import 'server-only';
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
