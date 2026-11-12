/* 钥匙房开锁读条：浏览器验收（开发版 + 离线单文件版）
   node tools/test-key-unlock-readbar-browser.js

   覆盖：1.5s 读条、读满才扣钥匙耐久并开锁、任何动作都打断（含受击/Esc/滚轮/再按 E）、
   打断不消耗耐久、开锁声在读条起手响、开门声只在成功时响、无钥匙不进读条、
   已解锁的门直接开合、耐久耗尽的钥匙被移除、钥匙链写回存档。 */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/items/key-unlock-v1');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();const ext=path.extname(f);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.wav':'audio/wav','.mp3':'audio/mpeg'})[ext]||'text/html;charset=utf-8');res.end(b);});});

/* 起手 / 打断的每一种输入，都在同一帧里手动驱动 updateAction，排除 rAF 抖动 */
const ACTIONS=[
  ['新按键 W（移动）',        ()=>{Game.input.keys.w=true;}],
  ['新按键 1（切枪）',        ()=>{Game.input.keys['1']=true;}],
  ['新按键 R（换弹）',        ()=>{Game.input.keys.r=true;}],
  ['新按键 Tab（背包）',      ()=>{Game.input.keys.tab=true;}],
  ['新按键 空格（冲刺）',     ()=>{Game.input.keys[' ']=true;}],
  ['新按键 5（医疗）',        ()=>{Game.input.keys['5']=true;}],
  ['鼠标左键（开火）',        ()=>{Game.input.mouseDown=true;}],
  ['鼠标右键（闪避）',        ()=>{Game.input.dodgePressed=true;}],
  ['换弹轮盘按键',            ()=>{Game.input.reloadPressed=true;}],
  ['角色实际位移',            ()=>{Game.player.vx=100;}],
  ['闪避动作中',              ()=>{Game.player.dodgeT=1;}],
  ['换弹动作中',              ()=>{Game.player.reloadT=1;}],
  ['近战动作中',              ()=>{Game.player.meleeActive=true;}],
  ['打开背包面板',            ()=>{Game.bagOpen=true;}],
  ['打开搜刮面板',            ()=>{Game.lootOpen={};}],
  ['离开门太远',              ()=>{Game.player.x+=40;}],
  ['受击',                    ()=>{Game.player.hurt(60,'body',0);}],
  ['再按一次 E',              ()=>{Game.handleInteract();}]
];

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[];const ok=(name,cond,extra)=>{checks.push([name,!!cond,extra||'']);assert.ok(cond,name+' '+(extra||''));};
 try{
  for(const offline of [false,true]){
   const tag=offline?'offline':'dev';
   const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failed=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push(r.url());});
   const url=(offline?pathToFileURL(path.join(root,'潮汐线.html')).href:'http://127.0.0.1:'+server.address().port+'/index.html')+'#doors-test';
   await page.goto(url);
   await page.waitForFunction(()=>typeof DoorSystem!=='undefined'&&typeof Game!=='undefined'&&Game.state==='playing'&&document.querySelector('#doorTestControls'));
   await page.evaluate(()=>{if(typeof SFX!=='undefined')SFX.unlock();});
   await page.waitForFunction(()=>typeof SFX!=='undefined'&&SFX.samples&&SFX.samples['unlock_key']);
   ok(tag+' 开锁音效已加载',await page.evaluate(()=>!!SFX.samples['unlock_key']));
   ok(tag+' 开锁响度档',await page.evaluate(()=>SFX._targetFor('unlock_key')===SFX.LOUD.unlock));

   await page.evaluate((actions)=>{
    const orig=SFX.play;window.__sfx=[];SFX.play=function(n,o){window.__sfx.push(n);return orig.call(this,n,o);};
    window.__t={
     setup(){
      /* door_key_test 只有 1 点耐久，一开就碎；用 10 点的老公寓钥匙才能验证
         「只扣 1 点」和「打断一点都不扣」。 */
      const P=Game.player,k=ITEM_BY_ID.door_key_old_apt;
      P.x=M.cx(13);P.y=M.cy(6);P.vx=0;P.vy=0;P.dodgeT=0;P.reloadT=0;P.meleeActive=false;
      /* 「受击」那一组会扣血，每个场景都从活人开始，否则 P.dead 会让
         后面所有打断断言变成假阳性（unlockInterrupted 第一条就命中）。 */
      P.hp=P.maxHp;P.dead=false;
      P.bag.chain=[{item:k,n:1,cap:3}];P.bag.slots=[];P.bag.safe=[];
      Save.chain=[{id:k.id,n:1,cap:3}];
      const d=M.at(13,7).door;d.keyId=k.id;d.open=false;d.unlocked=false;d.breached=false;
      Game.action=null;Game.lootOpen=null;Game.bagOpen=false;Game.state='playing';
      Game.input.keys={};for(const key of ['mouseDown','mousePressed','dodgePressed','reloadPressed','interactPressed'])Game.input[key]=false;
      Game.interactKey=null;Game._interactAnchor=null;Game.interactIndex=0;
      Game.toasts.length=0;window.__sfx.length=0;
      Game.updateCamera(true);
     },
     snap(){const d=M.at(13,7).door;return {
      action:Game.action&&{type:Game.action.type,t:Game.action.t,total:Game.action.total},
      unlocked:d.unlocked,open:d.open,cap:Game.player.bag.chain[0]?.cap??null,
      chain:(Save.chain||[]).map(e=>({id:e.id,cap:e.cap})),
      sfx:[...window.__sfx],toasts:Game.toasts.map(t=>t.msg)};},
     start(){Game.input.keys.e=true;Game.handleInteract();return this.snap();}
    };
    window.__actionFns={};
    for(const [name,src] of actions)window.__actionFns[name]=src;
   },ACTIONS.map(([n,fn])=>[n,fn.toString()]));
   /* 把函数字符串还原成可执行函数 */
   await page.evaluate(()=>{for(const k in window.__actionFns)window.__actionFns[k]=eval('('+window.__actionFns[k]+')');});

   /* 1. 起手：只读条，不碰耐久 / 门状态；开锁声起手响，开门声不响 */
   const start=await page.evaluate(()=>{__t.setup();return __t.start();});
   ok(tag+' 起手进入 1.5s 读条',start.action?.type==='unlock'&&start.action.total===1.5,JSON.stringify(start));
   ok(tag+' 起手不解锁不开门',start.unlocked===false&&start.open===false,JSON.stringify(start));
   ok(tag+' 起手不消耗耐久',start.cap===3&&start.chain[0].cap===3,JSON.stringify(start));
   ok(tag+' 起手播开锁声、不播开门声',start.sfx.includes('unlock_key')&&!start.sfx.includes('door_open_alt'),JSON.stringify(start.sfx));
   ok(tag+' 起手提示',start.toasts.some(t=>t.includes('开锁中')),JSON.stringify(start.toasts));

   /* 2. 没读满不完成 */
   const partial=await page.evaluate(()=>{__t.setup();__t.start();Game.updateAction(1.4);return __t.snap();});
   ok(tag+' 1.4s 仍在读条',partial.action?.type==='unlock'&&partial.action.t<1.5,JSON.stringify(partial));
   ok(tag+' 1.4s 未扣耐久',partial.cap===3&&!partial.unlocked&&!partial.open,JSON.stringify(partial));
   ok(tag+' 未完成不播开门声',!partial.sfx.includes('door_open_alt'),JSON.stringify(partial.sfx));

   /* 3. 读满：扣耐久、解锁、开门、写回钥匙链 */
   const done=await page.evaluate(()=>{__t.setup();__t.start();Game.updateAction(1.51);return __t.snap();});
   ok(tag+' 读满完成并清空 action',done.action===null,JSON.stringify(done));
   ok(tag+' 读满才解锁开门',done.unlocked===true&&done.open===true,JSON.stringify(done));
   ok(tag+' 读满才扣 1 点耐久',done.cap===2&&done.chain[0].cap===2,JSON.stringify(done));
   ok(tag+' 成功才播开门声',done.sfx.includes('unlock_key')&&done.sfx.includes('door_open_alt'),JSON.stringify(done.sfx));
   ok(tag+' 成功提示耐久 -1',done.toasts.some(t=>t.includes('钥匙耐久 -1')),JSON.stringify(done.toasts));

   /* 4. 任何动作打断：门仍锁、耐久不变、存档不变、不播开门声 */
   const interrupts=await page.evaluate(()=>{
    const rows=[];
    for(const name of Object.keys(__actionFns)){
     __t.setup();__t.start();
     try{__actionFns[name]();}catch(e){rows.push([name,'THREW '+e.message]);continue;}
     Game.updateAction(0.016);
     rows.push([name,__t.snap()]);
    }
    return rows;
   });
   for(const [name,s] of interrupts){
    ok(tag+' 打断 · '+name,s&&s.action===null,JSON.stringify(s));
    ok(tag+' 打断不消耗耐久 · '+name,s&&s.cap===3&&s.chain[0].cap===3&&!s.unlocked&&!s.open,JSON.stringify(s));
    ok(tag+' 打断不播开门声 · '+name,s&&!s.sfx.includes('door_open_alt'),JSON.stringify(s));
   }
   ok(tag+' 打断动作覆盖数',interrupts.length===ACTIONS.length,JSON.stringify(interrupts.length));

   /* 5. 真实 Esc / 滚轮 / 按 E 起手 */
   for(const [name,act] of [['Esc',async()=>page.keyboard.press('Escape')],['滚轮',async()=>page.mouse.wheel(0,120)]]){
    await page.evaluate(()=>{__t.setup();__t.start();});
    await act();
    const s=await page.evaluate(()=>__t.snap());
    ok(tag+' 真实 '+name+' 打断',s.action===null&&s.cap===3&&!s.unlocked&&!s.open,JSON.stringify(s));
   }
   await page.evaluate(()=>{__t.setup();});
   await page.keyboard.press('e');
   await page.waitForFunction(()=>Game.action?.type==='unlock');
   const real=await page.evaluate(()=>__t.snap());
   ok(tag+' 真实 E 起手读条',real.action.type==='unlock'&&real.cap===3&&real.sfx.includes('unlock_key'),JSON.stringify(real));
   if(!offline)await page.screenshot({path:path.join(out,'unlocking.png')});
   if(offline)await page.screenshot({path:path.join(out,'offline-unlocking.png')});

   /* 6. 无钥匙 / 已解锁 / 耐久耗尽 */
   const cases=await page.evaluate(()=>{
    const noKey=(()=>{__t.setup();Game.player.bag.chain=[];Save.chain=[];Game.input.keys.e=true;Game.handleInteract();return __t.snap();})();
    const unlocked=(()=>{__t.setup();M.at(13,7).door.unlocked=true;Game.input.keys.e=true;Game.handleInteract();return __t.snap();})();
    /* 最后一把钥匙用尽后，prepareOpen 会以 consumed=true 写回空链 */
    const broken=(()=>{__t.setup();Game.player.bag.chain[0].cap=1;Save.chain[0].cap=1;
      __t.start();Game.updateAction(1.51);return __t.snap();})();
    return {noKey,unlocked,broken};
   });
   ok(tag+' 无钥匙不进读条',cases.noKey.action===null&&cases.noKey.toasts.some(t=>t.includes('需要对应钥匙'))&&!cases.noKey.sfx.includes('unlock_key'),JSON.stringify(cases.noKey));
   ok(tag+' 已解锁的门直接开合且不扣耐久',cases.unlocked.action===null&&cases.unlocked.open===true&&cases.unlocked.cap===3,JSON.stringify(cases.unlocked));
   ok(tag+' 耐久归零的钥匙被移除',cases.broken.cap===null&&cases.broken.chain.length===0&&cases.broken.open===true,JSON.stringify(cases.broken));
   ok(tag+' 耗尽提示',cases.broken.toasts.some(t=>t.includes('钥匙耐久耗尽')),JSON.stringify(cases.broken.toasts));

   ok(tag+' 无脚本错误',errors.length===0,errors.join(' | '));
   ok(tag+' 无失败请求',failed.length===0,failed.join(' | '));
   await page.close();
  }
  console.log('PASS 钥匙房开锁读条：'+checks.length+' 项断言，开发版 + 离线版');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
