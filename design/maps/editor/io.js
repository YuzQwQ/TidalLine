/* 读取与写盘。
 * 读：fetch（需要 http/localhost）→ 失败时由界面提示拖入 JSON。
 * 写：File System Access API 直接写回原文件；不支持时退回下载 Blob。
 * 草稿：localStorage 自动存一份，崩溃或误关后可以恢复。 */
(function (root) {
  'use strict';

  const DIR = '../linhai-old-quarter/';
  const PICKER = {
    suggestedName: 'layout.json',
    types: [{ description: '地图 JSON', accept: { 'application/json': ['.json'] } }]
  };
  const supportsFSA = typeof window.showSaveFilePicker === 'function';

  let handle = null;          // FileSystemFileHandle，保存过一次后复用
  let handleName = '';

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
    return res.json();
  }

  /* ?map=../layout1.json 直接指定打开哪个文件；不带则打开临海路。
   * 路径相对 editor/ 算，rules.json 从同一目录取，取不到就退回"全不检查"的默认值——
   * 这样新图、草稿图不进 design/maps/<id>/ 也能直接看。 */
  function mapTarget() {
    try {
      const q = new URLSearchParams(location.search).get('map');
      return q ? q : DIR + 'layout.json';
    } catch (e) { return DIR + 'layout.json'; }
  }

  async function loadDefault() {
    const file = mapTarget();
    const data = await fetchJson(file);
    let rules = {};
    try { rules = await fetchJson(file.replace(/[^/]*$/, '') + 'rules.json'); } catch (e) { rules = {}; }
    return { data, rules, source: file.replace(/^\.\.\//, '').replace(/^\.\//, '') };
  }

  /* 地图和规则都能拖进来：靠"有没有 rows"区分，够用且不会误判。
   * file:// 下拿不到 rules.json 时，本图专属规则（M1–M6）会退回默认值，
   * 单独拖一次 rules.json 就能补上。 */
  async function readFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const isRules = parsed && !parsed.rows && (parsed.expect || parsed.specialChecks || parsed.enemySpacing);
    if (isRules) return { kind: 'rules', rules: parsed, source: file.name };
    return { kind: 'map', data: parsed, rules: {}, source: file.name };
  }

  function download(text, name) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'layout.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* 写盘必须由用户手势触发（点按钮 / 键盘），否则 picker 会被拦。
   * iframe 或受限上下文里 showSaveFilePicker 会抛 SecurityError，这时退回下载——
   * 用户至少能拿到文件，而不是看到一个红色报错。 */
  async function save(text, opts) {
    const forcePick = !!(opts && opts.pick);
    if (supportsFSA) {
      try {
        if (!handle || forcePick) {
          handle = await window.showSaveFilePicker(PICKER);
          handleName = handle.name || 'layout.json';
        }
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return { mode: 'file', name: handleName };
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;   // 用户主动取消
        handle = null;
        download(text);
        return { mode: 'download', name: 'layout.json', reason: err && err.name };
      }
    }
    download(text);
    return { mode: 'download', name: 'layout.json' };
  }

  function handleInfo() {
    return supportsFSA ? { name: handleName, bound: !!handle } : { name: '', bound: false };
  }

  /* ---------- 草稿 ---------- */
  const DRAFT_PREFIX = 'tide.map.draft.';
  const DRAFT_MAX = 1.6 * 1024 * 1024;

  function writeDraft(mapId, text) {
    try {
      if (text.length > DRAFT_MAX) return false;
      localStorage.setItem(DRAFT_PREFIX + (mapId || 'unknown'), JSON.stringify({ at: Date.now(), text }));
      return true;
    } catch (e) { return false; }
  }

  function readDraft(mapId) {
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + (mapId || 'unknown'));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.text ? parsed : null;
    } catch (e) { return null; }
  }

  function clearDraft(mapId) {
    try { localStorage.removeItem(DRAFT_PREFIX + (mapId || 'unknown')); } catch (e) { /* 忽略 */ }
  }

  root.EditorIO = {
    loadDefault, readFile, save, download, handleInfo, supportsFSA,
    writeDraft, readDraft, clearDraft, DIR
  };
})(window);
