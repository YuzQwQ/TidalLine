/* 地形原型专项：空实体层、永久水碰撞、全干地连通、可寻址地点与另一张地图隔离。 */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),d=require('../design/maps/fenced-zone/layout.json');
const {compile}=require('./build-fenced-map'),map=compile();
assert.deepEqual([d.width,d.height,d.buildings.length],[64,44,4]);
for(const key of ['containers','lootSpawns','enemies','props'])assert.equal(map[key].length,0,key);
assert.equal(map.exits.length,3);assert.deepEqual([map.spawn.x,map.spawn.y],[14,42]);
assert(map.doors.every(p=>p.doorType==='normal'));
const walk=(x,y)=>!!d.legend[d.rows[y]?.[x]]?.walkable&&d.rows[y][x]!=='~';
const seen=new Set(),q=[[d.spawn.x,d.spawn.y]];seen.add(q[0].join(','));
for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(walk(nx,ny)&&!seen.has(k)){seen.add(k);q.push([nx,ny]);}}}
for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++)if(walk(x,y))assert(seen.has(x+','+y),'孤立干地 '+[x,y]);
for(const p of map.pois)assert(seen.has(p.anchor.join(',')),'不可达地点 '+p.id);
for(const e of map.exits)assert(seen.has(e.x+','+e.y),'撤离点不可达 '+e.id);
assert(map.districts.find(b=>b.key==='a-registry').rect[1]<map.districts.find(b=>b.key==='b-camp').rect[1]);
assert(map.districts.find(b=>b.key==='c-yard').rect[1]<map.districts.find(b=>b.key==='d-pump').rect[1]);
assert.equal(map.terrain['~'].permanentWater,true);assert.equal(map.tileHeights.r,3);
assert.equal(map.terrain['~'].art,'canal_water');assert.equal(map.terrain['~'].blocked,true);
assert.equal(map.terrain['~'].solid,false,'水面不可通行但不是挡子弹的实体墙');
console.log('PASS: 64×44, four zones, empty entity layers, '+seen.size+' connected dry tiles, '+map.pois.length+' reachable POIs, three dry exits.');
