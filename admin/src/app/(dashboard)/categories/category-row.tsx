'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ThumbStack } from '@/components/ui/thumb-stack';
import { setCategoryVisibility } from '@/lib/actions/categories';
import { cn } from '@/lib/cn';

export type CategoryRowData = {
  slug: string;
  label: string;
  cards: number;
  previews: string[];
  visible: boolean;
  playable: boolean;
  /** Formaté côté serveur : une date relative recalculée au client divergerait à l'hydratation. */
  updatedLabel: string | null;
};

export function CategoryRow({ category }: { category: CategoryRowData }) {
  // L'état optimiste revient à la valeur serveur à la fin de la transition :
  // la nouvelle valeur si revalidatePath a tourné, l'ancienne en cas d'échec.
  const [visible, setVisible] = useOptimistic(category.visible);
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      setVisible(next);
      const result = await setCategoryVisibility(category.slug, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <Link
        href={`/categories/${encodeURIComponent(category.slug)}`}
        aria-label={`Voir les personnages de ${category.label}`}
        className={cn('group flex min-w-0 flex-1 items-center gap-4 rounded-md transition-opacity duration-150 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent', !visible && 'opacity-50')}
      >
        <ThumbStack urls={category.previews} size={32} ringClassName="ring-panel" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-fg group-hover:text-accent-fg">{category.label}</span>
            {category.playable ? null : <Badge tone="warning">Non jouable</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-subtle">
            <span className="font-mono">{category.slug}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{category.cards} cartes</span>
            {category.updatedLabel ? (
              <>
                <span aria-hidden>·</span>
                <span>modifiée {category.updatedLabel}</span>
              </>
            ) : null}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-subtle transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
      </Link>
      <span className={cn('hidden w-14 text-right text-xs sm:inline', visible ? 'text-muted' : 'text-subtle')}>
        {visible ? 'Visible' : 'Masquée'}
      </span>
      <Switch checked={visible} onCheckedChange={toggle} label={`Afficher ${category.label} dans l’app`} />
    </li>
  );
}
