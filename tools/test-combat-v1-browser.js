/* 战斗系统 V1 浏览器验收：开发版 + 离线版都要能加载 js/combat.js，
   公式、材质、弹药与真实受击链路一致，护甲详情显示材质。
   跑法：node tools/test-combat-v1-browser.js */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/equipment/combat-v1'),CFG_HEAD_MULT=1.5;
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});

(async()=>{let browser,n=0;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const file of ['index.html','潮汐线.html']){
  const tag=file==='index.html'?'开发版':'离线版';
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
  await p.waitForFunction(()=>typeof Combat!=='undefined'&&typeof GEAR!=='undefined'&&typeof Save!=='undefined');
  const ok=(name,cond,extra)=>{assert(cond,tag+' '+name+(extra!=null?' '+extra:''));n++;};

  /* 1. 配置与公式在离线版里同样可用 */
  const cfg=await p.evaluate(()=>{
    const g=GEAR.make('body',6),h=GEAR.make('helmet',1);
    const full=Combat.effectiveArmor(g);
    g.dur=g.max/2;const half=Combat.effectiveArmor(g);
    g.dur=0;const dead=Combat.effectiveArmor(g);
    const blunt=Combat.resolve({B:31,P:8,part:'body',armor:h});
    const pen=Combat.resolve({B:31,P:59,part:'body',armor:h});
    const head=Combat.resolve({B:31,P:59,part:'head',armor:h});
    const far=Combat.resolve({B:31,P:59,part:'body',armor:h,mul:0.55});
    return {full,half,dead,materials:CFG.MATERIALS.steel,ammo:Combat.ammo('556',3),
      blunt:blunt.health,pen:pen.health,head:head.health,
      bluntD:blunt.durabilityLoss,penD:pen.durabilityLoss,headD:head.durabilityLoss,
      farD:far.durabilityLoss,farH:far.health,
      pure:(()=>{const a=GEAR.make('body',3),d=a.dur;
        const r=Combat.resolve({B:40,P:16,part:'body',armor:a});
        return {unchanged:a.dur===d,predicted:r.armorDurAfter};})()};
  });
  ok('新增结算模块已内联',cfg.full===60,cfg.full);
  ok('半耐久 A=10L−5',cfg.half===55,cfg.half);
  ok('耐久归零 A=0',cfg.dead===0,cfg.dead);
  ok('材质参数',cfg.materials.Kb===0.75&&cfg.materials.Kd===0.70&&cfg.materials.Kr===0.015);
  ok('弹药表 5.56 Lv3=33/33',cfg.ammo.B===33&&cfg.ammo.P===33,cfg.ammo.B+'/'+cfg.ammo.P);
  ok('未穿透只产生钝伤',Math.abs(cfg.blunt-0.08*31*1.25)<1e-9,cfg.blunt);
  ok('穿透造成全额基础肉伤',cfg.pen===31,cfg.pen);
  ok('爆头倍率在结算之后乘',Math.abs(cfg.head-31*CFG_HEAD_MULT)<1e-9,cfg.head);
  ok('磨甲量与部位倍率、距离衰减无关',cfg.penD===cfg.headD&&cfg.penD===cfg.farD,cfg.penD);
  ok('磨甲量随穿透力 P 变化（公式含 0.009P）',cfg.bluntD<cfg.penD,cfg.bluntD+' vs '+cfg.penD);
  ok('距离衰减只作用于生命伤害',Math.abs(cfg.farH-cfg.pen*0.55)<1e-9,cfg.farH);
  ok('resolve 不修改护甲状态',cfg.pure.unchanged,JSON.stringify(cfg.pure));

  /* 2. 真实受击链路：玩家挨一发，掉血与磨甲都符合结算 */
  const hit=await p.evaluate(()=>{
    Game.state='playing';
    if(!Game.player)Game.startRun();
    const P=Game.player;
    P.helmet=null;P.body=GEAR.make('body',4);P.hp=100;P.dead=false;
    const before=P.body.dur;
    const expect=Combat.resolve({B:33,P:33,part:'body',armor:P.body});
    const dealt=P.hurt(33,'body',33,undefined,null,1);
    return {dealt,expect:expect.health,used:before-P.body.dur,loss:expect.durabilityLoss,
      material:P.body.material,hp:P.hp};
  });
  ok('真实受击掉血等于结算值',Math.abs(hit.dealt-hit.expect)<1e-9,hit.dealt+' vs '+hit.expect);
  ok('真实受击磨甲等于结算值',Math.abs(hit.used-hit.loss)<1e-9,hit.used+' vs '+hit.loss);
  ok('护甲实例带材质',hit.material==='ceramic',hit.material);

  /* 3. 详情浮窗显示材质与有效防护值 */
  const tip=await p.evaluate(()=>{
    Game.state='base';Safehouse.route('stash');
    const it=EQUIP.armor(GEAR.make('body',4));
    Tips.show(it,null,{x:400,y:300});
    return document.querySelector('#itemTip')?.innerText||'';
  });
  ok('详情显示材质',tip.includes('防弹陶瓷'),tip.slice(0,120));
  ok('详情显示有效防护值',tip.includes('有效防护值'),tip.slice(0,160));
  ok('详情显示耐修度',tip.includes('耐修度'),tip.slice(0,160));

  await p.screenshot({path:path.join(out,file==='index.html'?'browser-dev.png':'browser-offline.png')});
  ok('页面无异常',errors.length===0,errors.join(' | '));
  await p.close();
 }
 console.log('PASS: 战斗系统 V1 浏览器验收 — 开发版 / 离线版，'+n+' 项断言');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
