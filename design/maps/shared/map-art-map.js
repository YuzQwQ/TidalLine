/* 美术登记表：地块字符 → 贴图、方向性资源的旋转族、道具朝向变体的实际覆盖。
 * 只描述"资源长什么样"，不画图、不改数据。
 * 编辑器用它决定视图旋转时该换哪张图；缺变体时给出明确提示，而不是静默回退。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapArtMap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* 图例字符 → 地块贴图。与 tools/build-linhai-map.js 的 visual 表保持一致。 */
  const TILE_ART = {
    '#': 'wall', X: 'wall', '.': 'low', r: 'street_stone', q: 'courtyard_paving',
    i: 'floor', '~': 'canal_water', k: 'quay_top', '=': 'bridge_stone_deck',
    '-': 'bridge_wood_deck', '+': 'floor', '/': 'floor', w: 'floor', s: 'canal_steps_w'
  };

  const Library=typeof module==='object'&&module.exports?require('./scene-library.js'):globalThis.SceneLibrary;
  for(const a of (Library&&Library.grounds)||[])TILE_ART[a.ch]=a.id;

  /* 旋转族：只有这些资源在视图旋转时需要换变体。
   * 其余地块与道具都烘焙了左上光照，整图旋转会让光向错误，所以保持屏幕轴对齐。 */
  const ROT_FAMILIES = {
    'canal_steps': { w: 'canal_steps_w', e: 'canal_steps_e' },
    'bridge_rail_stone': { n: 'bridge_stone_rail_n', s: 'bridge_stone_rail_s' },
    'bridge_rail_wood': { n: 'bridge_wood_rail_n', s: 'bridge_wood_rail_s' },
    'window_ns': { ns: 'shop_window_ns' },
    'door': { v: 'door', h: 'door_side' },
    'sdoor': { v: 'sdoor', h: 'sdoor_side' }
  };

  /* 资源 → 家族与当前朝向键。 */
  const ART_TO_FAMILY = {};
  for (const [family, variants] of Object.entries(ROT_FAMILIES)) {
    for (const [dir, art] of Object.entries(variants)) ART_TO_FAMILY[art] = { family, dir };
  }

  /* 道具基名 → 已有朝向变体。front 由基名本身承担。
   * tree_courtyard 是 32px 单格基名；实际绘制用的 96px 树冠另有一条（三向齐全）。 */
  const FACING_VARIANTS = {
    barrel: ['side', 'back'],
    bed_clinic: ['side', 'back'],
    bed_home: ['side', 'back'],
    bench_wood: ['side', 'back'],
    chair: ['side', 'back'],
    console_security: ['side', 'back'],
    counter_bank: ['side', 'back'],
    counter_shop: ['side', 'back'],
    desk: ['side', 'back'],
    display_clock: ['side', 'back'],
    shelf: ['side', 'back'],
    sofa_home: ['side', 'back'],
    stove_home: ['side', 'back'],
    tree_courtyard: ['side', 'back'],
    tree_courtyard_canopy: ['side', 'back']
  };

  /* 有 `_large` 放大版的基名：占地 >1 格时用它，贴图才铺得满两格。
   * 每个基名三向（正 / 侧 / 背）都齐，实测见 tools/test-map-art-map.js。 */
  const LARGE_BASES = new Set([
    'bed_clinic', 'bed_home', 'bench_wood', 'counter_bank', 'counter_shop',
    'desk', 'display_clock', 'shelf', 'sofa_home'
  ]);

  /* 容器类型字模 → 箱子贴图。与 js/data.js 的 CONTAINER_TYPES.art 同源（有测试锁）。
   * 小型保险箱用crate_heavy，大型保险箱用独立crate_safe_big。 */
  const CONTAINER_ART = {
    Z: 'crate_trash', W: 'crate_wastepaper', b: 'crate_cardboard', U: 'crate_workwear',
    C: 'crate_fast', T: 'crate_tool', N: 'crate_bedside', e: 'crate_staff', m: 'crate_satchel',
    L: 'crate_std', J: 'crate_luggage', F: 'crate_filing', D: 'crate_schoolbag',
    M: 'crate_med', R: 'crate_elec', H: 'crate_emergency', Q: 'crate_comms', Y: 'crate_rescuevest',
    B: 'crate_heavy', K: 'crate_supply', G: 'crate_jewelry', A: 'crate_leatherbag',
    V: 'crate_safe_big', I: 'crate_sealed', O: 'crate_diplomatic'
  };

  /* 明确缺图清单。2026-10-29 复查：家具三向（正 / 侧 / 背）已全部补齐，
   * 只剩这张空表留给以后真出现缺口时登记。 */
  const KNOWN_MISSING = {};

  const FACINGS = ['front', 'side', 'back'];

  /* 道具类型 → 贴图基名。与 tools/build-linhai-map.js 的编译结果必须一致（有测试锁）。 */
  const FURNITURE = {
    bed: 'bed_home', stove: 'stove_home', sofa: 'sofa_home', bench: 'bench_wood',
    display: 'display_clock', counter: 'counter_shop', tree: 'tree_courtyard_canopy'
  };
  /* 同名不同图的例外：这三个按 name 覆盖 type。 */
  const BY_NAME = { '诊疗床': 'bed_clinic', '银行柜台': 'counter_bank', '安保监控台': 'console_security' };

  function resolvePropArt(prop) {
    return BY_NAME[prop.name] || FURNITURE[prop.type] || prop.type;
  }

  /* 实体实际该用哪张图：基名 + 朝向 + 是否多格。
   * 与 js/game.js 的 Art.prop() 同一套规则——多格件优先 `_large`（把两格铺满），
   * 没有放大版才退回单格图；朝向变体缺图时退回基名。
   * 注意 resolvePropArt 只给基名（build 产物里的 prop.art 就是基名，游戏自己去加 _large），
   * 需要最终文件名时用这个函数。 */
  function propVariant(prop, facing) {
    const base = resolvePropArt(prop);
    const area = (prop.footprint || [1, 1]).reduce((a, b) => a * b, 1);
    const stem = (area > 1 && LARGE_BASES.has(base)) ? base + '_large' : base;
    return resolveFacing(stem, facing).art;
  }

  /* 屏幕朝向 = 实体朝向 + 视图旋转。
   * 视图每转 90°，家具在屏幕上就换个方向看：正 → 侧 → 背 → 侧。
   * 因为屏幕占格同样在 90°/270° 时宽高互换，选出来的变体与占格永远是对得上的。 */
  function screenFacing(facing, viewRot) {
    const steps = { front: 0, side: 90, back: 180 };
    const total = (((steps[facing] || 0) + (viewRot || 0)) % 360 + 360) % 360;
    return total === 0 ? 'front' : total === 180 ? 'back' : 'side';
  }

  /* 顺时针转 90° 之后的下一个朝向。
   * 多格件只有两种长相（正 / 侧）——矩形转 180° 与不转一模一样，硬切到背面只是白丢细节；
   * 单格件按 正 → 侧 → 背 → 正 循环。 */
  function nextFacing(facing, area) {
    const f = FACINGS.includes(facing) ? facing : 'front';
    if (area > 1) return f === 'side' ? 'front' : 'side';
    return f === 'front' ? 'side' : f === 'side' ? 'back' : 'front';
  }

  function containerArt(type) {
    return CONTAINER_ART[type] || null;
  }

  /* 叠加层：栏杆、驳岸、橱窗、破口、碎砾。顺序与编译期一致，保证快照可逐字节比对。 */
  function resolveOverlays(data) {
    const out = [];
    const add = (art, x, y, extra) => out.push(Object.assign({ art, x, y }, extra || {}));
    const rows = data.rows || [], W = data.width, H = data.height;
    const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && typeof rows[y] === 'string') ? rows[y][x] : null;

    /* 驳岸：临水一侧的码头格，水在右 → 西岸图，水在左 → 东岸图。 */
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x, y) !== 'k') continue;
      if (at(x + 1, y) === '~') add('canal_bank_w', x, y);
      if (at(x - 1, y) === '~') add('canal_bank_e', x, y);
    }
    /* 桥栏：桥面上沿贴 _n、下沿贴 _s；材质按桥面字符判断。 */
    for (const bridge of data.bridges || []) {
      const material = bridge.tile === '=' ? 'stone' : 'wood';
      for (const [side, y] of [['n', bridge.rect[1] - 1], ['s', bridge.rect[3] + 1]]) {
        for (let x = bridge.rect[0]; x <= bridge.rect[2]; x++) add('bridge_' + material + '_rail_' + side, x, y);
      }
    }
    /* 橱窗 */
    for (const w of data.windows || []) for (const [x, y] of w.cells || []) add('shop_window_ns', x, y);
    /* 破口：竖直方向上端贴 _n、下端贴 _s，破口格本身铺碎砾。 */
    for (const p of data.portals || []) {
      if (p.kind !== 'breach' || !p.cells || !p.cells.length) continue;
      const xs = p.cells.map(c => c[0]), ys = p.cells.map(c => c[1]);
      if (Math.min(...xs) === Math.max(...xs)) {
        const x = xs[0];
        add('wall_breach_n', x, Math.min(...ys) - 1, { replaceWall: true });
        add('wall_breach_s', x, Math.max(...ys) + 1, { replaceWall: true });
      }
      for (const [x, y] of p.cells) add('rubble_decal', x, y);
    }
    return out;
  }

  function familyOf(art) {
    return ART_TO_FAMILY[art] || null;
  }

  function facingsOf(base) {
    const extra = FACING_VARIANTS[base] || [];
    return FACINGS.filter(f => f === 'front' || extra.includes(f));
  }

  function missingFacings(base) {
    const have = facingsOf(base);
    return FACINGS.filter(f => !have.includes(f));
  }

  /* 取朝向变体。缺图时回退基名，并标记 exact:false，让界面能提示而不是静默降级。
   * 支持 `_large` 放大版：先剥掉后缀查家族，再拼回去。 */
  function resolveFacing(base, facing) {
    const want = FACINGS.includes(facing) ? facing : 'front';
    if (want === 'front') return { art: base, exact: true };
    const isLarge = /_large$/.test(base);
    const family = isLarge ? base.slice(0, -'_large'.length) : base;
    const have = isLarge ? (LARGE_BASES.has(family) ? FACINGS : []) : (FACING_VARIANTS[family] || []);
    if (have.includes(want)) return { art: base + '_' + want, exact: true };
    return { art: base, exact: false, missing: base + '_' + want };
  }

  /* 视图旋转时，方向性资源换到对应变体。
   * 只能处理已有变体的角度：台阶与桥栏只有东西 / 南北两向，转 90° 时没有对应图，
   * 返回 exact:false 并说明缺哪一向，交给编辑器提示（这是美术缺口，不是逻辑错误）。 */
  function rotateArt(art, rot) {
    const spin = ((rot % 360) + 360) % 360;
    const entry = ART_TO_FAMILY[art];
    if (!entry || spin === 0) return { art, exact: true };
    const variants = ROT_FAMILIES[entry.family];

    if (entry.family === 'window_ns') return { art, exact: true };

    if (entry.family === 'door' || entry.family === 'sdoor') {
      /* 门窗是沿墙走向的：转 90° 换轴，转 180° 不变。 */
      const flip = spin === 90 || spin === 270;
      const key2 = flip ? (entry.dir === 'v' ? 'h' : 'v') : entry.dir;
      return { art: variants[key2], exact: true };
    }

    const horizontal = entry.dir === 'w' || entry.dir === 'e';
    if (spin === 180) return { art: variants[horizontal ? (entry.dir === 'w' ? 'e' : 'w') : (entry.dir === 'n' ? 's' : 'n')], exact: true };
    /* 90/270：需要另一轴向的变体，当前没有。 */
    return { art, exact: false, missing: horizontal ? 'n/s 变体' : 'e/w 变体' };
  }

  function isDirectional(art) {
    return !!ART_TO_FAMILY[art];
  }

  return {
    TILE_ART, ROT_FAMILIES, FACING_VARIANTS, LARGE_BASES, CONTAINER_ART,
    KNOWN_MISSING, FACINGS, FURNITURE, BY_NAME,
    familyOf, facingsOf, missingFacings, resolveFacing, rotateArt, isDirectional,
    resolvePropArt, propVariant, screenFacing, nextFacing, containerArt, resolveOverlays
  };
});
