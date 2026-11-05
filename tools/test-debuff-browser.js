/* 损伤状态 HUD 与医疗品使用的浏览器端验收（双入口）。
   node tools/test-debuff-browser.js
   覆盖：状态 chip、镇痛倒计时、可恢复上限提示、双击用止血带/止痛药后当帧刷新、
   结算清空、index.html 与 潮汐线.html 都无 JS 报错。 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
let chromium = null;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('跳过：本机没装 playwright（npm i -D playwright 后再跑）'); process.exit(0); }

const ROOT = path.resolve(__dirname, '..');
const SHOT = path.join(ROOT, 'output', 'debuff');
function assert(cond, msg) { if (!cond) throw new Error('断言失败：' + msg); }

async function run(file) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--no-proxy-server', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(pathToFileURL(path.join(ROOT, file)).href);
    await page.waitForFunction(() => typeof Game !== 'undefined' && typeof Debuff !== 'undefined');

    await page.evaluate(() => {
      Game.startRun({ ammo: 12, bandage: 1, stone: 0 });
      Game.enemies = [];
      Game.bullets = [];
      Game.state = 'playing';
      Game.time = 0;
      document.getElementById('startVeil').style.display = 'none';
      if (!Game.bagOpen) Game.toggleBag();
    });

    /* 1. 无状态时不显示 */
    assert(await page.locator('#debuffBar').evaluate(el => getComputedStyle(el).display) === 'none',
      '无损伤时状态条隐藏');

    /* 2. 三类损伤 + 镇痛：chip、上限、倒计时 */
    await page.evaluate(() => {
      const P = Game.player;
      P.debuffs = Debuff.fresh();
      Debuff.apply(P, 'bleeding');
      Debuff.apply(P, 'severe');
      Debuff.apply(P, 'severe');
      Debuff.apply(P, 'fracture');
      Debuff.applyAnalgesic(P, 125);
      DebuffHud.refresh();
    });
    const bar = await page.locator('#debuffBar').innerText();
    assert(/流血/.test(bar) && /骨折/.test(bar), '状态条有流血与骨折：' + bar);
    assert(/重伤 Lv2/.test(bar) && /上限 70%/.test(bar), '重伤层数与可恢复上限：' + bar);
    assert(/疼痛（已压制）/.test(bar) && /镇痛 2:0\d/.test(bar), '疼痛被压制与镇痛倒计时：' + bar);
    assert((await page.locator('#debuffBar .db-analg').count()) === 1, '镇痛 chip 唯一');
    assert((await page.locator('#debuffBar .db-muted').count()) === 1, '疼痛 chip 变灰');

    const cap = await page.evaluate(() => Debuff.recoverableMax(Game.player));
    assert(Math.abs(cap - 70) < 1e-6, '两层重伤的恢复上限是 70，实际 ' + cap);
    if (file === 'index.html') {
      fs.mkdirSync(SHOT, { recursive: true });
      /* 关掉背包拍一张：左上血量条的封锁段与状态条都要看得见 */
      await page.evaluate(() => { if (Game.bagOpen) Game.toggleBag({ silent: true }); });
      await page.screenshot({ path: path.join(SHOT, 'debuff-hud.png') });
      await page.evaluate(() => { if (!Game.bagOpen) Game.toggleBag({ silent: true }); });
    }

    /* 3. 双击止血带：读条走完，流血 chip 当帧消失 */
    await page.evaluate(() => {
      Game.player.bag.slots = [{ item: ITEM_BY_ID['heal09'], n: 1, cap: 1 }];
      Game.renderBag();
    });
    await page.locator('#bagGrid .cell').first().dblclick();
    assert(await page.evaluate(() => Game.action && Game.action.kind === 'cure'),
      '双击止血带进入 cure 读条');
    await page.evaluate(() => { for (let i = 0; i < 60 && Game.action; i++) Game.updateAction(0.05); });
    assert(await page.evaluate(() => !Game.player.debuffs.bleeding), '流血被止住');
    assert(!/流血/.test(await page.locator('#debuffBar').innerText()), '状态条当帧不再显示流血');

    /* 4. 止痛药：满血也能吃，镇痛倒计时出现 */
    await page.evaluate(() => {
      const P = Game.player;
      P.debuffs = Debuff.fresh();
      P.hp = 100;
      P.debuffs.fracture = true;
      P.bag.slots = [{ item: ITEM_BY_ID['heal06'], n: 1, cap: 1 }];
      Game.renderBag();
      DebuffHud.refresh();
    });
    await page.locator('#bagGrid .cell').first().dblclick();
    assert(await page.evaluate(() => Game.action && Game.action.kind === 'analgesic'),
      '满血也能开始服用止痛药');
    await page.evaluate(() => { for (let i = 0; i < 30 && Game.action; i++) Game.updateAction(0.05); });
    const bar2 = await page.locator('#debuffBar').innerText();
    assert(/镇痛 1:3\d/.test(bar2), '90 秒镇痛倒计时：' + bar2);
    assert(/疼痛（已压制）/.test(bar2), '骨折疼痛被镇痛压制');
    assert(await page.evaluate(() => Game.player.debuffs.fracture && !Debuff.penaltyOn(Game.player)),
      '镇痛不解骨折、只屏蔽操作惩罚');

    /* 5. 结算清空 */
    await page.evaluate(() => Game.showEnd(true));
    assert(await page.locator('#debuffBar').evaluate(el => getComputedStyle(el).display) === 'none',
      '结算后状态条隐藏');
    assert(await page.evaluate(() => {
      const d = Game.player.debuffs;
      return !d.bleeding && d.severe === 0 && !d.fracture && !Debuff.analgesicActive(Game.player);
    }), '结算清掉全部局内损伤与镇痛');

    assert(errors.length === 0, file + ' 有 JS 报错：' + errors.join(' | '));
    console.log('  ok   ' + file + '  损伤 HUD / 医疗品 / 结算清空 全部通过');
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    await run('index.html');
    await run('潮汐线.html');
    console.log('\n全部通过');
  } catch (e) {
    console.error('FAIL ' + e.message);
    process.exit(1);
  }
})();
