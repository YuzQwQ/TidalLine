/* 彩蛋藏品验收：七件红色孤品的图标、详情原图、彩蛋标签与掉落池隔离。
   掉落概率的数值断言在 run-test.js（那里能直接调 Loot），这里只管看得见的部分。
   立绘分两批：easter-eggs-v1 首版四件、easter-eggs-v2 新增三件，
   两批都是 1254×1254 RGBA，48px 图标由 tools/prepare-easter-egg-icons.js 统一缩出。 */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/storage-v1');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});

/* id → [背包简称, 大类, 立绘批次] */
const EGGS=[
 ['odd13','奶龙雕像','异常遗物','v1'],
 ['odd14','应激标本','异常遗物','v1'],
 ['odd15','颂乐玩偶','异常遗物','v1'],
 ['odd16','持械木偶','异常遗物','v1'],
 ['collect_secret01','XP画框','文物藏品','v2'],
 ['elec_secret01','6090Ti','电子产品','v2'],
 ['elec_secret02','诺鸡鸭','电子产品','v2']
];
const stashAll=ids=>{Save.stash=[];Save.bag=[];Save.credits=900000;for(const id of ids)Save.stash.push({id,n:1});Safehouse.route('stash');Base.render();};
const eggIds=EGGS.map(e=>e[0]);
const clickShort=async(p,short)=>{
  await p.evaluate(()=>Tips.hide());
  await p.locator('#stashGrid .scell:not(.empty)').filter({hasText:short}).first().click();
  await p.waitForTimeout(280);
};

(async()=>{let browser;const reports=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  const solo=file!=='index.html';
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url());});
  await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
  await p.waitForFunction(()=>typeof StorageUI!=='undefined'&&StorageUI.mounted);

  /* ---- 七件彩蛋进仓库 ---- */
  await p.evaluate(stashAll,eggIds);
  await p.waitForTimeout(400);
  const cells=await p.evaluate(()=>[...document.querySelectorAll('#stashGrid .scell:not(.empty)')].map(c=>({
    cls:c.className,name:(c.querySelector('.cn')||{}).textContent,
    img:c.querySelector('img')?{src:c.querySelector('img').getAttribute('src'),w:c.querySelector('img').naturalWidth}:null
  })));
  assert.equal(cells.length,7,'仓库里应有七件彩蛋');
  assert(cells.every(c=>/ r6 /.test(' '+c.cls+' ')),'七件都是 r6 红色格：'+cells.map(c=>c.cls).join('|'));
  assert(cells.every(c=>c.img&&c.img.w>0),'每件都要有自己的 48px 图标：'+JSON.stringify(cells.map(c=>c.img)));
  /* 单文件版把图标内联成 data URI，多文件版才是路径 */
  if(solo)assert(cells.every(c=>c.img.src.startsWith('data:image/png')),'单文件版图标应内联成 data URI');
  else for(const [id] of EGGS){
    assert(cells.some(c=>c.img.src.endsWith('/'+id+'.png')),'多文件版应指向 assets/items/'+id+'.png');
  }

  /* ---- 详情浮窗：彩蛋标签 + 分类 + 稀有度 + 正文 ---- */
  for(const [id,short,cat] of EGGS){
    await clickShort(p,short);
    const tip=await p.locator('#itemTip').innerText();
    const sub=await p.locator('#itemTip .tip-sub').innerText();
    const label=await p.locator('#itemTip .tip-egg').count();
    assert.equal(label,1,id+' 要有彩蛋标签');
    assert.equal((await p.locator('#itemTip .tip-egg').innerText()).trim(),'彩蛋');
    assert(sub.includes(cat)&&sub.includes('孤品')&&sub.includes('彩蛋'),
      id+' 的标签行应同时有分类/稀有度/彩蛋：'+sub);
    const name=await p.evaluate(id=>ITEM_BY_ID[id].name,id);
    assert(tip.includes(name),id+' 详情应显示全名 '+name+'：'+tip.slice(0,60));
  }
  /* 首版那件的正文与分类口径保持原样 */
  await clickShort(p,'奶龙雕像');
  const tip=await p.locator('#itemTip').innerText();
  assert(tip.includes('捧腹者雕像')&&tip.includes('奶龙'),'首版彩蛋详情显示名字与文案');

  /* ---- 普通收集品不该有彩蛋标签 ---- */
  await p.evaluate(()=>{Tips.hide();Save.stash=[{id:'odd01',n:1}];Base.render();});
  await p.locator('#stashGrid .scell:not(.empty)').first().click();
  await p.waitForTimeout(250);
  assert.equal(await p.locator('#itemTip .tip-egg').count(),0,'非彩蛋物品不能带标签');
  assert((await p.locator('#itemTip').innerText()).includes('回响结晶'));

  /* ---- 详情原图：多文件版直接读 1254px 原稿；单文件版按设计回落 48px 图标 ---- */
  await p.evaluate(stashAll,eggIds);
  for(const [id,short,,batch] of EGGS.filter(e=>e[3]==='v2').concat([EGGS[0]])){
    await clickShort(p,short);
    await p.waitForTimeout(280);
    const art=await p.evaluate(()=>{
      const img=document.querySelector('#itemTip img');
      return img?{src:img.getAttribute('src'),w:img.naturalWidth,h:img.naturalHeight}:null;
    });
    assert(art,id+' 详情要有图');
    if(solo){
      assert(art.w<=96,id+' 单文件版详情应回落 48px 图标（'+art.w+'）');
    }else{
      const expect='easter-eggs-'+batch+'/sources/'+id+'.png';
      assert(art.src.includes(expect),id+' 多文件版应加载 '+expect+'，实际 '+art.src);
      assert(art.w>=1000&&art.h>=1000,id+' 原稿是 1254×1254 整图（'+art.w+'×'+art.h+'）');
    }
  }

  /* ---- 掉落池隔离：彩蛋只能来自按品质分级的那条支线 ---- */
  const pool=await p.evaluate(()=>({
    eggs:Loot.eggPool().map(i=>i.id),
    chance:CFG.LOOT.eggChance,
    byQuality:Object.keys(CFG.LOOT.eggByQuality).map(q=>q+':'+Loot.eggChanceFor(q)).join(','),
    inRoll:(()=>{let hit=0;const keep=CFG.LOOT.eggChance;CFG.LOOT.eggChance=0;
      for(let i=0;i<3000;i++)if(Loot.roll('secret').item.egg)hit++;CFG.LOOT.eggChance=keep;return hit;})(),
    fromPool:Loot.pickFromPool(ITEMS.filter(i=>i.egg))
  }));
  assert.deepEqual(pool.eggs,EGGS.map(e=>e[0]),'彩蛋池就是这七件');
  assert.equal(pool.chance,0.02,'没有品质信息时兜底中签率 2%');
  assert.equal(pool.byQuality,'junk:0,plain:0,ample:0.01,fine:0.04,rich:0.12,secret:0.25','品质分级中签率');
  assert.equal(pool.inRoll,0,'常规池不得漏出彩蛋');
  assert.equal(pool.fromPool,null,'尸体/敌人池不得包含彩蛋');

  await p.evaluate(()=>Tips.hide());
  await p.evaluate(stashAll,eggIds);
  await p.waitForTimeout(300);
  await p.screenshot({path:path.join(out,file==='index.html'?'easter-eggs.png':'easter-eggs-offline.png')});
  assert.equal(errors.length,0,file+' 有报错：'+errors.join(' | '));
  reports.push(file+' ok');
  await p.close();
 }
 console.log(reports.join('\n'));
}finally{
 if(browser)await browser.close();
 server.close();
}})().catch(e=>{console.error(e);process.exit(1);});
