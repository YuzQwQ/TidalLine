const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/weapons/arsenal-v1');
(async()=>{
 const art=JSON.parse(fs.readFileSync(path.join(out,'art/manifest.json'))),pixels=[];
 for(const a of art.assets){const {data,info}=await sharp(path.join(root,a.target)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,48);assert.equal(info.height,48);let visible=0;for(let y=0;y<48;y++)for(let x=0;x<48;x++){const alpha=data[(y*48+x)*4+3];assert(alpha===0||alpha===255,a.id+' binary alpha');if(alpha){visible++;assert(x>=4&&x<44&&y>=4&&y<44,a.id+' margin');}}assert(visible>65,a.id+' visible');pixels.push({id:a.id,visible});}
 const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
 try{
 for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));p.on('request',r=>{if(file!=='index.html'&&r.url().includes('/assets/')&&!r.url().includes('/sources/'))external.push(r.url());});
  await p.goto(pathToFileURL(path.join(root,file)).href+'#base');await p.waitForFunction(()=>typeof Gunplay!=='undefined'&&ART.gear.every(id=>Icons.gear[id])&&AMMO_ITEMS.every(i=>Icons.get(i.id)));
  assert.deepEqual(await p.evaluate(()=>({guns:Object.keys(WEAPONS).length,ammo:AMMO_ITEMS.length})),{guns:23,ammo:30});
  await p.evaluate(()=>{Save.credits=1e7;Save.stash=[];Save.bag=[];Safehouse.route('traders');MerchantUI.open('gun');});
  assert.equal(await p.locator('#shopGrid [data-offer]').count(),57);
  for(const id of ['m4a1','akm','famas_f1','pp19_01','mp5a3','ump45','mp155','rem870','saiga12','glock17','m1911a1','beretta92']){
   assert(await p.evaluate(id=>{const cell=[...document.querySelectorAll('#shopGrid [data-offer]')].find(n=>JSON.parse(n.dataset.offer).id===id);return !!cell?.querySelector('img')?.naturalWidth;},id));
  }
  await p.locator('#shopGrid [data-offer]').filter({has:p.locator('img[src*="akm"]')}).click().catch(async()=>{await p.evaluate(()=>document.querySelectorAll('#shopGrid [data-offer]')[1].click());});
  await p.locator('[data-mb-confirm]').click();await p.locator('#dealBox .go').click();assert(await p.evaluate(()=>Save.stash.some(e=>e.gear?.equip.gun==='akm')));
  await p.screenshot({path:path.join(out,file==='index.html'?'shop.png':'offline-shop.png')});
  await p.evaluate(()=>{
   Base.close();Save.gear.weapons=[EQUIP.gun('famas_f1',25),null,EQUIP.gun('glock17',17)];Save.gear.back=BACKPACK.make('bag05');Game.startRun(null);Game.enemies=[];Game.player.fireCd=0;Game.player.bag.addAmmo('ammo_556_1',30);Game.player.bag.addAmmo('ammo_9mm_1',30);Game.wantLock=()=>false;
  });
  await p.keyboard.press('b');assert.equal(await p.evaluate(()=>Game.player.weapon.fireMode),'semi');
  await p.keyboard.press('b');assert.equal(await p.evaluate(()=>Game.player.weapon.fireMode),'burst3');
  // Real canvas mouse input, held across several render frames: exactly one burst.
  const box=await p.locator('#game').boundingBox();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.4);await p.mouse.down();await p.waitForTimeout(600);await p.mouse.up();assert.equal(await p.evaluate(()=>Game.player.mag),22);
  await p.keyboard.press('3');await p.waitForTimeout(350);await p.mouse.down();await p.waitForTimeout(500);await p.mouse.up();assert.equal(await p.evaluate(()=>Game.player.mag),16);
  await p.keyboard.press('r');await p.waitForFunction(()=>Game.player.reloadPending);assert.equal(await p.evaluate(()=>Game.player.weapon.reloadTime),1.5);await p.waitForFunction(()=>!Game.player.reloadPending);assert.equal(await p.evaluate(()=>Game.player.mag),17);
  await p.evaluate(()=>{Game.player.switchWeapon(0);Game.toggleBag();Game.renderGearPanel();});
  await p.locator('#eqStrip .eqs').first().click({button:'right'});assert((await p.locator('#ctxMenu').innerText()).includes('切换射击模式'));await p.evaluate(()=>{Ctx.hide();if(Game.bagOpen)Game.toggleBag();});
  await p.evaluate(()=>{Game.player.fireCd=0;Game.player.weapons[0]=Object.assign({},WEAPONS.rem870,{magCur:6,rounds:Array(6).fill('ammo_12g_1'),fireMode:'pump'});Game.player.mag=6;Game.player.bag.addAmmo('ammo_12g_1',12);Game.renderGearPanel();});
  await p.mouse.click(box.x+box.width*.7,box.y+box.height*.4);await p.waitForTimeout(40);assert(await p.evaluate(()=>Game.player.weapon.cycleRemaining>0));await p.screenshot({path:path.join(out,file==='index.html'?'combat.png':'offline-combat.png')});
  for(const width of [390,320]){await p.setViewportSize({width,height:844});await p.waitForFunction(()=>document.getElementById('frame').getBoundingClientRect().width<=innerWidth);await p.evaluate(()=>{Base.open();Safehouse.route('traders');MerchantUI.open('gun');});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await p.locator('#shopGrid [data-offer]').count(),57);}
  assert.deepEqual(errors,[]);if(file!=='index.html')assert.deepEqual(external,[]);reports.push({file,errors,externalAssets:external.length,shop:true,burst:true,semi:true,reload:true,modeMenu:true,pump:true,widths:[1440,390,320]});await p.close();
 }
 const p=await browser.newPage();await p.goto(pathToFileURL(path.join(out,'art/index.html')).href);await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));assert.equal(await p.locator('article').count(),26);
 await p.goto(pathToFileURL(path.join(root,'装备清单.html')).href);assert.equal(await p.locator('.thumb img').count(),90);await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 await p.goto(pathToFileURL(path.join(root,'物品清单.html')).href);for(const cal of ['762x39','45acp'])for(let lv=1;lv<=5;lv++)assert((await p.locator(`[data-item="ammo_${cal}_${lv}"] img`).getAttribute('src')).includes('ammo_'+cal+'.png'));
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,pixels,reports},null,2)+'\n');console.log('PASS: 26 hard-alpha icons; development/offline 23 models, six calibers, shop, input, burst, semi, reload, pump, menu, 320/390px and Wiki');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
