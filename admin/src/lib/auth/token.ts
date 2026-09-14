import { SignJWT, jwtVerify } from 'jose';

// Importé par proxy.ts : ni `server-only` ni `next/headers` dans ce module.

export const SESSION_COOKIE = 'mk_admin_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
const AUDIENCE = 'mk-admin';

function config() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!email || !secret || secret.length < 32) {
    throw new Error('ADMIN_EMAIL et ADMIN_SESSION_SECRET (32 caractères minimum) sont requis');
  }
  return { email, key: new TextEncoder().encode(secret) };
}

export function adminEmail() {
  return config().email;
}

export function signSession() {
  const { email, key } = config();
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);
}

/**
 * Signature, expiration, et jeton émis pour l'admin actuellement configuré :
 * changer ADMIN_EMAIL ou ADMIN_SESSION_SECRET révoque toutes les sessions.
 */
export async function isValidSession(token: string | undefined) {
  if (!token) return false;
  const { email, key } = config();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], audience: AUDIENCE });
    return payload.sub === email;
  } catch {
    return false;
  }
}
