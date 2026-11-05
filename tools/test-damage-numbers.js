/* 伤害飘字：位图字体加载、排版、命中链路、动效参数。
   用法：node tools/test-damage-numbers.js
   （截图落在 output/damage-numbers.png，用来人眼确认字号和位置） */
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOT = path.join(ROOT, 'output');
const FONTS = require('../js/floatfont-data.js');

(async () => {
  fs.mkdirSync(SHOT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--no-proxy-server', '--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    const miss = [];
    page.on('requestfailed', r => miss.push(r.url()));

    await page.goto(pathToFileURL(path.join(ROOT, '潮汐线.html')).href + '#play');
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'playing' && Game.player);
    await page.waitForFunction(() => {
      const p = Art.map['effects/float_damage'];
      return !!(p && p.complete && p.naturalWidth);
    }, null, { timeout: 8000 });

    /* ---------- 1. 字体数据与图集 ---------- */
    const fontInfo = await page.evaluate(() => {
      const out = {};
      for (const k of Object.keys(FLOAT_FONTS)) {
        const f = FLOAT_FONTS[k];
        const img = Art.map[f.sheet];
        out[k] = {
          glyphs: Object.keys(f.chars).length,
          sheet: f.sheet,
          w: img ? img.naturalWidth : 0,
          h: img ? img.naturalHeight : 0,
          line: f.line
        };
      }
      return out;
    });
    assert.deepEqual(Object.keys(fontInfo).sort(), ['crit', 'damage', 'melee'], '接了三套字体（普通/爆头/近战真伤）');
    for (const [k, f] of Object.entries(fontInfo)) {
      assert.equal(f.glyphs, 46, k + ' 字形数');
      assert.equal(f.w, 368, k + ' 图集宽');
      assert.equal(f.h, 75, k + ' 图集高');
      assert.equal(f.line, 20, k + ' 行高');
    }
    /* 素材包的图集尺寸要和数据文件对得上，防止换素材忘了重跑 build-floatfont */
    assert.equal(FONTS.damage.chars['1'][6] < FONTS.damage.chars['8'][6], true,
      '数字 1 的步进比 8 窄（说明读的是真字形数据，不是等宽兜底）');

    /* ---------- 2. 排版 ---------- */
    const lay = await page.evaluate(() => ({
      one: FloatText.width('damage', '1'),
      eight: FloatText.width('damage', '8'),
      long: FloatText.width('damage', '123'),
      crit: FloatText.width('crit', '250'),
      scale: FloatText.width('damage', '123', 2),
      h: FloatText.height('damage', '123'),
      empty: FloatText.width('damage', ''),
      // 排版缓存要复用，不能每次重算
      again: FloatText.width('damage', '123')
    }));
    assert(lay.one > 0 && lay.eight > lay.one, '单字宽按真实字形算，8 比 1 宽');
    assert(lay.long > lay.eight, '三位数比一位数宽');
    assert.equal(lay.scale, lay.long * 2, '缩放按比例放大');
    assert(lay.h >= 20, '字高至少要盖住行高');
    assert.equal(lay.empty, 0, '空串不占宽');
    assert.equal(lay.again, lay.long, '同串结果稳定');

    /* ---------- 3. 生成飘字：默认 / 爆头 / 上限 ---------- */
    const made = await page.evaluate(() => {
      Game.dmgPops = [];
      const P = Game.player;
      Game.popDamage(P.x, P.y - 20, 37.4);
      Game.popDamage(P.x, P.y - 20, 128, { crit: true });
      Game.popDamage(P.x, P.y - 20, 64, { kind: 'melee' });
      const a = Game.dmgPops[0], b = Game.dmgPops[1], c = Game.dmgPops[2];
      Game.dmgPops = [];
      return { a, b, c, C: CFG.DMG_TEXT };
    });
    assert.equal(made.a.txt, '37', '伤害四舍五入成整数串');
    assert.equal(made.a.font, 'damage', '普通命中用骨白那套');
    assert.equal(made.a.life, made.C.LIFE);
    assert.equal(made.b.font, 'crit', '爆头用橙金那套');
    assert.equal(made.b.txt, '128');
    assert(made.b.life > made.a.life && made.b.rise > made.a.rise, '爆头飘得更高、留得更久');
    assert.equal(made.b.scale, made.a.scale, '字号不放大（放大 1.25 倍像素块会宽窄不一）');
    assert.equal(made.c.font, 'melee', '近战真伤用蓝色那套');
    assert.equal(made.c.txt, '64');

    /* 连打错位：0.16s 内连续冒出来的数字要逐条抬高，否则一梭子糊成一片 */
    const stair = await page.evaluate(() => {
      Game.dmgPops = []; Game._popAt = -9; Game._popStair = 0;
      const P = Game.player;
      Game.popDamage(P.x, P.y, 10);
      Game.popDamage(P.x, P.y, 10);
      Game.popDamage(P.x, P.y, 10);
      const ys = Game.dmgPops.map(p => Math.round(P.y - p.y));
      /* 隔开一个间隔就该回到基准高度 */
      Game._popAt = Game.time - 1;
      Game.popDamage(P.x, P.y, 10);
      const reset = Math.round(P.y - Game.dmgPops[3].y);
      Game.dmgPops = [];
      return { ys, reset, step: CFG.DMG_TEXT.STAIR };
    });
    assert.deepEqual(stair.ys, [0, stair.step, stair.step * 2], '连续命中逐条抬高');
    assert.equal(stair.reset, 0, '间隔超过 0.16s 回到基准高度');

    const capped = await page.evaluate(() => {
      Game.dmgPops = [];
      for (let i = 0; i < CFG.DMG_TEXT.MAX + 25; i++) Game.popDamage(Game.player.x, Game.player.y, i);
      return Game.dmgPops.length;
    });
    assert.equal(capped, made.C.MAX, '同屏条数按 MAX 封顶');
    await page.evaluate(() => { Game.dmgPops = []; });

    /* ---------- 4. 真实命中：数字来自实际掉血，不是纸面伤害 ---------- */
    /* 走 Bullet.resolveHit，和子弹打中人走的是同一条结算路径。
       不在这里模拟扣扳机：那一段是瞄准/后坐力的另一套逻辑，
       和飘字无关，只会让断言依赖鼠标坐标。 */
    const hit = await page.evaluate(() => {
      const P = Game.player, e = Game.enemies[0];
      e.dead = false; e.hp = 400;
      e.helmet = null; e.body = null;              // 先脱甲：数字应该等于纸面伤害
      Game.dmgPops = [];
      const hp0 = e.hp;
      const b = new Bullet(P.x + 20, P.y, 0, 900, 'player', 26, 300, 3);
      b.resolveHit(e, 'body');
      return {
        pops: Game.dmgPops.length,
        txt: Game.dmgPops[0] && Game.dmgPops[0].txt,
        font: Game.dmgPops[0] && Game.dmgPops[0].font,
        lost: Math.round(hp0 - e.hp)
      };
    });
    assert.equal(hit.pops, 1, '一次命中只冒一个数字');
    assert.equal(hit.txt, String(hit.lost), '显示的正是实际掉血');
    assert.equal(hit.font, 'damage', '普通命中用骨白字体');
    assert(hit.lost > 0, '这一发确实掉了血');

    /* ---------- 4.5 连击合并：同一个目标短时间内的命中并成一条累加 ---------- */
    const merge = await page.evaluate(() => {
      const P = Game.player, e = Game.enemies[0];
      e.dead = false; e.hp = 2000; e.helmet = null; e.body = null;
      const shoot = () => new Bullet(P.x + 20, P.y, 0, 900, 'player', 20, 300, 3).resolveHit(e, 'body');
      Game.dmgPops = [];
      shoot();
      const one = Game.dmgPops[0].val;
      Game.dmgPops.forEach(p => { p.t = 0.1; });     // 隔了 0.1s 再中一发
      shoot();
      const merged = { n: Game.dmgPops.length, val: Game.dmgPops[0].val, txt: Game.dmgPops[0].txt };
      /* 超过窗口就该另起一条 */
      Game.dmgPops.forEach(p => { p.t = 1; p.last = 0; });
      shoot();
      const split = Game.dmgPops.length;
      /* 爆头不并进普通命中的那条：橙色数字要自己站一条 */
      Game.dmgPops = [];
      shoot();
      Game.dmgPops.forEach(p => { p.t = 0.1; });
      new Bullet(P.x + 20, P.y, 0, 900, 'player', 20, 300, 3).resolveHit(e, 'head');
      const critSplit = Game.dmgPops.map(p => p.font);
      /* 霰弹：八颗弹丸同一帧结算，应该并成一条总伤害 */
      Game.dmgPops = [];
      for (let i = 0; i < 8; i++) shoot();
      const pellets = { n: Game.dmgPops.length, val: Game.dmgPops[0].val };
      Game.dmgPops = [];
      return { one, merged, split, critSplit, pellets };
    });
    assert(merge.one > 0, '第一发先建一条');
    assert.equal(merge.merged.n, 1, '0.1s 后再中还是同一条飘字');
    assert.equal(merge.merged.val, merge.one * 2, '数字累加而不是并排显示');
    assert.equal(merge.merged.txt, String(merge.one * 2), '显示的是累计值');
    assert.equal(merge.split, 2, '超过 0.3s 窗口另起一条');
    assert.deepEqual(merge.critSplit, ['damage', 'crit'], '爆头不并进普通命中的那条');
    assert.equal(merge.pellets.n, 1, '霰弹八颗弹丸并成一条');
    assert(merge.pellets.val > merge.one, '并起来的是总伤害（' + merge.pellets.val + '）');

    /* ---------- 4.8 玩家受伤不再单独配色：按伤害类型走同一张表 ---------- */
    const phurt = await page.evaluate(() => {
      const P = Game.player;
      const hp0 = P.hp, body0 = P.body, helmet0 = P.helmet;
      P.body = null; P.helmet = null;      // 脱甲，飘出来的就是纸面值
      const pop = (part, kind) => {
        Game.dmgPops = [];
        const before = P.hp;
        P.hurt(5, part, 0, kind);
        return {
          font: Game.dmgPops[0] && Game.dmgPops[0].font,
          txt: Game.dmgPops[0] && Game.dmgPops[0].txt,
          lost: Math.round(before - P.hp)
        };
      };
      const normal = pop('body');
      const melee = pop('body', 'melee');
      const head = pop('head');
      /* 连续挨同类打合并成一条 */
      Game.dmgPops = [];
      const h1 = P.hp;
      P.hurt(3, 'body', 0);
      Game.dmgPops.forEach(p => { p.t = 0.05; });
      P.hurt(3, 'body', 0);
      const merge = { n: Game.dmgPops.length, val: Game.dmgPops[0].val, lost: Math.round(h1 - P.hp) };
      Game.dmgPops = [];
      P.hp = hp0; P.body = body0; P.helmet = helmet0; Save.setHP(hp0);
      return { normal, melee, head, merge };
    });
    assert.equal(phurt.normal.font, 'damage', '玩家中普通弹也用骨白');
    assert.equal(phurt.normal.txt, String(phurt.normal.lost), '显示实际掉血');
    assert.equal(phurt.melee.font, 'melee', '玩家挨近战用蓝色');
    assert.equal(phurt.head.font, 'crit', '玩家被爆头用橙金');
    assert.equal(phurt.merge.n, 1, '连续挨同类打合并成一条');
    assert.equal(phurt.merge.val, phurt.merge.lost, '合并累加等于实际掉血');

    /* ---------- 4.85 真实挥砍：近战真伤走蓝色 melee 字体 ---------- */
    const slash = await page.evaluate(() => {
      const P = Game.player, e = Game.enemies[0];
      e.dead = false; e.hp = 500;
      e.x = P.x + 18; e.y = P.y;         // 正前方、折叠刀够得着
      P.angle = 0; P.melee = EQUIP.melee('melee01'); P.meleeActive = true;
      P.meleeReadyAt = 0; P.meleeClock = 0; P.meleeAttack = null;
      const blockers = MeleeGeometry.blockers;
      MeleeGeometry.blockers = () => [];  // 只验飘字，地形遮挡不掺和
      Game.dmgPops = [];
      const ok = MeleeSystem.attack(P);
      const a = P.meleeAttack;
      if (ok && a) { P.meleeClock = a.start + a.weapon.windup + 0.001; MeleeSystem.tick(P, 0.001); }
      const r = {
        ok: !!(ok && a),
        font: Game.dmgPops[0] && Game.dmgPops[0].font,
        txt: Game.dmgPops[0] && Game.dmgPops[0].txt,
        hp: e.hp
      };
      Game.dmgPops = []; P.meleeAttack = null; MeleeGeometry.blockers = blockers;
      return r;
    });
    assert(slash.ok, '能发起一次挥砍');
    assert(slash.hp < 500, '这一刀确实砍中了');
    assert.equal(slash.font, 'melee', '近战真伤走蓝色 melee 字体');
    assert(Number(slash.txt) > 0, '近战飘出实际伤害数字');

    /* ---------- 5. 爆头走 crit 字体 ---------- */
    const crit = await page.evaluate(async () => {
      const P = Game.player, e = Game.enemies[0];
      e.dead = false; e.hp = 500;
      e.x = P.x + 34; e.y = P.y;
      Game.dmgPops = [];
      /* 直接走命中结算：head 部位 = 爆头 */
      const b = new Bullet(P.x + 20, P.y, 0, 900, 'player', 20, 300, 3);
      b.resolveHit(e, 'head');
      return { font: Game.dmgPops[0] && Game.dmgPops[0].font, txt: Game.dmgPops[0] && Game.dmgPops[0].txt };
    });
    assert.equal(crit.font, 'crit', '爆头命中用橙金字体');

    /* ---------- 6. 敌人打敌人不飘字（避免刷屏） ---------- */
    const ff = await page.evaluate(async () => {
      const P = Game.player, e = Game.enemies[0];
      e.dead = false; e.hp = 500;
      Game.dmgPops = [];
      const b = new Bullet(P.x + 20, P.y, 0, 900, 'scav', 10, 300, 3);
      b.resolveHit(e, 'body');
      return Game.dmgPops.length;
    });
    assert.equal(ff, 0, '非玩家子弹不给敌人飘字');

    /* ---------- 7. 动效：时间到了自己消失 ---------- */
    const life = await page.evaluate(async () => {
      /* 玩家挨打现在也飘字，等待期间敌人要是开枪，数组里就会多出一条 —— 先把人挪远 */
      const P = Game.player;
      for (const o of Game.enemies) { o.x = P.x + 2200; o.y = P.y + 2200; }
      Game.dmgPops = [];
      Game.popDamage(P.x, P.y - 20, 55);
      const t0 = Game.dmgPops.length;
      await new Promise(r => setTimeout(r, CFG.DMG_TEXT.LIFE * 1000 + 250));
      return { t0, t1: Game.dmgPops.length };
    });
    assert.equal(life.t0, 1);
    assert.equal(life.t1, 0, '住满寿命后从数组里摘掉');

    /* ---------- 8. 截图：同屏摆一排数字（含爆头）看字号与位置 ---------- */
    await page.evaluate(() => {
      const P = Game.player;
      Game.dmgPops = [];
      /* 摆开一点，别叠在一起——这张图是给人看字号和描边的，不是看堆叠。
         三条分别落在 P.x-32 / +30 / +96，都避开了左侧 HUD */
      Game.popDamage(P.x - 32, P.y - 30, 138, { crit: true });
      Game.popDamage(P.x + 30, P.y - 24, 92, { kind: 'melee' });
      Game.popDamage(P.x + 96, P.y - 24, 27);
      Game.dmgPops.forEach(p => { p.t = 0.12; p.drift = 0; });   // 跳过弹出，定格在清晰的那一帧
    });
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(SHOT, 'damage-numbers.png') });

    assert.deepEqual(errs, [], '没有 JS 报错');
    const bad = miss.filter(u => /assets\/effects\/float_/.test(u));
    assert.deepEqual(bad, [], '单文件版没有去请求外置字体图集');

    console.log('伤害飘字：字体 3 套 / 按类型分色 / 排版 / 命中链路 / 玩家受伤 / 真实挥砍 / 合并 / 寿命 / 截图 全部通过');
    console.log('  ' + path.relative(ROOT, path.join(SHOT, 'damage-numbers.png')));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
