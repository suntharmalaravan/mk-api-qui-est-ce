import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageOff } from 'lucide-react';
import { DeckKind, DeckStatus } from '@/components/deck-status';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Meta } from '@/components/ui/meta';
import { PageHeader } from '@/components/ui/page-header';
import { Time } from '@/components/ui/time';
import { parseId } from '@/lib/params';
import { DECK_MAX_CARDS, getDeck, listDeckCards } from '@/lib/queries/decks';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const deck = id ? await getDeck(id) : null;
  return { title: deck?.name ?? 'Deck' };
}

export default async function DeckPage({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();

  const [deck, cards] = await Promise.all([getDeck(id), listDeckCards(id)]);
  if (!deck) notFound();

  const atelier = cards.some((card) => card.atelier);
  // Le badge par carte n'informe que dans un deck qui mélange photos et personnages.
  const mixed = atelier && cards.some((card) => !card.atelier);

  return (
    <>
      <PageHeader title={deck.name} crumbs={[{ label: 'Decks', href: '/decks' }]} />

      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight text-fg">{deck.name}</h2>
              <span className="font-mono text-xs text-subtle">#{deck.id}</span>
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <Meta label="Propriétaire">
                {deck.ownerName ? (
                  <Link href={`/users/${deck.userId}`} className="inline-flex items-center gap-2 transition-colors hover:text-accent-fg">
                    <Avatar name={deck.ownerName} src={deck.ownerImageUrl} size={18} />
                    {deck.ownerName}
                  </Link>
                ) : (
                  <span className="text-subtle">Compte supprimé</span>
                )}
              </Meta>
              <Meta label="Cartes">
                <span className="tabular-nums">
                  {cards.length}
                  <span className="text-subtle">/{DECK_MAX_CARDS}</span>
                </span>
              </Meta>
              <Meta label="Création">
                <Time date={deck.createdAt} />
              </Meta>
            </dl>
          </div>
          <div className="flex items-center gap-2">
            <DeckStatus cards={cards.length} />
            <DeckKind atelier={atelier} />
          </div>
        </div>

        {cards.length === 0 ? (
          <EmptyState icon={ImageOff} title="Ce deck ne contient aucune carte" />
        ) : (
          <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-3 gap-y-5">
            {cards.map((card) => (
              <li key={card.id}>
                <a
                  href={card.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block aspect-[3/4] overflow-hidden rounded-lg border border-line bg-panel"
                >
                  <img
                    src={card.url}
                    alt={card.name}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                  {mixed && card.atelier ? (
                    <Badge tone="accent" className="absolute top-1.5 left-1.5 bg-accent/30 text-white backdrop-blur-sm">
                      Atelier
                    </Badge>
                  ) : null}
                </a>
                <p className="mt-2 truncate text-sm text-fg" title={card.name}>
                  {card.name}
                </p>
                <p className="font-mono text-2xs text-subtle">#{card.id}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
