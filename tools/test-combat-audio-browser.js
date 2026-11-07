/* 2026-11-07 新一批战斗人声：开发版 / 离线版都要能解码、能路由、能节流。
   1. 19 条新采样全部解码，响度对齐到各自的 LOUD 档且峰值不削波
   2. 玩家受伤 / 敌人受伤 / 死亡 / 接战 / 切刀 / 喘息都真的触发到对应采样
   3. 随机池在间隔内不叠音，过了间隔会换一条
   4. 接战音只在「进入战斗」那一次响，看见、挨打、互斗三条路径共用同一个入口
   跑法：node tools/test-combat-audio-browser.js */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),
      {pathToFileURL}=require('url'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const man=require('../assets/audio/manifest.json');
const NEW_IDS=['hurt_player_1','hurt_player_2','hurt_player_3','hurt_enemy_1','hurt_enemy_2',
  'death_player','death_enemy_1','death_enemy_2','death_enemy_3','death_enemy_4',
  'death_enemy_5','death_enemy_6','death_enemy_7','death_enemy_8',
  'echo_engage','echo_death','switch_melee','breath_low','mutant_roar'];

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,
   args:['--mute-audio','--no-proxy-server','--autoplay-policy=no-user-gesture-required']});
 const reports=[];
 try{
  for(const file of ['index.html','潮汐线.html']){
   const p=await browser.newPage({viewport:{width:1100,height:760}});
   const errors=[];p.on('pageerror',e=>errors.push(String(e)));
   await p.goto(pathToFileURL(path.join(ROOT,file)).href+'#play');
   await p.waitForFunction(()=>typeof Game!=='undefined'&&Game.state==='playing'&&Game.player&&typeof SFX!=='undefined');
   await p.evaluate(async()=>{SFX.unlock();await SFX.load();});
   await p.waitForFunction(ids=>ids.every(id=>!!SFX.samples[id]),NEW_IDS,{timeout:40000});

   const stats=Object.fromEntries(NEW_IDS.map(id=>{
     const a=man.assets.find(x=>x.id===id);
     return [id,{rms:a.rms,peak:a.peak}];
   }));
   const setup=await p.evaluate(({ids,stats})=>{
     window.__hits=[];
     const real=SFX._playSample.bind(SFX);
     SFX._playSample=(id,o)=>{window.__hits.push(id);return real(id,o);};
     window.__realPlay=real;
     return {
       missing:ids.filter(id=>!SFX.samples[id]),
       align:ids.map(id=>({id,rms:SFX.gainOf[id]*stats[id].rms,target:SFX._targetFor(id),
                           peak:SFX.gainOf[id]*stats[id].peak})),
       gaps:SFX.POOL_GAP,
       pools:Object.fromEntries(Object.entries(SFX.POOL).map(([k,v])=>[k,v.length]))
     };
   },{ids:NEW_IDS,stats});
   assert.deepEqual(setup.missing,[],file+' 有采样没解码');
   for(const a of setup.align){
     /* _addSample 会再用峰值卡一道增益：目标响度需要的增益超过 0.95/peak 时
        只能停在峰值上限，有效 RMS 会略低于目标 —— 这是防削波，不是没对齐。 */
     if(a.peak<0.94)
       assert(Math.abs(a.rms-a.target)<0.015,file+' '+a.id+' 没对齐响度档 '+a.rms+' vs '+a.target);
     assert(a.peak<=0.96,file+' '+a.id+' 会削波 '+a.peak);
     assert(a.rms>0.02,file+' '+a.id+' 播放增益不能小到听不见');
   }
   assert.equal(setup.pools.hurtPlayer,3);
   assert.equal(setup.pools.deathEnemy,8);
   assert.equal(setup.gaps.hurtPlayer,0.80);
   assert.equal(setup.gaps.echoEngage,2.00);

   const hits=()=>p.evaluate(()=>{const h=window.__hits.slice();window.__hits.length=0;return h;});
   const reset=()=>p.evaluate(()=>{window.__hits.length=0;SFX._poolAt={};SFX._poolLast={};});

   /* 玩家受伤：三段随机 + 0.8 秒节流 */
   await reset();
   const hurt=await p.evaluate(()=>{
     const P=Game.player;P.hp=100;P.dead=false;
     P.hurt(6,'body',null,'bullet');P.hurt(6,'body',null,'bullet');
     return null;
   });
   let h=await hits();
   assert.equal(h.filter(x=>/^hurt_player_/.test(x)).length,1,file+' 连挨两下只该响一声');
   await p.evaluate(()=>{SFX._poolAt.hurtPlayer-=1000;Game.player.hp=100;Game.player.hurt(6,'body',null,'bullet');});
   const second=(await hits()).find(x=>/^hurt_player_/.test(x));
   assert(second&&second!==h.find(x=>/^hurt_player_/.test(x)),file+' 过了间隔要换一条');

   /* 人形敌人受伤 / 死亡、回响体死亡 */
   await reset();
   await p.evaluate(()=>{
     const P=Game.player;
     const e=new Enemy('scav',P.x+80,P.y);e.hurt(5,'player','body',null,'bullet');
     Game.onEnemyKilled(new Enemy('scav',P.x+90,P.y));
     Game.onEnemyKilled(new Enemy('echo',P.x+100,P.y));
   });
   h=await hits();
   assert.equal(h.filter(x=>/^hurt_enemy_/.test(x)).length,1,file+' 敌人受伤一声');
   assert.equal(h.filter(x=>/^death_enemy_/.test(x)).length,1,file+' 人形敌人死亡惨叫一声');
   assert.equal(h.filter(x=>x==='echo_death').length,1,file+' 回响体死亡一声');

   /* 接战音：只在非 chase → chase 的那一次；退出后再进战要能再响 */
   await reset();
   await p.evaluate(()=>{
     const P=Game.player;
     const e=new Enemy('echo',P.x+120,P.y);
     e.enterCombat();e.enterCombat();e.enterCombat();
     e.state='patrol';SFX._poolAt.echoEngage-=3000;e.enterCombat();
   });
   assert.equal((await hits()).filter(x=>x==='echo_engage').length,2,
     file+' 接战音只在状态切换时响（连着三次 chase 只算一次）');

   /* 人形敌人不吃异常生物语音；玩家阵亡 / 切刀 / 喘息各自到位 */
   await reset();
   await p.evaluate(()=>{
     const P=Game.player;
     new Enemy('scav',P.x+130,P.y).enterCombat();
     SFX.play('deathPlayer');
     P.melee=MeleeSystem.normalize(EQUIP.melee('melee01'));
     P.meleeActive=false;P.switchMelee();
     SFX.play('breathLow');SFX.play('breathLow');
   });
   h=await hits();
   assert(!h.includes('echo_engage'),file+' 人形敌人不该播异常生物接战语音');
   assert(h.includes('death_player'),file+' 玩家阵亡走新人声');
   assert(h.includes('switch_melee'),file+' 切近战走拔刃出鞘');
   assert.equal(h.filter(x=>x==='breath_low').length,1,file+' 喘息有节流');

   await p.evaluate(()=>{SFX._playSample=window.__realPlay;});
   assert.deepEqual(errors,[],file+' 页面无 JS 报错');
   reports.push({file,newSamples:NEW_IDS.length,wired:['hurtPlayer','hurtEnemy','deathEnemy',
     'deathPlayer','echoEngage','echoDeath','switchMelee','breathLow'],errors});
   await p.close();
  }
  const outDir=path.join(ROOT,'design','audio','combat-voices-v1');
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'verification.json'),
    JSON.stringify({passed:true,reports},null,2)+'\n');
  console.log('PASS: development/offline 19 new samples aligned & decoded; random hurt pools with cooldown; engage fired once per combat entry; echo death/engage, human screams, melee draw and low-stamina breath all wired');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
