/* Wiki 集成检查：先 node gen-wiki.js；需要 playwright + Edge。 */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/wiki');
const url = file => pathToFileURL(path.join(root, file)).href;
const context = vm.createContext({});
for (const file of ['config.js', 'data.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
const expected = vm.runInContext('({types:CONTAINER_TYPES,rows:MAP_ROWS,quality:CONTAINER_QUALITY,itemCount:ITEMS.length,gearCount:Object.keys(WEAPONS).length+HELMETS.length+BODIES.length+1})', context);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => errors.push(request.url() + ': ' + request.failure().errorText));
    const active = () => page.locator('[data-wiki-page]:not([hidden])');
    const navigate = async key => {
      await page.locator(`[data-wiki-link="${key}"]`).click();
      await page.waitForFunction(key => !document.querySelector(`[data-wiki-page="${key}"]`).hidden, key);
      assert.equal(await page.locator('[data-wiki-page]:not([hidden])').count(), 1);
      assert.equal(await page.locator('[data-wiki-link][aria-current="page"]').getAttribute('data-wiki-link'), key);
    };
    await page.goto(url('wiki.html'));
    assert.equal(await active().locator('.item').count(), expected.itemCount);
    await navigate('gear');
    assert.equal(await active().locator('.item').count(), expected.gearCount);
    await navigate('containers');
    assert.equal(await active().locator('[data-container]').count(), Object.keys(expected.types).length);
    assert.equal(await active().locator('[data-remains]').count(), 3);
    for (const [ch, type] of Object.entries(expected.types)) {
      const card = active().locator(`[data-container="${ch}"]`);
      const count = expected.rows.join('').split(ch).length - 1;
      assert((await card.locator('summary').textContent()).includes(`当前地图 ${count} 个`));
      assert.equal(await card.locator('img').getAttribute('src'), `assets/props/${type.art}.png`);
      assert.equal(await card.locator('dd').first().textContent(), expected.quality[type.q].time ? expected.quality[type.q].time + ' 秒' : '即时打开');
      await card.locator('summary').click();
      assert.equal(await card.locator('.container-positions code').count(), count);
      await card.locator('summary').click();
    }
    assert(await page.evaluate(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)), '所有清单贴图都能本地加载');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'containers-desktop.png'), fullPage: true });
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('#gear').hidden);
    await page.goForward();
    await page.waitForFunction(() => !document.querySelector('#containers').hidden);
    await page.reload();
    assert.equal(await active().getAttribute('id'), 'containers');
    assert.equal(await page.title(), '潮汐线 Wiki · 容器清单');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const key of ['items', 'gear', 'containers']) {
        await navigate(key);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), key + ' 在 ' + width + 'px 下横向溢出');
      }
      if (width === 390) await page.screenshot({ path: path.join(output, 'containers-mobile.png'), fullPage: true });
    }
    for (const [file, key, count] of [['物品清单.html', 'items', expected.itemCount], ['装备清单.html', 'gear', expected.gearCount], ['容器清单.html', 'containers', Object.keys(expected.types).length + 3]]) {
      await page.goto(url(file));
      assert.equal(await page.locator('.wiki-sheet .item').count(), count);
      assert.equal(await page.locator('[aria-current="page"]').getAttribute('data-wiki-link'), key);
      await page.locator('[data-wiki-link="containers"]').click();
      await page.waitForFunction(() => document.querySelector('#containers') && !document.querySelector('#containers').hidden);
    }
    await page.goto(url('wiki.html') + '#missing');
    assert.equal(await active().getAttribute('id'), 'items');
    assert.deepEqual(errors, []);
    console.log('OK: 本地 Wiki、三页导航、前进后退、刷新与深链接、全部贴图、容器数据、地图位置、320/390px 布局、独立清单入口');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
