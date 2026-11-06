/* 彩蛋藏品验收：四件红色孤品的图标、详情原图、彩蛋标签与掉落池隔离。
   掉落概率的数值断言在 run-test.js（那里能直接调 Loot），这里只管看得见的部分。 */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/storage-v1');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.webp')?'image/webp':f.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});

(async()=>{let browser;const reports=[];await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const file of ['index.html','潮汐线.html']){
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  const solo=file!=='index.html';
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.url());});
  await p.goto('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(file)+'#base');
  await p.waitForFunction(()=>typeof StorageUI!=='undefined'&&StorageUI.mounted);

  /* ---- 四件彩蛋进仓库 ---- */
  await p.evaluate(()=>{
    Save.stash=[];Save.bag=[];Save.credits=900000;
    for(const id of ['odd13','odd14','odd15','odd16']) Save.stash.push({id,n:1});
    Safehouse.route('stash');Base.render();
  });
  await p.waitForTimeout(400);

  const cells=await p.evaluate(()=>[...document.querySelectorAll('#stashGrid .scell:not(.empty)')].map(c=>({
    cls:c.className,name:(c.querySelector('.cn')||{}).textContent,
    img:c.querySelector('img')?{src:c.querySelector('img').getAttribute('src'),w:c.querySelector('img').naturalWidth}:null
  })));
  assert.equal(cells.length,4,'仓库里应有四件彩蛋');
  assert(cells.every(c=>/ r6 /.test(' '+c.cls+' ')),'四件都是 r6 红色格：'+cells.map(c=>c.cls).join('|'));
  assert(cells.every(c=>c.img&&c.img.w>0),'每件都要有自己的 48px 图标：'+JSON.stringify(cells.map(c=>c.img)));
  /* 单文件版把图标内联成 data URI，多文件版才是路径 */
  assert(cells.every(c=>solo?c.img.src.startsWith('data:image/png'):/assets\/items\/odd1[3-6]\.png/.test(c.img.src)),
    '图标要指向 odd13–16 的 48px 文件：'+JSON.stringify(cells.map(c=>c.img.src.slice(0,48))));

  /* ---- 详情浮窗：彩蛋标签 + 分类 + 稀有度 + 正文 ---- */
  /* 仓库按价值排序，第一格是最贵的那件，所以按简称找奶龙雕像 */
  await p.locator('#stashGrid .scell:not(.empty)').filter({hasText:'奶龙雕像'}).first().click();
  await p.waitForTimeout(300);
  const tip=await p.locator('#itemTip').innerText();
  assert(tip.includes('捧腹者雕像'),'详情显示名字');
  assert(tip.includes('异常遗物'),'大类仍是异常遗物');
  assert(tip.includes('孤品'),'稀有度仍是孤品');
  assert(await p.locator('#itemTip .tip-egg').count()===1,'要有彩蛋标签');
  assert.equal((await p.locator('#itemTip .tip-egg').innerText()).trim(),'彩蛋');
  assert(tip.includes('奶龙'),'正文要带文案');
  /* 彩蛋标签不能顶掉分类与稀有度：两者仍需同时可见 */
  const sub=await p.locator('#itemTip .tip-sub').innerText();
  assert(/异常遗物/.test(sub)&&/孤品/.test(sub)&&/彩蛋/.test(sub),'标签行应同时有分类/稀有度/彩蛋：'+sub);

  /* ---- 普通收集品不该有彩蛋标签 ---- */
  await p.evaluate(()=>{Tips.hide();Save.stash=[{id:'odd01',n:1}];Base.render();});
  await p.locator('#stashGrid .scell:not(.empty)').first().click();
  await p.waitForTimeout(250);
  assert.equal(await p.locator('#itemTip .tip-egg').count(),0,'非彩蛋物品不能带标签');
  assert((await p.locator('#itemTip').innerText()).includes('回响结晶'));

  /* ---- 详情原图：多文件版直接读 1254px 原稿；单文件版按设计回落 48px 图标 ---- */
  await p.evaluate(()=>{Tips.hide();Save.stash=[];for(const id of ['odd13','odd14','odd15','odd16'])Save.stash.push({id,n:1});Base.render();});
  await p.locator('#stashGrid .scell:not(.empty)').filter({hasText:'奶龙雕像'}).first().click();
  await p.waitForTimeout(400);
  const art=await p.evaluate(()=>{
    const img=document.querySelector('#itemTip img');
    return img?{src:img.getAttribute('src'),w:img.naturalWidth,h:img.naturalHeight}:null;
  });
  assert(art,'详情要有图');
  if(solo){
    assert(art.w<=96,'单文件版详情应回落 48px 图标（'+art.w+'）');
  }else{
    assert(art.src.includes('easter-eggs-v1/sources/odd13.png'),'多文件版应加载彩蛋原稿：'+art.src);
    assert(art.w>=1000&&art.h>=1000,'原稿是 1254×1254 的整图（'+art.w+'×'+art.h+'）');
  }

  /* ---- 掉落池隔离：彩蛋只能来自那段 2% 的支线 ---- */
  const pool=await p.evaluate(()=>({
    eggs:Loot.eggPool().map(i=>i.id),
    chance:CFG.LOOT.eggChance,
    inRoll:(()=>{let hit=0;const keep=CFG.LOOT.eggChance;CFG.LOOT.eggChance=0;
      for(let i=0;i<3000;i++)if(Loot.roll('secret').item.egg)hit++;CFG.LOOT.eggChance=keep;return hit;})(),
    fromPool:Loot.pickFromPool(ITEMS.filter(i=>i.egg))
  }));
  assert.deepEqual(pool.eggs,['odd13','odd14','odd15','odd16'],'彩蛋池就是这四件');
  assert.equal(pool.chance,0.02,'掉落概率 2%');
  assert.equal(pool.inRoll,0,'常规池不得漏出彩蛋');
  assert.equal(pool.fromPool,null,'尸体/敌人池不得包含彩蛋');

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
