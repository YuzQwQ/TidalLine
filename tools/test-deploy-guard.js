/* 出发前提醒的回归测试：生命值过低 / 未装备枪械 / 未携带药物，
   三项触发条件、弹窗三动作（备战 / 继续 / 取消）各自的行为。

   跑法：node tools/test-deploy-guard.js */
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
  await page.goto(pathToFileURL(path.join(ROOT, '潮汐线.html')).href + '#base');
  await page.waitForTimeout(1500);

  /* ---------- 1. problems() 的判定逻辑 ---------- */
  const p1 = await page.evaluate(() => {
    const snap = { hp: Save.hp, weapons: Save.gear.weapons.slice(), melee: Save.gear.melee, bag: Save.bag.slice() };
    const out = {};
    // 全干净
    out.clean = DeployGuard.problems().map(x => x.kind);
    // 生命值低
    Save.hp = 40;
    out.lowHp = DeployGuard.problems().map(x => x.kind);
    Save.hp = 100;
    // 没枪
    const w = Save.gear.weapons; Save.gear.weapons = [null, null, null]; Save.gear.melee = null;
    out.noGun = DeployGuard.problems().map(x => x.kind);
    // 没药（清空背包里的医疗品）
    Save.gear.weapons = w.slice(); Save.gear.melee = snap.melee;
    Save.bag = Save.bag.filter(e => { const it = ITEM_BY_ID[e.id]; return !(it && Medical.is(it) && (it.healCap || 0) > 0); });
    out.noMed = DeployGuard.problems().map(x => x.kind);
    // 恢复
    Save.hp = snap.hp; Save.gear.weapons = snap.weapons; Save.gear.melee = snap.melee; Save.bag = snap.bag;
    return out;
  });
  assert.deepEqual(p1.clean, [], '全干净时没有提醒');
  assert(p1.lowHp.includes('hp'), '生命值低要触发 hp');
  assert(p1.noGun.includes('gun'), '没枪要触发 gun');
  assert(p1.noMed.includes('med'), '没药要触发 med');

  /* ---------- 2. guard() 弹窗与「继续出发」 ---------- */
  const p2 = await page.evaluate(() => {
    const out = {};
    // 制造一个缺枪场景
    out.hadWeapons = Save.gear.weapons.some(Boolean) || !!Save.gear.melee;
    // 直接测 guard 的弹窗逻辑：把 hp 压低制造缺口
    const oldHp = Save.hp; Save.hp = 30;
    const blocked = DeployGuard.guard('test-map');
    const veil = document.getElementById('deployVeil');
    out.blocked = blocked;
    out.veilVisible = !veil.classList.contains('hidden');
    out.warnCount = document.querySelectorAll('#deployWarns .deploy-warn').length;
    out.warnKinds = [...document.querySelectorAll('#deployWarns .deploy-warn')].map(x => x.className.match(/warn-(\w+)/)[1]);
    Save.hp = oldHp;
    DeployGuard.close();
    return out;
  });
  assert.equal(p2.blocked, true, '有缺口时 guard 拦截');
  assert.equal(p2.veilVisible, true, '弹窗显示');
  assert(p2.warnCount >= 1, '至少一条警告');
  assert(p2.warnKinds.includes('hp'), '警告里含生命值过低');

  /* ---------- 3. 「继续出发」绕过枪械硬闸门 ---------- */
  const p3 = await page.evaluate(async () => {
    const snap = { weapons: Save.gear.weapons.slice(), melee: Save.gear.melee, hp: Save.hp };
    // 没枪 + 低血：既触发 gun 也触发 hp
    Save.gear.weapons = [null, null, null]; Save.gear.melee = null; Save.hp = 30;
    DeployGuard.guard(RAID_MAP.id);
    const mapId = DeployGuard._pendingMap;
    // 直接点「继续出发」走 Base.deploy(force)
    DeployGuard.close();
    Base.deploy(mapId, { force: true });
    const out = { state: Game.state, mapId: Game.mapId };
    // 恢复
    Save.gear.weapons = snap.weapons; Save.gear.melee = snap.melee; Save.hp = snap.hp;
    return out;
  });
  assert.equal(p3.state, 'playing', '继续出发真的进了图（force 绕过枪械闸门）');
  assert(p3.mapId, '带着地图 id 进图');

  /* ---------- 4. 「取消」只是关掉弹窗，不进图、不回藏身处 ---------- */
  await page.evaluate(() => Game.state = 'map-select');
  const p4 = await page.evaluate(() => {
    Save.hp = 30;
    DeployGuard.guard('test');
    document.getElementById('deployCancel').click();
    return {
      veilHidden: document.getElementById('deployVeil').classList.contains('hidden'),
      state: Game.state,
      pending: DeployGuard._pendingMap
    };
  });
  assert.equal(p4.veilHidden, true, '取消后弹窗关闭');
  assert.equal(p4.state, 'map-select', '取消后还停在选图页');
  assert.equal(p4.pending, null, '取消后清空待出发地图');

  assert.equal(errs.length, 0, '页面无 JS 报错：' + errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log('出发前提醒：三项判定 / 弹窗 / 继续出发 / 取消 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
