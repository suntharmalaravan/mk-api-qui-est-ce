import 'server-only';
import { requireAdmin } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { loupeQueries } from './loupe-sql';
import type { LoupeFilters } from '@/lib/loupes';
export async function getLoupeTotals(f: LoupeFilters) { await requireAdmin();return loupeQueries(db()).totals(f); }
export async function listLoupeWallets(f: LoupeFilters) { await requireAdmin();return loupeQueries(db()).wallets(f); }
export async function listLoupeLedger(f: LoupeFilters) { await requireAdmin();return loupeQueries(db()).ledger(f); }
export async function listLoupeRewards(f: LoupeFilters) { await requireAdmin();return loupeQueries(db()).rewards(f); }
