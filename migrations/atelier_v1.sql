-- Apply explicitly in staging first. Never run automatically at application boot.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE atelier_account (
 user_id integer PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 balance integer NOT NULL DEFAULT 0 CHECK (balance BETWEEN 0 AND 1000000000),
 version integer NOT NULL DEFAULT 0
);
CREATE TABLE atelier_portrait (
 hash varchar(64) PRIMARY KEY,
 jpeg bytea NOT NULL CHECK (octet_length(jpeg) <= 524288)
);
CREATE TABLE atelier_character (
 user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 id varchar(100) NOT NULL,
 revision integer NOT NULL CHECK (revision > 0),
 name varchar(32) NOT NULL,
 recipe jsonb NOT NULL,
 portrait_hash varchar(64) NOT NULL REFERENCES atelier_portrait(hash),
 visible_key text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted boolean NOT NULL DEFAULT false,
 PRIMARY KEY (user_id, id)
);
CREATE TABLE atelier_inventory (
 user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 item_id varchar(80) NOT NULL,
 acquired_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, item_id)
);
CREATE TABLE atelier_operation (
 user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 id varchar(150) NOT NULL,
 request_hash varchar(64) NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, id)
);
CREATE TABLE atelier_ledger (
 id bigserial PRIMARY KEY,
 user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 source varchar(180) NOT NULL,
 amount integer NOT NULL,
 balance_after integer NOT NULL CHECK (balance_after >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, source)
);
CREATE INDEX atelier_operation_rate ON atelier_operation(user_id, created_at);
CREATE INDEX atelier_ledger_daily ON atelier_ledger(user_id, created_at) WHERE amount > 0;
ALTER TABLE image ADD COLUMN atelier_visible_key text;
CREATE UNIQUE INDEX image_atelier_unique ON image(deck_id, atelier_visible_key) WHERE atelier_visible_key IS NOT NULL;
-- Database enforcement also covers the existing photo upload routes.
CREATE FUNCTION guard_deck_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deck_id IS NOT NULL THEN
  PERFORM id FROM deck WHERE id = NEW.deck_id FOR UPDATE;
  IF (SELECT count(*) FROM image WHERE deck_id = NEW.deck_id AND id <> COALESCE(NEW.id, -1)) >= 21 THEN
   RAISE EXCEPTION 'DECK_FULL' USING ERRCODE = '23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER image_deck_capacity BEFORE INSERT OR UPDATE OF deck_id ON image FOR EACH ROW EXECUTE FUNCTION guard_deck_capacity();
-- Server-side guess receipts, immutable match identity independent of room names.
ALTER TABLE room ADD COLUMN match_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE room ADD COLUMN host_misses integer NOT NULL DEFAULT 0;
ALTER TABLE room ADD COLUMN guest_misses integer NOT NULL DEFAULT 0;
ALTER TABLE room ADD COLUMN match_started_at timestamptz;
CREATE TABLE atelier_match_result (
 match_id uuid PRIMARY KEY,
 winner_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 loser_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 reason varchar(30) NOT NULL,
 finished_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE atelier_guess (
 match_id uuid NOT NULL,
 player_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 character_id integer NOT NULL,
 right_answer boolean NOT NULL,
 response jsonb NOT NULL,
 PRIMARY KEY(match_id, player_id, character_id)
);
COMMIT;
