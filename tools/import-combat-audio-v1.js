/* 2026-11-07 新一批战斗人声入库（可重复运行）。
   源素材在 assets/audio/_source/新一批音效/（不入库），成品是 assets/audio/ 顶层
   16bit 单声道 WAV，文件名即 SFX id —— build.js 会把它们内联进单文件版。
   长惨叫 mp3 里 8 段的位置是 tools/audio-analyze.js + 解码包络量出来的。

   跑法：node tools/import-combat-audio-v1.js
   依赖：playwright（audio-slice.js 用 WebAudio 解码 mp3）、tools/audio-slice.js、tools/audio-add.js */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'audio', '_source', '新一批音效');
const OUT = path.join(ROOT, 'assets', 'audio');
const SOURCE_ID = 'batch-combat-20261107';

/* [id, 源文件, 起, 止, 说明, 额外切分参数] */
const jobs = [
  ['hurt_player_1', '男受伤-作为玩家受伤音效1.wav',                     0.00, 0.34, '玩家受伤人声 A · 短促闷哼'],
  ['hurt_player_2', '男性疼痛声_作为玩家受伤音效2.mp3',                 0.02, 0.36, '玩家受伤人声 B · 吸气疼痛'],
  ['hurt_player_3', '男受伤2_作为玩家受伤音效3.wav',                    0.00, 0.48, '玩家受伤人声 C · 长一点'],
  ['hurt_enemy_1',  '男人受伤的声音_作为人形敌人的受伤音效1.wav',       0.28, 0.80, '人形敌人受伤 A'],
  ['hurt_enemy_2',  '男性受伤突然疼痛 作为人形敌人的受伤音效2.mp3',      0.00, 0.52, '人形敌人受伤 B'],
  ['death_player',  '男性闷哼一声然后长叹，可以作为玩家死亡音效.mp3',    0.30, 2.72, '玩家阵亡 · 闷哼后长叹'],
  /* 15.91s 的惨叫合辑，8 段各自成一条死亡音，随机抽 */
  ['death_enemy_1', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 1.00, 1.52, '人形敌人死亡惨叫 1/8'],
  ['death_enemy_2', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 2.68, 3.22, '人形敌人死亡惨叫 2/8'],
  ['death_enemy_3', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 4.38, 5.16, '人形敌人死亡惨叫 3/8'],
  ['death_enemy_4', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 6.33, 6.73, '人形敌人死亡惨叫 4/8'],
  ['death_enemy_5', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 8.03, 8.39, '人形敌人死亡惨叫 5/8'],
  ['death_enemy_6', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 9.61, 10.14, '人形敌人死亡惨叫 6/8'],
  ['death_enemy_7', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 11.29, 12.71, '人形敌人死亡惨叫 7/8'],
  ['death_enemy_8', '受伤或死亡时惨叫声_作为人形敌人的死亡音效，一共8段可以切分复用.mp3', 13.92, 14.69, '人形敌人死亡惨叫 8/8'],
  ['echo_engage',   '可以作为异常生物敌人的接战语音音效.mp3',            0.01, 1.05, '异常生物接战语音 · 先给回响体'],
  ['echo_death',    '可以作为异常生物敌人的死亡音效.mp3',                0.03, 1.38, '异常生物死亡 · 先给回响体'],
  ['switch_melee',  '拔剑出鞘,可以作为切刀音效.mp3',                    0.14, 0.82, '枪切近战 · 拔刃出鞘'],
  ['breath_low',    '跑步后喘息声，可以作为低体力时的音效.mp3',          2.58, 3.78, '低体力喘息', ['--rms=0.08']],
  ['mutant_roar',   '丧尸怒吼大叫，可以留给后续畸变生物敌人.wav',        0.02, 2.10, '预留：后续畸变生物敌人，暂不接线'],
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
    addArgs.push('--source=' + SOURCE_ID, '--name=新一批战斗音效（用户提供）',
      '--site=用户提供', '--license=TODO');
  }
  process.stdout.write(run('audio-add.js', addArgs));
  n++;
}
console.log('已入库 ' + n + ' 条，来源 ' + SOURCE_ID + '；预留未接线：mutant_roar');
