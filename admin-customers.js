// Customer data is rendered as text and never persisted in browser storage.
export function createCustomers(api) {
 const $=id=>document.getElementById(id);
 let generation=0,listRequest=0,detailRequest=0,search='',cursor=null,next=null,previous=[],selected=null,offset=0;
 const time=value=>value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST':'No orders yet';
 const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
 const paragraph=(parent,text)=>parent.append(el('p',text));
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.className='btn-logout';b.addEventListener('click',fn);return b;};
 function reset(){
  generation++;listRequest++;detailRequest++;previous=[];cursor=next=selected=null;offset=0;search='';
  $('customerSearch').value='';$('customerList').replaceChildren();$('customerProfile').replaceChildren();$('customerOrders').replaceChildren();
  $('customerDetail').hidden=true;$('customerMessage').textContent='';$('customerDetailMessage').textContent='';
  $('customerNext').disabled=true;$('customerPrevious').disabled=true;
 }
 async function load(){
  const g=generation,r=++listRequest;
  $('customerList').replaceChildren();$('customerMessage').textContent='Loading customers…';
  $('customerNext').disabled=$('customerPrevious').disabled=true;
  try {
   const data=await api({action:'customers_list',search,after_id:cursor});
   if(g!==generation||r!==listRequest)return;
   next=data.next_id;
   for(const c of data.customers){
    const card=el('article','');card.className='customer-card';
    card.append(el('h3',c.name||'Unnamed customer'));
    paragraph(card,c.phone);paragraph(card,`${Number(c.normal_orders)+Number(c.bulk_orders)} website orders · ${c.normal_orders} normal · ${c.bulk_orders} bulk`);
    paragraph(card,'Latest order: '+time(c.last_order_at));
    card.append(button('View customer',()=>{selected=c.id;offset=0;detail();}));$('customerList').append(card);
   }
   $('customerMessage').textContent=data.customers.length?`${data.customers.length} customers on this page.`:'No customers match this search.';
   $('customerNext').disabled=!next;$('customerPrevious').disabled=!previous.length;
  }catch(e){if(g===generation&&r===listRequest){$('customerMessage').textContent=e.message;$('customerPrevious').disabled=!previous.length;}}
 }
 async function detail(){
  const g=generation,r=++detailRequest,id=selected;
  $('customerDetail').hidden=false;$('customerProfile').replaceChildren();$('customerOrders').replaceChildren();
  $('customerDetailMessage').textContent='Loading customer history…';
  $('customerOrdersPrevious').disabled=$('customerOrdersNext').disabled=true;
  try {
   const d=await api({action:'customer_detail',customer_id:id,offset});
   if(g!==generation||r!==detailRequest)return;
   const profile=$('customerProfile'),s=d.summary;
   profile.append(el('h3',d.customer.name||'Unnamed customer'));paragraph(profile,d.customer.phone);
   paragraph(profile,`${s.total_orders} website orders · ${s.normal_orders} normal · ${s.bulk_orders} bulk · ${s.cancelled_or_rejected} cancelled/rejected`);
   profile.append(el('h4','Recorded delivery addresses'));
   if(!d.addresses.length)paragraph(profile,'No delivery addresses recorded.');
   for(const a of d.addresses)paragraph(profile,a.address+' — last used '+time(a.last_used));
   if(d.addresses.length===10)paragraph(profile,'Showing the 10 most recently used addresses. Older addresses remain in order history.');
   profile.append(el('h4','Favourite items'));
   paragraph(profile,`Top items by quantity across ${s.preference_orders} orders, excluding cancelled/rejected orders. Includes orders still in progress.`);
   if(!d.favourites.length)paragraph(profile,'No item history available.');
   for(const f of d.favourites)paragraph(profile,`${f.product_name} (${f.order_type}) — ${f.quantity} ordered`);
   profile.append(el('h4','Common ordering times · IST'));
   paragraph(profile,'Based on when orders were placed, not scheduled delivery. Cancelled/rejected orders excluded.');
   if(!d.hours.length)paragraph(profile,'No ordering-time history available.');
   for(const h of d.hours)paragraph(profile,`${String(h.hour).padStart(2,'0')}:00–${String(h.hour).padStart(2,'0')}:59 — ${h.orders} orders`);
   if(Number(s.preference_orders)<3)paragraph(profile,'Limited history: these counts do not yet indicate a reliable preference.');
   for(const o of d.orders){
    const card=el('article','');card.className='customer-card';
    card.append(el('h4',`${o.order_number||o.id} · ${o.order_type}`));
    paragraph(card,time(o.created_at));paragraph(card,`${o.order_status} · payment ${o.payment_status} · ₹${Number(o.total).toFixed(2)}`);
    paragraph(card,`${o.name} · ${o.phone}`);paragraph(card,o.address);
    for(const i of o.items)paragraph(card,`${i.quantity} × ${i.name}`);
    if(!o.items.length)paragraph(card,'No item details recorded.');
    $('customerOrders').append(card);
   }
   $('customerDetailMessage').textContent=d.orders.length?`Orders ${offset+1}–${offset+d.orders.length} of ${s.total_orders}.`:'No website orders yet.';
   $('customerOrdersPrevious').disabled=offset===0;$('customerOrdersNext').disabled=d.next_offset==null;
   $('customerOrdersNext').onclick=()=>{offset=d.next_offset;detail();};
  }catch(e){if(g===generation&&r===detailRequest)$('customerDetailMessage').textContent=e.message;}
 }
 $('customerSearchForm').addEventListener('submit',e=>{e.preventDefault();search=$('customerSearch').value.trim();cursor=null;previous=[];load();});
 $('customerNext').addEventListener('click',()=>{if(next){previous.push(cursor);cursor=next;load();}});
 $('customerPrevious').addEventListener('click',()=>{if(previous.length){cursor=previous.pop();load();}});
 $('customerOrdersPrevious').addEventListener('click',()=>{offset=Math.max(0,offset-20);detail();});
 $('customerClose').addEventListener('click',()=>{detailRequest++;selected=null;$('customerDetail').hidden=true;$('customerProfile').replaceChildren();$('customerOrders').replaceChildren();});
 reset();return {reset,load};
}
