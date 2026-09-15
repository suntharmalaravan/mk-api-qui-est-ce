// Real PostgreSQL, random isolated schema; search_path never includes public.
const path = require('path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname,'../tsconfig.json') });
const { DataSource } = require('typeorm');
const { ConfigService } = require('@nestjs/config');
const { AtelierService } = require('../src/atelier/atelier.service');
const { AtelierGameService } = require('../src/atelier/atelier-game.service');
const { PortraitService } = require('../src/atelier/portrait.service');
const fs = require('fs');
const assert = require('assert/strict');
const schema = 'loupe_test_' + require('crypto').randomBytes(12).toString('hex');
(async () => {
 if (!process.env.LOUPE_TEST_DATABASE_URL) throw Error('LOUPE_TEST_DATABASE_URL required');
 const db = new DataSource({ type:'postgres', url:process.env.LOUPE_TEST_DATABASE_URL,ssl: process.env.LOUPE_TEST_SSL === 'true' ? { rejectUnauthorized:false } : undefined,extra:{ options:'-c search_path='+schema,max:8,connectionTimeoutMillis:10000 },synchronize:false });
 let created=false;
 try {
  await db.initialize(); await db.query(`CREATE SCHEMA "${schema}"`); created=true;
  await db.query(`CREATE TABLE "user"(id serial PRIMARY KEY,score integer NOT NULL DEFAULT 0);
   CREATE TABLE level(id serial PRIMARY KEY,score integer,title text);
   CREATE TABLE deck(id serial PRIMARY KEY,user_id integer,name varchar(50),created_at timestamptz DEFAULT now());
   CREATE TABLE image(id serial PRIMARY KEY,user_id integer,deck_id integer,url text,name text,category text);
   CREATE TABLE room(id serial PRIMARY KEY,name text UNIQUE,status text,hostplayerid integer,guestplayerid integer,hostcharacterid integer,guestcharacterid integer);
   CREATE TABLE room_image(fk_room integer,fk_image integer);
   INSERT INTO "user"(id) SELECT generate_series(1,12);
   INSERT INTO level(id,score,title) VALUES(1,0,'Début'),(2,8,'Premier pas'),(3,40,'Affûté');`);
  const sql = name => fs.readFileSync(path.join(__dirname,'../migrations/'+name),'utf8');
  await db.query(sql('atelier_v1.sql'));
  await db.query('INSERT INTO atelier_account(user_id,balance) VALUES(1,50)');
  await db.query(`INSERT INTO atelier_portrait VALUES('portrait',decode('00','hex')); INSERT INTO atelier_character(user_id,id,revision,name,recipe,portrait_hash,visible_key) VALUES(1,'saved',1,'Alex','{"hat":"hat-beret"}','portrait','key')`);
  await db.query(sql('loupe_economy_v1.sql'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM atelier_account WHERE balance=0'))[0].n,12);
  assert.equal((await db.query('SELECT item_id FROM atelier_inventory WHERE user_id=1'))[0].item_id,'hat-beret');
  assert.equal((await db.query("SELECT amount FROM atelier_ledger WHERE source='loupe-launch-v1'"))[0].amount,-50);
  const service = new AtelierService(db,new ConfigService({ ATELIER_ENABLED:'true',ATELIER_PUBLIC_URL:'https://api.example.test' }),new PortraitService());
  await service.onModuleInit(); assert.equal(service.loupeEconomyEnabled,true);
  const game = new AtelierGameService(db,service);
  async function room(name,a,b,seconds=40) {
   const [r] = await db.query(`INSERT INTO room(name,status,hostplayerid,guestplayerid,hostcharacterid,guestcharacterid,match_started_at) VALUES($1,'closed',$2,$3,11,12,now()-$4*interval '1 second') RETURNING id`,[name,a,b,seconds]);
   await db.query('INSERT INTO room_image VALUES($1,11),($1,12),($1,13)',[r.id]);
  }
  await room('race',1,2);
  const race = await Promise.allSettled([game.guess('race',1,'host',12),game.guess('race',2,'guest',11)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(race.map(r=>r.status==='rejected'?r.reason.message:r.status)));
  const [{winner_id:winner,loser_id:loser}] = await db.query('SELECT * FROM atelier_match_result');
  const wallet = await service.economy(winner);
  assert.equal(wallet.balance,46); assert.equal(wallet.rewards.length,1); assert.equal(wallet.rewards[0].payload.levelUps[0].amount,20);
  assert.equal((await service.account(loser)).balance,3);
  const retry = await game.guess('race',winner,winner===1?'host':'guest',winner===1?12:11); assert.equal(retry.duplicate,true);
  assert.equal((await service.account(winner)).balance,46);
  await service.acknowledgeReward(loser,wallet.rewards[0].id); assert.equal((await service.economy(winner)).rewards.length,1);
  await service.acknowledgeReward(winner,wallet.rewards[0].id); await service.acknowledgeReward(winner,wallet.rewards[0].id); assert.equal((await service.economy(winner)).rewards.length,0);
  await db.query(sql('loupe_economy_v1.sql')); assert.equal((await service.account(winner)).balance,46);
  console.log('PASS zero launch, ownership preservation, migration replay, concurrent terminal guesses, reward replay, level credit and owner-only acknowledgement');
  await room('fast',3,4,1); await game.guess('fast',3,'host',12); assert.equal((await service.account(3)).balance,0); assert.equal((await db.query('SELECT score FROM "user" WHERE id=3'))[0].score,0);
  for(let i=0;i<6;i++){await room('repeat'+i,3,4);await game.guess('repeat'+i,3,'host',12);}
  assert.equal((await service.account(3)).balance,84); // 2 full wins + 2 reduced + first level; instant match counts toward pair limit.
  await db.query('UPDATE "user" SET score=100 WHERE id=5');
  for(let i=6;i<=11;i++){await room('cap'+i,5,i);await game.guess('cap'+i,5,'host',12);}
  assert.equal((await service.account(5)).balance,120);
  console.log('PASS instant games, repeated opponents and daily cap across different opponents');
  const purchase = { operationId:'buy-gold',itemId:'backdrop-gold',expectedPrice:80 };
  await Promise.all([service.purchase(5,purchase),service.purchase(5,purchase)]);
  await service.purchase(5,{...purchase,operationId:'another-key'});
  assert.equal((await service.account(5)).balance,40);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM atelier_ledger WHERE user_id=5 AND source='purchase:backdrop-gold'"))[0].n,1);
  await assert.rejects(service.purchase(5,{ operationId:'overdraft',itemId:'glasses-rectangular',expectedPrice:140 }));
  await assert.rejects(service.purchase(5,{ operationId:'price',itemId:'hat-beret',expectedPrice:0 }));
  await assert.rejects(service.purchase(5,{ operationId:'prototype',itemId:'toString',expectedPrice:0 }));
  assert.equal((await service.account(5)).balance,40);
  await db.query(`CREATE FUNCTION fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_ROLLBACK'; END $$; CREATE TRIGGER fail_receipt BEFORE INSERT ON loupe_reward FOR EACH ROW EXECUTE FUNCTION fail_receipt()`);
  await room('rollback',11,12); await assert.rejects(game.guess('rollback',11,'host',12));
  assert.equal((await db.query("SELECT status FROM room WHERE name='rollback'"))[0].status,'closed');
  assert.equal((await service.account(11)).balance,3); // Previously lost to player 5.
  assert.equal((await db.query('SELECT score FROM "user" WHERE id=11'))[0].score,0);
  console.log('PASS purchases: concurrent retry, different keys, overdraft, forged price/item; complete rollback when reward persistence fails');
 } finally { if(created) await db.query(`DROP SCHEMA "${schema}" CASCADE`); if(db.isInitialized) await db.destroy(); }
})().catch(e=>{ console.error(e.stack);process.exitCode=1; });
