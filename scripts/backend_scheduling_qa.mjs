import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source = stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/place-order/index.ts', import.meta.url), 'utf8').replace(/^import .*createClient.*;$/m, ''));
let instant = '2026-09-23T10:30:00Z', saved = null, lookupError = null, writes = 0, fn;
class Clock extends Date { constructor(...args) {super(...(args.length ? args : [instant]));} }
const client = {async rpc(name) {
 if(name==='validate_menu_cart') return {data:true};
 if(name === 'consume_security_rate_limit') return {data:true};
 if(name === 'lookup_order_request') return {data:saved, error:lookupError};
 throw Error('Unexpected RPC');
}, from() {writes++; throw Error('Past schedule gate');}};
const ctx = vm.createContext({Date:Clock, createClient:()=>client, Deno:{env:{get:()=> 'offline'},serve:h=>fn=h}, Request,Response,TextEncoder,crypto,console:{error(){},warn(){}}});
vm.runInContext(source,ctx);
const cases = [
 ['ASAP (35–50 min)','2026-09-23T10:29:59Z',false],
 ['ASAP (35–50 min)','2026-09-23T10:30:00Z',true],
 ['ASAP (35–50 min)','2026-09-23T18:29:59Z',true],
 ['ASAP (35–50 min)','2026-09-23T18:30:00Z',false],
 ['4:00 pm – 4:30 pm (2026-09-23)','2026-09-23T10:30:00Z',true],
 ['4:00 pm – 4:30 pm (2026-09-23)','2026-09-23T10:30:01Z',false],
 ['11:30 pm – 12:00 am (2026-09-24)','2026-09-23T10:30:00Z',true],
 ['4:00 pm – 4:30 pm (2027-01-01)','2026-12-31T18:30:00Z',true],
];
for(const slot of ['Tomorrow 6 PM','4:00 pm – 4:30 pm (Tomorrow)','3:30 pm – 4:00 pm (2026-09-24)','4:15 pm – 4:45 pm (2026-09-24)','4:00 pm – 5:00 pm (2026-09-24)','12:00 am – 12:30 am (2026-09-24)','13:00 pm – 1:30 pm (2026-09-24)','4:00 pm – 4:30 pm (2026-09-25)','4:00 pm – 4:30 pm (2026-02-30)','4:00 pm – 4:30 pm (2026-09-22)']) cases.push([slot,'2026-09-23T10:30:00Z',false]);
const payload=slot=>({type:'normal',idempotency_key:'12345678-1234-4123-8123-123456789012',name:'Schedule QA',phone:'9123456780',address:'Synthetic address apartment 12 test',pincode:'411057',items:[{id:'dish',qty:1}],payment_method:'upi',delivery_slot:slot});
async function call(slot){return fn(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload(slot))}));}
for (const [slot,time,expected] of cases) {
 instant=time;ctx.slot=slot;
 assert.equal(vm.runInContext('validNormalSchedule(slot)',ctx),expected,slot);
 writes=0;const response=await call(slot);
 if(!expected){assert.equal(response.status,400);assert.equal(writes,0);assert.match((await response.json()).message,/slot is unavailable/);}
 else assert.equal(writes,1, 'valid schedule reaches pricing');
}
instant='2026-09-26T00:00:00Z';saved={success:true,order_number:'CBD-2026-000001'};
const old='4:00 pm – 4:30 pm (2026-09-23)';writes=0;
assert.deepEqual(await (await call(old)).json(),saved);assert.equal(writes,0);
saved=null;lookupError={code:'P0002'};assert.equal((await call(old)).status,409);
console.log(`PASS ${cases.length} normal schedule cases through actual handler; invalid slots make no product/order writes.`);
console.log('PASS expired saved retry returns original order; changed retry returns 409. No live API used.');
const html=readFileSync(new URL('../menu.html',import.meta.url),'utf8');
vm.runInContext('const OPEN_HOUR=16;\n'+html.slice(html.indexOf('  function getBusinessWindow('),html.indexOf('  function renderSlotNowWrap(')),ctx);
instant='2026-09-23T10:45:00Z';
for(const offset of [0,1]) {
 ctx.offset=offset;
 const labels=vm.runInContext('generateSlots(offset).map(s => `${s.label} (${new Date(s.start.getTime()+330*60000).toISOString().slice(0,10)})`)',ctx);
 for(const label of labels){ctx.slot=label;assert.equal(vm.runInContext('validNormalSchedule(slot)',ctx),true,label);}
}
assert.ok(html.includes('data-slot="${s.label} (${dayLabel})"'));
assert.ok(html.includes('getBusinessWindow(activeDayOffset).open.getTime() + 330 * 60000'));
console.log('PASS generated browser slots match backend dated-slot contract.');
