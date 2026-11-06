/* ============================================================
   护甲耐久条
   一条横杠，长度按「原厂上限」算 —— 修理吃掉的上限也要占位置，
   否则修过的甲会看起来和新的差不多。

     绿色 = 当前耐久
     灰色 = 已经打掉、还在当前上限以内的耐久
     红色 = 被修理吃掉的上限

   读法是「从右往左掉」：满耐久整条绿；挨打时绿色右端退、灰色补上来；
   修过以后右边多出一截红色，永久不再回绿。局内局外同一套，
   物品格 / 装备槽 / 详情浮窗 / 修理确认窗都用它。
   ============================================================ */
const DuraBar = {
  /* 原厂上限：模板值。没查到时退回实例的 max，至少别把条画空 */
  base(g) {
    if (!g) return 0;
    const d = GEAR.def(g.type, g.id || g.lv);
    return (d && d.dur) || Number(g.max) || 1;
  },

  /* opt.cap / opt.dur 可以传预览值：修理窗用它显示「修完之后」的上限 */
  html(g, opt) {
    if (!g || !g.type) return '';
    const o = opt || {}, base = this.base(g);
    const cap = U.clamp(o.cap != null ? o.cap : (Number(g.max) || 0), 0, base);
    const dur = U.clamp(o.dur != null ? o.dur : (Number(g.dur) || 0), 0, cap);
    const pct = n => Math.max(0, Math.min(100, n / base * 100)).toFixed(2) + '%';
    const label = '耐久 ' + Math.ceil(dur) + ' / ' + Math.round(cap) +
      (cap < base ? '（原厂 ' + Math.round(base) + '）' : '');
    return '<i class="dbar' + (o.cls ? ' ' + o.cls : '') + '" title="' + esc(label) +
      '" aria-label="' + esc(label) + '">' +
      '<b class="dg" style="width:' + pct(dur) + '"></b>' +
      '<b class="ds" style="width:' + pct(cap - dur) + '"></b>' +
      '<b class="dr" style="width:' + pct(base - cap) + '"></b></i>';
  },

  /* 往格子 / 装备槽里塞一条；重复调用不会叠第二条 */
  attach(el, g, opt) {
    if (!el || !g || !g.type || !el.insertAdjacentHTML) return;
    if (el.classList) el.classList.add('has-dbar');
    if (el.querySelector && el.querySelector('.dbar')) return;
    el.insertAdjacentHTML('beforeend', this.html(g, opt));
  },

  /* 伪物品 / 仓库条目 → 护甲实例；不是护甲就返回 null */
  of(item) {
    return (item && item.equip && item.equip.kind === 'armor') ? item.equip.gear : null;
  }
};
