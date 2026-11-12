/* 靶场战斗测试台验收：最新敌人数值、敌人靶、弹药等级、配件调试改装。
   开发版 + 离线版双入口，跑法：node tools/test-range-loadout-browser.js */
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'design/range/loadout-v1');
fs.mkdirSync(out, { recursive: true });
let n = 0;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--mute-audio', '--no-proxy-server'] });
  try {
    for (const file of ['index.html', '潮汐线.html']) {
      const tag = file === 'index.html' ? '开发版' : '离线版';
      const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      p.on('pageerror', e => errors.push(String(e)));
      await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      await p.goto(pathToFileURL(path.join(root, file)).href + '#range');
      await p.waitForFunction(() => typeof Range !== 'undefined' && Range.active &&
        !!document.getElementById('rangePanel'));
      const ok = (name, cond, extra) => {
        assert(cond, tag + ' ' + name + (extra != null ? ' ' + extra : ''));
        n++;
      };

      /* 1. 面板四块数据与最新敌人数值表 */
      const boxes = await p.evaluate(() => Object.fromEntries(
        ['dummy', 'ammo', 'parts', 'data'].map(k => {
          const el = document.querySelector('#rangePanel [data-box="' + k + '"]');
          return [k, el ? el.textContent.trim() : null];
        })));
      for (const k of ['dummy', 'ammo', 'parts', 'data'])
        ok('面板区块 ' + k + ' 已渲染', !!boxes[k] && boxes[k].length > 10, boxes[k] && boxes[k].slice(0, 40));
      const hpNow = await p.evaluate(() =>
        Object.fromEntries(Object.entries(ENEMY_TYPES).map(([k, t]) => [k, t.hp])));
      ok('HP 已同步到最新值', JSON.stringify(hpNow) ===
        JSON.stringify({ scav: 90, echo: 110, guard: 175, holdout: 110, retriever: 145 }),
        JSON.stringify(hpNow));
      for (const [k, v] of Object.entries(hpNow))
        ok('数值表列出 ' + k + ' ' + v + 'HP', boxes.data.includes(String(v) + ' HP'),
          boxes.data.slice(0, 120));

      /* 2. 钢板靶：7 参签名修正后 meta 不再被当倍率算成 NaN */
      const plate = await p.evaluate(() => {
        Range.setDummy('none');
        const t = Range.targets[0];
        const d = t.hurt(20, 'player', 'body', 16, undefined, { attackId: 'x' }, 1);
        return { count: Range.targets.length, isDummy: !!t.isEnemyDummy, dealt: d, dmg: t.dmg };
      });
      ok('默认仍是 7 个钢板靶', plate.count === 7 && !plate.isDummy, JSON.stringify(plate));
      ok('meta 不再污染倍率，距衰减仍生效', plate.dealt === 20 && plate.dmg === 20,
        JSON.stringify(plate));

      /* 3. 敌人靶：点真实按钮切换，HP 与护甲来自 ENEMY_TYPES / GEAR */
      await p.locator('#rangePanel [data-dummy="guard"]').click();
      const guard = await p.evaluate(() => {
        const t = Range.targets[0];
        return { count: Range.targets.length, allDummy: Range.targets.every(x => x.isEnemyDummy),
          hp: t.hp, maxHp: t.maxHp, humanless: !t.t.human,
          helmet: !!t.helmet, body: !!t.body, key: t.key };
      });
      ok('切到潮汐守卫生成 7 个敌人靶', guard.count === 7 && guard.allDummy,
        JSON.stringify(guard));
      ok('敌人靶 HP = 175（无甲单位补偿值）', guard.hp === 175 && guard.maxHp === 175,
        JSON.stringify(guard));
      ok('机械造物实战规则下不穿甲', guard.humanless && !guard.helmet && !guard.body,
        JSON.stringify(guard));

      /* 4. 固定护甲档：Lv4 头甲齐全、材质有效、A≈40 */
      await p.locator('#rangePanel [data-armor="4"]').click();
      const armored = await p.evaluate(() => {
        const t = Range.targets[0], g = t.body;
        const mat = g && CFG.MATERIALS[g.material];
        return { lv: g && g.lv, mat: g && g.material, label: mat && mat.label,
          A: g ? Combat.effectiveArmor(g) : null, dur: g && g.dur, max: g && g.max,
          helmetLv: t.helmet && t.helmet.lv };
      });
      ok('Lv4 头甲齐全', armored.lv === 4 && armored.helmetLv === 4, JSON.stringify(armored));
      ok('材质与有效防护值读得到', !!armored.label && Math.abs(armored.A - 40) < 0.01,
        JSON.stringify(armored));

      /* 敌人靶状态下的验收截图：清掉 toast，面板回到顶部 */
      if (file === 'index.html') {
        await p.evaluate(() => {
          Game.toasts = [];
          const el = document.getElementById('rangePanel');
          if (el) el.scrollTop = 0;
          Range.updateReadouts();
        });
        await p.waitForTimeout(200);
        await p.screenshot({ path: path.join(out, 'enemy-dummies.png') });
      }

      /* 5. 真实子弹链路：Bullet.targets() 能打中敌人靶并走 Combat.resolve */
      const shot = await p.evaluate(() => {
        const t = Range.targets[0];
        Game.targets = [t];
        t.hp = t.maxHp; t.dead = false; t.hits = 0;
        const before = { hp: t.hp, helmet: t.helmet.dur, body: t.body.dur };
        const b = new Bullet(t.x - 50, t.y, 0, 620, 'player', 33, 640, 16);
        Game.bullets = [b];
        for (let i = 0; i < 20 && !b.dead; i++) b.update(1 / 60);
        const r = t.lastRes;
        return { hits: t.hits, hp: t.hp, before,
          after: { helmet: t.helmet.dur, body: t.body.dur },
          res: r && { penetrated: r.penetrated, health: r.health,
            durabilityLoss: r.durabilityLoss, A: r.A, material: r.material,
            part: r.part, partMul: r.partMul } };
      });
      ok('子弹命中敌人靶', shot.hits === 1, JSON.stringify(shot));
      /* 从正左水平打靶心会被判爆头，部位倍率在结算之后乘，按 partMul 核对 */
      ok('本发按命中前耐久判定（P16 < A40 → 钝伤）',
        shot.res && shot.res.penetrated === false && shot.res.health > 0 &&
        Math.abs(shot.res.health - 0.08 * 33 * CFG_KB(shot.res.material) * shot.res.partMul) < 1e-6,
        JSON.stringify(shot.res));
      ok('穿透失败仍磨甲，且只磨被命中的那件',
        shot.hp < shot.before.hp &&
        (shot.after[shot.res.part === 'head' ? 'helmet' : 'body'] <
          shot.before[shot.res.part === 'head' ? 'helmet' : 'body']),
        JSON.stringify(shot));

      /* 6. 高穿透弹：同一件甲应穿透、吃全额 B，并同样磨甲 */
      const pen = await p.evaluate(() => {
        const t = Range.targets[0];
        t.hp = t.maxHp; t.dead = false; t.hits = 0;
        const r = t.hurt(33, 'player', 'body', 55, undefined, null, 1);
        return { dealt: r, hp: t.hp, res: t.lastRes && {
          penetrated: t.lastRes.penetrated, health: t.lastRes.health,
          durabilityLoss: t.lastRes.durabilityLoss } };
      });
      ok('P55 ≥ A40 → 穿透吃全额 B33', pen.res.penetrated === true &&
        Math.abs(pen.dealt - 33) < 1e-6, JSON.stringify(pen));
      ok('穿透成功一样磨甲', pen.res.durabilityLoss > 0, JSON.stringify(pen.res));

      /* 7. 击杀枪数与复位 */
      const kill = await p.evaluate(() => {
        const t = Range.targets[0];
        t.reset();
        let n = 0;
        while (!t.dead && n < 100) { t.hurt(47, 'player', 'body', 58, undefined, null, 1); n++; }
        return { shots: n, killed: t.dead, shotsToKill: t.shotsToKill, hp: t.hp };
      });
      ok('可击杀并记录击杀枪数', kill.killed && kill.shots > 0 &&
        kill.shotsToKill === kill.shots && kill.hp === 0, JSON.stringify(kill));
      await p.locator('#rangePanel [data-act="dummy-reset"]').click();
      const reset = await p.evaluate(() => {
        const t = Range.targets[0];
        return { hp: t.hp, dead: t.dead, hits: t.hits, dur: t.body.dur, max: t.body.max };
      });
      ok('复位回满 HP 与护甲耐久', reset.hp === 175 && !reset.dead && reset.hits === 0 &&
        Math.abs(reset.dur - reset.max) < 1e-6, JSON.stringify(reset));

      /* 8. 弹药等级：同口径 Lv1–Lv5，切换即换满弹匣 */
      const ammo = await p.evaluate(() => {
        Range.equip('m4a1');
        Range.setAmmoLevel(5);
        const W = Game.player.weapon;
        return { id: W.id, cal: W.caliber, ammo: W.ammo, mag: Game.player.mag,
          rounds: W.rounds.slice(), spec: BALLISTICS.flesh('556', 5),
          panel: document.querySelector('#rangePanel [data-box="ammo"]').textContent };
      });
      ok('Lv5 装的是 ammo_556_5', ammo.ammo === 'ammo_556_5', ammo.ammo);
      ok('口径不变、弹匣补满且不混弹', ammo.cal === '556' &&
        ammo.mag === ammo.rounds.length && ammo.rounds.every(id => id === 'ammo_556_5'),
        JSON.stringify({ mag: ammo.mag, rounds: ammo.rounds.slice(0, 3) }));
      ok('面板显示 B/P（556 Lv5 = 28/55）',
        ammo.spec.B === 28 && ammo.spec.P === 55 && ammo.panel.includes('B 28 / P 55'),
        ammo.panel.slice(0, 100));
      const shotgun = await p.evaluate(() => {
        Range.equip('rem870');
        Range.setAmmoLevel(4);
        const W = Game.player.weapon;
        return { cal: W.caliber, ammo: W.ammo, rounds: W.rounds.slice(),
          spec: BALLISTICS.flesh('12g', 4) };
      });
      ok('12 Gauge 走兼容表 Lv4 = B11/P18', shotgun.ammo === 'ammo_12g_4' &&
        shotgun.spec.B === 11 && shotgun.spec.P === 18 &&
        shotgun.rounds.every(id => id === 'ammo_12g_4'), JSON.stringify(shotgun));

      /* 8.5 靶场七参数模型：只保留七项，全局滑块全部退休 */
      const keys = ['rpm', 'aimTime', 'recoilVMul', 'recoilHMul', 'spreadGrowthMul', 'spreadMul', 'adsPrecisionMul'];
      const panel = await p.evaluate(() => ({
        n: RANGE_PARAMS.length,
        keys: RANGE_PARAMS.map(x => x.key),
        sliders: [...document.querySelectorAll('#rangePanel .rg-sl')].map(i => i.dataset.p),
        derived: ((document.querySelector('#rangePanel .rg-derived') || {}).textContent || '').trim()
      }));
      ok('调参只剩七项', panel.n === 7 && panel.keys.join(',') === keys.join(','), panel.keys.join(','));
      ok('面板不再有全局滑块', panel.sliders.length === 7 &&
        panel.sliders.every(k => keys.includes(k)), panel.sliders.join(','));
      ok('派生读数显示冲击/增长/散布与全局基准', /纵向冲击/.test(panel.derived) &&
        /连射增长/.test(panel.derived) && /基础 → 满散布/.test(panel.derived) &&
        /改 config\.js 生效/.test(panel.derived), panel.derived.slice(0, 90));

      const tuned = await p.evaluate(() => {
        const set = (k, v) => {
          const el = [...document.querySelectorAll('#rangePanel .rg-sl')].find(i => i.dataset.p === k);
          el.value = String(v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const base = { V: CFG.RECOIL.axis.v.kick, G: CFG.RECOIL.perShot };
        const first = Firearms.derive(Game.player.weapon);
        const mul0 = Game.player.weapon.recoilVMul;
        set('recoilVMul', 2);
        const one = Firearms.derive(Game.player.weapon);
        const textAt2 = ((document.querySelector('#rangePanel .rg-derived') || {}).textContent || '').trim();
        set('recoilVMul', mul0);
        const back = Firearms.derive(Game.player.weapon);
        return { base, first, one, back, mul0, textAt2, mulBack: Game.player.weapon.recoilVMul,
          text: ((document.querySelector('#rangePanel .rg-derived') || {}).textContent || '').trim() };
      });
      ok('滑块改的是倍率，派生冲击 = 全局基准 × 倍率',
        Math.abs(tuned.one.vKick - tuned.base.V * 2) < 1e-9 &&
        Math.abs(tuned.one.growth - tuned.first.growth) < 1e-12 &&
        Math.abs(tuned.back.vKick - tuned.base.V * tuned.mulBack) < 1e-9 &&
        Math.abs(tuned.back.vKick - tuned.first.vKick) < 0.05,
        JSON.stringify(tuned));
      ok('拖动滑块后派生读数同步刷新', tuned.textAt2.includes('6.80') &&
        tuned.textAt2.includes('纵向冲击'), tuned.textAt2.slice(0, 60));
      ok('调参不写全局配置', await p.evaluate(() =>
        CFG.RECOIL.axis.v.kick === 3.4 && CFG.RECOIL.perShot === 0.075));

      /* 8.6 配件：点说明文字也要生效，且配件倍率与调参叠加 */
      await p.evaluate(() => Range.equip('m4a1'));
      await p.locator('#rangePanel [data-slot="muzzle"]').click();
      const pick = await p.evaluate(() => {
        const W = Game.player.weapon;
        const a = Object.values(ATTACHMENT_DEFS).find(d => d.subtype === 'muzzle' &&
          Attachments.compatible(W.id, d.id) && d.statModifiers.recoilVertical);
        return a && { id: a.id, name: a.name, v: a.statModifiers.recoilVertical, base: WEAPONS.m4a1.recoilVMul };
      });
      ok('有会改纵向后坐力的枪口件可测', !!pick, JSON.stringify(pick));
      const partBtn = p.locator('#rangePanel [data-part="' + pick.id + '"]');
      await partBtn.scrollIntoViewIfNeeded();
      const small = await partBtn.locator('small').boundingBox();
      await p.mouse.click(small.x + small.width / 2, small.y + small.height / 2);
      await p.waitForTimeout(80);
      const attached = await p.evaluate(() => {
        const W = Game.player.weapon;
        return { slot: W.attachments.muzzle || null, mul: W.recoilVMul, d: Firearms.derive(W) };
      });
      ok('点在配件说明文字上也能装上（子元素点击回归）',
        attached.slot === pick.id, JSON.stringify(attached));
      ok('配件倍率真的派生到物理冲击',
        Math.abs(attached.d.vKick - 3.4 * attached.mul) < 1e-9 &&
        Math.abs(attached.mul - pick.base * (1 + pick.v)) < 1e-9,
        JSON.stringify({ mul: attached.mul, vKick: attached.d.vKick }));

      const composed = await p.evaluate(() => {
        const el = [...document.querySelectorAll('#rangePanel .rg-sl')].find(i => i.dataset.p === 'recoilVMul');
        el.value = '1.5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        const W = Game.player.weapon;
        return { mul: W.recoilVMul, d: Firearms.derive(W), att: W.attachments.muzzle || null };
      });
      ok('调参与配件相乘而不是互相覆盖',
        composed.att === pick.id &&
        Math.abs(composed.mul - 1.5 * pick.base * (1 + pick.v)) < 1e-9,
        JSON.stringify(composed));
      await p.evaluate(() => Range.onClick({ target: { dataset: { act: 'reset' } } }));
      const afterReset = await p.evaluate(() => ({
        mul: Game.player.weapon.recoilVMul, att: Game.player.weapon.attachments.muzzle || null,
        d: Firearms.derive(Game.player.weapon) }));
      ok('重置本枪只回退调参，已装配件保留',
        afterReset.att === pick.id &&
        Math.abs(afterReset.mul - pick.base * (1 + pick.v)) < 1e-9,
        JSON.stringify(afterReset));
      await p.evaluate(() => Range.setPart('muzzle', null));

      /* 9. 配件调试改装：真实点击装/卸，不扣款不动库存不写存档 */
      const before = await p.evaluate(() => {
        Range.equip('m4a1');
        return { stash: Save.stash.length, credits: Save.credits,
          save: JSON.stringify(Save.gear.weapons), aimTime: Game.player.weapon.aimTime };
      });
      await p.locator('#rangePanel [data-slot="optic"]').click();
      await p.locator('#rangePanel [data-part="att_optic01"]').click();
      const installed = await p.evaluate(() => {
        const W = Game.player.weapon;
        return { slot: W.attachments.optic, aimTime: W.aimTime,
          stash: Save.stash.length, credits: Save.credits,
          save: JSON.stringify(Save.gear.weapons),
          panel: document.querySelector('#rangePanel [data-box="parts"]').textContent };
      });
      ok('配件装上并即时改变属性', installed.slot === 'att_optic01' &&
        Math.abs(installed.aimTime - before.aimTime * 0.88) < 1e-6,
        JSON.stringify({ before: before.aimTime, after: installed.aimTime }));
      ok('调试改装不扣款、不动库存、不写存档',
        installed.stash === before.stash && installed.credits === before.credits &&
        installed.save === before.save, JSON.stringify({ before, installed }));
      ok('配件面板列出词条', installed.panel.includes('微型反射瞄具') ||
        installed.panel.includes('瞄准时间'), installed.panel.slice(0, 100));
      await p.locator('#rangePanel [data-part=""]').first().click();
      const removed = await p.evaluate(() => {
        const W = Game.player.weapon;
        return { slot: W.attachments.optic || null, aimTime: W.aimTime };
      });
      ok('拆卸回原装', removed.slot === null &&
        Math.abs(removed.aimTime - before.aimTime) < 1e-6, JSON.stringify(removed));

      /* 10. 切回钢板靶，双入口无脚本错误 */
      await p.locator('#rangePanel [data-dummy="none"]').click();
      const back = await p.evaluate(() => ({
        allPlate: Range.targets.every(x => !x.isEnemyDummy && x.isRangeTarget),
        key: Range.dummyKey }));
      ok('钢板靶可切回', back.allPlate && back.key === 'none', JSON.stringify(back));
      ok('无页面脚本错误', errors.length === 0, errors.join(' | '));

      /* 11. 旧版（v1）本地调参迁移：世界单位折成倍率，全局滑块丢弃 */
      const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await p2.addInitScript(() => {
        try {
          localStorage.clear();
          localStorage.setItem('tide.range.tune.v1', JSON.stringify({
            w: { m4a1: { rpm: 700, recoilPerShot: 0.15, spreadBase: 0.06, spreadMax: 0.39, speed: 900 } },
            g: { vKick: 6, decay: 1.2 }, cur: 'm4a1'
          }));
        } catch (e) {}
      });
      await p2.goto(pathToFileURL(path.join(root, file)).href + '#range');
      await p2.waitForFunction(() => typeof Range !== 'undefined' && Range.active);
      const mig = await p2.evaluate(() => ({
        rpm: Range.w.m4a1.rpm, g: Range.w.m4a1.spreadGrowthMul, sm: Range.w.m4a1.spreadMul,
        live: Game.player.weapon.rpm, global: CFG.RECOIL.axis.v.kick
      }));
      ok('v1 调参迁移成倍率', mig.rpm === 700 &&
        Math.abs(mig.g - 0.15 / 0.075) < 1e-3 && Math.abs(mig.sm - 1.5) < 1e-3,
        JSON.stringify(mig));
      ok('迁移后立即写进武器，全局常量不受旧滑块影响',
        mig.live === 700 && mig.global === 3.4, JSON.stringify(mig));
      await p2.close();

      /* 截图前把面板滚回顶部，验收图要拍到七项手感 */
      await p.evaluate(() => { const el = document.getElementById('rangePanel'); if (el) el.scrollTop = 0; });
      await p.waitForTimeout(60);
      await p.screenshot({ path: path.join(out, (file === 'index.html' ? '' : 'offline-') + 'panel.png') });
      await p.close();
    }
    console.log('PASS: 开发版＋离线版 靶场战斗测试台 ' + n + ' 项断言全绿');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

/* 材质钝伤倍率（与 CFG.MATERIALS 同表，测试里独立写一份便于离线环境取用） */
function CFG_KB(id) {
  return ({ aramid: 1.25, pe: 0.90, ceramic: 0.55, steel: 0.75 })[id] || 1;
}
