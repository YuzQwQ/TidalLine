/* Integration checks for the shared out-of-raid shell and existing business adapters. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/safehouse-v2');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,b)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});
(async()=>{let browser;const results=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));try{browser=await chromium.launch({channel:'msedge',headless:true});const origin='http://127.0.0.1:'+server.address().port;
 for(const file of ['index.html','潮汐线.html']){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url());});
  await page.goto(origin+'/'+encodeURIComponent(file)+'#base');await page.waitForFunction(()=>typeof Safehouse!=='undefined'&&Safehouse.root&&Game.state==='base');
  await page.waitForFunction(()=>document.querySelector('.sh-room-img').complete&&document.querySelector('.sh-room-img').naturalWidth>0);
  assert.equal(await page.locator('.sh-top nav button').count(),6);assert.equal(await page.locator('.sh-top [data-sh="loadout"]').count(),0);assert.equal(await page.locator('.sh-status-card').count(),3);
  assert.equal(await page.locator('.sh-primary-actions button').count(),2);
  assert(await page.evaluate(()=>Safehouse.timer!==null));
  const initial=await page.evaluate(()=>JSON.stringify({credits:Save.credits,hp:Save.hp,stash:Save.stash,bag:Save.bag}));
  await page.locator('.sh-top [data-sh="tasks"]').click();assert(await page.locator('.sh-dialog').isVisible());assert((await page.locator('.sh-dialog').innerText()).includes('尚未开放'));await page.keyboard.press('Escape');
  await page.locator('.sh-facility[data-sh="workshop"]').click();assert(await page.locator('.sh-dialog').isVisible());await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>JSON.stringify({credits:Save.credits,hp:Save.hp,stash:Save.stash,bag:Save.bag})),initial);
  const before=await page.locator('[data-sh-broadcast]').textContent();await page.locator('[data-radio="1"]').click();assert.notEqual(await page.locator('[data-sh-broadcast]').textContent(),before);await page.locator('[data-radio="pause"]').click();assert(await page.evaluate(()=>Safehouse.timer===null));
  await page.screenshot({path:path.join(out,file==='index.html'?'game-overview.png':'offline-overview.png')});
  await page.locator('.sh-prepare').click();assert(await page.locator('#baseGear').isVisible());assert.equal(await page.locator('#baseGear .slot').count(),7);assert(await page.evaluate(()=>Safehouse.timer===null));
  await page.evaluate(()=>{Save.addStash('heal01',1);Save.hp=50;Base.render();});
  assert(await page.evaluate(()=>{const entry=Save.stash.find(e=>e.id==='heal01');const before=Save.bag.length;Base.toBag(entry);const moved=Save.bag.length===before+1;Base.toStash(Save.bag.find(e=>e.id==='heal01'));return moved&&Save.bag.length===before&&Save.stash.some(e=>e.id==='heal01');}));
  await page.locator('.sh-top [data-sh="stash"]').click();assert(await page.locator('#stashGrid').isVisible());assert(!(await page.locator('.base-left').isVisible()));
  await page.locator('.sh-top [data-sh="traders"]').click();assert(await page.locator('.mb-overview').isVisible());await page.locator('[data-mb-open="doctor"]').click();assert(await page.locator('#doctorService').isVisible());
  assert(await page.evaluate(()=>{const before=Save.credits;const q=Medical.quote();Base.treat(q.total);return Save.hp===100&&Save.credits===before-q.total;}));
  await page.evaluate(()=>MerchantUI.open('gun'));assert(await page.locator('#shopGrid [data-melee="melee01"]').isVisible());
  assert(await page.evaluate(()=>{Save.credits=1e7;const before=Save.credits,n=Save.stash.length;Base.buyGun('pistol');return Save.credits<before&&Save.stash.length>n;}));
  await page.screenshot({path:path.join(out,file==='index.html'?'game-trader.png':'offline-trader.png')});
  await page.locator('.sh-top [data-sh="archive"]').click();assert((await page.locator('.sh-dialog').innerText()).includes('收集图鉴'));await page.keyboard.press('Escape');
  for(const size of [{width:1280,height:720},{width:390,height:844}]){
   await page.setViewportSize(size);await page.locator('.sh-top nav [data-sh="home"]').click();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+file+' '+size.width);
   if(size.width===1280){for(const sel of ['.sh-prepare','.sh-deploy']){const b=await page.locator(sel).boundingBox();assert(b.y>=0&&b.y+b.height<=720,'action outside viewport');}}
   else{await page.screenshot({path:path.join(out,file==='index.html'?'game-mobile.png':'offline-mobile.png'),fullPage:true});for(const route of ['loadout','stash','traders']){await page.evaluate(route=>Safehouse.route(route),route);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' mobile overflow');}}
  }
  await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>Safehouse.route('home'));await page.locator('.sh-deploy').click();assert(await page.evaluate(()=>Game.state==='map-select'&&Safehouse.timer===null));assert(await page.locator('#mapChoices button').count()>=2);await page.locator('#btnMapBack').click();assert(await page.evaluate(()=>Game.state==='base'));
  await page.evaluate(()=>{for(let i=0;i<30;i++){Safehouse.route('stash');Safehouse.route('home');}Safehouse.paused=false;Safehouse.syncTimer();});assert(await page.evaluate(()=>Safehouse.timer!==null));
  await page.locator('.sh-deploy').click();await page.locator('#btnMapStart').click();assert(await page.evaluate(()=>Game.state==='playing'&&Safehouse.timer===null));
  assert.deepEqual(errors,[]);results.push({file,errors,realTransactions:true,viewports:[1440,1280,390],baseReturn:true,timerLifecycle:true});await page.close();
 }
 const offline=await browser.newPage();await offline.goto('file:///'+path.join(root,'潮汐线.html').replace(/\\/g,'/')+'#base');await offline.waitForFunction(()=>typeof Safehouse!=='undefined'&&Safehouse.root&&Game.state==='base');assert(await offline.locator('.sh-room-img').evaluate(img=>img.src.startsWith('data:image/webp')));assert.equal(await offline.locator('link[href="assets/ui/safehouse.css"]').count(),0);await offline.close();
 const demo=await browser.newPage({viewport:{width:1440,height:900}});await demo.goto(origin+'/design/ui/safehouse-v2/index.html');await demo.waitForFunction(()=>document.querySelector('.sh-room-img').complete&&document.querySelector('.sh-room-img').naturalWidth>0);await demo.screenshot({path:path.join(out,'preview.png')});assert.equal(await demo.evaluate(()=>localStorage.length),0);await demo.close();
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',results,demoIsolated:true},null,2));console.log('PASS: shared prototype, live/offline navigation, existing shop/treatment, 7 gear slots, planned module feedback, archive, mobile, map deployment, broadcast cleanup');
 }finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
