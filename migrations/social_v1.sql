-- Additive and repeatable. Never rename an existing account implicitly.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(719204);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS public_identifier text;
-- Preserve display names and exact legacy logins; disambiguate public handles only.
WITH candidates AS (
  SELECT id,lower(btrim(username)) AS base,
    row_number() OVER(PARTITION BY lower(btrim(username)) ORDER BY id) AS position
  FROM "user"
)
UPDATE "user" u SET public_identifier=CASE WHEN c.position=1 THEN c.base
  ELSE left(c.base,9)||'_'||u.id::text END FROM candidates c WHERE u.id=c.id AND u.public_identifier IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_public_identifier_unique ON "user" (lower(public_identifier));
-- Compatibility while the previous API version is still serving registrations.
CREATE OR REPLACE FUNCTION set_user_public_identifier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_identifier IS NULL THEN NEW.public_identifier := lower(btrim(NEW.username)); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS user_public_identifier_default ON "user";
CREATE TRIGGER user_public_identifier_default BEFORE INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION set_user_public_identifier();
ALTER TABLE "user" ALTER COLUMN public_identifier SET NOT NULL;
ALTER TABLE "user" ALTER COLUMN username SET NOT NULL;
ALTER TABLE "user" ALTER COLUMN password DROP NOT NULL;
-- Future providers attach to an immutable user ID, never to a display name/email.
CREATE TABLE IF NOT EXISTS auth_identity (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','apple')),
  subject text NOT NULL CHECK (length(subject)>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,subject), UNIQUE(user_id,provider)
);
CREATE TABLE IF NOT EXISTS friendship (
  user_low integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  user_high integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  requester_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_low,user_high),
  CHECK(user_low < user_high), CHECK(requester_id IN (user_low,user_high))
);
CREATE INDEX IF NOT EXISTS friendship_high ON friendship(user_high,status);
CREATE TABLE IF NOT EXISTS duel_invitation (
  id uuid PRIMARY KEY,
  sender_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  recipient_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  room_id integer NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '5 minutes'),
  CHECK(sender_id<>recipient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS duel_invitation_pending ON duel_invitation(room_id,recipient_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS duel_invitation_recipient ON duel_invitation(recipient_id,expires_at DESC);
CREATE INDEX IF NOT EXISTS duel_invitation_sender ON duel_invitation(sender_id,created_at DESC);
COMMIT;
