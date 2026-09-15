import 'server-only';
import { cache } from 'react';
import { requireAdmin } from '@/lib/auth/session';
import { db, type Sql } from '@/lib/db';
import { PAGE_SIZE, containsPattern, parseIdQuery } from '@/lib/params';

export const USER_SORTS = ['recent', 'score', 'decks', 'wins', 'name', 'loupes'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export type UserListItem = {
  loupes: number;
  id: number;
  username: string;
  score: number;
  imageUrl: string | null;
  createdAt: Date | null;
  level: string | null;
  decks: number;
  wins: number;
  losses: number;
  total: number;
};

function orderBy(sql: Sql, sort: UserSort) {
  switch (sort) {
    case 'loupes':
      return sql`coalesce((select balance from atelier_account a where a.user_id=u.id),0) desc,u.id desc`;
    case 'score':
      return sql`u.score desc, u.id desc`;
    case 'decks':
      return sql`(select count(*) from deck d where d.user_id = u.id) desc, u.id desc`;
    case 'wins':
      return sql`(select count(*) from atelier_match_result m where m.winner_id = u.id) desc, u.id desc`;
    case 'name':
      return sql`lower(u.username), u.id`;
    case 'recent':
      return sql`u.id desc`;
  }
}

/**
 * Deux temps : la page de 50 identifiants est d'abord choisie (seul le tri
 * éventuel lit les agrégats), puis les statistiques ne sont calculées que pour
 * ces lignes, via les index deck(user_id) et atelier_match_result(winner/loser).
 */
export async function listUsers({ q, sort, offset }: { q: string; sort: UserSort; offset: number }) {
  await requireAdmin();
  const sql = db();
  const id = parseIdQuery(q);
  const filter = q
    ? sql`where u.username ilike ${containsPattern(q)} ${id ? sql`or u.id = ${id}` : sql``}`
    : sql``;

  const rows = await sql<UserListItem[]>`
    with page as (
      select u.id,
        (count(*) over ())::int as total,
        row_number() over (order by ${orderBy(sql, sort)}) as position
      from "user" u
      ${filter}
      order by position
      limit ${PAGE_SIZE} offset ${offset}
    )
    select u.id, u.username, u.score, u.image_url, u.created_at, p.total, lvl.title as level,
      coalesce((select balance from atelier_account a where a.user_id=u.id),0) as loupes,
      (select count(*)::int from deck d where d.user_id = u.id) as decks,
      (select count(*)::int from atelier_match_result m where m.winner_id = u.id) as wins,
      (select count(*)::int from atelier_match_result m where m.loser_id = u.id) as losses
    from page p
    join "user" u on u.id = p.id
    left join lateral (
      select l.title from "level" l where l.score <= u.score order by l.score desc limit 1
    ) lvl on true
    order by p.position
  `;

  return { rows, total: rows[0]?.total ?? 0 };
}

export type UserDetail = {
  id: number;
  username: string;
  score: number;
  imageUrl: string | null;
  createdAt: Date | null;
  level: string | null;
  decks: number;
  cards: number;
  wins: number;
  losses: number;
  badges: number;
  characters: number;
  coins: number | null;
  lastMatchAt: Date | null;
};

export const getUser = cache(async (id: number) => {
  await requireAdmin();
  const [user] = await db()<UserDetail[]>`
    select u.id, u.username, u.score, u.image_url, u.created_at, lvl.title as level,
      (select count(*)::int from deck where user_id = u.id) as decks,
      (select count(*)::int from image where user_id = u.id) as cards,
      (select count(*)::int from atelier_match_result where winner_id = u.id) as wins,
      (select count(*)::int from atelier_match_result where loser_id = u.id) as losses,
      (select count(*)::int from player_badge where user_id = u.id) as badges,
      (select count(*)::int from atelier_character where user_id = u.id and not deleted) as characters,
      (select balance from atelier_account where user_id = u.id) as coins,
      (select max(finished_at) from atelier_match_result where winner_id = u.id or loser_id = u.id) as last_match_at
    from "user" u
    left join lateral (
      select l.title from "level" l where l.score <= u.score order by l.score desc limit 1
    ) lvl on true
    where u.id = ${id}
  `;
  return user ?? null;
});

export type UserMatch = {
  matchId: string;
  finishedAt: Date;
  reason: string;
  won: boolean;
  opponentId: number;
  opponentName: string;
  opponentImageUrl: string | null;
};

export async function listUserMatches(userId: number, limit = 12) {
  await requireAdmin();
  return db()<UserMatch[]>`
    select m.match_id, m.finished_at, m.reason, m.winner_id = ${userId} as won,
      o.id as opponent_id, o.username as opponent_name, o.image_url as opponent_image_url
    from atelier_match_result m
    join "user" o on o.id = case when m.winner_id = ${userId} then m.loser_id else m.winner_id end
    where m.winner_id = ${userId} or m.loser_id = ${userId}
    order by m.finished_at desc
    limit ${limit}
  `;
}
