-- Catégorie « Mythologie » (slug: mythology) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-14
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
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/01-zeus.jpg', 'Zeus', 'Unknown artist Unknown artist', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Zeus%20Otricoli%20Pio-Clementino%20Inv257.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/02-poseidon.jpg', 'Poséidon', 'Auteur inconnu', 'CC BY-SA 3.0', 'http://creativecommons.org/licenses/by-sa/3.0/', 'https://commons.wikimedia.org/wiki/File:Poseidon%20sculpture%20Copenhagen%202005.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/03-hades.jpg', 'Hadès', 'Carole Raddato from Frankfurt, Germany', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Detail%20of%20Pluto-Serapis%2C%20Statue%20group%20of%20Persephone%20(as%20Isis)%20and%20Pluto%20(as%20Serapis)%2C%20from%20the%20Sanctuary%20of%20the%20Egyptian%20Gods%20at%20Gortyna%2C%20mid-2nd%20century%20AD%2C%20Heraklion%20Archaeological%20Museum%20(30305313721).jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/04-athena.jpg', 'Athéna', 'Unknown (Greek original by Kresilas)', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Bust%20Athena%20Velletri%20Glyptothek%20Munich%20213.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/05-ares.jpg', 'Arès', 'Wikipedia Commons', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:%CE%9F%20%CE%86%CF%81%CE%B7%CF%82%20(Borghese-%CE%9B%CE%BF%CF%8D%CE%B2%CF%81%CE%BF%CF%85).jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/06-hermes.jpg', 'Hermès', 'Phidias (?)', 'CC BY 2.5', 'https://creativecommons.org/licenses/by/2.5', 'https://commons.wikimedia.org/wiki/File:Hermes%20Logios%20Altemps%20Inv8624%20n2bb.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/07-aphrodite.jpg', 'Aphrodite', 'Ricardo André Frantz ( User:Tetraktys )', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Aphrodite8.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/08-apollon.jpg', 'Apollon', 'Livioandronico2013', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Apollo%20of%20the%20Belvedere.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/09-artemis.jpg', 'Artémis', 'Illustrated by Engravings on Wood.', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Artemis%2C%20Diana%20(Museum%20Capitolinum).png', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/10-hercule.jpg', 'Hercule', 'Antonio del Pollaiuolo', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Antonio%20del%20Pollaiolo%20-%20Ercole%20e%20l''Idra%20e%20Ercole%20e%20Anteo%20-%20Google%20Art%20Project.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/11-meduse.jpg', 'Méduse', 'Caravaggio', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Medusa%20by%20Carvaggio.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/12-minotaure.jpg', 'Minotaure', 'Painter of London E 4', 'CC BY 2.5', 'https://creativecommons.org/licenses/by/2.5', 'https://commons.wikimedia.org/wiki/File:Tondo%20Minotaur%20London%20E4%20MAN.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/13-odin.jpg', 'Odin', 'Ólafur Brynjúlfsson [2]', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:NKS%201867%204to%2C%2097v%2C%20Odin%20on%20Sleipnir.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/14-thor.jpg', 'Thor', 'Johannes Gehrts (1855–1921)', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Thor%20(Walhall).png', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/15-loki.jpg', 'Loki', 'Auteur inconnu', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Processed%20SAM%20loki.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/16-freyja.jpg', 'Freyja', 'Nils Blommér', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Freyja%20and%20cats%20and%20angels%20by%20Blommer.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/17-heimdall.jpg', 'Heimdall', 'Jakob Sigurðsson [2]', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:S%C3%81M%2066%2C%2080r%2C%20Heimdallr.jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/18-fenrir.jpg', 'Fenrir', 'The image is signed A. Fleming', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Fenrir%20(Manual%20of%20Mythology).jpg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/19-ra.jpg', 'Râ', 'Jeff Dahl', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Re-Horakhty.svg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/20-anubis.jpg', 'Anubis', 'Jeff Dahl', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Anubis%20standing.svg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/21-horus.jpg', 'Horus', 'Jeff Dahl', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Horus%20standing.svg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/22-bastet.jpg', 'Bastet', 'Gunawan Kartapranata', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Bastet.svg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/23-osiris.jpg', 'Osiris', 'Jeff Dahl', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Standing%20Osiris.svg', NULL),
  ('mythology', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/mythology/24-isis.jpg', 'Isis', 'Jeff Dahl', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Isis.svg', NULL)
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
--   (SELECT id FROM "image" WHERE category = 'mythology' AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'mythology' AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = 'mythology' AND user_id IS NULL;
-- COMMIT;
