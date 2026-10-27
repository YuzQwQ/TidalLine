/* 新增27件图标的交付规格、物品定义不变，以及双版本实际装载。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const sharp=require('sharp'),{chromium}=require('playwright'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),manifest=require('../assets/collectibles-generation.json');
const folder=path.join(root,'assets/item-art/collectibles'),output=path.join(root,'output/collectible-art');
const c=vm.createContext({});for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
const items=vm.runInContext('ITEMS',c);
(async()=>{
 fs.mkdirSync(output,{recursive:true});assert.equal(manifest.items.length,27);
 const hashes=new Set(),qa=[];
 for(const record of manifest.items){
  const item=items.find(i=>i.id===record.id);assert(item);
  for(const [key,value]of Object.entries(record.original)){const expected=key==='price'?require('../design/items/economy.json').items.find(i=>i.id===record.id).price:value;assert.deepEqual(JSON.parse(JSON.stringify(item[key])),expected,record.id+' 物品定义变化 '+key);}
  assert(record.prompt&&record.originalSource);assert.equal(record.status,'generated');
  assert(fs.existsSync(path.join(folder,'sources',record.id+'.png')));
  const png=fs.readFileSync(path.join(root,'assets/items',record.id+'.png'));
  const sha256=crypto.createHash('sha256').update(png).digest('hex');assert(!hashes.has(sha256));hashes.add(sha256);
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,48);assert.equal(info.height,48);
  let visible=0,partial=0,margin=0,left=48,top=48,right=-1,bottom=-1;const colors=new Set();
  for(let y=0;y<48;y++)for(let x=0;x<48;x++){
   const n=(y*48+x)*4,a=data[n+3];if(a&&a!==255)partial++;
   if(!a)continue;visible++;colors.add(data.subarray(n,n+4).toString('hex'));
   if(x<4||x>=44||y<4||y>=44)margin++;
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  assert(visible>60,record.id+' 内容过少');assert.equal(partial,0);assert.equal(margin,0);assert(colors.size<=16);
  const span=Math.max(right-left+1,bottom-top+1);assert(span>=38&&span<=40,record.id+' 缩放范围异常');
  qa.push({id:record.id,width:48,height:48,visiblePixels:visible,colors:colors.size,partialAlphaPixels:partial,marginPixels:margin,bounds:{left,top,right,bottom},sha256});
 }
 for(const item of items)assert(fs.existsSync(path.join(root,'assets/items',(item.iconId||item.id)+'.png')),'清单仍有缺图 '+item.id);
 const classification=require('../design/items/classification.json');for(const record of manifest.items)assert(!classification.items.find(i=>i.id===record.id).pendingArt);
 fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify({total:27,passed:27,assets:qa},null,2)+'\n');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const entry of ['index.html','潮汐线.html']){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#base');await page.waitForFunction(()=>Game.state==='base'&&ITEMS.every(i=>Icons.get(i.id)));
   assert.equal(await page.evaluate(()=>ITEMS.filter(i=>Icons.get(i.id)).length),items.length);
   if(entry!=='index.html')assert(await page.evaluate(()=>ITEMS.every(i=>Icons.get(i.id).src.startsWith('data:image/png;base64,'))));
   await page.evaluate(ids=>{Save.stash=ids.map(id=>({id,n:1}));Base.render();},manifest.items.map(i=>i.id));
   assert.equal(await page.locator('#stashGrid img').count(),27);assert.equal(await page.locator('#stashGrid .ph').count(),0);
   await page.screenshot({path:path.join(output,entry==='index.html'?'warehouse.png':'warehouse-offline.png')});
   await page.evaluate(ids=>{Base.close();Game.startRun({ammo:0,bandage:0,stone:0});Game.enemies=[];Game.state='ended';const list=ids.map(id=>ITEM_BY_ID[id]);Game.player.bag.slots=list.slice(0,24).map(item=>({item,n:1}));Game.player.bag.safe=list.slice(24).map(item=>({item,n:1}));if(!Game.bagOpen)Game.toggleBag();else Game.renderBag();Game.openLoot({kind:'secret',items:list.map(item=>({item,n:1,known:true}))});},manifest.items.map(i=>i.id));
   assert.equal(await page.locator('#bagGrid img').count(),24);assert.equal(await page.locator('#safeGrid img').count(),3);assert.equal(await page.locator('#lootList img').count(),27);
   assert.deepEqual(errors,[]);await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:1200}});
  for(const file of ['wiki.html','物品清单.html']){
   await page.goto(pathToFileURL(path.join(root,file)).href+'#items');
   assert.equal(await page.locator('[data-item] .thumb img').count(),items.length);assert.equal(await page.locator('[data-item] .thumb span').count(),0);
   assert(await page.locator('[data-item] img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())).then(()=>images.every(i=>i.naturalWidth===48))));
   for(const record of manifest.items)assert.equal(await page.locator('[data-item="'+record.id+'"] .thumb img').getAttribute('src'),'assets/items/'+record.id+'.png');
  }
  await page.goto(pathToFileURL(path.join(folder,'index.html')).href);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(folder,'contact-sheet.png'),fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.close();
 }finally{await browser.close();}
 console.log('OK: 27件原稿与独立图标 / 物品数据不变 / 48px与透明留边 / <=16色 / 全库图标齐全 / 双版本仓库、背包、安全箱、搜刮 / 离线全内嵌 / Wiki与窄屏总览');
})().catch(e=>{console.error(e);process.exitCode=1;});
