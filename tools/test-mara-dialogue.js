/* 玛拉（shop）的运行时语音：进店、闲置、购买、出售与三档收购反应是否真的会说。 */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/npcs/mara-dialogue');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'text/html;charset=utf-8'}).end(b));});

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:'+server.address().port+'/index.html#base');
    await p.waitForFunction(()=>typeof MerchantSpeech!=='undefined'&&typeof Sales!=='undefined');
    await p.evaluate(()=>{Save.stash=[];Save.bag=[];Save.credits=1e6;Save.hp=100;Safehouse.route('traders');});

    /* 总览卡片用的是 MERCHANT_UI_CONFIG.shop.description，换文案后要真的显示出来 */
    assert((await p.locator('[data-mb-open="shop"]').innerText()).includes('我卖的是防护装备，不是活命的保证'));

    await p.locator('[data-mb-open="shop"]').click();
    assert.equal(await p.evaluate(()=>MerchantSpeech.line.merchant),'shop');
    assert(await p.evaluate(()=>MERCHANT_DIALOGUE.shop.greeting.includes(MerchantSpeech.line.text)),'进店台词应来自 shop 池');
    const first=await p.evaluate(()=>MerchantSpeech.line.text);
    await p.evaluate(()=>MerchantSpeech.say('greeting'));
    assert.notEqual(await p.evaluate(()=>MerchantSpeech.line.text),first,'两条问候不应连续重复');
    await p.evaluate(()=>MerchantSpeech.idle());
    assert(await p.evaluate(()=>MerchantSpeech.line.kind==='idle'&&MERCHANT_DIALOGUE.shop.idle.includes(MerchantSpeech.line.text)),'闲置台词');
    await p.screenshot({path:path.join(out,'shop-idle.png')});

    /* 买背包走的是 Base.buyBag，之前没被接线，玛拉一句成交话都不会说 */
    await p.evaluate(()=>Base.buyBag('bag01'));
    assert(await p.evaluate(()=>MerchantSpeech.line.kind==='purchase'&&MERCHANT_DIALOGUE.shop.purchase.includes(MerchantSpeech.line.text)),'买背包应有成交台词');

    /* 出售：整批同档位走收购反应，混合批次走通用结算口径。
       spec 用 {gear:'bag02'} 放装备（玛拉主营，100% → 偏好），{item:'med02'} 放收集品（60% → 低价）。 */
    const sell=async specs=>p.evaluate(list=>{
      Save.stash=[];
      for(const s of list){ if(s.gear)Save.addGearStash(EQUIP.bag(s.gear)); else Save.addStash(s.item,1); }
      MerchantUI.mode='sell';
      const pv=Sales.preview('shop',Save.stash.map(entry=>({entry,n:1})));
      const token=Sales.authorize(pv),r=Sales.commit(token);
      return {ok:r.ok,reason:r.reason,kind:MerchantSpeech.line&&MerchantSpeech.line.kind,text:MerchantSpeech.line&&MerchantSpeech.line.text,statuses:pv.rows.map(x=>x.status)};
    },specs);

    const preferred=await sell([{gear:'bag02'}]);
    assert.deepEqual(preferred.statuses,['preferred'],'背包对玛拉属于偏好收购');
    assert.equal(preferred.ok,true,'出售应成功：'+preferred.reason);
    assert.equal(preferred.kind,'buybackPreferred','整批偏好应说偏好反应');
    assert(await p.evaluate(t=>MERCHANT_DIALOGUE.shop.buybackPreferred.includes(t),preferred.text));

    const low=await sell([{item:'med02'}]);
    assert.deepEqual(low.statuses,['low'],'非主营收集品是低价兜底');
    assert.equal(low.kind,'buybackLow','整批低价应说低价反应');
    assert(await p.evaluate(t=>MERCHANT_DIALOGUE.shop.buybackLow.includes(t),low.text));

    const mixed=await sell([{gear:'bag03'},{item:'med02'}]);
    assert.deepEqual(mixed.statuses.sort(),['low','preferred'],'混合档位');
    assert.equal(mixed.kind,'sell','混合批次走通用出售结算');
    assert(await p.evaluate(t=>MERCHANT_DIALOGUE.shop.sell.includes(t),mixed.text));
    await p.screenshot({path:path.join(out,'shop-sell.png')});

    /* 未接线的六条：写在前，留了位置，但语音池不该取到它们 */
    assert.equal(await p.evaluate(()=>MerchantSpeech.pick('trust2')),null,'信任台词还没接线，不该被随机取到');
    assert.equal(await p.evaluate(()=>Object.keys(MERCHANT_DIALOGUE.shop.reserved).length),6,'六条预留台词');

    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,greeting:true,idle:true,purchase:true,buyback:{preferred:preferred.text,low:low.text,sell:mixed.text},errors},null,2)+'\n');
    console.log('PASS: 玛拉总览文案/进店/闲置/买背包成交/偏好与低价收购反应/混合批次结算/预留台词不入池');
    await p.close();
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
