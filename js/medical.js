/* ============================================================
   恢复治疗：容量池 / 使用流程 / 面板
   数据全在 Medical，UI 在 medhud.js。
   ============================================================ */

/* ---------------- 恢复治疗 ----------------
   一件恢复品 = 一个"治疗容量池"。使用流程：
     启动（healStart 秒，不回血、不扣容量）
       └─ 持续阶段：每秒 healRate，回多少扣多少容量
            ├─ 满血 → 结束，剩余容量留在物品上
            ├─ 容量归零 → 物品移除
            └─ 主动取消 / 冲刺 / 攻击 / 死亡 → 结束，已扣的不退
   容量记在"条目"（entry.cap）上：新捡到或满堆里拆出来的都是满容量，
   用过的那件单独占一格，不会和满的再合并。其他医疗分组（止痛/创伤/针剂/异常）保持原样。 */
const Medical = {
  canonicalId(id) { return id === 'med01' ? 'heal01' : id; },
  is(item) { return !!item && item.cat === 'medical'; },
  ready(item) { return this.is(item) && item.use === true && (item.healCap || 0) > 0; },
  capOf(item) { return (item && item.healCap) || 0; },

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
    return '启动 ' + item.healStart + ' 秒 · ' + item.healRate + ' HP/秒 · 容量 ' + item.healCap;
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
  stashLike(where) { return where === 'stash' || where === 'basebag'; },

  entries(where) {
    if (where === 'stash') return Game.state === 'base' ? Save.stash : [];
    if (where === 'basebag') return Game.state === 'base' ? Save.bag : [];
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
      const limit = where === 'safe' ? CFG.BAG.SAFE : CFG.BAG.SLOTS;
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

    /* 局外（仓库 / 藏身处背包）：立即结算，拆件也不看格子 */
    if (this.stashLike(where)) {
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
    if (P.hp >= P.maxHp) return false;
    /* 同一时间只允许一种治疗；读条、搜刮、闪避、换弹期间也不能开始 */
    if (Game.action || Game.lootOpen || P.dodgeT > 0 || P.reloadT > 0) {
      Game.toast('请先结束当前动作，再开始治疗'); return false;
    }
    const unit = this.takeUnit(entry, where);
    if (!unit) return false;

    Game.input.mouseDown = false;
    Game.action = {
      type: 'heal', phase: 'start', t: 0,
      item, unit, where, restored: 0
    };
    Game.toast('使用' + item.name + '：' + item.healStart + ' 秒后开始恢复 · E / Esc 取消');
    if (Game.bagOpen) Game.renderBag();
    return true;
  },

  /* 每帧推进：启动阶段不回血，持续阶段按速率结算 */
  tick(a, dt) {
    const P = Game.player;
    const item = a.item, unit = a.unit;
    if (!P || P.dead || !this.valid(unit, a.where)) { this.cancel('治疗中断'); return; }

    if (a.phase === 'start') {
      a.t += dt;
      if (a.t >= item.healStart) {
        a.phase = 'active';
        a.t = 0;
        Game.sfx('pickup');
      }
      return;
    }

    a.t += dt;
    const room = Math.max(0, P.maxHp - P.hp);
    const cap = this.entryCap(unit);
    const gain = Math.min(item.healRate * dt, cap, room);
    if (gain > 0) {
      P.hp = Math.min(P.maxHp, P.hp + gain);
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
    else Game.toast('治疗已取消');
    if (Game.bagOpen) Game.renderBag();
    return true;
  },

  open(entry, where, node) {
    if (!this.valid(entry, where)) return;
    const item = this.stashLike(where) ? stashItem(entry) : entry.item;
    const max = this.capOf(item);
    const cur = this.entryCap(entry);
    const capText = max ? Math.ceil(cur) + ' / ' + max : '—';
    /* 启动与速率已经在「效果」那行写了，这里只补当前容量这个会变的值 */
    Tips.show(item, node.getBoundingClientRect(), '医疗物品操作', this.ready(item) ? [
      ['当前容量', capText]
    ] : null);
    const box = document.getElementById('itemTip');
    const hp = this.stashLike(where) ? Save.hp : Game.player.hp;
    const missing = Math.max(0, CFG.P.HP - hp);
    const useLabel = !this.ready(item) ? '效果待开放' : hp >= CFG.P.HP ? '生命值已满'
      : '使用一件（可恢复 ' + Math.round(Math.min(cur, missing)) + ' HP）';
    box.querySelector('.tip-hd').insertAdjacentHTML('afterend', '<div class="medical-actions"><button data-med="use"' +
      (!this.ready(item) || hp >= CFG.P.HP ? ' disabled' : '') + '>' + esc(useLabel) + '</button>' +
      '<button data-med="move">' + (where === 'stash' ? '出售这一堆' : where === 'safe' ? '移回背包' : '移入安全箱') + '</button></div>');
    box.querySelectorAll('[data-med]').forEach(button => button.onclick = () => {
      if (!this.valid(entry, where)) { Tips.hide(); return; }
      Tips.hide();
      if (button.dataset.med === 'use') this.use(entry, where);
      else if (where === 'stash') Base.askSell(entry, entry.n, node);
      else if (where === 'bag') Game.moveToSafe(Game.player.bag.slots.indexOf(entry));
      else {
        const bag = Game.player.bag;
        if (bag.slots.length >= CFG.BAG.SLOTS) { Game.toast('背包满了'); return; }
        this.cancel(); bag.safe.splice(bag.safe.indexOf(entry), 1); bag.slots.push(entry); Game.renderBag();
      }
    });
  }
};
