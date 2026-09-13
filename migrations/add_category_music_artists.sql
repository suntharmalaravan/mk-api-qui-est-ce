-- Catégorie « Stars de la musique » (slug: music_artists) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-07
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
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/01-bad-bunny.jpg', 'Bad Bunny', 'Toglenn', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Bad%20Bunny%202019%20by%20Glenn%20Francis%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/02-taylor-swift.jpg', 'Taylor Swift', 'iHeartRadioCA', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'https://commons.wikimedia.org/wiki/File:Taylor%20Swift%20at%20the%202023%20MTV%20Video%20Music%20Awards%20(3).png', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/03-the-weeknd.jpg', 'The Weeknd', 'Brian Ziff', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:The%20Weeknd%20Portrait%20by%20Brian%20Ziff.jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/04-drake.jpg', 'Drake', 'The Come Up Show', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Drake%20July%202016.jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/05-billie-eilish.jpg', 'Billie Eilish', 'Raph_PH', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:BillieEilishO2140725-39%20-%2054665577407%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/06-kendrick-lamar.jpg', 'Kendrick Lamar', 'Fuzheado', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Pulitzer2018-portraits-kendrick-lamar.jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/07-bruno-mars.jpg', 'Bruno Mars', 'slgckgc', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:BrunoMars24KMagicWorldTourLive%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/08-ariana-grande.jpg', 'Ariana Grande', 'Barbie Simons', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'https://commons.wikimedia.org/wiki/File:Ariana%20Grande%20promoting%20Wicked%20(2024).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/09-sabrina-carpenter.jpg', 'Sabrina Carpenter', 'Raph_PH', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Sabrina%20Carpenter%20-%20O2%20Arena%202025%20-%20086%20(cropped%202).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/10-lady-gaga.jpg', 'Lady Gaga', 'Office of the Vice President of the United States', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Lady%20Gaga%20at%20Oscars%202016.jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/11-dua-lipa.jpg', 'Dua Lipa', 'Harald Krichel', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Dua%20Lipa-69798%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/12-olivia-rodrigo.jpg', 'Olivia Rodrigo', 'Raph_PH', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:Glasto2025-546%20(cropped%202).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/13-sza.jpg', 'SZA', 'Raph_PH', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:KendrickSZASPurs230725-19%20-%2054683179509%20(cropped)%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/14-doja-cat.jpg', 'Doja Cat', 'Raph_PH', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:DojaCatO2140624%20(87%20of%20105)%20(53792876988)%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/15-rihanna.jpg', 'Rihanna', 'U.S. Embassy Bridgetown', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Rihanna%20visits%20U.S.%20Embassy%20in%20Barbados%202024%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/16-beyonce.jpg', 'Beyoncé', 'Raph_PH', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Beyonc%C3%A9%20-%20Tottenham%20Hotspur%20Stadium%20-%201st%20June%202023%20(10%20of%20118)%20(52946364598)%20(best%20crop).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/17-justin-bieber.jpg', 'Justin Bieber', 'Lou Stejskal', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Justin%20Bieber%20in%202015.jpg', 'personality'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/18-harry-styles.jpg', 'Harry Styles', 'Raph_PH', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:HarryStylesWembley170623%20(14%20of%2093)%20(52982076132)%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/19-ed-sheeran.jpg', 'Ed Sheeran', 'Harald Krichel', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Ed%20Sheeran-6886%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/20-post-malone.jpg', 'Post Malone', 'Cosmopolitan UK', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'https://commons.wikimedia.org/wiki/File:Post%20Malone%20at%20the%202019%20American%20Music%20Awards.png', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/21-aya-nakamura.jpg', 'Aya Nakamura', 'Mathis.aclr', 'CC0', 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Aya%20Nakamura%20IMG%204756%20(cropped).jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/22-stromae.jpg', 'Stromae', 'Pierre Huguet', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Le%20chanteur%20Stromae.jpg', 'personality-rights'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/23-angele.jpg', 'Angèle', 'Thesupermat', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Festival%20des%20Vieilles%20Charrues%202018%20-%20Ang%C3%A8le%20-%20011.jpg', 'personality'),
  ('music_artists', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/music_artists/24-gims.jpg', 'Gims', 'Georges Biard', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Ma%C3%AEtre%20Gims%20Cannes%202016.jpg', 'personality')
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
--   (SELECT id FROM "image" WHERE category = 'music_artists' AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'music_artists' AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = 'music_artists' AND user_id IS NULL;
-- COMMIT;
