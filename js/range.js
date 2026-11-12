/* ============================================================
   开发者靶场
   ------------------------------------------------------------
   入口：index.html#range
   一张只有靶子、一面落点墙的空房间，右侧是实时调参面板（F2 开关）。

   能调的东西（七项，全部即时生效，不用刷新）：
     射速 / 瞄准时间 / 纵向后坐力 × / 横向后坐力 × /
     连射扩散增长 × / 基础散布 ×
   底层物理常量（两轴冲击、上限、回正延迟、散布半衰期与基准）都在
   js/config.js 的 CFG.RECOIL 里，不上面板；枪只存倍率，最终值由 Firearms.derive() 相乘。

   战斗测试台（2026-11-09 起，与战斗系统 V1 及最新敌人数值同步）：
     敌人靶  5 种敌人按 ENEMY_TYPES 的最新 HP／护甲／材质生成可击杀目标，
             护甲可切「实战规则 / 无甲 / Lv1–6」；结算走 Combat.resolve 纯函数，
             穿透、钝伤、磨甲与实战一致，并记录击杀枪数。钢板靶仍是默认。
     弹药    当前枪口径 Lv1–Lv5（12 Gauge 走 SHOTGUN_COMPAT），切换即换满弹匣。
     配件    逐槽位列出兼容件，装/卸即时生效；不扣款、不动库存、不写存档。
     数值表  5 种敌人最新 HP 与当前口径 5 级的固定 B/P。

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
   地图：一条 96×17 的直走廊，东墙就是落点墙。
   1 格 = 32px，射击线与近距靶位保持不变，到东墙 2800px。
   ------------------------------------------------------------ */
const RANGE_MAP = (() => {
  const W = 96, H = 17;
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
    this.r = CFG.P.RADIUS;  // 与实战角色同尺寸
    this.headR = CFG.COMBAT.HEAD_RADIUS;
    this.label = label || '';
    this.dead = false;       // 永远打不坏
    this.isRangeTarget = true;
    this.flash = 0;
    this.hits = 0;
    this.headHits = 0;
    this.dmg = 0;
    this.pops = [];
  }

  /* 钢板靶不吃护甲。Bullet.resolveHit 传的是 7 参（第 6 是致伤 meta，
     第 7 才是距离衰减 mul），早期按 6 参写会把 meta 当成倍率算出 NaN。 */
  hurt(d, fromFaction, part, pen, damageType, meta, mul) {
    const head = part === 'head';
    const dealt = d * (head ? CFG.COMBAT.HEAD_MULT : 1) * (mul == null ? 1 : mul); // 无头盔、无护甲
    this.flash = 0.13;
    this.hits++;
    if (head) this.headHits++;
    this.dmg += dealt;
    this.pops.push({ d: Math.round(dealt), head, t: 0.85, x: this.x + U.rand(-3, 3), y: this.y - 13 });
    if (this.pops.length > 6) this.pops.shift();
    if (typeof Range !== 'undefined') Range.onTargetHit(this, dealt, part);
    return dealt;
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    for (const p of this.pops) { p.t -= dt; p.y -= 24 * dt; }
    if (this.pops.length && this.pops[0].t <= 0) this.pops = this.pops.filter(p => p.t > 0);
  }

  reset() { this.headHits = 0; this.hits = 0; this.dmg = 0; this.pops.length = 0; this.flash = 0; }
}

/* ------------------------------------------------------------
   敌人靶：按 ENEMY_TYPES 的最新 HP / 护甲 / 材质生成的可击杀目标。
   与钢板靶共用 Bullet.targets() 这条路径，但不带 AI、不掉物、不写存档；
   结算走 Combat.resolve() 纯函数 + applyDurability()，所以穿透、钝伤、
   磨甲和实战完全一致。顶层不引用 data.js / combat.js 的全局，保证
   tools/test-range-headshots.js 那种只加载三个文件的 vm 也能解析。
   ------------------------------------------------------------ */
const RANGE_ARMOR_MODES = ['live', 'none', '1', '2', '3', '4', '5', '6'];

class RDummy {
  constructor(key, x, y, label, armorMode) {
    const types = (typeof ENEMY_TYPES !== 'undefined') ? ENEMY_TYPES : {};
    const t = types[key] || null;
    this.key = key;
    this.t = t;
    this.x = x; this.y = y;
    this.r = CFG.P.RADIUS;
    this.headR = CFG.COMBAT.HEAD_RADIUS;
    this.label = label || '';
    this.isRangeTarget = false;   // 按活体算：喷血、走 Game.popDamage 飘字
    this.isEnemyDummy = true;
    this.armorMode = armorMode || 'live';
    this.maxHp = t ? t.hp : 100;
    this.hp = this.maxHp;
    this.dead = false;
    this.flash = 0;
    this.hits = 0; this.headHits = 0; this.dmg = 0;
    this.shotsToKill = 0;
    this.pops = [];
    this.lastRes = null;
    this.rollArmor();
  }

  /* live = 与实战同规则（一次掷等级 + 穿戴概率）；固定档 = 头甲整套同等级。
     这样同一把枪、同一级弹就能逐档量出穿透临界与击杀枪数。 */
  rollArmor() {
    this.helmet = null; this.body = null; this.gearLv = 0;
    if (typeof GEAR === 'undefined' || !this.t || this.armorMode === 'none') {
      this.baseArmor = { helmet: null, body: null };
      return;
    }
    let lv;
    if (this.armorMode === 'live') {
      const rows = this.t.levels || [[1, 100]];
      let roll = Math.random() * rows.reduce((n, r) => n + r[1], 0);
      lv = rows[0][0];
      for (const [candidate, weight] of rows) { roll -= weight; if (roll <= 0) { lv = candidate; break; } }
      this.helmet = Math.random() < (this.t.helmetChance || 0) ? GEAR.random('helmet', lv) : null;
      this.body = Math.random() < (this.t.bodyChance || 0) ? GEAR.random('body', lv) : null;
    } else {
      lv = U.clamp(Number(this.armorMode) || 1, 1, 6);
      this.helmet = GEAR.random('helmet', lv);
      this.body = GEAR.random('body', lv);
    }
    this.gearLv = lv;
    /* 实战里看守／回收员的甲不是满耐久，靶场对齐 60%~90% */
    if (this.t.tactical && this.key !== 'scav') {
      for (const g of [this.helmet, this.body]) if (g) g.dur = g.max * (0.6 + Math.random() * 0.3);
    }
    this.baseArmor = {
      helmet: this.helmet ? Object.assign({}, this.helmet) : null,
      body: this.body ? Object.assign({}, this.body) : null
    };
  }

  armorOf(part) { return part === 'head' ? this.helmet : this.body; }

  /* 签名与 Bullet.resolveHit 的 7 参一致：B / 阵营 / 部位 / P / 伤害类型 / meta / 距离衰减 */
  hurt(B, fromFaction, part, P, damageType, meta, mul) {
    if (this.dead || typeof Combat === 'undefined') return 0;
    const res = Combat.resolve({
      B, P, part, armor: this.armorOf(part),
      mul: (mul == null ? 1 : mul)
    });
    Combat.applyDurability(res);          // 唯一耐久写回，穿透成功也磨甲
    const dealt = res.health;
    this.hp = Math.max(0, this.hp - dealt);
    this.hits++;
    if (part === 'head') this.headHits++;
    this.dmg += dealt;
    this.flash = 0.13;
    this.lastRes = res;
    if (this.hp <= 0) { this.dead = true; this.shotsToKill = this.hits; }
    if (typeof Range !== 'undefined') Range.onDummyHit(this, res);
    return dealt;
  }

  update(dt) { this.flash = Math.max(0, this.flash - dt); }

  reset() {
    this.hp = this.maxHp;
    this.dead = false;
    this.hits = 0; this.headHits = 0; this.dmg = 0; this.shotsToKill = 0;
    this.flash = 0; this.lastRes = null;
    for (const k of ['helmet', 'body'])
      if (this.baseArmor && this.baseArmor[k] && this[k]) Object.assign(this[k], this.baseArmor[k]);
  }
}

/* ------------------------------------------------------------
   可调参数表：只保留七项。
   ------------------------------------------------------------
   纵向冲击 3.4px、横向冲击 2.4px、水平随机 ±0.9px、两轴上限/回正、
   连射增长 0.075、基础散布 0.040 / 满散布 0.260 —— 全部是全局常量，
   写在 js/config.js 的 CFG.RECOIL 里，随时可改，但不进这块面板。
   枪只存倍率，最终值由 Firearms.derive() 相乘得到。
   ------------------------------------------------------------ */
const RANGE_PARAMS = [
  { group: '射击手感', key: 'rpm',             label: '射速',         unit: 'RPM', min: 30,   max: 1200, step: 5,    digits: 0 },
  { group: '射击手感', key: 'aimTime',         label: '瞄准时间',     unit: 's',   min: 0.05, max: 1.2,  step: 0.01, digits: 2 },
  { group: '射击手感', key: 'recoilVMul',      label: '纵向后坐力',   unit: '×',   min: 0.1,  max: 3,    step: 0.01, digits: 2 },
  { group: '射击手感', key: 'recoilHMul',      label: '横向后坐力',   unit: '×',   min: 0.1,  max: 3,    step: 0.01, digits: 2 },
  { group: '射击手感', key: 'spreadGrowthMul', label: '连射扩散增长', unit: '×',   min: 0.1,  max: 3,    step: 0.01, digits: 2 },
  { group: '射击手感', key: 'spreadMul',       label: '基础散布',     unit: '×',   min: 0.2,  max: 2.5,  step: 0.01, digits: 2 },
  { group: '射击手感', key: 'adsPrecisionMul', label: '瞄准散布倍率', unit: '×',   min: 0.05, max: 1, step: 0.01, digits: 2 }
];

/* 默认值快照：必须在任何调参之前取，重置就是回到这里 */
const RANGE_DEF_W = (() => {
  const out = {};
  for (const id in WEAPONS) {
    const d = WEAPONS[id];
    out[id] = {
      rpm: d.rpm,
      aimTime: d.aimTime,
      recoilVMul: d.recoilVMul != null ? d.recoilVMul : 1,
      recoilHMul: d.recoilHMul != null ? d.recoilHMul : 1,
      spreadGrowthMul: d.spreadGrowthMul != null ? d.spreadGrowthMul : 1,
      spreadMul: d.spreadMul != null ? d.spreadMul : 1,
      adsPrecisionMul: d.adsPrecisionMul ?? ({pistol:.65,smg:.70,rifle:.50,dmr:.30,sniper:.15,shotgun:.70,lmg:.60}[d.category]??.50)
    };
  }
  return out;
})();

const RANGE_STORE_KEY = 'tide.range.tune.v2';
const RANGE_STORE_KEY_V1 = 'tide.range.tune.v1';

const Range = {
  active: false,
  preciseHits: true, // 默认与实战一致；旧版仅供靶场对照，不写入武器调参
  panel: null,
  visible: true,
  curId: 'm4a1',

  /* 战斗测试台：敌人靶类型 / 护甲档 / 弹药等级 / 配件槽位。
     'none' = 原来的钢板靶；其余按 ENEMY_TYPES 的最新定义生成可击杀目标。 */
  dummyKey: 'none',
  dummyArmor: 'live',
  ammoLv: 1,
  partSlot: 'optic',
  lastRes: null,

  w: {},          // 每把枪的七项调参值

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
    this.preciseHits = true;
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
    this.equip(this.w[this.curId] ? this.curId : 'm4a1');
    this.refreshPanel();
    this.showPanel(true);
    this.initAudio();

    Game.toast('靶场：瞄准金色靶心测试爆头 ×1.5；F2 面板 / F4 复位');
    Game.update(1 / 60);
    Game.render();
  },

  /* 靶场靠 URL 直插进来，没经过开始界面那一下点击，音频上下文根本不会建；
     就算建了也是 suspended，听上去跟"没加载音效"一模一样。
     具体逻辑在 SFX.armFirstGesture()：#play 直插也用同一套，别各写一份。 */
  initAudio() {
    if (typeof SFX === 'undefined' || !SFX || typeof SFX.armFirstGesture !== 'function') return false;
    SFX.armFirstGesture();
    return true;
  },

  exit() {
    this.active = false;
    Game.rangeMode = false;
    /* 调参只作用在这局临时武器上，CFG.RECOIL 一个数都没动，无需还原 */
    if (this.panel) this.panel.classList.add('hidden');
    this.targets = [];
    Game.targets = [];
    this.lastRes = null;
  },

  spawnTargets() {
    const TS = RANGE_GEO.TS;
    const list = [];
    /* 距离用「到射击线的直线距离」标注，方便对表 */
    const put = (tx, ty) => {
      const x = tx * TS + TS / 2, y = ty * TS + TS / 2;
      const d = Math.round(U.dist(x, y, RANGE_GEO.spawn.x, RANGE_GEO.spawn.y));
      const tag = d + 'px';
      list.push(this.dummyKey === 'none'
        ? new RTarget(x, y, tag)
        : new RDummy(this.dummyKey, x, y, tag, this.dummyArmor));
    };
    put(12, 5); put(12, 12);
    put(16, 5); put(16, 12);
    put(20, 8);
    put(22, 4); put(22, 13);
    return list;
  },

  /* 换靶型 / 换护甲档：重新生成整套靶子，同时清掉旧弹孔与统计 */
  setDummy(key, armor) {
    if (key !== undefined) this.dummyKey = key;
    if (armor !== undefined) this.dummyArmor = armor;
    this.targets = this.spawnTargets();
    Game.targets = this.targets;
    this.lastRes = null;
    this.clearMarks();
    this.refreshPanel();
    this.save();
    const name = this.dummyKey === 'none' ? '钢板靶'
      : (ENEMY_TYPES[this.dummyKey] || {}).name || this.dummyKey;
    Game.toast('靶子：' + name + ' · 护甲 ' + this.armorLabel());
  },

  armorLabel() {
    return this.dummyArmor === 'live' ? '实战规则'
      : this.dummyArmor === 'none' ? '无甲' : 'Lv' + this.dummyArmor;
  },

  onDummyHit(t, res) { this.lastRes = res; },

  /* ---------------- 数值读写 ---------------- */
  load() {
    let saved = null, legacy = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(RANGE_STORE_KEY);
        if (raw) saved = JSON.parse(raw);
        else {
          /* 没写过 v2 才读 v1，避免每次进靶场都重复折算 */
          const old = localStorage.getItem(RANGE_STORE_KEY_V1);
          if (old) legacy = JSON.parse(old);
        }
      }
    } catch (e) { saved = null; legacy = null; }

    this.w = {};
    for (const id in RANGE_DEF_W) {
      const base = Object.assign({}, RANGE_DEF_W[id]);
      const s = saved && saved.w && (saved.w[id]||saved.w[Object.keys(WEAPON_ALIASES).find(k=>WEAPON_ALIASES[k]===id)]);
      if (s) for (const k in base) if (typeof s[k] === 'number' && isFinite(s[k])) base[k] = s[k];
      this.w[id] = base;
    }
    /* 旧版（v1）调参是世界单位 + 一堆全局滑块：只把还能对应上的折算成倍率，
       全局滑块一律丢弃（它们现在是 CFG.RECOIL 常量，不再逐局覆盖）。 */
    if (legacy) this.migrateV1(legacy);
    if (saved && typeof saved.cur === 'string' && this.w[canonicalWeaponId(saved.cur)]) this.curId = canonicalWeaponId(saved.cur);
    /* 战斗测试台的选择跨刷新保留；旧存档没有这些字段时全部走默认值 */
    if (saved && typeof saved.dummyKey === 'string') this.dummyKey = saved.dummyKey;
    if (saved && RANGE_ARMOR_MODES.indexOf(saved.dummyArmor) >= 0) this.dummyArmor = saved.dummyArmor;
    if (saved && Number.isFinite(saved.ammoLv)) this.ammoLv = U.clamp(Math.round(saved.ammoLv), 1, 5);
    if (saved && typeof saved.partSlot === 'string') this.partSlot = saved.partSlot;
  },

  /* v1 → v2：每发后坐力、基础散布按旧基准折成倍率；射速保留，其余字段退休 */
  migrateV1(legacy) {
    const r3 = v => Math.round(v * 1000) / 1000;
    for (const id in this.w) {
      const s = legacy.w && (legacy.w[id] || legacy.w[Object.keys(WEAPON_ALIASES).find(k=>WEAPON_ALIASES[k]===id)]);
      if (!s) continue;
      if (Number.isFinite(s.rpm)) this.w[id].rpm = s.rpm;
      if (Number.isFinite(s.recoilPerShot)) this.w[id].spreadGrowthMul = r3(s.recoilPerShot / CFG.RECOIL.perShot);
      if (Number.isFinite(s.spreadBase)) this.w[id].spreadMul = r3(s.spreadBase / CFG.RECOIL.spreadBase);
    }
  },

  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(RANGE_STORE_KEY, JSON.stringify({
        w: this.w, cur: this.curId,
        dummyKey: this.dummyKey, dummyArmor: this.dummyArmor,
        ammoLv: this.ammoLv, partSlot: this.partSlot
      }));
    } catch (e) { /* 存不了就算了，不影响调试 */ }
  },

  /* 把七项调参值写进这一局的枪。
     先拿「原厂枪 + 调参值」当基准，再让配件在它上面派生 ——
     所以配件和调参同时生效，不再互相覆盖（旧版配件数值不生效就死在这）。 */
  apply() {
    const P = Game.player;
    if (!P || !P.weapon) return;
    this.install(P.weapon.id);
    P.syncSpread();
  },

  install(id) {
    const P = Game.player;
    if (!P) return null;
    const cur = P.weapons[P.slot];
    if (!cur || cur.id !== id) return null;
    const tuned = this.w[id];
    const base = tuned ? Object.assign({}, WEAPONS[id], tuned) : WEAPONS[id];
    const next = (typeof Attachments !== 'undefined')
      ? Attachments.resolve(id, cur.attachments || {}, base)
      : Object.assign({}, base);
    if (!next) return null;
    const n = Math.min(P.mag, next.mag);
    Object.assign(next, {
      magCur: n, ammo: cur.ammo,
      rounds: magazineRounds(next, n, cur.ammo),
      fireMode: cur.fireMode, cycleRemaining: cur.cycleRemaining
    });
    P.weapons[P.slot] = next;
    P.mag = n;
    return next;
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
    id=canonicalWeaponId(id);
    const P = Game.player;
    if (!P || !WEAPONS[id]) return;
    let idx = -1;
    for (let i = 0; i < P.weapons.length; i++) if (P.weapons[i] && P.weapons[i].id === id) idx = i;
    if (idx < 0) {
      Gunplay.cancel(P,true);
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
    this.setAmmoLevel(this.ammoLv);
    this.syncGunButtons();
    this.rebuildParams();
    this.save();
  },

  /* ---------------- 战斗测试台：弹药等级 / 配件调试改装 ---------------- */

  /* 只切当前枪口径的等级，口径不可混用；12 Gauge 走 SHOTGUN_COMPAT。 */
  setAmmoLevel(lv) {
    const P = Game.player;
    if (!P || !P.weapon) return;
    lv = U.clamp(Math.round(Number(lv) || 1), 1, 5);
    const W = P.weapon, cal = W.caliber;
    const item = (typeof ammoItem === 'function' ? ammoItem(cal, lv) : null)
      || (typeof defaultAmmo === 'function' ? defaultAmmo(cal) : null);
    if(!item)return;
    lv=item.level;
    const id = item ? item.id : BALLISTICS.ammoId(cal, lv);
    if (!id) return;
    this.ammoLv = lv;
    W.ammo = id;
    W.magCur = W.mag;
    W.rounds = magazineRounds(W, W.mag, id);
    P.mag = W.mag;
    P.reloadT = 0;
    Game.bullets = [];          // 清掉在途旧弹，别把两级弹混在同一轮统计里
    this.refreshPanel();
    this.save();
    const spec = BALLISTICS.flesh(cal, lv);
    Game.toast('弹药 Lv' + lv + ' · ' + BALLISTICS.caliberName(cal) + ' · B' + spec.B + ' / P' + spec.P);
  },

  /* 调试态改装：复用 Attachments.resolve 的纯派生。
     不扣款、不动库存、不写存档。基准用「原厂枪 + 当前调参值」，
     所以改装效果立即反映到手感，且不会把调参冲掉。 */
  setPart(slot, id) {
    const P = Game.player;
    if (!P || !P.weapon || typeof Attachments === 'undefined') return;
    const W = P.weapon;
    const parts = Object.assign({}, W.attachments || {});
    if (id) parts[slot] = id; else delete parts[slot];
    const base = Object.assign({}, WEAPONS[W.id], this.w[W.id] || {});
    const next = Attachments.resolve(W.id, parts, base);
    if (!next) return;
    const n = Math.min(P.mag, next.mag);
    Object.assign(next, {
      magCur: n, ammo: W.ammo,
      rounds: magazineRounds(next, n, W.ammo),
      fireMode: W.fireMode, cycleRemaining: W.cycleRemaining
    });
    P.weapons[P.slot] = next;
    P.mag = n;
    P.reloadT = 0;
    P.syncSpread();
    this.refreshPanel();
    const d = id && ATTACHMENT_DEFS[id];
    Game.toast((d ? d.name : '拆卸 ' + (Attachments.slotNames[slot] || slot)) + ' · 即时生效（不影响存档）');
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

    /* 后坐力遥测与实际击发计数分开：延迟后坐力的高速两连发仍记两发。 */
    const r = P.recoil;
    if (r > this._lastR + 1e-5) {
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
  onGunShot() {
    this._shots.push(Game.time);
    if(this._shots.length>30)this._shots.shift();
    this._lastShotT=Game.time;
  },
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

  /* ---------------- 战斗测试台面板 ---------------- */
  rgEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
      ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  },

  rebuildLoadout() {
    if (!this.panel || !this.panel.querySelector) return;
    const box = k => this.panel.querySelector('[data-box="' + k + '"]');
    const dummy = box('dummy'), ammo = box('ammo'), parts = box('parts'), data = box('data');
    if (dummy) dummy.innerHTML = this.dummyHtml();
    if (ammo) ammo.innerHTML = this.ammoHtml();
    if (parts) parts.innerHTML = this.partsHtml();
    if (data) data.innerHTML = this.dataHtml();
  },

  dummyHtml() {
    const types = (typeof ENEMY_TYPES !== 'undefined') ? ENEMY_TYPES : {};
    const keys = ['none'].concat(Object.keys(types));
    let html = '<div class="rg-line">' + keys.map(k =>
      '<button data-dummy="' + k + '" class="' + (k === this.dummyKey ? 'on' : '') + '">' +
      this.rgEsc(k === 'none' ? '钢板靶' : (types[k].name || k)) + '</button>').join('') + '</div>';
    html += '<div class="rg-line">' + RANGE_ARMOR_MODES.map(m =>
      '<button data-armor="' + m + '" class="' + (m === this.dummyArmor ? 'on' : '') + '">' +
      (m === 'live' ? '实战' : m === 'none' ? '无甲' : 'Lv' + m) + '</button>').join('') + '</div>';
    html += '<div class="rg-table">'
      + '<div class="rg-r"><span>靶子状态</span><b data-out="dummy">—</b></div>'
      + '<div class="rg-r"><span>最近一发</span><b data-out="lastshot">—</b></div>'
      + '</div>';
    html += '<div class="rg-line"><button data-act="dummy-reset">复位靶子（F4）</button></div>';
    html += '<div class="rg-tip">HP／护甲／材质读自 ENEMY_TYPES 与 GEAR；结算走 Combat.resolve：'
      + '穿透吃全额 B，未穿透只吃 0.08×B×Kb 钝伤，穿透成功一样磨甲。</div>';
    return html;
  },

  ammoHtml() {
    const W = Game.player && Game.player.weapon;
    const cal = W && W.caliber;
    let html = '<div class="rg-line">' + BALLISTICS.levels(cal).map(lv =>
      '<button data-ammo="' + lv + '" class="' + (lv === this.ammoLv ? 'on' : '') + '">Lv' + lv + '</button>').join('') + '</div>';
    if (cal && typeof BALLISTICS !== 'undefined') {
      const spec = BALLISTICS.flesh(cal, this.ammoLv);
      html += '<div class="rg-table">'
        + '<div class="rg-r"><span>口径</span><b>' + this.rgEsc(BALLISTICS.caliberName(cal)) + '</b></div>'
        + '<div class="rg-r"><span>当前 Lv' + this.ammoLv + '</span><b>B ' + spec.B + ' / P ' + spec.P + '</b></div>'
        + '</div>';
      html += '<div class="rg-tip">' + BALLISTICS.levels(cal).map(lv => {
        const s = BALLISTICS.flesh(cal, lv);
        return 'Lv' + lv + ' ' + s.B + '/' + s.P;
      }).join(' · ') + '</div>';
    }
    html += '<div class="rg-tip">切换即换满弹匣并清空在途子弹；只允许同口径。</div>';
    return html;
  },

  partsHtml() {
    const W = Game.player && Game.player.weapon;
    if (!W || typeof ATTACHMENT_DEFS === 'undefined' || typeof Attachments === 'undefined')
      return '<div class="rg-tip">当前无枪</div>';
    const slots = (typeof ATTACHMENT_SLOTS !== 'undefined') ? ATTACHMENT_SLOTS : Object.keys(Attachments.slotNames);
    const installed = W.attachments || {};
    const names = Attachments.slotNames || {};
    let html = '<div class="rg-slots">' + slots.map(s => {
      const disabled = !W.attachmentSlots || !W.attachmentSlots[s];
      return '<button data-slot="' + s + '" class="' + (s === this.partSlot ? 'on ' : '') +
        (installed[s] ? 'installed' : '') + '"' + (disabled ? ' disabled' : '') + '>' +
        this.rgEsc(names[s] || s) + '</button>';
    }).join('') + '</div>';
    const ids = Object.values(ATTACHMENT_DEFS)
      .filter(d => Attachments.compatible(W.id, d.id, this.partSlot));
    html += '<div class="rg-parts">'
      + '<button data-part="" class="' + (installed[this.partSlot] ? '' : 'on') + '">原装／拆卸</button>'
      + ids.map(d => '<button data-part="' + d.id + '" class="' +
        (installed[this.partSlot] === d.id ? 'on' : '') + '">' +
        this.rgEsc(d.name) + '<small>' +
        this.rgEsc(Attachments.describe(d.id) || '无属性修正') + '</small></button>').join('')
      + '</div>';
    html += '<div class="rg-table">'
      + '<div class="rg-r"><span>弹匣 / 基础散布</span><b>' + W.mag + ' 发 · ' +
        (Firearms.derive(W).spreadBase * 180 / Math.PI).toFixed(2) + '°</b></div>'
      + '<div class="rg-r"><span>瞄准 / 重量</span><b>' + W.aimTime.toFixed(2) + 's · ' +
        W.w.toFixed(2) + 'kg</b></div>'
      + '</div>';
    html += '<div class="rg-tip">调试改装：即时生效，不扣款、不动库存、不写存档；'
      + '改装与七项调参同时生效。</div>';
    return html;
  },

  dataHtml() {
    const types = (typeof ENEMY_TYPES !== 'undefined') ? ENEMY_TYPES : {};
    let html = '<div class="rg-table">' + Object.entries(types).map(([k, t]) =>
      '<div class="rg-r"><span>' + this.rgEsc(t.name) + '</span><b>' + t.hp + ' HP · ' +
      (t.human ? '有甲' : '无甲') + '</b></div>').join('') + '</div>';
    const W = Game.player && Game.player.weapon;
    if (W && W.caliber && typeof BALLISTICS !== 'undefined') {
      html += '<div class="rg-tip">' + this.rgEsc(BALLISTICS.caliberName(W.caliber)) + '：' +
        BALLISTICS.levels(W.caliber).map(lv => {
          const s = BALLISTICS.flesh(W.caliber, lv);
          return 'Lv' + lv + ' B' + s.B + '/P' + s.P;
        }).join(' · ') + '</div>';
    }
    html += '<div class="rg-tip">A=10L−10(1−D/Dmax) · H=穿透?B:0.08·B·Kb · '
      + 'ΔD=min[D, B(0.035+0.009P)·Kd]。</div>';
    return html;
  },

  /* ---------------- 面板 ---------------- */
  initPanel() {
    if (this.panel || typeof document === 'undefined' || !document.createElement) return;
    const el = document.createElement('div');
    el.id = 'rangePanel';
    el.innerHTML = [
      '<div class="rg-top">',
      '  <b>靶场</b>',
      '  <span class="rg-hint">F2 收起 · F3 清弹孔 · 七项手感</span>',
      '  <button class="rg-x" data-act="close" title="收起面板">×</button>',
      '</div>',
      '<div class="rg-guns"></div>',
      '<div class="rg-params"></div>',
      '<details class="rg-grp" open><summary>敌人靶 · 最新数据</summary><div class="rg-loadout" data-box="dummy"></div></details>',
      '<details class="rg-grp" open><summary>弹药等级</summary><div class="rg-loadout" data-box="ammo"></div></details>',
      '<details class="rg-grp" open><summary>配件改装</summary><div class="rg-loadout" data-box="parts"></div></details>',
      '<details class="rg-grp"><summary>战斗数值表</summary><div class="rg-loadout" data-box="data"></div></details>',
      '<div class="rg-read"></div>',
      '<details class="rg-grp" open><summary>爆头试验</summary>',
      '  <div class="rg-sfx">',
      '    <div class="rg-sfx-btns"><button data-act="hit-mode">判定：新版</button></div>',
      '    <div class="rg-r"><span>爆头 / 命中</span><b data-out="heads">0 / 0</b></div>',
      '    <div class="rg-sfx-tip">瞄准金色靶心 · 爆头 ×1.5 · 无盔甲<br>新版与实战一致 · 爆头半径 3px<br>切换判定清空统计 · F4 复位</div>',
      '  </div>',
      '</details>',
      '<details class="rg-grp" open><summary>音效试听</summary>',
      '  <div class="rg-sfx">',
      '    <div class="rg-r"><span>采样</span><b data-out="sfx">—</b></div>',
      '    <div class="rg-tip" data-out="suppressor">当前枪械消音试听 · 仅靶场</div>',
      '    <div class="rg-sfx-btns rg-suppressor-ab">',
      '      <button data-act="suppressor-load">为当前枪械装配消音器</button>',
      '      <button data-sfx="suppression-dry">原声单发</button>',
      '      <button data-sfx="suppression-suppressed">消音单发</button>',
      '      <button data-sfx="suppression-dry-burst">原声三连</button>',
      '      <button data-sfx="suppression-suppressed-burst">消音三连</button>',
      '    </div>',
      '    <div class="rg-sfx-btns">',
      '      <button data-sfx="gunshot">枪声</button>',
      '      <button data-sfx="switch">切枪</button>',
      '      <button data-sfx="reload">换弹</button>',
      '      <button data-sfx="step">脚步</button>',
      '      <button data-sfx="hit">命中</button>',
      '      <button data-sfx="headshot">爆头</button>',
      '      <button data-sfx="hurt">受伤</button>',
      '      <button data-sfx="dodge">闪避</button>',
      '      <button data-sfx="melee">近战</button>',
      '      <button data-sfx="melee_hit_small">小刀命中</button>',
      '      <button data-sfx="melee_hit_medium">中刀命中</button>',
      '      <button data-sfx="melee_hit_large">砍刀命中</button>',
      '      <button data-sfx="melee_hit_stab">刺击命中</button>',
      '      <button data-sfx="sell">出售</button>',
      '    </div>',
      '    <div class="rg-sfx-tip">枪声走真实采样轮换，与游戏内同一条链路</div>',
      '  </div>',
      '</details>',
      '<div class="rg-actions">',
      '  <button data-act="clear">清弹孔</button>',
      '  <button data-act="reset">重置本枪</button>',
      '  <button data-act="defaults">全部重置</button>',
      '  <button data-act="copy">复制 JSON</button>',
      '  <button data-act="export" title="下载 tide-tune.json，可用 tools/apply-tune.js 写回配置">导出 .json</button>',
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
      this._headsEl = el.querySelector('[data-out="heads"]');
      this._hitModeEl = el.querySelector('[data-act="hit-mode"]');
      this._rpmEl = el.querySelector('[data-out="rpm"]');
      this._peakEl = el.querySelector('[data-out="peak"]');
      this._clearEl = el.querySelector('[data-out="clear"]');
      this._groupEl = el.querySelector('[data-out="group"]');
      this._axesEl = el.querySelector('[data-out="axes"]');
      this._sfxEl = el.querySelector('[data-out="sfx"]');
      this._barEl = el.querySelector('.rg-bar > i');
    }
    this.syncGunButtons();
    this.rebuildParams();
    this.rebuildLoadout();
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
    this.rebuildLoadout();
    this.updateReadouts();
  },

  readoutsHtml() {
    return [
      '<div class="rg-r"><span>实测射速</span><b data-out="rpm">—</b></div>',
      '<div class="rg-r"><span>后坐力峰值</span><b data-out="clear">—</b></div>',
      '<div class="rg-bar"><i></i></div>',
      '<div class="rg-r"><span>准星偏移</span><b data-out="axes">—</b></div>',
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
    html += this.derivedHtml();
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

  /* 七项调参下方实时显示派生出来的物理绝对值：
     改的是倍率，看到的是真正的冲击像素与散布角度。 */
  derivedHtml() {
    const W = Game.player && Game.player.weapon;
    if (!W || typeof Firearms === 'undefined') return '';
    const d = Firearms.derive(W);
    const deg = v => (v * 180 / Math.PI).toFixed(2) + '°';
    return '<div class="rg-table rg-derived">'
      + '<div class="rg-r"><span>纵向冲击</span><b>' + d.vKick.toFixed(2) + ' px</b></div>'
      + '<div class="rg-r"><span>横向冲击</span><b>' + d.hKick.toFixed(2) + ' px</b></div>'
      + '<div class="rg-r"><span>连射增长</span><b>' + d.growth.toFixed(4) + ' /发</b></div>'
      + '<div class="rg-r"><span>基础 → 满散布</span><b>' + deg(d.spreadBase) + ' → ' + deg(d.spreadMax) + '</b></div>'
      + '<div class="rg-tip">全局基准：' + CFG.RECOIL.axis.v.kick + ' / ' + CFG.RECOIL.axis.h.kick +
        ' px · ' + CFG.RECOIL.perShot + ' /发 · ' + CFG.RECOIL.spreadBase + ' → ' +
        CFG.RECOIL.spreadMax + ' rad（改 config.js 生效）</div>'
      + '</div>';
  },

  dispVal(p) {
    const raw = (this.w[this.curId] || {})[p.key];
    const v = typeof raw === 'number' ? raw : 0;
    return Math.round(v * Math.pow(10, p.digits)) / Math.pow(10, p.digits);
  },

  setDisp(p, display) {
    if (!this.w[this.curId]) this.w[this.curId] = Object.assign({}, RANGE_DEF_W[this.curId]);
    this.w[this.curId][p.key] = display;
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
    this.refreshDerived();
    this.save();
  },

  /* 只换派生读数那一块，不重建滑块，拖动时不会掉焦点 */
  refreshDerived() {
    if (!this.panel || !this.panel.querySelector) return;
    const box = this.panel.querySelector('.rg-derived');
    if (box && box.outerHTML != null) box.outerHTML = this.derivedHtml();
  },

  onClick(e) {
    const raw = e.target;
    if (!raw || !raw.dataset) return;
    /* 按钮里常嵌 <small>/<b>，点在文字上时 e.target 是子元素，
       不往上找按钮就会出现「点了没反应」。 */
    const t = (raw.closest && raw.closest('[data-gun],[data-sfx],[data-dummy],[data-armor],[data-ammo],[data-slot],[data-part],[data-act]')) || raw;
    if (!t || !t.dataset) return;
    if (t.dataset.gun) { this.equip(t.dataset.gun); return; }
    if (t.dataset.sfx) { this.previewSfx(t.dataset.sfx); return; }
    /* 战斗测试台：靶型 / 护甲档 / 弹药等级 / 配件（data-part 可以是空串＝拆卸） */
    if (t.dataset.dummy) { this.setDummy(t.dataset.dummy); return; }
    if (t.dataset.armor) { this.setDummy(undefined, t.dataset.armor); return; }
    if (t.dataset.ammo !== undefined) { this.setAmmoLevel(t.dataset.ammo); return; }
    if (t.dataset.slot) { this.partSlot = t.dataset.slot; this.rebuildLoadout(); return; }
    if (t.dataset.part !== undefined) { this.setPart(this.partSlot, t.dataset.part || null); return; }
    const act = t.dataset.act;
    if (!act) return;
    if(act==='suppressor-load'){const id=Game.player?.weapon.id||this.curId,muzzle=SFX._suppressorMuzzle(id);if(!muzzle){Game.toast('这把枪目前没有兼容的消音器');return;}this.equip(id);this.setPart('muzzle',muzzle);Game.toast('消音试听：左键开火 · B切换射击模式');return;}
    if (act === 'dummy-reset') {
      for (const x of this.targets) x.reset();
      this.lastRes = null;
      this.clearMarks();
      this.updateReadouts();
      Game.toast('敌人靶已复位');
    }
    if (act === 'hit-mode') {
      this.preciseHits = !this.preciseHits;
      this.clearMarks();
      this.updateReadouts();
      Game.toast(this.preciseHits ? '新版判定：按弹道偏差判断爆头' : '旧版判定：按短线段判断爆头');
    }
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
      this.apply();
      this.rebuildParams();
      this.save();
      Game.toast('全部参数已回到默认值');
    }
    if (act === 'copy') this.copyJson();
    if (act === 'export') this.exportFile();
  },

  /* 只导出和默认值不一样的部分 —— 贴回去就是几处改动。
     v2 只导每把枪的七项倍率；全局物理参数不再逐局覆盖，
     tools/apply-tune.js 直接把倍率写进 design/weapons/arsenal-v1/arsenal.json。 */
  exportJson() {
    const r4 = v => Math.round(v * 10000) / 10000;
    const weapons = {};
    for (const id in this.w) {
      const w = this.w[id], dw = RANGE_DEF_W[id];
      if (!dw) continue;
      const diff = {};
      for (const k in w) if (Math.abs(w[k] - dw[k]) > 1e-9) diff[k] = r4(w[k]);
      if (Object.keys(diff).length) weapons[id] = diff;
    }
    return { version: 2, weapons };
  },

  /* 下载成 .json：双击入口是 file://，fetch 不了本地文件，
     所以走 Blob + a[download]，浏览器直接落到下载目录。 */
  exportFile() {
    const txt = JSON.stringify(this.exportJson(), null, 2);
    try {
      const a = document.createElement('a');
      const url = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      a.href = url;
      a.download = 'tide-tune.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      Game.toast('已导出 tide-tune.json（tools/apply-tune.js 可直接写回）');
    } catch (e) {
      /* 有些环境禁下载，退回复制文本 */
      this.copyJson();
    }
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

  /* 面板上的音效试听：一律走 Game.sfx，跟游戏里是同一套播放链路，
     听到什么就是实装后的什么（不是另一条简化通道）。 */
  previewSfx(name) {
    if (typeof SFX === 'undefined' || !SFX) { Game.toast('音效系统未加载'); return; }
    SFX.unlock();
    if(name.startsWith('suppression-')){
      const id=Game.player?.weapon.id||this.curId,variant=name.includes('suppressed')?'suppressed':'dry',count=name.endsWith('-burst')?3:1,rpm=this.w[id]?.rpm||WEAPONS[id].rpm;
      for(let i=0;i<count;i++)Game.sfx('shot',{gun:id,rangeSuppressorVariant:variant,delay:i*60/rpm});
    } else if (name === 'gunshot') {
      /* 采样轮换、音高抖动、敌人低通都一样会走 */
      Game.sfx('shot', { gun: this.curId,attachments:Game.player?.weapon.attachments });
    } else if (name === 'step') {
      Game.sfx('step_stone_' + (1 + Math.floor(Math.random() * 4)), { rate: 1, vol: 1 });
    } else if (name === 'switch') {
      /* 有专属切枪音的枪（霰弹、G36C/Groza/UMP45 等）会命中采样，其余自动回落通用音 */
      Game.sfx(SWITCH_MODEL[this.curId] || ('shot_switch_' + WEAPONS[this.curId].category));
    } else {
      Game.sfx(name);
    }
    this.updateReadouts();
  },

  /* 音效就绪情况：解码是异步的，进靶场头 200ms 内可能还是 0 段 */
  sfxStatus() {
    if (typeof SFX === 'undefined' || !SFX || !SFX.samples) return '不可用';
    const n = Object.keys(SFX.samples).length;
    const want = SFX.wantCount || n;
    if (!n) return '解码中…';
    const st = SFX.ctx && SFX.ctx.state === 'suspended' ? '待唤醒' : '就绪';
    return n + '/' + want + ' · ' + st;
  },

  /* 面板读数：10Hz 刷新，别每帧改 DOM */
  updateReadouts() {
    if (!this.panel || !this.visible) return;
    const P = Game.player;
    if (!P) return;
    const muzzle=SFX._suppressorMuzzle(P.weapon.id),supported=!!muzzle;
    const label=this.panel.querySelector('[data-out="suppressor"]');if(label)label.textContent=P.weapon.short+' · '+(supported?'M4模板 / 独立响度补偿 '+(SFX.RANGE_SUPPRESSOR_GAINS[P.weapon.id]??1).toFixed(2)+'×':'暂无兼容消音器');
    this.panel.querySelectorAll('[data-act="suppressor-load"],[data-sfx="suppression-suppressed"],[data-sfx="suppression-suppressed-burst"]').forEach(el=>el.disabled=!supported);

    if (this._hitModeEl) this._hitModeEl.textContent = '判定：' + (this.preciseHits ? '新版' : '旧版');
    if (this._headsEl) {
      const hits = this.targets.reduce((n, t) => n + t.hits, 0);
      const heads = this.targets.reduce((n, t) => n + t.headHits, 0);
      this._headsEl.textContent = heads + ' / ' + hits + (hits ? ' · ' + Math.round(heads / hits * 100) + '%' : '');
    }

    /* 敌人靶：剩余 HP、护甲材质 / 耐久 / 有效防护值，以及最近一发的结算明细 */
    const dEl = this.panel.querySelector('[data-out="dummy"]');
    const lEl = this.panel.querySelector('[data-out="lastshot"]');
    const d = this.targets.find(x => x.isEnemyDummy);
    if (dEl) {
      if (!d) dEl.textContent = '钢板靶（打不坏）';
      else if (d.dead) dEl.textContent = (d.t.name || d.key) + ' 已击杀 · ' + d.shotsToKill + ' 发';
      else {
        const g = d.body || d.helmet;
        const mat = g && CFG.MATERIALS[g.material];
        const armorTxt = g
          ? 'Lv' + g.lv + ' ' + (mat ? mat.label : g.material) + ' ' +
            Math.ceil(g.dur) + '/' + Math.round(g.max)
          : '无甲';
        const A = (g && typeof Combat !== 'undefined') ? Combat.effectiveArmor(g).toFixed(1) : '0';
        dEl.textContent = Math.ceil(d.hp) + '/' + d.maxHp + ' HP · ' + armorTxt + ' · A' + A;
      }
    }
    if (lEl) {
      const r = this.lastRes;
      lEl.textContent = r
        ? (r.penetrated ? '穿透' : '钝伤') + ' · H' + r.health.toFixed(1) +
          ' · ΔD' + r.durabilityLoss.toFixed(1) + ' · A' + r.A.toFixed(1)
        : '—';
    }

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

    /* 双轴后坐力的实时位移：H 是垂线方向（会真的改变弹道），V 是沿瞄准线推远 */
    if (this._axesEl) {
      const h = P.rH || 0, v = P.rV || 0;
      this._axesEl.textContent = 'H ' + (h >= 0 ? '+' : '') + h.toFixed(1) +
        ' / V ' + v.toFixed(1) + ' px';
    }

    if (this._sfxEl) this._sfxEl.textContent = this.sfxStatus();
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
  /* 敌人靶：沿用钢板靶的支架与爆头靶心，另加血条和 HP 读数。 */
  drawDummy(c, t, sx, sy) {
    c.save();
    c.strokeStyle = 'rgba(20,28,24,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(sx, sy + 6); c.lineTo(sx, sy + 15);
    c.stroke();

    const col = t.dead ? '#4a4038' : ((t.t && t.t.color) || '#8a9a90');
    c.fillStyle = t.flash > 0 ? '#f2efe2' : col;
    c.beginPath(); c.arc(sx, sy, t.r, 0, 6.29); c.fill();
    c.lineWidth = 2;
    c.strokeStyle = t.flash > 0 ? '#fff6dc' : '#26332d';
    c.beginPath(); c.arc(sx, sy, t.r, 0, 6.29); c.stroke();
    /* 金色靶心＝爆头判定圈，和钢板靶一致 */
    c.fillStyle = '#e5ac4b';
    c.beginPath(); c.arc(sx, sy, t.headR, 0, 6.29); c.fill();

    const bw = 26, bh = 3, by = sy - t.r - 9;
    c.fillStyle = 'rgba(10,14,12,0.85)';
    c.fillRect(sx - bw / 2, by, bw, bh);
    c.fillStyle = t.dead ? '#6b3a34' : '#8fd0a8';
    c.fillRect(sx - bw / 2, by, bw * U.clamp(t.hp / t.maxHp, 0, 1), bh);
    c.fillStyle = 'rgba(190,220,205,0.9)';
    c.font = '9px monospace';
    c.textAlign = 'center';
    c.fillText(Math.ceil(t.hp) + '/' + t.maxHp, sx, by - 3);
    c.fillText(t.label, sx, sy - t.r - 4);
    c.restore();
    c.globalAlpha = 1;
  },

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
    for (let d = 128; d < G.wallX - G.lineX; d += 128) {
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

    /* --- 钢板靶 / 敌人靶 --- */
    for (const t of this.targets) {
      const sx = t.x - camX, sy = t.y - camY;
      if (sx < -40 || sx > CFG.VIEW_W + 40 || sy < -40 || sy > CFG.VIEW_H + 40) continue;
      if (t.isEnemyDummy) { this.drawDummy(c, t, sx, sy); continue; }
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
      c.fillStyle = '#e5ac4b';
      c.beginPath(); c.arc(sx, sy, t.headR, 0, 6.29); c.fill();
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
        c.fillStyle = p.head ? '#ffc45c' : '#eee8d8';
        c.font = 'bold 10px monospace';
        c.fillText((p.head ? '爆头 ' : '') + String(p.d), p.x - camX, p.y - camY);
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
