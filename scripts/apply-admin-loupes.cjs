const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env')});
(async()=>{
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
 const body=fs.readFileSync(path.join(__dirname,'../migrations/admin_loupes_v1.sql'),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 const c=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?undefined:{rejectUnauthorized:false},connectionTimeoutMillis:10000,query_timeout:65000});
 const fingerprint=async()=>(await c.query(`SELECT count(*)::int AS n,md5(coalesce(string_agg(row(user_id,balance,version)::text,',' ORDER BY user_id),'')) AS digest FROM atelier_account`)).rows[0];
 try {
  await c.connect();
  for(const apply of process.argv.includes('--dry-run')?[false]:[false,true]) {
   await c.query("BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; LOCK TABLE atelier_account IN SHARE MODE");
   try {
    const before=await fingerprint();await c.query(body);const after=await fingerprint();assert.deepEqual(after,before);
    const indices=(await c.query(`SELECT c.relname,i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.oid=ANY(ARRAY[to_regclass('admin_loupe_ledger_user_id'),to_regclass('admin_loupe_ledger_created'),to_regclass('admin_loupe_reward_user_id')])`)).rows;
    assert.equal(indices.length,3);assert(indices.every(i=>i.indisvalid));
    await c.query(apply?'COMMIT':'ROLLBACK');console.log(JSON.stringify({applied:apply,accountsPreserved:before.n,validIndexes:indices.length}));
   } catch(e) {await c.query('ROLLBACK');throw e;}
  }
 }finally{await c.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
