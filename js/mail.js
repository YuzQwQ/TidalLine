/* ============================================================
   信箱：局外信件与附件领取
   ─ 信存在 Save.mail，跨局保留；附件点「领取」才进仓库，不直接进背包。
   ─ 另开一条 localStorage 队列 tideline_pending_mail：外部脚本或控制台
     可以往里塞信，下次进藏身处由 drain() 收进来（读完即删，只收一次）。
   ─ 发放批次 MAIL_BATCHES 只补给已有存档：新号从零开始，不靠这批发家。
   ============================================================ */

const MAIL_QUEUE_KEY = 'tideline_pending_mail';

/* ---------------- 发放批次 ----------------
   一批信只发一次：批次 id 记进 Save.mailBatches，重开页面不会重复寄。
   加新批次就在数组末尾追加一条，老存档下次进藏身处自动收到。 */
const MAIL_BATCHES = [
  {
    id: '2026-11-keys-4x5',
    letters: [
      {
        id: 'm_bank_vault_5',
        from: '维克托',
        title: '金库那扇门，我开不了',
        body: '银行侧门进来第三根柱子后面就是金库大门。机械锁，没有电，撬棍在上面只能留一道划痕——这活儿得用钥匙。\n' +
          '里面有两只大型保险箱、两只小型保险箱、一只机密封存箱，另外还有两处会自己冒物资出来的堆头。\n' +
          '上次那批货的抽成我不要了，换成这把。齿还剩五次，用一次少一次，别拿它去试别的门，它只认那一扇。',
        items: [{ id: 'door_key_bank_vault', n: 1, cap: 5 }]
      },
      {
        id: 'm_watchshop_5',
        from: '伊莲娜',
        title: '收藏室的钥匙，借你看看',
        body: '钟表店二楼那间私人收藏室，主人走得急，锁留下了。一只大型保险箱、两只小型保险箱，还有两口珠宝匣——柜台上那些摆着的都是幌子。\n' +
          '我不缺那一屋子的东西，缺的是有人替我看清里面到底有什么。看完把清单带来给我，钥匙就留在你那儿。\n' +
          '还剩五次开锁的余量。这锁的齿已经磨得很薄了，别浪费在无关的门上。',
        items: [{ id: 'door_key_watchshop', n: 1, cap: 5 }]
      },
      {
        id: 'm_clinic_5',
        from: '诊所值班医生',
        title: '储藏室的备用钥匙',
        body: '储藏室今晚没人值班，我也不打算再回去一趟。\n' +
          '里面有两只医疗柜、一只防水补给箱、一只小保险箱，还有两处临时堆放的物资。绷带和止血的东西应该够你用几趟。\n' +
          '钥匙圈上挂着编号，别和别的搞混。还剩五次，用完就真的没了。',
        items: [{ id: 'door_key_clinic', n: 1, cap: 5 }]
      },
      {
        id: 'm_old_apt_5',
        from: '潮汐线补给处',
        title: '关于上次那次断线',
        body: '你在局内刷新了页面，挂在钥匙链上的东西全部掉回海里——这是我们的问题，不是你的。\n' +
          '补一把老公寓 3 号房钥匙给你：一台大型保险箱、一台小型保险箱、一只密封公文包，外加两处物资刷新点。\n' +
          '耐久按五次计。钥匙链以后不会再因为断线被清空：局内每开一次门都会先把剩余耐久写回存档，刷新只会丢掉这一局，不会丢钥匙。\n' +
          '附件在信里，点「领取」后直接进仓库。',
        items: [{ id: 'door_key_old_apt', n: 1, cap: 5 }]
      }
    ]
  }
];

function mailDate(ts) {
  const d = new Date(Number.isFinite(ts) ? ts : Date.now());
  const p = n => (n < 10 ? '0' : '') + n;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

const Mail = {
  openId: null,
  _noteT: 0,

  /* 启动顺序：先收外部队列，再补发放批次，最后接按钮。
     放在 Save.load() 之后调用（见 boot.js）。 */
  init() {
    this.drain();
    this.applyBatches();
    this.bind();
    this.refreshBadge();
  },

  /* 已有存档才补发：新号的 Save.existed 是 false，什么都没收到。 */
  applyBatches() {
    if (!Save.existed) return 0;
    if (!Save.mailBatches || typeof Save.mailBatches !== 'object') Save.mailBatches = {};
    let added = 0;
    for (const batch of MAIL_BATCHES) {
      if (!batch || !batch.id || Save.mailBatches[batch.id]) continue;
      for (const letter of batch.letters || []) {
        this.push({ ...letter, batch: batch.id });
        added++;
      }
      Save.mailBatches[batch.id] = true;
    }
    if (added) { Save.save(); Save.flush(); }
    return added;
  },

  /* 外部投递口：往 localStorage 队列里塞一组信，进藏身处时收进来。
     读完立刻删队列键，同一批不会收第二次。 */
  drain() {
    let raw = null;
    try { raw = localStorage.getItem(MAIL_QUEUE_KEY); } catch (e) { return 0; }
    if (!raw) return 0;
    try { localStorage.removeItem(MAIL_QUEUE_KEY); } catch (e) { /* 删不掉也要往下走 */ }
    let list = [];
    try { list = JSON.parse(raw); } catch (e) { return 0; }
    if (!Array.isArray(list)) list = [list];
    let n = 0;
    for (const letter of list) {
      if (!letter || typeof letter !== 'object' || !letter.title) continue;
      this.push(letter);
      n++;
    }
    if (n) { Save.save(); Save.flush(); }
    return n;
  },

  /* 寄一封信。字段与 Save.normalizeMail 一致；id 不给就按时间戳生成。 */
  push(fields) {
    const letter = {
      id: fields.id || ('m' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      from: fields.from || '潮汐线补给处',
      title: fields.title || '无标题',
      body: fields.body || '',
      ts: Number.isFinite(fields.ts) ? fields.ts : Date.now(),
      items: Array.isArray(fields.items) ? fields.items.map(e => ({ ...e })) : [],
      credits: Math.max(0, Math.round(Number(fields.credits) || 0)),
      read: false,
      claimed: false,
      batch: fields.batch || null
    };
    Save.mail.push(letter);
    Save.normalizeMail();
    Save.save();
    return letter;
  },

  find(id) { return (Save.mail || []).find(l => l && l.id === id) || null; },
  unclaimed() { return (Save.mail || []).filter(l => l && !l.claimed).length; },
  unread() { return (Save.mail || []).filter(l => l && !l.read).length; },
  attachments(l) { return (l && Array.isArray(l.items) ? l.items : []).length + (l && l.credits > 0 ? 1 : 0); },

  notify(msg, bad) {
    const el = document.getElementById('mailHint');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('bad', !!bad);
    clearTimeout(this._noteT);
    this._noteT = setTimeout(() => {
      if (el.textContent === msg) { el.textContent = ''; el.classList.remove('bad'); }
    }, 2800);
  },

  /* 藏身处头部那个入口上的未领取计数 */
  refreshBadge() {
    const badge = document.getElementById('mailBadge');
    if (!badge) return;
    const n = this.unclaimed();
    badge.textContent = n;
    badge.hidden = n <= 0;
    const btn = document.getElementById('btnMail');
    if (btn) btn.classList.toggle('has-mail', n > 0);
  },

  bind() {
    if (this._bound) return;
    this._bound = true;
    /* 入口按钮在藏身处外壳（Safehouse.mount）里，比 Mail.init 挂得晚，
       所以走委托：按钮什么时候出现都能点。 */
    document.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target.closest('#btnMail, #btnMailClose, #btnMailClaimAll') : null;
      if (!t) return;
      if (t.id === 'btnMail') this.open();
      else if (t.id === 'btnMailClose') this.close();
      else this.claimAll();
    });
    const veil = document.getElementById('mailVeil');
    if (veil) veil.addEventListener('mousedown', e => { if (e.target === veil) this.close(); });
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const v = document.getElementById('mailVeil');
      if (!v || v.classList.contains('hidden')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.close();
    }, true);
  },

  open() {
    if (Game.state !== 'base') return false;
    Save.normalizeMail();
    const veil = document.getElementById('mailVeil');
    if (!veil) return false;
    veil.classList.remove('hidden');
    const first = (Save.mail || []).find(l => !l.claimed) || (Save.mail || [])[Save.mail.length - 1];
    this.openId = first ? first.id : null;
    this.render();
    if (typeof Game !== 'undefined' && Game.sfx) Game.sfx('pickup');
    return true;
  },

  close() {
    const veil = document.getElementById('mailVeil');
    if (veil) veil.classList.add('hidden');
    this.openId = null;
    this.refreshBadge();
    if (Game.state === 'base' && typeof Base !== 'undefined') Base.render();
  },

  select(id) {
    const l = this.find(id);
    if (!l) return false;
    this.openId = id;
    if (!l.read) { l.read = true; Save.save(); }
    this.render();
    return true;
  },

  /* ---- 领取 ---- */
  claim(id) {
    const l = this.find(id);
    if (!l) return false;
    if (l.claimed) { this.notify('这封已经领过了', true); return false; }
    if (!l.items.length && !l.credits) {
      l.claimed = true; Save.save(); this.render(); this.refreshBadge();
      return true;
    }
    const left = l.items.filter(e=>!e.gear&&!Save.canAddStash(e.id,e.n||1));
    const next=Save.normalizeList([...Save.stash,...l.items.flatMap(e=>e.gear?Array.from({length:e.n||1},()=>({...e,n:1})):[e])]);
    const moved=l.items.length;
    if (left.length||next.length>STASH_SLOTS) {
      /* 仓库放不下就整封留着：领一半会出现"那几件去哪了"的问题 */
      this.notify('仓库空间不足，先清出位置再领取整封附件', true);
      Save.save();
      this.render();
      return false;
    }
    Save.stash=next;
    if (l.credits > 0) {
      Save.credits += l.credits;
      this.notify('已领取 ' + formatMoney(l.credits) + ' 与 ' + moved + ' 件附件');
      l.credits = 0;
    } else {
      this.notify('已领取 ' + moved + ' 件附件，已放入仓库');
    }
    l.items = [];
    l.claimed = true;
    l.claimedAt = Date.now();
    Save.save(); Save.flush();
    this.render();
    this.refreshBadge();
    if (typeof Game !== 'undefined' && Game.sfx) Game.sfx('pickup');
    return true;
  },

  claimAll() {
    const list = (Save.mail || []).filter(l => l && !l.claimed);
    if (!list.length) { this.notify('没有待领取的信件', true); return 0; }
    let n = 0;
    for (const l of list) { if (this.claim(l.id)) n++; }
    this.notify(n ? '已领取 ' + n + ' 封' : '仓库空间不足，一件都没领走', !n);
    return n;
  },

  /* 领完的信可以删掉，正文不想留就清掉；还有附件的不许删。 */
  remove(id) {
    const l = this.find(id);
    if (!l) return false;
    if (l.items.length || l.credits > 0) { this.notify('附件还没领，不能删', true); return false; }
    Save.mail = Save.mail.filter(x => x !== l);
    if (this.openId === id) {
      const next = Save.mail[Save.mail.length - 1];
      this.openId = next ? next.id : null;
    }
    Save.save(); Save.flush();
    this.render();
    this.refreshBadge();
    return true;
  },

  /* ---- 渲染 ---- */
  render() {
    const list = document.getElementById('mailList');
    const read = document.getElementById('mailRead');
    if (!list || !read) return;
    const letters = (Save.mail || []).slice().reverse();
    list.innerHTML = '';
    if (!letters.length) {
      list.innerHTML = '<li class="mail-empty">还没有信件</li>';
      read.innerHTML = '<div class="mail-blank">补给处会把补发与活动奖励寄到这里。<br>附件不会占仓库位置，领了才入库。</div>';
      return;
    }
    if (!this.openId || !this.find(this.openId)) this.openId = letters[0].id;
    for (const l of letters) {
      const li = document.createElement('li');
      const cnt = this.attachments(l);
      li.className = 'mail-row' + (l.id === this.openId ? ' on' : '') + (l.claimed ? ' done' : '');
      li.dataset.mailId = l.id;
      li.innerHTML =
        '<div class="mr-top"><span class="mr-from">' + esc(l.from) + '</span>' +
        '<span class="mr-date">' + mailDate(l.ts) + '</span></div>' +
        '<b class="mr-title">' + esc(l.title) + '</b>' +
        '<div class="mr-foot">' +
        (l.claimed ? '<span class="mr-tag done">已领取</span>'
          : (cnt ? '<span class="mr-tag">' + cnt + ' 件附件</span>' : '<span class="mr-tag">纯信件</span>')) +
        (l.read ? '' : '<i class="mr-dot" title="未读"></i>') +
        '</div>';
      li.onclick = () => this.select(l.id);
      list.appendChild(li);
    }
    this.renderRead(this.find(this.openId));
  },

  renderRead(l) {
    const read = document.getElementById('mailRead');
    if (!read) return;
    if (!l) { read.innerHTML = '<div class="mail-blank">左边选一封信。</div>'; return; }
    const body = String(l.body || '').split(/\n+/).filter(p => p.trim())
      .map(p => '<p>' + esc(p) + '</p>').join('');
    const items = (l.items || []).map(e => this.card(e)).join('');
    const hasAtt = items || l.credits > 0;
    read.innerHTML =
      '<div class="ms-sheet">' +
        '<div class="ms-hd">' +
          '<h2>' + esc(l.title) + '</h2>' +
          '<div class="ms-meta">来自 ' + esc(l.from) + ' · ' + mailDate(l.ts) + '</div>' +
        '</div>' +
        '<div class="ms-body">' + (body || '<p class="dim">（没有正文）</p>') + '</div>' +
        (hasAtt ? '<div class="ms-att"><h3>附件</h3><div class="ms-items">' + items + '</div>' +
          (l.credits > 0 ? '<div class="ms-cr">信用点 <b>' + formatMoney(l.credits) + '</b></div>' : '') +
          '</div>' : '') +
        '<div class="ms-acts">' +
          (l.claimed
            ? '<span class="ms-done">已领取</span><button type="button" class="mini" data-mail-del="' + esc(l.id) + '">删除这封</button>'
            : (hasAtt
                ? '<button type="button" id="btnMailClaim" data-mail-claim="' + esc(l.id) + '">领取附件</button>'
                : '<button type="button" id="btnMailClaim" data-mail-claim="' + esc(l.id) + '">已阅，收下</button>')) +
        '</div>' +
      '</div>';
    const claim = read.querySelector('[data-mail-claim]');
    if (claim) claim.onclick = () => this.claim(claim.dataset.mailClaim);
    const del = read.querySelector('[data-mail-del]');
    if (del) del.onclick = () => this.remove(del.dataset.mailDel);
  },

  /* 附件卡片：和背包格同一套稀有度色，耐久按当前剩余折算价值 */
  card(entry) {
    const item = entry?.gear || ITEM_BY_ID[entry && entry.id];
    if (!item) return '';
    const val = entryValue(item, entry);
    const max = ItemCapacity.max(item);
    return '<div class="mail-item r' + item.r + '">' +
      '<div class="mi-ico">' + Icons.bagTag(item, '') + '</div>' +
      '<div class="mi-txt">' +
        '<b>' + esc(item.name) + '</b>' +
        '<span>' + esc(RARITY[U.clamp((item.r || 1) - 1, 0, RARITY.length - 1)].name) +
          ' · ' + formatMoney(val) + '</span>' +
        (max ? '<em>' + ItemCapacity.label(item) + ' ' + ItemCapacity.value(entry) + '</em>' : '') +
        /* 医疗品附件和格子 / 详情浮窗同款，挂一条容量 / 次数条 */
        (CapBar.html(entry) ? '<div class="mi-capbar">' + CapBar.html(entry) + '</div>' : '') +
      '</div></div>';
  }
};
