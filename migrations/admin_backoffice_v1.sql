-- Back office (dossier admin/).
-- À appliquer AVANT de déployer l'API qui lit category_setting : sans cette table,
-- GET /api/images/categories et la création de room échouent.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Visibilité des catégories du catalogue. Une catégorie sans ligne est visible :
-- celles ajoutées par add_category_<slug>.sql apparaissent donc sans étape de plus.
CREATE TABLE IF NOT EXISTS category_setting (
  slug varchar(50) PRIMARY KEY,
  visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Date d'inscription. Les comptes existants restent à NULL : aucune date inventée.
-- Colonne nullable sans défaut à l'ajout, donc sans réécriture de la table.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE "user" ALTER COLUMN created_at SET DEFAULT now();

-- Victoires / défaites par joueur, affichées dans le back office.
CREATE INDEX IF NOT EXISTS atelier_match_result_winner ON atelier_match_result(winner_id);
CREATE INDEX IF NOT EXISTS atelier_match_result_loser ON atelier_match_result(loser_id);

COMMIT;

-- ROLLBACK (si besoin) :
-- BEGIN;
-- DROP INDEX IF EXISTS atelier_match_result_winner;
-- DROP INDEX IF EXISTS atelier_match_result_loser;
-- ALTER TABLE "user" DROP COLUMN IF EXISTS created_at;
-- DROP TABLE IF EXISTS category_setting;
-- COMMIT;
