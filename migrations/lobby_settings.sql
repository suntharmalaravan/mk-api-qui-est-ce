-- Apply before deploying the lobby-settings backend. Existing games remain locked.
ALTER TABLE room ADD COLUMN IF NOT EXISTS lobby_revision integer NOT NULL DEFAULT 0;
ALTER TABLE room ADD COLUMN IF NOT EXISTS selection_started_at timestamptz;
UPDATE room SET selection_started_at = now() WHERE selection_started_at IS NULL AND (hostcharacterid IS NOT NULL OR guestcharacterid IS NOT NULL OR EXISTS (SELECT 1 FROM room_image WHERE fk_room=room.id));
