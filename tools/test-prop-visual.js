/* 落地钟这类"窄而高"的家具：占地 1×1，贴图要画 1.5 格高。
   锁住四件事：登记表声明 → 地图快照里有 → 碰撞仍只有 1 格 → 绘制盒确实变高且仍然贴底。 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const lib = require('../design/maps/shared/scene-library.js');

/* ---------- 1. 登记表 ---------- */
const clock = lib.placeables.find(a => a.id === 'clock_grandfather');
assert(clock, '登记表里没有落地钟');
assert.deepEqual(clock.paint.footprint, [1, 1], '落地钟占地应保持 1×1');
assert.deepEqual(clock.paint.visual, [1, 1.5], '落地钟应声明 1×1.5 的贴图绘制盒');

/* ---------- 2. 地图快照：登记表要落到每条落地钟上 ---------- */
const compiled = require('./build-linhai-map.js').compile();
const clocks = compiled.props.filter(p => p.art === 'clock_grandfather');
assert(clocks.length > 0, '临海路地图上没有落地钟');
for (const p of clocks) {
  assert.deepEqual(p.footprint, [1, 1], '落地钟占地被改动：' + p.id);
  assert.deepEqual(p.visual, [1, 1.5], '落地钟绘制盒没进地图快照：' + p.id);
}
/* 其余家具不该被顺手放大：只有声明了 visual 的才带这个字段 */
const withVisual = compiled.props.filter(p => p.visual !== undefined);
assert.equal(withVisual.length, clocks.length, 'visual 被扩散到了别的家具：' + withVisual.map(p => p.art).join(','));

/* ---------- 3. 运行时：碰撞 / 可走 / 绘制盒 ---------- */
const ctx = vm.createContext({ console, performance });
for (const f of ['config.js', 'data.js', 'core.js', 'art.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx);
}
const result = vm.runInContext(`(function(){
  const rows=['#######','#P....#','#.....#','#.....#','#....E#','#######'];
  const prop={id:'clock',type:'clock_grandfather',art:'clock_grandfather',x:3,y:2,footprint:[1,1],visual:[1,1.5]};
  M.load(rows,{},[prop]);
  const img={naturalWidth:32,naturalHeight:32,propBounds:[10,4,11,25]};
  const TS=CFG.TILE;
  const rect=Art.propRect(prop,img,TS);
  const plain=Art.propRect({id:'plain',x:3,y:2,footprint:[1,1]},img,TS);
  return {
    TS,
    cells:M.propCollisionCells(prop).length,
    walkAbove:M.walkable(3,1),
    walkSelf:M.walkable(3,2),
    blocksAbove:M.blocksShot(3,1),
    rect, plain,
    bottom:(prop.y+1)*TS-3,
    defaultVisual:M.propVisual({id:'x',footprint:[2,1]}),
    bad:/正数/.test((()=>{try{M.propVisual({id:'bad',footprint:[1,1],visual:[1,-2]});return '';}catch(e){return e.message;}})())
  };
})()`, ctx);

assert.equal(result.cells, 1, '落地钟应只占 1 个碰撞格');
assert.equal(result.walkSelf, false, '落地钟自己那格应该挡人');
assert.equal(result.walkAbove, true, '贴图长高了也不能让上面那格变成不可走');
assert.equal(result.blocksAbove, false, '贴图长高了也不能让上面那格挡子弹');
assert.deepEqual(Array.from(result.defaultVisual), [2, 1], '没声明 visual 时绘制盒应等于占地');
assert.equal(result.bad, true, '非法 visual 必须报错');

const rect = result.rect, plain = result.plain, TS = result.TS;
assert(rect.h > plain.h * 1.4, '绘制高度没有明显变大：' + rect.h.toFixed(1) + ' vs ' + plain.h.toFixed(1));
assert(rect.h <= 1.5 * TS, '绘制高度超过了 1.5 格：' + rect.h.toFixed(1));
assert(Math.abs(rect.y + rect.h - result.bottom) < 0.001, '绘制底边没有贴住占地底边');
assert(rect.w <= TS, '绘制宽度超过了 1 格：' + rect.w.toFixed(1));
assert(Math.abs(rect.x + rect.w / 2 - (3 + 0.5) * TS) < 0.001, '绘制盒没有在占地格上水平居中');

/* ---------- 4. 编辑器：调色板带 visual，放置时带进设计稿 ---------- */
const Core = require('../design/maps/shared/map-core.js'), Tpl = require('../design/maps/shared/map-templates.js');
const ec = vm.createContext({
  console, SceneLibrary: lib, MapCore: Core, MapTemplates: Tpl,
  MapArtMap: require('../design/maps/shared/map-art-map.js')
});
ec.window = ec;
for (const f of ['palette', 'tools']) vm.runInContext(fs.readFileSync(path.join(root, 'design/maps/editor', f + '.js'), 'utf8'), ec);
const fresh = Tpl.create({ id: 'visual-fresh', width: 40, height: 30, template: 'blank' }).data;
const item = ec.EditorPalette.CATEGORIES.find(c => c.id === 'prop').items(fresh).find(i => i.key === 'prop.clock_grandfather');
assert(item, '调色板里没有落地钟');
assert.deepEqual(item.paint.visual, [1, 1.5], '调色板条目丢了 visual');
const placed = ec.EditorTools.place(fresh, item.paint, 5, 5);
assert(placed.ok, '落地钟放置失败：' + placed.reason);
const rec = fresh.props.find(p => p.id === placed.id);
assert.deepEqual(Array.from(rec.footprint), [1, 1], '放置后占地应还是 1×1');
assert.deepEqual(Array.from(rec.visual), [1, 1.5], '放置后丢了 visual');

/* 序列化再读回，字段不能掉 */
const reopened = Core.parse(Core.serialize(fresh));
assert.deepEqual(Array.from(reopened.props.find(p => p.id === placed.id).visual), [1, 1.5], '保存重开后丢了 visual');

console.log('PASS: 落地钟 1×1 占地 / 1.5 格高贴图，碰撞不动、贴底居中不变形、编辑器与地图快照同步');
