import Link from 'next/link';
import { Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default function UserNotFound() {
  return (
    <EmptyState
      icon={Users}
      title="Joueur introuvable"
      description="Ce compte a peut-être été supprimé."
      action={
        <Link href="/users" className="text-accent-fg hover:text-fg">
          Tous les joueurs
        </Link>
      }
    />
  );
}
