import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, ArrowUpRight, EyeOff } from 'lucide-react';
import { ActivityChart } from '@/components/activity-chart';
import { StatTile } from '@/components/stat-tile';
import { Avatar } from '@/components/ui/avatar';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ThumbStack } from '@/components/ui/thumb-stack';
import { Time } from '@/components/ui/time';
import { formatNumber } from '@/lib/format';
import {
  ACTIVITY_DAYS,
  getMatchActivity,
  getTotals,
  listRecentDecks,
  listRecentUsers,
} from '@/lib/queries/overview';

export const metadata: Metadata = { title: 'Vue d’ensemble' };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Vue d’ensemble" />
      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 md:px-8">
        <Suspense fallback={<MetricsSkeleton />}>
          <Metrics />
        </Suspense>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<ListCardSkeleton title="Derniers inscrits" />}>
            <RecentUsers />
          </Suspense>
          <Suspense fallback={<ListCardSkeleton title="Derniers decks" />}>
            <RecentDecks />
          </Suspense>
        </div>
      </div>
    </>
  );
}

function Growth({ count, suffix }: { count: number; suffix: string }) {
  if (count === 0) return <>Aucun {suffix}</>;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center font-medium text-success">
        <ArrowUpRight className="size-3" aria-hidden />+{formatNumber(count)}
      </span>
      {suffix}
    </span>
  );
}

async function Metrics() {
  const [totals, activity] = await Promise.all([getTotals(), getMatchActivity()]);
  const visibleCategories = totals.categories - totals.hiddenCategories;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Joueurs"
          value={formatNumber(totals.users)}
          detail={<Growth count={totals.newUsers7d} suffix="sur 7 jours" />}
          href="/users"
        />
        <StatTile label="Joueurs actifs" value={formatNumber(totals.activePlayers7d)} detail="au moins une partie sur 7 jours" />
        <StatTile label="Parties terminées" value={formatNumber(totals.matches7d)} detail="sur 7 jours" />
        <StatTile
          label="Decks"
          value={formatNumber(totals.decks)}
          detail={<Growth count={totals.newDecks7d} suffix="sur 7 jours" />}
          href="/decks"
        />
      </div>

      <div className="mt-6">
        <ActivityChart
          days={activity}
          title="Parties terminées par jour"
          subtitle={`${ACTIVITY_DAYS} derniers jours · heure de Paris`}
        />
      </div>

      <Link
        href="/categories"
        className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        <EyeOff className="size-4 text-subtle" aria-hidden />
        <span>
          <span className="text-fg">{visibleCategories}</span> catégorie{visibleCategories > 1 ? 's' : ''} visible
          {visibleCategories > 1 ? 's' : ''} sur {totals.categories}
          {totals.hiddenCategories > 0 ? ` · ${totals.hiddenCategories} masquée${totals.hiddenCategories > 1 ? 's' : ''}` : ''}
        </span>
        <ArrowRight className="ml-auto size-3.5" aria-hidden />
      </Link>
    </>
  );
}

function ListCard({
  title,
  href,
  children,
}: {
  title: string;
  href?: Route;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-panel">
      <header className="flex h-11 items-center justify-between border-b border-line px-4">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {href ? (
          <Link href={href} className="text-xs text-muted transition-colors hover:text-fg">
            Tout voir
          </Link>
        ) : null}
      </header>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

const listRowClass = 'flex h-11 items-center gap-2.5 px-4 text-sm transition-colors hover:bg-white/[0.025]';

async function RecentUsers() {
  const users = await listRecentUsers();
  return (
    <ListCard title="Derniers inscrits" href="/users">
      {users.map((user) => (
        <li key={user.id}>
          <Link href={`/users/${user.id}`} className={listRowClass}>
            <Avatar name={user.username} src={user.imageUrl} size={22} />
            <span className="truncate text-fg">{user.username}</span>
            <span className="font-mono text-2xs text-subtle">#{user.id}</span>
            <span className="ml-auto text-xs tabular-nums text-subtle">{formatNumber(user.score)} pts</span>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}

async function RecentDecks() {
  const decks = await listRecentDecks();
  return (
    <ListCard title="Derniers decks" href="/decks">
      {decks.length === 0 ? <li className="px-4 py-6 text-center text-sm text-subtle">Aucun deck</li> : null}
      {decks.map((deck) => (
        <li key={deck.id}>
          <Link href={`/decks/${deck.id}`} className={listRowClass}>
            <ThumbStack urls={deck.previews} size={22} ringClassName="ring-panel" />
            <span className="truncate text-fg">{deck.name}</span>
            {deck.ownerName ? <span className="truncate text-xs text-subtle">{deck.ownerName}</span> : null}
            <span className="ml-auto shrink-0 text-xs text-subtle">
              <Time date={deck.createdAt} />
            </span>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}

function MetricsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-lg border border-line bg-panel p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-[292px] rounded-lg" />
      <Skeleton className="mt-3 h-[46px] rounded-lg" />
    </>
  );
}

function ListCardSkeleton({ title }: { title: string }) {
  return (
    <ListCard title={title}>
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="flex h-11 items-center gap-2.5 px-4">
          <Skeleton className="size-[22px] rounded-full" />
          <Skeleton className="h-3 w-32" />
        </li>
      ))}
    </ListCard>
  );
}
