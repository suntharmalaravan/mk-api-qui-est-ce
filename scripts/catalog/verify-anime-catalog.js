#!/usr/bin/env node
// --remote : télécharge les exports publics et compare les empreintes.
// --database : vérifie le catalogue et sa visibilité dans la base configurée.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const sharp = require('sharp');
const roster = require('./anime.roster.json');
const dir = path.resolve(__dirname, '../../assets/catalog/anime');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
async function main() {
  assert.equal(manifest.slug, 'anime');
  assert.equal(manifest.images.length, 24);
  assert.deepEqual(manifest.images.map(i => i.name), roster.characters.map(c => c.name));
  assert.equal(new Set(manifest.images.map(i => i.sha256)).size, 24);
  for (const image of manifest.images) {
    const data = fs.readFileSync(path.join(dir, image.file));
    assert.equal(hash(data), image.sha256);
    const metadata = await sharp(data).metadata();
    assert.equal(metadata.width, 768);
    assert.equal(metadata.height, 768);
    assert.equal(metadata.format, 'jpeg');
    if (process.argv.includes('--remote')) {
      assert.ok(image.url?.startsWith('https://storage.googleapis.com/'));
      const response = await fetch(image.url, { signal: AbortSignal.timeout(20000) });
      assert.equal(response.status, 200, image.name);
      assert.match(response.headers.get('content-type'), /^image\/jpeg/);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())), image.sha256, image.name);
    }
  }
  console.log('24 fichiers uniques : dimensions, noms et empreintes OK' + (process.argv.includes('--remote') ? ' (local + public)' : ' (local)'));
  if (process.argv.includes('--database')) {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
    await client.connect();
    try {
      const { rows } = await client.query('SELECT name,url FROM image WHERE category=$1 AND user_id IS NULL ORDER BY name', ['anime']);
      assert.deepEqual(rows, manifest.images.map(i => ({ name: i.name, url: i.url })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const hidden = await client.query('SELECT 1 FROM category_setting WHERE slug=$1 AND visible=false', ['anime']);
      assert.equal(hidden.rowCount, 0);
      console.log('Production : 24 personnages exacts, URL conformes, catégorie visible et jouable.');
    } finally { await client.end(); }
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
