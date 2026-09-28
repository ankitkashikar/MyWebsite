// Offline, ephemeral PostgreSQL only. Never reads a connection URL or credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '../.migration-rehearsal/node_modules/@electric-sql/pglite/dist/index.js';
const files=['20260920000100_coupon_validation.sql','20260920000200_atomic_orders.sql','20260923000100_delivery_settings.sql','20260923000200_coupon_admin.sql','20260924000100_audit_grants.sql','20260925000100_admin_customers.sql'];
const db=new PGlite(); let checks=0;
const test=async(name,fn)=>{await fn();console.log('PASS '+name);checks++;};
const rows=async(t)=>(await db.query(`select to_jsonb(t) r from public.${t} t order by id`)).rows.map(x=>x.r);
const tables=['customers','normal_orders','bulk_orders','normal_order_items','bulk_order_items','order_status_events'];
const baseline=readFileSync(new URL('./fixtures/website-schema-20260920.sql',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
try {
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(baseline);
 await db.exec('set search_path=public; set row_security=on; set check_function_bodies=on;');
 console.log('BASELINE SHA256 '+hash(baseline));
 await db.exec("insert into products(id,name,price,order_type) values ('legacy-dish','Legacy dish',199,'normal'); insert into customers(phone,name) values ('9234567801','Synthetic legacy customer');");
 for(const type of ['normal','bulk']) {
  await db.exec(`insert into ${type}_orders(customer_id,name,phone,address,${type==='normal'?'delivery_slot':'delivery_datetime'},subtotal,total,payment_method,payment_status,idempotency_key)
   select id,name,phone,'Synthetic address',${type==='normal'?"'Legacy slot'":"'2020-01-01T12:00:00+05:30'"},199,199,'cod','${type==='normal'?'pending':'paid'}',gen_random_uuid() from customers;
   insert into ${type}_order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
   select id,'legacy-dish','Legacy dish',199,1,199 from ${type}_orders;
   insert into order_status_events(order_type,order_id,order_number,previous_status,new_status,changed_by)
   select '${type}',id,order_number,'new','new','offline-test' from ${type}_orders;`);
 }
 const before=Object.fromEntries(await Promise.all(tables.map(async t=>[t,await rows(t)])));
 let coupon, replay;
 for(const [i,file] of files.entries()) {
  const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
  console.log('MIGRATION '+file+' SHA256 '+hash(sql));
  const schemaState=async()=> (await db.query("select pg_class.relname,pg_attribute.attname from pg_class join pg_namespace on pg_namespace.oid=relnamespace join pg_attribute on attrelid=pg_class.oid where nspname='public' and attnum>0 order by 1,2")).rows;
  const prior=await schemaState();
  await test(file+': injected failure rolls back DDL',async()=>{
   assert.match(sql,/commit;\s*$/i);
   await assert.rejects(()=>db.exec(sql.replace(/commit;\s*$/i,"select 1/0; commit;")),e=>e.code==='22012');
   await db.exec('rollback;'); assert.deepEqual(await schemaState(),prior);
  });
  await test(file+': applies successfully',()=>db.exec(sql));
  await test(file+': preserves every legacy field, item and audit event',async()=>{
   for(const t of tables){
    const after=await rows(t);assert.equal(after.length,before[t].length);
    for(let n=0;n<after.length;n++) for(const [k,v] of Object.entries(before[t][n])) assert.deepEqual(after[n][k],v,`${t}.${k}`);
   }
  });
  if(i===0){
   await db.exec("insert into coupons(code,active,kind,value,product_ids,usage_limit,starts_at) values ('LEGACY',true,'flat',100,array['legacy-dish'],10,'2020-01-01');");
   coupon=(await db.query("select to_jsonb(c) r from coupons c where code='LEGACY'")).rows[0].r;
  }
  if(i===1){
   await db.exec(`insert into order_requests(idempotency_key,request,response) values ('11111111-1111-4111-8111-111111111111','{"type":"normal"}','{"order_number":"SYNTHETIC-REPLAY","total":199}');`);
   replay=(await db.query('select to_jsonb(r) r from order_requests r')).rows;
  }
 }
 await test('existing coupon restrictions retained; admin version initialized',async()=>{
  const c=(await db.query("select to_jsonb(c) r from coupons c where code='LEGACY'")).rows[0].r;
  assert.equal(c.version,1);assert.equal(c.deleted_at,null);
  delete c.version;delete c.deleted_at;assert.deepEqual(c,coupon);
 });
 await test('saved request survives and retry returns original response',async()=>{
  assert.deepEqual((await db.query('select to_jsonb(r) r from order_requests r')).rows,replay);
  const q=(await db.query(`select lookup_order_request('11111111-1111-4111-8111-111111111111','{"type":"normal"}') r`)).rows[0].r;
  assert.deepEqual(q,{order_number:'SYNTHETIC-REPLAY',total:199,duplicate:true});
 });
 await db.exec('set role service_role');
 await test('normal and bulk missing delivery settings fail closed',async()=>{
  for(const type of ['normal','bulk']) await assert.rejects(()=>db.query('select quote_delivery_fee($1,19900)',[type]),e=>e.code==='P0003');
  assert.equal((await db.query('select count(*)::int n from delivery_rules')).rows[0].n,0);
 });
 await db.exec('reset role');
 const signatures=['quote_coupon(text,text,text,jsonb)','lookup_order_request(uuid,jsonb)','create_order_atomic(uuid,jsonb,jsonb,jsonb)','manage_delivery_rule(text,text,integer,bigint,bigint,boolean,uuid)','quote_delivery_fee(text,bigint)','manage_coupon(text,text,integer,jsonb,uuid)'];
 for(const role of ['anon','authenticated']) await test(role+': all new tables and RPCs denied',async()=>{
  for(const f of signatures) assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') ok',[role,'public.'+f])).rows[0].ok,false);
  await db.exec(`set role ${role}`);
  try {for(const t of ['coupons','coupon_product_categories','order_requests','delivery_rules','delivery_rule_events','coupon_admin_events']) await assert.rejects(()=>db.query(`select * from ${t}`),e=>e.code==='42501');}
  finally {await db.exec('reset role');}
 });
 await test('service role can execute RPCs; audit history cannot be updated/deleted',async()=>{
  for(const f of signatures) assert.equal((await db.query('select has_function_privilege(\'service_role\',$1,\'EXECUTE\') ok',['public.'+f])).rows[0].ok,true);
  for(const t of ['delivery_rule_events','coupon_admin_events']) for(const privilege of ['UPDATE','DELETE']) assert.equal((await db.query('select has_table_privilege(\'service_role\',$1,$2) ok',[t,privilege])).rows[0].ok,false);
 });
 await test('service role inserts and reads audit records after privilege correction',async()=>{
  await db.exec('set role service_role');
  try {
   for(const t of ['delivery_rule_events','coupon_admin_events']) {
    const key=t==='delivery_rule_events'?'order_type':'code';
    await db.query(`insert into ${t}(${key},action,actor,after_${key==='code'?'coupon':'rule'}) values ($1,'save','11111111-1111-4111-8111-111111111111','{}')`,[key==='code'?'TEST':'normal']);
    assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n,1);
    await assert.rejects(()=>db.query(`delete from ${t}`),e=>e.code==='42501');
   }
  } finally {await db.exec('reset role');}
 });
 console.log(`\n${checks} migration upgrade checks passed. In-memory PGlite; synthetic data only. No production access, Supabase migration ledger, PostgREST or concurrent-client verification.`);
}finally{await db.close();}
