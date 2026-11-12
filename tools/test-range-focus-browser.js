const {chromium}=require('playwright'),{pathToFileURL}=require('url');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/weapons/shooting-states-v1');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),reports=[];
 try{for(const file of ['index.html','潮汐线.html']){
  const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.clear());
  await p.goto(pathToFileURL(path.join(root,file)).href+'#range');
  await p.waitForFunction(()=>Range.active&&typeof RangeAim!=='undefined');
  await p.evaluate(()=>{Range.setPart('optic','att_optic04');Range.showPanel(false);});
  await p.waitForTimeout(350);
  const rect=await p.locator('#game').boundingBox();
  await p.mouse.move(rect.x+rect.width*650/720,rect.y+rect.height*.5);
  await p.waitForTimeout(180);
  const before=await p.evaluate(()=>({x:Game.input.wx,y:Game.input.wy,right:Game.cam.x+CFG.VIEW_W}));
  await p.mouse.down({button:'right'});await p.waitForTimeout(1100);
  const focused=await p.evaluate(()=>{const z=RangeAim.zoom(),P=Game.player;return{x:Game.input.wx,y:Game.input.wy,z,cam:Game.cam.x,right:Game.cam.x+CFG.VIEW_W/z,playerScreen:(P.x-Game.cam.x)*z,targetScreen:(Game.input.wx-Game.cam.x)*z,cursor:Game.canvas.style.cursor,state:{...P._rangeAim},view:RangeAim.opticView(P.weapon),bounds:RangeAim.observation(P,z)};});
  assert(Math.hypot(focused.x-before.x,focused.y-before.y)<1,'original aim point must stay fixed');
  assert(focused.playerScreen<0,'high-power observation can leave the player offscreen');
  assert(focused.right>before.right+80,'view must reach further than hip view');
  const expectedCam=Math.max(focused.bounds.minX,Math.min(focused.bounds.maxX,before.x-360/focused.z));
  assert(Math.abs(focused.cam-expectedCam)<1,'far point is centered unless the map or observation boundary is reached');
  assert.equal(focused.cursor,'none');
  await p.waitForTimeout(500);
  const stable=await p.evaluate(()=>Game.cam.x);assert(Math.abs(stable-focused.cam)<1,'no stationary-pointer drift');
  const shot=await p.evaluate(async()=>{
   const P=Game.player,s=RangeAim.state(P),before={a:s.a,z:s.zoom,x:Game.cam.x,y:Game.cam.y};
   P.fireCd=0;const fired=P.tryShoot(),after=s.a;
   let minZoom=s.zoom,maxShift=0;
   const start=performance.now();while(performance.now()-start<320){await new Promise(requestAnimationFrame);minZoom=Math.min(minZoom,s.zoom);maxShift=Math.max(maxShift,Math.hypot(Game.cam.x-before.x,Game.cam.y-before.y));}
   return{fired,before,after,minZoom,maxShift,recoil:P.recoil};
  });
  assert(shot.fired&&shot.after===shot.before.a,'first actual shot cannot reset settled ADS');
  assert(shot.minZoom>1.39&&shot.maxShift<1,'first shot must not collapse zoom or displace observation camera');
  // Move far enough to leave the map-edge clamp with the wider 1.4x window.
  await p.mouse.move(rect.x+rect.width*550/720,rect.y+rect.height*.5);
  await p.waitForTimeout(450);
  const moved=await p.evaluate(()=>({x:Game.input.wx,cam:Game.cam.x}));
  const expectedDelta=await p.evaluate(()=>-100*RangeAim.settings.panSpeed*RangeAim.observation(Game.player,RangeAim.zoom()).coverage/RangeAim.zoom());
  assert(Math.abs(moved.x-focused.x-expectedDelta)<1,'cursor scans the expanded observation area');
  assert(moved.cam<focused.cam-10,'zoom window follows the reticle');
  await p.waitForTimeout(400);assert(Math.abs((await p.evaluate(()=>Game.cam.x))-moved.cam)<1,'camera stops once the mouse stops');
  const limits=await p.evaluate(()=>{
   const P=Game.player,z=RangeAim.zoom(),bounds=RangeAim.observation(P,z);
   const original={...Game.input},anchor={...P._rangeAim.anchor},cam={...Game.cam};
   Game.input.mx+=10000;Game.input.my+=10000;
   Game.updateCamera(true);
   const atEdge={x:Game.cam.x,y:Game.cam.y,aimX:Game.input.wx,aimY:Game.input.wy};
   Game.input.mx-=20;Game.updateCamera(true);
   const reversed=Game.input.wx<atEdge.aimX;
   Object.assign(Game.input,original);
   P._rangeAim.anchor=anchor;Object.assign(Game.cam,cam);P.updateAimPoint(original.wx,original.wy);
   const low=RangeAim.observation({x:3000,y:3000},1.4,10000,10000,1.6);
   const high=RangeAim.observation({x:3000,y:3000},1.4,10000,10000,2.4);
   return{atEdge,bounds,reversed,lowSpan:low.right-low.left,highSpan:high.right-high.left};
  });
  assert(limits.atEdge.x<=limits.bounds.maxX&&limits.atEdge.y<=limits.bounds.maxY,'window stops at its observation boundary');
  assert(limits.atEdge.aimX<=limits.bounds.right&&limits.atEdge.aimY<=limits.bounds.bottom,'reticle cannot extend observation indefinitely');
  assert(limits.reversed&&limits.highSpan>limits.lowSpan,'edge reversal responds immediately and stronger optics extend observation');
  fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,file==='index.html'?'range-far-focus.png':'offline-range-far-focus.png')});
  await p.mouse.up({button:'right'});await p.waitForTimeout(650);
  const released=await p.evaluate(()=>({z:RangeAim.zoom(),anchor:Game.player._rangeAim.anchor,cursor:Game.canvas.style.cursor}));
  assert(Math.abs(released.z-1)<.01&&released.anchor===null&&released.cursor==='');
  assert.deepEqual(errors,[]);reports.push({file,before,focused,shot,moved,limits,released,passed:true});await p.close();
 }}finally{await b.close();}
 fs.writeFileSync(path.join(out,'focus-verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');
 console.log('PASS: pre-ADS focus, bounded observation window following, offscreen player, no drift, edge reversal and release; development/offline');
})().catch(e=>{console.error(e);process.exitCode=1});
