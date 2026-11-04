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
  /* 出发入口：旧壳是 #btnDeploy（进入游戏），新壳是 .sh-deploy（出发行动），谁可见点谁 */
  const deployBtn=()=>page.locator('#btnDeploy:visible, .sh-deploy:visible').first();
  /* 进图统一走这里：血量补满（上一局挨的枪会带回安全屋），
     真弹出出发提醒就点「继续出发」——这些换图用例测的是换图，不是提醒本身。 */
  const enterMap=async(mapId)=>{
    await page.evaluate(()=>{Save.hp=CFG.P.HP;Base.open();});
    await deployBtn().click();
    await page.locator('[data-map="'+mapId+'"]').click();
    await page.locator('#btnMapStart').click();
    if(await page.locator('#deployGoAnyway:visible').count())await page.locator('#deployGoAnyway').click();
    await page.waitForFunction(()=>Game.state==='playing');
  };
  await page.locator('#btnStart').click();assert(/进入游戏|出发行动/.test(await deployBtn().innerText()),'出发按钮文案变了');
  /* 老 id 'ammo' 会在存档归一化时迁到 ammo_556_1，种子直接用新 id 免得快照对不上 */
  await page.evaluate(()=>{Save.credits=200000;Save.stash=[{id:'ammo_556_1',n:20},{id:'heal01',n:1},{id:'antiq01',n:1},{id:'antiq01',n:1}];Save.bag=[{id:'ammo_556_1',n:60},{id:'heal01',n:1},{id:'heal01',n:1},{id:'heal01',n:1}];Base.render();});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({credits:Save.credits,stash:Save.stash,gear:Save.gear,runs:Save.runs}));
  const before=await snapshot();
  await deployBtn().click();await page.waitForFunction(()=>Game.state==='map-select');
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement?.classList.contains('map-choice')),'Tab 应能切换地图');
  await page.keyboard.press('Space');assert.equal(await page.locator('[data-map="fenced-zone"]').getAttribute('aria-pressed'),'true','空格可选择地图');
  assert.equal(await page.locator('#mapChoices [data-map]').count(),2);assert(await page.locator('[data-map="fenced-zone"]').innerText().then(s=>s.includes('围栏区')));
  assert.equal(await snapshot(),before,'浏览地图不能扣费');
  await page.locator('[data-map="fenced-zone"]').click();assert.equal(await page.locator('[data-map="fenced-zone"]').getAttribute('aria-pressed'),'true');
  assert.equal(await snapshot(),before,'切换地图不能扣费');
  await page.locator('#btnMapBack').click();assert.equal(await snapshot(),before,'返回不能扣费');assert(await page.evaluate(()=>Game.state==='base'));
  await deployBtn().click();await page.keyboard.press('Escape');assert(await page.evaluate(()=>Game.state==='base'));assert.equal(await snapshot(),before);
  await deployBtn().click();
  await page.screenshot({path:path.join(output,entry==='index.html'?'desktop.png':'offline-desktop.png')});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.locator('#mapVeil').evaluate(el=>el.scrollWidth<=el.clientWidth),'地图页横向溢出');await page.locator('[data-map="linhai-old-quarter"]').click();await page.locator('[data-map="fenced-zone"]').click();if(width===390)await page.screenshot({path:path.join(output,'mobile.png')});}
  await page.setViewportSize({width:1440,height:1000});
  const cost=0;   // 背包制：出发不花钱
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
  await enterMap('linhai-old-quarter');
  assert(await page.evaluate(()=>{Game.state='ended';return M.W===72&&M.H===56&&M.extracts.length===2&&!M.tideEnabled&&M.map.id==='linhai-old-quarter'&&M.map.props.length===RAID_MAP.props.length&&Game.enemies.length===RAID_MAP.enemies.length&&M.at(29,28).art==='canal_steps_w';}),'临海路切换失败');
  await enterMap('fenced-zone');
  assert(await page.evaluate(()=>{Game.state='ended';return M.W===64&&M.tideEnabled&&M.extracts.length===3&&!M.at(29,28).overlays.length&&canStand(Game.player.x,Game.player.y,7);}), '重新选围栏区残留新图状态');
  await page.evaluate(()=>{Base.open();Save.credits=0;Save.bag=[];Save.stash=[];Base.render();});
  const poor=await snapshot();await deployBtn().click();assert(!(await page.locator('#btnMapStart').isDisabled()),'出图不收费，空钱包也能出发');assert.equal(await snapshot(),poor);
  assert.deepEqual(errors,[]);console.log('OK: '+entry+' 改名/选择页/两图预览/返回与Escape/浏览不扣费/确认扣费/双图往返/旧图潮汐与三撤离/10秒模拟/320和390布局');await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
