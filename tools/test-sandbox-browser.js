const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/sandbox-v1');
async function main(){const b=await chromium.launch({channel:'msedge',headless:true}),results=[];fs.mkdirSync(out,{recursive:true});
 try{for(const file of ['doors.html','潮汐线.html']){const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.join(root,file)).href+(file==='doors.html'?'':'#sandbox-test'));await p.waitForFunction(()=>typeof Sandbox!=='undefined'&&Sandbox.active&&Game.boxes.filter(b=>b.groundLoot).length===19&&Sandbox.samples.every(([id])=>Icons.get(id)));
 const result=await p.evaluate(()=>{
  const check=(c,m)=>{if(!c)throw Error(m);},saved=JSON.stringify({bag:Save.bag,safe:Save.safe,gear:Save.gear,stash:Save.stash,codex:Save.codex,credits:Save.credits}),storage=JSON.stringify(localStorage);
  const first=Game.boxes.find(b=>b.groundLoot),item=first.items[0].item;const grades=Array(6).fill(0);for(const box of Game.boxes.filter(b=>b.groundLoot))grades[box.items[0].item.r-1]++;check(grades.every((n,i)=>n===(i===5?4:3)),'six rarities with three samples each');
  const probe=document.createElement('canvas');probe.width=probe.height=40;const mask=probe.getContext('2d');mask.fillStyle='#fff';mask.fillRect(8,8,24,24);for(const rarity of RARITY){const halo=GroundLoot.halo(probe,rarity.color),pixels=halo.getContext('2d').getImageData(0,0,halo.width,halo.height).data,expected=rarity.color.slice(1).match(/../g).map(h=>parseInt(h,16));let visible=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]===255){visible++;check(expected.every((v,k)=>pixels[i+k]===v),'wrong rarity border RGB');}check(visible>0,'empty rarity halo');}
  check(GroundLoot.halo(probe,RARITY[0].color)===GroundLoot.halo(probe,RARITY[0].color),'halo cache');check(M.walkable(first.tx,first.ty),'ground item collision');check(!M.opaque(first.tx,first.ty),'ground item sight');
  const im=GroundLoot.sprite(item);check(im.width===40&&im.height===40,'cropped existing icon cache');
  Game.player.x=first.x;Game.player.y=first.y+20;Game.interactKey=null;Game.action=null;Game.handleInteract();check(!Game.boxes.includes(first)&&Game.player.bag.slots.some(e=>e.item.id===item.id),'E pickup / disappearance');
  const next=Game.boxes.find(b=>b.groundLoot);const oldSlots=Game.player.bag.slots;Game.player.bag.slots=Array.from({length:bagSlots()},()=>({item:ITEM_BY_ID.life01,n:1}));check(!GroundLoot.take(next)&&Game.boxes.includes(next)&&next.items[0],'full bag deleted ground item');Game.player.bag.slots=oldSlots;
  Sandbox.populate();check(Game.boxes.filter(b=>b.groundLoot).length===19,'replenish');check(M.doors.length===7,'door fixtures lost');
  const bag=Save.bag;Sandbox.start();check(Save.bag===bag,'prepared bag reference consumed');
  check(JSON.stringify({bag:Save.bag,safe:Save.safe,gear:Save.gear,stash:Save.stash,codex:Save.codex,credits:Save.credits})===saved,'player save mutated');check(JSON.stringify(localStorage)===storage,'localStorage mutated');
  return{sixRaritiesThreeEach:true,rarityBorderPixels:true,reusesIcons:true,nonBlocking:true,ePickup:true,fullBagPreservesLoot:true,replenish:true,doorsPreserved:true,saveIsolation:true};
 });
 for(const size of ['12','16','20','24']){await p.locator('[data-ground-size]').selectOption(size);assert.equal(await p.evaluate(()=>GroundLoot.size),Number(size));}
 await p.locator('[data-ground-size]').selectOption('16');await p.locator('[data-ground-outline]').uncheck();assert.equal(await p.evaluate(()=>GroundLoot.outline),false);await p.locator('[data-ground-outline]').check();
 await p.screenshot({path:path.join(out,file==='doors.html'?'runtime.png':'offline-runtime.png')});assert.deepEqual(errors,[]);results.push({file,...result,errors});await p.close();}
 }finally{await b.close();}fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,results},null,2));console.log('PASS: general sandbox entry, 19 ground items (including one easter egg) across six rarities, icon cache and size controls, E pickup, collision/sight, full bag, reset and save isolation; development/offline');}
main().catch(e=>{console.error(e);process.exitCode=1;});
