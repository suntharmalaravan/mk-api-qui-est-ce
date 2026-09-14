'use client';

import { TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Impossible de charger cette page"
      description={error.digest ? `Référence de l’erreur : ${error.digest}` : error.message}
      action={
        <button
          type="button"
          onClick={reset}
          className="h-8 rounded-md border border-line-strong px-3 text-sm text-fg transition-colors hover:bg-hover"
        >
          Réessayer
        </button>
      }
    />
  );
}
