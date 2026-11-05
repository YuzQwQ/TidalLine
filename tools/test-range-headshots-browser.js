/* 靶场入口、伤害反馈与新旧切换的浏览器验收。 */
const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--mute-audio', '--no-proxy-server'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(pathToFileURL(path.join(root, 'range.html')).href);
    await page.waitForFunction(() => typeof Range !== 'undefined' && Range.active && Game.player);
    const result = await page.evaluate(() => {
      const target = Range.targets[0];
      const b = new Bullet(target.x - 40, target.y, 0, 620, 'player', 20, 640);
      for (let i = 0; i < 10 && !b.dead; i++) b.update(1 / 60);
      Range.updateReadouts();
      Game.render();
      return { mode: Range.preciseHits, hits: target.hits, heads: target.headHits,
        damage: target.dmg, headPop: target.pops.at(-1).head,
        stats: document.querySelector('[data-out="heads"]').textContent };
    });
    assert.equal(result.mode, true);
    assert.equal(result.hits, 1);
    assert.equal(result.heads, 1);
    assert.equal(result.damage, 30);
    assert.equal(result.headPop, true);
    assert.equal(result.stats, '1 / 1 · 100%');
    fs.mkdirSync(path.join(root, 'output'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'output/range-headshots.png') });
    await page.locator('[data-act="hit-mode"]').click();
    const legacy = await page.evaluate(() => ({ mode: Range.preciseHits,
      hits: Range.targets.reduce((n, t) => n + t.hits, 0),
      label: document.querySelector('[data-act="hit-mode"]').textContent }));
    assert.equal(legacy.mode, false);
    assert.equal(legacy.hits, 0);
    assert.equal(legacy.label, '判定：旧版');
    await page.locator('[data-act="hit-mode"]').click();
    assert.equal(await page.evaluate(() => Range.preciseHits), true);
    await page.keyboard.press('F4');
    assert.equal(await page.evaluate(() => Range.targets.reduce((n, t) => n + t.headHits, 0)), 0);
    await page.evaluate(() => Range.exit());
    assert.equal(await page.evaluate(() => Range.active || Game.targets.length > 0), false);
    // 多文件与离线版正式战局：真实 Enemy/Player.hurt 链路，双方共用 3px 边界。
    for (const file of ['index.html', '潮汐线.html']) {
      await page.goto(pathToFileURL(path.join(root, file)).href + '#play');
      await page.reload(); // 同一 index.html 从 #range 换 hash 不会重新运行 boot
      await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'playing' && Game.player);
      const raid = await page.evaluate(() => {
        let open = null;
        for (let y = 2; y < M.H - 2 && !open; y++) {
          for (let x = 2; x < M.W - 2 && !open; x++) {
            let clear = true;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
              if (!M.walkable(x + dx, y + dy)) clear = false;
            }
            if (clear) open = { x: M.cx(x), y: M.cy(y) };
          }
        }
        if (!open) throw Error('No open test area');
        const enemy = Game.enemies.find(e => !e.dead);
        Game.enemies = [enemy];
        Game.targets = [];
        enemy.x = open.x; enemy.y = open.y;
        enemy.helmet = null; enemy.body = null;
        const damage = (target, faction, offset) => {
          target.hp = 100;
          const b = new Bullet(target.x - 40, target.y + offset, 0, 620, faction, 20, 640, 5);
          for (let i = 0; i < 20 && !b.dead; i++) b.update(1 / 60);
          return 100 - target.hp;
        };
        const offsets = [0, 2.99, 3.01, 4.39];
        const outgoing = offsets.map(o => damage(enemy, 'player', o));
        Game.enemies = [];
        const p = Game.player;
        p.x = open.x; p.y = open.y;
        p.helmet = null; p.body = null;
        const incoming = offsets.map(o => damage(p, 'scav', o));
        return { outgoing, incoming, range: Range.active,
          radius: CFG.COMBAT.HEAD_RADIUS + CFG.COMBAT.HEAD_BULLET_ALLOWANCE };
      });
      assert.deepEqual(raid.outgoing, [30, 30, 20, 20], file + ' outgoing');
      assert.deepEqual(raid.incoming, [30, 30, 20, 20], file + ' incoming');
      assert.equal(raid.range, false);
      assert.equal(raid.radius, 3);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: range entry/feedback/toggle/reset; index/offline raids use 3px headshots for player and enemies');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
