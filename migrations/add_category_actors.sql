-- Catégorie « Acteurs & actrices » (slug: actors) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-06
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
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/01-jenna-ortega.jpg', 'Jenna Ortega', 'Harald Krichel', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Jenna%20Ortega-63799%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/02-zendaya.jpg', 'Zendaya', 'PhilipRomano', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Zendaya-byPhilipRomano.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/03-tom-holland.jpg', 'Tom Holland', 'PhilipRomano', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:TomHolland-byPhilipRomano.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/04-timothee-chalamet.jpg', 'Timothée Chalamet', 'Harald Krichel', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Timoth%C3%A9e%20Chalamet-63541%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/05-millie-bobby-brown.jpg', 'Millie Bobby Brown', 'Laviru Koruwakankanamge', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Millie%20Bobby%20Brown%20-%20MBB%20-%204%20-%20SFM5%20-%20July%2010%2C%202022%20at%20Stranger%20Fan%20Meet%205%20People%20Convention%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/06-anya-taylor-joy.jpg', 'Anya Taylor-Joy', 'Sara Komatsu', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Anya%20Taylor-Joy%20at%20the%202025%20Toronto%20International%20Film%20Festival.%2007%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/07-sydney-sweeney.jpg', 'Sydney Sweeney', 'Jay Dixit', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Sydney%20Sweeney%20at%20the%202024%20Toronto%20International%20Film%20Festival%2004%20(Cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/08-jacob-elordi.jpg', 'Jacob Elordi', 'JoshPopov', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:JacobElordi-TIFF2025-01%20(cropped%202).png'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/09-florence-pugh.jpg', 'Florence Pugh', 'Frank Sun', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Florence%20Pugh%20at%20the%202024%20Toronto%20International%20Film%20Festival%2013%20(cropped%202%20%E2%80%93%20color%20adjusted).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/10-saoirse-ronan.jpg', 'Saoirse Ronan', 'Scottish Government', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Mary%20Queen%20of%20Scots%20premiere%20(31825261767)%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/11-hunter-schafer.jpg', 'Hunter Schafer', 'Harald Krichel', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Hunter%20Schafer-64616%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/12-ayo-edebiri.jpg', 'Ayo Edebiri', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Ayo%20Edebiri%20After%20The%20Hunt-43%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/13-pedro-pascal.jpg', 'Pedro Pascal', 'Gage Skidmore', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Pedro%20Pascal%20by%20Gage%20Skidmore.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/14-margot-robbie.jpg', 'Margot Robbie', 'Eva Rinaldi from Sydney Australia', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:SYDNEY%2C%20AUSTRALIA%20-%20JANUARY%2023%20Margot%20Robbie%20arrives%20at%20the%20Australian%20Premiere%20of%20''I%2C%20Tonya''%20on%20January%2023%2C%202018%20in%20Sydney%2C%20Australia%20(25980753838)%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/15-ryan-gosling.jpg', 'Ryan Gosling', 'Raph_PH', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:GoslingBFI081223%20(22%20of%2030)%20(53388157347)%20(cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/16-keanu-reeves.jpg', 'Keanu Reeves', 'Gabriel Hutchinson', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Keanu%20Reeves%20at%20TIFF%202025%2002%20(Cropped).jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/17-cillian-murphy.jpg', 'Cillian Murphy', 'JoshPopov', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:CillianMurphy-TIFF2025-01-Cropped%20(cropped).png'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/18-emma-stone.jpg', 'Emma Stone', 'Gabriel Hutchinson', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Emma%20Stone%20at%20the%202025%20Cannes%20Film%20Festival%2004.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/19-daniel-radcliffe.jpg', 'Daniel Radcliffe', 'Gage Skidmore from Peoria, AZ, United States of America', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 'https://commons.wikimedia.org/wiki/File:Daniel%20Radcliffe%20in%20July%202015.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/20-emma-watson.jpg', 'Emma Watson', 'Georges Biard', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Emma%20Watson%202013.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/21-robert-pattinson.jpg', 'Robert Pattinson', 'Elena Ternovaja', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Robert%20Pattinson%20at%20Berlinale%202025.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/22-andrew-garfield.jpg', 'Andrew Garfield', 'Raph_PH', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:Andrew%20Garfield.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/23-lupita-nyongo.jpg', 'Lupita Nyong''o', 'PhilipRomano', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:LupitaNyongo-byPhilipRomano3.jpg'),
  ('actors', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/actors/24-austin-butler.jpg', 'Austin Butler', 'Gabriel Hutchinson', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Austin%20Butler%20at%20the%202025%20Cannes%20Film%20Festival%2002.jpg')
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
--   (SELECT id FROM "image" WHERE category = 'actors' AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'actors' AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = 'actors' AND user_id IS NULL;
-- COMMIT;
