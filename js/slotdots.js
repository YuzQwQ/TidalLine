/* ============================================================
   枪械槽位点
   护甲用耐久条读「还能扛几下」，枪就用一排点读「改装到什么程度」：

     灰点 = 这个槽位支持，但空着
     彩点 = 装了配件，颜色取配件的稀有度（和格子左边那条色条同一套）

   点数 = 这把枪支持的槽位数，顺序固定在 ATTACHMENT_SLOTS，
   所以不同枪之间能横向比；没有的槽位不画点，也不画占位。
   挂在物品格 / 装备槽 / 详情浮窗，局内局外同一套。
   ============================================================ */
const SlotDots = {
  /* 一条枪真正能装的槽位，按全局顺序；不认识的枪返回空数组。
     数据里 23 把枪全都标了 5 个槽，但手枪其实没有握把和枪托 —— 直接按槽位表画点，
     会给出永远灰着的死点。所以这里要求「至少有一件配件能装进去」才算一个可装槽位：
     手枪 → 瞄具/枪口/弹匣 3 点，步枪 5 点。 */
  slots(gun) {
    const w = typeof gun === 'string' ? WEAPONS[canonicalWeaponId(gun)] : gun;
    if (!w || !w.attachmentSlots) return [];
    const key = w.id;
    if (key) {
      if (!this._eff) this._eff = {};
      if (this._eff[key]) return this._eff[key];
    }
    const parts = Object.keys(ATTACHMENT_DEFS);
    const out = ATTACHMENT_SLOTS.filter(s => {
      if (!w.attachmentSlots[s]) return false;
      if (typeof Attachments === 'undefined') return true;
      return parts.some(id => Attachments.compatible(w, id, s));
    });
    if (key) this._eff[key] = out;
    return out;
  },

  /* 三种输入都吃：伪物品（equip.kind==='gun'）、解析后的枪、枪 id。
     返回 { id, attachments }，不是枪就是 null。 */
  of(item) {
    if (!item) return null;
    if (typeof item === 'string') return {id: canonicalWeaponId(item), attachments: {}};
    if (item.equip && item.equip.kind === 'gun')
      return {id: item.equip.gun, attachments: item.equip.attachments || {}};
    if (item.attachmentSlots) return {id: item.id, attachments: item.attachments || {}};
    return null;
  },

  /* 空槽灰点、已装配件按稀有度上色；每颗点自带 title，鼠标停上去能看到装的是哪件 */
  html(item, opt) {
    const g = this.of(item);
    if (!g) return '';
    const slots = this.slots(g.id);
    if (!slots.length) return '';
    const ins = g.attachments || {};
    const dots = slots.map(slot => {
      const d = ATTACHMENT_DEFS[ins[slot]];
      const name = Attachments.slotNames[slot] || slot;
      if (!d) return '<b class="off" title="' + esc(name + '：空槽') + '"></b>';
      const r = U.clamp(d.r || 1, 1, RARITY.length);
      return '<b class="on" style="background:' + RARITY[r - 1].color +
        '" title="' + esc(name + '：' + d.name + '（' + RARITY[r - 1].name + '）') + '"></b>';
    }).join('');
    const on = slots.filter(s => ATTACHMENT_DEFS[ins[s]]).length;
    const label = '配件 ' + on + '/' + slots.length + ' · ' + slots.map(s =>
      (Attachments.slotNames[s] || s) + (ATTACHMENT_DEFS[ins[s]] ? '' : '空')).join(' ');
    const cls = 'sdots' + (opt && opt.cls ? ' ' + opt.cls : '');
    return '<i class="' + cls + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
      dots + '</i>';
  },

  /* 往格子 / 装备槽里塞一排点；重复调用不会叠第二排 */
  attach(el, item, opt) {
    if (!el || !el.insertAdjacentHTML) return;
    const html = this.html(item, opt);
    if (!html) return;
    if (el.classList) el.classList.add('has-dots');
    if (el.querySelector && el.querySelector('.sdots')) return;
    el.insertAdjacentHTML('beforeend', html);
  },

  /* 详情浮窗里那一行：点 + 一句话说明（装了几件、都装了什么） */
  line(item) {
    const g = this.of(item);
    if (!g) return '';
    const slots = this.slots(g.id), ins = g.attachments || {};
    if (!slots.length) return '';
    const fitted = slots.filter(s => ATTACHMENT_DEFS[ins[s]]);
    /* 只列装了的：全是空槽时点本身已经说清楚了，再写四个「空」只是噪音 */
    const detail = fitted.length
      ? fitted.map(s => (Attachments.slotNames[s] || s) + ' ' + ATTACHMENT_DEFS[ins[s]].name).join(' · ')
      : '尚未安装配件';
    return '<div class="tip-slots">' + this.html(item) +
      '<small>' + esc('配件 ' + fitted.length + '/' + slots.length) + '</small></div>' +
      '<div class="tip-slot-list">' + esc(detail) + '</div>';
  }
};
