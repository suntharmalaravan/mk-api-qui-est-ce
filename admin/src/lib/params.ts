import type { Route } from 'next';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const PAGE_SIZE = 50;

export type ListParams<S extends string> = { q: string; sort: S; page: number; offset: number };

export function readListParams<S extends string>(
  raw: Record<string, string | string[] | undefined>,
  sorts: readonly S[],
  fallback: S,
): ListParams<S> {
  const one = (key: string) => (typeof raw[key] === 'string' ? raw[key] : undefined);
  const q = (one('q') ?? '').trim().slice(0, 100);
  const requestedPage = Number(one('page'));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const requestedSort = one('sort');
  const sort = sorts.find((candidate) => candidate === requestedSort) ?? fallback;
  return { q, sort, page, offset: (page - 1) * PAGE_SIZE };
}

/** Identifiant de ligne Postgres (int4) passé dans l'URL. */
export function parseId(raw: string) {
  return /^\d{1,9}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

/** `#42` ou `42` recherche aussi par identifiant. */
export function parseIdQuery(q: string) {
  return /^#?\d{1,9}$/.test(q) ? Number(q.replace('#', '')) : null;
}

/** Motif ILIKE « contient », jokers de l'utilisateur échappés. */
export function containsPattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** URL d'une liste, sans les paramètres restés à leur valeur par défaut. */
export function listHref(
  pathname: string,
  state: Record<string, string | number>,
  defaults: Record<string, string | number>,
): Route {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value !== '' && value !== defaults[key]) query.set(key, String(value));
  }
  const search = query.toString();
  return (search ? `${pathname}?${search}` : pathname) as Route;
}
