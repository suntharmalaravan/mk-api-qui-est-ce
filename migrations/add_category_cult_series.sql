-- Catégorie « Séries cultes » (slug: cult_series) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-15
-- À exécuter dans l'éditeur SQL de la base, ou via scripts/catalog/apply-migration.js

BEGIN;

-- Utilise le schéma et l’index du catalogue officiel existants.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('catalog:cult_series'));

-- 3. Les personnages
INSERT INTO "image" ("category", "url", "name", "author", "license", "license_url", "source_url", "restrictions")
VALUES
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/28523eff2ff1-01-juliette-nichols-v2.jpg', 'Juliette Nichols', NULL, NULL, NULL, 'https://www.esquire.com/entertainment/tv/a44466554/silo-season-1-ending-finale-recap/', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/84521f7069a0-02-jesse-pinkman.jpg', 'Jesse Pinkman', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Jesse_Pinkman', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/5d470288fa6f-03-saul-goodman.jpg', 'Saul Goodman', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Saul_Goodman', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/db9ee884d995-04-thomas-shelby.jpg', 'Thomas Shelby', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Tommy_Shelby', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/710ed5c4f102-05-mercredi-addams.jpg', 'Mercredi Addams', NULL, NULL, NULL, 'https://www.digitalspy.com/tv/ustv/a42050261/wednesday-ending-explained-netflix/', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/b9bde5300677-06-eleven.jpg', 'Eleven', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Eleven_(Stranger_Things)', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/3d1052d39a18-07-dustin-henderson.jpg', 'Dustin Henderson', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Dustin_Henderson', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/95590fd4d06b-08-le-professeur.jpg', 'Le Professeur', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Professor_(Money_Heist)', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/8c70f86bebc9-09-tokyo.jpg', 'Tokyo', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Tokyo_(Money_Heist)', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/cbea4c8ec05a-10-berlin.jpg', 'Berlin', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Berlin_(Money_Heist)', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/9b2b92ab89aa-11-dexter-morgan.jpg', 'Dexter Morgan', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Dexter_Morgan', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/a523c05d6087-12-rick-grimes.jpg', 'Rick Grimes', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Rick_Grimes', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/051dd0ecaa94-13-daryl-dixon.jpg', 'Daryl Dixon', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Daryl_Dixon', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/ecd8ab98a19b-14-jon-snow.jpg', 'Jon Snow', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Jon_Snow_(character)', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/f84fdabd45e3-15-daenerys-targaryen.jpg', 'Daenerys Targaryen', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Daenerys_Targaryen', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/9c4cb6d054d6-16-tyrion-lannister.jpg', 'Tyrion Lannister', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Tyrion_Lannister', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/ff5fccfa7892-17-sheldon-cooper.jpg', 'Sheldon Cooper', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Sheldon_Cooper', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/7651b4299d12-18-penny.jpg', 'Penny', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Penny_(The_Big_Bang_Theory)', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/0afe187a8ea3-19-phoebe-buffay.jpg', 'Phoebe Buffay', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Phoebe_Buffay', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/ec2aeda16a08-20-joey-tribbiani.jpg', 'Joey Tribbiani', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Joey_Tribbiani', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/cb6ec2037391-21-michael-scofield.jpg', 'Michael Scofield', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Michael_Scofield', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/24902b37d98b-22-gregory-house.jpg', 'Dr House', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Gregory_House', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/2008d48b9a18-23-sherlock-holmes.jpg', 'Sherlock Holmes', NULL, NULL, NULL, 'https://x.com/Sherlockology/status/811820108159000576', 'Illustration générée par IA ; personnage de fiction.'),
  ('cult_series', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cult_series/v1/84bc1b354828-24-mr-bean.jpg', 'Mr Bean', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Mr._Bean_(character)', 'Illustration générée par IA ; personnage de fiction.')
ON CONFLICT ("category", "name") WHERE "user_id" IS NULL
DO UPDATE SET
  "url"         = EXCLUDED."url",
  "author"      = EXCLUDED."author",
  "license"     = EXCLUDED."license",
  "license_url" = EXCLUDED."license_url",
  "source_url"  = EXCLUDED."source_url",
  "restrictions" = EXCLUDED."restrictions";

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM image WHERE category = 'cult_series' AND user_id IS NULL) <> 24 THEN
    RAISE EXCEPTION 'La catégorie cult_series doit contenir exactement 24 personnages officiels';
  END IF;
END;
$$;

COMMIT;

-- Vérification
SELECT category, COUNT(*) AS images, COUNT(license) AS avec_licence
FROM "image" WHERE user_id IS NULL GROUP BY category ORDER BY category;

-- ROLLBACK : masquer sans supprimer les images des parties existantes.
-- INSERT INTO category_setting (slug, visible) VALUES ('cult_series', false)
-- ON CONFLICT (slug) DO UPDATE SET visible = false;
