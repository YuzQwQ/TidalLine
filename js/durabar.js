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

/* ============================================================
   容量 / 次数 / 耐久条（CapBar）
   和护甲耐久条**同一套视觉**：整条按原始容量（healCap）、总次数
   （effect.uses）或原厂耐久（maxDur）铺满，绿色是还剩的，灰色是用掉的。
   这几类东西都不会被「修」掉上限，所以不画红色段；用一点少一点，条从右往左退。

   医疗品和钥匙原先只在格子左上角挂一个数字（医疗品还只有用过的那份才显示），
   满的、没用过的看起来一模一样；现在和头盔护甲一样，一眼能看出剩下的比例，
   满的整条绿。精确读数放在 title / 详情浮窗的数字行里，不因为换成条就丢掉。
   ============================================================ */
const CapBar = {
  /* 判断一条记录该不该挂条：医疗品（容量 / 次数）+ 钥匙（剩余耐久）。
     其它 cap 物品（目前没有）不挂，避免把普通收集品也画上一条杠。 */
  item(entry) {
    const it = entry && (entry.item || (typeof stashItem === 'function' ? stashItem(entry) : null));
    if (!it || !ItemCapacity.max(it)) return null;
    return (Medical.is(it) || it.cat === 'key') ? it : null;
  },

  /* 0..1；canvas 轮盘、快捷栏这些不用拼 HTML 的地方直接拿它画线 */
  ratio(entry) {
    const it = this.item(entry);
    if (!it) return null;
    return U.clamp(ItemCapacity.remaining(entry) / ItemCapacity.max(it), 0, 1);
  },

  label(entry) {
    const it = this.item(entry);
    if (!it) return '';
    const max = ItemCapacity.max(it);
    return ItemCapacity.label(it) + ' ' + Math.ceil(ItemCapacity.remaining(entry)) + ' / ' + max;
  },

  /* 悬浮 / 详情用的精确读数：挂条的物品走条自己的口径（N / 上限），
     其它 cap 物品退回 ItemCapacity 的角标文案 */
  readout(entry) {
    if (!entry) return '';
    const it = entry.item || (typeof stashItem === 'function' ? stashItem(entry) : null);
    if (!it || !ItemCapacity.max(it)) return '';
    return this.item(entry) ? this.label(entry) : ItemCapacity.label(it) + ' ' + ItemCapacity.text(entry);
  },

  html(entry, opt) {
    const it = this.item(entry);
    if (!it) return '';
    const o = opt || {}, max = ItemCapacity.max(it);
    const cur = U.clamp(ItemCapacity.remaining(entry), 0, max);
    const pct = n => (n / max * 100).toFixed(2) + '%';
    const label = this.label(entry);
    return '<i class="dbar dbar-capacity' + (o.cls ? ' ' + o.cls : '') + '" title="' + esc(label) +
      '" aria-label="' + esc(label) + '">' +
      '<b class="dg" style="width:' + pct(cur) + '"></b>' +
      '<b class="ds" style="width:' + pct(max - cur) + '"></b></i>';
  },

  /* 往已有的格子 / 面板里塞一条；重复调用不会叠第二条 */
  attach(el, entry, opt) {
    if (!el || !el.insertAdjacentHTML) return false;
    const bar = this.html(entry, opt);
    if (!bar) return false;
    if (el.classList) el.classList.add('has-dbar');
    if (el.querySelector && el.querySelector('.dbar-capacity')) return true;
    el.insertAdjacentHTML('beforeend', bar);
    return true;
  }
};
