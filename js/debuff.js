/* ============================================================
   损伤状态：流血 / 重伤 / 骨折 / 疼痛（派生）+ 镇痛
   ------------------------------------------------------------
   一份状态对象挂在「能吃状态的实体」上（Player 恒有、human:true 的
   Enemy 才有）。没有 debuffs 对象 = 完全免疫（机械守卫、回响体、钢板靶）。

   四类状态的关系：
     流血    实际损伤，按帧掉血，不叠层，只有止血带能解
     重伤    实际损伤，按层封锁「可恢复生命上限」，手术包一次治一层
     骨折    实际损伤，不叠层，夹板或手术包可解；翻滚额外掉血不走疼痛链
     疼痛    由重伤 / 骨折 / 短期疼痛动态派生的「操作惩罚」，不单独掷概率
     镇痛    临时增益，屏蔽疼痛与骨折的移动/翻滚惩罚，不治愈任何损伤

   致残判定只有一个入口 Debuff.onHit()，由 Player.hurt / Enemy.hurt
   在扣血之后调用。攻击元数据 meta 由四个发射点在开火时生成，同一次
   攻击的所有弹丸共享 attackId，因此一发霰弹只掷一次骰。

   所有依赖（CFG / U / Game / Save）都在函数体内取用，顶层不读取别的
   模块，加载顺序不敏感。状态是纯局内数据，不写 Save、不做跨局保留。
   ============================================================ */

const Debuff = {
  _seq: 0,

  /* 新的一份局内状态。infection / erosion / limbs 只占位，本轮不接逻辑。 */
  fresh() {
    return {
      bleeding: false,
      severe: 0,
      fracture: false,
      painUntil: 0,          // 绝对局内时间（Game.time），预留「攻击直接施加短期疼痛」
      analgesicUntil: 0,     // 绝对局内时间
      _seenAttackId: null,   // 同一次攻击去重
      _seenAttackAt: -1,
      _judgeReadyAt: 0,      // 每目标致伤判定节流
      infection: 0,
      erosion: 0,
      limbs: null
    };
  },

  nextAttackId() { return 'a' + (++this._seq); },

  /* 攻击元数据。chance 显式给出时优先（敌人按攻击频率归一），
     否则用该攻击类型的默认致残率 × 倍率（武器类别差异）。 */
  attack(type, opts) {
    const D = CFG.DEBUFF;
    const at = D.ATTACK_TYPES[type] ? type : 'bullet';
    const def = D.ATTACK_TYPES[at];
    const o = opts || {};
    const meta = {
      attackId: this.nextAttackId(),
      injuryType: at,
      injuryChance: o.chance != null ? o.chance : def.chance * (o.mul == null ? 1 : o.mul),
      injuryWeights: def.weights
    };
    if (o.painSeconds) meta.painSeconds = o.painSeconds;   // 预留：攻击直接施加短期疼痛
    return meta;
  },

  /* 敌人的致残率按攻击间隔归一：扫射快的不吃亏，慢的一枪更有分量。 */
  enemyChance(t) {
    const E = CFG.DEBUFF.ENEMY;
    return U.clamp(E.BASE_CHANCE * ((t && t.cd) || E.CD_REF) / E.CD_REF, E.MIN, E.MAX);
  },

  enemyAttack(t) {
    return this.attack(t.injuryType || 'bullet', { chance: this.enemyChance(t) });
  },

  /* ---------------- 唯一致伤入口 ----------------
     调用点：Player.hurt / Enemy.hurt，均在「算出实际生命伤害并扣血」之后。
     ctx = { dealt, meta, now }。返回本次生成的损伤类型，没生成则 null。 */
  onHit(t, ctx) {
    const d = t && t.debuffs;
    if (!d || t.dead) return null;
    const m = ctx && ctx.meta;
    if (!m) return null;                  // 溺水 / 敌人互殴 / 调试直扣不触发
    const D = CFG.DEBUFF;
    const dealt = Number(ctx.dealt) || 0;
    if (dealt <= 1e-9 || dealt < D.MIN_HEALTH_DMG) return null;   // 护甲完全抵挡 / 零伤害

    const now = ctx.now != null ? ctx.now : Game.time;
    /* 同一次攻击（霰弹多弹丸、同帧多段命中）对一个目标只判一次。
       一次挥砍打中多个目标时，各自有独立的 _seenAttackId，各判一次。 */
    if (d._seenAttackId === m.attackId && now - d._seenAttackAt < D.DEDUP_WINDOW) return null;
    d._seenAttackId = m.attackId;
    d._seenAttackAt = now;

    /* 高射速 / burst 的主闸：无论中否都锁一段时间，避免连续上状态。 */
    if (now < d._judgeReadyAt) return null;
    d._judgeReadyAt = now + D.INJURY_JUDGE_CD;

    const def = D.ATTACK_TYPES[m.injuryType] || D.ATTACK_TYPES.bullet;
    const chance = m.injuryChance != null ? m.injuryChance : def.chance;
    if (Math.random() >= chance) return null;

    /* 单次攻击最多生成一种新损伤 */
    const type = this._pick(m.injuryWeights || def.weights);
    if (m.painSeconds) this.applyPain(t, m.painSeconds);
    return this.apply(t, type);
  },

  _pick(weights) {
    let total = 0;
    for (const k in weights) total += Math.max(0, weights[k] || 0);
    if (!(total > 0)) return 'bleeding';
    let r = Math.random() * total;
    for (const k in weights) {
      r -= Math.max(0, weights[k] || 0);
      if (r <= 0) return k;
    }
    return 'bleeding';
  },

  /* ---------------- 施加 / 治疗 ---------------- */
  apply(t, type) {
    const d = t.debuffs;
    if (!d) return null;
    const D = CFG.DEBUFF;

    if (type === 'bleeding') {
      if (d.bleeding) return null;        // 同类不叠层，也不刷新
      d.bleeding = true;
    } else if (type === 'fracture') {
      if (d.fracture) return null;
      d.fracture = true;
    } else if (type === 'severe') {
      if (d.severe >= D.SEVERE.MAX_LAYERS) return null;
      d.severe++;
      /* 重伤不瞬间扣除额外生命值：只是把超过新可恢复上限的当前血量截断。
         人形敌人不截断（没有治疗 AI，截断等于变相增伤），只保留层数与疼痛。 */
      const truncate = t === Game.player || D.SEVERE.TRUNCATE_ENEMIES;
      const cap = this.recoverableMax(t);
      if (truncate && t.hp > cap) {
        t.hp = Math.max(D.BLEED.MIN_HP, cap);
        if (t === Game.player) Save.setHP(t.hp, false);
      }
    } else {
      /* 预留：infection / erosion 之类的新状态在这里加 case */
      return null;
    }
    this._refresh(t);
    return type;
  },

  /* 未来「攻击直接施加短期疼痛」的接口，镇痛同样能屏蔽它。 */
  applyPain(t, seconds) {
    const d = t.debuffs;
    if (!d) return;
    d.painUntil = Math.max(d.painUntil, Game.time + seconds);
    this._refresh(t);
  },

  /* 重复服药不叠加：剩余时间取较长者。接口通用，本轮只有玩家会调用。 */
  applyAnalgesic(t, seconds) {
    const d = t.debuffs;
    if (!d) return;
    d.analgesicUntil = Math.max(d.analgesicUntil, Game.time + seconds);
    this._refresh(t);
  },

  cure(t, what) {
    const d = t.debuffs;
    if (!d) return false;
    if (what === 'bleeding' && d.bleeding) { d.bleeding = false; this._refresh(t); return true; }
    if (what === 'fracture' && d.fracture) { d.fracture = false; this._refresh(t); return true; }
    return false;
  },

  /* 手术按状态二选一：有重伤治一层，没有重伤但有骨折就解骨折。
     不回血 —— 恢复上去的血还得靠普通治疗品。 */
  surgery(t) {
    const d = t.debuffs;
    if (!d) return null;
    if (d.severe > 0) { d.severe--; this._refresh(t); return 'severe'; }
    if (d.fracture) { d.fracture = false; this._refresh(t); return 'fracture'; }
    return null;
  },

  surgeryAvailable(t) {
    const d = t && t.debuffs;
    return !!d && (d.severe > 0 || d.fracture);
  },

  has(t, what) {
    const d = t && t.debuffs;
    return !!d && (what === 'bleeding' ? d.bleeding : d.fracture);
  },

  /* 骨折翻滚的额外掉血：无视护甲、不触发致残判定、不受镇痛影响。
     仿溺水直扣 hp，不经过 hurt()，所以不会再掷一次致残骰。 */
  onRoll(t) {
    const d = t && t.debuffs;
    if (!d || !d.fracture) return;
    const D = CFG.DEBUFF;
    t.hp = Math.max(D.BLEED.MIN_HP, t.hp - D.FRACTURE.ROLL_DMG);
    if (t === Game.player) Save.setHP(t.hp, false);
    this._refresh(t);
  },

  /* ---------------- 派生数值（纯函数、现算） ---------------- */
  recoverableMax(t) {
    const d = t && t.debuffs;
    const max = (t && t.maxHp) || CFG.P.HP;
    return d ? Math.max(CFG.DEBUFF.BLEED.MIN_HP, max * (1 - CFG.DEBUFF.SEVERE.PER_LAYER * d.severe)) : max;
  },

  inPain(t) {
    const d = t && t.debuffs;
    return !!d && (d.severe > 0 || d.fracture || Game.time < d.painUntil);
  },

  analgesicActive(t) {
    const d = t && t.debuffs;
    return !!d && Game.time < d.analgesicUntil;
  },

  analgesicLeft(t) {
    const d = t && t.debuffs;
    return d ? Math.max(0, d.analgesicUntil - Game.time) : 0;
  },

  /* 骨折造成的移动 / 翻滚性能下降统一走这条疼痛链，可被镇痛压制；
     FRACTURE 里的三个倍率默认中性，只作预留，避免重复惩罚。 */
  penaltyOn(t) { return this.inPain(t) && !this.analgesicActive(t); },

  moveMult(t) {
    if (!this.penaltyOn(t)) return 1;
    const D = CFG.DEBUFF;
    return D.FRACTURE.STACK_WITH_PAIN
      ? D.PAIN.MOVE_MULT * D.FRACTURE.MOVE_MULT
      : Math.min(D.PAIN.MOVE_MULT, D.FRACTURE.MOVE_MULT);
  },

  dodgeDistMult(t) {
    if (!this.penaltyOn(t)) return 1;
    const D = CFG.DEBUFF;
    return D.FRACTURE.STACK_WITH_PAIN
      ? D.PAIN.DODGE_DIST_MULT * D.FRACTURE.DODGE_DIST_MULT
      : Math.min(D.PAIN.DODGE_DIST_MULT, D.FRACTURE.DODGE_DIST_MULT);
  },

  dodgeCdMult(t) {
    if (!this.penaltyOn(t)) return 1;
    const D = CFG.DEBUFF;
    return D.FRACTURE.STACK_WITH_PAIN
      ? D.PAIN.DODGE_CD_MULT * D.FRACTURE.DODGE_CD_MULT
      : Math.max(D.PAIN.DODGE_CD_MULT, D.FRACTURE.DODGE_CD_MULT);
  },

  spreadAdd(t) { return this.penaltyOn(t) ? CFG.DEBUFF.PAIN.SPREAD_ADD : 0; },
  swayMult(t) { return this.penaltyOn(t) ? CFG.DEBUFF.PAIN.SWAY : 1; },

  /* ---------------- 每帧 / 生命周期 ---------------- */
  tickAll(dt) {
    const D = CFG.DEBUFF;
    const one = (t) => {
      const d = t && t.debuffs;
      if (!d || t.dead || !d.bleeding) return;
      t.hp = Math.max(D.BLEED.MIN_HP, t.hp - D.BLEED.DPS * dt);
      if (t === Game.player) Save.setHP(t.hp, false);
    };
    if (Game.player) one(Game.player);
    if (Game.enemies) for (const e of Game.enemies) one(e);
  },

  clearAll() {
    if (Game.player) Game.player.debuffs = this.fresh();
    if (Game.enemies) for (const e of Game.enemies) if (e.debuffs) e.debuffs = this.fresh();
    DebuffHud.hide();
  },

  _refresh(t) {
    if (t === Game.player) DebuffHud.refresh();
  }
};

/* ---------------- 局内状态条 ----------------
   沿用医疗层的深色底 + 细描边，只用文字 chip，不引入新美术。
   结构签名不变时只改 textContent，倒计时不会每帧重建 DOM。 */
const DebuffHud = {
  el() { return document.getElementById('debuffBar'); },

  refresh() {
    const box = this.el();
    if (!box) return;
    const P = Game.player;
    const d = P && P.debuffs;
    if (Game.state !== 'playing' || !d || P.dead) { this.hide(); return; }

    const D = CFG.DEBUFF;
    const pain = Debuff.inPain(P);
    const an = Debuff.analgesicActive(P);
    const chips = [];
    if (d.bleeding) chips.push(['db-bleed', '流血']);
    if (d.severe > 0) chips.push(['db-severe', '重伤 Lv' + d.severe + ' · 上限 ' +
      Math.round((1 - D.SEVERE.PER_LAYER * d.severe) * 100) + '%']);
    if (d.fracture) chips.push(['db-fract', '骨折']);
    if (pain) chips.push(['db-pain' + (an ? ' db-muted' : ''), an ? '疼痛（已压制）' : '疼痛']);
    if (an) {
      const s = Math.ceil(Debuff.analgesicLeft(P));
      chips.push(['db-analg', '镇痛 ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')]);
    }

    if (!chips.length) { this.hide(); return; }
    /* 签名里带上文本：状态变化或镇痛倒计时跳秒时才重建一次 DOM，
       逐帧其余时候什么都不做。文字都是内部生成的常量，没有外部输入。 */
    const sig = chips.map(c => c[0] + '|' + c[1]).join('~');
    if (box._dbSig !== sig) {
      box._dbSig = sig;
      box.innerHTML = chips.map(c => '<span class="db-chip ' + c[0] + '">' + c[1] + '</span>').join('');
    }
    if (box.style.display !== 'flex') box.style.display = 'flex';
  },

  frame() { this.refresh(); },

  hide() {
    const box = this.el();
    if (!box) return;
    if (box.style.display !== 'none') box.style.display = 'none';
    if (box.innerHTML) box.innerHTML = '';
    box._dbSig = null;
  }
};
