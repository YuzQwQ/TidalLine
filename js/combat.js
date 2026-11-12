/* ============================================================
   战斗系统 V1 · 确定性伤害结算（纯函数）

   输入弹药（B / P）、命中部位、护甲状态，返回生命伤害、耐久损失、穿透结果。
   本文件不修改任何游戏状态 —— 护甲耐久的写回统一走 applyDurability()，
   玩家与人形敌人调用同一个 resolve()，不允许各自实现一套穿甲规则。

     有效防护值  A = 10L − 10(1 − D/Dmax)            D≤0 或无甲时护甲失效
     生命伤害    H = (D≤0 或 P≥A) ? B : 0.08·B·Kb    二选一，不叠加钝伤
     耐久损耗    ΔD = min[D, B(0.035+0.009P)·Kd]
     完全维修    ΔDmax = (Dmax−D)·Kr, D'max = D' = Dmax−ΔDmax

   穿透判定一律用「命中前的耐久」：本发的 ΔD 不能反过来影响本发。
   头部倍率与距离衰减不进入 B —— 它们在结算之后乘到 health 上，
   因此也不会放大本发的磨甲量 ΔD。

   12 Gauge 专项暂缓：六颗弹丸各自独立调用本函数，B/P 取兼容表，
   不做多弹丸特殊穿透结算。
   ============================================================ */
const Combat = {
  _clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

  /* 材质参数。旧存档 / 未配置的装备按芳纶兜底，避免结算里出现 NaN。 */
  material(id) {
    const m = CFG.MATERIALS;
    return (m && m[id]) || m.aramid;
  },
  materialOf(gear) {
    return this.material(gear && (gear.material || gear.mat));
  },

  /* 弹药固定肉伤 B 与穿透力 P。查询表与兜底只在 BALLISTICS.flesh 一处维护。 */
  ammo(caliber, level) {
    const s = BALLISTICS.flesh(caliber, level);
    return { B: s.B, P: s.P, caliber: s.caliber, level: s.level, compat: s.compat };
  },
  ammoOf(item) {
    return item ? this.ammo(item.caliber, item.level) : null;
  },

  /* 异常体 / 机械造物 / 敌人近战没有正规弹药，保留各自的专属基础肉伤，
     只从这里取一个按装备等级映射的兼容穿透力。 */
  legacyPen(level) {
    const t = CFG.AMMO.LEGACY_ENEMY_PEN;
    return t[this._clamp(Math.round(Number(level) || 0), 0, t.length - 1)];
  },

  /* 有效防护值。Dmax 必须是「当前最大耐久」：修过几次的甲防护上限会变低。 */
  effectiveArmor(gear) {
    if (!gear || !(gear.dur > 0)) return 0;
    const M = CFG.COMBAT_MODEL;
    const L = this._clamp(Math.round(Number(gear.lv) || 1), 1, 6);
    const Dmax = Math.max(1e-9, Number(gear.max) || 0);
    const D = this._clamp(Number(gear.dur) || 0, 0, Dmax);
    return M.LV_SCALE * L - M.WEAR_SPAN * (1 - D / Dmax);
  },

  /* ------------------------------------------------------------
     核心结算。opt = { B, P, part, armor | helmet+body, mul }
       B    基础肉伤（不含任何倍率）
       P    穿透力
       part 'head' | 'body'（决定选哪件甲、是否乘 HEAD_MULT）
       armor 直接给护甲实例；不传则按 part 从 helmet/body 里取
       mul  外部倍率（距离衰减），默认 1
     返回对象里 baseHealth 是「结算内、乘任何倍率之前」的伤害，
     health 是最终落到血量上的伤害。
     ------------------------------------------------------------ */
  resolve(opt) {
    const o = opt || {};
    const M = CFG.COMBAT_MODEL;
    const B = Math.max(0, Number(o.B) || 0);
    const P = Math.max(0, Number(o.P != null ? o.P : CFG.AMMO.UNARMED_PEN) || 0);
    const part = o.part === 'head' ? 'head' : 'body';
    const armor = o.armor != null ? o.armor : (part === 'head' ? o.helmet : o.body);
    const mul = Math.max(0, Number(o.mul != null ? o.mul : 1) || 0);
    const partMul = part === 'head' ? CFG.COMBAT.HEAD_MULT : 1;

    /* 先按命中前的耐久判定，本发的 ΔD 不参与这次比较 */
    const alive = !!(armor && armor.dur > 0);
    const mat = this.materialOf(armor);
    const A = this.effectiveArmor(armor);
    const penetrated = !alive || P >= A;
    const baseHealth = penetrated ? B : M.BLUNT_RATIO * B * mat.Kb;
    const health = baseHealth * partMul * mul;

    /* 磨甲只按基础肉伤 B 与穿透力 P 算，与部位、距离无关 */
    const D = alive ? Math.max(0, Number(armor.dur) || 0) : 0;
    const raw = B * (M.DUR_BASE + M.DUR_PER_PEN * P) * mat.Kd;
    const durabilityLoss = alive ? Math.min(D, Math.max(0, raw)) : 0;

    return {
      B, P, part, mul, partMul,
      armor: armor || null, alive, material: mat.id,
      Kb: mat.Kb, Kd: mat.Kd, Kr: mat.Kr,
      A, penetrated, blunt: alive && !penetrated,
      baseHealth, health,
      durabilityLoss, armorDurBefore: D, armorDurAfter: D - durabilityLoss
    };
  },

  /* 唯一的护甲耐久写回入口；返回「这一发是否把甲打穿」。 */
  applyDurability(res) {
    const g = res && res.armor;
    if (!g || !(res.durabilityLoss > 0)) return false;
    const wasAlive = g.dur > 0;
    const cap = Math.max(0, Number(g.max) || 0);
    g.dur = this._clamp(g.dur - res.durabilityLoss, 0, cap);
    return wasAlive && !(g.dur > 0);
  },

  /* 完全维修的上限损耗（纯计算）。Kr 只由材质决定。 */
  repairLoss(gear) {
    if (!gear) return { Kr: 0, lost: 0, capLoss: 0, newMax: 0 };
    const Kr = this.materialOf(gear).Kr;
    const max = Math.max(0, Number(gear.max) || 0);
    const dur = this._clamp(Number(gear.dur) || 0, 0, max);
    const lost = Math.max(0, max - dur);
    const capLoss = Math.min(max, lost * Kr);
    const newMax = Math.max(0, max - capLoss);
    return { Kr, lost, capLoss, newMax };
  }
};
