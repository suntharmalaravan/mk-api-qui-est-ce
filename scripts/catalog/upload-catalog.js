#!/usr/bin/env node
/**
 * Envoie les images d'une catégorie sur Firebase Storage et note les URL
 * publiques obtenues dans le manifeste.
 *
 *   node scripts/catalog/upload-catalog.js footballers
 *   node scripts/catalog/upload-catalog.js footballers --dry-run
 *
 * Le chemin de stockage est identique à celui de FirebaseService.uploadCatalogImage
 * (catalog/<slug>/<fichier>), pour que l'API et ce script restent alignés.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function initFirebase() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('FIREBASE_STORAGE_BUCKET absente — voir scripts/catalog/check-env.js');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: bucketName,
  });

  return admin.storage().bucket();
}

async function main() {
  const slug = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!slug) {
    console.error('Usage: node scripts/catalog/upload-catalog.js <slug> [--dry-run]');
    process.exit(1);
  }

  const dir = path.join(__dirname, '..', '..', 'assets', 'catalog', slug);
  const manifestPath = path.join(dir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifeste introuvable: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Un catalogue incomplet casserait la partie : le jeu exige 18 images.
  if (manifest.images.length < 18) {
    console.error(`❌ ${manifest.images.length} images seulement — le jeu en exige 18 minimum.`);
    process.exit(1);
  }

  const missing = manifest.images.filter((i) => !fs.existsSync(path.join(dir, i.file)));
  if (missing.length) {
    console.error(`❌ Fichiers absents du dossier: ${missing.map((m) => m.file).join(', ')}`);
    process.exit(1);
  }

  console.log(`📦 ${manifest.images.length} images — catégorie "${manifest.slug}"`);
  if (dryRun) console.log('🔍 Simulation, aucun envoi\n');

  const bucket = dryRun ? null : initFirebase();
  if (bucket) console.log(`🔥 Bucket: ${bucket.name}\n`);

  for (const image of manifest.images) {
    const localPath = path.join(dir, image.file);
    const mimeType = image.file.endsWith('.png') ? 'image/png' : 'image/jpeg';

    if (dryRun) {
      console.log(`  · ${image.file.padEnd(24)} → ${image.storagePath}`);
      continue;
    }

    const file = bucket.file(image.storagePath);
    await file.save(fs.readFileSync(localPath), {
      metadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000' },
      validation: 'crc32c',
    });
    await file.makePublic();

    image.url = `https://storage.googleapis.com/${bucket.name}/${image.storagePath}`;
    console.log(`  ✅ ${image.file.padEnd(24)} → ${image.url}`);
  }

  if (!dryRun) {
    manifest.uploadedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📝 URL publiques enregistrées dans ${manifestPath}`);
  }
}

main().catch((error) => {
  console.error('❌ Échec:', error.message);
  process.exit(1);
});
