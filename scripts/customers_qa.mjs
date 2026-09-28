import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {PGlite} from '../.migration-rehearsal/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();let checks=0;
const test=async(label,fn)=>{await fn();checks++;console.log('PASS '+label);};
const migration=readFileSync(new URL('../supabase/migrations/20260925000100_admin_customers.sql',import.meta.url),'utf8');
try {
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(readFileSync(new URL('./fixtures/website-schema-20260920.sql',import.meta.url),'utf8'));
 await db.exec('set search_path=public;set row_security=on;set check_function_bodies=on;');
 await db.exec(migration);
 const id='11111111-1111-4111-8111-111111111111',empty='22222222-2222-4222-8222-222222222222';
 await db.query("insert into customers(id,name,phone) values ($1,'<img src=x onerror=alert(1)>','9234567801'),($2,'No orders','9234567802')",[id,empty]);
 await db.exec("insert into products(id,name,price,order_type) values ('dish','Noodles',100,'normal'),('bulk','Bulk noodles',100,'bulk');");
 for(let i=0;i<25;i++){
  const type=i===3?'bulk':'normal',status=i<2||i===3?'delivered':i===2?'cancelled':'rejected';
  const row=(await db.query(`insert into ${type}_orders(customer_id,name,phone,address,${type==='normal'?'delivery_slot':'delivery_datetime'},subtotal,total,payment_method,idempotency_key,order_status,created_at)
   values ($1,'Historic name','9234567801',$2,${type==='normal'?"'Legacy slot'":"'2026-10-01T18:00:00+05:30'"},100,100,'cod',gen_random_uuid(),$3,$4) returning id`,[id,i===3?'Address B':'Address A',status,i===3?'2026-09-20T12:00:00Z':'2026-09-20T18:45:00Z'])).rows[0];
  await db.query(`insert into ${type}_order_items(order_id,product_id,product_name,unit_price,quantity,line_total) values ($1,$2,$3,100,$4,$5)`,[row.id,type==='normal'?'dish':'bulk',type==='normal'?'Noodles':'Bulk noodles',status==='delivered'?(type==='normal'?2:3):9,100]);
 }
 const detail=async(offset=0,customer=id)=>(await db.query('select admin_customer_detail($1,$2) d',[customer,offset])).rows[0].d;
 const list=async(search='',after=null)=>(await db.query('select admin_customers_list($1,$2) d',[search,after])).rows[0].d;
 await test('normal/bulk counts and excluded-status counts are accurate',async()=>{assert.deepEqual((await detail()).summary,{total_orders:25,normal_orders:24,bulk_orders:1,cancelled_or_rejected:22,preference_orders:3});});
 await test('favourites sum quantities and exclude cancelled/rejected items',async()=>{assert.deepEqual((await detail()).favourites.map(x=>[x.product_name,x.quantity]),[['Noodles',4],['Bulk noodles',3]]);});
 await test('hour buckets use placed time in IST including UTC date rollover',async()=>{assert.deepEqual((await detail()).hours,[{hour:0,orders:2},{hour:17,orders:1}]);});
 await test('recorded addresses and historical contact/item data are available',async()=>{const d=await detail();assert.deepEqual(d.addresses.map(a=>a.address).sort(),['Address A','Address B']);assert.equal(d.orders[0].name,'Historic name');assert.equal(d.orders[0].items[0].name,'Noodles');assert.equal(d.customer.phone,'9234567801');});
 await test('stable order pagination handles equal timestamps without duplicates',async()=>{const a=await detail(),b=await detail(20);assert.equal(a.orders.length,20);assert.equal(b.orders.length,5);assert.equal(a.next_offset,20);assert.equal(b.next_offset,null);assert.equal(new Set([...a.orders,...b.orders].map(o=>o.order_type+o.id)).size,25);});
 await test('empty customers return empty summaries and unknown customers return null',async()=>{const d=await detail(0,empty);assert.equal(d.summary.total_orders,0);for(const k of ['orders','addresses','hours','favourites'])assert.deepEqual(d[k],[]);assert.equal(await detail(0,'33333333-3333-4333-8333-333333333333'),null);});
 await test('search is case-insensitive and treats SQL wildcard/injection characters literally',async()=>{assert.equal((await list('NO ORDERS')).customers.length,1);assert.equal((await list('9234567801')).customers.length,1);assert.equal((await list("%' OR 1=1 --")).customers.length,0);assert.equal((await list('%')).customers.length,0);});
 for(let i=0;i<25;i++)await db.query("insert into customers(name,phone) values ('Paging test',$1)",['9345678'+String(i).padStart(3,'0')]);
 await test('customer cursor pages do not repeat rows',async()=>{const a=await list(),b=await list('',a.next_id);assert.equal(a.customers.length,20);assert.equal(b.customers.length,7);assert.equal(b.next_id,null);assert.equal(new Set([...a.customers,...b.customers].map(c=>c.id)).size,27);});
 await test('SQL rejects invalid search/page parameters',async()=>{await assert.rejects(()=>list('x'.repeat(101)));await assert.rejects(()=>detail(-1));});
 await test('anonymous/authenticated cannot call any customer RPC',async()=>{for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(()=>list(),e=>e.code==='42501');await assert.rejects(()=>detail(),e=>e.code==='42501');await assert.rejects(()=>db.query('select * from admin_customer_orders($1)',[id]),e=>e.code==='42501');}finally{await db.exec('reset role');}}});
 await test('service role reads through forced RLS',async()=>{await db.exec('set role service_role');try{assert.equal((await detail()).summary.total_orders,25);}finally{await db.exec('reset role');}});
 let serve,serviceCalls=0,rpcCalls=0;
 const env={SUPABASE_URL:'offline',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',TCB_ADMIN_EMAIL:'owner@example.com'};
 const client={async rpc(name,a){if(name==='consume_security_rate_limit')return {data:true};rpcCalls++;try{return {data:name==='admin_customers_list'?await list(a.p_search,a.p_after):await detail(a.p_offset,a.p_customer)};}catch(error){return {error:{code:error.code}};}}};
 const src=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/admin-orders/index.ts',import.meta.url),'utf8').replace(/^import .*createClient.*;$/m,''));
 vm.runInNewContext(src,{Deno:{env:{get:k=>env[k]},serve:h=>serve=h},createClient:(url,key)=>{if(key==='service'){serviceCalls++;return client;}return {auth:{getUser:async token=>({data:{user:token==='anon'?null:{id,email:token==='owner'?'owner@example.com':'other@example.com'}}})}};},Request,Response,TextEncoder,TextDecoder,crypto,console:{error(){},warn(){}}});
 const call=(token,body)=>serve(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
 await test('API denies missing/anonymous/non-admin before service access',async()=>{for(const action of ['customers_list','customer_detail'])for(const [token,status] of [[null,401],['anon',401],['other',403]])assert.equal((await call(token,{action,customer_id:id,email:'owner@example.com'})).status,status);assert.equal(serviceCalls,0);});
 await test('API validates IDs, search and paging before customer queries',async()=>{for(const body of [{action:'customers_list',search:[]},{action:'customers_list',after_id:'bad'},{action:'customer_detail',customer_id:'bad'},{action:'customer_detail',customer_id:id,offset:-1},{action:'customer_detail',customer_id:id,offset:0.5}])assert.equal((await call('owner',body)).status,400);assert.equal(rpcCalls,0);});
 await test('authorized API returns customer profile with no-store and unknown ID 404',async()=>{const r=await call('owner',{action:'customer_detail',customer_id:id});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).summary.total_orders,25);assert.equal((await call('owner',{action:'customer_detail',customer_id:'33333333-3333-4333-8333-333333333333'})).status,404);});
 console.log(`${checks} customer database/API checks passed. Synthetic data; no production access.`);
}finally{await db.close();}
