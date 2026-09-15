// Executed against an explicitly supplied DB. Fixtures live in one rolled-back transaction.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),Module=require('module');
const root=path.resolve(__dirname,'..'),ts=require('typescript'),postgres=require('postgres');
let allowed=false,connection,reads=0;
const loaded=new Map();
function load(file) {
 const full=path.join(root,'src',file+'.ts');if(loaded.has(full))return loaded.get(full).exports;
 const m=new Module(full,module);loaded.set(full,m);m.filename=full;m.paths=module.paths;
 m.require=(id)=>{
  if(id==='server-only')return {};
  if(id==='@/lib/auth/session')return {requireAdmin:async()=>{if(!allowed)throw Error('UNAUTHORIZED');}};
  if(id==='@/lib/db')return {db:()=>{reads++;return connection;}};
  if(id.startsWith('@/'))return load(id.slice(2));
  if(id.startsWith('.'))return load(path.relative(path.join(root,'src'),path.resolve(path.dirname(full),id)).replace(/\.ts$/,''));
  return require(id);
 };
 m._compile(ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,full);
 return m.exports;
}
(async()=>{
 const {readLoupeFilters,movementLabel}=load('lib/loupes'),{csv}=load('lib/csv');
 const f=readLoupeFilters({days:'all'});
 assert.equal(readLoupeFilters({before:'9223372036854775808'}).before,null);
 assert.equal(readLoupeFilters({before:'9007199254740993'}).before,'9007199254740993');
 assert.equal(readLoupeFilters({user:'1 OR 1=1',sort:'SQL',view:'bad'}).user,null);
 assert.equal(readLoupeFilters({page:'Infinity'}).page,10000);
 assert.equal(movementLabel('purchase:backdrop-gold'),'Fond doré');
 assert(csv([['=HYPERLINK("bad")','@formula',-80]]).includes('"\'=HYPERLINK'));
 const secure=load('lib/queries/loupes');
 for(const name of ['getLoupeTotals','listLoupeWallets','listLoupeLedger','listLoupeRewards'])await assert.rejects(secure[name](f),/UNAUTHORIZED/);
 assert.equal(reads,0);
 const route=load('app/(dashboard)/loupes/export/route');await assert.rejects(route.GET(new Request('https://admin.test/loupes/export')),/UNAUTHORIZED/);assert.equal(reads,0);
 console.log('PASS query/export authorization, bigint cursors, input validation and CSV formula escaping');
 if(!process.env.LOUPE_ADMIN_TEST_DATABASE_URL)throw Error('LOUPE_ADMIN_TEST_DATABASE_URL required; no implicit production fallback');
 const sql=postgres(process.env.LOUPE_ADMIN_TEST_DATABASE_URL,{max:1,ssl:process.env.LOUPE_ADMIN_TEST_SSL==='true'?{rejectUnauthorized:false}:false,connect_timeout:10,transform:postgres.camel});
 try {
  await assert.rejects(sql.begin(async tx=>{
   const schema='loupe_admin_test_'+require('crypto').randomBytes(10).toString('hex');
   await tx.unsafe(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
    CREATE TABLE "user"(id integer PRIMARY KEY,username text);
    CREATE TABLE atelier_account(user_id integer PRIMARY KEY,balance integer);
    CREATE TABLE atelier_ledger(id bigint PRIMARY KEY,user_id integer,source text,amount integer,balance_after integer,created_at timestamptz DEFAULT now());
    CREATE TABLE loupe_reward(id bigint PRIMARY KEY,user_id integer,match_id uuid,payload jsonb,created_at timestamptz DEFAULT now(),acknowledged_at timestamptz);
    INSERT INTO "user" VALUES(1,'Alice'),(2,'Bob'),(3,'Zero'),(4,'=Formula');
    INSERT INTO atelier_account VALUES(1,46),(2,0),(4,7);
    INSERT INTO atelier_ledger(id,user_id,source,amount,balance_after) VALUES
      (1,1,'loupe-launch-v1',-50,0),(2,1,'duel:11111111-1111-4111-8111-111111111111',26,26),
      (3,1,'level:2',20,46),(4,2,'match:legacy',80,80),(5,2,'purchase:backdrop-gold',-80,0);
    INSERT INTO atelier_ledger VALUES(6,4,'old',7,7,now()-interval '90 days');
    INSERT INTO loupe_reward(id,user_id,match_id,payload) VALUES
      (1,1,'11111111-1111-4111-8111-111111111111','{"amount":46,"duelAmount":26,"xp":8,"breakdown":{"base":12,"speed":8,"precision":6,"factor":1},"levelUps":[{"level":2,"amount":20}]}'),
      (2,2,'22222222-2222-4222-8222-222222222222','{"amount":0,"duelAmount":0,"breakdown":{"reason":"too-short"}}');`);
   const migrationPath=process.env.LOUPE_ADMIN_MIGRATION_FILE || path.join(root,'../migrations/admin_loupes_v1.sql');
   const migration=fs.readFileSync(migrationPath,'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
   await tx.unsafe(migration);await tx.unsafe(migration);
   const indices=await tx`SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname LIKE 'admin_loupe_%'`;
   assert.equal(indices.length,3);
   connection=tx;allowed=true;
   assert.deepEqual(await secure.getLoupeTotals(f),{balance:53,holders:2,players:4,earned:133,spent:80,operations:6,adjustments:-50});
   const period=await secure.getLoupeTotals({...f,days:7});assert.equal(period.earned,126);assert.equal(period.balance,53);
   const wallets=await secure.listLoupeWallets(f);assert.equal(wallets.length,4);assert.equal(wallets[0].username,'Alice');assert.equal(wallets.find(r=>r.id===3).balance,0);
   assert.equal((await secure.listLoupeWallets({...f,sort:'spent'}))[0].id,2);
   assert.equal((await secure.listLoupeWallets({...f,q:'#2'})).length,1);
   assert.equal((await secure.listLoupeWallets({...f,q:'%'})).length,0);
   const purchases=await secure.listLoupeLedger({...f,kind:'purchase'});assert.equal(purchases.length,1);assert.equal(purchases[0].amount,-80);
   const alice=await secure.listLoupeLedger({...f,user:1});assert.equal(alice.length,3);assert.equal(alice[1].payload.duelAmount,26);
   assert.equal((await secure.listLoupeRewards({...f,user:2}))[0].payload.amount,0);
   assert.equal((await secure.listLoupeLedger({...f,kind:'other'})).length,1);
   const response=await route.GET(new Request('https://admin.test/loupes/export?view=journal&user=2&days=all'));
   assert.equal(response.headers.get('cache-control'),'private, no-store');assert((await response.text()).includes('Fond doré'));
   await tx.unsafe(`INSERT INTO atelier_ledger(id,user_id,source,amount,balance_after) SELECT 9007199254740993+n,1,'test:'||n,1,46+n FROM generate_series(0,109) n`);
   const first=await secure.listLoupeLedger(f);assert.equal(first.length,51);assert.equal(typeof first[0].id,'string');
   const cursor=first[49].id;
   await tx.unsafe(`INSERT INTO atelier_ledger(id,user_id,source,amount,balance_after) VALUES(9007199254741999,1,'new',1,157)`);
   const second=await secure.listLoupeLedger({...f,before:cursor});assert.equal(second.length,51);
   assert(!first.slice(0,50).some(a=>second.some(b=>a.id===b.id)));assert(second.every(r=>BigInt(r.id)<BigInt(cursor)));
   console.log('PASS PostgreSQL totals, zero wallets, periods, sorting, player/type filters, zero rewards, breakdown join, CSV and stable pagination during new writes');
   throw Error('ROLLBACK_FIXTURES');
  }),/ROLLBACK_FIXTURES/);
 } finally { await sql.end(); }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
