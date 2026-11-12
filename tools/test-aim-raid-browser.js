const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/weapons/shooting-states-live');
const near=(a,b,t=.02)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{for(const file of ['index.html','潮汐线.html'])for(const mapIndex of [0,1]){
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{localStorage.clear();localStorage.setItem('tideline_save_v1',JSON.stringify({v:4,attachmentsVersion:2,hp:100,credits:1000000,stash:[],bag:[{id:'ammo_556_1',n:120},{id:'heal03',n:1,cap:100}],safe:[],gear:{weapons:[{equip:{kind:'gun',gun:'m4a1',mag:30,ammo:'ammo_556_1',attachments:{optic:'att_optic08'}}},null,null]}}));});
 await p.goto(pathToFileURL(path.join(root,file)).href+'#play');await p.waitForFunction(()=>typeof ShootingStance!=='undefined'&&ShootingStance.active());
 await p.evaluate(i=>{Save.bag=[{id:'ammo_556_1',n:120},{id:'heal03',n:1,cap:100}];Game.startRun(null,MAP_CATALOG[i].id);Game.enemies=[];},mapIndex);
 const read=()=>p.evaluate(()=>{const P=Game.player,s=ShootingStance.state(P);return{a:s.a,z:ShootingStance.zoom(),spread:P.spread,mag:P.mag,sprint:P.sprinting,dodge:P.dodgeCd,mode:s.mode,range:Game.rangeMode,active:ShootingStance.active(),map:Game.mapId};});
 const rect=await p.locator('#game').boundingBox();await p.mouse.move(rect.x+rect.width*.82,rect.y+rect.height*.5);await p.waitForTimeout(300);
 const hip=await read();assert(hip.active&&!hip.range);near(hip.a,0);near(hip.z,1);
 await p.keyboard.down('Shift');await p.waitForTimeout(550);const shoulder=await read();near(shoulder.a,.55);near(shoulder.z,1.08);near(shoulder.spread/hip.spread,.725,.005);await p.keyboard.up('Shift');
 await p.mouse.down({button:'right'});await p.waitForTimeout(1100);const ads=await read();near(ads.a,1);near(ads.z,1.4);near(ads.spread/hip.spread,.325,.005);near(ads.dodge,0);
 await p.screenshot({path:path.join(out,(file==='index.html'?'runtime':'offline')+'-map'+mapIndex+'-ads.png')});
 const shot=await p.evaluate(async()=>{const s=ShootingStance.state(Game.player),before={a:s.a,z:s.zoom,x:Game.cam.x,y:Game.cam.y},mag=Game.player.mag;Game.player.fireCd=0;const fired=Game.player.tryShoot();let min=s.zoom,shift=0;const start=performance.now();while(performance.now()-start<300){await new Promise(requestAnimationFrame);min=Math.min(min,s.zoom);shift=Math.max(shift,Math.hypot(Game.cam.x-before.x,Game.cam.y-before.y));}return{fired,min,shift,a:s.a,mag:Game.player.mag,beforeMag:mag};});
 assert(shot.fired&&shot.mag===shot.beforeMag-1&&shot.min>1.39&&shot.shift<1&&shot.a===1,'first formal shot keeps settled ADS');
 assert(await p.evaluate(()=>!document.pointerLockElement),'canvas clicks preserve native mouse');
 await p.keyboard.down('w');await p.waitForTimeout(150);assert((await read()).a>.99,'walking does not restart ADS');
 await p.keyboard.down('Space');await p.waitForTimeout(350);const sprint=await read();assert(sprint.sprint&&sprint.a===0&&sprint.dodge===0);
 await p.keyboard.up('Space');await p.keyboard.up('w');await p.waitForTimeout(900);near((await read()).a,1);
 await p.mouse.up({button:'right'});await p.waitForTimeout(350);
 await p.keyboard.down('Space');await p.waitForTimeout(40);await p.keyboard.up('Space');await p.waitForTimeout(35);assert((await read()).dodge>.8,'short space dodges');await p.waitForTimeout(1250);
 await p.mouse.down({button:'right'});await p.waitForTimeout(950);await p.keyboard.press('r');await p.waitForTimeout(200);near((await read()).a,0);await p.waitForTimeout(2800);near((await read()).a,1);
 await p.keyboard.press('Tab');await p.waitForTimeout(400);assert(await p.evaluate(()=>Game.bagOpen&&!ShootingStance.right&&!ShootingStance.state(Game.player).anchor));near((await read()).z,1);
 await p.mouse.up({button:'right'});await p.keyboard.press('Tab');await p.waitForTimeout(300);near((await read()).a,0);
 await p.evaluate(()=>{Game.player.hp=70;const entry=Game.player.bag.slots.find(e=>e.item.id==='heal03');if(!Medical.use(entry,'bag'))throw Error('Cannot start medical fixture');});
 await p.mouse.down({button:'right'});await p.waitForTimeout(200);near((await read()).a,0);assert(await p.evaluate(()=>Game.action?.type==='heal'));
 await p.keyboard.press('Escape');await p.waitForTimeout(900);near((await read()).a,1);await p.mouse.up({button:'right'});
 await p.mouse.down({button:'right'});await p.waitForTimeout(950);await p.keyboard.press('4');await p.waitForTimeout(350);assert(await p.evaluate(()=>Game.player.meleeActive));near((await read()).z,1);await p.keyboard.press('1');await p.waitForTimeout(950);near((await read()).a,1);
 await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(400);near((await read()).z,1);assert(await p.evaluate(()=>!ShootingStance.right&&ShootingStance.spaceAt===null));await p.mouse.up({button:'right'});
 // Use the real FOV on an unobstructed test patch, then insert an opaque wall.
 await p.evaluate(()=>{M.load(Array(80).fill('.'.repeat(100)),null,[],null);Game.player.x=1600;Game.player.y=1200;Game.player.hp=100;ShootingStance.reset();Game.updateCamera(true);});
 await p.mouse.move(rect.x+rect.width*.88,rect.y+rect.height*.5);await p.waitForTimeout(400);
 assert(await p.evaluate(()=>!M.visible[M.idx(M.tx(Game.player.x)+20,M.ty(Game.player.y))]),'hip vision stays at its ordinary radius');
 await p.mouse.down({button:'right'});await p.waitForTimeout(1100);
 const vision=await p.evaluate(()=>{const P=Game.player,b=ShootingStance.observation(P,ShootingStance.zoom());return{visible:!!M.visible[M.idx(M.tx(P.x)+20,M.ty(P.y))],radius:ShootingStance.visionRadius(P),b};});assert(vision.visible&&vision.radius>30,'ADS actually reveals unobstructed distant cells');
 const limit=await p.evaluate(()=>{const K=Game.input;K.mx+=10000;Game.updateCamera(true);const b=ShootingStance.observation(Game.player,ShootingStance.zoom());return{x:Game.cam.x,y:Game.cam.y,wx:K.wx,wy:K.wy,b};});
 assert(limit.x<=limit.b.maxX&&limit.y<=limit.b.maxY&&limit.wx<=limit.b.right&&limit.wy<=limit.b.bottom,'camera and reticle remain bounded');
 // Aim east again; only opacity changes, not player position or optic.
 await p.mouse.up({button:'right'});await p.waitForTimeout(400);await p.evaluate(()=>{Game.input.mx=CFG.VIEW_W*.88;Game.input.my=CFG.VIEW_H/2;Game.updateCamera(true);const x=M.tx(Game.player.x)+10,y=M.ty(Game.player.y);for(let dy=-4;dy<=4;dy++)Object.assign(M.at(x,y+dy),{solid:true,opaque:true,ch:'#',art:'wall'});});
 await p.mouse.move(rect.x+rect.width*.88,rect.y+rect.height*.5);await p.mouse.down({button:'right'});await p.waitForTimeout(1100);
 assert(await p.evaluate(()=>!M.visible[M.idx(M.tx(Game.player.x)+20,M.ty(Game.player.y))]),'ADS cannot reveal enemies behind an opaque wall');
 await p.evaluate(()=>Game.beginDying());assert(await p.evaluate(()=>Game.state==='dying'&&ShootingStance.zoom()===1&&!ShootingStance.right));
 assert.deepEqual(errors,[]);reports.push({file,mapIndex,hip,shoulder,ads,shot,sprint,vision,limit,passed:true});await p.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');console.log('PASS: two formal maps, ordinary/offline ADS, shoulder, first shot, walk/sprint/dodge, reload, bag/melee/blur/death, bounded camera and real FOV with wall occlusion');
})().catch(e=>{console.error(e);process.exitCode=1;});
