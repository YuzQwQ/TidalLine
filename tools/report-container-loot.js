/* 容器掉落勘察报告生成器
   node tools/report-container-loot.js
   产出：
     design/items/CONTAINER_LOOT.html   交互式报告（按容器 / 按实例 / 按类别 / 按物品 / 问题）
     design/items/CONTAINER_LOOT.md     速查表（类别 × 容器 概率矩阵）

   概率完全复刻 js/core.js 的 Loot.roll：
     w(item) = pct[r] * catW / ΣcatW(该档) / 该档该类件数
   注意运行时真正生效的偏好是 `type.cats || spot.preference`（js/game.js:786），
   抽屉 / 储物柜 / 纸箱 / 垃圾桶 / 保险箱没有内置 cats，由地图点位决定——
   同名容器在不同房间掉的东西可以完全不同，报告按实例分别计算。
   ------------------------------------------------------------------ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'design/items');

/* ---------- 载入游戏数据 ---------- */
const ctx = vm.createContext({ console, performance });
for (const f of ['config.js', 'data.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
}
const G = vm.runInContext(
  '({ITEMS, CONTAINER_TYPES, CONTAINER_QUALITY, QUALITY_ORDER, RARITY, RARITY_WEIGHT, CATS, BOX_COUNT, CAT_PREF: CFG.LOOT.catPref, MAP: RAID_MAP})',
  ctx
);
const { ITEMS, CONTAINER_TYPES, CONTAINER_QUALITY, QUALITY_ORDER, RARITY, CATS, BOX_COUNT, CAT_PREF, MAP } = G;

/* ---------- 复刻 Loot.roll 的权重 ---------- */
function weightTable(quality, prefCats) {
  const Q = CONTAINER_QUALITY[quality];
  if (!Q) throw new Error('未知品质 ' + quality);
  const bias = r => Q.pct[r - 1] || 0;
  const pool = ITEMS.filter(it => !it.noLoot && bias(it.r) > 0);

  const catW = it => {
    let v = prefCats && prefCats.includes(it.cat) ? CAT_PREF : 1;
    if (Q.lv >= 5) {
      if (it.cat === 'collect') v *= 1.35;
    } else if (Q.lv <= 2) {
      if (it.cat === 'ind' || it.cat === 'life') v *= 1.25;
    }
    return v;
  };

  const cell = {}, cellW = {};
  for (const it of pool) {
    if (!cell[it.r]) { cell[it.r] = {}; cellW[it.r] = 0; }
    if (cell[it.r][it.cat] == null) { cell[it.r][it.cat] = 0; cellW[it.r] += catW(it); }
    cell[it.r][it.cat]++;
  }

  let total = 0;
  const rows = pool.map(it => {
    const v = bias(it.r) * catW(it) / cellW[it.r] / cell[it.r][it.cat];
    total += v;
    return { id: it.id, name: it.name, short: it.short || it.name, cat: it.cat, r: it.r, price: it.price, p: v };
  });
  for (const row of rows) row.p /= total;
  rows.sort((a, b) => b.p - a.p || a.r - b.r);

  /* 类别与稀有度汇总 */
  const byCat = {}, byR = {};
  for (const row of rows) { byCat[row.cat] = (byCat[row.cat] || 0) + row.p; byR[row.r] = (byR[row.r] || 0) + row.p; }
  return { quality, prefCats: prefCats || null, rows, byCat, byR };
}

/* ---------- 蒙特卡洛校验：用真实 Loot.roll 抽样比对 ---------- */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function verify(tables, samples = 40000) {
  const simCtx = vm.createContext({ console, performance, Math: Object.create(Math) });
  for (const f of ['config.js', 'data.js', 'core.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), simCtx);
  }
  simCtx.Math.random = seeded(20261030);
  const worst = [];
  for (const t of tables.slice(0, 8)) {
    const counts = {};
    const call = `Loot.roll(${JSON.stringify(t.quality)}, ${JSON.stringify(t.prefCats)})`;
    for (let i = 0; i < samples; i++) {
      const r = vm.runInContext(call, simCtx);
      counts[r.item.id] = (counts[r.item.id] || 0) + 1;
    }
    let maxDiff = 0, at = '';
    for (const row of t.rows) {
      const d = Math.abs((counts[row.id] || 0) / samples - row.p);
      if (d > maxDiff) { maxDiff = d; at = row.name; }
    }
    worst.push({ key: t.quality + '/' + (t.prefCats ? t.prefCats.join('+') : '通用'), maxDiff, at });
  }
  return worst;
}

/* ---------- 容器实例（真实生效偏好） ---------- */
const instances = MAP.containers.map(b => {
  const type = CONTAINER_TYPES[b.type];
  if (!type) return null;
  const fromType = Array.isArray(type.cats) && type.cats.length > 0;
  const prefCats = fromType ? type.cats : (Array.isArray(b.preference) ? b.preference : null);
  return {
    id: b.id, ch: b.type, x: b.x, y: b.y, region: b.region,
    name: type.name, art: type.art, quality: type.q,
    prefCats, prefSource: fromType ? 'type' : (prefCats ? 'spot' : 'none'),
    declared: type.cats || null, spotPref: b.preference || null
  };
}).filter(Boolean);

/* ---------- 组合表：同一 (品质, 偏好) 只算一次 ---------- */
const keyOf = (q, cats) => q + '|' + (cats && cats.length ? [...cats].sort().join('+') : '-');
const tables = new Map();
function tableFor(q, cats) {
  const k = keyOf(q, cats);
  if (!tables.has(k)) tables.set(k, weightTable(q, cats));
  return tables.get(k);
}
for (const inst of instances) {
  inst.table = tableFor(inst.quality, inst.prefCats);
  inst.key = keyOf(inst.quality, inst.prefCats);
}

/* ---------- 容器类型汇总 ---------- */
const types = Object.entries(CONTAINER_TYPES).map(([ch, type]) => {
  const mine = instances.filter(i => i.ch === ch);
  const keys = [...new Set(mine.map(i => i.key))];
  /* 地图上没放的容器也要能查它"本来会掉什么"，按类型声明算一套参考表 */
  const tbls = keys.length
    ? keys.map(k => tables.get(k))
    : [tableFor(type.q, Array.isArray(type.cats) && type.cats.length ? type.cats : null)];
  return {
    ch, ...type,
    count: mine.length,
    regions: [...new Set(mine.map(i => i.region))],
    keys,
    tables: tbls,
    unplaced: keys.length === 0,
    /* 只写在地图上、但类型本身没有 cats 时，偏好完全来自点位 */
    spotDriven: !Array.isArray(type.cats) || !type.cats.length
  };
});

/* ---------- 物品 → 来源（只算真正摆在地图上的容器） ---------- */
const itemSources = new Map();
for (const type of types) {
  if (type.unplaced) continue;
  for (const t of type.tables) {
    const label = type.name + (type.tables.length > 1 ? '（' + (t.prefCats ? t.prefCats.map(c => CATS[c].name).join('/') : '通用') + '）' : '');
    for (const row of t.rows) {
      if (row.p <= 0) continue;
      if (!itemSources.has(row.id)) itemSources.set(row.id, []);
      itemSources.get(row.id).push({ label, ch: type.ch, quality: t.quality, p: row.p, count: type.count });
    }
  }
}
for (const list of itemSources.values()) list.sort((a, b) => b.p - a.p);

const droppable = ITEMS.filter(it => !it.noLoot && G.RARITY_WEIGHT[it.r] > 0);
const deadItems = ITEMS.filter(it => !it.noLoot && G.RARITY_WEIGHT[it.r] > 0 && !itemSources.has(it.id));

/* ---------- 全网期望产出（按类别）与来源贡献 ---------- */
const catExpect = {};
for (const cat of Object.keys(CATS)) catExpect[cat] = 0;
const catContrib = {};   /* cat -> Map(容器名 → 期望件数) */
let totalItems = 0;
for (const inst of instances) {
  const [a, b] = BOX_COUNT[inst.quality];
  const n = (a + b) / 2;
  totalItems += n;
  for (const [cat, p] of Object.entries(inst.table.byCat)) {
    catExpect[cat] = (catExpect[cat] || 0) + n * p;
    if (!catContrib[cat]) catContrib[cat] = new Map();
    catContrib[cat].set(inst.name, (catContrib[cat].get(inst.name) || 0) + n * p);
  }
}
const catTop = {};
for (const [cat, m] of Object.entries(catContrib)) {
  catTop[cat] = [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/* 逐件物品的全网期望：Σ 容器件数 × 单抽概率 */
const itemExpect = new Map();
for (const inst of instances) {
  const [a, b] = BOX_COUNT[inst.quality];
  const n = (a + b) / 2;
  for (const row of inst.table.rows) {
    if (row.p <= 0) continue;
    const cur = itemExpect.get(row.id) || { row, v: 0, box: '' };
    cur.v += n * row.p;
    itemExpect.set(row.id, cur);
  }
}
const expectRanked = [...itemExpect.values()].sort((a, b) => a.v - b.v);

/* ---------- 问题扫描 ---------- */
const issues = [];
const catsWithItems = new Set(droppable.map(i => i.cat));

/* 1. 有物品但没有任何容器偏好它 */
for (const cat of catsWithItems) {
  const owners = types.filter(t => (t.cats || []).includes(cat));
  if (!owners.length) {
    issues.push({
      level: 'warn',
      title: `「${CATS[cat].name}」没有任何容器主动偏好`,
      detail: `该类共 ${droppable.filter(i => i.cat === cat).length} 件物品，只能靠 1× 基础权重被抽到。想让它形成稳定来源，需要给某个容器补上 cats。`
    });
  }
}

/* 2. 偏好写了，但该类在容器品质覆盖的档位里没有物品 → 倍率空转 */
for (const type of types) {
  for (const t of type.tables) {
    if (!t.prefCats) continue;
    const covered = t.prefCats.filter(c => t.byCat[c] > 0.0005);
    const missing = t.prefCats.filter(c => !(t.byCat[c] > 0.0005));
    for (const c of missing) {
      const hasAny = droppable.some(i => i.cat === c);
      issues.push({
        level: hasAny ? 'warn' : 'error',
        title: `${type.name} 偏好的「${CATS[c].name}」在 ${CONTAINER_QUALITY[t.quality].name} 档抽不到`,
        detail: hasAny
          ? `该类别在 ${CONTAINER_QUALITY[t.quality].name} 档的稀有度区间内没有物品（该类物品稀有度为 ${[...new Set(droppable.filter(i => i.cat === c).map(i => 'r' + i.r))].join('/')}），这条偏好实际不生效。`
          : `该类别目前没有任何可掉落物品，偏好是空指向。`
      });
    }
  }
}

/* 3. 同名容器在不同房间偏好不同（容易误判） */
for (const type of types) {
  if (type.tables.length > 1) {
    issues.push({
      level: 'info',
      title: `${type.name} 有 ${type.tables.length} 套不同的掉落表`,
      detail: `类型本身没有写 cats，${type.count} 个实例各自按地图点位偏好：` +
        type.tables.map(t => (t.prefCats ? t.prefCats.map(c => CATS[c].name).join('+') : '通用')).join(' / ') +
        '。玩家看到的是同一个贴图，掉的东西却不一样。'
    });
  }
}

/* 3b. 定义了但没放上地图的容器 */
for (const type of types) {
  if (type.unplaced) {
    issues.push({
      level: 'info',
      title: `${type.name} 当前地图未放置`,
      detail: `${CONTAINER_QUALITY[type.q].name}档容器已定义，但 ${MAP.title} 里没有实例，本局不会产出任何物品。`
    });
  }
}

/* 4. 稀有度-类别空洞：某档完全没有某类 */
const holes = [];
for (const cat of catsWithItems) {
  const rs = [1, 2, 3, 4, 5, 6].filter(r => droppable.some(i => i.cat === cat && i.r === r));
  if (rs.length < 6) holes.push({ cat, rs });
}
for (const h of holes) {
  const missing = [1, 2, 3, 4, 5, 6].filter(r => !h.rs.includes(r));
  issues.push({
    level: 'info',
    title: `「${CATS[h.cat].name}」缺 ${missing.map(r => 'r' + r).join('、')} 物品`,
    detail: `现有档位 ${h.rs.map(r => 'r' + r).join('/')}。缺档的品质级容器抽到该类时会自动把份额让给别的类别，因此高稀有度容器里该类占比会被压低。`
  });
}

/* 4b. 单一容器垄断某类别 */
for (const [cat, list] of Object.entries(catTop)) {
  const sum = catExpect[cat];
  if (sum < 3 || !list.length) continue;
  const [name, v] = list[0];
  if (v / sum > 0.35) {
    issues.push({
      level: 'info',
      title: `${CATS[cat].name} 主要靠「${name}」供给`,
      detail: `占该类别每局期望的 ${(v / sum * 100).toFixed(0)}%（${v.toFixed(1)} / ${sum.toFixed(1)} 件）。想分散来源，可以给别的容器补上这条偏好。`
    });
  }
}

/* 5. 几乎抽不到的物品（全网 < 0.05%） */
for (const it of droppable) {
  const src = itemSources.get(it.id);
  if (!src) continue;
  const total = src.reduce((s, x) => s + x.p * (x.count / Math.max(1, instances.length)), 0);
  if (total < 0.0005) issues.push({ level: 'info', title: `${it.name} 全网概率极低`, detail: `单件容器抽中率最高 ${(src[0].p * 100).toFixed(3)}%（${src[0].label}）。` });
}

/* 6. 类别供给失衡 */
const supply = Object.entries(catExpect).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
if (supply.length) {
  const top = supply[0], bottom = supply[supply.length - 1];
  if (top[1] > bottom[1] * 3) {
    issues.push({
      level: 'info',
      title: '整张图的类别供给差距较大',
      detail: `每局期望：${CATS[top[0]].name} ${top[1].toFixed(1)} 件，${CATS[bottom[0]].name} 只有 ${bottom[1].toFixed(1)} 件（约 ${(top[1] / bottom[1]).toFixed(1)} 倍）。若稀缺是刻意设计可忽略；否则调高稀缺类别的容器偏好或补高稀有度物品。`
    });
  }
}

const verifyRows = verify([...tables.values()]);

module.exports = { tables, instances, types, itemSources, issues };

/* ==================================================================
   渲染
   ================================================================== */
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (p, digits = 1) => (p * 100).toFixed(digits) + '%';
const pctS = p => (p * 100 >= 10 ? (p * 100).toFixed(0) : p * 100 >= 1 ? (p * 100).toFixed(1) : (p * 100).toFixed(2)) + '%';
const RCOLOR = Object.fromEntries(RARITY.map(r => [r.k, r.color]));
const RNAME = Object.fromEntries(RARITY.map(r => [r.k, r.name]));
/* 稀有度原色只有做徽章底色才够亮，当正文颜色会糊在白底上，文字用加深版 */
const RTEXT = { 1: '#6b7470', 2: '#2f6d5d', 3: '#31577d', 4: '#6b4a8a', 5: '#8a6a1e', 6: '#8d3a3a' };

const catOrder = ['life', 'elec', 'ind', 'med', 'collect', 'mil', 'intel', 'occult', 'odd', 'medical', 'ammo'];

function catChips(cats) {
  if (!cats) return '<span class="chip muted">通用（无偏好）</span>';
  return cats.map(c => `<span class="chip" style="--c:${CATS[c].color}">${esc(CATS[c].name)}</span>`).join('');
}
function bar(byCat) {
  const segs = catOrder.filter(c => byCat[c] > 0.001)
    .map(c => `<i style="width:${(byCat[c] * 100).toFixed(2)}%;background:${CATS[c].color}" title="${CATS[c].name} ${pct(byCat[c])}"></i>`).join('');
  return `<div class="bar">${segs}</div>`;
}
function itemRows(t, limit) {
  const rows = limit ? t.rows.slice(0, limit) : t.rows;
  return rows.map(r => `<tr data-item="${esc(r.id)}" data-cat="${r.cat}">
    <td><b style="color:${RTEXT[r.r]}">${esc(r.short)}</b></td>
    <td class="dim">${esc(CATS[r.cat].name)}</td>
    <td class="num"><span class="r" style="--c:${RCOLOR[r.r]}">r${r.r}</span></td>
    <td class="num">${pctS(r.p)}</td>
  </tr>`).join('');
}

/* ---------- 容器卡 ---------- */
function typeCard(type) {
  const q = CONTAINER_QUALITY[type.q];
  const [ca, cb] = BOX_COUNT[type.q];
  /* 点位驱动且有多套表时，把各套偏好取并集展示，再单独标「按点位」 */
  const prefUnion = [...new Set(type.tables.flatMap(t => t.prefCats || []))];
  const tablesHtml = type.tables.map(t => {
    const label = type.tables.length > 1
      ? `<div class="subtable-head">${t.prefCats ? t.prefCats.map(c => CATS[c].name).join(' / ') : '通用'} <span class="dim">· ${instances.filter(i => i.ch === type.ch && i.key === keyOf(t.quality, t.prefCats)).length} 个</span></div>`
      : '';
    const live = t.rows.filter(r => r.p > 0);
    return `${label}${bar(t.byCat)}
      <div class="poollen">可抽 ${live.length} 种 · 下表按概率排序前 8</div>
      <table class="mini"><tbody>${itemRows(t, 8)}</tbody></table>
      <details><summary>展开全部 ${live.length} 种</summary>
        <table class="mini"><tbody>${itemRows(t, 0)}</tbody></table></details>`;
  }).join('');
  return `<article class="card" data-ch="${type.ch}" data-name="${esc(type.name)}" data-q="${type.q}" style="--q:${q.color}">
    <header>
      <span class="glyph">${esc(type.ch)}</span>
      <div class="grow">
        <h3>${esc(type.name)}</h3>
        <div class="meta">${q.lv} 级 ${q.name} · 开箱 ${q.time === 0 ? '即时' : q.time + 's'} · ${ca}–${cb} 件 · 地图 ${type.count} 个</div>
      </div>
    </header>
    <div class="chips">${catChips(prefUnion.length ? prefUnion : null)}
      ${type.spotDriven ? '<span class="chip warn">偏好来自地图点位</span>' : ''}</div>
    ${type.unplaced ? '<p class="empty">当前地图未放置。下表按类型声明计算，仅供参考。</p>' : ''}
    ${tablesHtml}
  </article>`;
}

/* ---------- 类别 × 容器 矩阵 ---------- */
const matrixTypes = types.filter(t => t.count > 0);
function matrix() {
  const head = matrixTypes.map(t => `<th title="${esc(t.name)}"><span>${esc(t.ch)}</span></th>`).join('');
  const rows = catOrder.filter(c => catsWithItems.has(c)).map(c => {
    const cells = matrixTypes.map(t => {
      /* 该类型所有实例里，抽到该类别的平均概率 */
      const ps = t.tables.map(tb => tb.byCat[c] || 0);
      const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
      const best = Math.max(...ps);
      if (best < 0.0005) return '<td class="zero">·</td>';
      const level = best >= 0.45 ? 3 : best >= 0.2 ? 2 : 1;
      return `<td class="cell l${level}" title="${esc(t.name)} · ${pct(best)}${t.tables.length > 1 ? '（点位差异，取最偏）' : ''}">${(best * 100).toFixed(0)}${t.tables.length > 1 ? '<sup>*</sup>' : ''}</td>`;
    }).join('');
    return `<tr><th style="border-left:3px solid ${CATS[c].color}">${esc(CATS[c].name)}</th>${cells}</tr>`;
  }).join('');
  return `<table class="matrix"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>
    <p class="dim small">数字 = 该容器单次抽取落入此类别的最高概率（%）。<sup>*</sup> 表示该类型的偏好按地图点位走、有多套掉落表，此处取最偏的一套。</p>`;
}

/* ---------- 类别视图 ---------- */
function catSection(c) {
  const items = droppable.filter(i => i.cat === c).sort((a, b) => a.r - b.r);
  if (!items.length) return '';
  const providers = matrixTypes.map(t => {
    const ps = t.tables.map(tb => tb.byCat[c] || 0);
    return { t, p: Math.max(...ps) };
  }).filter(x => x.p > 0.0005).sort((a, b) => b.p - a.p);
  const rs = [1, 2, 3, 4, 5, 6].map(r => items.filter(i => i.r === r).length);
  return `<section class="catblock" data-cat="${c}">
    <h3><span class="swatch" style="background:${CATS[c].color}"></span>${esc(CATS[c].name)}
      <em>${items.length} 件 · ${rs.map((n, i) => (n ? `<span style="color:${RCOLOR[i + 1]}">r${i + 1}×${n}</span>` : `<span class="dim">r${i + 1}×0</span>`)).join(' ')}</em></h3>
    <div class="two">
      <div>
        <h4>主要来源容器</h4>
        <table class="mini"><tbody>${providers.slice(0, 10).map(x => `<tr><td><span class="glyph tiny">${esc(x.t.ch)}</span> ${esc(x.t.name)}</td><td class="dim">${CONTAINER_QUALITY[x.t.q].name}</td><td class="num">${pctS(x.p)}</td></tr>`).join('') || '<tr><td class="dim">无容器偏好此类</td></tr>'}
        ${providers.length > 10 ? `<tr><td class="dim small" colspan="3">另有 ${providers.length - 10} 个容器少量产出</td></tr>` : ''}</tbody></table>
      </div>
      <div>
        <h4>物品清单</h4>
        <table class="mini"><tbody>${items.map(i => `<tr><td><b style="color:${RTEXT[i.r]}">${esc(i.name)}</b></td><td class="num"><span class="r" style="--c:${RCOLOR[i.r]}">r${i.r}</span></td><td class="num dim">¥${i.price}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>
  </section>`;
}

/* ---------- 实例视图 ---------- */
function instanceTable() {
  const regions = [...new Set(instances.map(i => i.region))];
  return regions.map(reg => {
    const list = instances.filter(i => i.region === reg);
    return `<section class="catblock"><h3>${esc(reg)} <em>${list.length} 个</em></h3>
      <table class="list"><thead><tr><th>编号</th><th>坐标</th><th>容器</th><th>品质</th><th>生效偏好</th><th>来源</th><th>前 3 件（单抽概率）</th></tr></thead><tbody>
      ${list.map(i => `<tr>
        <td class="dim">${esc(i.id)}</td>
        <td class="num dim">${i.x},${i.y}</td>
        <td><span class="glyph tiny">${esc(i.ch)}</span> ${esc(i.name)}</td>
        <td><span class="qpill" style="--q:${CONTAINER_QUALITY[i.quality].color}">${CONTAINER_QUALITY[i.quality].name}</span></td>
        <td>${catChips(i.prefCats)}</td>
        <td class="dim">${i.prefSource === 'type' ? '类型内置' : i.prefSource === 'spot' ? '地图点位' : '无'}</td>
        <td class="dim small">${i.table.rows.slice(0, 3).map(r => `${esc(r.short)} ${pctS(r.p)}`).join(' · ')}</td>
      </tr>`).join('')}</tbody></table></section>`;
  }).join('');
}

/* ---------- 物品视图 ---------- */
function itemTable() {
  return droppable.map(it => {
    const src = itemSources.get(it.id) || [];
    const top = src.slice(0, 4).map(x => `<span class="src">${esc(x.label)} <b>${pctS(x.p)}</b></span>`).join('');
    return `<tr data-search="${esc((it.name + ' ' + (it.short || '') + ' ' + CATS[it.cat].name).toLowerCase())}" data-cat="${it.cat}">
      <td><b style="color:${RTEXT[it.r]}">${esc(it.name)}</b>${it.noCodex ? '<i class="dim small"> 非图鉴</i>' : ''}</td>
      <td class="dim">${esc(CATS[it.cat].name)}</td>
      <td class="num"><span class="r" style="--c:${RCOLOR[it.r]}">r${it.r}</span></td>
      <td class="num dim">¥${it.price}</td>
      <td class="srcs">${top || '<span class="dim">无来源</span>'}${src.length > 4 ? `<span class="dim small"> +${src.length - 4}</span>` : ''}</td>
    </tr>`;
  }).join('');
}

/* ---------- 汇总数字 ---------- */
const totalContainers = instances.length;
const placed = types.filter(t => t.count > 0).length;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>潮汐线 · 容器掉落勘察</title>
<style>
  :root{
    --paper:#f5f2ea; --card:#fffdf8; --ink:#23201c; --dim:#8a8175; --line:#ded7c8;
    --accent:#3f6d9b; --warn:#a8732a; --bad:#a34a3c;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:14px/1.65 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
  code,.glyph{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
  .wrap{max-width:1180px;margin:0 auto;padding:0 24px 80px}
  header.top{padding:34px 0 18px;border-bottom:2px solid var(--ink)}
  .kicker{font-size:11px;letter-spacing:.22em;color:var(--dim);text-transform:uppercase}
  h1{margin:6px 0 10px;font-size:30px;letter-spacing:.02em}
  .lead{color:#5c554a;max-width:820px}
  .stats{display:flex;gap:28px;flex-wrap:wrap;margin:18px 0 6px}
  .stat b{display:block;font-size:22px;line-height:1.2}
  .stat span{font-size:11px;color:var(--dim);letter-spacing:.08em}
  nav.tabs{position:sticky;top:0;z-index:9;background:var(--paper);display:flex;gap:6px;
    padding:10px 0;border-bottom:1px solid var(--line);margin-bottom:22px;flex-wrap:wrap}
  nav.tabs button{border:1px solid var(--line);background:var(--card);color:var(--ink);
    padding:7px 14px;border-radius:999px;font:inherit;font-size:13px;cursor:pointer}
  nav.tabs button[aria-selected=true]{background:var(--ink);color:#f7f4ec;border-color:var(--ink)}
  nav.tabs .search{margin-left:auto;display:flex;align-items:center;gap:8px}
  nav.tabs input{width:230px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;
    background:var(--card);font:inherit;font-size:13px}
  section.panel{display:none}
  section.panel[data-active=true]{display:block}
  h2{font-size:20px;margin:30px 0 6px;padding-bottom:6px;border-bottom:1px solid var(--line)}
  h3{font-size:15px;margin:22px 0 8px}
  h4{font-size:12px;letter-spacing:.08em;color:var(--dim);margin:12px 0 6px;font-weight:600}
  p{margin:8px 0}
  .dim{color:var(--dim)}
  .small{font-size:12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;align-items:start}
  .poollen{font-size:11px;color:var(--dim);margin:2px 0 4px}
  .card{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--q);
    border-radius:10px;padding:14px 16px 16px}
  .card header{display:flex;gap:10px;align-items:flex-start}
  .card h3{margin:0;font-size:15px}
  .glyph{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;
    border-radius:7px;background:#efeade;border:1px solid var(--line);font-weight:700;font-size:14px}
  .glyph.tiny{width:20px;height:20px;font-size:11px;border-radius:5px;margin-right:4px}
  .grow{flex:1}
  .meta{font-size:12px;color:var(--dim)}
  .chips{display:flex;gap:5px;flex-wrap:wrap;margin:10px 0 8px}
  .chip{font-size:11px;padding:2px 8px;border-radius:999px;background:#f0ebe0;
    border:1px solid color-mix(in srgb,var(--c,#ccc) 40%,#fff);color:#4a443b}
  .chip:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;
    background:var(--c,#bbb);margin-right:5px}
  .chip.muted:before{display:none}
  .chip.warn{background:#fbf0dc;border-color:#e2c48d;color:#8a5c15}
  .chip.warn:before{background:var(--warn)}
  .bar{display:flex;height:9px;border-radius:5px;overflow:hidden;background:#eae4d6;margin:8px 0 10px}
  .bar i{display:block;height:100%}
  table{border-collapse:collapse;width:100%}
  table.mini{font-size:12px}
  table.mini td{padding:3px 6px 3px 0;border-bottom:1px dotted #e8e2d3}
  table.mini tr:last-child td{border-bottom:0}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .r{display:inline-block;min-width:26px;text-align:center;font-size:10px;font-weight:700;
    color:#fff;background:var(--c);border-radius:4px;padding:0 4px}
  /* r1 的灰底太浅，白字看不清，单独压深字色 */
  .r[style*="#c6ceca"]{color:#3f3a33}
  .qpill{font-size:11px;padding:1px 7px;border-radius:4px;color:#fff;background:var(--q)}
  details{margin-top:8px;border-top:1px solid var(--line);padding-top:6px}
  summary{cursor:pointer;font-size:12px;color:var(--accent)}
  .subtable-head{font-size:11px;color:var(--dim);margin-top:12px;padding-top:8px;border-top:1px dashed var(--line)}
  .empty{margin:12px 0 0;font-size:12px;color:var(--dim);font-style:italic}
  table.matrix{font-size:12px;margin-top:8px}
  table.matrix th{padding:6px 4px;font-weight:600;border-bottom:1px solid var(--line)}
  table.matrix th span{display:inline-block;width:22px;text-align:center}
  table.matrix td{padding:5px 4px;text-align:center;border-bottom:1px solid #eee8da;
    font-variant-numeric:tabular-nums}
  table.matrix tr th:first-child{text-align:left;padding-left:10px;white-space:nowrap}
  .cell.l1{background:#eef1e6;color:#5c6a4a}
  .cell.l2{background:#dfe9d2;color:#41552e;font-weight:600}
  .cell.l3{background:#c7dcb4;color:#2f4620;font-weight:700}
  .cell.zero{color:#c9c2b3}
  table.list{font-size:12px;margin-top:8px}
  table.list th{text-align:left;font-weight:600;color:var(--dim);font-size:11px;
    letter-spacing:.04em;border-bottom:1px solid var(--line);padding:6px 8px 6px 0}
  table.list td{padding:6px 8px 6px 0;border-bottom:1px solid #eee8da;vertical-align:top}
  .catblock{margin:8px 0 26px}
  .catblock h3 em{font-style:normal;font-size:11px;color:var(--dim);font-weight:400;margin-left:8px}
  .swatch{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:7px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:26px}
  @media(max-width:780px){.two{grid-template-columns:1fr}}
  table.items tr{border-bottom:1px solid #eee8da}
  table.items td{padding:7px 8px 7px 0;vertical-align:top}
  table.items thead th{text-align:left;font-size:11px;color:var(--dim);font-weight:600;
    border-bottom:1px solid var(--line);padding:6px 8px 6px 0}
  .srcs{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px}
  .src b{color:var(--accent);font-variant-numeric:tabular-nums}
  .issue{border-left:3px solid var(--line);padding:8px 0 8px 12px;margin:10px 0}
  .issue.warn{border-color:#d9a94a}
  .issue.error{border-color:var(--bad)}
  .issue.info{border-color:#9fb6c9}
  .issue b{display:block;font-size:13px}
  .issue span{font-size:12px;color:#5c554a}
  .tag{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
  .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--dim);margin-top:8px}
  .legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}
  .hidden{display:none!important}
</style></head>
<body><div class="wrap">
<header class="top">
  <div class="kicker">TIDELINE · CONTAINER LOOT AUDIT</div>
  <h1>容器掉落勘察</h1>
  <p class="lead">按运行时真实逻辑计算：容器品质决定稀有度曲线，<code>cats</code> 把偏好类别权重抬到 ×${CAT_PREF}。
  抽屉、储物柜、遗弃纸箱、垃圾桶、保险箱没有内置 <code>cats</code>，实际偏好来自地图点位——
  同名容器在不同房间掉的东西并不一样，下面按实例分别列出。</p>
  <div class="stats">
    <div class="stat"><b>${Object.keys(CONTAINER_TYPES).length}</b><span>容器类型</span></div>
    <div class="stat"><b>${totalContainers}</b><span>地图实例</span></div>
    <div class="stat"><b>${placed}</b><span>已使用类型</span></div>
    <div class="stat"><b>${droppable.length}</b><span>可掉落物品</span></div>
    <div class="stat"><b>${instances.reduce((s, i) => { const [a, b] = BOX_COUNT[i.quality]; return s + (a + b) / 2; }, 0).toFixed(0)}</b><span>单局期望件数</span></div>
  </div>
</header>

<nav class="tabs">
  <button data-tab="overview" aria-selected="true">概览</button>
  <button data-tab="types">按容器</button>
  <button data-tab="instances">按实例</button>
  <button data-tab="cats">按类别</button>
  <button data-tab="items">按物品</button>
  <button data-tab="issues">问题 ${issues.length}</button>
  <div class="search"><input id="q" placeholder="搜索物品 / 容器…" autocomplete="off"></div>
</nav>

<section class="panel" data-panel="overview" data-active="true">
  <h2>品质曲线</h2>
  <table class="list"><thead><tr><th>档位</th><th>名称</th><th>件数</th><th>开箱</th><th>噪声</th><th>稀有度分布</th><th>地图容器</th></tr></thead><tbody>
  ${QUALITY_ORDER.map(q => {
    const Q = CONTAINER_QUALITY[q];
    const cnt = instances.filter(i => i.quality === q).length;
    return `<tr><td class="num">${Q.lv}</td>
      <td><span class="qpill" style="--q:${Q.color}">${Q.name}</span> <span class="dim small">${q}</span></td>
      <td class="num">${BOX_COUNT[q].join('–')}</td>
      <td class="num">${Q.time === 0 ? '即时' : Q.time + 's'}</td>
      <td class="num">${Q.noise}</td>
      <td>${Q.pct.map((v, i) => `<span class="r" style="--c:${RCOLOR[i + 1]}">${v}%</span>`).join(' ')}</td>
      <td class="num">${cnt}</td></tr>`;
  }).join('')}
  </tbody></table>
  <div class="legend">${RARITY.map(r => `<span><i style="background:${r.color}"></i>r${r.k} ${r.name}</span>`).join('')}</div>

  <h2>类别 × 容器 覆盖矩阵</h2>
  ${matrix()}

  <h2>单局期望产出（按类别）</h2>
  <table class="list"><thead><tr><th>类别</th><th>期望件数</th><th>占比</th><th></th></tr></thead><tbody>
  ${supply.map(([c, v]) => `<tr><td>${esc(CATS[c].name)}</td><td class="num">${v.toFixed(1)}</td>
    <td class="num dim">${(v / totalItems * 100).toFixed(1)}%</td>
    <td style="width:45%"><div class="bar"><i style="width:${(v / supply[0][1] * 100).toFixed(1)}%;background:${CATS[c].color}"></i></div></td></tr>`).join('')}
  </tbody></table>
  <p class="dim small">按 ${totalContainers} 个容器、各品质件数中值估算。合计约 ${totalItems.toFixed(0)} 件/局。</p>

  <h2>每类物品的来源构成</h2>
  <p class="dim small">想知道某类东西为什么多/少，看这张表——它按容器实例累加，能直接看出是哪几个箱子在供给。</p>
  <table class="list"><thead><tr><th>类别</th><th>每局期望</th><th>主要来源（占比）</th></tr></thead><tbody>
  ${supply.map(([c, v]) => {
    const list = (catTop[c] || []).slice(0, 4);
    const rest = v - list.reduce((s, [, x]) => s + x, 0);
    return `<tr><td style="border-left:3px solid ${CATS[c].color};padding-left:10px">${esc(CATS[c].name)}</td>
      <td class="num">${v.toFixed(1)}</td>
      <td class="srcs">${list.map(([n, x]) => `<span class="src">${esc(n)} <b>${(x / v * 100).toFixed(0)}%</b></span>`).join('')}
      ${rest > 0.05 ? `<span class="src dim">其他 ${(rest / v * 100).toFixed(0)}%</span>` : ''}</td></tr>`;
  }).join('')}
  </tbody></table>

  <h2>最罕见的 12 件物品</h2>
  <p class="dim small">按整张图的期望件数排（每局），不是单箱概率——一个箱子再偏爱某件，箱子少也照样难出。</p>
  <table class="list"><thead><tr><th>物品</th><th>类别</th><th>稀有度</th><th>每局期望</th></tr></thead><tbody>
  ${expectRanked.slice(0, 12).map(x => `<tr>
    <td><b style="color:${RTEXT[x.row.r]}">${esc(x.row.name)}</b></td>
    <td class="dim">${esc(CATS[x.row.cat].name)}</td>
    <td class="num"><span class="r" style="--c:${RCOLOR[x.row.r]}">r${x.row.r}</span></td>
    <td class="num">${x.v < 0.01 ? (x.v * 1000).toFixed(1) + '‰' : x.v.toFixed(2)}</td></tr>`).join('')}
  </tbody></table>

  <h2>要调整时改哪里</h2>
  <table class="list"><thead><tr><th>想改什么</th><th>改这里</th><th>注意</th></tr></thead><tbody>
  <tr><td>某个容器掉什么类别</td><td><code>js/data.js</code> → <code>CONTAINER_TYPES[字模].cats</code></td>
    <td>写 2–3 个类别；<b>不写</b>就回落到地图点位 <code>preference</code>，同名容器在不同房间可以完全不同。</td></tr>
  <tr><td>某个具体房间的容器</td><td><code>design/maps/&lt;图&gt;/layout.json</code> → <code>containers[].preference</code></td>
    <td>只对没写 <code>cats</code> 的类型生效。改完要跑 <code>node tools/build-linhai-map.js</code> 再 <code>node build.js</code>。</td></tr>
  <tr><td>某档品质的稀有度曲线</td><td><code>js/config.js</code> → <code>CONTAINER_QUALITY[q].pct</code></td>
    <td>六个数就是六档概率，合计 100；改完直接生效，不用重算。</td></tr>
  <tr><td>类别偏好有多强</td><td><code>js/config.js</code> → <code>LOOT.catPref</code></td>
    <td>当前 <b>×${CAT_PREF}</b>。调低 → 同类容器之间差异变小；调高 → 更容易只出偏好类别。</td></tr>
  <tr><td>每箱抽几件</td><td><code>js/config.js</code> → <code>CONTAINER_QUALITY[q].count</code></td>
    <td>与稀有度曲线解耦，单独调件数不会影响单件品质。</td></tr>
  <tr><td>某类东西太少见</td><td>先补该类的高稀有度物品，再考虑加容器偏好</td>
    <td>类别在某档没有物品时，这一档的份额会自动让给其它类别——光加偏好补不回来。</td></tr>
  <tr><td>新增一种容器</td><td><code>data.js</code> 加字模 + <code>assets/props</code> 贴图 + 地图图例</td>
    <td>字模不能占用 <code>P/E/S/X</code>；改完重跑本脚本可立即看到新表。</td></tr>
  </tbody></table>
</section>

<section class="panel" data-panel="types">
  <h2>容器类型清单</h2>
  <p class="dim small">每张卡显示该类型所有实例的合并结果。偏好来自点位的类型会按不同偏好拆成多张表。</p>
  <div class="grid">${QUALITY_ORDER.map(q => types.filter(t => t.q === q).map(typeCard).join('')).join('')}</div>
</section>

<section class="panel" data-panel="instances">
  <h2>地图实例（${totalContainers} 个）</h2>
  <p class="dim small">这是游戏里真正生成的对象：品质来自容器字模，偏好来自 <code>type.cats</code>，没有才回落点位 <code>preference</code>。</p>
  ${instanceTable()}
</section>

<section class="panel" data-panel="cats">
  <h2>按物品类别查看来源</h2>
  ${catOrder.filter(c => catsWithItems.has(c)).map(catSection).join('')}
</section>

<section class="panel" data-panel="items">
  <h2>物品 → 来源容器（${droppable.length} 件）</h2>
  <p class="dim small">只列出可掉落物品（<code>noLoot</code> 与权重为 0 的除外）。百分比是单件容器单次抽取的概率。</p>
  <table class="items"><thead><tr><th>物品</th><th>类别</th><th>稀有度</th><th>售价</th><th>主要来源</th></tr></thead>
  <tbody>${itemTable()}</tbody></table>
</section>

<section class="panel" data-panel="issues">
  <h2>自动发现（${issues.length} 条）</h2>
  <p class="dim small">由数据推导，不是规则校验。info 只作参考，warn 建议处理。</p>
  ${['error', 'warn', 'info'].map(lv => issues.filter(i => i.level === lv).map(i =>
    `<div class="issue ${lv}"><b>${esc(i.title)}</b><span>${esc(i.detail)}</span></div>`).join('')).join('')}
  ${issues.length ? '' : '<p class="dim">没有发现问题。</p>'}
  <h2>蒙特卡洛校验</h2>
  <p class="dim small">用带种子的随机数跑真实 <code>Loot.roll</code> 4 万次，与解析解对比最大偏差：</p>
  <table class="list"><thead><tr><th>组合</th><th>最大偏差</th><th>物品</th></tr></thead><tbody>
  ${verifyRows.map(v => `<tr><td class="dim">${esc(v.key)}</td><td class="num">${(v.maxDiff * 100).toFixed(3)}%</td><td class="dim">${esc(v.at)}</td></tr>`).join('')}
  </tbody></table>
</section>

<script>
const tabs = [...document.querySelectorAll('nav.tabs button[data-tab]')];
const panels = [...document.querySelectorAll('section.panel')];
function show(name){
  tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  panels.forEach(p => p.dataset.active = String(p.dataset.panel === name));
  window.scrollTo({top:0, behavior:'smooth'});
}
tabs.forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));

/* 搜索：在「按物品」页过滤，同时过滤容器卡 */
const box = document.getElementById('q');
box.addEventListener('input', () => {
  const q = box.value.trim().toLowerCase();
  document.querySelectorAll('table.items tbody tr').forEach(tr => {
    tr.classList.toggle('hidden', !!q && !tr.dataset.search.includes(q));
  });
  document.querySelectorAll('.card[data-ch]').forEach(card => {
    const hay = (card.dataset.name + ' ' + card.dataset.ch + ' ' + card.textContent).toLowerCase();
    card.classList.toggle('hidden', !!q && !hay.includes(q));
  });
  if (q) show('items');
});
</script>
</div></body></html>`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'CONTAINER_LOOT.html'), html);

/* ---------- Markdown 速查表 ---------- */
const md = [];
md.push('# 容器掉落勘察（自动生成）');
md.push('');
md.push('> 由 `tools/report-container-loot.js` 从 `js/data.js` / `js/config.js` / `js/core.js` 生成，不要手改。');
md.push('> 概率 = 单件容器单次抽取落入该项/该类别的概率，按 `Loot.roll` 的权重解析计算。');
md.push('> 运行时生效偏好是 `type.cats || spot.preference`；标「点位」的容器同名不同房间掉不同东西。');
md.push('');
md.push(`地图：${MAP.title}（${MAP.width}×${MAP.height}）· 容器实例 ${totalContainers} 个 · 可掉落物品 ${droppable.length} 件 · 单局期望 ${totalItems.toFixed(0)} 件`);
md.push('');
md.push('## 1. 容器类型一览');
md.push('');
md.push('| 字模 | 名称 | 品质 | 件数 | 开箱 | 地图 | 偏好 | 偏好来源 | 前三类别 |');
md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const q of QUALITY_ORDER) {
  for (const t of types.filter(x => x.q === q)) {
    const Q = CONTAINER_QUALITY[q];
    const pref = t.tables.length === 1
      ? (t.tables[0].prefCats ? t.tables[0].prefCats.map(c => CATS[c].name).join('/') : '通用')
      : t.tables.map(tb => tb.prefCats ? tb.prefCats.map(c => CATS[c].name).join('/') : '通用').join(' ‖ ');
    /* 多套掉落表逐套给前三类别，不要混在一起取最大值 */
    const top3 = t.tables.map(tb => {
      const pairs = Object.entries(tb.byCat).filter(([, v]) => v > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const head = t.tables.length > 1 ? `(${tb.prefCats ? tb.prefCats.map(c => CATS[c].name).join('/') : '通用'}) ` : '';
      return head + (pairs.length ? pairs.map(([c, v]) => `${CATS[c].name} ${(v * 100).toFixed(0)}%`).join('、') : '—');
    }).join(' ‖ ');
    md.push(`| \`${t.ch}\` | ${t.name} | ${Q.lv} ${Q.name} | ${BOX_COUNT[q].join('–')} | ${Q.time === 0 ? '即时' : Q.time + 's'} | ${t.count}${t.unplaced ? ' *' : ''} | ${pref} | ${t.spotDriven ? '点位' : '类型'} | ${top3} |`);
  }
}
md.push('');
md.push('`*` = 当前地图未放置，该行按类型声明算的参考表；`‖` 分隔同一名称的不同点位偏好。');
md.push('');
md.push('## 2. 类别 × 容器（%）');
md.push('');
md.push('同一类型有点位差异时取最偏的一套（带 `*` 者）。`.` = 抽不到。');
md.push('');
md.push('| 类别 | ' + matrixTypes.map(t => t.ch).join(' | ') + ' |');
md.push('| --- | ' + matrixTypes.map(() => '---').join(' | ') + ' |');
for (const c of catOrder.filter(c => catsWithItems.has(c))) {
  const cells = matrixTypes.map(t => {
    const best = Math.max(...t.tables.map(tb => tb.byCat[c] || 0));
    if (best < 0.0005) return '.';
    return (best * 100).toFixed(0) + (t.tables.length > 1 ? '*' : '');
  });
  md.push(`| ${CATS[c].name} | ${cells.join(' | ')} |`);
}
md.push('');
md.push('字模对照：' + matrixTypes.map(t => `\`${t.ch}\`=${t.name}`).join('、'));
md.push('');
md.push('## 3. 类别供给');
md.push('');
md.push('| 类别 | 物品数 | r1 | r2 | r3 | r4 | r5 | r6 | 单局期望 |');
md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const c of catOrder.filter(c => catsWithItems.has(c))) {
  const items = droppable.filter(i => i.cat === c);
  const rs = [1, 2, 3, 4, 5, 6].map(r => items.filter(i => i.r === r).length);
  md.push(`| ${CATS[c].name} | ${items.length} | ${rs.join(' | ')} | ${(catExpect[c] || 0).toFixed(1)} |`);
}
md.push('');
md.push('## 4. 自动发现');
md.push('');
for (const i of issues) md.push(`- **${i.level === 'warn' ? '⚠️ ' : i.level === 'error' ? '⛔ ' : '· '}${i.title}** — ${i.detail}`);
if (!issues.length) md.push('- 无');
md.push('');
md.push('## 5. 校验');
md.push('');
md.push('蒙特卡洛 4 万次与解析解的最大偏差：' + verifyRows.map(v => `${v.key} ${(v.maxDiff * 100).toFixed(3)}%`).join(' · '));
md.push('');

fs.writeFileSync(path.join(OUT_DIR, 'CONTAINER_LOOT.md'), md.join('\n'));

console.log(`容器类型 ${Object.keys(CONTAINER_TYPES).length} · 实例 ${totalContainers} · 可掉落物品 ${droppable.length} · 发现问题 ${issues.length}`);
console.log(`校验最大偏差 ${(Math.max(...verifyRows.map(v => v.maxDiff)) * 100).toFixed(3)}%`);
console.log('已写出 design/items/CONTAINER_LOOT.html 与 CONTAINER_LOOT.md');
