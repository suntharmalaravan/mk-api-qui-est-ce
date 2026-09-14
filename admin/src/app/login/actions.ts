'use server';

import type { Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { verifyCredentials } from '@/lib/auth/password';
import { clearAttempts, takeAttempt } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';

export type LoginState = { error?: string; email?: string };

const credentials = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
  next: z.string().max(512).optional(),
});

const PER_CLIENT_ATTEMPTS = 5;
// Plafond toutes origines confondues : changer d'IP ne contourne pas la limite.
const GLOBAL_ATTEMPTS = 50;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) return { error: 'Identifiants invalides.' };
  const { email, password, next } = parsed.data;

  // Dernière entrée : celle ajoutée par le proxy de la plateforme, non falsifiable par le client.
  const forwarded = (await headers()).get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const client = `login:${forwarded || 'direct'}`;
  if (!takeAttempt(client, PER_CLIENT_ATTEMPTS) || !takeAttempt('login:*', GLOBAL_ATTEMPTS)) {
    return { error: 'Trop de tentatives. Réessaie dans 15 minutes.', email };
  }

  if (!(await verifyCredentials(email, password))) {
    return { error: 'Identifiants invalides.', email };
  }

  clearAttempts(client);
  await createSession();
  redirect(internalPath(next));
}

/** Chemin interne uniquement : refuse `//hote`, `/\hote` et les URLs absolues. */
function internalPath(next: string | undefined): Route {
  const safe = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  return (safe ? next : '/') as Route;
}
