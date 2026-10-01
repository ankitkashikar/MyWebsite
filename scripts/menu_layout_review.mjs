// Visual review only: local files; external requests (including APIs) blocked.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'.menu-layout-review');
mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,'.'+decodeURIComponent(pathname));
 if(!file.startsWith(root+sep)||!['.html','.js','.css','.png','.svg','.jpg','.webp'].includes(extname(file)))throw Error('Unsupported path');
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;let browser;
const results=[];
try{
 browser=await chromium.launch({headless:true});
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  for(const file of readdirSync(root).filter(name=>name.endsWith('.html'))){
   await page.goto(origin+'/'+file,{waitUntil:'load'});
   assert.equal(await page.locator('link[href="brand-logo.css?v=1"]').count(),1,`${file}: shared logo styles`);
   assert.equal(await page.locator('.legal-brand-copy').count(),0,`${file}: duplicate policy branding`);
   const footer=page.locator('footer');
   if(await footer.count()){
    assert.equal(await footer.locator('.footer-brand-social svg').count(),2,`${file}: both social icons`);
    for(const link of await footer.locator('.footer-brand-social').all()){
     assert.ok(await link.getAttribute('aria-label'),`${file}: accessible social label`);
     const box=await link.boundingBox();assert.ok(box&&box.width>=44&&box.height>=44,`${file}: social tap target`);
    }
    if(await footer.locator('.footer-main').count()){
     const spacing=await footer.locator('.footer-main').evaluate(el=>{const cs=getComputedStyle(el);const headings=[...el.querySelectorAll('.fcol-title')];return {padding:parseFloat(cs.paddingTop),tops:headings.map(h=>h.getBoundingClientRect().top),gaps:headings.map(h=>parseFloat(getComputedStyle(h).marginBottom))};});
     assert.ok(spacing.padding>=28&&spacing.padding<=42,`${file}: balanced footer padding`);
     assert.ok(spacing.gaps.every(g=>g>=12&&g<=16),`${file}: consistent heading spacing`);
     for(const heading of await footer.locator('.fcol-title').all()){
      const line=await heading.evaluate(el=>{const s=getComputedStyle(el,'::after');return {content:s.content,width:parseFloat(s.width),height:parseFloat(s.height)};});
      assert.ok(line.content!=='none'&&line.width===26&&line.height===2,`${file}: footer heading underline visible`);
     }

     if(width===1280)assert.ok(Math.max(...spacing.tops)-Math.min(...spacing.tops)<2,`${file}: aligned footer headings`);
     await footer.screenshot({path:resolve(out,`footer-${file.replace('.html','')}-${width}.png`)});
    }
    const addressCount=((await footer.innerText()).match(/Shop No A1/g)||[]).length;
    assert.equal(addressCount,await footer.locator('.footer-main').count()?1:0,`${file}: single contact address`);
    const generated=await footer.evaluate(el=>[...el.querySelectorAll('*')].flatMap(x=>['::before','::after'].map(p=>getComputedStyle(x,p).content)).join(' '));
    assert.ok(!generated.includes('Shop No A1'),`${file}: no CSS-generated address`);
    if(file==='index.html')assert.ok((await footer.innerText()).includes('21525083001763'),'FSSAI details remain visible');
   }
   const logos=page.locator('img.site-brand-logo:visible');
   assert.ok(await logos.count()>0,`${file}: visible logo`);
   for(const logo of await logos.all()){
    await logo.evaluate(el=>el.decode());
    const actual=await logo.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,background:s.backgroundColor,radius:s.borderRadius,src:el.getAttribute('src'),footer:!!el.closest('.footer-logo-row')};});
    const size=actual.footer?42:width<=768?50:60;
    assert.equal(actual.src,'images/chinese logo.png',`${file}: homepage asset`);
    // Browser layout can return fractional pixels even for explicit CSS sizes.
    for(const dimension of ['width','height']){
     assert.ok(Math.abs(actual[dimension]-size)<=0.5,`${file}: logo ${dimension}: expected ${size}px ±0.5px, received ${actual[dimension]}px`);
    }
    assert.equal(actual.background,'rgba(0, 0, 0, 0)',`${file}: transparent logo background`);
    assert.equal(actual.radius,'50%',`${file}: round logo`);
   }
  }
  errors.length=0; // Auth/API pages above deliberately have their network calls blocked.
  console.log(`PASS ${width}px: consistent homepage logo across all 14 pages.`);
  await page.goto(origin+'/our-story.html',{waitUntil:'load'});
  await page.locator('.story-food-frame img').evaluate(el=>el.decode());
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Our Story horizontal overflow');
  assert.deepEqual(await page.locator('.story-person h3').allTextContents(),['Ankit','Atul']);
  assert.equal(await page.locator('.story-chapter-copy a').getAttribute('href'),'delivery-policy.html');
  await page.screenshot({path:resolve(out,`our-story-${width}.png`),fullPage:true});
  await page.locator('a[href="#meet-founders"]').click();
  assert.ok(page.url().endsWith('#meet-founders'));
  await page.emulateMedia({reducedMotion:'no-preference'});
  console.log(`PASS ${width}px: Our Story image, founders, delivery link and responsive bounds.`);
  await page.goto(origin+'/delivery-policy.html',{waitUntil:'load'});
  const policyText=await page.locator('body').innerText();assert.ok(policyText.includes('4:00 PM to 12:00 AM'));assert.ok(!policyText.toLowerCase().includes('midnight'));assert.ok(!policyText.includes(';'));assert.ok(!policyText.includes('Asia/Kolkata'));assert.ok(!policyText.includes('Order Status page'));
  await page.goto(origin+'/index.html',{waitUntil:'load'});
  const explore=page.locator('.favorites-section');await explore.scrollIntoViewIfNeeded();
  assert.equal(await explore.locator('.explore-dish').count(),3);
  for(const title of await explore.locator('.fav-name').all()){
   assert.equal(await title.evaluate(el=>getComputedStyle(el).fontFamily),await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily),'Explore dish titles use the menu/body font');
  }

  for(const img of await explore.locator('img').all())await img.evaluate(el=>el.decode());
  for(const card of await explore.locator('.explore-dish').all()){await card.scrollIntoViewIfNeeded();await page.waitForFunction(el=>Number(getComputedStyle(el).opacity)===1,await card.elementHandle());}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Homepage horizontal overflow');
  assert.equal((await page.request.get(origin+'/favicon.svg')).status(),200);
  for(const card of await explore.locator('.explore-dish').all()){
   const bounds=await card.evaluate(el=>{const r=el.getBoundingClientRect(),img=el.querySelector('img').getBoundingClientRect();return {height:r.height,width:r.width,imgHeight:img.height,imgWidth:img.width};});
   assert.ok(bounds.imgHeight<=bounds.imgWidth*.75+2,`Unexpected tall image: ${JSON.stringify(bounds)}`);
   assert.ok(bounds.height<bounds.width*.75+260,`Unexpected tall card: ${JSON.stringify(bounds)}`);
  }
  await page.locator('.home-track-button').click();assert.ok(page.url().endsWith('/order-status.html'));
  await page.goto(origin+'/index.html',{waitUntil:'load'});
  for(const card of await explore.locator('.explore-dish').all()){await card.scrollIntoViewIfNeeded();await page.waitForFunction(el=>Number(getComputedStyle(el).opacity)===1,await card.elementHandle());}

  await explore.screenshot({path:resolve(out,`homepage-explore-${width}.png`)});
  console.log(`PASS ${width}px: Delivery Policy wording, original homepage photos and favicon asset.`);
  await page.goto(origin+'/menu.html',{waitUntil:'load'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${width}: horizontal overflow`);
  assert.equal(await page.locator('.menu-photo-note').count(),1);assert.equal(await page.locator('figcaption').count(),0);
  const cards=page.locator('.menu-row');assert.equal(await cards.count(),75);
  for(let i=0;i<await cards.count();i++){
   const row=cards.nth(i);await row.scrollIntoViewIfNeeded();
   const img=row.locator('.menu-dish-photo img');
   if(await img.count())await img.evaluate(el=>el.decode());
   const bad=await row.evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.menu-dish-photo,.qty-stepper,.menu-row-name,.menu-card-footer')].some(x=>{const b=x.getBoundingClientRect();return b.width>0&&(b.left<r.left-1||b.right>r.right+1);});});
   assert.equal(bad,false,`${width}: card ${i+1} content escapes card`);
  }
  await page.locator('.menu-category').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(out,`menu-${width}.png`)});
  await page.locator('.qty-plus').first().click();
  await page.locator('.inline-addons').first().waitFor({state:'visible'});
  await page.locator('.inline-addons input').first().check();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:resolve(out,`menu-addons-${width}.png`)});
  const search=page.locator('input[type="search"],#menuSearch').first();
  await search.fill('Chicken Fried Rice');
  const shown=await page.locator('.menu-row:visible .menu-row-name').allTextContents();
  const unexpected=shown.filter(x=>!x.toLowerCase().includes('chicken fried rice'));
  assert.ok(shown.length>0&&unexpected.length===0,`${width}: Search must hide non-matches. Visible: ${JSON.stringify(shown)}`);
  assert.equal(await page.locator('.menu-row[hidden]:visible').count(),0,'Hidden cards, including combos, must not remain visible');
  await search.fill('zzzz-no-such-dish');assert.equal(await page.locator('.menu-row:visible').count(),0);
  assert.deepEqual(errors,[]);results.push(`PASS ${width}px: images load; cards fit; inline add-ons; search filtering; one photo note.`);console.log(results.at(-1));await page.close();
 }
 writeFileSync(resolve(out,'results.txt'),results.join('\n')+'\nExternal requests blocked; remote fonts may use local fallbacks. Visual screenshots require owner review.\n');
 console.log('Screenshots: '+out);console.log('No backend calls or orders submitted.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
