import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { formatNumber, humanize } from '@/lib/format';
import { listHref, readListParams, type SearchParams } from '@/lib/params';
import { CATEGORY_MIN_CARDS, getCategory, listCategoryCards } from '@/lib/queries/categories';

type Props = { params: Promise<{ slug: string }>; searchParams: SearchParams };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  return { title: category ? humanize(category.slug) : 'Catégorie introuvable' };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const { q, page, offset } = readListParams(await searchParams, ['id'], 'id');
  const { rows, total } = await listCategoryCards(slug, { q, offset });
  const href = (target: number) => listHref(`/categories/${encodeURIComponent(slug)}`, { q, page: target }, { q: '', page: 1 });

  return (
    <>
      <PageHeader title={humanize(category.slug)} crumbs={[{ label: 'Catégories', href: '/categories' }]} />
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold tracking-tight text-fg">{humanize(category.slug)}</h2>
            <p className="mt-1 break-all font-mono text-xs text-subtle">{category.slug}</p>
            <p className="mt-3 text-sm text-muted">{formatNumber(category.cards)} personnages · Catalogue officiel</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={category.visible ? 'success' : 'neutral'}>{category.visible ? 'Visible dans l’app' : 'Masquée dans l’app'}</Badge>
            {category.cards < CATEGORY_MIN_CARDS ? <Badge tone="warning">Non jouable · {CATEGORY_MIN_CARDS} cartes minimum</Badge> : null}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-fg">Personnages</h3>
          <SearchInput placeholder="Rechercher un personnage" defaultValue={q} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ImageOff}
            title={page > 1 ? 'Aucun personnage sur cette page' : 'Aucun personnage trouvé'}
            description={q ? `Rien ne correspond à « ${q} ».` : undefined}
            action={page > 1 ? <Link href={href(1)} className="text-accent-fg hover:text-fg">Revenir à la première page</Link> : undefined}
          />
        ) : (
          <>
            <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {rows.map((card) => (
                <li key={card.id} className="min-w-0">
                  <a
                    href={card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Voir l’image de ${card.name} en grand (nouvel onglet)`}
                    className="group block aspect-[3/4] overflow-hidden rounded-lg border border-line bg-panel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  >
                    <img
                      src={card.url}
                      alt={card.name}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-contain motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
                    />
                  </a>
                  <p className="mt-2 break-words text-sm font-medium text-fg">{card.name}</p>
                  <p className="mt-0.5 font-mono text-2xs text-subtle">#{card.id}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line">
              <Pagination page={page} total={total} href={href} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
