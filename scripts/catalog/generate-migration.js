#!/usr/bin/env node
/**
 * Écrit la migration SQL qui insère une catégorie du catalogue en base,
 * à partir du manifeste (donc après upload, quand les URL sont connues).
 *
 *   node scripts/catalog/generate-migration.js footballers
 *
 * Format aligné sur migrations/custom_library_mode.sql : BEGIN/COMMIT,
 * requête de vérification, bloc de rollback en commentaire.
 */

const fs = require('fs');
const path = require('path');

const quote = (value) => (value === null || value === undefined || value === ''
  ? 'NULL'
  : `'${String(value).replace(/'/g, "''")}'`);

function cleanAuthor(author) {
  if (!author) return null;
  // Commons répète parfois le champ quand l'auteur est inconnu.
  const cleaned = author.replace(/^(Unknown author\s*)+$/i, '').trim();
  return cleaned || 'Auteur inconnu';
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/catalog/generate-migration.js <slug>');
    process.exit(1);
  }

  const manifestPath = path.join(__dirname, '..', '..', 'assets', 'catalog', slug, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifeste introuvable: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const withoutUrl = manifest.images.filter((i) => !i.url);
  if (withoutUrl.length) {
    console.error(`❌ ${withoutUrl.length} images sans URL publique — lancer d'abord upload-catalog.js`);
    process.exit(1);
  }

  const values = manifest.images.map((image) => {
    const a = image.attribution || {};
    return '  (' + [
      quote(slug),
      quote(image.url),
      quote(image.name),
      quote(cleanAuthor(a.author)),
      quote(a.license),
      quote(a.licenseUrl),
      quote(a.sourceFile),
    ].join(', ') + ')';
  }).join(',\n');

  const sql = `-- Catégorie « ${manifest.label} » (slug: ${slug}) — ${manifest.images.length} personnages
-- Généré par scripts/catalog/generate-migration.js le ${new Date().toISOString().slice(0, 10)}
-- À exécuter dans l'éditeur SQL de la base, ou via scripts/catalog/apply-migration.js

BEGIN;

-- 1. Colonnes d'attribution. Les licences CC BY / CC BY-SA obligent à créditer
--    l'auteur et à nommer la licence partout où l'image est affichée.
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "author" VARCHAR(255);
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "license" VARCHAR(100);
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "license_url" VARCHAR(500);
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "source_url" VARCHAR(500);

-- 2. Unicité (catégorie, nom) sur le seul catalogue officiel, pour que ce
--    script puisse être rejoué sans créer de doublons.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_image_catalog_name"
  ON "image" ("category", "name") WHERE "user_id" IS NULL;

-- 3. Les personnages
INSERT INTO "image" ("category", "url", "name", "author", "license", "license_url", "source_url")
VALUES
${values}
ON CONFLICT ("category", "name") WHERE "user_id" IS NULL
DO UPDATE SET
  "url"         = EXCLUDED."url",
  "author"      = EXCLUDED."author",
  "license"     = EXCLUDED."license",
  "license_url" = EXCLUDED."license_url",
  "source_url"  = EXCLUDED."source_url";

COMMIT;

-- Vérification
SELECT category, COUNT(*) AS images, COUNT(license) AS avec_licence
FROM "image" WHERE user_id IS NULL GROUP BY category ORDER BY category;

-- ROLLBACK (si besoin) :
-- BEGIN;
-- UPDATE "room" SET hostcharacterid = NULL WHERE hostcharacterid IN
--   (SELECT id FROM "image" WHERE category = ${quote(slug)} AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = ${quote(slug)} AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = ${quote(slug)} AND user_id IS NULL;
-- COMMIT;
`;

  const outPath = path.join(__dirname, '..', '..', 'migrations', `add_category_${slug}.sql`);
  fs.writeFileSync(outPath, sql);
  console.log(`✅ Migration écrite: ${outPath}`);
  console.log(`   ${manifest.images.length} personnages, ${sql.length} octets`);
}

main();
