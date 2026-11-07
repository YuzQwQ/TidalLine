const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),c=vm.createContext({console,performance});for(const f of ['config.js','data.js','core.js','entities.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
const {M,canStand,moveEntity,maps}=vm.runInContext('({M,canStand,moveEntity,maps:MAP_CATALOG})',c);
M.load(['.......','.......','...#...','.......','..P.E..'],{},[]);
assert(canStand(112,39,7));assert(canStand(112,42,7));assert(canStand(112,55,7));assert(canStand(112,57,7));assert(!canStand(112,58,7));assert(!canStand(112,72,7));assert(!canStand(112,102,7));assert(canStand(112,104,7));
assert(!M.blocksShot(3,1,112,47));assert(!M.blocksShot(3,1,112,48));assert(!M.blocksShot(3,1,112,63));assert(M.blocksShot(3,2,112,64));assert(M.blocksShot(3,2,112,80));assert(!M.blocksShot(3,3,112,97));
assert.equal(M.navigationPoint(3,1).y,48);assert.equal(M.collisionRects(3,1).length,0);assert(!M.opaque(3,1));
const actor={x:112,y:30,r:7};moveEntity(actor,0,100);assert(actor.y<=57&&actor.y>55&&canStand(actor.x,actor.y,7));
M.load(['...','.+.','.#.'],{},[]);assert(M.walkablePoint(48,55));assert(!M.opaque(1,1));
for(const map of maps){M.load(map.rows,map.doorAxes,map.props,map);const step=8,w=map.width*4+1,h=map.height*4+1,start=M.navigationPoint(map.spawn.x,map.spawn.y),queue=[[start.x/step,start.y/step]],seen=new Set([queue[0].join(',')]);assert(canStand(start.x,start.y,7));for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=nx+','+ny;if(nx<0||ny<0||nx>=w||ny>=h||seen.has(key)||!canStand(nx*step,ny*step,7))continue;seen.add(key);queue.push([nx,ny]);}}
 for(const ex of map.exits){const p=M.navigationPoint(ex.x,ex.y);assert(seen.has([p.x/step,p.y/step].join(',')),map.id+' 撤离不通');}
 for(const s of map.enemies){const p=M.navigationPoint(s.x,s.y);assert(canStand(p.x,p.y,7),map.id+' 敌人出生被墙覆盖 '+s.x+','+s.y);}
 for(const b of map.containers)assert([...seen].some(k=>{const [x,y]=k.split(',').map(Number);return Math.hypot(x*step-M.cx(b.x),y*step-M.cy(b.y))<=55;}),map.id+' 容器无法靠近 '+b.x+','+b.y);
 console.log('OK: '+map.id+' 8px精细碰撞连通 / 出生 / 撤离 / 容器接近');}
console.log('PASS: 32px整格墙体碰撞、纯视觉墙顶、快速移动、弹道与门口');
