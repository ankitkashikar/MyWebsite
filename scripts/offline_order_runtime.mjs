// Shared offline fixture: actual SQL and handlers, fixture-only tables, no network.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
export async function createOfflineOrderRuntime(options = {}) {
const {PGlite} = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
if (options.schemaPath) {
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(readFileSync(options.schemaPath, 'utf8'));
 await db.exec('set search_path = public; set row_security = on; set check_function_bodies = on;');
 await db.exec("insert into products(id,name,price,active,order_type) values ('dish','Dish',199.99,true,'normal'),('other','Other',100,true,'normal'),('bulk','Bulk',250,true,'bulk')");
 if(options.beforeMigrations) await options.beforeMigrations(db);
} else {
 await db.exec(readFileSync(new URL('./offline_order_fixture.sql', import.meta.url), 'utf8'));
}
await db.exec(readFileSync(new URL('../supabase/migrations/20260920000100_coupon_validation.sql', import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20260920000200_atomic_orders.sql', import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20260929000100_menu_cart_validation.sql', import.meta.url),'utf8'));
await db.exec(`insert into coupon_product_categories values ('dish','noodles'),('other','rice');`);
async function quote(code, cart=[{id: 'dish', qty: 2}], type='normal', customer='9123456780') {
  return (await db.query('select quote_coupon($1,$2,$3,$4::jsonb) as q',[code,type,customer,JSON.stringify(cart)])).rows[0].q;
}
let rateAllowed=true;
const client={
 async rpc(name,args) {
  if(name==='validate_menu_cart') {
   try{return {data:(await db.query('select validate_menu_cart($1,$2::jsonb) q',[args.p_type,JSON.stringify(args.p_items)])).rows[0].q};}catch(error){return {error:{code:error.code}};}
  }
  if(name==='consume_security_rate_limit')return {data:rateAllowed};
  if (name==='quote_delivery_fee') {
   try{return {data:(await db.query('select quote_delivery_fee($1,$2) q',[args.p_type,args.p_net])).rows[0].q};}catch(error){return {error:{code:error.code}};}
  }
  if (name==='lookup_order_request' || name==='create_order_atomic') {
   try {
    const values=[args.p_key,JSON.stringify(args.p_request)];
    if(name==='create_order_atomic')values.push(JSON.stringify(args.p_order),JSON.stringify(args.p_items));
    return {data:(await db.query(`select ${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as result`,values)).rows[0].result};
   } catch(error) { return {error:{code:error.code}}; }
  }
  assert.equal(name,'quote_coupon');
  try{return {data:await quote(args.p_code,args.p_items,args.p_type,args.p_phone)};}
  catch(error){return {error:{code:error.code}};}
 },
 from(table) {
  assert.ok(['products','customers','normal_orders','bulk_orders','normal_order_items','bulk_order_items'].includes(table));
  let action='select',body, filters=[],ids;
  const execute=async()=>{
   try {
    if(action==='upsert')return {data:(await db.query('insert into customers(phone,name) values ($1,$2) on conflict(phone) do update set name=excluded.name returning id',[body.phone,body.name])).rows[0]};
    if(action==='insert'){
     let result;
     for(const row of Array.isArray(body)?body:[body]){
      const keys=Object.keys(row); assert.ok(keys.every(k=>/^[a-z_]+$/.test(k)));
      result=await db.query(`insert into ${table}(${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(row).map(v=>typeof v==='object'&&v!==null?JSON.stringify(v):v));
     }
     return {data:result.rows[0]};
    }
    const values=[],where=[];
    for(const [key,value]of filters){values.push(value);where.push(`${key}=$${values.length}`);}
    if(ids){values.push(ids);where.push(`id=any($${values.length}::text[])`);}
    const rows=(await db.query(`${action==='delete'?'delete from':'select * from'} ${table}${where.length?' where '+where.join(' and '):''}`,values)).rows;
    return {data:table==='products'?rows:rows[0]??null};
   }catch(error){return {error:{code:error.code}};}
  };
  const q={select(){return q;},eq(k,v){assert.match(k,/^[a-z_]+$/);filters.push([k,v]);return q;},in(k,v){assert.equal(k,'id');ids=v;return q;},insert(v){action='insert';body=v;return q;},upsert(v){action='upsert';body=v;return q;},delete(){action='delete';return q;},single:execute,maybeSingle:execute,then(resolve,reject){return execute().then(resolve,reject);}};
  return q;
 }
};
function handler(name){
 let fn;
 const code=stripTypeScriptTypes(readFileSync(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8').replace(/^import .*createClient.*;$/m,''));
 runInNewContext(code,{createClient:()=>client,Deno:{env:{get:()=> 'offline'},serve:h=>{fn=h;}},Request,Response,TextEncoder,TextDecoder,crypto,console:{error(){},warn(){}}});
 return async(payload,options={})=>{
  const response=await fn(new Request('https://offline.invalid',{method:options.method??'POST',headers:options.headers??{'content-type':'application/json'},...(options.method==='GET'||options.method==='OPTIONS'?{}:{body:options.raw??JSON.stringify(payload)})}));
  return {status:response.status,body:await response.json().catch(()=>null),headers:response.headers};
 };
}
return {db, handler, quote, setRateAllowed(value) {rateAllowed=value;}};
}
