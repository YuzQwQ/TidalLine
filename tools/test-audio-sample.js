/* 采样音效：内联加载、时长校验、多段序列、降级。
   用法：node tools/test-audio-sample.js */
const path = require('path');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const man = require('../assets/audio/manifest.json');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    /* ---------- 1. 单文件版：8 段采样全部解码，时长对得上 ---------- */
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(pathToFileURL(path.join(ROOT, '潮汐线.html')).href + '#base');
    await page.waitForFunction(() => typeof SFX !== 'undefined' && Game.state === 'base');

    const injected = await page.evaluate(() => Object.keys(window.__AUDIO__ || {}));
    assert.equal(injected.length, man.assets.length, '内联的音频数量');
    assert.deepEqual(injected.sort(), man.assets.map(a => a.id).sort(), '内联 id 与 manifest 一致');

    /* init 会建 AudioContext 并异步 load */
    await page.evaluate(() => SFX.init());
    const loaded = await page.evaluate(async () => {
      await SFX.load();
      const out = {};
      for (const id of Object.keys(SFX.samples)) {
        out[id] = { dur: +SFX.samples[id].duration.toFixed(3), ch: SFX.samples[id].numberOfChannels };
      }
      return out;
    });
    assert.equal(Object.keys(loaded).length, man.assets.length, '解码成功的段数');
    for (const a of man.assets) {
      assert(loaded[a.id], a.id + ' 已解码');
      assert(Math.abs(loaded[a.id].dur - a.dur) < 0.02, a.id + ' 时长对得上 manifest');
      assert.equal(loaded[a.id].ch, 1, a.id + ' 是单声道');
    }

    /* ---------- 2. 换弹序列：三段按 0 / 0.55 / 1.05 排，长度落在 1.5s 内 ---------- */
    const seq = await page.evaluate(() => SFX.SEQ.reload);
    assert.equal(seq.length, 3, '换弹分三段');
    assert.deepEqual(seq.map(x => x[1]), [0, 0.55, 1.05], '时间轴');
    const last = man.assets.find(a => a.id === seq[2][0]);
    const tail = seq[2][1] + last.dur;
    assert(tail <= 1.5 + 1e-6, '末段收在换弹 1.5 秒之内，实际 ' + tail.toFixed(3) + 's');

    /* stopSeq 要能掐掉没播的段：起播后立刻停，定时器应清空 */
    const stopped = await page.evaluate(() => {
      SFX.play('reload');
      const had = (SFX.seqTimers.reload || []).length;
      SFX.stopSeq('reload');
      return { had, after: (SFX.seqTimers.reload || []).length };
    });
    assert.equal(stopped.had, 2, '除首段外还有两个定时器');
    assert.equal(stopped.after, 0, 'stopSeq 清干净');

    /* ---------- 3. 采样优先：有采样的名字不会落到合成分支 ---------- */
    const routed = await page.evaluate(() => {
      const seen = [];
      const orig = SFX._playSample.bind(SFX);
      SFX._playSample = (id, o) => { seen.push(id); return orig(id, o); };
      SFX.play('shot_switch');
      SFX.play('step_stone_3', { rate: 1.02 });
      SFX._playSample = orig;
      return seen;
    });
    assert.deepEqual(routed, ['shot_switch', 'step_stone_3'], '有采样时走采样');

    /* ---------- 4. 调用点：换枪走 shot_switch、换弹走 reload、打断时掐序列 ---------- */
    const ent = require('fs').readFileSync(path.join(ROOT, 'js/entities.js'), 'utf8');
    const switchBody = /switchWeapon\(i\)\s*\{([\s\S]*?)\n  \}/.exec(ent);
    assert(switchBody, '找得到 switchWeapon');
    /* 换枪音可以按枪型覆盖（霰弹有专属泵动声），但必须回落到 shot_switch */
    assert(/sfx\([^)]*'shot_switch'\)/.test(switchBody[1]), '换枪播 shot_switch 或其变体');
    assert(!/sfx\('reload'\)/.test(switchBody[1]), '换枪不再误播换弹声');
    assert(/SFX\.stopSeq\('reload'\)/.test(switchBody[1]), '换枪掐掉换弹序列');
    const reloadBody = /tryReload\(\)\s*\{([\s\S]*?)\n  \}/.exec(ent);
    assert(reloadBody, '找得到 tryReload');
    assert(/sfx\('reload'\)/.test(reloadBody[1]), '换弹开始播 reload');
    assert(/step_stone_/.test(ent), '玩家脚步已接入');
    await page.close();

    /* ---------- 5. 多文件版：bundle.js 让双击也能有声音；拿掉后静默降级 ---------- */
    const plain = await browser.newPage();
    const perr = [];
    plain.on('pageerror', e => perr.push(String(e)));
    await plain.goto(pathToFileURL(path.join(ROOT, 'index.html')).href + '#base');
    await plain.waitForFunction(() => typeof SFX !== 'undefined');

    const multi = await plain.evaluate(async () => {
      SFX.init();
      const n = await SFX.load();
      return { n, ids: Object.keys(SFX.samples).sort() };
    });
    assert.equal(multi.n, man.assets.length, '多文件版靠 bundle.js 也拿到全部采样');
    assert.deepEqual(multi.ids, man.assets.map(a => a.id).sort());

    /* 模拟没有内联数据（旧浏览器 / 文件缺失）：不崩，退回合成音 */
    const fallback = await plain.evaluate(async () => {
      delete window.__AUDIO__;
      SFX.samples = {}; SFX.loading = null;
      const n = await SFX.load();
      SFX.play('reload');              // 走合成音分支
      SFX.play('step_stone_1');        // 没有采样，静默跳过
      return { loaded: n, hasSamples: Object.keys(SFX.samples).length, on: SFX.on };
    });
    assert.equal(fallback.loaded, 0, '没有数据时加载到 0 段');
    assert.equal(fallback.hasSamples, 0);
    assert.equal(fallback.on, true, '降级后合成音仍可用');
    await plain.close();

    assert.deepEqual(errs, [], '单文件版无脚本错误');
    assert.deepEqual(perr, [], '多文件版无脚本错误');
    console.log('OK: ' + man.assets.length + ' 段采样内联解码、时长对齐 manifest、换弹三段序列收在 1.5s、' +
      '有采样时优先采样、删掉 __AUDIO__ 后静默退回合成音');
  } finally {
    await browser.close();
  }
})();
