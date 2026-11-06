/* 局内交互滚轮：多个候选目标共存时可滚动选择，且尸体容器能反复打开。
   覆盖开发版与单文件离线版，并留一张 5 条选项带的实机截图。 */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),
      {pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/interact-wheel-v1');
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio','--no-proxy-server']});
  const reports=[];
  try{
    for(const file of ['index.html','潮汐线.html']){
      const p=await browser.newPage({viewport:{width:1440,height:900}});
      const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(pathToFileURL(path.join(root,file)).href+'#base');
      await p.waitForFunction(()=>typeof Game!=='undefined'&&Game.canvas&&typeof M!=='undefined'&&typeof ITEM_BY_ID!=='undefined');

      /* 在玩家脚下摆 3 个容器 + 1 具尸体 + 1 扇门，复现「尸体压在门上」 */
      const setup=async()=>p.evaluate(()=>{
        Game.startRun({ammo:0,bandage:0,stone:0,medical:{}});
        /* 直接调 startRun 不会走 Base.deploy()，局外遮罩要自己收掉才看得见画布 */
        document.getElementById('baseVeil').classList.add('hidden');
        document.getElementById('mapVeil').classList.add('hidden');
        Game.enemies=[];Game.action=null;Game.closeLoot();
        M.extracts=[];
        const P=Game.player,tx=M.tx(P.x),ty=M.ty(P.y);
        const prize=ITEM_BY_ID['life01'];
        const mk=i=>({id:'iw-box-'+i,region:null,x:P.x,y:P.y,tx,ty,kind:'junk',
          q:CONTAINER_QUALITY.junk,art:null,name:'测试容器 '+i,
          items:[{item:prize,n:1}],opened:false,searched:false});
        Game.boxes=[mk(1),mk(2),mk(3)];
        Game.corpses=[{x:P.x,y:P.y,opened:false,searched:false,
          enemy:{t:{name:'拾荒者'}},loot:[{item:prize,n:1}]}];
        M.at(tx,ty).door={open:true};
        Game.interactKey=null;Game.interactIndex=0;
        Game.findInteractable();
        return {types:Game.interactList.map(o=>o.type),sel:Game.interactIndex};
      });
      const first=await setup();
      assert(first.types.includes('door')&&first.types.includes('corpse'),'门和尸体都在候选表里');
      assert.equal(first.types.length,5,'本用例应有 5 个候选（3 箱 + 1 尸 + 1 门）');
      assert.equal(first.sel,0,'默认选中第一项');

      /* 真实滚轮：向下滚一格 */
      const cv=await p.locator('#game').boundingBox();
      await p.mouse.move(cv.x+cv.width/2,cv.y+cv.height/2);
      await p.mouse.wheel(0,40);
      assert.equal(await p.evaluate(()=>Game.interactIndex),1,'向下滚一格换到下一项');
      await p.mouse.wheel(0,-40);
      assert.equal(await p.evaluate(()=>Game.interactIndex),0,'向上滚一格换回来');
      await p.mouse.wheel(0,-40);
      assert.equal(await p.evaluate(()=>Game.interactIndex),0,'滚到表头不循环');

      /* 滚到中间，检查最多 5 条、上下各 2 条、越边缘越小越淡 */
      await p.evaluate(()=>{Game.interactKey=Game.interactKeyOf(Game.interactList[2]);Game.findInteractable();});
      const drawn=await p.evaluate(()=>{
        const labels=[],texts=[],c=Game.ctx;
        const origLabel=Game.interactLabel.bind(Game),origText=c.fillText.bind(c);
        Game.interactLabel=function(it,multi){const s=origLabel(it,multi);labels.push(s);return s;};
        c.fillText=function(t,x,y){
          if(String(t).startsWith('[E]'))texts.push({text:String(t),font:c.font,alpha:+c.globalAlpha.toFixed(2)});
          return origText(t,x,y);
        };
        try{Game.render();}finally{Game.interactLabel=origLabel;c.fillText=origText;}
        return {labels,texts,sel:Game.interactIndex,count:Game.interactList.length};
      });
      assert.equal(drawn.sel,2);
      assert.equal(drawn.labels.length,5,'中间位置上下各 2 条，一共 5 条');
      assert.equal(drawn.texts.length,5);
      const fonts=drawn.texts.map(t=>parseInt(t.font,10));
      const alphas=drawn.texts.map(t=>t.alpha);
      assert.equal(fonts.filter(f=>f===12).length,1,'只有选中项是原来的 12px');
      assert(fonts.filter(f=>f<12).length===4,'其余项都缩小');
      assert.equal(alphas.filter(a=>a===1).length,1,'只有选中项不透明');
      assert(alphas.every(a=>a>0&&a<=1),'边缘项只是变淡，不会消失');
      assert(drawn.texts.find(t=>t.font.startsWith('12px')).text.includes('测试容器'),
        '选中项文案和普通容器一致');

      await p.screenshot({path:path.join(out,(file==='index.html'?'':'offline-')+'wheel-5.png')});

      /* 选中尸体按 E：门不能抢走交互 */
      await p.evaluate(()=>{
        const cp=Game.findInteractables().find(o=>o.type==='corpse');
        Game.interactKey=Game.interactKeyOf(cp);Game.findInteractable();
      });
      await p.keyboard.press('e');
      await p.waitForFunction(()=>!!Game.action&&Game.action.type==='corpse');
      await p.waitForFunction(()=>Game.lootOpen===Game.corpses[0],null,{timeout:5000});
      const corpseState=await p.evaluate(()=>({searched:Game.corpses[0].searched,opened:Game.corpses[0].opened}));
      assert.deepEqual(corpseState,{searched:true,opened:false},'搜过但没摸空的尸体保持可打开');

      /* 关掉再开：不再读条，且还能继续开 */
      await p.keyboard.press('Escape');
      await p.waitForFunction(()=>!Game.lootOpen);
      const still=await p.evaluate(()=>Game.findInteractables().some(o=>o.type==='corpse'));
      assert(still,'关掉面板后尸体仍在候选表');
      await p.evaluate(()=>{
        const cp=Game.findInteractables().find(o=>o.type==='corpse');
        Game.interactKey=Game.interactKeyOf(cp);
        Game.input.interactPressed=true;
      });
      await p.waitForFunction(()=>Game.lootOpen===Game.corpses[0],null,{timeout:5000});
      assert.equal(await p.evaluate(()=>Game.action),null,'第二次打开不再读条');
      await p.keyboard.press('Escape');

      /* 摸空之后才从候选表消失 */
      const emptied=await p.evaluate(()=>{
        const cp=Game.corpses[0];cp.items=cp.loot=[null];Game.syncBoxState(cp);
        return {opened:cp.opened,present:Game.findInteractables().some(o=>o.type==='corpse')};
      });
      assert.deepEqual(emptied,{opened:true,present:false},'摸空的尸体才永久关闭');

      /* 只剩一个候选时必须退回旧版那条 12px / 不透明的提示 */
      const single=await p.evaluate(()=>{
        Game.boxes=[Game.boxes[0]];
        M.at(M.tx(Game.player.x),M.ty(Game.player.y)).door=null;
        Game.interactKey=null;Game.findInteractable();
        const texts=[],c=Game.ctx,orig=c.fillText.bind(c);
        c.fillText=function(t,x,y){
          if(String(t).startsWith('[E]'))texts.push({text:String(t),font:c.font,alpha:c.globalAlpha});
          return orig(t,x,y);
        };
        try{Game.render();}finally{c.fillText=orig;}
        return texts;
      });
      assert.equal(single.length,1,'单选项只画一条');
      assert.equal(single[0].font,'12px monospace','单选项字号与旧版一致');
      assert.equal(single[0].alpha,1,'单选项不淡化');
      assert(single[0].text.startsWith('[E] 打开 '),'单选项文案与旧版一致');
      await p.screenshot({path:path.join(out,(file==='index.html'?'':'offline-')+'wheel-1.png')});

      assert.deepEqual(errors,[]);
      reports.push({file,types:first.types,maxVisible:5,fonts,alphas,
        corpseReopen:true,scrollBothWays:true,errors});
      await p.close();
    }
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,reports},null,2)+'\n');
    console.log('PASS: development/offline 5 options (3 boxes + corpse + door), wheel up/down with clamped ends, 5-item band with edge shrink/fade, door no longer blocks corpse, corpse stays openable until emptied');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
