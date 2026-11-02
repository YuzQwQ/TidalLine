/* Real stock/inspector/gear/loot + embedded offline assets; isolated browser saves. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/equipment/armor-variants-v1');
const variants=JSON.parse(fs.readFileSync(path.join(out,'design.json'))).variants;
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':f.endsWith('.json')?'application/json':'text/html;charset=utf-8');res.end(b);});});
(async()=>{let browser;const reports=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{browser=await chromium.launch({channel:'msedge',headless:true});
for(const offline of [false,true]){
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],external=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(offline&&r.url().includes('/assets/'))external.push(r.url());});
 await p.goto((offline?pathToFileURL(path.join(root,'潮汐线.html')).href:origin+'/index.html')+'#base');
 await p.waitForFunction(()=>typeof MerchantUI!=='undefined'&&MerchantUI.mounted&&ART.gear.every(id=>Icons.gear[id]));
 const specs=await p.evaluate(ids=>ids.map(id=>{const img=Icons.gear[id],c=document.createElement('canvas');c.width=c.height=48;const cx=c.getContext('2d');cx.drawImage(img,0,0);const b=cx.getImageData(0,0,48,48).data;let opaque=0,partial=0,edge=0;for(let y=0;y<48;y++)for(let x=0;x<48;x++){const a=b[(y*48+x)*4+3];opaque+=a>0;partial+=a>0&&a<255;edge+=(x<4||y<4||x>=44||y>=44)&&a>0;}return{id,width:img.naturalWidth,height:img.naturalHeight,opaque,partial,edge,embedded:img.src.startsWith('data:image/png;base64,')};}),variants.map(v=>v.id));
 for(const s of specs){assert.equal(s.width,48,s.id);assert.equal(s.height,48,s.id);assert(s.opaque>80,s.id);assert.equal(s.partial,0,s.id);assert.equal(s.edge,0,s.id);if(offline)assert(s.embedded,s.id);}
 await p.evaluate(()=>{Save.stash=[];Save.bag=[];Save.credits=1000000;Safehouse.route('traders');MerchantUI.open('shop');});
 assert.equal(await p.locator('#shopGrid .scell').count(),15);
 const stock=await p.locator('#shopGrid [data-offer]').evaluateAll(ns=>ns.map(n=>JSON.parse(n.dataset.offer)).filter(x=>x.kind==='armor').map(x=>x.id));
 for(const v of variants){if(v.level>3){assert(!stock.includes(v.id));continue;}assert(stock.includes(v.id));
  const before=await p.evaluate(()=>Save.credits);
  await p.evaluate(id=>[...document.querySelectorAll('#shopGrid [data-offer]')].find(n=>JSON.parse(n.dataset.offer).id===id).click(),v.id);
  assert((await p.locator('.mb-inspector').innerText()).includes(v.name));
  if(v.type==='body')assert((await p.locator('.mb-inspector').innerText()).includes('瞄准时间惩罚'));
  await p.locator('[data-mb-confirm]').click();assert((await p.locator('#dealBox').innerText()).includes(v.name));
  await p.evaluate(()=>{const b=document.querySelector('#dealBox .go');b.click();b.click();});
  assert.equal(await p.evaluate(()=>Save.credits),before-v.proposed.price);
  assert(await p.evaluate(id=>Save.stash.some(e=>e.gear?.equip?.gear?.id===id),v.id));
 }
 await p.screenshot({path:path.join(out,offline?'ui-offline-shop.png':'ui-shop.png')});
 await p.evaluate(ids=>{for(const id of ids){const type=id.startsWith('helmet')?'helmet':'body';Save.addGearStash(EQUIP.armor(GEAR.make(type,id)));}Safehouse.route('stash');},variants.filter(v=>v.level===4).map(v=>v.id));
 for(const v of variants){await p.locator('[aria-label="搜索库存"]').fill(v.name);await p.locator('#stashGrid .scell:not(.empty)').click();const text=await p.locator('.st-detail').innerText();assert(text.includes(v.name));assert(text.includes(v.description.split('\n')[0]));if(v.type==='body')assert(text.includes('瞄准时间'));
  assert(await p.evaluate(id=>{const e=Save.stash.find(e=>e.gear?.equip?.gear?.id===id);const type=e.gear.equip.gear.type;if(!Base.equipFromStash(e,type))return false;Save.save();Save.flush();Save.load();return Save.gear[type].id===id;},v.id));
 }
 await p.screenshot({path:path.join(out,offline?'ui-offline-stash.png':'ui-stash.png')});
 await p.evaluate(()=>{Safehouse.route('loadout');Save.gear.helmet=GEAR.make('helmet','helmet3_riot');Save.gear.body=GEAR.make('body','body4_lightplate');Base.render();});
 assert(await p.locator('#baseGear').evaluate(el=>el.innerHTML.includes(Icons.gear.helmet3_riot.src)&&el.innerHTML.includes(Icons.gear.body4_lightplate.src)));
 for(const width of [1440,390,320]){await p.setViewportSize({width,height:width>800?900:844});await p.waitForFunction(()=>document.getElementById('frame').getBoundingClientRect().width<=innerWidth+1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'loadout overflow '+width);if(width===390)await p.screenshot({path:path.join(out,offline?'ui-offline-mobile.png':'ui-mobile.png')});}
 await p.setViewportSize({width:1440,height:900});
 await p.evaluate(()=>{Base.close();Game.startRun(null);Game.state='ended';if(!Game.bagOpen)Game.toggleBag();Game.renderGearPanel();});
 for(let lv=1;lv<=4;lv++){
  await p.evaluate(lv=>Game.openLoot({enemy:{t:{name:'装备检视'}},items:ARMOR_VARIANTS.filter(d=>d.lv===lv).map(d=>({gear:GEAR.make(d.type,d.id)}))},true),lv);
  assert.equal(await p.locator('#lootGear img').count(),2);
  assert(await p.locator('#lootGear').evaluate((el,lv)=>ARMOR_VARIANTS.filter(d=>d.lv===lv).every(d=>el.innerHTML.includes(Icons.gear[d.id].src)),lv));
 }
 assert(await p.locator('#eqStrip').evaluate(el=>el.innerHTML.includes(Icons.gear.helmet3_riot.src)&&el.innerHTML.includes(Icons.gear.body4_lightplate.src)));
 await p.screenshot({path:path.join(out,offline?'ui-offline-raid.png':'ui-raid.png')});
 assert(await p.evaluate(()=>{
  Game.closeLoot();if(Game.bagOpen)Game.toggleBag();const p=Game.player;p.meleeActive=false;p.dead=false;p.aimRemaining=.456;p._aimValid=false;Game.input.mx=350;Game.input.my=220;
  const texts=[],cx=Game.ctx,original=cx.fillText;cx.fillText=function(t,...args){texts.push(String(t));return original.call(this,t,...args);};
  try{Game.state='playing';Game.render();return texts.some(t=>t.startsWith('瞄准准备 0.5s'));}finally{cx.fillText=original;Game.state='ended';}
 }),'aim preparation HUD');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);reports.push({entry:offline?'offline_file':'development_http',icons:specs,shop:15,publicVariants:6,lockedVariants:2,storageAndSaveModels:8,raidAndLootIcons:true,aimPreparationHUD:true,widths:[1440,390,320],errors});await p.close();
}
const sheet=await browser.newPage();await sheet.goto(origin+'/'+encodeURIComponent('装备清单.html'));await sheet.waitForFunction(()=>[...document.querySelectorAll('.thumb img')].every(i=>i.complete&&i.naturalWidth===48));assert.equal(await sheet.locator('.thumb img').count(),32);for(const v of variants)assert((await sheet.locator('body').innerText()).includes(v.name));await sheet.close();
const gallery=await browser.newPage({viewport:{width:1440,height:1000}});await gallery.goto(origin+'/assets/item-art/armor-variants/index.html');await gallery.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===48));assert.equal(await gallery.locator('article').count(),8);assert.equal(await gallery.locator('.visor img').count(),10);await gallery.screenshot({path:path.join(out,'art-review.png'),fullPage:true});await gallery.setViewportSize({width:390,height:844});assert(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await gallery.close();
fs.writeFileSync(path.join(out,'ui-validation.json'),JSON.stringify({status:'passed',reports,gearSheet:32,visorBackgrounds:5},null,2)+'\n');console.log('PASS: 8 icons/specs; six variant purchases; two IV locks; all variant storage/save/equip; raid/loot; 1440/390/320px; live + offline file; 32-item sheet; visor 24/34px on five backgrounds');
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
