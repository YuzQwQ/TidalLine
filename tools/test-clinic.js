/* 备战页的「健康状态 + 快速治疗」：
     1. 卡片按血量分档（健康 / 轻伤 / 重伤 / 濒危），满血时按钮禁用
     2. 结账页：商人头像 / 名字 / 身份齐全，血量行给出「当前 → 满血」
     3. 费用明细逐条列出（药品材料 + 诊疗服务费），加起来等于总计，
        总计与医生页 Medical.quote() 同源
     4. 只卖一档（恢复到完全健康）：页面上没有可选档位，也不能只治一部分
     5. 取消 → 不扣款、不治疗
     6. 确定支付 → 扣款、回满血、卡片与余额同步
     7. 余额不足 → 支付按钮禁用（点不动，也不会扣成负数）

   跑法：node tools/test-clinic.js */
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const num = s => Number(String(s).replace(/[^\d]/g, ''));

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

  /* ---------- 2. 报价：所有血量下都等于医生页，且明细能加出总计 ---------- */
  const math = await page.evaluate(() => {
    const hp0 = Save.hp;
    const out = [];
    for (const hp of [99, 75, 62, 38, 20, 1]) {
      Save.hp = hp;
      const p = Clinic.plan();
      out.push({
        hp,
        total: p.total,
        medicine: p.medicine,
        service: p.service,
        doctor: Medical.quote(hp).total,
        packs: p.packs,
        needPacks: Math.ceil((CFG.P.HP - hp) / ITEM_BY_ID.heal01.healCap),
        target: p.target,
        max: CFG.P.HP
      });
    }
    Save.hp = hp0;
    return out;
  });
  for (const r of math) {
    assert.equal(r.total, r.doctor, r.hp + ' HP：总价与医生页一致');
    assert.equal(r.total, r.medicine + r.service, r.hp + ' HP：材料费 + 服务费 = 总计');
    assert.equal(r.packs, r.needPacks, r.hp + ' HP：绷带数量够补满缺口');
    assert.equal(r.target, r.max, r.hp + ' HP：目标就是满血');
  }

  /* ---------- 3. 结账页内容 ---------- */
  const view = await page.evaluate(() => {
    Save.hp = 38; Save.credits = 60000; Base.render();
    Clinic.open();
    const dlg = document.querySelector('.clinic-checkout');
    const img = dlg.querySelector('.clinic-vendor-identity img');
    const lines = [...dlg.querySelectorAll('.clinic-bill li')].map(li => ({
      name: li.querySelector('span').textContent.trim(),
      note: li.querySelector('small').textContent.trim(),
      price: Number(li.querySelector('b').textContent.replace(/[^\d]/g, ''))
    }));
    return {
      merchant: {
        name: dlg.querySelector('.clinic-vendor-identity h3').textContent.trim(),
        identity: dlg.querySelector('.clinic-vendor-identity small').textContent.trim(),
        photo: img ? img.getAttribute('src') : '',
        photoW: img ? img.naturalWidth : 0
      },
      vitals: {
        hp: Number(dlg.querySelector('.clinic-vitals b').textContent),
        state: dlg.querySelector('.clinic-vitals em').textContent.trim(),
        arrow: dlg.querySelector('.clinic-arrow').textContent.trim()
      },
      lines,
      total: Number(dlg.querySelector('.clinic-total strong').textContent.replace(/[^\d]/g, '')),
      wallet: dlg.querySelector('.clinic-wallet').textContent.trim(),
      /* 只卖一档：页面上不该有任何可选档位 */
      optionButtons: dlg.querySelectorAll('[data-clinic-opt], .clinic-option').length,
      payDisabled: dlg.querySelector('[data-clinic-pay]').disabled,
      header: dlg.querySelector('h2').textContent.trim()
    };
  });
  assert.equal(view.merchant.name, '林岑', '显示医生名字');
  assert(/医生/.test(view.merchant.identity), '显示身份：' + view.merchant.identity);
  assert(view.merchant.photoW > 0, '头像真的加载出来了：' + view.merchant.photo);
  assert.equal(view.vitals.hp, 38, '血量行显示当前血量');
  assert.equal(view.vitals.arrow, '→ 100', '血量行给出治到满血');
  assert.equal(view.optionButtons, 0, '不提供分段治疗：页面上没有档位可选');
  assert.equal(view.header, '恢复到完全健康');

  assert.equal(view.lines.length, 2, '明细两行：材料费 + 服务费');
  assert(/药品材料/.test(view.lines[0].name) && /绷带 ×4/.test(view.lines[0].name),
    '第一行写清药量与数量：' + view.lines[0].name);
  assert(/补足 62 点生命/.test(view.lines[0].note), '第一行注明补足多少血');
  assert(/诊疗服务费/.test(view.lines[1].name), '第二行是诊疗服务费');
  assert(/25%/.test(view.lines[1].note), '第二行注明费率');
  assert.equal(view.lines[0].price, 8000, '绷带 4 剂 ×2000');
  assert.equal(view.lines[1].price, 2000, '服务费 = 材料费 25%');
  assert.equal(view.total, 10000, '总计 = 两行之和');
  assert.equal(view.payDisabled, false, '钱够时能支付');
  assert(/支付后 100 \/ 100 HP/.test(view.wallet), '余额行预告治疗后的血量：' + view.wallet);

  /* ---------- 4. 取消：不扣款不治疗 ---------- */
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

  /* ---------- 5. 支付：扣款 + 回满血 + 刷新 ---------- */
  const paid = await page.evaluate(() => {
    Save.hp = 38; Save.credits = 60000; Base.render();
    Clinic.open();
    const dlg = document.querySelector('.clinic-checkout');
    const price = Number(dlg.querySelector('.clinic-total strong').textContent.replace(/[^\d]/g, ''));
    dlg.querySelector('[data-clinic-pay]').click();
    return {
      price,
      hp: Save.hp, credits: Save.credits,
      gone: !document.querySelector('.clinic-checkout'),
      cardState: document.querySelector('#loadoutHealth .lh-state').textContent.trim(),
      cardHp: document.querySelector('#loadoutHealth .lh-hp').textContent,
      note: (document.getElementById('baseNote') || {}).textContent || ''
    };
  });
  assert.equal(paid.hp, 100, '一次治到满血');
  assert.equal(paid.credits, 60000 - paid.price, '按总价扣款');
  assert.equal(paid.gone, true, '支付后弹窗关闭');
  assert.equal(paid.cardState, '健康', '卡片状态词已刷新');
  assert(/100/.test(paid.cardHp), '卡片血量已刷新');

  /* ---------- 6. 余额不足 ---------- */
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

  /* ---------- 7. 满血时开不了结账页 ---------- */
  const full = await page.evaluate(() => {
    Save.hp = CFG.P.HP; Save.credits = 60000; Base.render();
    const opened = Clinic.open();
    return { opened, dlg: !!document.querySelector('.clinic-checkout') };
  });
  assert.equal(full.opened, false, '满血不开结账页');
  assert.equal(full.dlg, false, '没有残留弹窗');

  assert.equal(errs.length, 0, '页面无 JS 报错：' + errs.slice(0, 2).join(' | '));
  await browser.close();
  console.log('健康状态 + 快速治疗：分档 / 报价同源 / 商人信息 / 明细 / 全额治疗 / 取消 / 支付 / 余额不足 —— 全部通过');
})().catch(e => { console.error(e); process.exit(1); });
