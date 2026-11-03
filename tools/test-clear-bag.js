/* 备战页的「清空背包」：
     1. 按钮插在背包标题行右侧，空包时禁用
     2. 点一下 → 背包条目全部搬进仓库，**一件不少**（整叠搬，不是每样搬 1 件）
     3. 装备栏（枪 / 护甲 / 背包 / 近战）不动 —— 那是身上穿的，不属于背包
     4. 仓库塞不下的弹药留在包里，并在提示里说明
     5. 用过的医疗品按单件入仓，容量跟着走

   跑法：node tools/test-clear-bag.js */
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
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '#base');
  await page.waitForFunction(() => Game.state === 'base');
  await page.waitForTimeout(500);

  /* ---------- 1. 按钮就位 ---------- */
  const head = await page.evaluate(() => {
    const btn = document.getElementById('btnClearBag');
    const hd = document.getElementById('bagHead');
    return {
      exists: !!btn,
      inHead: !!(hd && btn && hd.contains(btn)),
      rightOfTitle: !!(hd && btn && hd.lastElementChild === btn),
      label: btn && btn.textContent.trim(),
      title: btn && btn.title
    };
  });
  assert(head.exists, '背包标题行里有「清空背包」按钮');
  assert(head.inHead && head.rightOfTitle, '按钮排在容量文字的右边');
  assert.equal(head.label, '清空背包');

  /* ---------- 2. 清空：一件不少 ---------- */
  const cleared = await page.evaluate(() => {
    const ammo = ITEMS.filter(i => i.cat === 'ammo')[0].id;
    const junk = ITEMS.filter(i => i.cat === 'collect' && i.w)[0].id;
    const gun = Save.gear.weapons[0];
    /* 混合一包：整叠药品 / 用过的药品 / 弹药 / 杂物 / 包里的一把枪 */
    Save.bag = [
      { id: 'heal01', n: 3 },
      { id: 'heal01', n: 1, cap: 7 },
      { id: ammo, n: 30 },
      { id: junk, n: 5 },
      { id: gun.id, n: 1, gear: gun }
    ];
    Base.render();
    const units = () => Save.bag.reduce((s, e) => s + (e.gear ? 1 : Math.max(1, e.n || 1)), 0);
    const stashUnits = () => Save.stash.reduce((s, e) => s + (e.gear ? 1 : Math.max(1, e.n || 1)), 0);
    const before = { bag: units(), stash: stashUnits(), stashLen: Save.stash.length };
    const gearBefore = JSON.stringify(Save.gear);

    document.getElementById('btnClearBag').click();

    const after = { bag: units(), stash: stashUnits(), stashLen: Save.stash.length };
    const caps = Save.stash.filter(e => e.id === 'heal01' && e.cap != null).map(e => e.cap);
    return {
      ammo, junk,
      before, after,
      gearSame: JSON.stringify(Save.gear) === gearBefore,
      caps,
      note: document.getElementById('deployHint').textContent,
      disabled: document.getElementById('btnClearBag').disabled,
      meta: document.getElementById('bagMeta').textContent
    };
  });
  assert.equal(cleared.after.bag, 0, '背包清空了');
  assert.equal(cleared.after.stash - cleared.before.stash, cleared.before.bag,
    '搬进仓库的件数和背包原有件数一致（' + cleared.before.bag + ' 件不能少）');
  assert.equal(cleared.gearSame, true, '装备栏原样不动');
  assert.equal(cleared.disabled, true, '空包后按钮禁用');
  assert(/背包已清空/.test(cleared.note), '给出清空提示：' + cleared.note);
  assert(/0 \/ \d+ 格/.test(cleared.meta), '容量显示归零：' + cleared.meta);
  /* 用过的绷带进仓库仍带着 7 点容量，不会和新的混在一起 */
  assert(cleared.caps.includes(7), '用过的医疗品保留了剩余容量：' + JSON.stringify(cleared.caps));

  /* ---------- 3. 仓库放不下弹药：其余的照样搬，弹药留包里 ---------- */
  const stuck = await page.evaluate(() => {
    const ammo = ITEMS.filter(i => i.cat === 'ammo')[0].id;
    Save.bag = [{ id: 'heal01', n: 2 }, { id: ammo, n: 20 }];
    Base.render();
    const real = Save.canAddStash.bind(Save);
    Save.canAddStash = () => false;                // 假装仓库满了
    document.getElementById('btnClearBag').click();
    Save.canAddStash = real;
    const left = Save.bag.map(e => e.id + ':' + (e.n || 1));
    return { left, note: document.getElementById('deployHint').textContent };
  });
  assert.equal(stuck.left.length, 1, '只剩塞不下的那一条');
  assert(/ammo/.test(stuck.left[0]), '留下的是弹药：' + stuck.left[0]);
  assert(/20/.test(stuck.left[0]), '20 发一发没少');
  assert(/放不下/.test(stuck.note), '提示里说明了原因：' + stuck.note);

  /* ---------- 4. 空包时点它不会有副作用 ---------- */
  const empty = await page.evaluate(() => {
    const ammo = ITEMS.filter(i => i.cat === 'ammo')[0].id;
    Save.bag = [];
    Base.render();
    const stash = Save.stash.length;
    document.getElementById('btnClearBag').click();      // 禁用状态，点了也没反应
    const r = { stash, after: Save.stash.length, note: document.getElementById('deployHint').textContent };
    /* 直接调函数则给一句提示，不至于静默 */
    const n = Base.clearBag();
    r.direct = n;
    r.directNote = document.getElementById('deployHint').textContent;
    return r;
  });
  assert.equal(empty.after, empty.stash, '空包点击不动仓库');
  assert.equal(empty.direct, 0, '空包直接调用返回 0');
  assert(/已经是空的/.test(empty.directNote), '空包时说明白：' + empty.directNote);

  assert.equal(errs.length, 0, '页面无 JS 报错：' + errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('清空背包：按钮 / 整叠搬运不丢件 / 装备栏不动 / 仓库放不下 / 空包 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
