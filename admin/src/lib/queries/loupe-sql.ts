import 'server-only';
import type { Sql } from '@/lib/db';
import { containsPattern, PAGE_SIZE, parseIdQuery } from '@/lib/params';
import type { LoupeFilters, RewardPayload } from '@/lib/loupes';
export type WalletRow = { id: number; username: string; balance: number; earned: number; spent: number; operations: number; lastAt: Date | null; total: number };
export type LoupeTotals = { balance: number; holders: number; players: number; earned: number; spent: number; operations: number; adjustments: number };
export type LedgerRow = { id: string; userId: number; username: string; source: string; amount: number; balanceAfter: number; createdAt: Date; payload: RewardPayload | null };
export type RewardRow = { id: string; userId: number; username: string; matchId: string; createdAt: Date; acknowledgedAt: Date | null; payload: RewardPayload };
// Only called through the authenticated query boundary in queries/loupes.ts.
export function loupeQueries(sql: Sql) {
  const people = (f: LoupeFilters) => sql`(${f.user}::integer is null or u.id=${f.user}) and (${f.q}='' or u.username ilike ${containsPattern(f.q)} or u.id=${parseIdQuery(f.q)})`;
  const period = (f: LoupeFilters) => sql`(${f.days}::integer is null or l.created_at>=now()-${f.days}::integer*interval '1 day')`;
  const kind = sql`case when l.source like 'duel:%' then 'duel' when l.source like 'level:%' then 'level' when l.source like 'purchase:%' then 'purchase' when l.source='loupe-launch-v1' then 'launch' when l.source like 'match:%' then 'legacy' else 'other' end`;
  return {
    async totals(f: LoupeFilters) {
      const [row] = await sql<LoupeTotals[]>`
        with players as (select u.id,coalesce(a.balance,0) as balance from "user" u left join atelier_account a on a.user_id=u.id where ${people(f)}),
        flows as (select l.* from atelier_ledger l join players p on p.id=l.user_id where ${period(f)})
        select (select coalesce(sum(balance),0)::float8 from players) as balance,
          (select count(*)::int from players where balance>0) as holders,
          (select count(*)::int from players) as players,
          coalesce(sum(amount) filter(where amount>0),0)::float8 as earned,
          coalesce(sum(-amount) filter(where amount<0 and source like 'purchase:%'),0)::float8 as spent,
          count(*)::int as operations,
          coalesce(sum(amount) filter(where amount<0 and source not like 'purchase:%'),0)::float8 as adjustments from flows`;
      return row!;
    },
    async wallets(f: LoupeFilters) {
      const order = f.sort === 'earned' ? sql`earned desc` : f.sort === 'spent' ? sql`spent desc` : sql`balance desc`;
      // Aggregate the ledger once, not a separate unbounded history scan per player.
      return sql<WalletRow[]>`
        with flows as (select l.user_id,sum(greatest(l.amount,0))::float8 as earned,
          coalesce(sum(-l.amount) filter(where l.amount<0 and l.source like 'purchase:%'),0)::float8 as spent,
          count(*)::int as operations,max(l.created_at) as last_at
          from atelier_ledger l join "user" u on u.id=l.user_id where ${people(f)} and ${period(f)} group by l.user_id)
        select u.id,u.username,coalesce(a.balance,0) as balance,coalesce(f.earned,0)::float8 as earned,
          coalesce(f.spent,0)::float8 as spent,coalesce(f.operations,0) as operations,f.last_at,count(*) over()::int as total
        from "user" u left join atelier_account a on a.user_id=u.id left join flows f on f.user_id=u.id
        where ${people(f)} order by ${order},u.id desc limit ${PAGE_SIZE} offset ${(f.page-1)*PAGE_SIZE}`;
    },
    async ledger(f: LoupeFilters) {
      return sql<LedgerRow[]>`
        with page as (select l.id,l.user_id,u.username,l.source,l.amount,l.balance_after,l.created_at
          from atelier_ledger l join "user" u on u.id=l.user_id
          where ${people(f)} and ${period(f)} and (${f.kind}='all' or ${kind}=${f.kind})
            and (${f.before}::bigint is null or l.id<${f.before}::bigint)
          order by l.id desc limit ${PAGE_SIZE+1})
        select l.id::text,l.user_id,l.username,l.source,l.amount,l.balance_after,l.created_at,r.payload
        from page l left join loupe_reward r on r.user_id=l.user_id and r.match_id=case
          when l.source ~ '^duel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then substring(l.source from 6)::uuid end
        order by l.id desc`;
    },
    async rewards(f: LoupeFilters) {
      return sql<RewardRow[]>`select l.id::text,l.user_id,u.username,l.match_id,l.created_at,l.acknowledged_at,l.payload
        from loupe_reward l join "user" u on u.id=l.user_id
        where ${people(f)} and ${period(f)} and (${f.before}::bigint is null or l.id<${f.before}::bigint)
        order by l.id desc limit ${PAGE_SIZE+1}`;
    },
  };
}
