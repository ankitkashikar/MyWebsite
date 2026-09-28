const bulkQaDate = new Date(Date.now() + 3 * 86400000).toISOString();
// Dated future slot accepted by server scheduling validation.
const normalQaSlot = `6:00 pm – 6:30 pm (${new Date(Date.now() + 330 * 60000 + 86400000).toISOString().slice(0,10)})`;
// Offline only: unmodified public-schema export, synthetic rows, actual SQL/handler.
import assert from 'node:assert/strict';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
let legacy, checks=0;
const {db,handler}=await createOfflineOrderRuntime({
 schemaPath:new URL('./fixtures/website-schema-20260920.sql',import.meta.url),
 async beforeMigrations(db){
  await db.exec(`insert into customers(phone,name) values ('9234567801','Synthetic Legacy');
   insert into normal_orders(customer_id,name,phone,address,delivery_slot,subtotal,total,payment_method,idempotency_key)
   select id,name,phone,'Synthetic legacy address apartment 12','Legacy',199,199,'cod',gen_random_uuid() from customers;
   insert into normal_order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
   select id,'dish','Dish',199,1,199 from normal_orders;`);
  legacy=(await db.query('select to_jsonb(n) as row from normal_orders n')).rows[0].row;
 }
});
const place=handler('place-order');
const test=async(label,fn)=>{await fn();checks++;console.log('PASS '+label);};
const count=async t=>Number((await db.query(`select count(*) n from ${t}`)).rows[0].n);
const req=(type,coupon)=>({type,idempotency_key:crypto.randomUUID(),name:'Schema Test',phone:'9123456780',address:'Synthetic offline address apartment 12',pincode:'411057',delivery_slot:normalQaSlot,delivery_datetime:bulkQaDate,payment_method:'upi',...(coupon?{coupon_code:coupon}:{}),items:[{id:type==='normal'?'dish':'bulk',qty:2}]});
try {
 await test('both migrations apply to the unmodified exported schema',async()=>{
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema='public' and table_name in ('coupons','order_requests','coupon_product_categories')")).rows[0].n,3);
 });
 await test('migration preserves every original legacy field and item',async()=>{
  const after=(await db.query('select to_jsonb(n) as row from normal_orders n where id=$1',[legacy.id])).rows[0].row;
  const {coupon_items,...original}=after;assert.equal(coupon_items,null);assert.deepEqual(original,legacy);
  assert.equal(await count('normal_order_items'),1);
 });
 await db.exec("set role service_role; insert into coupons(code,active,kind,value) values ('TEN',true,'percent',1000); insert into coupons(code,active,kind,value,ends_at) values ('EXPIRED',true,'flat',100,'2000-01-01'); insert into coupons(code,active,kind,value,product_ids) values ('INELIGIBLE',true,'flat',100,array['missing-product'])");
 for(const type of ['normal','bulk']) {
  for(const coupon of [null,'TEN']) {
   const p=req(type,coupon);let first;
   await test(`${type} ${coupon??'no coupon'}: service role creates UUID header/items and real order number`,async()=>{
    first=await place(p);assert.equal(first.status,200,JSON.stringify(first));
    assert.match(first.body.order_number,type==='normal'?/^CBD-\d{4}-\d{6}$/:/^BLK-\d{4}-\d{6}$/);
    const row=(await db.query(`select * from ${type}_orders where idempotency_key=$1`,[p.idempotency_key])).rows[0];
    assert.match(row.id,/^[0-9a-f-]{36}$/);assert.equal(row.payment_status,'pending');assert.equal(row.order_status,'new');
    const expected=type==='normal'?(coupon?359.99:399.98):(coupon?450:500);
    assert.equal(Number(row.total),expected);assert.equal(first.body.total,expected);
    assert.equal((await db.query(`select count(*)::int n from ${type}_order_items where order_id=$1`,[row.id])).rows[0].n,1);
   });
   await test(`${type} ${coupon??'no coupon'}: replay is stable and changed payload conflicts`,async()=>{
    const before=await count(type+'_orders');const repeat=await place(p);
    assert.equal(repeat.body.duplicate,true);assert.equal(repeat.body.order_number,first.body.order_number);
    assert.equal((await place({...p,notes:'Changed'})).status,409);assert.equal(await count(type+'_orders'),before);
   });
  }
  for(const coupon of ['FAKE','EXPIRED','INELIGIBLE']) await test(`${type}: rejects ${coupon} coupon without writes`,async()=>{
   const before=await count(type+'_orders');assert.equal((await place(req(type,coupon))).status,400);assert.equal(await count(type+'_orders'),before);
  });
  await db.exec('reset role');
  await db.query('insert into products(id,name,price,order_type) values ($1,$2,100,$3)',[type+'-zfail','Failure product',type]);
  await db.exec(`create function fail_schema_item() returns trigger language plpgsql as $$ begin if new.product_id like '%-zfail' then raise exception 'injected failure'; end if; return new; end $$;
   create trigger zz_fail_schema_item before insert on ${type}_order_items for each row execute function fail_schema_item(); set role service_role;`);
  for(const phone of ['9123456780','9345678012']) await test(`${type}: item failure rolls back customer/header/items/key for ${phone}`,async()=>{
   const tables=['customers',type+'_orders',type+'_order_items','order_requests'];const before=await Promise.all(tables.map(count));
   const customers=(await db.query('select * from customers order by phone')).rows;
   const p={...req(type),phone,name:'Must roll back',items:[{id:type==='normal'?'dish':'bulk',qty:1},{id:type+'-zfail',qty:1}]};
   assert.notEqual((await place(p)).status,200);assert.deepEqual(await Promise.all(tables.map(count)),before);
   assert.deepEqual((await db.query('select * from customers order by phone')).rows,customers);
  });
  await db.exec(`reset role; drop trigger zz_fail_schema_item on ${type}_order_items; drop function fail_schema_item(); set role service_role;`);
 }
 await test('legacy retry is rejected without changing legacy COD state',async()=>{
  assert.equal((await place({...req('normal'),idempotency_key:legacy.idempotency_key})).status,409);
  const after=(await db.query('select to_jsonb(n) as row from normal_orders n where id=$1',[legacy.id])).rows[0].row;
  const {coupon_items,...original}=after;assert.deepEqual(original,legacy);
 });
 await test('operations payment/status update and event insert work under service role',async()=>{
  for(const type of ['normal','bulk']){
   const row=(await db.query(`update ${type}_orders set payment_status='paid',order_status='accepted' where payment_method='upi' returning id,order_number`)).rows[0];
   await db.query("insert into order_status_events(order_type,order_id,order_number,previous_status,new_status,changed_by) values($1,$2,$3,'new','accepted','offline-test')",[type,row.id,row.order_number]);
  }
  assert.equal(await count('order_status_events'),2);
 });
 await db.exec('reset role');
 for(const role of ['anon','authenticated']) await test(`${role}: denied tables and new RPCs despite exported default grants`,async()=>{
  await db.exec(`set role ${role}`);
  try {
   for(const table of ['customers','products','normal_orders','bulk_orders','normal_order_items','bulk_order_items','coupons','coupon_product_categories','order_requests','order_status_events','security_rate_limits'])
    await assert.rejects(()=>db.query(`select * from ${table}`),e=>e.code==='42501');
   for(const sql of ["select quote_coupon('TEN','normal','9123456780','[]')","select lookup_order_request(gen_random_uuid(),'{}')","select create_order_atomic(gen_random_uuid(),'{}','{}','[]')"])
    await assert.rejects(()=>db.query(sql),e=>e.code==='42501');
  }finally{await db.exec('reset role');}
 });
 console.log(`\n${checks} exported-schema compatibility checks passed. PGlite only; role attributes synthesized, no production data, migration history or HTTP/PostgREST acceptance.`);
}finally{await db.close();}
