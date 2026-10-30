/* 检查器：选中实体的字段编辑。
 * 只做"改一个字段"这类操作，不参与选择与移动——那些在 editor.js 里按鼠标走。
 * 每次改动都过 history.run，所以每个字段修改是一步撤销。 */
(function (root) {
  'use strict';

  const T = root.EditorTools;

  function field(label, node, hint) {
    const row = document.createElement('div');
    row.className = 'field';
    const k = document.createElement('label');
    k.textContent = label;
    row.appendChild(k);
    row.appendChild(node);
    if (hint) {
      const h = document.createElement('span');
      h.className = 'field-hint';
      h.textContent = hint;
      row.appendChild(h);
    }
    return row;
  }

  function textInput(value, onCommit) {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = value == null ? '' : value;
    el.addEventListener('change', () => onCommit(el.value));
    return el;
  }

  function numberInput(value, onCommit, min, max) {
    const el = document.createElement('input');
    el.type = 'number';
    el.value = value;
    if (min != null) el.min = min;
    if (max != null) el.max = max;
    el.addEventListener('change', () => {
      const n = Number(el.value);
      if (Number.isFinite(n)) onCommit(Math.round(n));
      else el.value = value;
    });
    return el;
  }

  function selectInput(options, value, onCommit) {
    const el = document.createElement('select');
    for (const [v, label] of options) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      if (String(v) === String(value)) o.selected = true;
      el.appendChild(o);
    }
    el.addEventListener('change', () => onCommit(el.value));
    return el;
  }

  function readOnly(text) {
    const el = document.createElement('span');
    el.className = 'ro mono';
    el.textContent = text;
    return el;
  }

  /* opts: { data, sel, commit(label, fn), remove(), rotate() } */
  function render(host, opts) {
    const { data, sel, commit, remove, rotate } = opts;
    host.innerHTML = '';
    const ref = sel ? T.resolve(data, sel) : null;
    if (!sel) {
      host.innerHTML = '<div class="hint">用「选择」工具点一个实体，或按 <kbd>1</kbd> 后点画布。</div>';
      return;
    }
    if (!ref) {
      /* 刚被删掉时选中状态是留着的（为了撤销后能跳回来），这里要说清楚 */
      host.innerHTML = '<div class="hint">这个实体已经不在了。按 <kbd>Ctrl+Z</kbd> 撤销可以把它带回来。</div>';
      return;
    }

    const title = document.createElement('div');
    title.className = 'sel-title';
    const kindName = { container: '容器', prop: '装饰', enemy: '敌人', spawn: '出生点', exit: '撤离点', portal: '门洞', window: '橱窗' }[sel.kind] || sel.kind;
    /* 门 / 窗没有 x/y，只有一组格坐标，位置得从头一格推 */
    const cells = ref.cells || [];
    const posText = ref.x != null
      ? '(' + ref.x + ', ' + ref.y + ')'
      : cells.length ? '(' + cells[0].join(',') + ')' + (cells.length > 1 ? ' +' + (cells.length - 1) : '') : '';
    title.innerHTML = '<span class="sel-kind">' + kindName + '</span>' +
      '<span class="mono">' + escapeHtml(ref.id || '') + '</span>' +
      '<span class="sel-pos mono">' + escapeHtml(posText) + '</span>';
    host.appendChild(title);

    if (sel.kind === 'container') {
      const typeOpts = Object.entries(data.containerTypes).map(([k, v]) => [k, (v.name || k) + '（' + k + '）']);
      host.appendChild(field('类型', selectInput(typeOpts, ref.type, v => commit('改容器类型', d => {
        const e = T.resolve(d, sel); if (e) e.type = v;
      }))));
      host.appendChild(field('偏好', textInput((ref.preference || []).join(','), v => commit('改容器偏好', d => {
        const e = T.resolve(d, sel);
        if (e) e.preference = v.split(/[,\s]+/).filter(Boolean);
      })), '掉落类别，逗号分隔'));
      host.appendChild(field('分区', readOnly(ref.region || '—'), '随位置自动判定'));
    } else if (sel.kind === 'prop') {
      const types = [...new Set(data.props.map(p => p.type))];
      host.appendChild(field('类型', selectInput(types.map(t => [t, t]), ref.type, v => commit('改装饰类型', d => {
        const e = T.resolve(d, sel); if (e) e.type = v;
      }))));
      host.appendChild(field('名称', textInput(ref.name || '', v => commit('改装饰名称', d => {
        const e = T.resolve(d, sel); if (e) e.name = v;
      }))));
      /* 朝向不再直接选：多格家具的朝向和占地是绑在一起的（侧面 = 宽高互换），
       * 分成两个入口必然能选出"侧面 + 竖着占 1×2"这种贴图与占格打架的组合。
       * 只留一个旋转入口，贴图和占地就永远一致。 */
      const fp = ref.footprint || [1, 1];
      const multi = fp[0] * fp[1] > 1;
      const faceRow = document.createElement('div');
      faceRow.className = 'spin-row';
      const faceText = document.createElement('span');
      faceText.className = 'ro mono';
      faceText.textContent = FACING_NAME[ref.facing] || FACING_NAME.front;
      const spin = document.createElement('button');
      spin.type = 'button';
      spin.className = 'spin-btn';
      spin.textContent = '↻ 转 90°';
      spin.title = '快捷键 R';
      if (rotate) spin.addEventListener('click', rotate);
      faceRow.appendChild(faceText);
      faceRow.appendChild(spin);
      host.appendChild(field('朝向', faceRow,
        multi ? '多格家具每次旋转都会交换占地：' + fp.join('×') + ' ↔ ' + [fp[1], fp[0]].join('×')
              : '正 → 侧 → 背 循环'));
      host.appendChild(field('占地', textInput(fp.join('x'), v => {
        const m = /^(\d+)\s*[x×]\s*(\d+)$/.exec(v.trim());
        if (!m) return;
        commit('改装饰占地', d => {
          const e = T.resolve(d, sel);
          if (e) e.footprint = [Number(m[1]), Number(m[2])];
        });
      }), '宽x高。多格件建议用旋转，手改朝向不会跟着变'));
      host.appendChild(field('分区', readOnly(ref.region || '—')));
    } else if (sel.kind === 'enemy') {
      const opts2 = Object.entries(root.EditorPalette.ENEMY).map(([k, v]) => [k, v.name]);
      host.appendChild(field('类型', selectInput(opts2, ref.type, v => commit('改敌人类型', d => {
        const e = T.resolve(d, sel); if (e) e.type = v;
      }))));
      host.appendChild(field('巡逻半径', numberInput(ref.patrolRadius || 0, v => commit('改巡逻半径', d => {
        const e = T.resolve(d, sel); if (e) e.patrolRadius = v;
      }), 0, 12), '格；与出生点 12 格、撤离点 6 格内不能有敌人'));
      host.appendChild(field('分区', readOnly(ref.region || '—')));
    } else if (sel.kind === 'spawn') {
      host.appendChild(field('名称', textInput(ref.name || '', v => commit('改出生点名称', d => {
        if (d.spawn) d.spawn.name = v;
      }))));
      host.appendChild(field('坐标', readOnly('(' + ref.x + ', ' + ref.y + ')'), '拖动或方向键移动'));
    } else if (sel.kind === 'exit') {
      host.appendChild(field('名称', textInput(ref.name || '', v => commit('改撤离点名称', d => {
        const e = T.resolve(d, sel); if (e) e.name = v;
      }))));
      host.appendChild(field('风险', textInput(ref.risk || '', v => commit('改撤离点风险', d => {
        const e = T.resolve(d, sel); if (e) e.risk = v;
      }))));
      host.appendChild(field('坐标', readOnly('(' + ref.x + ', ' + ref.y + ')')));
    } else if (sel.kind === 'portal') {
      host.appendChild(field('名称', textInput(ref.name || '', v => commit('改门洞名称', d => {
        const e = T.resolve(d, sel); if (e) e.name = v;
      }))));
      host.appendChild(field('类型', selectInput(
        [['door', '门'], ['breach', '破口'], ['gate', '闸门']],
        ref.kind,
        v => commit('改门洞类型', d => { const e = T.resolve(d, sel); if (e) e.kind = v; })
      ), '门会画出木门板，破口只有洞口'));
      host.appendChild(field('连接空间', textInput((ref.connects || []).join(','), v => commit('改门洞连接', d => {
        const e = T.resolve(d, sel);
        if (e) e.connects = v.split(/[,\s]+/).filter(Boolean);
      })), '两侧空间的 id，至少两个'));
      host.appendChild(field('建筑', readOnly(ref.building || '—')));
      host.appendChild(field('宽度', readOnly(cells.length + ' 格'),
        '由格坐标决定。要改宽度就在目标位置重画一扇，不要手改 cells'));
    } else if (sel.kind === 'window') {
      host.appendChild(field('建筑', readOnly(ref.building || '—')));
      host.appendChild(field('可通行', selectInput(
        [['no', '否'], ['yes', '是']],
        ref.walkable ? 'yes' : 'no',
        v => commit('改橱窗可通行', d => { const e = T.resolve(d, sel); if (e) e.walkable = v === 'yes'; })
      )));
      host.appendChild(field('可透视', selectInput(
        [['yes', '是'], ['no', '否']],
        ref.opaque ? 'no' : 'yes',
        v => commit('改橱窗透视', d => { const e = T.resolve(d, sel); if (e) e.opaque = v !== 'yes'; })
      ), '橱窗一般不可通行但能看进去'));
      host.appendChild(field('宽度', readOnly(cells.length + ' 格')));
    }

    const actions = document.createElement('div');
    actions.className = 'sel-actions';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'danger';
    del.textContent = '删除';
    del.disabled = sel.kind === 'spawn' || sel.kind === 'exit';
    if (del.disabled) del.title = '出生点与撤离点只能移动，不能删除';
    del.addEventListener('click', remove);
    actions.appendChild(del);
    host.appendChild(actions);
  }

  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FACING_NAME = { front: '正面', side: '侧面', back: '背面' };

  root.EditorInspector = { render };
})(window);
