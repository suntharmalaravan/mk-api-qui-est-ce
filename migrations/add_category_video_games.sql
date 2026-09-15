-- Catégorie « Jeux vidéo » (slug: video_games) — 24 personnages
-- Généré par scripts/catalog/generate-migration.js le 2026-09-15
-- À exécuter dans l'éditeur SQL de la base, ou via scripts/catalog/apply-migration.js

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('catalog:video_games'));

-- Colonnes et index UQ_image_catalog_name déjà présents.
-- Écriture limitée aux 24 portraits du catalogue officiel video_games.
INSERT INTO "image" ("category", "url", "name", "author", "license", "license_url", "source_url", "restrictions")
VALUES
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/07fbca8f3a4e-01-rayman.jpg', 'Rayman', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Rayman_(character)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/c749239da063-02-ratchet.jpg', 'Ratchet', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Ratchet_(Ratchet_%26_Clank)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/c3a4a9c44845-03-clank.jpg', 'Clank', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Clank_(Ratchet_%26_Clank)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/a193c4fc5081-04-crash.jpg', 'Crash Bandicoot', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Crash_Bandicoot_(character)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/9ffb10680593-05-coco.jpg', 'Coco Bandicoot', NULL, NULL, NULL, 'https://www.hiclipart.com/free-transparent-background-png-clipart-fctri', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/877ee392125d-06-spyro.jpg', 'Spyro', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Spyro_(character)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/a9f4bf176460-07-sonic.jpg', 'Sonic', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_(character)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/236a9d32422b-08-tails.jpg', 'Tails', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Tails_(Sonic_the_Hedgehog)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/96815bfdd9a7-09-knuckles.jpg', 'Knuckles', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Knuckles_the_Echidna', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/ad10be1515fb-10-shadow.jpg', 'Shadow', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Shadow_the_Hedgehog', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/ac450b0956ed-11-amy.jpg', 'Amy Rose', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Amy_Rose', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/7bd339cb5b25-12-eggman.jpg', 'Dr Eggman', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Doctor_Eggman', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/a5b3f25baa8e-13-pac-man-v2.jpg', 'Pac-Man', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Pac-Man_(character)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/1f81987e6151-14-mega-man.jpg', 'Mega Man', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Mega_Man_(character)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/9b20c91c1387-15-ryu.jpg', 'Ryu', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Ryu_(Street_Fighter)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/f42c575a3c47-16-chun-li.jpg', 'Chun-Li', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Chun-Li', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/69109a260718-17-ken.jpg', 'Ken', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Ken_Masters', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/5d4862201f59-18-lara-croft.jpg', 'Lara Croft', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Lara_Croft', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/680d52c828c2-19-kratos.jpg', 'Kratos', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Kratos_(God_of_War)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/80f42d1bf33d-20-aloy.jpg', 'Aloy', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Aloy', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/2c4a4fca4949-21-steve.jpg', 'Steve', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Steve_(Minecraft)', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/48c49673e03e-22-alex.jpg', 'Alex', NULL, NULL, NULL, 'https://in.pinterest.com/pin/mincraft-alex-minecraft-hd-png-download411x795-pngfind--34269647156997727/', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/359497e48b14-23-sackboy.jpg', 'Sackboy', NULL, NULL, NULL, 'https://en.wikipedia.org/wiki/Sackboy', 'Illustration générée par IA ; personnage de fiction.'),
  ('video_games', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/video_games/v1/85865d6a352f-24-sly.jpg', 'Sly Cooper', NULL, NULL, NULL, 'https://www.pngfind.com/mpng/hTRbii_sly-cooper-thieves-in-time-sly-hd-png/', 'Illustration générée par IA ; personnage de fiction.')
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
  IF (SELECT COUNT(*) FROM image WHERE category = 'video_games' AND user_id IS NULL) <> 24 THEN
    RAISE EXCEPTION 'Le catalogue video_games doit contenir exactement 24 personnages';
  END IF;
END $$;

COMMIT;

-- Vérification
SELECT category, COUNT(*) AS images, COUNT(license) AS avec_licence
FROM "image" WHERE user_id IS NULL GROUP BY category ORDER BY category;

-- Retour arrière sans casser les parties déjà créées :
-- INSERT INTO category_setting (slug, visible) VALUES ('video_games', false)
-- ON CONFLICT (slug) DO UPDATE SET visible = false;
