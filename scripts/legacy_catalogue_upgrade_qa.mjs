// Synthetic in-memory rehearsal only. No URLs, credentials or production writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../.migration-rehearsal/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalogue=JSON.parse(read('data/menu-options.json'));
const migrate=async name=>db.exec(read('supabase/migrations/'+name+'.sql'));
let checks=0;
const test=async(name,fn)=>{await fn();console.log('PASS '+name);checks++;};
const snapshot=async table=>(await db.query(`select to_jsonb(t) row from public.${table} t order by id`)).rows;
try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(read('scripts/fixtures/website-schema-20260920.sql'));
 await db.exec('set search_path=public;');
 for(const name of ['20260920000100_coupon_validation','20260920000200_atomic_orders','20260923000100_delivery_settings','20260923000200_coupon_admin','20260924000100_audit_grants','20260925000100_admin_customers'])await migrate(name);
 const prices=[150,150,150,150,180,180,180,180,170,170,170,170,190,190,190,190,180,180,180,210,210,210,280,280];
 for(let i=0;i<24;i++)await db.query("insert into products(id,name,price,order_type,active) values($1,'Dish Name',$2,'normal',true)",['N'+String(i+1).padStart(3,'0'),prices[i]]);
 await db.exec(`insert into customers(phone,name) values ('9234567801','Synthetic legacy customer');
 insert into normal_orders(customer_id,name,phone,address,delivery_slot,subtotal,total,payment_method,payment_status,idempotency_key)
 select id,name,phone,'Synthetic address','Legacy slot',150,150,'cod','pending',gen_random_uuid() from customers;
 insert into normal_order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
 select id,'N001','Dish Name',150,1,150 from normal_orders;
 insert into order_status_events(order_type,order_id,order_number,previous_status,new_status,changed_by)
 select 'normal',id,order_number,'new','new','offline-test' from normal_orders;
 insert into order_requests(idempotency_key,request,response) values('11111111-1111-4111-8111-111111111111','{"type":"normal"}','{"order_number":"SYNTHETIC-LEGACY","total":150}');`);
 const tables=['customers','normal_orders','normal_order_items','order_status_events'];
 const before=Object.fromEntries(await Promise.all(tables.map(async t=>[t,await snapshot(t)])));
 const legacy=await snapshot('products');
 const replay=(await db.query('select to_jsonb(r) row from order_requests r')).rows;
 await migrate('20260929000100_menu_cart_validation');
 const sql=read('supabase/migrations/20260929000200_menu_catalogue.sql');
 await test('current legacy catalogue fails the missing-base guard without adding products',async()=>{
  await assert.rejects(db.exec(sql),/Menu base product missing/);await db.exec('rollback');assert.deepEqual(await snapshot('products'),legacy);
 });
 await test('stage 75 distinct bases inactive, using synthetic development prices only',async()=>{
  assert.equal(catalogue.items.length,75);
  await db.exec('begin');
  for(const item of catalogue.items)await db.query("insert into products(id,name,price,order_type,active) values($1,$2,$3,'normal',false)",[item.key,item.title,item.options[0].price]);
  await db.exec('commit');
  assert.equal((await db.query("select count(*)::int n from products where not active")).rows[0].n,75);
 });
 const staged=await snapshot('products');
 await test('injected catalogue failure rolls back products and add-on mappings',async()=>{
  await assert.rejects(db.exec(sql.replace(/commit;\s*$/i,'select 1/0; commit;')),e=>e.code==='22012');await db.exec('rollback');
  assert.deepEqual(await snapshot('products'),staged);
  assert.equal((await db.query('select count(*)::int n from menu_addon_parents')).rows[0].n,0);
 });
 await test('catalogue upgrade applies after prerequisite staging',()=>db.exec(sql));
 await test('all 24 legacy product records remain byte-for-byte equivalent',async()=>{
  const after=(await snapshot('products')).filter(x=>/^N\d{3}$/.test(x.row.id));assert.deepEqual(after,legacy);
 });
 await test('saved N001 order, customer and audit history are unchanged',async()=>{
  for(const table of tables)assert.deepEqual(await snapshot(table),before[table],table);
 });
 await test('saved idempotency response remains intact',async()=>{
  assert.deepEqual((await db.query('select to_jsonb(r) row from order_requests r')).rows,replay);
  const r=(await db.query(`select lookup_order_request('11111111-1111-4111-8111-111111111111','{"type":"normal"}') r`)).rows[0].r;
  assert.equal(r.duplicate,true);assert.equal(r.total,150);
 });
 await test('new products stay inactive and no coupons are created',async()=>{
  assert.equal((await db.query("select count(*)::int n from products where id !~ '^N[0-9]{3}$' and active")).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from coupons')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from menu_addon_parents')).rows[0].n,253);
 });
 console.log(`${checks} legacy catalogue upgrade checks passed. Synthetic PGlite only; no production changes or price approval.`);
}finally{await db.close();}
