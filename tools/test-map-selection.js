/* 地图选择与双地图回归：浏览不扣费，确认后加载对应地图。 */
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/map-selection');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const entry of ['index.html','潮汐线.html']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
  await page.goto(pathToFileURL(path.join(root,entry)).href);
  await page.waitForFunction(()=>typeof Game!=='undefined'&&ART.tiles.every(id=>Art.get('tiles',id)));
  await page.locator('#btnStart').click();assert.equal(await page.locator('#btnDeploy').textContent(),'进入游戏');
  await page.evaluate(()=>{Save.credits=200000;Save.stash=[{id:'ammo',n:20},{id:'heal01',n:1},{id:'antiq01',n:2}];Save.loadout={ammo:60,bandage:3,stone:3};Base.render();});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({credits:Save.credits,stash:Save.stash,gear:Save.gear,runs:Save.runs}));
  const before=await snapshot();
  await page.locator('#btnDeploy').click();await page.waitForFunction(()=>Game.state==='map-select');
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement?.classList.contains('map-choice')),'Tab 应能切换地图');
  await page.keyboard.press('Space');assert.equal(await page.locator('[data-map="fenced-zone"]').getAttribute('aria-pressed'),'true','空格可选择地图');
  assert.equal(await page.locator('#mapChoices [data-map]').count(),2);assert(await page.locator('[data-map="fenced-zone"]').innerText().then(s=>s.includes('围栏区')));
  assert.equal(await snapshot(),before,'浏览地图不能扣费');
  await page.locator('[data-map="fenced-zone"]').click();assert.equal(await page.locator('[data-map="fenced-zone"]').getAttribute('aria-pressed'),'true');
  assert.equal(await snapshot(),before,'切换地图不能扣费');
  await page.locator('#btnMapBack').click();assert.equal(await snapshot(),before,'返回不能扣费');assert(await page.evaluate(()=>Game.state==='base'));
  await page.locator('#btnDeploy').click();await page.keyboard.press('Escape');assert(await page.evaluate(()=>Game.state==='base'));assert.equal(await snapshot(),before);
  await page.locator('#btnDeploy').click();
  await page.screenshot({path:path.join(output,entry==='index.html'?'desktop.png':'offline-desktop.png')});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.locator('#mapVeil').evaluate(el=>el.scrollWidth<=el.clientWidth),'地图页横向溢出');await page.locator('[data-map="linhai-old-quarter"]').click();await page.locator('[data-map="fenced-zone"]').click();if(width===390)await page.screenshot({path:path.join(output,'mobile.png')});}
  await page.setViewportSize({width:1440,height:1000});
  const cost=await page.evaluate(()=>Base.computeCost());
  await page.locator('#btnMapStart').click();await page.waitForFunction(()=>Game.state==='playing');
  const old=await page.evaluate(()=>{
   Game.state='ended';
   const result={id:Game.mapId,title:M.map.title,width:M.W,height:M.H,boxes:Game.boxes.length,enemies:Game.enemies.length,exits:M.extracts.length,props:M.map.props.length,credits:Save.credits,ammo:Save.stashCount('ammo'),safe:M.extracts.every(ex=>M.findPath(M.playerSpawn.x,M.playerSpawn.y,ex.x,ex.y)),stand:Game.enemies.every(e=>canStand(e.x,e.y,e.r))};
   Game.time=600;Game.updateTide();result.tide=Game.tideLevel;result.dockBlocked=!M.walkable(52,37);
   Game.startRun(undefined,'fenced-zone');Game.state='ended';
   const stableStart=Game.enemies.every(e=>canStand(e.x,e.y,e.r));Game.state='playing';for(let i=0;i<600;i++)Game.update(1/60);Game.state='ended';
   result.simulation=stableStart&&!Game.player.dead&&Game.enemies.filter(e=>!e.dead).every(e=>canStand(e.x,e.y,e.r));
   return result;
  });
  assert.equal(old.id,'fenced-zone');assert.equal(old.title,'围栏区');assert.equal(old.width,64);assert.equal(old.height,44);assert.equal(old.boxes,41);assert.equal(old.enemies,24);assert.equal(old.exits,3);assert.equal(old.props,42);
  assert.equal(old.credits,200000-cost);assert.equal(old.ammo,0);assert(old.safe&&old.stand&&old.tide>1.05&&old.dockBlocked&&old.simulation,'旧地图通路/潮汐/出生碰撞必须保留');
  await page.evaluate(()=>Base.open());await page.locator('#btnDeploy').click();await page.locator('[data-map="linhai-old-quarter"]').click();await page.locator('#btnMapStart').click();await page.waitForFunction(()=>Game.state==='playing');
  assert(await page.evaluate(()=>{Game.state='ended';return M.W===72&&M.H===56&&M.extracts.length===2&&!M.tideEnabled&&M.map.id==='linhai-old-quarter'&&M.map.props.length===40&&Game.enemies.length===24&&M.at(29,28).art==='canal_steps_w';}),'临海路切换失败');
  await page.evaluate(()=>Base.open());await page.locator('#btnDeploy').click();await page.locator('[data-map="fenced-zone"]').click();await page.locator('#btnMapStart').click();await page.waitForFunction(()=>Game.state==='playing');
  assert(await page.evaluate(()=>{Game.state='ended';return M.W===64&&M.tideEnabled&&M.extracts.length===3&&!M.at(29,28).overlays.length&&canStand(Game.player.x,Game.player.y,7);}), '重新选围栏区残留新图状态');
  await page.evaluate(()=>{Base.open();Save.credits=20000;Save.loadout={ammo:120,bandage:5,stone:5};Save.stash=[];Base.render();});
  const poor=await snapshot();await page.locator('#btnDeploy').click();assert(await page.locator('#btnMapStart').isDisabled(),'补给不足应禁用出发');assert.equal(await snapshot(),poor);
  assert.deepEqual(errors,[]);console.log('OK: '+entry+' 改名/选择页/两图预览/返回与Escape/浏览不扣费/确认扣费/双图往返/旧图潮汐与三撤离/10秒模拟/320和390布局');await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
