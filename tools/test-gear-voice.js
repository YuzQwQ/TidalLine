/* 三组新音的回归测试：装备穿脱、挥砍六变体、玩家受击。
   这三条都属于"接上了但听不出接没接"的类型 —— 采样 id 写错、路由漏了一条，
   耳朵里只是"某个动作没声音"，眼睛看不出来。所以这里逐个把它们逼出来：

   1. 六段挥空真的在轮换（不是每次都播第一条）
   2. 头盔 / 护甲 / 背包走各自的材质声，卸下比穿上慢一档
   3. 仓库里穿上、脱下装备都会出声（Base 那一层要真的调）
   4. 玩家中弹会响 hurt，近战挨打要更闷

   跑法：node tools/test-gear-voice.js */
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE_IDS = ['hurt', 'gear_helmet', 'gear_armor', 'gear_bag',
  'melee_1', 'melee_2', 'melee_3', 'melee_4', 'melee_5', 'melee_6'];

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--no-proxy-server', '--mute-audio', '--autoplay-policy=no-user-gesture-required']
  });
  const errs = [];

  /* ---------- 局外：装备穿脱 ---------- */
  const base = await browser.newPage();
  base.on('pageerror', e => errs.push('base: ' + e));
  await base.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '#base');
  /* 大厅不点任何按钮就不会建音频上下文（浏览器手势限制），
     这里手动把它叫起来，否则采样一条都不会解码 */
  await base.waitForFunction(() => typeof SFX !== 'undefined' && SFX.samples);
  await base.evaluate(async () => { SFX.init(); await SFX.load(); });
  await base.waitForFunction(ids => SFX.samples && ids.every(id => SFX.samples[id]), SAMPLE_IDS);

  const b = await base.evaluate(() => {
    const out = {};
    /* 每段采样实际用哪一档响度，和 LOUD 表对不对得上 */
    out.loud = {
      melee: SFX._targetFor('melee_3'),
      gear: SFX._targetFor('gear_armor'),
      hurt: SFX._targetFor('hurt')
    };
    out.loudTable = { melee: SFX.LOUD.melee, gear: SFX.LOUD.gear, hurt: SFX.LOUD.hurt };

    /* 抓 _playSample 的入参：既看播了哪一段，也看 rate 有没有分穿上/卸下 */
    const played = [];
    const real = SFX._playSample.bind(SFX);
    SFX._playSample = (id, o) => { played.push({ id, opts: o || {} }); return real(id, o); };

    /* 1. 六段挥空轮换 */
    for (let i = 0; i < 12; i++) SFX.play('melee');
    const meleeIds = played.filter(p => /^melee_\d$/.test(p.id)).map(p => p.id);
    out.meleeIds = meleeIds;
    out.meleeUnique = [...new Set(meleeIds)].length;
    out.meleeRepeat = meleeIds.some((id, i) => i > 0 && id === meleeIds[i - 1]);

    /* 2. 三件装备各自的材质声 */
    played.length = 0;
    SFX.gear('helmet'); SFX.gear('body'); SFX.gear('back');
    out.gearIds = played.map(p => p.id);
    played.length = 0;
    SFX.gear('body', { off: true });
    out.offRate = played[0] ? played[0].opts.rate : null;
    played.length = 0;
    const unknown = SFX.gear('melee');
    out.unknownGear = { ok: unknown, played: played.length };

    /* 3. 仓库那条路径：穿上 / 脱下都要真的调到 gear() */
    Save.stash = [];
    Save.gear.helmet = null;
    Save.addGearStash(EQUIP.armor(GEAR.make('helmet', 4)));
    const entry = Save.stash.find(e => e.gear && e.gear.equip.kind === 'armor');
    const gearCalls = [];
    const realGear = SFX.gear.bind(SFX);
    SFX.gear = (k, o) => { gearCalls.push({ k, off: !!(o && o.off) }); return realGear(k, o); };
    out.equipOk = Base.equipFromStash(entry, 'helmet');
    out.afterEquip = Save.gear.helmet ? Save.gear.helmet.lv : null;
    out.unequipOk = Base.unequip('helmet');
    out.afterUnequip = Save.gear.helmet;
    out.gearCalls = gearCalls;
    SFX.gear = realGear;

    SFX._playSample = real;
    return out;
  });

  assert.deepEqual(b.loud, b.loudTable, '挥砍 / 装备 / 受击的响度档对不上 LOUD 表');

  assert.equal(b.meleeIds.length, 12, '12 刀都应该走采样，实际 ' + b.meleeIds.length + ' 刀');
  assert(b.meleeUnique >= 5, '六段挥空应该轮起来（12 刀只听到 ' + b.meleeUnique + ' 种）');
  assert(!b.meleeRepeat, '同一段挥空不该连着播两次');

  assert.deepEqual(b.gearIds, ['gear_helmet', 'gear_armor', 'gear_bag'],
    '头盔 / 护甲 / 背包应该各播各的：' + b.gearIds.join(','));
  assert(b.offRate != null && b.offRate < 1, '卸下要比穿上慢一档，实际 rate ' + b.offRate);
  assert.equal(b.unknownGear.ok, false, '没有专属声的槽位（近战）应该静默返回 false');
  assert.equal(b.unknownGear.played, 0, '静默槽位不该播任何采样');

  assert(b.equipOk && b.afterEquip === 4, '仓库里戴头盔要成功');
  assert(b.unequipOk && b.afterUnequip == null, '卸头盔要成功');
  assert.equal(b.gearCalls.length, 2, '穿上 + 卸下各响一声，实际 ' + b.gearCalls.length + ' 声');
  assert.deepEqual(b.gearCalls[0], { k: 'helmet', off: false }, '穿上是 off=false');
  assert.deepEqual(b.gearCalls[1], { k: 'helmet', off: true }, '卸下是 off=true');

  /* ---------- 局内：中弹的受击反馈 ---------- */
  const play = await browser.newPage();
  play.on('pageerror', e => errs.push('play: ' + e));
  await play.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '#play');
  await play.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'playing' && Game.player);

  const p = await play.evaluate(() => {
    const calls = [];
    const real = SFX.play.bind(SFX);
    SFX.play = (n, o) => { calls.push({ n, o: o || {} }); return real(n, o); };
    Game.player.hp = 100;
    const before = Game.player.hp;
    Game.player.hurt(12, 'body', 0);          // 没穿甲：一声压暗的硬碰
    const bare = calls.slice();
    calls.length = 0;
    Game.player.hurt(5, 'body', 0, 'melee');  // 被近战砍：更闷
    const punch = calls.slice();
    SFX.play = real;
    return { before, after: Game.player.hp, bare, punch };
  });

  assert.equal(errs.length, 0, '页面没有 JS 报错：' + errs.slice(0, 2).join(' | '));
  assert(p.after < p.before, '中弹要真的掉血（测试前提）');
  assert(p.bare.some(c => c.n === 'hurt'), '玩家中弹要响 hurt，实际：' +
    p.bare.map(c => c.n).join(','));
  const bareHurt = p.bare.find(c => c.n === 'hurt');
  assert.equal(bareHurt.o.lp, 2600, '没挡住的一发要把高频压掉（lp 2600）');
  assert(p.punch.some(c => c.n === 'hurt'), '近战挨打也要有受击声');
  const punchHurt = p.punch.find(c => c.n === 'hurt');
  assert.equal(punchHurt.o.lp, 900, '近战落在身上更闷（lp 900）');
  assert(punchHurt.o.vol < 1, '近战那一声音量要低一点，实际 vol ' + punchHurt.o.vol);

  await browser.close();
  console.log('新音效接线：六段挥空轮换 / 三件装备各响各的 / 穿上脱下 / 中弹受击 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
