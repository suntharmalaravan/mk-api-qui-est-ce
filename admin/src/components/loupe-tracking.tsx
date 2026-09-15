import Link from 'next/link';
import { LoupeAmount, LoupeIcon } from '@/components/ui/loupe';
import { StatTile } from '@/components/stat-tile';
import { Table, thClass, tdClass } from '@/components/ui/table';
import { Time } from '@/components/ui/time';
import { formatNumber, formatDateTime } from '@/lib/format';
import { getLoupeTotals } from '@/lib/queries/loupes';
import type { LedgerRow, RewardRow } from '@/lib/queries/loupe-sql';
import { readLoupeFilters, KIND_LABELS, movementKind, movementLabel, rewardReason, type RewardPayload, type LoupeFilters } from '@/lib/loupes';
export async function LoupeMetrics({ filters }: { filters: LoupeFilters }) {
  const t = await getLoupeTotals(filters);
  const period = filters.days ? `${filters.days} derniers jours glissants` : 'tout l’historique';
  return <section aria-label="Indicateurs des loupes">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Solde actuel" value={t.balance} detail={`${formatNumber(t.holders)} joueurs avec des loupes sur ${formatNumber(t.players)}`} />
      <Metric label="Loupes gagnées" value={t.earned} detail={period} />
      <Metric label="Dépensées à l’atelier" value={t.spent} detail={period} />
      <StatTile label="Opérations enregistrées" value={formatNumber(t.operations)} detail={period} />
    </div>
    {t.adjustments!==0 && <p className="mt-3 text-xs text-subtle">{formatNumber(t.adjustments)} loupes d’ajustements, dont l’initialisation à zéro, hors dépenses d’atelier.</p>}
  </section>;
}
function Metric({ label,value,detail }: { label: string;value: number;detail: string }) {
  return <dl className="rounded-lg border border-line bg-panel p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold text-fg"><LoupeAmount amount={value} /></dd><dd className="mt-1 text-xs text-subtle">{detail}</dd></dl>;
}
function Breakdown({ payload }: { payload: RewardPayload }) {
  const b = payload.breakdown;
  return <div className="mt-3 space-y-2 text-xs leading-5 text-muted">
    <p>Barème avant limites : duel {b?.base ?? 0} · rapidité {b?.speed ?? 0} · précision {b?.precision ?? 0}.</p>
    <p>{rewardReason(b?.reason ?? null,b?.factor)}. Crédit de duel effectif : {payload.duelAmount ?? 0} loupes.</p>
    {!!payload.levelUps?.length && <p>Bonus de niveau (opérations séparées) : {payload.levelUps.map(l => `niveau ${l.level} +${l.amount}`).join(' · ')}.</p>}
    <p>{payload.xp ?? 0} XP attribués.</p>
  </div>;
}
export function LoupeLedger({ rows }: { rows: LedgerRow[] }) {
  if(!rows.length)return <Empty />;
  return <Table><thead><tr>{['Date','Joueur','Opération','Mouvement','Solde après'].map(label=><th key={label} className={thClass}>{label}</th>)}</tr></thead><tbody>
    {rows.map(row=><tr key={row.id} className="align-top transition-colors hover:bg-white/[0.025]">
      <td className={`${tdClass} py-3 text-xs text-muted`}><span title={formatDateTime(row.createdAt)}><Time date={row.createdAt} /></span></td>
      <td className={`${tdClass} py-3`}><Link href={`/users/${row.userId}`} className="text-fg hover:text-accent-fg">{row.username}</Link><div className="font-mono text-2xs text-subtle">#{row.userId}</div></td>
      <td className={`${tdClass} max-w-md py-3 !whitespace-normal`}><details><summary className="cursor-pointer text-fg">{movementLabel(row.source)}<span className="mt-1 block text-2xs text-subtle">{KIND_LABELS[movementKind(row.source)]} · #{row.id}</span></summary>
        <p className="mt-2 break-all font-mono text-2xs text-subtle">{row.source}</p><p className="mt-1 text-xs text-subtle">{formatDateTime(row.createdAt)}</p>
        {row.payload && <Breakdown payload={row.payload} />}
      </details></td>
      <td className={`${tdClass} py-3 ${row.amount>0?'text-success':'text-muted'}`}><LoupeAmount amount={row.amount} signed /></td>
      <td className={`${tdClass} py-3 text-fg`}><LoupeAmount amount={row.balanceAfter} /></td>
    </tr>)}
  </tbody></Table>;
}
export function LoupeRewards({ rows }: { rows: RewardRow[] }) {
  if(!rows.length)return <Empty />;
  return <Table><thead><tr>{['Date','Joueur','Duel / attribution','Total crédité','Notification'].map(label=><th key={label} className={thClass}>{label}</th>)}</tr></thead><tbody>
    {rows.map(row=><tr key={row.id} className="align-top transition-colors hover:bg-white/[0.025]">
      <td className={`${tdClass} py-3 text-xs text-muted`}><Time date={row.createdAt} /></td>
      <td className={`${tdClass} py-3`}><Link href={`/users/${row.userId}`} className="hover:text-accent-fg">{row.username}</Link><div className="text-2xs text-subtle">#{row.userId}</div></td>
      <td className={`${tdClass} max-w-md py-3 !whitespace-normal`}><details><summary className="cursor-pointer">{rewardReason(row.payload.breakdown?.reason ?? null,row.payload.breakdown?.factor)}</summary><p className="mt-2 break-all font-mono text-2xs text-subtle">Duel {row.matchId}</p><Breakdown payload={row.payload} /></details></td>
      <td className={`${tdClass} py-3`}><LoupeAmount amount={row.payload.amount ?? 0} /></td>
      <td className={`${tdClass} py-3 text-xs text-muted`}>{row.acknowledgedAt ? (row.payload.amount ?? 0) === 0 && !row.payload.levelUps?.length ? 'Clôturée sans gain' : 'Acquittée' : 'En attente'}<div className="text-2xs text-subtle">Les gains sont déjà enregistrés</div></td>
    </tr>)}
  </tbody></Table>;
}
function Empty() { return <p className="px-4 py-12 text-center text-sm text-subtle">Aucune opération pour ces filtres.</p>; }

export async function LoupeOverview() {
  const totals=await getLoupeTotals(readLoupeFilters({days:'7'}));
  return <Link href="/loupes" className="mt-6 flex flex-wrap items-center gap-5 rounded-lg border border-line bg-panel p-4 transition-colors hover:border-line-strong"><LoupeIcon size={52} /><div className="mr-auto"><h2 className="text-sm font-medium">Loupes</h2><p className="mt-1 text-xs text-subtle">Soldes, gains et dépenses →</p></div><dl><dt className="text-xs text-muted">En circulation</dt><dd className="mt-1 text-lg font-semibold">{formatNumber(totals.balance)}</dd></dl><dl><dt className="text-xs text-muted">Gagnées · 7 jours</dt><dd className="mt-1 text-lg font-semibold text-success">+{formatNumber(totals.earned)}</dd></dl><dl><dt className="text-xs text-muted">Dépensées · 7 jours</dt><dd className="mt-1 text-lg font-semibold">{formatNumber(totals.spent)}</dd></dl></Link>;
}
