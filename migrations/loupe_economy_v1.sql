BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(719206,1);
CREATE TABLE IF NOT EXISTS game_economy_config (
 id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL, enabled boolean NOT NULL DEFAULT false,
 launched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS loupe_reward (
 id bigserial PRIMARY KEY,
 user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 match_id uuid NOT NULL REFERENCES atelier_match_result(match_id) ON DELETE CASCADE,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_at timestamptz,
 UNIQUE(user_id,match_id)
);
CREATE INDEX IF NOT EXISTS loupe_reward_pending ON loupe_reward(user_id,id) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS loupe_opponent_daily ON atelier_match_result(LEAST(winner_id,loser_id),GREATEST(winner_id,loser_id),finished_at);
-- Once only: everyone starts at zero. Preserve the ledger and existing ownership.
-- Newly sold equipment remains owned by players who already used it for free.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM game_economy_config WHERE id=1) THEN
  LOCK TABLE atelier_account IN EXCLUSIVE MODE;
  INSERT INTO atelier_account(user_id) SELECT id FROM "user" ON CONFLICT DO NOTHING;
  INSERT INTO atelier_ledger(user_id,source,amount,balance_after)
    SELECT user_id,'loupe-launch-v1',-balance,0 FROM atelier_account WHERE balance>0 ON CONFLICT DO NOTHING;
  UPDATE atelier_account SET balance=0,version=version+1 WHERE balance<>0;
  INSERT INTO atelier_inventory(user_id,item_id)
    SELECT c.user_id,item.value FROM atelier_character c CROSS JOIN LATERAL jsonb_each_text(c.recipe) item
    WHERE NOT c.deleted AND item.value IN ('hat-beret','glasses-rectangular','neckwear-bowtie') ON CONFLICT DO NOTHING;
  INSERT INTO game_economy_config(id,version,enabled) VALUES(1,1,true);
 END IF;
END $$;
COMMIT;
