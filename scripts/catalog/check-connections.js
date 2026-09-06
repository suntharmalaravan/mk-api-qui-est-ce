#!/usr/bin/env node
/** Teste les accès réels : Postgres (Railway) et Firebase Storage. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Client } = require('pg');
const admin = require('firebase-admin');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `SELECT category, COUNT(*)::int AS n FROM "image" WHERE user_id IS NULL GROUP BY category ORDER BY category`,
  );
  console.log('✅ Postgres joignable. Catégories officielles existantes :');
  rows.forEach((r) => console.log(`   ${String(r.category ?? '(null)').padEnd(16)} ${r.n} images`));
  if (!rows.length) console.log('   (aucune)');
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='image' ORDER BY ordinal_position`,
  );
  console.log('   colonnes image :', cols.rows.map((c) => c.column_name).join(', '));
  await client.end();

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  const bucket = admin.storage().bucket();
  const [exists] = await bucket.exists();
  console.log(`\n${exists ? '✅' : '❌'} Bucket Firebase "${bucket.name}" ${exists ? 'accessible' : 'INTROUVABLE'}`);
  const [meta] = await bucket.getMetadata();
  const uniform = meta.iamConfiguration?.uniformBucketLevelAccess?.enabled;
  console.log(`   uniform bucket-level access : ${uniform ? '⚠️  ACTIVÉ (makePublic échouera)' : 'désactivé (makePublic ok)'}`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
