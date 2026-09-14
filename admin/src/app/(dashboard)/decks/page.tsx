import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Layers } from 'lucide-react';
import { DeckKind, DeckStatus } from '@/components/deck-status';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { SortableTh, Table, rowLinkClass, tdClass, thClass, trClass } from '@/components/ui/table';
import { ThumbStack } from '@/components/ui/thumb-stack';
import { Time } from '@/components/ui/time';
import { cn } from '@/lib/cn';
import { listHref, readListParams, type ListParams, type SearchParams } from '@/lib/params';
import { DECK_MAX_CARDS, DECK_SORTS, listDecks, type DeckSort } from '@/lib/queries/decks';

export const metadata: Metadata = { title: 'Decks' };

const DEFAULTS = { q: '', sort: 'recent', page: 1 };

export default async function DecksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = readListParams(await searchParams, DECK_SORTS, 'recent');

  return (
    <>
      <PageHeader title="Decks">
        <SearchInput placeholder="Deck, joueur ou #id" defaultValue={params.q} />
      </PageHeader>
      <Suspense fallback={<TableSkeleton />}>
        <DecksTable {...params} />
      </Suspense>
    </>
  );
}

async function DecksTable({ q, sort, page, offset }: ListParams<DeckSort>) {
  const { rows, total } = await listDecks({ q, sort, offset });
  const href = (patch: { sort?: DeckSort; page?: number }) => listHref('/decks', { q, sort, page, ...patch }, DEFAULTS);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title={q ? 'Aucun deck trouvé' : 'Aucun deck créé pour l’instant'}
        description={q ? `Rien ne correspond à « ${q} ».` : undefined}
        action={
          page > 1 ? (
            <Link href={href({ page: 1 })} className="text-accent-fg hover:text-fg">
              Revenir à la première page
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <SortableTh href={href({ sort: 'name', page: 1 })} active={sort === 'name'} direction="asc">
              Deck
            </SortableTh>
            <th className={thClass}>Propriétaire</th>
            <SortableTh href={href({ sort: 'cards', page: 1 })} active={sort === 'cards'} direction="desc" align="right">
              Cartes
            </SortableTh>
            <th className={thClass}>État</th>
            <th className={thClass}>Type</th>
            <SortableTh href={href({ sort: 'recent', page: 1 })} active={sort === 'recent'} direction="desc" align="right">
              Création
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((deck) => (
            <tr key={deck.id} className={trClass}>
              <td className={tdClass}>
                <Link href={`/decks/${deck.id}`} className={cn(rowLinkClass, 'flex items-center gap-3')}>
                  <ThumbStack urls={deck.previews} />
                  <span className="max-w-[260px] truncate font-medium text-fg">{deck.name}</span>
                  <span className="font-mono text-2xs text-subtle">#{deck.id}</span>
                </Link>
              </td>
              <td className={tdClass}>
                {deck.ownerName ? (
                  <Link
                    href={`/users/${deck.userId}`}
                    className="relative z-10 inline-flex items-center gap-2 text-muted transition-colors hover:text-fg"
                  >
                    <Avatar name={deck.ownerName} src={deck.ownerImageUrl} size={18} />
                    {deck.ownerName}
                  </Link>
                ) : (
                  <span className="text-subtle">Compte supprimé</span>
                )}
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums text-fg')}>
                {deck.cards}
                <span className="text-subtle">/{DECK_MAX_CARDS}</span>
              </td>
              <td className={tdClass}>
                <DeckStatus cards={deck.cards} />
              </td>
              <td className={tdClass}>
                <DeckKind atelier={deck.atelier} />
              </td>
              <td className={cn(tdClass, 'text-right text-muted')}>
                <Time date={deck.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} total={total} href={(target) => href({ page: target })} />
    </>
  );
}
