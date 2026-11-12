const {chromium}=require('playwright'),{pathToFileURL}=require('url');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/weapons/shooting-states-v1');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
 const near=(a,b,t=.01)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
 try{for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.clear());
  await p.goto(pathToFileURL(path.join(root,file)).href+'#range');
  await p.waitForFunction(()=>typeof RangeAim!=='undefined'&&RangeAim.active()&&Game.player.weapon.adsPrecisionMul!=null);
  const read=()=>p.evaluate(()=>{const P=Game.player;return{a:P._rangeAim.a,zoom:RangeAim.zoom(),spread:P.spread,mode:P._rangeAim.mode,sprint:P.sprinting,dodge:P.dodgeCd};});
  const hip=await read();near(hip.a,0);near(hip.zoom,1);
  await p.keyboard.down('Shift');await p.waitForTimeout(450);
  const shoulder=await read();near(shoulder.a,.55);near(shoulder.zoom,1.08);near(shoulder.spread/hip.spread,.725);
  await p.mouse.move(700,400);await p.mouse.down({button:'right'});await p.waitForTimeout(500);
  const ads=await read();near(ads.a,1);near(ads.zoom,1.15);near(ads.spread/hip.spread,.5);assert.equal(ads.dodge,0);
  const formula=await p.evaluate(()=>{
   const P=Game.player,w=P.weapon,R=CFG.RECOIL,store=JSON.stringify({bag:Save.bag,stash:Save.stash,gear:Save.gear});
   P.recoil=.8;P.rV=9;P.rH=4;RangeAim.updateAim(P,.01);
   const preserved=P.recoil===.8&&P.rV===9&&P.rH===4;
   P.recoil=0;P.rV=0;P.rH=0;P.frameTravel=0;P.sprinting=false;P.sinceShot=1;
   Firearms.kick(P,w);const kick={growth:P.recoil,vertical:P.rV};
   const expected={growth:Firearms.derive(w).growth*RangeAim.settings.adsGrowth,vertical:Firearms.derive(w).vKick*RangeAim.settings.adsV};
   P.recoil=P.rV=P.rH=0;P.syncSpread();
   return{preserved,kick,expected,rpm:w.rpm,baseRpm:WEAPONS[w.id].rpm,store};
  });
  assert(formula.preserved);near(formula.kick.growth,formula.expected.growth,.00001);near(formula.kick.vertical,formula.expected.vertical,.00001);assert.equal(formula.rpm,formula.baseRpm);
  // Optics use the existing parts test bench; zoom changes without buffing hip precision.
  await p.mouse.up({button:'right'});await p.keyboard.up('Shift');
  await p.evaluate(()=>Range.setPart('optic','att_optic04'));await p.waitForTimeout(450);
  near((await read()).spread,hip.spread);
  await p.mouse.down({button:'right'});await p.waitForTimeout(750);
  near((await read()).zoom,1.4,.02);
  const aligned=await p.evaluate(()=>{const z=RangeAim.zoom(),P=Game.player,cursor=RangeAim.screenCursor(Game.cam.x,Game.cam.y);return Math.hypot((P.aimPoint.x-Game.cam.x)*z-cursor.x,(P.aimPoint.y-Game.cam.y)*z-cursor.y);});
  assert(aligned<.1,'zoomed cursor/world conversion');
  await p.keyboard.down('w');await p.waitForTimeout(180);assert((await read()).a>.99,'moving ADS must not reset');
  await p.keyboard.down('Space');await p.waitForTimeout(400);
  const sprint=await read();assert(sprint.sprint&&sprint.a===0&&sprint.dodge===0);
  await p.keyboard.up('Space');await p.keyboard.up('w');await p.waitForTimeout(750);
  assert((await read()).a>.99,'held RMB resumes ADS after sprint');
  await p.mouse.up({button:'right'});await p.waitForTimeout(250);
  await p.keyboard.down('Space');await p.waitForTimeout(45);await p.keyboard.up('Space');
  await p.waitForTimeout(35);assert((await read()).dodge>.8,'short space dodges');
  await p.waitForTimeout(1200);assert.equal((await read()).dodge,0);
  // Configure and reset the live global rules without writing the player's save.
  await p.locator('[data-range-aim] summary').click();
  await p.locator('[data-ra-setting="shoulderZoom"]').fill('1.12');await p.locator('[data-ra-setting="shoulderZoom"]').dispatchEvent('change');
  near(await p.evaluate(()=>RangeAim.settings.shoulderZoom),1.12);
  await p.locator('[data-ra-reset]').click();near(await p.evaluate(()=>RangeAim.settings.shoulderZoom),1.08);
  await p.keyboard.down('Shift');await p.waitForTimeout(450);
  fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,file==='index.html'?'range-shoulder.png':'offline-range-shoulder.png')});
  await p.keyboard.up('Shift');await p.mouse.move(700,400);await p.mouse.down({button:'right'});await p.waitForTimeout(750);
  near((await read()).zoom,1.4,.02);
  await p.screenshot({path:path.join(out,file==='index.html'?'range-ads.png':'offline-range-ads.png')});await p.mouse.up({button:'right'});
  const isolated=await p.evaluate(saved=>{
   const unchanged=saved===JSON.stringify({bag:Save.bag,stash:Save.stash,gear:Save.gear});
   Range.exit();Game.rangeMode=false;const P=Game.player;
   P.recoil=0;P.moving=false;P.sprinting=false;P.sneaking=false;P.aimRemaining=0;P.syncSpread();
   return{unchanged,active:RangeAim.active(),zoom:RangeAim.zoom(),spread:P.spread,expected:Firearms.derive(P.weapon).spreadBase};
  },formula.store);
  assert(isolated.unchanged&&isolated.active);near(isolated.zoom,1);near(isolated.spread,isolated.expected);
  assert.deepEqual(errors,[]);reports.push({file,hip,shoulder,ads,sprint,formula:{preserved:formula.preserved,kick:formula.kick},aligned,isolated,passed:true});await p.close();
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');
 console.log('PASS: shared hip/shoulder/ADS, optics, camera coordinates, recoil retention, tap/hold space, live tuning, save and runtime isolation; development/offline');
})().catch(e=>{console.error(e);process.exitCode=1;});
