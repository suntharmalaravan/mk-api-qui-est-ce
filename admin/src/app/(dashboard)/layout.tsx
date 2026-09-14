import { requireAdmin } from '@/lib/auth/session';
import { CommandMenu } from '@/components/shell/command-menu';
import { MobileNav, Sidebar } from '@/components/shell/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandMenu />
    </div>
  );
}
