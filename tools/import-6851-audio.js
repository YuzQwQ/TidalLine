/* 2026-11-10 6851 口径专属音效入库（可重复运行）。
   源素材在 assets/audio/_source/6851/（不入库），成品为 assets/audio/ 顶层
   16bit 单声道 WAV，文件名即 SFX id —— build.js 会把它们内联进单文件版。

   四条一一对应：
     spear开火声.mp3  → shot_spear   MCX SPEAR 开火
     RM277开火声.mp3  → shot_rm277   GD RM277 开火
     拉栓声（换弹尾声+切枪）→ switch_6851  两把枪共用的拉栓 / 切枪声
     换弹夹（音量过小需放大）→ reload_6851 两把枪共用的换弹夹声（按 LOUD.reload 归一）

   跑法：node tools/import-6851-audio.js
   依赖：playwright（audio-slice.js 用 WebAudio 解码 mp3）、tools/audio-slice.js、tools/audio-add.js */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'audio', '_source', '6851');
const OUT = path.join(ROOT, 'assets', 'audio');
const SOURCE_ID = '6851-guns-20261110';

/* [id, 源文件, 起, 止, 说明, 额外切分参数]
   起止给足范围，--trim 会自动裁掉源文件静音头尾；换弹夹源偏轻，peak 提到 0.95 多留余量。 */
const jobs = [
  ['shot_spear', 'spear开火声.mp3',                         0, 2.0, 'MCX SPEAR 开火 · 6.8×51mm'],
  ['shot_rm277', 'RM277开火声.mp3',                         0, 2.0, 'GD RM277 开火 · 6.8×51mm'],
  ['switch_6851', '拉栓声，作为换弹尾声和切枪音效.mp3',      0, 3.0, '拉栓：换弹尾声 + 切枪（MCX SPEAR / RM277 共用）'],
  ['reload_6851', '换弹夹，音量过小，需放大.mp3',           0, 3.0, '换弹夹（已按 LOUD.reload 归一，源偏轻），MCX SPEAR / RM277 共用', ['--peak=0.95']]
];

const run = (script, args) => execFileSync(process.execPath,
  [path.join(ROOT, 'tools', script), ...args], { cwd: ROOT, encoding: 'utf8' });

let n = 0;
for (const [id, src, a, b, note, extra] of jobs) {
  const input = path.join(SRC, src);
  const output = path.join(OUT, id + '.wav');
  if (!fs.existsSync(input)) throw new Error('缺源素材：' + input);
  const sliceArgs = [input, output, String(a), String(b), '--peak=0.89', '--trim=0.03',
    '--in=4', '--out=12', ...(extra || [])];
  process.stdout.write(run('audio-slice.js', sliceArgs));
  const addArgs = [output, '--id=' + id, '--from=' + SOURCE_ID, '--note=' + note];
  if (n === 0) {
    addArgs.push('--source=' + SOURCE_ID, '--name=6851 口径枪械音效（用户提供）',
      '--site=用户提供', '--license=TODO');
  }
  process.stdout.write(run('audio-add.js', addArgs));
  n++;
}
console.log('已入库 ' + n + ' 条，来源 ' + SOURCE_ID + '；MCX SPEAR / RM277 的火声、切枪、换弹均已接线');
