const bulkQaDate = new Date(Date.now() + 3 * 86400000).toISOString();
// Dated future slot accepted by server scheduling validation.
const normalQaSlot = `6:00 pm – 6:30 pm (${new Date(Date.now() + 330 * 60000 + 86400000).toISOString().slice(0,10)})`;
// Actual handler and exported schema; local SQL adapter, no Supabase gateway/Auth.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
const {db,handler}=await createOfflineOrderRuntime({schemaPath:new URL('./fixtures/website-schema-20260920.sql',import.meta.url)});
let allowed=true,checks=0,serve;
const client={rpc:async()=>({data:allowed}),from(table){
 assert.ok(['normal_orders','bulk_orders','normal_order_items','bulk_order_items'].includes(table));
 let fields,filters=[],single=false;
 const execute=async()=>{try{
  const rows=(await db.query(`select ${fields} from ${table} where ${filters.map(([k],i)=>`${k}=$${i+1}`).join(' and ')}`,filters.map(([,v])=>v))).rows;
  return {data:single?rows[0]??null:rows};
 }catch(error){return {error};}};
 const q={select(s){assert.match(s,/^[a-z_,]+$/);fields=s;return q;},eq(k,v){assert.match(k,/^[a-z_]+$/);filters.push([k,v]);return q;},order(){return q;},maybeSingle(){single=true;return execute();},then(a,b){return execute().then(a,b);}};return q;
}};
const code=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/order-status/index.ts',import.meta.url),'utf8').replace(/^import .*createClient.*;$/m,''));
runInNewContext(code,{createClient:()=>client,Deno:{env:{get:()=> 'offline'},serve:f=>serve=f},Response,TextEncoder,crypto,console});
const lookup=async(order_number,phone='9123456780')=>{const r=await serve(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_number,phone})}));return {status:r.status,body:await r.json()};};
const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try {
 for(const type of ['normal','bulk']){
  const placed=await handler('place-order')({type,idempotency_key:crypto.randomUUID(),name:'Synthetic',phone:'9123456780',address:'Synthetic offline address apartment 12',pincode:'411057',delivery_slot:normalQaSlot,delivery_datetime:bulkQaDate,payment_method:'upi',items:[{id:type==='normal'?'dish':'bulk',qty:2}]});
  assert.equal(placed.status,200);const number=placed.body.order_number;
  await test(type+' correct table, schema fields, items and pending payment',async()=>{
   const r=await lookup(number);assert.equal(r.status,200);assert.equal(r.body.order.order_type,type);assert.equal(r.body.order.payment_status,'pending');assert.equal(r.body.order.items.length,1);
   assert.equal(r.body.order.items[0].product_name,type==='normal'?'Dish':'Bulk');
   if(type==='bulk')assert.equal(new Date(r.body.order.delivery_datetime).toISOString(),bulkQaDate);
   else assert.equal(r.body.order.delivery_slot,normalQaSlot);
   for(const field of ['id','address','phone','name','customer_id','payment_reference','delivery_partner_cost'])assert.equal(r.body.order[field],undefined);
  });
  await test(type+' wrong phone and missing order match',async()=>{
   const wrong=await lookup(number,'9234567801'),missing=await lookup((type==='bulk'?'BLK':'CBD')+'-9999-999999');assert.equal(wrong.status,404);assert.deepEqual(wrong,missing);
  });
  await test(type+' does not cross tables when prefix is switched',async()=>{
   // Different phone on the other order ensures an overlapping suffix cannot authorize it.
   const other=type==='bulk'?'normal_orders':'bulk_orders';await db.query(`update ${other} set phone='9234567801'`);
   assert.equal((await lookup(number.replace(type==='bulk'?'BLK':'CBD',type==='bulk'?'CBD':'BLK'))).status,404);
  });
 }
 await test('unsupported prefix rejected',async()=>assert.equal((await lookup('BAD-2026-000001')).status,400));
 await test('rate limiter fails closed',async()=>{allowed=false;assert.equal((await lookup('BLK-2026-000001')).status,429);});
 console.log(`${checks} offline tracking checks passed; live gateway/Auth acceptance excluded.`);
}finally{await db.close();}
