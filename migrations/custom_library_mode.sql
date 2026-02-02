-- Migration for Deck System
-- Run this SQL in your database SQL Editor
-- Uses BEGIN/COMMIT for transaction safety

BEGIN;

-- 1. Create deck table
CREATE TABLE IF NOT EXISTS deck (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_deck_user_id ON deck(user_id);

-- 2. Add user_id column to image table (if not exists)
ALTER TABLE image ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE image ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_image_user_id ON image(user_id);

-- 3. Add deck_id column to image table
ALTER TABLE image ADD COLUMN IF NOT EXISTS deck_id INTEGER REFERENCES deck(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_image_deck_id ON image(deck_id);

-- 4. Add mode, custom_library_user_id and deck_id to room table
ALTER TABLE room ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'category';
ALTER TABLE room ADD COLUMN IF NOT EXISTS custom_library_user_id INTEGER;
ALTER TABLE room ADD COLUMN IF NOT EXISTS deck_id INTEGER REFERENCES deck(id) ON DELETE SET NULL;

COMMIT;

-- Verify
SELECT 'deck' as table_name, column_name, data_type 
FROM information_schema.columns WHERE table_name = 'deck'
UNION ALL
SELECT 'image' as table_name, column_name, data_type 
FROM information_schema.columns WHERE table_name = 'image' AND column_name IN ('user_id', 'deck_id', 'created_at')
UNION ALL
SELECT 'room' as table_name, column_name, data_type 
FROM information_schema.columns WHERE table_name = 'room' AND column_name IN ('mode', 'custom_library_user_id');

-- ROLLBACK (if needed):
-- BEGIN;
-- DROP TABLE IF EXISTS deck CASCADE;
-- ALTER TABLE image DROP COLUMN IF EXISTS deck_id;
-- ALTER TABLE image DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE image DROP COLUMN IF EXISTS created_at;
-- ALTER TABLE room DROP COLUMN IF EXISTS mode;
-- ALTER TABLE room DROP COLUMN IF EXISTS custom_library_user_id;
-- COMMIT;
