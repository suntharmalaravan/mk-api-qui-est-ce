import type { Route } from 'next';
export const KINDS = ['all', 'duel', 'level', 'purchase', 'launch', 'legacy', 'other'] as const;
export const KIND_LABELS = { all: 'Toutes les opérations', duel: 'Gain de duel', level: 'Bonus de niveau', purchase: 'Achat atelier', launch: 'Initialisation', legacy: 'Ancienne récompense', other: 'Autre opération' };
export type LoupeFilters = { view: 'wallets' | 'journal' | 'rewards'; q: string; user: number | null; days: 7 | 30 | null; kind: typeof KINDS[number]; sort: 'balance' | 'earned' | 'spent'; page: number; before: string | null };
export function readLoupeFilters(raw: Record<string,string | string[] | undefined>): LoupeFilters {
  const one = (key: string) => typeof raw[key] === 'string' ? raw[key] : '';
  const id = one('user'), before = one('before');
  return {
    view: one('view') === 'journal' ? 'journal' : one('view') === 'rewards' ? 'rewards' : 'wallets',
    q: one('q').trim().slice(0,100),
    user: /^\d{1,10}$/.test(id) && Number(id)>0 && Number(id)<=2147483647 ? Number(id) : null,
    days: one('days') === '7' ? 7 : one('days') === 'all' ? null : 30,
    kind: KINDS.find(k => k === one('kind')) ?? 'all',
    sort: one('sort') === 'earned' ? 'earned' : one('sort') === 'spent' ? 'spent' : 'balance',
    page: Math.min(10000,Math.max(1,Math.floor(Number(one('page')))||1)),
    before: /^\d{1,19}$/.test(before) && BigInt(before)>0 && BigInt(before)<=9223372036854775807n ? before : null,
  };
}
export function loupeHref(filters: LoupeFilters, patch: Partial<LoupeFilters> = {}): Route {
  const f = { ...filters,...patch };const params = new URLSearchParams();
  params.set('view',f.view);params.set('days',f.days === null ? 'all' : String(f.days));
  if(f.q)params.set('q',f.q);if(f.user)params.set('user',String(f.user));
  if(f.kind!=='all')params.set('kind',f.kind);if(f.sort!=='balance')params.set('sort',f.sort);
  if(f.page>1)params.set('page',String(f.page));if(f.before)params.set('before',f.before);
  return `/loupes?${params}` as Route;
}
export function movementKind(source: string): Exclude<LoupeFilters['kind'],'all'> {
  return source.startsWith('duel:') ? 'duel' : source.startsWith('level:') ? 'level' : source.startsWith('purchase:') ? 'purchase' : source === 'loupe-launch-v1' ? 'launch' : source.startsWith('match:') ? 'legacy' : 'other';
}
const ITEMS: Record<string,string> = { 'backdrop-gold': 'Fond doré', 'hat-beret': 'Béret', 'glasses-rectangular': 'Lunettes lagon', 'neckwear-bowtie': 'Nœud papillon' };
export function movementLabel(source: string) {
  const kind = movementKind(source);
  if(kind === 'purchase') return ITEMS[source.slice(9)] ?? source.slice(9);
  if(kind === 'level') return `Niveau ${source.slice(6)}`;
  return KIND_LABELS[kind];
}
export function rewardReason(reason: string | null, factor?: number) {
  if(reason === 'too-short')return 'Duel de moins de 15 secondes';
  if(reason === 'opponent-limit')return 'Limite avec le même adversaire';
  if(reason === 'daily-limit')return 'Plafond quotidien atteint';
  return factor === .25 ? 'Adversaire répété · tarif à 25 %' : 'Barème normal';
}
export type RewardPayload = { amount?: number; duelAmount?: number; xp?: number; balanceAfter?: number; breakdown?: { base?: number; speed?: number; precision?: number; factor?: number; reason?: string | null }; levelUps?: { level: number; title: string; amount: number }[] };
