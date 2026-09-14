'use client';

import { useActionState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { login, type LoginState } from './actions';

const inputClass =
  'h-9 w-full rounded-md border border-line-strong bg-white/[0.02] px-3 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-white/20 focus:border-accent focus:ring-2 focus:ring-accent/25';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.email}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Mot de passe</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
        Se connecter
      </button>
    </form>
  );
}
