import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from '../.migration-rehearsal/node_modules/linkedom/esm/index.js';
import {createOfflineOrderRuntime} from './offline_order_runtime.mjs';
const cat=JSON.parse(readFileSync('data/menu-options.json','utf8'));
const {db,handler}=await createOfflineOrderRuntime({schemaPath:new URL('./fixtures/website-schema-20260920.sql',import.meta.url)});
let checks=0;const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try {
for(const f of ['20260923000100_delivery_settings.sql','20260923000200_coupon_admin.sql','20260924000100_audit_grants.sql','20260925000100_admin_customers.sql','20260929000100_menu_cart_validation.sql'])await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
for(const item of cat.items)await db.query("insert into products(id,name,price,active,order_type) values($1,$2,$3,true,'normal')",[item.key,item.title,item.options[0].price]);
await test('catalogue migration fails atomically when a base is missing',async()=>{
 await db.exec("delete from products where id='VS-1'");
 await assert.rejects(db.exec(readFileSync('supabase/migrations/20260929000200_menu_catalogue.sql','utf8')));await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from menu_addon_parents')).rows[0].n,0);
 const item=cat.items.find(x=>x.key==='VS-1');await db.query("insert into products(id,name,price,active,order_type) values($1,$2,$3,true,'normal')",[item.key,item.title,item.options[0].price]);
});
await db.exec(readFileSync('supabase/migrations/20260929000200_menu_catalogue.sql','utf8'));
const valid=items=>db.query('select validate_menu_cart($1,$2::jsonb)', ['normal',JSON.stringify(items)]);
const dish=cat.items.find(x=>x.key==='VS-1'), main=dish.options[0],addon=dish.addons[0];
const cart=[{id:main.id,qty:2},{id:addon.id,qty:2}];
await test('all 75 dishes, 127 choices and 253 eligible add-on mappings validate',async()=>{
 assert.equal(cat.items.length,75);assert.equal(cat.products.filter(x=>x.kind==='dish').length,127);assert.equal(cat.products.filter(x=>x.kind==='addon').length,253);
 for(const item of cat.items)for(const option of item.options)await valid([{id:option.id,qty:1},...item.addons.map(a=>({id:a.id,qty:1}))]);
});
await test('removed dishes and standalone drinks unavailable; no offers created',async()=>{
 for(const id of cat.retired_ids)await assert.rejects(valid([{id,qty:1}]));
 assert.ok(cat.products.every(p=>!/(Peri Peri|Mineral Water|200\s?ml|10%)/i.test(p.name)));
 assert.ok(cat.items.every(p=>!/^Veg Noodles$|Thums|Sprite/.test(p.title)));
 assert.equal((await db.query('select count(*)::int n from coupons')).rows[0].n,0);
});
await test('orphan, wrong-dish and excessive add-ons rejected including duplicates',async()=>{
 for(const items of [[{id:addon.id,qty:1}],[{id:'VS-2',qty:1},{id:addon.id,qty:1}],[{id:main.id,qty:1},{id:addon.id,qty:2}],[{id:main.id,qty:1},{id:addon.id,qty:1},{id:addon.id,qty:1}]])await assert.rejects(valid(items));
 await valid([{id:main.id,qty:1},{id:main.id,qty:1},{id:addon.id,qty:2}]);
});
await test('malformed choices, negative/fractional quantity and cross-channel cart denied',async()=>{
 for(const items of [[],[{id:'forged',qty:1}],[{id:main.id,qty:-1}],[{id:main.id,qty:1.5}],[{id:main.id,qty:'1'}],[{id:main.id,qty:51}]])await assert.rejects(valid(items));
 await assert.rejects(db.query('select validate_menu_cart($1,$2::jsonb)',['bulk',JSON.stringify(cart)]));
});
await db.query("select manage_delivery_rule('normal','save',0,0,null,true,'11111111-1111-4111-8111-111111111111')");
const place=handler('place-order');
const payload=items=>({type:'normal',idempotency_key:crypto.randomUUID(),name:'Menu QA',phone:'9123456780',address:'Synthetic apartment 12, local only',pincode:'411057',delivery_slot:`6:00 pm – 6:30 pm (${new Date(Date.now()+330*60000+86400000).toISOString().slice(0,10)})`,payment_method:'upi',items});
let original;
await test('real handler ignores forged prices and saves variant/add-on names and amounts',async()=>{
 original=payload(cart.map(x=>({...x,price:0,name:'forged'})));const q=await place({...original,action:'quote'});assert.equal(q.status,200,JSON.stringify(q));assert.equal(q.body.total,(main.price+addon.price)*2);
 original={...original,delivery_version:q.body.delivery_version,expected_total_paise:q.body.total_paise};
 const saved=await place(original);assert.equal(saved.status,200,JSON.stringify(saved));
 const lines=(await db.query('select product_id,product_name,unit_price,quantity from normal_order_items order by product_id')).rows;
 assert.equal(lines.length,2);assert.ok(lines.some(x=>x.product_name===main.name&&Number(x.quantity)===2));assert.ok(lines.some(x=>x.product_name===addon.name&&Number(x.unit_price)===addon.price));
 assert.equal((await place(original)).body.duplicate,true);
 const changed={...original,items:[{id:dish.options[1].id,qty:2},{id:addon.id,qty:2}]};assert.equal((await place(changed)).status,409);
});
await test('handler quote rejects orphan add-on before order writes',async()=>{
 assert.equal((await place({...payload([{id:addon.id,qty:1}]),action:'quote'})).status,400);
 assert.equal((await db.query('select count(*)::int n from normal_orders')).rows[0].n,1);
});
await test('SQL final transaction independently rejects orphan add-on and rolls back',async()=>{
 const request=payload([{id:addon.id,qty:1}]);
 await assert.rejects(db.query('select create_order_atomic($1,$2,$3,$4)',[request.idempotency_key,JSON.stringify(request),'{}',JSON.stringify([{product_id:addon.id,product_name:addon.name,unit_price:addon.price,quantity:1,line_total:addon.price}])]),/eligible dish/);
 assert.equal((await db.query('select count(*)::int n from order_requests')).rows[0].n,1);
});
await test('coupon quote validates add-on eligibility, no implicit offer',async()=>{
 await db.exec("insert into coupons(code,active,kind,value) values('EXPLICIT',true,'flat',100)");
 await assert.rejects(db.query("select quote_coupon('EXPLICIT','normal','9123456780',$1)",[JSON.stringify([{id:addon.id,qty:1}])]));
 const q=(await db.query("select quote_coupon('EXPLICIT','normal','9123456780',$1) q",[JSON.stringify(cart)])).rows[0].q;
 assert.equal(q.subtotal_paise,(main.price+addon.price)*200);assert.equal(q.discount_paise,100);
});
await test('disabled add-on rejected; completed retry survives catalogue changes',async()=>{
 await db.query('update products set active=false where id=$1',[addon.id]);await assert.rejects(valid(cart));assert.equal((await place(original)).body.duplicate,true);
});
await test('anonymous and customer roles cannot change or call catalogue rules',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from menu_addon_parents'));await assert.rejects(valid(cart));await assert.rejects(db.query("update products set price=1"));await db.exec('reset role');}
});
const {document,window}=parseHTML(readFileSync('menu.html','utf8'));const context={};vm.runInNewContext(readFileSync('menu-options.js','utf8'),context);let changes=0;
await test('inline add-ons hidden until selected, without a dialog',async()=>{
 context.TCBMenuOptions.init(document,()=>changes++);
 assert.equal(document.querySelectorAll('.menu-row').length,75);
 const row=document.querySelector('[data-menu-key="VS-1"]');const panel=row.querySelector('.inline-addons');assert.equal(panel.hidden,true);
 row.querySelector('.qty-display').value='2';context.TCBMenuOptions.sync();assert.equal(panel.hidden,false);
 const check=panel.querySelector('input');check.checked=true;check.setAttribute('checked','');check.dispatchEvent(new window.Event('change'));assert.equal(changes,1);
 const items=context.TCBMenuOptions.withAddons([{id:row.dataset.id,name:row.dataset.item,price:main.price,qty:2}]);assert.equal(items.length,2);assert.equal(items[1].qty,2);assert.equal(items[1].id,addon.id);
 row.querySelector('.qty-display').value='0';context.TCBMenuOptions.sync();assert.equal(panel.hidden,true);assert.equal(check.checked,false);assert.equal(context.TCBMenuOptions.withAddons([]).length,0);
});
await test('all rendered variants and add-on labels match the approved catalogue',async()=>{
 for(const item of cat.items){const row=document.querySelector('[data-menu-key="'+item.key+'"]');assert.ok(row);const opts=[...row.querySelectorAll('select option')];if(item.options.length>1){assert.deepEqual(opts.map(x=>x.value.split('|')[0]),item.options.map(x=>x.id));}for(const a of item.addons)assert.ok(row.textContent.includes(a.label));}
 assert.equal(document.querySelectorAll('.menu-row[data-item*="Peri Peri"]').length,0);
});
console.log(`${checks} menu option SQL/API/DOM checks passed. Synthetic data only; no real browser, Supabase or printer verification.`);
} finally {await db.close();}
