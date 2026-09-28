import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {parseHTML} from '../.migration-rehearsal/node_modules/linkedom/esm/index.js';
const html=readFileSync(new URL('../order-status.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
let checks=0;const test=async(label,f)=>{await f();checks++;console.log('PASS '+label);};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const {document,window}=parseHTML(html),timers=new Map(),storage=new Map();let clock=Date.parse('2026-09-25T18:45:00Z'),seq=0,calls=0,status='preparing',failure=null,pending=null,resolvePending;
 const order=()=>({order_number:'CBD-2026-000001',order_status:status,payment_status:'paid',created_at:'2026-09-25T18:45:00Z',total:100,items:[{product_name:'<img src=x>',quantity:1,line_total:100}],tracking_url:'https://example.com/private',delivery_provider:'Private rider company'});
 window.lookupTCBOrderStatus=async()=>{calls++;if(pending)return new Promise(r=>resolvePending=r);return failure||{success:true,order:order()};};
 class Clock extends Date {constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
 vm.runInNewContext(script,{document,window,Date:Clock,URLSearchParams,location:{search:''},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:(f,delay)=>{timers.set(++seq,{f,at:clock+delay});return seq;},clearTimeout:id=>timers.delete(id)});
 document.getElementById('trackOrderNumber').value='CBD-2026-000001';document.getElementById('trackPhone').value='9234567801';
 const submit=async()=>{document.getElementById('trackForm').dispatchEvent(new window.Event('submit',{cancelable:true}));await tick();};
 return {document,window,timers,submit,get calls(){return calls;},set status(s){status=s;},set failure(f){failure=f;},set pending(p){pending=p;},resolve:()=>resolvePending({success:true,order:order()}),async advance(ms){clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.f();await tick();}}};
}
await test('four-step timeline, no provider link, map or ETA',()=>{const f=fixture();assert.deepEqual([...f.document.querySelectorAll('.track-step-label')].map(n=>n.textContent),['Accepted','Preparing','Food is Ready','Dispatched']);assert.equal(f.document.getElementById('trackingLink'),null);assert.equal(f.document.getElementById('resultEta'),null);});
await test('internal statuses map to simple customer progress and safe exceptional messages',async()=>{for(const [status,label] of [['new','Awaiting Acceptance'],['accepted','Accepted'],['preparing','Preparing'],['ready_for_pickup','Food is Ready'],['rider_assigned','Food is Ready'],['dispatched','Dispatched'],['delivered','Dispatched'],['cancelled','Cancelled'],['rejected','Rejected']]){const f=fixture();f.status=status;await f.submit();assert.equal(f.document.getElementById('resultStatus').textContent,label);if(['new','cancelled','rejected'].includes(status))assert.equal(f.document.querySelectorAll('.track-step.complete,.track-step.current').length,0);}});
await test('IST timestamp and item escaping survive simplification',async()=>{const f=fixture();await f.submit();assert.match(f.document.getElementById('resultOrderMeta').textContent,/26 Sept/);assert.equal(f.document.querySelectorAll('#resultItems img').length,0);});
await test('two-minute polling stays below eight checks in each ten-minute window',async()=>{const f=fixture();await f.submit();for(let i=0;i<15;i++)await f.advance(120000);assert.equal(f.calls,16);});
await test('repeated submit clicks cannot accelerate polling',async()=>{const f=fixture();await f.submit();for(let i=0;i<20;i++)await f.submit();assert.equal(f.calls,1);await f.advance(120000);assert.equal(f.calls,2);});
await test('dispatch/rejection/cancellation stop automatic checks',async()=>{for(const status of ['dispatched','delivered','rejected','cancelled']){const f=fixture();f.status=status;await f.submit();assert.equal(f.timers.size,0);await f.advance(1200000);assert.equal(f.calls,1);}});
await test('silent failure pauses polling and marks displayed data stale',async()=>{const f=fixture();await f.submit();f.failure={success:false,message:'Unavailable'};await f.advance(120000);assert.equal(f.timers.size,0);assert.match(f.document.getElementById('refreshNote').textContent,/last successful check/);});
await test('429 pauses polling and blocks immediate manual retries',async()=>{const f=fixture();f.failure={success:false,httpStatus:429,message:'Please wait'};await f.submit();await f.advance(120000);await f.submit();assert.equal(f.calls,1);assert.equal(f.timers.size,0);});
await test('editing lookup details discards an in-flight old response',async()=>{const f=fixture();f.pending=true;await f.submit();f.document.getElementById('trackOrderNumber').value='CBD-2026-999999';f.document.getElementById('trackOrderNumber').dispatchEvent(new f.window.Event('input'));f.resolve();await tick();assert.equal(f.document.getElementById('trackResult').classList.contains('visible'),false);assert.equal(f.timers.size,0);});
await test('hidden tabs pause network polling and resume on the next visible interval',async()=>{
 const f=fixture();await f.submit();Object.defineProperty(f.document,'hidden',{value:true,configurable:true});
 for(let i=0;i<5;i++)await f.advance(120000);assert.equal(f.calls,1);
 Object.defineProperty(f.document,'hidden',{value:false,configurable:true});await f.advance(120000);assert.equal(f.calls,2);
});
await test('slow status request blocks overlapping manual and scheduled requests',async()=>{
 const f=fixture();f.pending=true;await f.submit();for(let i=0;i<5;i++){await f.submit();await f.advance(120000);}
 assert.equal(f.calls,1);f.resolve();await tick();assert.equal(f.timers.size,1);
});
let serve,allow=true;
const row={id:'1',order_number:'CBD-2026-000001',order_status:'preparing',payment_status:'paid',total:100,created_at:new Date().toISOString(),tracking_url:'https://example.com/private',delivery_provider:'Private',rider_phone:'9234567890',estimated_delivery_from:'private'};
const client={rpc:async()=>({data:allow}),from(table){let phone;const q={select(){return q;},eq(k,v){if(k==='phone')phone=v;return q;},maybeSingle:async()=>({data:phone==='9234567801'?row:null}),order:async()=>({data:[]})};return q;}};
const src=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/order-status/index.ts',import.meta.url),'utf8').replace(/^import .*createClient.*;$/m,''));
vm.runInNewContext(src,{createClient:()=>client,Deno:{env:{get:()=> 'offline'},serve:f=>serve=f},Response,TextEncoder,crypto,console});
const lookup=number=>serve(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_number:number,phone:'9234567801'})}));
await test('normal and bulk public responses omit delivery/rider details',async()=>{for(const number of ['CBD-2026-000001','BLK-2026-000001']){const r=await lookup(number);assert.equal(r.status,200);const d=await r.json();for(const key of ['tracking_url','delivery_provider','rider_phone','rider_name','estimated_delivery_from','estimated_delivery_to','rider_assigned_at'])assert.equal(d.order[key],undefined);}});
await test('server rate-limit protection remains fail-closed',async()=>{allow=false;assert.equal((await lookup('CBD-2026-000001')).status,429);});
console.log(`${checks} customer progress API/DOM checks passed. Simulated clock/API; real local acceptance pending.`);
