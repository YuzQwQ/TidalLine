/* 背包开合音的回归测试：只有玩家自己按出来的那一下才响。
   搜容器时搜刮面板会把背包一起带出来（左侧），那是系统动作，不该有拉链声 ——
   以前两种情况都响，翻一个箱子先"唰"一声，听着像在开自己的包。

   跑法：node tools/test-bag-voice.js */
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
  await page.goto(pathToFileURL(path.join(ROOT, '潮汐线.html')).href + '#play');
  await page.waitForFunction(() => Game.state === 'playing' && Game.player);
  await page.waitForTimeout(500);

  const r = await page.evaluate(() => {
    const hits = [];
    const real = SFX.play.bind(SFX);
    SFX.play = (n, o) => { hits.push(n); return real(n, o); };
    const out = {};

    /* 1. 打开容器：搜刮面板把背包带出来 —— 拉链不该响 */
    hits.length = 0;
    const box = Game.boxes[0] || { art: 'crate_std', kind: 'std', items: [] };
    Game.openLoot(box);
    out.openLoot = [...new Set(hits)];
    out.bagOpenAfterLoot = Game.bagOpen;

    /* 2. 关面板：自动收背包 —— 也不该响 */
    hits.length = 0;
    Game.closeLoot();
    out.closeLoot = [...new Set(hits)];
    out.bagOpenAfterClose = Game.bagOpen;

    /* 3. 玩家自己按 Tab 开背包 —— 该响 */
    hits.length = 0;
    Game.toggleBag();
    out.openByHand = [...new Set(hits)];
    out.bagOpenAfterHand = Game.bagOpen;

    /* 4. 再按一次关 —— 也该响 */
    hits.length = 0;
    Game.toggleBag();
    out.closeByHand = [...new Set(hits)];

    /* 5. 显式静默：系统动作用的那条路径 */
    hits.length = 0;
    Game.toggleBag({ silent: true });
    out.silent = [...new Set(hits)];

    SFX.play = real;
    return out;
  });

  assert.equal(errs.length, 0, '页面没有 JS 报错：' + errs.slice(0, 2).join(' | '));

  assert(r.bagOpenAfterLoot === true, '搜容器时背包确实被带出来了');
  assert(!r.openLoot.includes('bag_zip'), '打开容器不该有拉链声，实际：' + r.openLoot.join(','));
  assert(r.openLoot.includes('container_open'), '打开容器该有开箱声');
  assert(r.openLoot.includes('search'), '打开容器后自动搜第一件，该有翻找声');

  assert.equal(r.bagOpenAfterClose, false, '关面板后背包收起来了');
  assert(!r.closeLoot.includes('bag_zip'), '自动收背包不该有拉链声，实际：' + r.closeLoot.join(','));

  assert(r.openByHand.includes('bag_zip'), '玩家自己开背包要有拉链声');
  assert(r.closeByHand.includes('bag_zip'), '玩家自己关背包要有拉链声');
  assert(!r.silent.includes('bag_zip'), '静默模式不该出声');

  await browser.close();
  console.log('背包开合音：搜容器不响 / 自动收包不响 / 手动开收都响 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
