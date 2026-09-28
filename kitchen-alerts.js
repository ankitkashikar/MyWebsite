// Pure alert presentation: counts come from the authorized server, not the visible page.
export function kitchenAttention(summary,now=Date.now()) {
 const groups=summary?.groups;
 if(!Array.isArray(groups)||groups.length!==2)throw new Error('Kitchen alert status unavailable.');
 for(const type of ['normal','bulk'])if(groups.filter(g=>g.order_type===type&&Number.isInteger(g.count)&&g.count>=0).length!==1)throw new Error('Invalid kitchen alert counts.');
 const normal=groups.find(g=>g.order_type==='normal').count,bulk=groups.find(g=>g.order_type==='bulk').count;
 const dates=groups.filter(g=>g.count>0).map(g=>Date.parse(g.oldest_at));
 if(dates.some(d=>!Number.isFinite(d)))throw new Error('Invalid kitchen alert time.');
 const minutes=dates.length?Math.max(0,Math.floor((now-Math.min(...dates))/60000)):0;
 return {total:normal+bulk,normal,bulk,minutes,overdue:dates.length>0&&minutes>=5};
}
