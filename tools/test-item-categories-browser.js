/* Wiki 分类与新旧物品 ID 的存档兼容，检查开发版和离线版。 */
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const review=require('../design/items/classification.json'),root=path.resolve(__dirname,'..'),output=path.join(root,'output/item-categories');
/* 物品表会持续扩充（收集品 31 → 140 件），分组数量从数据表现算，不写死 */
const ctx={console,Math,Object,Array};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),ctx);
vm.runInContext('globalThis.ITEMS=ITEMS;globalThis.itemGroup=itemGroup;',ctx);
const {ITEMS,itemGroup}=ctx;
const counts={collectible:ITEMS.filter(i=>itemGroup(i)==='collectible').length,supply:ITEMS.filter(i=>itemGroup(i)==='supply').length,codex:ITEMS.filter(i=>!i.noCodex).length};
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
  for(const entry of ['wiki.html','物品清单.html']){
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#items');
   assert.equal(await page.locator('[data-item-group]').count(),2);
   assert.equal(await page.locator('[data-item-category]').count(),11);
   assert.equal(await page.locator('[data-item-group="collectible"] .item').count(),counts.collectible);
   assert.equal(await page.locator('[data-item-group="supply"] .item').count(),counts.supply);
   for(const r of review.items){const card=page.locator('[data-item-category="'+r.category+'"] [data-item="'+r.id+'"]');assert.equal(await card.count(),1);assert((await card.innerText()).includes(r.reason));}
   /* 异常遗物从 0 件扩到 15 件，"目前没有"占位只在空分类出现 */
   const occultCount=ITEMS.filter(i=>i.cat==='occult').length,occultText=await page.locator('[data-item-category="occult"]').innerText();
   assert.equal(await page.locator('[data-item-category="occult"] .item').count(),occultCount);
   assert.equal(occultText.includes('目前没有'),occultCount===0);
   assert((await page.locator('[data-item-category="ammo"]').innerText()).includes('不进图鉴'));
   assert((await page.locator('[data-item-category="medical"]').innerText()).includes('不进图鉴'));
   assert((await page.locator('[data-item-category="collect"] h3').innerText()).includes('文物藏品'));
   for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.setViewportSize({width:1440,height:1000});
  }
  await page.locator('[data-item-category="collect"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'collectibles.png')});
  for(const entry of ['index.html','潮汐线.html']){
   await page.addInitScript(()=>localStorage.setItem('tideline_save_v1',JSON.stringify({v:2,credits:1500,runs:4,stash:[{id:'life02',n:1},{id:'art03',n:1},{id:'antiq03',n:2},{id:'odd02',n:1},{id:'med01',n:3},{id:'ammo',n:24}],codex:{life02:{count:1},art03:{count:1},antiq03:{count:2},odd02:{count:1},med01:{count:8},ammo:{count:1}},loadout:{ammo:60,bandage:3,stone:3},gear:{weapons:['rifle','shotgun','pistol'],helmet:null,body:null}})));
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#base');
   await page.waitForFunction(()=>Game.state==='base'&&Object.keys(Icons.map).length===ITEMS.length);
   /* 老存档里的 'ammo' / 'med01' 会迁移到 ammo_556_1 / heal01；
      仓库不再叠放，除子弹外一件一条 */
   const saved=await page.evaluate(()=>({credits:Save.credits,runs:Save.runs,ids:Save.stash.map(e=>e.id),codex:Object.keys(Save.codex),mil:ITEM_BY_ID['ammo_556_1'].cat,gear:EQUIP.gun('rifle',30).cat}));
   assert.deepEqual(saved.ids,['life02','art03','antiq03','antiq03','odd02','heal01','heal01','heal01','ammo_556_1']);assert.equal(saved.credits,1500);assert.equal(saved.runs,4);assert.equal(saved.codex.length,6);assert.equal(saved.mil,'ammo');assert.equal(saved.gear,'gear');
   assert.equal((await page.locator('#bCodex').innerText()).replace(/\s/g,''),'4/'+counts.codex,'旧绷带图鉴记录不计新进度');
   await page.locator('#stashFilter [data-f="ammo"]').click();assert.equal(await page.locator('#stashGrid .scell:not(.empty)').count(),1);
   await page.locator('#stashFilter [data-f="med"]').click();assert.equal(await page.locator('#stashGrid .scell:not(.empty)').count(),3);
   await page.locator('#stashFilter [data-f="col"]').click();assert.equal(await page.locator('#stashGrid .scell:not(.empty)').count(),5);
   await page.evaluate(()=>{const count=Save.codex.med01.count;Game.registerCodex(ITEM_BY_ID.heal01);if(Save.codex.med01.count!==count)throw Error('物资不应再登记图鉴');});
   for(const [id,cat]of [['life02','收集品 / 情报资料'],['art03','收集品 / 情报资料'],['antiq03','收集品 / 生活用品'],['antiq04','收集品 / 文物藏品'],['odd02','收集品 / 异常遗物'],['ammo_556_1','物资 / 弹药类'],['heal01','物资 / 医疗物品']]){
    await page.evaluate(id=>Tips.show(ITEM_BY_ID[id],{left:100,top:100,right:150,bottom:150,width:50,height:50}),id);
    assert((await page.locator('#itemTip').innerText()).includes(cat),entry+' 分类提示 '+id);
   }
   await page.evaluate(()=>Tips.hide());
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log('OK: Wiki'+counts.collectible+'收集品与'+counts.supply+'物资 / 文物藏品 / 弹药医疗子类 / 仓库双筛选 / 旧图鉴过滤不删记录 / 双版本分类路径 / 320和390布局');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
