import {createCustomers} from './admin-customers.js';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = window.TCB_SUPABASE_CONFIG;
const client = createClient(cfg.url,cfg.anonKey);
const $ = id => document.getElementById(id);
let rules = [], busy = false, sessionEpoch=0;
const customers=createCustomers(api);
let initializing=true;
$('btnLogin').disabled=true;
async function api(body) {
  const {data:{session}} = await client.auth.getSession();
  if (!session) throw new Error('Sign in required.');
  const response = await fetch(cfg.url+'/functions/v1/admin-orders',{
    method:'POST',headers:{'content-type':'application/json',apikey:cfg.anonKey,authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if(response.status===401||response.status===403)hide();
  if (!response.ok || !data.success) throw new Error(data.message || 'Could not save settings.');
  return data;
}
function render() {
  const rule = rules.find(r=>r.order_type===$('deliveryType').value);
  const exists = rule && !rule.deleted;
  $('deliveryFee').value = exists ? (rule.fee_paise/100).toFixed(2) : '';
  $('deliveryFree').value = exists && rule.free_above_paise!==null ? (rule.free_above_paise/100).toFixed(2) : '';
  $('deliveryEnabled').checked = !!(exists && rule.enabled);
  $('deleteDelivery').disabled = !exists;
  $('deliveryState').textContent = !exists ? 'Not configured — checkout blocked' : rule.enabled ? 'Enabled' : 'Disabled — checkout blocked';
}
async function load() { const result=await api({action:'delivery_list'}); rules=result.rules; render(); }
function hide() {sessionEpoch++;customers.reset();$('dashboard').style.display='none';$('loginScreen').style.display='block';rules=[];coupons=[];editingCoupon=null;clearCoupon();$('couponListBody').replaceChildren();$('couponHistoryBody').replaceChildren();}
async function open() {const epoch=sessionEpoch;await load();if(epoch!==sessionEpoch)return;customers.load();loadCoupons().catch(e=>$('couponMessage').textContent=e.message);$('loginScreen').style.display='none';$('dashboard').style.display='block';}
$('btnLogin').addEventListener('click',async()=>{
  if(initializing)return;
  $('btnLogin').disabled=true;
  let authenticated=false;
  try {
    const {error}=await client.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});
    $('adminPassword').value='';if(error)throw error;authenticated=true;
    await open();$('loginError').classList.remove('visible');
  } catch(e) {hide();await client.auth.signOut();$('loginError').textContent=authenticated?'Admin settings could not load. '+(e.message||'Please retry.'):'Sign-in failed or this account is not authorized.';$('loginError').classList.add('visible');}
  finally {$('btnLogin').disabled=false;}
});
$('btnLogout').addEventListener('click',async()=>{hide();await client.auth.signOut();});
client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')hide();});
$('deliveryType').addEventListener('change',()=>{render();$('deliveryMessage').textContent='';});
function paise(text) {if(!/^\d{1,8}(\.\d{1,2})?$/.test(text))throw new Error('Use a non-negative amount with up to two decimal places.');return Math.round(Number(text)*100);}
async function change(remove=false) {
  if(busy)return;
  const type=$('deliveryType').value;
  if(remove && !confirm('Delete this rule? New checkout for this order type will be blocked.'))return;
  busy=true;
  const controls=[...$('deliveryForm').querySelectorAll('button,input,select')];controls.forEach(el=>el.disabled=true);
  try {
    const rule=rules.find(r=>r.order_type===type);
    await api({action:remove?'delivery_delete':'delivery_save',order_type:type,version:rule?.version||0,
      fee_paise:remove?null:paise($('deliveryFee').value),free_above_paise:remove||$('deliveryFree').value===''?null:paise($('deliveryFree').value),enabled:$('deliveryEnabled').checked});
    await load();$('deliveryMessage').textContent=remove?'Rule deleted. New checkout is blocked.':'Delivery rule saved.';
  } catch(e) {$('deliveryMessage').textContent=e.message;}
  finally {busy=false;controls.forEach(el=>el.disabled=false);$('deleteDelivery').disabled=!rules.some(r=>r.order_type===type&&!r.deleted);}
}
$('deliveryForm').addEventListener('submit',e=>{e.preventDefault();change();});
$('deleteDelivery').addEventListener('click',()=>change(true));
$('reloadDelivery').addEventListener('click',()=>load().catch(e=>$('deliveryMessage').textContent=e.message));


let coupons=[], editingCoupon=null, couponBusy=false, nextCoupon=null;
function clearCoupon() {
  editingCoupon=null;$('couponForm').reset();$('newCode').disabled=false;
  $('newMinOrder').value='0';$('btnAddCoupon').textContent='Create Coupon';$('couponRestrictions').textContent='';
}
function editCoupon(c) {
  if(couponBusy)return;
  editingCoupon=c;$('newCode').value=c.code;$('newCode').disabled=true;
  $('newType').value=c.kind;$('newValue').value=(c.value/100).toFixed(2);
  $('newMinOrder').value=(c.min_subtotal_paise/100).toFixed(2);$('newActive').checked=c.active;
  $('couponScope').value=c.order_type||'';$('couponCap').value=c.max_discount_paise===null?'':(c.max_discount_paise/100).toFixed(2);
  $('couponLimit').value=c.usage_limit??'';$('couponPhoneLimit').value=c.per_phone_limit??'';
  $('btnAddCoupon').textContent='Save Coupon';
  $('couponRestrictions').textContent='Existing restrictions (preserved): '+JSON.stringify({starts_at:c.starts_at,ends_at:c.ends_at,products:c.product_ids,categories:c.categories});
  $('couponForm').scrollIntoView({block:'start',behavior:'smooth'});
}
function renderCoupons() {
  $('couponListBody').replaceChildren();
  if(!coupons.length){$('couponListBody').textContent='No coupons configured.';return;}
  for(const c of coupons){
    const row=document.createElement('article');row.dataset.coupon=c.code;
    const label=document.createElement('p');label.textContent=`${c.code} — ${c.active?'Enabled':'Disabled'} — ${c.kind==='percent'?(c.value/100)+'%':'₹'+(c.value/100).toFixed(2)} off — ${c.order_type||'normal and bulk'}`;
    row.append(label);
    for(const [title,fn] of [['Edit',()=>editCoupon(c)],[c.active?'Disable':'Enable',()=>mutateCoupon('coupon_toggle',c,{active:!c.active})],['Delete',()=>{if(confirm('Delete '+c.code+'? This code cannot be reused; historical orders are preserved.'))mutateCoupon('coupon_delete',c,{});} ]]){
      const button=document.createElement('button');button.type='button';button.className='btn-logout';button.textContent=title;button.disabled=couponBusy;button.addEventListener('click',fn);row.append(button);
    }
    $('couponListBody').append(row);
  }
}
async function loadCoupons(more=false) {
  const result=await api({action:'coupon_list',after_code:more?nextCoupon:null});
  coupons=more?[...coupons,...result.coupons]:result.coupons;nextCoupon=result.next_code;
  $('couponMore').hidden=!nextCoupon;renderCoupons();
}
function optionalInt(id){const v=$(id).value;if(v==='')return null;if(!/^\d+$/.test(v)||Number(v)<1||Number(v)>2147483647)throw new Error('Usage limits must be positive whole numbers.');return Number(v);}
async function mutateCoupon(action,c,changes){
 if(couponBusy)return;couponBusy=true;
 const controls=[...$('couponForm').querySelectorAll('input,select,button'),$('couponReload'),$('couponMore')];controls.forEach(el=>el.disabled=true);renderCoupons();
 try {
  await api({action,code:c.code,version:c.version,changes});
  await loadCoupons();clearCoupon();$('couponMessage').textContent=action==='coupon_delete'?'Coupon deleted.':'Coupon saved.';
  $('couponHistoryBody').replaceChildren();
 }catch(e){$('couponMessage').textContent=e.message;}
 finally{couponBusy=false;controls.forEach(el=>el.disabled=false);$('newCode').disabled=!!editingCoupon;renderCoupons();}
}
$('couponForm').addEventListener('submit',e=>{
 e.preventDefault();if(couponBusy)return;
 try{
  const code=$('newCode').value.trim().toUpperCase();
  const value=paise($('newValue').value);if(value<=0||($('newType').value==='percent'&&value>10000))throw new Error('Enter a positive discount; percentages cannot exceed 100%.');
  mutateCoupon('coupon_save',editingCoupon||{code,version:0},{kind:$('newType').value,value,active:$('newActive').checked,
   min_subtotal_paise:paise($('newMinOrder').value),order_type:$('couponScope').value||null,
   max_discount_paise:$('couponCap').value===''?null:paise($('couponCap').value),usage_limit:optionalInt('couponLimit'),per_phone_limit:optionalInt('couponPhoneLimit')});
 }catch(e){$('couponMessage').textContent=e.message;}
});
$('couponCancel').addEventListener('click',clearCoupon);
$('couponReload').addEventListener('click',()=>{clearCoupon();loadCoupons().catch(e=>$('couponMessage').textContent=e.message);});
$('couponMore').addEventListener('click',()=>loadCoupons(true).catch(e=>$('couponMessage').textContent=e.message));
$('couponHistory').addEventListener('click',async()=>{
 try{
  const result=await api({action:'coupon_history'});$('couponHistoryBody').replaceChildren();
  if(!result.events.length)$('couponHistoryBody').textContent='No changes recorded.';
  for(const event of result.events){
   const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('pre');
   summary.textContent=`${event.code}: ${event.action} — ${new Date(event.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST`;
   body.textContent=JSON.stringify({admin:event.actor,before:event.before_coupon,after:event.after_coupon},null,2);details.append(summary,body);$('couponHistoryBody').append(details);
  }
 }catch(e){$('couponMessage').textContent=e.message;}
});
async function initializeAdmin(){
 try {const {data:{session}}=await client.auth.getSession();if(session)await open();else hide();}
 catch {hide();}
 finally {initializing=false;$('btnLogin').disabled=false;}
}
initializeAdmin();
