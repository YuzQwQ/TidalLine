const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),http=require('http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'design/ui/loot-spawns-v1'),Spec=require('../js/loot-spawn-data');
const harness=fs.readFileSync(path.join(root,'run-test.js'),'utf8').split('let pass = 0')[0],c=new Function('require','__dirname',harness+'\nreturn ctx;')(require,root);c.assert=assert;
vm.runInContext(`const spec={id:'t',x:3,y:3,...LootSpawnSpec.defaults,chance:100,weights:[0,0,0,0,0,100]};for(let i=0;i<100;i++)assert.equal(GroundSpawns.roll(spec).item.r,6);for(const pool of Object.keys(LootSpawnSpec.pools)){const entry=GroundSpawns.roll({...spec,pool,weights:[10,18,32,30,9.5,.5]});assert(entry&&entry.item,pool+' empty');}M.load(Array(10).fill('..........'),{},[],null);Game.boxes=[];GroundSpawns.generate({lootSpawns:[spec,{...spec,id:'none',x:4,chance:0}]});assert.equal(Game.boxes.length,1);assert(M.walkable(3,3));assert(Game.boxes[0].groundLoot);assert(!M.at(3,3).box);`,c);
assert(!Spec.valid({id:'bad',x:1,y:1,...Spec.defaults,weights:[0,0,0,0,0,0]}));
/* 五套预案：六档、合计100、可被 matchPreset 识别；默认权重不属于任何预案 */
assert.equal(Spec.presets.length,5);
for(const ps of Spec.presets){assert.equal(ps.weights.length,6,ps.key);assert(Math.abs(ps.weights.reduce((a,b)=>a+b,0)-100)<.001,ps.key+' 合计');assert.equal(Spec.matchPreset(ps.weights),ps.key);assert(ps.chance>0&&ps.chance<100,ps.key+' 出现率不该是 0/100');}
assert.equal(Spec.matchPreset([...Spec.defaults.weights]),null);
assert(Spec.defaults.chance<100,'新建点默认出现率不该是 100%');
/* coverage 必须与运行时候选表同步，否则编辑器的空档警告会说谎 */
const realCov=vm.runInContext(`(()=>{const r={};for(const pool of Object.keys(LootSpawnSpec.pools)){const items=GroundSpawns.candidates(pool).filter(Boolean);r[pool]=Array.from({length:6},(_,k)=>items.some(it=>(it.r||1)===k+1)?1:0);}return r;})()`,c);
assert.deepEqual(Spec.coverage,JSON.parse(JSON.stringify(realCov)),'coverage 与运行时候选表不同步');
const none=Spec.effective({pool:'attachment',weights:[0,0,0,0,20,80]});assert.equal(none.spawns,false);assert.equal(none.sum,0);assert.deepEqual(none.empty,[4,5]);
const gunEff=Spec.effective({pool:'gun',weights:[10,18,32,30,9.5,.5]});assert(gunEff.spawns);assert(Math.abs(gunEff.sum-99.5)<.001);assert.deepEqual(gunEff.empty,[5]);
async function main(){const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html;charset=utf-8');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server.close();throw e;});fs.mkdirSync(out,{recursive:true});
try{const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/design/maps/editor/index.html');await p.waitForFunction(()=>window.__editor?.store.get().data);
await p.evaluate(()=>{const data=MapTemplates.create({id:'loot-spawn-test',width:30,height:24,template:'blank'}).data;data.props=[{id:'table',type:'barrel',x:10,y:10,footprint:[1,1],solid:true}];__editor.apply({data,rules:{},source:'test'},{silent:true});});
assert.equal(await p.locator('#layers label').first().innerText(),'物资刷新点（置顶）');await p.locator('[data-key="lootSpawn:all"]').evaluate(e=>e.click());
await p.evaluate(()=>{const e=__editor;for(const[x,y]of [[8,8],[10,10]]){const r=e.history.apply('放置刷新点',d=>e.tools.place(d,e.store.get().material,x,y));if(!r.value.ok)throw Error(r.value.reason);}e.select({kind:'lootSpawn',id:'loot-2'});if(e.tools.entityAt(e.store.get().data,10,10).kind!=='lootSpawn')throw Error('spawn layer not on top');});
await p.getByLabel('刷新类型',{exact:true}).selectOption('mil');for(const color of ['白','绿','蓝','紫','金','红']){await p.getByLabel(color+'品质 %',{exact:true}).fill(color==='红'?'100':'0');await p.getByLabel(color+'品质 %',{exact:true}).press('Tab');}
const saved=await p.evaluate(()=>MapCore.serialize(__editor.store.get().data));assert.equal(JSON.parse(saved).lootSpawns[1].weights[5],100);
await p.evaluate(()=>{const e=__editor;e.history.undo();e.history.redo();const saved=MapCore.serialize(e.store.get().data);e.apply({data:MapCore.parse(saved),rules:{},source:'reopen'},{silent:true});if(e.store.get().data.lootSpawns.length!==2)throw Error('save/reopen');if(e.tools.moveTo(e.store.get().data,{kind:'lootSpawn',id:'loot-1'},11,10))throw Error('move');e.select({kind:'lootSpawn',id:'loot-2'});});await p.getByLabel('刷新类型',{exact:true}).waitFor({state:'visible'});await p.screenshot({path:path.join(out,'editor.png')});
/* 预案下拉：一键套用并同步六个输入框，逐档改动回到自定义，空档给出警告 */
await p.getByLabel('出货预案',{exact:true}).selectOption('S4');
const presetSaved=await p.evaluate(()=>MapCore.serialize(__editor.store.get().data));
assert.deepEqual(JSON.parse(presetSaved).lootSpawns[1].weights,Spec.presets.find(x=>x.key==='S4').weights,'preset not applied');
assert.equal(await p.getByLabel('金品质 %',{exact:true}).inputValue(),'25','weight input not synced');
assert.equal(JSON.parse(presetSaved).lootSpawns[1].chance,30,'preset chance not applied');
assert.equal(await p.getByLabel('出现概率 %',{exact:true}).inputValue(),'30','chance input not synced');
assert((await p.locator('#inspector').innerText()).includes('当前出现率 30%'),'chance summary missing');
await p.screenshot({path:path.join(out,'editor.png')});
await p.getByLabel('金品质 %',{exact:true}).fill('30');await p.getByLabel('金品质 %',{exact:true}).press('Tab');
assert.equal(await p.getByLabel('出货预案',{exact:true}).inputValue(),'','manual edit should clear preset');
await p.getByLabel('刷新类型',{exact:true}).selectOption('attachment');
assert((await p.locator('#inspector').innerText()).includes('档在此池无物品'),'missing empty-tier warning');
await p.getByLabel('刷新类型',{exact:true}).selectOption('mil');
await p.getByRole('button',{name:'删除刷新点',exact:true}).click();assert.equal(await p.evaluate(()=>__editor.store.get().data.lootSpawns.length),1);await p.evaluate(()=>__editor.history.undo());assert.equal(await p.evaluate(()=>__editor.store.get().data.lootSpawns.length),2);assert.deepEqual(errors,[]);await p.close();const runtime=await b.newPage();await runtime.goto('http://127.0.0.1:'+server.address().port+'/index.html#sandbox-test');await runtime.waitForFunction(()=>typeof Sandbox!=='undefined'&&Sandbox.active);await runtime.evaluate(()=>{const s={id:'furniture',x:8,y:10,...LootSpawnSpec.defaults,chance:100,pool:'mil',weights:[0,0,0,0,0,100]};const tile=M.at(8,10);tile.obstacle=true;tile.prop={id:'test-table'};Game.boxes=[];GroundSpawns.generate({lootSpawns:[s]});const box=Game.boxes[0];if(!box||M.walkable(8,10))throw Error('furniture collision changed');Game.player.x=box.x;Game.player.y=box.y+24;Game.interactKey=null;Game.action=null;Game.handleInteract();if(Game.boxes.includes(box)||!Game.player.bag.slots.some(e=>e.item.cat==='mil'&&e.item.r===6))throw Error('furniture surface pickup failed');});await runtime.close();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,furnitureAndFloor:true,topLayer:true,manualRarity:true,allPools:true,runtimeSpawning:true,undoRedoMoveDeleteSaveReopen:true,presets:5,presetApply:true,chanceApplied:true,defaultChanceBelow100:true,emptyTierWarning:true,coverageSynced:true},null,2));console.log('PASS: ground spawn editor top layer, floor/furniture placement, 5 rarity presets + per-point chance + empty-tier warning, type/rarity editing, move/delete/undo/redo/save/reopen, all runtime pools and exclusive red draws');
}finally{await b.close();server.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
