import 'server-only';
import { createHash, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { adminEmail } from './token';

const MAX_MEMORY = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, length: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** ADMIN_PASSWORD_HASH au format de scripts/hash-password.mjs : scrypt:N:r:p:sel:clé. */
export async function verifyCredentials(email: string, password: string) {
  const [algorithm, n, r, p, salt, key] = (process.env.ADMIN_PASSWORD_HASH ?? '').split(':');
  if (algorithm !== 'scrypt' || !n || !r || !p || !salt || !key) {
    throw new Error('ADMIN_PASSWORD_HASH invalide : générer la valeur avec npm run hash-password');
  }

  const expected = Buffer.from(key, 'base64url');
  // Le hash est calculé même quand l'email est faux : la durée de réponse ne révèle rien.
  const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEMORY,
  });
  const emailMatches = timingSafeEqual(sha256(email.trim().toLowerCase()), sha256(adminEmail()));
  const passwordMatches = timingSafeEqual(actual, expected);
  return emailMatches && passwordMatches;
}
