import type { Metadata } from 'next';
import { Tags } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { formatRelative, humanize } from '@/lib/format';
import { CATEGORY_MIN_CARDS, listCategories } from '@/lib/queries/categories';
import { CategoryRow } from './category-row';

export const metadata: Metadata = { title: 'Catégories' };

export default async function CategoriesPage() {
  const categories = await listCategories();
  const visibleCount = categories.filter((category) => category.visible).length;

  return (
    <>
      <PageHeader title="Catégories">
        {categories.length > 0 ? (
          <span className="text-xs tabular-nums text-muted">
            {visibleCount} visible{visibleCount > 1 ? 's' : ''} sur {categories.length}
          </span>
        ) : null}
      </PageHeader>

      <div className="mx-auto w-full max-w-[920px] px-4 py-8 md:px-8">
        <p className="max-w-[640px] text-sm text-muted">
          Une catégorie masquée disparaît de la liste proposée dans l’app et ne peut plus lancer de nouvelle
          partie. Les salons déjà configurés dessus restent jouables. La modification est immédiate.
        </p>

        {categories.length === 0 ? (
          <EmptyState icon={Tags} title="Aucune catégorie au catalogue" />
        ) : (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
            {categories.map((category) => (
              <CategoryRow
                key={category.slug}
                category={{
                  slug: category.slug,
                  label: humanize(category.slug),
                  cards: category.cards,
                  previews: category.previews,
                  visible: category.visible,
                  playable: category.cards >= CATEGORY_MIN_CARDS,
                  updatedLabel: category.updatedAt ? formatRelative(category.updatedAt) : null,
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
