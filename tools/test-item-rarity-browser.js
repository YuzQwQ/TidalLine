
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),review=require('../design/items/rarity.json'),output=path.join(root,'output/item-rarity');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
  const names=['寻常','良品','上乘','稀见','珍罕','孤品'],rgb=['rgb(198, 206, 202)','rgb(63, 139, 120)','rgb(63, 109, 155)','rgb(145, 101, 179)','rgb(168, 134, 42)','rgb(141, 58, 58)'];
  for(const file of ['wiki.html','物品清单.html']){
   await page.goto(pathToFileURL(path.join(root,file)).href);
   assert.equal(await page.locator('[data-rarity]').count(),6);
   for(let i=0;i<6;i++){const sw=page.locator('[data-rarity="'+(i+1)+'"]');assert((await sw.innerText()).includes(names[i]));assert.equal(await sw.locator('span').evaluate(el=>getComputedStyle(el).backgroundColor),rgb[i]);}
   for(const row of review.items)assert((await page.locator('[data-item="'+row.id+'"] .sub').innerText()).includes(names[row.rarity-1]));
   for(const w of [390,320]){await page.setViewportSize({width:w,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.setViewportSize({width:1440,height:1000});
  }
  for(const entry of ['index.html','潮汐线.html']){
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#base');await page.waitForFunction(()=>Game.state==='base'&&Object.keys(Icons.map).length===ITEMS.length);
   await page.evaluate(()=>{
    const reps=['life01','life03','elec01','odd01','lux01','odd02'];
    const gold=EQUIP.armor(GEAR.make('helmet',5,37)),red=EQUIP.armor(GEAR.make('helmet',6,42));gold.r=4;red.r=5;
    Save.stash=reps.map(id=>({id,n:1})).concat([{id:gold.id,n:1,gear:gold},{id:red.id,n:1,gear:red}]);Save.save();Save.flush();
   });
   await page.reload();await page.waitForFunction(()=>Game.state==='base'&&Object.keys(Icons.map).length===ITEMS.length);
   assert(await page.evaluate(()=>Save.stash.some(e=>e.id==='odd02')&&Save.stash.find(e=>e.id==='g_helmet5').gear.r===5&&Save.stash.find(e=>e.id==='g_helmet6').gear.r===6&&Save.stash.find(e=>e.id==='g_helmet5').gear.equip.gear.dur===37&&Save.stash.find(e=>e.id==='g_helmet6').gear.equip.gear.dur===42),'旧装备金红等级或耐久变化');
   for(let n=1;n<=6;n++){
    const style=await page.locator('#stashGrid .scell.r'+n).first().evaluate(el=>({color:getComputedStyle(el).borderLeftColor,width:getComputedStyle(el).borderLeftWidth,bg:getComputedStyle(el).backgroundImage}));
    assert.equal(style.color,rgb[n-1],entry+' 仓库颜色 '+n);assert.equal(style.width,'3px');assert.notEqual(style.bg,'none');
   }
   await page.screenshot({path:path.join(output,entry==='index.html'?'source-warehouse.png':'offline-warehouse.png')});
   await page.evaluate(()=>{
    Base.close();Game.startRun();Game.state='ended';Game.enemies=[];
    const reps=['life01','life03','elec01','odd01','lux01','odd02'].map(id=>ITEM_BY_ID[id]);
    Game.player.bag.slots=reps.map(item=>({item,n:1}));Game.player.bag.safe=reps.slice(2).map(item=>({item,n:1}));
    if(!Game.bagOpen)Game.toggleBag();Game.openLoot({kind:'secret',items:reps.map(item=>({item,n:1,known:true}))});
   });
   for(const selector of ['#bagGrid .cell','#lootList .row']){
    for(let n=1;n<=6;n++)assert.equal(await page.locator(selector+'.r'+n).evaluate(el=>getComputedStyle(el).borderLeftColor),rgb[n-1],entry+' '+selector+' '+n);
   }
   assert.equal(await page.locator('#safeGrid .cell.r6').evaluate(el=>getComputedStyle(el).borderLeftColor),rgb[5]);
   for(const [id,label]of [['odd01','稀见'],['lux01','珍罕'],['odd02','孤品']]){await page.evaluate(id=>Tips.show(ITEM_BY_ID[id],{left:100,top:100,right:150,bottom:150,width:50,height:50}),id);assert((await page.locator('#itemTip').innerText()).includes(label));}
   await page.evaluate(()=>Tips.hide());await page.screenshot({path:path.join(output,entry==='index.html'?'source-inventory.png':'offline-inventory.png')});
   assert(await page.evaluate(()=>[1,2,3,4,5,6].every(r=>Number.isFinite(Game.searchTime({r})))&&Game.searchTime({r:6})===3));
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log('OK: 六色Wiki与31物品评级 / 双版本六色仓库背包搜刮安全箱 / 六级提示和搜索 / 旧装备金红快照耐久 / 320和390布局');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
