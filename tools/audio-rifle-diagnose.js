/* 步枪开火音诊断：按 tools/rifle-variants.js 的定义渲染 A/B/C 三版，
   统一响度后导出 WAV，并额外导出 Crack / Body / Sub 的分层 WAV，最后打印诊断表。
   用法：node tools/audio-rifle-diagnose.js */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const VARIANTS = require('./rifle-variants');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'audio-rifle-diag');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
    await page.waitForFunction(() => typeof SFX !== 'undefined');
    await page.evaluate(() => SFX.init());
    /* 变体定义要在页面里跑，函数没法跨进程传，所以整份脚本注进去 */
    await page.addScriptTag({ path: path.join(__dirname, 'rifle-variants.js') });

    const result = await page.evaluate(async () => {
      const V = window.RIFLE_VARIANTS;
      const base = SFX.GUN.rifle;
      const mk = v => (v.patch ? v.patch(base) : JSON.parse(JSON.stringify(base)));

      const b64 = u8 => {
        let s = '';
        const chunk = 0x8000;
        for (let i = 0; i < u8.length; i += chunk) {
          s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
        }
        return btoa(s);
      };

      /* 只统计有声段：短促的声音按整段平均会被静音稀释 */
      const info = buf => {
        const d = buf.getChannelData(0);
        let first = -1, last = -1, peak = 0, peakAt = 0;
        for (let i = 0; i < d.length; i++) {
          const a = Math.abs(d[i]);
          if (a > peak) { peak = a; peakAt = i; }
          if (a > 0.0005) { if (first < 0) first = i; last = i; }
        }
        if (first < 0) return { rms: 0, rms120: 0, peak: 0, dur: 0, peakMs: 0, first: 0, last: 0 };
        let s = 0;
        for (let i = first; i <= last; i++) s += d[i] * d[i];
        /* 响度口径：起音后固定 120ms 窗口。用*整段*平均会惩罚短促的声音——
           3ms 瞬态 + 85ms 爆裂 和 220ms 的轰 比平均功率，短的永远吃亏。
           固定窗口比的是"最响那一下有多狠"，A/B/C 才公平。 */
        const wEnd = Math.min(last, first + Math.round(0.12 * buf.sampleRate));
        let s120 = 0;
        for (let i = first; i <= wEnd; i++) s120 += d[i] * d[i];
        return {
          rms: Math.sqrt(s / (last - first + 1)),
          rms120: Math.sqrt(s120 / Math.max(1, wEnd - first + 1)),
          peak,
          dur: (last - first + 1) / buf.sampleRate,
          peakMs: (peakAt / buf.sampleRate) * 1000,
          first, last
        };
      };

      /* 频段能量：把渲染结果分别过一遍带通，量 RMS 占比 */
      const BANDS = [[60, 150], [150, 400], [400, 1000], [1000, 3000], [3000, 8000], [8000, 16000]];
      const bandRms = async (buf, f0, f1) => {
        const off = new OfflineAudioContext(1, buf.length, buf.sampleRate);
        const s = off.createBufferSource();
        s.buffer = buf;
        const bp = off.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = Math.sqrt(f0 * f1);
        bp.Q.value = Math.max(0.4, (f1 - f0) / Math.sqrt(f0 * f1) * 1.2);
        s.connect(bp); bp.connect(off.destination); s.start(0);
        const r = await off.startRendering();
        const d = r.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        return Math.sqrt(sum / d.length);
      };
      const bands = async buf => {
        const vals = [];
        for (const [a, z] of BANDS) vals.push(await bandRms(buf, a, z));
        const tot = Math.sqrt(vals.reduce((s, v) => s + v * v, 0)) || 1;
        return vals.map(v => Math.round(v / tot * 100));
      };

      /* 解一个整体 vol，让有声段 RMS 落在目标上，同时峰值不超上限 */
      const solve = async (profile, layers) => {
        let vol = 1, best = null, bestScore = Infinity;
        for (let i = 0; i < 8; i++) {
          SFX.setSeed(V.seed);
          const buf = await SFX.renderShot('rifle', { profile, layers, vol }, 1.0);
          const m = info(buf);
          const feasible = m.peak <= V.maxPeak;
          const score = feasible ? Math.abs(Math.log(m.rms120 / V.targetRms)) : 100 + m.peak;
          if (score < bestScore) { bestScore = score; best = { buf, m, vol }; }
          if (feasible && score < 0.02) break;
          vol *= feasible ? V.targetRms / m.rms120 : (V.maxPeak / m.peak) * 0.92;
        }
        return best;
      };

      /* 导出时裁掉尾部静音：留 5ms 头、20ms 尾 */
      const trimmed = (buf, m) => SFX.toWav(buf, Math.max(0, m.first - 220), Math.min(buf.length, m.last + 882));

      const out = { versions: {}, layers: {}, seed: V.seed };

      for (const key of Object.keys(V.versions)) {
        const v = V.versions[key];
        const prof = mk(v);
        const best = await solve(prof, v.layers);
        const b = await bands(best.buf);
        out.versions[key] = {
          label: v.label, note: v.note, layers: v.layers, vol: best.vol,
          rms: best.m.rms, rms120: best.m.rms120, peak: best.m.peak, dur: best.m.dur, peakMs: best.m.peakMs,
          bands: b, wav: b64(new Uint8Array(trimmed(best.buf, best.m))),
          chain: SFX.lastShot.chain
        };
      }

      /* 分层导出：用该版本解出来的同一个 vol 与同一个种子，方便直接叠听对比 */
      const layerSets = { A: ['crack', 'body', 'sub'], C: ['crack', 'body'] };
      for (const key of Object.keys(layerSets)) {
        const v = V.versions[key];
        const prof = mk(v);
        for (const layer of layerSets[key]) {
          SFX.setSeed(V.seed);
          const buf = await SFX.renderShot('rifle', { profile: prof, layers: [layer], vol: out.versions[key].vol }, 1.0);
          const m = info(buf);
          out.layers[key + '_' + layer] = {
            rms: m.rms, rms120: m.rms120, peak: m.peak, dur: m.dur, peakMs: m.peakMs,
            bands: await bands(buf),
            wav: b64(new Uint8Array(trimmed(buf, m)))
          };
        }
      }
      return out;
    });

    /* ---------- 落盘 ---------- */
    const write = (name, b64) => {
      const file = path.join(OUT, name);
      fs.writeFileSync(file, Buffer.from(b64, 'base64'));
      return file;
    };
    const written = [];
    for (const k of Object.keys(result.versions)) written.push(write('rifle_' + k + '.wav', result.versions[k].wav));
    for (const k of Object.keys(result.layers)) written.push(write('rifle_' + k + '.wav', result.layers[k].wav));

    /* ---------- 诊断表 ---------- */
    const db = x => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
    const pct = a => a.map(v => String(v).padStart(4)).join('');
    console.log('\n版本 / 层          RMS120  整段RMS  峰(dBFS) 峰时刻  时长   频段占比 60-150/150-400/400-1k/1-3k/3-8k/8k+');
    console.log('-'.repeat(110));
    for (const k of Object.keys(result.versions)) {
      const v = result.versions[k];
      console.log((k + ' ' + v.label).padEnd(18) + v.rms120.toFixed(4) + '  ' + v.rms.toFixed(4) + '  ' +
        db(v.peak).padStart(6) + '  ' + v.peakMs.toFixed(1).padStart(5) + 'ms ' +
        v.dur.toFixed(3) + 's ' + pct(v.bands));
    }
    console.log('-'.repeat(110));
    for (const k of Object.keys(result.layers)) {
      const v = result.layers[k];
      console.log(('  ' + k).padEnd(18) + v.rms120.toFixed(4) + '  ' + v.rms.toFixed(4) + '  ' +
        db(v.peak).padStart(6) + '  ' + v.peakMs.toFixed(1).padStart(5) + 'ms ' +
        v.dur.toFixed(3) + 's ' + pct(v.bands));
    }

    /* ---------- 记录文件 ---------- */
    const lines = [];
    lines.push('# 步枪开火音 A/B/C 诊断\n');
    lines.push('种子：`' + result.seed + '`（三版与所有分层用同一个）\n');
    lines.push('响度口径：起音后固定 120ms 窗口的 RMS（记作 RMS120）对齐到 ' + VARIANTS.targetRms +
      '，峰值上限 ' + VARIANTS.maxPeak + '（约 ' + db(VARIANTS.maxPeak) + 'dBFS），不削波。');
    lines.push('用固定窗口而不是整段平均，是因为整段平均会惩罚短促的声音：');
    lines.push('3ms 瞬态 + 85ms 爆裂 与 220ms 的轰按同一峰值播放时，后者能量天然更大。');
    lines.push('导出为干声（无总线压缩器），44.1kHz / 16bit / 单声道。\n');
    lines.push('| 版本 | 层 | 解出 vol | RMS120 | 整段 RMS | 峰值 dBFS | 峰时刻 | 有声段 | 频段 60-150 / 150-400 / 400-1k / 1-3k / 3-8k / 8k+ |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const k of Object.keys(result.versions)) {
      const v = result.versions[k];
      lines.push('| ' + k + ' ' + v.label + ' | ' + v.layers.join('+') + ' | ' + v.vol.toFixed(3) +
        ' | ' + v.rms120.toFixed(4) + ' | ' + v.rms.toFixed(4) + ' | ' + db(v.peak) + ' | ' + v.peakMs.toFixed(1) + 'ms | ' +
        v.dur.toFixed(3) + 's | ' + v.bands.join(' / ') + ' |');
    }
    for (const k of Object.keys(result.layers)) {
      const v = result.layers[k];
      lines.push('| 分层 ' + k + ' | ' + k.split('_')[1] + ' | 同版本 | ' + v.rms120.toFixed(4) +
        ' | ' + v.rms.toFixed(4) + ' | ' + db(v.peak) + ' | ' + v.peakMs.toFixed(1) +
        'ms | ' + v.dur.toFixed(3) + 's | ' + v.bands.join(' / ') + ' |');
    }
    lines.push('\n## 各版说明\n');
    for (const k of Object.keys(result.versions)) {
      lines.push('- **' + k + '**：' + result.versions[k].note + '；处理链：' + result.versions[k].chain);
    }
    lines.push('\n## 文件\n');
    written.forEach(f => lines.push('- `' + path.basename(f) + '`'));
    fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');

    if (errs.length) console.log('\n页面错误：' + errs.join(' | '));
    console.log('\n已输出到 output/audio-rifle-diag/：' + written.length + ' 个 WAV + report.md');
  } finally {
    await browser.close();
  }
})();
