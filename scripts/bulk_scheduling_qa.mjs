import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
let instant='2026-09-23T12:30:00Z', saved=null, lookupError=null, writes=0, handler;
class Clock extends Date {constructor(...args){super(...(args.length?args:[instant]));} static now(){return new Date(instant).getTime();}}
const client={async rpc(name){if(name==='consume_security_rate_limit')return {data:true};if(name==='lookup_order_request')return {data:saved,error:lookupError};throw Error(name);},from(){writes++;throw Error('Reached pricing');}};
const source=stripTypeScriptTypes(readFileSync('supabase/functions/place-order/index.ts','utf8').replace(/^import .*createClient.*;$/m,''));
const ctx=vm.createContext({Date:Clock,createClient:()=>client,Deno:{env:{get:()=> 'offline'},serve:h=>handler=h},Request,Response,TextEncoder,crypto,console:{error(){},warn(){}}});
vm.runInContext(source,ctx);
const cases=[
 ['2026-09-24T18:00',true],['2026-09-24T18:00:00+05:30',true],['2026-09-24T12:30:00.000Z',true],
 ['2026-09-24T17:59:59+05:30',false],['2026-09-24T12:29:59.999Z',false],['2026-09-24T18:01',true],
 ['2026-09-23T18:00',false],['2026-09-25T00:00',true],['2026-02-30T18:00',false],
 ['2026-13-01T18:00',false],['2026-09-25T24:00',false],['2026-09-25T18:60',false],
 ['2026-09-25T18:00:60Z',false],['tomorrow',false],['',false],[{},false],['2026-09-25',false],
 ['2026-09-25T18:00-07:00',false],
];
const body=date=>({type:'bulk',idempotency_key:'12345678-1234-4123-8123-123456789012',name:'Bulk QA',phone:'9123456780',address:'Synthetic address apartment 12 test',items:[{id:'dish',qty:1}],payment_method:'upi',delivery_datetime:date});
const call=date=>handler(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body(date))}));
for(const [value,valid] of cases){ctx.value=value;assert.equal(vm.runInContext('validBulkSchedule(value)',ctx),valid,JSON.stringify(value));writes=0;const r=await call(value);if(!valid){assert.equal(r.status,400);assert.equal(writes,0);}else assert.equal(writes,1);}
for(const [now,value] of [['2026-12-31T18:30:00Z','2027-01-02T00:00'],['2028-02-28T12:30:00Z','2028-02-29T18:00']]){instant=now;ctx.value=value;assert.equal(vm.runInContext('validBulkSchedule(value)',ctx),true);}
instant='2026-09-26T00:00:00Z';saved={success:true,order_number:'BLK-2026-000001'};writes=0;
assert.deepEqual(await (await call('2026-09-24T18:00')).json(),saved);assert.equal(writes,0);
saved=null;lookupError={code:'P0002'};assert.equal((await call('2026-09-24T18:00')).status,409);
console.log('PASS 18 bulk schedule cases, year/leap-day boundaries, saved retry and changed retry through actual handler.');
const html=readFileSync('bulk-order.html','utf8');
const code=html.slice(html.indexOf('// Offset-less browser'),html.indexOf('    function finalTotal()'));
const field={addEventListener(){}};
const browser=vm.createContext({Date:Clock,document:{getElementById:()=>field}});vm.runInContext(code,browser);
instant='2026-09-23T12:30:00Z';
for(const [value,valid] of cases){browser.value=value;assert.equal(vm.runInContext('validBulkSchedule(value)',browser),valid);}
instant='2026-09-23T18:29:30Z';vm.runInContext('refreshBulkDateMinimum()',browser);assert.equal(field.min,'2026-09-25T00:00');
console.log('PASS browser/server agreement and India midnight minimum; host timezone '+(process.env.TZ||'default'));
