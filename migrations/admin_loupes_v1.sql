-- Read-only tracking performance; no wallet, XP or inventory changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE INDEX IF NOT EXISTS admin_loupe_ledger_user_id ON atelier_ledger(user_id,id DESC);
CREATE INDEX IF NOT EXISTS admin_loupe_ledger_created ON atelier_ledger(created_at);
CREATE INDEX IF NOT EXISTS admin_loupe_reward_user_id ON loupe_reward(user_id,id DESC);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mk_admin') THEN
  GRANT SELECT ON atelier_ledger,loupe_reward TO mk_admin;
 END IF;
END $$;
COMMIT;
