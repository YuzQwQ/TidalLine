/* ============================================================
   藏身处与出击：仓库、背包搬运、配装、商人、地图选择
   ============================================================ */

/* ============================================================
   藏身处：仓库 / 出售 / 补给 / 出发
   ============================================================ */
const Base = {
  filter: 'all',
  tab: 'stash',     // 右侧页签：仓库 / 护甲商人
  picker: null,     // 正在挑装备的槽位（'helmet' / 'body'），null = 没开

  open() {
    this.picker = null;
    this._anchor = null;
    document.getElementById('startVeil').classList.add('hidden');
    document.getElementById('endVeil').classList.add('hidden');
    document.getElementById('baseVeil').classList.remove('hidden');
    document.getElementById('mapVeil').classList.add('hidden');
    Game.state = 'base';
    Save.normalizeStash();
    Save.normalizeBag();
    this.ensureSidearm();     // 副武器永远不能空着
    this.render();
  },

  close() {
    this.picker = null;
    this._anchor = null;
    document.getElementById('baseVeil').classList.add('hidden');
  },

  /* 藏身处内部的提示（不是 canvas 上那个 toast） */
  note(msg, bad) {
    const el = document.getElementById('deployHint');
    el.textContent = msg;
    el.classList.toggle('bad', !!bad);
    clearTimeout(this._noteT);
    this._noteT = setTimeout(() => {
      if (el.textContent === msg) { el.textContent = ''; el.classList.remove('bad'); }
    }, 2600);
  },

  render() {
    const totalCodex = ITEMS.filter(i => !i.noCodex).length;
    document.getElementById('bHealth').textContent = Math.round(Save.hp * 10) / 10 + ' / ' + CFG.P.HP;
    document.getElementById('bCredits').textContent = formatMoney(Save.credits);
    document.getElementById('bRuns').textContent = Save.runs;
    document.getElementById('bCodex').textContent =
      Save.codexCount() + ' / ' + totalCodex;

    this.renderGear();
    this.renderPicker();
    this.renderBag();
    this.renderTabs();
    this.renderFilter();
    this.renderStash();
  },

  /* ---- 装备槽的读写：'w0'/'w1'/'w2' 走武器位，'helmet'/'body' 走护甲，'back' 是背包 ---- */
  slotKind(key) {
    if (key === 'back') return 'bag';
    return (key && key[0] === 'w') ? 'gun' : 'armor';
  },
  slotIdx(key) { return parseInt(String(key).slice(1), 10) || 0; },
  slotLabel(key) {
    if (key === 'helmet') return '头盔';
    if (key === 'body') return '护甲';
    if (key === 'back') return '背包';
    return this.slotIdx(key) < 2 ? '主武器 ' + (this.slotIdx(key) + 1) : '副武器';
  },
  getEquip(key) {
    if (this.slotKind(key) === 'gun') return Save.gear.weapons[this.slotIdx(key)] || null;
    return Save.gear[key] || null;
  },
  setEquip(key, item) {
    if (this.slotKind(key) === 'gun') Save.gear.weapons[this.slotIdx(key)] = item || null;
    else Save.gear[key] = item || null;
  },

  /* ---- 装备：3 个武器位 + 头盔 / 护甲 / 背包 ---- */
  renderGear() {
    const el = document.getElementById('baseGear');
    if (!el) return;
    el.innerHTML = '';
    const G = Save.gear;

    for (let i = 0; i < 3; i++) {
      const key = 'w' + i;
      const it = G.weapons[i];                  // 伪物品（EQUIP.gun）
      const w = it ? WEAPONS[it.equip.gun] : null;
      const ammo = it ? (it.equip.mag | 0) : 0;
      const own = this.stashEquip(key).length;
      const act = this.picker === key
        ? '<b class="price">↓ 正在挑选</b>'
        : (own ? '点击从仓库挑选（' + own + ' 把）'
               : '点击挑选 · 仓库里没有' + (i === SIDEARM_SLOT ? '（副武器必带）' : ''));

      const row = document.createElement('div');
      row.className = 'slot' + (w ? '' : ' empty') + (this.picker === key ? ' open' : '');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(w ? w.id : null, i < 2 ? '主' : '副') + '</div>' +
        '<div class="slot-txt"><b>' + (w ? w.name + (i === SIDEARM_SLOT ? '（必带）' : '') : '空') + '</b><span>' +
          (w ? w.dmgMin + '–' + w.dmgMax + ' 伤害 · 弹匣 ' + ammo + '/' + w.mag + ' · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker(key, row);
      el.appendChild(row);
    }

    for (const type of ['helmet', 'body']) {
      const g = G[type];
      const own = this.stashArmor(type).length;
      const act = this.picker === type
        ? '<b class="price">↓ 正在挑选</b>'
        : (own ? '点击从仓库挑选（' + own + ' 件）' : '点击挑选 · 仓库里没有');

      const row = document.createElement('div');
      row.className = 'slot' + (g ? '' : ' empty') + (this.picker === type ? ' open' : '');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(g ? type + g.lv : null, GEAR[type].short) + '</div>' +
        '<div class="slot-txt"><b>' + (g ? g.name + ' Lv' + g.lv : '未装备' + GEAR[type].label) + '</b><span>' +
          (g ? '防护 Lv' + g.lv + ' · 耐久 ' +
               Math.ceil(g.dur) + '/' + g.max + ' · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker(type, row);
      el.appendChild(row);
    }

    /* 背包：独立槽位。空间只由它决定，所以这里显示当前容量 */
    {
      const bag = G.back;
      const own = this.stashEquip('back').length;
      const act = this.picker === 'back'
        ? '<b class="price">↓ 正在挑选</b>'
        : (own ? '点击从仓库挑选（' + own + ' 个）' : '点击挑选 · 仓库里没有');
      const row = document.createElement('div');
      row.className = 'slot' + (bag ? '' : ' empty') + (this.picker === 'back' ? ' open' : '');
      row.innerHTML =
        '<div class="slot-ico">' + Icons.gearIcon(bag ? bag.id : 'bag', '包') + '</div>' +
        '<div class="slot-txt"><b>' + (bag ? bag.name : '未装备背包 · 基础 ' + BASE_BAG_SLOTS + ' 格') + '</b><span>' +
          (bag ? '容量 ' + bag.slots + ' 格 · ' + bag.w.toFixed(1) + 'kg · ' : '') +
          act +
        '</span></div>';
      row.onclick = () => this.togglePicker('back', row);
      el.appendChild(row);
    }
  },

  /* ---- 装备槽：点开一个列表，从仓库里挑一件 ----
     武器位和护甲位共用这一套：list 只列同类的东西，点一件就换上，旧的回仓库。 */

  /* 仓库里能放进这一位的装备 */
  stashEquip(key) {
    if (this.slotKind(key) === 'bag') return this.stashBags();
    if (this.slotKind(key) === 'gun') {
      const want = this.slotIdx(key) < 2 ? 'primary' : 'secondary';
      return Save.stash.filter(e => {
        const it = stashItem(e);
        if (!it || !it.equip || it.equip.kind !== 'gun') return false;
        const def = WEAPONS[it.equip.gun];
        return def && def.slot === want;
      }).sort((a, b) => {
        const ia = WEAPONS[stashItem(a).equip.gun], ib = WEAPONS[stashItem(b).equip.gun];
        return (ib.price - ia.price) || (stashItem(b).equip.mag - stashItem(a).equip.mag);
      });
    }
    return Save.stash.filter(e => {
      const it = stashItem(e);
      return it && it.equip && it.equip.kind === 'armor' && it.equip.gear.type === key;
    }).sort((a, b) => stashItem(b).equip.gear.lv - stashItem(a).equip.gear.lv);
  },

  /* 仓库里能放进背包槽的东西：按容量从大到小 */
  stashBags() {
    return Save.stash.filter(e => {
      const it = stashItem(e);
      return it && it.equip && it.equip.kind === 'bag';
    }).sort((a, b) => stashItem(b).equip.slots - stashItem(a).equip.slots);
  },

  /* 老名字还留着，测试和别处都按这个找护甲 */
  stashArmor(type) { return this.stashEquip(type); },

  /* 这一位能不能空着：副武器不行，其它都行 */
  canUnequip(key) { return key !== 'w' + SIDEARM_SLOT; },

  /* 副武器不能空着 —— 没有手枪就发一把，保证永远能空手不进去 */
  ensureSidearm() {
    if (Save.gear.weapons[SIDEARM_SLOT]) return false;
    Save.gear.weapons[SIDEARM_SLOT] = EQUIP.gun('pistol', WEAPONS.pistol.mag);
    Save.save();
    return true;
  },

  /* 悬浮窗跟着被点的那个槽位走：先记下它的位置，renderGear 会把行重建掉 */
  togglePicker(type, row) {
    if (this.picker === type) { this.closePicker(); return; }   // 再点一次收起
    this._anchor = (row && row.getBoundingClientRect)
      ? row.getBoundingClientRect() : null;
    this.picker = type;
    this.bindPickerClose();
    this.renderGear();
    this.renderPicker();
  },

  closePicker() {
    this.picker = null;
    this._anchor = null;
    this.renderGear();
    this.renderPicker();
  },

  /* 点别处 / 滚动 / 改窗口大小就收起 —— 悬浮窗不该赖在屏幕上 */
  bindPickerClose() {
    if (this._pickerBound) return;
    this._pickerBound = true;
    const doc = document;
    if (doc && doc.addEventListener) {
      doc.addEventListener('click', ev => {
        if (!this.picker) return;
        const t = ev.target;
        if (t && t.closest) {
          if (t.closest('#gearPicker')) return;
          /* 点槽位时那一行会被 renderGear 重建掉，target 已经脱离文档 ——
             这种情况说明刚点的就是槽位本身，别关 */
          if (t.isConnected === false) return;
          if (t.closest('#baseGear')) return;
        }
        this.closePicker();
      });
      doc.addEventListener('scroll', () => { if (this.picker) this.closePicker(); }, true);
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => { if (this.picker) this.closePicker(); });
    }
  },

  /* 摆在槽位右侧，顶边和槽位对齐；右边放不下就翻到左边 */
  placePicker(box) {
    const r = this._anchor;
    if (!r) return;
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const w = 268;
    const right = (r.right != null) ? r.right : (r.left || 0) + (r.width || 0);
    let left = right + 8;
    if (left + w > vw - 8) left = Math.max(8, (r.left || 0) - w - 8);
    const top = U.clamp(r.top || 0, 8, Math.max(8, vh - 140));

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = w + 'px';
    box.style.maxHeight = Math.max(210, vh - top - 12) + 'px';
  },

  renderPicker() {
    const box = document.getElementById('gearPicker');
    if (!box) return;
    box.innerHTML = '';
    const key = this.picker;
    if (!key) { box.style.display = 'none'; return; }
    box.style.display = '';

    const kind = this.slotKind(key);
    const isGun = kind === 'gun';
    const isBag = kind === 'bag';
    const cur = this.getEquip(key);
    const list = this.stashEquip(key);
    const unit = isGun ? '把' : '件';
    const label = this.slotLabel(key);

    const hd = document.createElement('div');
    hd.className = 'picker-hd';
    hd.innerHTML = '<span>选择' + label + '</span><span>仓库里有 ' + list.length + ' ' + unit + '</span>';
    box.appendChild(hd);

    /* 第一条是"不穿"，否则装上了就取不下来。
       副武器不给这一条 —— 空手进局没法打，必须一直带一把。 */
    if (cur && this.canUnequip(key)) {
      box.appendChild(this.pickerRow({
        fb: isGun ? '空' : (isBag ? '包' : GEAR[key].short),
        name: isGun ? '不装' : (isBag ? '不背' : '不穿'),
        sub: '把 ' + cur.name + ' 放回仓库' +
             (isBag ? '（容量回到 ' + BASE_BAG_SLOTS + ' 格）' : ''),
        cls: 'off',
        click: () => this.unequip(key)
      }));
    }

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'picker-empty';
      empty.innerHTML = cur
        ? '仓库里没有别的' + label + '了。'
        : (isGun
            ? '仓库里没有' + label + '。<br>顶部<b>军火商</b>那儿能买到全新的，尸体上也能捡。'
            : isBag
              ? '仓库里没有' + label + '。<br>顶部<b>护甲商人</b>那儿有前三个档位，' +
                '更好的只在<b>军用物资箱</b>里出。'
              : '仓库里没有' + label + '。<br>顶部<b>护甲商人</b>那儿能买到崭新的一~三级，' +
                '更高级的只能从尸体上带回来。');
      box.appendChild(empty);
    } else {
      for (const e of list) {
        const it = stashItem(e);
        if (isGun) {
          const def = WEAPONS[it.equip.gun];
          const ammo = it.equip.mag | 0;
          box.appendChild(this.pickerRow({
            icon: it.icon, fb: def.short,
            name: def.name,
            sub: BALLISTICS.caliber(def.caliber).short + ' · ' + def.dmgMin + '–' + def.dmgMax + ' 伤害 · 弹匣 ' + ammo + '/' + def.mag +
                 ' · ' + def.rpm + ' 发/分',
            click: () => this.equipFromStash(e, key)
          }));
        } else if (isBag) {
          const slots = it.equip.slots;
          const over = Save.bag.length > slots;
          box.appendChild(this.pickerRow({
            icon: it.icon, fb: it.short,
            name: it.name,
            sub: '容量 ' + slots + ' 格 · ' + it.w.toFixed(1) + 'kg' +
                 (over ? ' · <span class="worn">当前 ' + Save.bag.length + ' 件放不下</span>' : ''),
            click: () => this.equipFromStash(e, key)
          }));
        } else {
          const g = it.equip.gear;
          const st = GEAR.state(g);
          const stName = st === 'ok' ? '完好' : (st === 'worn' ? '破损' : '失效');
          box.appendChild(this.pickerRow({
            icon: it.icon, fb: it.short,
            name: g.name + ' Lv' + g.lv,
            sub: '防护 Lv' + g.lv + ' · 耐久 ' +
                 Math.ceil(g.dur) + '/' + g.max + ' · ' +
                 (st === 'ok' ? '完好' : '<span class="' + st + '">' + stName + '</span>'),
            click: () => this.equipFromStash(e, key)
          }));
        }
      }
    }

    const cancel = document.createElement('div');
    cancel.className = 'prow cancel';
    cancel.textContent = '取消';
    cancel.onclick = () => this.closePicker();
    box.appendChild(cancel);

    this.placePicker(box);
  },

  pickerRow(o) {
    const row = document.createElement('div');
    row.className = 'prow' + (o.cls ? ' ' + o.cls : '');
    const ico = (o.icon && Icons.gear[o.icon])
      ? '<img src="' + Icons.gear[o.icon].src + '" alt="">'
      : esc((o.fb || '·').charAt(0));
    row.innerHTML = '<span class="ic gl">' + ico + '</span>' +
      '<span class="nm">' + esc(o.name) + '<i>' + (o.sub || '') + '</i></span>';
    row.onclick = o.click;
    return row;
  },

  /* 装上仓库里那一件（枪 / 甲 / 背包）；身上原有的落回仓库，不会消失。
     武器位存 EQUIP.gun 伪物品（带余弹），护甲位存护甲实例，背包位存背包实例。 */
  equipFromStash(entry, key) {
    const it = stashItem(entry);
    if (!it || !it.equip) return false;
    const kind = this.slotKind(key);
    const cur = this.getEquip(key);
    let next, name, verb;

    if (kind === 'gun') {
      const def = WEAPONS[it.equip.gun];
      if (!def) return false;
      const want = this.slotIdx(key) < 2 ? 'primary' : 'secondary';
      if (def.slot !== want) return false;                 // 类型不对，别硬塞
      next = EQUIP.gun(it.equip.gun, it.equip.mag | 0);    // 余弹跟着枪走
      name = def.name; verb = '装上 ';
    } else if (kind === 'bag') {
      if (it.equip.kind !== 'bag') return false;
      const bag = BACKPACK.make(it.equip.bag);
      if (!bag) return false;
      /* 换更小的包：已经带在身上的东西装不下就不让换 */
      if (Save.bag.length > bag.slots) {
        this.note('背包空间不足，无法装备该背包。', true);
        this.closePicker();
        return false;
      }
      next = bag; name = bag.name; verb = '背上 ';
    } else {
      const g = it.equip.gear;
      if (!g || it.equip.kind !== 'armor') return false;
      next = GEAR.make(key, g.lv, g.dur);                   // 拷一份，仓库那件要移除
      name = g.name; verb = '穿上 ';
    }

    Save.stash = Save.stash.filter(x => x !== entry);
    if (cur) Save.addGearStash(kind === 'gun' ? cur : kind === 'bag' ? EQUIP.bag(cur.id) : EQUIP.armor(cur));
    this.setEquip(key, next);
    Save.save();

    this.closePicker();
    this.render();
    this.note(verb + name + (cur ? '，' + cur.name + ' 放回仓库' : ''));
    return true;
  },

  /* 卸下：放回仓库，不是销毁。副武器不能卸 */
  unequip(key) {
    if (!this.canUnequip(key)) {
      this.note('副武器必须带一把手枪 —— 空手进去没法打', true);
      this.closePicker();
      return false;
    }
    const cur = this.getEquip(key);
    if (!cur) { this.closePicker(); return; }
    /* 卸背包等于容量掉回 4 格，带的东西放不下就不让卸 */
    if (this.slotKind(key) === 'bag' && Save.bag.length > BASE_BAG_SLOTS) {
      this.note('背包空间不足：先清到 ' + BASE_BAG_SLOTS + ' 格以内再卸下。', true);
      this.closePicker();
      return false;
    }
    if (Save.stash.length >= STASH_SLOTS) {
      this.note('仓库满了，先卖点东西', true);
      return false;
    }
    const kind = this.slotKind(key);
    Save.addGearStash(kind === 'gun' ? cur : kind === 'bag' ? EQUIP.bag(cur.id) : EQUIP.armor(cur));
    this.setEquip(key, null);
    Save.save();
    this.closePicker();
    this.render();
    this.note('卸下' + cur.name + '，已放回仓库');
    return true;
  },

  /* ---- 护甲商人：只卖崭新的一~三级 ---- */
  SHOP_MAX_LV: 3,

  renderTabs() {
    const el = document.getElementById('baseTabs');
    if (!el) return;
    const shop = ['shop','gun','doctor'].includes(this.tab);
    if (!el.dataset.built) {
      const opts = [['stash', '仓库'], ['shop', '护甲商人'], ['gun', '军火商'], ['doctor', '医生']];
      el.innerHTML = opts.map(([k, name]) =>
        '<button class="' + (k === (this.tab || 'stash') ? 'on' : '') +
        '" data-t="' + k + '">' + name + '</button>'
      ).join('');
      el.dataset.built = '1';
      el.querySelectorAll('button').forEach(b => {
        b.onclick = () => { this.tab = b.dataset.t; this.render(); };
      });
    } else {
      el.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', b.dataset.t === (this.tab || 'stash'));
      });
    }

    /* 商人页（护甲 / 军火）展开在左边那一块，右边的仓库始终可见 —— 买完能直接看见东西进库 */
    const pg = document.getElementById('paneGear');
    const ps = document.getElementById('paneShop');
    if (pg) pg.style.display = shop ? 'none' : '';
    if (ps) ps.style.display = shop ? '' : 'none';
    const tip = document.getElementById('navTip');
    if (tip) {
      tip.textContent = this.tab === 'doctor' ? '白绿蓝医疗品 · 库存用药与收费治疗'
        : this.tab === 'gun'
        ? '全新枪械 · 买下的东西直接进右边仓库'
        : (this.tab === 'shop'
            ? '只进崭新的一~三级 · 买下的东西直接进右边仓库'
            : '左边是配装与背包，右边是仓库');
    }
    if (shop) this.renderShop();
  },

  /* 商品也用格子摆，点一下弹交易框确认金额。
     护甲商人和军火商共用同一块面板，只是货架内容不同。 */
  renderShop() {
    const el = document.getElementById('shopGrid');
    if (!el) return;
    el.innerHTML = '';
    const wallet = document.getElementById('shopWallet');
    if (wallet) wallet.textContent = formatMoney(Save.credits);
    const clinic = document.getElementById('doctorService');
    if (clinic) clinic.hidden = this.tab !== 'doctor';

    if (this.tab === 'doctor') return this.renderDoctor(el);
    if (this.tab === 'gun') return this.renderGunShop(el);

    const note = document.getElementById('shopNote');
    if (note) {
      note.innerHTML = '只进<b>崭新</b>的一~三级货。更高级的东西他也弄不到，那得你自己下去找。';
    }
    const hint = document.getElementById('shopHint');
    if (hint) hint.textContent = '买下的东西直接进右边的仓库';

    for (const type of ['helmet', 'body']) {
      for (let lv = 1; lv <= this.SHOP_MAX_LV; lv++) {
        const d = GEAR.def(type, lv);
        if (!d) continue;
        const cell = document.createElement('div');
        cell.className = 'scell r' + gearRarity(lv);
        const ico = Icons.gear[type + lv]
          ? '<img src="' + Icons.gear[type + lv].src + '" alt="">'
          : '<span class="gl">' + esc(GEAR[type].short) + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(d.short || d.name) + '</span>' +
          '<span class="pr">' + formatMoney(d.price) + '</span>';
        cell.title = d.name + ' · 防护 Lv' + lv +
          ' · 耐久 ' + d.dur + ' · ' + d.w + 'kg · 右键看详情';
        cell.onclick = () => this.askBuy(type, lv, cell);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(EQUIP.armor(GEAR.make(type, lv)), cell.getBoundingClientRect(), '左键买下');
        };
        el.appendChild(cell);
      }
    }

    /* 背包：只出前三档。20 / 24 格那两只要下军用物资箱，商人弄不到 */
    const bt = document.createElement('div');
    bt.className = 'shop-cat';
    bt.textContent = '背包（容量 ' + BAGS.filter(d => d.r <= this.SHOP_BAG_MAX_R).map(d => d.slots).join(' / ') + ' 格）';
    el.appendChild(bt);

    for (const d of BAGS) {
      if (d.r > this.SHOP_BAG_MAX_R) continue;
      const item = EQUIP.bag(d.id);
      const cell = document.createElement('div');
      cell.className = 'scell r' + d.r;
      const ico = Icons.gear[d.id]
        ? '<img src="' + Icons.gear[d.id].src + '" alt="">'
        : '<span class="gl">包</span>';
      cell.innerHTML = ico +
        '<span class="cn">' + esc(d.short) + '</span>' +
        '<span class="pr">' + formatMoney(d.price) + '</span>';
      cell.title = d.name + ' · 容量 ' + d.slots + ' 格 · ' + d.w + 'kg · 右键看详情';
      cell.onclick = () => this.askBuyBag(d.id, cell);
      cell.oncontextmenu = (ev) => {
        ev.preventDefault();
        Tips.show(item, cell.getBoundingClientRect(), '左键买下');
      };
      el.appendChild(cell);
    }
  },

  /* 护甲商人最多卖到这一档背包（白绿蓝），紫金靠搜 */
  SHOP_BAG_MAX_R: 3,

  askBuyBag(id, cell) {
    const d = BACKPACK.def(id);
    if (!d) return;
    Deal.show({
      kind: 'buy',
      title: '买入',
      name: d.name,
      sub: '容量 ' + d.slots + ' 格 · ' + d.w + 'kg',
      icon: d.id,
      short: d.short,
      price: d.price,
      can: Save.credits >= d.price && Save.stash.length < STASH_SLOTS,
      onGo: () => this.buyBag(id)
    }, cell.getBoundingClientRect());
  },

  buyBag(id) {
    const d = BACKPACK.def(id);
    if (!d) return false;
    if (d.r > this.SHOP_BAG_MAX_R) return false;        // 商人进不到更高级的货
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return false; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ' + formatMoney(d.price - Save.credits), true);
      return false;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.bag(id));
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），在仓库里，回左边背上');
    return true;
  },

  /* 军火商的货架：两个主武器 + 一个副武器，全是崭新的满弹匣；再往下是弹药柜 */
  renderGunShop(el) {
    const note = document.getElementById('shopNote');
    if (note) {
      note.innerHTML = '全新枪械，<b>满弹匣</b>出手。弹药只进<b>一级、二级</b>——' +
        '三级以上得从人身上拿。';
    }
    const hint = document.getElementById('shopHint');
    if (hint) hint.textContent = '买下的东西直接进右边的仓库，回左边装进背包';

    for (const [group, label] of [['primary', '主武器'], ['secondary', '副武器']]) {
      const title = document.createElement('div');
      title.className = 'shop-cat';
      title.textContent = label;
      el.appendChild(title);

      for (const id of Object.keys(WEAPONS)) {
        const d = WEAPONS[id];
        if (d.slot !== group) continue;
        const item = EQUIP.gun(id, d.mag);          // 崭新：满弹匣
        const cell = document.createElement('div');
        cell.className = 'scell r' + item.r;
        const ico = Icons.gear[id]
          ? '<img src="' + Icons.gear[id].src + '" alt="">'
          : '<span class="gl">' + esc(d.short) + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(d.short) + '</span>' +
          '<span class="pr">' + formatMoney(d.price) + '</span>';
        cell.title = d.name + ' · ' + d.dmgMin + '–' + d.dmgMax + ' 伤害 · 弹匣 ' + d.mag +
          ' · ' + d.rpm + ' 发/分 · ' + d.w + 'kg · 右键看详情';
        cell.onclick = () => this.askBuyGun(id, cell);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(item, cell.getBoundingClientRect(), '左键买下');
        };
        el.appendChild(cell);
      }
    }

    this.renderAmmoShop(el);
  },

  /* 弹药柜：三种口径 × 一~二级，一盒 30 发。
     三级以上没有渠道 —— 那才是下海一趟的理由。 */
  SHOP_AMMO_MAX_LV: 2,
  SHOP_AMMO_PACK: 30,

  renderAmmoShop(el) {
    const pack = this.SHOP_AMMO_PACK;
    const title = document.createElement('div');
    title.className = 'shop-cat';
    title.textContent = '弹药（一盒 ' + pack + ' 发）';
    el.appendChild(title);

    for (const cal of Object.keys(CALIBERS)) {
      for (let lv = 1; lv <= this.SHOP_AMMO_MAX_LV; lv++) {
        const it = ammoItem(cal, lv);
        if (!it) continue;
        const cell = document.createElement('div');
        cell.className = 'scell r' + it.r;
        const ico = Icons.get(it.id)
          ? '<img src="' + Icons.get(it.id).src + '" alt="">'
          : '<span class="gl">Lv' + it.level + '</span>';
        cell.innerHTML = ico +
          '<span class="cn">' + esc(it.short) + ' ×' + pack + '</span>' +
          '<span class="pr">' + formatMoney(it.price * pack) + '</span>';
        cell.title = it.name + ' · 穿透 Lv' + it.penLevel + ' · 伤害系数 ×' + it.dmgMul.toFixed(2) +
          ' · 一盒 ' + pack + ' 发';
        cell.onclick = () => this.askBuyAmmo(it.id, pack, cell);
        cell.oncontextmenu = (ev) => {
          ev.preventDefault();
          Tips.show(it, cell.getBoundingClientRect(), '左键买一盒 ' + pack + ' 发');
        };
        el.appendChild(cell);
      }
    }
  },

  askBuyAmmo(id, pack, cell) {
    const it = ITEM_BY_ID[id];
    if (!it) return;
    Deal.show({
      kind: 'buy',
      title: '买入弹药',
      name: it.name + ' ×' + pack,
      id: it.id,
      short: it.short,
      sub: '穿透 Lv' + it.penLevel + ' · 一盒 ' + pack + ' 发',
      price: it.price * pack,
      can: Save.credits >= it.price * pack,
      onGo: () => this.buyAmmo(id, pack)
    }, cell.getBoundingClientRect());
  },

  buyAmmo(id, pack) {
    const it = ITEM_BY_ID[id];
    if (!it || it.cat !== 'ammo' || it.level > this.SHOP_AMMO_MAX_LV) return false;
    const price = it.price * pack;
    if (Save.credits < price) { this.note('信用点不够', true); return false; }
    Save.credits -= price;
    Save.addStash(id, pack);
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + it.name + ' ×' + pack + '（-' + formatMoney(price) + '），已放入仓库');
    return true;
  },

  /* 买之前先把金额摆出来 */
  renderDoctor(el) {
    document.getElementById('shopNote').innerHTML = '出售<b>寻常、良品、上乘</b>医疗品。紫金恢复药需要探索获取；标有“效果待开放”的商品当前不可使用。';
    document.getElementById('shopHint').textContent = '购买后进入仓库；点击库存医疗品可使用或出售';
    const q = Medical.quote(), service = document.getElementById('doctorService');
    service.innerHTML = '<h3>治疗服务</h3><p>生命值 <b>' + Math.round(Save.hp * 10) / 10 + ' / 100 HP</b> · 补满 ' +
      Math.round(q.missing * 10) / 10 + ' HP</p><p>绷带等效成本 ' + formatMoney(q.medicine) + ' + 服务费 ' + formatMoney(q.service) +
      '</p><button id="btnDoctorTreat"' + (!q.missing || Save.credits < q.total ? ' disabled' : '') + '>' +
      (q.missing ? '立即治疗至满血 · ' + formatMoney(q.total) : '生命值已满') + '</button><p class="medical-muted">' +
      (q.missing && Save.credits < q.total ? '信用点不足。' : '') + '损伤清除服务待状态系统开放。</p>';
    document.getElementById('btnDoctorTreat').onclick = ev => {
      const quote = Medical.quote();
      Deal.show({ kind:'buy', title:'治疗服务', name:'立即恢复至满血',
        sub:'恢复 ' + Math.round(quote.missing * 10) / 10 + ' HP · 药费 ' + formatMoney(quote.medicine) + ' + 服务费 ' + formatMoney(quote.service),
        price:quote.total, can:quote.missing > 0 && Save.credits >= quote.total,
        onGo:() => this.treat(quote.total) }, ev.currentTarget.getBoundingClientRect());
    };
    for (const [group, label] of Object.entries(MEDICAL_GROUPS)) {
      const title = document.createElement('div'); title.className = 'shop-cat'; title.textContent = label; el.appendChild(title);
      for (const item of MEDICAL_ITEMS.filter(i => i.medicalGroup === group && i.r <= 3)) {
        const cell = document.createElement('div'); cell.className = 'scell r' + item.r; cell.dataset.medical = item.id;
        cell.innerHTML = Icons.bagTag(item, '') + '<span class="cn">' + esc(item.short || item.name) + '</span>' +
          '<span class="pr">' + formatMoney(item.price) + '</span>' + (!Medical.ready(item) ? '<span class="pending-mark">效果待开放</span>' : '');
        cell.title = item.name + ' · ' + Medical.summary(item) + ' · ' + formatMoney(item.price);
        cell.onclick = () => Deal.show({ kind:'buy', title:'买入医疗品', name:item.name, id:item.id,
          sub:Medical.summary(item), price:item.price,
          can:Save.credits >= item.price && (Save.stashCount(item.id) > 0 || Save.stash.length < STASH_SLOTS),
          onGo:() => this.buyMedical(item.id) }, cell.getBoundingClientRect());
        cell.oncontextmenu = ev => { ev.preventDefault(); Tips.show(item, cell.getBoundingClientRect(), '左键购买一件'); };
        el.appendChild(cell);
      }
    }
  },

  buyMedical(id) {
    const item = ITEM_BY_ID[id];
    if (Game.state !== 'base' || !Medical.is(item) || item.r > 3) return false;
    if (Save.credits < item.price) { this.note('信用点不足', true); return false; }
    if (!Save.stashCount(id) && Save.stash.length >= STASH_SLOTS) { this.note('仓库满了', true); return false; }
    Save.credits -= item.price; Save.addStash(id, 1); Save.save(); Save.flush();
    this.render(); this.note('买下' + item.name + '，已放入仓库'); return true;
  },

  treat(expectedPrice) {
    if (Game.state !== 'base') return false;
    const q = Medical.quote();
    if (!q.missing) return false;
    if (q.total !== expectedPrice) { this.note('伤势已变化，请重新确认诊费', true); return false; }
    if (Save.credits < q.total) { this.note('信用点不足', true); return false; }
    Save.credits -= q.total; Save.setHP(CFG.P.HP);
    this.render(); this.note('治疗完成，已恢复至满血（-' + formatMoney(q.total) + '）'); return true;
  },

  askBuy(type, lv, cell) {
    const d = GEAR.def(type, lv);
    if (!d) return;
    Deal.show({
      kind: 'buy',
      title: '买入',
      name: d.name,
      sub: '防护 Lv' + lv + ' · 耐久 ' + d.dur,
      icon: type + lv,
      short: d.short,
      price: d.price,
      can: Save.credits >= d.price && Save.stash.length < STASH_SLOTS,
      onGo: () => this.buyArmor(type, lv)
    }, cell.getBoundingClientRect());
  },

  askBuyGun(id, cell) {
    const d = WEAPONS[id];
    if (!d) return;
    Deal.show({
      kind: 'buy',
      title: '买入',
      name: d.name,
      sub: (d.slot === 'primary' ? '主武器' : '副武器') + ' · ' + d.dmgMin + '–' + d.dmgMax +
           ' 伤害 · 弹匣 ' + d.mag + ' · 满弹',
      icon: id,
      short: d.short,
      price: d.price,
      can: Save.credits >= d.price && Save.stash.length < STASH_SLOTS,
      onGo: () => this.buyGun(id)
    }, cell.getBoundingClientRect());
  },

  buyGun(id) {
    const d = WEAPONS[id];
    if (!d) return;
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ' + formatMoney(d.price - Save.credits), true);
      return;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.gun(id, d.mag));      // 崭新：满弹匣
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），在仓库里，回左边装上');
  },

  buyArmor(type, lv) {
    const d = GEAR.def(type, lv);
    if (!d) return;
    if (lv > this.SHOP_MAX_LV) return;                 // 商人进不到更高级的货
    if (Save.stash.length >= STASH_SLOTS) { this.note('仓库满了，先卖点东西', true); return; }
    if (Save.credits < d.price) {
      this.note('买 ' + d.name + ' 还差 ' + formatMoney(d.price - Save.credits), true);
      return;
    }
    Save.credits -= d.price;
    Save.addGearStash(EQUIP.armor(GEAR.make(type, lv)));   // 崭新：耐久是满的
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('买下 ' + d.name + '（-' + formatMoney(d.price) + '），在仓库里，回左边换上');
  },

  /* ---- 背包：和局内背包同一套格子 UI ----
     这里不放"携带数量"了：想带什么就把什么放进背包，带多少就是包里的数量。
     弹药和药物回藏身处时留在包里（下一趟接着用），其它东西自动回仓库。 */
  renderBag() {
    const grid = document.getElementById('baseBagGrid');
    if (!grid) return;
    grid.innerHTML = '';
    /* 老存档可能带着超过当前容量的东西：多出来的格子照样画出来，
       让玩家能搬回仓库，别让它们卡在包里看不见 */
    const cap = Math.max(bagSlots(), Save.bag.length);
    for (let i = 0; i < cap; i++) {
      const cell = document.createElement('div');
      const e = Save.bag[i];
      const it = e ? stashItem(e) : null;
      if (!it) {
        cell.className = 'cell empty';
        cell.textContent = '·';
        grid.appendChild(cell);
        continue;
      }
      const n = e.n || 1;
      cell.className = 'cell ' + RARITY[U.clamp((it.r || 1) - 1, 0, RARITY.length - 1)].cls +
        (it.equip ? ' eq' : '');
      cell.innerHTML = Icons.bagTag(it, 'ico-bag') +
        '<span class="cn">' + esc(it.short || it.name) + '</span>' +
        (n > 1 ? '<span class="qty">' + n + '</span>' : '') +
        ((it.healCap && Medical.isPartial(e))
          ? '<span class="cap">' + Math.ceil(Medical.entryCap(e)) + '</span>' : '');
      cell.title = it.name + ' · ' + (it.w * n).toFixed(2) + 'kg · 左键看详情';
      cell.onclick = () => this.showItem(e, 'bag', cell);
      cell.oncontextmenu = ev => { ev.preventDefault(); this.showItem(e, 'bag', cell); };
      grid.appendChild(cell);
    }

    const w = Save.bagWeight();
    const meta = document.getElementById('bagMeta');
    if (meta) meta.textContent = Save.bag.length + ' / ' + bagSlots() + ' 格 · ' +
      w.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg';
    const bar = document.getElementById('bagBar');
    if (bar && bar.querySelector) {
      bar.querySelector('i').style.width = Math.min(100, w / CFG.BAG.CARRY * 100) + '%';
    }
    Save.save();
  },

  /* 背包还能不能塞下：先算再动，算不过就不搬，绝不吞东西 */
  bagBlock(it, n) {
    if (!it) return '物品不存在';
    if (Save.bagWeight() + it.w * n > CFG.BAG.CARRY + 1e-6) return '太重了';
    const stack = Math.max(1, it.stack || 1);
    const perSlot = it.healCap ? 1 : stack;
    let room = 0;
    for (const e of Save.bag) {
      if (e.gear || e.id !== it.id) continue;
      if (it.healCap && e.cap != null && e.cap < it.healCap - 1e-6) continue;
      room += Math.max(0, stack - e.n);
    }
    const need = Math.max(0, n - room);
    if (need > (bagSlots() - Save.bag.length) * perSlot) return '格子不够';
    return '';
  },

  /* 仓库 → 背包：整叠搬（装备和用过的恢复品一件一件搬） */
  toBag(e) {
    const it = stashItem(e);
    if (!it) return false;
    const n = (e.gear || it.healCap) ? 1 : Math.max(1, e.n || 1);
    const why = this.bagBlock(it, n);
    if (why) { this.note('放不进背包：' + why, true); return false; }
    if (e.gear) Save.addGearBag(it);
    else Save.addBag(it.id, n, e.cap);
    this.dropFrom(Save.stash, e, n);
    this.render();
    this.note('已放入背包：' + it.name + (n > 1 ? ' ×' + n : ''));
    return true;
  },

  /* 背包 → 仓库 */
  toStash(e) {
    const it = stashItem(e);
    if (!it) return false;
    const n = (e.gear || it.healCap) ? 1 : Math.max(1, e.n || 1);
    if (e.gear) Save.addGearStash(it);
    else Save.addStash(it.id, n, e.cap);
    this.dropFrom(Save.bag, e, n);
    this.render();
    this.note('已放回仓库：' + it.name + (n > 1 ? ' ×' + n : ''));
    return true;
  },

  dropFrom(list, e, n) {
    e.n -= Math.min(e.n || 1, n);
    if (e.n <= 0) {
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
    }
  },

  /* 仓库 / 背包里点开一件：详情 + 动作。
     仓库那侧多一个「放入背包」，背包那侧多一个「放回仓库」，两边同一个浮窗。 */
  showItem(e, where, node) {
    const it = stashItem(e);
    if (!it || !node || !node.getBoundingClientRect) return;
    const n = e.n || 1;
    const extra = [];
    if (it.healCap) extra.push(['当前容量', Math.ceil(Medical.entryCap(e)) + ' / ' + it.healCap]);
    Tips.show(it, node.getBoundingClientRect(),
      where === 'stash' ? '左键放入背包' : '左键放回仓库', extra);

    const acts = [];
    const canHeal = Medical.ready(it) && Save.hp < CFG.P.HP;
    if (Medical.ready(it)) {
      acts.push({
        label: Save.hp >= CFG.P.HP ? '生命值已满' : '使用一件',
        disabled: !canHeal,
        onClick: () => { if (canHeal) Medical.use(e, where === 'bag' ? 'basebag' : 'stash'); }
      });
    }
    if (where === 'stash') {
      acts.push({ label: '放入背包', onClick: () => this.toBag(e) });
      acts.push({ label: '卖出' + (n > 1 ? ' ×' + n : ''), onClick: () => this.askSell(e, n, node) });
    } else {
      acts.push({ label: '放回仓库', onClick: () => this.toStash(e) });
    }
    Tips.actions(acts);
  },

  /* ---- 仓库 ---- */
  renderFilter() {
    const el = document.getElementById('stashFilter');
    if (el.dataset.built) return;      // 只建一次，之后只切 class
    const opts = [
      ['all', '全部'], ['sell', '可出售'],
      ['sup', '物资'], ['col', '收集品']
    ];
    el.innerHTML = opts.map(([k, name]) =>
      '<button class="pill' + (k === this.filter ? ' on' : '') + '" data-f="' + k + '">' + name + '</button>'
    ).join('');
    el.dataset.built = '1';
    el.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        this.filter = b.dataset.f;
        el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        this.renderStash();
      };
    });
  },

  /* 仓库格子按容器尺寸实时算：正方形、边长 46~78，列数铺满宽度，行数铺满高度。
     窗口一变就重算，所以什么分辨率下都是满屏的方格，不会一边空一大条。 */
  gridMetrics() {
    const grid = document.getElementById('stashGrid');
    const gap = 9;                 // 缝隙跟着格子一起放大，比例感不变
    const w = (grid && grid.clientWidth) || 900;
    const h = (grid && grid.clientHeight) || 560;

    /* 边长目标 93（原来 62，整体放大 1.5 倍），夹在 69~118 */
    const TARGET = 93, MIN = 69, MAX = 118;

    /* 格子必须是正方形，宽高又都有限，所以不能只按一边算：
       在目标行数附近逐个试，行数定了边长就定了，再看这一边长能摆几列，
       挑「宽高都用得最满」的那组。 */
    const r0 = Math.max(3, Math.round((h + gap) / (TARGET + gap)));
    let best = null;
    for (let rows = Math.max(3, r0 - 2); rows <= r0 + 2; rows++) {
      const cell = (h - gap * (rows - 1)) / rows;
      if (cell < MIN || cell > MAX) continue;
      const cols = Math.floor((w + gap) / (cell + gap));
      if (cols < 4) continue;
      const fill = (cols * cell + gap * (cols - 1)) / w +
                   (rows * cell + gap * (rows - 1)) / h;
      if (!best || fill > best.fill + 1e-6) best = { rows: rows, cols: cols, cell: cell, fill: fill };
    }

    if (!best) {                   // 容器异常小的时候兜底，别算不出格子
      const cols = Math.max(3, Math.floor((w + gap) / (MIN + gap)));
      return { cols: cols, rows: 3, cell: MIN };
    }
    return { cols: best.cols, rows: best.rows, cell: Math.floor(best.cell) };
  },

  page: 0,

  renderStash() {
    const grid = document.getElementById('stashGrid');
    if (!grid) return;

    const list = Save.stash.filter(e => {
      const it = stashItem(e);
      if (!it) return false;
      if (this.filter === 'sup') {
        return itemGroup(it)==='supply';
      }
      if (this.filter === 'col') return itemGroup(it)==='collectible';
      return true;
    }).sort((a, b) => {
      const ia = stashItem(a), ib = stashItem(b);
      return (ib.price || 0) - (ia.price || 0);
    });

    document.getElementById('stashCount').textContent =
      Save.stash.length + ' / ' + STASH_SLOTS + ' 格';
    const total = Save.stash.reduce((a, e) => {
      const it = stashItem(e);
      return a + (it ? unitPrice(it) * (e.n || 1) : 0);
    }, 0);
    document.getElementById('stashValue').textContent = formatMoney(total);

    /* 分页：一页就是当前屏幕能摆下的格数 */
    const m = this.gridMetrics();
    if (grid.style && grid.style.setProperty) {
      grid.style.setProperty('--cols', m.cols);
      grid.style.setProperty('--gap', '9px');
    }
    const per = m.cols * m.rows;
    this._per = per;
    const pages = Math.max(1, Math.ceil(list.length / per));
    this.page = U.clamp(this.page, 0, pages - 1);
    const slice = list.slice(this.page * per, this.page * per + per);

    grid.innerHTML = '';
    for (let i = 0; i < per; i++) {
      const cell = document.createElement('div');
      const e = slice[i];
      if (!e) {                       // 空位也画出来，网格始终填满可视区域
        cell.className = 'scell empty';
        grid.appendChild(cell);
        continue;
      }
      const it = stashItem(e);
      const n = e.n || 1;
      cell.className = 'scell r' + (it.r || 1) + (it.equip ? ' eq' : '');
      cell.innerHTML =
        Icons.bagTag(it, '') +
        '<span class="cn">' + esc(it.short || it.name) + '</span>' +
        (n > 1 ? '<span class="qty">' + n + '</span>' : '') +
        ((it.healCap && Medical.isPartial(e))
          ? '<span class="cap">' + Math.ceil(Medical.entryCap(e)) + '</span>' : '');
      cell.title = it.name + (it.healCap && Medical.isPartial(e)
          ? ' · 剩余容量 ' + Math.ceil(Medical.entryCap(e)) + ' / ' + it.healCap
          : ' · ' + it.w.toFixed(2) + 'kg') + ' · ' +
        formatMoney(unitPrice(it) * n) + ' · 左键看详情';
      cell.onclick = () => this.showItem(e, 'stash', cell);
      cell.oncontextmenu = (ev) => {
        ev.preventDefault();
        this.showItem(e, 'stash', cell);
      };
      grid.appendChild(cell);
    }

    this.renderPager(pages, list.length);
  },

  renderPager(pages, total) {
    const el = document.getElementById('stashPager');
    if (!el) return;
    if (pages <= 1) {
      el.innerHTML = '<span>共 ' + total + ' 种</span>';
      return;
    }
    el.innerHTML =
      '<button data-p="-1">上一页</button>' +
      '<span>' + (this.page + 1) + ' / ' + pages + '</span>' +
      '<button data-p="1">下一页</button>';
    el.querySelectorAll('button').forEach(b => {
      const d = parseInt(b.dataset.p, 10);
      b.disabled = (d < 0 && this.page === 0) || (d > 0 && this.page >= pages - 1);
      b.onclick = () => {
        this.page = U.clamp(this.page + d, 0, pages - 1);
        this.renderStash();
      };
    });
  },

  /* 卖出也要先确认：一格点下去就是一整堆，误点太亏 */
  askSell(e, n, cell) {
    const it = stashItem(e);
    if (!it) return;
    const gain = unitPrice(it) * n;
    Deal.show({
      kind: 'sell',
      title: '卖出',
      name: it.name + (n > 1 ? ' ×' + n : ''),
      sub: it.equip ? '装备按剩余耐久折价' : itemCategoryLabel(it),
      icon: it.icon,
      id: it.id,
      short: it.short,
      price: gain,
      onGo: () => this.sell(e, n)
    }, cell.getBoundingClientRect());
  },

  /* 按仓库条目卖。装备按剩余耐久折价，永远不超过买价 */
  sell(e, n) {
    const it = stashItem(e);
    if (!it || !e) return;
    const take = Math.min(e.n || 1, n);
    const gain = unitPrice(it) * take;
    if (e.gear) Save.stash = Save.stash.filter(x => x !== e);
    else {
      e.n -= take;
      if (e.n <= 0) Save.stash = Save.stash.filter(x => x !== e);
    }
    Save.credits += gain;
    Save.save();
    Game.sfx('pickup');
    this.render();
    this.note('卖出 ' + it.name + ' ×' + take + '，+' + gain + ' 信用点');
  },

  sellJunk() {
    let gain = 0, count = 0;
    const keep = [];
    for (const e of Save.stash) {
      const it = stashItem(e);
      if (it && itemGroup(it) === 'collectible' && it.r === 1) { gain += it.price * e.n; count += e.n; }
      else keep.push(e);
    }
    if (!count) { this.note('仓库里没有寻常收集品可卖'); return; }
    Save.stash = keep;
    Save.credits += gain;
    Save.save();
    this.render();
    this.note('清掉 ' + count + ' 件寻常物，+' + gain + ' 信用点');
  },

  /* ---- 出发：背包里装了什么就带什么，不再现场买补给 ---- */
  deploy(mapId) {
    const map = MAP_CATALOG.find(m => m.id === (mapId || RAID_MAP.id));
    if (!map) return;
    /* 空手不准下海：没有副武器就发一把，有主武器就照常带 */
    this.ensureSidearm();
    if (!Save.gear.weapons[SIDEARM_SLOT]) {
      this.note('副武器必须带一把手枪 —— 先去军火商买一把', true);
      return;
    }
    Save.normalizeBag();
    Save.save(); Save.flush();

    this.close();
    document.getElementById('mapVeil').classList.add('hidden');
    Game.startRun(null, map.id);
  }
};

/* 地图选择：浏览/返回不消耗补给，确认出发才结算。 */
const MapSelect = {
  selectedId: RAID_MAP.id,
  open() {
    if(Game.state!=='base')return;
    Base.close();Tips.hide();Deal.hide();
    document.getElementById('gearPicker').style.display='none';
    Game.state='map-select';
    document.getElementById('mapVeil').classList.remove('hidden');
    this.render();
    document.querySelector('#mapChoices [aria-pressed="true"]')?.focus({preventScroll:true});
  },
  back() {
    if(Game.state!=='map-select')return;
    Base.open();document.getElementById('btnDeploy').focus();
  },
  render() {
    const choices=document.getElementById('mapChoices');
    choices.innerHTML=MAP_CATALOG.map(map=>`<button type="button" class="map-choice" data-map="${map.id}" aria-pressed="${map.id===this.selectedId}"><span class="map-choice-head"><b>${esc(map.title)}</b><span class="map-choice-state">${map.id===this.selectedId?'已选择':'选择地图'}</span></span><canvas width="${map.width*4}" height="${map.height*4}" data-preview="${map.id}" role="img" aria-label="${esc(map.title)}地形示意"></canvas><span class="map-choice-tags">${map.width}×${map.height} 格 · ${map.districts.length} 栋建筑 · ${map.exits.length} 个撤离点</span><span class="map-choice-desc">${map.tideEnabled?'修理铺、旧集市与低洼船坞。水位逐渐上涨，留意退路。':'两岸旧街、中央运河与双桥。水位稳定，银行集中高价值物资。'}</span><span class="map-choice-detail">${map.containers.length} 个容器 · ${map.enemies.length} 个敌人 · 12 分钟</span></button>`).join('');
    choices.querySelectorAll('[data-map]').forEach(button=>button.onclick=()=>{
      this.selectedId=button.dataset.map;this.render();
      document.querySelector('#mapChoices [aria-pressed="true"]')?.focus({preventScroll:true});
    });
    for(const map of MAP_CATALOG){
      const canvas=choices.querySelector('[data-preview="'+map.id+'"]'),c=canvas.getContext('2d');
      const colors={wall:'#273b34',floor:'#8b9583',low:'#46584c',marsh:'#285960',canal_water:'#285960',street_stone:'#667c6b',courtyard_paving:'#a39a77',quay_top:'#91a18b',bridge_stone_deck:'#baac89',bridge_wood_deck:'#a98351'};
      for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){c.fillStyle=colors[map.terrain[map.terrainRows[y][x]].art]||'#7d927d';c.fillRect(x*4,y*4,4,4);}
      c.fillStyle='#e8f4ee';c.fillRect(map.spawn.x*4-1,map.spawn.y*4-1,6,6);
      c.fillStyle='#52e8b3';for(const ex of map.exits)c.fillRect(ex.x*4-1,ex.y*4-1,6,6);
    }
    const map=MAP_CATALOG.find(m=>m.id===this.selectedId);
    document.getElementById('mapSelectedName').textContent=map.title;
    const bagN=Save.bag.length, bagW=Save.bagWeight();
    document.getElementById('mapSupplyCost').textContent='背包 ' + bagN + ' / ' + bagSlots() +
      ' 格 · ' + bagW.toFixed(1) + ' / ' + CFG.BAG.CARRY + ' kg';
    document.getElementById('mapSelectionHint').textContent=
      '带什么由背包决定：子弹和药物回来还留在包里，其它东西自动入库。';
    document.getElementById('btnMapStart').disabled=false;
  },
  confirm() {
    if(Game.state!=='map-select')return;
    Base.deploy(this.selectedId);
  }
};
