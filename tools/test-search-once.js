/* 容器搜索音：一次交互只响一声，不循环、不再分"开容器"。
     1. 容器表：每个容器都指到一条真的加载了的采样，且不再出现 bag_zip
     2. 撬箱子：读条一开始响一次，读条结束开面板不再响第二声
     3. 已经搜过的箱子直接打开：仍然响一次
     4. 翻尸体：布料声，一次
     5. 循环那套 API 已经拆干净（syncSearchLoop / _searchLoop）
     6. 没配素材的容器不播采样（落回合成兜底）

   跑法：node tools/test-search-once.js */
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--no-proxy-server', '--mute-audio', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  /* 跑多文件版：搜索音是运行时逻辑，和打包无关 */
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '#play');
  await page.waitForFunction(() => Game.state === 'playing' && Game.player);
  await page.waitForFunction(() => Object.keys(SFX.samples || {}).length >= 40, null, { timeout: 40000 });
  await page.waitForTimeout(200);

  /* 录音笔：把每次采样播放都记下来 */
  await page.evaluate(() => {
    window.__hits = [];
    const real = SFX._playSample.bind(SFX);
    SFX._playSample = (id, o) => { window.__hits.push(id); return real(id, o); };
  });

  /* ---------- 1. 表本身 ---------- */
  const table = await page.evaluate(() => {
    const map = SFX.CONTAINER_SFX;
    const keys = Object.keys(map);
    return {
      keys,
      values: [...new Set(Object.values(map))],
      missing: keys.filter(k => !SFX.samples[map[k]]),
      usesZip: keys.filter(k => map[k] === 'bag_zip'),
      objectShaped: Object.values(map).filter(v => v && typeof v === 'object').length,
      /* 每个容器都得有映射：CONTAINER_TYPES 里的 art 全覆盖（尸体单独一条） */
      arts: [...new Set(Object.values(CONTAINER_TYPES).map(t => t.art))],
      api: {
        sync: typeof SFX.syncSearchLoop,
        stop: typeof SFX.stopSearchLoop,
        loopState: typeof SFX._searchLoop
      }
    };
  });
  assert(table.keys.length >= 20, '容器表有 ' + table.keys.length + ' 条');
  assert.deepEqual(table.missing, [], '每个容器都指到一条已加载的采样');
  assert.deepEqual(table.usesZip, [], '容器不再用 bag_zip（那是玩家背包的）');
  assert.equal(table.objectShaped, 0, '每条只剩一个搜索音，没有对象形式的"打开音"');
  /* 允许保险箱这类暂时空着，但已登记的必须覆盖绝大多数容器 */
  const uncovered = table.arts.filter(a => !table.keys.includes(a));
  assert(uncovered.length <= 3, '未配素材的容器不该太多：' + uncovered.join(','));
  assert.equal(table.api.sync, 'undefined', '循环入口已删除');
  assert.equal(table.api.stop, 'undefined', '循环停止入口已删除');
  assert.equal(table.api.loopState, 'undefined', '没有残留的循环状态');

  /* ---------- 2. 撬箱子：交互一次 = 一声 ---------- */
  const first = await page.evaluate(() => {
    const box = Game.boxes.find(b => b.art === 'crate_luggage') || Game.boxes[0];
    Game.closeLoot();
    box.searched = false;
    Game.player.x = box.x; Game.player.y = box.y;
    Game.player.vx = Game.player.vy = 0;
    window.__hits = [];
    Game.handleInteract();                       // 真实交互入口
    const atInteract = [...window.__hits];
    const type = Game.action && Game.action.type;
    if (Game.action) Game.action.t = Game.action.total + 0.01;   // 把读条推完
    Game.update(0.016);
    /* 场上还有敌人开枪，只数搜索这一类的声 */
    const searchOnly = ids => ids.filter(id => /^search_/.test(id));
    return {
      art: box.art, expect: SFX.CONTAINER_SFX[box.art], type,
      atInteract: searchOnly(atInteract), all: searchOnly([...window.__hits]),
      lootOpen: !!Game.lootOpen
    };
  });
  assert.equal(first.type, 'search', '交互开的是撬箱读条');
  assert.deepEqual(first.atInteract, [first.expect], '读条一开始响一声，且是这只容器的声');
  assert.equal(first.all.length, 1, '读条结束开面板不再补一声，实际：' + first.all.join(','));
  assert.equal(first.lootOpen, true, '面板确实打开了');

  /* ---------- 3. 搜过的箱子：直接打开也只响一声 ---------- */
  const reopen = await page.evaluate(() => {
    const box = Game.boxes.find(b => b.art === 'crate_luggage');
    Game.closeLoot();
    box.searched = true;
    Game.player.x = box.x; Game.player.y = box.y;
    Game.player.vx = Game.player.vy = 0;
    window.__hits = [];
    Game.handleInteract();
    const searchOnly = ids => ids.filter(id => /^search_/.test(id));
    return { hits: searchOnly([...window.__hits]), expect: SFX.CONTAINER_SFX[box.art], open: !!Game.lootOpen };
  });
  assert.equal(reopen.open, true, '搜过的箱子直接开面板');
  assert.deepEqual(reopen.hits, [reopen.expect], '直接打开也是这一声，且只有一声');

  /* ---------- 4. 翻尸体：布料声，一次 ---------- */
  const corpse = await page.evaluate(() => {
    Game.closeLoot();
    const e = Game.enemies.find(x => !x.dead) || Game.enemies[0];
    const c = new Corpse(e.x, e.y, e);
    c.opened = false;
    Game.corpses = [c];
    Game.player.x = c.x; Game.player.y = c.y;
    Game.player.vx = Game.player.vy = 0;
    window.__hits = [];
    Game.handleInteract();
    const hits = [...window.__hits];
    if (Game.action) Game.action.t = Game.action.total + 0.01;
    Game.update(0.016);
    const searchOnly = ids => ids.filter(id => /^search_/.test(id));
    return { hits: searchOnly(hits), all: searchOnly([...window.__hits]), expect: SFX.CONTAINER_SFX.corpse };
  });
  assert.deepEqual(corpse.hits, [corpse.expect], '翻尸体响一次布料声');
  assert.equal(corpse.expect, 'search_cloth', '尸体用布料（衣服口袋）');
  assert.equal(corpse.all.length, 1, '开面板不再补一声');

  /* ---------- 5. 没配素材的容器：不播采样 ---------- */
  const silent = await page.evaluate(() => {
    window.__hits = [];
    /* 这只箱子本来就没登记，不该有任何采样声 */
    SFX.play('search', { at: 'crate_trash' });     // 垃圾桶没登记
    return { hits: [...window.__hits], mapped: !!SFX.CONTAINER_SFX.crate_trash };
  });
  assert.equal(silent.mapped, false, '垃圾桶确实没配素材');
  assert.equal(silent.hits.length, 0, '没配素材就不播采样（落回合成音）');

  assert.equal(errs.length, 0, '页面无 JS 报错：' + errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('容器搜索音：一次交互一声 / 不循环 / 不分开箱 / 拉链归背包 / 尸体布料 / 未配不响 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
