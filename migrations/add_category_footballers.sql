-- Catégorie « Footballeurs » (slug: footballers) — 24 personnages
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
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/01-mbappe.jpg', 'Mbappé', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Kylian_Mbappe_-_France_v_Norway_-_26_June_2026_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/02-messi.jpg', 'Messi', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Leo_Messi_Argentina_v_Egypt_7_July_2026-1.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/03-cristiano-ronaldo.jpg', 'Cristiano Ronaldo', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_Croatia_v_Portugal_2_July_2026-075_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/04-zidane.jpg', 'Zidane', 'Hadi Abyar', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:Zinedine_Zidane_by_Tasnim_03.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/05-ronaldinho.jpg', 'Ronaldinho', 'Marcos Corrêa/PR', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 'https://commons.wikimedia.org/wiki/File:Ronaldinho_in_2019.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/06-valderrama.jpg', 'Valderrama', 'Biser Todorov', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:Carlos_Valderrama_2016.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/07-davids.jpg', 'Davids', 'Paul Blank', 'CC BY 2.5', 'https://creativecommons.org/licenses/by/2.5', 'https://commons.wikimedia.org/wiki/File:Edgar_Davids.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/08-fellaini.jpg', 'Fellaini', 'Кирилл Венедиктов', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Fellaini_2018_2_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/09-ibrahimovic.jpg', 'Ibrahimović', 'Meghdad Madadi', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:Zlatan_Ibrahimovi%C4%87_June_2018.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/10-modric.jpg', 'Modrić', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Luka_Modric_Croatia_v_Portugal_2_July_2026-055.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/11-salah.jpg', 'Salah', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Mohamed_Salah_Argentina_v_Egypt_7_July_2026-163_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/12-haaland.jpg', 'Haaland', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Erling_Haaland_France_v_Norway_26_June_26-008.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/13-pogba.jpg', 'Pogba', 'Антон Зайцев', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Paul_Pogba_in_2018.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/14-marcelo.jpg', 'Marcelo', 'Hadi Abyar', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', 'https://commons.wikimedia.org/wiki/File:Marcelo_by_Tasnim.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/15-maradona.jpg', 'Maradona', 'Auteur inconnu', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Argentina_celebrando_copa_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/16-pele.jpg', 'Pelé', 'Auteur inconnu', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Pele_con_brasil_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/17-renard.jpg', 'Wendie Renard', 'Steffen Prößdorf', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:2019-05-17_Fu%C3%9Fball%2C_Frauen%2C_UEFA_Women''s_Champions_League%2C_Olympique_Lyonnais_-_FC_Barcelona_StP_0635_LR10_by_Stepro.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/18-rapinoe.jpg', 'Megan Rapinoe', 'US Embassy New Zealand', 'Public domain', NULL, 'https://commons.wikimedia.org/wiki/File:Megan_Rapinoe_on_20_July_2023_-_53058900298_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/19-hegerberg.jpg', 'Ada Hegerberg', 'Steffen Prößdorf', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Ada_Hegerberg_2019.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/20-marta.jpg', 'Marta', 'Hameltion', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:NC_Courage_vs_Orlando_Pride_(Jun_2024)_073_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/21-putellas.jpg', 'Alexia Putellas', 'Pedro J Pacheco', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Premios_Goya_2026_-_Alexia_Putellas_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/22-kerr.jpg', 'Sam Kerr', 'Katie Chan', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:Chelsea_FC_Women_v_Everton_FC_Women%2C_12_September_2021_(10)_(cropped).jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/23-buffon.jpg', 'Buffon', 'Илья Хохлов', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0', 'https://commons.wikimedia.org/wiki/File:Gianluigi_Buffon_Euro_2012_final_02.jpg'),
  ('footballers', 'https://storage.googleapis.com/quiestceapi-prod.firebasestorage.app/catalog/footballers/24-kante.jpg', 'Kanté', 'Bryan Berlin', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 'https://commons.wikimedia.org/wiki/File:N''Golo_Kante_France_v_Senegal_16_June_2026-267.jpg')
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
--   (SELECT id FROM "image" WHERE category = 'footballers' AND user_id IS NULL);
-- UPDATE "room" SET guestcharacterid = NULL WHERE guestcharacterid IN
--   (SELECT id FROM "image" WHERE category = 'footballers' AND user_id IS NULL);
-- DELETE FROM "image" WHERE category = 'footballers' AND user_id IS NULL;
-- COMMIT;
