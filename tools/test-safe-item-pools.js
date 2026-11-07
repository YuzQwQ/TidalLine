/* 大小保险箱专属奖池验收。
   node tools/test-safe-item-pools.js

   规格（design/items/CONTAINER_LOOT.md · 保险箱专属池）：
     · B 小型保险箱 / V 大型保险箱取消通用池；
     · 非红色（r1–r5）只从文物藏品 / 情报资料 / 神秘学物品三类里出；
     · 红色（r6）放开到全部九个收集类别，彩蛋仍走 2% 支线；
     · 稀有度曲线、红档 tier 权重、其它容器一律不变。 */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '..');
const c = vm.createContext({ console, performance });
for (const f of ['config.js', 'data.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), c);
}
const G = vm.runInContext(
  '({Loot,ITEMS,CONTAINER_TYPES,CONTAINER_QUALITY,CFG,itemGroup,BOX_COUNT})', c);
const { Loot, ITEMS, CONTAINER_TYPES, CONTAINER_QUALITY, CFG, itemGroup } = G;

let checks = 0;
function test(name, fn) {
  try { fn(); checks++; console.log('OK: ' + name); }
  catch (e) { console.log('FAIL: ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
const near = (a, b, tol) => Math.abs(a - b) < (tol == null ? 1e-6 : tol);

const B = CONTAINER_TYPES.B, V = CONTAINER_TYPES.V;
const CATS3 = ['collect', 'intel', 'occult'];
const RED = CFG.LOOT.eggRarity;
const COLLECT_CATS = [...new Set(ITEMS.filter(i => itemGroup(i) === 'collectible').map(i => i.cat))];

/* 固定的可复现随机源：抽样要用大量样本覆盖九类红品，每次跑结果一致 */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withSeed(seed, fn) {
  const real = Math.random;
  Math.random = seeded(seed);
  try { return fn(); } finally { Math.random = real; }
}

/* ---------- 声明 ---------- */
test('保险箱与新军械容器的专属物品池声明', () => {
  for (const [ch, t] of Object.entries(CONTAINER_TYPES)) {
    if (ch === 'B' || ch === 'V') assert.ok(t.itemPool, ch + ' 缺 itemPool');
    else if(ch==='g'||ch==='h'){assert.deepEqual([...t.itemPool.cats],['mil']);assert.equal(t.itemPool.allowEggs,false);}
    else assert.equal(t.itemPool, undefined, ch + ' 不该有 itemPool');
  }
  assert.equal(B.itemPool, V.itemPool, '两种保险箱共用同一份池声明');
  assert.deepEqual([...B.itemPool.cats], CATS3);
  assert.equal(B.itemPool.redAllCollectibles, true);
  assert.equal(B.q, 'rich');
  assert.equal(V.q, 'secret');
  assert.equal(B.ammoPool, undefined, '保险箱不挂弹药池');
  assert.equal(B.gearPool, undefined, '保险箱不挂装备池');
});

test('九个收集类别在红档都有非彩蛋物品，非红三类在每一档都有物品', () => {
  assert.equal(COLLECT_CATS.length, 9);
  for (const cat of COLLECT_CATS) {
    assert(ITEMS.some(i => i.cat === cat && i.r === RED && !i.egg && !i.noLoot),
      cat + ' 红档空缺');
  }
  for (const cat of CATS3) {
    for (let r = 1; r < RED; r++) {
      assert(ITEMS.some(i => i.cat === cat && i.r === r && !i.noLoot),
        cat + ' r' + r + ' 空缺：该档会被曲线抬走');
    }
  }
});

/* ---------- 准入判断 ---------- */
test('inItemPool：非红只放三类，红档放全部收集品', () => {
  const rule = B.itemPool;
  for (const it of ITEMS) {
    if (it.noLoot || it.egg) continue;
    const allowed = Loot.inItemPool(it, rule, RED);
    if (it.r === RED) assert.equal(allowed, itemGroup(it) === 'collectible', it.id + ' 红档');
    else assert.equal(allowed, CATS3.includes(it.cat), it.id + ' 非红');
  }
  /* 物资类红档（如果将来有人加）仍不进池 */
  assert.equal(Loot.inItemPool({ id: 'fake', cat: 'medical', r: RED }, rule, RED), false);
  assert.equal(Loot.inItemPool({ id: 'fake', cat: 'ammo', r: 3 }, rule, RED), false);
  /* 不传 rule 时完全放行，其它容器走老路 */
  assert.equal(Loot.inItemPool({ cat: 'life', r: 2 }, null, RED), true);
});

/* ---------- 实际掉落 ---------- */
function sample(quality, type, n, seed) {
  return withSeed(seed, () => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(Loot.roll(quality, ['collect'], type.itemPool).item);
    return out;
  });
}

test('非红物品严格限定三类，且没有物资 / 彩蛋混进来', () => {
  for (const [q, type] of [['rich', B], ['secret', V]]) {
    const rows = sample(q, type, 60000, 20261107);
    const nonRed = rows.filter(i => i.r !== RED);
    assert(nonRed.length > 40000, q + ' 样本不足');
    for (const it of nonRed) {
      assert(CATS3.includes(it.cat), q + ' 非红越界 ' + it.id + '/' + it.cat);
      assert.equal(itemGroup(it), 'collectible', q + ' 非红混进物资 ' + it.id);
      assert(!it.noLoot, q + ' 非红混进 noLoot');
    }
  }
});

test('红档覆盖全部九个收集类别，且三类限制不再生效', () => {
  for (const [q, type] of [['rich', B], ['secret', V]]) {
    const reds = sample(q, type, 200000, 77123).filter(i => i.r === RED);
    const cats = new Set(reds.map(i => i.cat));
    assert.equal(cats.size, 9, q + ' 红档只覆盖 ' + [...cats].join(','));
    for (const cat of COLLECT_CATS) assert(cats.has(cat), q + ' 红档缺 ' + cat);
    /* 原本被三类挡在门外的六类确实出现了 */
    for (const cat of COLLECT_CATS.filter(x => !CATS3.includes(x)))
      assert(cats.has(cat), q + ' 红档没放开 ' + cat);
  }
});

test('稀有度曲线仍是品质 pct，一格不动', () => {
  for (const [q, type] of [['rich', B], ['secret', V]]) {
    const rows = sample(q, type, 200000, 330011);
    const pct = CONTAINER_QUALITY[q].pct;
    const sum = pct.reduce((a, b) => a + b, 0);
    for (let r = 1; r <= 6; r++) {
      const obs = rows.filter(i => i.r === r).length / rows.length * 100;
      const exp = pct[r - 1] / sum * 100;
      assert(near(obs, exp, 0.35), q + ' r' + r + ' 实测 ' + obs.toFixed(2) + '% 期望 ' + exp.toFixed(2) + '%');
    }
  }
});

test('红档内部仍按 45/35/18 的价值档位加权', () => {
  const reds = sample('secret', V, 300000, 918273).filter(i => i.r === RED && !i.egg);
  const cnt = { 1: 0, 2: 0, 3: 0 };
  for (const it of reds) if (cnt[it.tier] != null) cnt[it.tier]++;
  const total = cnt[1] + cnt[2] + cnt[3];
  const w = CFG.LOOT.redTiers, sum = w[1] + w[2] + w[3];
  for (const t of [1, 2, 3]) {
    const obs = cnt[t] / total * 100, exp = w[t] / sum * 100;
    assert(near(obs, exp, 2.0), 'tier' + t + ' 实测 ' + obs.toFixed(2) + '% 期望 ' + exp.toFixed(2) + '%');
  }
});

test('彩蛋 2% 支线仍从保险箱红档里出来', () => {
  const reds = sample('secret', V, 300000, 55555).filter(i => i.r === RED);
  const eggs = reds.filter(i => i.egg).length;
  const rate = eggs / reds.length;
  assert(eggs > 0, '保险箱摸不到彩蛋');
  assert(near(rate, CFG.LOOT.eggChance, 0.004), '彩蛋率 ' + rate.toFixed(4));
});

test('池内三类等权，点位偏好 collect 不再把另外两类压没', () => {
  const rows = sample('secret', V, 120000, 4400).filter(i => i.r !== RED);
  const cnt = {};
  for (const it of rows) cnt[it.cat] = (cnt[it.cat] || 0) + 1;
  for (const cat of CATS3) {
    const p = (cnt[cat] || 0) / rows.length;
    assert(near(p, 1 / 3, 0.02), cat + ' 占比 ' + p.toFixed(3) + '，应接近 1/3');
  }
});

/* ---------- fill 端到端 ---------- */
test('Loot.fill 走容器 type 时自动启用专属池', () => {
  for (const [q, type] of [['rich', B], ['secret', V]]) {
    withSeed(8811, () => {
      for (let k = 0; k < 4000; k++) {
        const rows = Loot.fill(q, ['collect'], type);
        assert(rows.length >= 2 && rows.length <= 3, q + ' 件数越界 ' + rows.length);
        for (const { item } of rows) {
          assert(!item.noLoot, q + ' 掉出 noLoot');
          if (item.r === RED) assert(itemGroup(item) === 'collectible' || item.egg, q + ' 红档越界 ' + item.id);
          else assert(CATS3.includes(item.cat), q + ' 非红越界 ' + item.id + '/' + item.cat);
        }
      }
    });
  }
});

test('不传 type / 不传 itemPool 的容器仍走通用池', () => {
  const generic = withSeed(2026, () => {
    const out = [];
    for (let i = 0; i < 30000; i++) out.push(Loot.roll('rich', ['collect']).item);
    return out;
  });
  assert(generic.some(i => i.cat === 'life' || i.cat === 'ind' || i.cat === 'mil'),
    '通用池不该被保险箱规则误伤');
  const drawer = withSeed(2027, () => {
    const out = [];
    for (let i = 0; i < 30000; i++) for (const e of Loot.fill('plain', null, CONTAINER_TYPES.C)) out.push(e.item);
    return out;
  });
  assert(drawer.some(i => !CATS3.includes(i.cat)), '抽屉不该被限定成三类');
});

test('缺档回退也带专属池：rollGear / rollAttachment 不漏回通用池', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'core.js'), 'utf8');
  assert(/rollGear\(quality, options, itemPool\)/.test(src));
  assert(/this\.roll\(quality, null, itemPool\)/.test(src));
  assert(/this\.roll\(quality,cats,itemPool\)/.test(src));
  const fallback = withSeed(31337, () => Loot.rollGear('secret', { kinds: [] }, V.itemPool).item);
  assert(!fallback.equip, '空 kinds 应该回退成物品');
  if (fallback.r === RED) assert(itemGroup(fallback) === 'collectible');
  else assert(CATS3.includes(fallback.cat), '回退物品越界 ' + fallback.id);
});

console.log('\n' + checks + ' 组保险箱专属奖池断言通过');
