/* 新建地图对话框：尺寸 + 模板 → 一份 layout / rules。
 * 生成逻辑全在 shared/map-templates.js（纯函数，node 侧也用它建图），
 * 这里只负责把选项收集起来、把报错显示出来。 */
(function (root) {
  'use strict';

  const Tpl = root.MapTemplates;
  const $ = id => document.getElementById(id);

  const state = {
    sizeId: '48x36',
    width: 48,
    height: 36,
    template: 'blank',
    custom: false,
    idTouched: false,
    titleTouched: false
  };
  let onDone = null;
  let built = false;

  function autoId() {
    return 'untitled-' + state.width + 'x' + state.height;
  }

  function shell() {
    const host = $('newmap');
    host.className = 'modal';
    host.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true" aria-label="新建地图">' +
        '<header class="modal-head"><h2>新建地图</h2><button type="button" class="modal-x" data-act="close" aria-label="关闭">×</button></header>' +
        '<div class="modal-body">' +
          '<div class="fld"><label for="nm-id">地图编号</label>' +
            '<input id="nm-id" type="text" spellcheck="false" placeholder="untitled-48x36">' +
            '<span class="fld-note">只能用小写字母、数字和连字符；它是目录名，也是草稿与校验的键。</span></div>' +
          '<div class="fld"><label for="nm-title">标题</label>' +
            '<input id="nm-title" type="text" placeholder="留空则用编号"></div>' +
          '<div class="fld"><span class="fld-label">尺寸</span>' +
            '<div class="chips" id="nm-sizes"></div>' +
            '<div class="custom-size" id="nm-custom" hidden>' +
              '<input id="nm-w" type="number" min="' + Tpl.MIN_SIZE + '" max="' + Tpl.MAX_SIZE + '" step="1">' +
              '<span>×</span>' +
              '<input id="nm-h" type="number" min="' + Tpl.MIN_SIZE + '" max="' + Tpl.MAX_SIZE + '" step="1">' +
              '<span class="fld-note">' + Tpl.MIN_SIZE + '–' + Tpl.MAX_SIZE + '</span>' +
            '</div></div>' +
          '<div class="fld"><span class="fld-label">模板</span>' +
            '<div class="chips" id="nm-templates"></div>' +
            '<p class="fld-note" id="nm-tpl-note"></p></div>' +
          '<p class="modal-warn" id="nm-warn" hidden></p>' +
        '</div>' +
        '<footer class="modal-foot">' +
          '<button type="button" data-act="close">取消</button>' +
          '<button type="button" class="primary" data-act="create">创建</button>' +
        '</footer>' +
      '</div>';

    host.querySelectorAll('[data-act="close"]').forEach(b => b.addEventListener('click', close));
    host.addEventListener('mousedown', e => { if (e.target === host) close(); });
    host.querySelector('[data-act="create"]').addEventListener('click', submit);
    built = true;
  }

  function renderChips() {
    $('nm-sizes').innerHTML = Tpl.SIZES.map(s =>
      '<button type="button" data-size="' + s.id + '"' + (!state.custom && state.sizeId === s.id ? ' class="on"' : '') + '>' +
      '<b>' + s.label + '</b><i>' + s.note + '</i></button>'
    ).join('') +
      '<button type="button" data-size="custom"' + (state.custom ? ' class="on"' : '') + '><b>自定义</b><i>宽高独立</i></button>';

    $('nm-templates').innerHTML = Tpl.TEMPLATES.map(t =>
      '<button type="button" data-tpl="' + t.id + '"' + (state.template === t.id ? ' class="on"' : '') + '>' +
      '<b>' + t.name + '</b><i>' + t.note + '</i></button>'
    ).join('');

    const tpl = Tpl.TEMPLATES.find(t => t.id === state.template);
    $('nm-tpl-note').textContent = tpl ? tpl.detail : '';
    $('nm-custom').hidden = !state.custom;
    if (state.custom) { $('nm-w').value = state.width; $('nm-h').value = state.height; }
    $('nm-warn').hidden = true;
    $('nm-warn').textContent = '';
  }

  function syncId() {
    if (!state.idTouched) $('nm-id').value = autoId();
  }

  function refreshSizeFromChips() {
    if (state.custom) return;
    const s = Tpl.SIZES.find(s => s.id === state.sizeId);
    if (s) { state.width = s.width; state.height = s.height; }
  }

  function bind() {
    $('nm-id').addEventListener('input', e => {
      state.idTouched = e.target.value.trim() !== '';
      e.target.classList.remove('bad');
    });
    $('nm-title').addEventListener('input', e => { state.titleTouched = e.target.value.trim() !== ''; });

    $('nm-sizes').addEventListener('click', e => {
      const btn = e.target.closest('[data-size]');
      if (!btn) return;
      if (btn.dataset.size === 'custom') {
        state.custom = true;
      } else {
        state.custom = false;
        state.sizeId = btn.dataset.size;
        refreshSizeFromChips();
      }
      renderChips();
      syncId();
    });

    $('nm-w').addEventListener('input', e => { state.width = Number(e.target.value); syncId(); });
    $('nm-h').addEventListener('input', e => { state.height = Number(e.target.value); syncId(); });

    $('nm-templates').addEventListener('click', e => {
      const btn = e.target.closest('[data-tpl]');
      if (!btn) return;
      state.template = btn.dataset.tpl;
      renderChips();
    });

    document.addEventListener('keydown', e => {
      if ($('newmap').hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); }
    });
  }

  function submit() {
    const warn = $('nm-warn');
    let out;
    try {
      out = Tpl.create({
        id: $('nm-id').value,
        title: $('nm-title').value,
        width: state.custom ? Number($('nm-w')) : state.width,
        height: state.custom ? Number($('nm-h')) : state.height,
        template: state.template
      });
    } catch (err) {
      warn.textContent = err.message;
      warn.hidden = false;
      $('nm-id').classList.toggle('bad', /编号/.test(err.message));
      return;
    }
    const cb = onDone;
    close();
    if (cb) cb(out);
  }

  function open(cb) {
    onDone = cb || null;
    if (!built) { shell(); bind(); }
    state.sizeId = '48x36';
    state.width = 48; state.height = 36;
    state.template = 'blank';
    state.custom = false;
    state.idTouched = false;
    state.titleTouched = false;
    $('nm-title').value = '';
    $('nm-id').classList.remove('bad');
    renderChips();
    syncId();
    $('newmap').hidden = false;
    setTimeout(() => $('nm-id').focus(), 30);
  }

  function close() {
    $('newmap').hidden = true;
    onDone = null;
  }

  root.EditorNewMap = { open, close, submit };
})(window);
