/* 地图语义校验：纯函数，不抛异常、不读文件、不改数据。
 * 通用规则 G1–G12 对任意尺寸成立；本图规则 M1–M6 由 rules.json 的 specialChecks 开关。
 * 浏览器与 node 共用；node 侧用 assertValid() 把 error 折成异常，保持既有调用方式。 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./map-core.js') : root.MapCore,
    isNode ? require('./map-rules.js') : root.MapRules
  );
  if (isNode) module.exports = api;
  else root.MapValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, Rules) {
  'use strict';

  /* 规则清单。scope=general 任何地图都跑；scope=map 需要 rules.json 开启。 */
  const RULES = [
    { code: 'G1', name: '尺寸、行宽与边界', scope: 'general' },
    { code: 'G2', name: '图例字段完整', scope: 'general' },
    { code: 'G3', name: '实体占格、重叠与地形冲突', scope: 'general' },
    { code: 'G4', name: '实体分区归属', scope: 'general' },
    { code: 'G5', name: '空地、房间、门洞与撤离点连通', scope: 'general' },
    { code: 'G6', name: '容器具备可交互面', scope: 'general' },
    { code: 'G7', name: '敌人间距与出生 / 撤离缓冲', scope: 'general' },
    { code: 'G8', name: '门洞结构合法', scope: 'general' },
    { code: 'G9', name: '出生点与撤离点合法', scope: 'general' },
    { code: 'G10', name: '推荐路线可寻路', scope: 'general' },
    { code: 'G11', name: '配额与计数一致', scope: 'general' },
    { code: 'G12', name: '实体编号唯一且非空', scope: 'general' },
    { code: 'M1', name: '建筑出入口与橱窗', scope: 'map' },
    { code: 'M2', name: '净宽标注与占用', scope: 'map' },
    { code: 'M3', name: '桥为唯一跨河通路', scope: 'map' },
    { code: 'M4', name: '银行安保链', scope: 'map' },
    { code: 'M5', name: '潮汐预留不影响撤离', scope: 'map' },
    { code: 'M6', name: '室内绕行与封闭房间', scope: 'map' }
  ];
  const RULE_NAME = Object.fromEntries(RULES.map(r => [r.code, r.name]));
  const LABEL = {
    width: '宽度', height: '高度', tileSize: '格子尺寸', buildings: '建筑数', rooms: '房间数',
    portals: '门洞数', windows: '窗数', props: '家具数', containers: '容器数', enemies: '敌人数',
    containerTypes: '容器类型数', containerTypesUsed: '实际用到的容器类型数',
    exits: '撤离点数', bridges: '桥数', routes: '推荐路线数'
  };
  const MAX_DETAIL = 8;      // 同一规则逐条列出的上限
  const DOOR_CHARS = ['+', '/', '=', '-', 's'];

  function validateMap(rawData, rawRules) {
    const data = Core.coerce(rawData);
    const rules = Rules.normalize(rawRules);
    const issues = [];
    const counters = new Map();

    function push(level, rule, message, extra) {
      const bucket = rule + ':' + level;
      const seen = counters.get(bucket) || 0;
      counters.set(bucket, seen + 1);
      if (seen < MAX_DETAIL) issues.push(Object.assign({ level, rule, message }, extra || {}));
    }
    const err = (rule, msg, extra) => push('error', rule, msg, extra);
    const warn = (rule, msg, extra) => push('warn', rule, msg, extra);

    const W = data.width, H = data.height;
    const legend = data.legend, rows = data.rows;
    const key = Core.key;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const terrain = (x, y) => Core.terrainAt(data, x, y);
    const walkable = (x, y) => Core.isWalkableTerrain(data, x, y);

    /* occupied 由家具与容器占格构成；敌人不占格，但必须站在可通行地形上。 */
    const occupied = new Map();
    const walk = (x, y, blocked) => walkable(x, y) && !occupied.has(key(x, y)) && !(blocked && blocked.has(key(x, y)));

    function search(start, blocked) {
      if (!walk(start[0], start[1], blocked)) return null;
      const parents = new Map([[key(start[0], start[1]), null]]);
      const queue = [start];
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i];
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (walk(nx, ny, blocked) && !parents.has(k)) { parents.set(k, key(x, y)); queue.push([nx, ny]); }
        }
      }
      return parents;
    }
    function findPath(start, goal, blocked) {
      const visited = search(start, blocked);
      if (!visited) return null;
      const end = key(goal[0], goal[1]);
      if (!visited.has(end)) return null;
      const out = [];
      let cursor = end;
      while (cursor) { out.push(Core.parseKey(cursor)); cursor = visited.get(cursor); }
      return out.reverse();
    }

    /* ---------- G1 尺寸、行宽与边界 ---------- */
    if (!Number.isInteger(W) || W < 8 || W > 128) err('G1', `地图宽度必须是 8–128 的整数，当前 ${W}`);
    if (!Number.isInteger(H) || H < 8 || H > 128) err('G1', `地图高度必须是 8–128 的整数，当前 ${H}`);
    if (rows.length !== H) err('G1', `rows 有 ${rows.length} 行，与 height ${H} 不符`);
    const unknownChars = new Set();
    const usedChars = new Set();
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      if (typeof row !== 'string') { err('G1', `第 ${y} 行不是字符串`); continue; }
      if (row.length !== W) err('G1', `第 ${y} 行有 ${row.length} 个字符，应为 ${W}`);
      for (const ch of row) { usedChars.add(ch); if (!legend[ch]) unknownChars.add(ch); }
    }
    if (unknownChars.size) err('G1', `图例缺少字符：${[...unknownChars].join(' ')}`);
    for (let x = 0; x < W; x++) {
      if (walkable(x, 0)) err('G1', `上边界 (${x},0) 可通行`, { cells: [[x, 0]] });
      if (walkable(x, H - 1)) err('G1', `下边界 (${x},${H - 1}) 可通行`, { cells: [[x, H - 1]] });
    }
    for (let y = 0; y < H; y++) {
      if (walkable(0, y)) err('G1', `左边界 (0,${y}) 可通行`, { cells: [[0, y]] });
      if (walkable(W - 1, y)) err('G1', `右边界 (${W - 1},${y}) 可通行`, { cells: [[W - 1, y]] });
    }

    /* ---------- G2 图例字段完整 ---------- */
    for (const [ch, rule] of Object.entries(legend)) {
      if (!rule || typeof rule.name !== 'string' || !rule.name) err('G2', `图例 ${ch} 缺少名称`);
      if (!rule || typeof rule.walkable !== 'boolean') err('G2', `图例 ${ch} 缺少 walkable 布尔值`);
      if (!rule || typeof rule.opaque !== 'boolean') err('G2', `图例 ${ch} 缺少 opaque 布尔值`);
      if (!rule || typeof rule.color !== 'string' || !rule.color) err('G2', `图例 ${ch} 缺少颜色`);
      if (!usedChars.has(ch)) warn('G2', `图例 ${ch}（${rule && rule.name}）没有被任何格子使用`);
    }

    /* ---------- G3 实体占格、重叠与地形冲突 ---------- */
    const entities = [...data.props, ...data.containers];
    for (const e of entities) {
      const size = e.footprint === undefined ? [1, 1] : e.footprint;
      if (!Array.isArray(size) || size.length !== 2 || !size.every(n => Number.isInteger(n) && n > 0)) {
        err('G3', `占地尺寸非法 ${e.id}`); continue;
      }
      if (!Number.isInteger(e.x) || !Number.isInteger(e.y)) { err('G3', `坐标非法 ${e.id}`); continue; }
      if (e.x < 0 || e.y < 0 || e.x + size[0] > W || e.y + size[1] > H) { err('G3', `视觉范围越界 ${e.id}`); continue; }
      const mask = e.collisionCells || Array.from({ length: size[0] * size[1] }, (_, i) => [i % size[0], Math.floor(i / size[0])]);
      if (!Array.isArray(mask) || new Set(mask.map(c => c.join(','))).size !== mask.length) {
        err('G3', `碰撞格非法或重复 ${e.id}`); continue;
      }
      for (const [dx, dy] of mask) {
        if (!Number.isInteger(dx) || !Number.isInteger(dy) || dx < 0 || dy < 0 || dx >= size[0] || dy >= size[1]) {
          err('G3', `碰撞格越界 ${e.id}`); continue;
        }
        const x = e.x + dx, y = e.y + dy, k = key(x, y);
        if (!walkable(x, y)) err('G3', `实体落在不可通行地形 ${e.id} @ ${k}`, { cells: [[x, y]], entityId: e.id });
        else if (occupied.has(k)) err('G3', `实体重叠 ${k}：${occupied.get(k)} 与 ${e.id}`, { cells: [[x, y]], entityId: e.id });
        else if (DOOR_CHARS.includes(terrain(x, y))) err('G3', `实体堵住门洞 / 桥 / 阶梯 ${e.id} @ ${k}`, { cells: [[x, y]], entityId: e.id });
        else occupied.set(k, e.id);
      }
    }

    /* ---------- G4 实体分区归属 ---------- */
    /* 降为提醒：分区决定掉落表的归属，标错不会让游戏跑不起来，
     * 手工摆位时"先放东西再划区"是常态，不该拦着保存。 */
    const footIndex = new Map();
    for (const b of data.buildings) for (const [x, y] of b.footprint || []) footIndex.set(key(x, y), b.id);
    const regionIds = Object.keys(data.quotas.regions || {});
    for (const e of [...data.containers, ...data.enemies, ...data.props]) {
      if (!Number.isInteger(e.x) || !Number.isInteger(e.y)) continue;
      const expected = footIndex.get(key(e.x, e.y)) || 'outdoors';
      if (e.region !== expected) {
        warn('G4', `分区标注错误 ${e.id}：应为 ${expected}，当前 ${e.region || '(空)'}`, { cells: [[e.x, e.y]], entityId: e.id });
      } else if (regionIds.length && !regionIds.includes(e.region)) {
        warn('G4', `分区 ${e.region} 未在 quotas.regions 登记：${e.id}`, { entityId: e.id });
      }
    }

    /* ---------- G5 连通性 ---------- */
    const spawn = [data.spawn.x, data.spawn.y];
    let reached = new Map();
    if (!walkable(spawn[0], spawn[1])) err('G5', `出生点不可通行 (${spawn[0]},${spawn[1]})`, { cells: [spawn] });
    else reached = search(spawn) || new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (walkable(x, y) && !occupied.has(key(x, y)) && !reached.has(key(x, y))) {
        /* 孤立空格降为提醒：手工画图时"先铺地板后开门"是常态，
         * 玩家进不去只是浪费空间，不会坏档。 */
        warn('G5', `孤立可行格 ${key(x, y)}`, { cells: [[x, y]] });
      }
    }
    for (const ex of data.exits) {
      if (!reached.has(key(ex.x, ex.y))) err('G5', `撤离点不可达 ${ex.id}`, { cells: [[ex.x, ex.y]] });
    }
    for (const r of data.rooms) {
      const a = r.anchor || [];
      if (!walkable(a[0], a[1])) warn('G5', `房间标注点非法 ${r.id}`);
      else if (!reached.has(key(a[0], a[1]))) warn('G5', `房间标注点不可达 ${r.id}`, { cells: [[a[0], a[1]]] });
    }
    for (const p of data.portals) for (const c of p.cells || []) {
      if (!reached.has(key(c[0], c[1]))) warn('G5', `入口不可达 ${p.id} @ ${c.join(',')}`, { cells: [c] });
    }
    /* 敌人这一条必须是错误：巡逻是"在自己周围随机选点 + 寻路过去"，
     * 出生格到不了主区域，NPC 就只能在原地打转，属于会坏体验的硬伤。 */
    for (const e of data.enemies) {
      if (walkable(e.x, e.y) && !reached.has(key(e.x, e.y))) {
        err('G5', `敌人巡逻不到外面 ${e.id} @ ${key(e.x, e.y)}`, { cells: [[e.x, e.y]], entityId: e.id });
      }
    }

    /* ---------- G6 容器可交互面 ---------- */
    /* 降为提醒：箱子被围死只是"这个格子搜不到"，不会坏档；玩家可能故意做个封死的装饰柜。 */
    for (const box of data.containers) {
      if (!dirs.some(([dx, dy]) => reached.has(key(box.x + dx, box.y + dy)))) {
        warn('G6', `箱柜无法操作 ${box.id}`, { cells: [[box.x, box.y]], entityId: box.id });
      }
    }

    /* ---------- G7 敌人布防 ---------- */
    const space = rules.enemySpacing;
    const reserve = data.bridgeHeadReserve;
    for (let i = 0; i < data.enemies.length; i++) {
      const e = data.enemies[i];
      if (!walkable(e.x, e.y)) err('G7', `敌人出生格非法 ${e.id}`, { cells: [[e.x, e.y]], entityId: e.id });
      if (Math.hypot(e.x - spawn[0], e.y - spawn[1]) < space.fromSpawn) {
        err('G7', `出生点附近有敌人 ${e.id}`, { cells: [[e.x, e.y]], entityId: e.id });
      }
      for (const ex of data.exits) {
        if (Math.hypot(e.x - ex.x, e.y - ex.y) <= space.fromExit) {
          err('G7', `撤离点附近有固定敌人 ${e.id}（${ex.id}）`, { cells: [[e.x, e.y]], entityId: e.id });
        }
      }
      for (let j = i + 1; j < data.enemies.length; j++) {
        const o = data.enemies[j];
        if (Math.hypot(e.x - o.x, e.y - o.y) < space.between) err('G7', `敌人过密 ${e.id} / ${o.id}`);
      }
      if (reserve && reserve.rect) {
        const [x1, y1, x2, y2] = reserve.rect;
        if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) err('G7', `堵桥点有固定敌人 ${e.id}`, { cells: [[e.x, e.y]], entityId: e.id });
      }
      if (['=', '-'].includes(terrain(e.x, e.y))) err('G7', `固定敌人位于桥面 ${e.id}`, { cells: [[e.x, e.y]], entityId: e.id });
    }

    /* ---------- G8 门洞结构 ---------- */
    for (const p of data.portals) {
      if (!p.id) err('G8', '门洞缺少 id');
      if (!['door', 'breach', 'gate', 'window'].includes(p.kind)) err('G8', `门洞类型未知 ${p.id || '?'}：${p.kind}`);
      if (!Array.isArray(p.cells) || !p.cells.length) err('G8', `门洞缺少格坐标 ${p.id}`);
      else {
        if (p.width !== p.cells.length) err('G8', `门洞宽度 ${p.width} 与格数 ${p.cells.length} 不符 ${p.id}`);
        if (p.cells.length > rules.portal.maxWidth) err('G8', `门洞过宽 ${p.id}（${p.cells.length} 格）`);
        for (const c of p.cells) if (!walkable(c[0], c[1])) err('G8', `门洞格不可通行 ${p.id} @ ${c.join(',')}`, { cells: [c] });
      }
      if (!Array.isArray(p.connects) || p.connects.length < 2) err('G8', `门洞必须连接两个空间 ${p.id}`);
      if (p.building && !data.buildings.some(b => b.id === p.building)) err('G8', `门洞指向不存在的建筑 ${p.id} → ${p.building}`);
    }

    /* ---------- G9 出生点与撤离点 ---------- */
    if (!Number.isInteger(data.spawn.x) || !Number.isInteger(data.spawn.y)) err('G9', '出生点坐标非法');
    const exitIds = new Set();
    if (!data.exits.length) err('G9', '至少需要一个撤离点');
    for (const ex of data.exits) {
      if (!ex.id) err('G9', '撤离点缺少 id');
      else if (exitIds.has(ex.id)) err('G9', `撤离点编号重复 ${ex.id}`);
      else exitIds.add(ex.id);
      if (!Number.isInteger(ex.x) || !Number.isInteger(ex.y)) { err('G9', `撤离点坐标非法 ${ex.id}`); continue; }
      if (!walkable(ex.x, ex.y)) err('G9', `撤离点不可通行 ${ex.id}`, { cells: [[ex.x, ex.y]], entityId: ex.id });
      if (ex.x === spawn[0] && ex.y === spawn[1]) err('G9', `撤离点与出生点重合 ${ex.id}`);
    }

    /* ---------- G10 推荐路线 ---------- */
    for (const spec of data.routeSpecs) {
      const name = spec.name || spec.id;
      if (!Array.isArray(spec.waypoints) || spec.waypoints.length < 2) { err('G10', `推荐路线航点不足 ${name}`); continue; }
      for (const w of spec.waypoints) {
        if (!walkable(w[0], w[1])) err('G10', `推荐路线航点不可通行 ${name} @ ${w.join(',')}`, { cells: [w] });
      }
    }

    /* ---------- G11 配额与计数 ---------- */
    /* 配额全部降为提醒。这些数字原本是给 AI 生成地图设的锚点，
     * 手工设计时"先摆东西、最后再定配额"才是常态，数字对不上不该拦着构建。
     * 唯一保留为错误的是"容器类型未定义"——那会让游戏查不到掉落表。 */
    const actual = {
      width: W, height: H, tileSize: data.tileSize,
      buildings: data.buildings.length, rooms: data.rooms.length, portals: data.portals.length,
      windows: data.windows.length, props: data.props.length, containers: data.containers.length,
      enemies: data.enemies.length, containerTypes: Object.keys(data.containerTypes).length,
      containerTypesUsed: new Set(data.containers.map(c => c.type)).size,
      exits: data.exits.length, bridges: data.bridges.length, routes: data.routeSpecs.length
    };
    for (const field of Rules.expectations(rules)) {
      if (rules.expect[field] !== actual[field]) {
        warn('G11', `配额不符：${LABEL[field] || field} 应为 ${rules.expect[field]}，当前 ${actual[field]}`);
      }
    }
    if (data.quotas.containers != null && data.quotas.containers !== data.containers.length) {
      warn('G11', `容器数量 ${data.containers.length} 与配额 ${data.quotas.containers} 不符`);
    }
    if (data.quotas.enemies != null && data.quotas.enemies !== data.enemies.length) {
      warn('G11', `敌人数量 ${data.enemies.length} 与配额 ${data.quotas.enemies} 不符`);
    }
    for (const [region, pair] of Object.entries(data.quotas.regions || {})) {
      if (!Array.isArray(pair) || pair.length !== 2) { warn('G11', `分区配额格式错误 ${region}`); continue; }
      const boxes = data.containers.filter(c => c.region === region).length;
      const mobs = data.enemies.filter(e => e.region === region).length;
      if (boxes !== pair[0]) warn('G11', `${region} 容器配额 ${pair[0]}，实际 ${boxes}`);
      if (mobs !== pair[1]) warn('G11', `${region} 敌人配额 ${pair[1]}，实际 ${mobs}`);
    }
    for (const c of data.containers) {
      if (c.type && !data.containerTypes[c.type]) err('G11', `容器类型未定义 ${c.id} → ${c.type}`);
    }

    /* ---------- G12 实体编号唯一且非空 ---------- */
    for (const [kind, list] of [['建筑', data.buildings], ['房间', data.rooms], ['门洞', data.portals],
      ['家具', data.props], ['容器', data.containers], ['敌人', data.enemies]]) {
      const seen = new Map();
      for (const e of list) {
        if (!e.id) { err('G12', `${kind}缺少 id`); continue; }
        if (seen.has(e.id)) err('G12', `${kind}编号重复 ${e.id}（与 ${seen.get(e.id)}）`);
        else seen.set(e.id, kind);
      }
    }

    /* ---------- M1 建筑出入口与橱窗 ---------- */
    if (Rules.enabled(rules, 'buildingEntrances')) {
      const minEntrances = rules.special.minExitsPerBuilding || 2;
      for (const b of data.buildings) {
        const outs = data.portals.filter(p => p.building === b.id && (p.connects || []).includes('outside'));
        if (outs.length < minEntrances) err('M1', `${b.name || b.id} 只有 ${outs.length} 处室外入口，需要 ${minEntrances} 处`);
      }
      for (const p of data.portals.filter(p => p.kind === 'breach')) {
        if ((p.width || (p.cells || []).length) < 2) err('M1', `破口宽度不足 ${p.id}`);
      }
      /* 橱窗与破口一并归到这里：它们和出入口属于同一类"建筑形态"约束，
       * 手工设计时不希望被拦，就该能整组关掉，而不是留半个开关。 */
      for (const w of data.windows) {
        for (const [x, y] of w.cells || []) {
          if (walkable(x, y)) err('M1', `橱窗必须不可通行 ${w.id} @ ${x},${y}`, { cells: [[x, y]], entityId: w.id });
          const ch = terrain(x, y);
          if (ch && legend[ch] && legend[ch].opaque === true) err('M1', `橱窗必须可透视 ${w.id} @ ${x},${y}`, { cells: [[x, y]] });
        }
      }
    }
    if (rules.expect.windowsMin != null && data.windows.length < rules.expect.windowsMin) {
      err('M1', `橱窗数量 ${data.windows.length}，至少需要 ${rules.expect.windowsMin}`);
    }

    /* ---------- M2 净宽标注与占用 ---------- */
    if (Rules.enabled(rules, 'clearanceWidth')) {
      for (const c of data.clearances) {
        const [x1, y1, x2, y2] = c.rect;
        const shortSide = Math.min(x2 - x1 + 1, y2 - y1 + 1);
        if (shortSide < c.width) err('M2', `${c.id} 标注宽度 ${c.width} 超过实际 ${shortSide}`);
        for (const [x, y] of Core.cellsOfRect(c.rect)) {
          if (!walk(x, y)) err('M2', `净宽被占用 ${c.id} @ ${key(x, y)}`, { cells: [[x, y]] });
        }
      }
    }

    /* ---------- M3 桥为唯一跨河通路 ---------- */
    if (Rules.enabled(rules, 'bridgeOnlyCrossing')) {
      const last = data.exits[data.exits.length - 1];
      const goal = last ? [last.x, last.y] : spawn;
      for (const bridge of data.bridges) {
        const blocked = new Set(Core.cellsOfRect(bridge.rect).map(p => key(p[0], p[1])));
        if (!findPath(spawn, goal, blocked)) err('M3', `移除 ${bridge.name || bridge.id} 后不能过河`);
      }
      const both = new Set(data.bridges.flatMap(b => Core.cellsOfRect(b.rect)).map(p => key(p[0], p[1])));
      if (findPath(spawn, goal, both)) err('M3', '封闭双桥后仍能绕河');
      if (rules.canal.x) {
        const [cx1, cx2] = rules.canal.x;
        for (let y = 0; y < H; y++) for (let x = cx1; x <= cx2; x++) {
          const onBridge = data.bridges.some(b => x >= b.rect[0] && x <= b.rect[2] && y >= b.rect[1] && y <= b.rect[3]);
          if (!onBridge && walk(x, y)) err('M3', `运河可以涉水 ${key(x, y)}`, { cells: [[x, y]] });
        }
      }
    }

    /* ---------- M4 银行安保链 ---------- */
    const bank = rules.special.bank;
    if (Rules.enabled(rules, 'bankSecurityChain') && bank) {
      const bankId = bank.building || 'bank';
      const vaultRoom = data.rooms.find(r => r.id === bank.vault);
      if (!vaultRoom) err('M4', `找不到金库房间 ${bank.vault}`);
      else {
        const vault = vaultRoom.anchor;
        for (const id of bank.guardDoors || []) {
          const p = data.portals.find(x => x.id === id);
          if (!p) { err('M4', `找不到安保门 ${id}`); continue; }
          if (findPath(spawn, vault, new Set(p.cells.map(c => key(c[0], c[1]))))) err('M4', `绕过了 ${p.name || p.id}`);
        }
        for (const p of data.portals.filter(x => x.building === bankId && (x.connects || []).includes('outside'))) {
          if ((p.connects || []).includes(bank.vault)) err('M4', `金库直接连接室外 ${p.id}`);
        }
        const front = data.portals.find(p => p.id === bank.front);
        const rear = data.portals.find(p => p.id === bank.rear);
        const footprint = new Set(((data.buildings.find(b => b.id === bankId) || {}).footprint || []).map(c => key(c[0], c[1])));
        if (front && rear && footprint.size) {
          const blocked = new Set();
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!footprint.has(key(x, y))) blocked.add(key(x, y));
          for (const id of bank.guardDoors || []) {
            const d = data.portals.find(x => x.id === id);
            for (const c of (d ? d.cells : [])) blocked.add(key(c[0], c[1]));
          }
          if (!findPath(front.cells[0], rear.cells[0], blocked)) err('M4', '银行前后门不能通过办公后勤环路连接');
        }
      }
    }

    /* ---------- M5 潮汐预留不影响撤离 ---------- */
    if (Rules.enabled(rules, 'tideReserve')) {
      if (data.tide.implemented !== false) err('M5', '潮汐必须保持未实现状态（tide.implemented 应为 false）');
      const blocked = new Set(data.tide.zones.flatMap(z => Core.cellsOfRect(z.rect)).map(p => key(p[0], p[1])));
      for (const ex of data.exits) {
        if (!findPath(spawn, [ex.x, ex.y], blocked)) err('M5', `预留区封路会切断撤离 ${ex.id}`);
      }
      const southId = rules.special.tide && rules.special.tide.southBridge;
      const south = southId ? data.bridges.find(b => b.id === southId) : null;
      if (south) {
        for (const c of Core.cellsOfRect(south.rect)) blocked.add(key(c[0], c[1]));
        for (const ex of data.exits) {
          if (!findPath(spawn, [ex.x, ex.y], blocked)) err('M5', `南桥失效后无稳定撤离路线 ${ex.id}`);
        }
      }
    }

    /* ---------- M6 室内绕行与封闭房间 ---------- */
    const routing = rules.special.routing;
    if (Rules.enabled(rules, 'indoorRouting') && routing) {
      for (const [portalId, fromId, toId] of routing.pairs || []) {
        const portal = data.portals.find(p => p.id === portalId);
        if (!portal) { err('M6', `找不到绕行检查用的门 ${portalId}`); continue; }
        const b = data.buildings.find(x => x.id === portal.building);
        if (!b) { err('M6', `门 ${portalId} 不属于任何建筑`); continue; }
        const from = data.rooms.find(r => r.id === fromId);
        const to = data.rooms.find(r => r.id === toId);
        if (!from || !to) { err('M6', `绕行检查引用了不存在的房间：${portalId}`); continue; }
        const inside = new Set((b.footprint || []).map(c => key(c[0], c[1])));
        const blocked = new Set(portal.cells.map(c => key(c[0], c[1])));
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inside.has(key(x, y))) blocked.add(key(x, y));
        if (!findPath(from.anchor, to.anchor, blocked)) err('M6', `内部缺少绕行 ${portalId}`);
      }
      const sealed = routing.sealed;
      if (sealed) {
        const room = data.rooms.find(r => r.id === sealed.room);
        const door = data.portals.find(p => p.id === sealed.door);
        if (!room || !door) err('M6', `封闭检查引用了不存在的房间或门：${sealed.room} / ${sealed.door}`);
        else if (findPath(spawn, room.anchor, new Set(door.cells.map(c => key(c[0], c[1]))))) {
          err('M6', `破口或其他路径绕过 ${door.name || door.id}`);
        }
      }
    }

    /* ---------- 推荐路线（现场计算，不入库） ---------- */
    const routes = data.routeSpecs.map(spec => {
      const points = [];
      for (let i = 1; i < (spec.waypoints || []).length; i++) {
        const segment = findPath(spec.waypoints[i - 1], spec.waypoints[i]);
        if (!segment) {
          err('G10', `推荐路线不连通 ${spec.name || spec.id} → ${spec.waypoints[i].join(',')}`);
          return Object.assign({}, spec, { points, steps: 0, connected: false });
        }
        points.push(...segment.slice(i === 1 ? 0 : 1));
      }
      return Object.assign({}, spec, { points, steps: points.length - 1, connected: true });
    });

    /* 超限的同类问题补一条汇总，避免静默丢信息。 */
    for (const [bucket, total] of counters) {
      if (total <= MAX_DETAIL) continue;
      const [rule, level] = bucket.split(':');
      issues.push({ level, rule, message: `另有 ${total - MAX_DETAIL} 处同类问题未逐条列出` });
    }

    const checks = RULES.map(r => ({
      code: r.code,
      name: r.code + ' ' + r.name,
      passed: !issues.some(i => i.rule === r.code && i.level === 'error')
    }));

    const stats = {
      width: W, height: H,
      buildings: data.buildings.length, rooms: data.rooms.length,
      containers: data.containers.length, enemies: data.enemies.length, props: data.props.length,
      walkableCells: reached.size,
      containersByType: Object.fromEntries(Object.keys(data.containerTypes).map(t => [t, data.containers.filter(c => c.type === t).length])),
      enemiesByType: Object.fromEntries([...new Set(data.enemies.map(e => e.type))].map(t => [t, data.enemies.filter(e => e.type === t).length])),
      regions: Object.fromEntries(Object.keys(data.quotas.regions || {}).map(id => [id, {
        containers: data.containers.filter(c => c.region === id).length,
        enemies: data.enemies.filter(e => e.region === id).length
      }]))
    };

    return {
      issues,
      checks,
      stats,
      routes,
      counts: { errors: issues.filter(i => i.level === 'error').length, warnings: issues.filter(i => i.level === 'warn').length },
      schemaVersion: Core.SCHEMA_VERSION
    };
  }

  /* node 侧保持"有错就抛"的既有调用方式；错误对象带上完整 issues。 */
  function assertValid(data, rules) {
    const result = validateMap(data, rules);
    if (result.counts.errors > 0) {
      const errors = result.issues.filter(i => i.level === 'error');
      const message = `地图校验失败 ${errors.length} 项：` + errors.map(i => `[${i.rule}] ${i.message}`).join('；');
      const error = new Error(message);
      error.issues = errors;
      error.result = result;
      throw error;
    }
    return result;
  }

  return { validateMap, assertValid, RULES, RULE_NAME };
});
