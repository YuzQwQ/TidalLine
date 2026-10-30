/* 编辑器入口（M2）：载入 → 编辑 → 校验 → 写盘。
 * 分工：tools.js 改数据、history.js 管撤销、render.js 画、inspector.js 改字段，
 * 这里只做"把鼠标和键盘翻译成上面四者的一次调用"。 */
(function (root) {
  'use strict';

  const Core = root.MapCore, Validator = root.MapValidator, Pal = root.EditorPalette;
  const Rules = root.MapRules;
  const Render = root.EditorRender, IO = root.EditorIO, T = root.EditorTools;

  const $ = id => document.getElementById(id);
  const canvas = $('map');
  const view = $('view');

  const store = root.EditorStore.createStore({
    data: null,
    rules: {},
    result: null,
    source: '',
    rot: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
    layers: {
      container: true, prop: true, enemy: true, interact: true,
      route: true, zones: false, grid: true, coords: true, patrol: false
    },
    hover: null,
    highlight: null,
    issueFocus: null,
    issueHover: null,
    issueIndex: null,
    selection: null,
    material: null,
    tool: 'select',
    preview: null,
    docVersion: 0,
    dirty: false,
    autoFit: true,
    view: null
  });

  const history = root.EditorHistory.createHistory(store, { limit: 80 });

  const TOOLS = {
    select: { name: '选择', hint: '点实体选中，拖动移动，方向键微调，R 顺时针转 90°，Delete 删除；点空白处拖动平移' },
    brush: { name: '画笔', hint: '按住拖动连续刷；地形逐格改，实体每点一次放一个' },
    rect: { name: '矩形', hint: '按住拖出一个矩形，松手后整块填成当前地形' },
    bucket: { name: '油漆桶', hint: '点一下，把相连的同种地形整片换掉' },
    erase: { name: '橡皮', hint: '擦掉实体；空格子上则刷回默认地板（地形材质不参与）' }
  };

  let dirtyFrame = false;
  function scheduleDraw() {
    if (dirtyFrame) return;
    dirtyFrame = true;
    requestAnimationFrame(() => {
      dirtyFrame = false;
      const s = store.get();
      if (s.data) Render.draw(s.data, s.result, s, canvas);
    });
  }

  /* ---------- 尺寸与缩放 ---------- */
  function fit() {
    const s = store.get();
    if (!s.data) return;
    const [vw, vh] = Core.rotatedSize(s.data.width, s.data.height, s.rot);
    const zx = (view.clientWidth - 56) / (vw * Render.TILE);
    const zy = (view.clientHeight - 56) / (vh * Render.TILE);
    const zoom = Math.max(0.2, Math.min(4, Math.min(zx, zy)));
    store.set({ zoom, pan: { x: 0, y: 0 }, autoFit: true });
  }

  function zoomAt(clientX, clientY, factor) {
    const s = store.get();
    if (!s.data || !s.view) return;
    const old = s.view;
    const cellX = (clientX - old.ox) / old.tile;
    const cellY = (clientY - old.oy) / old.tile;
    const zoom = Math.max(0.25, Math.min(4, s.zoom * factor));
    const tile = Render.TILE * zoom;
    const w = old.vw * tile, h = old.vh * tile;
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    store.set({
      zoom,
      autoFit: false,
      pan: {
        x: clientX - cellX * tile - (cssW - w) / 2,
        y: clientY - cellY * tile - (cssH - h) / 2
      }
    });
  }

  /* ---------- 提示 ---------- */
  let toastTimer = 0;
  function toast(msg, bad) {
    const el = $('tool-hint');
    el.textContent = msg;
    el.classList.toggle('bad', !!bad);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, bad ? 4200 : 1800);
  }

  /* ---------- 侧栏 ---------- */
  const openCats = new Set(['container', 'enemy']);
  let dataSeq = 0, lastData = null;

  function renderPalette() {
    const s = store.get();
    const host = $('palette');
    host.innerHTML = '';
    if (!s.data) return;
    for (const cat of Pal.CATEGORIES) {
      const items = cat.items(s.data);
      if (!items.length) continue;
      const total = cat.unit === '种' ? items.length : items.reduce((n, i) => n + (i.count || 0), 0);
      const box = document.createElement('div');
      box.className = 'cat' + (openCats.has(cat.id) ? ' open' : '');
      box.dataset.cat = cat.id;
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'cat-head';
      head.innerHTML = '<span class="cat-dot" style="background:' + Pal.ITEM_COLOR[cat.id] + '"></span>' +
        '<span class="cat-name">' + cat.name + '</span>' +
        (cat.paintable ? '<span class="cat-paint" title="可放置">●</span>' : '') +
        '<span class="cat-count">' + total + '</span>';
      head.addEventListener('click', () => {
        if (openCats.has(cat.id)) openCats.delete(cat.id); else openCats.add(cat.id);
        box.classList.toggle('open');
      });
      box.appendChild(head);

      const list = document.createElement('div');
      list.className = 'cat-items';
      for (const item of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cat-item';
        btn.dataset.key = cat.id + ':' + item.key;
        btn.title = item.detail ? item.detail : item.label;
        btn.innerHTML = (item.art ? '<img class="sw" style="image-rendering:pixelated;object-fit:contain" src="../../../assets/'+(cat.id==='ground'?'tiles':'props')+'/'+item.art+'.png" alt="">' : '<span class="sw" style="background:' + (item.swatch || '#ccc') + '"></span>') +
          '<span class="lb">' + escapeHtml(item.label) + '</span><span class="n">' + (item.count || 0) + '</span>';
        btn.addEventListener('click', () => pickItem(cat, item));
        list.appendChild(btn);
      }
      box.appendChild(list);
      host.appendChild(box);
    }
    syncPaletteState();
  }

  function pickItem(cat, item) {
    const s = store.get();
    if (item.paint) {
      store.set({
        material: Object.assign({ cat: cat.id }, item.paint),
        highlight: { key: cat.id + ':' + item.key, category: cat.id, match: item.match, label: item.label },
        tool: s.tool === 'select' ? 'brush' : s.tool
      });
      toast('拿起：' + item.paint.label + (s.tool === 'select' ? ' · 已切到画笔' : ''));
    } else {
      const key = cat.id + ':' + item.key;
      const now = s.highlight;
      store.set({ highlight: now && now.key === key ? null : { key, category: cat.id, match: item.match, label: item.label } });
    }
    syncPaletteState();
  }

  /* 只改计数与高亮，不重建 DOM——否则拖拽刷墙时会一直折叠掉展开的分类。 */
  function syncPaletteState() {
    const s = store.get();
    if (!s.data) return;
    for (const cat of Pal.CATEGORIES) {
      const box = $('palette').querySelector('.cat[data-cat="' + cat.id + '"]');
      if (!box) continue;
      const items = cat.items(s.data);
      const total = cat.unit === '种' ? items.length : items.reduce((n, i) => n + (i.count || 0), 0);
      const cnt = box.querySelector('.cat-count');
      if (cnt) cnt.textContent = total;
      for (const item of items) {
        const btn = box.querySelector('.cat-item[data-key="' + cat.id + ':' + cssEscape(item.key) + '"]');
        if (!btn) continue;
        const n = btn.querySelector('.n');
        if (n) n.textContent = item.count || 0;
        btn.classList.toggle('on', !!(s.highlight && s.highlight.key === cat.id + ':' + item.key));
      }
    }
    const m = s.material;
    $('material').classList.toggle('none', !m);
    $('material').querySelector('.m-name').textContent = m ? m.label : '未选择';
    $('material').querySelector('.m-label').textContent = m ? (m.kind === 'terrain' ? '地形' : m.kind === 'container' ? '容器' : m.kind === 'prop' ? '装饰' : '敌人') : '材质';
  }

  function renderStats() {
    const s = store.get();
    const host = $('stats');
    if (!s.data) { host.innerHTML = ''; return; }
    const sum = Core.summary(s.data);
    const rows = [
      ['尺寸', sum.size + ' · ' + sum.tileSize + 'px'],
      ['建筑 / 房间', sum.buildings + ' / ' + sum.rooms],
      ['容器', sum.containers + ' / ' + sum.containerTypes + ' 型'],
      ['装饰', String(sum.props)],
      ['敌人', String(sum.enemies)],
      ['门洞 / 窗', sum.portals + ' / ' + sum.windows],
      ['撤离 / 桥', sum.exits + ' / ' + sum.bridges],
      ['推荐路线', String(sum.routes)],
      ['schema', 'v' + sum.schemaVersion]
    ];
    host.innerHTML = rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('');
    $('map-id').textContent = sum.id || '';
  }

  function renderIssues() {
    const s = store.get();
    const host = $('issues');
    const issues = root.EditorIssues;
    issues.render(host, {
      result: s.result,
      active: s.issueIndex,
      onPick: focusIssue,
      onHover: hoverIssue
    });
    $('rule-count').textContent = issues.ruleHint(
      s.result,
      Rules.expectations(s.rules).length,
      hasMapRules(s.rules)
    );
  }

  /* rules.json 里有没有"这张图专属"的东西：期望值、特殊检查开关、或分区限制。 */
  function hasMapRules(rules) {
    if (!rules) return false;
    if (Rules.expectations(rules).length) return true;
    if (Array.isArray(rules.specialChecks) && rules.specialChecks.length) return true;
    return !!rules.canal && rules.canal.x !== null && rules.canal.x !== undefined;
  }

  /* 点一条校验结果：有格子就跳过去并高亮，没有就只标选中（计数类问题没有具体位置）。 */
  function focusIssue(issue, index) {
    const cells = (issue.cells || []).filter(c => Array.isArray(c) && c.length === 2);
    store.set({
      issueIndex: index,
      issueHover: null,
      issueFocus: cells.length ? { cells, rule: issue.rule, level: issue.level } : null
    });
    /* 带 entityId 的（实体占格类问题）顺手选中它，检查器就能直接改。 */
    if (issue.entityId) {
      const d = store.get().data;
      for (const [kind, list] of [['container', d.containers], ['prop', d.props], ['enemy', d.enemies], ['exit', d.exits]]) {
        if (list.some(e => e.id === issue.entityId)) { select({ kind, id: issue.entityId }); break; }
      }
    }
    if (!cells.length) { toast(issue.rule + ' 是计数类问题，没有可定位的格子'); return; }
    centerOn(cells[0][0], cells[0][1]);
  }

  /* 悬停预览：只描边，不改选中与焦点。 */
  function hoverIssue(issue) {
    const s = store.get();
    if (!issue || !issue.cells || !issue.cells.length) {
      if (s.issueHover) store.set({ issueHover: null });
      return;
    }
    const next = { cells: issue.cells, level: issue.level, rule: issue.rule };
    const cur = s.issueHover;
    if (cur && cur.rule === next.rule && cur.cells.length === next.cells.length) return;
    store.set({ issueHover: next });
  }

  function renderLayers() {
    const s = store.get();
    const labels = {
      container: '容器', prop: '装饰', enemy: '敌人', interact: '出生 / 撤离 / 房间',
      route: '推荐路线', zones: '净宽与建筑框', grid: '网格', coords: '坐标', patrol: '巡逻半径'
    };
    const host = $('layers');
    host.innerHTML = Object.keys(labels).map(k =>
      '<label><input type="checkbox" data-layer="' + k + '"' + (s.layers[k] ? ' checked' : '') + '>' + labels[k] + '</label>'
    ).join('');
  }

  function renderHover() {
    const s = store.get();
    const host = $('hover'), coord = $('coord'), name = $('coord-name'), kind = $('hover-kind');
    if (!s.data || !s.hover) {
      host.textContent = '把鼠标移到地图上';
      coord.textContent = '—'; name.textContent = ''; kind.textContent = '';
      return;
    }
    const { x, y } = s.hover;
    const ch = (s.data.rows[y] || '')[x];
    const rule = s.data.legend[ch] || {};
    coord.textContent = '(' + x + ', ' + y + ')';
    name.textContent = rule.name || '';

    const rows = [];
    const box = s.data.containers.find(c => T.coversCell(c, x, y));
    const prop = s.data.props.find(p => T.coversCell(p, x, y));
    const enemy = s.data.enemies.find(e => e.x === x && e.y === y);
    const portal = s.data.portals.find(p => p.cells.some(c => c[0] === x && c[1] === y));
    const window_ = s.data.windows.find(w => w.cells.some(c => c[0] === x && c[1] === y));
    const room = s.data.rooms.find(r => inRect(r.rect, x, y));
    const building = s.data.buildings.find(b => (b.footprint || []).some(c => c[0] === x && c[1] === y));

    kind.textContent = box ? '容器' : prop ? '装饰' : enemy ? '敌人' : portal ? '门洞' : window_ ? '橱窗' : '';
    if (ch) rows.push(['地形', ch + ' ' + (rule.name || '')]);
    if (building) rows.push(['建筑', building.name]);
    if (room) rows.push(['房间', room.name]);
    if (box) {
      const type = s.data.containerTypes[box.type] || {};
      rows.push(['容器', (type.name || box.type) + ' · ' + box.id]);
      rows.push(['品质', (Pal.QUALITY[type.q] || {}).name || type.q]);
      rows.push(['偏好', (box.preference || []).join(' / ') || '—']);
    }
    if (prop) rows.push(['装饰', prop.name || prop.type, prop.id], ['朝向', prop.facing || 'front']);
    if (enemy) rows.push(['敌人', (Pal.ENEMY[enemy.type] || {}).name || enemy.type, enemy.id], ['巡逻', enemy.patrolRadius + ' 格']);
    if (portal) rows.push(['门洞', portal.name, portal.kind + ' · ' + portal.width + ' 格']);
    if (window_) rows.push(['橱窗', window_.id]);
    host.innerHTML = rows.map(([k, v, id]) =>
      '<div class="row"><span>' + k + '</span><span>' + escapeHtml(String(v)) + (id ? ' · ' + id : '') + '</span></div>'
    ).join('') || '<div class="hint">空格子</div>';
  }

  let lastInspectorKey = '';
  function renderInspector() {
    const s = store.get();
    /* 缓存键要带"实体还在不在"：删除是原地改数组，data 引用没换，
     * 只靠 kind:id + dataSeq 判断的话，删完检查器还停在被删实体的字段上。 */
    const exists = s.selection && T.resolve(s.data, s.selection) ? '1' : '0';
    const key = (s.selection ? s.selection.kind + ':' + s.selection.id : '-') + '|' + exists + '|' + dataSeq;
    if (key === lastInspectorKey) return;
    lastInspectorKey = key;
    root.EditorInspector.render($('inspector'), {
      data: s.data,
      sel: s.selection,
      commit: (label, fn) => { if (history.run(label, fn)) markEdited(); },
      remove: deleteSelection,
      rotate: rotateSelection
    });
    $('sel-hint').textContent = s.selection ? '拖动移动' : '';
  }

  const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cssEscape = s => String(s).replace(/(["\\])/g, '\\$1');

  function renderToolbar() {
    const s = store.get();
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === s.tool));
    const lb = history.labels();
    $('btn-undo').disabled = !history.canUndo;
    $('btn-redo').disabled = !history.canRedo;
    $('btn-undo').title = lb.undo ? '撤销：' + lb.undo : '没有可撤销的操作';
    $('btn-redo').title = lb.redo ? '重做：' + lb.redo : '没有可重做的操作';
    const st = $('dirty');
    st.textContent = s.dirty ? '未保存' : (s.data ? '已保存' : '—');
    st.className = 'dirty ' + (s.dirty ? 'dirty-on' : 'clean');
    canvas.style.cursor = s.tool === 'select' ? 'default' : 'crosshair';
  }

  function refresh() {
    const s = store.get();
    if (s.data && s.data !== lastData) { lastData = s.data; dataSeq++; }
    if (!s.data) return;
    if (!$('palette').childElementCount) renderPalette();
    else syncPaletteState();
    renderStats(); renderIssues(); renderLayers(); renderHover(); renderToolbar(); renderInspector();
    $('zoom-label').textContent = Math.round(s.zoom * 100) + '%';
    $('rot-hint').hidden = s.rot === 0;
    document.querySelectorAll('[data-rot]').forEach(b => b.classList.toggle('on', Number(b.dataset.rot) === s.rot));
  }

  /* ---------- 编辑与提交 ---------- */
  let validateTimer = 0, draftTimer = 0;

  function markEdited() {
    const s = store.get();
    if (!s.dirty) store.set({ dirty: true });
    /* 一动数据，之前那条 issue 的高亮就该收起来：它可能已经被改掉了，
     * 还留在画布上就是"提示一个不存在的问题"。 */
    if (s.issueFocus || s.issueIndex !== null) store.set({ issueFocus: null, issueIndex: null });
    scheduleValidate();
    scheduleDraft();
    renderToolbar();
  }

  function scheduleValidate() {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(validateNow, 140);
  }

  /* 立刻重算一次校验。去抖只是刷墙时的手段，测试与脚本要的是确定的时间点。 */
  function validateNow() {
    const s = store.get();
    if (!s.data) return;
    store.set({ result: Validator.validateMap(s.data, s.rules) });
    updateStatus();
  }

  /* 草稿按"来源文件"存，不按 data.id：从临海路另存出来的副本 id 往往还是
   * linhai-old-quarter-draft，按 id 存会让两份不同的图互相覆盖草稿。 */
  const draftKeyOf = s => (s && (s.source || (s.data && s.data.id))) || 'unknown';

  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const s = store.get();
      if (!s.data) return;
      IO.writeDraft(draftKeyOf(s), Core.serialize(s.data));
    }, 900);
  }

  function updateStatus() {
    const s = store.get();
    const el = $('status');
    if (!s.data || !s.result) { el.textContent = '—'; el.className = 'status'; return; }
    const c = s.result.counts;
    if (c.errors) {
      el.textContent = c.errors + ' 项错误' + (c.warnings ? ' / ' + c.warnings + ' 提醒' : '');
      el.className = 'status bad';
    } else if (c.warnings) {
      el.textContent = s.data.width + '×' + s.data.height + ' · ' + c.warnings + ' 提醒';
      el.className = 'status warn';
    } else {
      el.textContent = s.data.width + '×' + s.data.height + ' · ' + s.data.containers.length + ' 容器 · 校验通过';
      el.className = 'status good';
    }
  }

  function setTool(id) {
    const s = store.get();
    if (!TOOLS[id]) return;
    store.set({ tool: id, preview: null });
    toast(TOOLS[id].name + ' · ' + TOOLS[id].hint);
    if (id !== 'select' && !s.material) toast('先在左侧选一个材质，否则画笔没有东西可刷', true);
    renderToolbar();
  }

  function select(sel) {
    store.set({ selection: sel });
  }

  /* 顺时针转选中家具 90°。占格、贴图、朝向一起转，所以是一次撤销一步。
   * 返回 true 表示"这件事归我管了"（包括转不动而拒绝），false 表示没有选中、交给视角旋转。 */
  function rotateSelection() {
    const s = store.get();
    if (!s.selection) return false;
    const ref = T.resolve(s.data, s.selection);
    const res = history.apply('旋转 ' + ((ref && ref.id) || '实体'), d => T.rotateEntity(d, s.selection));
    const r = res.value || {};
    if (!r.ok) { toast(r.reason, true); return true; }
    if (res.changed) {
      lastInspectorKey = '';          // 占地可能变了，检查器要重画
      markEdited();
      const f = { front: '正面', side: '侧面', back: '背面' }[r.facing] || r.facing;
      toast('已旋转 · ' + f + ' · 占地 ' + r.footprint.join('×'));
    }
    return true;
  }

  function deleteSelection() {
    const s = store.get();
    if (!s.selection) return;
    const ref = T.resolve(s.data, s.selection);
    if (!ref) { select(null); return; }
    if (s.selection.kind === 'spawn' || s.selection.kind === 'exit') { toast('出生点与撤离点不能删除', true); return; }
    const kind = s.selection.kind;
    const table = {
      container: s.data.containers, prop: s.data.props, enemy: s.data.enemies,
      portal: s.data.portals, window: s.data.windows
    };
    const list = table[kind];
    if (!list) { toast('这种实体不能删除', true); return; }
    const id = ref.id;
    const isOpening = kind === 'portal' || kind === 'window';
    if (history.run('删除 ' + id, () => {
      /* 门 / 窗要先封墙再摘记录：摘完就没有 cells 可用了 */
      if (isOpening) T.sealShut(s.data, ref.cells);
      const i = list.indexOf(ref);
      if (i >= 0) list.splice(i, 1);
    })) {
      /* 刻意不清空 selection：撤销能把实体带回来，选中状态也该跟着回来。
       * 实体真不存在时检查器会退回提示，不会出错。 */
      markEdited();
      toast(isOpening ? '已删除 ' + id + ' · 原地已封墙' : '已删除 ' + id);
    }
  }

  /* ---------- 指针交互 ---------- */
  let drag = null;      // {mode:'pan'|'paint'|'rect'|'move'|'erase', ...}
  let spaceDown = false;

  const cellFromEvent = e => {
    const s = store.get();
    if (!s.data || !s.view) return null;
    const rect = canvas.getBoundingClientRect();
    return Render.cellAt(s.data, s, e.clientX - rect.left, e.clientY - rect.top);
  };

  function applyBrush(cell) {
    const s = store.get(), m = s.material;
    if (!m) return false;
    if (m.kind === 'terrain') return T.setTerrain(s.data, cell.x, cell.y, m.ch);
    return false;
  }

  function applyErase(cell) {
    const s = store.get();
    const hit = T.entityAt(s.data, cell.x, cell.y);
    if (hit && hit.kind !== 'spawn' && hit.kind !== 'exit') {
      const table = {
        container: s.data.containers, prop: s.data.props, enemy: s.data.enemies,
        portal: s.data.portals, window: s.data.windows
      };
      const list = table[hit.kind];
      if (!list) return false;
      const i = list.indexOf(hit.ref);
      if (i < 0) return false;
      /* 擦门 / 窗同样要把墙补回去，理由同 T.sealShut */
      if (hit.kind === 'portal' || hit.kind === 'window') T.sealShut(s.data, hit.ref.cells);
      list.splice(i, 1);
      return true;
    }
    return T.setTerrain(s.data, cell.x, cell.y, T.defaultFloorChar(s.data));
  }

  function brushPreview(cell) {
    const s = store.get(), m = s.material;
    if (!cell) { store.set({ preview: null }); return; }
    if (!m) { store.set({ preview: null }); return; }
    if (s.tool === 'erase') {
      const hit = T.entityAt(s.data, cell.x, cell.y);
      store.set({ preview: { cell: [cell.x, cell.y], tint: 'rgba(176,64,47,.30)', color: '#b0402f', label: hit ? '删除 ' + (hit.ref.id || '') : '刷回地板' } });
      return;
    }
    if (m.kind === 'terrain') {
      const cur = Core.terrainAt(s.data, cell.x, cell.y);
      if (cur === m.ch) { store.set({ preview: null }); return; }
      const color = (s.data.legend[m.ch] || {}).color || '#d9622b';
      store.set({ preview: { cell: [cell.x, cell.y], tint: hexA(color, 0.42), color: '#d9622b', label: m.ch + ' ' + m.label } });
      return;
    }
    /* 门走反向判据：不是"能不能站"而是"是不是墙"——粗糙预览给个方向，
     * 两侧是否都通由 T.placePortal 真正判。 */
    if (m.kind === 'portal') {
      const ch = Core.terrainAt(s.data, cell.x, cell.y);
      const ok = ch === '#';
      store.set({
        preview: {
          cell: [cell.x, cell.y],
          tint: ok ? 'rgba(47,143,106,.34)' : 'rgba(176,64,47,.30)',
          color: ok ? '#2f8f6a' : '#b0402f',
          label: ok ? '开 ' + m.label : '只能开在墙上'
        }
      });
      return;
    }
    if (m.kind === 'container' || m.kind === 'prop' || m.kind === 'enemy') {
      const w = m.kind === 'prop' ? (T.propDefaults(s.data, m.type).footprint) : [1, 1];
      const bad = T.placementProblem(s.data, cell.x, cell.y, w[0], w[1], null);
      store.set({
        preview: {
          rect: [cell.x, cell.y, cell.x + w[0] - 1, cell.y + w[1] - 1],
          tint: bad ? 'rgba(176,64,47,.34)' : 'rgba(44,107,84,.30)',
          color: bad ? '#b0402f' : '#2c6b54',
          label: bad ? bad : '放置 ' + m.label
        }
      });
    }
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    const s = store.get();
    if (!s.data) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 合成事件没有活动指针 */ }
    const cell = cellFromEvent(e);
    const panMode = e.button === 1 || spaceDown || (s.tool === 'select' && !(cell && T.entityAt(s.data, cell.x, cell.y)));

    if (panMode) {
      drag = { mode: 'pan', x: e.clientX, y: e.clientY, pan: Object.assign({}, s.pan) };
      canvas.classList.add('dragging');
      return;
    }
    if (!cell) return;

    if (s.tool === 'select') {
      const hit = T.entityAt(s.data, cell.x, cell.y);
      if (!hit) { select(null); return; }
      select({ kind: hit.kind, id: hit.ref.id });
      /* 门 / 窗没有 x/y，只有一组格坐标。拖动它得同时决定"旧位置封哪几格、新位置开哪几格"，
       * 连续手势下每帧都要重算，容易画出半截门。第一版只让选中与删除，不让拖。 */
      if (hit.kind === 'portal' || hit.kind === 'window') return;
      drag = { mode: 'move', sel: { kind: hit.kind, id: hit.ref.id }, start: cell, orig: { x: hit.ref.x, y: hit.ref.y }, moved: false };
      history.begin('移动 ' + (hit.ref.id || hit.kind));
      return;
    }

    if (s.tool === 'brush') {
      if (!s.material) { toast('先在左侧选一个材质', true); return; }
      if (s.material.kind === 'terrain') {
        history.begin('刷 ' + s.material.label);
        drag = { mode: 'paint', last: null };
        if (applyBrush(cell)) markEdited();
        drag.last = cell.x + ',' + cell.y;
      } else {
        const res = history.apply('放置 ' + (s.material.label || ''), d => T.place(d, s.material, cell.x, cell.y));
        const r = res.value;
        if (!r.ok) { toast(r.reason, true); return; }
        if (res.changed) markEdited();
        select({ kind: s.material.kind, id: r.id });
        toast('已放置 ' + r.label + ' · ' + r.id);
      }
      return;
    }

    if (s.tool === 'rect') {
      if (!s.material || s.material.kind !== 'terrain') { toast('矩形只能填地形，先选一个地面材质', true); return; }
      drag = { mode: 'rect', start: cell };
      store.set({ preview: { rect: [cell.x, cell.y, cell.x, cell.y], tint: hexA((s.data.legend[s.material.ch] || {}).color || '#d9622b', 0.4), color: '#d9622b', label: s.material.ch + ' ' + s.material.label } });
      return;
    }

    if (s.tool === 'bucket') {
      if (!s.material || s.material.kind !== 'terrain') { toast('油漆桶只能填地形，先选一个地面材质', true); return; }
      const res = history.apply('填充', d => T.floodFill(d, cell, s.material.ch));
      if (res.changed) { markEdited(); toast('填充 ' + res.value + ' 格'); }
      else toast('这一片已经是该地形');
      return;
    }

    if (s.tool === 'erase') {
      history.begin('擦除');
      drag = { mode: 'erase', last: null };
      if (applyErase(cell)) markEdited();
      drag.last = cell.x + ',' + cell.y;
    }
  });

  canvas.addEventListener('pointermove', e => {
    const s = store.get();
    if (drag && drag.mode === 'pan') {
      store.set({ autoFit: false, pan: { x: drag.pan.x + (e.clientX - drag.x), y: drag.pan.y + (e.clientY - drag.y) } });
      return;
    }
    const cell = cellFromEvent(e);
    const prev = s.hover;
    if ((cell ? cell.x + ',' + cell.y : null) !== (prev ? prev.x + ',' + prev.y : null)) store.set({ hover: cell });
    if (!cell) return;

    if (!drag) { brushPreview(cell); return; }

    if (drag.mode === 'paint') {
      const k = cell.x + ',' + cell.y;
      if (k === drag.last) return;
      drag.last = k;
      if (applyBrush(cell)) markEdited();
      return;
    }
    if (drag.mode === 'erase') {
      const k = cell.x + ',' + cell.y;
      if (k === drag.last) return;
      drag.last = k;
      if (applyErase(cell)) markEdited();
      return;
    }
    if (drag.mode === 'rect') {
      const rect = T.rectBetween(drag.start, cell);
      store.set({ preview: { rect, tint: hexA((s.data.legend[s.material.ch] || {}).color || '#d9622b', 0.4), color: '#d9622b', label: s.material.ch + ' ' + s.material.label } });
      return;
    }
    if (drag.mode === 'move') {
      const dx = cell.x - drag.start.x, dy = cell.y - drag.start.y;
      if (!dx && !dy) return;
      const err = T.moveTo(s.data, drag.sel, drag.orig.x + dx, drag.orig.y + dy);
      if (err) { if (!drag.warned) { drag.warned = true; toast(err, true); } return; }
      drag.warned = false;
      drag.moved = true;
      markEdited();
      return;
    }
  });

  function endDrag(e) {
    if (!drag) return;
    const s = store.get();
    if (drag.mode === 'pan') { canvas.classList.remove('dragging'); drag = null; return; }
    if (drag.mode === 'paint' || drag.mode === 'erase') {
      if (history.end()) markEdited();
      store.set({ preview: null });
    } else if (drag.mode === 'rect') {
      const rect = s.preview && s.preview.rect;
      if (rect && s.material) {
        const res = history.apply('矩形填充', d => T.fillRect(d, rect, s.material.ch));
        if (res.changed) { markEdited(); toast('填充 ' + res.value + ' 格'); }
      }
      store.set({ preview: null });
    } else if (drag.mode === 'move') {
      if (history.end()) { markEdited(); toast('已移动'); }
    }
    drag = null;
    if (e && e.pointerId != null) { try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* 已释放 */ } }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (!drag) { store.set({ hover: null, preview: null }); } });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  /* ---------- 载入与保存 ---------- */
  function apply(payload, opts) {
    const data = payload.data;
    /* 一定要归一化再进 store：没有 rules.json 时 payload.rules 是空对象 {},
     * 而侧栏、校验都按"完整结构"读 rules.expect / rules.specialChecks，
     * 直接存 {} 会让 Object.keys(undefined) 抛错——新图一打开就白屏。 */
    const rules = Rules.normalize(payload.rules || {});
    history.clear();
    const result = Validator.validateMap(data, rules);
    lastData = null;
    lastInspectorKey = '';
    store.set({
      data, rules, result, source: payload.source, pan: { x: 0, y: 0 },
      selection: null, material: null, preview: null, docVersion: (store.get().docVersion || 0) + 1,
      issueFocus: null, issueHover: null, issueIndex: null,
      dirty: !!(opts && opts.dirty)
    });
    $('palette').innerHTML = '';
    Render.invalidate();
    requestAnimationFrame(() => { fit(); scheduleDraw(); });
    showDrop(false);
    updateStatus();
    refresh();
    scheduleDraw();
    if (!opts || !opts.silent) {
      const draft = IO.readDraft((payload && payload.source) || data.id);
      if (draft && draft.text !== Core.serialize(data)) {
        const when = new Date(draft.at);
        $('draft-text').textContent = '检测到 ' + when.toLocaleString() + ' 的未保存草稿';
        $('draft-bar').hidden = false;
        $('draft-bar').dataset.text = draft.text;
      } else {
        $('draft-bar').hidden = true;
      }
    }
  }

  function showDrop(on) { $('drop').hidden = !on; }

  async function boot() {
    showDrop(false);
    try {
      apply(await IO.loadDefault());
    } catch (err) {
      showDrop(true);
      $('status').textContent = '需要手动载入';
      $('status').className = 'status';
      console.warn(err);
    }
  }

  async function save(pick) {
    const s = store.get();
    if (!s.data) return;
    const text = Core.serialize(s.data);
    try {
      const res = await IO.save(text, { pick });
      store.set({ dirty: false });
      IO.clearDraft(draftKeyOf(s));
      $('draft-bar').hidden = true;
      toast(res.mode === 'download' ? '浏览器不支持直接写盘，已下载 layout.json' : '已写入 ' + (res.name || 'layout.json'));
      renderToolbar();
    } catch (err) {
      if (err && err.name === 'AbortError') { toast('已取消保存'); return; }
      toast('保存失败：' + (err && err.message || err), true);
    }
  }

  /* ---------- 按钮与键盘 ---------- */
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  $('btn-fit').addEventListener('click', () => fit());
  $('btn-zoom-in').addEventListener('click', () => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1.25));
  $('btn-zoom-out').addEventListener('click', () => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 0.8));
  $('btn-reload').addEventListener('click', () => {
    if (store.get().dirty && !confirm('有未保存的修改，确定重新载入？')) return;
    boot();
  });
  $('btn-open').addEventListener('click', () => $('file-input').click());
  $('btn-art').addEventListener('click', () => reloadArt(true));
  $('btn-new').addEventListener('click', () => {
    if (store.get().dirty && !confirm('当前地图有未保存的修改，仍然新建？')) return;
    root.EditorNewMap.open(res => {
      /* 新图的 rules 是"expect 全 null"的骨架，所以只会跑 G1–G12。
       * 标 dirty：它还没落盘，必须让用户另存。 */
      apply({ data: res.data, rules: res.rules, source: '新建 · ' + res.spec.template }, { dirty: true, silent: true });
      toast('已新建 ' + res.data.width + '×' + res.data.height + ' ' + res.data.title + ' · 记得另存为 layout.json');
    });
  });
  async function openFile(file) {
    try {
      const payload = await IO.readFile(file);
      if (payload.kind === 'rules') {
        store.set({ rules: payload.rules });
        scheduleValidate();
        toast('已载入本图规则 ' + file.name);
        return;
      }
      apply(payload);
    } catch (err) {
      toast('JSON 解析失败：' + err.message, true);
    }
  }
  $('file-input').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) openFile(file);
  });
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-save').addEventListener('click', () => save(false));
  $('btn-save-as').addEventListener('click', () => save(true));
  $('btn-download').addEventListener('click', () => {
    const s = store.get();
    if (!s.data) return;
    IO.download(Core.serialize(s.data), 'layout.json');
    toast('已导出 layout.json');
  });
  $('btn-quotas').addEventListener('click', () => {
    if (history.run('同步配额', d => T.syncQuotas(d))) { markEdited(); toast('quotas 已同步为当前实际数量'); }
    else toast('配额已经是当前数量');
  });

  $('draft-restore').addEventListener('click', () => {
    const text = $('draft-bar').dataset.text;
    try {
      const data = JSON.parse(text);
      apply({ data, rules: store.get().rules, source: '草稿' }, { dirty: true, silent: true });
      toast('已恢复草稿（记得保存）');
    } catch (err) { toast('草稿解析失败', true); }
    $('draft-bar').hidden = true;
  });
  $('draft-discard').addEventListener('click', () => {
    const s = store.get();
    IO.clearDraft(draftKeyOf(s));
    $('draft-bar').hidden = true;
    toast('已丢弃草稿');
  });

  function undo() { if (history.undo()) { lastInspectorKey = ''; markEdited(); toast('已撤销'); } }
  function redo() { if (history.redo()) { lastInspectorKey = ''; markEdited(); toast('已重做'); } }

  document.querySelectorAll('[data-rot]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.set({ rot: Number(btn.dataset.rot), pan: { x: 0, y: 0 } });
      fit();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.target && e.target.matches && e.target.matches('input, textarea, select')) return;
    if (!$('newmap').hidden) return;      // 新建对话框开着时，快捷键全部让位
    const s = store.get();
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;

    if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return; }
    if (mod && (k === 's' || k === 'S')) { e.preventDefault(); save(false); return; }
    /* Alt+R 重载贴图。选中家具时 R 归"转 90°"、Shift+R 归"转视角"，
     * 再加 Alt 才不至于把三个动作挤在一个键上。 */
    if (e.altKey && (k === 'r' || k === 'R')) { e.preventDefault(); reloadArt(true); return; }

    if (k === ' ') { e.preventDefault(); spaceDown = true; canvas.classList.add('dragging'); return; }

    if (k >= '1' && k <= '5') { setTool(['select', 'brush', 'rect', 'bucket', 'erase'][Number(k) - 1]); return; }

    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      if (s.selection) deleteSelection();
      else if (s.hover) {
        const hit = T.entityAt(s.data, s.hover.x, s.hover.y);
        if (hit) { select({ kind: hit.kind, id: hit.ref.id }); deleteSelection(); }
      }
      return;
    }
    if (s.selection && k.startsWith('Arrow')) {
      e.preventDefault();
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      const ref = T.resolve(s.data, s.selection);
      if (!ref) return;
      if (s.selection.kind === 'portal' || s.selection.kind === 'window') {
        toast('门洞与橱窗没有 x/y，方向键挪不动；删掉后在目标位置重画', true);
        return;
      }
      if (history.run('微调 ' + (ref.id || ''), data => { T.moveTo(data, s.selection, ref.x + d[0], ref.y + d[1]); })) markEdited();
      return;
    }

    if (k === 'r' || k === 'R') {
      /* 有选中项时 R 转家具；Shift+R 永远转视角，免得选中一个箱子后转不动画面。 */
      if (!e.shiftKey && rotateSelection()) return;
      store.set({ rot: (s.rot + 90) % 360, pan: { x: 0, y: 0 } });
      fit();
      toast('视角转到 ' + ((s.rot + 90) % 360) + '°');
    } else if (k === 'g' || k === 'G') {
      store.set({ layers: Object.assign({}, s.layers, { grid: !s.layers.grid }) }); renderLayers();
    } else if (k === 'n' || k === 'N') {
      $('btn-new').click();
    } else if (k === 'f' || k === 'F') fit();
    else if (k === '+' || k === '=') zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1.2);
    else if (k === '-') zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1 / 1.2);
    else if (k === 'Escape') {
      drag = null;
      store.set({ highlight: null, material: null, selection: null, preview: null });
      syncPaletteState();
      toast('已放下材质');
    }
  });
  document.addEventListener('keyup', e => {
    if (e.key === ' ') { spaceDown = false; canvas.classList.remove('dragging'); }
  });

  $('layers').addEventListener('change', e => {
    const key = e.target.dataset && e.target.dataset.layer;
    if (!key) return;
    const s = store.get();
    store.set({ layers: Object.assign({}, s.layers, { [key]: e.target.checked }) });
  });

  /* 校验列表的点击由 issues.js 自己接管，这里只负责"点完怎么定位"。 */

  function centerOn(x, y) {
    const s = store.get();
    const [vw, vh] = Core.rotatedSize(s.data.width, s.data.height, s.rot);
    const zoom = Math.max(0.9, s.zoom);
    const tile = Render.TILE * zoom;
    const [sx, sy] = Core.project(x, y, s.rot, s.data.width, s.data.height);
    store.set({
      zoom, autoFit: false,
      pan: {
        x: canvas.clientWidth / 2 - (sx + 0.5) * tile - (canvas.clientWidth - vw * tile) / 2,
        y: canvas.clientHeight / 2 - (sy + 0.5) * tile - (canvas.clientHeight - vh * tile) / 2
      }
    });
    store.set({ hover: { x, y } });
  }

  /* 拖放 JSON */
  view.addEventListener('dragover', e => { e.preventDefault(); });
  view.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) openFile(file);
  });

  window.addEventListener('beforeunload', e => {
    if (!store.get().dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* 重绘与刷新：画布每帧都跟着状态走，右栏与左栏按"文档相关字段"去抖，
   * 否则刷墙时每改一格都会重排一次调色板。 */
  let uiTimer = 0;
  function scheduleUi() {
    clearTimeout(uiTimer);
    uiTimer = setTimeout(refresh, 40);
  }
  function uiKeyOf(s) {
    return [
      s.data ? s.data.id : '-', s.docVersion, s.tool, s.dirty, s.rot,
      Math.round((s.zoom || 1) * 100),      // 缩放只改画布，但百分比标签得跟着更新
      s.selection ? s.selection.kind + ':' + s.selection.id : '-',
      s.material ? s.material.kind + ':' + (s.material.ch || s.material.type) : '-',
      s.highlight ? s.highlight.key : '-',
      s.issueIndex === null || s.issueIndex === undefined ? '-' : s.issueIndex,
      s.result ? s.result.issues.length : -1,
      JSON.stringify(s.layers)
    ].join('|');
  }
  let lastUiKey = '';
  store.subscribe(s => {
    scheduleDraw();
    const k = uiKeyOf(s);
    if (k !== lastUiKey) { lastUiKey = k; scheduleUi(); }
    else renderHover();      // 只有 hover / preview 变了
  });
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (store.get().autoFit) fit();
      scheduleDraw();
    }, 90);
  }).observe(view);

  /* ---------- 贴图重载 ---------- */
  /* 贴图有三层缓存，任一层没打通都表现为"改了图没反应"：
   *   1. 这里的 images Map —— 会话内永不失效
   *   2. 浏览器的启发式缓存 —— 服务端不发 Cache-Control，按文件年龄的 10% 算新鲜期
   *   3. 静态层离屏画布 —— 只认 docVersion，不认贴图版本
   * reloadAssets() 三样一起清，并把 URL 版本戳换成当前毫秒，绕开第 2 层。 */
  let assetPending = false;

  function reloadArt(manual) {
    Render.reloadAssets();
    assetPending = manual;
    clearTimeout(assetTimer);
    scheduleDraw();
    if (manual) toast('重载贴图…');
  }

  let assetTimer = 0;
  Render.setAssetHook(() => {
    clearTimeout(assetTimer);
    assetTimer = setTimeout(() => {
      Render.invalidate(); scheduleDraw();
      if (assetPending) { assetPending = false; toast('贴图已更新'); }
    }, 120);
  });

  /* 切回窗口时问一遍磁盘：贴图动过就整批重下。
   * 只发 HEAD 比对 Last-Modified，本地几十毫秒；1.5 秒内重复切窗口不再问。 */
  let probeAt = 0;
  window.addEventListener('focus', () => {
    if (!store.get().data) return;
    if (Date.now() - probeAt < 1500) return;
    probeAt = Date.now();
    Render.probeAssets().then(changed => {
      if (changed) toast('检测到贴图改动 · 已自动重载');
    });
  });

  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(217,98,43,' + a + ')';
    const n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* 调试钩子：截图与自测用 */
  root.__editor = {
    store, fit, apply, zoomAt, Render, refresh, history, tools: T,
    setTool, save, select, centerOn, focusIssue, validateNow, markEdited,
    reloadArt,
    newMap: root.EditorNewMap,
    get selection() { return store.get().selection; }
  };

  /* 自测：index.html?selftest=1。带戳是为了改完测试脚本按 F5 就能跑新版；
   * file:// 下 ?query 会被当成文件名的一部分，那里不加。 */
  if (/[?&]selftest\b/.test(location.search)) {
    const sc = document.createElement('script');
    sc.src = 'test-editor.js' + (/^https?:$/.test(location.protocol) ? '?v=' + Date.now() : '');
    sc.onload = () => { if (root.__selftestRun) root.__selftestRun(); };
    document.body.appendChild(sc);
  }

  boot();
})(window);
