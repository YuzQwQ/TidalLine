/* 四类命中声的解码、峰值与真实近战结算；多文件/离线版都必须可用。 */
const assert = require('assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--mute-audio', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const file of ['index.html', '潮汐线.html']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(pathToFileURL(path.join(root, file)).href + '#play');
      await page.waitForFunction(() => typeof Game !== 'undefined' && Game.player && Game.state === 'playing');
      const result = await page.evaluate(async () => {
        cancelAnimationFrame(Game._frameId);Game._frameId = null;
        SFX.unlock();await SFX.load();
        const ids = ['melee_hit_small', 'melee_hit_medium', 'melee_hit_large', 'melee_hit_stab'];
        const ready = ids.every(id => SFX.samples[id] && SFX._targetFor(id) === SFX.LOUD.meleeHit);
        const peaks = ids.map(id => SFX._peak(SFX.samples[id]) * SFX.gainOf[id]);
        const played = [], real = SFX._playSample.bind(SFX);
        SFX._playSample = (id, opts) => { if (ids.includes(id)) played.push(id);return real(id, opts); };
        MeleeGeometry.blockers = () => [];
        const p = Game.player, swings = [];
        for (const id of ['melee01', 'melee02', 'melee03', 'melee04', 'melee05', 'melee06', 'melee07']) {
          p.melee = EQUIP.melee(id);p.meleeActive = true;p.meleeAttack = null;
          p.meleeClock = 0;p.meleeReadyAt = 0;p.angle = 0;
          Game.bagOpen = false;Game.lootOpen = null;
          const e = new Enemy('scav', p.x + 20, p.y);e.hp = 100;
          Game.enemies = [e, new Enemy('scav', p.x + 19, p.y + 1)];
          const start = played.length;
          const ok = MeleeSystem.attack(p);
          MeleeSystem.tick(p, MeleeSystem.def(p.melee).windup);
          MeleeSystem.tick(p, .001);
          swings.push({ ok, sounds: played.slice(start), hp: e.hp });
        }
        // 刺击采样已入库且可播放；不新增尚未推出的武器。
        SFX.play('melee_hit_stab');
        return { ready, peaks, swings, last: played.at(-1) };
      });
      assert(result.ready, file + ' missing decoded sample');
      assert(result.peaks.every(p => p > 0 && p <= .951), file + ' clipping');
      for (const [i, kind] of ['small', 'medium', 'large', 'stab', 'small', 'medium', 'large'].entries()) {
        assert(result.swings[i].ok);
        assert.deepEqual(result.swings[i].sounds, ['melee_hit_' + kind]);
        assert.equal(result.swings[i].hp, [88, 82, 74, 68, 90, 78, 70][i]);
      }
      assert.equal(result.last, 'melee_hit_stab');
      assert.deepEqual(errors, []);
      console.log('PASS: ' + file + ' four samples decoded, safe peaks, seven real weapon hits, one sound per swing');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e);process.exit(1); });
