// Produit la valeur de ADMIN_PASSWORD_HASH : scrypt:N:r:p:sel:clé (base64url).
// Séparateur « : » et non « $ », que le chargement des .env interprète comme une variable.
import { randomBytes, scrypt } from 'node:crypto';

const N = 2 ** 15;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Usage : npm run hash-password -- 'mot de passe (12 caractères minimum)'");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * 1024 * 1024 }, (error, derived) =>
    error ? reject(error) : resolve(derived),
  ),
);

console.log(['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join(':'));
