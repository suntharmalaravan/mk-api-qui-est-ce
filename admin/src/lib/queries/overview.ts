import 'server-only';
import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';

export type Totals = {
  users: number;
  newUsers7d: number;
  activePlayers7d: number;
  matches7d: number;
  decks: number;
  newDecks7d: number;
  categories: number;
  hiddenCategories: number;
};

export async function getTotals() {
  await requireAdmin();
  const [totals] = await db()<Totals[]>`
    select
      (select count(*)::int from "user") as users,
      (select count(*)::int from "user" where created_at >= now() - interval '7 days') as new_users_7d,
      (select count(distinct player)::int
        from atelier_match_result m
        cross join lateral (values (m.winner_id), (m.loser_id)) as p(player)
        where m.finished_at >= now() - interval '7 days') as active_players_7d,
      (select count(*)::int from atelier_match_result where finished_at >= now() - interval '7 days') as matches_7d,
      (select count(*)::int from deck) as decks,
      (select count(*)::int from deck where created_at >= now() - interval '7 days') as new_decks_7d,
      (select count(distinct category)::int from image where user_id is null) as categories,
      (select count(distinct i.category)::int
        from image i
        join category_setting s on s.slug = i.category and not s.visible
        where i.user_id is null) as hidden_categories
  `;
  return totals!;
}

export type ActivityDay = { day: string; matches: number };

export const ACTIVITY_DAYS = 14;

/**
 * Parties terminées par jour calendaire de Paris. La jointure compare
 * finished_at à des bornes timestamptz : l'index sur finished_at reste utilisable.
 */
export async function getMatchActivity() {
  await requireAdmin();
  return db()<ActivityDay[]>`
    with days as (
      select day::date
      from generate_series(
        (now() at time zone 'Europe/Paris')::date - ${ACTIVITY_DAYS - 1}::int,
        (now() at time zone 'Europe/Paris')::date,
        interval '1 day'
      ) as day
    )
    select d.day::text as day, count(m.match_id)::int as matches
    from days d
    left join atelier_match_result m
      on m.finished_at >= (d.day::timestamp at time zone 'Europe/Paris')
     and m.finished_at < ((d.day + 1)::timestamp at time zone 'Europe/Paris')
    group by d.day
    order by d.day
  `;
}

export async function listRecentUsers(limit = 6) {
  await requireAdmin();
  return db()<{ id: number; username: string; imageUrl: string | null; score: number }[]>`
    select id, username, image_url, score from "user" order by id desc limit ${limit}
  `;
}

export async function listRecentDecks(limit = 6) {
  await requireAdmin();
  return db()<{ id: number; name: string; ownerName: string | null; createdAt: Date | null; previews: string[] }[]>`
    select d.id, d.name, owner.username as owner_name, d.created_at,
      coalesce((select (array_agg(i.url order by i.id))[1:3] from image i where i.deck_id = d.id), '{}') as previews
    from deck d
    left join "user" owner on owner.id = d.user_id
    order by d.id desc
    limit ${limit}
  `;
}
