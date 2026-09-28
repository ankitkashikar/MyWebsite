// Browser -> actual Edge handler -> local PostgreSQL fixture. No live orders.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
import {startOfflineSite} from './offline_site_server.mjs';
const site=await startOfflineSite();
const base=site.url;
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const packaged=process.env.CHROMIUM_MODULE ? (await import(process.env.CHROMIUM_MODULE)).default : null;
const browser=await chromium.launch({headless:true,...(packaged?{executablePath:await packaged.executablePath(),args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']}: {})});
const {db,handler}=await createOfflineOrderRuntime();
const place=handler('place-order'),validate=handler('validate-coupon');
await db.exec("insert into coupons(code,active,kind,value) values ('TEN',true,'percent',1000),('EXPIRED',true,'flat',1000),('OTHER',true,'flat',1000); update coupons set ends_at='2000-01-01' where code='EXPIRED'; update coupons set product_ids=array['not-orderable-here'] where code='OTHER';");
let checks=0;
const findings=[];
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
try {
 for(const [file,type] of [['menu.html','normal'],['bulk-order.html','bulk']]) {
  for(const width of [390,1280]) {
   const page=await browser.newPage({viewport:{width,height:900},timezoneId:'Asia/Kolkata'});
   await page.clock.setFixedTime(new Date('2026-09-20T18:00:00+05:30'));
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let mutate=null,last=null,requests=0;
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(['/functions/v1/place-order','/functions/v1/validate-coupon'].includes(url.pathname)) {
     if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, authorization, apikey'}});
     let body=req.postDataJSON();
     if(url.pathname.endsWith('/place-order')) {
      if(mutate)body=mutate(body);
      const result=await place(body);last={request:body,result};requests++;
      return route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body),headers:{'access-control-allow-origin':'*'}});
     }
     const result=await validate(body);
     return route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body),headers:{'access-control-allow-origin':'*'}});
    }
    if(url.origin===new URL(base).origin)return route.continue();
    return route.abort();
   });
   await page.goto(new URL(file,base).href,{waitUntil:'domcontentloaded'});
   const product=await page.locator('.menu-row').first().evaluate(el=>({id:el.dataset.id,price:Number(el.dataset.price)}));
   assert.ok(Number.isInteger(product.price)&&product.price>0);
   await db.query('insert into products(id,name,price,active,order_type) values ($1,$2,$3,true,$4) on conflict(id) do update set price=excluded.price, active=true, order_type=excluded.order_type',[product.id,'Offline fixture dish',product.price,type]);
   const full=product.price*2,discount=Math.floor(full*100*1000/10000)/100,expected=full-discount;
   await page.locator('.qty-plus').first().click();await page.locator('.qty-plus').first().click();
   await page.locator('#cartBarInner').click();await page.locator('#btnToAddress').click();
   await page.locator('#custName').fill('Offline Customer');
   await page.locator('#custPhone').fill('9999999999');
   await page.locator('#custAddress').fill('short');
   if(type==='normal')await page.locator('#custPincode').fill('411057');
   else {await page.locator('#custDate').fill('2026-09-21T18:00');await page.locator('#custEvent').fill('Offline test');}
   await check(`${type} ${width}: invalid details stop checkout`,async()=>{
    await page.locator('#btnPlaceOrder').click();
    assert.equal(await page.locator('#stepAddress').evaluate(el=>el.classList.contains('active')),true);
    assert.equal(requests,0);
   });
   await page.locator('#custPhone').fill('9123456780');
   await page.locator('#custAddress').fill('Offline test building, apartment 12, Test Road');
   if(type==='normal') {
    await page.locator('[data-mode="later"]').click();
    await page.locator('[data-day="1"]').click();await page.locator('.slot-chip').first().click();
   }
   await page.locator('#couponInput').fill('TEN');await page.locator('#btnApplyCoupon').click();
   await page.waitForFunction(()=>document.getElementById('couponAppliedTag').classList.contains('visible'));
   await page.locator('#btnPlaceOrder').click();
   const shown=await page.locator('#payAmount').textContent();
   assert.equal(Number(shown.replace(/[^0-9.]/g,'')),expected);
   const upi=await page.locator('#btnPayUpiApp').getAttribute('href');
   if(upi.includes('yourbusiness@upi'))findings.push(`${type} ${width}: placeholder UPI recipient remains`);
   await check(`${type} ${width}: valid checkout persists server total and pending payment`,async()=>{
    await page.locator('#btnConfirmPayment').click();
    await page.waitForFunction(()=>document.getElementById('stepSuccess').classList.contains('active'));
    assert.equal(last.result.status,200);assert.equal(Number(last.result.body.total),expected);
    const row=(await db.query(`select * from ${type}_orders where idempotency_key=$1`,[last.request.idempotency_key])).rows[0];
    assert.equal(Number(row.total),expected);assert.equal(Number(row.discount),discount);assert.equal(row.payment_status,'pending');
    assert.match(await page.locator('#successTitle').textContent(),/Payment Pending Confirmation/);
   });
   const valid=structuredClone(last.request);
   await page.waitForFunction(()=>[...document.querySelectorAll('.qty-display')].every(el=>el.value==='0'));
   // Browser-console equivalent requests still pass through interception to
   // the real handler/database. New UUID per attack avoids replay shortcuts.
   const send=async extra=>page.evaluate(async payload=>submitOrder(payload),{...valid,idempotency_key:crypto.randomUUID(),...extra});
   await check(`${type} ${width}: modified network money/payment fields ignored`,async()=>{
    const result=await send({items:[{id:product.id,qty:2,price:0,unit_price:-1}],price:0,subtotal:0,total:1,discount:999999,discountPercent:100,delivery_charge:-999,payment_amount:0,payment_status:'paid',payment_reference:'FORGED'});
    assert.equal(result.success,true);assert.equal(Number(result.total),expected);
    const row=(await db.query(`select * from ${type}_orders where idempotency_key=$1`,[last.request.idempotency_key])).rows[0];
    assert.equal(Number(row.total),expected);assert.equal(row.payment_status,'pending');
   });
   for(const [label,extra]of [
    ['fake coupon',{coupon_code:'MY100OFF'}],['expired coupon',{coupon_code:'EXPIRED'}],['ineligible coupon',{coupon_code:'OTHER'}],
    ['coupon object',{coupon_code:{code:'TEN',discount:9999}}],['stacked coupons',{coupon_code:['TEN','OTHER']}],
    ['unknown product',{items:[{id:'missing',qty:1}]}],['zero quantity',{items:[{id:product.id,qty:0}]}],
    ['negative quantity',{items:[{id:product.id,qty:-1}]}],['decimal quantity',{items:[{id:product.id,qty:1.5}]}],
    ['huge quantity',{items:[{id:product.id,qty:999999}]}],['bad phone',{phone:'9999999999'}],
    ['bad address',{address:'short'}],['COD request',{payment_method:'cod'}],
    ...(type==='normal'?[['unserviceable PIN',{pincode:'000000'}]]:[]),
   ])await check(`${type} ${width}: ${label} rejected without new order`,async()=>{
    const before=(await db.query(`select count(*) n from ${type}_orders`)).rows[0].n;
    const result=await send(extra);assert.equal(result.success,false);
    assert.equal((await db.query(`select count(*) n from ${type}_orders`)).rows[0].n,before);
   });
   await check(`${type} ${width}: unavailable product rejected`,async()=>{
    await db.query('update products set active=false where id=$1',[product.id]);
    assert.equal((await send({})).success,false);
    await db.query('update products set active=true where id=$1',[product.id]);
   });
   await check(`${type} ${width}: replay returns same order without duplicate`,async()=>{
    const before=(await db.query(`select count(*) n from ${type}_orders`)).rows[0].n;
    const result=await page.evaluate(payload=>submitOrder(payload),valid);
    assert.equal(result.duplicate,true);assert.equal((await db.query(`select count(*) n from ${type}_orders`)).rows[0].n,before);
   });
   // Tamper actual DOM/JS cart state, then use the real UI confirmation button.
   await page.evaluate(({id})=>{
    document.querySelectorAll('.qty-display').forEach(el=>el.value='0');
    const row=[...document.querySelectorAll('.menu-row')].find(el=>el.dataset.id===id);
    row.dataset.price='0';row.querySelector('.qty-display').value='2';
    document.getElementById('custName').value='Offline Customer';document.getElementById('custPhone').value='9123456780';document.getElementById('custAddress').value='Offline test building, apartment 12, Test Road';
    appliedCoupon={code:'TEN',discount:999999,label:'fake 100%'};
    currentIdempotencyKey=crypto.randomUUID();
    document.getElementById('payAmount').textContent='₹0';
    if(typeof selectedSlot!=='undefined')selectedSlot=`6:00 pm – 6:30 pm (${new Date(Date.now()+330*60000+86400000).toISOString().slice(0,10)})`;
    openDrawer('stepPayment');
   },product);
   await check(`${type} ${width}: DevTools cart/discount/total edits cannot change saved amount`,async()=>{
    const prior=requests;
    await page.locator('#btnConfirmPayment').click();
    await page.waitForFunction(()=>!document.getElementById('btnConfirmPayment').disabled);
    assert.ok(requests>prior);assert.equal(last.result.status,200,JSON.stringify(last));
    await page.waitForFunction(()=>document.getElementById('stepSuccess').classList.contains('active'));
    assert.equal(Number(last.result.body.total),expected);assert.equal(last.result.status,200);
   });
   await page.waitForFunction(()=>[...document.querySelectorAll('.qty-display')].every(el=>el.value==='0'));
   // Stale quotes are an expected failure; no fake success may be shown.
   await page.evaluate(({id})=>{
    document.querySelectorAll('.qty-display').forEach(el=>el.value='0');const row=[...document.querySelectorAll('.menu-row')].find(el=>el.dataset.id===id);row.querySelector('.qty-display').value='2';
    currentIdempotencyKey=crypto.randomUUID();appliedCoupon={code:'EXPIRED',discount:10,label:'stale'};openDrawer('stepPayment');
   },product);
   await check(`${type} ${width}: failed order displays error rather than success`,async()=>{
    await page.locator('#btnConfirmPayment').click();await page.locator('#orderSubmitError').waitFor({state:'visible'});
    assert.equal(await page.locator('#stepSuccess').evaluate(el=>el.classList.contains('active')),false);
   });
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }
 console.log(`\n${checks} browser checkout/tampering checks passed against offline SQL/handlers.`);
 console.log('OPEN FINDINGS: '+[...new Set(findings)].join('; '));
}finally{await browser.close();await db.close();await site.close();}
