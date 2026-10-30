/* Canvas 渲染：底层（地块 + 叠加 + 门）烘进离屏画布，实体层每帧重画。
 * 视图旋转只转坐标系与叠加层，贴图按旋转族换变体；旋转时实体改用标记，避免烘焙光照跟着转错。 */
(function (root) {
  'use strict';

  const Core = root.MapCore, Art = root.MapArtMap, Pal = root.EditorPalette;
  const TILE = 32;
  const BASE = { tiles: '../../../assets/tiles/', props: '../../../assets/props/' };
  const images = new Map();
  const missing = new Set();
  let onAssetLoaded = null;

  let staticCanvas = null, staticKey = '';
  /* 探测基线：贴图 key → Last-Modified。Image 对象拿不到响应头，只能另发 HEAD 记录。 */
  const probeStamps = new Map();
  let probeBusy = false;

  /* 贴图 URL 的版本戳。
   * python -m http.server 不发 Cache-Control，浏览器只能拿 Last-Modified 推一个启发式
   * 新鲜期（经验值是"文件年龄的 10%"）——刚改完图那半小时里按 F5 根本不会发请求，
   * 画面还停在旧图上，很容易误判成"编辑器坏了"。
   * 每张图 URL 带一枚戳，换戳 = 换 URL = 必然重新请求。默认每次打开页面换一次。
   * http 下用 ?query（会进缓存键）；双击直开是 file://，?query 会被当成文件名的一部分而 404，
   * 只能退成 #fragment（不参与资源定位，但同样改掉缓存键）。 */
  const overHttp = /^https?:$/.test(location.protocol);
  let assetStamp = Date.now();
  const stampSuffix = () => overHttp ? '?v=' + assetStamp : '#v=' + assetStamp;

  function image(kind, name) {
    const key = kind + '/' + name;
    if (images.has(key)) return images.get(key);
    const im = new Image();
    im.onload = () => { if (onAssetLoaded) onAssetLoaded(); };
    im.onerror = () => { missing.add(key); if (onAssetLoaded) onAssetLoaded(); };
    im.src = BASE[kind] + name + '.png' + stampSuffix();
    images.set(key, im);
    return im;
  }

  /* 会话内贴图被重画了：清缓存、换戳、丢静态层，下次绘制整批重下。
   * staticKey 必须一起清——它只认 docVersion，不认贴图版本，
   * 否则地形层还贴着旧图，看起来像"只有家具更新了"。 */
  function reloadAssets() {
    assetStamp = Date.now();
    images.clear();
    missing.clear();
    staticKey = '';
    probeStamps.clear();
    return assetStamp;
  }

  /* ---------- 自动探测：切回窗口时检查磁盘上的贴图是否变过 ---------- */
  function assetUrl(key) {
    const i = key.indexOf('/');
    return BASE[key.slice(0, i)] + key.slice(i + 1) + '.png';
  }

  /* 返回 true 表示发现改动并已重载。浏览器直开（file://）没有 HTTP 头可比，直接跳过。 */
  function probeAssets() {
    if (probeBusy) return Promise.resolve(false);
    if (!overHttp) return Promise.resolve(false);
    const keys = [...images.keys()].filter(k => !missing.has(k));
    if (!keys.length) return Promise.resolve(false);
    probeBusy = true;
    const first = probeStamps.size === 0;
    let changed = false;
    const jobs = keys.map(key => fetch(assetUrl(key), { method: 'HEAD', cache: 'no-store' })
      .then(res => {
        if (!res.ok) return;
        const lm = res.headers.get('last-modified') || '';
        if (!lm) return;
        const was = probeStamps.get(key);
        probeStamps.set(key, lm);
        if (!first && was && was !== lm) changed = true;
      })
      .catch(() => {}));
    return Promise.all(jobs).then(() => {
      probeBusy = false;
      if (changed) { reloadAssets(); if (onAssetLoaded) onAssetLoaded(); }
      return changed;
    });
  }
  const usable = im => im && im.complete && im.naturalWidth > 0;

  function doorAxis(data, p) {
    const [x, y] = p.cells[0];
    if (p.cells.length > 1) return p.cells[1][0] === x ? 'vertical' : 'horizontal';
    const wall = (cx, cy) => ['#', 'X', 'w'].includes((data.rows[cy] || '')[cx]);
    const v = Number(wall(x, y - 1)) + Number(wall(x, y + 1));
    const h = Number(wall(x - 1, y)) + Number(wall(x + 1, y));
    return v > h ? 'vertical' : 'horizontal';
  }

  /* docVersion 进缓存键：地形改一个字符时 id/尺寸都不变，只有版本号能告诉这里要重建。 */
  function buildStatic(data, rot, version) {
    const key = [data.id, data.width, data.height, rot, data.rows.length, version || 0].join('|');
    if (staticKey === key && staticCanvas) return staticCanvas;
    const [vw, vh] = Core.rotatedSize(data.width, data.height, rot);
    const c = document.createElement('canvas');
    c.width = vw * TILE; c.height = vh * TILE;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    for (let y = 0; y < data.height; y++) {
      const row = data.rows[y];
      if (typeof row !== 'string') continue;
      for (let x = 0; x < data.width; x++) {
        const ch = row[x], rule = data.legend[ch];
        const [sx, sy] = Core.project(x, y, rot, data.width, data.height);
        g.fillStyle = (rule && rule.color) || '#dcdcd4';
        g.fillRect(sx * TILE, sy * TILE, TILE, TILE);
        const art = Art.rotateArt((rule && rule.art) || Art.TILE_ART[ch] || 'low', rot).art;
        const im = image('tiles', art);
        if (usable(im)) g.drawImage(im, sx * TILE, sy * TILE, TILE, TILE);
      }
    }
    for (const o of Art.resolveOverlays(data)) {
      const [sx, sy] = Core.project(o.x, o.y, rot, data.width, data.height);
      const im = image('props', Art.rotateArt(o.art, rot).art);
      if (usable(im)) g.drawImage(im, sx * TILE, sy * TILE, TILE, TILE);
    }
    for (const p of data.portals) {
      if (p.kind !== 'door') continue;
      const [x, y] = p.cells[0];
      const art = 'door' + (doorAxis(data, p) === 'vertical' ? '_side' : '');
      const [sx, sy] = Core.project(x, y, rot, data.width, data.height);
      const im = image('props', Art.rotateArt(art, rot).art);
      if (usable(im)) g.drawImage(im, sx * TILE, sy * TILE, TILE, TILE);
    }
    staticCanvas = c; staticKey = key;
    return c;
  }

  function metrics(data, state, cssW, cssH) {
    const [vw, vh] = Core.rotatedSize(data.width, data.height, state.rot);
    const tile = TILE * state.zoom;
    const w = vw * tile, h = vh * tile;
    return { vw, vh, tile, w, h, ox: state.pan.x + (cssW - w) / 2, oy: state.pan.y + (cssH - h) / 2 };
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* 贴图按"屏幕盒"摆放：先算出实体在**屏幕上**占几格（视角旋转后宽高互换），
   * 再把贴图 contain 进这个盒子、底边对齐。这样 2 格家具的图才会铺满两格，
   * 而不是按 32px 单格图缩成一小坨。
   * 留白与抬底都按 tile 比例算（4/32、3/32）：写死成 4px 的话，缩小到 30% 时
   * 这点留白会吃掉小半个格子，家具全被压瘪。 */
  function spriteRect(box, im, tile) {
    const sw = im.naturalWidth, sh = im.naturalHeight;
    const bw = box.w * tile, bh = box.h * tile;
    const pad = tile * (4 / TILE);
    const lift = tile * (3 / TILE);
    const scale = Math.min((bw - pad) / sw, (bh - pad) / sh);
    const dw = sw * scale, dh = sh * scale;
    return { x: (bw - dw) / 2, y: bh - lift - dh, w: dw, h: dh };
  }

  /* 实体在屏幕上占的格范围。旋转 90/270 时，实体的左上角不一定还是屏幕左上角
   * （project(x,y) 可能是矩形右下角），所以取四角投影的包围盒，不能直接用 (x,y)。 */
  function screenBox(ent, data, rot) {
    const [w, h] = ent.footprint || [1, 1];
    const pts = [[ent.x, ent.y], [ent.x + w - 1, ent.y], [ent.x, ent.y + h - 1], [ent.x + w - 1, ent.y + h - 1]]
      .map(p => Core.project(p[0], p[1], rot, data.width, data.height));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const sx = Math.min.apply(null, xs), sy = Math.min.apply(null, ys);
    return { sx, sy, w: Math.max.apply(null, xs) - sx + 1, h: Math.max.apply(null, ys) - sy + 1 };
  }

  function draw(data, result, state, canvas) {
    const ctx = canvas.getContext('2d');
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!data) return;

    const m = metrics(data, state, cssW, cssH);
    state.view = m;
    const tile = m.tile;
    const px = (x, y) => {
      const [sx, sy] = Core.project(x, y, state.rot, data.width, data.height);
      return [m.ox + sx * tile, m.oy + sy * tile];
    };

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buildStatic(data, state.rot, state.docVersion), m.ox, m.oy, m.w, m.h);
    ctx.imageSmoothingEnabled = true;

    const highlight = state.highlight;
    const hot = desc => !!(highlight && highlight.match && highlight.match(desc));
    const accent = '#d9622b';

    /* 高亮：地形字符 */
    if (highlight && highlight.category === 'ground') {
      ctx.fillStyle = 'rgba(217,98,43,.30)';
      for (let y = 0; y < data.height; y++) {
        const row = data.rows[y];
        if (typeof row !== 'string') continue;
        for (let x = 0; x < data.width; x++) {
          if (!hot({ kind: 'cell', ch: row[x], x, y })) continue;
          const [sx, sy] = px(x, y);
          ctx.fillRect(sx, sy, tile, tile);
        }
      }
    }

    /* 区域与路线在实体之下 */
    if (state.layers.zones) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      for (const c of data.clearances) drawRectOutline(ctx, px, c.rect, 'rgba(110,140,150,.55)');
      for (const b of data.buildings) drawRectOutline(ctx, px, b.rect, 'rgba(194,162,74,.6)');
      ctx.restore();
    }
    /* 命中分类时，即使图层关闭也把框/格画出来 */
    for (const c of data.clearances) if (hot({ kind: 'clearance', ref: c })) drawRectOutline(ctx, px, c.rect, accent);
    for (const b of data.buildings) if (hot({ kind: 'region', ref: b.id })) drawRectOutline(ctx, px, b.rect, accent);
    for (const br of data.bridges) if (hot({ kind: 'bridge', ref: br })) drawRectOutline(ctx, px, br.rect, accent);
    for (const w of data.windows) {
      if (!hot({ kind: 'window', ref: w })) continue;
      for (const [wx, wy] of w.cells) { const [sx, sy] = px(wx, wy); outlineCell(ctx, sx, sy, tile, accent); }
    }
    for (const p of data.portals) {
      if (!hot({ kind: 'portal', ref: p })) continue;
      for (const [px2, py2] of p.cells) { const [sx, sy] = px(px2, py2); outlineCell(ctx, sx, sy, tile, accent); }
    }
    if (state.layers.route && result) {
      for (const r of result.routes) {
        if (!r.points || r.points.length < 2) continue;
        ctx.beginPath();
        r.points.forEach(([x, y], i) => {
          const [sx, sy] = px(x, y);
          if (i === 0) ctx.moveTo(sx + tile / 2, sy + tile / 2);
          else ctx.lineTo(sx + tile / 2, sy + tile / 2);
        });
        ctx.strokeStyle = r.color || '#21937b';
        ctx.lineWidth = Math.max(1.5, tile * 0.09);
        ctx.globalAlpha = 0.75;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    /* 家具：一律用贴图。屏幕朝向 = 实体朝向 + 视角，二者相加后选变体，
     * 所以转视角时家具会"转过来"而不是缩成一个点。占地 >1 格时优先 _large 放大版。 */
    if (state.layers.prop) {
      for (const prop of [...data.props].sort((a,b)=>Number(!!b.ground)-Number(!!a.ground))) {
        const box = screenBox(prop, data, state.rot);
        const bx = m.ox + box.sx * tile, by = m.oy + box.sy * tile;
        const art = Art.propVariant(prop, Art.screenFacing(prop.facing || 'front', state.rot));
        const im = image('props', art);
        if (usable(im)) {
          const r = prop.ground ? {x:0,y:0,w:tile*box.w,h:tile*box.h} : spriteRect(box, im, tile);
          ctx.drawImage(im, bx + r.x, by + r.y, r.w, r.h);
        } else {
          drawDot(ctx, bx, by, tile, '#8a6f9a');   // 只有缺图时才退成小方块
        }
        if (hot({ kind: 'prop', ref: prop, x: prop.x, y: prop.y })) {
          for (let dy = 0; dy < box.h; dy++) for (let dx = 0; dx < box.w; dx++) {
            outlineCell(ctx, bx + dx * tile, by + dy * tile, tile, accent);
          }
        }
      }
    }

    /* 容器：箱子贴图 + 品质角标。贴图不区分品质，角标是唯一能一眼看出"这箱值不值"的线索。 */
    if (state.layers.container) {
      for (const c of data.containers) {
        const type = data.containerTypes[c.type] || {};
        const q = Pal.QUALITY[type.q] || Pal.QUALITY.plain;
        const [sx, sy] = px(c.x, c.y);
        const art = Art.containerArt(c.type);
        const im = art ? image('props', art) : null;
        if (usable(im)) {
          ctx.drawImage(im, sx, sy, tile, tile);
        } else {
          const s = tile * 0.66, off = (tile - s) / 2;
          ctx.fillStyle = q.color;
          roundRect(ctx, sx + off, sy + off, s, s, Math.max(2, tile * 0.08));
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.75)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        const d = Math.max(3, Math.round(tile * 0.18));
        if (tile >= 22) {
          /* 放大到看得清贴图时，品质缩成右上角一个小方点 */
          ctx.fillStyle = q.color;
          ctx.fillRect(sx + tile - d - 1, sy + 1, d, d);
          ctx.strokeStyle = 'rgba(255,255,255,.9)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + tile - d - 0.5, sy + 1.5, d - 1, d - 1);
        } else {
          /* 缩到看不清贴图时，品质改成一圈描边——箱子在哪、值不值得搜，一眼就能扫出来 */
          ctx.strokeStyle = q.color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx + 1, sy + 1, tile - 2, tile - 2);
        }
        if (hot({ kind: 'container', ref: c, x: c.x, y: c.y })) outlineCell(ctx, sx, sy, tile, accent);
      }
    }

    /* 敌人 */
    if (state.layers.enemy) {
      for (const e of data.enemies) {
        const info = Pal.ENEMY[e.type] || { color: '#b04f3a', glyph: '?' };
        const [sx, sy] = px(e.x, e.y);
        if (state.layers.patrol && e.patrolRadius) {
          ctx.beginPath();
          ctx.arc(sx + tile / 2, sy + tile / 2, (e.patrolRadius + 0.5) * tile, 0, Math.PI * 2);
          ctx.strokeStyle = info.color + '55';
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.arc(sx + tile / 2, sy + tile / 2, tile * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = info.color;
        ctx.fill();
        if (tile >= 14) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + Math.round(tile * 0.3) + 'px Consolas, monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(info.glyph, sx + tile / 2, sy + tile / 2 + 1);
        }
        if (hot({ kind: 'enemy', ref: e, x: e.x, y: e.y })) outlineCell(ctx, sx, sy, tile, accent);
      }
    }

    /* 出生点 / 撤离点 / 房间锚点 */
    if (state.layers.interact) {
      for (const r of data.rooms) {
        const [sx, sy] = px(r.anchor[0], r.anchor[1]);
        ctx.beginPath();
        ctx.arc(sx + tile / 2, sy + tile / 2, Math.max(1.5, tile * 0.09), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(194,162,74,.85)';
        ctx.fill();
        if (hot({ kind: 'room', ref: r, x: r.anchor[0], y: r.anchor[1] })) outlineCell(ctx, sx, sy, tile, accent);
      }
      const [psx, psy] = px(data.spawn.x, data.spawn.y);
      drawBadge(ctx, psx, psy, tile, '#2f8f6a', 'P');
      if (hot({ kind: 'spawn' })) outlineCell(ctx, psx, psy, tile, accent);
      for (const ex of data.exits) {
        const [sx, sy] = px(ex.x, ex.y);
        drawBadge(ctx, sx, sy, tile, '#2f8f9a', ex.id);
        if (hot({ kind: 'exit', ref: ex })) outlineCell(ctx, sx, sy, tile, accent);
      }
    }

    /* 网格与坐标 */
    if (state.layers.grid) {
      const step = tile >= 12 ? 1 : 5;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= m.vw; i += step) {
        const gx = Math.round(m.ox + i * tile) + 0.5;
        ctx.moveTo(gx, m.oy); ctx.lineTo(gx, m.oy + m.h);
      }
      for (let j = 0; j <= m.vh; j += step) {
        const gy = Math.round(m.oy + j * tile) + 0.5;
        ctx.moveTo(m.ox, gy); ctx.lineTo(m.ox + m.w, gy);
      }
      ctx.strokeStyle = step === 1 ? 'rgba(40,70,60,.14)' : 'rgba(40,70,60,.26)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    if (state.layers.coords && tile >= 8) {
      const font = Math.max(10, Math.round(tile * 0.3)) + 'px Consolas, monospace';
      ctx.font = font;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.lineWidth = 3;
      const label = (text, x, y) => {
        ctx.strokeStyle = 'rgba(255,255,255,.82)';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = 'rgba(30,58,50,.9)';
        ctx.fillText(text, x, y);
      };
      for (let i = 0; i < m.vw; i += 10) label(String(i), m.ox + i * tile + 3, m.oy + 3);
      for (let j = 0; j < m.vh; j += 10) label(String(j), m.ox + 3, m.oy + j * tile + 3);
    }

    /* 选中实体：虚线框 + 四角。门 / 窗没有 x/y，包围框由格坐标算。 */
    const picked = resolveSel(data, state.selection);
    if (picked) {
      let ax, ay, bx, by;
      if (Array.isArray(picked.cells) && picked.cells.length) {
        const xs = picked.cells.map(c => c[0]), ys = picked.cells.map(c => c[1]);
        [ax, ay] = px(Math.min(...xs), Math.min(...ys));
        [bx, by] = px(Math.max(...xs) + 1, Math.max(...ys) + 1);
      } else {
        const [w, h] = picked.footprint || [1, 1];
        [ax, ay] = px(picked.x, picked.y);
        [bx, by] = px(picked.x + w, picked.y + h);
      }
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = '#1f6f9c';
      ctx.lineWidth = 2;
      ctx.strokeRect(ax + 1, ay + 1, bx - ax - 2, by - ay - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = '#1f6f9c';
      const c = Math.max(3, tile * 0.18);
      for (const [cx, cy] of [[ax, ay], [bx - c, ay], [ax, by - c], [bx - c, by - c]]) ctx.fillRect(cx, cy, c, c);
      ctx.restore();
    }

    /* 编辑预览：矩形选区 / 单格落点 / 放置合法性 */
    const pv = state.preview;
    if (pv) {
      const cells = pv.rect
        ? rectCells(pv.rect)
        : (pv.cells || (pv.cell ? [pv.cell] : []));
      ctx.fillStyle = pv.tint || 'rgba(217,98,43,.28)';
      for (const [x, y] of cells) {
        if (x < 0 || y < 0 || x >= data.width || y >= data.height) continue;
        const [sx, sy] = px(x, y);
        ctx.fillRect(sx, sy, tile, tile);
      }
      if (cells.length) {
        const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
        const [ax, ay] = px(Math.min(...xs), Math.min(...ys));
        const [bx, by] = px(Math.max(...xs) + 1, Math.max(...ys) + 1);
        ctx.strokeStyle = pv.color || '#d9622b';
        ctx.lineWidth = 2;
        ctx.strokeRect(ax + 1, ay + 1, bx - ax - 2, by - ay - 2);
        if (pv.label && tile >= 10) {
          const text = pv.label;
          ctx.font = Math.max(10, Math.round(tile * 0.34)) + 'px Consolas, monospace';
          ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          const tw = ctx.measureText(text).width + 8;
          ctx.fillStyle = 'rgba(22,48,42,.86)';
          ctx.fillRect(ax + 2, ay - 16, tw, 15);
          ctx.fillStyle = '#f2f7f2';
          ctx.fillText(text, ax + 6, ay - 3);
        }
      }
    }

    /* 校验焦点：点侧栏某条 issue 后，把相关格子标出来。
     * 画在最后、光标之前，保证压在所有实体之上。
     * issueHover 是鼠标悬停在条目上的临时预览，只描边不填色。 */
    paintIssue(ctx, px, tile, data, state.issueHover, false);
    paintIssue(ctx, px, tile, data, state.issueFocus, true);

    /* 光标 */
    if (state.hover && state.hover.x >= 0) {
      const [sx, sy] = px(state.hover.x, state.hover.y);
      ctx.strokeStyle = 'rgba(217,98,43,.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, tile - 2, tile - 2);
    }
  }

  /* 校验相关格子的标记。strong=true 是"点了这条"，填色 + 编号标签；
   * false 是"鼠标悬在这条"，只描边，避免和已选中的那条打架。 */
  function paintIssue(ctx, px, tile, data, focus, strong) {
    if (!focus || !focus.cells || !focus.cells.length) return;
    const cells = focus.cells.filter(c => Array.isArray(c) && c[0] >= 0 && c[1] >= 0 && c[0] < data.width && c[1] < data.height);
    if (!cells.length) return;
    const warn = focus.level === 'warn';
    const line = warn ? '#a8762a' : '#b0402f';
    ctx.save();
    if (strong) {
      ctx.fillStyle = warn ? 'rgba(214,158,46,.26)' : 'rgba(176,64,47,.26)';
      for (const [x, y] of cells) { const [cx, cy] = px(x, y); ctx.fillRect(cx, cy, tile, tile); }
    }
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const [fx, fy] = px(Math.min(...xs), Math.min(...ys));
    const [tx, ty] = px(Math.max(...xs) + 1, Math.max(...ys) + 1);
    ctx.setLineDash(strong ? [6, 4] : [3, 3]);
    ctx.strokeStyle = line;
    ctx.lineWidth = strong ? 2 : 1.5;
    ctx.strokeRect(fx + 1, fy + 1, tx - fx - 2, ty - fy - 2);
    ctx.setLineDash([]);
    if (strong && focus.rule) {
      const text = focus.rule + (cells.length > 1 ? ' · ' + cells.length + ' 格' : '');
      ctx.font = Math.max(10, Math.round(tile * 0.34)) + 'px Consolas, monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      const tw = ctx.measureText(text).width + 10;
      ctx.fillStyle = warn ? 'rgba(94,64,10,.9)' : 'rgba(96,26,16,.9)';
      ctx.fillRect(fx + 2, fy - 17, tw, 16);
      ctx.fillStyle = '#fdf6ef';
      ctx.fillText(text, fx + 7, fy - 4);
    }
    ctx.restore();
  }

  function drawRectOutline(ctx, px, rect, color) {    const [x1, y1] = px(rect[0], rect[1]);
    const [x2, y2] = px(rect[2] + 1, rect[3] + 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1);
  }
  function outlineCell(ctx, sx, sy, tile, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, tile - 2, tile - 2);
  }
  function drawDot(ctx, sx, sy, tile, color) {
    const s = Math.max(3, tile * 0.3);
    ctx.fillStyle = color + 'cc';
    ctx.fillRect(sx + (tile - s) / 2, sy + (tile - s) / 2, s, s);
  }
  function drawMarker(ctx, sx, sy, tile, color, glyph) {
    const s = tile * 0.5;
    ctx.fillStyle = color + 'cc';
    roundRect(ctx, sx + (tile - s) / 2, sy + (tile - s) / 2, s, s, 2);
    ctx.fill();
    if (tile >= 14) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(tile * 0.3) + 'px Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyph, sx + tile / 2, sy + tile / 2 + 1);
    }
  }
  function drawBadge(ctx, sx, sy, tile, color, label) {
    const s = tile * 0.72, off = (tile - s) / 2;
    ctx.fillStyle = color;
    roundRect(ctx, sx + off, sy + off, s, s, Math.max(2, tile * 0.12));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (tile >= 12) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(tile * 0.38) + 'px Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(label), sx + tile / 2, sy + tile / 2 + 1);
    }
  }

  /* 只按 id 取，避免撤销后拿到已失效的引用 */
  function resolveSel(data, sel) {
    if (!sel) return null;
    if (sel.kind === 'spawn') return data.spawn;
    const table = {
      container: data.containers, prop: data.props, enemy: data.enemies,
      exit: data.exits, portal: data.portals, window: data.windows
    };
    const list = table[sel.kind];
    return list ? list.find(e => e.id === sel.id) || null : null;
  }
  function rectCells(rect) {
    const out = [];
    for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++) out.push([x, y]);
    return out;
  }

  /* 屏幕坐标 → 格子 */
  function cellAt(data, state, clientX, clientY) {
    const v = state.view;
    if (!v) return null;
    const sx = Math.floor((clientX - v.ox) / v.tile);
    const sy = Math.floor((clientY - v.oy) / v.tile);
    if (sx < 0 || sy < 0 || sx >= v.vw || sy >= v.vh) return null;
    const [x, y] = Core.unproject(sx, sy, state.rot, data.width, data.height);
    return { x, y };
  }

  root.EditorRender = {
    TILE, draw, cellAt, metrics, image, usable, missing,
    setAssetHook(fn) { onAssetLoaded = fn; },
    invalidate() { staticKey = ''; },
    reloadAssets, probeAssets,
    get assetStamp() { return assetStamp; }
  };
})(window);
