/* 枪声分层试听/导出的回归：参数没被改、层可独立、同种子可复现、WAV 头正确。
   用法：node tools/test-audio-layers.js */
const path = require('path');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
    await page.waitForFunction(() => typeof SFX !== 'undefined');
    await page.evaluate(() => SFX.init());

    /* ---------- 1. 分层名单 ---------- */
    const layers = await page.evaluate(() => SFX.SHOT_LAYERS);
    assert.deepEqual(layers, ['crack', 'body', 'sub', 'tail', 'mech'], '五层名字与顺序');

    /* ---------- 2. 合成参数保持原样（这轮只加功能，不动音色） ---------- */
    const gun = await page.evaluate(() => JSON.parse(JSON.stringify(SFX.GUN)));
    const pick = g => {
      const out = { vol: g.vol, drive: g.drive };
      if (g.crack) out.crack = [g.crack.freq, g.crack.gain, g.crack.dur];
      if (g.body) out.body = [g.body.from, g.body.to, g.body.gain, g.body.dur];
      if (g.sub) out.sub = [g.sub.from, g.sub.to, g.sub.gain, g.sub.dur];
      if (g.tail) out.tail = [g.tail.freq, g.tail.gain, g.tail.dur, g.tail.at];
      if (g.mech) out.mech = [g.mech.freq, g.mech.gain, g.mech.dur, g.mech.at];
      return out;
    };
    assert.deepEqual(pick(gun.rifle), {
      vol: 1, drive: 2,
      crack: [3400, 0.55, 0.03], body: [5200, 520, 0.95, 0.17],
      sub: [150, 46, 0.7, 0.2], tail: [1000, 0.16, 0.32, 0.02],
      mech: [2400, 0.07, 0.02, 0.008]
    }, '步枪参数未被改动');
    assert.deepEqual(pick(gun.shotgun), {
      vol: 0.82, drive: 2.6,
      crack: [2200, 0.3, 0.05], body: [3600, 260, 1, 0.24],
      sub: [95, 32, 0.95, 0.3], tail: [800, 0.22, 0.42, 0.03]
    }, '霰弹参数未被改动（本来就没有 mech 层）');
    assert.equal(gun.smg.vol, 0.95, '冲锋枪 vol');
    assert.equal(gun.pistol.mech.at, 0.055, '手枪枪机延后 55ms');
    const cal = await page.evaluate(() => SFX.CAL.shot);
    assert.equal(cal, 0.62, '总线 CAL.shot 未变');

    /* ---------- 3. 同种子 → 可复现；换种子 → 不同 ----------
       单层是逐采样完全一致的；多层混音会带进约 1e-6 的浮点差
       （WebAudio 混音求和 + 2x 过采样削波的舍入），量化成 16bit 后
       最多几个采样差 1 LSB（约 -90dB，听不出）。这里按实测口径断言。 */
    const det = await page.evaluate(async () => {
      const twice = async (layers) => {
        SFX.setSeed(7);
        const a = await SFX.renderShot('rifle', { layers }, 0.9);
        SFX.setSeed(7);
        const b = await SFX.renderShot('rifle', { layers }, 0.9);
        const x = a.getChannelData(0), y = b.getChannelData(0);
        let f = 0;
        for (let i = 0; i < x.length; i++) f = Math.max(f, Math.abs(x[i] - y[i]));
        const wa = new Uint8Array(SFX.toWav(a)), wb = new Uint8Array(SFX.toWav(b));
        let bytes = 0;
        for (let i = 0; i < wa.length; i++) if (wa[i] !== wb[i]) bytes++;
        return { float: f, bytes, len: x.length, rate: a.sampleRate };
      };
      const solo = await twice(['crack']);
      const mix = await twice(undefined);
      SFX.setSeed(8);
      const c = await SFX.renderShot('rifle', {}, 0.9);
      SFX.setSeed(7);
      const d = await SFX.renderShot('rifle', {}, 0.9);
      const dc = c.getChannelData(0), dd = d.getChannelData(0);
      let other = 0;
      for (let i = 0; i < dc.length; i++) other = Math.max(other, Math.abs(dc[i] - dd[i]));
      return { solo, mix, other, len: dc.length, rate: c.sampleRate };
    });
    assert.equal(det.rate, 44100, '导出采样率');
    assert.equal(det.solo.float, 0, '单层同种子逐采样完全一致');
    assert.equal(det.solo.bytes, 0, '单层导出的 WAV 逐字节一致');
    assert(det.mix.float < 1e-4, '多层混音浮点差 < 1e-4，实际 ' + det.mix.float.toExponential(1));
    assert(det.mix.bytes <= 60, '多层混音量化后只有零星采样不同，实际差 ' + det.mix.bytes + ' 字节（共 ' + (det.mix.len * 2) + '）');
    assert(det.other > 1e-3, '换种子结果不同，最大差 ' + det.other.toExponential(1));

    /* ---------- 4. 单层：只合成被点名的那层 ---------- */
    const one = await page.evaluate(async () => {
      SFX.setSeed(7);
      await SFX.renderShot('rifle', { layers: ['sub'] }, 0.6);
      const rec = SFX.lastShot;
      const buf = await SFX.renderShot('rifle', { layers: ['sub'] }, 0.6);
      const d = buf.getChannelData(0);
      const rms = (a, b) => {
        let s = 0;
        for (let i = a; i < b; i++) s += d[i] * d[i];
        return Math.sqrt(s / Math.max(1, b - a));
      };
      // 30–60ms 窗口：sub 还在，crack/body 已经衰掉大半
      return { names: rec.layers.map(l => l.name), omitted: rec.omitted, early: rms(0, 2205), late: rms(13230, 15435) };
    });
    assert.deepEqual(one.names, ['sub'], '只合成 sub');
    assert.deepEqual(one.omitted, ['crack', 'body', 'tail', 'mech'], '其余层被记录为未启用');
    assert(one.early > 0.002, 'sub 起始段有声，RMS ' + one.early.toFixed(4));
    assert(one.late < one.early / 3, 'sub 到 300ms 已明显衰减');

    /* ---------- 5. 组合：关掉一层必须真的不一样 ---------- */
    const combo = await page.evaluate(async () => {
      const render = async (ly) => {
        SFX.setSeed(3);
        return SFX.renderShot('pistol', { layers: ly }, 0.6);
      };
      const rms = buf => {
        const d = buf.getChannelData(0);
        let s = 0;
        for (let i = 0; i < d.length; i++) s += d[i] * d[i];
        return Math.sqrt(s / d.length);
      };
      const all = await render(['crack', 'body', 'sub', 'tail', 'mech']);
      const noMech = await render(['crack', 'body', 'sub', 'tail']);
      const crackOnly = await render(['crack']);
      const da = all.getChannelData(0), db = noMech.getChannelData(0);
      let maxDiff = 0;
      for (let i = 0; i < da.length; i++) maxDiff = Math.max(maxDiff, Math.abs(da[i] - db[i]));
      return {
        rmsAll: rms(all), rmsCrack: rms(crackOnly), maxDiff,
        lastNames: SFX.lastShot.layers.map(l => l.name)
      };
    });
    assert.equal(combo.lastNames.length, 1, '最后一次只渲染了 crack');
    assert(combo.rmsAll > combo.rmsCrack, '整体比单层响');
    /* mech 只有 22ms、增益 0.1，对整段 RMS 的影响小于 1e-4，
       要逐采样比才看得出来 */
    assert(combo.maxDiff > 0.001, '去掉 mech 后波形确实变了，最大差 ' + combo.maxDiff.toFixed(4));

    /* ---------- 6. 归一模式：每层拉到同一 RMS（口径要和页面一致：只算有声段） ---------- */
    const norm = await page.evaluate(async () => {
      const activeRms = buf => {
        const d = buf.getChannelData(0);
        let first = -1, last = -1;
        for (let i = 0; i < d.length; i++) {
          if (Math.abs(d[i]) > 0.0005) { if (first < 0) first = i; last = i; }
        }
        if (first < 0) return 0;
        let s = 0;
        for (let i = first; i <= last; i++) s += d[i] * d[i];
        return Math.sqrt(s / (last - first + 1));
      };
      const out = {};
      for (const l of ['crack', 'body', 'tail']) {
        /* 和页面同一套迭代：tanh 削波是非线性的，单次换算到不了目标 */
        let mul = 1, r = 0;
        for (let i = 0; i < 4; i++) {
          SFX.setSeed(1);
          r = activeRms(await SFX.renderShot('rifle', { layers: [l], layerVol: { [l]: mul } }, 0.6)) || 1e-4;
          if (Math.abs(r - 0.05) / 0.05 < 0.01) break;
          const next = Math.min(20, Math.max(0.02, mul * (0.05 / r)));
          if (next === mul) break;
          mul = next;
        }
        out[l] = mul;
        out[l + 'Rms'] = r;
      }
      return out;
    });
    assert(norm.tail > norm.crack, '尾音需要更大的乘子才追得上脆响，' +
      norm.crack.toFixed(2) + ' → ' + norm.tail.toFixed(2));
    for (const k of ['crackRms', 'bodyRms', 'tailRms']) {
      assert(Math.abs(norm[k] - 0.05) < 0.004, k + ' 归一后接近目标 RMS，实际 ' + norm[k].toFixed(4));
    }

    /* ---------- 7. WAV 头 ---------- */
    const wav = await page.evaluate(async () => {
      SFX.setSeed(7);
      const buf = await SFX.renderShot('smg', {}, 0.5);
      const ab = SFX.toWav(buf);
      const v = new DataView(ab);
      const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
      return {
        bytes: ab.byteLength, riff: tag(0), wave: tag(8), fmt: tag(12), data: tag(36),
        channels: v.getUint16(22, true), rate: v.getUint32(24, true),
        bits: v.getUint16(34, true), dataLen: v.getUint32(40, true)
      };
    });
    assert.equal(wav.riff, 'RIFF'); assert.equal(wav.wave, 'WAVE');
    assert.equal(wav.fmt, 'fmt '); assert.equal(wav.data, 'data');
    assert.equal(wav.channels, 1, '单声道');
    assert.equal(wav.rate, 44100);
    assert.equal(wav.bits, 16, '16bit');
    assert.equal(wav.dataLen, wav.bytes - 44, '数据长度与文件长度对得上');

    assert.deepEqual(errs, [], '没有脚本错误');
    console.log('OK: 五层名单、参数未改、单层/组合/归一、同种子逐采样一致、WAV 头正确');
  } finally {
    await browser.close();
  }
})();
