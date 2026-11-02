/* 响度体检：把每条合成音离线渲染一遍，量出真实 RMS / 峰值，
   对照 SFX.LOUD 里的目标值，直接给出该填进 SFX.CAL（以及各枪 vol）的系数。
   用法：node tools/audio-levels.js [--json]
   采样（wav）直接读解码后的 buffer 算，不需要重新渲染。 */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

/* 要测的合成音。shot 每把枪单独测，因为 vol 是各枪自己的。 */
const SYNTH = [
  { name: 'shot', opts: { gun: 'rifle' }, label: 'shot/rifle', target: 'shot' },
  { name: 'shot', opts: { gun: 'shotgun' }, label: 'shot/shotgun', target: 'shot' },
  { name: 'shot', opts: { gun: 'smg' }, label: 'shot/smg', target: 'shot' },
  { name: 'shot', opts: { gun: 'pistol' }, label: 'shot/pistol', target: 'shot' },
  { name: 'enemyShot', target: 'enemyShot' },
  { name: 'hit', target: 'hit' },
  { name: 'headshot', target: 'headshot' },
  { name: 'break', target: 'break' },
  { name: 'reload', target: 'reload' },
  { name: 'melee', target: 'melee' },
  { name: 'dodge', target: 'dodge' },
  { name: 'door', target: 'door' },
  { name: 'pickup', target: 'pickup' },
  { name: 'search', target: 'search' },
  { name: 'drop', target: 'drop' },
  { name: 'hurt', target: 'hurt' },
  { name: 'extract', target: 'extract' },
  { name: 'death', target: 'death' }
];

const db = x => 20 * Math.log10(Math.max(x, 1e-9));
const f2 = x => Number(x.toFixed(3));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
    await page.waitForFunction(() => typeof SFX !== 'undefined');

    /* 多文件版要先把采样 load 进来，采样那半张表才有数 */
    await page.evaluate(async () => { SFX.init(); await SFX.load(); });

    const rows = await page.evaluate(async (SYNTH) => {
      /* RMS 只统计"有声段"：合成音渲染窗留了 1.6 秒尾巴，
         整段算会把静音也平均进去，短促的声音会被量得偏轻一大截。 */
      const rmsOf = buf => {
        let peak = 0, first = -1, last = -1;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > peak) peak = a;
            if (a > 0.0005) { if (first < 0) first = i; last = i; }
          }
        }
        if (first < 0) return { rms: 0, peak: 0, dur: 0, bright: 0 };
        let sum = 0, n = 0, cross = 0, prev = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = first; i <= last; i++) {
            sum += d[i] * d[i]; n++;
            if (i > first && ((d[i] >= 0) !== (prev >= 0))) cross++;
            prev = d[i];
          }
        }
        /* 过零率当"亮度"的替身：和频谱重心同向变化，够用来判断
           "冲锋枪该比霰弹枪亮"这种事 */
        const bright = cross / 2 / ((last - first + 1) / buf.sampleRate) / 1000;
        return {
          rms: Math.sqrt(sum / Math.max(1, n)),
          peak,
          dur: (last - first + 1) / buf.sampleRate,
          bright
        };
      };

      const out = [];

      /* --- 合成音：换到离线上下文渲染，绕开总线压缩器，量的是"进压缩器之前" --- */
      for (const c of SYNTH) {
        const rate = 44100, dur = 1.6;
        const off = new OfflineAudioContext(1, Math.round(rate * dur), rate);
        const old = { ctx: SFX.ctx, master: SFX.master, noise: SFX.noiseBuf };
        SFX.ctx = off;
        SFX.master = off.destination;
        const nb = off.createBuffer(1, off.sampleRate, off.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        SFX.noiseBuf = nb;
        try { SFX.play(c.name, c.opts); } catch (e) { out.push({ label: c.label || c.name, error: String(e) }); }
        SFX.ctx = old.ctx; SFX.master = old.master; SFX.noiseBuf = old.noise;
        const buf = await off.startRendering();
        const m = rmsOf(buf);
        out.push({
          label: c.label || c.name, kind: 'synth', targetKey: c.target,
          target: SFX.LOUD[c.target], rms: m.rms, peak: m.peak, dur: m.dur, bright: m.bright,
          cal: SFX.CAL[c.name] != null ? SFX.CAL[c.name] : 1
        });
      }

      /* --- 采样：直接量解码后的 buffer，乘上 gainOf 就是实际播出来的响度 --- */
      for (const id of Object.keys(SFX.samples).sort()) {
        const m = rmsOf(SFX.samples[id]);
        const gain = SFX.gainOf[id];
        out.push({
          label: id, kind: 'sample', targetKey: null,
          target: SFX._targetFor(id), rms: m.rms * gain, peak: m.peak * gain, bright: m.bright,
          cal: gain, raw: m.rms
        });
      }
      return out;
    }, SYNTH);

    /* ---- 输出 ---- */
    const fmt = (label, targetKey, target, rms, peak, dur, bright, extra) => {
      const d = db(rms) - db(target);
      const mark = Math.abs(d) <= 2 ? '  ' : (d > 0 ? '响' : '轻');
      const head = db(peak) > -0.5 ? '!' : ' ';
      return [
        label.padEnd(16),
        (targetKey || '-').padEnd(10),
        f2(target).toFixed(3).padStart(6),
        f2(rms).toFixed(3).padStart(6),
        (d >= 0 ? '+' : '') + d.toFixed(1) + 'dB'.padStart(3),
        mark,
        head + '峰' + db(peak).toFixed(1).padStart(6) + 'dB',
        (dur != null ? dur.toFixed(2) + 's' : '     ').padStart(6),
        (bright != null ? bright.toFixed(1) + 'kHz' : '      ').padStart(7),
        extra
      ].join(' ');
    };

    console.log('\n音色 / 目标项        目标RMS 实测RMS  偏差    峰值(-0dBFS=满)  时长   亮度');
    console.log('-'.repeat(96));
    const calOut = {}, volOut = {};
    for (const r of rows) {
      if (r.error) { console.log(r.label.padEnd(16) + ' 渲染失败: ' + r.error); continue; }
      const d = db(r.rms) - db(r.target);
      const extra = r.kind === 'sample' ? 'gain=' + f2(r.cal) : 'CAL=' + f2(r.cal);
      console.log(fmt(r.label, r.targetKey, r.target, r.rms, r.peak, r.dur, r.bright, extra));
      if (r.kind === 'synth') {
        const next = f2(r.cal * Math.pow(10, -d / 20));
        if (r.label.startsWith('shot/')) volOut[r.label.slice(5)] = next;
        else calOut[r.label] = next;
      }
    }

    console.log('\n---- 建议填进 js/ui.js ----');
    const calLines = Object.entries(calOut).map(([k, v]) => `${k}: ${v}`).join(', ');
    console.log('CAL: { ' + calLines + ' }');
    console.log('GUN vol: ' + Object.entries(volOut).map(([k, v]) => `${k}: ${v}`).join(', '));
    console.log('（CAL 是相对当前值的修正系数，乘上去即可；重跑本工具应回到 ±2dB 内）');

    if (errs.length) console.log('\n页面错误: ' + errs.join(' | '));
    if (process.argv.includes('--json')) console.log('\n' + JSON.stringify(rows, null, 1));
  } finally {
    await browser.close();
  }
})();
