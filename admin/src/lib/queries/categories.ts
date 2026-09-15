import 'server-only';
import { cache } from 'react';
import { PAGE_SIZE, containsPattern } from '@/lib/params';
import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';

/** Une partie refuse de démarrer sous ce nombre de cartes (room.gateway, lobby.service). */
export const CATEGORY_MIN_CARDS = 18;

export type Category = {
  slug: string;
  cards: number;
  previews: string[];
  visible: boolean;
  updatedAt: Date | null;
};

/**
 * Une catégorie n'est pas une table : ce sont les valeurs distinctes de
 * image.category du catalogue officiel (user_id null). Sans ligne dans
 * category_setting, elle est visible.
 */
export async function listCategories() {
  await requireAdmin();
  return db()<Category[]>`
    select i.category as slug,
      count(*)::int as cards,
      (array_agg(i.url order by i.id))[1:4] as previews,
      coalesce(s.visible, true) as visible,
      s.updated_at
    from image i
    left join category_setting s on s.slug = i.category
    where i.user_id is null and i.category is not null
    group by i.category, s.visible, s.updated_at
    order by i.category
  `;
}

export const getCategory = cache(async (slug: string) => {
  await requireAdmin();
  const [category] = await db()<Category[]>`
    select i.category as slug, count(*)::int as cards,
      (array_agg(i.url order by i.id))[1:4] as previews,
      coalesce(s.visible, true) as visible, s.updated_at
    from image i
    left join category_setting s on s.slug = i.category
    where i.user_id is null and i.category = ${slug}
    group by i.category, s.visible, s.updated_at
  `;
  return category ?? null;
});

export type CategoryCard = { id: number; name: string; url: string; total: number };

export async function listCategoryCards(slug: string, { q = '', offset = 0 }: { q?: string; offset?: number } = {}) {
  await requireAdmin();
  const sql = db();
  const rows = await sql<CategoryCard[]>`
    select id, coalesce(nullif(btrim(name), ''), 'Personnage #' || id) as name,
      url, (count(*) over ())::int as total
    from image
    where user_id is null and category = ${slug}
      ${q ? sql`and coalesce(nullif(btrim(name), ''), 'Personnage #' || id) ilike ${containsPattern(q)}` : sql``}
    order by id
    limit ${PAGE_SIZE} offset ${offset}
  `;
  return { rows, total: rows[0]?.total ?? 0 };
}
