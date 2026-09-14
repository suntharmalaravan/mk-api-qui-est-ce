import type { Route } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type Crumb = { label: string; href?: Route };

export function PageHeader({
  title,
  crumbs = [],
  children,
}: {
  title: string;
  crumbs?: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md md:px-6">
      <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb) => (
          <span key={crumb.label} className="flex items-center gap-1.5 text-muted">
            {crumb.href ? (
              <Link href={crumb.href} className="transition-colors hover:text-fg">
                {crumb.label}
              </Link>
            ) : (
              crumb.label
            )}
            <ChevronRight className="size-3.5 text-subtle" aria-hidden />
          </span>
        ))}
        <h1 className="truncate font-medium text-fg">{title}</h1>
      </nav>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}
