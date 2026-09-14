import type { Metadata } from 'next';
import { Logo } from '@/components/ui/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-[340px]">
        <Logo size={28} />
        <h1 className="mt-6 text-base font-medium text-fg">Back office</h1>
        <p className="mt-1 text-sm text-muted">Qui est-ce ? · accès administrateur</p>
        <LoginForm next={typeof next === 'string' ? next : undefined} />
      </div>
    </main>
  );
}
