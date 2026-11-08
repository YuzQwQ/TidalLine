/* 钥匙链（局外）：挂在保险箱下方，6 格只收钥匙。
   ─ 不占背包格、不计负重、不计背包价值：靠 Bag.chain / Save.chain 独立存放实现；
   ─ 局内只能拿去开门、正常扣耐久，拿不出来也放不进去；
   ─ 死亡不掉落，撤离与阵亡都按剩余耐久原样回档（见 Game.showEnd）。
   动作入口和保险箱一样，走 Base.showItem 的按钮组与格子右键菜单。 */
const BaseKeychain = {
  list(where) {
    return where === 'chain' ? Save.chain : where === 'bag' ? Save.bag : where === 'stash' ? Save.stash : null;
  },
  isKey(entry) { const it = entry && stashItem(entry); return !!it && it.cat === 'key'; },

  /* bag / stash / chain 三者互转。钥匙不可堆叠，所以不用处理拆分合并。 */
  transfer(entry, from, to) {
    if (Game.state !== 'base' || from === to) return false;
    const src = this.list(from), dest = this.list(to), item = entry && stashItem(entry);
    if (!src || !dest || !src.includes(entry) || !item) return false;
    const n = entry.n || 1;
    if (to === 'chain') {
      if (item.cat !== 'key') { Base.note('钥匙链只能挂钥匙', true); return false; }
      if (Save.chain.length >= CFG.BAG.CHAIN) { Base.note('钥匙链已满（' + CFG.BAG.CHAIN + ' 格）', true); return false; }
    }
    if (to === 'bag') {
      if (Save.bag.length >= bagSlots()) { Base.note('背包空间不足', true); return false; }
      if (Attachments.carriedWeight() + item.w * n > CFG.BAG.CARRY + 1e-6) { Base.note('超过携带负重，无法转移', true); return false; }
    }
    src.splice(src.indexOf(entry), 1);
    dest.push({ ...entry });
    Save.save(); Save.flush();
    Tips.hide();
    Base.render();
    Base.note('已' + (to === 'chain' ? '挂到钥匙链' : to === 'bag' ? '放进背包' : '放回仓库') + '：' + item.name);
    Game.sfx('pickup');
    return true;
  },

  render() {
    const grid = document.getElementById('baseBagGrid');
    if (!grid) return;
    let box = document.getElementById('baseChainSection');
    if (!box) {
      box = document.createElement('section');
      box.id = 'baseChainSection';
      box.className = 'base-safe-section';
      /* 紧跟保险箱，保险箱没渲染出来时退回背包格下方 */
      const safeBox = document.getElementById('baseSafeSection');
      if (safeBox && safeBox.after) safeBox.after(box);
      else grid.after(box);
    }
    box.innerHTML = '<h3>钥匙链 <em>' + Save.chain.length + ' / ' + CFG.BAG.CHAIN + ' 格</em></h3>' +
      '<div id="baseChainGrid" class="bag-grid"></div>' +
      '<p>只放钥匙 · 不占背包格、不计负重与背包价值 · 局内只能开门，死亡不掉落</p>';
    const cells = box.querySelector('#baseChainGrid');
    if (!cells || typeof cells.appendChild !== 'function') return;   // 无 DOM（单测环境）时只画到这里
    for (let i = 0; i < CFG.BAG.CHAIN; i++) {
      const entry = Save.chain[i], it = entry && stashItem(entry), cell = Base.makeBagCell(entry);
      cell.dataset.chainSlot = i;
      if (it) {
        cell.title = it.name + ' · ' + ItemCapacity.text(entry) + ' · 双击移回背包 · 右键更多';
        cell.onclick = ev => {
          if (ev && (ev.ctrlKey || ev.metaKey)) { Tips.hide(); this.transfer(entry, 'chain', 'bag'); return; }
          this.open(entry, cell);
        };
        cell.ondblclick = ev => {
          if (ev && ev.preventDefault) ev.preventDefault();
          Tips.hide(); this.transfer(entry, 'chain', 'bag');
        };
        cell.oncontextmenu = ev => { ev.preventDefault(); ev.stopPropagation(); this.menu(entry, cell, ev); };
      } else cell.title = '从背包或仓库的钥匙上右键「挂到钥匙链」';
      cells.appendChild(cell);
    }
  },

  open(entry, node) {
    if (!Save.chain.includes(entry)) return;
    const item = stashItem(entry);
    const extra = item && ItemCapacity.max(item) ? [[ItemCapacity.label(item), ItemCapacity.text(entry)]] : null;
    Tips.show(item, node.getBoundingClientRect(), '', extra, entry);
  },

  menu(entry, node, ev) {
    const item = stashItem(entry);
    if (!item) return;
    Ctx.show(ev.clientX, ev.clientY, [
      { label: '详情', onClick: () => this.open(entry, node) },
      { label: '移回背包', onClick: () => this.transfer(entry, 'chain', 'bag') },
      { label: '放回仓库', onClick: () => this.transfer(entry, 'chain', 'stash') }
    ]);
  },

  /* 物品浮窗 / 右键菜单里的「挂到钥匙链」：只对背包和仓库里的钥匙出现 */
  actFor(entry, where) {
    if (where !== 'bag' && where !== 'stash') return null;
    if (!this.isKey(entry)) return null;
    if (Save.chain.length >= CFG.BAG.CHAIN) return { label: '挂到钥匙链（已满）', disabled: true, onClick: () => {} };
    return { label: '挂到钥匙链', onClick: () => this.transfer(entry, where, 'chain') };
  }
};

{
  /* 挂在 Base.renderBag 后面，这样保险箱先画完，钥匙链正好排在它下方 */
  const bag = Base.renderBag;
  Base.renderBag = function () {
    const r = bag.apply(this, arguments);
    BaseKeychain.render();
    return r;
  };

  const own = Base.extraActsFor;
  Base.extraActsFor = function (entry, where) {
    const acts = own.apply(this, arguments) || [];
    const act = BaseKeychain.actFor(entry, where);
    if (act) acts.push(act);
    return acts;
  };
}
