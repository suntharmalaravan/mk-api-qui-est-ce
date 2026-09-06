#!/usr/bin/env node
/**
 * Applique un fichier de migration sur la base pointée par DATABASE_URL.
 *
 *   node scripts/catalog/apply-migration.js migrations/add_category_footballers.sql
 *   node scripts/catalog/apply-migration.js migrations/add_category_footballers.sql --dry-run
 *
 * Le fichier porte ses propres BEGIN/COMMIT : en cas d'erreur en cours de
 * route, Postgres annule tout le bloc.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!file) {
    console.error('Usage: node scripts/catalog/apply-migration.js <fichier.sql> [--dry-run]');
    process.exit(1);
  }

  const sqlPath = path.resolve(file);
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Fichier introuvable: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const target = new URL(process.env.DATABASE_URL);
  console.log(`📄 ${path.basename(sqlPath)} (${sql.length} octets)`);
  console.log(`🎯 ${target.hostname}:${target.port}${target.pathname}`);

  if (dryRun) {
    console.log('\n🔍 Simulation — rien n\'est exécuté.');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const results = await client.query(sql);
    const list = Array.isArray(results) ? results : [results];

    for (const result of list) {
      if (result.command === 'INSERT') console.log(`\n✅ INSERT — ${result.rowCount} lignes`);
      if (result.command === 'SELECT' && result.rows.length) {
        console.log('\n📊 Vérification :');
        console.table(result.rows);
      }
    }
    console.log('\n✅ Migration appliquée');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('❌ Échec:', error.message);
  process.exit(1);
});
