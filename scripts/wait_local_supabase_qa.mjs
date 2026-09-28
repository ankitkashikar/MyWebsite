import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const status=JSON.parse(readFileSync(new URL('../.local-supabase-qa/status.json',import.meta.url),'utf8'));
assert.equal(new URL(status.API_URL).origin,'http://127.0.0.1:55321');
let ready=false;
let lastStatus='no response';
for(let i=0;i<30;i++){
 try {
  const r=await fetch(status.API_URL+'/functions/v1/validate-coupon',{method:'GET',redirect:'error',headers:{'content-type':'application/json',authorization:'Bearer '+status.ANON_KEY,apikey:status.ANON_KEY},signal:AbortSignal.timeout(2000)});
  lastStatus=`HTTP ${r.status}`;
  const data=await r.json();if(r.status===405&&data.valid===false){ready=true;break;}
 }catch{}
 await new Promise(r=>setTimeout(r,1000));
}
if(!ready)throw Error(`Local readiness check failed (${lastStatus}). Inspect .local-supabase-qa/functions.log locally.`);
