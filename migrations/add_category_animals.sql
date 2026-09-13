-- Catégorie « Animaux incroyables » (slug: animals) — 24 personnages
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
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/01-lion.jpg', 'Lion', 'Sumit.pamnani at English Wikipedia', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Lion%20in%20masai%20mara.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/02-tigre.jpg', 'Tigre', 'Gowri Subramanya', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:A%20tiger%20portrait.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/03-guepard.jpg', 'Guépard', 'Charles J. Sharp', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Cheetah%20(Acinonyx%20jubatus)%20female%202.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/04-panthere-des-neiges.jpg', 'Panthère des neiges', 'Bernard Landgraf', 'CC BY-SA 3.0', 'http://creativecommons.org/licenses/by-sa/3.0/', 'https://commons.wikimedia.org/wiki/File:Uncia%20uncia.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/05-loup.jpg', 'Loup gris', 'User:Mas3cf', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Eurasian%20wolf%202.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/06-renard.jpg', 'Renard roux', 'Peter Trimming', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Fox%20at%20the%20British%20Wildlife%20Centre%2C%20Newchapel%2C%20Surrey%20-%20geograph.org.uk%20-%202221750.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/07-ours-polaire.jpg', 'Ours polaire', 'Alan Wilson', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Polar%20Bear%20-%20Alaska%20(cropped).jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/08-panda-geant.jpg', 'Panda géant', 'Jeff Kubina', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Giant%20Panda%202004-03-2.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/09-panda-roux.jpg', 'Panda roux', 'Ajit Hota', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:RedPanda%20SingalilaNationalPark%20DFrame.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/10-koala.jpg', 'Koala', 'Diliff', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Koala%20climbing%20tree.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/11-dauphin.jpg', 'Grand dauphin', 'NASA', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Tursiops%20truncatus%2001-cropped.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/12-elephant.jpg', 'Éléphant d’Afrique', 'Giles Laurent', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:178%20Male%20African%20bush%20elephant%20in%20Etosha%20National%20Park%20Photo%20by%20Giles%20Laurent.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/13-girafe.jpg', 'Girafe', 'John Walker', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Giraffen.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/14-zebre.jpg', 'Zèbre', 'Joachim Huber 2007-2025 (R.I.P.)', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Equus%20quagga.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/15-hippopotame.jpg', 'Hippopotame', 'Bernard DUPONT from FRANCE', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Hippo%20(Hippopotamus%20amphibius)%20(16485955207).jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/16-rhinoceros.jpg', 'Rhinocéros blanc', 'Payamfarahani', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:White%20rhinoceros%20africa.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/17-gorille.jpg', 'Gorille', 'Macinate', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Gorille.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/18-lemurien.jpg', 'Maki catta', 'Francis C. Franklin', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Ring%20tailed%20lemur%20portrait.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/19-paresseux.jpg', 'Paresseux', 'Stefan Laube ( Tauchgurke )', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Bradypus.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/20-capybara.jpg', 'Capybara', 'Bernard DUPONT from FRANCE', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Capybaras%20(Hydrochoerus%20hydrachaeris)%20female%20and%20young%20suckling%20...%20(48427191032).jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/21-manchot-empereur.jpg', 'Manchot empereur', 'Hannes Grobe/AWI', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'https://commons.wikimedia.org/wiki/File:Emperor-solo%20hg.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/22-flamant-rose.jpg', 'Flamant rose', 'El Golli Mohamed', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Flamant%20rose%20Thyna009.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/23-axolotl.jpg', 'Axolotl', 'LoKiLeCh', 'CC BY-SA 3.0', 'http://creativecommons.org/licenses/by-sa/3.0/', 'https://commons.wikimedia.org/wiki/File:Axolotl%20Portrait.jpg', NULL),
  ('animals', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/animals/24-requin-blanc.jpg', 'Grand requin blanc', 'Sharkdiver.com', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Carcharodon%20carcharias.jpg', NULL)
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
--   (SELECT id FROM "image" WHERE category = 'animals' AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'animals' AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = 'animals' AND user_id IS NULL;
-- COMMIT;
