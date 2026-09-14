import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  adminEmail,
  isValidSession,
  signSession,
} from './token';

/**
 * Contrôle d'accès qui fait foi. proxy.ts ne fait qu'une redirection anticipée :
 * chaque lecture de données et chaque server action passe par ici.
 */
export const requireAdmin = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) redirect('/login');
  return { email: adminEmail() };
});

export async function createSession() {
  (await cookies()).set(SESSION_COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
