/* ============================================================
   潮汐线 · 实体层
   玩家 / 敌人 / 子弹 / 投掷物 / 尸体
   ============================================================ */

/* 换枪音：有专属采样的枪单独列出来，其余沿用通用滑套声。
   霰弹枪用的是泵动前推上膛（Freesound 858509），比"啪嗒"一声更重。 */
const SWITCH_SFX = {
  shotgun: 'shot_switch_shotgun'
};

/* ---------------- 碰撞 ---------------- */
function canStand(x, y, r) {
  const size = CFG.TILE;
  for (let ty = M.ty(y - r); ty <= M.ty(y + r); ty++) {
    for (let tx = M.tx(x - r); tx <= M.tx(x + r); tx++) {
      for(const [rx,ry,rw,rh] of M.collisionRects(tx,ty)) {
        const closestX=U.clamp(x,rx,rx+rw),closestY=U.clamp(y,ry,ry+rh);
        if((x-closestX)**2+(y-closestY)**2<r*r)return false;
      }
    }
  }
  return true;
}

function moveEntity(e, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Math.min(e.r, CFG.TILE / 4)));
  for (let i = 0; i < steps; i++) {
    if (dx !== 0 && canStand(e.x + dx / steps, e.y, e.r)) e.x += dx / steps;
    if (dy !== 0 && canStand(e.x, e.y + dy / steps, e.r)) e.y += dy / steps;
  }
}

/* ---------------- 背包 ---------------- */
/* 负重 → 档位（装备重量也算进去，所以单独抽出来） */
function weightTier(w) {
  const T = CFG.BAG.TIERS;
  for (let i = 0; i < T.length; i++) {
    if (w <= T[i][0]) return { i, move: T[i][1], noise: T[i][2], name: T[i][3] };
  }
  return { i: 3, move: 0.55, noise: 2, name: '超载' };
}

/* 线段 AB 上离 C 最近的点对应的参数 t（0~1） */
function segT(ax, ay, bx, by, cx, cy) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return 0;
  return U.clamp(((cx - ax) * dx + (cy - ay) * dy) / len2, 0, 1);
}

/* 点 C 到线段 AB 的最短距离——命中部位判定就靠它 */
function segDist(ax, ay, bx, by, cx, cy) {
  const t = segT(ax, ay, bx, by, cx, cy);
  return Math.hypot(cx - (ax + (bx - ax) * t), cy - (ay + (by - ay) * t));
}

class Bag {
  constructor() {
    this.slots = [];        // [{ item, n }]
    this.safe = [];         // 安全箱
  }
  weight() {
    let w = 0;
    for (const s of this.slots) w += s.item.w * s.n;
    for (const s of this.safe) w += s.item.w * s.n;
    return w;
  }
  value() {
    let v = 0;
    for (const s of this.slots) v += s.item.price * s.n;
    for (const s of this.safe) v += s.item.price * s.n;
    return v;
  }
  count() { return this.slots.length; }

  tier() { return weightTier(this.weight()); }

  canAdd(item, n, cap) {
    n = Math.max(1, n | 0);
    /* 背包不能套背包：容量只由背包槽决定，塞进去也不会变大 */
    if (item.equip && item.equip.kind === 'bag') {
      return { ok: false, why: '背包不能塞进背包，回藏身处换装' };
    }
    const stack = stackLimit(item);
    // 可堆叠：找同类（容量类物品只和"满的"那堆合并，用过的不并）
    if (stack > 1 && this.fullCap({ item, n: 1, cap }, item)) {
      const ex = this.slots.find(s => s.item.id === item.id && this.fullCap(s, item));
      if (ex && ex.n + n <= stack) return { ok: true, merge: true };
    }
    /* 不可堆叠的一件一格，要几格就占几格 */
    const need = stack > 1 ? Math.ceil(n / stack) : n;
    if (this.slots.length + need > bagSlots()) return { ok: false, why: '背包满了' };
    if (this.weight() + item.w * n > CFG.BAG.CARRY) return { ok: false, why: '太重了' };
    return { ok: true };
  }

  /* 带治疗容量的物品，只有满容量才能互相堆叠 */
  fullCap(entry, item) {
    const max = (item && item.healCap) || 0;
    if (!max) return true;
    return (typeof entry.cap === 'number' ? entry.cap : max) >= max - 1e-6;
  }

  add(item, n, cap) {
    n = Math.max(1, n | 0);
    if (item.equip && item.equip.kind === 'bag') return false;   // 不套背包
    const stack = stackLimit(item);
    /* 先并进已有的同类堆（只有子弹这类可堆叠的） */
    if (stack > 1 && this.fullCap({ item, n: 1, cap }, item)) {
      for (const s of this.slots) {
        if (s.item.id !== item.id || !this.fullCap(s, item)) continue;
        const put = Math.min(Math.max(0, stack - s.n), n);
        if (put <= 0) continue;
        s.n += put; n -= put;
        if (n <= 0) return true;
      }
    }
    /* 剩下的新开格：不可堆叠的一件一格 */
    const need = stack > 1 ? Math.ceil(n / stack) : n;
    if (this.slots.length + need > bagSlots()) return false;
    if (this.weight() + item.w * n > CFG.BAG.CARRY) return false;
    while (n > 0) {
      const put = Math.min(stack, n);
      this.slots.push(item.healCap
        ? { item, n: put, cap: typeof cap === 'number' ? cap : item.healCap }
        : { item, n: put });
      n -= put;
    }
    return true;
  }

  removeAt(i) {
    if (i < 0 || i >= this.slots.length) return null;
    return this.slots.splice(i, 1)[0];
  }

  /* ---------------- 弹药 ----------------
     弹药按"口径 + 等级"分开存：ammo_556_3 和 ammo_556_1 是两个物品，
     不会合并成一堆；不同口径更不能混。这里只认 id，不认识就返回 0。 */
  ammoCount(id) {
    return this.slots.reduce((n,s) => n + (s.item.id === id ? s.n : 0), 0);
  }
  /* 某口径下所有等级的弹药条目（按格子顺序） */
  ammoStacks(caliber) {
    return this.slots.filter(s => s.item.cat === 'ammo' && s.item.caliber === caliber);
  }
  /* 口径总备弹（HUD 用不到，留给将来的快速查看） */
  ammoCountByCaliber(caliber) {
    return this.ammoStacks(caliber).reduce((n, s) => n + s.n, 0);
  }
  /* 没有口径参数时退回"所有弹药总数"，老调用点（测试）还能用 */
  hasAmmo(caliber) {
    if (caliber) return this.ammoCountByCaliber(caliber);
    return this.slots.reduce((n, s) => n + (s.item.cat === 'ammo' ? s.n : 0), 0);
  }
  /* 从指定弹种里扣 n 发，跨多个同类堆一起扣 */
  useAmmo(id, n) {
    let left = Math.max(0, n | 0), taken = 0;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (!s || s.item.id !== id) continue;
      const take = Math.min(left, s.n);
      s.n -= take; left -= take; taken += take;
      if (s.n <= 0) this.slots.splice(i, 1);
    }
    return taken;
  }
  /* 往背包里塞某弹种，放不下就返回 false（调用方负责别把东西弄丢） */
  addAmmo(id, n) {
    const item = AMMO_BY_ID[id];
    if (!item || n <= 0) return false;
    const stack = stackLimit(item);
    let left = n;
    for (const s of this.slots) {
      if (s.item.id !== id) continue;
      const room = Math.max(0, stack - s.n);
      const put = Math.min(room, left);
      s.n += put; left -= put;
      if (left <= 0) return true;
    }
    while (left > 0) {
      if (this.slots.length >= bagSlots()) return false;
      const put = Math.min(stack, left);
      this.slots.push({ item, n: put });
      left -= put;
    }
    return true;
  }
}

/* ---------------- 玩家 ---------------- */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = CFG.P.RADIUS;
    this.hp = CFG.P.HP;
    this.maxHp = CFG.P.HP;
    this.angle = 0;
    this.vx = 0; this.vy = 0;
    this.bag = new Bag();
    // 武器：0/1 主武器，2 副武器（startRun 时按配装填真实武器对象）
    this.weapons = [null, null, null];
    this.slot = 0;
    this.helmet = null;
    this.body = null;
    this.back = null;               // 背包（决定携带容量），startRun 时按配装填
    this.headR = CFG.COMBAT.HEAD_RADIUS;   // 头部判定半径
    this.mag = CFG.WEAPON.mag;
    this.reloadT = 0;
    this.reloadPending = false;
    if (typeof AmmoQuick !== 'undefined') AmmoQuick.cancel();
    this.fireCd = 0;
    this.windupT = 0;           // 击发延迟剩余时间（W.windup > 0 时才有意义）
    this.windupShot = false;    // 扳机已扣、子弹还没出膛
    this.animSpeed = 1;         // 开火动作速率倍率（靶场可调）
    this.recoil = 0;            // 0~1，驱动散布与准星
    this.sinceShot = 99;        // 距上次开火多久
    this.crossKick = { x: 0, y: 0 };  // 准星抖动偏移（纯视觉）
    /* 双轴后坐力：以鼠标瞄准点为原点的位移量（像素），见 CFG.RECOIL.axis。
       rV 沿瞄准方向把准星推远（≥0），rH 沿垂线侧移（可正可负）。 */
    this.rH = 0;
    this.rV = 0;
    this.aimDir = { x: 1, y: 0 };     // 最后一次有效的瞄准方向（鼠标压在身上时沿用）
    this.aimPoint = { x: 0, y: 0 };   // 实际准星世界坐标 R
    this.aimMouse = { x: 0, y: 0 };   // 最近一次鼠标世界坐标（重算 R 用）
    this._aimValid = false;           // R 是否已经算过（没有鼠标数据时为 false）
    this.spread = CFG.RECOIL.spreadBase;
    this.aimRemaining = 0;
    this.aimProfile = null;
    this.dodgeCd = 0;
    this.dodgeT = 0;
    this.dodgeAngle = 0;
    this.noiseT = 0;
    this.stepDist = 0;          // 距上一步走过的距离，够了就响一声
    this.waterT = 0;
    this.moving = false;
    this.sneaking = false;
    this.sprinting = false;
    this.inWater = false;
    this.dead = false;
    this.anim = { state: 'idle', time: 0 };
    this.shotAnimT = 0;
    this.hurtAnimT = 0;
    this.frameTravel = 0;
  }

  /* 当前手上的枪 */
  get weapon() {
    return this.weapons[this.slot] || WEAPONS.rifle;
  }

  /* 弹匣里装的是哪一档弹药。
     武器上记的是 id；口径对不上（改过存档 / 换了枪）就退回该口径的 Lv1。 */
  get ammoItem() {
    const w = this.weapon;
    const a = AMMO_BY_ID[this.mag > 0 ? this.roundsFor(w, this.mag)[0] : w.ammo];
    if (a && a.caliber === w.caliber) return a;
    return defaultAmmo(w.caliber);
  }
  get ammoId() { const a = this.ammoItem; return a ? a.id : null; }

  /* 总重量 = 背包里的东西 + 安全箱 + 身上的武器 + 头盔 + 护甲 + 背包自身 */
  get totalWeight() {
    let w = this.bag.weight();
    for (const x of this.weapons) if (x) w += x.w;
    if (this.helmet) w += this.helmet.w;
    if (this.body) w += this.body.w;
    if (this.back) w += this.back.w;
    return w;
  }

  /* 当前携带容量：装备了背包就用它的格数，否则是基础 4 格（替换，不叠加） */
  get slots() { return (this.back && this.back.slots) || BASE_BAG_SLOTS; }

  get tier() { return weightTier(this.totalWeight); }

  /* 旧移速字段兼容；负重分档仍生效，护甲只增加瞄准准备时间。 */
  get armorMove() { return 1; } // legacy API; armor no longer directly slows movement
  get aimTime() { return (this.weapon.aimTime ?? 0.4) * (1+(this.body?.aimPenaltyPct||0)/100); }
  get aimProgress() { return U.clamp(1-this.aimRemaining/Math.max(.001,this.aimTime),0,1); }
  resetAim() { this.aimRemaining=Math.max(this.aimRemaining||0,this.aimTime); this.syncSpread(); }

  /* 实际准星落点 R = M + D*rV + N*rH。
     M 是鼠标的世界坐标；D 退化（鼠标压在玩家身上）时沿用上一次有效方向，
     否则 atan2 会在玩家中心附近跳来跳去。 */
  updateAimPoint(mx, my) {
    if (typeof mx !== 'number' || typeof my !== 'number' || !isFinite(mx) || !isFinite(my)) return;
    const dx = mx - this.x, dy = my - this.y;
    const d = Math.hypot(dx, dy);
    /* 死区内不更新方向：鼠标压在角色身上时方向没有意义，
       而且压枪把鼠标往回拉、一不小心跨过去就会翻转 180°。 */
    const dead = CFG.P.AIM_DEAD || 12;
    if (d > dead) { this.aimDir.x = dx / d; this.aimDir.y = dy / d; }
    const Dx = this.aimDir.x, Dy = this.aimDir.y;
    const Nx = -Dy, Ny = Dx;
    /* 偏移量受"鼠标离玩家还剩多少"限制：
       准星本来就被推向鼠标外侧，鼠标一贴近玩家，推远就会把准星甩到身后。
       留 keep 的余量（默认 18px），保证准星永远停在玩家前方、不会越过去。 */
    const keep = CFG.RECOIL.axis.keep || 18;
    const room = Math.max(0, d - keep);
    const offLen = Math.hypot(this.rV, this.rH);
    const k = (offLen > 1e-9 && offLen > room) ? room / offLen : 1;
    this.aimPoint.x = mx + (Dx * this.rV + Nx * this.rH) * k;
    this.aimPoint.y = my + (Dy * this.rV + Ny * this.rH) * k;

    /* 鼠标贴到（或跨过）玩家时，准星不能跟着钻进去：
       按最后一次有效方向把它顶到 keep 远处。这一条是"压枪拉过头就转身"的关键 ——
       死区里方向不变，准星就稳稳停在身前，不会跳到身后去。 */
    const rd = Math.hypot(this.aimPoint.x - this.x, this.aimPoint.y - this.y);
    if (rd < keep) {
      this.aimPoint.x = this.x + Dx * keep;
      this.aimPoint.y = this.y + Dy * keep;
    }
    /* 记住鼠标点：开火累加后要立刻按新位移重算一次，不然这一帧画的还是旧位置 */
    this.aimMouse.x = mx;
    this.aimMouse.y = my;
    this._aimValid = true;
  }

  /* 这一发该往哪打：玩家 → 实际准星。
     rV 沿 D 推远，方向不变；rH 侧移才会改变角度 ——
     这就是"垂直后坐力看着飘、但不会把子弹打高"的来源。 */
  get shootAngle() {
    const p = this.aimPoint;
    if (!this._aimValid) return this.angle;
    const dx = p.x - this.x, dy = p.y - this.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return this.angle;
    return Math.atan2(dy, dx);
  }

  checkAimProfile() {
    const profile=this.slot+':'+this.weapon.id+':'+(this.body?.id||'none')+':'+(this.body?.aimPenaltyPct||0)+':'+!!this.meleeActive;
    if(this.aimProfile!==profile){this.aimProfile=profile;this.resetAim();}
  }
  updateAim(dt) {
    this.checkAimProfile();
    if(this.moving||this.sprinting||this.dodgeT>0||this.reloadT>0||this.meleeActive)this.resetAim();
    else this.aimRemaining=Math.max(0,this.aimRemaining-dt);
    this.syncSpread();
  }

  /* 换成第 i 个武器槽。每个槽的弹匣各自记忆。 */
  switchWeapon(i) {
    Medical.cancel();
    if (i < 0 || i >= this.weapons.length) return false;
    if (!this.weapons[i]) { Game.toast('这个位置是空的'); return false; }
    if (i === this.slot) return false;
    this.weapons[this.slot].magCur = this.mag;
    this.slot = i;
    this.mag = this.weapon.magCur || 0;
    this.reloadPending = false;
    if (typeof AmmoQuick !== 'undefined') AmmoQuick.cancel();
    this.reloadT = 0;
    this.windupShot = false;      // 换枪打断还没出膛的那一发
    this.fireCd = Math.max(this.fireCd, 0.28);   // 换枪有个小硬直
    this.resetAim();
    this.syncSpread();
    /* 换枪会打断换弹，别让换弹序列的后两段还响在空枪上 */
    if (typeof SFX !== 'undefined') SFX.stopSeq('reload');
    Game.sfx(SWITCH_SFX[this.weapon.id] || 'shot_switch');
    return true;
  }

  /* 按存档配装填武器槽。每条可以是：
     - null / 空
     - 枪的 id（老存档）
     - 伪物品 EQUIP.gun(id, mag) —— 现在统一用这个，余弹跟着枪走 */
  fillWeapons(list) {
    this.weapons = [null, null, null];
    for (let i = 0; i < 3 && i < (list || []).length; i++) {
      const e = list[i];
      let def = null, mag = 0;
      if (typeof e === 'string') {
        def = WEAPONS[e];
        mag = def ? def.mag : 0;      // 只给 id 就当满弹匣
      } else if (e && e.equip && e.equip.kind === 'gun') {
        def = WEAPONS[e.equip.gun];
        mag = e.equip.mag || 0;
      } else if (e && e.id && WEAPONS[e.id]) {
        def = WEAPONS[e.id];
      }
      if (!def) continue;
      const loaded = (e && e.equip && AMMO_BY_ID[e.equip.ammo] && AMMO_BY_ID[e.equip.ammo].caliber === def.caliber)
        ? e.equip.ammo : def.ammo;
      this.weapons[i] = Object.assign({}, def, { magCur: U.clamp(mag | 0, 0, def.mag), ammo: loaded, rounds: magazineRounds(def, mag, loaded, e?.equip?.rounds) });
    }
    /* 余弹照存档来 —— 空着就是空着，不白送子弹 */
    this.slot = this.weapons[0] ? 0 : (this.weapons[1] ? 1 : 2);
    if (!this.weapons[this.slot]) this.slot = 0;   // 三个都空：别让 slot 指到不存在的枪
    this.mag = this.weapon.magCur || 0;
  }

  tickAnimation(dt, looting) {
    const duration = state => PLAYER_ANIMS[state].frames / PLAYER_ANIMS[state].fps;
    const state = this.dead ? 'death' : this.hurtAnimT > 0 ? 'hurt'
      : this.dodgeT > 0 ? 'dodge' : this.shotAnimT > 0 ? 'shoot'
      : looting ? 'loot' : this.frameTravel > 0.01 ? 'walk' : 'idle';
    if (this.anim.state !== state) { this.anim.state = state; this.anim.time = 0; }
    else this.anim.time += state === 'walk' ? this.frameTravel / CFG.P.SPEED : dt;
    if (state === 'shoot') this.anim.time = duration('shoot') - this.shotAnimT;
    if (state === 'hurt') this.anim.time = duration('hurt') - this.hurtAnimT;
    if (state === 'dodge') this.anim.time = duration('dodge') * (1 - this.dodgeT / CFG.P.DODGE_TIME);
    this.shotAnimT = Math.max(0, this.shotAnimT - dt);
    this.hurtAnimT = Math.max(0, this.hurtAnimT - dt);
  }

  update(dt, input) {
    this.frameTravel = 0;
    if (this.dead) return;

    this.fireCd = Math.max(0, this.fireCd - dt);
    /* 击发延迟到点就出膛。扣扳机后即使松手也照打——
       扳机已经压下去，这一发是承诺过的。 */
    if (this.windupShot) {
      this.windupT -= dt;
      if (this.windupT <= 0) { this.windupT = 0; this._fireNow(); }
    }
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.reloadT = Math.max(0, this.reloadT - dt);
    this.sinceShot += dt;
    this.finishReloadIfDone();

    /* 朝向：鼠标贴着角色时 atan2 会剧烈抖动；更麻烦的是双轴后坐力把准星推远后，
       玩家为了压枪会把鼠标往自己身上拉，拉过头就翻 180°。所以给一个死区：
       鼠标离玩家超过 AIM_DEAD 才改朝向，要转身就得明确移到另一侧。 */
    if (input.aimX != null && input.aimY != null) {
      const adx = input.aimX - this.x, ady = input.aimY - this.y;
      if (Math.hypot(adx, ady) > (CFG.P.AIM_DEAD || 12)) this.angle = input.aimAngle;
      /* 准星落点按鼠标世界坐标算（Game.update 每帧塞进 input.aimX/aimY） */
      this.updateAimPoint(input.aimX, input.aimY);
    } else {
      /* 没有坐标的调用方（测试、AI）保持旧行为 */
      this.angle = input.aimAngle;
    }
    this.sneaking = input.sneak;
    this.sprinting = input.sprint && !input.sneak;
    /* 治疗期间可以走，但不能冲刺——冲刺直接打断 */
    if (this.sprinting && Game.action && Game.action.type === 'heal') {
      Medical.cancel('冲刺打断了治疗');
      this.sprinting = false;
    }
    this.inWater = M.flooded(M.tx(this.x), M.ty(this.y));

    /* --- 闪避 --- */
    if (this.dodgeT > 0) {
      this.resetAim();
      this.dodgeT -= dt;
      const sp = CFG.P.DODGE_SPEED * (this.dodgeT > 0 ? 1 : 0);
      this.vx = Math.cos(this.dodgeAngle) * sp;
      this.vy = Math.sin(this.dodgeAngle) * sp;
      const x0 = this.x, y0 = this.y;
      moveEntity(this, this.vx * dt, this.vy * dt);
      this.frameTravel = U.dist(x0, y0, this.x, this.y);
      if (this.dodgeT <= 0) {
        this.vx *= 0.3; this.vy *= 0.3;
        /* 收尾踩实一步：闪避才不是"飘"过去的 */
        const n = 1 + ((Math.random() * 4) | 0);
        Game.sfx('step_stone_' + n, { rate: 1.06, vol: 1.1 });
      }
      return;   // 闪避期间不响应移动输入
    }
    if (input.dodge && this.dodgeCd <= 0) {
      this.resetAim();
      this.dodgeCd = CFG.P.DODGE_CD;
      this.dodgeT = CFG.P.DODGE_TIME;
      this.dodgeAngle = this.angle;
      this.windupShot = false;      // 闪避会把还没出膛的那一发收掉
      Noise.emit(this.x, this.y, CFG.NOISE.dodge, 'dodge');
      Game.sfx('dodge');
      return;
    }

    /* --- 移动 --- */
    let mx = input.mx, my = input.my;
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      mx /= len; my /= len;
      this.moving = true;
    } else {
      this.moving = false;
      mx = my = 0;
    }

    let speed = CFG.P.SPEED;
    if (this.sneaking) speed *= CFG.P.SNEAK;
    else if (this.sprinting) speed *= CFG.P.SPRINT;
    speed *= this.tier.move;
    if (this.inWater) speed *= CFG.P.WATER_SLOW;
    /* 边打药边走：正常步行的 30% */
    if (Game.action && Game.action.type === 'heal') speed *= 0.3;

    const targetVx = mx * speed;
    const targetVy = my * speed;
    const k = 1 - Math.exp(-CFG.P.ACCEL * dt);
    this.vx += (targetVx - this.vx) * k;
    this.vy += (targetVy - this.vy) * k;

    const x0 = this.x, y0 = this.y;
    moveEntity(this, this.vx * dt, this.vy * dt);
    this.frameTravel = U.dist(x0, y0, this.x, this.y);

    this.updateAim(dt);

    /* --- 脚步：按走过的距离触发，站住自然就没声了 ---
       步频跟"实际速度"走：stride = 60 * (v / 步行速度)^0.4。
       走 120 → 60px 一步；冲刺 206 → 74px，每秒约 2.8 步；潜行 53 → 43px。
       负重、护甲、涉水、边打药走都会自己变密或变疏，不用再按状态列举。
       注意别按 frameTravel 清零：顶着墙走时每帧位移接近 0，
       那样会把已经攒的进度反复抹掉，走两步丢一步。有输入才累加，松手才清。 */
    if (this.moving) {
      this.stepDist += this.frameTravel;
      const spd = Math.hypot(this.vx, this.vy);
      const stride = U.clamp(60 * Math.pow(spd / CFG.P.SPEED, 0.4), 26, 120);
      if (this.stepDist >= stride) {
        this.stepDist -= stride;
        const n = 1 + ((Math.random() * 4) | 0);
        /* 越快步子越沉；潜行压到七成，但别让人听不见自己 */
        const vol = U.clamp(0.55 + 0.45 * (spd / CFG.P.SPEED), 0.5, 1.2);
        Game.sfx('step_stone_' + n, { rate: 0.94 + Math.random() * 0.12, vol });
      }
    } else if (this.stepDist > 0) {
      this.stepDist = 0;        // 松手就清零，别攒到下次一迈腿连响两下
    }

    /* --- 涉水掉血 --- */
    if (this.inWater) {
      this.waterT += dt;
      if (this.waterT > CFG.P.WATER_DMG_DELAY) {
        this.hp -= CFG.P.WATER_DMG * dt;
        Medical.cancel(); Save.setHP(this.hp, false);
        if (this.hp <= 0) { this.hp = 0; this.dead = true; }
      }
    } else {
      this.waterT = 0;
    }

    /* --- 后坐力恢复 --- */
    // 静止恢复快，移动中只有一半，潜行更快回正
    const R = CFG.RECOIL;
    if (this.sinceShot > R.decayDelay && this.recoil > 0) {
      let rate = R.decay;
      if (this.moving) rate *= R.decayMoveMult;
      if (this.sneaking) rate *= R.decaySneakMult;
      this.recoil = Math.max(0, this.recoil - rate * dt);
      this.syncSpread();
    }

    /* --- 双轴后坐力恢复 ---
       指数衰减：每帧乘 exp(-k*dt)，所以任何帧率下同样时间恢复的比例都相同；
       天然"先快后慢"，有惯性而不会过冲，也不需要额外做回弹。
       停火超过各自的 decayDelay 才开始，移动中回正慢一点。 */
    const AX = R.axis;
    if (this.rH !== 0 && this.sinceShot > AX.h.decayDelay) {
      const k = AX.h.decay * (this.sneaking ? 1.30 : (this.moving ? 0.70 : 1));
      this.rH *= Math.exp(-k * dt);
      if (Math.abs(this.rH) < 0.05) this.rH = 0;
    }
    if (this.rV !== 0 && this.sinceShot > AX.v.decayDelay) {
      const k = AX.v.decay * (this.sneaking ? 1.30 : (this.moving ? 0.70 : 1));
      this.rV *= Math.exp(-k * dt);
      if (this.rV < 0.05) this.rV = 0;
    }

    /* --- 准星抖动回弹 --- */
    const kd = Math.exp(-R.kickDecay * dt);
    this.crossKick.x *= kd;
    this.crossKick.y *= kd;
    if (Math.abs(this.crossKick.x) < 0.06) this.crossKick.x = 0;
    if (Math.abs(this.crossKick.y) < 0.06) this.crossKick.y = 0;

    /* --- 移动噪声 --- */
    this.noiseT -= dt;
    if (this.noiseT <= 0 && this.moving) {
      this.noiseT = 0.36;
      let base = this.sneaking ? CFG.NOISE.sneak
        : this.sprinting ? CFG.NOISE.sprint
        : CFG.NOISE.walk;
      base *= this.tier.noise;
      if (this.inWater) base *= CFG.NOISE.waterMult;
      Noise.emit(this.x, this.y, base, 'step');
    } else if (!this.moving && this.noiseT <= 0) {
      this.noiseT = 0.5;
    }
  }

  tryShoot() {
    Medical.cancel();
    if (this.dead || !this.weapons[this.slot]) return false;
    this.checkAimProfile();
    if (this.reloadT > 0) return false;
    if (this.fireCd > 0) return false;
    if (this.dodgeT > 0) return false;
    if (this.mag <= 0) { this.tryReload(); return false; }
    if (this.windupShot) return false;              // 扳机已经扣下去，正在等击发

    /* 击发延迟：扣扳机到子弹出膛之间的空档（W.windup，秒）。
       默认 0 —— 只有靶场或以后改数值时才会走到这里。 */
    const W = this.weapon;
    if (W.windup > 0) {
      this.windupT = W.windup;
      this.windupShot = true;
      this.sinceShot = 0;
      return false;
    }
    return this._fireNow();
  }

  /* 真正的开火：扣弹、撒弹丸、累加后坐力、出声 */
  _fireNow() {
    if (this.dead || !this.weapons[this.slot]) return false;
    if (this.reloadT > 0 || this.dodgeT > 0) return false;
    if (this.mag <= 0) { this.windupShot = false; return false; }

    const W = this.weapon;
    const R = CFG.RECOIL;
    this.windupShot = false;
    this.fireCd = 60 / W.rpm;
    const shotAmmo = this.ammoItem;
    W.rounds = this.roundsFor(W, this.mag).slice(1);
    this.mag--;
    W.magCur = this.mag;
    this.shotAnimT = PLAYER_ANIMS.shoot.frames / PLAYER_ANIMS.shoot.fps / (this.animSpeed || 1);

    // 这一发用「开火前」的散布，后面的累加只影响下一发
    /* 弹道方向取"开火前的实际准星"：双轴后坐力已经把准星推离鼠标点，
       但这一发仍按推之前的位置打出去，累加只影响后续几发。
       玩家可能刚被瞬移过（调试入口、测试），所以先按当前坐标重算一次准星。 */
    if (this._aimValid) this.updateAimPoint(this.aimMouse.x, this.aimMouse.y);
    const aimA = this.shootAngle;
    const pellets = W.pellets || 1;
    // 霰弹的每颗弹丸再额外散开一点，否则六颗会叠成一束
    const sp = pellets > 1 ? this.spread * 1.7 : this.spread;
    /* 弹药属性一次取好：伤害系数进单颗伤害，穿透等级随子弹走。
       霰弹的六颗弹丸分辨率独立，所以这里每颗都带同一份弹药属性、各自结算。 */
    const ammo = shotAmmo;
    const ammoMul = ammo ? ammo.dmgMul : 1;
    const pen = ammo ? ammo.penLevel : 1;
    for (let i = 0; i < pellets; i++) {
      const a = aimA + U.rand(-sp, sp);
      const mx = this.x + Math.cos(a) * 14;
      const my = this.y + Math.sin(a) * 14;
      Game.bullets.push(new Bullet(mx, my, a, W.speed, 'player',
        U.rand(W.dmgMin, W.dmgMax) * ammoMul, W.range, pen));
    }

    // 后坐力累加：冲刺 > 移动 > 站立，潜行更稳
    let mul = 1;
    if (this.sprinting) mul = R.sprintMult;
    else if (this.moving) mul = R.moveMult;
    else if (this.sneaking) mul = R.sneakMult;
    this.recoil = Math.min(R.max, this.recoil + (W.recoilPerShot || R.perShot) * mul);
    this.sinceShot = 0;
    this.syncSpread();

    /* --- 双轴后坐力 ---
       垂直只加不减：绝不会反向把准星往玩家身上拉。
       水平每发随机左右，但幅度收敛、且有累计上限，连射会形成稳定的"晃动区间"
       而不是一路飞走；bias 可以让某把枪固定偏向一侧（枪口上跳的偏斜）。 */
    const AX = R.axis;
    let mulH = 1, mulV = 1;
    if (this.sprinting) { mulH = AX.h.sprintMult; mulV = AX.v.sprintMult; }
    else if (this.moving) { mulH = AX.h.moveMult; mulV = AX.v.moveMult; }
    else if (this.sneaking) { mulH = AX.h.sneakMult; mulV = AX.v.sneakMult; }

    this.rV = Math.min(AX.v.max, this.rV + AX.v.kick * mulV);

    /* 方向：bias 不为 0 固定偏向一侧，否则对半随机。
       扰动取两次均匀分布的均值（近似三角分布），小扰动更常见，偶尔才来一下大的。 */
    const sign = AX.h.bias > 0 ? 1 : (AX.h.bias < 0 ? -1 : (Math.random() < 0.5 ? -1 : 1));
    const jitter = (Math.random() + Math.random() - 1) * AX.h.rand;
    this.rH = U.clamp(this.rH + (AX.h.kick + jitter) * mulH * sign, -AX.h.max, AX.h.max);

    /* 位移变了就立刻重算准星，别等下一帧 update */
    if (this._aimValid) this.updateAimPoint(this.aimMouse.x, this.aimMouse.y);

    // 准星抖一下（纯视觉反馈，不改弹道）
    // 加个位移上限，免得连射时准星被推出屏幕
    const kick = R.kickMin + this.recoil * R.kickScale;
    this.crossKick.x = U.clamp(this.crossKick.x + U.rand(-kick, kick), -16, 16);
    this.crossKick.y = U.clamp(this.crossKick.y + U.rand(-kick, kick), -16, 16);

    Noise.emit(this.x, this.y, CFG.NOISE.shoot, 'shot');
    Game.muzzle(this.x + Math.cos(this.angle) * 16, this.y + Math.sin(this.angle) * 16);
    /* 枪型参数交给音效层：四把枪的开火声从同一套合成参数里分化出来 */
    Game.sfx('shot', { gun: W.id });
    return true;
  }

  /* 后坐力与准备散布取较大值，不重复乘算；稳定精度不变。 */
  syncSpread() {
    const W = this.weapon, R = CFG.RECOIL;
    const lo = W.spreadBase != null ? W.spreadBase : R.spreadBase;
    const hi = W.spreadMax != null ? W.spreadMax : R.spreadMax;
    const recoilSpread=lo+(hi-lo)*this.recoil;
    const preparationSpread=lo+(hi-lo)*0.35*(1-this.aimProgress);
    this.spread = this.meleeActive ? recoilSpread : Math.max(recoilSpread,preparationSpread);
  }

  roundsFor(w, n) {
    w.rounds = magazineRounds(w, n, w.ammo, w.rounds);
    return w.rounds;
  }

  unloadWeapon(slot = this.slot) {
    const w = this.weapons[slot];
    if (!w) return false;
    const n = slot === this.slot ? this.mag : w.magCur;
    const rounds = this.roundsFor(w, n);
    if (!n) return true;
    const snapshot = this.bag.slots.map(s => ({...s}));
    const counts = {};
    for (const id of rounds) counts[id] = (counts[id] || 0) + 1;
    for (const [id, count] of Object.entries(counts)) {
      if (!this.bag.addAmmo(id, count)) {
        this.bag.slots = snapshot; Game.toast('背包空间不足，退弹已取消'); return false;
      }
    }
    Medical.cancel();
    w.rounds = []; w.magCur = 0;
    if (slot === this.slot) {
      this.mag = 0; this.reloadT = 0; this.reloadPending = false;
      if (typeof SFX !== 'undefined') SFX.stopSeq('reload');
    }
    Game.syncGear(); Game.renderBag(); return true;
  }

  tryReload() {
    Medical.cancel();
    if (this.dead || !this.weapons[this.slot] || this.reloadT > 0 || this.mag >= this.weapon.mag) return false;
    if (!this.bag.ammoCountByCaliber(this.weapon.caliber)) { Game.toast('没有同口径备弹'); return false; }
    this.reloadT = CFG.P.RELOAD_TIME;
    this.reloadPending = true; this.reloadSlot = this.slot;
    Game.sfx('reload');
    Noise.emit(this.x, this.y, CFG.NOISE.reload, 'reload'); return true;
  }

  finishReloadIfDone() {
    if (!this.reloadPending || this.reloadT > 0) return;
    this.reloadPending = false;
    if (this.dead || this.reloadSlot !== this.slot) return;
    const w = this.weapon, rounds = this.roundsFor(w, this.mag);
    const priority = AMMO_BY_ID[w.ammo]?.caliber === w.caliber ? w.ammo : this.ammoId;
    const ids = [...new Set([priority, ...this.bag.ammoStacks(w.caliber).map(s => s.item.id)])];
    for (const id of ids) {
      const n = Math.min(w.mag - rounds.length, this.bag.ammoCount(id));
      if (n > 0) { this.bag.useAmmo(id, n); rounds.push(...Array(n).fill(id)); }
    }
    this.mag = w.magCur = rounds.length; Game.syncGear();
    if (Game.bagOpen) Game.renderBag();
  }

  loadAmmo(id) {
    const w = this.weapons[this.slot], item = AMMO_BY_ID[id];
    if (!w || !item || item.caliber !== w.caliber) { Game.toast('只能装填同口径弹药'); return false; }
    if (!this.unloadWeapon()) return false;
    w.ammo = id; Game.syncGear(); Game.toast('优先装填：' + item.name);
    this.tryReload(); return true;
  }

  /* base 是「没乘部位倍率、没乘弹药系数」的原始伤害，pen 是弹药穿透等级。
     部位倍率先并进来，再交给 BALLISTICS 统一算穿透与耐久，别在这里各乘一次。 */
  hurt(base, part, pen) {
    if (this.dead) return;
    part = part || 'body';
    const head = part === 'head';
    const gear = head ? this.helmet : this.body;
    const pre = base * (head ? CFG.COMBAT.HEAD_MULT : 1);
    const res = BALLISTICS.hit(pre, pen == null ? CFG.AMMO.UNARMED_PEN : pen, gear);
    const dmg = res.health;

    this.hurtAnimT = PLAYER_ANIMS.hurt.frames / PLAYER_ANIMS.hurt.fps;
    this.hp -= dmg;
    /* 受击不打断治疗：只有死亡才强制中断（下面 hp<=0 那一段处理） */
    Save.setHP(this.hp);
    Game.shake(head ? 4.4 : 3.2);
    Game.flash(head ? '#b23f36' : '#8d3a3a', head ? 0.30 : 0.22);
    Game.hitDir = Game.lastHitAngle;
    if (head) Game.headshotMark();

    /* 护甲耐久：只有真的挡下伤害才掉，穿透干净的一发不磨甲 */
    if (gear && res.durabilityLoss > 0) {
      const wasOk = GEAR.state(gear);
      gear.dur = Math.max(0, gear.dur - res.durabilityLoss);
      const nowOk = GEAR.state(gear);
      if (wasOk !== 'broken' && nowOk === 'broken') {
        Game.toast(GEAR[gear.type].label + '被打穿了，已经失效');
        Game.sfx('break');
      } else if (wasOk === 'ok' && nowOk === 'worn') {
        Game.toast(GEAR[gear.type].label + '破损了');
      }
      Game.syncGear();
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      Medical.cancel('死亡打断了治疗');
      Game.onPlayerDeath(this);
    }
  }
}

/* ---------------- 敌人 ---------------- */
class Enemy {
  constructor(typeKey, x, y, patrolRadius, spawnConfig = {}) {
    const t = ENEMY_TYPES[typeKey];
    this.key = typeKey;
    this.t = t;
    this.x = x; this.y = y;
    this.r = 7;
    this.headR = CFG.COMBAT.HEAD_RADIUS;
    /* 人（拾荒者）：先掷一个 1~4 的等级，头、甲、身上带的弹全按这个等级走，
       "子弹和头甲等级一致"就是在这里保证的。机械体不穿戴，走原来的空手路线。 */
    if (t.human && !t.tactical) {
      const lv = ENEMY_LOADOUT.rollLevel();
      this.gearLv = lv;
      this.helmet = Math.random() < ENEMY_LOADOUT.helmetChance ? GEAR.random('helmet', lv) : null;
      this.body = Math.random() < ENEMY_LOADOUT.bodyChance ? GEAR.random('body', lv) : null;
      // 手里那把枪：决定尸体上掉哪种口径的弹，也决定自己打出去的弹
      this.weaponId = U.pick(['pistol', 'pistol', 'smg', 'shotgun']);
      this.ammoId = BALLISTICS.ammoId((WEAPONS[this.weaponId] || {}).caliber || '9mm', lv);
      this.penLevel = BALLISTICS.tier(lv).pen;   // 打出来的子弹也是这个等级
    } else {
      this.weaponId = null;
      this.gearLv = 0;
      this.ammoId = null;
      this.penLevel = null;                      // null = 走 UNARMED_PEN
    }
    this.hp = t.hp;
    this.maxHp = t.hp;
    this.angle = Math.random() * Math.PI * 2;
    this.state = 'patrol';
    this.stateT = 0;
    this.suspectX = x; this.suspectY = y;
    this.path = null;
    this.pathI = 0;
    this.repathT = Math.random() * CFG.ENEMY.REPATH;
    this.atkCd = 0;
    this.target = null;        // { kind:'player'|'enemy', ref }
    this.chaseT = 0;
    this.noiseScanT = Math.random() * 0.1;
    this.homeX = x; this.homeY = y;
    this.patrolRadius = patrolRadius ?? (t.tactical ? 2 : 4);
    this.patrolPt = null;
    this.dead = false;
    this.hurtFlash = 0;
    this.seenPlayerT = 0;
    this.alarmPlayed = false;
    this.patrolCd = 0;
    if (t.tactical) HumanAI.init(this,spawnConfig);
  }

  /* 感知倍率（安静区会削弱） */
  senseMult() {
    const q = Quiet.factor(this.x, this.y);
    return 1 - q * (1 - CFG.QUIET_SENSE);
  }

  /* 察觉到玩家了吗？
     有视觉的走 canSee（射程 + 视野角 + 遮挡）；全盲的（回响体 sight=0）
     本来就没有"看见"这回事，用它自己的近身存在感代替，否则它永远进不了 chase、
     也就永远不会攻击 —— 只会在噪声点原地打转。 */
  sensePlayer(P) {
    if (!P || P.dead) return false;
    if (this.t.sight > 0) return this.canSee(P.x, P.y);
    const d = U.dist(this.x, this.y, P.x, P.y);
    const r = (CFG.ENEMY.BLIND_SENSE || 3.0) * CFG.TILE * this.senseMult() *
      (P.sneaking ? 0.55 : 1);
    if (d > r) return false;
    /* 贴身（1.2 格）隔着墙角也能感到；远一点就要视线通 */
    if (d <= CFG.TILE * 1.2) return true;
    return M.lineOfSight(M.tx(this.x), M.ty(this.y), M.tx(P.x), M.ty(P.y));
  }

  canSee(wx, wy) {
    const s = this.t.sight;
    if (s <= 0) return false;
    const d = U.dist(this.x, this.y, wx, wy);
    let range = s * CFG.TILE * this.senseMult();
    if (d > range) return false;
    // 近身 2 格内不看朝向
    if (d > 2 * CFG.TILE) {
      const a = Math.atan2(wy - this.y, wx - this.x);
      if (Math.abs(U.angDiff(a, this.angle)) > this.t.fov / 2) return false;
    }
    return M.lineOfSight(
      M.tx(this.x), M.ty(this.y),
      M.tx(wx), M.ty(wy)
    );
  }

  hearNoises(dt) {
    this.noiseScanT -= dt;
    if (this.noiseScanT > 0) return null;
    this.noiseScanT = CFG.NOISE_TICK;

    const mult = this.t.hear * this.senseMult();
    for (const e of Noise.events) {
      if (e.kind === 'step' && this.t.sight > 0 && this.state === 'patrol') {
        // 巡逻中的敌人对远处脚步不敏感，避免全图连锁
        if (U.dist(this.x, this.y, e.x, e.y) > e.r * mult * 0.6) continue;
      }
      const d = U.dist(this.x, this.y, e.x, e.y);
      if (d < e.r * mult) {
        return { x: e.x, y: e.y };
      }
    }
    return null;
  }

  /* 找敌对目标：玩家 or 别的阵营的敌人（v0.4 的"敌人互斗"）
     回响体没有视野，用近身感知代替；其它敌人用正常视觉。 */
  perceiveFoe() {
    const isEcho = this.t.sight === 0;
    let best = null, bd = 1e9;
    for (const o of Game.enemies) {
      if (o === this || o.dead) continue;
      if (o.t.faction === this.t.faction) continue;
      const d = U.dist(this.x, this.y, o.x, o.y);
      if (d >= bd) continue;
      if (isEcho) {
        if (d < 3.2 * CFG.TILE) { bd = d; best = o; }
      } else {
        if (d < this.t.sight * CFG.TILE * this.senseMult() && this.canSee(o.x, o.y)) {
          bd = d; best = o;
        }
      }
    }
    return best;
  }

  setPathTo(tx, ty) {
    const p = M.findPath(M.tx(this.x), M.ty(this.y), tx, ty);
    this.path = p;
    this.pathI = 0;
  }

  moveAlongPath(dt, speed) {
    if (!this.path || this.pathI >= this.path.length) return false;
    const node = this.path[this.pathI];
    if (!M.walkable(node.x, node.y)) { this.path = null; return false; }
    const point=M.navigationPoint(node.x,node.y),wx=point.x,wy=point.y;
    const d = U.dist(this.x, this.y, wx, wy);
    if (d < 0.5) {
      this.pathI++;
      return true;
    }
    const a = Math.atan2(wy - this.y, wx - this.x);
    const step = Math.min(d, speed * dt);
    const beforeX = this.x, beforeY = this.y;
    moveEntity(this, Math.cos(a) * step, Math.sin(a) * step);
    if (U.dist(beforeX, beforeY, this.x, this.y) < 0.001) { this.path = null; return false; }
    this.angle = a;
    return true;
  }

  update(dt) {
    if (this.dead) return;
    if (this.t.tactical) return HumanAI.update(this,dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.patrolCd = Math.max(0, this.patrolCd - dt);
    this.stateT += dt;

    const P = Game.player;
    const canSeePlayer = this.sensePlayer(P);
    const heard = this.hearNoises(dt);

    /* ---------- 感知 → 状态 ---------- */
    if (canSeePlayer) {
      this.seenPlayerT = 0.9;
      if (this.state !== 'chase') {
        this.state = 'chase';
        this.stateT = 0;
        this.chaseT = 0;
        this.target = { kind: 'player' };
        this.path = null;
        // 拾荒者发现玩家会喊一声，把同伴引过来
        if (this.t.faction === 'scav' && !this.alarmPlayed) {
          this.alarmPlayed = true;
          Noise.emit(this.x, this.y, 15, 'shout');
          Game.toast('有人喊了一声');
        }
      }
    } else if (heard) {
      this.seenPlayerT = Math.max(0, this.seenPlayerT - dt);
      if (this.state === 'patrol' || this.state === 'idle') {
        this.state = 'suspect';
        this.stateT = 0;
        // 模糊化：误差 ±2 格
        this.suspectX = heard.x + U.rand(-2, 2) * CFG.TILE;
        this.suspectY = heard.y + U.rand(-2, 2) * CFG.TILE;
        this.path = null;
      }
    } else {
      this.seenPlayerT = Math.max(0, this.seenPlayerT - dt);
    }

    /* ---------- 互斗：看不见玩家时，转头去打敌对阵营 ---------- */
    if (!canSeePlayer && this.state !== 'chase') {
      const foe = this.perceiveFoe();
      if (foe) {
        this.target = { kind: 'enemy', ref: foe };
        this.state = 'chase';
        this.stateT = 0;
        this.chaseT = 0;
        this.path = null;
      }
    }

    /* ---------- 状态行为 ---------- */
    const speed = this.t.speed * (this.state === 'chase' ? 1.25 : 1);

    switch (this.state) {
      case 'patrol': {
        if (!this.path || this.pathI >= this.path.length) {
          if (this.patrolCd <= 0) {
            const ax = M.tx(this.homeX) + U.randInt(-this.patrolRadius, this.patrolRadius);
            const ay = M.ty(this.homeY) + U.randInt(-this.patrolRadius, this.patrolRadius);
            this.path = null;
            if (M.walkable(ax, ay)) this.setPathTo(ax, ay);
            if (!this.path) this.patrolCd = 0.8;
          }
        }
        this.moveAlongPath(dt, speed * 0.55);
        break;
      }
      case 'suspect': {
        if (this.stateT > CFG.ENEMY.SUSPECT_TIME) {
          this.state = 'patrol';
          this.stateT = 0;
          this.path = null;
          break;
        }
        if (!this.path) {
          this.setPathTo(M.tx(this.suspectX), M.ty(this.suspectY));
        }
        const moving = this.moveAlongPath(dt, speed * 0.85);
        if (!moving) {
          // 到达，原地环视
          this.angle += dt * 1.6;
        }
        break;
      }
      case 'chase': {
        this.chaseT += dt;
        // 优先打玩家；看不见玩家就打敌对单位（互斗）
        if (canSeePlayer) {
          this.target = { kind: 'player' };
        } else {
          const cur = this.currentTargetPos();
          if (!cur || Math.random() < dt * 1.5) {
            const foe = this.perceiveFoe();
            if (foe) this.target = { kind: 'enemy', ref: foe };
            else if (!cur) {
              this.state = 'patrol';
              this.stateT = 0;
              this.path = null;
              this.chaseT = 0;
              break;
            }
          }
        }

        const tgt = this.currentTargetPos();
        if (!tgt) { this.state = 'patrol'; this.stateT = 0; break; }

        const d = U.dist(this.x, this.y, tgt.x, tgt.y);

        /* 能不能打：有视觉的要求真的看见（射程 + 朝向 + 遮挡）；
           全盲的近战只要够近、视线没被墙挡住就行 —— 它本来就不看朝向。 */
        const reachable = this.t.sight > 0
          ? this.canSee(tgt.x, tgt.y)
          : M.lineOfSight(M.tx(this.x), M.ty(this.y), M.tx(tgt.x), M.ty(tgt.y));

        // 在射程内且够得着 → 停下攻击
        if (d < this.t.range && reachable) {
          this.angle = Math.atan2(tgt.y - this.y, tgt.x - this.x);
          if (this.atkCd <= 0) this.attack(tgt);
          // 略微保持距离
          if (d < this.t.range * 0.45 && this.t.arrow) {
            const back = Math.atan2(this.y - tgt.y, this.x - tgt.x);
            moveEntity(this, Math.cos(back) * speed * 0.5 * dt,
              Math.sin(back) * speed * 0.5 * dt);
          }
        } else {
          this.repathT -= dt;
          if (!this.path || this.repathT <= 0) {
            this.repathT = CFG.ENEMY.REPATH + Math.random() * 0.25;
            this.setPathTo(M.tx(tgt.x), M.ty(tgt.y));
          }
          if (!this.moveAlongPath(dt, speed)) {
            // 寻路失败，直接朝目标走
            const a = Math.atan2(tgt.y - this.y, tgt.x - this.x);
            this.angle = a;
            moveEntity(this, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
          }
        }

        // 追击耐心
        if (this.chaseT > CFG.ENEMY.CHASE_TIME && this.seenPlayerT <= 0) {
          this.state = 'suspect';
          this.stateT = 0;
          this.suspectX = this.x; this.suspectY = this.y;
          this.path = null;
          this.chaseT = 0;
          this.alarmPlayed = false;
        }
        break;
      }
      default:
        this.state = 'patrol';
    }

    /* 血量低时逃跑（拾荒者） */
    if (this.t.faction === 'scav' && this.hp < this.maxHp * 0.3 &&
        this.state === 'chase' && Math.random() < dt * 0.9) {
      this.state = 'patrol';
      this.path = null;
      this.chaseT = 0;
      this.homeX = this.x; this.homeY = this.y;
    }
  }

  currentTargetPos() {
    if (!this.target) return null;
    if (this.target.kind === 'player') {
      const P = Game.player;
      return P.dead ? null : { x: P.x, y: P.y };
    }
    const e = this.target.ref;
    if (!e || e.dead) return null;
    return { x: e.x, y: e.y };
  }

  attack(tgt) {
    this.atkCd = this.t.cd;
    if (this.t.arrow) {
      const a = Math.atan2(tgt.y - this.y, tgt.x - this.x)
        + U.rand(-0.07, 0.07);
      Game.bullets.push(new Bullet(
        this.x + Math.cos(a) * 12, this.y + Math.sin(a) * 12,
        a, 480, this.t.faction, this.t.dmg, 460,
        this.penLevel                               // 人打的弹按他自己那个等级穿透
      ));
      Noise.emit(this.x, this.y, CFG.NOISE.shoot * 0.8, 'shot');
      Game.sfx('enemyShot');
    } else {
      // 近战
      const d = U.dist(this.x, this.y, tgt.x, tgt.y);
      if (d < this.t.range + 8) {
        if (this.target.kind === 'player') Game.player.hurt(this.t.dmg, 'body', this.penLevel);
        else tgt.hp -= this.t.dmg;
      }
      Game.sfx('melee');
    }
  }

  hurt(d, fromFaction, part, pen, damageType) {
    if (this.dead) return;
    part = part || 'body';
    const head = part === 'head';
    const gear = head ? this.helmet : this.body;
    const pre = d * (head ? CFG.COMBAT.HEAD_MULT : 1);
    const res = damageType === 'trueDamage' ? {health:d,durabilityLoss:0} : BALLISTICS.hit(pre, pen == null ? CFG.AMMO.UNARMED_PEN : pen, gear);
    this.hp -= res.health;
    /* 敌人穿着护甲时一样会被打穿、掉耐久，尸体上捡到的就是打剩下的那件 */
    if (gear && res.durabilityLoss > 0) {
      gear.dur = Math.max(0, gear.dur - res.durabilityLoss);
    }
    this.hurtFlash = 0.12;
    // 被打会立刻警觉
    if (this.t.tactical) HumanAI.hurt(this,fromFaction);
    if (!this.t.tactical && (this.state === 'patrol' || this.state === 'suspect')) {
      this.state = 'chase';
      this.stateT = 0;
      this.chaseT = 0;
      this.path = null;
      if (!this.target) this.target = { kind: 'player' };
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if(this.ai){this.ai.phase=null;this.ai.burstLeft=0;}
      Game.onEnemyKilled(this);
    }
  }
}

/* ---------------- 子弹 ---------------- */
class Bullet {
  constructor(x, y, angle, speed, faction, dmg, range, pen) {
    this.x = x; this.y = y;
    this.sx = x; this.sy = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.faction = faction;   // 'player' | 'scav' | 'echo' | 'guard'
    this.dmg = dmg;
    this.range = range;
    /* 穿透等级：玩家子弹带的是那一发弹药的等级；
       没有弹药来源的射击（敌人制式武器）走 UNARMED_PEN。 */
    this.pen = (pen == null) ? CFG.AMMO.UNARMED_PEN : pen;
    this.life = CFG.BULLET.LIFE;
    this.dead = false;
    this.angle = angle;
  }

  update(dt) {
    if (this.dead) return;
    // 防御：坐标一旦坏掉就当作已消失，别让一颗子弹拖垮整局
    if (!isFinite(this.x) || !isFinite(this.y)) { this.dead = true; return; }
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // 细分步进：一小段一小段地推进，每一段里比较"墙"和"人"谁先接触
    const steps = 4;
    for (let step = 0; step < steps; step++) {
      const ax = this.x, ay = this.y;
      this.x += this.vx * dt / steps;
      this.y += this.vy * dt / steps;

      if (this.hitSegment(ax, ay, this.x, this.y)) return;

      if (U.dist(this.sx, this.sy, this.x, this.y) > this.range) {
        /* 靶场：把「飞不到」的位置也标出来，一眼看出射程够不够得着靶墙 */
        if (this.faction === 'player' && typeof Range !== 'undefined' && Range.active) {
          Range.trailEnd(this.x, this.y);
        }
        this.dead = true;
        return;
      }
    }
  }

  /* 这一小段弹道上最先接触到的东西：墙 or 角色（含命中部位）
     返回 true 表示这颗子弹已经结算完，不该继续飞 */
  hitSegment(ax, ay, bx, by) {
    // 1) 墙：沿这一小段按 2px 采样，取最早越界的位置
    let wallT = 2;
    const segLen = Math.hypot(bx - ax, by - ay);
    const probes = Math.max(1, Math.ceil(segLen / 2));
    for (let i = 1; i <= probes; i++) {
      const t = i / probes;
      const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
      if (M.blocksShot(M.tx(px), M.ty(py),px,py)) { wallT = t; break; }
    }

    // 2) 角色：线段到圆心最短距离 ≤ 有效半径就算碰到
    const br = CFG.BULLET.RADIUS;
    let best = null;
    for (const a of this.targets()) {
      if (a.dead) continue;
      const d = segDist(ax, ay, bx, by, a.x, a.y);
      if (d > a.r + br) continue;
      const t = segT(ax, ay, bx, by, a.x, a.y);
      if (t >= wallT) continue;                     // 墙挡在人前面
      if (best && t >= best.t) continue;
      const headR = (a.headR != null ? a.headR : CFG.COMBAT.HEAD_RADIUS) + br;
      best = { actor: a, t: t, part: d <= headR ? 'head' : 'body' };
    }

    // 3) 结算：墙优先于后面的目标，人也只吃一颗子弹
    if (best) {
      this.resolveHit(best.actor, best.part);
      return true;
    }
    if (wallT <= 1) {
      this.dead = true;
      Game.impact(bx, by, this.angle);
      return true;
    }
    return false;
  }

  /* 这颗子弹能打到谁 */
  targets() {
    const out = [];
    if (this.faction === 'player') {
      for (const e of Game.enemies) if (!e.dead) out.push(e);
      /* 靶场的钢板靶：不是敌人，但结算路径一样走 hurt() */
      if (Game.targets) for (const t of Game.targets) if (!t.dead) out.push(t);
    } else {
      const P = Game.player;
      if (P && !P.dead) out.push(P);
      for (const e of Game.enemies) {
        if (e.dead || e.t.faction === this.faction) continue;
        out.push(e);
      }
    }
    return out;
  }

  resolveHit(actor, part) {
    const base = this.dmg * this.falloff();
    this.dead = true;

    if (actor === Game.player) {
      Game.lastHitAngle = Math.atan2(this.vy, this.vx);
      actor.hurt(base, part, this.pen);
      Game.impact(actor.x, actor.y, this.angle, true, false);
      return;
    }

    /* 敌人：部位倍率与护甲穿透都在 hurt 里统一算；
       钢板靶只吃伤害数字，不喷血也算命中音 */
    const dummy = !!actor.isRangeTarget;
    actor.hurt(base, this.faction, part, this.pen);
    Game.impact(actor.x, actor.y, this.angle, !dummy, part === 'head');
    Game.sfx(dummy ? 'hit' : (part === 'head' ? 'headshot' : 'hit'));
  }

  falloff() {
    const W = CFG.WEAPON;
    const d = U.dist(this.sx, this.sy, this.x, this.y);
    if (d < W.falloffStart) return 1;
    const t = U.clamp((d - W.falloffStart) / (W.falloffEnd - W.falloffStart), 0, 1);
    return 1 - t * 0.45;
  }
}

/* ---------------- 尸体（可搜） ---------------- */
class Corpse {
  constructor(x, y, enemy) {
    this.x = x; this.y = y;
    this.enemy = enemy;
    this.key = (enemy && enemy.key) || 'scav';   // 画哪种尸体
    // 倒地朝向：按 90° 取随机，避免一地尸体全都朝同一个方向
    this.rot = U.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    this.opened = false;
    this.loot = [];
    this.bagLv = 0;        // 人型敌人的背包等级（1~3）；0 = 没有背包（回响体）
    this.bagName = '';
    // 拾荒者身上有他的装备与战利品；回响体留下结晶
    if (enemy.t.tactical) {
      HumanAI.corpse(enemy,this);
    } else if (enemy.t.faction === 'echo') {
      const od = ITEMS.filter(i => i.cat === 'odd');
      this.loot.push({ item: Loot.pickFromPool(od), n: 1 });
      if (Math.random() < 0.5) this.loot.push({ item: ITEMS.find(i => i.id === 'heal01'), n: 1 });
    } else if (enemy.t.faction === 'guard') {
      /* 人型：随机等级的背包，等级 = 这具尸体能搜出几件普通物品。
         子弹和身上穿的枪/头/甲不占这几格 —— 那是他带的东西，不是包里翻出来的。 */
      this.fillBag(ITEMS.filter(i => i.cat === 'ind' || i.cat === 'elec'));
      this.loot.push({ item: defaultAmmo('556'), n: 12 });
    } else {
      this.fillBag(ITEMS.filter(i => i.r <= 2));
      /* 他包里的弹：等级和自己身上的头甲一致，10~30 发 */
      const lv = enemy.gearLv || 1;
      const caliber = (WEAPONS[enemy.weaponId] || {}).caliber || '9mm';
      const ammo = ammoItem(caliber, lv) || defaultAmmo(caliber);
      if (ammo) this.loot.push({ item: ammo, n: U.randInt(ENEMY_LOADOUT.ammoMin, ENEMY_LOADOUT.ammoMax) });
      // 他身上穿的东西：头盔、护甲，还有手里的枪（gun 一律存武器 id 字符串）
      if (enemy.helmet) this.loot.push({ gear: enemy.helmet });
      if (enemy.body) this.loot.push({ gear: enemy.body });
      if (enemy.weaponId) this.loot.push({ gun: enemy.weaponId });
    }
  }

  /* 掷一个背包等级，把那只包塞进战利品，再按等级塞对应件数的普通物品。
     包是"容器"也是"战利品"：摸出来能直接背，容量比身上那只大就换掉。
     同一具尸体里不抽重复物品（三件都是同一罐石头的观感太差），池子抽干就少放。
     不在 factions 名单里的敌人（机械守卫）仍旧只掉一件，不吃改动的亏。 */
  fillBag(pool) {
    const B = CFG.CORPSE_BAG || {};
    const on = !Array.isArray(B.factions) || B.factions.indexOf(this.key) >= 0;
    if (!on) {
      const it = Loot.pickFromPool(pool);
      if (it) this.loot.push({ item: it, n: 1 });
      return 1;
    }
    this.bagLv = Loot.rollBagLevel();
    const bagId = 'bag0' + this.bagLv;
    const def = (typeof BACKPACK !== 'undefined' && BACKPACK.def(bagId)) || null;
    this.bagName = def ? def.name : '';
    /* 包本身放最前面：它是这具尸体上最值钱的一件，也是"能装几件"的来源 */
    const bagItem = (typeof EQUIP !== 'undefined') ? EQUIP.bag(bagId) : null;
    /* known:true —— 包背在尸体外面一眼就看得见，和头盔护甲一样不用单独搜；
       要搜的是"包里装了什么"，所以下面那些才是未搜索状态。 */
    if (bagItem) this.loot.push({ item: bagItem, n: 1, corpseBag: true, known: true });

    const cap = (B.itemsByLevel || {})[this.bagLv] || this.bagLv;
    const used = new Set();
    for (let i = 0; i < cap; i++) {
      const it = Loot.pickFromPool(pool.filter(x => !used.has(x.id)));
      if (!it) break;
      used.add(it.id);
      this.loot.push({ item: it, n: 1, fromBag: true });
    }
    return this.bagLv;
  }
}
