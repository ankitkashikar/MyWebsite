const bulkQaDate = new Date(Date.now() + 3 * 86400000).toISOString();
// Dated future slot accepted by server scheduling validation.
const normalQaSlot = `6:00 pm – 6:30 pm (${new Date(Date.now() + 330 * 60000 + 86400000).toISOString().slice(0,10)})`;
// Actual atomic SQL + handler; PGlite serializes DB statements. Promise.all
// exercises overlapping handler requests, NOT independent PostgreSQL sessions.
import assert from 'node:assert/strict';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
const {db,handler}=await createOfflineOrderRuntime();
const place=handler('place-order');let checks=0;
async function test(label,fn){await fn();checks++;console.log('PASS '+label);}
const request=(type='normal')=>({type,idempotency_key:crypto.randomUUID(),name:'Test Customer',phone:'9123456780',address:'Offline test building, apartment 12',pincode:'411057',delivery_slot:normalQaSlot,delivery_datetime:bulkQaDate,payment_method:'upi',items:[{id:type==='normal'?'dish':'bulk',qty:2}]});
const count=async table=>Number((await db.query(`select count(*) n from ${table}`)).rows[0].n);
try{
 await db.exec("insert into products values ('bulk-other','Second bulk',100,true,'bulk'); insert into coupons(code,active,kind,value) values ('TEN',true,'percent',1000);");
 for(const type of ['normal','bulk']){
  const payload=request(type), table=type+'_orders', lines=type+'_order_items';
  let first;
  await test(`${type}: create header/items/retry record together`,async()=>{
   const before=await count(table);first=await place(payload);assert.equal(first.status,200);
   assert.equal(await count(table),before+1);
   assert.ok((await db.query('select response from order_requests where idempotency_key=$1',[payload.idempotency_key])).rows[0].response.success);
  });
  await test(`${type}: identical retry returns original without writes`,async()=>{
   const before=[await count(table),await count(lines),await count('order_requests')];const retry=await place(payload);
   assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.total,first.body.total);
   assert.deepEqual([await count(table),await count(lines),await count('order_requests')],before);
  });
  for(const patch of [{name:'Changed Name'},{phone:'9234567801'},{address:'Different building, apartment 99, Test Road'},{notes:'Changed instructions'},{coupon_code:'TEN'},{items:[{id:type==='normal'?'dish':'bulk',qty:3}]},type==='normal'?{delivery_slot:'Tomorrow 9 PM'}:{delivery_datetime:'2026-09-22T18:00'}]){
   await test(`${type}: changed ${Object.keys(patch)[0]} conflicts without data leakage`,async()=>{
    const before=await count(table);const response=await place({...payload,...patch});
    assert.equal(response.status,409);assert.equal(response.body.success,false);
    assert.equal(response.body.order_number,undefined);assert.equal(response.body.total,undefined);
    assert.equal(await count(table),before);
   });
  }
  await test(`${type}: duplicated lines and ignored prices remain equivalent retry`,async()=>{
   const response=await place({...payload,items:[{id:payload.items[0].id,qty:1,price:0},{id:payload.items[0].id,qty:1,price:1}],total:0,payment_status:'paid'});
   assert.equal(response.status,200);assert.equal(response.body.duplicate,true);
  });
  await test(`${type}: retry survives subsequent unavailable catalogue`,async()=>{
   await db.query('update products set active=false where id=$1',[payload.items[0].id]);
   const response=await place(payload);assert.equal(response.status,200);assert.equal(response.body.duplicate,true);
   await db.query('update products set active=true where id=$1',[payload.items[0].id]);
  });
  await test(`${type}: 12 overlapping identical handler calls create one order`,async()=>{
   const next=request(type),before=await count(table);const responses=await Promise.all(Array.from({length:12},()=>place(next)));
   assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses));
   assert.equal(responses.filter(r=>r.body.duplicate!==true).length,1);assert.equal(await count(table),before+1);
  });
  await test(`${type}: overlapping changed payloads with same key choose one winner`,async()=>{
   const next=request(type),before=await count(table);const responses=await Promise.all([place(next),place({...next,notes:'Changed'})]);
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(await count(table),before+1);
  });
  const fail=request(type);fail.name='Must Roll Back';fail.coupon_code='TEN';
  fail.items=[{id:type==='normal'?'dish':'bulk',qty:1},{id:type==='normal'?'other':'bulk-other',qty:1}];
  await db.exec(`create function public.fail_${type}_item() returns trigger language plpgsql as $$ begin if new.product_id='${type==='normal'?'other':'bulk-other'}' then raise exception 'injected item failure'; end if; return new; end $$;
    create trigger fail_item before insert on ${lines} for each row execute function public.fail_${type}_item();`);
  await test(`${type}: second item failure rolls back header, first item, customer update and key`,async()=>{
   const before=[await count(table),await count(lines),await count('order_requests')];
   const customer=(await db.query('select name from customers where phone=$1',[fail.phone])).rows[0].name;
   const response=await place(fail);assert.equal(response.body.success,false);
   assert.deepEqual([await count(table),await count(lines),await count('order_requests')],before);
   assert.equal((await db.query('select name from customers where phone=$1',[fail.phone])).rows[0].name,customer);
   assert.equal((await db.query('select * from order_requests where idempotency_key=$1',[fail.idempotency_key])).rows.length,0);
  });
  await test(`${type}: failed order also rolls back a NEW customer`,async()=>{
   const before=await count('customers');const response=await place({...fail,idempotency_key:crypto.randomUUID(),phone:'9345678012'});
   assert.equal(response.body.success,false);assert.equal(await count('customers'),before);
  });
  await db.exec(`drop trigger fail_item on ${lines};drop function public.fail_${type}_item();`);
  await test(`${type}: same failed key can safely retry after cause is fixed`,async()=>{
   const response=await place(fail);assert.equal(response.status,200);
   const retry=await place(fail);assert.equal(retry.body.duplicate,true);
  });
 }
 await test('key cannot be reused across normal and bulk channels',async()=>{
  const normal=request();await place(normal);const response=await place({...request('bulk'),idempotency_key:normal.idempotency_key});assert.equal(response.status,409);
 });
 await test('legacy key is rejected without rewriting the historical order',async()=>{
  const p=request();await db.query("insert into normal_orders(idempotency_key,order_number,payment_method,payment_status,total) values($1,'CBD-2026-000002','cod','pending',199)",[p.idempotency_key]);
  const before=(await db.query('select * from normal_orders where idempotency_key=$1',[p.idempotency_key])).rows[0];
  assert.equal((await place(p)).status,409);
  assert.deepEqual((await db.query('select * from normal_orders where idempotency_key=$1',[p.idempotency_key])).rows[0],before);
 });
 await test('cart ordering is irrelevant to retry identity',async()=>{
  const p={...request(),items:[{id:'other',qty:1},{id:'dish',qty:1}]};assert.equal((await place(p)).status,200);
  assert.equal((await place({...p,items:p.items.toReversed()})).body.duplicate,true);
 });
 await test('quota is not oversubscribed by overlapping handler submissions',async()=>{
  await db.exec("insert into coupons(code,active,kind,value,usage_limit) values('ONE',true,'flat',1000,1)");
  const responses=await Promise.all([place({...request(),coupon_code:'ONE'}),place({...request(),coupon_code:'ONE'})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  assert.equal(Number((await db.query("select count(*) n from normal_orders where coupon_code='ONE'")).rows[0].n),1);
 });
 await test('retry of committed coupon order survives later coupon expiry',async()=>{
  const p={...request(),coupon_code:'TEN'};const first=await place(p);assert.equal(first.status,200);
  await db.exec("update coupons set ends_at='2000-01-01' where code='TEN'");const retry=await place(p);assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.total,first.body.total);
 });
 await test('browser roles cannot access retry records or call transaction functions',async()=>{
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await assert.rejects(()=>db.query('select * from order_requests'),e=>e.code==='42501');
   await assert.rejects(()=>db.query('select lookup_order_request($1,$2)',[crypto.randomUUID(),'{}']),e=>e.code==='42501');
   await assert.rejects(()=>db.query('select create_order_atomic($1,$2,$3,$4)',[crypto.randomUUID(),'{}','{}','[]']),e=>e.code==='42501');
   await db.exec('reset role');
  }
 });
 console.log(`\n${checks} atomic-order/replay checks passed. Overlapping handlers use one serialized PGlite database; multi-connection lock contention remains unverified.`);
}finally{await db.close();}
