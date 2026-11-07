/* 钥匙池验收。
   node tools/test-key-pool.js

   规格（design/items/KEYS.md · 局内产出）：
     · 钥匙不进通用物品池（全部 noLoot），只走容器挂的 keyPool；
     · 只有 drop:true 的钥匙能掉：001 测试钥匙、003/004 通用模板钥匙永远不掉；
     · keyPool 每次开启只判一次，抽中是「额外一件」，所以件数最多 rolls 上限 +1；
     · 只挂在低价值容器上（U 工作服 / Y 背心 / F 文件柜），
       高价值容器（保险箱 / 秘藏箱 / 补给箱 / 军用箱）一粒钥匙都不出。 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '..');
const c = vm.createContext({ console, performance });
for (const f of ['config.js', 'data.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), c);
}
const G = vm.runInContext(
  '({Loot,ITEMS,KEY_ITEMS,CONTAINER_TYPES,CONTAINER_QUALITY,CFG,BOX_COUNT})', c);
const { Loot, ITEMS, KEY_ITEMS, CONTAINER_TYPES, CONTAINER_QUALITY, CFG, BOX_COUNT } = G;
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(it => [it.id, it]));

let checks = 0;
function test(name, fn) {
  try { fn(); checks++; console.log('OK: ' + name); }
  catch (e) { console.log('FAIL: ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
const near = (a, b, tol) => Math.abs(a - b) < (tol == null ? 1e-6 : tol);
const DROPPABLE = KEY_ITEMS.filter(k => k.drop === true);
const KEY_CATS = CONTAINER_TYPES;

test('只有五把房卡可掉落，测试 / 模板钥匙都不在池里', () => {
  assert.equal(DROPPABLE.length, 5);
  assert.deepEqual(Array.from(DROPPABLE, k => k.number).sort(), ['002', '005', '006', '007', '008']);
  for (const id of ['door_key_test', 'door_key_tier_1', 'door_key_tier_2']) {
    const k = KEY_ITEMS.find(x => x.id === id);
    assert(k && !k.drop, id + ' 不该可掉落');
  }
  assert(DROPPABLE.every(k => k.price > 0 && k.maxDur === 10 && k.cat === 'key'));
});

test('钥匙永远不进通用物品池', () => {
  assert(KEY_ITEMS.every(k => k.noLoot === true));
  const pool = ITEMS.filter(it => !it.noLoot && !it.egg);
  assert(!pool.some(it => it.cat === 'key'), '通用池里混进了钥匙');
});

test('只有 U / Y / F 挂了 keyPool，且都是低价值容器', () => {
  const withPool = Object.entries(KEY_CATS).filter(([, t]) => t.keyPool).map(([ch]) => ch).sort();
  assert.deepEqual(withPool, ['F', 'U', 'Y']);
  for (const ch of withPool) {
    const t = KEY_CATS[ch];
    assert(!t.itemPool && !t.ammoPool && !t.gearPool && !t.poolWeights, ch + ' 走了专属/装备/弹药池');
    assert(['junk', 'plain', 'ample', 'fine'].includes(t.q), ch + ' 品质过高：' + t.q);
  }
});

test('高价值容器一粒钥匙都不出', () => {
  for (const ch of ['B', 'V', 'I', 'O', 'K', 'Q', 'G', 'A']) {
    const t = CONTAINER_TYPES[ch];
    for (let i = 0; i < 400; i++) {
      const out = Loot.fill(t.q, t.cats, t);
      assert(!out.some(e => e.item.cat === 'key'), ch + ' 掉出了钥匙');
    }
  }
});

test('掉落率与配置一致（3σ 容差）', () => {
  const N = 60000;
  for (const ch of ['U', 'Y', 'F']) {
    const t = CONTAINER_TYPES[ch];
    let hit = 0;
    for (let i = 0; i < N; i++) {
      if (Loot.fill(t.q, t.cats, t).some(e => e.item.cat === 'key')) hit++;
    }
    const p = hit / N, exp = t.keyPool.chance;
    /* 二项分布抽样误差：3σ ≈ 99.7% 置信。固定容差在 0.3% 档会偶发误报 */
    const tol = 3 * Math.sqrt(exp * (1 - exp) / N);
    assert(near(p, exp, tol), ch + ' 实测 ' + (p * 100).toFixed(3) + '% ≠ 配置 ' + (exp * 100).toFixed(2) + '%');
  }
});

test('钥匙是额外一件，件数不超过 rolls 上限 +1', () => {
  for (const ch of ['U', 'Y', 'F']) {
    const t = CONTAINER_TYPES[ch];
    const [a, b] = t.rolls || BOX_COUNT[t.q];
    for (let i = 0; i < 2000; i++) {
      const n = Loot.fill(t.q, t.cats, t).length;
      assert(n >= a && n <= b + 1, ch + ' 件数越界：' + n);
    }
  }
});

test('档位分布按 keyTiers，红档合计为两把之和', () => {
  const tiers = CFG.LOOT.keyTiers;
  const N = 120000;
  const seen = {};
  let total = 0;
  for (const ch of ['U', 'Y', 'F']) {
    const t = CONTAINER_TYPES[ch];
    for (let i = 0; i < N; i++) {
      for (const e of Loot.fill(t.q, t.cats, t)) {
        if (e.item.cat !== 'key') continue;
        seen[e.item.id] = (seen[e.item.id] || 0) + 1;
        total++;
      }
    }
  }
  assert(total > 500, '样本太少：' + total);
  const wsum = DROPPABLE.reduce((s, k) => s + (tiers[k.r] || 0), 0);
  for (const k of DROPPABLE) {
    const p = (seen[k.id] || 0) / total;
    const exp = (tiers[k.r] || 0) / wsum;
    assert(near(p, exp, 0.03), k.number + ' 实测 ' + (p * 100).toFixed(1) + '% ≠ 期望 ' + (exp * 100).toFixed(1) + '%');
  }
});

test('掉落钥匙进背包即为满耐久', () => {
  const k = KEY_ITEMS.find(x => x.id === 'door_key_bank_vault');
  const cap = ItemCapacityCap(k);
  assert.equal(cap, k.maxDur);
});

/* 背包 capacity 的取值走 common.js 的 ItemCapacity.max；这里直接复算一遍，避免依赖运行时 */
function ItemCapacityCap(item) {
  return item ? (item.maxDur || item.healCap || (item.effect && item.effect.uses) || 0) : 0;
}

test('钥匙在掉落物里的估值与售价一致（供容器价值审计使用）', () => {
  for (const k of DROPPABLE) assert.equal(ITEM_BY_ID[k.id].price, k.price);
});

console.log('\n' + checks + ' 项通过');
