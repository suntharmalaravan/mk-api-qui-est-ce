-- Création des tables pour l'application "Qui est-ce ?"

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS "user" (
    "id" SERIAL PRIMARY KEY,
    "username" VARCHAR(255) NOT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(255) NOT NULL DEFAULT 'debutant'
);

-- Table des images
CREATE TABLE IF NOT EXISTS "image" (
    "id" SERIAL PRIMARY KEY,
    "category" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "name" VARCHAR(255) NOT NULL
);

-- Table des salles
CREATE TABLE IF NOT EXISTS "room" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "status" VARCHAR(50) DEFAULT 'closed',
    "hostPlayerId" INTEGER NOT NULL,
    "guestPlayerId" INTEGER,
    "hostCharacterId" INTEGER,
    "guestCharacterId" INTEGER
);

-- Table de liaison entre salles et images
CREATE TABLE IF NOT EXISTS "room_image" (
    "id" SERIAL PRIMARY KEY,
    "fk_room" INTEGER NOT NULL,
    "fk_image" INTEGER NOT NULL,
    FOREIGN KEY ("fk_room") REFERENCES "room"("id") ON DELETE CASCADE,
    FOREIGN KEY ("fk_image") REFERENCES "image"("id") ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS "IDX_user_username" ON "user"("username");
CREATE INDEX IF NOT EXISTS "IDX_room_name" ON "room"("name");
CREATE INDEX IF NOT EXISTS "IDX_image_category" ON "image"("category");
CREATE INDEX IF NOT EXISTS "IDX_room_image_room" ON "room_image"("fk_room");
CREATE INDEX IF NOT EXISTS "IDX_room_image_image" ON "room_image"("fk_image");
