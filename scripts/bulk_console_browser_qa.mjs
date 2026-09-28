// UI-only regression with synthetic Auth/API responses; not live acceptance.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true});let checks=0;
try{for(const width of [390,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900}});
 const rows=['normal','bulk'].map(type=>({id:'shared-id',order_type:type,order_number:(type==='bulk'?'BLK':'CBD')+'-2026-000001',order_status:'new',payment_status:'pending',created_at:new Date().toISOString(),name:'Synthetic',phone:'9123456780',address:'Synthetic address',delivery_datetime:'2026-09-22T12:30:00Z',delivery_slot:'Tomorrow 6 PM',event_type:'Synthetic event',total:199,subtotal:199,items:[{product_name:'QA Dish',quantity:1,line_total:199}]}));
 const requests=[];
 await ctx.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:`export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}}),onAuthStateChange(){},signOut:async()=>({})}};}`});
  if(url.endsWith('/admin-orders')){
   const b=route.request().postDataJSON();requests.push(b);
   if(b.action==='list'){assert.equal(b.order_type,'all');return route.fulfill({json:{success:true,orders:rows}});}
   const row=rows.find(r=>r.order_type===b.order_type);assert.ok(row);assert.equal(b.order_id,row.id);
   if(b.action==='confirm_payment')row.payment_status='paid';
   if(b.action==='update_status')row.order_status=b.status;
   return route.fulfill({json:{success:true}});
  }
  return url.startsWith('http://127.0.0.1:4173/')?route.continue():route.abort();
 });
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/orders.html');
 await page.locator('[data-order-type="bulk"]').waitFor();
 for(const type of ['bulk','normal']){
  const card=page.locator(`[data-order-type="${type}"]`);
  assert.ok(await card.locator('[data-status="accepted"]').isDisabled());
  if(type==='bulk')assert.match(await card.textContent(),/Synthetic event/);
  await card.locator('[data-action="payment"]').click();await page.locator('#paymentReference').fill('SYNTHETIC');await page.locator('#confirmPaymentButton').click();
  await page.waitForFunction(type=>!document.querySelector(`[data-order-type="${type}"] [data-status="accepted"]`).disabled,type);
  await card.locator('[data-status="accepted"]').click();await card.locator('[data-status="preparing"]').waitFor();
  assert.equal(requests.filter(r=>r.action==='confirm_payment').at(-1).order_type,type);
  assert.equal(requests.filter(r=>r.action==='update_status').at(-1).order_type,type);
  checks++;console.log(`PASS ${width} ${type}: shared-ID action routing and payment gate`);
 }
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 checks++;console.log(`PASS ${width}: no browser errors or horizontal overflow`);await ctx.close();
}console.log(`${checks} UI-only checks passed; real Auth/API acceptance excluded.`);}finally{await browser.close();}
