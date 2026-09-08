import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { AtelierService } from './atelier.service';
import { AtelierGameService } from './atelier-game.service';
import { PortraitService } from './portrait.service';
import { ITEMS, Recipe, recipe, visibleKey } from './catalog';

// Opt-in only. Never use DATABASE_URL or the application's database as a fallback.
const enabled = process.env.ATELIER_RUN_DATABASE_TESTS === 'true';
(enabled ? describe : describe.skip)(
  'atelier real PostgreSQL concurrency (isolated test database)',
  () => {
    let db: DataSource;
    let service: AtelierService;
    const schema = 'atelier_test_' + randomBytes(8).toString('hex');
    const all: Recipe[] = [];
    const seen = new Set<string>();
    for (const hair of ITEMS.hair)
      for (const glasses of ITEMS.glasses)
        for (const hat of ITEMS.hat)
          for (const beard of ITEMS.beard)
            for (const outfit of ITEMS.outfit) {
              const r = recipe({
                catalogVersion: 1,
                hair,
                glasses,
                hat,
                beard,
                outfit,
                backdrop: 'backdrop-ice',
              });
              if (!seen.has(visibleKey(r))) {
                seen.add(visibleKey(r));
                all.push(r);
              }
            }
    beforeAll(async () => {
      const url = process.env.ATELIER_TEST_DATABASE_URL;
      if (!url || !new URL(url).pathname.endsWith('_atelier_test'))
        throw new Error(
          'A dedicated database ending in _atelier_test is required',
        );
      db = new DataSource({
        type: 'postgres',
        url,
        extra: { options: '-c search_path=' + schema },
        synchronize: false,
      });
      await db.initialize();
      await db.query('CREATE SCHEMA "' + schema + '"');
      await db.query(`
   CREATE TABLE "user"(id serial PRIMARY KEY,score integer NOT NULL DEFAULT 0);
   CREATE TABLE deck(id serial PRIMARY KEY,user_id integer REFERENCES "user"(id),name varchar(50),created_at timestamptz DEFAULT now());
   CREATE TABLE image(id serial PRIMARY KEY,user_id integer REFERENCES "user"(id),deck_id integer REFERENCES deck(id),url text,name text,category text);
   CREATE TABLE room(id serial PRIMARY KEY,name text UNIQUE,status text,hostplayerid integer,guestplayerid integer,hostcharacterid integer,guestcharacterid integer);
   CREATE TABLE room_image(fk_room integer,fk_image integer);
   INSERT INTO "user"(id) VALUES(7),(9);
  `);
      await db.query(
        readFileSync(
          join(__dirname, '../../migrations/atelier_v1.sql'),
          'utf8',
        ),
      );
      service = new AtelierService(
        db,
        new ConfigService({
          ATELIER_ENABLED: 'true',
          ATELIER_ECONOMY_ENABLED: 'true',
          ATELIER_PUBLIC_URL: 'https://api.example.test',
          ATELIER_MIN_MATCH_SECONDS: '0',
        }),
        new PortraitService(),
      );
      await service.onModuleInit();
    }, 30000);
    afterAll(async () => {
      if (db?.isInitialized) {
        // Only this run's random schema in the explicitly named TEST database.
        try {
          await db.query('DROP SCHEMA "' + schema + '" CASCADE');
        } finally {
          await db.destroy();
        }
      }
    });
    beforeEach(async () => {
      await db.query(
        'TRUNCATE room_image,room,image,deck,atelier_guess,atelier_match_result,atelier_operation,atelier_ledger,atelier_character,atelier_inventory,atelier_account RESTART IDENTITY CASCADE',
      );
      await db.query('UPDATE "user" SET score=0');
    });
    it('charges once for parallel identical purchase requests and different purchase keys', async () => {
      await service.account(7);
      await db.query('UPDATE atelier_account SET balance=100 WHERE user_id=7');
      const input = {
        operationId: 'purchase',
        itemId: 'backdrop-gold',
        expectedPrice: 50,
      };
      await Promise.all([
        service.purchase(7, input),
        service.purchase(7, input),
      ]);
      await service.purchase(7, { ...input, operationId: 'second-key' });
      expect(await service.account(7)).toMatchObject({
        balance: 50,
        owned: ['backdrop-gold'],
      });
      expect(
        Number(
          (await db.query('SELECT count(*) AS n FROM atelier_ledger'))[0].n,
        ),
      ).toBe(1);
    });
    it('allows exactly one concurrent update at the same character revision', async () => {
      const input = {
        operationId: 'create',
        id: 'alex',
        name: 'Alex',
        expectedRevision: 0,
        recipe: all[0],
      };
      await service.save(7, input);
      const results = await Promise.allSettled([
        service.save(7, {
          ...input,
          operationId: 'update-a',
          expectedRevision: 1,
          name: 'Alex A',
        }),
        service.save(7, {
          ...input,
          operationId: 'update-b',
          expectedRevision: 1,
          name: 'Alex B',
        }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await service.list(7)).characters[0].revision).toBe(2);
    });
    it('publishes once and rolls back an entire over-capacity concurrent addition', async () => {
      const refs = [];
      for (let i = 0; i < 22; i++) {
        const c = await service.save(7, {
          operationId: 'save-' + i,
          id: 'c' + i,
          name: 'Suspect ' + i,
          expectedRevision: 0,
          recipe: all[i],
        });
        refs.push({ id: c.id, revision: c.revision });
      }
      const input = { operationId: 'deck', characters: refs.slice(0, 18) };
      const [a, b] = await Promise.all([
        service.publish(7, input),
        service.publish(7, input),
      ]);
      expect(a.deck.id).toBe(b.deck.id);
      const results = await Promise.allSettled([
        service.publish(7, {
          operationId: 'add-a',
          deckId: a.deck.id,
          characters: refs.slice(18, 20),
        }),
        service.publish(7, {
          operationId: 'add-b',
          deckId: a.deck.id,
          characters: refs.slice(20, 22),
        }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        Number(
          (
            await db.query('SELECT count(*) AS n FROM image WHERE deck_id=$1', [
              a.deck.id,
            ])
          )[0].n,
        ),
      ).toBe(20);
      expect(
        Number((await db.query('SELECT count(*) AS n FROM deck'))[0].n),
      ).toBe(1);
    }, 30000);
    it('settles one winner and one reward pair for simultaneous winning guesses', async () => {
      await db.query(
        "INSERT INTO room(name,status,hostplayerid,guestplayerid,hostcharacterid,guestcharacterid,match_started_at) VALUES('R','closed',7,9,11,12,now())",
      );
      await db.query(
        'INSERT INTO room_image SELECT id,11 FROM room UNION ALL SELECT id,12 FROM room',
      );
      const game = new AtelierGameService(db, service);
      const results = await Promise.allSettled([
        game.guess('R', 7, 'host', 12),
        game.guess('R', 9, 'guest', 11),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        Number((await db.query('SELECT sum(score) AS n FROM "user"'))[0].n),
      ).toBe(8);
      expect(
        Number(
          (await db.query('SELECT sum(balance) AS n FROM atelier_account'))[0]
            .n,
        ),
      ).toBe(13);
      expect(
        Number(
          (await db.query('SELECT count(*) AS n FROM atelier_match_result'))[0]
            .n,
        ),
      ).toBe(1);
    });
  },
);
