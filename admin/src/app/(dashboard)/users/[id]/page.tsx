import { LoupeAmount } from '@/components/ui/loupe';
import { LoupeMetrics, LoupeLedger } from '@/components/loupe-tracking';
import { readLoupeFilters, loupeHref } from '@/lib/loupes';
import { listLoupeLedger } from '@/lib/queries/loupes';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DeckKind, DeckStatus } from '@/components/deck-status';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Meta } from '@/components/ui/meta';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ThumbStack } from '@/components/ui/thumb-stack';
import { Time } from '@/components/ui/time';
import { formatNumber, humanize } from '@/lib/format';
import { parseId } from '@/lib/params';
import { DECK_MAX_CARDS, listDecks } from '@/lib/queries/decks';
import { getUser, listUserMatches } from '@/lib/queries/users';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const user = id ? await getUser(id) : null;
  return { title: user?.username ?? 'Joueur' };
}

export default async function UserPage({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const user = await getUser(id);
  if (!user) notFound();

  const played = user.wins + user.losses;
  const winRate = played > 0 ? user.wins / played : null;

  return (
    <>
      <PageHeader title={user.username} crumbs={[{ label: 'Joueurs', href: '/users' }]} />

      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 md:px-8">
        <section className="flex flex-wrap items-center gap-4">
          <Avatar name={user.username} src={user.imageUrl} size={56} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight text-fg">{user.username}</h2>
              <span className="font-mono text-xs text-subtle">#{user.id}</span>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              <Meta label="Niveau">{user.level ? humanize(user.level) : '—'}</Meta>
              <Meta label="Inscription">
                <Time date={user.createdAt} fallback="Non enregistrée" />
              </Meta>
              <Meta label="Dernière partie">
                <Time date={user.lastMatchAt} fallback="Jamais" />
              </Meta>
            </dl>
          </div>
        </section>

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          <Stat label="Score" value={formatNumber(user.score)} />
          <Stat
            label="Parties"
            value={formatNumber(played)}
            detail={`${formatNumber(user.wins)} victoires · ${formatNumber(user.losses)} défaites`}
          />
          <Stat label="Taux de victoire" value={winRate === null ? '—' : `${Math.round(winRate * 100)} %`}>
            {winRate === null ? null : (
              <div aria-hidden className="mt-2.5 h-1 overflow-hidden rounded-full bg-accent/20">
                <div className="h-full rounded-full bg-accent" style={{ width: `${winRate * 100}%` }} />
              </div>
            )}
          </Stat>
          <Stat label="Decks" value={formatNumber(user.decks)} detail={`${formatNumber(user.cards)} cartes importées`} />
          <Stat label="Personnages" value={formatNumber(user.characters)} detail="créés dans l’atelier" />
          <Stat label="Badges" value={formatNumber(user.badges)} />
          <Stat label="Loupes" value={<LoupeAmount amount={user.coins ?? 0} />} detail="solde actuel" />
          <Stat label="Identifiant" value={`#${user.id}`} />
        </dl>

        <Section title="Loupes · historique du joueur">
          <Suspense fallback={<RowsSkeleton />}><UserLoupes userId={user.id} /></Suspense>
        </Section>

        <Section title="Decks">
          <Suspense fallback={<RowsSkeleton />}>
            <UserDecks userId={user.id} />
          </Suspense>
        </Section>

        <Section title="Dernières parties">
          <Suspense fallback={<RowsSkeleton />}>
            <UserMatches userId={user.id} />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-panel p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1.5 text-lg font-semibold tracking-tight text-fg">{value}</dd>
      {detail ? <dd className="mt-0.5 text-xs text-subtle">{detail}</dd> : null}
      {children ? <dd>{children}</dd> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h3 className="mb-3 text-sm font-medium text-fg">{title}</h3>
      {children}
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">{children}</p>
  );
}

async function UserDecks({ userId }: { userId: number }) {
  const { rows, total } = await listDecks({ userId });
  if (rows.length === 0) return <EmptyRow>Aucun deck créé</EmptyRow>;

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
        {rows.map((deck) => (
          <li key={deck.id}>
            <Link
              href={`/decks/${deck.id}`}
              className="flex h-12 items-center gap-3 px-4 text-sm transition-colors hover:bg-white/[0.025]"
            >
              <ThumbStack urls={deck.previews} size={26} ringClassName="ring-panel" />
              <span className="truncate font-medium text-fg">{deck.name}</span>
              <span className="font-mono text-2xs text-subtle">#{deck.id}</span>
              <span className="ml-auto hidden text-xs tabular-nums text-muted sm:inline">
                {deck.cards}/{DECK_MAX_CARDS}
              </span>
              <DeckStatus cards={deck.cards} />
              <span className="hidden sm:inline-flex">
                <DeckKind atelier={deck.atelier} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total > rows.length ? (
        <p className="mt-2 text-xs text-subtle">
          {rows.length} decks affichés sur {formatNumber(total)}
        </p>
      ) : null}
    </>
  );
}

async function UserMatches({ userId }: { userId: number }) {
  const matches = await listUserMatches(userId);
  if (matches.length === 0) return <EmptyRow>Aucune partie terminée</EmptyRow>;

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
      {matches.map((match) => (
        <li key={match.matchId} className="flex h-12 items-center gap-3 px-4 text-sm">
          {match.won ? <Badge tone="success">Victoire</Badge> : <Badge>Défaite</Badge>}
          <span className="text-subtle">contre</span>
          <Link
            href={`/users/${match.opponentId}`}
            className="inline-flex min-w-0 items-center gap-2 text-fg transition-colors hover:text-accent-fg"
          >
            <Avatar name={match.opponentName} src={match.opponentImageUrl} size={18} />
            <span className="truncate">{match.opponentName}</span>
          </Link>
          <span className="hidden font-mono text-2xs text-subtle sm:inline">{match.reason}</span>
          <span className="ml-auto shrink-0 text-xs text-muted">
            <Time date={match.finishedAt} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function RowsSkeleton() {
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-panel">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex h-12 items-center gap-3 px-4">
          <Skeleton className="h-[26px] w-16" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

async function UserLoupes({ userId }: { userId: number }) {
  const filters=readLoupeFilters({user:String(userId),days:'all',view:'journal'});
  const rows=await listLoupeLedger(filters);
  return <div className="space-y-4"><LoupeMetrics filters={filters} /><div className="overflow-hidden rounded-lg border border-line"><LoupeLedger rows={rows.slice(0,8)} /></div><Link href={loupeHref(filters)} className="inline-flex text-sm text-accent-fg hover:text-fg">Tout le journal et les attributions de duel →</Link></div>;
}
