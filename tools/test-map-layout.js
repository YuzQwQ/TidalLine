/* 临海路设计稿与实际游戏碰撞/寻路一致性。 */
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),draft=require('../design/maps/linhai-old-quarter/layout.json');
require('../design/maps/linhai-old-quarter/validate.cjs').validate(draft);
const ctx=vm.createContext({console,performance});
for(const f of ['config.js','data.js','core.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),ctx);
const {M,map,rows,spawns,props}=vm.runInContext('({M,map:RAID_MAP,rows:MAP_ROWS,spawns:SPAWNS,props:DECOR})',ctx);
assert.deepEqual(JSON.parse(JSON.stringify(map)),require('./build-linhai-map.js').compile(),'地图快照落后于设计稿');
M.load(rows);assert.equal(M.W,72);assert.equal(M.H,56);assert.equal(M.extracts.length,2);
const key=(x,y)=>x+','+y,dirs=[[1,0],[-1,0],[0,1],[0,-1]];
function flood(blocked=new Set()) {const q=[M.playerSpawn],seen=new Set([key(q[0].x,q[0].y)]);for(let i=0;i<q.length;i++)for(const [dx,dy]of dirs){const x=q[i].x+dx,y=q[i].y+dy,k=key(x,y);if(M.walkable(x,y)&&!blocked.has(k)&&!seen.has(k)){seen.add(k);q.push({x,y});}}return seen;}
const reached=flood();
for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++){
 const occupied=draft.props.some(p=>p.x===x&&p.y===y)||draft.containers.some(p=>p.x===x&&p.y===y);
 assert.equal(M.walkable(x,y),draft.legend[draft.rows[y][x]].walkable&&!occupied,'碰撞不一致 '+key(x,y));
 if(M.walkable(x,y))assert(reached.has(key(x,y)),'孤立可行格 '+key(x,y));
 if(x===0||y===0||x===M.W-1||y===M.H-1)assert(!M.walkable(x,y),'地图边缘可绕河');
}
for(const box of draft.containers){assert(!M.walkable(box.x,box.y));assert(!M.opaque(box.x,box.y));assert(dirs.some(([dx,dy])=>reached.has(key(box.x+dx,box.y+dy))&&M.findPath(M.playerSpawn.x,M.playerSpawn.y,box.x+dx,box.y+dy)));}
assert.equal(draft.containers.length,41);assert.equal(spawns.length,24);assert.equal(props.length,40);
for(const s of spawns){assert(M.walkable(s.x,s.y));assert(Math.hypot(s.x-map.spawn.x,s.y-map.spawn.y)>=12);for(const ex of map.exits)assert(Math.hypot(s.x-ex.x,s.y-ex.y)>=6);for(const other of spawns)if(other!==s)assert(Math.hypot(s.x-other.x,s.y-other.y)>=3);}
const bridgeCells=b=>{const out=[];for(let y=b.rect[1];y<=b.rect[3];y++)for(let x=b.rect[0];x<=b.rect[2];x++)out.push(key(x,y));return out;};
for(const b of map.bridges)assert(flood(new Set(bridgeCells(b))).has('67,51'),'单桥仍须能撤离');
assert(!flood(new Set(map.bridges.flatMap(bridgeCells))).has('67,51'),'封闭两桥后不可绕河');
for(const ex of map.exits)assert(M.findPath(map.spawn.x,map.spawn.y,ex.x,ex.y));
for(const w of draft.windows)for(const [x,y]of w.cells){assert(!M.walkable(x,y));assert(!M.opaque(x,y));assert(M.blocksShot(x,y));}
assert(M.lineOfSight(43,18,45,18),'橱窗允许视线穿过');assert(M.lineOfSight(28,28,37,28),'运河不挡视线');
assert(!M.blocksShot(31,28));assert(!M.blocksShot(29,28));
for(const d of M.doors){for(const [x,y]of d.cells)assert.equal(M.at(x,y).door,d);d.open=false;for(const [x,y]of d.cells){assert(!M.walkable(x,y));assert(M.opaque(x,y));}d.open=true;}
assert(M.walkable(14,39)&&M.walkable(14,40),'破口净宽');
const dry=[0,1.55,3].map(level=>{M.tideLevel=level;for(const ex of map.exits)assert.equal(M.waterDepth(ex.x,ex.y),0);return flood().size;});assert(dry.every(n=>n===dry[0]),'潮汐预留不可提前封路');
console.log('OK: 72×56 同源地图 / 41 容器 / 24 敌人 / 40 家具 / 双桥唯一跨河 / 两处撤离 / 门组 / 透视窗 / 全潮位稳定');
