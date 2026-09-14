'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Command } from 'cmdk';
import { Layers, LoaderCircle, LogOut, Search } from 'lucide-react';
import { searchEverything, type SearchHit } from '@/lib/actions/search';
import { logout } from '@/lib/auth/actions';
import { cn } from '@/lib/cn';
import { isTypingTarget } from '@/lib/dom';
import { formatNumber } from '@/lib/format';
import { NAV_ITEMS } from '@/lib/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Kbd } from '@/components/ui/kbd';

const OPEN_EVENT = 'mk:open-command-menu';
const SEARCH_DEBOUNCE_MS = 150;
const SEQUENCE_WINDOW_MS = 1000;

const itemClass =
  'flex h-10 cursor-pointer select-none items-center gap-3 rounded-md px-2.5 text-sm text-muted data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-fg';

/** ⌘K / Ctrl+K : menu de commandes. « G puis H/U/D/C » : navigation directe. */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, startSearch] = useTransition();
  const latestRequest = useRef(0);

  useEffect(() => {
    let sequenceStartedAt = 0;

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'g') {
        sequenceStartedAt = event.timeStamp;
        return;
      }
      const inSequence = sequenceStartedAt > 0 && event.timeStamp - sequenceStartedAt < SEQUENCE_WINDOW_MS;
      sequenceStartedAt = 0;
      const target = inSequence ? NAV_ITEMS.find((item) => item.shortcut === key) : undefined;
      if (target) {
        event.preventDefault();
        router.push(target.href);
      }
    }

    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [router]);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const request = ++latestRequest.current;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchEverything(trimmed);
        // Une réponse lente ne doit pas écraser celle d'une frappe plus récente.
        if (request === latestRequest.current) setHits(result);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  function close() {
    setOpen(false);
    setQuery('');
    setHits([]);
  }

  function go(href: Route) {
    close();
    router.push(href);
  }

  const needle = trimmed.toLowerCase();
  const results = trimmed ? hits : [];
  const users = results.filter((hit) => hit.kind === 'user');
  const decks = results.filter((hit) => hit.kind === 'deck');
  const pages = NAV_ITEMS.filter((item) => !needle || item.label.toLowerCase().includes(needle));
  const showLogout = !needle || 'se déconnecter'.includes(needle);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(value) => (value ? setOpen(true) : close())}
      label="Menu de commandes"
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
      contentClassName="fixed top-[16vh] left-1/2 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-line-strong bg-elevated shadow-2xl shadow-black/60"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        {searching ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-subtle" aria-hidden />
        ) : (
          <Search className="size-4 shrink-0 text-subtle" aria-hidden />
        )}
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher un joueur, un deck, une page…"
          className="h-12 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle"
        />
        <Kbd>Esc</Kbd>
      </div>

      <Command.List className="max-h-[min(440px,60vh)] overflow-y-auto overscroll-contain p-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle">
        <Command.Empty className="px-3 py-10 text-center text-sm text-subtle">
          {searching ? 'Recherche…' : 'Aucun résultat'}
        </Command.Empty>

        {users.length > 0 ? (
          <Command.Group heading="Joueurs">
            {users.map((hit) => (
              <Command.Item key={`user-${hit.id}`} value={`user-${hit.id}`} onSelect={() => go(`/users/${hit.id}` as Route)} className={itemClass}>
                <Avatar name={hit.title} src={hit.imageUrl} size={20} />
                <span className="truncate text-fg">{hit.title}</span>
                <span className="font-mono text-2xs text-subtle">#{hit.id}</span>
                <span className="ml-auto text-xs tabular-nums text-subtle">{formatNumber(hit.score)} pts</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {decks.length > 0 ? (
          <Command.Group heading="Decks">
            {decks.map((hit) => (
              <Command.Item key={`deck-${hit.id}`} value={`deck-${hit.id}`} onSelect={() => go(`/decks/${hit.id}` as Route)} className={itemClass}>
                <Layers className="size-4 text-subtle" aria-hidden />
                <span className="truncate text-fg">{hit.title}</span>
                <span className="font-mono text-2xs text-subtle">#{hit.id}</span>
                {hit.ownerName ? <span className="ml-auto truncate text-xs text-subtle">{hit.ownerName}</span> : null}
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {pages.length > 0 ? (
          <Command.Group heading="Navigation">
            {pages.map(({ href, label, icon: Icon, shortcut }) => (
              <Command.Item key={href} value={`page-${href}`} onSelect={() => go(href)} className={itemClass}>
                <Icon className="size-4 text-subtle" aria-hidden />
                {label}
                <span className="ml-auto flex gap-0.5" aria-hidden>
                  <Kbd>G</Kbd>
                  <Kbd>{shortcut.toUpperCase()}</Kbd>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {showLogout ? (
          <Command.Group heading="Compte">
            <Command.Item
              value="logout"
              onSelect={() => {
                close();
                void logout();
              }}
              className={itemClass}
            >
              <LogOut className="size-4 text-subtle" aria-hidden />
              Se déconnecter
            </Command.Item>
          </Command.Group>
        ) : null}
      </Command.List>
    </Command.Dialog>
  );
}

export function CommandTrigger({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label="Ouvrir le menu de commandes"
      className={cn(
        'flex h-8 items-center gap-2 rounded-md border border-line bg-white/[0.02] text-sm text-subtle transition-colors hover:border-line-strong hover:text-muted',
        compact ? 'w-8 justify-center' : 'w-full px-2.5',
      )}
    >
      <Search className="size-3.5 shrink-0" aria-hidden />
      {compact ? null : (
        <>
          <span>Rechercher…</span>
          <Kbd className="ml-auto">⌘K</Kbd>
        </>
      )}
    </button>
  );
}
