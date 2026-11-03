/* 防水补给箱 / 军用物资箱的独立奖池验收。
   覆盖：抽取次数、弹药池概率与等级分布、装备池种类与稀有度、不套娃、其它容器不受影响。
   node tools/test-container-pools.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const harness = fs.readFileSync(path.join(root, 'run-test.js'), 'utf8').split('let pass = 0')[0];
const c = new Function('require', '__dirname', harness + '\nreturn ctx;')(require, root);
/* 顶层 const 不会挂到沙箱对象上，统一用 runInContext 取 */
const G = vm.runInContext(
  '({Loot,Game,Save,ITEMS,ITEM_BY_ID,EQUIP,GEAR,BACKPACK,BAGS,' +
  'CONTAINER_TYPES,CONTAINER_QUALITY,BOX_COUNT,RARITY,Medical,bagSlots,WEAPONS,ATTACHMENT_LOOT})', c);
const { Loot, Game, Save, ITEMS, EQUIP, BACKPACK, CONTAINER_TYPES,
        CONTAINER_QUALITY, BOX_COUNT } = G;

let checks = 0;
function test(name, fn) {
  try { fn(); checks++; console.log('OK: ' + name); }
  catch (e) { console.log('FAIL: ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
const near = (a, b, tol) => Math.abs(a - b) < (tol == null ? 1e-6 : tol);

const K = CONTAINER_TYPES.K;      // 防水补给箱 · rich
const Q = CONTAINER_TYPES.Q;      // 军用物资箱 · fine

/* ---------- 抽取次数 ---------- */
test('抽取次数：下限 +1，防水补给箱上限再 +2', () => {
  assert.deepEqual(Array.from(BOX_COUNT.rich), [2, 3]);   // rich 的基准
  assert.deepEqual(Array.from(BOX_COUNT.fine), [2, 3]);  // fine 的基准
  assert.deepEqual(Array.from(K.rolls), [3, 6]);       // 2+1 · 3+1+2
  assert.deepEqual(Array.from(Q.rolls), [3, 4]);       // 2+1 · 3+1
});

test('两个容器都挂上了弹药池与装备池', () => {
  for (const [ch, t] of [['K', K], ['Q', Q]]) {
    assert.ok(t.ammoPool, ch + ' 缺 ammoPool');
    assert.ok(t.gearPool, ch + ' 缺 gearPool');
    assert.equal(t.ammoPool.chance, 0.25);
    assert.equal(t.gearPool.chance, 0.10);
  }
  assert.deepEqual(Array.from(K.gearPool.kinds), ['helmet', 'body', 'bag', 'gun']);
});

test('其它容器保持原样：没有 rolls / 池', () => {
  for (const [ch, t] of Object.entries(CONTAINER_TYPES)) {
    if (ch === 'K' || ch === 'Q') continue;
    assert.equal(t.rolls, undefined, ch);
    assert.equal(t.ammoPool, undefined, ch);
    assert.equal(t.gearPool, undefined, ch);
  }
});

/* ---------- 弹药池 ---------- */
test('弹药池五种口径等概率，发数落在区间内', () => {
  const cal = {};
  for (let i = 0; i < 30000; i++) {
    const r = Loot.rollAmmo('rich', K.ammoPool);
    assert.equal(r.item.cat, 'ammo');
    assert.ok(r.item.level >= 1 && r.item.level <= 5);
    const range = K.ammoPool.count[r.item.caliber];
    assert.ok(r.n >= range[0] && r.n <= range[1], '发数越界 ' + r.n);
    cal[r.item.caliber] = (cal[r.item.caliber] || 0) + 1;
  }
  assert.equal(Object.keys(cal).length, 5);
  for (const n of Object.values(cal)) assert(Math.abs(n / 30000 - 1 / 5) < 0.015);
});

test('防水补给箱弹药等级分布 = rich 稀有度（红档并入金档）', () => {
  const lv = [0, 0, 0, 0, 0];
  for (let i = 0; i < 60000; i++) lv[Loot.rollAmmo('rich', K.ammoPool).item.level - 1]++;
  const obs = lv.map(n => n / 600);
  [4, 9, 22, 36, 29].forEach((p, i) => assert(Math.abs(obs[i] - p) < 0.8,
    'Lv' + (i + 1) + ' 实际 ' + obs[i].toFixed(2) + '% 期望 ' + p + '%'));
});

test('军用物资箱弹药等级分布 = fine 稀有度（红档并入金档）', () => {
  const lv = [0, 0, 0, 0, 0];
  for (let i = 0; i < 60000; i++) lv[Loot.rollAmmo('fine', Q.ammoPool).item.level - 1]++;
  const obs = lv.map(n => n / 600);
  [10, 18, 32, 30, 10].forEach((p, i) => assert(Math.abs(obs[i] - p) < 0.8,
    'Lv' + (i + 1) + ' 实际 ' + obs[i].toFixed(2) + '% 期望 ' + p + '%'));
});

/* ---------- 装备池 ---------- */
test('头盔 / 护甲 / 背包子池仍等概率抽，等级 1–5', () => {
  const kinds = {}, levels = {};
  for (let i = 0; i < 60000; i++) {
    const { item } = Loot.rollGear('rich', {kinds:['helmet','body','bag']});
    const eq = item.equip;
    assert.ok(eq && (eq.kind === 'armor' || eq.kind === 'bag'), '种类越界');
    const kind = eq.kind === 'bag' ? 'bag' : eq.gear.type;
    const lv = eq.kind === 'bag' ? BACKPACK.def(eq.bag).r : eq.gear.lv;
    kinds[kind] = (kinds[kind] || 0) + 1;
    levels[lv] = (levels[lv] || 0) + 1;
  }
  assert.deepEqual(Object.keys(kinds).sort(), ['bag', 'body', 'helmet']);
  for (const n of Object.values(kinds)) assert(Math.abs(n / 60000 - 1 / 3) < 0.015);
  for (let k = 1; k <= 5; k++) assert(levels[k] > 0, '缺 Lv' + k);
  assert.equal(levels[6], undefined, '不该出六级');
});

test('防具背包子池稀有度分布与同容器的弹药池一致', () => {
  const lv = [0, 0, 0, 0, 0];
  for (let i = 0; i < 80000; i++) {
    const { item } = Loot.rollGear('rich', {kinds:['helmet','body','bag']});
    const eq = item.equip;
    lv[(eq.kind === 'bag' ? BACKPACK.def(eq.bag).r : eq.gear.lv) - 1]++;
  }
  const obs = lv.map(n => n / 800);
  [4, 9, 22, 36, 29].forEach((p, i) => assert(Math.abs(obs[i] - p) < 0.8,
    'Lv' + (i + 1) + ' 实际 ' + obs[i].toFixed(2) + '% 期望 ' + p + '%'));
});

/* ---------- 整体产出 ---------- */
test('容器实际抽取次数落在 rolls 区间内，且每次都出东西', () => {
  for (let i = 0; i < 2000; i++) {
    const r = Loot.fill('rich', K.cats, K);
    assert.ok(r.length >= 3 && r.length <= 6, '次数越界 ' + r.length);
    for (const e of r) assert.ok(e && e.item, '空条目');
  }
  for (let i = 0; i < 2000; i++) {
    const r = Loot.fill('fine', Q.cats, Q);
    assert.ok(r.length >= 3 && r.length <= 4, '次数越界 ' + r.length);
  }
});

test('配件独立分支不稀释弹药／装备分支，缺档均回到普通池', () => {
  for (const [q, t] of [['rich', K], ['fine', Q]]) {
    let ammo = 0, gear = 0, attachment = 0, total = 0;
    for (let i = 0; i < 3000; i++) {
      for (const e of Loot.fill(q, t.cats, t)) {
        total++;
        if (e.item.cat === 'ammo') ammo++;
        if (e.item.equip?.kind === 'attachment') attachment++;
        else if (e.item.cat === 'gear') gear++;
      }
    }
    assert(Math.abs(ammo / total - 0.25) < 0.02, q + ' 弹药占比 ' + (ammo / total * 100).toFixed(2) + '%');
    const pct=Array.from(CONTAINER_QUALITY[q].pct),levels=pct.slice(0,5);levels[4]+=pct[5];
    const missingGun=levels.reduce((n,p,i)=>n+(Object.values(G.WEAPONS).some(w=>w.rarity===i+1)?0:p),0)/100;
    const expectedGear=.10*(1-missingGun/4),expectedAttachment=G.ATTACHMENT_LOOT[t===K?'K':'Q']*(pct[1]+pct[2]+pct[3])/100;
    assert(Math.abs(gear / total - expectedGear) < 0.015, q + ' 非配件装备占比 ' + (gear / total * 100).toFixed(2) + '%');
    assert(Math.abs(attachment / total - expectedAttachment)<.015,q+' 配件占比');
  }
});

test('掉出的背包能穿回去，携带容量随之变化', () => {
  const before = G.bagSlots();
  const r = Loot.rollGear('rich', K.gearPool);
  const eq = r.item.equip;
  if (eq?.kind === 'bag') {
    Save.gear.back = BACKPACK.make(eq.bag);
    assert.equal(G.bagSlots(), BACKPACK.def(eq.bag).slots);
  } else if(eq?.kind==='gun') {
    assert(G.WEAPONS[eq.gun]);assert.equal(eq.mag,0);
  } else if(eq?.kind==='armor') {
    assert.ok(EQUIP.armor(eq.gear), '护甲伪物品造不出来');
  } else {
    assert.equal(r.item.equip,undefined,'枪械缺档回退为普通物品');
  }
  assert.ok(before >= 4);
});

console.log('\n' + checks + ' 组容器奖池断言通过');
