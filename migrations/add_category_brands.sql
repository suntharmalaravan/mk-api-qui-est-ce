-- Catégorie « Marques & logos » (slug: brands) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-06
-- À exécuter dans l'éditeur SQL de la base, ou via scripts/catalog/apply-migration.js

BEGIN;

-- 1. Colonnes d'attribution. Les licences CC BY / CC BY-SA obligent à créditer
--    l'auteur et à nommer la licence partout où l'image est affichée.
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "author" VARCHAR(255);
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "license" VARCHAR(100);
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "license_url" VARCHAR(500);
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "source_url" VARCHAR(500);
ALTER TABLE "image" ADD COLUMN IF NOT EXISTS "restrictions" VARCHAR(255);

-- 2. Unicité (catégorie, nom) sur le seul catalogue officiel, pour que ce
--    script puisse être rejoué sans créer de doublons.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_image_catalog_name"
  ON "image" ("category", "name") WHERE "user_id" IS NULL;

-- 3. Les personnages
INSERT INTO "image" ("category", "url", "name", "author", "license", "license_url", "source_url", "restrictions")
VALUES
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/01-apple.jpg', 'Apple', 'Original: Rob Janoff', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Apple%20logo%20black.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/02-nike.jpg', 'Nike', 'Carolyn Davidson , Nike', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Logo%20NIKE.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/03-adidas.jpg', 'Adidas', 'Adidas', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Adidas%202022%20logo.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/04-puma.jpg', 'Puma', 'CarlosEduardoPA', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Puma-logo-(text).svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/05-new-balance.jpg', 'New Balance', 'New Balance', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:New%20Balance%20logo.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/06-tiktok.jpg', 'TikTok', 'ByteDance', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Tiktok%20logo%20text.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/07-instagram.jpg', 'Instagram', 'Instagram', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Instagram%20logo%202022.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/08-youtube.jpg', 'YouTube', 'YouTube', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:YouTube%20Logo%202017.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/09-whatsapp.jpg', 'WhatsApp', 'WhatsApp', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:WhatsApp.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/10-spotify.jpg', 'Spotify', 'Spotify', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Spotify%20logo%20with%20text.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/11-netflix.jpg', 'Netflix', 'TM/®Netflix Inc.', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Netflix%20logo.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/12-discord.jpg', 'Discord', '™/®Discord Inc.', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Discord%20colour%20textlogo%20(2021).svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/13-twitch.jpg', 'Twitch', 'Twitch Interactive', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Twitch%20logo%202019.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/14-playstation.jpg', 'PlayStation', 'Sony Interactive Entertainment', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:PlayStation%20logo%20and%20wordmark.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/15-xbox.jpg', 'Xbox', 'Microsoft Corporation', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Xbox%20logo%20(2019).svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/16-nintendo.jpg', 'Nintendo', 'Nintendo', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Nintendo.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/17-steam.jpg', 'Steam', 'Steam', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Steam%20icon%20logo.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/18-mcdonalds.jpg', 'McDonald''s', 'McDonald''s', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:McDonald''s%20Golden%20Arches.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/19-coca-cola.jpg', 'Coca-Cola', 'The Coca-Cola Company', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Coca-Cola%20logo.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/20-starbucks.jpg', 'Starbucks', 'Auteur inconnu', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Starbucks%20coffee%20wordmark.png', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/21-red-bull.jpg', 'Red Bull', 'Red Bull GmbH', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Logo%20of%20Red%20bull.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/22-amazon.jpg', 'Amazon', 'Amazon.com , Inc.', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Amazon%20logo.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/23-tesla.jpg', 'Tesla', 'Tesla', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Tesla%20Motors.svg', 'trademarked'),
  ('brands', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/brands/24-lego.jpg', 'Lego', 'The Lego Group', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:LEGO%20logo.svg', 'trademarked')
ON CONFLICT ("category", "name") WHERE "user_id" IS NULL
DO UPDATE SET
  "url"         = EXCLUDED."url",
  "author"      = EXCLUDED."author",
  "license"     = EXCLUDED."license",
  "license_url" = EXCLUDED."license_url",
  "source_url"  = EXCLUDED."source_url",
  "restrictions" = EXCLUDED."restrictions";

COMMIT;

-- Vérification
SELECT category, COUNT(*) AS images, COUNT(license) AS avec_licence
FROM "image" WHERE user_id IS NULL GROUP BY category ORDER BY category;

-- ROLLBACK (si besoin) :
-- BEGIN;
-- UPDATE "room" SET hostcharacterid = NULL WHERE hostcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'brands' AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'brands' AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = 'brands' AND user_id IS NULL;
-- COMMIT;
