import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
let checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
for(const endpoint of ['place-order','order-status','admin-orders','validate-coupon']){
 await test(endpoint+': isolated support references and allowlisted logs',async()=>{
  let serve;const logs=[];
  const source=readFileSync(new URL('../supabase/functions/'+endpoint+'/index.ts',import.meta.url),'utf8').replace(/^import .*createClient.*;$/m,'');
  vm.runInNewContext(stripTypeScriptTypes(source),{Deno:{serve:f=>serve=f,env:{get:()=>undefined}},crypto,Response,TextEncoder,console:{warn:x=>logs.push(JSON.parse(x)),error:()=>assert.fail('Raw error logger used')}});
  const responses=await Promise.all([1,2].map(()=>serve(new Request('https://offline.invalid/?phone=PRIVATE',{method:'GET',headers:{authorization:'SECRET','x-request-id':'ATTACKER'}}))));
  const bodies=await Promise.all(responses.map(r=>r.json()));
  assert.notEqual(bodies[0].reference,bodies[1].reference);
  for(let i=0;i<2;i++){
   assert.equal(responses[i].status,405);assert.equal(logs[i].reference,bodies[i].reference);
   assert.deepEqual(Object.keys(logs[i]).sort(),['duration_ms','endpoint','event','reference','status']);
   assert.match(bodies[i].message,new RegExp(bodies[i].reference));
  }
  assert.doesNotMatch(JSON.stringify(logs),/PRIVATE|SECRET|ATTACKER/);
  logs.length=0;await serve(new Request('https://offline.invalid',{method:'OPTIONS'}));assert.equal(logs.length,0);
  assert.doesNotMatch(source,/console\.error\(/);
 });
}
const src=readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');
let respond,requests=[];const ctx=vm.createContext({window:{},AbortSignal,crypto,fetch:async(url,options)=>{requests.push(options);return respond();}});vm.runInContext(src,ctx);
await test('checkout timeout preserves request key and explains uncertain order outcome',async()=>{
 respond=()=>{throw new Error('PRIVATE SECRET');};ctx.payload={idempotency_key:'same-key'};
 const a=await vm.runInContext('submitOrder(payload)',ctx);const b=await vm.runInContext('submitOrder(payload)',ctx);
 assert.equal(a.success,false);assert.match(a.message,/could not confirm whether/);assert.doesNotMatch(a.message,/PRIVATE|SECRET/);
 assert.equal(requests[0].body,requests[1].body);assert.ok(requests.every(r=>r.signal));
});
await test('server errors hide raw proxy details and retain valid support reference',async()=>{
 respond=()=>({ok:false,status:503,json:async()=>({message:'PRIVATE SECRET',reference:'12345678-1234-1234-1234-123456789abc'})});
 const r=await vm.runInContext('submitOrder({})',ctx);assert.match(r.message,/12345678-1234/);assert.doesNotMatch(r.message,/PRIVATE|SECRET/);
});
await test('rate limit uses clear wait message; malformed proxy response remains safe',async()=>{
 respond=()=>({ok:false,status:429,json:async()=>({})});assert.match((await vm.runInContext('lookupTCBOrderStatus("x","y")',ctx)).message,/10 minutes/);
 respond=()=>({ok:false,status:502,json:async()=>{throw Error('PRIVATE');}});assert.equal((await vm.runInContext('validateTCBCoupon({})',ctx)).valid,false);
 assert.ok(requests.at(-1).signal);
});
console.log(`${checks} error-monitoring checks passed. Mock API/runtime; local Supabase acceptance pending.`);
