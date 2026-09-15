-- Catégorie « Personnages d’anime » (slug: anime) — 24 personnages
-- Généré depuis le manifeste le 2026-09-14, puis limité au catalogue anime.
-- À exécuter dans l'éditeur SQL de la base, ou via scripts/catalog/apply-migration.js

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('catalog:anime'));

-- Utilise les colonnes et l'index UQ_image_catalog_name déjà présents.
-- Les références identifient les personnages, les URL sont les créations 3D.
INSERT INTO "image" ("category", "url", "name", "author", "license", "license_url", "source_url", "restrictions")
VALUES
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/d076a3f1af99-01-goku.jpg', 'Goku', NULL, NULL, NULL, 'https://en.bandainamcoent.eu/dragon-ball/dragon-ball-sparking-zero/fighters', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/0b14eb8e5d95-02-vegeta-v2.jpg', 'Vegeta', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Vegeta', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/847829b3ecb4-03-bulma.jpg', 'Bulma', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Bulma', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/fde6111b164e-04-piccolo.jpg', 'Piccolo', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Piccolo_(Dragon_Ball)', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/cab277490360-05-naruto.jpg', 'Naruto', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Naruto_Uzumaki', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/77cc402a1751-06-sasuke.jpg', 'Sasuke', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Sasuke_Uchiha', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/4b18766412f3-07-sakura.jpg', 'Sakura', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Sakura_Haruno', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/ecf63d717b37-08-kakashi.jpg', 'Kakashi', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Kakashi_Hatake', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/b82719463506-09-luffy.jpg', 'Luffy', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Monkey_D._Luffy', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/709ca9c2752a-10-zoro.jpg', 'Zoro', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Roronoa_Zoro', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/b282b7082864-11-nami.jpg', 'Nami', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Nami_(One_Piece)', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/cdaf7fd59a35-12-chopper.jpg', 'Chopper', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Tony_Tony_Chopper', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/7e46ad219571-13-tanjiro.jpg', 'Tanjiro', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Tanjiro_Kamado', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/ea174194cdc5-14-nezuko.jpg', 'Nezuko', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Nezuko_Kamado', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/bc082eee3627-15-zenitsu.jpg', 'Zenitsu', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Zenitsu_Agatsuma', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/bacf80083909-16-inosuke.jpg', 'Inosuke', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Zenitsu_Agatsuma', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/7f8ed4654630-17-light.jpg', 'Light', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Light_Yagami', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/8e6016a9a2bd-18-l.jpg', 'L', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/L_(Death_Note)', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/4dd8ad94f108-19-eren.jpg', 'Eren', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Eren_Yeager', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/cd5d9b833f25-20-mikasa.jpg', 'Mikasa', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Mikasa_Ackerman', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/2e795744b871-21-livai.jpg', 'Livaï', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Levi_Ackerman', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/5ba30b56efbd-22-deku.jpg', 'Deku', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Izuku_Midoriya', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/7c478877fd44-23-bakugo.jpg', 'Bakugo', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Katsuki_Bakugo', 'Illustration générée par IA ; personnage de fiction.'),
  ('anime', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/anime/v1/f33301032b37-24-ichigo.jpg', 'Ichigo', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Ichigo_Kurosaki', 'Illustration générée par IA ; personnage de fiction.')
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
  IF (SELECT COUNT(*) FROM image WHERE category = 'anime' AND user_id IS NULL) <> 24 THEN
    RAISE EXCEPTION 'Le catalogue anime doit contenir exactement 24 personnages';
  END IF;
END $$;

COMMIT;

-- Vérification
SELECT category, COUNT(*) AS images, COUNT(license) AS avec_licence
FROM "image" WHERE user_id IS NULL GROUP BY category ORDER BY category;

-- Retour arrière sans casser les parties déjà créées :
-- INSERT INTO category_setting (slug, visible) VALUES ('anime', false)
-- ON CONFLICT (slug) DO UPDATE SET visible = false;
