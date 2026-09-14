import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { NumberCell, SortableTh, Table, rowLinkClass, tdClass, thClass, trClass } from '@/components/ui/table';
import { Time } from '@/components/ui/time';
import { cn } from '@/lib/cn';
import { humanize } from '@/lib/format';
import { listHref, readListParams, type ListParams, type SearchParams } from '@/lib/params';
import { USER_SORTS, listUsers, type UserSort } from '@/lib/queries/users';

export const metadata: Metadata = { title: 'Joueurs' };

const DEFAULTS = { q: '', sort: 'recent', page: 1 };

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = readListParams(await searchParams, USER_SORTS, 'recent');

  return (
    <>
      <PageHeader title="Joueurs">
        <SearchInput placeholder="Joueur ou #id" defaultValue={params.q} />
      </PageHeader>
      <Suspense fallback={<TableSkeleton />}>
        <UsersTable {...params} />
      </Suspense>
    </>
  );
}

async function UsersTable({ q, sort, page, offset }: ListParams<UserSort>) {
  const { rows, total } = await listUsers({ q, sort, offset });
  const href = (patch: { sort?: UserSort; page?: number }) => listHref('/users', { q, sort, page, ...patch }, DEFAULTS);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={q ? 'Aucun joueur trouvé' : 'Aucun joueur'}
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

  const sortable = (key: UserSort, label: string, align?: 'right') => (
    <SortableTh href={href({ sort: key, page: 1 })} active={sort === key} direction={key === 'name' ? 'asc' : 'desc'} align={align}>
      {label}
    </SortableTh>
  );

  return (
    <>
      <Table>
        <thead>
          <tr>
            {sortable('name', 'Joueur')}
            <th className={thClass}>Niveau</th>
            {sortable('score', 'Score', 'right')}
            {sortable('decks', 'Decks', 'right')}
            {sortable('wins', 'Victoires', 'right')}
            <th className={cn(thClass, 'text-right')}>Défaites</th>
            {sortable('recent', 'Inscription', 'right')}
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => (
            <tr key={user.id} className={trClass}>
              <td className={tdClass}>
                <Link href={`/users/${user.id}`} className={cn(rowLinkClass, 'flex items-center gap-2.5')}>
                  <Avatar name={user.username} src={user.imageUrl} size={22} />
                  <span className="max-w-[240px] truncate font-medium text-fg">{user.username}</span>
                  <span className="font-mono text-2xs text-subtle">#{user.id}</span>
                </Link>
              </td>
              <td className={cn(tdClass, 'text-muted')}>{user.level ? humanize(user.level) : '—'}</td>
              <NumberCell value={user.score} />
              <NumberCell value={user.decks} />
              <NumberCell value={user.wins} />
              <NumberCell value={user.losses} />
              <td className={cn(tdClass, 'text-right text-muted')}>
                <Time date={user.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} total={total} href={(target) => href({ page: target })} />
    </>
  );
}
