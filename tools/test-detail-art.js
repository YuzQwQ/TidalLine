const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),http=require('http'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),catalog=require('../assets/item-details/catalog.json'),out=path.join(root,'output/detail-art');
for(const a of catalog.assets){const b=fs.readFileSync(path.join(root,a.source));assert.equal(b.readUInt32BE(16),a.width);assert.equal(b.readUInt32BE(20),a.height);assert(a.width>48&&a.height>48,a.key);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sourceHash);assert.equal(a.target,a.source,'must use actual original');}
assert.equal(catalog.missing.length,0);
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
 try{for(const offline of [false,true]){
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/sources/'))requests.push(r.url());});
  await p.goto(offline?pathToFileURL(path.join(root,'潮汐线.html')).href+'#base':'http://127.0.0.1:'+server.address().port+'/index.html#base');
  await p.waitForFunction(()=>typeof StorageUI!=='undefined'&&StorageUI.mounted&&Icons.gear.m4a1&&Icons.get('heal01'));
  assert.equal(requests.length,0,'initialization must not request native originals');
  await p.evaluate(()=>{Save.stash=[];Save.bag=[];Save.credits=1e7;for(const id of ['life01','heal01','odd02','ammo_556_2'])Save.addStash(id,1);for(const item of [EQUIP.gun('m4a1'),EQUIP.armor(GEAR.make('helmet',1)),EQUIP.armor(GEAR.make('body','body3_fragmentation')),EQUIP.bag('bag03'),EQUIP.melee('melee01')])Save.addGearStash(item);Safehouse.route('stash');});
  const seen=[];
  for(const name of ['life01','heal01','odd02','ammo_556_2','g_m4a1','g_helmet1','g_body3_fragmentation','g_bag03','g_melee01']){
   const id=await p.evaluate(name=>{const entry=Save.stash.find(e=>e.id===name||e.gear?.id===name);if(!entry)return null;StorageUI.select(entry,document.querySelector('#stashGrid .scell'));return stashItem(entry).id;},name);
   if(!id)throw new Error('Missing fixture '+name);
   const img=p.locator('.st-item-picture img');await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());
   const s=await img.evaluate(i=>({w:i.naturalWidth,h:i.naturalHeight,render:getComputedStyle(i).imageRendering,original:i.hasAttribute('data-detail-image')}));
   /* 单文件版（潮汐线.html）是自包含分发物：身边没有 assets/，按设计文档只带 48px 图标，
      不发必然失败的请求。开发版（http / file 多文件）才用 native 尺寸原图。 */
   if(offline){assert.equal(s.w,48,'离线单文件应回落到 48px 图标');assert(!s.original,'离线单文件不该挂原图');}
   else{assert(s.w>48&&s.h>48&&s.original);assert.equal(s.render,'auto');}
   seen.push({id,...s});
  }
  assert(await p.locator('#stashGrid img').evaluateAll(imgs=>imgs.every(i=>i.naturalWidth===48&&i.naturalHeight===48)));
  await p.screenshot({path:path.join(out,offline?'offline-storage.png':'storage.png')});
  for(const shop of ['shop','gun','doctor']){await p.evaluate(key=>{Safehouse.route('traders');MerchantUI.open(key);},shop);const img=p.locator('.mb-item-preview img');await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());assert(await img.evaluate(i=>i.naturalWidth>(window.__SELF_CONTAINED__?47:48)&&getComputedStyle(i).imageRendering==='auto') || (offline&&await img.evaluate(i=>i.naturalWidth===48)));assert(await p.locator('#shopGrid img').evaluateAll(xs=>xs.every(i=>i.naturalWidth===48)));}
  await p.evaluate(()=>{MerchantUI.open('gun');const cell=[...document.querySelectorAll('#shopGrid [data-offer]')].find(n=>JSON.parse(n.dataset.offer).id==='m4a1');Base.askBuyGun('m4a1',cell);});
  await p.locator('#dealBox img').evaluate(i=>i.decode());assert(await p.locator('#dealBox img').evaluate(i=>i.naturalWidth>(window.__SELF_CONTAINED__?47:48)));await p.evaluate(()=>Deal.hide());
  await p.evaluate(()=>Tips.show(ITEM_BY_ID.heal01,{left:100,right:200,top:100},''));await p.locator('#itemTip img').evaluate(i=>i.decode());assert(await p.locator('#itemTip img').evaluate(i=>i.naturalWidth>(window.__SELF_CONTAINED__?47:48)));await p.evaluate(()=>Tips.hide());
  // Original unavailable: fall back once to the existing icon, including portable offline HTML.
  await p.route('**/missing-detail.png',r=>r.fulfill({status:404,body:''}));
  await p.evaluate(()=>{DETAIL_ART['items/heal01']='missing-detail.png';Tips.show(ITEM_BY_ID.heal01,{left:100,right:200,top:100},'');});
  await p.waitForFunction(()=>{const i=document.querySelector('#itemTip img');return i?.naturalWidth===48&&!i.classList.contains('item-detail-original');});await p.evaluate(()=>Tips.hide());
  // In-raid details must continue to use low-resolution icons.
  await p.evaluate(()=>{Base.close();Game.startRun(null);Game.enemies=[];Tips.show(ITEM_BY_ID.odd02,{left:100,right:200,top:100},'');});assert(await p.locator('#itemTip img').evaluate(i=>i.naturalWidth===48&&!i.hasAttribute('data-detail-image')));await p.evaluate(()=>{Tips.hide();Base.open();});
  for(const width of [390,320]){await p.setViewportSize({width,height:844});await p.waitForFunction(()=>document.getElementById('frame').getBoundingClientRect().width<=innerWidth);await p.evaluate(()=>{Safehouse.route('traders');MerchantUI.open('gun');});const img=p.locator('.mb-item-preview img');await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());assert(await img.evaluate(i=>{const a=i.getBoundingClientRect(),b=i.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right;}));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  assert.deepEqual(errors,[]);reports.push({offline,seen,noPreload:true,grid48px:true,merchants:3,tooltips:true,deal:true,missingOriginalFallback:true,raid48px:true,widths:[1440,390,320]});await p.close();
 }
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed:true,originals:catalog.assets.length,reports},null,2)+'\n');console.log('PASS: '+catalog.assets.length+' exact original PNGs; lazy loading; storage, 3 merchants, tooltips and deals; 48px grids/raid; missing-original fallback; development/offline and 320/390px');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
