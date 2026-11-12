/* 新一批音效 2 的四条预留音效接线验收（开发版 + 离线单文件版）
   node tools/test-batch-sfx2-routing-browser.js

   loot_rare_reveal  → 逐件搜索翻出 r5/r6 时；r1~r4 仍用 pickup
   door_open_alt     → 所有开门 / 关门；door_kick → 受阻门被踹开那一下
   trade_settle      → 任何购买 / 卖出 / 付费服务成交，含改枪工坊买配件；一次成交只响一次
*/
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/audio/batch-sfx2-routing');
const IDS=['unlock_key','door_open_alt','door_kick','trade_settle','loot_rare_reveal'];
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();const ext=path.extname(f);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.wav':'audio/wav','.mp3':'audio/mpeg'})[ext]||'text/html;charset=utf-8');res.end(b);});});

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[];const ok=(name,cond,extra)=>{checks.push([name,!!cond,extra||'']);assert.ok(cond,name+' '+(extra||''));};
 const base=(offline)=>(offline?pathToFileURL(path.join(root,'潮汐线.html')).href:'http://127.0.0.1:'+server.address().port+'/index.html');
 try{
  for(const offline of [false,true]){
   const tag=offline?'offline':'dev',errors=[];
   /* ---------------- A. 局内：门与搜索 ---------------- */
   const p=await browser.newPage({viewport:{width:1280,height:800}});
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base(offline)+'#doors-test');
   await p.waitForFunction(()=>typeof DoorSystem!=='undefined'&&typeof Game!=='undefined'&&Game.state==='playing'&&document.querySelector('#doorTestControls'));
   await p.evaluate(()=>{if(typeof SFX!=='undefined')SFX.unlock();});
   await p.waitForFunction(ids=>ids.every(id=>SFX.samples&&SFX.samples[id]),IDS);
   ok(tag+' 5 条音效样本都已加载',await p.evaluate(ids=>ids.every(id=>!!SFX.samples[id]),IDS));
   ok(tag+' 响度档已登记',await p.evaluate(()=>SFX._targetFor('door_open_alt')===SFX.LOUD.door&&SFX._targetFor('door_kick')===SFX.LOUD.doorKick&&SFX._targetFor('loot_rare_reveal')===SFX.LOUD.rareReveal&&SFX._targetFor('trade_settle')===SFX.LOUD.sell));
   await p.evaluate(()=>{
    const orig=SFX.play;window.__sfx=[];SFX.play=function(n,o){window.__sfx.push(n);return orig.call(this,n,o);};
    window.__door=(id,x,y)=>{
     const P=Game.player;P.x=M.cx(x);P.y=M.cy(y);P.vx=0;P.vy=0;
     Game.interactKey=null;Game._interactAnchor=null;Game.interactIndex=0;Game.action=null;
     Game.input.keys={};Game.toasts.length=0;window.__sfx.length=0;
     Game.updateCamera(true);
     return M.doors.find(d=>d.id===id);
    };
   });

   const doors=await p.evaluate(()=>{
    /* 只取本次交互新增的音效，别把之前的累计进来 */
    const press=()=>{const n=window.__sfx.length;Game.handleInteract();return window.__sfx.slice(n);};
    const r={};
    /* 普通门：开、关都应是 door_open_alt */
    __door('normal',4,6);r.open=press();
    r.close=press();
    /* 受阻门：第一次踹开是 door_kick，之后开合回归普通开门声 */
    const kick=__door('kick-n',8,6);kick.open=false;kick.breached=false;
    r.kick=press();
    r.kickClose=press();
    r.kickOpen=press();
    /* 钥匙房：起手 unlock_key，读满后开锁 + 开门声 */
    const d=__door('iron-h',13,6);d.keyId=ITEM_BY_ID.door_key_old_apt.id;d.open=false;d.unlocked=false;
    Game.player.bag.chain=[{item:ITEM_BY_ID.door_key_old_apt,n:1,cap:3}];
    Game.player.bag.slots=[];Game.player.bag.safe=[];
    Game.input.keys.e=true;r.unlockStart=press();
    Game.updateAction(Game.action.total+0.01);r.unlockDone=[...window.__sfx];
    return r;
   });
   ok(tag+' 开门用 door_open_alt',doors.open.includes('door_open_alt')&&!doors.open.includes('door'),JSON.stringify(doors.open));
   ok(tag+' 关门也用 door_open_alt',doors.close.length===1&&doors.close[0]==='door_open_alt',JSON.stringify(doors.close));
   ok(tag+' 踹开受阻门用 door_kick',doors.kick.includes('door_kick')&&!doors.kick.includes('door_open_alt'),JSON.stringify(doors.kick));
   ok(tag+' 踹开之后的开合回归普通门声',doors.kickClose.includes('door_open_alt')&&doors.kickOpen.includes('door_open_alt')&&!doors.kickClose.includes('door_kick'),JSON.stringify([doors.kickClose,doors.kickOpen]));
   ok(tag+' 开锁起手仍是 unlock_key',doors.unlockStart.includes('unlock_key')&&!doors.unlockStart.includes('door_open_alt'),JSON.stringify(doors.unlockStart));
   ok(tag+' 开锁成功后接开门声',doors.unlockDone.includes('door_open_alt'),JSON.stringify(doors.unlockDone));

   const loot=await p.evaluate(async()=>{
    const orig=Game.renderLootList;Game.renderLootList=()=>{};
    const run=r=>{
     window.__sfx.length=0;
     const it={...ITEM_BY_ID.life01,r};
     Game.lootOpen={items:[{item:it,known:false,n:1}],x:Game.player.x,y:Game.player.y};
     Game.search={idx:0,t:0,total:0.001,noiseT:0};Game.autoSearch=false;
     return new Promise(res=>{
      let frames=0;
      const tick=()=>{
       if(!Game.search||frames>60)return res({sfx:[...window.__sfx],search:!!Game.search});
       frames++;requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
     });
    };
    const r6=await run(6),r5=await run(5),r3=await run(3),r1=await run(1);
    Game.renderLootList=orig;Game.lootOpen=null;Game.search=null;
    return {r6,r5,r3,r1};
   });
   for(const [k,v] of [['r6',loot.r6],['r5',loot.r5]]){
    ok(tag+' '+k+' 翻出播 loot_rare_reveal',v.sfx.includes('loot_rare_reveal')&&!v.sfx.includes('pickup')&&!v.search,JSON.stringify(v));
   }
   for(const [k,v] of [['r3',loot.r3],['r1',loot.r1]]){
    ok(tag+' '+k+' 翻出仍是 pickup',v.sfx.includes('pickup')&&!v.sfx.includes('loot_rare_reveal'),JSON.stringify(v));
   }
   await p.close();

   /* ---------------- B. 局外：交易结算 ---------------- */
   const q=await browser.newPage({viewport:{width:1280,height:800}});
   q.on('pageerror',e=>errors.push(e.message));
   await q.goto(base(offline)+'#base');
   await q.waitForFunction(()=>typeof TradeAudio!=='undefined'&&typeof SFX!=='undefined'&&Game.state==='base'&&Safehouse.root);
   await q.evaluate(()=>SFX.unlock());
   await q.waitForFunction(()=>SFX.samples&&SFX.samples['trade_settle']);
   await q.evaluate(()=>{
    const orig=SFX.play;window.__sfx=[];SFX.play=function(n,o){window.__sfx.push(n);return orig.call(this,n,o);};
   });
   const trade=await q.evaluate(()=>{
    const out={},take=()=>{const r=[...window.__sfx];window.__sfx.length=0;return r;};
    const wrapped=()=>{
     const names={Base:['buyGun','buyAmmo','buyMelee','buyAttachment','buyMedical','buyArmor','buyBag','treat'],
      TradeMerchant:['buy'],Clinic:['pay'],Repair:['apply']};
     /* 这些对象是脚本顶层的 const（词法绑定，不挂在 window 上），直接引用 */
     const objs={Base,TradeMerchant,Clinic,Repair};
     const r={};for(const [obj,list]of Object.entries(names))for(const n of list)r[obj+'.'+n]=!!(objs[obj]&&typeof objs[obj][n]==='function'&&objs[obj][n].__tradeSettled);
     return r;
    };
    out.wrapped=wrapped();
    Save.credits=1e7;Save.stash=[];Game.state='base';
    /* 代表性购买：枪（内部原本会响 pickup）、配件、治疗服务 */
    const gun=Object.keys(WEAPONS).find(id=>WEAPONS[id].shopAvailable!==false);
    out.buyGun={r:Base.buyGun(gun),sfx:take()};
    const att=Object.values(ATTACHMENT_DEFS).find(a=>a.r<=3);
    out.buyAttachment={r:Base.buyAttachment(att.id),sfx:take()};
    Save.setHP(50);out.treat={r:Base.treat(Medical.quote().total),sfx:take()};
    /* 贸易商：需要商人视图与对应页签 */
    const view=Safehouse.view,tab=Base.tab;
    Safehouse.view='merchant';Base.tab='viktor';
    const o=TradeMerchant.offers('viktor')[0];
    out.trader={r:TradeMerchant.buy('viktor',o.item.id,o.price),sfx:take()};
    /* 诊所付费 */
    Save.setHP(50);out.clinic={r:Clinic.pay(),sfx:take()};
    /* 出售（Sales.commit 走 Game.sfx('sell') 重定向） */
    Save.stash=[{id:'life01',n:1}];MerchantUI.key='viktor';MerchantUI.mode='sell';
    const pv=Sales.preview('viktor',[{entry:Save.stash[0],n:1}]);
    const tok=Sales.authorize(pv);
    out.sell={r:Sales.commit(tok),sfx:take()};
    Safehouse.view=view;Base.tab=tab;MerchantUI.mode='buy';
    /* 改枪工坊两条分支：花钱买配件 → buy，只装已有 → pickup */
    Game.sfx('buy');out.gunsmithPaid=take();
    Game.sfx('pickup');out.gunsmithFree=take();
    /* 免费行为不该触发结算 */
    Save.addStash('life01',1);out.free=take();
    return out;
   });
   const wrapped=trade.wrapped;
   ok(tag+' 所有购买入口都被结算包装',Object.values(wrapped).every(Boolean)&&Object.keys(wrapped).length===11,JSON.stringify(wrapped));
   for(const key of ['buyGun','buyAttachment','treat','trader','clinic','sell']){
    const t=trade[key];
    ok(tag+' '+key+' 成交只响一次 trade_settle',t.sfx.filter(x=>x==='trade_settle').length===1&&!t.sfx.includes('pickup')&&!t.sfx.includes('sell')&&!t.sfx.includes('buy'),JSON.stringify(t));
   }
   ok(tag+' 改枪买配件走结算音',trade.gunsmithPaid.length===1&&trade.gunsmithPaid[0]==='trade_settle',JSON.stringify(trade.gunsmithPaid));
   ok(tag+' 改枪零消费仍是 pickup',trade.gunsmithFree.length===1&&trade.gunsmithFree[0]==='pickup',JSON.stringify(trade.gunsmithFree));
   ok(tag+' 免费入库不触发结算音',!trade.free.includes('trade_settle'),JSON.stringify(trade.free));
   ok(tag+' 无脚本错误',errors.length===0,errors.join(' | '));
   await q.close();
  }
  console.log('PASS 新一批音效 2 接线：'+checks.length+' 项断言，开发版 + 离线版');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
