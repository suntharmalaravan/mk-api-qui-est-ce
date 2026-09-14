import { Badge } from '@/components/ui/badge';
import { DECK_MIN_CARDS } from '@/lib/queries/decks';

export function DeckStatus({ cards }: { cards: number }) {
  return cards >= DECK_MIN_CARDS ? (
    <Badge tone="success">Jouable</Badge>
  ) : (
    <Badge tone="warning">Incomplet</Badge>
  );
}

export function DeckKind({ atelier }: { atelier: boolean }) {
  return atelier ? <Badge tone="accent">Atelier</Badge> : <Badge>Photos</Badge>;
}
