-- Catégorie « Dessins animés » (slug: cartoons) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-15
-- À exécuter dans l'éditeur SQL de la base, ou via scripts/catalog/apply-migration.js

BEGIN;

-- Utilise le schéma et l’index du catalogue officiel existants.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('catalog:cartoons'));

-- 3. Les personnages
INSERT INTO "image" ("category", "url", "name", "author", "license", "license_url", "source_url", "restrictions")
VALUES
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/d11c6b456a3e-01-djok-v2.jpg', 'D’Jok', NULL, NULL, NULL, 'https://editthis.info/akillian/D%27Jok', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/ba4224caa75a-02-micro-ice.jpg', 'Micro-Ice', NULL, NULL, NULL, 'https://m.imdb.com/title/tt1507675/characters/nm1489469/?ref_=tt_cst_c_11', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/81eb6725f715-03-marsupilami.jpg', 'Marsupilami', NULL, NULL, NULL, 'https://www.pinterest.com/pin/741827369845734274/', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/ec95213bc141-04-sammy.jpg', 'Sammy', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Shaggy_Rogers', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/2558444233fa-05-gumball.jpg', 'Gumball', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Gumball_Watterson', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/bb66eb2930a9-06-darwin.jpg', 'Darwin', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Darwin_Watterson', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/110e8d4dc42e-07-ben.jpg', 'Ben 10', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Ben_Tennyson', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/cf589277c30a-08-ladybug.jpg', 'Ladybug', NULL, NULL, NULL, 'https://news.nate.com/view/20210402n04108', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/08524a434b8e-09-chat-noir.jpg', 'Chat Noir', NULL, NULL, NULL, 'https://news.nate.com/view/20210402n04108', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/b40b033934c7-10-sam.jpg', 'Sam', NULL, NULL, NULL, 'https://thetvdb.com/series/totally-spies', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/20034abe97e4-11-clover.jpg', 'Clover', NULL, NULL, NULL, 'https://thetvdb.com/series/totally-spies', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/b2c3f6493e16-12-alex.jpg', 'Alex', NULL, NULL, NULL, 'https://thetvdb.com/series/totally-spies', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/70b2408cf68a-13-tag.jpg', 'Tag', NULL, NULL, NULL, 'https://www.jetpunk.com/user-quizzes/162811/footballeurs-de-fiction-par-images', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/685f61342ee3-14-corneil.jpg', 'Corneil', NULL, NULL, NULL, 'https://www.primevideo.com/-/es/detail/Corneil-Bernie/0ILQVCM85KZH4HCZ9Q4LHBMJEF', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/db4620657212-15-bernie.jpg', 'Bernie', NULL, NULL, NULL, 'https://www.primevideo.com/-/es/detail/Corneil-Bernie/0ILQVCM85KZH4HCZ9Q4LHBMJEF', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/e13580731078-16-dora.jpg', 'Dora', NULL, NULL, NULL, 'https://nickjrcharacters.blogspot.com/2013/09/dora-explorer-volume-1.html', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/8b63403641aa-17-aang.jpg', 'Aang', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Aang', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/62d86a824a70-18-katara.jpg', 'Katara', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Katara_(Avatar:_The_Last_Airbender)', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/2dc3429bb97d-19-finn.jpg', 'Finn', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Finn_the_Human', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/e0970e235d7d-20-jake-v2.jpg', 'Jake', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Jake_the_Dog', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/a0d054bcca9d-21-boom.jpg', 'Boom', NULL, NULL, NULL, 'https://www.senscritique.com/serie/linus_et_boom/439279', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/bb1a40b52534-22-titeuf.jpg', 'Titeuf', NULL, NULL, NULL, 'https://serieously.ouest-france.fr/quiz-cest-juste-mission-impossible-de-relier-ces-10-personnages-a-leur-dessin-anime/', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/e45ff8718834-23-oggy.jpg', 'Oggy', NULL, NULL, NULL, 'https://www.businesstoday.in/in-the-news/photo/top-10-kids-programmes-in-india-5340-2016-09-14', 'Illustration générée par IA ; personnage de fiction.'),
  ('cartoons', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/cartoons/v1/f63fe5c5e7c8-24-garfield.jpg', 'Garfield', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Garfield_(character)', 'Illustration générée par IA ; personnage de fiction.')
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
  IF (SELECT COUNT(*) FROM image WHERE category = 'cartoons' AND user_id IS NULL) <> 24 THEN
    RAISE EXCEPTION 'La catégorie cartoons doit contenir exactement 24 personnages officiels';
  END IF;
END;
$$;

COMMIT;

-- Vérification
SELECT category, COUNT(*) AS images, COUNT(license) AS avec_licence
FROM "image" WHERE user_id IS NULL GROUP BY category ORDER BY category;

-- ROLLBACK : masquer sans supprimer les images des parties existantes.
-- INSERT INTO category_setting (slug, visible) VALUES ('cartoons', false)
-- ON CONFLICT (slug) DO UPDATE SET visible = false;
