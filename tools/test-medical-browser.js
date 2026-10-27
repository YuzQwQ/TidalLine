const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/medical');
const pendingArt=new Set(require('../design/items/classification.json').items.filter(i=>i.pendingArt&&!fs.existsSync(path.join(root,'assets/items',(i.original.iconId||i.id)+'.png'))).map(i=>i.original.iconId||i.id));
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const entry of ['index.html','潮汐线.html']){
   const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{
    const match=r.url().match(/\/assets\/items\/([^/]+)\.png$/);
    if(!match||!pendingArt.has(match[1]))errors.push(r.url());
   });
   await context.addInitScript(()=>{if(!sessionStorage.getItem('medical-seeded')){localStorage.setItem('tideline_save_v1',JSON.stringify({v:2,hp:1,credits:200000,stash:[{id:'med01',n:3},{id:'heal01',n:2},{id:'heal02',n:1},{id:'heal06',n:1}],loadout:{ammo:60,bandage:3,stone:3},gear:{weapons:['rifle','shotgun','pistol']}}));sessionStorage.setItem('medical-seeded','1');}});
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#base');
   await page.waitForFunction(()=>Game.state==='base'&&Icons.get('heal01')&&Object.keys(Icons.map).length===ITEMS.length);
   assert(await page.evaluate(()=>Save.hp===1&&Save.stashCount('heal01')===5&&!Save.stash.some(e=>e.id==='med01')));
   await page.locator('[data-t="doctor"]').click();
   assert.equal(await page.locator('#shopGrid [data-medical]').count(),10);assert.equal(await page.locator('#shopGrid .pending-mark').count(),7);
   assert((await page.locator('#doctorService').innerText()).includes('¥12,500'));
   await page.locator('[data-medical="heal02"]').click();await page.locator('#dealBox [data-a="go"]').click();
   assert(await page.evaluate(()=>Save.stashCount('heal02')===2&&Save.credits===195000));
   await page.locator('[data-medical="heal06"]').click();assert((await page.locator('#dealBox').innerText()).includes('效果待开放'));await page.locator('#dealBox [data-a="no"]').click();
   await page.locator('#btnDoctorTreat').click();await page.locator('#dealBox [data-a="go"]').evaluate(button=>{button.click();button.click();});
   assert(await page.evaluate(()=>Save.hp===100&&Save.credits===182500));assert(await page.locator('#btnDoctorTreat').isDisabled());
   await page.evaluate(()=>{Save.setHP(85);Base.render();});
   const band=page.locator('#stashGrid .scell').filter({has:page.locator('.cn',{hasText:/^绷带$/})});
   await band.click();assert((await page.locator('#itemTip [data-med="use"]').innerText()).includes('溢出 5 HP'));
   await page.locator('#itemTip [data-med="use"]').click();assert(await page.evaluate(()=>Save.hp===100&&Save.stashCount('heal01')===4));
   await page.locator('#stashGrid .scell').filter({has:page.locator('.cn',{hasText:/^止痛片$/})}).click();
   assert(await page.locator('#itemTip [data-med="use"]').isDisabled());await page.evaluate(()=>Tips.hide());
   await page.evaluate(()=>{Save.setHP(40);Base.render();});
   await page.screenshot({path:path.join(output,entry==='index.html'?'doctor-desktop.png':'doctor-offline.png')});
   for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    assert(await page.locator('#baseVeil').evaluate(el=>el.scrollWidth<=el.clientWidth),'医生页横向溢出 '+width);
    await page.locator('#btnDoctorTreat').scrollIntoViewIfNeeded();await page.locator('#btnDoctorTreat').click();
    assert(await page.locator('#dealBox').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await page.locator('#dealBox [data-a="no"]').click();
    await band.click();assert(await page.locator('#itemTip').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await page.evaluate(()=>Tips.hide());
    if(width===390)await page.screenshot({path:path.join(output,'doctor-mobile.png')});
   }
   await page.setViewportSize({width:1440,height:1000});await page.locator('[data-t="stash"]').click();
   await page.locator('.medical-carry summary').click();
   await page.locator('#medicalCarry .carry-row').filter({hasText:'安禾无菌敷料'}).locator('[data-d="1"]').click();
   assert(await page.evaluate(()=>Save.loadout.medical.heal02===1));
   await page.locator('#btnDeploy').click();await page.locator('#btnMapStart').click();await page.waitForFunction(()=>Game.state==='playing');
   await page.evaluate(()=>{Game.enemies=[];Game.bullets=[];});
   assert(await page.evaluate(()=>Game.player.hp===40&&Game.player.bag.slots.some(e=>e.item.id==='heal02')&&Save.stashCount('heal02')===1));
   await page.keyboard.press('Tab');
   const bagBand=page.locator('#bagGrid .cell').filter({has:page.locator('.cn',{hasText:/^绷带$/})});
   await bagBand.click();await page.locator('#itemTip [data-med="use"]').click();
   await page.keyboard.press('Tab');assert(await page.evaluate(()=>Game.action?.type==='heal'&&!Game.bagOpen));
   await page.keyboard.down('d');await page.waitForFunction(()=>!Game.action);await page.keyboard.up('d');
   assert(await page.evaluate(()=>Game.player.hp===40&&Game.player.bag.slots.find(e=>e.item.id==='heal01').n===3));
   await page.evaluate(()=>{Game.player.vx=Game.player.vy=0;});await page.keyboard.press('Tab');await bagBand.click();await page.locator('#itemTip [data-med="use"]').click();await page.keyboard.press('Escape');
   assert(await page.evaluate(()=>!Game.action&&Game.player.hp===40));
   if(!(await page.evaluate(()=>Game.bagOpen)))await page.keyboard.press('Tab');
   await bagBand.click();await page.locator('#itemTip [data-med="use"]').click();await page.keyboard.press('Tab');
   await page.screenshot({path:path.join(output,entry==='index.html'?'healing-raid.png':'healing-offline.png')});
   await page.waitForFunction(()=>Game.player.hp===60);assert(await page.evaluate(()=>Game.player.bag.slots.find(e=>e.item.id==='heal01').n===2));
   await page.reload();await page.waitForFunction(()=>Game.state==='base');assert(await page.evaluate(()=>Save.hp===60),'刷新保留治疗后HP');
   assert.deepEqual(errors,[]);await context.close();
   console.log('OK: '+entry+' 医生10件/7件预留、实际购买/治疗/防重复、库存使用、医疗携带、局内读条与移动/Esc取消、关闭背包继续、刷新、320/390px');
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});
  for(const entry of ['wiki.html','物品清单.html']){
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#items');
   assert.equal(await page.locator('[data-item]').count(),require('../design/items/classification.json').items.length);assert.equal(await page.locator('[data-medical-group]').count(),5);
   assert.equal(await page.locator('[data-item-category="medical"] .item').count(),18);
   assert.equal(await page.locator('[data-item-category="medical"] .thumb img').count(),18);
   assert((await page.locator('[data-item="heal15"]').innerText()).includes('效果待开放'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
