/* 容器品质抽样：验证"六档目标概率"是否原样生效，并估算整局产出。
   node tools/sample-drop.js [次数] */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
const c = vm.createContext({ console, performance });
for (const f of ['js/config.js', 'js/data.js', 'js/core.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c);
const { Loot, CONTAINER_QUALITY, QUALITY_ORDER, CONTAINER_TYPES, RAID_MAP } = vm.runInContext(
  '({Loot,CONTAINER_QUALITY,QUALITY_ORDER,CONTAINER_TYPES,RAID_MAP})', c);

const N = parseInt(process.argv[2] || '40000', 10);

console.log('品质        实测（白/绿/蓝/紫/金/红 %）                          目标');
for (const q of QUALITY_ORDER) {
  const Q = CONTAINER_QUALITY[q], r = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) r[Loot.roll(q).item.r - 1]++;
  const got = r.map(v => (v / N * 100).toFixed(2).padStart(6)).join(' ');
  const tgt = Q.pct.map(v => v.toFixed(2).padStart(6)).join(' ');
  console.log(`${(Q.name + ' ' + q).padEnd(10)} ${got}  |${tgt}`);
}

/* 整局产出：每个容器按自身品质抽 count 区间中值件数 */
const perType = {};
for (const box of RAID_MAP.containers) {
  const t = CONTAINER_TYPES[box.type];
  const Q = CONTAINER_QUALITY[t.q];
  const k = perType[box.type] || (perType[box.type] = { type: t, Q, n: 0 });
  k.n++;
}
const exp = [0, 0, 0, 0, 0, 0];
let items = 0;
const lines = [];
for (const { type, Q, n } of Object.values(perType)) {
  const avg = (Q.count[0] + Q.count[1]) / 2;
  items += avg * n;
  for (let r = 0; r < 6; r++) exp[r] += n * avg * Q.pct[r] / 100;
  lines.push(`${type.name}×${n}（${Q.name}，每箱 ${Q.count[0]}–${Q.count[1]} 件）`);
}
console.log('\n地图容器：' + lines.join('、'));
console.log(`一局期望 ${items.toFixed(1)} 件 → 白 ${exp[0].toFixed(1)} / 绿 ${exp[1].toFixed(1)} / 蓝 ${exp[2].toFixed(1)} / 紫 ${exp[3].toFixed(1)} / 金 ${exp[4].toFixed(1)} / 红 ${exp[5].toFixed(2)}`);
