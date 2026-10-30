/* 只验证本轮15件神秘学物品，允许其他类别并行新增待绘制物品。 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const sharp=require('sharp'),{chromium}=require('playwright'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),spec=require('../assets/occult-generation.json'),folder=path.join(root,'assets/item-art/occult');
const c=vm.createContext({});for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);const items=vm.runInContext('ITEMS',c);
async function main(){
 assert.equal(spec.items.length,15);const qa=[],hashes=new Set();
 for(const a of spec.items){
  assert.deepEqual(JSON.parse(JSON.stringify(items.find(i=>i.id===a.id))),a.original,a.id+' 数值/文案保持不变');assert.equal(a.status,'generated');assert(a.prompt&&a.originalSource);
  assert(fs.existsSync(path.join(folder,'sources',a.id+'.png')));const bytes=fs.readFileSync(path.join(root,a.output)),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert(!hashes.has(hash));hashes.add(hash);
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,48);assert.equal(info.height,48);
  let visible=0,left=48,right=-1,top=48,bottom=-1;const colors=new Set();
  for(let y=0;y<48;y++)for(let x=0;x<48;x++){const n=(y*48+x)*4,a=data[n+3];assert(a===0||a===255);if(!a)continue;visible++;assert(x>=4&&y>=4&&x<44&&y<44);colors.add(data.subarray(n,n+4).toString('hex'));left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  assert(visible>120);assert(colors.size<=15);assert(Math.max(right-left+1,bottom-top+1)>=38);assert(!require('../design/items/classification.json').items.find(i=>i.id===a.id).pendingArt);
  qa.push({id:a.id,width:48,height:48,visiblePixels:visible,colors:colors.size,bounds:{left,top,right,bottom},sha256:hash});
 }
 fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify({total:15,passed:15,assets:qa},null,2)+'\n');console.log('OK: 15件原稿、独立图标、48px、4px透明边、硬边16色、数值与描述不变');
 const browser=await chromium.launch({channel:'msedge',headless:true}),ids=spec.items.map(i=>i.id);
 try{
  for(const file of ['index.html','潮汐线.html']){
   const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(/occ(?:0[1-9]|1[0-5])\.png/.test(r.url()))errors.push(r.url());});
   await page.goto(pathToFileURL(path.join(root,file)).href+'#base');await page.waitForFunction(ids=>Game.state==='base'&&ids.every(id=>Icons.get(id)),ids);
   assert(await page.evaluate(ids=>ids.every(id=>Icons.get(id).naturalWidth===48),ids));if(file!=='index.html')assert(await page.evaluate(ids=>ids.every(id=>Icons.get(id).src.startsWith('data:image/png;base64,')),ids));
   await page.evaluate(ids=>{Save.stash=ids.map(id=>({id,n:1}));Base.render();},ids);assert.equal(await page.locator('#stashGrid img').count(),15);
   await page.evaluate(ids=>{Base.close();Game.startRun({ammo:0,bandage:0,stone:0});Game.enemies=[];Game.state='ended';const list=ids.map(id=>ITEM_BY_ID[id]);Game.player.bag.slots=list.slice(0,12).map(item=>({item,n:1}));Game.player.bag.safe=list.slice(12).map(item=>({item,n:1}));if(!Game.bagOpen)Game.toggleBag();else Game.renderBag();Game.openLoot({kind:'secret',items:list.map(item=>({item,n:1,known:true}))});},ids);
   assert.equal(await page.locator('#bagGrid img').count(),12);assert.equal(await page.locator('#safeGrid img').count(),3);assert.equal(await page.locator('#lootList img').count(),15);assert.deepEqual(errors,[]);await page.close();console.log('OK: '+file+' 仓库、背包、安全箱与搜刮；全部独立加载');
  }
  const page=await browser.newPage({viewport:{width:1280,height:1100}});
  for(const file of ['wiki.html','物品清单.html']){await page.goto(pathToFileURL(path.join(root,file)).href+'#items');for(const id of ids){const image=page.locator('[data-item="'+id+'"] .thumb img');assert.equal(await image.count(),1);assert.equal(await image.getAttribute('src'),'assets/items/'+id+'.png');await image.evaluate(i=>i.decode());}}
  await page.goto(pathToFileURL(path.join(folder,'index.html')).href);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));assert.equal(await page.locator('article').count(),15);await page.screenshot({path:path.join(folder,'contact-sheet.png'),fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.close();console.log('OK: Wiki与物品清单、15件审核总览、320/390px布局');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
