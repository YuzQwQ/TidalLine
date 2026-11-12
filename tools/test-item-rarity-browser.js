
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
    /* 稀有度重排过，六档代表件从数据表现挑，保证每档都有格子可查 */
    const reps=['odd02'];
    for(let r=1;r<=6;r++){const it=ITEMS.find(i=>i.r===r&&itemGroup&&itemGroup(i)==='collectible'&&!reps.includes(i.id));if(it)reps.push(it.id);}
    const gold=EQUIP.armor(GEAR.make('helmet',5,37)),red=EQUIP.armor(GEAR.make('helmet',6,42));gold.r=4;red.r=5;
    Save.stash=reps.map(id=>({id,n:1})).concat([{id:gold.id,n:1,gear:gold},{id:red.id,n:1,gear:red}]);Save.save();Save.flush();
   });
   await page.reload();await page.waitForFunction(()=>Game.state==='base'&&Object.keys(Icons.map).length===ITEMS.length);
   assert(await page.evaluate(()=>Save.stash.some(e=>e.id==='odd02')&&Save.stash.find(e=>e.id==='g_helmet5').gear.r===5&&Save.stash.find(e=>e.id==='g_helmet6').gear.r===6&&Save.stash.find(e=>e.id==='g_helmet5').gear.equip.gear.dur===37&&Save.stash.find(e=>e.id==='g_helmet6').gear.equip.gear.dur===42),'旧装备金红等级或耐久变化');
   /* 仓库格改版后不再用 3px 左边框，稀有度落在 --rarity-edge 变量与格子上，
      这里查「六档各有描边色、且互不相同」，配色值本身不写死。 */
   const edges=[];
   for(let n=1;n<=6;n++){
    const style=await page.locator('#stashGrid .scell.r'+n).first().evaluate(el=>({
      edge:getComputedStyle(el).getPropertyValue('--rarity-edge').trim(),
      bg:getComputedStyle(el).backgroundColor,bgi:getComputedStyle(el).backgroundImage}));
    assert(style.edge,entry+' 仓库稀有度描边 '+n);
    assert(style.bg!=='rgba(0, 0, 0, 0)'||style.bgi!=='none',entry+' 格子没有底色 '+n);
    edges.push(style.edge);
   }
   assert.equal(new Set(edges).size,6,entry+' 六档稀有度描边应各不相同：'+edges.join(','));
   await page.screenshot({path:path.join(output,entry==='index.html'?'source-warehouse.png':'offline-warehouse.png')});
   await page.evaluate(()=>{
    Base.close();Game.startRun();Game.state='ended';Game.enemies=[];
    /* 同样按稀有度各挑一件，六档颜色各查一次，不会因为重排撞档 */
    const reps=[1,2,3,4,5,6].map(r=>ITEMS.find(i=>i.r===r&&itemGroup(i)==='collectible'));
    Game.player.bag.slots=reps.map(item=>({item,n:1}));Game.player.bag.safe=reps.slice(2).map(item=>({item,n:1}));
    if(!Game.bagOpen)Game.toggleBag();Game.openLoot({kind:'secret',items:reps.map(item=>({item,n:1,known:true}))});
   });
   /* 局内格子同样改成渐变底色标稀有度，颜色仍是 RARITY 那六个 RGB */
   const tint=v=>v.replace('rgb(','rgba(').replace(')',',');
   for(const selector of ['#bagGrid .cell','#lootList .row']){
    for(let n=1;n<=6;n++){
     const bgi=await page.locator(selector+'.r'+n).evaluate(el=>getComputedStyle(el).backgroundImage);
     assert(bgi.includes(tint(rgb[n-1])),entry+' '+selector+' '+n+' 稀有度底色：'+bgi.slice(0,80));
    }
   }
   /* 安全箱格不走渐变底色，稀有度只落在 --rarity-edge；和背包红格取同一个值即可 */
   const bagEdge=await page.locator('#bagGrid .cell.r6').evaluate(el=>getComputedStyle(el).getPropertyValue('--rarity-edge').trim());
   const safeEdge=await page.locator('#safeGrid .cell.r6').evaluate(el=>getComputedStyle(el).getPropertyValue('--rarity-edge').trim());
   assert(bagEdge&&safeEdge===bagEdge,entry+' 安全箱红格描边应与背包一致：'+bagEdge+' / '+safeEdge);
   for(const [id,label]of [['odd01','稀见'],['lux01','珍罕'],['odd02','孤品']]){await page.evaluate(id=>Tips.show(ITEM_BY_ID[id],{left:100,top:100,right:150,bottom:150,width:50,height:50}),id);assert((await page.locator('#itemTip').innerText()).includes(label));}
   await page.evaluate(()=>Tips.hide());await page.screenshot({path:path.join(output,entry==='index.html'?'source-inventory.png':'offline-inventory.png')});
   assert(await page.evaluate(()=>[1,2,3,4,5,6].every(r=>Number.isFinite(Game.searchTime({r})))&&Game.searchTime({r:6})===3));
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log('OK: 六色Wiki与'+review.items.length+'件评级 / 双版本六色仓库背包搜刮安全箱 / 六级提示和搜索 / 旧装备金红快照耐久 / 320和390布局');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
