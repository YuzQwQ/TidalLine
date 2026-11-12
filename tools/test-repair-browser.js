const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/storage-v1');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});

(async()=>{let browser;const reports=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url());});
  await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
  await p.waitForFunction(()=>typeof Repair!=='undefined'&&typeof StorageUI!=='undefined'&&StorageUI.mounted);

  /* ---- 布景：身上一件打坏的四级甲、一件满耐久的头盔、仓库一件打坏的三级甲 ---- */
  await p.evaluate(()=>{
    Save.stash=[];Save.bag=[];Save.credits=500000;Save.hp=90;
    Save.gear.body=GEAR.make('body',4,20);        // 战术防弹衣 Lv4 / 110 / 陶瓷 Kr .090
    Save.gear.helmet=GEAR.make('helmet',3,45);    // 防撞头盔 45 / 满耐久
    Save.addGearStash(EQUIP.armor(GEAR.make('body',3,10))); // 轻型战术背心 85
    Safehouse.route('stash');
  });

  /* ---- 装备槽右键：多一条修理，点开是带数值的确认浮窗 ---- */
  await p.locator('#baseGear .slot').nth(4).click({button:'right'});
  const gearMenu=await p.locator('#ctxMenu .citem').allInnerTexts();
  assert(gearMenu.some(t=>t.trim().startsWith('修理')),'装备槽右键应有修理：'+gearMenu.join('|'));
  await p.locator('#ctxMenu .citem').filter({hasText:'修理'}).click();
  assert(await p.locator('#dealBox').isVisible(),'修理应弹出确认浮窗');
  const boxText=await p.locator('#dealBox').innerText();
  assert(boxText.includes('战术防弹衣'),'浮窗要写护甲名字');
  assert(boxText.includes('防护 Lv4'),'浮窗要写防护等级');
  assert(/耐久 20 → [\d.]+/.test(boxText),'浮窗要用一行小字写当前耐久与修完的耐久');
  assert(/上限 110 → [\d.]+/.test(boxText),'浮窗要写上限从当前上限降到哪里');
  assert(boxText.includes('防弹陶瓷')&&boxText.includes('耐修 84'),'浮窗要显示材质与耐修度');
  assert(/材质耐修损耗 ×0\.09/.test(boxText),'浮窗要写明材质 Kr');
  assert(!boxText.includes('耐修程度'),'简化后不再显示耐修程度');
  assert(!boxText.includes('当前信用点')&&!boxText.includes('成交后'),'简化后不再显示余额与成交后');
  assert(await p.locator('#dealBox .dbar').count()===1,'浮窗要有耐久条');
  const segs=await p.locator('#dealBox .dbar > b').evaluateAll(bs=>bs.map(b=>b.className+':'+b.style.width));
  assert.equal(segs.length,3,'耐久条分绿/灰/红三段');
  assert(segs[0].startsWith('dg:')&&segs[1].startsWith('ds:')&&segs[2].startsWith('dr:'),'三段顺序是绿灰红：'+segs.join('|'));
  const q=await p.evaluate(()=>{const q=Repair.quote(Save.gear.body);return {fee:q.fee,newMax:q.newMax,capLoss:q.capLoss,credits:Save.credits};});
  const feeText=await p.evaluate(f=>formatMoney(f),q.fee);
  assert((await p.locator('#dealBox .deal-sum').innerText()).includes(feeText),'浮窗修理费应与报价一致');
  await p.screenshot({path:path.join(out,file==='index.html'?'repair.png':'repair-offline.png')});

  /* ---- 确认修理：扣钱、补满耐久、削上限 ---- */
  await p.locator('#dealBox [data-a="go"]').click();
  const after=await p.evaluate(()=>({credits:Save.credits,dur:Save.gear.body.dur,max:Save.gear.body.max}));
  assert.equal(after.credits,q.credits-q.fee,'确认修理后应扣掉修理费');
  assert.equal(after.dur,q.newMax,'修理应把耐久补到新上限');
  assert.equal(after.max,q.newMax,'修理应削掉一截耐久上限');
  assert(after.max<110&&q.capLoss>0,'上限必须真的降下来');
  assert((await p.locator('.st-loadout #baseGear .slot').nth(4).innerText()).includes(String(q.newMax)),'装备槽应显示修完的耐久');

  /* ---- 详情浮窗里也有修理按钮 ---- */
  await p.evaluate(()=>{Save.gear.body.dur=30;Base.render();});
  await p.locator('#baseGear .slot').nth(4).click({button:'right'});
  await p.locator('#ctxMenu .citem').filter({hasText:'详情'}).click();
  assert(await p.locator('#itemTip').isVisible());
  const tipText=await p.locator('#itemTip').innerText();
  assert(tipText.includes('耐久上限'),'修过的甲在详情里要标出上限已降');
  assert(!tipText.includes('耐修程度'),'详情里也不再显示耐修程度');
  assert(await p.locator('#itemTip .dbar').count()===1,'详情浮窗要有耐久条');
  const tipOrder=await p.evaluate(()=>{const tip=document.querySelector('#itemTip');const bar=tip.querySelector('.dbar'),btns=tip.querySelector('.medical-actions');return bar.compareDocumentPosition(btns)&Node.DOCUMENT_POSITION_FOLLOWING?1:0;});
  assert.equal(tipOrder,1,'耐久条应排在按钮前面（名字下方）');
  assert((await p.locator('#itemTip .medical-actions button').allInnerTexts()).includes('修理'),'详情浮窗应有修理按钮');
  await p.locator('#itemTip .medical-actions button').filter({hasText:'修理'}).click();
  assert(await p.locator('#dealBox').isVisible(),'详情里的修理也要弹确认浮窗');
  await p.locator('#dealBox [data-a="no"]').click();
  assert(!(await p.locator('#dealBox').isVisible()),'取消不结算');

  /* ---- 满耐久的甲：点修理只给一句话，不弹窗 ---- */
  await p.locator('#baseGear .slot').nth(3).click({button:'right'});
  await p.locator('#ctxMenu .citem').filter({hasText:'修理'}).click();
  assert(!(await p.locator('#dealBox').isVisible()),'满耐久不该弹确认窗');
  assert((await p.locator('.st-feedback').innerText()).includes('耐久是满的'),'满耐久要给一句说明');

  /* ---- 仓库里的甲同样能修，修完回收价跟着重算 ---- */
  await p.evaluate(()=>{Save.credits=500000;});
  await p.locator('[aria-label="搜索库存"]').fill('轻型战术背心');
  await p.locator('#stashGrid .scell:not(.empty)').first().click();
  assert((await p.locator('#itemTip').innerText()).includes('10 / 85'),'仓库里的甲应显示当前耐久');
  const beforeSell=await p.evaluate(()=>Save.stash.find(e=>e.gear)?.gear.sell);
  await p.locator('#itemTip .medical-actions button').filter({hasText:'修理'}).click();
  const stashQ=await p.evaluate(()=>{const e=Save.stash.find(x=>x.gear);return Repair.quote(e.gear.equip.gear);});
  assert(/耐久 10 → [\d.]+/.test(await p.locator('#dealBox').innerText()),'仓库修理浮窗读数来自这件甲');
  await p.locator('#dealBox [data-a="go"]').click();
  const stashAfter=await p.evaluate(()=>{const e=Save.stash.find(x=>x.gear);return {dur:e.gear.equip.gear.dur,max:e.gear.equip.gear.max,sell:e.gear.sell};});
  assert.equal(stashAfter.dur,stashQ.newMax,'仓库里的甲也要补满');
  assert.equal(stashAfter.max,stashQ.newMax,'仓库里的甲上限也要降');
  assert.notEqual(stashAfter.sell,beforeSell,'修完回收价要重算');

  /* ---- 条子在各个容器里都挂上了 ---- */
  const bars=await p.evaluate(()=>({
    stash:document.querySelectorAll('#stashGrid .scell.has-dbar .dbar').length,
    gear:document.querySelectorAll('#baseGear .slot.has-dbar .dbar').length
  }));
  assert(bars.gear===2,'备战页头盔与护甲槽各一条（'+bars.gear+'）');
  assert(bars.stash>=1,'仓库护甲格也有条（'+bars.stash+'）');

  /* ---- 钱不够：按钮变灰、点不动 ---- */
  await p.evaluate(()=>{Save.credits=0;Save.gear.body.dur=10;Base.render();});
  await p.locator('[aria-label="搜索库存"]').fill('');
  await p.locator('#baseGear .slot').nth(4).click({button:'right'});
  await p.locator('#ctxMenu .citem').filter({hasText:'修理'}).click();
  assert((await p.locator('#dealBox [data-a="go"]').getAttribute('class')).includes('no'),'信用点不足时确认按钮要置灰');
  assert((await p.locator('#dealBox [data-a="go"]').innerText()).includes('钱不够'),'按钮要说明钱不够');
  await p.locator('#dealBox [data-a="go"]').click();
  assert.equal(await p.evaluate(()=>Save.credits),0,'钱不够时点了也不该结算');
  assert.equal(await p.evaluate(()=>Save.gear.body.dur),10,'钱不够时耐久不该被补满');

  /* ---- 枪和背包没有修理 ---- */
  await p.evaluate(()=>{Save.gear.weapons[0]=EQUIP.gun('rifle');Base.render();});
  await p.locator('#baseGear .slot').nth(0).click({button:'right'});
  const gunMenu=await p.locator('#ctxMenu .citem').allInnerTexts();
  assert(gunMenu.some(t=>t.includes('详情')),'枪的右键菜单应该在：'+gunMenu.join('|'));
  assert(!gunMenu.some(t=>t.includes('修理')),'枪不该出现修理');

  /* ---- 修完读档，痕迹不掉 ---- */
  const kept=await p.evaluate(()=>{const before={dur:Save.gear.body.dur,max:Save.gear.body.max};Save.save();Save.flush();Save.load();return {before,after:{dur:Save.gear.body.dur,max:Save.gear.body.max}};});
  assert.deepEqual(kept.after,kept.before,'读档后耐久与上限都不能变');
  assert(kept.after.max<110,'读档后上限不能回到模板值');

  await p.screenshot({path:path.join(out,file==='index.html'?'repair-done.png':'repair-done-offline.png')});
  assert.deepEqual(errors,[],'页面不应报错：'+errors.join(' | '));
  reports.push({file,menu:gearMenu.length,fee:q.fee,capLoss:q.capLoss,after});
  await p.close();
 }
 fs.writeFileSync(path.join(out,'repair-validation.json'),JSON.stringify({passed:true,reports},null,2)+'\n');
 console.log('PASS: armor repair — gear menu + detail button, quote (name/level/durability/new cap), pay+confirm, full-durability/hard-cap guards, stash armor, poor wallet, non-armor entries, save round-trip; development/offline');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
