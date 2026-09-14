import { LogOut } from 'lucide-react';
import { logout } from '@/lib/auth/actions';
import { NAV_ITEMS } from '@/lib/navigation';
import { Logo } from '@/components/ui/logo';
import { CommandTrigger } from './command-menu';
import { NavLink } from './nav-link';

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="hidden w-[228px] shrink-0 flex-col border-r border-line bg-panel md:flex">
      <div className="flex h-12 items-center gap-2 px-4">
        <Logo />
        <span className="truncate text-sm font-medium text-fg">Qui est-ce ?</span>
        <span className="ml-auto text-2xs text-subtle">Admin</span>
      </div>

      <div className="px-2">
        <CommandTrigger />
      </div>

      <nav aria-label="Navigation principale" className="mt-4 flex flex-col gap-px px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, shortcut }) => (
          <NavLink key={href} href={href} label={label} shortcut={shortcut} icon={<Icon className="size-4" aria-hidden />} />
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-line py-2.5 pr-2 pl-4">
        <span className="min-w-0 flex-1 truncate text-xs text-muted" title={email}>
          {email}
        </span>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-hover hover:text-fg"
          >
            <LogOut className="size-3.5" aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-panel px-3 md:hidden">
      <Logo />
      <nav aria-label="Navigation principale" className="ml-2 flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} label={label} compact icon={<Icon className="size-4" aria-hidden />} />
        ))}
      </nav>
      <div className="ml-auto">
        <CommandTrigger compact />
      </div>
    </div>
  );
}
