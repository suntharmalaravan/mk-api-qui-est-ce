import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-mono text-xs text-subtle">404</p>
        <h1 className="mt-2 text-lg font-medium">Page introuvable</h1>
        <Link href="/" className="mt-4 inline-block text-sm text-accent-fg hover:text-fg">
          Retour à la vue d’ensemble
        </Link>
      </div>
    </main>
  );
}
