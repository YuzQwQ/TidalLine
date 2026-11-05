/* 容器逐件搜索的循环底声（179670 / search_rustle）验收。
   node tools/test-search-loop.js
   覆盖：采样已加载、搜索中循环在播、全部搜完即停、手动搜完一件即停、
   关面板立即停、容器本来就搜完不启用循环；以及整段没有 JS 报错。 */
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert/strict');

let chromium = null;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.log('跳过：本机没装 playwright（npm i -D playwright 后再跑）');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
    await page.waitForFunction(() => typeof Game !== 'undefined' && typeof SFX !== 'undefined');

    await page.evaluate(async () => {
      SFX.init();
      await SFX.load();
      Game.startRun({ ammo: 12, bandage: 1, stone: 0 });
      Game.enemies = [];
      Game.state = 'playing';
      document.getElementById('startVeil').style.display = 'none';
      /* 三件普通物品，站在箱子旁边不会被"走远自动关"打断 */
      window.__box = {
        name: '测试箱', art: 'crate_std',
        x: Game.player.x, y: Game.player.y,
        items: [0, 1, 2].map(() => ({ item: ITEM_BY_ID['heal01'], n: 1 }))
      };
    });

    const loaded = await page.evaluate(() => !!SFX.samples.search_rustle);
    assert(loaded, 'search_rustle 采样应已解码（bundle.js 里要有这一段）');

    /* ---- 1. 打开容器 → 起搜 → 循环在播 ---- */
    const started = await page.evaluate(() => {
      Game.openLoot(window.__box);
      Game.update(1 / 60);          // 循环由局内每帧喂状态驱动
      const L = SFX._searchLoop;
      return {
        searching: !!Game.search,
        active: !!L,
        loop: !!(L && L.s.loop),
        rate: L ? L.s.playbackRate.value : 0,
        id: SFX._boxSfxOf('crate_std')
      };
    });
    assert(started.searching, '打开容器后应立刻开始自动搜第一件');
    assert(started.active, '搜索进行中循环底声应该在播');
    assert(started.loop, '循环底声的 BufferSource 要设 loop=true');
    assert(started.rate > 0.9 && started.rate < 1.1, '起播音高只做轻微抖动');
    assert.equal(started.id, 'search_toolbox', '一次性的材质音不受循环影响');

    /* ---- 2. 搜完三件 → 循环停 ---- */
    const finished = await page.evaluate(() => {
      for (let i = 0; i < 300 && (Game.search || Game.autoSearch); i++) Game.update(0.1);
      return {
        searching: !!Game.search,
        auto: Game.autoSearch,
        known: window.__box.items.map(e => !!e.known),
        active: !!SFX._searchLoop
      };
    });
    assert.deepEqual(finished.known, [true, true, true], '三件都该搜出来');
    assert(!finished.searching && !finished.auto, '自动搜索应已结束');
    assert(!finished.active, '全部搜完循环底声必须停');

    /* ---- 3. 本来就搜完的容器再打开：不该起循环 ---- */
    const reopenedDone = await page.evaluate(() => {
      Game.closeLoot();
      Game.openLoot(window.__box);
      Game.update(1 / 60);
      return { searching: !!Game.search, active: !!SFX._searchLoop };
    });
    assert(!reopenedDone.searching && !reopenedDone.active, '搜完的容器再打开不该有翻找声');

    /* ---- 4. 手动搜一件：搜完即停 ---- */
    const manual = await page.evaluate(() => {
      Game.closeLoot();
      window.__box.items.forEach(e => { e.known = false; });
      Game.openLoot(window.__box);
      Game.startItemSearch(0, true);       // 插队改成手动搜这一件
      Game.update(1 / 60);
      const during = !!SFX._searchLoop;
      for (let i = 0; i < 100 && Game.search; i++) Game.update(0.1);
      return { during, after: !!SFX._searchLoop, auto: Game.autoSearch };
    });
    assert(manual.during, '手动搜一件时循环也该在播');
    assert(!manual.after && !manual.auto, '手动搜完这一件、没有下一件在搜就停');

    /* ---- 5. 搜索途中关面板：立刻停（不等下一帧） ---- */
    const closed = await page.evaluate(() => {
      Game.closeLoot();
      window.__box.items.forEach(e => { e.known = false; });
      Game.openLoot(window.__box);
      Game.update(1 / 60);
      const during = !!SFX._searchLoop;
      Game.closeLoot();
      return { during, after: !!SFX._searchLoop };
    });
    assert(closed.during, '关面板前循环在播');
    assert(!closed.after, 'closeLoot 必须显式掐掉循环（死亡/撤离不走 update）');

    assert.deepEqual(errors, [], '页面不该有 JS 报错：' + errors.join(' | '));
    console.log('OK: 搜索循环底声起搜即播、全部搜完/单件搜完/关面板即停，材质音不受影响');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
