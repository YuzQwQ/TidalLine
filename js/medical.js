/* ============================================================
   恢复治疗：容量池 / 使用流程 / 面板
   数据全在 Medical，UI 在 medhud.js。
   ============================================================ */

/* ---------------- 恢复治疗 ----------------
   一件恢复品 = 一个"治疗容量池"。使用流程：
     启动（healStart 秒，不回血；流血且容量足够时，读完先消耗50容量止血）
       └─ 持续阶段：每秒 healRate，回多少扣多少容量
            ├─ 满血 → 结束，剩余容量留在物品上
            ├─ 容量归零 → 物品移除
            └─ 主动取消 / 冲刺 / 攻击 / 死亡 → 结束，已扣的不退
   容量记在"条目"（entry.cap）上：新捡到或满堆里拆出来的都是满容量，
   用过的那件单独占一格，不会和满的再合并。其他医疗分组（止痛/创伤/针剂/异常）保持原样。 */
const Medical = {
  canonicalId(id) { return id === 'med01' ? 'heal01' : id; },
  is(item) { return !!item && item.cat === 'medical'; },
  ready(item) {
    /* 恢复品看 healCap，效果品（镇痛 / 止血 / 夹板 / 手术）看 effect。
       七件仍「效果待开放」的物品两者都没有，继续不可用、不进掉落池。 */
    return this.is(item) && item.use === true && ((item.healCap || 0) > 0 || !!item.effect);
  },
  /* 容量语义复用：恢复品是 HP 容量，效果品是「次数」。 */
  capOf(item) { return (item && (item.healCap || (item.effect && item.effect.uses))) || 0; },

  canStopBleeding(item, entry) {
    return this.kindOf(item) === 'heal' && Debuff.has(Game.player, 'bleeding') &&
      (entry ? this.entryCap(entry) : this.capOf(item)) >= CFG.DEBUFF.BLEED.HEAL_CAP_COST;
  },

  /* 同类药优先使用能止血的残容量件；不够止血时仍沿用先用残件的规则。 */
  preferredEntry(entries) {
    const candidates = entries.filter(e => this.canStopBleeding(e.item, e));
    const pool = candidates.length ? candidates : entries;
    return pool.find(e => this.isPartial(e)) || pool[0];
  },

  kindOf(item) {
    if (!this.is(item)) return null;
    if (item.effect) return item.effect.kind;
    return (item.use === true && (item.healCap || 0) > 0) ? 'heal' : null;
  },

  capText(entry) {
    const item = entry && (entry.item || stashItem(entry));
    const cap = Math.ceil(this.entryCap(entry));
    return item && item.effect ? '剩余 ' + cap + ' 次' : cap + ' / ' + this.capOf(item);
  },

  /* 统一给七个使用入口与快捷栏用：能不能用、按钮上写什么，都只问这里。 */
  canUse(item, where, hp, entry) {
    if (!this.ready(item)) return false;
    const kind = this.kindOf(item);
    if (this.stashLike(where)) {
      /* 局内损伤不跨局保留，效果品在藏身处没有可处理的对象 */
      return kind === 'heal' && (hp == null ? Save.hp : hp) < CFG.P.HP;
    }
    const P = Game.player;
    if (!P || P.dead) return false;
    const cur = hp == null ? P.hp : hp;
    if (kind === 'heal') return cur < Debuff.recoverableMax(P) - 1e-6 || this.canStopBleeding(item, entry);
    if (kind === 'analgesic') return true;              // 满血、没受伤也能提前服药
    if (kind === 'cure') return Debuff.has(P, item.effect.cures);
    if (kind === 'surgery') return Debuff.surgeryAvailable(P);
    return false;
  },

  actionLabel(item, where, hp, entry) {
    if (!this.ready(item)) return '效果待开放';
    const kind = this.kindOf(item);
    if (this.stashLike(where)) {
      if (kind !== 'heal') return '只能在行动中使用';
      const missing = Math.max(0, CFG.P.HP - (hp == null ? Save.hp : hp));
      return missing > 0 ? '使用一件（可恢复 ' + Math.round(missing) + ' HP）' : '生命值已满';
    }
    const P = Game.player;
    if (kind === 'heal') {
      const missing = Math.max(0, Debuff.recoverableMax(P) - (hp == null ? P.hp : hp));
      const cost = CFG.DEBUFF.BLEED.HEAL_CAP_COST;
      if (this.canStopBleeding(item, entry)) return '先止血（消耗' + cost + '容量）' + (missing > 0 ? '，再回血' : '');
      if (Debuff.has(P, 'bleeding')) return missing > 0 ? '回血（容量不足' + cost + '，无法止血）' : '容量不足' + cost + '，无法止血';
      return missing > 0 ? '使用一件（可恢复 ' + Math.round(missing) + ' HP）' : '已达可恢复上限';
    }
    if (kind === 'analgesic') return '服用（镇痛 ' + item.effect.duration + ' 秒）';
    if (kind === 'cure') {
      return Debuff.has(P, item.effect.cures)
        ? '解除' + (item.effect.cures === 'bleeding' ? '流血' : '骨折')
        : '没有对应的损伤';
    }
    if (kind === 'surgery') {
      if (!Debuff.surgeryAvailable(P)) return '无适用损伤';
      return '进行手术（' + (P.debuffs.severe > 0 ? '治 1 层重伤' : '解骨折') + '）' +
        (item.effect.analgesic ? ' · 术后镇痛 ' + item.effect.analgesic + ' 秒' : '');
    }
    return '使用';
  },

  /* 条目剩余容量：没写 cap 就是满的（老存档、新捡到的都走这条路） */
  entryCap(entry) {
    if (!entry) return 0;
    const item = entry.item || stashItem(entry);
    const max = this.capOf(item);
    if (!max) return 0;
    return typeof entry.cap === 'number' ? U.clamp(entry.cap, 0, max) : max;
  },
  isPartial(entry) {
    const item = entry && (entry.item || stashItem(entry));
    const max = this.capOf(item);
    return max > 0 && this.entryCap(entry) < max - 1e-6;
  },

  summary(item) {
    if (!this.ready(item)) {
      return '效果待开放' + (item.reservedEffect ? ' · 预留：' + item.reservedEffect : '');
    }
    const kind = this.kindOf(item), e = item.effect;
    if (kind === 'heal') return '启动 ' + item.healStart + ' 秒 · ' + item.healRate + ' HP/秒 · 容量 ' + item.healCap +
      (item.healCap >= CFG.DEBUFF.BLEED.HEAL_CAP_COST ? ' · 流血时先消耗' + CFG.DEBUFF.BLEED.HEAL_CAP_COST + '容量止血' : ' · 容量不足以止血');
    if (kind === 'analgesic') return '镇痛 ' + e.duration + ' 秒 · 读条 ' + e.useTime + ' 秒 · ' + e.uses + ' 次';
    if (kind === 'cure') return (e.cures === 'bleeding' ? '解除流血' : '固定骨折') + ' · 读条 ' + e.useTime + ' 秒 · ' + e.uses + ' 次';
    if (kind === 'surgery') return '手术（重伤 -1 层 / 解骨折）· 读条 ' + e.useTime + ' 秒 · ' + e.uses + ' 次' +
      (e.analgesic ? ' · 术后镇痛 ' + e.analgesic + ' 秒' : '');
    return '效果待开放';
  },

  /* 诊所报价：按绷带容量折算需要几卷 */
  quote(hp = Save.hp) {
    const missing = Math.max(0, CFG.P.HP - hp);
    const bandage = ITEM_BY_ID.heal01;
    const medicine = Math.ceil(missing / bandage.healCap) * bandage.price;
    const service = missing > 0 ? Math.max(Math.ceil(bandage.price * ECONOMY.doctor.minimumBandageFraction), Math.ceil(medicine * ECONOMY.doctor.serviceRate)) : 0;
    return { missing, medicine, service, total: medicine + service };
  },

  /* 'stash' 与 'basebag' 都是藏身处的列表，条目形态一致（{id,n,cap} / {id,n,gear}）；
     'bag' / 'safe' 是局内玩家背包里的活条目（{item,n,cap}）。 */
  stashLike(where) { return where === 'stash' || where === 'basebag' || where === 'basesafe'; },

  entries(where) {
    if (where === 'stash') return Game.state === 'base' ? Save.stash : [];
    if (where === 'basebag') return Game.state === 'base' ? Save.bag : [];
    if (where === 'basesafe') return Game.state === 'base' ? Save.safe : [];
    return Game.state === 'playing' && Game.player && !Game.player.dead
      ? (where === 'safe' ? Game.player.bag.safe : Game.player.bag.slots) : [];
  },

  valid(entry, where) { return !!entry && entry.n > 0 && this.entries(where).includes(entry); },

  /* 从堆里取出一件来用：
       n = 1 → 就用这一条，容量记在它身上
       n > 1 → 拆出一件单独的，需要有空位；拆不动宁可不让用，也不能把东西弄丢 */
  takeUnit(entry, where) {
    if (!this.valid(entry, where)) return null;
    const list = this.entries(where);
    const item = this.stashLike(where) ? stashItem(entry) : entry.item;
    const max = this.capOf(item);
    if (!item) return null;

    if (entry.n <= 1) {
      entry.n = 1;
      if (entry.cap == null) entry.cap = max;
      return entry;
    }

    if (!this.stashLike(where)) {
      const limit = where === 'safe' ? CFG.BAG.SAFE : bagSlots();
      if (list.length >= limit) { Game.toast('背包没有空位，先腾一格再拆开用'); return null; }
    }
    entry.n -= 1;
    if (entry.cap == null) entry.cap = max;      // 剩下的仍是整堆满容量
    const unit = this.stashLike(where) ? { id: item.id, n: 1, cap: max } : { item, n: 1, cap: max };
    list.push(unit);
    return unit;
  },

  /* 实际恢复：受剩余容量和缺口双重限制，绝不超量扣 */
  applyCap(unit, item, room) {
    const cap = this.entryCap(unit);
    const gain = Math.max(0, Math.min(room, cap));
    if (gain > 0) unit.cap = cap - gain;
    return gain;
  },

  /* 容量归零就从所在列表移除 */
  dropIfEmpty(entry, where) {
    if (!entry || this.entryCap(entry) > 1e-6) return false;
    const list = this.entries(where);
    const i = list.indexOf(entry);
    if (i < 0) return false;
    list.splice(i, 1);
    if (!this.stashLike(where)) { if (Game.bagOpen) Game.renderBag(); }
    else if (where === 'basebag' && typeof Base !== 'undefined') Base.renderBag();
    return true;
  },

  use(entry, where) {
    const item = this.stashLike(where) ? stashItem(entry) : entry && entry.item;
    if (!this.valid(entry, where) || !this.ready(item)) return false;
    const kind = this.kindOf(item);

    /* 局外（仓库 / 藏身处背包）：恢复品立即结算；效果品只在局内有用 */
    if (this.stashLike(where)) {
      if (kind !== 'heal') { Game.toast('只能在行动中使用'); return false; }
      const hp = Save.hp;
      if (hp >= CFG.P.HP) return false;
      const unit = this.takeUnit(entry, where);
      if (!unit) return false;
      const healed = this.applyCap(unit, item, CFG.P.HP - hp);
      this.dropIfEmpty(unit, where);
      Save.setHP(hp + healed);
      Base.render();
      Base.note(item.name + '：恢复 ' + Math.round(healed * 10) / 10 + ' HP');
      return true;
    }

    const P = Game.player;
    if (!P || P.dead) return false;
    if (!this.canUse(item, where, P.hp, entry)) {
      Game.toast(kind === 'heal' ? this.actionLabel(item, where, P.hp, entry)
        : kind === 'cure' ? '没有对应的损伤'
        : kind === 'surgery' ? '没有需要手术的损伤' : '现在不能使用');
      return false;
    }
    /* 同一时间只允许一种治疗；读条、搜刮、闪避、换弹期间也不能开始 */
    if (Game.action || Game.lootOpen || P.dodgeT > 0 || P.reloadT > 0) {
      Game.toast('请先结束当前动作，再开始治疗'); return false;
    }
    const unit = this.takeUnit(entry, where);
    if (!unit) return false;

    const e = item.effect || null;
    Game.input.mouseDown = false;
    /* 统一 type:'heal'，用 kind 区分子类型：cancel / 轮盘 / 读条排除 /
       开火拦截 / HealHud / updateAction 六处现成判断都自动覆盖。 */
    Game.action = {
      type: 'heal', kind, phase: this.canStopBleeding(item, unit) ? 'stopBleed' : 'start', t: 0,
      item, unit, where, restored: 0, hemostasisSpent: 0,
      effect: e, useTime: e ? e.useTime : item.healStart,
      interruptOnHit: !!e && CFG.DEBUFF.INTERRUPT_ON_HIT.includes(kind)
    };
    Game.toast('使用' + item.name + '：' + Game.action.useTime + ' 秒后' +
      (e ? '生效' : Game.action.phase === 'stopBleed' ? '止血并开始恢复' : '开始恢复') +
      (!e && Debuff.has(P, 'bleeding') && Game.action.phase !== 'stopBleed' ? '（容量不足，无法止血）' : '') + ' · E / Esc 取消');
    if (Game.bagOpen) Game.renderBag();
    return true;
  },

  /* 每帧推进：启动阶段不回血，持续阶段按速率结算 */
  tick(a, dt) {
    const P = Game.player;
    const item = a.item, unit = a.unit;
    if (!P || P.dead || !this.valid(unit, a.where)) { this.cancel('治疗中断'); return; }

    /* 效果类动作：单段读条，到点一次性生效（不回血、不扣 HP 容量） */
    if (a.kind && a.kind !== 'heal') {
      a.t += dt;
      if (a.t >= a.useTime) this.finish(a);
      return;
    }

    /* 治疗期间新出现流血时也先处理；低于50容量仍可继续回血。
       启动途中沿用已读时间，持续回血途中则新读一段启动时间。 */
    if (a.phase !== 'stopBleed' && this.canStopBleeding(item, unit)) {
      if (a.phase === 'active') a.t = 0;
      a.phase = 'stopBleed';
    }
    if (a.phase === 'start' || a.phase === 'stopBleed') {
      a.t += dt;
      if (a.t >= item.healStart) {
        if (a.phase === 'stopBleed' && this.canStopBleeding(item, unit)) {
          const cost = CFG.DEBUFF.BLEED.HEAL_CAP_COST;
          unit.cap = this.entryCap(unit) - cost;
          a.hemostasisSpent = (a.hemostasisSpent || 0) + cost;
          Debuff.cure(P, 'bleeding');
          Game.toast('流血已止住 · 消耗' + cost + '容量');
        }
        a.phase = 'active';
        a.t = 0;
        Game.sfx('pickup');
        if (this.entryCap(unit) <= 1e-6 || P.hp >= Debuff.recoverableMax(P) - 1e-6) this.finish(a);
      }
      return;
    }

    a.t += dt;
    /* 普通治疗只能回到「可恢复生命上限」：重伤封锁的那一段回不上去 */
    const healMax = Debuff.recoverableMax(P);
    const room = Math.max(0, healMax - P.hp);
    const cap = this.entryCap(unit);
    const gain = Math.min(item.healRate * dt, cap, room);
    if (gain > 0) {
      P.hp = Math.min(healMax, P.hp + gain);
      unit.cap = cap - gain;
      a.restored += gain;
      Save.setHP(P.hp);
    }
    /* 满血或容量归零都收工；满血时剩余容量留在物品上 */
    if (room - gain <= 1e-6 || this.entryCap(unit) <= 1e-6) this.finish(a);
  },

  finish(a) {
    if (!a || a.type !== 'heal') return;
    const unit = a.unit, where = a.where;

    /* 效果类动作：读条走完才真正施加，扣一次使用次数，用完移除 */
    if (a.kind && a.kind !== 'heal') {
      const e = a.effect, P = Game.player;
      let msg = '';
      if (e.kind === 'analgesic') {
        Debuff.applyAnalgesic(P, e.duration);
        msg = '镇痛生效 · 剩余 ' + Math.ceil(Debuff.analgesicLeft(P)) + ' 秒';
      } else if (e.kind === 'cure') {
        Debuff.cure(P, e.cures);
        msg = e.cures === 'bleeding' ? '流血已止住' : '骨折已固定';
      } else if (e.kind === 'surgery') {
        const done = Debuff.surgery(P);         // 二选一，不回血
        msg = done === 'severe' ? '手术完成 · 重伤 -1 层（可恢复上限 +15%）'
            : done === 'fracture' ? '手术完成 · 骨折已处理' : '';
        /* 紫 / 金两档术后自带镇痛：治疗成功才算数，被打断或被取消不发放。 */
        if (done && e.analgesic) {
          Debuff.applyAnalgesic(P, e.analgesic);
          msg += ' · 镇痛 ' + e.analgesic + ' 秒';
        }
      }
      unit.cap = Math.max(0, this.entryCap(unit) - 1);
      const emptied = this.entryCap(unit) <= 1e-6;
      if (emptied) this.dropIfEmpty(unit, where);
      if (Game.action === a) Game.action = null;
      if (msg) { Game.toast(msg + (emptied ? ' · ' + a.item.name + ' 用完' : '')); Game.sfx('pickup'); }
      if (Game.bagOpen) Game.renderBag();
      /* 用医疗品后当帧刷新状态条、快捷栏和读条，不等下一帧 */
      DebuffHud.refresh();
      if (typeof MedBar !== 'undefined') MedBar.refresh();
      if (typeof HealHud !== 'undefined') HealHud.frame();
      return;
    }

    const left = this.entryCap(unit);
    const emptied = left <= 1e-6;
    if (emptied) this.dropIfEmpty(unit, where);
    if (Game.action === a) Game.action = null;

    if (a.restored > 0.01) {
      Game.sfx('pickup');
      Game.toast('恢复 ' + Math.round(a.restored * 10) / 10 + ' HP' +
        (emptied ? ' · ' + a.item.name + ' 用完' : ' · 剩余容量 ' + Math.ceil(left)));
    } else if (emptied) {
      Game.toast(a.item.name + ' 已用完');
    }
    if (Game.bagOpen) Game.renderBag();
  },

  /* 中断：保留已恢复的 HP，已扣的容量不退 */
  cancel(message) {
    const a = Game.action;
    if (!a || a.type !== 'heal') return false;
    const emptied = this.entryCap(a.unit) <= 1e-6;
    if (emptied) this.dropIfEmpty(a.unit, a.where);
    Game.action = null;
    if (message) Game.toast(message);
    else if (a.restored > 0.01) Game.toast('治疗中断 · 已恢复 ' + Math.round(a.restored * 10) / 10 + ' HP');
    else Game.toast(a.hemostasisSpent > 0 ? '治疗中断 · 已止血，消耗' + a.hemostasisSpent + '容量' : '治疗已取消');
    if (Game.bagOpen) Game.renderBag();
    return true;
  },

  open(entry, where, node) {
    if (!this.valid(entry, where)) return;
    const item = this.stashLike(where) ? stashItem(entry) : entry.item;
    const max = this.capOf(item);
    const cur = this.entryCap(entry);
    const capText = max ? Math.ceil(cur) + ' / ' + max : '—';
    /* 传 entry 让详情浮窗也挂上同款容量 / 次数条；数值行继续给精确读数 */
    Tips.show(item, node.getBoundingClientRect(), '医疗物品操作', this.ready(item) ? [
      [ItemCapacity.label(item), capText]
    ] : null, entry);
    const box = document.getElementById('itemTip');
    const hp = this.stashLike(where) ? Save.hp : Game.player.hp;
    const usable = this.canUse(item, where, hp, entry);
    const useLabel = this.actionLabel(item, where, hp, entry);
    box.querySelector('.tip-hd').insertAdjacentHTML('afterend', '<div class="medical-actions"><button data-med="use"' +
      (!usable ? ' disabled' : '') + '>' + esc(useLabel) + '</button>' +
      '<button data-med="move">' + (where === 'stash' ? '前往出售' : where === 'safe' ? '移回背包' : '移入安全箱') + '</button></div>');
    box.querySelectorAll('[data-med]').forEach(button => button.onclick = () => {
      if (!this.valid(entry, where)) { Tips.hide(); return; }
      Tips.hide();
      if (button.dataset.med === 'use') this.use(entry, where);
      else if (where === 'stash') Base.goToSell();
      else if (where === 'bag') Game.moveToSafe(Game.player.bag.slots.indexOf(entry));
      else {
        const bag = Game.player.bag;
        if (bag.slots.length >= bagSlots()) { Game.toast('背包满了'); return; }
        this.cancel(); bag.safe.splice(bag.safe.indexOf(entry), 1); bag.slots.push(entry); Game.renderBag();
      }
    });
  }
};
