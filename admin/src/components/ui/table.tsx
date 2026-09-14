import type { Route } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

const edge = 'first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6';

export const thClass = cn('h-9 border-b border-line px-3 text-left text-xs font-normal whitespace-nowrap text-subtle', edge);
export const tdClass = cn('h-11 border-b border-line px-3 whitespace-nowrap', edge);
/** Ligne entièrement cliquable : le lien principal porte `after:absolute after:inset-0`. */
export const trClass = 'relative transition-colors hover:bg-white/[0.025] focus-within:bg-white/[0.025]';
export const rowLinkClass =
  'outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent/70';

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function SortableTh({
  children,
  href,
  active,
  direction,
  align = 'left',
}: {
  children: React.ReactNode;
  href: Route;
  active: boolean;
  direction: 'asc' | 'desc';
  align?: 'left' | 'right';
}) {
  const Icon = direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(thClass, align === 'right' && 'text-right')}
    >
      <Link
        href={href}
        replace
        scroll={false}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-fg',
          active && 'text-fg',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {children}
        <Icon className={cn('size-3', !active && 'opacity-0')} aria-hidden />
      </Link>
    </th>
  );
}

export function NumberCell({ value }: { value: number }) {
  return (
    <td className={cn(tdClass, 'text-right tabular-nums', value === 0 ? 'text-subtle' : 'text-fg')}>
      {formatNumber(value)}
    </td>
  );
}
