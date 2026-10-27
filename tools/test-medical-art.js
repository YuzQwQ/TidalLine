/* 只验证本轮18件医疗图标；兼容项目中并行新增、尚待绘制的收集品。 */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const sharp=require('sharp'),{chromium}=require('playwright'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),spec=require('../design/items/medical.json'),manifest=require('../assets/medical-generation.json');
const folder=path.join(root,'assets/item-art/medical'),output=path.join(root,'output/medical-art');
(async()=>{
 fs.mkdirSync(output,{recursive:true});assert.equal(spec.items.length,18);assert.equal(manifest.items.length,18);
 const qa=[],hashes=new Set();
 for(const item of spec.items){
  const file=path.join(root,'assets/items',item.id+'.png'),source=path.join(folder,'sources',item.id+'.png');
  assert(fs.existsSync(source));assert.equal(item.iconId,item.id);
  const record=manifest.items.find(i=>i.id===item.id);assert(record?.prompt&&record.originalSource);
  const png=fs.readFileSync(file),hash=crypto.createHash('sha256').update(png).digest('hex');assert(!hashes.has(hash));hashes.add(hash);
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,48);assert.equal(info.height,48);
  let visible=0,partial=0,margin=0,left=48,top=48,right=-1,bottom=-1;const colors=new Set();
  for(let y=0;y<48;y++)for(let x=0;x<48;x++){
   const n=(y*48+x)*4,a=data[n+3];if(a&&a!==255)partial++;
   if(!a)continue;visible++;colors.add(data.subarray(n,n+4).toString('hex'));
   if(x<4||y<4||x>=44||y>=44)margin++;
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  assert(visible>120,item.id+' 内容过少');assert.equal(partial,0,item.id+' 半透明边缘');assert.equal(margin,0,item.id+' 越过留边');
  assert(colors.size<=16,item.id+' 调色板超限');
  const span=Math.max(right-left+1,bottom-top+1);assert(span>=38&&span<=40,item.id+' 物体缩放不一致');
  qa.push({id:item.id,width:48,height:48,visiblePixels:visible,colors:colors.size,partialAlphaPixels:partial,marginPixels:margin,bounds:{left,top,right,bottom},sha256:hash});
 }
 fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify({total:18,passed:18,assets:qa},null,2)+'\n');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const entry of ['index.html','潮汐线.html']){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',r=>{if(/heal\d\d\.png/.test(r.url()))errors.push(r.url());});
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#base');
   await page.waitForFunction(()=>Game.state==='base'&&MEDICAL_ITEMS.every(i=>Icons.get(i.id)));
   assert(await page.evaluate(()=>MEDICAL_ITEMS.every(i=>Icons.get(i.id).naturalWidth===48&&Icons.get(i.id).naturalHeight===48)));
   if(entry!=='index.html')assert(await page.evaluate(()=>MEDICAL_ITEMS.every(i=>Icons.get(i.id).src.startsWith('data:image/png;base64,'))));
   await page.evaluate(()=>{Save.stash=MEDICAL_ITEMS.map(i=>({id:i.id,n:1}));Save.credits=3000;Save.hp=40;Base.tab='doctor';Base.render();});
   assert.equal(await page.locator('#stashGrid img').count(),18);assert.equal(await page.locator('#shopGrid [data-medical] img').count(),10);
   assert.equal(await page.locator('#shopGrid [data-medical] .ph').count(),0);
   await page.screenshot({path:path.join(output,entry==='index.html'?'doctor-icons.png':'doctor-icons-offline.png')});
   await page.evaluate(()=>{Base.close();Game.startRun({ammo:0,bandage:0,stone:0});Game.enemies=[];Game.state='ended';Game.player.bag.slots=MEDICAL_ITEMS.map(item=>({item,n:1}));if(!Game.bagOpen)Game.toggleBag();else Game.renderBag();Game.openLoot({kind:'plain',items:MEDICAL_ITEMS.map(item=>({item,n:1,known:true}))});});
   assert.equal(await page.locator('#bagGrid img').count(),18);assert.equal(await page.locator('#lootList img').count(),18);
   await page.evaluate(()=>{const entry=Game.player.bag.slots.shift();Game.player.bag.safe=[entry];Game.renderBag();});assert.equal(await page.locator('#safeGrid img').count(),1);
   assert.deepEqual(errors,[]);await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  for(const file of ['wiki.html','物品清单.html']){
   await page.goto(pathToFileURL(path.join(root,file)).href+'#items');
   assert.equal(await page.locator('[data-item-category="medical"] .thumb img').count(),18);
   assert.equal(await page.locator('[data-item-category="medical"] .thumb span').count(),0);
   for(const item of spec.items)assert.equal(await page.locator('[data-item="'+item.id+'"] .thumb img').getAttribute('src'),'assets/items/'+item.id+'.png');
   assert(await page.locator('[data-item-category="medical"] img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())).then(()=>images.every(i=>i.naturalWidth===48))));
  }
  await page.goto(pathToFileURL(path.join(folder,'index.html')).href);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(folder,'contact-sheet.png'),fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.close();
 }finally{await browser.close();}
 console.log('OK: 18/18医疗图标 / 唯一PNG / 48px与40px占幅 / <=16色 / 硬边透明和4px留边 / 提示词原稿记录 / 双版本医生、仓库、背包、安全箱、搜刮 / 离线内嵌 / Wiki / 窄屏总览');
})().catch(e=>{console.error(e);process.exitCode=1;});
