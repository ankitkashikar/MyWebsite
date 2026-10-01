// Actual browser -> local Edge runtime -> PostgREST -> exported PostgreSQL schema.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import pg from 'pg';
const root=resolve(import.meta.dirname,'..'),qa=resolve(root,'.local-supabase-qa');
assert.ok(existsSync(qa+'/TCB_LOCAL_QA_ONLY'));
assert.ok(!existsSync(qa+'/supabase/.temp/project-ref'),'Refusing linked project');
const config=JSON.parse(readFileSync(qa+'/status.json','utf8'));
const api=new URL(config.API_URL),dbUrl=new URL(config.DB_URL);
assert.equal(api.hostname,'127.0.0.1');assert.equal(api.port,'55321');
assert.equal(dbUrl.hostname,'127.0.0.1');assert.equal(dbUrl.port,'55322');
assert.ok(config.ANON_KEY,'Local anon JWT missing from status');
const db=new pg.Client({connectionString:config.DB_URL});await db.connect();
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
 try {
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if(!path.startsWith(root+sep))throw Error();
  let body=readFileSync(path);
  if(path===resolve(root,'supabase-config.js'))body=body.toString().replace(/const SUPABASE_URL = .*?;/,`const SUPABASE_URL = ${JSON.stringify(api.origin)};`).replace(/const SUPABASE_ANON_KEY = .*?;/,`const SUPABASE_ANON_KEY = ${JSON.stringify(config.ANON_KEY)};`);
  res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
 }catch{res.writeHead(404).end();}
});
let browser,checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const endpoint=async(name,payload,authenticated=true)=>fetch(api.origin+'/functions/v1/'+name,{method:'POST',redirect:'error',headers:{'content-type':'application/json','origin':'http://127.0.0.1:4173',...(authenticated?{apikey:config.ANON_KEY,authorization:'Bearer '+config.ANON_KEY}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
try {
 await new Promise((ok,no)=>{server.once('error',no);server.listen(4173,'127.0.0.1',ok);});
 await test('JWT gateway rejects missing credentials',async()=>{assert.equal((await endpoint('place-order',{},false)).status,401);});
 await db.query("insert into coupons(code,active,kind,value) values ('LOCALQA10',true,'percent',1000) on conflict(code) do update set active=true");
 browser=await chromium.launch({headless:true});
 for(const [file,type] of [['menu.html','normal'],['bulk-order.html','bulk']])for(const width of [390,1280]){
  // Isolate scenarios; a separate test below verifies real rate limiting.
  await db.query('delete from security_rate_limits');
  const page=await browser.newPage({viewport:{width,height:900},timezoneId:'Asia/Kolkata'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   return url.hostname==='127.0.0.1'&&['4173','55321'].includes(url.port)?route.continue():route.abort();
  });
  await page.goto('http://127.0.0.1:4173/'+file);
  if(type==='normal')await page.locator('.menu-variant').first().selectOption({index:1});
  const product=await page.locator('.menu-row').first().evaluate(el=>({id:el.dataset.id,price:Number(el.dataset.price)}));
  if(type==='bulk')await db.query('insert into products(id,name,price,active,order_type) values($1,$2,$3,true,$4) on conflict(id) do update set price=excluded.price,active=true,order_type=excluded.order_type',[product.id,'Local synthetic dish',product.price,type]);
  await page.locator('.qty-plus').first().click();await page.locator('.qty-plus').first().click();
  let addonPrice=0;
  if(type==='normal'){
   const panel=page.locator('.menu-row').first().locator('.inline-addons');await panel.waitFor({state:'visible'});
   const checkbox=panel.locator('input').first();await checkbox.check();
   addonPrice=Number((await db.query('select price from products where id=$1',[await checkbox.inputValue()])).rows[0].price);
  }
  await page.locator('#cartBarInner').click();await page.locator('#btnToAddress').click();
  await page.locator('#custName').fill('Local QA Customer');await page.locator('#custPhone').fill('9123456780');
  await page.locator('#custAddress').fill('Synthetic local test address apartment 12');
  if(type==='normal'){
   await page.locator('#custPincode').fill('411057');await page.locator('[data-mode="later"]').click();
   await page.locator('[data-day="1"]').click();await page.locator('.slot-chip').first().click();
  }else{
   const tomorrow=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
   await page.locator('#custDate').fill(tomorrow+'T18:00');await page.locator('#custEvent').fill('Local QA');
  }
  await page.locator('#couponInput').fill('LOCALQA10');await page.locator('#btnApplyCoupon').click();
  try {
   await page.waitForFunction(()=>document.getElementById('couponAppliedTag').classList.contains('visible') || document.getElementById('couponMsg').classList.contains('error'));
  } catch {
   throw new Error(`Coupon step stalled (${type} ${width}); button=${await page.locator('#btnApplyCoupon').innerText()}; message=${await page.locator('#couponMsg').innerText()}`);
  }
  assert.ok(await page.locator('#couponAppliedTag').evaluate(el=>el.classList.contains('visible')), `Coupon failed (${type} ${width}): ${await page.locator('#couponMsg').innerText()}`);
  const alerts=[];
  page.on('dialog',async d=>{alerts.push(d.message());await d.dismiss();});
  const isOrderResponse=r=>r.url().endsWith('/functions/v1/place-order')&&r.request().method()==='POST';
  const [quoteResponse]=await Promise.all([
   page.waitForResponse(r=>isOrderResponse(r)&&r.request().postDataJSON()?.action==='quote'),
   page.locator('#btnPlaceOrder').click(),
  ]);
  const quote=await quoteResponse.json();
  assert.equal(quoteResponse.status(),200,`Delivery quote HTTP ${quoteResponse.status()}: ${quote.message || 'No message'}`);
  assert.equal(quote.success,true,'Delivery quote failed');
  try {await page.locator('#btnConfirmPayment').waitFor({state:'visible',timeout:10000});}
  catch {throw new Error('Payment step did not open. Alerts: '+alerts.join(' | ')+'; browser errors: '+errors.join(' | '));}
  const subtotalPaise=(product.price+addonPrice)*200;
  const expected=(subtotalPaise-Math.floor(subtotalPaise*0.1))/100;
  const [response]=await Promise.all([
   page.waitForResponse(r=>isOrderResponse(r)&&r.request().postDataJSON()?.action!=='quote'),
   page.locator('#btnConfirmPayment').click(),
  ]);
  const payload=response.request().postDataJSON(), result=await response.json();
  await test(`${type} ${width}: complete browser checkout via real local API`,async()=>{
   assert.equal(response.status(),200,JSON.stringify(result));assert.match(result.order_number,/^(CBD|BLK)-/);assert.equal(result.total,expected);
   await page.waitForFunction(()=>document.getElementById('stepSuccess').classList.contains('active'));
   assert.match(await page.locator('#successTitle').textContent(),/Payment Pending Confirmation/);
   const row=(await db.query(`select * from ${type}_orders where idempotency_key=$1`,[payload.idempotency_key])).rows[0];
   assert.equal(row.payment_status,'pending');assert.equal(Number(row.total),expected);
   assert.equal((await db.query(`select count(*)::int n from ${type}_order_items where order_id=$1`,[row.id])).rows[0].n,type==='normal'?2:1);
   if(type==='normal'){
    const lines=(await db.query('select product_name from normal_order_items where order_id=$1',[row.id])).rows;
    assert.ok(lines.some(x=>x.product_name.includes('Semi Gravy')));assert.ok(lines.some(x=>x.product_name.includes('Extra Schezwan Chutney')));
   }
  });
  await test(`${type} ${width}: replay and conflicting replay through gateway`,async()=>{
   const repeat=await (await endpoint('place-order',payload)).json();assert.equal(repeat.duplicate,true);assert.equal(repeat.order_number,result.order_number);
   assert.equal((await endpoint('place-order',{...payload,notes:'changed'})).status,409);
  });
  await test(`${type} ${width}: forged amount/payment cannot alter saved values`,async()=>{
   const altered={...payload,idempotency_key:crypto.randomUUID(),total:1,discount:99999,payment_status:'paid',items:payload.items.map(i=>({...i,price:0}))};
   const r=await endpoint('place-order',altered);assert.equal(r.status,200);assert.equal((await r.json()).total,expected);
   const row=(await db.query(`select total,payment_status from ${type}_orders where idempotency_key=$1`,[altered.idempotency_key])).rows[0];
   assert.equal(Number(row.total),expected);assert.equal(row.payment_status,'pending');
  });
  await test(`${type} ${width}: fake coupon rejected`,async()=>{assert.equal((await endpoint('place-order',{...payload,idempotency_key:crypto.randomUUID(),coupon_code:'FAKE_LOCAL'})).status,400);});
  if(type==='normal') {
   await db.query('delete from security_rate_limits');
   const date=days=>new Date(Date.now()+330*60000+days*86400000).toISOString().slice(0,10);
   const invalidSlots=[
    ['relative label', 'Tomorrow 6 PM'],
    ['past date', `6:00 pm – 6:30 pm (${date(-1)})`],
    ['outside hours', `3:30 pm – 4:00 pm (${date(1)})`],
    ['non-half-hour slot', `6:15 pm – 6:45 pm (${date(1)})`],
    ['invalid duration', `6:00 pm – 7:00 pm (${date(1)})`],
    ['beyond tomorrow', `6:00 pm – 6:30 pm (${date(3)})`],
   ];
   for(const [label,slot] of invalidSlots) await test(`normal ${width}: API rejects ${label} without saving an order`,async()=>{
    const key=crypto.randomUUID();
    const r=await endpoint('place-order',{...payload,idempotency_key:key,delivery_slot:slot});
    assert.equal(r.status,400);assert.match((await r.json()).message,/delivery slot is unavailable/);
    assert.equal((await db.query('select count(*)::int n from normal_orders where idempotency_key=$1',[key])).rows[0].n,0);
   });
  }
  if(type==='bulk') {
   await db.query('delete from security_rate_limits');
   for(const [label,date] of [
    ['under 24 hours',new Date(Date.now()+23*3600000).toISOString()],
    ['past date','2020-01-01T18:00:00+05:30'],
    ['invalid calendar date','2099-02-30T18:00:00+05:30'],
    ['malformed date','tomorrow evening'],
   ]) await test(`bulk ${width}: API rejects ${label} without saving an order`,async()=>{
    const key=crypto.randomUUID();
    const r=await endpoint('place-order',{...payload,idempotency_key:key,delivery_datetime:date});
    assert.equal(r.status,400);assert.match((await r.json()).message,/24 hours notice/);
    assert.equal((await db.query('select count(*)::int n from bulk_orders where idempotency_key=$1',[key])).rows[0].n,0);
   });
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 await test('real rate limit rejects the thirteenth request',async()=>{
  await db.query('delete from security_rate_limits');
  for(let i=0;i<12;i++)assert.equal((await endpoint('place-order',{})).status,400);
  assert.equal((await endpoint('place-order',{})).status,429);
 });
 console.log(`${checks} local Supabase checkout/API checks passed. UPI transfers and production acceptance are excluded.`);
}finally{
 await browser?.close();await db.end();await new Promise(r=>server.close(r));
}
