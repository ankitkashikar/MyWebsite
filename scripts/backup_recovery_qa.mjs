// Disposable databases, synthetic rows. No connection URL or production credentials.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const mode=process.argv[2];
assert.ok(['--pglite','--docker'].includes(mode),'Use --pglite or --docker');
const root=new URL('../',import.meta.url);
const files=['20260920000100_coupon_validation.sql','20260920000200_atomic_orders.sql','20260923000100_delivery_settings.sql','20260923000200_coupon_admin.sql','20260924000100_audit_grants.sql','20260925000100_admin_customers.sql'];
const {fileURLToPath}=await import('node:url');
const dir=resolve(fileURLToPath(new URL('../.recovery-qa/',import.meta.url)),randomUUID());
mkdirSync(dir,{recursive:true});
let db,pg,container,started=false,current='source',serial=0,checks=0;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024}).trim();
const run=async sql=>mode==='--pglite'?db.exec(sql):execFileSync('docker',['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d',current],{input:sql,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
const scalar=async sql=>{
 if(mode==='--pglite')return (await db.query(sql)).rows[0].v;
 return JSON.parse(execFileSync('docker',['exec','-i',container,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d',current],{input:sql,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024}).trim());
};
const test=async(label,fn)=>{await fn();checks++;console.log('PASS '+label);};
const tables=['customers','products','normal_orders','bulk_orders','normal_order_items','bulk_order_items','order_status_events','security_rate_limits'];
const rowState=async()=>scalar(`select jsonb_build_object(${tables.flatMap(t=>["'"+t+"'",`(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from public.${t} t)`]).join(',')}) v;`);
const state=async()=>scalar(`select jsonb_build_object(
 'rows',(${`select jsonb_build_object(${tables.flatMap(t=>["'"+t+"'",`(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from public.${t} t)`]).join(',')})`}),
 'ledger',(select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m),
 'columns',(select jsonb_agg(to_jsonb(c)-'table_catalog'-'udt_catalog'-'domain_catalog'-'collation_catalog' order by table_name,ordinal_position) from information_schema.columns c where table_schema='public'),
 'grants',(select jsonb_agg(to_jsonb(g)-'table_catalog' order by to_jsonb(g)::text) from information_schema.role_table_grants g where table_schema='public'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'body',pg_get_functiondef(p.oid),'acl',p.proacl) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text,c.conname) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
 'rls',(select jsonb_agg(jsonb_build_object('name',c.relname,'enabled',c.relrowsecurity,'forced',c.relforcerowsecurity) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text),'[]') from pg_policies p where schemaname='public'),
 'sequences',(select jsonb_agg(to_jsonb(s) order by sequencename) from pg_sequences s where schemaname='public')
 ) v;`);
// Physical recovery may advance sequence WAL reservations; never allow regression.
const compareState=(actual,expected)=>{
 const a=structuredClone(actual),b=structuredClone(expected);
 for(let i=0;i<b.sequences.length;i++){
  if(b.sequences[i].last_value!==null)assert.ok(a.sequences[i].last_value>=b.sequences[i].last_value,'Sequence must not regress');
  delete a.sequences[i].last_value;delete b.sequences[i].last_value;
 }
 assert.deepEqual(a,b);
};
const ledgerSql=file=>`insert into supabase_migrations.schema_migrations(version,name) values ('${file.split('_')[0]}','${file.slice(15,-4)}');`;
const migrate=async(file,fail=false)=>{
 const sql=readFileSync(new URL('supabase/migrations/'+file,root),'utf8');
 assert.match(sql,/commit;\s*$/i);
 return run(sql.replace(/commit;\s*$/i,ledgerSql(file)+(fail?'select 1/0;':'')+'commit;'));
};
const backup=async label=>{
 const path=resolve(dir,label+(mode==='--pglite'?'.tar.gz':'.dump'));
 if(mode==='--pglite')writeFileSync(path,Buffer.from(await (await db.dumpDataDir()).arrayBuffer()));
 else {docker('exec',container,'pg_dump','-U','postgres','-d',current,'-Fc','-f','/tmp/'+label+'.dump');docker('cp',container+':/tmp/'+label+'.dump',path);}
 assert.ok(statSync(path).size>100);
 console.log('BACKUP '+label+' SHA256 '+createHash('sha256').update(readFileSync(path)).digest('hex'));
 return path;
};
const restore=async path=>{
 if(mode==='--pglite') {await db.close();db=new pg.PGlite({loadDataDir:new Blob([readFileSync(path)])});await db.waitReady;}
 else {current='restored_'+(++serial);docker('exec',container,'createdb','-U','postgres',current);docker('cp',path,container+':/tmp/restore.dump');docker('exec',container,'pg_restore','-U','postgres','-d',current,'--exit-on-error','--single-transaction','/tmp/restore.dump');}
 await run('set search_path=public; set row_security=on;');
};
try {
 if(mode==='--pglite'){pg=await import('../.migration-rehearsal/node_modules/@electric-sql/pglite/dist/index.js');db=new pg.PGlite();}
 else {
  docker('version','--format','{{.Server.Version}}');
  container='tcb-recovery-'+randomUUID();
  docker('run','--detach','--rm','--network','none','--name',container,'--env','POSTGRES_PASSWORD=synthetic-local-only','--env','POSTGRES_DB=source','postgres:17');started=true;
  // The image's initialization server accepts Unix sockets before POSTGRES_DB
  // exists, then stops. Only the final server accepts TCP. Require a real query
  // against the target DB over container loopback before starting the rehearsal.
  const readyDeadline=Date.now()+90000;
  for(;;){
   try {
    const ready=execFileSync('docker',['exec','--env','PGPASSWORD=synthetic-local-only',
     '--env','PGCONNECT_TIMEOUT=2',container,'psql','-X','-q','-t','-A',
     '-h','127.0.0.1','-U','postgres','-d','source','-v','ON_ERROR_STOP=1',
     '-c','select 1'],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']}).trim();
    assert.equal(ready,'1');break;
   }catch(e){
    if(Date.now()>=readyDeadline)throw new Error('Disposable PostgreSQL source database was not ready within 90 seconds.',{cause:e});
    await delay(500);
   }
  }
  console.log('Ready: final PostgreSQL server accepts queries on source.');
 }
 await run('create role anon; create role authenticated; create role service_role bypassrls;');
 await run(readFileSync(new URL('scripts/fixtures/website-schema-20260920.sql',root),'utf8'));
 await run(`set search_path=public; set row_security=on; set check_function_bodies=on;
 create schema supabase_migrations;
 create table supabase_migrations.schema_migrations(version text primary key,name text not null);
 insert into supabase_migrations.schema_migrations values ('20260917085405','order_operations'),('20260917085433','security_hardening');
 insert into products(id,name,price,order_type) values ('legacy','Synthetic dish',199,'normal');
 insert into customers(phone,name) values ('9234567801','Synthetic recovery customer');`);
 for(const type of ['normal','bulk'])await run(`insert into ${type}_orders(customer_id,name,phone,address,${type==='normal'?'delivery_slot':'delivery_datetime'},subtotal,total,payment_method,payment_status,idempotency_key)
 select id,name,phone,'Synthetic address',${type==='normal'?"'Legacy slot'":"'2020-01-01T12:00:00+05:30'"},199,199,'cod','${type==='normal'?'pending':'paid'}',gen_random_uuid() from customers;
 insert into ${type}_order_items(order_id,product_id,product_name,unit_price,quantity,line_total) select id,'legacy','Synthetic dish',199,1,199 from ${type}_orders;
 insert into order_status_events(order_type,order_id,order_number,new_status,changed_by) select '${type}',id,order_number,'new','synthetic' from ${type}_orders;`);
 const baseline=await state(),legacy=await rowState();let initial,partial,final;
 await test('baseline backup written to disk',async()=>{initial=await backup('baseline');});
 await test('baseline restore into a fresh database matches rows, schema, grants, sequences and ledger',async()=>{await restore(initial);compareState(await state(),baseline);});
 for(const file of files.slice(0,2))await migrate(file);
 await run(`insert into coupons(code,active,kind,value,usage_limit) values ('RECOVER',true,'flat',100,5);
 insert into order_requests(idempotency_key,request,response) values ('11111111-1111-4111-8111-111111111111','{"type":"normal"}','{"order_number":"SYNTHETIC","total":199}');`);
 const extra=()=>scalar(`select jsonb_build_object('coupons',(select jsonb_agg(to_jsonb(c) order by code) from coupons c),'requests',(select jsonb_agg(to_jsonb(r) order by idempotency_key) from order_requests r)) v;`);
 const partialState=await state(),partialExtra=await extra();
 await test('partial-upgrade backup restores committed migrations, coupons and retry responses',async()=>{partial=await backup('partial');await restore(partial);compareState(await state(),partialState);assert.deepEqual(await extra(),partialExtra);});
 await test('failed delivery migration rolls back schema and its ledger entry',async()=>{
  await assert.rejects(()=>migrate(files[2],true));
  if(mode==='--pglite')await run('rollback;');
  compareState(await state(),partialState);assert.deepEqual(await extra(),partialExtra);
 });
 await test('resume applies only the remaining migrations',async()=>{for(const f of files.slice(2))await migrate(f);assert.equal(await scalar('select to_jsonb(count(*)) v from supabase_migrations.schema_migrations'),2+files.length);});
 await test('original customer, order, item and audit values survive the upgrade',async()=>{
  const after=await rowState();
  for(const table of tables){assert.equal(after[table].length,legacy[table].length);for(let i=0;i<legacy[table].length;i++)for(const [k,v] of Object.entries(legacy[table][i]))assert.deepEqual(after[table][i][k],v,table+'.'+k);}
 });
 const completed=await state(),extraComplete=await extra();
 await test('completed upgrade backup restores to a fresh database',async()=>{final=await backup('upgraded');await restore(final);compareState(await state(),completed);assert.deepEqual(await extra(),extraComplete);});
 await test('saved order retry still returns the same response',async()=>{assert.deepEqual(await scalar(`select lookup_order_request('11111111-1111-4111-8111-111111111111','{"type":"normal"}') v`),{order_number:'SYNTHETIC',total:199,duplicate:true});});
 await test('missing normal/bulk delivery settings remain blocked after restore',async()=>{for(const t of ['normal','bulk'])await assert.rejects(()=>run(`select quote_delivery_fee('${t}',19900);`),e=>String(e.message).includes('Delivery is not configured'));});
 await test('restored audit permissions prohibit service-role updates and deletes',async()=>{
  for(const t of ['coupon_admin_events','delivery_rule_events'])for(const p of ['UPDATE','DELETE'])assert.equal(await scalar(`select to_jsonb(has_table_privilege('service_role','${t}','${p}')) v`),false);
 });
 await test('restored coupon validation rejects combined codes',async()=>{for(const type of ['normal','bulk'])await assert.rejects(()=>run(`select quote_coupon('RECOVER,SECOND','${type}','9234567801','[{"id":"legacy","qty":1}]');`),e=>String(e.message).includes('Coupon is not available'));});
 await test('original backup can recover pre-upgrade state after completed changes',async()=>{await restore(initial);compareState(await state(),baseline);assert.equal(await scalar("select to_jsonb(to_regclass('public.coupons') is null) v"),true);});
 const report=`${checks} ${mode.slice(2)} backup/restore and upgrade-recovery checks passed. Synthetic website data only. Production untouched.\n`;
 writeFileSync(resolve(dir,'result.txt'),report);console.log('\n'+report+'Artifacts: '+dir);
}finally{
 if(db)await db.close();
 if(started)docker('rm','--force',container);
}
