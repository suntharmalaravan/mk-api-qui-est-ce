-- Daily leaderboard. Rankings are derived from authoritative match results:
-- no new table, only the index that keeps "one day of matches" a range scan
-- instead of a full scan of every match ever played.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE INDEX IF NOT EXISTS atelier_match_result_finished_at
  ON atelier_match_result(finished_at);

COMMIT;
