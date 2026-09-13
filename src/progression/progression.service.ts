import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type SummaryRow = {
  games_played: number | string;
  wins: number | string;
  direct_wins: number | string;
  max_win_streak: number | string;
};

type ContentRow = {
  characters_created: number | string;
  complete_decks: number | string;
};

type HistoryRow = {
  match_id: string;
  opponent: string;
  did_win: boolean;
  reason: string;
  played_at: Date | string;
};

type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  metric: keyof BadgeMetrics;
  target: number;
};

type BadgeMetrics = {
  gamesPlayed: number;
  wins: number;
  directWins: number;
  maxWinStreak: number;
  charactersCreated: number;
  completeDecks: number;
};

const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'first-duel',
    title: 'Première enquête',
    description: 'Terminer un premier duel en ligne.',
    metric: 'gamesPlayed',
    target: 1,
  },
  {
    id: 'sharp-eye',
    title: 'Œil de lynx',
    description: 'Gagner en trouvant directement le bon suspect.',
    metric: 'directWins',
    target: 1,
  },
  {
    id: 'hot-streak',
    title: 'Sur la piste',
    description: 'Enchaîner trois victoires consécutives.',
    metric: 'maxWinStreak',
    target: 3,
  },
  {
    id: 'veteran',
    title: 'Fin limier',
    description: 'Terminer dix duels en ligne.',
    metric: 'gamesPlayed',
    target: 10,
  },
  {
    id: 'creator',
    title: 'Portrait-robot',
    description: 'Créer un personnage dans l’atelier.',
    metric: 'charactersCreated',
    target: 1,
  },
  {
    id: 'decksmith',
    title: 'Casting complet',
    description: 'Composer un deck jouable d’au moins 18 cartes.',
    metric: 'completeDecks',
    target: 1,
  },
  {
    id: 'master-detective',
    title: 'Maître enquêteur',
    description: 'Remporter cinquante duels en ligne.',
    metric: 'wins',
    target: 50,
  },
] as const;

@Injectable()
export class ProgressionService {
  constructor(private readonly db: DataSource) {}

  async getForUser(userId: number) {
    const [summaryRows, contentRows, historyRows] = await Promise.all([
      this.db.query(
        `WITH player_matches AS (
           SELECT
             match_id,
             finished_at,
             reason,
             winner_id = $1 AS won
           FROM atelier_match_result
           WHERE winner_id = $1 OR loser_id = $1
         ), grouped AS (
           SELECT
             won,
             SUM(CASE WHEN won THEN 0 ELSE 1 END)
               OVER (ORDER BY finished_at, match_id) AS loss_group
           FROM player_matches
         ), streaks AS (
           SELECT COUNT(*)::int AS length
           FROM grouped
           WHERE won
           GROUP BY loss_group
         )
         SELECT
           COUNT(*)::int AS games_played,
           COUNT(*) FILTER (WHERE won)::int AS wins,
           COUNT(*) FILTER (WHERE won AND reason = 'guess')::int AS direct_wins,
           COALESCE((SELECT MAX(length) FROM streaks), 0)::int AS max_win_streak
         FROM player_matches`,
        [userId],
      ),
      this.db.query(
        `SELECT
           (SELECT COUNT(*) FROM atelier_character
             WHERE user_id = $1 AND deleted = false)::int AS characters_created,
           (SELECT COUNT(*) FROM deck d
             WHERE d.user_id = $1
               AND (SELECT COUNT(*) FROM image i WHERE i.deck_id = d.id) >= 18
           )::int AS complete_decks`,
        [userId],
      ),
      this.db.query(
        `SELECT
           result.match_id,
           CASE
             WHEN result.winner_id = $1 THEN loser.username
             ELSE winner.username
           END AS opponent,
           result.winner_id = $1 AS did_win,
           result.reason,
           result.finished_at AS played_at
         FROM atelier_match_result result
         JOIN "user" winner ON winner.id = result.winner_id
         JOIN "user" loser ON loser.id = result.loser_id
         WHERE result.winner_id = $1 OR result.loser_id = $1
         ORDER BY result.finished_at DESC, result.match_id DESC
         LIMIT 50`,
        [userId],
      ) as Promise<HistoryRow[]>,
    ]);

    const summary = (summaryRows[0] ?? {}) as SummaryRow;
    const content = (contentRows[0] ?? {}) as ContentRow;
    const wins = Number(summary.wins ?? 0);
    const gamesPlayed = Number(summary.games_played ?? 0);
    const metrics: BadgeMetrics = {
      gamesPlayed,
      wins,
      directWins: Number(summary.direct_wins ?? 0),
      maxWinStreak: Number(summary.max_win_streak ?? 0),
      charactersCreated: Number(content.characters_created ?? 0),
      completeDecks: Number(content.complete_decks ?? 0),
    };

    const earned = BADGES.filter(
      (badge) => metrics[badge.metric] >= badge.target,
    );
    let newlyUnlockedBadgeIds: string[] = [];
    if (earned.length > 0) {
      const inserted = (await this.db.query(
        `INSERT INTO player_badge(user_id, badge_id)
         SELECT $1, badge_id
         FROM unnest($2::text[]) AS badge_id
         ON CONFLICT (user_id, badge_id) DO NOTHING
         RETURNING badge_id`,
        [userId, earned.map((badge) => badge.id)],
      )) as Array<{ badge_id: string }>;
      newlyUnlockedBadgeIds = inserted.map((row) => row.badge_id);
    }

    const unlockRows = (await this.db.query(
      `SELECT badge_id, unlocked_at
       FROM player_badge
       WHERE user_id = $1`,
      [userId],
    )) as Array<{ badge_id: string; unlocked_at: Date | string }>;
    const unlocks = new Map(
      unlockRows.map((row) => [
        row.badge_id,
        new Date(row.unlocked_at).toISOString(),
      ]),
    );

    return {
      stats: {
        gamesPlayed,
        wins,
        losses: gamesPlayed - wins,
        winRate:
          gamesPlayed === 0 ? null : Math.round((wins / gamesPlayed) * 100),
      },
      recentMatches: historyRows.map((row) => ({
        id: row.match_id,
        opponent: row.opponent,
        didIWin: row.did_win,
        playedAt: new Date(row.played_at).toISOString(),
      })),
      badges: BADGES.map((badge) => ({
        id: badge.id,
        title: badge.title,
        description: badge.description,
        progress: Math.min(metrics[badge.metric], badge.target),
        target: badge.target,
        unlockedAt: unlocks.get(badge.id) ?? null,
      })),
      newlyUnlockedBadgeIds,
    };
  }
}
