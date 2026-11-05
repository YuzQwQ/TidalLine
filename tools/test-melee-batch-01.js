/* 首批新增近战：真实军火商交易、最新文案、装备存档与七套攻击素材。 */
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/melee-batch-01');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio','--no-proxy-server']});
  try{for(const file of ['index.html','潮汐线.html']){
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(pathToFileURL(path.join(root,file)).href+'#base');
    await page.waitForFunction(()=>typeof MerchantUI!=='undefined'&&MerchantUI.mounted&&Icons.gear.melee07);
    await page.evaluate(()=>{Save.credits=2000000;Save.stash=[];MerchantUI.open('gun');});
    await page.locator('[data-mb-filter="melee"]').click();
    assert.deepEqual(await page.locator('#shopGrid [data-melee]:visible').evaluateAll(c=>c.map(x=>x.dataset.melee)),['melee01','melee02','melee04','melee05','melee06']);
    for(const id of ['melee05','melee06','melee04']){
      await page.locator('#shopGrid [data-melee="'+id+'"]').click();
      if(id==='melee06'){
        assert((await page.locator('.mb-inspector').innerText()).includes('物理学圣剑'));
        assert.equal(await page.locator('.mb-inspector strong').innerText(),'「科研」。');
        assert((await page.locator('.mb-inspector').innerText()).includes('二十四根撬棍'));
        await page.screenshot({path:path.join(out,file==='index.html'?'shop.png':'offline-shop.png')});
      }
      await page.locator('[data-mb-confirm]').click();
      await page.locator('#dealBox .go').click();
    }
    assert.equal(await page.evaluate(()=>Save.credits),1137500);
    const state=await page.evaluate(()=>{
      const denied=['melee03','melee07'].map(id=>Base.buyMelee(id));
      const e=Save.stash.find(e=>e.gear?.equip?.melee==='melee06');
      const equipped=Base.equipFromStash(e,'melee');Save.flush();Save.load();
      return {denied,equipped,id:Save.gear.melee.equip.melee,desc:EQUIP.melee('melee06').desc};
    });
    assert.deepEqual(state.denied,[false,false]);assert(state.equipped);assert.equal(state.id,'melee06');
    assert(state.desc.endsWith('「科研」。'));
    await page.waitForFunction(()=>MELEE.every(d=>['e','n','s'].every(dir=>{
      const im=Art.get('anim','player_melee_'+d.id+'_'+dir);return im&&im.complete&&im.naturalWidth===256;
    })));
    const sprites=await page.evaluate(()=>{
      Base.close();Game.startRun(null);Game.enemies=[];
      const p=Game.player,cv=document.createElement('canvas');cv.width=cv.height=64;
      return MELEE.map(d=>{
        p.melee=EQUIP.melee(d.id);p.meleeActive=true;
        return ['e','n','s'].every(dir=>{
          const angle=dir==='e'?0:dir==='n'?-Math.PI/2:Math.PI/2;
          p.meleeAttack={phase:'windup',weapon:d,start:p.meleeClock||0,angle,debug:[]};
          return Art.drawChar(cv.getContext('2d'),'player',angle,32,32,p,1).sheet.naturalWidth===256;
        });
      });
    });
    assert(sprites.every(Boolean));
    const drops=await page.evaluate(()=>{
      const random=Math.random;let result;
      try{
        Math.random=()=>0; // 确定性触发额外池，验证打包后的真实路径。
        const type=CONTAINER_TYPES.K,items=Loot.fill(type.q,type.cats,type);
        const e=new Enemy('retriever',Game.player.x+30,Game.player.y),corpse=new Corpse(e.x,e.y,e);
        result={boxItems:items.length,boxKnife:items.at(-1).item.equip.melee,
          corpseKnife:corpse.loot.at(-1).item.equip.melee,fromBag:corpse.loot.at(-1).fromBag,
          unbound:!corpse.loot.at(-1).item.equip.bound};
      }finally{Math.random=random;}
      return result;
    });
    assert.deepEqual(drops,{boxItems:4,boxKnife:'melee03',corpseKnife:'melee03',fromBag:true,unbound:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: '+file+' new shop inventory, exact payment, crowbar lore/emphasis, save/equip, 7x3 attack strips');
    await page.close();
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
