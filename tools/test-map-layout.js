/* 扩建地图的可玩性与布防回归，无第三方依赖。 */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, performance });
for (const file of ['config.js', 'data.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
const { M, rows, districts, spawns, props, types } = vm.runInContext('({M,rows:MAP_ROWS,districts:MAP_DISTRICTS,spawns:SPAWNS,props:DECOR,types:CONTAINER_TYPES})', ctx);
M.load(rows);
assert.equal(M.W, 64); assert.equal(M.H, 44);
assert(rows.every(row => row.length === M.W));
assert(rows[0].split('').every(ch => ch === '#') && rows.at(-1).split('').every(ch => ch === '#'));
assert(rows.every(row => row[0] === '#' && row.at(-1) === '#'));
assert.equal(rows.join('').split('P').length - 1, 1);
assert.equal(M.extracts.length, 3);

function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a,b] = polygon[i], [u,v] = polygon[j];
    if ((b > y) !== (v > y) && x < (u-a)*(y-b)/(v-b)+a) result = !result;
  }
  return result;
}
function flood(level) {
  M.tideLevel = level;
  const start = M.playerSpawn, queue = [start], reached = new Set([start.x + ',' + start.y]);
  for (let i = 0; i < queue.length; i++) {
    const {x,y} = queue[i];
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy, key=nx+','+ny;
      if (M.walkable(nx,ny) && !reached.has(key)) { reached.add(key); queue.push({x:nx,y:ny}); }
    }
  }
  return reached;
}
const reached = flood(0), boxes = [];
for (let y=0; y<M.H; y++) for (let x=0; x<M.W; x++) {
  if (M.walkable(x,y)) assert(reached.has(x+','+y), `孤立空地 ${x},${y}`);
  if (!types[rows[y][x]]) continue;
  boxes.push({x,y});
  assert(!M.walkable(x,y));
  assert([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => reached.has((x+dx)+','+(y+dy)) && M.findPath(M.playerSpawn.x,M.playerSpawn.y,x+dx,y+dy)), `箱柜缺少可寻路操作面 ${x},${y}`);
}
assert.equal(boxes.length, 41);
assert.equal(spawns.length, 24);
assert.equal(new Set(props.map(p => p.x+','+p.y)).size, props.length);
for (const spawn of spawns) {
  assert(M.walkable(spawn.x,spawn.y), '敌人不能出生在实体内');
  assert(reached.has(spawn.x+','+spawn.y));
  assert(Math.hypot(spawn.x-M.playerSpawn.x,spawn.y-M.playerSpawn.y)>=12, '出生缓冲不足');
  assert([2,3].includes(spawn.patrolRadius));
  for (const other of spawns) if (other !== spawn) assert(Math.hypot(spawn.x-other.x,spawn.y-other.y)>=3, '出生过密');
}
const groups = districts.map(d => ({ ...d, enemies: spawns.filter(s => inside(s.x+.5,s.y+.5,d.polygon)).length, heavy: boxes.filter(b => inside(b.x+.5,b.y+.5,d.polygon) && ['B','K'].includes(rows[b.y][b.x])).length }));
assert(groups.every(d => d.polygon.length >= 6), '建筑不能退回统一方框');
assert(groups.filter(d => d.loot === 'high').every(d => d.enemies >= 3 && d.heavy >= 2), '高物资区须有守备与至少两处重型物资');
assert(groups.filter(d => d.loot === 'normal').every(d => d.enemies >= 2 && d.enemies <= 3));
assert(groups.filter(d => d.loot === 'safe').every(d => d.enemies === 0));
assert(M.walkable(32,11), 'U形集市应保留开放庭院');
for (const level of [1.55,3]) {
  const safe = flood(level);
  for (const ex of M.extracts) {
    assert(safe.has(ex.x+','+ex.y), '涨潮封死撤离路线');
    assert.equal(M.waterDepth(ex.x,ex.y), 0);
    assert(M.findPath(M.playerSpawn.x,M.playerSpawn.y,ex.x,ex.y), '涨潮寻路失败');
  }
  for (let y=0;y<M.H;y++) for (let x=0;x<M.W;x++) if (rows[y][x] === '~') assert(!safe.has(x+','+y), '深水港池仍可通行');
  assert(safe.has('21,17') && safe.has('42,32'), '堤顶主路不能被潮水切断');
}
console.log('OK: 64×44 / 41 容器 / 24 敌人 / 全空地连通 / 全箱柜操作面与寻路 / 分区布防与间距 / 出生缓冲 / 各潮位三个撤离点 / 深水封路');
console.table(groups.map(d => ({街区:d.name,建筑:d.shape,敌人:d.enemies,重型容器:d.heavy})));
