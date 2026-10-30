/* ============================================================
   潮汐线 · 核心层
   工具 / 地图 / 视野 / 寻路 / 噪声
   ============================================================ */

/* ---------------- 工具 ---------------- */
const U = {
  clamp: (v, a, b) => v < a ? a : (v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  dist2: (x1, y1, x2, y2) => (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  // 角度差，归一化到 [-PI, PI]
  angDiff: (a, b) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  now: () => performance.now() / 1000
};

/* ---------------- 地图 ---------------- */
const M = {
  W: 0, H: 0,
  grid: [],          // 每格 { ch, solid, opaque, h, box, door }
  visible: null,     // Uint8Array 视锥内可见
  seen: null,        // Uint8Array 曾经可见
  raw: null,         // Uint8Array 360° 实测可见（未过滤视锥）
  playerSpawn: { x: 0, y: 0 },
  extracts: [],      // [{x,y}]
  tideLevel: 0,
  tideEnabled: true,
  doors: [],

  // x/y 为占地左上角；尺寸为地图轴向的宽×高，朝向不会隐式交换尺寸。
  propSize(prop) {
    const size = prop.footprint === undefined ? [1,1] : prop.footprint;
    if (!Array.isArray(size) || size.length !== 2 || !size.every(n=>Number.isInteger(n)&&n>0))
      throw new Error('物件占地必须为两个正整数: '+prop.id);
    return size;
  },

  propCells(prop) {
    const [w,h]=this.propSize(prop),cells=[];
    for(let y=prop.y;y<prop.y+h;y++)for(let x=prop.x;x<prop.x+w;x++)cells.push([x,y]);
    return cells;
  },

  propCollisionCells(prop) {
    if(prop.collisionCells===undefined)return this.propCells(prop);
    const [w,h]=this.propSize(prop),seen=new Set();
    if(!Array.isArray(prop.collisionCells))throw new Error('碰撞格配置非法: '+prop.id);
    return prop.collisionCells.map(cell=>{
      if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger)||cell[0]<0||cell[0]>=w||cell[1]<0||cell[1]>=h||seen.has(cell.join(',')))throw new Error('碰撞格越界/重复: '+prop.id);
      seen.add(cell.join(','));return [prop.x+cell[0],prop.y+cell[1]];
    });
  },

  load(rows, doorAxes, props, mapSpec) {
    const map = mapSpec || MAP_CATALOG.find(map=>map.rows===rows) || null;
    // 地形与容器可以共用字符（旧图H为高地）；正式地图按显式点位判定。
    const containerCells = map && Array.isArray(map.containers)
      ? new Set(map.containers.map(c => c.x + ',' + c.y)) : null;
    this.map = map;
    this.tideEnabled = map ? map.tideEnabled : true;
    this.tideLevel = 0;
    this.doors = [];
    this.playerSpawn = {x:0,y:0};
    this.H = rows.length;
    this.W = rows[0].length;
    this.grid = [];
    this.extracts = [];
    const n = this.W * this.H;
    this.visible = new Uint8Array(n);
    this.seen = new Uint8Array(n);
    this.raw = new Uint8Array(n);

    for (let y = 0; y < this.H; y++) {
      const line = rows[y];
      const row = [];
      for (let x = 0; x < this.W; x++) {
        const ch = line[x] || '#';
        const terrainCh = map ? map.terrainRows[y][x] : ch;
        const rule = map ? map.terrain[terrainCh] : null;
        const t = {
          ch,
          terrainCh,
          art: rule ? (terrainCh === 's' ? 'canal_steps_' + (x < this.W/2 ? 'w':'e') : rule.art) : null,
          solid: rule ? rule.solid : ch === '#',
          obstacle: (containerCells ? containerCells.has(x + ',' + y) : !!BOX_KIND[ch]) || !!(rule && rule.blocked),
          permanentWater: !!(rule && rule.permanentWater),
          overlays: [],
          container: containerCells ? containerCells.has(x + ',' + y) : !!BOX_KIND[ch],
          prop: null,
          opaque: rule ? rule.opaque : ch === '#',
          h: (map && map.tileHeights ? map.tileHeights[ch] : TILE_H[ch]) ?? 2,
          box: null,
          door: null
        };
        if (ch === 'P') this.playerSpawn = { x, y };
        if (ch === 'E') this.extracts.push({ x, y });
        if (ch === '+' || ch === 'S') {
          const wall = (cx, cy) => !!(rows[cy] && rows[cy][cx] === '#');
          const vertical = Number(wall(x, y - 1)) + Number(wall(x, y + 1));
          const horizontal = Number(wall(x - 1, y)) + Number(wall(x + 1, y));
          const axes=doorAxes || (map&&map.doorAxes);
          const override = axes && axes[x + ',' + y];
          const axis = override === 'vertical' || override === 'horizontal'
            ? override : (vertical > horizontal ? 'vertical' : 'horizontal');
          t.door = { open: true, safe: ch === 'S', axis };
        }
        row.push(t);
      }
      this.grid.push(row);
    }
    // 同一两格门洞共用一个门状态和门框；按显式墙轴线绘制。
    if (map) {
      for (const spec of map.doors) {
        const door = {...spec,open:true,safe:false,x:spec.cells[0][0],y:spec.cells[0][1]};
        this.doors.push(door);
        for (const [x,y] of spec.cells) this.at(x,y).door = door;
      }
      for (const overlay of map.overlays) {
        const tile = this.at(overlay.x,overlay.y);
        tile.overlays.push(overlay.art);
        if (overlay.replaceWall) {tile.art='floor';tile.wallCap=true;}
      }
      this.extracts = map.exits.map(ex=>({...ex}));
    }
    // 自定义测试/扩展地图可显式传摆设；主地图默认使用 DECOR。
    const furnishings = props || (map ? map.props : []);
    for (const prop of furnishings) {
      if(!Number.isInteger(prop.x)||!Number.isInteger(prop.y))throw new Error('物件坐标必须为整数: '+prop.id);
      const [pw,ph]=this.propSize(prop);
      if(prop.x<0||prop.y<0||pw>this.W-prop.x||ph>this.H-prop.y)throw new Error('场景摆设越界: '+prop.id);
      const cells=this.propCollisionCells(prop);
      for(const [x,y] of cells){
        const tile=this.at(x,y);
        if (!tile || tile.solid || tile.obstacle || tile.prop || tile.door || tile.container || tile.ch === 'P' || tile.ch === 'E'
          || (map&&map.exits.some(ex=>ex.x===x&&ex.y===y)))
          throw new Error('场景摆设位置冲突: ' + prop.id + ' @ ' + x + ',' + y);
      }
      for(const [x,y] of cells){
        const tile=this.at(x,y);
        tile.prop = prop;
        if (!prop.ground) tile.obstacle = true;
      }
    }
  },

  at(x, y) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return null;
    return this.grid[y][x];
  },

  idx(x, y) { return y * this.W + x; },

  /* 人物与寻路统一使用同一占用表：墙、实体物件、关门、深水不可进入。 */
  baseWalkable(x, y) {
    const t = this.at(x, y);
    if (!t) return false;
    if (t.solid || t.obstacle) return false;
    if (t.door && !t.door.open) return false;
    if (this.deepWater(x, y)) return false;
    return true;
  },

  // 与48px高墙的可见范围一致：原格 + 北侧半格，特殊破口/玻璃除外。
  wallCell(t) { return !!(t&&t.solid&&!t.wallCap&&t.terrainCh!=='w'&&(t.ch==='#'||t.art==='wall')); },
  wallAtPoint(wx,wy) {
    const x=this.tx(wx),y=this.ty(wy),t=this.at(x,y);
    return this.wallCell(t)||(!t?.door&&!t?.wallCap&&t?.terrainCh!=='w'&&this.wallCell(this.at(x,y+1))&&wy>=(y+.5)*CFG.TILE);
  },
  walkable(x,y) { return this.baseWalkable(x,y); },
  navigationPoint(x,y) { return {x:this.cx(x),y:this.cy(y)-(this.wallCell(this.at(x,y+1))&&!this.at(x,y)?.door?CFG.TILE/4:0)}; },
  walkablePoint(wx,wy) { return this.baseWalkable(this.tx(wx),this.ty(wy))&&!this.wallAtPoint(wx,wy); },
  collisionRects(x,y) {
    const size=CFG.TILE;
    if(!this.baseWalkable(x,y))return [[x*size,y*size,size,size]];
    return !this.at(x,y)?.door&&!this.at(x,y)?.wallCap&&this.wallCell(this.at(x,y+1))?[[x*size,(y+.5)*size,size,size/2]]:[];
  },

  /* 是否挡视线。
     容器（抽屉 / 柜子 / 保险箱）不算：它挡住走路，但看得见后面，
     不然整个房间的视野会被一堆箱子切得七零八落。 */
  opaque(x, y) {
    const t = this.at(x, y);
    if (!t) return true;
    if (t.opaque || this.wallAtPoint(this.cx(x),this.cy(y))) return true;
    if (t.door && !t.door.open) return true;
    if (t.prop && !t.prop.ground && t.prop.opaque !== false) return true;
    return false;
  },

  // 不可走的水面、驳岸允许子弹越过；玻璃、实体家具与门仍阻挡弹道。
  blocksShot(x,y,wx=this.cx(x),wy=this.cy(y)) {
    const t=this.at(x,y);
    return !t || this.wallAtPoint(wx,wy) || t.solid || t.container || !!(t.prop&&!t.prop.ground)
      || t.terrainCh==='w' || !!(t.door&&!t.door.open);
  },

  /* 该格的积水深度（0 = 干燥） */
  waterDepth(x, y) {
    const t = this.at(x, y);
    if (!t) return 0;
    if (!this.tideEnabled) return 0;
    return Math.max(0, this.tideLevel - t.h);
  },

  /* 浅水：可以走，但慢、吵 */
  flooded(x, y) {
    const d = this.waterDepth(x, y);
    return d > 0.02 && d <= 1.05;
  },

  /* 深水：过不去。这是"涨潮把路收走"的具体实现 */
  deepWater(x, y) {
    const t = this.at(x,y);
    return !!(t && t.permanentWater) || this.waterDepth(x, y) > 1.05;
  },

  /* 世界坐标 → 格 */
  tx(wx) { return Math.floor(wx / CFG.TILE); },
  ty(wy) { return Math.floor(wy / CFG.TILE); },
  /* 格 → 世界坐标（格中心） */
  cx(tx) { return tx * CFG.TILE + CFG.TILE / 2; },
  cy(ty) { return ty * CFG.TILE + CFG.TILE / 2; },

  /* ---- 视野：递归阴影投射（八分区法） ---- */
  _oct: [
    [1, 0, 0, -1, -1, 0, 0, 1],
    [0, 1, -1, 0, 0, -1, 1, 0],
    [0, 1, 1, 0, 0, -1, -1, 0],
    [1, 0, 0, 1, -1, 0, 0, -1]
  ],

  computeFOV(cx, cy, radius) {
    this.raw.fill(0);
    const r2 = radius * radius;
    const mark = (x, y) => {
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
      this.raw[y * this.W + x] = 1;
    };
    mark(cx, cy);
    for (let o = 0; o < 8; o++) {
      this._cast(cx, cy, 1, 1.0, 0.0, radius, r2,
        this._oct[0][o], this._oct[1][o],
        this._oct[2][o], this._oct[3][o], mark);
    }
    // 看见墙体伸入上格的实体部分时，也显示所属墙格；避免出现隐形碰撞。
    for(let y=0;y<this.H-1;y++)for(let x=0;x<this.W;x++)
      if(this.raw[this.idx(x,y)]&&!this.wallCell(this.at(x,y))&&this.wallCell(this.at(x,y+1)))mark(x,y+1);
  },

  /* 把 360° 的 raw 可见，按视锥 + 近身 过滤成 visible，并累积 seen */
  applyCone(px, py, angle, halfAngle, nearR) {
    this.visible.fill(0);
    const W = this.W, H = this.H;
    const ptx = Math.floor(px / CFG.TILE), pty = Math.floor(py / CFG.TILE);
    const near2 = (nearR + 0.5) * (nearR + 0.5);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!this.raw[i]) continue;
        const dx = x - ptx, dy = y - pty;
        const d2 = dx * dx + dy * dy;
        let inCone = false;
        if (d2 <= near2) {
          inCone = true;
        } else {
          const a = Math.atan2(dy, dx);
          if (Math.abs(U.angDiff(a, angle)) <= halfAngle) inCone = true;
        }
        if (inCone) {
          this.visible[i] = 1;
          this.seen[i] = 1;
        }
      }
    }
  },

  _cast(cx, cy, row, start, end, radius, r2, xx, xy, yx, yy, mark) {
    if (start < end) return;
    let newStart = 0;
    let blocked = false;

    for (let j = row; j <= radius && !blocked; j++) {
      let dx = -j - 1;
      const dy = -j;
      while (dx <= 0) {
        dx += 1;
        const X = cx + dx * xx + dy * xy;
        const Y = cy + dx * yx + dy * yy;
        const lSlope = (dx - 0.5) / (dy + 0.5);
        const rSlope = (dx + 0.5) / (dy - 0.5);

        if (start < rSlope) continue;
        if (end > lSlope) break;

        if (X >= 0 && Y >= 0 && X < this.W && Y < this.H) {
          if (dx * dx + dy * dy <= r2) mark(X, Y);
        }

        if (blocked) {
          if (this.opaque(X, Y)) {
            newStart = rSlope;
            continue;
          } else {
            blocked = false;
            start = newStart;
          }
        } else if (this.opaque(X, Y) && j < radius) {
          blocked = true;
          this._cast(cx, cy, j + 1, start, lSlope, radius, r2, xx, xy, yx, yy, mark);
          newStart = rSlope;
        }
      }
      if (blocked) break;
    }
  },

  /* 两点之间是否通视（敌人用，简化的直线检查） */
  lineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    let guard = 0;
    while (guard++ < 200) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && this.opaque(x, y)) return false;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return false;
  },

  /* ---- A* 寻路 ----
     二十几个敌人每 0.4~0.6 秒各重算一次，一秒就是几十次调用。
     原来每次都 new 四个「全图大小」的 typed array，还用 open.includes()
     做线性查找 —— 既制造垃圾又让单次调用是 O(n²)，攒久了就是周期性掉帧。
     现在缓冲区复用 + 二叉堆，稳态下每次调用零分配。 */
  _pf: null,

  _pfBuf(n) {
    if (!this._pf || this._pf.n !== n) {
      this._pf = {
        n,
        g: new Float32Array(n),
        f: new Float32Array(n),
        from: new Int32Array(n),
        closed: new Uint8Array(n),
        // 堆按「每个节点最多被相邻的四条边各更新一次」给容量，不会溢出
        hi: new Int32Array(n * 4 + 16),
        hf: new Float32Array(n * 4 + 16)
      };
    }
    return this._pf;
  },

  findPath(sx, sy, tx, ty, maxNode) {
    if (!this.walkable(tx, ty)) return null;
    if (sx === tx && sy === ty) return [];
    // 扩建地图的跨区路线可能超过旧的 900 节点上限；默认最多访问全图一次。
    maxNode = maxNode || this.W * this.H;

    const W = this.W, H = this.H, n = W * H;
    const b = this._pfBuf(n);
    const g = b.g, f = b.f, from = b.from, closed = b.closed, hi = b.hi, hf = b.hf;
    g.fill(Infinity); f.fill(Infinity); from.fill(-1); closed.fill(0);

    const cap = hi.length - 1;
    let hn = 0;
    const push = (i, fv) => {
      if (hn >= cap) return;
      let k = ++hn;
      hi[k] = i; hf[k] = fv;
      while (k > 1) {
        const p = k >> 1;
        if (hf[p] <= hf[k]) break;
        const ti = hi[p], tf = hf[p];
        hi[p] = hi[k]; hf[p] = hf[k]; hi[k] = ti; hf[k] = tf;
        k = p;
      }
    };
    const pop = () => {
      const top = hi[1];
      hi[1] = hi[hn]; hf[1] = hf[hn]; hn--;
      let k = 1;
      for (;;) {
        const l = k << 1, r = l + 1;
        let m = k;
        if (l <= hn && hf[l] < hf[m]) m = l;
        if (r <= hn && hf[r] < hf[m]) m = r;
        if (m === k) break;
        const ti = hi[m], tf = hf[m];
        hi[m] = hi[k]; hf[m] = hf[k]; hi[k] = ti; hf[k] = tf;
        k = m;
      }
      return top;
    };

    const startI = sy * W + sx;
    const goalI = ty * W + tx;
    const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
    g[startI] = 0;
    f[startI] = h(sx, sy);
    push(startI, f[startI]);

    let nodes = 0;
    while (hn > 0 && nodes++ < maxNode) {
      const cur = pop();
      if (closed[cur]) continue;          // 堆里可能有同一格的旧副本
      if (cur === goalI) {
        const path = [];
        let c = cur;
        while (c !== startI && c !== -1) {
          path.push({ x: c % W, y: Math.floor(c / W) });
          c = from[c];
        }
        path.reverse();
        return path;
      }
      closed[cur] = 1;
      const cx = cur % W, cy = Math.floor(cur / W);

      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (!this.walkable(nx, ny)) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + 1;
        if (ng >= g[ni]) continue;
        g[ni] = ng;
        f[ni] = ng + h(nx, ny);
        from[ni] = cur;
        push(ni, f[ni]);                  // 已在堆里就多留一份，靠 closed 跳过
      }
    }
    return null;
  }
};

/* ---------------- 噪声 ---------------- */
const Noise = {
  events: [],       // {x, y, r, life, kind}
  visuals: [],      // 玩家能看到的噪声环 {x, y, r, age, max}

  emit(wx, wy, radiusTiles, kind) {
    this.events.push({
      x: wx, y: wy,
      r: radiusTiles * CFG.TILE,
      life: 0.45,
      kind: kind || 'step'
    });
    if (this.events.length > 200) this.events.shift();
  },

  /* 玩家能"听见"的噪声（来自敌人），用于屏幕边缘提示 */
  visual(wx, wy, radiusTiles) {
    this.visuals.push({
      x: wx, y: wy,
      r: radiusTiles * CFG.TILE,
      age: 0, max: 0.9
    });
    if (this.visuals.length > 30) this.visuals.shift();
  },

  tick(dt) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      this.events[i].life -= dt;
      if (this.events[i].life <= 0) {
        this.events.splice(i, 1);
      }
    }
    for (let i = this.visuals.length - 1; i >= 0; i--) {
      this.visuals[i].age += dt;
      if (this.visuals[i].age >= this.visuals[i].max) this.visuals.splice(i, 1);
    }
  },

  clear() { this.events.length = 0; this.visuals.length = 0; }
};

/* ---------------- 安静区（v0.4 的战后间歇） ---------------- */
const Quiet = {
  zones: [],   // {x, y, r, ttl}

  add(wx, wy, radiusTiles, time) {
    this.zones.push({ x: wx, y: wy, r: radiusTiles * CFG.TILE, ttl: time });
  },

  /* 某点是否在安静区里，返回剩余时间比例 */
  factor(wx, wy) {
    let best = 0;
    for (const z of this.zones) {
      if (U.dist(wx, wy, z.x, z.y) < z.r) {
        best = Math.max(best, z.ttl / CFG.QUIET_TIME);
      }
    }
    return best;
  },

  tick(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      this.zones[i].ttl -= dt;
      if (this.zones[i].ttl <= 0) this.zones.splice(i, 1);
    }
  },

  clear() { this.zones.length = 0; }
};

/* 每个稀有度在池子里有几件 —— 掉落权重按档位归一要用 */
function rarityCounts(list) {
  const c = {};
  for (const it of list) c[it.r] = (c[it.r] || 0) + 1;
  return c;
}

/* ---------------- 掉落表 ---------------- */
const Loot = {
  /* 指定物品池也按稀有度加权，尸体不能绕过新等级规则等概率产出孤品。 */
  pickFromPool(pool) {
    const available=pool.filter(item=>!item.noLoot&&RARITY_WEIGHT[item.r]>0);
    if(!available.length)return null;
    /* 同一档里再多几件，只是多几种长相，不该把这一档的总概率抬上去 */
    const cnt=rarityCounts(available);
    const w=available.map(item=>RARITY_WEIGHT[item.r]/cnt[item.r]);
    let roll=Math.random()*w.reduce((sum,v)=>sum+v,0);
    for(let i=0;i<available.length;i++){roll-=w[i];if(roll<=0)return available[i];}
    return available[0];
  },
  /* 按容器品质抽一件。
     品质直接给出六档目标概率（CONTAINER_QUALITY[q].pct），档内再按「类别」平分、
     同一类别里按件数平分。因为档内权重会被 cellW 归一，最终 P(稀有度) 恰好等于
     pct/Σpct —— 与类别偏好、物品数量都无关。所以这里绝不能再乘一层 RARITY_WEIGHT，
     否则曲线会被拉回白绿。
     某一档在池子里没有物品时，那一档的份额会按比例让给其余档（通用回退），
     缺档不会让容器抽不出东西，只会把曲线整体抬向仍在池子里的档位。 */
  roll(quality, preferredCats) {
    const Q = CONTAINER_QUALITY[quality] || null;
    const pct = Q ? Q.pct : null;
    const bias = r => pct ? (pct[r - 1] || 0) : RARITY_WEIGHT[r];

    const pool = ITEMS.filter(it => !it.noLoot && bias(it.r) > 0);

    /* 类别偏好倍率：容器只声明"偏爱哪几类"，具体强度在这里统一控制。
       取值越大，同品质容器之间的内容差异越明显；受该类别在各档的件数限制，
       空缺的档会自动把份额让给其它类别（不会抽空）。 */
    const CAT_PREF = (CFG.LOOT && CFG.LOOT.catPref) || 9;
    const catW = it => {
      let v = (preferredCats && preferredCats.includes(it.cat)) ? CAT_PREF : 1;
      // 高级容器偏向"收藏感强"的类别，低级容器偏向顺手能拿的工具与日用品。
      // 这个系数只改档内类别占比，不改稀有度曲线。
      if (Q && Q.lv >= 5) {
        if (it.cat === 'collect') v *= 1.35;
      } else if (Q && Q.lv <= 2) {
        if (it.cat === 'ind' || it.cat === 'life') v *= 1.25;
      }
      return v;
    };

    /* 每个 (稀有度, 类别) 格子里的件数，以及每个档的类别权重和 */
    const cell = {};          // r -> { cat: 件数 }
    const cellW = {};         // r -> 该档类别权重之和
    for (const it of pool) {
      if (!cell[it.r]) { cell[it.r] = {}; cellW[it.r] = 0; }
      if (cell[it.r][it.cat] == null) {
        cell[it.r][it.cat] = 0;
        cellW[it.r] += catW(it);
      }
      cell[it.r][it.cat]++;
    }

    let total = 0;
    const w = pool.map(it => {
      const v = bias(it.r) * catW(it) / cellW[it.r] / cell[it.r][it.cat];
      total += v;
      return v;
    });

    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= w[i];
      if (r <= 0) return { item: pool[i], n: 1 };
    }
    return { item: pool[0], n: 1 };
  },

  fill(quality, preferredCats) {
    const [a, b] = BOX_COUNT[quality] || [1, 2];
    const n = U.randInt(a, b);
    const out = [];
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      /* 同一个容器尽量不出重复条目；重抽几次仍撞上就照收，
         否则"抽 2–3 件"会被悄悄打折成 1 件。 */
      let r = this.roll(quality, preferredCats);
      for (let k = 0; k < 8 && seen.has(r.item.id); k++) r = this.roll(quality, preferredCats);
      seen.add(r.item.id);
      out.push(r);
    }
    return out;
  }
};
