'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { isTypingTarget } from '@/lib/dom';
import { Kbd } from './kbd';

const DEBOUNCE_MS = 200;

/**
 * Recherche portée par l'URL (`?q=`) : partageable, compatible retour arrière,
 * et rendue côté serveur. La navigation se fait en transition, donc les
 * résultats précédents restent affichés jusqu'à l'arrivée des suivants.
 */
export function SearchInput({ placeholder, defaultValue }: { placeholder: string; defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer.current);
    };
  }, []);

  function navigate(value: string) {
    clearTimeout(timer.current);
    const params = new URLSearchParams(searchParams);
    if (value) params.set('q', value);
    else params.delete('q');
    params.delete('page');
    const search = params.toString();
    startTransition(() => {
      router.replace((search ? `${pathname}?${search}` : pathname) as Route, { scroll: false });
    });
  }

  return (
    <label className="group relative flex h-8 w-[min(260px,50vw)] items-center">
      <span className="pointer-events-none absolute left-2.5 text-subtle">
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Search className="size-3.5" aria-hidden />
        )}
      </span>
      <input
        ref={inputRef}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          const value = event.currentTarget.value.trim();
          clearTimeout(timer.current);
          timer.current = setTimeout(() => navigate(value), DEBOUNCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') navigate(event.currentTarget.value.trim());
          if (event.key === 'Escape') {
            event.currentTarget.value = '';
            event.currentTarget.blur();
            navigate('');
          }
        }}
        className="h-full w-full rounded-md border border-line bg-white/[0.02] pr-8 pl-8 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-accent/70 focus:bg-white/[0.03]"
      />
      <Kbd className="pointer-events-none absolute right-2 group-focus-within:opacity-0">/</Kbd>
    </label>
  );
}
