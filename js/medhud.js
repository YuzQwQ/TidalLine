/* ============================================================
   医疗交互层：快捷键 5 / 快捷栏 / 圆形轮盘 / 治疗进度 HUD
   ------------------------------------------------------------
   四块职责分明，但都只认同一份数据 —— Medical 的状态机和背包格子：

     MedQuick  短按/长按判定、默认类型记忆、调用 Medical.use
     MedWheel  轮盘扇区、鼠标方向命中、松开确认
     MedBar    屏幕下方的快捷栏（当前药 + 剩余容量/数量）
     HealHud   治疗进度条，独立顶层，不会被背包或详情框盖住

   这里不做任何数值计算：回血、扣容量、拆堆、移除都还是 Medical 的事。
   数值一律现取自 Medical.entryCap / Medical.capOf，避免 UI 和实际对不上。
   ============================================================ */

/* ---------------- 快捷医疗控制器 ---------------- */
const MedQuick = {
  /* 长按判定阈值（毫秒）。改这个就能调轮盘的触发时间 */
  HOLD_MS: 250,

  typeId: null,       // 记住的是物品 id，不是格子或实例引用
  pressing: false,
  hold: 0,            // 本次按住累计秒数
  longFired: false,   // 这次按住已经开过轮盘（防重复开）

  /* 背包里所有可用于快捷治疗的条目，按格子顺序分出"种类" */
  groups() {
    const out = [];
    const seen = new Map();
    const P = Game.player;
    if (Game.state !== 'playing' || !P || P.dead || !P.bag) return out;

    for (const e of P.bag.slots) {
      const item = e && e.item;
      if (!Medical.ready(item)) continue;
      if (Medical.entryCap(e) <= 1e-6) continue;      // 容量归零的残件不算可用
      let g = seen.get(item.id);
      if (!g) {
        g = { id: item.id, item, entries: [], count: 0 };
        seen.set(item.id, g);
        out.push(g);
      }
      g.entries.push(e);
      g.count += Math.max(1, e.n | 0);
    }
    for (const g of out) {
      const max = Medical.capOf(g.item) || 1;
      const part = g.entries.find(e => Medical.isPartial(e));
      g.max = max;
      g.text = g.count > 1
        ? (part ? '×' + g.count + ' · ' + Math.ceil(Medical.entryCap(part)) + '/' + max : '×' + g.count)
        : Math.ceil(Medical.entryCap(g.entries[0])) + '/' + max;
    }
    return out;
  },

  /* 当前该用哪一件：优先记忆的类型，没有就退到格子排序最前的；同类型先用残容量的 */
  pick() {
    const gs = this.groups();
    if (!gs.length) return null;
    let g = this.typeId ? gs.find(x => x.id === this.typeId) : null;
    if (!g) g = gs[0];
    const part = g.entries.find(e => Medical.isPartial(e));
    return { group: g, entry: part || g.entries[0] };
  },

  /* 真正使用。id 传了就先改默认类型（轮盘确认走这条） */
  use(id) {
    if (id) this.typeId = id;
    const p = this.pick();
    if (!p) { Game.toast('背包里没有可用的医疗品'); return false; }
    /* 记忆为空、或者记的那种已经不在背包里：把当前选中的立为新默认，
       这样快捷栏和下一次短按都指向同一件，不会来回跳 */
    const gs = this.groups();
    if (!this.typeId || !gs.some(g => g.id === this.typeId)) this.typeId = p.group.id;

    const a = Game.action;
    if (a && a.type === 'heal') {
      /* 正在治同样的药：不重启，也不该白扣一次启动时间 */
      if (a.item.id === p.group.id) { Game.toast('正在治疗中'); return false; }
      /* 换药：先按原有规则正常中断，已恢复的 HP 和已扣的容量都保留 */
      Medical.cancel('已切换医疗品');
    }
    const P = Game.player;
    if (P && P.hp >= P.maxHp) { Game.toast('生命值已满'); return false; }
    return Medical.use(p.entry, 'bag');
  },

  press() {
    if (this.pressing) return false;
    this.pressing = true;
    this.hold = 0;
    this.longFired = false;
    return true;
  },

  release() {
    if (!this.pressing) return false;
    const wasLong = this.longFired;
    this.pressing = false;
    this.hold = 0;
    this.longFired = false;
    if (wasLong) return MedWheel.confirm();     // 轮盘已经关掉（Esc）时 confirm 直接返回 false
    return this.use();
  },

  tick(dt) {
    if (!this.pressing) return;
    this.hold += dt;
    if (!this.longFired && this.hold >= this.HOLD_MS / 1000) {
      this.longFired = true;                     // 先立牌子再开，轮盘打不开也不会退化成短按
      MedWheel.open();
    }
  },

  /* Esc：只关轮盘，不动正在进行的治疗 */
  abortWheel() {
    if (!MedWheel.isOpen()) return false;
    MedWheel.close();
    return true;
  },

  cancel() {
    this.pressing = false;
    this.hold = 0;
    this.longFired = false;
    MedWheel.close();
  },

  reset() {
    this.cancel();
    this.typeId = null;
  }
};

/* ---------------- 圆形医疗轮盘 ---------------- */
const MedWheel = {
  open_: false,
  sectors: [],
  sel: -1,
  /* 圆心放在画面中心偏上一点，给下方的快捷栏和治疗进度留位置 */
  cx: 360, cy: 214,
  rOut: 176, rIn: 62,
  dead: 30,                 // 中心死区半径：靠近圆心不选，松手即取消
  mx: 360, my: 214,
  _cv: null,
  _bound: false,

  isOpen() { return this.open_; },

  cv() {
    if (!this._cv) {
      const el = document.getElementById('medWheel');
      if (el) this._cv = el;
    }
    return this._cv;
  },

  bind() {
    if (this._bound) return;
    const cv = this.cv();
    if (!cv || !cv.addEventListener) return;
    this._bound = true;

    cv.addEventListener('mousemove', e => {
      if (!this.open_) return;
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      const s = CFG.VIEW_W / r.width;
      this.mx = (e.clientX - r.left) * s;
      this.my = (e.clientY - r.top) * s;
      this.sel = this.hitTest(this.mx, this.my);
    });

    /* 轮盘展开时整块盖住画面：点哪里都不会穿透到背包格子 */
    cv.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mouseleave', () => { if (this.open_) this.sel = -1; });
  },

  /* 圆心到鼠标的方向决定扇区；不看距离，鼠标在盘外也照样命中 */
  hitTest(x, y) {
    const n = this.sectors.length;
    if (!n) return -1;
    const dx = x - this.cx, dy = y - this.cy;
    if (Math.hypot(dx, dy) < this.dead) return -1;
    const step = 360 / n;
    let deg = Math.atan2(dy, dx) * 180 / Math.PI;   // -180..180，画布里 0 度朝右、顺时针为正
    let t = (deg + 90 + step / 2) % 360;            // 让第一个扇区的中心落在正上方
    if (t < 0) t += 360;
    return Math.min(n - 1, Math.floor(t / step));
  },

  open() {
    if (this.open_) return true;
    const gs = MedQuick.groups();
    if (!gs.length) { Game.toast('背包里没有可用的医疗品'); return false; }

    this.sectors = gs;
    this.bind();
    this.open_ = true;
    this.sel = -1;

    const cv = this.cv();
    if (cv) cv.style.display = 'block';
    Game.input.mouseDown = false;               // 别让开轮盘这一下顺手打出一枪

    /* 打开瞬间就按当前指针方向给个高亮；指针在死区里就先空着 */
    const gx = Number.isFinite(Game.input.mx) ? Game.input.mx : this.cx;
    const gy = Number.isFinite(Game.input.my) ? Game.input.my : this.cy;
    this.mx = gx; this.my = gy;
    this.sel = this.hitTest(gx, gy);
    this.draw();
    return true;
  },

  close() {
    if (!this.open_) return false;
    this.open_ = false;
    this.sectors = [];
    this.sel = -1;
    const cv = this.cv();
    if (cv) cv.style.display = 'none';
    return true;
  },

  /* 松手：把高亮的那种设成默认，然后立刻用一次 */
  confirm() {
    if (!this.open_) return false;
    const sec = this.sel >= 0 ? this.sectors[this.sel] : null;
    this.close();
    if (!sec) return false;                     // 没选到就什么都不改、也不用
    return MedQuick.use(sec.id);
  },

  /* 画布后备尺寸跟着渲染倍率走，逻辑坐标永远是 720×480 */
  sync() {
    const cv = this.cv();
    if (!cv || !cv.getContext) return null;
    const rs = Game._rs || 1;
    const w = Math.round(CFG.VIEW_W * rs);
    const h = Math.round(CFG.VIEW_H * rs);
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    const c = cv.getContext('2d');
    if (!c) return null;
    if (c.setTransform) c.setTransform(rs, 0, 0, rs, 0, 0);
    if (c.clearRect) c.clearRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    return c;
  },

  draw() {
    if (!this.open_) return;
    const c = this.sync();
    if (!c) return;
    const W = CFG.VIEW_W, H = CFG.VIEW_H;
    const n = this.sectors.length;
    if (!n) return;

    /* 背景压暗一点，让轮盘浮出来（不彻底盖住场内，方便判断自己站在哪） */
    c.fillStyle = 'rgba(5,9,8,0.58)';
    c.fillRect(0, 0, W, H);

    const cx = this.cx, cy = this.cy, R = this.rOut, r0 = this.rIn;
    const step = 360 / n;
    const RAD = Math.PI / 180;
    /* 扇区越多，图标和字越小，免得挤在一起 */
    const k = U.clamp(step / 72, 0.72, 1);
    const rLabel = (R + r0) / 2 + 6;

    for (let i = 0; i < n; i++) {
      const mid = (-90 + i * step) * RAD;
      const gap = n > 1 ? 0.012 : 0;
      const a0 = mid - (step / 2) * RAD + gap;
      const a1 = mid + (step / 2) * RAD - gap;
      const on = i === this.sel;

      c.beginPath();
      c.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
      c.arc(cx, cy, R, a0, a1);
      c.arc(cx, cy, r0, a1, a0, true);
      c.closePath();
      c.fillStyle = on ? 'rgba(63,191,155,0.3)' : 'rgba(15,26,22,0.9)';
      c.fill();
      c.lineWidth = on ? 2 : 1;
      c.strokeStyle = on ? 'rgba(150,236,208,0.95)' : 'rgba(58,88,80,0.9)';
      c.stroke();

      /* 标签：稀有度圆标 → 简称 → 剩余容量/数量，整块竖排在扇区中线处 */
      const lx = cx + Math.cos(mid) * rLabel;
      const ly = cy + Math.sin(mid) * rLabel;
      const it = this.sectors[i].item;
      const rc = RARITY[U.clamp((it.r || 1) - 1, 0, RARITY.length - 1)].color;
      const br = 12 * k;

      c.globalAlpha = on ? 1 : 0.72;
      c.beginPath();
      c.arc(lx, ly - 26 * k, br, 0, Math.PI * 2);
      c.fillStyle = rc;
      c.fill();
      c.fillStyle = '#0c1412';
      c.font = 'bold ' + Math.round(12 * k) + 'px Consolas, monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(it.r || 1), lx, ly - 26 * k + 0.5);

      c.fillStyle = on ? '#f0f7f4' : '#b8ccc4';
      c.font = Math.round(12 * k) + 'px "Microsoft YaHei", sans-serif';
      c.fillText(it.name.length <= 6 ? it.name : (it.short || it.name), lx, ly + 1);
      c.fillStyle = on ? '#9fe4c9' : '#6f8a82';
      c.font = Math.round(10 * k) + 'px Consolas, monospace';
      c.fillText(this.sectors[i].text, lx, ly + 17 * k);
      c.globalAlpha = 1;
    }

    /* 内外圈描边，把环带勾出来 */
    c.lineWidth = 1.4;
    c.strokeStyle = 'rgba(126,160,150,0.55)';
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy, r0, 0, Math.PI * 2); c.stroke();

    /* 中心空心区 */
    c.beginPath();
    c.arc(cx, cy, r0 - 1, 0, Math.PI * 2);
    c.fillStyle = 'rgba(8,14,12,0.94)';
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#dbe5e1';
    c.font = 'bold 14px "Microsoft YaHei", sans-serif';
    c.fillText('医疗物品', cx, cy - 6);
    c.fillStyle = '#6f8a82';
    c.font = '10px "Microsoft YaHei", sans-serif';
    c.fillText(this.sel >= 0 ? '松开 5 使用' : '移动鼠标选择', cx, cy + 13);
  }
};

/* ---------------- 快捷栏 ---------------- */
const MedBar = {
  _el: null,
  _id: undefined,     // 当前显示的是哪种药；换了才重建 DOM
  _txt: null,


  el() {
    if (!this._el) {
      const e = document.getElementById('medBar');
      if (e) this._el = e;
    }
    return this._el;
  },

  /* 只描述"该长什么样"，DOM 更新在 refresh 里做，方便测试直接查 */
  state() {
    const show = Game.state === 'playing' && !!Game.player && !Game.player.dead;
    const p = show ? MedQuick.pick() : null;
    return {
      show,
      id: p ? p.group.id : null,
      name: p ? (p.group.item.short || p.group.item.name) : '',
      text: p ? p.group.text : '无医疗品',
      empty: !p
    };
  },

  refresh() {
    const el = this.el();
    if (!el) return;
    const st = this.state();
    if (!st.show) {
      if (el.style.display !== 'none') el.style.display = 'none';
      this._id = undefined;
      return;
    }
    if (el.style.display !== 'flex') el.style.display = 'flex';

    /* 只有换药才重建结构；治疗中容量每帧都在变，那种情况只改文字，
       免得每帧新建一个 <img> 造成闪烁 */
    if (st.id !== this._id) {
      this._id = st.id;
      el.classList.toggle('empty', st.empty);
      el.innerHTML =
        '<span class="pill" title="短按 5 使用 · 长按 5 选择医疗品">' +
          '<span class="mk">5</span>' +
          (st.id ? Icons.tag(st.id, 'mic') : '<span class="mic ph"></span>') +
          '<span class="mtx"></span>' +
        '</span>';
      this._txt = el.querySelector('.mtx');
    }
    if (this._txt && this._txt.textContent !== st.text) this._txt.textContent = st.text;
  }
};

/* ---------------- 治疗进度（顶层 HUD） ----------------
   两行就够：上面一行写阶段和实时 HP，下面一条两段式进度条。
   剩余容量在正下方的快捷栏里实时变，不重复占地方。 */
const HealHud = {
  _el: null,
  _top: null, _fill: null,

  el() {
    if (!this._el) {
      const e = document.getElementById('healHud');
      if (e) {
        this._el = e;
        this._top = e.querySelector('.hh-top');
        this._fill = e.querySelector('.hh-fill');
      }
    }
    return this._el;
  },

  /* 当前该显示什么：进度、阶段、文案 */
  state() {
    const a = Game.action;
    const P = Game.player;
    const on = !!(a && a.type === 'heal' && Game.state === 'playing' && P && !P.dead);
    if (!on) return { show: false };
    const start = a.phase === 'start';
    const max = Medical.capOf(a.item) || 1;
    const left = Medical.entryCap(a.unit);
    const pct = start
      ? U.clamp(a.t / Math.max(0.01, a.item.healStart), 0, 1)
      : U.clamp(1 - left / max, 0, 1);
    const hp = Math.ceil(P.hp) + ' / ' + P.maxHp;
    return {
      show: true,
      start,
      pct,
      hp,
      top: start
        ? '启动 · ' + Math.max(0, a.item.healStart - a.t).toFixed(1) + ' 秒 · HP ' + hp
        : '+' + a.item.healRate + ' HP/秒 · HP ' + hp
    };
  },

  frame() {
    const el = this.el();
    if (!el) return;
    const st = this.state();
    const disp = st.show ? 'block' : 'none';
    if (el.style.display !== disp) el.style.display = disp;
    if (!st.show) return;

    el.classList.toggle('start', st.start);
    if (this._top) this._top.textContent = st.top;
    if (this._fill) this._fill.style.width = (st.pct * 100).toFixed(1) + '%';
  }
};

/* ---------------- 统一逐帧刷新 ----------------
   一次调用把三块都更新掉：轮盘重画、快捷栏换数值、进度条推进。
   挂在 Game.loop 里，和主渲染同频。 */
const MedHud = {
  frame() {
    MedBar.refresh();
    HealHud.frame();
    if (MedWheel.isOpen()) MedWheel.draw();
  },
  reset() {
    MedQuick.reset();
    MedBar._id = undefined;
  },
  /* 给测试和外部用的一个小入口：模拟一次完整的短按/长按 */
  press() { return MedQuick.press(); },
  release() { return MedQuick.release(); },
  tick(dt) { MedQuick.tick(dt); }
};
