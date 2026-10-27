const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/economy');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const entry of ['index.html','潮汐线.html']){
   const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#base');await page.waitForFunction(()=>Game.state==='base'&&ITEMS.every(i=>Icons.get(i.id)));
   assert.equal(await page.locator('#bCredits').innerText(),'¥60,000');assert.equal(await page.locator('#carryCost').innerText(),'¥19,500');
   await page.evaluate(()=>{
    const armor=EQUIP.armor(GEAR.make('helmet',4,17));armor.price=600;armor.sell=78;armor.equip.gear.price=600;
    const gun=EQUIP.gun('smg',7);gun.price=420;gun.sell=210;
    localStorage.setItem(Save.key,JSON.stringify({v:3,credits:12345,hp:1,runs:8,stash:[{id:armor.id,n:1,gear:armor},{id:gun.id,n:1,gear:gun},{id:'odd02',n:1}],gear:{weapons:['rifle','shotgun','pistol'],helmet:{lv:4,dur:13},body:null},loadout:{ammo:60,bandage:3,stone:3}}));
   });
   await page.reload();await page.waitForFunction(()=>Game.state==='base'&&ITEMS.every(i=>Icons.get(i.id)));
   assert.equal(await page.locator('#bCredits').innerText(),'¥12,345');assert.equal(await page.locator('#carryCost').innerText(),'救济补给 · 免费');
   assert(await page.evaluate(()=>Save.credits===12345&&Save.hp===1&&Save.runs===8&&Save.stash.find(e=>e.id==='g_helmet4').gear.price===48000&&Save.stash.find(e=>e.id==='g_helmet4').gear.equip.gear.dur===17&&Save.stash.find(e=>e.id==='g_smg').gear.equip.mag===7&&Save.stash.find(e=>e.id==='g_smg').gear.sell===19000));
   await page.evaluate(()=>Tips.show(Save.stash.find(e=>e.id==='g_helmet4').gear,{left:100,top:150,right:150}));
   const tip=await page.locator('#itemTip').innerText();assert(tip.includes('¥48,000')&&tip.includes('¥6,276'));await page.evaluate(()=>{Tips.hide();Save.credits=60000;Base.render();});
   await page.locator('[data-t="shop"]').click();const cap=page.locator('#shopGrid .scell').filter({has:page.locator('.cn',{hasText:/^工帽$/})});
   assert.equal(await cap.locator('.pr').innerText(),'¥2,000');await cap.click();await page.locator('#dealBox [data-a="go"]').click();assert(await page.evaluate(()=>Save.credits===58000));
   const owned=page.locator('#stashGrid .scell').filter({has:page.locator('.cn',{hasText:/^工帽$/})});await owned.click();assert((await page.locator('#dealBox').innerText()).includes('¥1,000'));await page.locator('#dealBox [data-a="go"]').click();assert(await page.evaluate(()=>Save.credits===59000));
   await page.locator('[data-t="doctor"]').click();assert((await page.locator('#doctorService').innerText()).includes('¥12,500'));
   assert.equal(await page.locator('[data-medical="heal02"] .pr').innerText(),'¥5,000');await page.locator('[data-medical="heal02"]').click();await page.locator('#dealBox [data-a="go"]').click();assert(await page.evaluate(()=>Save.credits===54000&&Save.stashCount('heal02')===1));
   await page.locator('#btnDoctorTreat').click();await page.locator('#dealBox [data-a="go"]').evaluate(button=>{button.click();button.click();});assert(await page.evaluate(()=>Save.hp===100&&Save.credits===41500));
   await page.locator('[data-t="gun"]').click();const pistol=page.locator('#shopGrid .scell').filter({has:page.locator('.cn',{hasText:/^手枪$/})});assert.equal(await pistol.locator('.pr').innerText(),'¥5,000');await pistol.click();await page.locator('#dealBox [data-a="go"]').click();assert(await page.evaluate(()=>Save.credits===36500));
   await page.locator('#stashGrid .scell').filter({has:page.locator('.cn',{hasText:/^潮汐仪$/})}).click();assert((await page.locator('#dealBox').innerText()).includes('¥3,000,000'));await page.locator('#dealBox [data-a="go"]').click();assert(await page.evaluate(()=>Save.credits===3036500));
   await page.screenshot({path:path.join(output,entry==='index.html'?'shops-source.png':'shops-offline.png')});
   for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.locator('[data-t="doctor"]').click();await page.evaluate(()=>{Save.hp=1;Base.render();});
    assert(await page.locator('#baseVeil').evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert(await page.locator('#shopGrid .pr').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().right<=n.parentElement.getBoundingClientRect().right+1)));
    if(width===390)await page.screenshot({path:path.join(output,'doctor-mobile.png')});
   }
   assert.deepEqual(errors,[]);await context.close();console.log('OK: '+entry+' 新档6万/旧余额保留/旧装备估值/原耐久余弹/防具买卖/医生新价与诊费/枪械买价/300万交易/千位格式/320和390');
  }
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  for(const entry of ['wiki.html','物品清单.html']){
   await page.goto(pathToFileURL(path.join(root,entry)).href+'#items');assert.equal(await page.locator('[data-value-band]').count(),6);
   assert((await page.locator('[data-value-band="1"]').innerText()).includes('¥1,000–¥3,000'));assert((await page.locator('[data-value-band="6"]').innerText()).includes('¥200,000–¥3,000,000+'));
   for(const [id,price]of [['odd02','¥3,000,000'],['heal13','¥25,000'],['life28','¥250,000']])assert((await page.locator('[data-item="'+id+'"] .sub').innerText()).includes(price));
   if(entry==='wiki.html')await page.locator('.economy-guide').screenshot({path:path.join(output,'value-bands.png')});
   for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.setViewportSize({width:1440,height:1000});
  }
  await page.goto(pathToFileURL(path.join(root,'装备清单.html')).href);const text=await page.locator('.wiki-sheet').innerText();assert(text.includes('¥45,000')&&text.includes('¥650,000')&&!text.includes('undefined'));
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
