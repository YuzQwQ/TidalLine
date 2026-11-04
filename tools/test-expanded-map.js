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
  assert(await page.evaluate(()=>Save.stash.filter(s=>s.id==='antiq01').length===2&&Save.stash.every(s=>s.id!=='antiq01'||s.n===1)&&Save.runs===3&&Save.gear.helmet.dur===20),'旧档保留');
  await page.locator('#btnStart').click();
  /* 安全屋外壳正在改版：出发入口从 #btnDeploy 换成了 .sh-deploy，旧壳里那个按钮被隐藏。
     两种都认，谁可见点谁，别让 UI 重构把地图回归卡死。 */
  await page.locator('#btnDeploy:visible, .sh-deploy:visible').first().click();
  await page.locator('#btnMapStart').click();
  await page.waitForFunction(()=>Game.state==='playing'&&Game.player);
  const result=await page.evaluate(()=>{
   Game.state='ended';Game.startRun();Game.state='ended';
   const before=Game.enemies.every(e=>canStand(e.x,e.y,e.r));
   Game.state='playing';for(let i=0;i<600;i++){Game.update(1/60);if(i%10===0)Game.render();}Game.state='ended';
   const safe=!Game.player.dead,stand=canStand(Game.player.x,Game.player.y,7)&&Game.enemies.filter(e=>!e.dead).every(e=>canStand(e.x,e.y,e.r));
   for(const ex of M.extracts){
    /* 墙体体积会投影进北侧半格，所以"格心"未必站得住，站位一律取 navigationPoint。 */
    const start=M.navigationPoint(7,4),actor={x:start.x,y:start.y,r:7},route=M.findPath(7,4,ex.x,ex.y);
    if(!route)throw Error('撤离无路径');
    for(const step of route){
     const p=M.navigationPoint(step.x,step.y);
     if(!canStand(p.x,p.y,7))throw Error('撤离路径落地不可站 '+step.x+','+step.y);
     /* 和局内一样按帧推进：相邻两格的站位高度可能差半格（墙体投影），一次 moveEntity 未必走满。 */
     for(let k=0;k<4;k++){const dx=p.x-actor.x,dy=p.y-actor.y;if(Math.hypot(dx,dy)<=2)break;moveEntity(actor,dx,dy);}
     if(Math.hypot(actor.x-p.x,actor.y-p.y)>2||!canStand(actor.x,actor.y,7))throw Error('撤离路径碰撞不一致 '+step.x+','+step.y);
    }
   }
   const d=M.at(52,34).door;Game.player.x=M.cx(51);Game.player.y=M.cy(34);Game.player.vx=Game.player.vy=0;
   /* 敌人巡逻也会开关门，跑完 10 秒模拟后门的初始状态不再固定。
      先把门统一摆成"开着"，再测玩家交互，否则断言会随巡逻路线随机红。 */
   if(!d.open)Game.handleInteract();
   Game.handleInteract();const closed=!d.open&&d.cells.every(([x,y])=>!M.walkable(x,y));
   Game.handleInteract();const opened=d.open&&d.cells.every(([x,y])=>M.walkable(x,y));
   Game.player.x=M.cx(52);Game.handleInteract();const cannotCloseOnActor=d.open;
   Game.startRun();Game.state='ended';Game.enemies=[];
   const box=Game.boxes[0];Game.player.x=box.x+24;Game.player.y=box.y;Game.player.vx=Game.player.vy=0;
   /* boxes[0] 是贵重容器（读条 2.6s），按品质的撬开时长推进，别用固定 1 秒 */
   Game.handleInteract();Game.updateAction(CONTAINER_QUALITY[box.kind].time+.1);const loot=Game.lootOpen===box;Game.closeLoot();const occupied=!canStand(box.x,box.y,7);
   Game.startRun();Game.state='ended';Game.time=600;Game.updateTide();
   const staticWater=Game.tideLevel===0&&M.extracts.every(ex=>M.findPath(7,4,ex.x,ex.y));
   Game.time=CFG.TIDE.ROUND;Game.updateTide();const timeout=document.getElementById('endVeil').textContent.includes('行动时间已结束');
   return {width:M.W,height:M.H,boxes:Game.boxes.length,enemies:SPAWNS.length,before,safe,stand,closed,opened,cannotCloseOnActor,loot,occupied,staticWater,timeout};
  });
  /* 箱子/敌人数量对齐编译快照，而不是写死数字：地图一改设计稿就会变，
     写死只会让人怀疑地图没载入。这里要抓的是"运行期没按快照铺满"。 */
  assert.equal(result.width,72);assert.equal(result.height,56);
  assert.equal(result.boxes,await page.evaluate(()=>RAID_MAP.containers.length),entry+' 容器数未对齐快照');
  assert.equal(result.enemies,await page.evaluate(()=>RAID_MAP.enemies.length),entry+' 敌人数未对齐快照');
  for(const k of ['before','safe','stand','closed','opened','cannotCloseOnActor','loot','occupied','staticWater','timeout'])assert(result[k],entry+' '+k);
  const render=await page.evaluate(()=>{
   const c=document.createElement('canvas').getContext('2d');c.canvas.width=720;c.canvas.height=480;
   const drawn=new Set(),real=c.drawImage.bind(c);c.drawImage=(img,...a)=>{for(const [key,value]of Object.entries(Art.map))if(value===img)drawn.add(key);real(img,...a);};
   M.seen.fill(1);M.visible.fill(1);
   for(const [x,y]of [[16,27],[32,13],[32,41],[32,27],[46,21],[13,39]])Game.renderTerrain(c,U.clamp(M.cx(x)-360,0,M.W*32-720),U.clamp(M.cy(y)-240,0,M.H*32-480));
   /* 只校验本图真用到的地块：素材库里还有 marsh / 夯实土这类「备着但本图没铺」的图块。 */
   const usedTiles=[...new Set(RAID_MAP.terrainRows.join('').split('').map(ch=>RAID_MAP.terrain[ch]&&RAID_MAP.terrain[ch].art).filter(Boolean))];
   const decoTiles=['wall_face_s','wall_face_e','canal_steps_e'];
   const all=RAID_MAP.overlays.every(o=>drawn.has('props/'+o.art))&&[...usedTiles,...decoTiles].every(id=>drawn.has('tiles/'+id));
   /* 迷雾：现在地形是"始终铺满 + 未探索区域压一层暗色"，
      所以不能再要求"一格都不画"（那是旧渲染的模型）。改验两件事：
      视野外地形照样绘制，且暗层把视口内每一格都盖住——漏一格就是透视野区。 */
   drawn.clear();M.seen.fill(0);M.visible.fill(0);Game.renderTerrain(c,0,0);
   const terrainAlwaysDrawn=drawn.size>0;
   let fogRects=0;const realRect=c.fillRect.bind(c);c.fillRect=(...a)=>{fogRects++;realRect(...a);};
   Game.renderFog(c,0,0);c.fillRect=realRect;
   const TS=CFG.TILE;
   const fogCells=Math.min(M.W,Math.ceil(CFG.VIEW_W/TS))*Math.min(M.H,Math.ceil(CFG.VIEW_H/TS));
   const fog=terrainAlwaysDrawn&&fogRects===fogCells;
   /* 双格门探针：同一块画面画两张——只有物件的一张、再加迷雾层的一张。
      迷雾是在物件之后统一压一层的（renderFog 排在 renderObjects 后），
      所以这里要验的是"第二格（不可见那半）在雾下确实被压暗"，
      而不是"贴图一格都不许画"——那是旧渲染模型的断言。
       canvas 被 file:// 贴图污染、不能 getImageData，照旧用截图取像素。 */
   const probeCanvas=(id,withFog)=>{const g=document.createElement('canvas').getContext('2d');
     g.canvas.width=720;g.canvas.height=480;g.fillStyle='#112233';g.fillRect(0,0,720,480);
     M.seen.fill(0);M.visible.fill(0);M.seen[M.idx(52,34)]=1;M.visible[M.idx(52,34)]=1;
     Game.renderObjects(g,52*32,34*32);if(withFog)Game.renderFog(g,52*32,34*32);
     /* 两张并排摆：叠在同一点的话，截下面那张会拍到上面那张的像素 */
     g.canvas.id=id;g.canvas.style.cssText='position:fixed;left:'+(withFog?720:0)+'px;top:0;width:720px;height:480px;z-index:99999';document.body.appendChild(g.canvas);};
   probeCanvas('doorNoFogProbe',false);probeCanvas('doorFogProbe',true);
   return {all,fog};
  });assert(render.all&&render.fog,entry+' 地块/结构未绘制或泄漏迷雾');
  /* 只看门的下半格（镜头对齐在门首格，第二格正好落在 y=32..64） */
  const cellMean=async(sel)=>{const shot=await page.locator(sel).screenshot();
    const px=await sharp(shot).extract({left:0,top:32,width:32,height:32}).removeAlpha().raw().toBuffer();
    let sum=0;for(let i=0;i<px.length;i+=3)sum+=(px[i]+px[i+1]+px[i+2])/3;return sum/(px.length/3);};
  const noFog=await cellMean('#doorNoFogProbe'),withFog=await cellMean('#doorFogProbe');
  /* 背景 #112233 的均值是 34：和它拉开差距才说明门贴图真的画到了第二格
     （下半格多半是暗部/阴影，不一定是亮色，所以只验"有东西"而不是"更亮"） */
  assert(Math.abs(noFog-34)>2,entry+' 双格门下半格什么都没画（均值 '+noFog.toFixed(1)+'）');
  assert(withFog<noFog*0.8,entry+' 双格门下半格在雾下没被压暗（'+noFog.toFixed(1)+' → '+withFog.toFixed(1)+'）');
  await page.locator('#doorNoFogProbe').evaluate(el=>el.remove());
  await page.locator('#doorFogProbe').evaluate(el=>el.remove());
  for(const [name,x,y]of [['apartment',13,16],['clinic',12,39],['clockshop',49,22],['bank',59,39],['north-bridge',32,14],['south-bridge',35,41]]){
   await page.evaluate(({x,y})=>{Game.startRun();Game.state='ended';M.visible.fill(1);M.seen.fill(1);Game.cam.x=U.clamp(M.cx(x)-360,0,M.W*32-720);Game.cam.y=U.clamp(M.cy(y)-240,0,M.H*32-480);Game.render();},{x,y});
   await page.locator('#frame').screenshot({path:path.join(out,(entry==='index.html'?'source-':'offline-')+name+'.png')});
  }
  for(const exit of ['A','B'])assert(await page.evaluate(id=>{Game.startRun();Game.state='ended';Game.enemies=[];const ex=M.extracts.find(e=>e.id===id);Game.player.x=M.cx(ex.x);Game.player.y=M.cy(ex.y);Game.player.vx=Game.player.vy=0;Game.handleInteract();const started=Game.action?.type==='extract';Game.updateAction(CFG.EXTRACT_TIME+.1);return started&&Game.state==='ended'&&document.getElementById('endVeil').textContent.includes('撤离成功');},exit),entry+' 撤离 '+exit);
  assert.deepEqual(errors,[]);console.log('OK: '+entry+' UI出发/旧档/贴图/10秒更新/双路线实走/双格门/搜刮/双撤离/静态水位/迷雾/6区域截图');console.log(JSON.stringify(result));await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
