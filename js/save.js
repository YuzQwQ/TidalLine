/* ============================================================
   存档：localStorage 读写 / 仓库与背包 / 图鉴 / 装备配装
   ============================================================ */

/* ---------------- 存档 ---------------- */
const Save = {
  key: 'tideline_save_v1',
  codex: {},
  stash: [],          // [{ id, n }]
  /* 藏身处的背包，跨局保留：弹药和药物回来时留在里面，其它东西自动回仓库。
     条目形态和仓库一致（{id,n,cap} / {id,n:1,gear}），这样仓库和背包能用同一套代码搬。 */
  bag: [],
  credits: START_CREDITS,
  hp: CFG.P.HP,
  // 配装：三个武器位 + 头盔 / 护甲
  // 武器位和护甲一样存"物品"（EQUIP.gun 伪物品，带余弹），不是光存一个 id：
  // 这样从尸体上捡的枪、军火商买的枪、身上那把，走的是同一套数据结构。
  gear: {
    weapons: [EQUIP.gun('rifle', 30), EQUIP.gun('shotgun', 6), EQUIP.gun('pistol', 12)],
    helmet: null,      // { type:'helmet', lv, dur }
    body: null,        // { type:'body',   lv, dur }
    back: null         // { id, name, slots, w, price }：决定携带容量，见 bagSlots()
  },
  runs: 0,
  bestHaul: 0,        // 单局带出价值的历史最高（结算页的"新纪录"用）
  codexCount() { return ITEMS.filter(item=>!item.noCodex&&itemGroup(item)==='collectible'&&this.codex[item.id]).length; },

  /* 武器位的老格式是 ['rifle','shotgun','pistol']（只有 id，余弹丢失）。
     统一转成 EQUIP.gun 伪物品；缺位补 null，副武器空着就发一把手枪。 */
  migrateWeapons(list) {
    const out = [null, null, null];
    if (Array.isArray(list)) {
      for (let i = 0; i < 3; i++) {
        const e = list[i];
        if (!e) continue;
        if (typeof e === 'string') {
          if (WEAPONS[e]) out[i] = EQUIP.gun(e, WEAPONS[e].mag);
        } else if (e.equip && e.equip.kind === 'gun' && WEAPONS[e.equip.gun]) {
          out[i] = EQUIP.gun(e.equip.gun, e.equip.mag | 0, e.equip.ammo);   // 重新包一遍，字段补齐（含装填弹种）
        }
      }
    }
    /* 副武器不能空 —— 空手进去就没得打了 */
    if (!out[SIDEARM_SLOT]) out[SIDEARM_SLOT] = EQUIP.gun('pistol', WEAPONS.pistol.mag);
    return out;
  },

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) { this.bag = this.defaultBag(); return; }
      const d = JSON.parse(raw);
      this.codex = d.codex || {};
      this.stash = Array.isArray(d.stash) ? d.stash : [];
      this.runs = d.runs || 0;
      this.bestHaul = Number.isFinite(d.bestHaul) ? d.bestHaul : 0;
      // 老存档没有这两个字段，补默认值
      this.credits = (typeof d.credits === 'number') ? d.credits : START_CREDITS;
      this.hp = Number.isFinite(d.hp) ? U.clamp(d.hp, 1, CFG.P.HP) : CFG.P.HP;
      /* 这一版把"携带数量"换成了真正的背包：老存档的 loadout 折算成包里的东西，
         数量一条不差（旧 ammo 字段归 5.56，绷带归 heal01），不会白丢。 */
      this.bag = Array.isArray(d.bag) ? d.bag : this.bagFromLoadout(d.loadout || null);

      // 配装：老存档没有就补默认，缺字段逐项兜底
      const g = d.gear || {};
      this.gear = {
        weapons: this.migrateWeapons(g.weapons),
        helmet: g.helmet ? GEAR.make('helmet', g.helmet.lv, g.helmet.dur) : null,
        body: g.body ? GEAR.make('body', g.body.lv, g.body.dur) : null,
        /* 老存档没有背包槽：保持 null，容量回落到基础 4 格 */
        back: (g.back && BACKPACK.def(g.back.id)) ? BACKPACK.make(g.back.id) : null
      };

      this.normalizeStash();
      this.normalizeBag();
    } catch (e) {
      if (!Array.isArray(this.bag) || !this.bag.length) this.bag = this.defaultBag();
    }
  },

  /* 第一次玩：三口径各一点、几卷绷带，进图就能打 */
  defaultBag() {
    return [
      { id: 'ammo_556_1', n: 30 },
      { id: 'ammo_9mm_1', n: 20 },
      { id: 'ammo_12g_1', n: 10 },
      { id: 'heal01', n: 3 }
    ];
  },

  /* 老存档的 loadout（携带数量）→ 背包条目 */
  bagFromLoadout(L) {
    if (!L) return this.defaultBag();
    const out = [];
    const push = (id, n) => {
      const item = ITEM_BY_ID[Medical.canonicalId(id)];
      n = Math.floor(Number(n) || 0);
      if (item && n > 0) out.push({ id: item.id, n });
    };
    push('ammo_556_1', L.ammo556 || L.ammo);
    push('ammo_9mm_1', L.ammo9mm);
    push('ammo_12g_1', L.ammo12g);
    push('heal01', L.bandage);
    for (const [id, n] of Object.entries(L.medical || {})) {
      if (Medical.canonicalId(id) !== 'heal01') push(id, n);
    }
    return out;
  },

  /* 存档写入要节流。localStorage 是同步 I/O，还得把整个仓库序列化一遍；
     挨打时护甲掉耐久就会调一次，被围攻时一秒好几次，攒久了就是明显卡顿。
     所以标记脏 + 400ms 合并写，真正落盘在 flush()。 */
  _dirty: false,
  _saveT: 0,

  save() {
    this._dirty = true;
    if (this._saveT) return;                       // 已经有一次待写
    this._saveT = (typeof setTimeout === 'function' ? setTimeout(() => this.flush(), 400) : 0) || 0;
    if (!this._saveT) this.flush();                // 没有定时器可用就立刻写（测试环境）
  },

  flush() {
    if (this._saveT) {
      if (typeof clearTimeout === 'function') clearTimeout(this._saveT);
      this._saveT = 0;
    }
    if (!this._dirty) return;
    this._dirty = false;
    try {
      localStorage.setItem(this.key, JSON.stringify({
        v: 3,
        codex: this.codex,
        stash: this.stash.slice(-300),
        bag: this.bag.slice(-60),
        credits: this.credits,
        hp: this.hp,
        gear: this.gear,
        runs: this.runs,
        bestHaul: this.bestHaul
      }));
    } catch (e) { /* localStorage 不可用就算了 */ }
  },

  /* 同一种物品合并成一条，顺便丢掉物品表里已经不存在的东西。
     装备（e.gear）不合并：同型号的耐久不一样，一件一条。 */
  /* 老存档里的通用弹药没有口径，统一并到 5.56 Lv1：
     数量原样搬过去，不多给也不吞掉。 */
  migrateAmmoId(id) {
    return id === 'ammo' ? 'ammo_556_1' : id;
  },

  /* 一份条目表 → 规范化条目表。仓库允许一个 id 一条（不分堆），
     背包要按堆叠上限切开（格子有限，进局时一条就占一格）。 */
  normalizeList(list, splitStacks) {
    const m = new Map();          // 满容量堆：id → 件数
    const partials = [];          // 用过的恢复品：一件一条，带 cap
    const gears = [];
    for (const e of list) {
      if (!e) continue;
      if (e.gear && e.gear.equip) {
        // 用当前模板重算价格与回收价，耐久、余弹仍来自旧快照。
        const spec = e.gear.equip;
        const current = spec.kind === 'armor' ? EQUIP.armor(spec.gear)
          : spec.kind === 'gun' ? EQUIP.gun(spec.gun, spec.mag, spec.ammo)
          : spec.kind === 'bag' ? EQUIP.bag(spec.bag) : null;
        if (current) gears.push({ id: e.id, n: 1, gear: current });
        continue;
      }
      const id = this.migrateAmmoId(Medical.canonicalId(e.id));
      const item = ITEM_BY_ID[id];
      if (!item) continue;
      const n = Math.max(1, e.n || 1);
      const max = item.healCap || 0;
      if (!max) { m.set(id, (m.get(id) || 0) + n); continue; }
      /* 恢复品要保留"用了多少"：老存档没写 cap 就按满容量初始化，归零的直接丢掉 */
      const cap = typeof e.cap === 'number' ? U.clamp(e.cap, 0, max) : max;
      if (cap <= 0) continue;
      if (cap >= max - 1e-6) m.set(id, (m.get(id) || 0) + n);
      else {
        partials.push({ id, n: 1, cap });
        if (n > 1) m.set(id, (m.get(id) || 0) + (n - 1));
      }
    }
    let main = [...m].map(([id, n]) => ({ id, n }));
    if (splitStacks) {
      const cut = [];
      for (const e of main) {
        const item = ITEM_BY_ID[e.id];
        const stack = Math.max(1, (item && item.stack) || 1);
        let left = e.n;
        while (left > 0) { const put = Math.min(stack, left); cut.push({ id: e.id, n: put }); left -= put; }
      }
      main = cut;
    }
    return main.concat(partials, gears);
  },

  normalizeStash() { this.stash = this.normalizeList(this.stash, false); },
  normalizeBag() { this.bag = this.normalizeList(this.bag, true); },

  /* ---- 背包：数量、重量、整堆合并 ---- */
  bagCount(id) {
    id = Medical.canonicalId(id);
    return this.bag.reduce((sum, x) => x.id === id && !x.gear ? sum + x.n : sum, 0);
  },

  /* 往背包里塞（按堆叠上限切开）。恢复品的 cap 原样保留。 */
  addBag(id, n, cap) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    if (!item) return false;
    const stack = Math.max(1, item.stack || 1);
    const max = item.healCap || 0;
    if (max && typeof cap === 'number' && cap < max - 1e-6) {
      this.bag.push({ id, n: 1, cap: U.clamp(cap, 0, max) });
      return true;
    }
    let left = Math.max(1, Math.floor(Number(n) || 1));
    for (const e of this.bag) {
      if (left <= 0) break;
      if (e.gear || e.id !== id) continue;
      if (max && e.cap != null && e.cap < max - 1e-6) continue;
      const put = Math.min(Math.max(0, stack - e.n), left);
      e.n += put; left -= put;
    }
    while (left > 0) {
      const put = Math.min(stack, left);
      this.bag.push(max ? { id, n: put, cap: max } : { id, n: put });
      left -= put;
    }
    return true;
  },

  addGearBag(item) {
    if (!item || !item.equip) return false;
    this.bag.push({ id: item.id, n: 1, gear: item });
    return true;
  },

  bagWeight() {
    return this.bag.reduce((w, e) => {
      const it = stashItem(e);
      return w + (it ? it.w * (e.n || 1) : 0);
    }, 0);
  },

  stashCount(id) {
    id = Medical.canonicalId(id);
    return this.stash.reduce((sum, x) => x.id === id && !x.gear ? sum + x.n : sum, 0);
  },

  /* 能带下场的只有满容量那几件：用过的恢复品留在仓库，不参与携带结算 */
  fullCount(id) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    const max = item ? (item.healCap || 0) : 0;
    if (!max) return this.stashCount(id);
    return this.stash.reduce((sum, x) =>
      (x.id === id && !x.gear && (x.cap == null || x.cap >= max - 1e-6)) ? sum + x.n : sum, 0);
  },

  takeFull(id, n) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    const max = item ? (item.healCap || 0) : 0;
    if (this.fullCount(id) < n) return false;
    let left = n;
    for (const e of this.stash.slice()) {
      if (left <= 0) break;
      if (e.id !== id || e.gear) continue;
      if (max && !(e.cap == null || e.cap >= max - 1e-6)) continue;
      const take = Math.min(e.n, left);
      e.n -= take; left -= take;
      if (e.n <= 0) this.stash = this.stash.filter(x => x !== e);
    }
    return left <= 0;
  },

  addStash(id, n, cap) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    const max = (item && item.healCap) || 0;
    if (max) {
      /* 用过的那件单独入库，容量原样保留 */
      if (typeof cap === 'number' && cap < max - 1e-6) {
        this.stash.push({ id, n: 1, cap: U.clamp(cap, 0, max) });
        return;
      }
      /* 只往满容量那一堆里并，超过堆叠上限就另起一条 */
      const stack = Math.max(1, item.stack || 1);
      let left = n;
      const full = this.stash.find(e => e.id === id && !e.gear && (e.cap == null || e.cap >= max - 1e-6));
      if (full) {
        const take = Math.min(Math.max(0, stack - full.n), left);
        full.n += take; left -= take;
      }
      while (left > 0) {
        const put = Math.min(stack, left);
        this.stash.push({ id, n: put });
        left -= put;
      }
      return;
    }
    const e = this.stash.find(x => x.id === id && !x.gear);
    if (e) e.n += n;
    else this.stash.push({ id, n });
  },

  setHP(hp, immediate = true) {
    this.hp = U.clamp(Number.isFinite(hp) ? hp : CFG.P.HP, 1, CFG.P.HP);
    this.save(); if (immediate) this.flush();
  },

  /* 装备进仓库：独立一条，带耐久，卖价由伪物品的 sell 决定 */
  addGearStash(item) {
    if (!item || !item.equip) return;
    this.stash.push({ id: item.id, n: 1, gear: item });
  }
};

/* 仓库条目 → 能用的物品字段（普通物品查表，装备用自带快照） */
function stashItem(e) {
  if (!e) return null;
  if (e.gear) return e.gear;
  return ITEM_BY_ID[e.id] || null;
}

/* 卖价：装备用 sell（已经按剩余耐久折过、且不超过买价），普通物品用原价 */
function unitPrice(it) {
  if (!it) return 0;
  return (it.sell != null) ? it.sell : it.price;
}
