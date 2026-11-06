/* ============================================================
   护甲修理
   局外限定：战局里没有工位，也没有时间坐下来拆甲。

   一件甲不是无限修的。每次修理补满耐久，同时按「耐修程度 rep」和
   这次补回多少耐久削掉一截上限：
       上限损耗 = round(缺失耐久 × (1 - rep/100) × CFG.REPAIR.WEAR)
       修理费   = 原价 ÷ 原厂耐久 × 缺失耐久 × CFG.REPAIR.COST
   上限掉到 CFG.REPAIR.MIN_MAX 就不能再修了 —— 那时只剩卖掉或换新。

   入口只有两个，都挂在 base.js 统一手势的钩子上，不另接管任何格子：
     · 装备槽右键菜单  → Base.extraGearActs
     · 详情浮窗按钮    → Base.extraActsFor（仓库 / 背包 / 装备栏共用一个浮窗）
   ============================================================ */
const Repair = {
  /* 原厂耐久（模板值）。实例的 max 会越修越低，费用不能拿它当分母。 */
  baseMax(g) {
    const d = GEAR.def(g && g.type, g && (g.id || g.lv));
    return (d && d.dur) || (g && g.max) || 0;
  },

  /* 耐修程度 0~100：越高，同样的损伤只掉更少的上限 */
  repOf(g) {
    const d = GEAR.def(g && g.type, g && (g.id || g.lv));
    const rep = (d && d.rep != null) ? d.rep : (g && g.rep != null ? g.rep : 50);
    return U.clamp(Math.round(rep), 0, 100);
  },

  /* 报价：ok=false 时 reason 说明为什么不能修 */
  quote(g) {
    if (!g || !g.type) return null;
    const base = this.baseMax(g), rep = this.repOf(g);
    const max = Math.max(0, Number(g.max) || 0);
    const dur = U.clamp(Number(g.dur) || 0, 0, max);
    const lost = Math.round((max - dur) * 10) / 10;
    const wear = U.clamp((100 - rep) / 100 * CFG.REPAIR.WEAR, 0, 1);
    const capLoss = Math.max(1, Math.round(lost * wear));
    const newMax = Math.round(max - capLoss);
    const per = base > 0 ? (Number(g.price) || 0) / base : 0;
    const fee = Math.max(CFG.REPAIR.MIN_FEE, Math.round(per * lost * CFG.REPAIR.COST / 10) * 10);

    let reason = '';
    if (dur >= max - 1e-6) reason = '耐久是满的，不用修';
    else if (newMax < CFG.REPAIR.MIN_MAX) reason = '上限只剩 ' + Math.round(max) + '，这件已经修不动了';

    return {
      rep, base, max, dur, lost, capLoss, newMax, fee,
      ok: !reason, reason
    };
  },

  /* 局外、非演示界面才开口 */
  usable() {
    if (typeof Game === 'undefined' || Game.state !== 'base') return false;
    if (typeof Safehouse !== 'undefined' && Safehouse.demo) return false;
    return true;
  },

  /* 三种上下文里的护甲实例：装备槽存实例本身，仓库 / 背包存在伪物品的 equip.gear 里 */
  target(where, entry, key) {
    if (where === 'gear') return Base.slotKind(key) === 'armor' ? Base.getEquip(key) : null;
    const it = stashItem(entry);
    return (it && it.equip && it.equip.kind === 'armor') ? it.equip.gear : null;
  },

  /* 打开修理浮窗：名字、等级、当前耐久、修完的上限与费用，确认后结算 */
  open(where, entry, key, node) {
    if (!this.usable()) return false;
    const g = this.target(where, entry, key);
    if (!g) return false;
    const q = this.quote(g);
    if (!q.ok) { Base.note(q.reason, true); return false; }
    const rect = (node && node.getBoundingClientRect) ? node.getBoundingClientRect() : null;

    /* 只留名字、等级、耐久条和价钱。条上直接画「修完的样子」：
       绿色还是当前耐久，灰色是这次要修回来的部分，右边红色是修完要扣掉的上限。 */
    Deal.show({
      kind: 'repair',
      title: '修理护甲',
      name: g.name,
      sub: '防护 Lv' + g.lv + ' · ' + GEAR[g.type].label,
      icon: GEAR.icon(g),
      short: g.short,
      price: q.fee,
      priceLabel: '修理费',
      hideBalance: true,
      bar: '<div class="dbar-box">' + DuraBar.html(g, {cap: q.newMax, dur: q.dur}) +
        '<span class="dbar-cap">耐久 ' + Math.ceil(q.dur) + ' → ' + q.newMax +
        ' · 上限 ' + Math.round(q.max) + ' → ' + q.newMax + '</span></div>',
      goLabel: '确认修理',
      can: Save.credits >= q.fee,
      onGo: () => this.apply(where, entry, key, q.fee)
    }, rect);
    return true;
  },

  /* 结算：扣钱、补满耐久、削上限。expected 是浮窗打开时的报价，
     中间要是甲的状态变了（比如刚被换下来修过），宁可让人重新确认。 */
  apply(where, entry, key, expected) {
    if (!this.usable()) return false;
    const g = this.target(where, entry, key);
    const q = this.quote(g);
    if (!q || !q.ok) { Base.note('护甲状态已变化，请重新确认修理', true); return false; }
    if (expected != null && q.fee !== expected) { Base.note('修理费已变化，请重新确认', true); return false; }
    if (Save.credits < q.fee) { Base.note('信用点不足', true); return false; }

    Save.credits -= q.fee;
    g.dur = q.newMax;
    g.max = q.newMax;
    /* 仓库 / 背包里是伪物品，回收价跟着耐久走；装备栏存的是实例，改完就是改完了 */
    if (where !== 'gear') {
      const it = stashItem(entry);
      if (it) it.sell = EQUIP.sellPrice(it.price, g.dur, g.max, q.base);
    }
    Save.save();
    Save.flush();

    Tips.hide();
    if (typeof Ctx !== 'undefined') Ctx.hide();
    Base.render();
    Game.sfx('gear');
    Base.note('修理完成：' + g.name + ' 耐久 ' + Math.ceil(g.dur) + '，上限 ' +
      Math.round(g.max) + ' / ' + Math.round(q.base) + '（-' + formatMoney(q.fee) + '）');
    return true;
  },

  /* 菜单 / 浮窗里的那一条。修不了也给，点一下会说明原因 —— 比直接把按钮藏了更好懂 */
  act(where, entry, key, node) {
    if (!this.usable()) return null;
    const g = this.target(where, entry, key);
    if (!g) return null;
    const q = this.quote(g);
    return {
      label: '修理',
      hint: q.ok ? formatMoney(q.fee) : '不可修',
      onClick: () => this.open(where, entry, key, node)
    };
  }
};
{
  /* 详情浮窗（仓库 / 背包 / 装备栏）和装备槽右键共用同一条动作 */
  const own = Base.extraActsFor;
  Base.extraActsFor = function (entry, where, node, key) {
    const act = Repair.act(where, entry, key, node);
    return own.apply(this, arguments).concat(act ? [act] : []);
  };
  const ownGear = Base.extraGearActs;
  Base.extraGearActs = function (key, item, row) {
    const act = Repair.act('gear', item, key, row);
    return ownGear.apply(this, arguments).concat(act ? [act] : []);
  };
}
