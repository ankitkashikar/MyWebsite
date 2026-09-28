const bulkQaDate = new Date(Date.now() + 3 * 86400000).toISOString();
// Dated future slot accepted by server scheduling validation.
const normalQaSlot = `6:00 pm – 6:30 pm (${new Date(Date.now() + 330 * 60000 + 86400000).toISOString().slice(0,10)})`;
// Node 24+, npm install @electric-sql/pglite@0.5.8 in a temporary directory.
// PGLITE_MODULE may point to that directory's dist/index.js. No live DB/network.
import assert from 'node:assert/strict';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
const {db, handler, quote, setRateAllowed} = await createOfflineOrderRuntime();
let count = 0;
async function test(name, fn) {await fn(); count++; console.log(`PASS ${name}`);}
const items = [{id:'dish',qty:2}];
const phone = '9123456780';
async function coupon(code, extra = {}) {
  const row = {code,active:true,kind:'percent',value:1000,...extra};
  const keys=Object.keys(row);
  await db.query(`insert into coupons (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
}
async function invalid(code, cart=items, type='normal', customer=phone) {
  await assert.rejects(()=>quote(code,cart,type,customer), e=>e.code==='P0001');
}
await coupon('TEN');
await test('database calculates percentage in integer paise',async()=>assert.deepEqual(await quote('TEN'),{subtotal_paise:39998,discount_paise:3999,total_paise:35999}));
for (const [code, rule] of [
 ['INACTIVE',{active:false}],['EXPIRED',{ends_at:'2000-01-01T00:00:00Z'}],
 ['FUTURE',{starts_at:'2100-01-01T00:00:00Z'}],['MIN',{min_subtotal_paise:40000}],
 ['CHANNEL',{order_type:'bulk'}],['PRODUCT',{product_ids:['other']}],
 ['CATEGORY',{categories:['rice']}],['FREE',{kind:'percent',value:10000}],
]) {
 await coupon(code,rule); await test(`${code} coupon rejected`,()=>invalid(code));
}
await test('nonexistent coupon rejected',()=>invalid('FAKE100'));
await coupon('FLAT',{kind:'flat',value:5000});
await test('flat coupon uses server value',async()=>assert.equal((await quote('FLAT')).discount_paise,5000));
await coupon('CAP',{max_discount_paise:1000});
await test('maximum discount enforced',async()=>assert.equal((await quote('CAP')).discount_paise,1000));
await coupon('ELIGIBLE',{product_ids:['dish'],categories:['noodles']});
await test('mixed cart discounts only eligible lines',async()=>assert.equal((await quote('ELIGIBLE',[{id:'dish',qty:1},{id:'other',qty:1}])).discount_paise,1999));
await test('duplicate IDs cannot multiply discount beyond quantities',async()=>assert.deepEqual(await quote('TEN',[{id:'dish',qty:1},{id:'dish',qty:1}]),await quote('TEN')));
for(const cart of [[],[{id:'missing',qty:1}],[{id:'dish',qty:0}],[{id:'dish',qty:-1}],[{id:'dish',qty:1.5}],[{id:'dish',qty:51}],[{id:'dish',qty:'1'}],[null]]) {
 await test('invalid coupon cart rejected',()=>invalid('TEN',cart));
}
await test('wrong product channel rejected',()=>invalid('TEN',[{id:'bulk',qty:1}]));
await test('invalid phone rejected',()=>invalid('TEN',items,'normal','9999999999'));
await test('null type rejected',()=>invalid('TEN',items,null));
await test('price/subtotal/discount attached to items ignored',async()=>assert.deepEqual(await quote('TEN',[{id:'dish',qty:2,price:0,total:0,discount:99999}]),await quote('TEN')));
async function insert(code, q, customer=phone, type='normal', cart=items) {
 return db.query(`insert into ${type}_orders(phone,coupon_code,coupon_items,subtotal,discount,total,delivery_fee,payment_status) values ($1,$2,$3,$4,$5,$6,0,'pending') returning id`,[customer,code,JSON.stringify(cart),q.subtotal_paise/100,q.discount_paise/100,q.total_paise/100]);
}
await coupon('ONCE',{usage_limit:1});
const firstQuote=await quote('ONCE');
await test('preview does not consume coupon use',async()=>assert.deepEqual(await quote('ONCE'),firstQuote));
await test('insert revalidates and consumes usage',async()=>{await insert('ONCE',firstQuote);await invalid('ONCE');});
await test('stale preview cannot exceed usage limit',async()=>assert.rejects(()=>insert('ONCE',firstQuote),e=>e.code==='P0001'));
await coupon('PERSON',{per_phone_limit:1});
await test('per-phone quota enforced across order types',async()=>{
 await insert('PERSON',await quote('PERSON'));
 await invalid('PERSON',[{id:'bulk',qty:1}],'bulk');
 assert.ok((await quote('PERSON',items,'normal','9234567801')).discount_paise>0);
});
await coupon('CHANGED'); const stale=await quote('CHANGED');
await test('deactivated coupon rejected after successful quote',async()=>{await db.exec("update coupons set active=false where code='CHANGED'");await assert.rejects(()=>insert('CHANGED',stale),e=>e.code==='P0001');});
await coupon('CHANGED_VALUE'); const staleValue=await quote('CHANGED_VALUE');
await test('discount changed after quote is rejected at insertion',async()=>{await db.exec("update coupons set value=2000 where code='CHANGED_VALUE'");await assert.rejects(()=>insert('CHANGED_VALUE',staleValue),e=>e.code==='P0001');});
await test('forged final discount fails database trigger',async()=>{const q=await quote('TEN');await assert.rejects(()=>insert('TEN',{...q,discount_paise:39997,total_paise:1}),e=>e.code==='P0001');});
await test('coupon context required at insertion',async()=>assert.rejects(()=>insert('TEN',firstQuote,phone,'normal',null),e=>e.code==='P0001'));
await test('failed insert does not consume use',async()=>{
 await coupon('ROLLBACK',{usage_limit:1});const q=await quote('ROLLBACK');
 await db.exec('begin');await insert('ROLLBACK',q);await db.exec('rollback');assert.deepEqual(await quote('ROLLBACK'),q);
});
await test('database access denied to public roles',async()=>{
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(()=>db.query('select * from coupons'),e=>e.code==='42501');
  await assert.rejects(()=>quote('TEN'),e=>e.code==='42501');
  await db.exec('reset role');
 }
});
await test('service role can quote with forced RLS',async()=>{await db.exec('set role service_role');assert.ok((await quote('TEN')).total_paise>0);await db.exec('reset role');});

// Execute real Edge handlers against local PostgreSQL via a tiny query adapter.
const validate=handler('validate-coupon'),place=handler('place-order');
const request={code:'TEN',type:'normal',phone,items};
await test('HTTP coupon quote returns only customer-safe values',async()=>{
 const r=await validate({...request,total:0,discount:999999,price:1});assert.equal(r.status,200);assert.deepEqual(Object.keys(r.body).sort(),['code','discount','label','subtotal','total','valid']);assert.equal(r.body.total,359.99);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),'https://ankitkashikar.github.io');
});
for(const code of ['FAKE','EXPIRED','PRODUCT',{code:'TEN',discount:9999},['TEN','FLAT']])await test('HTTP fake/expired/ineligible/object/stacked coupon rejected',async()=>{const r=await validate({...request,code});assert.equal(r.status,400);assert.equal(r.body.valid,false);});
await test('HTTP lowercase code normalized',async()=>assert.equal((await validate({...request,code:' ten '})).body.code,'TEN'));
await test('HTTP actual body-size limit enforced without Content-Length',async()=>assert.equal((await validate(null,{raw:' '.repeat(8193)})).status,413));
await test('HTTP malformed JSON rejected',async()=>assert.equal((await validate(null,{raw:'{'})).status,400));
await test('HTTP content type/method rejected',async()=>{assert.equal((await validate({}, {headers:{'content-type':'text/plain'}})).status,415);assert.equal((await validate({}, {method:'GET'})).status,405);});
await test('HTTP rate limit fails closed',async()=>{setRateAllowed(false);assert.equal((await validate(request)).status,429);setRateAllowed(true);});
const order=()=>({type:'normal',idempotency_key:crypto.randomUUID(),name:'Offline Test',phone,address:'Offline test building, apartment 12',pincode:'411057',items,payment_method:'upi',delivery_slot:normalQaSlot,coupon_code:'TEN'});
await test('real order handler persists database coupon totals and pending payment',async()=>{
 const payload={...order(),total:0,discount:399.98,payment_status:'paid'};const r=await place(payload);assert.equal(r.status,200);assert.equal(Number(r.body.total),359.99);
 const row=(await db.query('select * from normal_orders where idempotency_key=$1',[payload.idempotency_key])).rows[0];assert.equal(Number(row.discount),39.99);assert.equal(row.payment_status,'pending');
 const lines=(await db.query('select * from normal_order_items where order_id=$1',[row.id])).rows;assert.equal(Number(lines[0].line_total),399.98);
 const retry=await place(payload);assert.equal(retry.body.duplicate,true);
});
for(const code of ['FAKE','EXPIRED','PRODUCT',{code:'TEN',discount:9999},['TEN','FLAT']])await test('order handler rejects invalid coupon before customer writes',async()=>{
 const before=(await db.query('select count(*) as n from customers')).rows[0].n;
 const r=await place({...order(),phone:'9345678012',coupon_code:code});assert.equal(r.status,400);
 assert.equal((await db.query('select count(*) as n from customers')).rows[0].n,before);
});
await test('bulk handler uses coupon trigger too',async()=>{const r=await place({...order(),type:'bulk',delivery_datetime:bulkQaDate,items:[{id:'bulk',qty:2}]});assert.equal(r.status,200);assert.equal(Number(r.body.total),450);});
console.log(`\n${count} coupon database/handler checks passed (offline PGlite; fixture schema).`);
await db.close();
