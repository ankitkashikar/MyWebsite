import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from '../.migration-rehearsal/node_modules/linkedom/esm/index.js';
const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
const src=readFileSync(new URL('../admin-settings.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const tick=()=>new Promise(r=>setImmediate(r));
let checks=0;
for(const fail of [false,true]){
 const {document,window}=parseHTML(html);window.TCB_SUPABASE_CONFIG={url:'https://offline.invalid',anonKey:'anon'};
 document.getElementById('couponForm').reset=()=>{};
 let resolveInitial,session=null,initial=true,signins=0;
 const client={auth:{getSession:()=>{if(initial){initial=false;return new Promise(r=>resolveInitial=r);}return Promise.resolve({data:{session}});},onAuthStateChange(){},signInWithPassword:async()=>{signins++;session={access_token:'test'};return {};},signOut:async()=>{session=null;}}};
 vm.runInNewContext(src,{document,window,createClient:()=>client,createCustomers:()=>({reset(){},load(){}}),AbortSignal,fetch:async()=>({status:fail?503:200,ok:!fail,json:async()=>fail?{success:false,message:'Could not load delivery settings.'}:{success:true,rules:[],coupons:[],next_code:null}})});
 const button=document.getElementById('btnLogin');assert.equal(button.disabled,true);
 button.dispatchEvent(new window.Event('click'));await tick();assert.equal(signins,0);
 resolveInitial({data:{session:null}});await tick();assert.equal(button.disabled,false);
 button.dispatchEvent(new window.Event('click'));await tick();await tick();
 if(fail){assert.equal(document.getElementById('dashboard').style.display,'none');assert.match(document.getElementById('loginError').textContent,/Admin settings could not load.*Could not load delivery settings/);}
 else assert.equal(document.getElementById('dashboard').style.display,'block');
 checks++;console.log('PASS '+(fail?'settings failure is reported separately from authentication':'session initialization completes before interactive sign-in'));
}
console.log(`${checks} admin startup DOM checks passed. Mock Auth/API; laptop acceptance pending.`);
