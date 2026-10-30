/* 编辑器自测：打开 index.html?selftest=1 触发。
 * 走的是真实事件路径（pointerdown/move/up + keydown），不是直接调函数，
 * 因为要验的正是"鼠标 → 工具 → 数据"这一段接线。
 * 每条断言独立；跑完把 data 还原，不留痕迹。 */
(function (root) {
  'use strict';

  const Core = root.MapCore, T = root.EditorTools;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const results = [];
  let pass = 0, fail = 0;

  function ok(name, cond, extra) {
    if (cond) { pass++; results.push({ s: 'ok', name }); }
    else { fail++; results.push({ s: 'fail', name, extra: extra === undefined ? '' : String(extra) }); }
  }

  function panel() {
    const box = document.createElement('div');
    box.id = 'selftest';
    box.innerHTML = '<div class="st-head">自测 · M3</div><div class="st-body"></div>';
    document.body.appendChild(box);
    const style = document.createElement('style');
    style.textContent = `
      #selftest{position:fixed;left:12px;bottom:12px;max-height:64vh;width:430px;overflow:auto;z-index:99;
        background:rgba(12,32,28,.95);color:#dcece3;border:1px solid #3a6357;border-radius:6px;
        font:11px/1.7 Consolas,monospace;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
      #selftest .st-head{font-weight:600;color:#9fe0c2;margin-bottom:6px}
      #selftest .row{display:flex;gap:6px;border-bottom:1px dashed rgba(255,255,255,.08);padding:1px 0}
      #selftest .row.fail{color:#ffb4a2}
      #selftest .row b{flex:0 0 14px}
      #selftest .sum{margin-top:6px;font-weight:600}`;
    document.head.appendChild(style);
    return box;
  }

  const canvas = () => document.getElementById('map');
  function toClient(x, y) {
    const s = root.__editor.store.get();
    const m = s.view;
    const [sx, sy] = Core.project(x, y, s.rot, s.data.width, s.data.height);
    const r = canvas().getBoundingClientRect();
    return { clientX: r.left + m.ox + sx * m.tile + m.tile / 2, clientY: r.top + m.oy + sy * m.tile + m.tile / 2 };
  }
  function fire(type, x, y) {
    const p = toClient(x, y);
    canvas().dispatchEvent(new PointerEvent(type, Object.assign({
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1
    }, p)));
  }
  const click = (x, y) => { fire('pointerdown', x, y); fire('pointerup', x, y); };
  function key(k, extra) {
    document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, extra || {})));
  }
  function pick(cat, keyName) {
    const btn = document.querySelector('.cat[data-cat="' + cat + '"] .cat-item[data-key="' + cat + ':' + keyName + '"]');
    if (!btn) return false;
    btn.click();
    return true;
  }

  /* 找一块 3×2 全是 "." 且没有实体的空地，所有地形测试都在它上面做 */
  function findBlock(data, w, h) {
    for (let y = 1; y < data.height - h - 1; y++) {
      for (let x = 1; x < data.width - w - 1; x++) {
        let good = true;
        for (let dy = 0; dy < h && good; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (Core.terrainAt(data, x + dx, y + dy) !== '.' || T.entityAt(data, x + dx, y + dy)) { good = false; break; }
          }
        }
        if (good) return { x, y };
      }
    }
    return null;
  }

  /* 找一面"能开门"的墙：本身是 #、没有实体、且横或竖有一对可通行且空着的邻居
   * （站着家具的格子过不去，placePortal 会拒绝） */
  function findDoorWall(data) {
    const clear = (x, y) => Core.isWalkableTerrain(data, x, y) && !T.entityAt(data, x, y);
    for (let y = 1; y < data.height - 1; y++) {
      for (let x = 1; x < data.width - 1; x++) {
        if (Core.terrainAt(data, x, y) !== '#') continue;
        if (T.entityAt(data, x, y)) continue;
        if ((clear(x - 1, y) && clear(x + 1, y)) || (clear(x, y - 1) && clear(x, y + 1))) return { x, y };
      }
    }
    return null;
  }

  /* 找一格室外空地，且右邻也空——用于验证方向键真的能挪动 */
  function findFreeWithRight(data) {
    for (let y = 2; y < data.height - 2; y++) {
      for (let x = 2; x < data.width - 3; x++) {
        if (T.placementProblem(data, x, y, 1, 1, null)) continue;
        if (T.placementProblem(data, x + 1, y, 1, 1, null)) continue;
        return { x, y };
      }
    }
    return null;
  }

  async function run() {
    try { await main(); }
    catch (err) {
      ok('自测过程无异常', false, err && err.message);
      root.__selftest = { pass, fail, results };
      const box = document.getElementById('selftest');
      if (box) box.querySelector('.st-body').innerHTML = results.map(r =>
        '<div class="row ' + r.s + '"><b>' + (r.s === 'ok' ? '✓' : '✗') + '</b><span>' + r.name +
        (r.extra ? ' — ' + r.extra : '') + '</span></div>').join('') +
        '<div class="sum">' + pass + ' 通过 / ' + fail + ' 失败</div>';
      console.error(err);
    }
  }

  async function main() {
    const E = root.__editor;
    const S = () => E.store.get();

    for (let i = 0; i < 80 && !S().data; i++) await sleep(100);
    const box = panel();
    const body = box.querySelector('.st-body');
    const draw = () => {
      body.innerHTML = results.map(r =>
        '<div class="row ' + r.s + '"><b>' + (r.s === 'ok' ? '✓' : '✗') + '</b><span>' + r.name +
        (r.extra ? ' — ' + r.extra : '') + '</span></div>').join('') +
        '<div class="sum">' + pass + ' 通过 / ' + fail + ' 失败</div>';
    };
    const finish = () => {
      draw();
      root.__selftest = { pass, fail, results };
      console.log('[selftest]', pass, '通过 /', fail, '失败');
    };

    if (!S().data) { ok('地图已载入', false); return finish(); }

    /* 等左栏真的渲染出来——数据到位与调色板渲染之间差一个 40ms 的去抖 */
    for (let i = 0; i < 40 && !document.querySelector('.cat[data-cat="ground"] .cat-item'); i++) await sleep(50);

    const original = Core.serialize(S().data);
    /* 不写死容器数：设计稿会一直改，这里只验"确实载入了有内容的图" */
    ok('地图已载入', S().data.containers.length > 0 && S().data.enemies.length > 0,
      S().data.containers.length + ' 容器 / ' + S().data.enemies.length + ' 敌人');
    ok('调色板已渲染', !!document.querySelector('.cat[data-cat="ground"] .cat-item'));
    ok('初始校验 0 错误', S().result.counts.errors === 0, S().result.counts.errors);
    ok('初始未标记修改', S().dirty === false);

    /* ---------- 1. 选材质自动切工具 ---------- */
    ok('分类里有地面条目', pick('ground', '#'));
    ok('拿起了地形材质', !!(S().material && S().material.kind === 'terrain' && S().material.ch === '#'));
    ok('选材质后自动切到画笔', S().tool === 'brush', S().tool);

    const blk = findBlock(S().data, 3, 2);
    ok('找到 3×2 的测试空地', !!blk, blk ? blk.x + ',' + blk.y : 'none');
    if (!blk) return finish();
    const at = (dx, dy) => Core.terrainAt(S().data, blk.x + dx, blk.y + dy);

    /* ---------- 2. 画笔 ---------- */
    click(blk.x, blk.y);
    ok('画笔把空地刷成墙', at(0, 0) === '#', at(0, 0));
    ok('刷完标记未保存', S().dirty === true);

    /* ---------- 3. 撤销 / 重做 ---------- */
    key('z', { ctrlKey: true });
    ok('撤销还原地形', at(0, 0) === '.', at(0, 0));
    key('z', { ctrlKey: true, shiftKey: true });
    ok('重做又变回墙', at(0, 0) === '#', at(0, 0));
    key('z', { ctrlKey: true });

    /* ---------- 4. 拖拽连刷 = 一步撤销 ---------- */
    fire('pointerdown', blk.x, blk.y);
    fire('pointermove', blk.x + 1, blk.y);
    fire('pointerup', blk.x + 1, blk.y);
    ok('拖拽连续刷了两格', at(0, 0) === '#' && at(1, 0) === '#', at(0, 0) + at(1, 0));
    key('z', { ctrlKey: true });
    ok('一次拖拽只占一步撤销', at(0, 0) === '.' && at(1, 0) === '.', at(0, 0) + at(1, 0));

    /* ---------- 5. 矩形 ---------- */
    E.setTool('rect');
    fire('pointerdown', blk.x, blk.y);
    fire('pointermove', blk.x + 2, blk.y + 1);
    const pv = S().preview;
    ok('拖矩形时有预览', !!(pv && pv.rect && pv.rect[2] === blk.x + 2 && pv.rect[3] === blk.y + 1));
    fire('pointerup', blk.x + 2, blk.y + 1);
    let filled = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) if (at(dx, dy) === '#') filled++;
    ok('松手后整块 6 格填满', filled === 6, filled);
    key('z', { ctrlKey: true });
    ok('矩形一步撤销干净', at(0, 0) === '.' && at(2, 1) === '.', at(0, 0) + at(2, 1));

    /* ---------- 6. 油漆桶 ---------- */
    E.setTool('bucket');
    const beforeFill = Core.serialize(S().data);
    click(blk.x, blk.y);
    ok('油漆桶改了地形', Core.serialize(S().data) !== beforeFill);
    key('z', { ctrlKey: true });
    ok('油漆桶一步撤销干净', Core.serialize(S().data) === beforeFill);

    /* ---------- 7. 放置容器 ---------- */
    ok('分类里有容器类型', pick('container', 'type.N'));
    ok('拿起了容器材质', !!(S().material && S().material.kind === 'container' && S().material.type === 'N'));
    const before7 = S().data.containers.length;
    const spot = findFreeWithRight(S().data);
    E.setTool('brush');
    if (spot) {
      click(spot.x, spot.y);
      ok('放下一个容器', S().data.containers.length === before7 + 1, S().data.containers.length);
      const placed = S().data.containers[S().data.containers.length - 1];
      ok('新容器自动填分区', placed.region === T.regionAt(S().data, spot.x, spot.y), placed.region);
      ok('新容器自动填偏好', Array.isArray(placed.preference) && placed.preference.length > 0, JSON.stringify(placed.preference));
      ok('放完自动选中', !!(S().selection && S().selection.id === placed.id), JSON.stringify(S().selection));
      await sleep(80);
      ok('检查器显示选中项', !!document.querySelector('#inspector .sel-title'));

      const placedX = placed.x;
      const selX = () => { const e = T.resolve(S().data, S().selection); return e ? e.x : null; };
      E.setTool('select');   // 画笔状态下按住只会再放一个，拖动要用选择工具
      /* 拖动移动：按住实体拖到右邻格，应该跟手且只占一步撤销 */
      fire('pointerdown', spot.x, spot.y);
      fire('pointermove', spot.x + 1, spot.y);
      fire('pointerup', spot.x + 1, spot.y);
      ok('拖动把实体挪到右邻格', selX() === placedX + 1, selX());
      fire('pointerdown', spot.x + 1, spot.y);
      fire('pointermove', spot.x, spot.y);
      fire('pointerup', spot.x, spot.y);
      ok('再拖回原格', selX() === placedX, selX());
      key('z', { ctrlKey: true });
      ok('两次拖动 = 两步撤销', selX() === placedX + 1, selX());
      key('z', { ctrlKey: true, shiftKey: true });
      ok('重做回到原格', selX() === placedX, selX());

      key('ArrowRight');
      const moved = T.resolve(S().data, S().selection);
      ok('方向键把实体挪了一格', !!(moved && moved.x === placedX + 1), moved ? moved.x + ' vs ' + (placedX + 1) : 'null');
      key('ArrowLeft');

      key('Delete');
      ok('Delete 删掉选中容器', S().data.containers.length === before7, S().data.containers.length);
      key('z', { ctrlKey: true });
      ok('撤销把容器放回来', S().data.containers.length === before7 + 1, S().data.containers.length);
      key('z', { ctrlKey: true, shiftKey: true });
      ok('重做又删掉', S().data.containers.length === before7, S().data.containers.length);
      key('z', { ctrlKey: true });
      key('Delete');
      ok('清理测试容器', S().data.containers.length === before7, S().data.containers.length);
    }

    /* ---------- 8. 放置敌人 ---------- */
    pick('enemy', 'enemy.scav');
    const before8 = S().data.enemies.length;
    const spot2 = findFreeWithRight(S().data);
    if (spot2) {
      click(spot2.x, spot2.y);
      ok('放下一个敌人', S().data.enemies.length === before8 + 1, S().data.enemies.length);
      key('z', { ctrlKey: true });
      ok('撤销敌人', S().data.enemies.length === before8, S().data.enemies.length);
    }

    /* ---------- 9. 橡皮 ---------- */
    pick('ground', '#');
    E.setTool('brush');
    click(blk.x, blk.y);
    ok('重新刷成墙以便测试橡皮', at(0, 0) === '#', at(0, 0));
    E.setTool('erase');
    click(blk.x, blk.y);
    ok('橡皮把墙刷回地板', at(0, 0) === '.', at(0, 0));
    key('z', { ctrlKey: true });

    /* ---------- 10. 序列化往返 ---------- */
    const text = Core.serialize(S().data);
    const parsed = JSON.parse(text);
    ok('序列化不含 routes', !('routes' in parsed));
    ok('序列化幂等', Core.serialize(parsed) === text);
    ok('字段数与初始一致', Object.keys(parsed).length === Object.keys(JSON.parse(original)).length,
      Object.keys(parsed).length + ' vs ' + Object.keys(JSON.parse(original)).length);

    /* ---------- 11. 配额同步（把"置坏"也走历史，收尾才能干净回到原图） ---------- */
    E.history.run('测试置坏配额', d => { d.quotas.containers = -1; });
    document.getElementById('btn-quotas').click();
    ok('同步配额改回实际数量', S().data.quotas.containers === S().data.containers.length, S().data.quotas.containers);
    key('z', { ctrlKey: true });
    ok('同步配额可撤销', S().data.quotas.containers === -1, S().data.quotas.containers);

    /* ---------- 12. 收尾 ---------- */
    let guard = 0;
    while (E.history.canUndo && guard++ < 200) key('z', { ctrlKey: true });
    await sleep(250);
    ok('全部撤销后与初始图逐字节一致', Core.serialize(S().data) === original);

    /* ---------- 13. 校验条目 → 画布定位 ---------- */
    const originalRules = S().rules;
    const brokeId = S().data.containers[0].id;
    E.history.run('测试制造 G3 错误', d => { d.containers[0].x = 0; d.containers[0].y = 0; });
    E.validateNow();          // 直接走 history 不会触发去抖校验，这里手动算一次
    await sleep(120);
    const g3 = [...document.querySelectorAll('#issues .issue')].find(b => b.querySelector('.code').textContent === 'G3');
    ok('破坏后列表里出现 G3', !!g3);
    if (g3) {
      g3.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      ok('悬停条目时画布有预览', !!(S().issueHover && S().issueHover.cells.length), JSON.stringify(S().issueHover));
      document.getElementById('issues').dispatchEvent(new PointerEvent('pointerleave'));
      ok('移开鼠标预览消失', S().issueHover === null);

      g3.click();
      await sleep(90);        // 侧栏刷新有 40ms 去抖，选中态不会同步出现
      const f = S().issueFocus;
      ok('点条目后画布有焦点格子', !!(f && f.cells && f.cells.length), JSON.stringify(f));
      ok('焦点带规则编号', !!(f && f.rule === 'G3'), f && f.rule);
      ok('条目进入选中态', !!document.querySelector('#issues .issue.on'));
      ok('焦点把视图移到了问题处', !!(S().autoFit === false));
      ok('问题带实体时自动选中它', !!(S().selection && S().selection.id === brokeId),
        JSON.stringify(S().selection) + ' vs ' + brokeId);
    }
    ok('有问题时状态栏是红的', document.getElementById('status').classList.contains('bad'));
    key('z', { ctrlKey: true });
    await sleep(260);
    ok('改回去以后焦点自动收起', S().issueFocus === null, JSON.stringify(S().issueFocus));
    ok('改回去以后回到 0 错误', S().result.counts.errors === 0, S().result.counts.errors);

    /* ---------- 14. 门可选中 / 可编辑 / 可删除 ---------- */
    const door = S().data.portals.find(p => p.id === 'apartment.living-w');
    ok('测试用的门存在且占两格', !!(door && door.cells.length === 2), door && door.cells.length);
    const [dx, dy] = door.cells[1];          // 故意点第二格：多格门任意一格都该命中
    const terrBefore = Core.terrainAt(S().data, dx, dy);

    E.setTool('select');
    click(dx, dy);
    await sleep(80);
    ok('点门的第二格能选中',
      S().selection && S().selection.kind === 'portal' && S().selection.id === 'apartment.living-w',
      JSON.stringify(S().selection));

    const insp = document.getElementById('inspector');
    ok('检查器显示"门洞"', insp.textContent.includes('门洞'), insp.textContent.slice(0, 50));
    ok('检查器没把格坐标渲染成 undefined', !insp.textContent.includes('undefined'), insp.textContent.slice(0, 80));

    const pname = insp.querySelector('input');
    ok('门有可编辑的名称框', !!pname);
    if (pname) {
      pname.value = '客厅侧门A';
      pname.dispatchEvent(new Event('change'));
      await sleep(80);
      ok('改名称写进了数据', (S().data.portals.find(p => p.id === 'apartment.living-w') || {}).name === '客厅侧门A');
    }

    const pkind = insp.querySelector('select');
    ok('门有类型下拉', !!pkind);
    if (pkind) {
      pkind.value = 'breach';
      pkind.dispatchEvent(new Event('change'));
      await sleep(80);
      ok('改类型写进了数据', (S().data.portals.find(p => p.id === 'apartment.living-w') || {}).kind === 'breach');
    }

    /* 门没有 x/y，方向键与拖动都不该把它挪走 */
    const cellsBefore = JSON.stringify(S().data.portals.find(p => p.id === 'apartment.living-w').cells);
    key('ArrowRight');
    await sleep(80);
    ok('方向键不挪动门',
      JSON.stringify(S().data.portals.find(p => p.id === 'apartment.living-w').cells) === cellsBefore,
      JSON.stringify(S().data.portals.find(p => p.id === 'apartment.living-w').cells));

    key('Delete');
    await sleep(100);
    ok('Delete 删掉了门', !S().data.portals.some(p => p.id === 'apartment.living-w'));
    ok('原地补成了墙', Core.terrainAt(S().data, dx, dy) === '#', Core.terrainAt(S().data, dx, dy));
    ok('另一格也补成了墙', Core.terrainAt(S().data, door.cells[0][0], door.cells[0][1]) === '#',
      Core.terrainAt(S().data, door.cells[0][0], door.cells[0][1]));

    key('z', { ctrlKey: true });
    await sleep(140);
    ok('撤销把门带回来了', !!S().data.portals.find(p => p.id === 'apartment.living-w'));
    ok('撤销把地形也带回来了', Core.terrainAt(S().data, dx, dy) === terrBefore, Core.terrainAt(S().data, dx, dy));

    /* 只删不加的话，删掉的洞就补不回来了 */
    const wall = findDoorWall(S().data);
    ok('找到一面能开门的墙', !!wall, JSON.stringify(wall));
    if (wall) {
      E.setTool('brush');
      pick('structure', 'portal.door');
      await sleep(80);
      ok('从调色板拿起了门洞', S().material && S().material.kind === 'portal', JSON.stringify(S().material));
      click(wall.x, wall.y);
      await sleep(140);
      const made = S().data.portals.find(p => p.cells.some(c => c[0] === wall.x && c[1] === wall.y));
      ok('点墙开出了一扇门', !!made, JSON.stringify(made));
      ok('地形改成门洞字符', Core.terrainAt(S().data, wall.x, wall.y) === '+', Core.terrainAt(S().data, wall.x, wall.y));
      ok('连接空间是自动推出来的', !!(made && made.connects && made.connects.length === 2),
        made && JSON.stringify(made.connects));
      E.validateNow();
      await sleep(140);
      ok('新门没有引入校验错误', S().result.counts.errors === 0, S().result.counts.errors);
      ok('开门后自动选中了它', !!(S().selection && S().selection.kind === 'portal'), JSON.stringify(S().selection));

      /* 再点墙上一格（此时是 +，不是墙）应该被拒绝 */
      const res = T.place(S().data, { kind: 'portal', portalKind: 'door', label: '门洞' }, wall.x, wall.y);
      ok('同一格不能开第二扇门', res.ok === false, JSON.stringify(res));
    }
    E.select(null);

    /* ---------- 15. 新建地图 ---------- */
    const realConfirm = root.confirm;
    root.confirm = () => true;
    document.getElementById('btn-new').click();
    ok('新建对话框打开了', document.getElementById('newmap').hidden === false);
    ok('默认编号按尺寸生成', document.getElementById('nm-id').value === 'untitled-48x36',
      document.getElementById('nm-id').value);
    ok('三个尺寸预设都在', document.querySelectorAll('#nm-sizes [data-size]').length === 4);
    ok('三个模板都在', document.querySelectorAll('#nm-templates [data-tpl]').length === 3);

    /* 先试一个越界尺寸：应该只报错、不关窗 */
    document.querySelector('#nm-sizes [data-size="custom"]').click();
    document.getElementById('nm-w').value = '20';
    document.getElementById('nm-w').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#newmap [data-act="create"]').click();
    ok('越界尺寸被拦住', document.getElementById('nm-warn').hidden === false);
    ok('报错后对话框不关', document.getElementById('newmap').hidden === false);

    document.querySelector('#nm-sizes [data-size="64x48"]').click();
    document.querySelector('#nm-templates [data-tpl="building"]').click();
    document.querySelector('#newmap [data-act="create"]').click();
    root.confirm = realConfirm;

    const nd = S().data;
    ok('对话框已关闭', document.getElementById('newmap').hidden === true);
    ok('新图尺寸是 64×48', nd.width === 64 && nd.height === 48, nd.width + '×' + nd.height);
    ok('新图带了一栋建筑', nd.buildings.length === 1 && nd.rooms.length === 5, nd.buildings.length + '/' + nd.rooms.length);
    ok('新图预置容器类型', Object.keys(nd.containerTypes).length === 25, Object.keys(nd.containerTypes).length);
    ok('新图没有容器和敌人', nd.containers.length === 0 && nd.enemies.length === 0);
    ok('新图规则未设定', Object.values(S().rules.expect).every(v => v === null));
    ok('新图 0 错误', S().result.counts.errors === 0, S().result.counts.errors);
    ok('新图标记未保存', S().dirty === true);
    ok('面板写明规则未设定', /本图规则未设定/.test(document.getElementById('rule-count').textContent),
      document.getElementById('rule-count').textContent);

    await sleep(120);
    const propTypes = document.querySelectorAll('#palette .cat[data-cat="prop"] .cat-item').length;
    ok('新图调色板里有家具可放', propTypes >= 10, propTypes);
    ok('新图能选到容器类型', !!document.querySelector('#palette .cat[data-cat="container"] .cat-item'));

    /* 撤销不该回到旧图（apply 清了历史），但也不该崩 */
    ok('新建后历史被清空', E.history.canUndo === false);

    /* ---------- 14b. 家具朝向自动推导 ---------- */
    ok('调色板里有家具类型', pick('prop', 'prop.barrel'));
    ok('拿起了家具材质', !!(S().material && S().material.kind === 'prop'), JSON.stringify(S().material));
    E.setTool('brush');
    /* 新图主楼 NW 房，格子 (25,17)：上方是外墙、左右都是地板 → back */
    click(25, 17);
    const back = S().data.props.find(p => p.x === 25 && p.y === 17);
    ok('顶着上墙的家具朝里', !!(back && back.facing === 'back'), back && back.facing);
    /* (21,19)：左边是外墙 → side（左右贴墙优先于上方） */
    click(21, 19);
    const side = S().data.props.find(p => p.x === 21 && p.y === 19);
    ok('贴着侧墙的家具改成侧向', !!(side && side.facing === 'side'), side && side.facing);
    /* 屋子正中什么都不挨 → 不写 facing，序列化里就不该出现这个字段 */
    click(25, 19);
    const front = S().data.props.find(p => p.x === 25 && p.y === 19);
    ok('不挨墙的家具保持正面且不写字段', !!(front && front.facing === undefined), front && front.facing);

    /* ---------- 14c. 多格贴图与 R 旋转 ---------- */
    const Art = root.MapArtMap;
    ok('两格家具用放大贴图', Art.propVariant({ type: 'bed', footprint: [1, 2] }, 'front') === 'bed_home_large',
      Art.propVariant({ type: 'bed', footprint: [1, 2] }, 'front'));
    ok('转过来用横版放大贴图', Art.propVariant({ type: 'bed', footprint: [2, 1] }, 'side') === 'bed_home_large_side',
      Art.propVariant({ type: 'bed', footprint: [2, 1] }, 'side'));

    E.history.apply('放床', d => T.place(d, { kind: 'prop', type: 'bed', label: '床', name: '床', footprint: [1, 2] }, 27, 17));
    const bed = S().data.props[S().data.props.length - 1];
    E.select({ kind: 'prop', id: bed.id });
    E.setTool('select');
    ok('床初始是 1×2', bed.footprint.join('×') === '1×2', bed.footprint.join('×'));
    ok('顶着上墙自动朝里', bed.facing === 'back', bed.facing);

    const bedNow = () => T.resolve(S().data, { kind: 'prop', id: bed.id });
    const rot0 = S().rot;
    key('r');
    await sleep(60);
    ok('R 把床转成 2×1', bedNow().footprint.join('×') === '2×1', bedNow().footprint.join('×'));
    ok('转过来朝向变侧面', bedNow().facing === 'side', bedNow().facing);
    ok('转家具不动视角', S().rot === rot0, S().rot + ' vs ' + rot0);
    ok('旋转可撤销', E.history.canUndo);
    key('z', { ctrlKey: true });
    ok('撤销后回到 1×2', bedNow().footprint.join('×') === '1×2', bedNow().footprint.join('×'));
    key('z', { ctrlKey: true, shiftKey: true });
    ok('重做又变回 2×1', bedNow().footprint.join('×') === '2×1', bedNow().footprint.join('×'));

    key('r');
    await sleep(60);
    ok('再转一次转回 1×2', bedNow().footprint.join('×') === '1×2', bedNow().footprint.join('×'));
    ok('两圈之后朝向回归正面', bedNow().facing === undefined, bedNow().facing);

    /* 单格件：占地不变，朝向 正 → 侧 → 背 → 正 */
    const barrel = S().data.props.find(p => p.x === 25 && p.y === 17);
    E.select({ kind: 'prop', id: barrel.id });
    ok('单格桶初始朝向不是正面', barrel.facing === 'back', barrel.facing);
    key('r');
    await sleep(60);
    const bNow = () => T.resolve(S().data, { kind: 'prop', id: barrel.id });
    ok('单格件背 → 正', bNow().facing === undefined && bNow().footprint.join('×') === '1×1', bNow().facing);
    key('r');
    ok('单格件正 → 侧', bNow().facing === 'side', bNow().facing);
    key('r');
    ok('单格件侧 → 背', bNow().facing === 'back', bNow().facing);

    /* 容器转不动，也不该顺手把视角转了 */
    E.history.apply('放箱', d => T.place(d, { kind: 'container', type: 'L', label: '储物柜' }, 29, 19));
    const crate = S().data.containers[S().data.containers.length - 1];
    E.select({ kind: 'container', id: crate.id });
    const rotBefore = S().rot;
    key('r');
    await sleep(60);
    ok('容器拒绝旋转', S().rot === rotBefore && S().data.containers.some(c => c.id === crate.id));
    ok('容器没有被改动', !('facing' in crate) && !crate.footprint, JSON.stringify(crate));

    /* 没有选中时 R 仍是转视角 */
    E.select(null);
    key('r');
    await sleep(60);
    ok('空选时 R 转视角', S().rot === (rotBefore + 90) % 360, S().rot);
    ok('转视角后家具图上仍按屏幕方向取变体',
      Art.propVariant({ type: 'bed', footprint: [1, 2] }, Art.screenFacing('front', S().rot)) === 'bed_home_large_side',
      Art.screenFacing('front', S().rot));
    E.store.set({ rot: 0 });
    E.fit();

    /* ---------- 16. 贴图重载 ---------- */
    /* 三层缓存任何一层没清，表现都是"改了图没反应"。这里逐层验。 */
    const imBefore = E.Render.image('tiles', 'wall');
    const stampBefore = E.Render.assetStamp;
    ok('贴图 URL 带版本戳（绕开浏览器启发式缓存）', /[?#]v=\d+$/.test(imBefore.src), imBefore.src);

    key('r', { altKey: true });
    await sleep(140);
    ok('Alt+R 换掉版本戳', E.Render.assetStamp !== stampBefore, stampBefore + ' → ' + E.Render.assetStamp);

    const imAfter = E.Render.image('tiles', 'wall');
    ok('重载后同一张贴图换了对象（内存缓存已清）', imAfter !== imBefore);
    ok('新 URL 与旧 URL 不同', imAfter.src !== imBefore.src, imAfter.src);
    ok('重载不清"缺图"以外的状态：版本戳是数字',
      typeof E.Render.assetStamp === 'number' && E.Render.assetStamp > 0);

    const probedFirst = await E.Render.probeAssets();
    ok('首次探测只建基线、不重载', probedFirst === false, String(probedFirst));

    /* ---------- 17. 还原并收尾 ---------- */
    E.apply({ data: JSON.parse(original), rules: originalRules, source: '还原' }, { silent: true });
    await sleep(200);
    ok('还原后与初始图逐字节一致', Core.serialize(S().data) === original);

    finish();  }

  root.__selftestRun = run;
})(window);
