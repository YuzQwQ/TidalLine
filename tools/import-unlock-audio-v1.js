/* 2026-11-09 新一批音效 2 入库（可重复运行）。
   源素材在 assets/audio/_source/新一批音效2/（不入库），成品为 assets/audio/ 顶层
   16bit 单声道 WAV，文件名即 SFX id —— build.js 会把它们内联进单文件版。

   五条现已全部接线：unlock_key 开锁读条起手、door_open_alt 开门/关门、
   door_kick 受阻门踹开、loot_rare_reveal 红/金物品搜索结算、
   trade_settle 局外交易结算（见 js/trade-audio.js）。

   跑法：node tools/import-unlock-audio-v1.js
   依赖：playwright（audio-slice.js 用 WebAudio 解码 mp3）、tools/audio-slice.js、tools/audio-add.js */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'audio', '_source', '新一批音效2');
const OUT = path.join(ROOT, 'assets', 'audio');
const SOURCE_ID = 'batch-sfx-20261109';

/* [id, 源文件, 起, 止, 说明, 额外切分参数]
   起止给足范围，--trim 会自动裁掉源文件的静音头尾（开锁声头部有 944ms 空白）。 */
const jobs = [
  ['unlock_key',      '钥匙插入门锁音效.mp3',                  0, 10,   '钥匙房开锁读条 · 插钥匙转动（已接线）'],
  ['door_open_alt',   '开门声.mp3',                            0, 10,   '普通门开 / 关 · 已接线（Game.applyDoor）'],
  ['door_kick',       '踹门声.mp3',                            0, 10,   '受阻门踹开 · 已接线（prepareOpen.kicked）'],
  ['trade_settle',    '任何花费和收入时的结算音效.mp3',        0, 10,   '局外购物 / 卖出 / 付费结算 · 已接线（js/trade-audio.js）'],
  ['loot_rare_reveal','金红稀有度收集品的搜索结算音效.wav',   0, 2.64, 'r5 珍罕 / r6 孤品逐件搜索结算 · 已接线']
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
    addArgs.push('--source=' + SOURCE_ID, '--name=新一批音效2（用户提供）',
      '--site=用户提供', '--license=TODO');
  }
  process.stdout.write(run('audio-add.js', addArgs));
  n++;
}
console.log('已入库 ' + n + ' 条，来源 ' + SOURCE_ID + '；五条音效均已接线');
