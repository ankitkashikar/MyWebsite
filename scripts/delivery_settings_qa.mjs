import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
const {db,handler}=await createOfflineOrderRuntime({schemaPath:new URL('./fixtures/website-schema-20260920.sql',import.meta.url)});
await db.exec(readFileSync('supabase/migrations/20260923000100_delivery_settings.sql','utf8'));
let checks=0;const test=async(name,f)=>{await f();checks++;console.log('PASS '+name);};
const actor='11111111-1111-4111-8111-111111111111';
const rule=(type,version,fee=4000,free=79900,enabled=true,action='save')=>db.query('select manage_delivery_rule($1,$2,$3,$4,$5,$6,$7) r',[type,action,version,fee,free,enabled,actor]);
const fee=(type,net)=>db.query('select quote_delivery_fee($1,$2) q',[type,net]);
const payload=type=>({type,idempotency_key:crypto.randomUUID(),name:'Delivery QA',phone:'9123456780',address:'Synthetic apartment 12, local only',pincode:'411057',delivery_slot:`6:00 pm – 6:30 pm (${new Date(Date.now()+330*60000+86400000).toISOString().slice(0,10)})`,delivery_datetime:new Date(Date.now()+3*86400000).toISOString(),payment_method:'upi',items:[{id:type==='normal'?'dish':'bulk',qty:2}]});
const place=handler('place-order');
await test('missing settings block quote and order without writes',async()=>{for(const type of ['normal','bulk']){const p=payload(type);assert.equal((await place({...p,action:'quote'})).status,503);assert.equal((await place(p)).status,503);}assert.equal((await db.query('select count(*)::int n from order_requests')).rows[0].n,0);});
await test('admin rule create records audit atomically',async()=>{await rule('normal',0);await rule('bulk',0,6000,null);assert.equal((await db.query('select count(*)::int n from delivery_rule_events')).rows[0].n,2);});
await test('threshold: below charged; exact and above free',async()=>{for(const [net,want] of [[79899,4000],[79900,0],[79901,0]])assert.equal(Number((await fee('normal',net)).rows[0].q.fee_paise),want);});
await test('stale edits and invalid fees rejected without audit',async()=>{await assert.rejects(rule('normal',0));await assert.rejects(rule('normal',1,-1));assert.equal((await db.query('select count(*)::int n from delivery_rule_events')).rows[0].n,2);});
let old;
for(const type of ['normal','bulk'])await test(type+' server quote, forged fee protection, stored total and retry',async()=>{
 const p=payload(type);const q=await place({...p,action:'quote',delivery_fee:0,total:1});assert.equal(q.status,200);assert.equal(q.body.delivery_fee,type==='normal'?40:60);
 const final={...p,delivery_version:q.body.delivery_version,expected_total_paise:q.body.total_paise,delivery_fee:0,total:1};
 const saved=await place(final);assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(Number(saved.body.total),q.body.total);
 const row=(await db.query(`select delivery_fee,delivery_rule_version from ${type}_orders where order_number=$1`,[saved.body.order_number])).rows[0];assert.equal(Number(row.delivery_fee),q.body.delivery_fee);assert.equal(row.delivery_rule_version,1);
 assert.equal((await place(final)).body.duplicate,true);if(type==='normal')old=final;
});
await test('coupon threshold uses subtotal after discounts',async()=>{
 await rule('normal',1,4000,35000);await db.exec("insert into coupons(code,active,kind,value) values('DELIVERY20',true,'percent',2000)");
 const p={...payload('normal'),coupon_code:'DELIVERY20'};const q=await place({...p,action:'quote'});assert.equal(q.status,200);assert.equal(q.body.delivery_fee,40);
 const saved=await place({...p,delivery_version:q.body.delivery_version,expected_total_paise:q.body.total_paise});assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(Number(saved.body.total),q.body.total);
});
await test('rule changed after quote rejects new order; existing retry survives',async()=>{
 const p=payload('normal');const q=await place({...p,action:'quote'});await rule('normal',2,5000,79900);
 assert.equal((await place({...p,delivery_version:q.body.delivery_version,expected_total_paise:q.body.total_paise})).status,409);
 assert.equal((await place(old)).body.duplicate,true);
});
await test('disabled and deleted rules block, history retained',async()=>{
 await rule('normal',3,5000,null,false);assert.equal((await place({...payload('normal'),action:'quote'})).status,503);
 await rule('bulk',1,null,null,false,'delete');assert.equal((await place({...payload('bulk'),action:'quote'})).status,503);
 assert.equal((await place(old)).body.duplicate,true);
 assert.equal(Number((await db.query("select delivery_fee from normal_orders where idempotency_key=$1",[old.idempotency_key])).rows[0].delivery_fee),40);
});
await test('delete and recreate preserve version sequence',async()=>{await rule('bulk',2,0,null);assert.equal((await fee('bulk',100)).rows[0].q.version,3);});
await test('anon and authenticated cannot read/write rules or invoke management',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(db.query('select * from delivery_rules'));
  await assert.rejects(db.query("update delivery_rules set fee_paise=0"));
  await assert.rejects(rule('normal',4));
  await db.exec('reset role');
 }
});
let adminHandler, serviceClients=0;
const env={SUPABASE_URL:'https://offline.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',TCB_ADMIN_EMAIL:'owner@example.com'};
const managementClient={async rpc(name,a){
 if(name==='consume_security_rate_limit')return {data:true};
 try {const result=await db.query('select manage_delivery_rule($1,$2,$3,$4,$5,$6,$7) r',[a.p_type,a.p_action,a.p_version,a.p_fee,a.p_free,a.p_enabled,a.p_actor]);return {data:result.rows[0].r};}
 catch(error){return {error:{code:error.code}};}
}};
const adminSource=stripTypeScriptTypes(readFileSync('supabase/functions/admin-orders/index.ts','utf8').replace(/^import .*createClient.*;$/m,''));
vm.runInNewContext(adminSource,{Deno:{env:{get:key=>env[key]},serve:h=>adminHandler=h},createClient:(url,key)=>{
 if(key==='service'){serviceClients++;return managementClient;}
 return {auth:{getUser:async token=>({data:{user:token==='anon'?null:{id:actor,email:token==='owner'?'owner@example.com':'other@example.com'}}})}};
},Request,Response,TextEncoder,TextDecoder,crypto,console:{error(){},warn(){}}});
const adminCall=(token,body)=>adminHandler(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
await test('management handler denies missing, anon and non-admin tokens before service access',async()=>{
 for(const [token,status] of [[null,401],['anon',401],['other',403]])assert.equal((await adminCall(token,{action:'delivery_delete',order_type:'normal',version:4})).status,status);
 assert.equal(serviceClients,0);
});
await test('authorized save ignores forged audit actor and stale write returns conflict',async()=>{
 const body={action:'delivery_save',order_type:'normal',version:4,fee_paise:3500,free_above_paise:null,enabled:true,actor:'forged'};
 assert.equal((await adminCall('owner',body)).status,200);
 assert.equal((await db.query('select actor::text from delivery_rule_events order by id desc limit 1')).rows[0].actor,actor);
 assert.equal((await adminCall('owner',body)).status,409);
});
console.log(`${checks} delivery database/API checks passed against exported schema. No live services used.`);
await db.close();
