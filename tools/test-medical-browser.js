const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/medical');
/* 物品表还在扩（158 → 173 件），清单页数从数据表现算 */
const ctx={console,Math,Object,Array};ctx.globalThis=ctx;vm.createContext(ctx);for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),ctx);
const itemTotal=vm.runInContext('ITEMS.length',ctx),medTotal=vm.runInContext("ITEMS.filter(i=>i.cat==='medical').length",ctx);
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
   /* 仓库格子改成"左键看详情"：医疗动作在气泡的 .medical-actions 里 */
   const medAction=(name,label)=>page.locator('#itemTip .medical-actions button',{hasText:label});
   const band=page.locator('#stashGrid .scell').filter({has:page.locator('.cn',{hasText:/^绷带$/})}).first();
   await band.click();assert(await medAction('绷带','使用一件').first().isEnabled());assert((await page.locator('#itemTip').innerText()).includes('当前容量'));
   /* 容量制：用掉 15 点后那卷还剩 5 点，件数不变但多出一条残容量 */
   await medAction('绷带','使用一件').click();assert(await page.evaluate(()=>Save.hp===100&&Save.stashCount('heal01')===5&&Save.stash.some(e=>e.id==='heal01'&&e.cap<20)));
   await page.locator('#stashGrid .scell').filter({has:page.locator('.cn',{hasText:/^止痛片$/})}).click();
   assert.equal(await medAction('止痛片','使用一件').count(),0,'效果待开放的药不给使用按钮');await page.evaluate(()=>Tips.hide());
   await page.evaluate(()=>{Save.setHP(40);Base.render();});
   await page.screenshot({path:path.join(output,entry==='index.html'?'doctor-desktop.png':'doctor-offline.png')});
   for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    assert(await page.locator('#baseVeil').evaluate(el=>el.scrollWidth<=el.clientWidth),'医生页横向溢出 '+width);
    await page.locator('#btnDoctorTreat').scrollIntoViewIfNeeded();await page.locator('#btnDoctorTreat').click();
    assert(await page.locator('#dealBox').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await page.locator('#dealBox [data-a="no"]').click();
    await band.first().click();assert(await page.locator('#itemTip').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await page.evaluate(()=>Tips.hide());
    if(width===390)await page.screenshot({path:path.join(output,'doctor-mobile.png')});
   }
   await page.setViewportSize({width:1440,height:1000});await page.locator('[data-t="stash"]').click();
   /* 背包制：点仓库里的敷料，浮窗里「放入背包」 */
   await page.locator('#stashGrid .scell').filter({hasText:'无菌敷料'}).first().click();
   await page.locator('#itemTip .medical-actions button').filter({hasText:'放入背包'}).click();
   assert(await page.evaluate(()=>Save.bagCount('heal02')===1));
   await page.locator('#btnDeploy').click();await page.locator('#btnMapStart').click();await page.waitForFunction(()=>Game.state==='playing');
   await page.evaluate(()=>{Game.enemies=[];Game.bullets=[];});
   assert(await page.evaluate(()=>Game.player.hp===40&&Game.player.bag.slots.some(e=>e.item.id==='heal02')&&Save.stashCount('heal02')===1));
   await page.keyboard.press('Tab');
   const bagBand=page.locator('#bagGrid .cell').filter({has:page.locator('.cn',{hasText:/^绷带$/})}).first();
   await bagBand.click();await page.locator('#itemTip [data-med="use"]').click();
   await page.keyboard.press('Tab');assert(await page.evaluate(()=>Game.action?.type==='heal'&&!Game.bagOpen));
   /* 治疗期间允许走路（30% 速度），走动不再打断读条 —— 打断交给冲刺 / 攻击 / Esc */
   await page.keyboard.down('d');await page.waitForTimeout(300);assert(await page.evaluate(()=>Game.action?.type==='heal'));await page.keyboard.up('d');
   await page.waitForFunction(()=>!Game.action);
   assert(await page.evaluate(()=>Math.round(Game.player.hp)===60&&Game.player.bag.slots.filter(e=>e.item.id==='heal01').reduce((n,e)=>n+e.n,0)===2));
   await page.evaluate(()=>{Game.player.vx=Game.player.vy=0;});await page.keyboard.press('Tab');await bagBand.click();await page.locator('#itemTip [data-med="use"]').click();await page.keyboard.press('Escape');
   assert(await page.evaluate(()=>!Game.action&&Math.round(Game.player.hp)===60));
   if(!(await page.evaluate(()=>Game.bagOpen)))await page.keyboard.press('Tab');
   await bagBand.click();await page.locator('#itemTip [data-med="use"]').click();await page.keyboard.press('Tab');
   await page.screenshot({path:path.join(output,entry==='index.html'?'healing-raid.png':'healing-offline.png')});
   /* 等这卷绷带彻底用完（容量归零才从背包移除），别在 79.5 就断言 */
   await page.waitForFunction(()=>Math.round(Game.player.hp)===80&&!Game.action);assert(await page.evaluate(()=>Game.player.bag.slots.filter(e=>e.item.id==='heal01').reduce((n,e)=>n+e.n,0)===1));
   await page.reload();await page.waitForFunction(()=>Game.state==='base');assert(await page.evaluate(()=>Math.round(Save.hp)===80),'刷新保留治疗后HP');
   assert.deepEqual(errors,[]);await context.close();
   console.log('OK: '+entry+' 医生10件/7件预留、实际购买/治疗/防重复、库存使用、医疗携带、局内读条与移动/Esc取消、关闭背包继续、刷新、320/390px');
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});
  for(const entry of ['wiki.html','物品清单.html']){
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#items');
   assert.equal(await page.locator('[data-item]').count(),itemTotal);assert.equal(await page.locator('[data-medical-group]').count(),5);
   assert.equal(await page.locator('[data-item-category="medical"] .item').count(),medTotal);
   assert.equal(await page.locator('[data-item-category="medical"] .thumb img').count(),medTotal);
   assert((await page.locator('[data-item="heal15"]').innerText()).includes('效果待开放'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
