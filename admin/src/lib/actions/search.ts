'use server';

import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { containsPattern, parseIdQuery } from '@/lib/params';

export type SearchHit =
  | { kind: 'user'; id: number; title: string; imageUrl: string | null; score: number }
  | { kind: 'deck'; id: number; title: string; ownerName: string | null };

export async function searchEverything(query: string): Promise<SearchHit[]> {
  await requireAdmin();
  const q = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  if (!q) return [];

  const sql = db();
  const pattern = containsPattern(q);
  const id = parseIdQuery(q);

  const [users, decks] = await Promise.all([
    sql<{ id: number; username: string; imageUrl: string | null; score: number }[]>`
      select id, username, image_url, score
      from "user"
      where username ilike ${pattern} ${id ? sql`or id = ${id}` : sql``}
      order by lower(username) = lower(${q}) desc, score desc
      limit 6
    `,
    sql<{ id: number; name: string; ownerName: string | null }[]>`
      select d.id, d.name, owner.username as owner_name
      from deck d
      left join "user" owner on owner.id = d.user_id
      where d.name ilike ${pattern} ${id ? sql`or d.id = ${id}` : sql``}
      order by d.id desc
      limit 5
    `,
  ]);

  return [
    ...users.map((u) => ({ kind: 'user' as const, id: u.id, title: u.username, imageUrl: u.imageUrl, score: u.score })),
    ...decks.map((d) => ({ kind: 'deck' as const, id: d.id, title: d.name, ownerName: d.ownerName })),
  ];
}
