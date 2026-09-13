-- Player progression is derived from authoritative match results.
-- Only durable badge unlocks need their own table.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE player_badge (
  user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  badge_id varchar(80) NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX player_badge_unlocked_at
  ON player_badge(user_id, unlocked_at DESC);

COMMIT;
