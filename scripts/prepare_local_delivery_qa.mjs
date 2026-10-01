import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import pg from 'pg';
const root=new URL('../.local-supabase-qa/',import.meta.url);
assert.ok(existsSync(new URL('TCB_LOCAL_QA_ONLY',root)));
assert.ok(!existsSync(new URL('supabase/.temp/project-ref',root)));
const config=JSON.parse(readFileSync(new URL('status.json',root),'utf8'));
const url=new URL(config.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55322');
const db=new pg.Client({connectionString:config.DB_URL});await db.connect();
try {
 if(!(await db.query("select to_regclass('public.delivery_rules') t")).rows[0].t){
  await db.query(readFileSync(new URL('../supabase/migrations/20260923000100_delivery_settings.sql',import.meta.url),'utf8'));
 }
 if(!(await db.query("select to_regclass('public.coupon_admin_events') t")).rows[0].t){
  await db.query(readFileSync(new URL('../supabase/migrations/20260923000200_coupon_admin.sql',import.meta.url),'utf8'));
 }
 // Re-runnable privilege correction; local loopback guard above is mandatory.
 await db.query(readFileSync(new URL('../supabase/migrations/20260924000100_audit_grants.sql',import.meta.url),'utf8'));
 if(!(await db.query("select to_regprocedure('public.admin_customer_detail(uuid,integer)') f")).rows[0].f){
  await db.query(readFileSync(new URL('../supabase/migrations/20260925000100_admin_customers.sql',import.meta.url),'utf8'));
 }
 // Apply menu validation after all existing order/coupon function upgrades.
 await db.query(readFileSync(new URL('../supabase/migrations/20260929000100_menu_cart_validation.sql',import.meta.url),'utf8'));
 if(!(await db.query('select 1 from public.menu_addon_parents limit 1')).rowCount){
  // Synthetic catalogue only; the loopback and unlinked-project guards above apply.
  const catalogue=JSON.parse(readFileSync(new URL('../data/menu-options.json',import.meta.url),'utf8'));
  for(const item of catalogue.items)await db.query("insert into products(id,name,price,active,order_type) values($1,$2,$3,true,'normal') on conflict(id) do nothing",[item.key,item.title,item.options[0].price]);
  await db.query(readFileSync(new URL('../supabase/migrations/20260929000200_menu_catalogue.sql',import.meta.url),'utf8'));
 }
 // Explicit synthetic zero-fee fixtures for legacy checkout regression only.
 for(const type of ['normal','bulk']) {
  const row=(await db.query('select version from delivery_rules where order_type=$1',[type])).rows[0];
  await db.query("select manage_delivery_rule($1,'save',$2,0,null,true,'11111111-1111-4111-8111-111111111111')",[type,row?.version||0]);
 }
 await db.query("NOTIFY pgrst, 'reload schema'");
 console.log('Local delivery migration ready; synthetic zero-fee rules configured for QA only.');
} finally {await db.end();}
