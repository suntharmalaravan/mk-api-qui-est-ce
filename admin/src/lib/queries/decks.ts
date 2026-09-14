import 'server-only';
import { cache } from 'react';
import { requireAdmin } from '@/lib/auth/session';
import { db, type Sql } from '@/lib/db';
import { PAGE_SIZE, containsPattern, parseIdQuery } from '@/lib/params';

/** Bornes imposées par l'API (création) et par le trigger guard_deck_capacity. */
export const DECK_MIN_CARDS = 18;
export const DECK_MAX_CARDS = 21;

export const DECK_SORTS = ['recent', 'name', 'cards'] as const;
export type DeckSort = (typeof DECK_SORTS)[number];

export type DeckListItem = {
  id: number;
  name: string;
  createdAt: Date | null;
  userId: number;
  ownerName: string | null;
  ownerImageUrl: string | null;
  cards: number;
  previews: string[];
  atelier: boolean;
  total: number;
};

function orderBy(sql: Sql, sort: DeckSort) {
  switch (sort) {
    case 'name':
      return sql`lower(d.name), d.id`;
    case 'cards':
      return sql`(select count(*) from image i where i.deck_id = d.id) desc, d.id desc`;
    case 'recent':
      return sql`d.id desc`;
  }
}

/** Même découpage que listUsers : page d'identifiants d'abord, agrégats ensuite. */
export async function listDecks({
  q = '',
  sort = 'recent',
  offset = 0,
  userId,
}: {
  q?: string;
  sort?: DeckSort;
  offset?: number;
  userId?: number;
}) {
  await requireAdmin();
  const sql = db();
  const id = parseIdQuery(q);
  const pattern = containsPattern(q);

  const rows = await sql<DeckListItem[]>`
    with page as (
      select d.id,
        (count(*) over ())::int as total,
        row_number() over (order by ${orderBy(sql, sort)}) as position
      from deck d
      left join "user" owner on owner.id = d.user_id
      where true
        ${userId ? sql`and d.user_id = ${userId}` : sql``}
        ${q ? sql`and (d.name ilike ${pattern} or owner.username ilike ${pattern} ${id ? sql`or d.id = ${id}` : sql``})` : sql``}
      order by position
      limit ${PAGE_SIZE} offset ${offset}
    )
    select d.id, d.name, d.created_at, d.user_id, p.total,
      owner.username as owner_name, owner.image_url as owner_image_url,
      c.cards, c.previews, c.atelier
    from page p
    join deck d on d.id = p.id
    left join "user" owner on owner.id = d.user_id
    cross join lateral (
      select count(*)::int as cards,
        coalesce((array_agg(i.url order by i.id))[1:4], '{}') as previews,
        coalesce(bool_or(i.atelier_visible_key is not null), false) as atelier
      from image i
      where i.deck_id = d.id
    ) c
    order by p.position
  `;

  return { rows, total: rows[0]?.total ?? 0 };
}

export type DeckDetail = {
  id: number;
  name: string;
  createdAt: Date | null;
  userId: number;
  ownerName: string | null;
  ownerImageUrl: string | null;
};

export const getDeck = cache(async (id: number) => {
  await requireAdmin();
  const [deck] = await db()<DeckDetail[]>`
    select d.id, d.name, d.created_at, d.user_id,
      owner.username as owner_name, owner.image_url as owner_image_url
    from deck d
    left join "user" owner on owner.id = d.user_id
    where d.id = ${id}
  `;
  return deck ?? null;
});

export type DeckCard = {
  id: number;
  name: string;
  url: string;
  atelier: boolean;
};

export async function listDeckCards(deckId: number) {
  await requireAdmin();
  return db()<DeckCard[]>`
    select id, name, url, atelier_visible_key is not null as atelier
    from image
    where deck_id = ${deckId}
    order by id
  `;
}
