// Explicit opt-in; never runs at application startup. --dry-run verifies then rolls back.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env')});
(async()=>{
 if(!process.env.DATABASE_URL) throw Error('DATABASE_URL required');
 const sql=fs.readFileSync(path.join(__dirname,'../migrations/loupe_economy_v1.sql'),'utf8');
 assert.match(sql,/^BEGIN;/);assert.match(sql,/COMMIT;\s*$/);
 const body=sql.replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,'');
 const client=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?undefined:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:65000});
 let transaction=false;
 try {
  await client.connect();await client.query('BEGIN');transaction=true;
  // Stabilize registration and inventory while auditing the one-time initialization.
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; LOCK TABLE \"user\" IN SHARE MODE; LOCK TABLE atelier_inventory IN SHARE ROW EXCLUSIVE MODE");
  const fingerprint=async()=> (await client.query(`SELECT count(*)::int AS n,md5(COALESCE(string_agg(row(id,username,password,score,image_url)::text,E'\\n' ORDER BY id),'')) AS digest FROM "user"`)).rows[0];
  const usersBefore=await fingerprint();
  const ownedBefore=(await client.query('SELECT user_id,item_id FROM atelier_inventory ORDER BY user_id,item_id')).rows;
  const already=(await client.query("SELECT to_regclass('game_economy_config') AS table_name")).rows[0].table_name;
  const launched=already && (await client.query('SELECT 1 FROM game_economy_config WHERE id=1')).rowCount>0;
  await client.query(body);
  assert.deepEqual(await fingerprint(),usersBefore,'Account identity and XP must be preserved');
  const wallets=(await client.query('SELECT count(*)::int AS n,count(*) FILTER(WHERE balance=0)::int AS zero FROM atelier_account')).rows[0];
  assert.equal(wallets.n,usersBefore.n);if(!launched) assert.equal(wallets.zero,wallets.n);
  const ownedAfter=new Set((await client.query('SELECT user_id,item_id FROM atelier_inventory')).rows.map(r=>r.user_id+':'+r.item_id));
  assert(ownedBefore.every(r=>ownedAfter.has(r.user_id+':'+r.item_id)));
  const beforeReplay=(await client.query('SELECT user_id,balance,version FROM atelier_account ORDER BY user_id')).rows;
  await client.query(body);
  assert.deepEqual((await client.query('SELECT user_id,balance,version FROM atelier_account ORDER BY user_id')).rows,beforeReplay,'Reapplying must preserve all balances and versions');
  const dry=process.argv.includes('--dry-run');await client.query(dry?'ROLLBACK':'COMMIT');transaction=false;
  console.log(JSON.stringify({migration:'loupe_economy_v1',applied:!dry,rolledBack:dry,alreadyLaunched:!!launched,accounts:wallets.n,zeroBalances:wallets.zero,existingOwnershipPreserved:true,identityAndXpPreserved:true,idempotenceVerified:true}));
 } finally {if(transaction) await client.query('ROLLBACK').catch(()=>{});await client.end();}
})().catch(e=>{console.error('Migration failed:',e.message);process.exitCode=1;});
