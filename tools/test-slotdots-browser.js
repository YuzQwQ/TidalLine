/* 枪械槽位点验收：局外（仓库格 / 装备槽 / 背包 / 保险箱 / 详情浮窗）与局内（装备槽 / 背包 / 搜刮）。
   重点不是「有没有画」，而是：点数和可装槽位一致、颜色取配件稀有度、不遮名称。 */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
/* 浏览器把内联的 #9165b3 读成 rgb(145, 101, 179)，断言前统一换算 */
const rgb=hex=>{const n=parseInt(hex.slice(1),16);return 'rgb('+(n>>16&255)+', '+(n>>8&255)+', '+(n&255)+')';};
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/storage-v1');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});

(async()=>{let browser;const reports=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url());});
  await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
  await p.waitForFunction(()=>typeof SlotDots!=='undefined'&&typeof StorageUI!=='undefined'&&StorageUI.mounted);

  /* ---- 布景：一把装三件的步枪、一把空枪、一把手枪（只有三个可装槽位） ---- */
  await p.evaluate(()=>{
    Save.stash=[];Save.bag=[];Save.safe=[];Save.credits=500000;
    Save.addGearStash(EQUIP.gun('m4a1',30,null,null,{attachments:{optic:'att_optic03',grip:'att_grip02',magazine:'att_mag_556_quick'}}));
    Save.addGearStash(EQUIP.gun('glock17',17));
    Save.bag=[{id:'g_akm',n:1,gear:EQUIP.gun('akm',30,null,null,{attachments:{optic:'att_optic04'}})}];
    Save.safe=[{id:'g_mp155',n:1,gear:EQUIP.gun('mp155',6,null,null,{attachments:{stock:'att_stock02'}})}];
    Save.gear.weapons[0]=EQUIP.gun('m4a1',30,null,null,{attachments:{optic:'att_optic02',grip:'att_grip02'}});
    Save.addGearStash(EQUIP.armor(GEAR.make('body',3,40)));      // 护甲不该有点
    Save.addGearStash({id:'ammo_9mm',n:30});                     // 弹药也不该有
    Safehouse.route('stash');Base.render();
  });
  await p.waitForTimeout(300);

  /* ---- 仓库格：点数 = 可装槽位，颜色 = 配件稀有度 ---- */
  const stash=await p.evaluate(()=>{
    const cells=[...document.querySelectorAll('#stashGrid .scell:not(.empty)')].map(c=>{
      const d=c.querySelector('.sdots');
      return {name:c.querySelector('.cn')?.textContent,
        dots:d?[...d.children].map(b=>b.className+':'+(b.style.background||'')):null};
    });
    return {cells,rules:{m4a1:SlotDots.slots('m4a1').length,glock:SlotDots.slots('glock17').length},
      colors:Object.fromEntries(RARITY.map(r=>[r.k,r.color]))};
  });
  const m4=stash.cells.find(c=>c.name==='M4A1');
  assert(m4&&m4.dots,'仓库里的步枪要有槽位点');
  assert.equal(m4.dots.length,stash.rules.m4a1,'点数等于可装槽位数');
  assert.equal(m4.dots.filter(d=>d.startsWith('on')).length,3,'装了三件就有三颗彩点');
  assert.equal(m4.dots[0],'on:'+rgb(stash.colors[3]),'瞄具点是上乘的蓝色：'+m4.dots[0]);
  assert.equal(m4.dots[1],'on:'+rgb(stash.colors[2]),'握把点是良品的绿色：'+m4.dots[1]);
  assert(m4.dots[3].startsWith('off'),'没装的枪口是灰点');
  const glock=stash.cells.find(c=>/Glock/i.test(c.name||''));
  assert(glock,'仓库里要有那把空手枪：'+stash.cells.map(c=>c.name).join('|'));
  assert.equal(glock.dots.length,3,'手枪只有瞄具/枪口/弹匣三个可装槽位');
  assert(glock.dots.every(d=>d.startsWith('off')),'空手枪三颗全灰');
  assert(!stash.cells.some(c=>/战术防弹衣/.test(c.name||'')&&c.dots),'护甲不该有槽位点');
  assert(!stash.cells.some(c=>/弹$/.test(c.name||'')&&c.dots),'弹药不该有槽位点');

  /* ---- 点不能压住名称（仓库格名称在右下角，点是左下一排） ---- */
  const clash=await p.evaluate(()=>{
    const out=[];
    for(const sel of ['#stashGrid .scell.has-dots','#baseBagGrid .cell.has-dots','#baseSafeGrid .cell.has-dots','#baseGear .slot.has-dots']){
      for(const el of document.querySelectorAll(sel)){
        const d=el.querySelector('.sdots'),n=el.querySelector('.cn,.slot-txt');
        if(!d||!n)continue;
        const dr=d.getBoundingClientRect(),nr=n.getBoundingClientRect();
        out.push({sel,overlap:dr.left<nr.right&&dr.right>nr.left&&dr.top<nr.bottom&&dr.bottom>nr.top,
          inside:el.getBoundingClientRect().bottom-dr.bottom>=-0.5});
      }
    }
    return out;
  });
  assert(clash.length>=4,'仓库、背包、保险箱、装备槽都该挂上点：'+clash.length);
  assert(clash.every(c=>!c.overlap),'点不能压住名称');
  assert(clash.every(c=>c.inside),'点不能溢出格子');

  /* ---- 装备槽 / 背包 / 保险箱 ---- */
  /* 开局默认就会带几把枪，所以按「装了枪的槽位数」对，而不是写死 1 */
  const gunSlots=await p.evaluate(()=>Save.gear.weapons.filter(Boolean).length);
  const gearDots=await p.locator('#baseGear .slot.has-dots .sdots').count();
  assert.equal(gearDots,gunSlots,'每个装了枪的装备槽都该有一排点（'+gearDots+'/'+gunSlots+'）');
  assert.equal(await p.locator('#baseBagGrid .cell.has-dots .sdots').count(),1,'背包里的枪要有点');
  assert.equal(await p.locator('#baseSafeGrid .cell.has-dots .sdots').count(),1,'保险箱里的枪要有点');

  /* ---- 详情浮窗：一排点 + 配件 N/M + 只列已装的槽位 ---- */
  await p.locator('[aria-label="搜索库存"]').fill('M4A1');
  await p.locator('#stashGrid .scell:not(.empty)').first().click();
  await p.waitForTimeout(250);
  const tip=await p.locator('#itemTip').innerText();
  assert(tip.includes('配件 3/5'),'详情要写装了几件：'+tip.split('\n').slice(0,4).join(' | '));
  assert(tip.includes('瞄具')&&tip.includes('握把')&&tip.includes('弹匣'),'详情要列出装了的槽位');
  assert(!tip.includes('尚未安装配件'),'装了配件就不该说尚未安装');
  assert.equal(await p.locator('#itemTip .sdots > b').count(),5,'详情里的点数和槽位数一致');
  const tipOrder=await p.evaluate(()=>{
    const tip=document.querySelector('#itemTip'),d=tip.querySelector('.sdots'),b=tip.querySelector('.medical-actions');
    return d.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?1:0;
  });
  assert.equal(tipOrder,1,'点排在按钮之前（名字下方）');
  await p.screenshot({path:path.join(out,file==='index.html'?'slotdots.png':'slotdots-offline.png')});

  /* ---- 商人货架：全新枪没有配件，也要把全部槽位画成灰点 ---- */
  await p.evaluate(()=>Safehouse.route('traders'));
  await p.waitForTimeout(300);
  await p.locator('[data-mb-open="gun"]').click();
  await p.waitForTimeout(500);
  const shop=await p.evaluate(()=>[...document.querySelectorAll('#shopGrid .scell')].map(c=>{
    const d=c.querySelector('.sdots');
    return {cat:c.closest('.shop-grid')?.previousElementSibling?.textContent||'',
      name:(c.querySelector('.cn')||{}).textContent||'',
      dots:d?[...d.children].map(b=>b.className):null};
  }));
  const shopGuns=shop.filter(c=>c.dots);
  assert(shopGuns.length>=10,'军火商货架的枪都要有点：'+shopGuns.length);
  const expect=await p.evaluate(()=>Object.fromEntries(Object.keys(WEAPONS).map(id=>[WEAPONS[id].short,SlotDots.slots(id).length])));
  for(const g of shopGuns) assert.equal(g.dots.length,expect[g.name],g.name+' 的点数要等于可装槽位（'+g.dots.length+'）');
  assert(shopGuns.every(g=>g.dots.every(d=>d==='off')),'货架上的新枪应该全是灰点（空槽）');
  assert(shop.some(c=>!c.dots),'弹药/配件格子不该有槽位点');
  await p.screenshot({path:path.join(out,file==='index.html'?'slotdots-shop.png':'slotdots-shop-offline.png')});
  await p.evaluate(()=>Safehouse.route('stash'));
  await p.waitForTimeout(300);

  /* ---- 局内：装备槽 / 背包 / 搜刮尸体 ---- */
  await p.evaluate(()=>{
    Base.close();Game.startRun(null);Game.enemies=[];
    Game.player.bag.add(EQUIP.gun('akm',30,null,null,{attachments:{optic:'att_optic04',stock:'att_stock03'}}),1);
    Game.toggleBag();
  });
  await p.waitForTimeout(500);
  const raid=await p.evaluate(()=>{
    const eq=[...document.querySelectorAll('#eqStrip .eqs')].map(e=>{
      const d=e.querySelector('.sdots');
      return {label:e.querySelector('.lbl')?.textContent,
        dots:d?[...d.children].map(b=>b.className+':'+(b.style.background||'')):null};
    });
    const bag=document.querySelector('#bagGrid .cell.has-dots');
    return {eq,bagDots:bag?[...bag.querySelectorAll('.sdots > b')].map(b=>b.className):null};
  });
  const prim=raid.eq[0];
  assert(prim.dots&&prim.dots.length===5,'局内主武器槽要有五个点');
  assert.equal(prim.dots.filter(d=>d.startsWith('on')).length,2,'装了两件就有两颗彩点');
  assert(raid.bagDots&&raid.bagDots.length===5,'局内背包里的枪也要有点');
  const stripClash=await p.evaluate(()=>{
    const out=[];
    for(const e of document.querySelectorAll('#eqStrip .eqs.has-dots')){
      const d=e.querySelector('.sdots'),t=e.querySelector('.tag');
      if(!d||!t)continue;
      const dr=d.getBoundingClientRect(),tr=t.getBoundingClientRect(),er=e.getBoundingClientRect();
      out.push({label:e.querySelector('.lbl')?.textContent,n:d.children.length,
        clash:dr.left<tr.right&&dr.right>tr.left&&dr.top<tr.bottom&&dr.bottom>tr.top,
        w:+er.width.toFixed(1),dotsR:+(dr.right-er.left).toFixed(1),tagL:+(tr.left-er.left).toFixed(1)});
    }
    return out;
  });
  assert(!stripClash.some(c=>c.clash),'装备槽里的点不能和弹药数字叠在一起：'+JSON.stringify(stripClash));

  await p.evaluate(()=>{
    Game.toggleBag();
    Game.openLoot({enemy:{t:{name:'拾荒者'}},items:[
      {gun:{id:'m4a1',magCur:30,attachments:{optic:'att_optic03'},fireMode:'auto',cycleRemaining:0}},
      {gear:GEAR.make('body',4,30,94)},null,null]},true);
  });
  await p.waitForTimeout(350);
  const loot=await p.evaluate(()=>{
    const cells=[...document.querySelectorAll('#lootGear .eqs')].map(e=>{
      const d=e.querySelector('.sdots');
      return {label:e.querySelector('.lbl')?.textContent,dots:d?d.children.length:0};
    });
    return cells;
  });
  assert(loot.some(c=>c.dots===5),'尸体上的枪也要有槽位点：'+JSON.stringify(loot));
  assert(!loot.some(c=>/甲|盔/.test(c.label||'')&&c.dots),'尸体护甲不该有点');

  assert.equal(errors.length,0,file+' 有报错：'+errors.join(' | '));
  reports.push(file+' ok');
  await p.close();
 }
 console.log(reports.join('\n'));
}finally{
 if(browser)await browser.close();
 server.close();
}})().catch(e=>{console.error(e);process.exit(1);});
