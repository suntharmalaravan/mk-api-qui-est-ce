'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Kbd } from '@/components/ui/kbd';

export function NavLink({
  href,
  icon,
  label,
  shortcut,
  compact = false,
}: {
  href: Route;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={compact ? label : undefined}
      className={cn(
        'group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors',
        active ? 'bg-white/[0.06] text-fg' : 'text-muted hover:bg-hover hover:text-fg',
        compact && 'w-8 justify-center px-0',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-fg' : 'text-subtle group-hover:text-muted')}>{icon}</span>
      <span className={cn('truncate', compact && 'sr-only')}>{label}</span>
      {shortcut && !compact ? (
        <span className="ml-auto hidden items-center gap-0.5 group-hover:flex" aria-hidden>
          <Kbd>G</Kbd>
          <Kbd>{shortcut.toUpperCase()}</Kbd>
        </span>
      ) : null}
    </Link>
  );
}
