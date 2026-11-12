/* ============================================================
   潮汐线 · 实体层
   玩家 / 敌人 / 子弹 / 投掷物 / 尸体
   ============================================================ */

/* 换枪音：有专属采样的枪单独列出来，其余沿用通用滑套声。
   霰弹枪用的是泵动前推上膛（Freesound 858509），比"啪嗒"一声更重。 */
const SWITCH_SFX = {
  shotgun: 'shot_switch_shotgun'
};

/* 型号 → 专属切枪音（优先于上面的类别映射）。G36C / Groza / UMP45 用
   各自换弹录音拆出的"最后一段"作为切枪声；其余型号回落到 SWITCH_SFX[类别]，
   再不行用通用 shot_switch。键是 WEAPONS 里的型号 id。 */
const SWITCH_MODEL = {
  g36c: 'switch_g36c',
  groza1: 'switch_groza',
  ump45: 'switch_ump45',
  galil_arm: 'switch_galil',
  /* 6851 口径两把枪共用一段拉栓声作切枪（与换弹尾声同源） */
  mcx_spear: 'switch_6851',
  rm277: 'switch_6851'
};

/* Weapon physics shared by player and human AI. Trigger decisions remain with each controller.
   ------------------------------------------------------------
   六参数模型：枪只存 rpm / aimTime / recoilVMul / recoilHMul /
   spreadGrowthMul / spreadMul，物理绝对值统一来自 CFG.RECOIL。
   derive() 是唯一派生入口 —— 改全局手感只动 config.js，别在枪上写死数字。 */
const Firearms = {
  derive(w) {
    const R = CFG.RECOIL, AX = R.axis;
    const v = w && w.recoilVMul != null ? w.recoilVMul : 1;
    const h = w && w.recoilHMul != null ? w.recoilHMul : 1;
    const g = w && w.spreadGrowthMul != null ? w.spreadGrowthMul : 1;
    const s = w && w.spreadMul != null ? w.spreadMul : 1;
    return {
      vKick: AX.v.kick * v,          // 纵向单发冲击（px）
      hKick: AX.h.kick * h,          // 横向单发冲击（px）
      growth: R.perShot * g,         // 每发累加的后坐热度
      spreadBase: R.spreadBase * s,  // 静止散布（弧度）
      spreadMax: R.spreadMax * s     // 满后坐散布（弧度）
    };
  },
  spread(w, recoil) {
    const d = this.derive(w);
    return d.spreadBase + (d.spreadMax - d.spreadBase) * (recoil || 0);
  },
  emit(w, o) {
    const center=o.angle+U.rand(-o.spread,o.spread),pellets=w.pellets||1;
    /* 战斗系统 V1：伤害来自弹药表的固定 B / P。武器不再随机 dmgMin~dmgMax，
       也不再有按等级增长的 dmgMul；同口径同弹药，每发结果确定。
       12 Gauge 的六颗弹丸共享同一份 B/P，各自独立走 Combat.resolve()。 */
    const spec = Combat.ammoOf(o.ammo) || Combat.ammo(w.caliber, BALLISTICS.defaultLevel(w.caliber));
    for(let i=0;i<pellets;i++){
      const a=center+(pellets>1?U.rand(-(w.pelletSpread||0),w.pelletSpread||0):0);
      Game.bullets.push(new Bullet(o.x+Math.cos(a)*14,o.y+Math.sin(a)*14,a,w.speed,o.faction,
        spec.B,w.range,spec.P,o.meta));
    }
    return pellets;
  },
  kick(s,w) {
    const R=CFG.RECOIL,AX=R.axis,d=this.derive(w);
    const mul=s.sprinting?R.sprintMult:s.moving?R.moveMult:s.sneaking?R.sneakMult:1;
    s.recoil=Math.min(R.max,s.recoil+d.growth*mul);s.sinceShot=0;
    const mv=s.sprinting?AX.v.sprintMult:s.moving?AX.v.moveMult:s.sneaking?AX.v.sneakMult:1;
    const mh=s.sprinting?AX.h.sprintMult:s.moving?AX.h.moveMult:s.sneaking?AX.h.sneakMult:1;
    s.rV=Math.min(AX.v.max,s.rV+d.vKick*mv);
    const sign=AX.h.bias>0?1:AX.h.bias<0?-1:Math.random()<.5?-1:1;
    const jitter=(Math.random()+Math.random()-1)*AX.h.rand;
    s.rH=U.clamp(s.rH+(d.hKick+jitter)*mh*sign,-AX.h.max,AX.h.max);
  },
  recover(s,w,dt) {
    const R=CFG.RECOIL,AX=R.axis;
    if(s.sinceShot>R.decayDelay&&s.recoil>0){
      /* 半衰期恢复：每 decayHalfLife 秒减半。stance 是半衰期倍率（>1 更快），
         乘在 dt 上；潜行优先于移动 —— 蹲着挪也算潜行，两项相乘会把潜行加成
         抵消成比静止还慢。指数衰减逐帧相乘，30/60/144FPS 结果一致。 */
      const stance=s.sneaking?R.decaySneakMult:s.moving?R.decayMoveMult:1;
      s.recoil*=Math.pow(0.5,dt*stance/R.decayHalfLife);
      if(s.recoil<0.01)s.recoil=0;
    }
    /* 回正速度只来自全局常量：配件不再修正它（精密枪托改走射击稳定性）。 */
    const stance=s.sneaking?1.3:s.moving?.7:1;
    if(s.rH!==0&&s.sinceShot>AX.h.decayDelay){s.rH*=Math.exp(-AX.h.decay*stance*dt);if(Math.abs(s.rH)<.05)s.rH=0;}
    if(s.rV!==0&&s.sinceShot>AX.v.decayDelay){s.rV*=Math.exp(-AX.v.decay*stance*dt);if(s.rV<.05)s.rV=0;}
  }
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
    /* 钥匙链：只用来开门，不参与 capacity / weight / value 的计算，
       所以塞满 6 把钥匙也不会挤占背包格或抬高背包价值。 */
    this.chain = [];
  }
  weight() {
    let w = 0;
    for (const s of this.slots) w += s.item.w * s.n;
    for (const s of this.safe) w += s.item.w * s.n;
    return w;
  }
  value() {
    let v = 0;
    for (const s of this.slots) v += (typeof RaidValue!=='undefined'?RaidValue.value(s.item,s):entryValue(s.item,s)) * s.n;
    for (const s of this.safe) v += (typeof RaidValue!=='undefined'?RaidValue.value(s.item,s):entryValue(s.item,s)) * s.n;
    return v;
  }
  count() { return this.slots.length; }

  tier() { return weightTier(this.weight()); }

  canAdd(item, n, cap) {
    n = Math.max(1, n | 0);
    /* 背包可以塞进背包：它只占 1 格、只加自重，不会让容量变大，
       所以可以带着备用包进图，进去再换上。 */
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
    const max = ItemCapacity.max(item);
    if (!max) return true;
    return (typeof entry.cap === 'number' ? entry.cap : max) >= max - 1e-6;
  }

  add(item, n, cap) {
    n = Math.max(1, n | 0);
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
      this.slots.push(ItemCapacity.max(item)
        ? { item, n: put, cap: typeof cap === 'number' ? cap : ItemCapacity.max(item) }
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
    /* 体力：上限先按满级给，成长系统落地后按角色等级取一段 */
    this.maxStamina = (CFG.STAMINA && CFG.STAMINA.MAX) || 100;
    this.stamina = this.maxStamina;
    this.stamRegenT = 9;      // 距上次消耗多久（开局算早就歇够了）
    this.stamAlpha = 0;       // 体力条显示浓度 0~1，满体力会淡到 0
    this.stamHold = 0;        // 回满之后再亮一会儿
    this.exhausted = false;   // 力竭：回到 EXHAUST_EXIT 之前冲不动
    this.dodgeMsgT = 0;       // 「闪不动」提示的节流
    this.noiseT = 0;
    this.stepDist = 0;          // 距上一步走过的距离，够了就响一声
    this.waterT = 0;
    this.moving = false;
    this.sneaking = false;
    this.sprinting = false;
    this._sprintVoiced = false;  // 这一轮冲刺的起步声已经响过了吗
    this.inWater = false;
    this.dead = false;
    /* 局内损伤状态：玩家恒有；没有这个字段的实体（机械守卫 / 回响体 / 钢板靶）完全免疫。 */
    this.debuffs = Debuff.fresh();
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

  /* ---------------- 体力 ----------------
     冲刺按秒扣、闪避一次性扣，负重只放大"消耗"，不影响上限。 */
  get stamRatio() { return U.clamp(this.stamina / Math.max(1, this.maxStamina), 0, 1); }
  /* 中载及以下不变，重载变贵，超载最贵（跟 BAG.TIERS 的档位对齐） */
  get stamLoadMult() {
    const L = CFG.STAMINA && CFG.STAMINA.LOAD_MULT;
    return L ? (L[this.tier.i] != null ? L[this.tier.i] : 1) : 1;
  }
  dodgeCost() { return (CFG.STAMINA.DODGE_COST || 0) * this.stamLoadMult; }
  canDodge() { return !this.dodgeBlockedWhy(); }
  /* 超载为什么不能闪：那个档位移速已经砍到 55%，还能滑一步就没人怕超载了。
     体力不够同理——闪避是"应急"，应急不该无条件。 */
  dodgeBlockedWhy() {
    const S = CFG.STAMINA;
    if (this.tier.i >= S.NO_DODGE_TIER) return '超载，闪不动';
    if (this.stamina < this.dodgeCost()) return '体力不够，闪不动';
    return '';
  }
  spendStamina(v) {
    this.stamina = Math.max(0, this.stamina - v);
    this.stamRegenT = 0;
    this.stamHold = CFG.STAMINA.HOLD;
    if (this.stamina <= 0) { this.exhausted = true; this.sprinting = false; }
  }
  updateStamina(dt, sprinting, moving) {
    const S = CFG.STAMINA;
    if (sprinting && moving && !this.exhausted) {
      this.spendStamina(S.SPRINT_DRAIN * this.stamLoadMult * dt);
    } else {
      this.stamRegenT += dt;
      if (this.stamRegenT >= S.REGEN_DELAY && this.stamina < this.maxStamina) {
        this.stamina = Math.min(this.maxStamina, this.stamina + S.REGEN * dt);
      }
      /* 力竭要歇够才能再冲，不然回 1 点就能接着冲，条会一直贴着 0 抖 */
      if (this.exhausted && this.stamRatio >= S.EXHAUST_EXIT) this.exhausted = false;
    }
    /* 显示：不满就一直亮着；回满后停 HOLD 秒再慢慢化掉，别老糊在视野里 */
    const full = this.stamina >= this.maxStamina - 0.01;
    if (!full || this.stamHold > 0) {
      if (full) this.stamHold -= dt;
      else this.stamHold = S.HOLD;
      this.stamAlpha = Math.min(1, this.stamAlpha + dt / S.FADE_IN);
    } else {
      this.stamAlpha = Math.max(0, this.stamAlpha - dt / S.FADE);
    }
  }
  /* 按了闪避但闪不动：一句话说明原因，节流免得连点刷屏 */
  dodgeDenied(why) {
    if (this.dodgeMsgT > 0 || !why) return;
    this.dodgeMsgT = 1.1;
    if (typeof Game !== 'undefined' && Game.toast) Game.toast(why);
  }

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
    /* 死区内不更新方向：鼠标正好压在角色中心时 atan2 没有稳定解，
       沿用上一次有效方向免得准星乱抖。鼠标穿过去、离开死区就照常翻向另一侧。 */
    const dead = CFG.P.AIM_DEAD || 12;
    if (d > dead) { this.aimDir.x = dx / d; this.aimDir.y = dy / d; }
    const Dx = this.aimDir.x, Dy = this.aimDir.y;
    const Nx = -Dy, Ny = Dx;
    /* 偏移量原样叠加，不再按"鼠标离玩家还剩多少"缩放、也不再给准星设最小半径。
       那两层夹取会让鼠标穿过玩家时准星被顶回身前：贴身近战要往身后甩枪，
       光标和准星却卡在身前，操作直接被锁死。现在鼠标想穿就穿，准星跟着走。 */
    this.aimPoint.x = mx + (Dx * this.rV + Nx * this.rH);
    this.aimPoint.y = my + (Dy * this.rV + Ny * this.rH);

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
    const profile=this.slot+':'+this.weapon.id+':'+JSON.stringify(this.weapon.attachments||{})+':'+(this.body?.id||'none')+':'+(this.body?.aimPenaltyPct||0)+':'+!!this.meleeActive;
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
    Game.sfx(SWITCH_MODEL[this.weapon.id] || SWITCH_SFX[this.weapon.category] || 'shot_switch');
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
      if(typeof Attachments!=='undefined')def=Attachments.resolve(def.id,e?.equip?.attachments);
      const loaded = (e && e.equip && AMMO_BY_ID[e.equip.ammo] && AMMO_BY_ID[e.equip.ammo].caliber === def.caliber)
        ? e.equip.ammo : def.ammo;
      this.weapons[i] = Object.assign({}, def, { magCur: U.clamp(mag | 0, 0, def.mag), ammo: loaded, rounds: magazineRounds(def, mag, loaded, e?.equip?.rounds),fireMode:e?.equip?.fireMode||def.defaultMode,cycleRemaining:e?.equip?.cycleRemaining||0 });
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

    /* 朝向：鼠标正好压在角色中心时 atan2 会剧烈抖动，所以留一个死区：
       离玩家超过 AIM_DEAD 才改朝向。鼠标穿过玩家、到另一侧离开死区就翻向那边，
       贴身近战要甩枪时不会被卡在身前。 */
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
    /* 力竭或空槽时冲不起来：不是"按住没用"，是这一下确实蹬不动了 */
    this.sprinting = input.sprint && !input.sneak && !this.exhausted && this.stamina > 0;
    this.dodgeMsgT = Math.max(0, this.dodgeMsgT - dt);
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
      const sp = CFG.P.DODGE_SPEED * (this.dodgeT > 0 ? 1 : 0) * (this._dodgeDistMult || 1);
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
      this.updateStamina(dt, false, false);   // 滑行中不回体力，但条要亮着
      return;   // 闪避期间不响应移动输入
    }
    if (input.dodge && this.dodgeCd <= 0) {
      const why = this.dodgeBlockedWhy();
      if (why) {
        this.dodgeDenied(why);          // 闪不动就给个说法，然后照常走移动分支
      } else {
        this.resetAim();
        this.dodgeCd = CFG.P.DODGE_CD * Debuff.dodgeCdMult(this);
        this.dodgeT = CFG.P.DODGE_TIME;
        this._dodgeDistMult = Debuff.dodgeDistMult(this);  // 开始时快照，途中镇痛到期不突变
        this.dodgeAngle = this.angle;
        this.windupShot = false;      // 闪避会把还没出膛的那一发收掉
        this.spendStamina(this.dodgeCost());
        /* 骨折翻滚的额外掉血：直扣 HP、无视护甲、不触发致残、镇痛不能免除 */
        Debuff.onRoll(this);
        Noise.emit(this.x, this.y, CFG.NOISE.dodge, 'dodge');
        Game.sfx('dodge');
        this.updateStamina(dt, false, false);
        return;
      }
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
    /* 疼痛（含骨折派生）的操作惩罚，镇痛期间自动归零 */
    speed *= Debuff.moveMult(this);

    const targetVx = mx * speed;
    const targetVy = my * speed;
    const k = 1 - Math.exp(-CFG.P.ACCEL * dt);
    this.vx += (targetVx - this.vx) * k;
    this.vy += (targetVy - this.vy) * k;

    const x0 = this.x, y0 = this.y;
    moveEntity(this, this.vx * dt, this.vy * dt);
    this.frameTravel = U.dist(x0, y0, this.x, this.y);
    /* 体力在移动之后结一次账：这帧到底动没动（moving）到这儿才确定 */
    this.updateStamina(dt, this.sprinting, this.moving);

    /* --- 冲刺起步：蹬地一声，只响一次 ---
       sprinting 是"按住 Shift"这个状态，站着按住也一样为真，所以还要 moving：
       真跑起来了才响，原地不动不响。松开再按会再响一次，那是又一次起步，应该的。 */
    if (this.sprinting && this.moving) {
      if (!this._sprintVoiced) {
        this._sprintVoiced = true;
        Game.sfx('sprint', { rate: 0.97 + Math.random() * 0.06 });
      }
    } else {
      this._sprintVoiced = false;
    }

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

    /* 玩家与人类敌人共用散布及双轴后坐力恢复。 */
    const R=CFG.RECOIL;
    Firearms.recover(this,this.weapon,dt);this.syncSpread();

    /* --- 准星抖动回弹 --- */
    const kd = Math.exp(-R.kickDecay * dt);
    this.crossKick.x *= kd;
    this.crossKick.y *= kd;
    if (Math.abs(this.crossKick.x) < 0.06) this.crossKick.x = 0;
    if (Math.abs(this.crossKick.y) < 0.06) this.crossKick.y = 0;
    /* 疼痛让准星持续轻微游走：复用现有的 crossKick 回弹与渲染链 */
    const sway = Debuff.swayMult(this);
    if (sway > 1) {
      const k = (sway - 1) * 18 * dt;
      this.crossKick.x = U.clamp(this.crossKick.x + U.rand(-k, k), -16, 16);
      this.crossKick.y = U.clamp(this.crossKick.y + U.rand(-k, k), -16, 16);
    }

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
    /* 致伤元数据与伤害 / 穿透 / 弹药等级解耦：一次开火只生成一次，霰弹六颗共享 */
    const hitMeta = Debuff.attack(W.attackType || 'bullet',
      { mul: W.injuryChanceMul == null ? 1 : W.injuryChanceMul });
    Firearms.emit(W,{x:this.x,y:this.y,angle:aimA,spread:this.spread,ammo:shotAmmo,faction:'player',meta:hitMeta});
    Firearms.kick(this,W);this.syncSpread();

    /* 位移变了就立刻重算准星，别等下一帧 update */
    if (this._aimValid) this.updateAimPoint(this.aimMouse.x, this.aimMouse.y);

    // 准星抖一下（纯视觉反馈，不改弹道）
    // 加个位移上限，免得连射时准星被推出屏幕
    const kick = R.kickMin + this.recoil * R.kickScale;
    this.crossKick.x = U.clamp(this.crossKick.x + U.rand(-kick, kick), -16, 16);
    this.crossKick.y = U.clamp(this.crossKick.y + U.rand(-kick, kick), -16, 16);

    Noise.emit(this.x, this.y, CFG.NOISE.shoot * (W.noiseRadius??1), 'shot');
    Game.muzzle(this.x + Math.cos(this.angle) * 16, this.y + Math.sin(this.angle) * 16);
    /* 枪型参数交给音效层：四把枪的开火声从同一套合成参数里分化出来 */
    Game.sfx('shot', { gun: W.id, attachments:W.attachments });
    return true;
  }

  /* 后坐力与准备散布取较大值，不重复乘算；稳定精度不变。 */
  syncSpread() {
    const W = this.weapon, d = Firearms.derive(W);
    const lo = d.spreadBase, hi = d.spreadMax;
    const recoilSpread=Firearms.spread(W,this.recoil);
    const preparationSpread=lo+(hi-lo)*0.35*(1-this.aimProgress);
    this.spread = (this.meleeActive ? recoilSpread : Math.max(recoilSpread,preparationSpread)) * (this.sneaking?1:(W.hipSpread??1))
      + Debuff.spreadAdd(this);
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
    Game.sfx('reload', { model: this.weapon.id });
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

  /* 战斗系统 V1：B 是弹药固定基础肉伤、P 是穿透力、mul 是距离衰减。
     护甲选择、穿透判定、磨甲量、部位倍率全部交给 Combat.resolve()，
     玩家与敌人共用同一套规则；这里只负责掉血、反馈与存档写回。 */
  /* 返回**实际掉的血**（扣完护甲）：伤害飘字按这个数显示，
     不是按枪的纸面伤害 —— 打穿护甲和打在护甲上，玩家看到的数字得不一样。 */
  hurt(B, part, P, kind, meta, mul) {
    if (this.dead) return 0;
    part = part || 'body';
    const head = part === 'head';
    const res = Combat.resolve({
      B, P: (P == null ? CFG.AMMO.UNARMED_PEN : P),
      part, helmet: this.helmet, body: this.body,
      mul: (mul == null ? 1 : mul)
    });
    const dmg = res.health;

    /* 自己挨打也飘字，但不再单独配色：按伤害类型走和敌人同一张表
       （普通枪伤骨白、爆头橙金、近战蓝）。kind 由伤害来源传进来，
       没传就按部位推：写在 hurt 里，将来任何新的掉血来源都自动覆盖。 */
    Game.popDamage(this.x, this.y - 20, dmg,
      { kind: kind || (head ? 'crit' : 'normal'), key: this });
    this.hurtAnimT = PLAYER_ANIMS.hurt.frames / PLAYER_ANIMS.hurt.fps;
    this.hp -= dmg;
    /* 玩家受伤人声：三段随机，SFX.POOL 里按 0.8 秒节流 —— 自动武器一梭子
       扫过来不会叠成一片惨叫。护甲完全挡下（dmg=0）或已阵亡都不出声。 */
    if (dmg > 0 && this.hp > 0) Game.sfx('hurtPlayer');
    /* 受击不打断治疗：只有死亡才强制中断（下面 hp<=0 那一段处理） */
    Save.setHP(this.hp);
    /* 唯一致伤入口：拿「实际掉血」判定，护甲完全抵挡（0）或蹭伤过小都不触发。
       放在扣血之后，重伤截断当前 HP 才不会把这一发的伤害再算一遍。 */
    if (this.hp > 0) Debuff.onHit(this, { dealt: dmg, meta, now: Game.time });
    /* 手术是长读条，受击打断；其余医疗动作沿用「受击不打断」。 */
    if (Game.action && Game.action.interruptOnHit && dmg >= CFG.DEBUFF.MIN_HEALTH_DMG)
      Medical.cancel('受击打断了手术');
    /* 插着钥匙挨一枪手会缩回来：开锁读条同样受击打断，且不消耗钥匙耐久。 */
    if (Game.action?.type === 'unlock' && dmg >= CFG.DEBUFF.MIN_HEALTH_DMG && Game.cancelUnlock)
      Game.cancelUnlock('受击打断了开锁');
    Game.shake(head ? 4.4 : 3.2);
    Game.flash(head ? '#b23f36' : '#8d3a3a', head ? 0.30 : 0.22);
    Game.hitDir = Game.lastHitAngle;
    if (head) Game.headshotMark();

    /* V1：只要命中时身上有甲就磨甲，穿透成功也一样（ΔD 与穿透结果无关）。
       穿透判定用的是「命中前的耐久」，本发的 ΔD 绝不影响本发。 */
    const before = res.armor ? GEAR.state(res.armor) : 'none';
    const broke = Combat.applyDurability(res);
    if (res.durabilityLoss > 0) {
      const after = res.armor ? GEAR.state(res.armor) : 'none';
      if (broke) {
        Game.toast(GEAR[res.armor.type].label + '被打穿了，已经失效');
        Game.sfx('break');
      } else if (before === 'ok' && after === 'worn') {
        Game.toast(GEAR[res.armor.type].label + '破损了');
      }
      Game.syncGear();
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      Medical.cancel('死亡打断了治疗');
      Game.onPlayerDeath(this);
    }
    return dmg;
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
      this.penLevel = Combat.legacyPen(lv);      // 旧制式射击的兼容穿透力 P
    } else {
      this.weaponId = null;
      this.gearLv = 0;
      this.ammoId = null;
      /* 异常体 / 机械造物不穿甲，保留各自的专属基础肉伤 t.dmg；
         制式射击统一给 Lv3 兼容穿透力，免得玩家穿上甲后完全打不动。 */
      this.penLevel = Combat.legacyPen(3);
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
    /* 只有「人」才吃损伤状态；机械与异常体没有这份局内状态。 */
    if (t.human) this.debuffs = Debuff.fresh();
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
    if (this.debuffs) speed *= Debuff.moveMult(this);
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

  /* 进入战斗状态的唯一入口：只有从非 chase 切进来的那一次算「接战」。
     异常生物（目前是回响体）在这一刻响专属接战语音，看见玩家、被同伴叫来、
     挨了一枪三条路径共用这里，不会每帧重播、也不会在开火时反复触发。
     SFX 里还有 2 秒的池间隔兜住 chase↔suspect 来回抖动。 */
  enterCombat() {
    const fresh = this.state !== 'chase';
    this.state = 'chase';
    this.stateT = 0;
    this.chaseT = 0;
    this.path = null;
    if (fresh && this.t.faction === 'echo') Game.sfx('echoEngage');
    return fresh;
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
        this.enterCombat();
        this.target = { kind: 'player' };
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
        this.enterCombat();
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
            moveEntity(this, Math.cos(back) * speed * Debuff.moveMult(this) * 0.5 * dt,
              Math.sin(back) * speed * Debuff.moveMult(this) * 0.5 * dt);
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
            moveEntity(this, Math.cos(a) * speed * Debuff.moveMult(this) * dt,
              Math.sin(a) * speed * Debuff.moveMult(this) * dt);
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
      const wobble = Debuff.spreadAdd(this);
      const a = Math.atan2(tgt.y - this.y, tgt.x - this.x)
        + U.rand(-0.07 - wobble, 0.07 + wobble);
      Game.bullets.push(new Bullet(
        this.x + Math.cos(a) * 12, this.y + Math.sin(a) * 12,
        a, 480, this.t.faction, this.t.dmg, 460,
        this.penLevel,                             // V1：这一发子弹的穿透力 P
        Debuff.enemyAttack(this.t)                    // 致残率按这个敌人的攻击频率归一
      ));
      Noise.emit(this.x, this.y, CFG.NOISE.shoot * 0.8, 'shot');
      Game.sfx('enemyShot');
    } else {
      // tgt is a position snapshot, not the actor: resolve the actual melee victim.
      const playerTarget = this.target?.kind === 'player';
      const victim = playerTarget ? Game.player : this.target?.ref;
      if (victim && !victim.dead && (playerTarget || victim.t.faction !== this.t.faction) &&
          U.dist(this.x, this.y, victim.x, victim.y) < this.t.range + 8 &&
          M.lineOfSight(M.tx(this.x), M.ty(this.y), M.tx(victim.x), M.ty(victim.y))) {
        const meta = Debuff.enemyAttack(this.t);
        if (playerTarget) victim.hurt(this.t.dmg, 'body', this.penLevel, 'melee', meta);
        else victim.hurt(this.t.dmg, this.t.faction, 'body', this.penLevel, 'melee', meta);
      }
      Game.sfx('melee');
    }
  }

  /* 与 Player.hurt 共用 Combat.resolve()：同样的弹药与护甲规则。
     trueDamage 是玩家近战的专属真伤，绕过护甲与部位倍率，只吃距离衰减。 */
  hurt(d, fromFaction, part, P, damageType, meta, mul) {
    if (this.dead) return 0;
    part = part || 'body';
    const M = (mul == null ? 1 : mul);
    let res;
    if (damageType === 'trueDamage') {
      res = { health: d * M, durabilityLoss: 0, armor: null };
    } else {
      res = Combat.resolve({
        B: d, P: (P == null ? CFG.AMMO.UNARMED_PEN : P),
        part, helmet: this.helmet, body: this.body, mul: M
      });
    }
    this.hp -= res.health;
    /* 人形敌人受伤人声：两条随机 + 0.45 秒节流；异常体和机械守卫不吃人声。
       打死了就不喊了 —— 那一声交给 onEnemyKilled 的死亡惨叫。 */
    if (res.health > 0 && this.hp > 0 && this.t.human) Game.sfx('hurtEnemy');
    if (this.hp > 0) Debuff.onHit(this, { dealt: res.health, meta, now: Game.time });
    /* 敌人穿着护甲时一样会被磨甲，尸体上捡到的就是打剩下的那件 */
    Combat.applyDurability(res);
    this.hurtFlash = 0.12;
    // 被打会立刻警觉
    if (this.t.tactical) HumanAI.hurt(this,fromFaction);
    if (!this.t.tactical && this.hp > 0 && (this.state === 'patrol' || this.state === 'suspect')) {
      this.enterCombat();
      if (!this.target) this.target = { kind: 'player' };
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if(this.ai){this.ai.phase=null;this.ai.burstLeft=0;}
      Game.onEnemyKilled(this);
    }
    return res.health;
  }
}

/* ---------------- 子弹 ---------------- */
class Bullet {
  constructor(x, y, angle, speed, faction, dmg, range, pen, meta) {
    this.x = x; this.y = y;
    this.sx = x; this.sy = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.faction = faction;   // 'player' | 'scav' | 'echo' | 'guard'
    /* V1：dmg 字段存的是弹药「固定基础肉伤 B」，pen 字段存的是「穿透力 P」。
       两者都不含任何倍率，距离衰减与部位倍率在 Combat.resolve() 之后才乘。 */
    this.dmg = dmg;
    this.range = range;
    this.pen = (pen == null) ? CFG.AMMO.UNARMED_PEN : pen;
    /* 同一次攻击的所有弹丸共享一份 meta（attackId 用于去重） */
    this.meta = meta || null;
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
    // 正式战局默认使用精准判定；仅靶场的旧版对照按钮可临时关闭。
    const precise = !(typeof Range !== 'undefined' && Range.active && Range.preciseHits === false);
    let best = null;
    for (const a of this.targets()) {
      if (a.dead) continue;
      let d = segDist(ax, ay, bx, by, a.x, a.y);
      if (d > a.r + br) continue;
      let t = segT(ax, ay, bx, by, a.x, a.y);
      /* 身体按首次接触排序，部位按弹道横向偏差判断。
         避免短线段还没到头部内圈，就提前结算成身体。 */
      if (precise && segLen > 1e-9) {
        const dx = bx - ax, dy = by - ay;
        const cx = a.x - ax, cy = a.y - ay;
        const along = (cx * dx + cy * dy) / segLen;
        d = Math.abs(cx * dy - cy * dx) / segLen;
        const radius = a.r + br;
        const entry = along - Math.sqrt(Math.max(0, radius * radius - d * d));
        t = U.clamp(entry / segLen, 0, 1);
      }
      if (t >= wallT) continue;                     // 墙挡在人前面
      if (best && t >= best.t) continue;
      // 头部只扩张 1px，身体仍按完整子弹半径判命中。
      const headR = (a.headR != null ? a.headR : CFG.COMBAT.HEAD_RADIUS)
        + (precise ? Math.min(br, CFG.COMBAT.HEAD_BULLET_ALLOWANCE) : br);
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
    /* V1：B 是固定基础肉伤，距离衰减与部位倍率都在结算之后乘，
       不能预乘进 B —— 否则本发的磨甲量 ΔD 会被倍率一起放大。 */
    const B = this.dmg, mul = this.falloff();
    this.dead = true;

    if (actor === Game.player) {
      Game.lastHitAngle = Math.atan2(this.vy, this.vx);
      actor.hurt(B, part, this.pen, undefined, this.meta, mul);
      Game.impact(actor.x, actor.y, this.angle, true, false);
      return;
    }

    /* 敌人：部位倍率与护甲穿透都在 hurt 里统一算；
       钢板靶只吃伤害数字，不喷血也算命中音 */
    const dummy = !!actor.isRangeTarget;
    const dealt = actor.hurt(B, this.faction, part, this.pen, undefined, this.meta, mul);
    Game.impact(actor.x, actor.y, this.angle, !dummy, part === 'head');
    /* 命中反馈：打身体和打头是两段录音（660770 / 660769）。
       连打十几发时同一段会听成机械节拍，所以音高抖 ±3% 把重复感散开。 */
    Game.sfx(part === 'head' ? 'headshot' : 'hit',
      { rate: 0.97 + Math.random() * 0.06 });
    /* 只有玩家打出来的伤害才飘字：敌人互相开火时屏幕上飘一堆数字只是噪声。
       钢板靶另有自己的读数（Range 那边按散布量尺寸，字号更小），不重复画。 */
    if (this.faction === 'player' && !dummy) {
      Game.popDamage(actor.x, actor.y - 20, dealt,
        { kind: part === 'head' ? 'crit' : 'normal', key: actor });
    }
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
    this.opened = false;           // 是否已摸空（只有空了才不再可交互）
    this.searched = false;         // 是否已翻过（决定要不要读 0.35 秒的条）
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
