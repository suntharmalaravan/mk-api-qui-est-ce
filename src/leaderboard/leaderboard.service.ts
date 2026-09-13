import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** A ranking day starts and ends at midnight, Paris time. */
export const LEADERBOARD_TIME_ZONE = 'Europe/Paris';
/** Days that can be browsed, today included. Older days are not served. */
export const LEADERBOARD_MAX_DAYS = 14;
/** Entries returned; the caller's own rank is resolved beyond it. */
export const LEADERBOARD_TOP = 50;

/** Today's ranking still moves: short cache, a finished match shows up fast. */
const TODAY_TTL_MS = 30_000;
/** A past day is final; only renames and avatars can still change it. */
const PAST_TTL_MS = 10 * 60_000;
const DAYS_TTL_MS = 60_000;
const MAX_CACHED_RANKINGS = LEADERBOARD_MAX_DAYS + 2;

export type LeaderboardEntry = {
  rank: number;
  userId: number;
  username: string;
  imageUrl: string | null;
  wins: number;
  games: number;
};

export type LeaderboardDay = {
  date: string;
  /** Players with at least one win that day — the ones who get ranked. */
  players: number;
};

type RankingRow = {
  user_id: number | string;
  username: string;
  image_url: string | null;
  wins: number | string;
  games: number | string;
  rank: number | string;
};

type DayRow = { day: string; players: number | string };

type CacheEntry<T> = { value: Promise<T>; expiresAt: number };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` of `at` in the leaderboard time zone. */
export function dayInTimeZone(
  at: Date,
  timeZone = LEADERBOARD_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Calendar arithmetic on `YYYY-MM-DD`, immune to DST. */
export function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects 2026-02-30, which Date silently rolls over to March.
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

@Injectable()
export class LeaderboardService {
  private readonly rankings = new Map<string, CacheEntry<LeaderboardEntry[]>>();
  private readonly activeDays = new Map<string, CacheEntry<LeaderboardDay[]>>();

  constructor(private readonly db: DataSource) {}

  /** Overridable clock, so tests can cross midnight. */
  protected now(): Date {
    return new Date();
  }

  async getDaily(userId: number, requestedDay?: string) {
    const today = dayInTimeZone(this.now());
    const oldest = shiftDay(today, -(LEADERBOARD_MAX_DAYS - 1));
    const date = requestedDay || today;

    if (!isValidDay(date) || date < oldest || date > today) {
      throw new BadRequestException(
        `date must be a day between ${oldest} and ${today}`,
      );
    }

    const [days, ranking] = await Promise.all([
      this.remember(this.activeDays, today, DAYS_TTL_MS, 2, () =>
        this.loadDays(today, oldest),
      ),
      this.remember(
        this.rankings,
        date,
        date === today ? TODAY_TTL_MS : PAST_TTL_MS,
        MAX_CACHED_RANKINGS,
        () => this.loadRanking(date),
      ),
    ]);

    return {
      timeZone: LEADERBOARD_TIME_ZONE,
      today,
      date,
      maxDays: LEADERBOARD_MAX_DAYS,
      days,
      totalPlayers: ranking.length,
      entries: ranking.slice(0, LEADERBOARD_TOP),
      me: ranking.find((entry) => entry.userId === userId) ?? null,
    };
  }

  /**
   * Days with at least one ranked player, newest first. Today is always
   * listed, even empty: it is the day players can still climb.
   */
  private async loadDays(
    today: string,
    oldest: string,
  ): Promise<LeaderboardDay[]> {
    const rows = (await this.db.query(
      `SELECT
         to_char((finished_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS day,
         COUNT(DISTINCT winner_id)::int AS players
       FROM atelier_match_result
       WHERE finished_at >= ($2::date::timestamp AT TIME ZONE $1)
       GROUP BY 1
       ORDER BY 1 DESC`,
      [LEADERBOARD_TIME_ZONE, oldest],
    )) as DayRow[];

    const days = rows
      .map((row) => ({ date: row.day, players: Number(row.players) }))
      .filter(
        (day) =>
          day.date >= oldest && day.date <= today && day.players > 0,
      );
    if (days[0]?.date !== today) days.unshift({ date: today, players: 0 });
    return days;
  }

  /**
   * The full ranking of one day. Players without a win are excluded.
   *
   * Ties: fewer games played first (the more efficient day), then whoever
   * reached that win count first, then the older account — so every rank
   * is unique and the podium never has two players on the same step.
   */
  private async loadRanking(date: string): Promise<LeaderboardEntry[]> {
    const rows = (await this.db.query(
      `WITH day_matches AS (
         SELECT winner_id, loser_id, finished_at
         FROM atelier_match_result
         WHERE finished_at >= ($1::date::timestamp AT TIME ZONE $2)
           AND finished_at < (($1::date + 1)::timestamp AT TIME ZONE $2)
       ), participations AS (
         SELECT winner_id AS user_id, 1 AS win, finished_at FROM day_matches
         UNION ALL
         SELECT loser_id, 0, NULL FROM day_matches
       ), totals AS (
         SELECT
           user_id,
           SUM(win)::int AS wins,
           COUNT(*)::int AS games,
           MAX(finished_at) AS last_win_at
         FROM participations
         GROUP BY user_id
         HAVING SUM(win) > 0
       )
       SELECT
         t.user_id,
         u.username,
         u.image_url,
         t.wins,
         t.games,
         ROW_NUMBER() OVER (
           ORDER BY t.wins DESC, t.games ASC, t.last_win_at ASC, t.user_id ASC
         )::int AS rank
       FROM totals t
       JOIN "user" u ON u.id = t.user_id
       ORDER BY rank`,
      [date, LEADERBOARD_TIME_ZONE],
    )) as RankingRow[];

    return rows.map((row) => ({
      rank: Number(row.rank),
      userId: Number(row.user_id),
      username: row.username,
      imageUrl: row.image_url || null,
      wins: Number(row.wins),
      games: Number(row.games),
    }));
  }

  /**
   * Bounded LRU of promises. Caching the promise, not its result, means a
   * burst of identical requests shares one query instead of stampeding the
   * database; a failed load is evicted so the next request retries.
   */
  private remember<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    ttl: number,
    capacity: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      cache.delete(key);
      cache.set(key, hit);
      return hit.value;
    }

    const value = load().catch((error) => {
      if (cache.get(key)?.value === value) cache.delete(key);
      throw error;
    });
    cache.delete(key);
    cache.set(key, { value, expiresAt: now + ttl });
    while (cache.size > capacity) {
      cache.delete(cache.keys().next().value as string);
    }
    return value;
  }
}
