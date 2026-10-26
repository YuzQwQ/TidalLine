/* 多文件 + 单文件离线实机验证；需要 playwright / Edge。 */
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url'),{chromium}=require('playwright');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/map/linhai');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const entry of ['index.html','潮汐线.html']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
  await page.addInitScript(()=>localStorage.setItem('tideline_save_v1',JSON.stringify({v:2,credits:9999,runs:3,stash:[{id:'antiq01',n:2}],codex:{antiq01:true},loadout:{ammo:60,bandage:3,stone:3},gear:{weapons:['rifle','shotgun','pistol'],helmet:{type:'helmet',lv:2,dur:20},body:null}})));
  await page.goto(pathToFileURL(path.join(root,entry)).href);
  await page.waitForFunction(()=>typeof Game!=='undefined'&&ART.props.every(id=>Art.get('props',id))&&ART.tiles.every(id=>Art.get('tiles',id)));
  assert(await page.evaluate(()=>Save.stash.some(s=>s.id==='antiq01'&&s.n===2)&&Save.runs===3&&Save.gear.helmet.dur===20),'旧档保留');
  await page.locator('#btnStart').click();await page.locator('#btnDeploy').click();await page.locator('#btnMapStart').click();
  await page.waitForFunction(()=>Game.state==='playing'&&Game.player);
  const result=await page.evaluate(()=>{
   Game.state='ended';Game.startRun();Game.state='ended';
   const before=Game.enemies.every(e=>canStand(e.x,e.y,e.r));
   Game.state='playing';for(let i=0;i<600;i++){Game.update(1/60);if(i%10===0)Game.render();}Game.state='ended';
   const safe=!Game.player.dead,stand=canStand(Game.player.x,Game.player.y,7)&&Game.enemies.filter(e=>!e.dead).every(e=>canStand(e.x,e.y,e.r));
   for(const ex of M.extracts){
    const actor={x:M.cx(7),y:M.cy(4),r:7},route=M.findPath(7,4,ex.x,ex.y);if(!route)throw Error('撤离无路径');
    for(const step of route){const x=M.cx(step.x),y=M.cy(step.y);moveEntity(actor,x-actor.x,y-actor.y);if(Math.hypot(actor.x-x,actor.y-y)>.1||!canStand(actor.x,actor.y,7))throw Error('撤离路径碰撞不一致');}
   }
   const d=M.at(52,34).door;Game.player.x=M.cx(51);Game.player.y=M.cy(34);Game.player.vx=Game.player.vy=0;
   Game.handleInteract();const closed=!d.open&&d.cells.every(([x,y])=>!M.walkable(x,y));
   Game.handleInteract();const opened=d.open&&d.cells.every(([x,y])=>M.walkable(x,y));
   Game.player.x=M.cx(52);Game.handleInteract();const cannotCloseOnActor=d.open;
   Game.startRun();Game.state='ended';Game.enemies=[];
   const box=Game.boxes[0];Game.player.x=box.x+24;Game.player.y=box.y;Game.player.vx=Game.player.vy=0;
   Game.handleInteract();Game.updateAction(1);const loot=Game.lootOpen===box;Game.closeLoot();const occupied=!canStand(box.x,box.y,7);
   Game.startRun();Game.state='ended';Game.time=600;Game.updateTide();
   const staticWater=Game.tideLevel===0&&M.extracts.every(ex=>M.findPath(7,4,ex.x,ex.y));
   Game.time=CFG.TIDE.ROUND;Game.updateTide();const timeout=document.getElementById('endVeil').textContent.includes('行动时间已结束');
   return {width:M.W,height:M.H,boxes:Game.boxes.length,enemies:SPAWNS.length,before,safe,stand,closed,opened,cannotCloseOnActor,loot,occupied,staticWater,timeout};
  });
  assert.equal(result.width,72);assert.equal(result.height,56);assert.equal(result.boxes,41);assert.equal(result.enemies,24);
  for(const k of ['before','safe','stand','closed','opened','cannotCloseOnActor','loot','occupied','staticWater','timeout'])assert(result[k],entry+' '+k);
  const render=await page.evaluate(()=>{
   const c=document.createElement('canvas').getContext('2d');c.canvas.width=720;c.canvas.height=480;
   const drawn=new Set(),real=c.drawImage.bind(c);c.drawImage=(img,...a)=>{for(const [key,value]of Object.entries(Art.map))if(value===img)drawn.add(key);real(img,...a);};
   M.seen.fill(1);M.visible.fill(1);
   for(const [x,y]of [[16,27],[32,13],[32,41],[32,27],[46,21],[13,39]])Game.renderTerrain(c,U.clamp(M.cx(x)-360,0,M.W*32-720),U.clamp(M.cy(y)-240,0,M.H*32-480));
   const all=RAID_MAP.overlays.every(o=>drawn.has('props/'+o.art))&&ART.tiles.filter(id=>!['marsh'].includes(id)).every(id=>drawn.has('tiles/'+id));
   drawn.clear();M.seen.fill(0);M.visible.fill(0);Game.renderTerrain(c,0,0);
   const fog=drawn.size===0;
   c.clearRect(0,0,720,480);c.fillStyle='#112233';c.fillRect(0,0,720,480);
   M.seen[M.idx(52,34)]=1;M.visible[M.idx(52,34)]=1;
   Game.renderObjects(c,52*32,34*32);
   // file:// 的贴图会使 canvas 禁止 getImageData，使用浏览器截图验证最终像素。
   c.canvas.id='doorFogProbe';c.canvas.style.cssText='position:fixed;left:0;top:0;width:720px;height:480px;z-index:99999';document.body.appendChild(c.canvas);
   return {all,fog};
  });assert(render.all&&render.fog,entry+' 地块/结构未绘制或泄漏迷雾');
  const probe=await page.locator('#doorFogProbe').screenshot();
  const pixels=await sharp(probe).extract({left:0,top:32,width:32,height:32}).removeAlpha().raw().toBuffer();
  assert(Array.from(pixels).every((v,i)=>v===[17,34,51][i%3]),entry+' 双格门泄漏迷雾');
  await page.locator('#doorFogProbe').evaluate(el=>el.remove());
  for(const [name,x,y]of [['apartment',13,16],['clinic',12,39],['clockshop',49,22],['bank',59,39],['north-bridge',32,14],['south-bridge',35,41]]){
   await page.evaluate(({x,y})=>{Game.startRun();Game.state='ended';M.visible.fill(1);M.seen.fill(1);Game.cam.x=U.clamp(M.cx(x)-360,0,M.W*32-720);Game.cam.y=U.clamp(M.cy(y)-240,0,M.H*32-480);Game.render();},{x,y});
   await page.locator('#frame').screenshot({path:path.join(out,(entry==='index.html'?'source-':'offline-')+name+'.png')});
  }
  for(const exit of ['A','B'])assert(await page.evaluate(id=>{Game.startRun();Game.state='ended';Game.enemies=[];const ex=M.extracts.find(e=>e.id===id);Game.player.x=M.cx(ex.x);Game.player.y=M.cy(ex.y);Game.player.vx=Game.player.vy=0;Game.handleInteract();const started=Game.action?.type==='extract';Game.updateAction(CFG.EXTRACT_TIME+.1);return started&&Game.state==='ended'&&document.getElementById('endVeil').textContent.includes('撤离成功');},exit),entry+' 撤离 '+exit);
  assert.deepEqual(errors,[]);console.log('OK: '+entry+' UI出发/旧档/贴图/10秒更新/双路线实走/双格门/搜刮/双撤离/静态水位/迷雾/6区域截图');console.log(JSON.stringify(result));await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
