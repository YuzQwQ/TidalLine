/* 校验列表：只渲染，不改数据、不定位（定位交给 editor.js）。
 * 单独成模块的原因：这块要处理"画一笔就重算一次"的高频刷新，
 * 靠签名比对跳过无变化的重绘，否则刷墙时右栏列表会一直闪、滚动位置也会丢。 */
(function (root) {
  'use strict';

  const MAX_SHOW = 60;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function signature(result, active) {
    if (!result) return 'none';
    return result.issues.map(i => i.level + i.rule + i.message + (i.cells ? i.cells.length : 0)).join('|') +
      '#' + (active === null || active === undefined ? '-' : active);
  }

  /* opts: { result, active, rules, onPick(issue, index) }
   * active 是当前聚焦条目的下标，用来画选中态。 */
  function render(host, opts) {
    const result = opts.result;
    const active = opts.active;
    const sig = signature(result, active);
    if (host.dataset.sig === sig) return;
    const keep = host.scrollTop;
    host.dataset.sig = sig;
    /* 本轮可能不再有可点条目，先把上一轮的闭包摘掉，避免指向旧的 result。 */
    host.onclick = null;
    host.onpointerover = null;
    host.onpointerleave = null;

    if (!result) { host.innerHTML = '<div class="hint">—</div>'; return; }

    const errs = result.issues.filter(i => i.level === 'error');
    const warns = result.issues.filter(i => i.level === 'warn');

    if (!result.issues.length) {
      host.innerHTML = '<div class="ok-all">✓ 全部通过（0 错误 / 0 提醒）</div>';
      return;
    }

    const shown = result.issues.slice(0, MAX_SHOW);
    const head = '<div class="issue-sum">' +
      (errs.length ? '<span class="bad">' + errs.length + ' 错误</span>' : '<span class="good">0 错误</span>') +
      (warns.length ? '<span class="warn">' + warns.length + ' 提醒</span>' : '') +
      '</div>';

    host.innerHTML = head + shown.map((i, idx) => {
      const n = i.cells && i.cells.length;
      return '<button type="button" class="issue ' + (i.level === 'error' ? 'err' : 'warn') +
        (idx === active ? ' on' : '') + '" data-i="' + idx + '"' +
        (n ? ' title="点击定位到 ' + i.cells[0].join(', ') + '"' : ' title="这条没有具体格子，只能看描述"') + '>' +
        '<span class="code">' + esc(i.rule) + '</span>' +
        '<span class="msg">' + esc(i.message) + '</span>' +
        (n > 1 ? '<span class="n">' + n + ' 格</span>' : '') +
        '</button>';
    }).join('') + (result.issues.length > MAX_SHOW
      ? '<div class="hint">另有 ' + (result.issues.length - MAX_SHOW) + ' 条未列出</div>' : '');

    host.scrollTop = keep;

    host.onclick = e => {
      const btn = e.target.closest('.issue');
      if (!btn) return;
      const idx = Number(btn.dataset.i);
      const issue = result.issues[idx];
      if (issue && opts.onPick) opts.onPick(issue, idx);
    };

    /* 悬停预览：鼠标划过哪条，画布上就把那几格描出来。
     * 用 pointerover 而不是 mouseover，触控笔也能触发。 */
    host.onpointerover = e => {
      if (!opts.onHover) return;
      const btn = e.target.closest('.issue');
      opts.onHover(btn ? result.issues[Number(btn.dataset.i)] || null : null);
    };
    host.onpointerleave = () => { if (opts.onHover) opts.onHover(null); };
  }

  /* 面板标题旁的一句话。rules.json 的 expect 全 null 时 M1–M6 会全部跳过，
   * 这里必须说清楚，否则用户会以为"没检查"是 bug。 */
  function ruleHint(result, expectCount, checksOn) {
    if (!result) return '';
    const parts = [result.checks.length + ' 条规则'];
    if (checksOn) parts.push(expectCount + ' 项预期');
    else parts.push('本图规则未设定');
    return parts.join(' · ');
  }

  root.EditorIssues = { render, ruleHint, MAX_SHOW };
})(window);
