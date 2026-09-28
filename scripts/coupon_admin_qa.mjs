import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
const {db,handler}=await createOfflineOrderRuntime({schemaPath:new URL('./fixtures/website-schema-20260920.sql',import.meta.url)});
for(const name of ['20260923000100_delivery_settings.sql','20260923000200_coupon_admin.sql'])await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
const actor='11111111-1111-4111-8111-111111111111';
let checks=0;const test=async(name,f)=>{await f();checks++;console.log('PASS '+name);};
const fields=(extra={})=>({active:true,kind:'percent',value:1000,min_subtotal_paise:0,order_type:null,max_discount_paise:null,usage_limit:null,per_phone_limit:null,...extra});
const manage=(code,version,changes=fields(),action='save')=>db.query('select manage_coupon($1,$2,$3,$4,$5) c',[code,action,version,JSON.stringify(changes),actor]);
const quote=(code,type='normal',phone='9123456780')=>db.query('select quote_coupon($1,$2,$3,$4) q',[code,type,phone,JSON.stringify([{id:type==='normal'?'dish':'bulk',qty:2}])]);
await test('create and atomic audit record',async()=>{await manage('ADMIN10',0);const e=(await db.query('select * from coupon_admin_events')).rows[0];assert.equal(e.actor,actor);assert.equal(e.before_coupon,null);assert.equal(e.after_coupon.version,1);});
await test('percentage quote uses catalogue prices',async()=>{assert.equal((await quote('ADMIN10')).rows[0].q.discount_paise,3999);});
await test('edit flat discount, minimum, cap and order scope',async()=>{
 await manage('ADMIN10',1,fields({kind:'flat',value:5000,min_subtotal_paise:10000,max_discount_paise:3000,order_type:'normal'}));
 assert.equal((await quote('ADMIN10')).rows[0].q.discount_paise,3000);await assert.rejects(quote('ADMIN10','bulk'));
});
await test('stale edits and invalid input leave audit/state unchanged',async()=>{
 await assert.rejects(manage('ADMIN10',1));await assert.rejects(manage('ADMIN10',2,fields({value:-1})));await assert.rejects(manage('ADMIN10',2,{actor:'spoof'}));
 assert.equal((await db.query('select count(*)::int n from coupon_admin_events')).rows[0].n,2);
});
await test('disable rejects redemption; enable restores it',async()=>{await manage('ADMIN10',2,{active:false},'toggle');await assert.rejects(quote('ADMIN10'));await manage('ADMIN10',3,{active:true},'toggle');await quote('ADMIN10');});
await test('editing preserves existing date/product/category restrictions',async()=>{
 await db.exec("update coupons set starts_at='2020-01-01',ends_at='2099-01-01',product_ids=array['dish'],categories=array['noodles'] where code='ADMIN10'");
 await manage('ADMIN10',4,fields());const row=(await db.query("select * from coupons where code='ADMIN10'")).rows[0];assert.deepEqual(row.product_ids,['dish']);assert.deepEqual(row.categories,['noodles']);assert.ok(row.ends_at);await quote('ADMIN10');
});
await test('minimum order and maximum percentage validation',async()=>{await manage('MINIMUM',0,fields({min_subtotal_paise:50000}));await assert.rejects(quote('MINIMUM'));await assert.rejects(manage('BADPERCENT',0,fields({value:10001})));});
const place=handler('place-order');let order, saved;
await db.query("select manage_delivery_rule('normal','save',0,0,null,true,$1)",[actor]);
await test('usage limits count real saved orders',async()=>{
 await manage('ONCE',0,fields({usage_limit:1,per_phone_limit:1}));
 order={type:'normal',idempotency_key:crypto.randomUUID(),name:'Coupon QA',phone:'9123456780',address:'Synthetic local address apartment 12',pincode:'411057',delivery_slot:`6:00 pm – 6:30 pm (${new Date(Date.now()+330*60000+86400000).toISOString().slice(0,10)})`,payment_method:'upi',items:[{id:'dish',qty:2}],coupon_code:'ONCE'};
 const q=await place({...order,action:'quote'});assert.equal(q.status,200);order={...order,delivery_version:q.body.delivery_version,expected_total_paise:q.body.total_paise};saved=await place(order);assert.equal(saved.status,200,JSON.stringify(saved));await assert.rejects(quote('ONCE'));
});
await test('delete blocks reuse while historical totals and retry remain intact',async()=>{
 await manage('ONCE',1,{},'delete');await assert.rejects(quote('ONCE'));await assert.rejects(manage('ONCE',2));
 const retry=await place(order);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.total,saved.body.total);
 const row=(await db.query('select coupon_code,total from normal_orders where idempotency_key=$1',[order.idempotency_key])).rows[0];assert.equal(row.coupon_code,'ONCE');assert.equal(Number(row.total),Number(saved.body.total));
});
await test('deleted flag cannot be bypassed by reactivating row',async()=>{await db.exec("update coupons set active=true where code='ONCE'");await assert.rejects(quote('ONCE'));});
await test('anon and authenticated cannot manage coupons or read audit',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(manage('BYPASS',0));await assert.rejects(db.query('select * from coupon_admin_events'));await assert.rejects(db.query('update coupons set active=true'));await db.exec('reset role');}
});
let serve,serviceCalls=0;
const env={SUPABASE_URL:'offline',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',TCB_ADMIN_EMAIL:'owner@example.com'};
const client={async rpc(name,a){if(name==='consume_security_rate_limit')return {data:true};try{return {data:(await db.query('select manage_coupon($1,$2,$3,$4,$5) c',[a.p_code,a.p_action,a.p_version,JSON.stringify(a.p_changes),a.p_actor])).rows[0].c};}catch(error){return {error:{code:error.code}};}}};
const src=stripTypeScriptTypes(readFileSync('supabase/functions/admin-orders/index.ts','utf8').replace(/^import .*createClient.*;$/m,''));
vm.runInNewContext(src,{Deno:{env:{get:k=>env[k]},serve:h=>serve=h},createClient:(u,key)=>{if(key==='service'){serviceCalls++;return client;}return {auth:{getUser:async token=>({data:{user:token==='anon'?null:{id:actor,email:token==='owner'?'owner@example.com':'other@example.com'}}})}};},Request,Response,TextEncoder,TextDecoder,crypto,console:{error(){},warn(){}}});
const call=(token,body)=>serve(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
await test('API denies missing, anonymous and non-admin identity',async()=>{
 for(const action of ['coupon_list','coupon_history','coupon_save','coupon_toggle','coupon_delete'])for(const [token,status] of [[null,401],['anon',401],['other',403]])assert.equal((await call(token,{action})).status,status);
 assert.equal(serviceCalls,0);
});
await test('API uses verified actor and rejects forged fields, invalid amounts and stale saves',async()=>{
 const request={action:'coupon_save',code:'API10',version:0,changes:fields(),actor:'spoof'};
 assert.equal((await call('owner',request)).status,200);
 assert.equal((await db.query("select actor from coupon_admin_events where code='API10'")).rows[0].actor,actor);
 assert.equal((await call('owner',request)).status,409);
 assert.equal((await call('owner',{...request,code:'INVALID',changes:fields({value:1.5})})).status,400);
 assert.equal((await call('owner',{...request,code:'INVALID',changes:{...fields(),deleted_at:null}})).status,400);
});
console.log(`${checks} coupon administration database/API checks passed; no live services used.`);
await db.close();
