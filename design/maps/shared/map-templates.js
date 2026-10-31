/* 新图模板：尺寸预设 + 三种骨架 + 标准容器类型库。
 * 纯函数，不读文件、不碰 DOM；浏览器里给新建对话框用，node 里给 CLI 与测试用。
 * 模板只铺地形与结构骨架，**不生成容器、敌人、家具**——那些是设计决策，不该自动填。
 * 但容器"类型定义"要带上，否则新图的调色板里一个箱子都没有，等于不能放。 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./map-core.js') : root.MapCore,
    isNode ? require('./map-rules.js') : root.MapRules
  );
  if (isNode) module.exports = api;
  else root.MapTemplates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, Rules) {
  'use strict';

  const MIN_SIZE = 24;
  const MAX_SIZE = 128;
  const TILE_SIZE = 32;

  const SIZES = [
    { id: '48x36', width: 48, height: 36, label: '48 × 36', note: '单栋小图：诊所、公寓' },
    { id: '64x48', width: 64, height: 48, label: '64 × 48', note: '双岸街区：临海路缩小版' },
    { id: '72x56', width: 72, height: 56, label: '72 × 56', note: '与临海路同尺寸' }
  ];

  const TEMPLATES = [
    {
      id: 'blank', name: '空白',
      note: '四周一圈墙，内部全空；出生点在北，两个撤离点在南。',
      detail: '只放地形与出生 / 撤离点，适合从零画一张自定义图。'
    },
    {
      id: 'canal', name: '双岸运河',
      note: '中央 6 格运河、两座石桥、两岸街道与三处院落。',
      detail: '两岸靠两座桥连通，适合做"必须过桥"的搜刮路线。'
    },
    {
      id: 'building', name: '单栋建筑',
      note: '街道中央一栋房：2 格走廊、四间房、南门与东侧门。',
      detail: '自带建筑 / 房间 / 门洞骨架，适合先把室内动线画出来。'
    }
  ];

  /* 图例库：只输出真正用到的那几个字符，避免 G2 的"未被使用"提醒。 */
  const LEGEND_LIB = {
    '#': { name: '墙体 / 边界', walkable: false, opaque: true, color: '#354550' },
    '.': { name: '街坊空地', walkable: true, opaque: false, color: '#e9e6d9' },
    r: { name: '街道 / 巷道', walkable: true, opaque: false, color: '#c4ccd0' },
    q: { name: '庭院 / 前场', walkable: true, opaque: false, color: '#d8e1ce' },
    i: { name: '室内地板', walkable: true, opaque: false, color: '#f4ecd9' },
    '~': { name: '常态不可涉水的运河', walkable: false, opaque: false, color: '#438697' },
    '=': { name: '石桥', walkable: true, opaque: false, color: '#c9b58e' },
    '+': { name: '门洞（评审按打开状态）', walkable: true, opaque: false, color: '#d5a956' }
  };
  const LEGEND_ORDER = ['#', '.', 'r', 'q', 'i', '~', '=', '+'];

  /* 标准容器类型库。与 js/data.js 的 CONTAINER_TYPES 同源，字段只取 name / q
   * （cats 属于掉落逻辑，不进地图数据）。tools/test-map-templates.js 会逐条比对。 */
  const CONTAINER_TYPES = {
    Z: { name: '垃圾桶', q: 'junk' },
    W: { name: '废纸篓', q: 'junk' },
    b: { name: '遗弃纸箱', q: 'junk' },
    U: { name: '遗落的工作服', q: 'junk' },

    C: { name: '抽屉', q: 'plain' },
    T: { name: '工具箱', q: 'plain' },
    N: { name: '床头柜', q: 'plain' },
    e: { name: '员工储物盒', q: 'plain' },
    m: { name: '帆布挎包', q: 'plain' },

    L: { name: '储物柜', q: 'ample' },
    J: { name: '旅行箱', q: 'ample' },
    F: { name: '办公文件柜', q: 'ample' },
    D: { name: '运动包', q: 'ample' },

    M: { name: '医疗柜', q: 'fine' },
    R: { name: '电子设备柜', q: 'fine' },
    H: { name: '急救器材箱', q: 'fine' },
    Q: { name: '军用物资箱', q: 'fine' },
    Y: { name: '救援人员背心', q: 'fine' },

    B: { name: '小型保险箱', q: 'rich' },
    K: { name: '防水补给箱', q: 'rich' },
    G: { name: '珠宝匣', q: 'rich' },
    A: { name: '皮质旅行包', q: 'rich' },

    V: { name: '大型保险箱', q: 'secret' },
    I: { name: '机密封存箱', q: 'secret' },
    O: { name: '密封公文包', q: 'secret' }
  };

  /* 家具目录：新图没有实例，调色板无从推导类型，所以给一份最小可用清单。
   * 名字与占地取临海路的多数派；贴图由 map-art-map.js 的 FURNITURE 决定。 */
  const PROP_CATALOG = [
    { type: 'bed', name: '床', footprint: [1, 2] },
    { type: 'counter', name: '柜台', footprint: [2, 1] },
    { type: 'shelf', name: '货架', footprint: [2, 1] },
    { type: 'bench', name: '长凳', footprint: [2, 1] },
    { type: 'sofa', name: '沙发', footprint: [2, 1] },
    { type: 'desk', name: '桌子', footprint: [1, 1] },
    { type: 'chair', name: '椅子', footprint: [1, 1] },
    { type: 'stove', name: '灶台', footprint: [1, 1] },
    { type: 'barrel', name: '杂物桶', footprint: [1, 1] },
    { type: 'display', name: '展柜', footprint: [1, 2] },
    { type: 'tree', name: '院落树木', footprint: [3, 3] }
  ];

  const COORD_NOTE = '左上角 (0,0)，x 向东、y 向南；所有 rect 为包含端点的 [x1,y1,x2,y2]。';

  /* ---------- spec ---------- */

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  /* 校验并补全 spec。抛 Error 时 message 就是给人看的一句话，调用方直接显示。 */
  function normalizeSpec(raw) {
    const spec = Object.assign({}, raw || {});
    /* 不四舍五入：48.5 直接拒掉，静默取整会让"我填的 48 怎么变 49"没法解释。 */
    const w = Number(spec.width);
    const h = Number(spec.height);
    if (!Number.isInteger(w) || w < MIN_SIZE || w > MAX_SIZE) {
      throw new Error('宽度必须是 ' + MIN_SIZE + '–' + MAX_SIZE + ' 的整数，当前 ' + spec.width);
    }
    if (!Number.isInteger(h) || h < MIN_SIZE || h > MAX_SIZE) {
      throw new Error('高度必须是 ' + MIN_SIZE + '–' + MAX_SIZE + ' 的整数，当前 ' + spec.height);
    }
    const id = slugify(spec.id);
    if (!id || id.length < 2) throw new Error('地图编号只能用小写字母、数字和连字符，至少 2 个字符');
    const tpl = TEMPLATES.some(t => t.id === spec.template) ? spec.template : 'blank';
    return {
      id,
      title: String(spec.title || '').trim() || id,
      width: w, height: h, tileSize: TILE_SIZE,
      template: tpl
    };
  }

  /* ---------- 画布工具 ---------- */

  const blank = (W, H) => {
    const g = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) row.push((x === 0 || y === 0 || x === W - 1 || y === H - 1) ? '#' : '.');
      g.push(row);
    }
    return g;
  };
  const fill = (g, x1, y1, x2, y2, ch) => {
    for (let y = Math.max(0, y1); y <= Math.min(g.length - 1, y2); y++) {
      for (let x = Math.max(0, x1); x <= Math.min(g[0].length - 1, x2); x++) g[y][x] = ch;
    }
  };
  const center = (a, b) => Math.floor((a + b) / 2);

  function rectCells(rect) {
    const out = [];
    for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++) out.push([x, y]);
    return out;
  }

  /* ---------- 骨架 ---------- */

  function skeletonBlank(g, W, H) {
    const spawn = { id: 'spawn', name: '出生点', x: center(2, W - 3), y: 2 };
    const exits = [
      { id: 'A', name: '西南撤离点', x: Math.max(2, Math.round(W / 3)), y: H - 3, risk: '低' },
      { id: 'B', name: '东南撤离点', x: Math.min(W - 3, W - 1 - Math.round(W / 3)), y: H - 3, risk: '低' }
    ];
    return { spawn, exits, buildings: [], rooms: [], portals: [], bridges: [], roomFlows: {} };
  }

  function skeletonCanal(g, W, H) {
    const cw = 6;
    const cx1 = Math.floor((W - cw) / 2), cx2 = cx1 + cw - 1;
    fill(g, 1, 1, W - 2, H - 2, 'r');
    fill(g, cx1, 1, cx2, H - 2, '~');

    const yA = Math.max(3, Math.round(H * 0.18));
    const yB = Math.min(H - 5, Math.round(H * 0.72));
    const bridges = [];
    for (const [id, name, y0] of [['north', '北石桥', yA], ['south', '南石桥', yB]]) {
      fill(g, cx1, y0, cx2, y0 + 1, '=');
      bridges.push({
        id, name, rect: [cx1, y0, cx2, y0 + 1], width: 2, tile: '=',
        risk: '待定：暂不放固定堵桥敌人'
      });
    }

    /* 院落只铺地形，不塞家具；放不下就少放一个，小图不会硬挤。 */
    const size = 8;
    const courts = [];
    const tryCourt = (slot, side, y0) => {
      let x1 = side === 'west' ? 2 : W - 2 - size;
      if (side === 'west' && x1 + size - 1 > cx1 - 1) return;
      if (side === 'east' && x1 < cx2 + 1) x1 = cx2 + 1;
      if (x1 < 1 || x1 + size - 1 > W - 2) return;
      if (y0 < 2 || y0 + size - 1 > H - 3) return;
      fill(g, x1, y0, x1 + size - 1, y0 + size - 1, 'q');
      courts.push({ id: slot, name: slot === 'west-north' ? '西岸北院' : slot === 'west-south' ? '西岸南院' : '东岸北院', rect: [x1, y0, x1 + size - 1, y0 + size - 1] });
    };
    tryCourt('west-north', 'west', 3);
    tryCourt('west-south', 'west', H - 3 - size);
    tryCourt('east-north', 'east', 3);

    const spawn = { id: 'spawn', name: '西岸渡口', x: 2, y: 2 };
    const exits = [
      { id: 'A', name: '西岸撤离点', x: 3, y: H - 3, risk: '低' },
      { id: 'B', name: '东岸撤离点', x: W - 4, y: H - 3, risk: '中' }
    ];
    return { spawn, exits, buildings: [], rooms: [], portals: [], bridges, courts, canal: [cx1, cx2], roomFlows: {} };
  }

  function skeletonBuilding(g, W, H) {
    fill(g, 1, 1, W - 2, H - 2, 'r');
    const bw = Math.min(24, W - 10);
    const bh = Math.min(16, H - 10);
    const bx = Math.floor((W - bw) / 2), by = Math.floor((H - bh) / 2);
    const x2 = bx + bw - 1, y2 = by + bh - 1;

    fill(g, bx, by, x2, y2, '#');
    fill(g, bx + 1, by + 1, x2 - 1, y2 - 1, 'i');

    /* 走廊两格高，横贯全屋；上下各一道墙把房间隔开，左右再竖一道分四间。 */
    const cy = by + Math.floor(bh / 2) - 1;
    const mx = bx + Math.floor(bw / 2);
    fill(g, bx + 1, cy - 1, x2 - 1, cy - 1, '#');
    fill(g, bx + 1, cy + 2, x2 - 1, cy + 2, '#');
    fill(g, mx, by + 1, mx, cy - 2, '#');
    fill(g, mx, cy + 3, mx, y2 - 1, '#');

    const dNW = center(bx + 1, mx - 1), dNE = center(mx + 1, x2 - 1);
    const doors = [
      { id: 'bld.d-nw', name: '西北房内门', x: dNW, y: cy - 1, connects: ['bld.room-nw', 'bld.hall'] },
      { id: 'bld.d-ne', name: '东北房内门', x: dNE, y: cy - 1, connects: ['bld.room-ne', 'bld.hall'] },
      { id: 'bld.d-sw', name: '西南房内门', x: dNW, y: cy + 2, connects: ['bld.room-sw', 'bld.hall'] },
      { id: 'bld.d-se', name: '东南房内门', x: dNE, y: cy + 2, connects: ['bld.room-se', 'bld.hall'] },
      { id: 'bld.front', name: '南门', x: bx + 3, y: y2, connects: ['outdoors', 'bld.room-sw'] },
      { id: 'bld.side', name: '东侧门', x: x2, y: cy, connects: ['outdoors', 'bld.hall'] }
    ];
    for (const d of doors) g[d.y][d.x] = '+';

    const rooms = [
      { id: 'bld.room-nw', name: '西北房', rect: [bx + 1, by + 1, mx - 1, cy - 2] },
      { id: 'bld.room-ne', name: '东北房', rect: [mx + 1, by + 1, x2 - 1, cy - 2] },
      { id: 'bld.hall', name: '走廊', rect: [bx + 1, cy, x2 - 1, cy + 1] },
      { id: 'bld.room-sw', name: '西南房', rect: [bx + 1, cy + 3, mx - 1, y2 - 1] },
      { id: 'bld.room-se', name: '东南房', rect: [mx + 1, cy + 3, x2 - 1, y2 - 1] }
    ].map(r => Object.assign(r, {
      building: 'bld',
      anchor: [center(r.rect[0], r.rect[2]), center(r.rect[1], r.rect[3])],
      role: r.name
    }));

    const building = {
      id: 'bld', name: '主楼', rect: [bx, by, x2, y2], notches: [],
      shape: '矩形单栋：两格走廊 + 四间房',
      footprint: rectCells([bx, by, x2, y2])
    };

    const portals = doors.map(d => ({
      id: d.id, building: 'bld', name: d.name, cells: [[d.x, d.y]],
      connects: d.connects, kind: 'door', width: 1
    }));

    return {
      spawn: { id: 'spawn', name: '楼前街口', x: center(bx, x2), y: Math.min(H - 3, y2 + 3) },
      exits: [
        { id: 'A', name: '西街撤离点', x: 3, y: H - 3, risk: '低' },
        { id: 'B', name: '东街撤离点', x: W - 4, y: H - 3, risk: '低' }
      ],
      buildings: [building], rooms, portals, bridges: [], roomFlows: {
        bld: '南门进西南房 → 内门 → 走廊；走廊东西贯通，东侧门直出街道；三间房各自开门通走廊，互不串门。'
      },
      buildingRect: [bx, by, x2, y2]
    };
  }

  /* ---------- 组装 ---------- */

  function usedLegend(g) {
    const used = new Set();
    for (const row of g) for (const ch of row) used.add(ch);
    const out = {};
    for (const ch of LEGEND_ORDER) if (used.has(ch)) out[ch] = Object.assign({}, LEGEND_LIB[ch]);
    return out;
  }

  function rulesSkeleton(spec) {
    const rules = Rules.normalize({ id: spec.id });
    /* expect 全留 null：新图只跑 G1–G12，等设计定稿再填预期值。 */
    return rules;
  }

  /* 主入口：spec → { data, rules, notes } */
  function create(rawSpec) {
    const spec = normalizeSpec(rawSpec);
    const W = spec.width, H = spec.height;
    const g = blank(W, H);

    let skel;
    const notes = [];
    if (spec.template === 'canal') {
      skel = skeletonCanal(g, W, H);
      notes.push('运河占 x ' + skel.canal[0] + '–' + skel.canal[1] + '，共 6 列；两座桥各 2 格宽。');
      notes.push('院落 ' + (skel.courts.length ? skel.courts.map(c => c.name).join(' / ') : '未放置（地图太小）') + '。');
    } else if (spec.template === 'building') {
      skel = skeletonBuilding(g, W, H);
      const r = skel.buildingRect;
      notes.push('主楼范围 [' + r.join(', ') + ']，外墙 ' + (r[2] - r[0] + 1) + '×' + (r[3] - r[1] + 1) + ' 格。');
      notes.push('六个门洞：南门 / 东侧门 / 四道内门，已写进 portals 并指明 connects。');
    } else {
      skel = skeletonBlank(g, W, H);
      notes.push('内部全空，只有外墙与出生 / 撤离点。');
    }

    const data = {
      schemaVersion: Core.SCHEMA_VERSION,
      id: spec.id,
      title: spec.title,
      status: 'draft',
      width: W,
      height: H,
      tileSize: spec.tileSize,
      coordinateConvention: COORD_NOTE,
      reference: '',
      legend: usedLegend(g),
      rows: g.map(r => r.join('')),
      buildings: skel.buildings,
      rooms: skel.rooms,
      roomFlows: skel.roomFlows,
      portals: skel.portals,
      windows: [],
      clearances: [],
      props: [],
      containers: [],
      containerTypes: JSON.parse(JSON.stringify(CONTAINER_TYPES)),
      enemies: [],
      spawn: skel.spawn,
      exits: skel.exits,
      bridges: skel.bridges,
      bridgeHeadReserve: null,
      plazas: (skel.courts || []).map(c => ({ id: c.id, name: c.name, rect: c.rect })),
      tide: {
        implemented: false,
        permanentWater: '~',
        note: spec.template === 'canal' ? '水面常态不可涉水；本稿按正常可通行地形检查。' : '',
        zones: []
      },
      quotas: { containers: null, enemies: null, regions: {} },
      routeSpecs: []
    };

    return { data, rules: rulesSkeleton(spec), notes, spec };
  }

  return {
    MIN_SIZE, MAX_SIZE, TILE_SIZE, SIZES, TEMPLATES,
    LEGEND_LIB, CONTAINER_TYPES, PROP_CATALOG, COORD_NOTE,
    slugify, normalizeSpec, create, rulesSkeleton
  };
});
