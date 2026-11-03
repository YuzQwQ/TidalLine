/* 备战页的「健康状态 + 快速治疗」：
     1. 卡片按血量分档（健康 / 轻伤 / 重伤 / 濒危），满血时按钮禁用
     2. 快速治疗弹出结账页，三档按当前伤势给价，价格与医生页同源
     3. 取消 → 不扣款、不治疗
     4. 确定支付 → 扣款、回血到该档目标、卡片与余额同步
     5. 余额不足 → 支付按钮禁用（点不动，也不会扣成负数）

   跑法：node tools/test-clinic.js */
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

  /* ---------- 1. 血量分档 ---------- */
  const tiers = await page.evaluate(() => {
    const snap = { hp: Save.hp, credits: Save.credits };
    const out = {};
    for (const hp of [100, 90, 75, 60, 45, 38, 10]) {
      Save.hp = hp;
      Base.render();
      const card = document.getElementById('loadoutHealth');
      out[hp] = {
        state: card.querySelector('.lh-state').textContent,
        tone: /tone-(\w+)/.exec(card.className)[1],
        bar: card.querySelector('.lh-bar i').style.width,
        disabled: card.querySelector('.lh-treat').disabled
      };
    }
    Save.hp = snap.hp; Save.credits = snap.credits; Base.render();
    return out;
  });
  assert.equal(tiers[100].state, '健康');
  assert.equal(tiers[100].disabled, true, '满血时按钮禁用');
  assert.equal(tiers[90].state, '轻伤');
  assert.equal(tiers[90].tone, 'warn');
  assert.equal(tiers[45].state, '重伤');
  assert.equal(tiers[38].tone, 'bad');
  assert.equal(tiers[10].state, '濒危');
  /* 浏览器会把 "100.0%" 规范化成 "100%"：按数值比，不按字符串比 */
  assert.equal(parseFloat(tiers[100].bar), 100, '血条按比例');
  assert.equal(parseFloat(tiers[38].bar), 38);

  /* ---------- 2. 结账页内容与定价 ---------- */
  const quote = await page.evaluate(() => {
    Save.hp = 38; Save.credits = 60000; Base.render();
    Clinic.open();
    const dlg = document.querySelector('.clinic-checkout');
    const opts = [...dlg.querySelectorAll('[data-clinic-opt]')].map(b => ({
      id: b.dataset.clinicOpt,
      price: Number(b.querySelector('.co-price').textContent.replace(/[^\d]/g, '')),
      heal: Number(/恢复 (\d+) HP/.exec(b.querySelector('small').textContent)[1])
    }));
    /* 与医生页同源：全面治疗的价钱 == Medical.quote() 的总价 */
    const full = opts.find(o => o.id === 'full');
    return {
      opts, full,
      doctorTotal: Medical.quote().total,
      totalShown: Number(dlg.querySelector('.clinic-total strong').textContent.replace(/[^\d]/g, '')),
      payDisabled: dlg.querySelector('[data-clinic-pay]').disabled,
      optionCount: opts.length
    };
  });
  assert(quote.optionCount >= 2, '至少列出两档治疗');
  assert(quote.opts.every(o => o.price > 0), '每一档都有价格');
  assert(quote.opts.every(o => o.heal > 0), '每一档都回血');
  assert.equal(quote.full.price, quote.doctorTotal, '全面治疗的价格和医生页一致');
  assert.equal(quote.totalShown, quote.opts[0].price, '总价跟着选中项走');
  assert.equal(quote.payDisabled, false, '钱够时能支付');

  /* ---------- 3. 取消：不扣款不治疗 ---------- */
  const cancelled = await page.evaluate(() => {
    const before = { hp: Save.hp, credits: Save.credits };
    document.querySelector('[data-clinic-cancel]').click();
    return {
      before,
      after: { hp: Save.hp, credits: Save.credits },
      gone: !document.querySelector('.clinic-checkout'),
      cardHp: document.querySelector('#loadoutHealth .lh-hp').textContent
    };
  });
  assert.equal(cancelled.after.hp, cancelled.before.hp, '取消不回血');
  assert.equal(cancelled.after.credits, cancelled.before.credits, '取消不扣款');
  assert.equal(cancelled.gone, true, '取消后弹窗关闭');
  assert(/38/.test(cancelled.cardHp), '卡片血量没变');

  /* ---------- 4. 支付：扣款 + 回血 + 刷新 ---------- */
  const paid = await page.evaluate(() => {
    Save.hp = 38; Save.credits = 60000; Base.render();
    Clinic.open();
    const dlg = document.querySelector('.clinic-checkout');
    const btn = [...dlg.querySelectorAll('[data-clinic-opt]')].find(b => b.dataset.clinicOpt === 'field');
    btn.click();                                    // 选「现场急救」
    const price = Number(dlg.querySelector('.clinic-total strong').textContent.replace(/[^\d]/g, ''));
    const target = Math.min(CFG.P.HP, 38 + 60);
    dlg.querySelector('[data-clinic-pay]').click();
    return {
      price, target,
      hp: Save.hp, credits: Save.credits,
      gone: !document.querySelector('.clinic-checkout'),
      cardState: document.querySelector('#loadoutHealth .lh-state').textContent,
      cardHp: document.querySelector('#loadoutHealth .lh-hp').textContent
    };
  });
  assert.equal(paid.hp, paid.target, '回血到该档目标');
  assert.equal(paid.credits, 60000 - paid.price, '按总价扣款');
  assert.equal(paid.gone, true, '支付后弹窗关闭');
  assert(/98/.test(paid.cardHp), '卡片血量已刷新');

  /* ---------- 5. 余额不足 ---------- */
  const poor = await page.evaluate(() => {
    Save.hp = 20; Save.credits = 10; Base.render();
    Clinic.open();
    const dlg = document.querySelector('.clinic-checkout');
    const pay = dlg.querySelector('[data-clinic-pay]');
    const before = Save.credits;
    const disabled = pay.disabled;
    if (!disabled) pay.click();                     // 万一还能点，也不该扣成负数
    const out = {
      disabled,
      credits: Save.credits,
      hp: Save.hp,
      error: (dlg.querySelector('.clinic-error') || {}).textContent || '',
      stillOpen: !!document.querySelector('.clinic-checkout')
    };
    Clinic.close();
    return out;
  });
  assert.equal(poor.disabled, true, '余额不足时支付按钮禁用');
  assert.equal(poor.credits, 10, '没扣钱');
  assert.equal(poor.hp, 20, '没治疗');
  assert(/不足/.test(poor.error), '给出余额不足提示');

  assert.equal(errs.length, 0, '页面无 JS 报错：' + errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('健康状态 + 快速治疗：分档 / 定价 / 取消 / 支付 / 余额不足 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
