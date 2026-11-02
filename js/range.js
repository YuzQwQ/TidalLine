/* ============================================================
   开发者靶场
   ------------------------------------------------------------
   入口：index.html#range
   一张只有靶子、一面落点墙的空房间，右侧是实时调参面板（F2 开关）。

   能调的东西（全部即时生效，不用刷新）：
     射速 / 击发延迟 / 开火动作速度
     每发后坐力 / 后坐力上限 / 回正延迟 / 回正速度 / 移动倍率
     散布上下限 / 准星抖动幅度与回弹
     弹速 / 射程 / 弹丸数

   这套东西只改「本局运行时」的数值：
     - 每把枪是 Player.weapons 里的拷贝（fillWeapons 用 Object.assign），
       改它不会碰 data.js 里的 WEAPONS；
     - 后坐力写的是 CFG.RECOIL 的字段，离开靶场（Range.exit）会还原。
   所以调完把「复制 JSON」里的差异贴回 data.js / config.js 就算落地。

   测量口径：
     - 弹孔只记「打在墙上的命中点」，与目标靶的命中分开记；
     - 射程尽头会有空心圈标记（子弹飞到最大射程消失的位置），
       用来判断某把枪能不能打到那面墙；
     - 实测射速用最近 20 发的开火间隔反推，不看配置值。
   ============================================================ */

/* ------------------------------------------------------------
   地图：一条 26×17 的直走廊，东墙就是落点墙
   1 格 = 32px，射击线在出生点，到东墙 560px。
   ------------------------------------------------------------ */
const RANGE_MAP = (() => {
  const W = 26, H = 17;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      line += border ? '#' : (x === 7 && y === 8 ? 'P' : 'r');
    }
    rows.push(line);
  }
  const terrain = {
    r: { art: 'street_stone', solid: false, blocked: false, opaque: false, permanentWater: false },
    '#': { art: 'wall', solid: true, blocked: true, opaque: true, permanentWater: false },
    P: { art: 'street_stone', solid: false, blocked: false, opaque: false, permanentWater: false }
  };
  return {
    id: 'dev-range',
    title: '靶场（开发用）',
    width: W, height: H,
    rows,
    terrainRows: rows,
    terrain,
    tileHeights: { r: 1, '#': 2, P: 1 },
    tideEnabled: false,
    containers: [], doors: [], overlays: [], exits: [], props: [], enemies: [],
    districts: []
  };
})();

/* 靶场坐标系（世界像素） */
const RANGE_GEO = (() => {
  const TS = CFG.TILE;
  const spawn = { x: 7 * TS + TS / 2, y: 8 * TS + TS / 2 };
  return {
    TS,
    spawn,
    lineX: spawn.x,                       // 射击线 = 出生点所在的竖线
    wallX: (RANGE_MAP.width - 1) * TS,     // 东墙内沿
    centerY: spawn.y
  };
})();

/* ------------------------------------------------------------
   靶子：打不坏的钢板靶，只负责记命中与飘伤害数字
   Bullet.targets() 会把 Game.targets 一起算进玩家子弹的目标里，
   所以它只要实现 dead / r / headR / hurt() 就够。
   ------------------------------------------------------------ */
class RTarget {
  constructor(x, y, label) {
    this.x = x; this.y = y;
    this.r = 10;
    this.headR = 0;          // 不区分头身，靶子只报落点
    this.label = label || '';
    this.dead = false;       // 永远打不坏
    this.isRangeTarget = true;
    this.flash = 0;
    this.hits = 0;
    this.dmg = 0;
    this.pops = [];
  }

  hurt(d, fromFaction, part, pen) {
    this.flash = 0.13;
    this.hits++;
    this.dmg += d;
    this.pops.push({ d: Math.round(d), t: 0.85, x: this.x + U.rand(-3, 3), y: this.y - 13 });
    if (this.pops.length > 6) this.pops.shift();
    if (typeof Range !== 'undefined') Range.onTargetHit(this, d, part);
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    for (const p of this.pops) { p.t -= dt; p.y -= 24 * dt; }
    if (this.pops.length && this.pops[0].t <= 0) this.pops = this.pops.filter(p => p.t > 0);
  }

  reset() { this.hits = 0; this.dmg = 0; this.pops.length = 0; this.flash = 0; }
}

/* ------------------------------------------------------------
   可调参数表
   where: 'w' = 当前这把枪自己的数值；'g' = 全局（CFG.RECOIL / 动作速度）
   mul:   显示值 = 存储值 × mul（毫秒、角度换算用）
   ------------------------------------------------------------ */
const RANGE_PARAMS = [
  // 射速与击发
  { group: '射速与击发', key: 'rpm',            label: '射速',         unit: 'rpm', where: 'w', min: 30,  max: 1200, step: 5,    digits: 0 },
  { group: '射速与击发', key: 'windup',         label: '击发延迟',     unit: 'ms',  where: 'w', min: 0,   max: 200,  step: 1,    digits: 0, mul: 1000 },
  { group: '射速与击发', key: 'anim',           label: '开火动作速度', unit: '×',   where: 'g', min: 0.4, max: 3,    step: 0.05, digits: 2 },

  // 后坐力
  { group: '后坐力',     key: 'recoilPerShot',  label: '每发后坐力',   unit: '',    where: 'w', min: 0,   max: 0.4,  step: 0.005, digits: 3 },
  { group: '后坐力',     key: 'max',            label: '后坐力上限',   unit: '',    where: 'g', min: 0.1, max: 2,    step: 0.05, digits: 2 },
  { group: '后坐力',     key: 'decayDelay',     label: '回正延迟',     unit: 's',   where: 'g', min: 0,   max: 1,    step: 0.01, digits: 2 },
  { group: '后坐力',     key: 'decay',          label: '回正速度',     unit: '/s',  where: 'g', min: 0.05, max: 3,   step: 0.01, digits: 2 },
  { group: '后坐力',     key: 'moveMult',       label: '移动倍率',     unit: '×',   where: 'g', min: 0.5, max: 4,    step: 0.05, digits: 2 },
  { group: '后坐力',     key: 'sprintMult',     label: '冲刺倍率',     unit: '×',   where: 'g', min: 0.5, max: 5,    step: 0.05, digits: 2 },
  { group: '后坐力',     key: 'sneakMult',      label: '潜行倍率',     unit: '×',   where: 'g', min: 0,   max: 2,    step: 0.05, digits: 2 },

  // 散布与准星
  { group: '散布与准星', key: 'spreadBase',     label: '基础散布',     unit: '°',   where: 'w', min: 0,   max: 15,   step: 0.1,  digits: 2, mul: 180 / Math.PI },
  { group: '散布与准星', key: 'spreadMax',      label: '满后坐散布',   unit: '°',   where: 'w', min: 0,   max: 25,   step: 0.1,  digits: 2, mul: 180 / Math.PI },
  { group: '散布与准星', key: 'kickMin',        label: '准星基础抖动', unit: 'px',  where: 'g', min: 0,   max: 12,   step: 0.1,  digits: 1 },
  { group: '散布与准星', key: 'kickScale',      label: '抖动随后坐力', unit: 'px',  where: 'g', min: 0,   max: 40,   step: 0.5,  digits: 1 },
  { group: '散布与准星', key: 'kickDecay',      label: '抖动回弹速度', unit: '/s',  where: 'g', min: 2,   max: 40,   step: 0.5,  digits: 1 },

  // 弹道
  { group: '弹道与伤害', key: 'speed',          label: '弹速',         unit: 'px/s', where: 'w', min: 150, max: 1500, step: 10, digits: 0 },
  { group: '弹道与伤害', key: 'range',          label: '最大射程',     unit: 'px',  where: 'w', min: 120, max: 1400, step: 10, digits: 0 },
  { group: '弹道与伤害', key: 'pellets',        label: '弹丸数',       unit: '颗',  where: 'w', min: 1,   max: 12,   step: 1,  digits: 0 }
];

/* 默认值快照：必须在任何调参之前取，重置就是回到这里 */
const RANGE_DEF_W = (() => {
  const out = {};
  for (const id in WEAPONS) {
    const d = WEAPONS[id];
    out[id] = {
      rpm: d.rpm, windup: 0,
      recoilPerShot: d.recoilPerShot != null ? d.recoilPerShot : CFG.RECOIL.perShot,
      spreadBase: d.spreadBase, spreadMax: d.spreadMax,
      speed: d.speed, range: d.range, pellets: d.pellets || 1
    };
  }
  return out;
})();
const RANGE_DEF_G = {
  max: CFG.RECOIL.max, decayDelay: CFG.RECOIL.decayDelay, decay: CFG.RECOIL.decay,
  moveMult: CFG.RECOIL.moveMult, sprintMult: CFG.RECOIL.sprintMult, sneakMult: CFG.RECOIL.sneakMult,
  kickMin: CFG.RECOIL.kickMin, kickScale: CFG.RECOIL.kickScale, kickDecay: CFG.RECOIL.kickDecay,
  anim: 1
};

const RANGE_STORE_KEY = 'tide.range.tune.v1';

const Range = {
  active: false,
  panel: null,
  visible: true,
  curId: 'rifle',

  w: {},          // 每把枪的调参值
  g: {},          // 全局调参值
  savedG: null,   // 进靶场前的 CFG.RECOIL 快照

  targets: [],
  holes: [],      // { x, y, t } 墙上的弹孔
  ends: [],       // { x, y, t } 射程尽头
  _shots: [],     // 开火时间戳
  _lastR: 0,
  _peak: 0,
  _lastShotT: -99,
  _clearT: 0,
  _rise: false,
  _uiT: 0,

  /* ---------------- 生命周期 ---------------- */
  start() {
    Game.rangeMode = true;
    this.active = false;                 // 等地图铺好再开，避免 update 里空跑
    this.load();

    Game.startRun(null, RANGE_MAP.id);

    this.active = true;
    this.holes = [];
    this.ends = [];
    this._shots = [];
    this._lastR = 0;
    this._peak = 0;
    this._clearT = 0;

    const P = Game.player;
    P.hp = P.maxHp;
    /* 两处都要有：子弹结算读 Game.targets，绘制与复位读 Range.targets */
    this.targets = this.spawnTargets();
    Game.targets = this.targets;

    this.initPanel();
    this.equip(this.w[this.curId] ? this.curId : 'rifle');
    this.refreshPanel();
    this.showPanel(true);

    Game.toast('靶场：F2 面板 / F3 清弹孔');
    Game.update(1 / 60);
    Game.render();
  },

  exit() {
    this.active = false;
    Game.rangeMode = false;
    if (this.savedG) {
      Object.assign(CFG.RECOIL, this.savedG);
      this.savedG = null;
    }
    if (this.panel) this.panel.classList.add('hidden');
    this.targets = [];
    Game.targets = [];
  },

  spawnTargets() {
    const TS = RANGE_GEO.TS;
    const list = [];
    /* 距离用「到射击线的直线距离」标注，方便对表 */
    const put = (tx, ty, tag) => {
      const x = tx * TS + TS / 2, y = ty * TS + TS / 2;
      const d = Math.round(U.dist(x, y, RANGE_GEO.spawn.x, RANGE_GEO.spawn.y));
      const t = new RTarget(x, y, d + 'px');
      list.push(t);
      return t;
    };
    put(12, 5, '');
    put(12, 12, '');
    put(16, 5, '');
    put(16, 12, '');
    put(20, 8, '');
    put(22, 4, '');
    put(22, 13, '');
    return list;
  },

  /* ---------------- 数值读写 ---------------- */
  load() {
    let saved = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(RANGE_STORE_KEY);
        if (raw) saved = JSON.parse(raw);
      }
    } catch (e) { saved = null; }

    this.w = {};
    for (const id in RANGE_DEF_W) {
      const base = Object.assign({}, RANGE_DEF_W[id]);
      const s = saved && saved.w && saved.w[id];
      if (s) for (const k in base) if (typeof s[k] === 'number' && isFinite(s[k])) base[k] = s[k];
      this.w[id] = base;
    }
    this.g = Object.assign({}, RANGE_DEF_G);
    if (saved && saved.g) {
      for (const k in this.g) {
        if (typeof saved.g[k] === 'number' && isFinite(saved.g[k])) this.g[k] = saved.g[k];
      }
    }
    if (saved && typeof saved.cur === 'string' && this.w[saved.cur]) this.curId = saved.cur;
  },

  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(RANGE_STORE_KEY, JSON.stringify({ w: this.w, g: this.g, cur: this.curId }));
    } catch (e) { /* 存不了就算了，不影响调试 */ }
  },

  /* 把调参值写进这一局的枪和 CFG.RECOIL */
  apply() {
    const P = Game.player;
    if (!P) return;
    const W = P.weapon;
    const w = W && this.w[W.id];
    if (w) {
      W.rpm = w.rpm;
      W.windup = w.windup;
      W.recoilPerShot = w.recoilPerShot;
      W.spreadBase = w.spreadBase;
      W.spreadMax = w.spreadMax;
      W.speed = w.speed;
      W.range = w.range;
      W.pellets = w.pellets;
    }
    const g = this.g, R = CFG.RECOIL;
    if (!this.savedG) this.savedG = Object.assign({}, R);
    R.max = g.max;
    R.decayDelay = g.decayDelay;
    R.decay = g.decay;
    R.moveMult = g.moveMult;
    R.sprintMult = g.sprintMult;
    R.sneakMult = g.sneakMult;
    R.kickMin = g.kickMin;
    R.kickScale = g.kickScale;
    R.kickDecay = g.kickDecay;
    P.animSpeed = g.anim;
    P.syncSpread();
  },

  makeWeapon(id) {
    const d = WEAPONS[id];
    if (!d) return null;
    const w = Object.assign({}, d, { magCur: d.mag });
    w.rounds = magazineRounds(w, d.mag, d.ammo);
    w.ammo = d.ammo;
    return w;
  },

  /* 换上一把枪；已经在枪位上的直接切过去 */
  equip(id) {
    const P = Game.player;
    if (!P || !WEAPONS[id]) return;
    let idx = -1;
    for (let i = 0; i < P.weapons.length; i++) if (P.weapons[i] && P.weapons[i].id === id) idx = i;
    if (idx < 0) {
      if (P.weapons[0]) P.weapons[0].magCur = P.mag;
      P.weapons[0] = this.makeWeapon(id);
      P.slot = 0;
      P.mag = P.weapons[0].mag;
      P.reloadT = 0;
      P.windupShot = false;
      P.fireCd = 0.15;
      P.syncSpread();
    } else if (P.slot !== idx) {
      P.switchWeapon(idx);
    }
    /* 存档里三把枪全空时 startRun 会默认切到刀上；靶场必须先把刀放下，
       否则 tryShoot 会走成近战挥砍，怎么点都没有子弹。 */
    P.meleeActive = false;
    if (typeof MeleeSystem !== 'undefined') MeleeSystem.cancel(P);
    this.curId = id;
    this.apply();
    this.syncGunButtons();
    this.rebuildParams();
    this.save();
  },

  /* ---------------- 每帧 ---------------- */
  tick(dt) {
    const P = Game.player;
    if (!P) return;

    /* 靶场不需要视野遮蔽：整间屋子都点亮，落点看得清 */
    M.visible.fill(1);

    /* 血量与弹药不设限，专心看弹道 */
    if (P.hp < P.maxHp) P.hp = P.maxHp;
    const W = P.weapon;
    if (W && P.mag !== W.mag && P.reloadT <= 0) {
      P.mag = W.mag;
      W.magCur = W.mag;
      W.rounds = magazineRounds(W, W.mag, W.ammo);
    }

    /* 手换到别的枪位时，面板跟着换 */
    if (W && this.w[W.id] && W.id !== this.curId) {
      this.curId = W.id;
      this.apply();
      this.syncGunButtons();
      this.rebuildParams();
    }

    for (const t of this.targets) t.update(dt);
    const now = Game.time;
    for (let i = this.holes.length - 1; i >= 0; i--) if (now - this.holes[i].t > 60) this.holes.splice(i, 1);
    for (let i = this.ends.length - 1; i >= 0; i--) if (now - this.ends[i].t > 12) this.ends.splice(i, 1);

    /* 后坐力遥测：靠值上升判断"这一发打出去了"，不侵入开火逻辑 */
    const r = P.recoil;
    if (r > this._lastR + 1e-5) {
      this._shots.push(now);
      if (this._shots.length > 30) this._shots.shift();
      this._lastShotT = now;
      this._peak = Math.max(this._peak, r);
      this._rise = true;
    } else if (this._rise && r <= 1e-4) {
      this._clearT = now - this._lastShotT;
      this._rise = false;
    }
    this._lastR = r;

    this._uiT -= dt;
    if (this._uiT <= 0) {
      this._uiT = 0.1;
      this.updateReadouts();
    }
  },

  /* ---------------- 事件 ---------------- */
  onTargetHit(t, dmg, part) {
    /* 靶子自己记账，这里只留个钩子，方便以后接命中统计 */
  },

  /* 墙上的弹孔：由 Game.impact 在无血时回调 */
  hole(x, y) {
    this.holes.push({ x, y, t: Game.time });
    if (this.holes.length > 500) this.holes.shift();
  },

  /* 子弹飞到最大射程消失的位置：判断射程够不够得着那面墙 */
  trailEnd(x, y) {
    this.ends.push({ x, y, t: Game.time });
    if (this.ends.length > 80) this.ends.shift();
  },

  clearMarks() {
    this.holes = [];
    this.ends = [];
    this._shots = [];
    this._peak = 0;
    this._clearT = 0;
    for (const t of this.targets) t.reset();
  },

  /* ---------------- 面板 ---------------- */
  initPanel() {
    if (this.panel || typeof document === 'undefined' || !document.createElement) return;
    const el = document.createElement('div');
    el.id = 'rangePanel';
    el.innerHTML = [
      '<div class="rg-top">',
      '  <b>靶场</b>',
      '  <span class="rg-hint">F2 收起 · F3 清弹孔</span>',
      '  <button class="rg-x" data-act="close" title="收起面板">×</button>',
      '</div>',
      '<div class="rg-guns"></div>',
      '<div class="rg-read"></div>',
      '<div class="rg-params"></div>',
      '<div class="rg-actions">',
      '  <button data-act="clear">清弹孔</button>',
      '  <button data-act="reset">重置本枪</button>',
      '  <button data-act="defaults">全部重置</button>',
      '  <button data-act="copy">复制 JSON</button>',
      '</div>',
      '<pre class="rg-json hidden"></pre>'
    ].join('\n');

    const frame = (document.getElementById && document.getElementById('frame')) || document.body;
    if (frame && frame.appendChild) frame.appendChild(el);
    this.panel = el;

    el.addEventListener('input', e => this.onInput(e));
    el.addEventListener('change', e => this.onInput(e));
    el.addEventListener('click', e => this.onClick(e));
    if (el.querySelector) {
      const guns = el.querySelector('.rg-guns');
      if (guns) {
        guns.innerHTML = Object.keys(WEAPONS).map(id =>
          '<button data-gun="' + id + '">' + (WEAPONS[id].short || WEAPONS[id].name) + '</button>'
        ).join('');
      }
      const read = el.querySelector('.rg-read');
      if (read) read.innerHTML = this.readoutsHtml();
      this._rpmEl = el.querySelector('[data-out="rpm"]');
      this._peakEl = el.querySelector('[data-out="peak"]');
      this._clearEl = el.querySelector('[data-out="clear"]');
      this._groupEl = el.querySelector('[data-out="group"]');
      this._barEl = el.querySelector('.rg-bar > i');
    }
    this.syncGunButtons();
    this.rebuildParams();
  },

  showPanel(on) {
    this.visible = on !== false;
    if (!this.panel) return;
    this.panel.classList.toggle('hidden', !this.visible);
    if (this.visible) this.refreshPanel();
  },

  togglePanel() { this.showPanel(!this.visible); },

  /* 数值改了、枪换了之后把面板整体刷一遍 */
  refreshPanel() {
    this.syncGunButtons();
    this.rebuildParams();
    this.updateReadouts();
  },

  readoutsHtml() {
    return [
      '<div class="rg-r"><span>实测射速</span><b data-out="rpm">—</b></div>',
      '<div class="rg-r"><span>后坐力峰值</span><b data-out="clear">—</b></div>',
      '<div class="rg-bar"><i></i></div>',
      '<div class="rg-r"><span>落点 / 散布</span><b data-out="group">—</b></div>'
    ].join('');
  },

  syncGunButtons() {
    if (!this.panel || !this.panel.querySelectorAll) return;
    const btns = this.panel.querySelectorAll('[data-gun]');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      const on = b.dataset.gun === this.curId;
      b.classList.toggle('on', on);
    }
  },

  rebuildParams() {
    if (!this.panel || !this.panel.querySelector) return;
    const box = this.panel.querySelector('.rg-params');
    if (!box) return;
    let html = '';
    let group = null;
    for (const p of RANGE_PARAMS) {
      if (p.group !== group) {
        if (group !== null) html += '</div></details>';
        html += '<details class="rg-grp" open><summary>' + p.group + '</summary><div class="rg-rows">';
        group = p.group;
      }
      html += this.paramHtml(p);
    }
    if (group !== null) html += '</div></details>';
    box.innerHTML = html;
  },

  paramHtml(p) {
    const v = this.dispVal(p);
    return '<div class="rg-row" data-row="' + p.key + '">' +
      '<span class="rg-lab">' + p.label + '</span>' +
      '<input class="rg-sl" type="range" data-p="' + p.key + '" min="' + p.min + '" max="' + p.max +
        '" step="' + p.step + '" value="' + v + '">' +
      '<input class="rg-num" type="number" data-p="' + p.key + '" min="' + p.min + '" max="' + p.max +
        '" step="' + p.step + '" value="' + v.toFixed(p.digits) + '">' +
      '<span class="rg-unit">' + (p.unit || '') + '</span>' +
      '</div>';
  },

  dispVal(p) {
    const raw = p.where === 'w' ? (this.w[this.curId] || {})[p.key] : this.g[p.key];
    const v = (typeof raw === 'number' ? raw : 0) * (p.mul || 1);
    return Math.round(v * Math.pow(10, p.digits)) / Math.pow(10, p.digits);
  },

  setDisp(p, display) {
    const raw = display / (p.mul || 1);
    if (p.where === 'w') {
      if (!this.w[this.curId]) this.w[this.curId] = Object.assign({}, RANGE_DEF_W[this.curId]);
      this.w[this.curId][p.key] = raw;
    } else {
      this.g[p.key] = raw;
    }
  },

  onInput(e) {
    const t = e.target;
    if (!t || !t.dataset || !t.dataset.p) return;
    const p = RANGE_PARAMS.find(x => x.key === t.dataset.p);
    if (!p) return;
    /* 数字框在打字中途不套用，等 change 再算，免得输 "0." 被夹成 0 */
    if (t.type === 'number' && e.type === 'input') return;
    let v = parseFloat(t.value);
    if (!isFinite(v)) return;
    v = U.clamp(v, p.min, p.max);
    this.setDisp(p, v);

    const row = t.parentElement;
    if (row && row.querySelector) {
      const sl = row.querySelector('.rg-sl'), num = row.querySelector('.rg-num');
      if (t === sl && num) num.value = this.dispVal(p).toFixed(p.digits);
      if (t === num && sl) sl.value = this.dispVal(p);
    }
    this.apply();
    this.save();
  },

  onClick(e) {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.gun) { this.equip(t.dataset.gun); return; }
    const act = t.dataset.act;
    if (!act) return;
    if (act === 'close') this.showPanel(false);
    if (act === 'clear') this.clearMarks();
    if (act === 'reset') {
      this.w[this.curId] = Object.assign({}, RANGE_DEF_W[this.curId]);
      this.apply();
      this.rebuildParams();
      this.save();
      Game.toast('已重置：' + (WEAPONS[this.curId].short || this.curId));
    }
    if (act === 'defaults') {
      for (const id in RANGE_DEF_W) this.w[id] = Object.assign({}, RANGE_DEF_W[id]);
      this.g = Object.assign({}, RANGE_DEF_G);
      this.apply();
      this.rebuildParams();
      this.save();
      Game.toast('全部参数已回到默认值');
    }
    if (act === 'copy') this.copyJson();
  },

  /* 只导出和默认值不一样的部分，贴回去就是一处改动 */
  exportJson() {
    const id = this.curId;
    const w = this.w[id], dw = RANGE_DEF_W[id];
    const wd = {}, gd = {};
    const r4 = v => Math.round(v * 10000) / 10000;
    for (const k in w) if (Math.abs(w[k] - dw[k]) > 1e-9) wd[k] = r4(w[k]);
    for (const k in this.g) if (Math.abs(this.g[k] - RANGE_DEF_G[k]) > 1e-9) gd[k] = r4(this.g[k]);
    return {
      weapon: id,
      weaponDiff: wd,
      recoil: gd
    };
  },

  copyJson() {
    const txt = JSON.stringify(this.exportJson(), null, 2);
    const show = () => {
      if (!this.panel || !this.panel.querySelector) return;
      const pre = this.panel.querySelector('.rg-json');
      if (!pre) return;
      pre.textContent = txt;
      pre.classList.remove('hidden');
      setTimeout(() => pre && pre.classList.add('hidden'), 6000);
    };
    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt);
        copied = true;
      }
    } catch (e) { copied = false; }
    if (!copied && typeof document !== 'undefined' && document.createElement) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); copied = true; } catch (e) { copied = false; }
      document.body.removeChild(ta);
    }
    show();
    Game.toast(copied ? '参数已复制' : '复制失败，参数见面板底部');
  },

  /* 面板读数：10Hz 刷新，别每帧改 DOM */
  updateReadouts() {
    if (!this.panel || !this.visible) return;
    const P = Game.player;
    if (!P) return;

    /* 实测射速：最近 20 发的时间戳反推 */
    let rpm = '—';
    const s = this._shots;
    if (s.length >= 2) {
      const span = s[s.length - 1] - s[0];
      if (span > 0.001) rpm = Math.round((s.length - 1) / span * 60);
    }
    if (this._rpmEl) this._rpmEl.textContent = rpm + (rpm === '—' ? '' : ' rpm');

    const peakPct = Math.round(U.clamp(P.recoil / Math.max(0.001, CFG.RECOIL.max), 0, 1) * 100);
    if (this._peakEl) {
      this._peakEl.textContent = this._peak > 0
        ? '峰值 ' + this._peak.toFixed(2) + ' · 回正 ' + (this._clearT > 0 ? this._clearT.toFixed(2) + 's' : '—')
        : '—';
    }
    if (this._barEl && this._barEl.style) this._barEl.style.width = peakPct + '%';

    if (this._groupEl) {
      const g = this.groupStats();
      this._groupEl.textContent = g
        ? g.n + ' 发 · 极值 ' + g.es.toFixed(0) + 'px · RMS ' + g.rms.toFixed(1) + 'px'
        : '—';
    }
  },

  /* 一组弹孔的统计：中心、RMS 半径、极值散布（最远两孔距离） */
  groupStats() {
    const hs = this.holes;
    const n = hs.length;
    if (!n) return null;
    let mx = 0, my = 0;
    for (const h of hs) { mx += h.x; my += h.y; }
    mx /= n; my /= n;
    let ss = 0;
    for (const h of hs) { const dx = h.x - mx, dy = h.y - my; ss += dx * dx + dy * dy; }
    let es = 0;
    const list = hs.length > 60 ? hs.slice(-60) : hs;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = U.dist(list[i].x, list[i].y, list[j].x, list[j].y);
        if (d > es) es = d;
      }
    }
    return { n, mx, my, rms: Math.sqrt(ss / n), es };
  },

  /* ---------------- 绘制 ---------------- */
  render(c, camX, camY) {
    const TS = CFG.TILE;
    const G = RANGE_GEO;

    /* --- 射击线与距离刻度 --- */
    const lx = G.lineX - camX;
    if (lx > -20 && lx < CFG.VIEW_W + 20) {
      c.save();
      c.strokeStyle = 'rgba(120,200,180,0.30)';
      c.lineWidth = 1;
      c.setLineDash([5, 5]);
      c.beginPath();
      c.moveTo(lx, 0); c.lineTo(lx, CFG.VIEW_H);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(140,210,190,0.55)';
      c.font = '9px monospace';
      c.textAlign = 'left';
      c.fillText('射击线', lx + 3, 12);
      c.restore();
    }

    /* 距离刻度：从射击线往东每 128px 一根短线 */
    c.save();
    c.font = '9px monospace';
    c.textAlign = 'center';
    for (let d = 128; d <= 640; d += 128) {
      const x = G.lineX + d - camX;
      if (x < -10 || x > CFG.VIEW_W + 10) continue;
      c.strokeStyle = 'rgba(150,190,180,0.16)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, G.centerY - camY - 7);
      c.lineTo(x, G.centerY - camY + 7);
      c.stroke();
      c.fillStyle = 'rgba(150,190,180,0.35)';
      c.fillText(String(d), x, G.centerY - camY - 12);
    }
    c.restore();

    /* --- 东墙上的环靶 --- */
    const wx = G.wallX - camX;
    if (wx > -80 && wx < CFG.VIEW_W + 80) {
      const cy = G.centerY - camY;
      c.save();
      c.lineWidth = 1.4;
      const rings = [[10, 'rgba(230,220,190,0.55)'], [22, 'rgba(230,220,190,0.34)'],
                     [34, 'rgba(230,220,190,0.22)'], [46, 'rgba(230,220,190,0.13)']];
      for (const [r, col] of rings) {
        c.strokeStyle = col;
        c.beginPath(); c.arc(wx - 6, cy, r, 0, 6.29); c.stroke();
      }
      c.strokeStyle = 'rgba(230,220,190,0.30)';
      c.beginPath();
      c.moveTo(wx - 6, cy - 52); c.lineTo(wx - 6, cy + 52);
      c.moveTo(wx - 58, cy); c.lineTo(wx + 46, cy);
      c.stroke();
      c.restore();
    }

    /* --- 射程尽头（空心圈） --- */
    for (const e of this.ends) {
      const a = U.clamp(1 - (Game.time - e.t) / 12, 0, 1);
      const sx = e.x - camX, sy = e.y - camY;
      c.strokeStyle = 'rgba(200,170,120,' + (0.35 * a) + ')';
      c.lineWidth = 1;
      c.beginPath(); c.arc(sx, sy, 2.6, 0, 6.29); c.stroke();
    }

    /* --- 弹孔 --- */
    for (const h of this.holes) {
      const sx = h.x - camX, sy = h.y - camY;
      if (sx < -4 || sx > CFG.VIEW_W + 4 || sy < -4 || sy > CFG.VIEW_H + 4) continue;
      const age = Game.time - h.t;
      const a = U.clamp(1.15 - age / 45, 0.25, 1);
      c.fillStyle = 'rgba(10,12,10,' + a + ')';
      c.beginPath(); c.arc(sx, sy, 1.9, 0, 6.29); c.fill();
      c.strokeStyle = 'rgba(240,230,200,' + (0.35 * a) + ')';
      c.lineWidth = 0.8;
      c.beginPath(); c.arc(sx, sy, 2.9, 0, 6.29); c.stroke();
    }

    /* --- 当前散布的可视化 --- */
    const P = Game.player;
    if (P && !P.dead) {
      const sp = P.weapon.pellets > 1 ? P.spread * 1.7 : P.spread;
      const len = 260;
      const cx = P.x - camX, cy = P.y - camY;
      c.save();
      c.strokeStyle = 'rgba(120,200,180,0.18)';
      c.lineWidth = 1;
      for (const s of [-1, 1]) {
        const a = P.angle + s * sp;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
        c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        c.stroke();
      }
      c.restore();
    }

    /* --- 钢板靶 --- */
    for (const t of this.targets) {
      const sx = t.x - camX, sy = t.y - camY;
      if (sx < -40 || sx > CFG.VIEW_W + 40 || sy < -40 || sy > CFG.VIEW_H + 40) continue;
      c.save();
      /* 支架 */
      c.strokeStyle = 'rgba(20,28,24,0.85)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(sx, sy + 6); c.lineTo(sx, sy + 15);
      c.stroke();
      /* 靶面 */
      c.fillStyle = t.flash > 0 ? '#f2efe2' : '#c8c3b0';
      c.beginPath(); c.arc(sx, sy, t.r, 0, 6.29); c.fill();
      c.lineWidth = 2;
      c.strokeStyle = t.flash > 0 ? '#fff6dc' : '#7d7768';
      c.beginPath(); c.arc(sx, sy, t.r, 0, 6.29); c.stroke();
      /* 靶心 */
      c.fillStyle = '#8d3a3a';
      c.beginPath(); c.arc(sx, sy, t.r * 0.34, 0, 6.29); c.fill();
      c.fillStyle = 'rgba(240,236,220,0.9)';
      c.beginPath(); c.arc(sx, sy, t.r * 0.13, 0, 6.29); c.fill();
      /* 距离标 */
      c.fillStyle = 'rgba(170,200,190,0.55)';
      c.font = '9px monospace';
      c.textAlign = 'center';
      c.fillText(t.label, sx, sy - t.r - 4);
      /* 命中飘字 */
      for (const p of t.pops) {
        c.globalAlpha = U.clamp(p.t / 0.85, 0, 1);
        c.fillStyle = '#f0d9a0';
        c.font = 'bold 10px monospace';
        c.fillText(String(p.d), p.x - camX, p.y - camY);
      }
      c.restore();
      c.globalAlpha = 1;
    }
  }
};

/* 靶场按键：F2 面板、F3 清弹孔、F4 靶子复位 */
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', e => {
    if (!Range.active) return;
    const k = e.key;
    if (k === 'F2') { e.preventDefault(); Range.togglePanel(); }
    if (k === 'F3') { e.preventDefault(); Range.clearMarks(); Game.toast('弹孔与统计已清空'); }
    if (k === 'F4') { e.preventDefault(); for (const t of Range.targets) t.reset(); Game.toast('靶子已复位'); }
  });
}
