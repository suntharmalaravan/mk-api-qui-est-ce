-- Preconditions required by the atomic WebSocket room lifecycle.
BEGIN;

ALTER TABLE room ALTER COLUMN guestplayerid DROP NOT NULL;
ALTER TABLE room ALTER COLUMN hostcharacterid DROP NOT NULL;
ALTER TABLE room ALTER COLUMN guestcharacterid DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'room'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'room'::regclass
            AND attname = 'name'
        )
      ]::smallint[]
  ) THEN
    ALTER TABLE room ADD CONSTRAINT uq_room_name UNIQUE (name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_room_status ON room(status);

COMMIT;
