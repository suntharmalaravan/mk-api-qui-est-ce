-- Catégorie « Food & snacks » (slug: food_snacks) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-13
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
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/01-pizza.jpg', 'Pizza', 'Valerio Capello at English Wikipedia', 'CC BY-SA 3.0', 'http://creativecommons.org/licenses/by-sa/3.0/', 'https://commons.wikimedia.org/wiki/File:Eq%20it-na%20pizza-margherita%20sep2005%20sml.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/02-sushi.jpg', 'Sushi', 'Yumi Kimura', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Various%20sushi%2C%20beautiful%20October%20night%20at%20midnight.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/03-burger.jpg', 'Burger', 'Luke', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Burger%20King%20double%20cheeseburger.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/04-tacos.jpg', 'Tacos', 'Popo le Chien', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Tacos%202.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/05-ramen.jpg', 'Ramen', 'Mariaaa05', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Ramen%2C%20sopa%20de%20fideus.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/06-bubble-tea.jpg', 'Bubble tea', 'Battlesnake1', 'CC0', 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Pearl%20Milk%20Tea%20in%20Chun%20Shui%20Tang.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/07-croissant.jpg', 'Croissant', 'Herry Wibisono ( herryway )', 'CC0', 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Croissants%20au%20beurre%20(18953292873).jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/08-donut.jpg', 'Donut', 'Angeldm', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Doughnut.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/09-kebab.jpg', 'Kebab', 'Usien', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Zwei%20Doener%20Kebab.JPG', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/10-mochi.jpg', 'Mochi', 'No machine-readable author provided. Lyzzy assumed (based on copyright claims).', 'CC BY 2.5', 'https://creativecommons.org/licenses/by/2.5', 'https://commons.wikimedia.org/wiki/File:Daifuku%201.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/11-tiramisu.jpg', 'Tiramisu', 'Sharon Chen from Austin, United States', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Classic%20Italian%20Tiramisu-3%20(29989504485).jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/12-paella.jpg', 'Paella', 'Jebulon', 'CC0', 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Cooking%20a%20paella.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/13-couscous.jpg', 'Couscous', 'Lmmima', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Moroccan%20cuscus%2C%20from%20Casablanca%2C%20September%202018.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/14-fondue.jpg', 'Fondue', 'Juliano Mendes', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Fondue%20dish.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/15-crepe.jpg', 'Crêpe', 'David Monniaux', 'CC BY-SA 3.0', 'http://creativecommons.org/licenses/by-sa/3.0/', 'https://commons.wikimedia.org/wiki/File:Crepes%20dsc07085.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/16-gaufre.jpg', 'Gaufre', 'No machine-readable author provided. Jrenier assumed (based on copyright claims).', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Gaufre%20molle.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/17-hot-dog.jpg', 'Hot-dog', 'Evan Swigart from Chicago, USA', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Hotdog%20-%20Evan%20Swigart.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/18-frites.jpg', 'Frites', 'Horacio Cambeiro', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:Papas%20fritas%20(plato).jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/19-churros.jpg', 'Churros', 'Garry Knight from London, England', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Churros%20en%20vasos%20en%20Londres%20-%20A%20Taste%20of%20Spain.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/20-macarons.jpg', 'Macarons', 'M0tty', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Macarons%20Marcolini%2004.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/21-avocado-toast.jpg', 'Avocado toast', 'Jami430', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Avocado%20toast%20with%20sesame%20seeds.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/22-nuggets.jpg', 'Nuggets', 'Evan-Amos', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:McDonalds-Chicken-McNuggets.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/23-glace.jpg', 'Glace', 'Peachyeung316', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:A%20cup%20of%20three%20ice%20cream%20in%20Victoria%20Peak%20Hong%20Kong.jpg', NULL),
  ('food_snacks', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/food_snacks/24-falafel.jpg', 'Falafel', 'Burkhard Mücke', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Falafel%20beim%20Isarinselfest%20M%C3%BCnchen%202.jpg', NULL)
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
--   (SELECT id FROM "image" WHERE category = 'food_snacks' AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'food_snacks' AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = 'food_snacks' AND user_id IS NULL;
-- COMMIT;
