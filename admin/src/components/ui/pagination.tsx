import type { Route } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { PAGE_SIZE } from '@/lib/params';

const buttonClass = 'grid size-7 place-items-center rounded-md border border-line';

export function Pagination({
  page,
  total,
  href,
}: {
  page: number;
  total: number;
  href: (page: number) => Route;
}) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-12 items-center justify-between px-4 text-xs text-subtle md:px-6">
      <span className="tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} sur {formatNumber(total)}
      </span>
      {last > 1 ? (
        <div className="flex items-center gap-1.5">
          <PageLink href={page > 1 ? href(page - 1) : null} label="Page précédente">
            <ChevronLeft className="size-3.5" aria-hidden />
          </PageLink>
          <span className="px-1.5 tabular-nums">
            {page} / {last}
          </span>
          <PageLink href={page < last ? href(page + 1) : null} label="Page suivante">
            <ChevronRight className="size-3.5" aria-hidden />
          </PageLink>
        </div>
      ) : null}
    </div>
  );
}

function PageLink({ href, label, children }: { href: Route | null; label: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled className={`${buttonClass} opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} replace aria-label={label} className={`${buttonClass} text-muted transition-colors hover:bg-hover hover:text-fg`}>
      {children}
    </Link>
  );
}
