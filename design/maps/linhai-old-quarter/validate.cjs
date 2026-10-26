/* 设计稿验收。仅读取本目录数据，不加载或修改游戏状态。 */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
function validate(data) {
  const checks=[], directions=[[1,0],[-1,0],[0,1],[0,-1]], key=(x,y)=>x+','+y;
  const cells=rect=>{const a=[];for(let y=rect[1];y<=rect[3];y++)for(let x=rect[0];x<=rect[2];x++)a.push([x,y]);return a;};
  const occupied=new Map();
  function pass(name,fn) {fn();checks.push({name,passed:true});}
  const terrain=(x,y)=>x>=0&&y>=0&&x<data.width&&y<data.height?data.rows[y][x]:null;
  const walk=(x,y,blocked=new Set())=>!!terrain(x,y)&&data.legend[terrain(x,y)].walkable&&!occupied.has(key(x,y))&&!blocked.has(key(x,y));
  function search(start,blocked=new Set(),goal) {
    assert(walk(...start,blocked),'起点不能通行 '+start);
    const queue=[start], parents=new Map([[key(...start),null]]);
    for(let i=0;i<queue.length;i++) {
      const [x,y]=queue[i];if(goal&&x===goal[0]&&y===goal[1])break;
      for(const [a,b] of directions){const nx=x+a,ny=y+b,k=key(nx,ny);if(walk(nx,ny,blocked)&&!parents.has(k)){parents.set(k,key(x,y));queue.push([nx,ny]);}}
    }
    return parents;
  }
  function findPath(start,goal,blocked=new Set()) {
    const visited=search(start,blocked,goal), end=key(...goal);if(!visited.has(end))return null;
    const result=[];let cursor=end;while(cursor){result.push(cursor.split(',').map(Number));cursor=visited.get(cursor);}return result.reverse();
  }
  const spawn=[data.spawn.x,data.spawn.y];
  pass('72×56 方格、完整图例与不可越界边缘',()=>{
    assert.equal(data.width,72);assert.equal(data.height,56);assert.equal(data.rows.length,56);
    assert(data.rows.every(row=>row.length===72));for(const row of data.rows)for(const ch of row)assert(data.legend[ch]);
    for(let x=0;x<72;x++){assert(!walk(x,0));assert(!walk(x,55));}
    for(let y=0;y<56;y++){assert(!walk(0,y));assert(!walk(71,y));}
  });
  pass('实体家具与 41 个箱柜无重叠、无地形冲突',()=>{
    for(const prop of [...data.props,...data.containers]){
      const k=key(prop.x,prop.y);assert(terrain(prop.x,prop.y)&&data.legend[terrain(prop.x,prop.y)].walkable,'实体落在不可通行地形 '+prop.id+' @ '+k);
      assert(!occupied.has(k),'实体重叠 '+k);assert(!['+','/','=','-','s'].includes(terrain(prop.x,prop.y)),'实体堵住门洞/桥/阶梯 '+prop.id);
      occupied.set(k,prop.id);
    }
    assert.equal(data.containers.length,41);assert.equal(data.enemies.length,24);
    assert.equal(new Set(data.containers.map(c=>c.type)).size,7);
    assert.equal(data.buildings.length,5);
  });
  const reached=search(spawn);
  pass('全部空地、室内、门洞、阶梯与两处撤离点连通',()=>{
    for(let y=0;y<56;y++)for(let x=0;x<72;x++)if(walk(x,y))assert(reached.has(key(x,y)),'孤立可行格 '+key(x,y));
    for(const ex of data.exits)assert(reached.has(key(ex.x,ex.y)));
    assert.equal(data.exits.length,2);
    for(const r of data.rooms){assert(walk(...r.anchor),'房间标注点非法 '+r.id);assert(reached.has(key(...r.anchor)));}
    for(const p of data.portals)for(const c of p.cells)assert(reached.has(key(...c)),'入口不可达 '+p.id);
  });
  pass('每个箱柜都有可达、可交互的操作面',()=>{
    for(const box of data.containers)assert(directions.some(([a,b])=>reached.has(key(box.x+a,box.y+b))),'箱柜无法操作 '+box.id);
  });
  pass('主街 6 格、支巷至少 3 格、主要室内走廊 2 格净宽',()=>{
    for(const c of data.clearances){const [x1,y1,x2,y2]=c.rect;assert(Math.min(x2-x1+1,y2-y1+1)>=c.width,c.id+' 标注宽度错误');for(const [x,y] of cells(c.rect))assert(walk(x,y),'净宽被占用 '+c.id+' @ '+key(x,y));}
  });
  pass('两座桥为仅有的跨岸路线，任一桥均可独立连接两岸',()=>{
    const goal=[data.exits[1].x,data.exits[1].y];
    for(const bridge of data.bridges){const blocked=new Set(cells(bridge.rect).map(p=>key(...p)));assert(findPath(spawn,goal,blocked),'移除 '+bridge.name+' 后不能过河');}
    const both=new Set(data.bridges.flatMap(b=>cells(b.rect)).map(p=>key(...p)));
    assert(!findPath(spawn,goal,both),'封闭双桥后仍能绕河');
    for(let y=0;y<56;y++)for(let x=30;x<=35;x++)if(!data.bridges.some(b=>x>=b.rect[0]&&x<=b.rect[2]&&y>=b.rect[1]&&y<=b.rect[3]))assert(!walk(x,y),'运河可以涉水 '+key(x,y));
  });
  pass('五栋建筑均有两处独立室外入口，诊所有两格破口',()=>{
    for(const b of data.buildings){const exits=data.portals.filter(p=>p.building===b.id&&p.connects.includes('outside'));assert(exits.length>=2,b.name+' 缺少另一出口');}
    const breach=data.portals.find(p=>p.id==='clinic.breach');assert.equal(breach.kind,'breach');assert.equal(breach.width,2);
    assert(data.windows.length>=1);for(const window of data.windows)for(const [x,y] of window.cells){assert(!walk(x,y));assert.equal(data.legend[terrain(x,y)].opaque,false);}
  });
  pass('公寓、诊所与钟表店有实际室内绕行，药储不直连破口',()=>{
    for(const [id,from,to] of [
      ['apartment.living-s','apartment.entry','apartment.living'],
      ['clinic.treatment','clinic.waiting','clinic.treatment'],
      ['clockshop.repair','clockshop.showroom','clockshop.repair'],
      ['clockshop.counter','clockshop.counter','clockshop.store']
    ]) {
      const portal=data.portals.find(p=>p.id===id), b=data.buildings.find(b=>b.id===portal.building);
      const inside=new Set(b.footprint.map(c=>key(...c))),blocked=new Set(portal.cells.map(c=>key(...c)));
      for(let y=0;y<56;y++)for(let x=0;x<72;x++)if(!inside.has(key(x,y)))blocked.add(key(x,y));
      assert(findPath(data.rooms.find(r=>r.id===from).anchor,data.rooms.find(r=>r.id===to).anchor,blocked),'内部缺少绕行 '+id);
    }
    const pharmacy=data.rooms.find(r=>r.id==='clinic.pharmacy').anchor, door=data.portals.find(p=>p.id==='clinic.pharmacy');
    assert(!findPath(spawn,pharmacy,new Set(door.cells.map(c=>key(...c)))),'破口或其他路径绕过药储门');
  });
  pass('银行必须通过安保过渡门和金库门，金库不连接室外',()=>{
    const vault=data.rooms.find(r=>r.id==='bank.vault').anchor;
    for(const id of ['bank.security','bank.vault']) {
      const p=data.portals.find(p=>p.id===id);assert(!findPath(spawn,vault,new Set(p.cells.map(c=>key(...c)))),'绕过了 '+p.name);
    }
    const bankOutside=data.portals.filter(p=>p.building==='bank'&&p.connects.includes('outside'));
    assert(bankOutside.every(p=>!p.connects.includes('bank.vault')));
    const front=bankOutside.find(p=>p.id==='bank.front').cells[0], rear=bankOutside.find(p=>p.id==='bank.rear').cells[0];
    const footprint=new Set(data.buildings.find(b=>b.id==='bank').footprint.map(c=>key(...c)));
    const blocked=new Set();for(let y=0;y<56;y++)for(let x=0;x<72;x++)if(!footprint.has(key(x,y)))blocked.add(key(x,y));
    for(const p of ['bank.security','bank.vault'])for(const c of data.portals.find(d=>d.id===p).cells)blocked.add(key(...c));
    assert(findPath(front,rear,blocked),'银行前后门不能通过办公后勤环路连接');
  });
  pass('分区物资 / 布防配额、敌人间距和出生 / 撤离缓冲',()=>{
    for(const [region,[boxes,mobs]] of Object.entries(data.quotas.regions)){
      assert.equal(data.containers.filter(c=>c.region===region).length,boxes,region+' 容器配额');
      assert.equal(data.enemies.filter(e=>e.region===region).length,mobs,region+' 敌人配额');
    }
    for(const e of data.enemies){
      assert(walk(e.x,e.y),'敌人出生格非法 '+e.id);
      assert(Math.hypot(e.x-data.spawn.x,e.y-data.spawn.y)>=12,'出生点附近有敌人 '+e.id);
      for(const ex of data.exits)assert(Math.hypot(e.x-ex.x,e.y-ex.y)>6,'撤离点附近固定敌人 '+e.id);
      for(const other of data.enemies)if(other!==e)assert(Math.hypot(e.x-other.x,e.y-other.y)>=3,'敌人过密 '+e.id+' / '+other.id);
      const [x1,y1,x2,y2]=data.bridgeHeadReserve.rect;assert(!(e.x>=x1&&e.x<=x2&&e.y>=y1&&e.y<=y2),'北桥堵桥点 '+e.id);
      assert(!['=','-'].includes(terrain(e.x,e.y)),'固定敌人位于桥面');
    }
  });
  pass('室内物资与敌人确实位于所属建筑，室外点不混入室内',()=>{
    for(const e of [...data.containers,...data.enemies,...data.props]){
      const owner=data.buildings.find(b=>b.footprint.some(([x,y])=>x===e.x&&y===e.y));
      assert.equal(owner?owner.id:'outdoors',e.region,'分区标注错误 '+e.id);
    }
  });
  pass('潮汐只做预留：低地仍可通行，稳定路线不受模拟封路影响',()=>{
    assert.equal(data.tide.implemented,false);
    const blocked=new Set(data.tide.zones.flatMap(z=>cells(z.rect)).map(p=>key(...p)));
    for(const ex of data.exits)assert(findPath(spawn,[ex.x,ex.y],blocked),'未来局部封路会切断撤离 '+ex.id);
    const south=data.bridges.find(b=>b.id==='south');for(const c of cells(south.rect))blocked.add(key(...c));
    for(const ex of data.exits)assert(findPath(spawn,[ex.x,ex.y],blocked),'南桥未来不可用后无稳定撤离路线');
  });
  const routes=data.routeSpecs.map(route=>{
    const points=[];for(let i=1;i<route.waypoints.length;i++){const segment=findPath(route.waypoints[i-1],route.waypoints[i]);assert(segment,'推荐路线不连通 '+route.name+' '+route.waypoints[i]);points.push(...segment.slice(i===1?0:1));}
    return {...route,points,steps:points.length-1};
  });
  pass('三条推荐路线均按实体占格寻路生成',()=>{assert.equal(routes.length,3);assert(routes.every(r=>r.points.every(p=>walk(...p))));});
  const stats={width:72,height:56,buildings:data.buildings.length,rooms:data.rooms.length,containers:41,enemies:24,props:data.props.length,walkableCells:reached.size,
    containersByType:Object.fromEntries(Object.keys(data.containerTypes).map(t=>[t,data.containers.filter(c=>c.type===t).length])),
    enemiesByType:Object.fromEntries(['scav','echo','guard'].map(t=>[t,data.enemies.filter(e=>e.type===t).length])),
    regions:Object.fromEntries(Object.keys(data.quotas.regions).map(id=>[id,{containers:data.containers.filter(c=>c.region===id).length,enemies:data.enemies.filter(c=>c.region===id).length}]))};
  return {checks,stats,routes};
}
module.exports={validate};
if(require.main===module){const file=path.join(__dirname,'layout.json');const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):require('./source.cjs').data;const result=validate(data);console.log(`通过 ${result.checks.length} 项设计验收`);console.log(JSON.stringify(result.stats,null,2));}
