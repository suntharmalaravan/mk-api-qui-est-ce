import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { LoupeAmount, LoupeIcon } from '@/components/ui/loupe';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, thClass, tdClass } from '@/components/ui/table';
import { Time } from '@/components/ui/time';
import { LoupeLedger, LoupeMetrics, LoupeRewards } from '@/components/loupe-tracking';
import { KINDS, KIND_LABELS, readLoupeFilters, loupeHref, type LoupeFilters } from '@/lib/loupes';
import { listLoupeWallets, listLoupeLedger, listLoupeRewards } from '@/lib/queries/loupes';
import { PAGE_SIZE, type SearchParams } from '@/lib/params';
export const metadata: Metadata = { title: 'Loupes' };
const control = 'h-9 rounded-md border border-line bg-panel px-3 text-sm text-fg';
export default async function LoupesPage({ searchParams }: { searchParams: SearchParams }) {
  const f = readLoupeFilters(await searchParams);
  return <>
    <PageHeader title="Loupes"><LoupeIcon size={36} /></PageHeader>
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 md:px-8">
      <div className="flex items-center gap-4"><LoupeIcon size={64} /><div><h2 className="text-xl font-semibold tracking-tight">L’économie du Bureau</h2><p className="mt-1 text-sm text-muted">Qui gagne, qui dépense, et où vont les loupes.</p></div></div>
      <form action="/loupes" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value={f.view} />
        {f.user && <input type="hidden" name="user" value={f.user} />}
        <label className="grid gap-1.5 text-xs text-muted">Joueur<input name="q" defaultValue={f.q} placeholder="Pseudo ou #id" maxLength={100} className={control} /></label>
        <label className="grid gap-1.5 text-xs text-muted">Période<select name="days" defaultValue={f.days ?? 'all'} className={control}><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="all">Tout l’historique</option></select></label>
        {f.view==='journal' && <label className="grid gap-1.5 text-xs text-muted">Opération<select name="kind" defaultValue={f.kind} className={control}>{KINDS.map(k=><option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>}
        {f.view==='wallets' && <label className="grid gap-1.5 text-xs text-muted">Trier par<select name="sort" defaultValue={f.sort} className={control}><option value="balance">Plus gros solde</option><option value="earned">Plus de gains</option><option value="spent">Plus de dépenses</option></select></label>}
        <button className={`${control} bg-accent/15 hover:bg-accent/25`}>Appliquer / actualiser</button>
        <Link href="/loupes" className="py-2 text-xs text-muted hover:text-fg">Réinitialiser</Link>
      </form>
      {f.user && <p className="text-sm text-muted">Suivi du <Link href={`/users/${f.user}`} className="text-accent-fg">joueur #{f.user}</Link> · <Link href={loupeHref(f,{user:null,before:null,page:1})} className="underline">Voir tous les joueurs</Link></p>}
      <Suspense key={`metrics-${f.user}-${f.q}-${f.days}`} fallback={<TableSkeleton />}><LoupeMetrics filters={f} /></Suspense>
      <p className="text-xs text-subtle">Le solde est actuel. Les flux couvrent la période et les joueurs sélectionnés, tous types d’opérations confondus.</p>
      <section className="overflow-hidden rounded-lg border border-line bg-panel">
        <nav aria-label="Suivi des loupes" className="flex flex-wrap items-center gap-1 border-b border-line p-2">
          {(['wallets','journal','rewards'] as const).map(view=><Link key={view} href={loupeHref(f,{view,page:1,before:null,kind:'all'})} aria-current={f.view===view?'page':undefined} className={`rounded-md px-3 py-2 text-sm ${f.view===view?'bg-white/10 text-fg':'text-muted hover:bg-hover'}`}>{view==='wallets'?'Soldes des joueurs':view==='journal'?'Journal des mouvements':'Attributions de duel'}</Link>)}
          <a href={loupeHref(f).replace('/loupes?','/loupes/export?')} className="ml-auto px-3 py-2 text-xs text-accent-fg">Exporter cette page · CSV</a>
        </nav>
        <p className="border-b border-line px-4 py-3 text-xs leading-5 text-subtle">{f.view==='journal'?'Chaque ligne correspond à un mouvement validé. Une récompense peut produire un gain de duel et un bonus de niveau distincts. Ouvre une opération pour voir son détail.':f.view==='rewards'?'Attributions enregistrées par le système de loupes, y compris les gains nuls. Ces attributions détaillent le journal ; elles ne constituent pas des crédits supplémentaires.':'Tous les joueurs sont présents, même ceux à zéro. Les gains et dépenses respectent la période choisie.'}</p>
        <Suspense key={JSON.stringify(f)} fallback={<TableSkeleton />}><Content filters={f} /></Suspense>
      </section>
    </div>
  </>;
}
async function Content({ filters: f }: { filters: LoupeFilters }) {
  if(f.view==='wallets') {
    const rows = await listLoupeWallets(f);
    if(!rows.length)return <div className="p-10 text-center text-muted">Aucun joueur sur cette page. <Link href={loupeHref(f,{page:1})} className="underline">Première page</Link></div>;
    return <><Table><thead><tr>{['Joueur','Solde actuel','Gagnées','Dépensées','Mouvements','Dernier mouvement'].map(t=><th key={t} className={thClass}>{t}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="transition-colors hover:bg-white/[0.025]">
      <td className={tdClass}><Link href={loupeHref(f,{user:row.id,view:'journal',page:1,before:null})} className="text-fg hover:text-accent-fg">{row.username} <span className="text-xs text-subtle">#{row.id}</span></Link></td>
      <td className={tdClass}><LoupeAmount amount={row.balance} /></td><td className={`${tdClass} text-success`}><LoupeAmount amount={row.earned} /></td><td className={tdClass}><LoupeAmount amount={row.spent} /></td><td className={tdClass}>{row.operations}</td><td className={`${tdClass} text-xs text-muted`}><Time date={row.lastAt} fallback="Aucun" /></td>
    </tr>)}</tbody></Table><Pagination page={f.page} total={rows[0]!.total} href={page=>loupeHref(f,{page})} /></>;
  }
  const rows = f.view==='journal' ? await listLoupeLedger(f) : await listLoupeRewards(f);
  const page = rows.slice(0,PAGE_SIZE);
  return <>{f.view==='journal' ? <LoupeLedger rows={page as Awaited<ReturnType<typeof listLoupeLedger>>} /> : <LoupeRewards rows={page as Awaited<ReturnType<typeof listLoupeRewards>>} />}
    <div className="flex items-center justify-between px-4 py-4 text-xs text-muted"><Link href={loupeHref(f,{before:null})}>Revenir aux plus récents</Link><span>{page.length} lignes affichées</span>{rows.length>PAGE_SIZE && <Link href={loupeHref(f,{before:page.at(-1)!.id})} className="text-accent-fg">Plus anciennes →</Link>}</div>
  </>;
}
