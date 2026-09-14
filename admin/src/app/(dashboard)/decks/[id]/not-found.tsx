import Link from 'next/link';
import { Layers } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default function DeckNotFound() {
  return (
    <EmptyState
      icon={Layers}
      title="Deck introuvable"
      description="Il a peut-être été supprimé par son propriétaire."
      action={
        <Link href="/decks" className="text-accent-fg hover:text-fg">
          Tous les decks
        </Link>
      }
    />
  );
}
