// Local checkout integration only. All external network requests are blocked.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {startOfflineSite} from './offline_site_server.mjs';
const site=await startOfflineSite();
const base=site.url;
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const packaged=process.env.CHROMIUM_MODULE ? (await import(process.env.CHROMIUM_MODULE)).default : null;
const browser=await chromium.launch({headless:true,...(packaged ? {executablePath:await packaged.executablePath(),args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']} : {})});
let checks=0;
try {
 for(const [file,type] of [['menu.html','normal'],['bulk-order.html','bulk']]) {
  for(const width of [390,1280]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let sent;
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname==='/functions/v1/validate-coupon') {
     if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, authorization, apikey'}});
     sent=req.postDataJSON();
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({valid:true,code:'TEN',discount:10,label:'₹10.00 off',subtotal:200,total:190}),headers:{'access-control-allow-origin':'*'}});
    }
    if(url.origin===new URL(base).origin)return route.continue();
    return route.abort();
   });
   await page.goto(new URL(file,base).href,{waitUntil:'domcontentloaded'});
   // Exercise coupon controls in the existing drawer without depending on
   // delivery time-of-day or opening-hour navigation rules.
   await page.evaluate(()=>{
    document.querySelector('.qty-display').value='2';
    document.getElementById('custPhone').value='9123456780';
    document.getElementById('couponInput').value='TEN';
    document.getElementById('btnApplyCoupon').click();
   });
   await page.waitForFunction(()=>document.getElementById('couponAppliedTag').classList.contains('visible'));
   assert.equal(sent.type,type);assert.equal(sent.phone,'9123456780');assert.equal(sent.code,'TEN');
   assert.deepEqual(Object.keys(sent).sort(),['code','items','phone','type']);
   assert.deepEqual(Object.keys(sent.items[0]).sort(),['id','qty']);
   assert.equal(sent.items[0].qty,2);
   await page.evaluate(()=>{const p=document.getElementById('custPhone');p.value='9234567801';p.dispatchEvent(new Event('input',{bubbles:true}));});
   assert.equal(await page.locator('#couponAppliedTag').evaluate(el=>el.classList.contains('visible')),false);
   await page.evaluate(()=>document.getElementById('btnApplyCoupon').click());
   await page.waitForFunction(()=>document.getElementById('couponAppliedTag').classList.contains('visible'));
   await page.evaluate(()=>document.querySelector('.qty-plus').click());
   assert.equal(await page.locator('#couponAppliedTag').evaluate(el=>el.classList.contains('visible')),false);
   assert.deepEqual(errors,[]);
   const keys=await page.evaluate(()=>{
    const first=buildOrderPayload('upi').idempotency_key;
    const retry=buildOrderPayload('upi').idempotency_key;
    document.getElementById('custAddress').value='Changed building, apartment 77, Test Road';
    const changed=buildOrderPayload('upi').idempotency_key;
    return {first,retry,changed};
   });
   assert.equal(keys.first,keys.retry);assert.notEqual(keys.first,keys.changed);
   console.log(`PASS ${type} ${width}px: coupon flow, invalidation, stable retry/new changed-cart key, no JS errors`);checks++;
   await page.close();
  }
 }
 console.log(`${checks} local browser scenarios passed; external requests intercepted/blocked.`);
} finally {await browser.close();await site.close();}
