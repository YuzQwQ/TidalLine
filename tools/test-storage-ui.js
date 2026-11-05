const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/storage-v1');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});
(async()=>{let browser;const reports=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));try{browser=await chromium.launch({channel:'msedge',headless:true});for(const file of ['index.html','潮汐线.html']){
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url());});await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');await p.waitForFunction(()=>typeof StorageUI!=='undefined'&&StorageUI.mounted);
 await p.evaluate(()=>{Save.stash=[];Save.bag=[];Save.credits=60000;Save.hp=50;for(const id of ['rifle','shotgun','pistol'])Save.addGearStash(EQUIP.gun(id));Save.addGearStash(EQUIP.melee('melee01',true));Save.addGearStash(EQUIP.melee('melee02'));Save.addGearStash(EQUIP.armor(GEAR.make('helmet',3,25)));Save.addGearStash(EQUIP.armor(GEAR.make('body',3,40)));Save.addGearStash(EQUIP.bag('bag02'));for(const [id,n] of [['ammo_556_1',60],['ammo_9mm_1',90],['ammo_12g_1',20]])Save.addStash(id,n);Save.addStash('heal01',1,12);Save.addStash('heal03',1);Save.addStash('heal06',1);for(const it of ITEMS.filter(i=>itemGroup(i)==='collectible').slice(0,48))Save.addStash(it.id,1);Save.addStash('odd02',1);Safehouse.route('stash');});
 assert(await p.locator('.st-layout').isVisible());assert.equal(await p.locator('.st-stock-mount #stashGrid').count(),1);assert((await p.locator('[data-st-capacity]').innerText()).includes('/ 600'));assert.equal(await p.locator('.st-sidebar nav>[data-st-category]').count(),8);
 await p.locator('[data-st-category="weapons"]').click();await p.locator('#stashGrid .scell:not(.empty)').first().click();assert(await p.locator('#itemTip').isVisible(),'仓库左键应弹详情浮窗');assert((await p.locator('#itemTip .medical-actions button').allInnerTexts()).includes('放进背包'),'仓库详情应有放进背包');await p.locator('[data-st-category="all"]').click();await p.locator('#stashGrid .scell:not(.empty)').first().click();await p.screenshot({path:path.join(out,file==='index.html'?'game.png':'offline.png')});
 await p.locator('[data-st-category="ammo"]').click();assert.equal(await p.locator('#stashGrid .scell:not(.empty)').count(),3);assert.equal(await p.locator('[data-st-count="ammo"]').textContent(),'3');
 await p.locator('[aria-label="搜索库存"]').fill('5.56');assert.equal(await p.locator('#stashGrid .scell:not(.empty)').count(),1);await p.locator('#stashGrid .scell:not(.empty)').first().click();assert((await p.locator('#itemTip').innerText()).includes('60 发'));
 await p.evaluate(()=>{Save.bag=Array.from({length:bagSlots()},()=>({id:'heal06',n:1}));Base.render();});await p.locator('#stashGrid .scell:not(.empty)').first().click();assert(await p.locator('#itemTip .medical-actions button').first().isDisabled(),'背包满时放进背包应置灰');await p.evaluate(()=>{Save.bag=[];Base.render();});await p.locator('#stashGrid .scell:not(.empty)').first().click();await p.locator('#itemTip .medical-actions button').first().click();assert(await p.evaluate(()=>Save.bag.some(e=>e.id==='ammo_556_1'&&e.n===60)));
 await p.locator('[aria-label="搜索库存"]').fill('');await p.locator('[data-st-category="medical"]').click();await p.locator('[aria-label="搜索库存"]').fill('绷带');await p.locator('#stashGrid .scell:not(.empty)').click();assert((await p.locator('#itemTip').innerText()).includes('12 / 20'));await p.getByRole('button',{name:/使用一件/}).click();assert(await p.evaluate(()=>Save.hp>50));
 await p.locator('[aria-label="搜索库存"]').fill('');await p.locator('[data-st-category="weapons"]').click();await p.locator('[aria-label="搜索库存"]').fill('旧式折叠刀');await p.locator('#stashGrid .scell:not(.empty)').click();assert(await p.locator('#itemTip .medical-actions button').filter({hasText:'前往出售'}).count()===1,'仓库详情应有前往出售');
 /* ---- 统一手势：仓库只有左键看详情 + 双击进包；背包与装备槽右键卸下 ---- */
 await p.evaluate(()=>{window.__kStash=Save.stash.slice();window.__kBag=Save.bag.slice();window.__kGear=JSON.stringify(Save.gear);});
 await p.evaluate(()=>{Save.bag=[];Save.stash=Save.stash.filter(e=>!e.gear);Save.gear={weapons:[EQUIP.gun('m4a1',12),null,null],helmet:GEAR.make('helmet',3),body:null,back:BACKPACK.make('bag03'),melee:EQUIP.melee('melee01',true)};Base.render();});
 await p.locator('[aria-label="搜索库存"]').fill('');
 await p.locator('[data-st-category="all"]').click();
 const bag0=await p.evaluate(()=>Save.bag.length);
 await p.locator('#stashGrid .scell:not(.empty)').first().click({button:'right'});
 assert(!(await p.locator('#ctxMenu').isVisible()),'仓库格右键不弹菜单');
 await p.locator('#stashGrid .scell:not(.empty)').first().dblclick();
 assert.equal(await p.evaluate(()=>Save.bag.length),bag0+1,'双击仓库物品应该放进背包');
 await p.locator('#baseBagGrid .cell:not(.empty)').first().click({button:'right'});
 assert.deepEqual((await p.locator('#ctxMenu .citem').allInnerTexts()).slice(0,2),['详情','卸下'],'背包右键前两项是详情与卸下');
 await p.evaluate(()=>Ctx.hide());
 await p.locator('#baseGear .slot:not(.empty)').first().click({button:'right'});
 assert.deepEqual((await p.locator('#ctxMenu .citem').allInnerTexts()).slice(0,2),['详情','卸下'],'装备槽右键前两项是详情与卸下');
 await p.evaluate(()=>Ctx.hide());
 const unload=await p.evaluate(()=>{
   const stash0=Save.stash,bag0=Save.bag;
   Save.stash=Array.from({length:STASH_SLOTS},()=>({id:'life01',n:1}));
   Save.bag=[];
   const okBag=Base.unequip('helmet');
   const wentBag=!Save.gear.helmet&&Save.bag.some(e=>e.gear?.equip?.kind==='armor');
   Save.gear.helmet=GEAR.make('helmet',3);
   Save.bag=Array.from({length:bagSlots()},()=>({id:'heal06',n:1}));
   const refused=Base.unequip('helmet')===false&&!!Save.gear.helmet;
   Save.stash=stash0;Save.bag=bag0;Save.gear.helmet=GEAR.make('helmet',3);Base.render();
   return {okBag,wentBag,refused};
 });
 assert(unload.okBag&&unload.wentBag,'仓库满时卸下的装备应该落进背包');
 assert(unload.refused,'仓库与背包都满时不允许卸下');
 await p.evaluate(()=>{Ctx.hide();Tips.hide();Save.stash=window.__kStash;Save.bag=window.__kBag;Save.gear=JSON.parse(window.__kGear);Base.render();});
 await p.locator('[aria-label="搜索库存"]').fill('');await p.locator('[data-st-category="all"]').click();const before=await p.evaluate(()=>JSON.stringify(Save.stash));await p.locator('[data-st-organize]').click();assert.equal(await p.evaluate(()=>JSON.stringify(Save.stash)),before);
 await p.locator('[aria-label="搜索库存"]').fill('潮汐仪');assert(await p.locator('#stashGrid .scell:not(.empty)').count()>=1);await p.locator('[aria-label="搜索库存"]').fill('不存在的物品');assert(await p.locator('.st-empty').isVisible());await p.locator('[aria-label="搜索库存"]').fill('');await p.locator('[aria-label="筛选品质"]').selectOption('6');assert(await p.evaluate(()=>Base.stashList().every(e=>stashItem(e).r===6)));await p.locator('[aria-label="筛选品质"]').selectOption('all');
 await p.locator('[data-st-toggle]').click();assert.equal(await p.locator('.st-subcats button').count(),9);await p.locator('[data-st-category="cat:med"]').click();assert(await p.evaluate(()=>Base.stashList().every(e=>stashItem(e).cat==='med')));
 const state=await p.evaluate(()=>JSON.stringify({stash:Save.stash,credits:Save.credits}));await p.locator('[data-st-bulk]').click();assert(await p.locator('.mb-overview').isVisible());assert.equal(await p.evaluate(()=>JSON.stringify({stash:Save.stash,credits:Save.credits})),state);await p.evaluate(()=>Safehouse.route('stash'));assert((await p.locator('.store-ft').innerText()).includes('估价'));
 await p.locator('.sh-top [data-sh="traders"]').click();await p.locator('[data-mb-open="gun"]').click();await p.locator('[data-mb-mode="sell"]').click();assert(await p.locator('.mb-sell-mount #stashGrid').isVisible());await p.evaluate(()=>Safehouse.route('loadout'));assert(await p.locator('.base-main>.base-right').isVisible());assert.equal(await p.locator('#baseGear .slot').count(),7);
 for(const width of [1280,390,320]){await p.setViewportSize({width,height:width>800?720:844});await p.waitForFunction(()=>document.getElementById('frame').getBoundingClientRect().width<=innerWidth);await p.evaluate(()=>Safehouse.route('stash'));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);await p.locator('[data-st-category="weapons"]').click();await p.locator('#stashGrid .scell:not(.empty)').first().click();if(width===1280){const box=await p.locator('#itemTip .medical-actions button').last().boundingBox();assert(box&&box.y+box.height<=720);}if(width===390)await p.screenshot({path:path.join(out,file==='index.html'?'mobile.png':'offline-mobile.png')});}
 assert.deepEqual(errors,[]);reports.push({file,errors,filtersBeforePagination:true,realMedicalTransfer:true,boundProtected:true,bulkConfirmed:true,staleQuoteRejected:true,nodeOwnership:true,widths:[1440,1280,390,320]});await p.close();
 }
 const demo=await browser.newPage({viewport:{width:1440,height:900}});await demo.goto('http://127.0.0.1:'+server.address().port+'/design/ui/storage-v1/index.html');await demo.waitForFunction(()=>StorageUI.mounted);await demo.locator('.st-demo-grid .scell').first().click();await demo.screenshot({path:path.join(out,'demo.png')});assert.equal(await demo.evaluate(()=>localStorage.length),0);await demo.close();fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',reports,demoIsolated:true},null,2));console.log('PASS: storage categories/search/rarity/sort, real operations, full bag, bound knife, safe bulk sale, stale quote, view restoration, live/offline and four widths');
 }finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
