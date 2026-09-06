#!/usr/bin/env node
/**
 * Vérifie que le .env est réellement exploitable avant un déploiement de
 * catalogue. N'affiche jamais la valeur d'un secret.
 *
 *   node scripts/catalog/check-env.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const KEYS = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_STORAGE_BUCKET',
];

let ok = true;

for (const key of KEYS) {
  const value = process.env[key];

  if (!value) {
    console.log(`❌ ${key.padEnd(26)} absente`);
    ok = false;
    continue;
  }

  let note = `${value.length} caractères`;

  if (key === 'DATABASE_URL') {
    try {
      const url = new URL(value);
      note = `${url.protocol}//…@${url.hostname}:${url.port}${url.pathname}`;
    } catch {
      note = '⚠️  URL illisible';
      ok = false;
    }
  }

  if (key === 'FIREBASE_PRIVATE_KEY') {
    // firebase.service.ts remplace les \n littéraux : après ce traitement la
    // clé doit contenir de vrais sauts de ligne et un en-tête PEM.
    const pem = value.replace(/\\n/g, '\n');
    const hasHeader = pem.includes('-----BEGIN PRIVATE KEY-----');
    const hasNewlines = pem.includes('\n');
    note = `${hasHeader ? 'en-tête PEM ok' : '⚠️  en-tête PEM absent'}, ${hasNewlines ? 'sauts de ligne ok' : '⚠️  aucun saut de ligne'}`;
    if (!hasHeader || !hasNewlines) ok = false;
  }

  if (key === 'FIREBASE_STORAGE_BUCKET') {
    if (value.startsWith('gs://')) {
      note = '⚠️  contient gs:// (à retirer)';
      ok = false;
    } else {
      note = value;
    }
  }

  if (key === 'FIREBASE_CLIENT_EMAIL') note = value.replace(/^[^@]+/, '…');

  console.log(`${ok || !note.startsWith('⚠️') ? '✅' : '❌'} ${key.padEnd(26)} ${note}`);
}

console.log(ok ? '\n→ Variables exploitables' : '\n→ Corrections nécessaires avant déploiement');
process.exit(ok ? 0 : 1);
