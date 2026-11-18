/* ============================================================
   转运区：搬运工具升级
   ------------------------------------------------------------
   负重上限、档位、满载惩罚全部由 CFG.BAG.HAUL 决定（见 common.js 的
   carryLimit / carryTiers）。这里只负责三件事：报价、扣料、刷新。

   材料从**仓库**扣，不从背包扣 —— 升级是据点行为，不是带在身上做的。
   这些工业件本身都有重量，所以「攒材料」这件事会挤占你的负重，
   这也是为什么 0 级只有 45kg 时，攒满 36 件材料要跑好几趟。
   ============================================================ */
const Haul = {
  level() { return haulLevel(); },
  maxLevel() { return CFG.BAG.HAUL.CAP.length - 1; },
  isMax() { return this.level() >= this.maxLevel(); },
  name(lv) { return CFG.BAG.HAUL.NAME[lv == null ? this.level() : lv]; },

  /* 当前等级的实测数值 */
  stats(lv) {
    const H = CFG.BAG.HAUL, i = lv == null ? this.level() : lv;
    return { cap: H.CAP[i], move: H.MOVE[i], noise: H.NOISE[i], name: H.NAME[i] };
  },

  /* 下一级的报价；满级返回 null */
  quote() {
    if (this.isMax()) return null;
    const lv = this.level() + 1, H = CFG.BAG.HAUL;
    return {
      level: lv, name: H.NAME[lv], desc: H.DESC[lv] || '',
      cost: H.COST[lv], mats: H.MATS[lv] || {},
      cap: H.CAP[lv], move: H.MOVE[lv], noise: H.NOISE[lv]
    };
  },

  /* 仓库里每种材料各有几件 */
  have(mats) {
    const out = {};
    for (const id of Object.keys(mats || {})) {
      out[id] = Save.stash.reduce((n, e) => n + (e.id === id ? (e.n || 1) : 0), 0);
    }
    return out;
  },

  /* 能不能升：返回 { ok, why, short:[...] } */
  check() {
    const q = this.quote();
    if (!q) return { ok: false, why: '已经是最高等级' };
    const have = this.have(q.mats);
    const short = [];
    for (const [id, need] of Object.entries(q.mats)) {
      if ((have[id] || 0) < need) short.push({ id, need, got: have[id] || 0 });
    }
    if (Save.credits < q.cost) return { ok: false, why: '信用点不足', short, have };
    if (short.length) {
      const names = short.map(s => (ITEM_BY_ID[s.id]?.name || s.id) + ' ' + s.got + '/' + s.need).join('、');
      return { ok: false, why: '材料不足：' + names, short, have };
    }
    return { ok: true, why: '', short, have, quote: q };
  },

  /* 从仓库扣掉 n 件某物；不够就一件也不扣，返回 false */
  takeFromStash(id, n) {
    const total = Save.stash.reduce((s, e) => s + (e.id === id ? (e.n || 1) : 0), 0);
    if (total < n) return false;
    let left = n;
    for (let i = Save.stash.length - 1; i >= 0 && left > 0; i--) {
      const e = Save.stash[i];
      if (e.id !== id) continue;
      const got = Math.min(left, e.n || 1);
      e.n = (e.n || 1) - got;
      left -= got;
      if (e.n <= 0) Save.stash.splice(i, 1);
    }
    return left === 0;
  },

  upgrade() {
    const r = this.check();
    if (!r.ok) return r;
    const q = r.quote;
    /* 先扣材料再扣钱：材料不够时 check 已经拦住了，这里只是防御 */
    for (const [id, need] of Object.entries(q.mats)) {
      if (!this.takeFromStash(id, need)) return { ok: false, why: '材料扣除失败' };
    }
    Save.credits -= q.cost;
    Save.facilities = Save.facilities || {};
    Save.facilities.haul = q.level;
    Save.save();
    if (typeof Game !== 'undefined' && Game.sfx) Game.sfx('ui');
    return { ok: true, level: q.level, name: q.name };
  },

  /* ---------------- 面板 ---------------- */
  fmt(n) { return '¥' + (n || 0).toLocaleString('en-US'); },

  panelHTML() {
    const cur = this.stats(), q = this.quote(), lv = this.level(), max = this.maxLevel();
    const rows = [
      ['负重上限', cur.cap + ' kg', q ? q.cap + ' kg' : '—'],
      ['满载移速', '×' + cur.move.toFixed(2), q ? '×' + q.move.toFixed(2) : '—'],
      ['满载噪声', '×' + cur.noise.toFixed(2), q ? '×' + q.noise.toFixed(2) : '—']
    ];
    const stat = rows.map(([label, a, b]) => `
      <div style="flex:1;min-width:0;padding:10px 12px;background:var(--sh-panel,#151b1a);border:0.5px solid rgba(255,255,255,.08);border-radius:8px;">
        <small style="display:block;color:#8a9a90;font-size:11px;">${label}</small>
        <b style="font-weight:500;font-size:15px;">${a}${q ? ' <span style="color:#52e8b3">→ ' + b + '</span>' : ''}</b>
      </div>`).join('');

    let matsHTML = '';
    let footHTML = '';
    if (!q) {
      matsHTML = '<p style="color:#8a9a90;font-size:13px;">搬运能力已经到顶。现在满载 78kg 也不会变慢、不会变吵。</p>';
    } else {
      const have = this.have(q.mats);
      const lines = Object.entries(q.mats).map(([id, need]) => {
        const got = have[id] || 0, enough = got >= need;
        const nm = ITEM_BY_ID[id]?.name || id;
        return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:0.5px solid rgba(255,255,255,.06);">
          <span>${nm}</span>
          <b style="font-weight:500;color:${enough ? '#52e8b3' : '#d98b6b'}">${got} / ${need}</b></div>`;
      }).join('');
      matsHTML = `<div style="margin-top:14px;"><small style="display:block;color:#8a9a90;font-size:11px;margin-bottom:6px;">升级材料 · 从仓库扣除</small>${lines}</div>`;

      const chk = this.check();
      const afford = Save.credits >= q.cost;
      footHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;flex-wrap:wrap;">
          <span style="font-size:13px;color:${afford ? '#8a9a90' : '#d98b6b'};">费用 ${this.fmt(q.cost)} · 持有 ${this.fmt(Save.credits)}</span>
          <button data-haul-up class="mb-gold" ${chk.ok ? '' : 'disabled'} style="padding:8px 20px;">${chk.ok ? '升级到 ' + q.name : (chk.why.split('：')[0])}</button>
        </div>
        ${chk.ok ? '' : `<p style="font-size:12px;color:#8a9a90;margin-top:8px;">${chk.why}</p>`}`;
    }

    return `
      <small class="sh-kicker">HAULAGE / 转运区</small>
      <h2>${cur.name} <span style="font-size:13px;font-weight:400;color:#8a9a90;">Lv${lv} / ${max}</span></h2>
      <p>搬运工具决定你能扛多少、扛满时走多快、有多吵。重量上限只是明面数字，
      真正的差别在满载手感：背满还能正常跑、正常潜行的，只有最后一级。</p>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">${stat}</div>
      ${q && q.desc ? `<p style="font-size:13px;color:#8a9a90;margin-top:12px;">下一级 · ${q.name}：${q.desc}</p>` : ''}
      ${matsHTML}
      ${footHTML}`;
  },

  /* 点开面板。演示状态（藏身处原型）只展示，不写存档。 */
  open(demo) {
    const root = typeof Safehouse !== 'undefined' ? Safehouse.root : null;
    const d = root && root.querySelector('dialog');
    if (!d) return;
    const content = d.querySelector('.sh-dialog-content');
    if (demo) {
      content.innerHTML = `
        <small class="sh-kicker">HAULAGE / 转运区（演示）</small>
        <h2>转运区</h2>
        <p>搬运工具决定负重上限与满载手感：0 级 45kg、满载 ×0.75 移速；
        满级 78kg、满载 ×0.88 移速且没有噪声惩罚。正式游戏里材料从仓库扣，这里只做展示。</p>`;
    } else {
      content.innerHTML = this.panelHTML();
      const btn = content.querySelector('[data-haul-up]');
      if (btn) btn.onclick = () => {
        const r = this.upgrade();
        if (!r.ok) { if (typeof Base !== 'undefined') Base.note(r.why, true); return; }
        content.innerHTML = this.panelHTML();
        const again = content.querySelector('[data-haul-up]');
        if (again) again.onclick = btn.onclick;
        if (typeof Safehouse !== 'undefined') Safehouse.refresh();
        if (typeof Base !== 'undefined') { Base.render(); Base.renderStash(); }
      };
    }
    if (!d.open) d.showModal();
  }
};
