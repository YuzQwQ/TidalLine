/* 编辑操作：只改数据，不管状态、不管撤销。
 * 一次调用 = 一个原子动作；事务边界（撤销颗粒度）由 history.js 负责。
 * 所有函数原地修改传入的 data，返回值表示"改了什么"或"为什么不能改"。 */
(function (root) {
  'use strict';
  const Library=root.SceneLibrary||{grounds:[],decals:[]};

  const Core = root.MapCore;
  const DOOR_CHARS = ['+', '/', '=', '-', 's'];

  const inBounds = (d, x, y) => x >= 0 && y >= 0 && x < d.width && y < d.height;
  const terrain = (d, x, y) => Core.terrainAt(d, x, y);
  const walkable = (d, x, y) => Core.isWalkableTerrain(d, x, y);
  const footprintOf = e => e.footprint || [1, 1];

  /* ---------- 地形 ---------- */

  function setTerrain(d, x, y, ch) {
    if (!inBounds(d, x, y)) return false;
    const row = d.rows[y];
    if (typeof row !== 'string' || row[x] === ch) return false;
    if(!d.legend[ch]){
      const a=Library.grounds.find(a=>a.ch===ch);
      if(!a)return false;
      d.legend[ch]=Core.clone(a.rule);
    }
    d.rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
    return true;
  }

  function rectBetween(a, b) {
    return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
  }

  function fillRect(d, rect, ch) {
    let n = 0;
    for (let y = rect[1]; y <= rect[3]; y++) {
      for (let x = rect[0]; x <= rect[2]; x++) if (setTerrain(d, x, y, ch)) n++;
    }
    return n;
  }

  /* 四邻域洪水填充。limit 防止在大片同色区域上一次性改掉整张图。 */
  function floodFill(d, start, ch, limit) {
    const cap = limit || 20000;
    const from = terrain(d, start.x, start.y);
    if (from === null || from === ch) return 0;
    const seen = new Set();
    const stack = [[start.x, start.y]];
    let n = 0;
    while (stack.length && n < cap) {
      const [x, y] = stack.pop();
      const k = x + ',' + y;
      if (seen.has(k)) continue;
      seen.add(k);
      if (terrain(d, x, y) !== from) continue;
      if (setTerrain(d, x, y, ch)) n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= d.width || ny >= d.height) continue;
        if (!seen.has(nx + ',' + ny) && terrain(d, nx, ny) === from) stack.push([nx, ny]);
      }
    }
    return n;
  }

  /* 橡皮用的默认地板。取图例里可通行的第一个非门洞字符（临海路是 "."）。 */
  function defaultFloorChar(d) {
    if(d.legend['.'] && d.legend['.'].walkable)return '.';
    for (const [ch, rule] of Object.entries(d.legend || {})) {
      if (rule.walkable && !DOOR_CHARS.includes(ch)) return ch;
    }
    return '.';
  }

  /* ---------- 实体查询 ---------- */

  function footprintCells(e) {
    const [w, h] = footprintOf(e);
    const out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([e.x + x, e.y + y]);
    return out;
  }

  function coversCell(e, x, y) {
    const [w, h] = footprintOf(e);
    return x >= e.x && x < e.x + w && y >= e.y && y < e.y + h;
  }

  /* 命中优先级：容器 → 家具 → 敌人 → 出生点 → 撤离点。
   * 容器和家具会互斥占格，顺序只在数据本身已经出错时才有意义。 */
  function entityAt(d, x, y) {
    const c = d.containers.find(c => c.x === x && c.y === y && !(c.footprint && c.footprint[0] * c.footprint[1] > 1));
    if (c) return { kind: 'container', ref: c };
    const c2 = d.containers.find(c => coversCell(c, x, y));
    if (c2) return { kind: 'container', ref: c2 };
    const p = d.props.find(p => coversCell(p, x, y));
    if (p) return { kind: 'prop', ref: p };
    const e = d.enemies.find(e => e.x === x && e.y === y);
    if (e) return { kind: 'enemy', ref: e };
    if (d.spawn.x === x && d.spawn.y === y) return { kind: 'spawn', ref: d.spawn };
    const ex = d.exits.find(e => e.x === x && e.y === y);
    if (ex) return { kind: 'exit', ref: ex };
    /* 门与橱窗排在最后：它们嵌在墙里，同一格上如果还有别的东西（正常数据不会，
     * 但坏数据会），先让实体拿走命中，免得点不到箱子。 */
    const pt = d.portals.find(p => p.cells.some(c => c[0] === x && c[1] === y));
    if (pt) return { kind: 'portal', ref: pt };
    const wn = d.windows.find(w => w.cells.some(c => c[0] === x && c[1] === y));
    if (wn) return { kind: 'window', ref: wn };
    return null;
  }

  /* 用 id 重新取实体。撤销会整份替换 data，所以选择状态只能存 id，不能存引用。 */
  function resolve(d, sel) {
    if (!sel) return null;
    const table = {
      container: d.containers, prop: d.props, enemy: d.enemies,
      exit: d.exits, portal: d.portals, window: d.windows
    };
    if (sel.kind === 'spawn') return d.spawn;
    const list = table[sel.kind];
    return list ? list.find(e => e.id === sel.id) || null : null;
  }

  /* 门 / 窗被删掉后，墙上那个洞要补回去。
   * 只删 portals 里的记录、不动地形，会留下"地形还是门洞、数据里没有对应记录"的孤儿格：
   * G8 只遍历 portals，查不出来，但游戏里那就是一道看不见的出入口。
   * 只封真正是开口的字符（+ / w），桥面（= -）与阶梯（s）不碰。 */
  function sealShut(d, cells) {
    let n = 0;
    for (const c of cells || []) {
      const ch = terrain(d, c[0], c[1]);
      if ((ch === '+' || ch === '/' || ch === 'w') && setTerrain(d, c[0], c[1], '#')) n++;
    }
    return n;
  }

  /* 以 id 在指定实体的占地范围外再找一个可落点，用于"移动后原位置空出来"。 */
  function overlapsOther(d, x, y, w, h, ignoreId) {
    for (const list of [d.props, d.containers]) {
      for (const e of list) {
        if (e.id === ignoreId || e.ground) continue;
        const [ew, eh] = footprintOf(e);
        if (x < e.x + ew && x + w > e.x && y < e.y + eh && y + h > e.y) return e.id;
      }
    }
    for (const e of d.enemies) {
      if (e.id === ignoreId) continue;
      if (e.x >= x && e.x < x + w && e.y >= y && e.y < y + h) return e.id;
    }
    return null;
  }

  /* 放置前检查。返回 null 表示可以放，否则是一句人话原因。 */
  function placementProblem(d, x, y, w, h, ignoreId) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = x + dx, cy = y + dy;
        if (!inBounds(d, cx, cy)) return '超出地图边界';
        if (!walkable(d, cx, cy)) return '(' + cx + ',' + cy + ') 不可通行';
        if (DOOR_CHARS.includes(terrain(d, cx, cy))) return '(' + cx + ',' + cy + ') 是门洞 / 桥 / 阶梯';
      }
    }
    const hit = overlapsOther(d, x, y, w, h, ignoreId);
    if (hit) return '与 ' + hit + ' 占格重叠';
    return null;
  }

  /* ---------- 派生默认值 ---------- */

  function regionAt(d, x, y) {
    const b = d.buildings.find(b => (b.footprint || []).some(c => c[0] === x && c[1] === y));
    return b ? b.id : 'outdoors';
  }

  /* 门连接的是"空间"：优先房间 id，出了房间退回建筑 id，室外是 outdoors。
   * 只用 regionAt 的话，同一栋楼里两个房间之间的门会写成 apartment → apartment，等于没说。 */
  function spaceAt(d, x, y) {
    for (const r of d.rooms) {
      const b = r.rect;
      if (b && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return r.id;
    }
    return regionAt(d, x, y);
  }

  /* 类型 → 最常见的偏好。临海路同一类型在不同位置挂不同偏好（储物柜在公寓是 life、
   * 在仓库是 ind+elec），所以这里只给"多数派"当默认值，真正决定权在检查器里。 */
  function dominantPreference(d, type) {
    const tally = new Map();
    for (const c of d.containers) {
      if (c.type !== type || !Array.isArray(c.preference)) continue;
      const k = c.preference.join(',');
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    if (!tally.size) return ['life'];
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return best.split(',');
  }

  function propDefaults(d, type) {
    const names = new Map(), foots = new Map();
    for (const p of d.props) {
      if (p.type !== type) continue;
      if (p.name) names.set(p.name, (names.get(p.name) || 0) + 1);
      const k = footprintOf(p).join('x');
      foots.set(k, (foots.get(k) || 0) + 1);
    }
    const pick = map => map.size ? [...map.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
    const foot = pick(foots);
    return {
      name: pick(names) || type,
      footprint: foot ? foot.split('x').map(Number) : [1, 1]
    };
  }

  /* 朝向推导：左右贴墙 → side，顶到上墙 → back，都不挨着 → front。
   * 与 tools/build-linhai-map.js 判门轴的方式同源（都是"看邻格是不是不可通行"）。
   * 注意 side 对多格家具意味着宽高互换，调用方要自己确认转过来放得下。 */
  function deriveFacing(d, x, y, w, h) {
    const blocked = (cx, cy) => !inBounds(d, cx, cy) || !walkable(d, cx, cy);
    for (let dy = 0; dy < h; dy++) {
      if (blocked(x - 1, y + dy) || blocked(x + w, y + dy)) return 'side';
    }
    for (let dx = 0; dx < w; dx++) if (blocked(x + dx, y - 1)) return 'back';
    return 'front';
  }

  /* 顺时针转 90°：占格和贴图一起转。
   *   多格件：宽高互换（1×2 → 2×1），朝向在 正 / 侧 之间切换——矩形转 180° 与不转长得一样；
   *   单格件：占格不变，朝向按 正 → 侧 → 背 → 正 循环；
   *   容器：只有一张正面贴图，转不动。
   * 转过去放不下就整个不改，返回原因交给调用方提示。 */
  function rotateEntity(d, sel) {
    if (!sel) return { ok: false, reason: '先用选择工具点一个家具' };
    if (sel.kind === 'container') return { ok: false, reason: '容器只有一张正面贴图，转不动（转视角用 Shift+R）' };
    if (sel.kind !== 'prop') return { ok: false, reason: '只有家具能转（转视角用 Shift+R）' };
    const e = resolve(d, sel);
    if (!e) return { ok: false, reason: '实体已不存在' };
    const [w, h] = footprintOf(e);
    const multi = w * h > 1;
    if (multi) {
      const bad = placementProblem(d, e.x, e.y, h, w, e.id);
      if (bad) return { ok: false, reason: '转过来放不下：' + bad };
      e.footprint = [h, w];
    }
    const next = root.MapArtMap.nextFacing(e.facing || 'front', multi ? 2 : 1);
    if (next === 'front') delete e.facing; else e.facing = next;
    return { ok: true, facing: next, footprint: (e.footprint || [1, 1]).slice() };
  }

  function nextId(list, prefix) {
    const used = new Set(list.map(e => e.id));
    const re = new RegExp('^' + prefix + '(\\d+)$');
    let max = 0;
    for (const id of used) { const m = re.exec(id); if (m) max = Math.max(max, Number(m[1])); }
    let n = max + 1, id;
    do { id = prefix + String(n++).padStart(2, '0'); } while (used.has(id));
    return id;
  }

  /* ---------- 放置 / 删除 / 移动 ---------- */

  function place(d, material, x, y) {
    if (!material || !material.kind) return { ok: false, reason: '没有选中材质' };

    if (material.kind === 'container') {
      const type = d.containerTypes[material.type];
      if (!type) return { ok: false, reason: '未定义的容器类型 ' + material.type };
      const bad = placementProblem(d, x, y, 1, 1, null);
      if (bad) return { ok: false, reason: bad };
      const rec = {
        id: nextId(d.containers, 'c'),
        region: regionAt(d, x, y),
        type: material.type,
        x, y,
        preference: dominantPreference(d, material.type)
      };
      d.containers.push(rec);
      return { ok: true, id: rec.id, label: type.name };
    }

    if (material.kind === 'prop') {
      const decal=Library.decals.find(a=>a.id===material.type);
      if(decal){
        if(!inBounds(d,x,y)||!walkable(d,x,y))return {ok:false,reason:'贴花需要可通行地面'};
        if(d.props.some(p=>p.type===decal.id&&p.x===x&&p.y===y))return {ok:false,reason:'这里已有相同贴花'};
        const rec={id:nextId(d.props,'p'),region:regionAt(d,x,y),type:decal.id,name:decal.name,x,y,
          solid:false,ground:true,opaque:false,footprint:[1,1],collisionCells:[]};
        d.props.push(rec);return {ok:true,id:rec.id,label:rec.name};
      }
      /* 材质自带占地时优先用它：新图没有同类型实例可参考，只能靠目录给的那份。 */
      const def = propDefaults(d, material.type);
      const foot = material.footprint || def.footprint;
      const [w, h] = foot;
      const bad = placementProblem(d, x, y, w, h, null);
      if (bad) return { ok: false, reason: bad };
      /* 靠墙自动转：侧面意味着宽高互换，换过去放不下就老老实实摆正面。 */
      let facing = deriveFacing(d, x, y, w, h);
      let fp = [w, h];
      if (facing === 'side' && w * h > 1) {
        if (!placementProblem(d, x, y, h, w, null)) fp = [h, w];
        else facing = 'front';
      }
      const rec = {
        id: nextId(d.props, 'p'),
        region: regionAt(d, x, y),
        type: material.type,
        name: material.name || def.name,
        x, y,
        solid: true,
        footprint: fp
      };
      /* 只在不是正面时写 facing：正面是默认值，写进去只是给 layout 增噪。 */
      if (facing !== 'front') rec.facing = facing;
      d.props.push(rec);
      return { ok: true, id: rec.id, label: rec.name };
    }

    if (material.kind === 'enemy') {
      const bad = placementProblem(d, x, y, 1, 1, null);
      if (bad) return { ok: false, reason: bad };
      const rec = {
        id: nextId(d.enemies, 'e'),
        region: regionAt(d, x, y),
        type: material.type,
        x, y,
        patrolRadius: 2
      };
      d.enemies.push(rec);
      return { ok: true, id: rec.id, label: material.type };
    }

    if (material.kind === 'portal') return placePortal(d, x, y, material.portalKind || 'door');

    return { ok: false, reason: '这种材质不能放置' };
  }

  /* 在墙上开一扇门（宽 1）。
   * 与其它实体不同，门的要求反着来：它必须落在**不可通行**的墙上，且两侧都要有可通行空间。
   * connects 由两侧的 regionAt 现推——门在数据上就是"连接两个空间的记录"，
   * 让用户先选两个房间再画门，比让他手填 id 现实得多。 */
  function placePortal(d, x, y, kind) {
    if (!inBounds(d, x, y)) return { ok: false, reason: '超出地图边界' };
    const ch = terrain(d, x, y);
    /* + 也接受：地形已经画成门洞、portals 里却没有记录时，这一步正好把记录补上。 */
    if (ch !== '#' && ch !== '+') return { ok: false, reason: '门要开在墙上，(' + x + ', ' + y + ') 现在是「' + ch + '」' };
    if (d.portals.some(p => p.cells.some(c => c[0] === x && c[1] === y))) return { ok: false, reason: '这里已经有门洞了' };
    if (d.windows.some(w => w.cells.some(c => c[0] === x && c[1] === y))) return { ok: false, reason: '这里已经有橱窗了' };

    /* 横着通还是竖着通：两侧要"真的能走"。
     * 只看地形可通行不够——站着家具的格子照样过不去，会造出"门后是衣柜"的死门，
     * G5 立刻报孤立可行格。 */
    const free = (cx, cy) => walkable(d, cx, cy) && !entityAt(d, cx, cy);
    let pair = null;
    for (const [a, b] of [[[-1, 0], [1, 0]], [[0, -1], [0, 1]]]) {
      const p1 = [x + a[0], y + a[1]], p2 = [x + b[0], y + b[1]];
      if (inBounds(d, p1[0], p1[1]) && inBounds(d, p2[0], p2[1]) &&
          free(p1[0], p1[1]) && free(p2[0], p2[1])) { pair = [p1, p2]; break; }
    }
    if (!pair) return { ok: false, reason: '门两侧都要有能走通的空间（地形可通行、且没有家具挡着）' };

    const building = d.buildings.find(b => (b.footprint || []).some(c => c[0] === x && c[1] === y));
    let n = 1, id;
    const base = (building ? building.id : 'outdoor') + '.door';
    do { id = base + (n++); } while (d.portals.some(p => p.id === id));

    const rec = {
      id,
      building: building ? building.id : undefined,
      name: '新门洞',
      cells: [[x, y]],
      connects: [spaceAt(d, pair[0][0], pair[0][1]), spaceAt(d, pair[1][0], pair[1][1])],
      kind: kind || 'door',
      width: 1
    };
    if (!rec.building) delete rec.building;
    setTerrain(d, x, y, '+');
    d.portals.push(rec);
    return { ok: true, id: rec.id, label: '门洞' };
  }

  function removeAt(d, x, y) {
    const hit = entityAt(d, x, y);
    if (!hit) return { ok: false, reason: '这里没有实体' };
    if (hit.kind === 'spawn') return { ok: false, reason: '出生点不能删除，只能移动' };
    if (hit.kind === 'exit') return { ok: false, reason: '撤离点不能删除，只能移动' };
    const table = {
      container: d.containers, prop: d.props, enemy: d.enemies,
      portal: d.portals, window: d.windows
    };
    const list = table[hit.kind];
    const i = list.indexOf(hit.ref);
    if (i < 0) return { ok: false, reason: '找不到实体' };
    /* 门 / 窗是多格坐标集合，一个实体可能横跨好几格：先封墙再摘记录，
     * 顺序反了就拿不到 cells 了。 */
    const sealed = (hit.kind === 'portal' || hit.kind === 'window') ? sealShut(d, hit.ref.cells) : 0;
    list.splice(i, 1);
    return { ok: true, id: hit.ref.id, kind: hit.kind, sealed };
  }

  /* 移动：x/y 是目标格（实体的左上角）。返回 null 表示成功。 */
  function moveTo(d, sel, x, y) {
    const e = resolve(d, sel);
    if (!e) return '实体已不存在';
    if (sel.kind === 'portal' || sel.kind === 'window') {
      return '门洞与橱窗没有 x/y，只有一组格坐标；拖动没法决定新形状，请删掉后在目标位置重画';
    }
    const [w, h] = sel.kind === 'container' ? footprintOf(e) : sel.kind === 'prop' ? footprintOf(e) : [1, 1];
    const bad = e.ground ? (!inBounds(d,x,y)||!walkable(d,x,y)?'贴花需要可通行地面':null) : placementProblem(d, x, y, w, h, e.id);
    if (bad) return bad;
    const changedRegion = regionAt(d, x, y);
    e.x = x; e.y = y;
    if (sel.kind !== 'spawn') e.region = changedRegion;
    return null;
  }

  /* ---------- 配额同步（显式动作，不自动） ---------- */

  /* 把 quotas.containers / quotas.enemies / quotas.regions 改成当前实际值。
   * 刻意不做成自动：配额是"想画成什么样"的声明，自动跟随就变成"已经画成什么样"的复印件。 */
  function syncQuotas(d) {
    const before = JSON.stringify([d.quotas.containers, d.quotas.enemies, d.quotas.regions]);
    d.quotas = d.quotas || {};
    d.quotas.containers = d.containers.length;
    d.quotas.enemies = d.enemies.length;
    const regions = {};
    for (const id of Object.keys(d.quotas.regions || {})) {
      regions[id] = [
        d.containers.filter(c => c.region === id).length,
        d.enemies.filter(e => e.region === id).length
      ];
    }
    d.quotas.regions = regions;
    return before !== JSON.stringify([d.quotas.containers, d.quotas.enemies, d.quotas.regions]);
  }

  root.EditorTools = {
    DOOR_CHARS,
    setTerrain, fillRect, floodFill, rectBetween, defaultFloorChar,
    entityAt, resolve, footprintCells, coversCell, sealShut,
    regionAt, spaceAt, dominantPreference, propDefaults, deriveFacing, nextId, rotateEntity,
    placementProblem, place, placePortal, removeAt, moveTo, syncQuotas
  };
})(window);
