/* 容器搜索音：从"每翻一件响一次"改成"整段搜索一段循环，搜完就停"。
   这个测试盯住四件事：
     1. 开始搜 → 起循环，且循环的就是该容器对应材质的那段采样
     2. 自动搜索期间循环不断（逐件之间不重启）
     3. 全部搜完 → 停
     4. 关面板 / 走开 → 立刻停

   跑法：node tools/test-search-loop.js */
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
  /* 跑多文件版而不是单文件版：搜索循环是运行时逻辑，和打包无关，
     用 index.html 还能避免"改完源码忘了 build"导致的假红/假绿。 */
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '#play');
  await page.waitForFunction(() => Game.state === 'playing' && Game.player);
  await page.waitForFunction(() => Object.keys(SFX.samples || {}).length >= 39);
  await page.waitForTimeout(300);

  /* 挑一个"配了搜索采样"的容器：没配素材的容器（比如 crate_heavy）走合成兜底，
     本来就不该循环 —— 那不是这条用例要验的路径 */
  await page.evaluate(() => {
    window.__pickBox = () => Game.boxes.find(b =>
      SFX.BOX_SFX[b.art] && SFX.BOX_SFX[b.art].search &&
      (b.items || []).some(e => e && e.item)) || null;
  });

  /* ---------- 1. 打开容器就开始循环 ---------- */
  const p1 = await page.evaluate(async () => {
    Game.closeLoot();
    const box = window.__pickBox();
    if (!box) return { skip: true };
    box.searched = false;
    /* 回归到"一次都没搜过"：条目默认 known 可能是 true（之前搜过） */
    (box.items || []).forEach(e => { if (e && e.item) e.known = false; });
    /* 站到箱子边上：面板有"走远 70px 自动关"的跟随检查 */
    Game.player.x = box.x; Game.player.y = box.y;
    Game.openLoot(box);
    await new Promise(r => setTimeout(r, 120));
    const L = SFX._searchLoop;
    return {
      at: SFX._searchLoopAt,
      hasLoop: !!L,
      loopFlag: L ? L.src.loop : null,
      sample: L ? L.id : null,
      expect: (SFX.BOX_SFX[box.art] || {}).search,
      searching: !!Game.search,
      // 打开容器时应该只有开箱音，没有一次性翻找声
      src: box.art
    };
  });
  assert(!p1.skip, '地图里要有可搜的容器');
  assert(p1.searching, '打开容器后自动开始搜第一件');
  assert.equal(p1.at, p1.src, '循环的 key 是这只容器');
  assert(p1.hasLoop, '搜索开始后循环已起');
  assert.equal(p1.loopFlag, true, 'BufferSource 处于 loop 模式');
  assert.equal(p1.sample, p1.expect, '循环的是该容器材质的那段采样');

  /* ---------- 2. 逐件之间不断：换件不换源 ---------- */
  const p2 = await page.evaluate(async () => {
    const before = SFX._searchLoop && SFX._searchLoop.src;
    const idx0 = Game.search && Game.search.idx;
    /* 把当前这件的进度直接推到头，逼它切下一件 */
    if (Game.search) Game.search.t = Game.search.total;
    await new Promise(r => setTimeout(r, 120));
    return {
      sameSource: before === (SFX._searchLoop && SFX._searchLoop.src),
      movedOn: (Game.search && Game.search.idx) !== idx0 || !Game.search,
      stillLooping: !!SFX._searchLoop
    };
  });
  assert(p2.stillLooping, '换下一件时循环没有断');
  assert(p2.sameSource, '换件不重新起源（否则听起来就是重启一次）');

  /* ---------- 3. 全部搜完 → 停 ---------- */
  const p3 = await page.evaluate(async () => {
    for (const e of (Game.lootOpen.items || [])) if (e && e.item) e.known = true;
    Game.search = null;
    Game.autoSearch = false;
    await new Promise(r => setTimeout(r, 120));
    return { loop: !!SFX._searchLoop, at: SFX._searchLoopAt, stillOpen: !!Game.lootOpen };
  });
  assert.equal(p3.loop, false, '全部搜完后循环停止');
  assert.equal(p3.at, null, '停止后 key 清空');
  assert(p3.stillOpen, '面板还开着（只是没得搜了）');

  /* ---------- 4. 关闭面板立刻停 ---------- */
  const p4 = await page.evaluate(async () => {
    /* 再开一个没搜过的容器，把循环重新点起来 */
    Game.closeLoot();
    const box = window.__pickBox() || Game.boxes[0];
    (box.items || []).forEach(e => { if (e) e.known = false; });
    Game.player.x = box.x; Game.player.y = box.y;
    Game.openLoot(box);
    await new Promise(r => setTimeout(r, 100));
    const running = !!SFX._searchLoop;
    Game.closeLoot();
    const afterClose = !!SFX._searchLoop;
    return { running, afterClose };
  });
  assert(p4.running, '重新打开容器后循环又起来了');
  assert.equal(p4.afterClose, false, '关面板立刻收声（不等下一帧）');

  /* ---------- 5. 撬开读条阶段就响，且走同一个 key ---------- */
  const p5 = await page.evaluate(async () => {
    Game.closeLoot();
    const box = window.__pickBox() || Game.boxes[0];
    box.searched = false;
    box.items.forEach(e => { if (e) e.known = false; });
    Game.player.x = box.x; Game.player.y = box.y;
    Game.action = { type: 'search', t: 0, total: 0.4, target: box, kind: box.kind, still: false };
    await new Promise(r => setTimeout(r, 100));
    const dur = { at: SFX._searchLoopAt, loop: !!SFX._searchLoop };
    Game.action = null;
    await new Promise(r => setTimeout(r, 100));
    return { dur, after: { loop: !!SFX._searchLoop } };
  });
  assert(p5.dur.loop, '撬容器读条阶段循环就在响');
  assert(p5.dur.at, '读条阶段也有对应的容器 key');
  assert.equal(p5.after.loop, false, '读条被打断（action 清空）后循环停');

  assert.equal(errs.length, 0, '页面无 JS 报错：' + errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log('容器搜索循环音：起循环 / 搜完停 / 关面板停 / 撬开阶段响 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
