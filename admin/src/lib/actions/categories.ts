'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';

export type ActionResult = { ok: true } | { ok: false; error: string };

const input = z.object({
  // Même contrainte que l'API sur les noms de catégorie (lobby.service).
  slug: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
  visible: z.boolean(),
});

export async function setCategoryVisibility(slug: string, visible: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = input.safeParse({ slug, visible });
  if (!parsed.success) return { ok: false, error: 'Catégorie invalide.' };

  // N'enregistre un réglage que pour une catégorie réellement présente au catalogue.
  const [row] = await db()`
    insert into category_setting (slug, visible, updated_at)
    select ${parsed.data.slug}, ${parsed.data.visible}, now()
    where exists (select 1 from image where category = ${parsed.data.slug} and user_id is null)
    on conflict (slug) do update set visible = excluded.visible, updated_at = now()
    returning slug
  `;
  if (!row) return { ok: false, error: 'Cette catégorie n’existe plus au catalogue.' };

  revalidatePath('/categories');
  revalidatePath('/');
  return { ok: true };
}
