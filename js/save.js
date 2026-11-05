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
  safe: [],          // 局外保险箱准备区，出发时交给局内保险箱
  credits: START_CREDITS,
  hp: CFG.P.HP,
  // 配装：三个武器位 + 头盔 / 护甲
  // 武器位和护甲一样存"物品"（EQUIP.gun 伪物品，带余弹），不是光存一个 id：
  // 这样从尸体上捡的枪、军火商买的枪、身上那把，走的是同一套数据结构。
  gear: {
    weapons: DEFAULT_WEAPONS.map(id=>EQUIP.gun(id,WEAPONS[id].mag)),
    helmet: null,      // { type:'helmet', lv, dur }
    body: null,        // { type:'body',   lv, dur }
    back: null         // { id, name, slots, w, price }：决定携带容量，见 bagSlots()
  },
  meleeGiftClaimed: false,
  attachmentRecovery: [],
  runs: 0,
  bestHaul: 0,        // 单局带出价值的历史最高（结算页的"新纪录"用）
  codexCount() { return ITEMS.filter(item=>!item.noCodex&&itemGroup(item)==='collectible'&&this.codex[item.id]).length; },

  /* 武器位的老格式是 ['rifle','shotgun','pistol']（只有 id，余弹丢失）。
     统一转成 EQUIP.gun 伪物品；缺位保留 null，不免费补发。 */
  migrateWeapons(list) {
    const out = [null, null, null];
    if (Array.isArray(list)) {
      for (let i = 0; i < 3; i++) {
        const e = list[i];
        if (!e) continue;
        if (typeof e === 'string') {
          if (WEAPONS[e]) out[i] = this.migrateGun({gun:e,mag:({rifle:30,smg:25,shotgun:6,pistol:12})[e]??WEAPONS[e].mag});
        } else if (e.equip && e.equip.kind === 'gun' && WEAPONS[e.equip.gun]) {
          out[i] = this.migrateGun(e.equip);
        }
      }
    }
    /* 空副武器槽必须保留，避免死亡刷新恢复装备 */
    // Explicit empty weapon slots stay empty, including after death.
    return out;
  },

  migrateGun(eq){
    const w=typeof Attachments!=='undefined'?Attachments.resolve(eq.gun,eq.attachments):WEAPONS[canonicalWeaponId(eq.gun)];if(!w)return null;
    if(typeof Attachments!=='undefined'&&this._partSpill){for(const bad of Attachments.normalize(eq.gun,eq.attachments).invalid){if(bad.known)this._partSpill.push(EQUIP.attachment(bad.id));else this.attachmentRecovery.push({gun:eq.gun,...bad});}}
    const count=Math.max(0,eq.mag|0),fallback=AMMO_BY_ID[eq.ammo]?.caliber===w.caliber?eq.ammo:w.ammo;
    const rounds=(Array.isArray(eq.rounds)?eq.rounds:[]).filter(id=>AMMO_BY_ID[id]?.caliber===w.caliber).slice(0,count);
    while(rounds.length<count)rounds.push(fallback);
    if(this._ammoSpill)for(const id of rounds.slice(w.mag))this._ammoSpill.push({id,n:1});
    return EQUIP.gun(w.id,Math.min(count,w.mag),fallback,rounds.slice(0,w.mag),eq);
  },

  load() {
    try {
      this._ammoSpill=[];
      const raw = localStorage.getItem(this.key);
      if (!raw) { this.bag = this.defaultBag(); this.safe=[]; return; }
      const d = JSON.parse(raw);
      this._partSpill=[];
      this.attachmentRecovery=Array.isArray(d.attachmentRecovery)?d.attachmentRecovery:[];
      this.codex = d.codex || {};
      this.stash = Array.isArray(d.stash) ? d.stash : [];
      this.runs = d.runs || 0;
      this.meleeGiftClaimed = d.meleeGiftClaimed === true;
      this.bestHaul = Number.isFinite(d.bestHaul) ? d.bestHaul : 0;
      // 老存档没有这两个字段，补默认值
      this.credits = (typeof d.credits === 'number') ? d.credits : START_CREDITS;
      this.hp = Number.isFinite(d.hp) ? U.clamp(d.hp, 1, CFG.P.HP) : CFG.P.HP;
      /* 这一版把"携带数量"换成了真正的背包：老存档的 loadout 折算成包里的东西，
         数量一条不差（旧 ammo 字段归 5.56，绷带归 heal01），不会白丢。 */
      this.bag = Array.isArray(d.bag) ? d.bag : this.bagFromLoadout(d.loadout || null);
      this.safe = Array.isArray(d.safe) ? d.safe : [];

      // 配装：老存档没有就补默认，缺字段逐项兜底
      const g = d.gear || {};
      this.gear = {
        weapons: this.migrateWeapons(g.weapons),
        melee: g.melee?.equip?.kind === 'melee' ? EQUIP.melee(g.melee.equip.melee,g.melee.equip.bound) : null,
        helmet: g.helmet ? GEAR.make('helmet', g.helmet.id || g.helmet.lv, g.helmet.dur) : null,
        body: g.body ? GEAR.make('body', g.body.id || g.body.lv, g.body.dur) : null,
        /* 老存档没有背包槽：保持 null，容量回落到基础 4 格 */
        back: (g.back && BACKPACK.def(g.back.id)) ? BACKPACK.make(g.back.id) : null
      };

      this.normalizeStash();
      this.normalizeBag();
      this.normalizeSafe();
      for(const item of this._partSpill)this.stash.push({id:item.id,n:1,gear:item});
      this._partSpill=null;
      if(this._ammoSpill.length)this.stash=this.normalizeList([...this.stash,...this._ammoSpill]);
      this._ammoSpill=null;
    } catch (e) {
      if (!Array.isArray(this.bag) || !this.bag.length) this.bag = this.defaultBag();
    }
  },

  /* 第一次玩：三口径各一点、绷带一卷，进图就能打。
     药品不再叠放，一卷绷带就占一格，所以默认背包正好塞满基础四格。 */
  defaultBag() {
    return [
      { id: 'ammo_556_1', n: 30 },
      { id: 'ammo_9mm_1', n: 20 },
      { id: 'ammo_12g_1', n: 10 },
      { id: 'heal01', n: 1 }
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
    if (!this._dirty) return true;
    this._dirty = false;
    try {
      localStorage.setItem(this.key, JSON.stringify({
        v: 3,
        codex: this.codex,
        /* 仓库不再叠放，条目数会变多；整份存，别再截尾丢东西 */
        stash: this.stash,
        bag: this.bag.slice(-60),
        safe: this.safe,
        credits: this.credits,
        hp: this.hp,
        gear: this.gear,
        runs: this.runs,
        meleeGiftClaimed: this.meleeGiftClaimed,
        attachmentRecovery: this.attachmentRecovery,
        bestHaul: this.bestHaul
      }));
      return true;
    } catch (e) { this._dirty=true; return false; }
  },

  /* 同一种物品合并成一条，顺便丢掉物品表里已经不存在的东西。
     装备（e.gear）不合并：同型号的耐久不一样，一件一条。 */
  /* 老存档里的通用弹药没有口径，统一并到 5.56 Lv1：
     数量原样搬过去，不多给也不吞掉。 */
  migrateAmmoId(id) {
    return id === 'ammo' ? 'ammo_556_1' : id;
  },

  /* 一份条目表 → 规范化条目表。只有子弹能堆叠，仓库与背包都按口径上限分堆；
     其它物品一件一条，不叠。
     顺序照旧，合并只发生在原来的位置上。 */
  normalizeList(list) {
    const out = [];            // 保序输出
    const merged = new Map();  // 可堆叠的（子弹）：id → 条目
    const push = (id, n, item) => {
      if (stackLimit(item) > 1) {
        const cur = merged.get(id);
        if (cur) { cur.n += n; return; }
        const entry = { id, n };
        merged.set(id, entry);
        out.push(entry);
        return;
      }
      for (let k = 0; k < n; k++) out.push({ id, n: 1 });
    };
    for (const e of list) {
      if (!e) continue;
      if (e.gear && e.gear.equip) {
        // 用当前模板重算价格与回收价，耐久、余弹仍来自旧快照。
        const spec = e.gear.equip;
        const current = spec.kind === 'attachment' ? EQUIP.attachment(spec.attachment) : spec.kind === 'melee' ? EQUIP.melee(spec.melee,spec.bound) : spec.kind === 'armor' ? EQUIP.armor(spec.gear)
          : spec.kind === 'gun' ? this.migrateGun(spec)
          : spec.kind === 'bag' ? EQUIP.bag(spec.bag) : null;
        if (current) out.push({ id: current.id, n: 1, gear: current });
        else if(spec.kind==='attachment'&&this._partSpill)this.attachmentRecovery.push({id:spec.attachment,kind:'unknown-loose'});
        continue;
      }
      const id = this.migrateAmmoId(Medical.canonicalId(e.id));
      const item = ITEM_BY_ID[id];
      if (!item) continue;
      const n = Math.max(1, e.n || 1);
      /* 恢复品的容量是 HP，效果品的容量是次数，用了多少都得存下来 */
      const max = Medical.capOf(item) || 0;
      if (!max) { push(id, n, item); continue; }
      /* 恢复品要保留"用了多少"：老存档没写 cap 就按满容量初始化，归零的直接丢掉 */
      const cap = typeof e.cap === 'number' ? U.clamp(e.cap, 0, max) : max;
      if (cap <= 0) continue;
      if (cap >= max - 1e-6) push(id, n, item);
      else {
        out.push({ id, n: 1, cap });
        if (n > 1) push(id, n - 1, item);
      }
    }
    /* 仓库和背包统一按上限切开，保持物品顺序与数量。 */
    const cut = [];
    for (const e of out) {
      if (!merged.has(e.id)) { cut.push(e); continue; }
      const stack = stackLimit(ITEM_BY_ID[e.id]);
      let left = e.n;
      while (left > 0) { const put = Math.min(stack, left); cut.push({ id: e.id, n: put }); left -= put; }
    }
    return cut;
  },

  normalizeStash() { this.stash = this.normalizeList(this.stash); },
  normalizeSafe() {
    const rows=this.normalizeList(this.safe||[]);this.safe=rows.slice(0,CFG.BAG.SAFE);
    for(const e of rows.slice(CFG.BAG.SAFE)){if(e.gear)this.addGearStash(e.gear);else this.addStash(e.id,e.n,e.cap);}
  },
  safeWeight(){return (this.safe||[]).reduce((n,e)=>n+(stashItem(e)?.w||0)*(e.n||1),0);},
  normalizeBag() {
    this.bag = this.normalizeList(this.bag);
    /* 老存档里药品是叠着的，拆成一件一条之后可能超出背包容量。
       放不下的退回仓库——别硬塞，也别把东西弄丢。 */
    const limit = bagSlots();
    while (this.bag.length > limit) {
      const e = this.bag.pop();
      if (e.gear) this.addGearStash(e.gear);
      else this.addStash(e.id, e.n, e.cap);
    }
  },

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
    const stack = stackLimit(item);
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

  /* Transactions check capacity first; migrations/settlement never discard overflow. */
  canAddStash(id, n) {
    id=Medical.canonicalId(id);const item=ITEM_BY_ID[id];if(!item)return false;
    const stack=stackLimit(item);let left=Math.max(1,Math.floor(Number(n)||1));
    if(stack>1)for(const e of this.stash)if(!e.gear&&e.id===id)left-=Math.max(0,stack-e.n);
    const slots=Math.ceil(Math.max(0,left)/stack);
    return slots===0||this.stash.length+slots<=STASH_SLOTS;
  },

  addStash(id, n, cap) {
    id = Medical.canonicalId(id);
    const item = ITEM_BY_ID[id];
    const max = (item && item.healCap) || 0;
    /* 用过的那件单独入库，容量原样保留 */
    if (max && typeof cap === 'number' && cap < max - 1e-6) {
      this.stash.push({ id, n: 1, cap: U.clamp(cap, 0, max) });
      return;
    }
    /* Fill partial stacks first, then allocate new slots with the same cap as the backpack. */
    if (item && stackLimit(item) > 1) {
      const limit=stackLimit(item);let left=Math.max(1,Math.floor(Number(n)||1));
      for(const e of this.stash){
        if(e.gear||e.id!==id)continue;
        const put=Math.min(Math.max(0,limit-e.n),left);e.n+=put;left-=put;
        if(!left)break;
      }
      while(left>0){const put=Math.min(limit,left);this.stash.push({id,n:put});left-=put;}
      return;
    }
    for (let k = 0; k < Math.max(1, n | 0); k++) this.stash.push({ id, n: 1 });
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
