// Dated future slot accepted by server scheduling validation.
const normalQaSlot = `6:00 pm – 6:30 pm (${new Date(Date.now() + 330 * 60000 + 86400000).toISOString().slice(0,10)})`;
// No Auth/API stubs. Only local URLs and copied CORS/browser configuration.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import pg from 'pg';
const root=resolve(import.meta.dirname,'..'),qa=resolve(root,'.local-supabase-qa');
assert.ok(existsSync(qa+'/TCB_LOCAL_QA_ONLY'));
assert.ok(!existsSync(qa+'/supabase/.temp/project-ref'));
const c=JSON.parse(readFileSync(qa+'/status.json','utf8'));
assert.equal(new URL(c.API_URL).origin,'http://127.0.0.1:55321');
const d=new URL(c.DB_URL);assert.equal(d.hostname,'127.0.0.1');assert.equal(d.port,'55322');
assert.ok(c.SERVICE_ROLE_KEY&&c.ANON_KEY,'Missing local JWT keys');
const {email}=JSON.parse(readFileSync(qa+'/operations.json','utf8'));
const password=crypto.randomUUID()+'Aa1!';
const db=new pg.Client({connectionString:c.DB_URL});await db.connect();
await build({absWorkingDir:root,stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:root},bundle:true,format:'esm',platform:'browser',outfile:qa+'/auth-client.mjs',logLevel:'silent'});
const server=createServer((req,res)=>{
 try{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/qa-auth-client.mjs'){res.writeHead(200,{'content-type':'application/javascript'}).end(readFileSync(qa+'/auth-client.mjs'));return;}
  const path=resolve(root,'.'+decodeURIComponent(pathname));
  assert.ok(path.startsWith(root+sep));
  assert.ok(['.html','.js','.css','.svg','.png'].includes(extname(path)));
  let body=readFileSync(path);
  if(path===resolve(root,'supabase-config.js'))body=body.toString().replace(/const SUPABASE_URL = .*?;/,`const SUPABASE_URL = ${JSON.stringify(c.API_URL)};`).replace(/const SUPABASE_ANON_KEY = .*?;/,`const SUPABASE_ANON_KEY = ${JSON.stringify(c.ANON_KEY)};`);
  if(path===resolve(root,'orders.html') || path===resolve(root,'admin-settings.js'))body=body.toString().replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm','/qa-auth-client.mjs');
  res.writeHead(200,{'content-type':{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[extname(path)]}).end(body);
 }catch{res.writeHead(404).end();}
});
const api=async(path,body,token=c.ANON_KEY,method='POST')=>{
 const r=await fetch(c.API_URL+path,{method,redirect:'error',headers:{apikey:c.ANON_KEY,authorization:'Bearer '+token,'content-type':'application/json',origin:'http://127.0.0.1:4173'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 return {status:r.status,body:await r.json().catch(()=>null)};
};
const edge=(name,body,token)=>api('/functions/v1/'+name,body,token);
let checks=0,browser;const users=[];
const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const createUser=async(address)=>{
 const r=await api('/auth/v1/admin/users',{email:address,password,email_confirm:true},c.SERVICE_ROLE_KEY);
 assert.ok([200,201].includes(r.status),`Local Auth user creation HTTP ${r.status}`);
 assert.ok(r.body.id);users.push(r.body.id);
};
try{
 await new Promise((yes,no)=>{server.once('error',no);server.listen(4173,'127.0.0.1',yes);});
 // Isolate this suite from the checkout suite's deliberate rate-limit exhaustion.
 await db.query('delete from security_rate_limits');
 await createUser(email);
 const other=`other-${crypto.randomUUID()}@example.com`;await createUser(other);
 await test('anon JWT cannot list operations orders',async()=>{assert.equal((await edge('admin-orders',{action:'list'})).status,401);});
 await test('authenticated non-operations account denied',async()=>{
  const signed=await api('/auth/v1/token?grant_type=password',{email:other,password});assert.equal(signed.status,200);
  assert.equal((await edge('admin-orders',{action:'list'},signed.body.access_token)).status,403);
 });
 await test('customers: anonymous and non-admin access denied',async()=>{
  const login=await api('/auth/v1/token?grant_type=password',{email:other,password});
  for(const action of ['customers_list','customer_detail']) {
   assert.equal((await edge('admin-orders',{action})).status,401);
   assert.equal((await edge('admin-orders',{action},login.body.access_token)).status,403);
  }
 });
 browser=await chromium.launch({headless:true});
 await test('delivery: anonymous changes denied',async()=>{assert.equal((await edge('admin-orders',{action:'delivery_save',order_type:'normal',version:0,fee_paise:0,free_above_paise:null,enabled:true})).status,401);});
 await test('delivery: non-admin changes denied',async()=>{
  const login=await api('/auth/v1/token?grant_type=password',{email:other,password});
  assert.equal((await edge('admin-orders',{action:'delivery_delete',order_type:'normal',version:1},login.body.access_token)).status,403);
 });
 for(const width of [390,1280]) {
  const ctx=await browser.newContext({viewport:{width,height:1000}});
  await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&['4173','55321'].includes(u.port)?route.continue():route.abort();});
  const p=await ctx.newPage();
  const signInDiagnostics=[];
  p.on('pageerror',e=>signInDiagnostics.push('Page error: '+e.message));
  p.on('response',r=>{
   const u=new URL(r.url());
   if(u.pathname.includes('/auth/v1/token'))signInDiagnostics.push('Auth HTTP '+r.status());
   if(u.pathname.endsWith('/admin-orders'))signInDiagnostics.push('Admin '+(r.request().postDataJSON()?.action||'unknown')+' HTTP '+r.status());
   if(r.status()>=400&&u.pathname.endsWith('.js'))signInDiagnostics.push('Script HTTP '+r.status()+': '+u.pathname);
  });
  await p.goto('http://127.0.0.1:4173/admin.html');
  await test(`delivery ${width}: real admin sign-in`,async()=>{
   await p.locator('#adminEmail').fill(email);await p.locator('#adminPassword').fill(password);
   try {
    await p.locator('#btnLogin').click();
    await p.waitForFunction(()=>document.getElementById('dashboard').style.display==='block'||document.getElementById('loginError').classList.contains('visible'));
    assert.equal(await p.locator('#dashboard').isVisible(),true);
   }catch {
    throw new Error('Admin sign-in did not open dashboard. '+(await p.locator('#loginError').textContent())+' | '+signInDiagnostics.slice(-12).join(' | '));
   }
  });
  await test(`customers ${width}: admin searches and reads saved history`,async()=>{
   const customer=(await db.query('select c.id,c.phone from customers c where exists(select 1 from normal_orders n where n.customer_id=c.id) or exists(select 1 from bulk_orders b where b.customer_id=c.id) order by c.id limit 1')).rows[0];
   assert.ok(customer,'Run the checkout suite first to create synthetic orders.');
   const wait=p.waitForResponse(r=>r.url().endsWith('/admin-orders')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='customers_list'&&r.request().postDataJSON()?.search===customer.phone);
   await p.locator('#customerSearch').fill(customer.phone);await p.locator('#customerSearchForm button').click();
   assert.equal((await wait).status(),200);await p.locator('#customerList button').first().waitFor();
   const profile=p.waitForResponse(r=>r.url().endsWith('/admin-orders')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='customer_detail');
   await p.locator('#customerList button').first().click();const result=await profile;assert.equal(result.status(),200);
   const data=await result.json();assert.equal(data.customer.phone,customer.phone);assert.ok(data.orders.length>0);
   await p.waitForFunction(phone=>document.getElementById('customerProfile').textContent.includes(phone),customer.phone);
   assert.ok((await p.locator('#customerOrders').textContent()).includes(data.orders[0].order_number));
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  });
  await test(`delivery ${width}: fee and threshold saved with audit`,async()=>{
   await p.locator('#deliveryFee').fill('40');await p.locator('#deliveryFree').fill('799');await p.locator('#deliveryEnabled').check();
   await p.locator('#deliveryForm button[type=submit]').click();await p.waitForFunction(()=>document.getElementById('deliveryMessage').textContent==='Delivery rule saved.');
   const row=(await db.query("select * from delivery_rules where order_type='normal'")).rows[0];assert.equal(Number(row.fee_paise),4000);
   assert.equal((await db.query("select actor::text from delivery_rule_events where order_type='normal' order by id desc limit 1")).rows[0].actor,users[0]);
  });
  await test(`delivery ${width}: delete blocks quote; recreate supported`,async()=>{
   p.once('dialog',d=>d.accept());await p.locator('#deleteDelivery').click();await p.waitForFunction(()=>document.getElementById('deliveryMessage').textContent.startsWith('Rule deleted'));
   const request={type:'normal',idempotency_key:crypto.randomUUID(),name:'Delivery QA',phone:'9123456780',address:'Synthetic local apartment address 12',pincode:'411057',delivery_slot:normalQaSlot,payment_method:'upi',items:[{id:'dish',qty:1}],action:'quote'};
   await db.query("insert into products(id,name,price,active,order_type) values('dish','QA',199,true,'normal') on conflict(id) do update set active=true,order_type='normal'");
   assert.equal((await edge('place-order',request)).status,503);
   await p.locator('#deliveryFee').fill('0');await p.locator('#deliveryEnabled').check();await p.locator('#deliveryForm button[type=submit]').click();await p.waitForFunction(()=>document.getElementById('deliveryMessage').textContent==='Delivery rule saved.');
  });
  await test(`delivery ${width}: sign-out hides settings`,async()=>{await p.locator('#btnLogout').click();await p.locator('#loginScreen').waitFor();assert.equal(await p.locator('#dashboard').isVisible(),false);assert.equal(await p.locator('#customerProfile').textContent(),'');assert.equal(await p.locator('#customerList').textContent(),'');});
  await ctx.close();
 }
 await test('coupons: anonymous access denied for all management actions',async()=>{
  for(const action of ['coupon_list','coupon_history','coupon_save','coupon_toggle','coupon_delete'])assert.equal((await edge('admin-orders',{action})).status,401);
 });
 await test('coupons: non-admin access denied for all management actions',async()=>{
  const login=await api('/auth/v1/token?grant_type=password',{email:other,password});
  for(const action of ['coupon_list','coupon_history','coupon_save','coupon_toggle','coupon_delete'])assert.equal((await edge('admin-orders',{action},login.body.access_token)).status,403);
 });
 for(const width of [390,1280]) {
  await db.query('delete from security_rate_limits');
  const ctx=await browser.newContext({viewport:{width,height:1000}});
  await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&['4173','55321'].includes(u.port)?route.continue():route.abort();});
  const p=await ctx.newPage(),code='QA'+crypto.randomUUID().replaceAll('-','').toUpperCase();
  await p.goto('http://127.0.0.1:4173/admin.html');
  await p.locator('#adminEmail').fill(email);await p.locator('#adminPassword').fill(password);
  const list=p.waitForResponse(r=>r.url().endsWith('/admin-orders')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='coupon_list');
  await p.locator('#btnLogin').click();await list;await p.locator('#dashboard').waitFor();
  const row=()=>p.locator('[data-coupon="'+code+'"]');
  const mutation=async(action,fn)=>{
   const response=p.waitForResponse(r=>r.url().endsWith('/admin-orders')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action===action);
   await fn();const r=await response;assert.equal(r.status(),200,JSON.stringify(await r.json()));
   await p.waitForFunction(()=>!document.getElementById('btnAddCoupon').disabled);
  };
  const couponQuote=()=>edge('validate-coupon',{code,type:'normal',phone:'9123456780',items:[{id:'dish',qty:2}]});
  await test(`coupons ${width}: create through authenticated admin page`,async()=>{
   await p.locator('#newCode').fill(code);await p.locator('#newValue').fill('10');await p.locator('#newActive').check();
   await mutation('coupon_save',()=>p.locator('#btnAddCoupon').click());await row().waitFor();
   assert.equal((await couponQuote()).body.valid,true);
  });
  await test(`coupons ${width}: edit changes actual coupon quote`,async()=>{
   await row().getByRole('button',{name:'Edit',exact:true}).click();await p.locator('#newType').selectOption('flat');await p.locator('#newValue').fill('25');
   await mutation('coupon_save',()=>p.locator('#btnAddCoupon').click());assert.equal((await couponQuote()).body.discount,25);
  });
  await test(`coupons ${width}: disable blocks redemption`,async()=>{
   await mutation('coupon_toggle',()=>row().getByRole('button',{name:'Disable',exact:true}).click());assert.equal((await couponQuote()).body.valid,false);
  });
  await test(`coupons ${width}: enable restores redemption`,async()=>{
   await mutation('coupon_toggle',()=>row().getByRole('button',{name:'Enable',exact:true}).click());assert.equal((await couponQuote()).body.valid,true);
  });
  await test(`coupons ${width}: verified actor and visible audit history`,async()=>{
   const rows=(await db.query('select actor::text from coupon_admin_events where code=$1',[code])).rows;assert.equal(rows.length,4);assert.ok(rows.every(r=>r.actor===users[0]));
   await p.locator('#couponHistory').click();await p.waitForFunction(code=>document.getElementById('couponHistoryBody').textContent.includes(code),code);
  });
  await test(`coupons ${width}: delete rejects redemption and removes active listing`,async()=>{
   p.once('dialog',d=>d.accept());await mutation('coupon_delete',()=>row().getByRole('button',{name:'Delete',exact:true}).click());assert.equal(await row().count(),0);assert.equal((await couponQuote()).body.valid,false);
   assert.ok((await db.query('select deleted_at from coupons where code=$1',[code])).rows[0].deleted_at);
  });
  await ctx.close();
 }
 for(const type of ['normal','bulk'])for(const width of [390,1280]){
  const table=type==='bulk'?'bulk_orders':'normal_orders';
  const deliveryDate=new Date(Date.now()+3*86400000).toISOString();
  await db.query('delete from security_rate_limits');
  await db.query("insert into products(id,order_type,name,price,active) values($1,$2,'Operations QA Dish',199,true) on conflict(id) do update set active=true,price=199,order_type=excluded.order_type",['ops-qa-'+type,type]);
  const key=crypto.randomUUID(),phone='9123456780';
  const orderRequest={type,delivery_datetime:deliveryDate,event_type:'Synthetic event',idempotency_key:key,name:'Synthetic Operations QA',phone,address:'Synthetic local QA address apartment 12',pincode:'411057',delivery_slot:normalQaSlot,payment_method:'upi',items:[{id:'ops-qa-'+type,qty:1}]};
  const quote=await edge('place-order',{...orderRequest,action:'quote'});assert.equal(quote.status,200);
  const placed=await edge('place-order',{...orderRequest,delivery_version:quote.body.delivery_version,expected_total_paise:quote.body.total_paise});
  assert.equal(placed.status,200,'Seed order must use real place-order API');
  const row=(await db.query(`select * from ${table} where idempotency_key=$1`,[key])).rows[0];
  const ctx=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Kolkata'});
  await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&['4173','55321'].includes(u.port)?route.continue():route.abort();});
  const page=await ctx.newPage();await page.goto('http://127.0.0.1:4173/orders.html');
  await test(`${type} ${width}: invalid password cannot sign in`,async()=>{
   await page.locator('#loginEmail').fill(email);await page.locator('#loginPassword').fill('incorrect-password');await page.locator('#loginButton').click();
   await page.locator('#loginError.visible').waitFor();assert.equal(await page.locator('#appShell').isVisible(),false);
  });
  let token;
  await test(`${type} ${width}: operations sign-in and saved order visible`,async()=>{
   await page.locator('#loginPassword').fill(password);
   const response=page.waitForResponse(r=>r.url().includes('/auth/v1/token')&&r.request().method()==='POST');
   await page.locator('#loginButton').click();const r=await response;assert.equal(r.status(),200);token=(await r.json()).access_token;
   await page.locator('#appShell').waitFor();await page.locator('[data-filter="all"]').click();
   await page.locator('#orderSearch').fill(row.order_number);await page.locator(`[data-order-id="${row.id}"]`).waitFor();
  });
  await test(`${type} ${width}: kitchen alert summary and explicit sound controls`,async()=>{
   const alerts=await edge('admin-orders',{action:'list',order_type:'all',limit:1,include_attention:true},token);
   assert.equal(alerts.status,200);assert.ok(alerts.body.attention.groups.find(g=>g.order_type===type).count>=1);
   await page.locator('#attentionBanner.visible').waitFor();
   assert.match(await page.locator('#attentionText').textContent(),/normal.*bulk/);
   assert.equal(await page.locator('#soundButton').textContent(),'Enable Sound');
   await page.locator('#soundButton').click();await page.waitForFunction(()=>document.getElementById('soundButton').textContent==='Sound On');
   await page.locator('#soundButton').click();assert.equal(await page.locator('#soundButton').textContent(),'Enable Sound');
  });
  const card=page.locator(`[data-order-id="${row.id}"]`);
  const admin=(body)=>edge('admin-orders',{order_type:type,order_id:row.id,...body},token);
  await test(`${type} ${width}: unpaid acceptance blocked by UI and API`,async()=>{
   assert.equal(await card.locator('[data-status="accepted"]').isDisabled(),true);
   assert.equal((await admin({action:'update_status',status:'accepted'})).status,409);
  });
  await test(`${type} ${width}: payment confirmation saved from console`,async()=>{
   await card.locator('[data-action="payment"]').click();await page.locator('#paymentReference').fill('SYNTHETIC-LOCAL-QA');
   const response=page.waitForResponse(r=>r.url().endsWith('/admin-orders')&&r.request().postDataJSON()?.action==='confirm_payment');
   await page.locator('#confirmPaymentButton').click();assert.equal((await response).status(),200);
   await card.locator('[data-status="accepted"]').waitFor();
   await page.waitForFunction(id=>!document.querySelector(`[data-order-id="${id}"] [data-status="accepted"]`)?.disabled,row.id);
   const saved=(await db.query(`select payment_status,payment_reference from ${table} where id=$1`,[row.id])).rows[0];
   assert.equal(saved.payment_status,'paid');assert.equal(saved.payment_reference,'SYNTHETIC-LOCAL-QA');
  });
  for(const state of ['accepted','preparing','ready_for_pickup','dispatched','delivered'])await test(`${type} ${width}: console transition ${state} and audit event saved`,async()=>{
   const response=page.waitForResponse(r=>r.url().endsWith('/admin-orders')&&r.request().postDataJSON()?.action==='update_status');
   await card.locator(`[data-status="${state}"]`).click();assert.equal((await response).status(),200);
   assert.equal((await db.query(`select order_status from ${table} where id=$1`,[row.id])).rows[0].order_status,state);
   assert.equal((await db.query('select count(*)::int n from order_status_events where order_id=$1 and new_status=$2 and order_type=$3',[row.id,state,type])).rows[0].n,1);
  });
  await test(`${type} ${width}: terminal order cannot return to preparing`,async()=>{assert.equal((await admin({action:'update_status',status:'preparing'})).status,409);});
  const track=await ctx.newPage();await track.goto('http://127.0.0.1:4173/order-status.html');
  await test(`${type} ${width}: customer browser shows final Dispatched step and paid payment`,async()=>{
   await track.locator('#trackOrderNumber').fill(row.order_number);await track.locator('#trackPhone').fill(phone);await track.locator('#trackSubmit').click();
   await track.waitForFunction(()=>document.getElementById('resultStatus').textContent==='Dispatched');
   assert.match(await track.locator('#resultPayment').textContent(),/Payment Confirmed/);
   assert.equal(await track.locator('.track-step').count(),4);
   assert.equal(await track.locator('#trackingLink').count(),0);
   assert.match(await track.locator('#resultItems').textContent(),/Operations QA Dish/);
   if(type==='bulk')assert.notEqual((await track.locator('#resultSlot').textContent()).trim(),'—');
  });
  await test(`${type} ${width}: wrong phone and unknown order have identical safe response`,async()=>{
   const wrong=await edge('order-status',{order_number:row.order_number,phone:'9234567801'});
   const missing=await edge('order-status',{order_number:(type==='bulk'?'BLK':'CBD')+'-9999-999999',phone});
   assert.equal(wrong.status,404);assert.equal(missing.status,404);
   const safeNotFound = body => {
    assert.match(body.reference,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const suffix=' Reference: '+body.reference;
    assert.equal(typeof body.message,'string');assert.ok(body.message.endsWith(suffix));
    const {reference,...rest}=body;
    return {...rest,message:body.message.slice(0,-suffix.length)};
   };
   const expected={success:false,message:'Order not found. Check the order number and mobile number and try again.'};
   assert.notEqual(wrong.body.reference,missing.body.reference);
   assert.deepEqual(safeNotFound(wrong.body),expected);
   assert.deepEqual(safeNotFound(missing.body),expected);
   const correct=await edge('order-status',{order_number:row.order_number,phone});assert.equal(correct.status,200);
   for(const key of ['address','phone','customer_id','payment_reference','delivery_partner_cost','delivery_provider','tracking_url','rider_name','rider_phone','estimated_delivery_from','estimated_delivery_to','rider_assigned_at'])assert.equal(correct.body.order[key],undefined);
  });
  await test(`${type} ${width}: sign-out restores login screen`,async()=>{await page.locator('#signOutButton').click();await page.locator('#loginShell').waitFor();assert.equal(await page.locator('#appShell').isVisible(),false);});
  await ctx.close();
 }
 console.log(`${checks} local customers/coupon/delivery-settings/operations/Auth/customer-tracking checks passed. Normal and bulk orders; synthetic payments, no production acceptance.`);
}finally{
 await browser?.close();
 for(const id of users){const r=await api('/auth/v1/admin/users/'+id,undefined,c.SERVICE_ROLE_KEY,'DELETE').catch(()=>null);if(!r||r.status>=400)console.log('Local synthetic Auth user cleanup incomplete.');}
 await db.end();await new Promise(r=>server.close(r));
}
