/* 战斗系统 V1 交叉矩阵报告（只读，不写游戏状态）。
   全部弹药（6 口径 × 5 级）× 全部 1~6 级护甲（20 件），
   逐发模拟命中身体，输出：首次穿透枪数、击杀枪数、护甲消耗、累计钝伤。

   跑法：node tools/report-combat-v1.js
   产物：design/balance/combat-v1/{combat-v1-matrix.json, combat-v1-matrix.csv, README.md} */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const h = fs.readFileSync(path.join(root, 'run-test.js'), 'utf8').split('let pass = 0')[0];
const c = new Function('require', '__dirname', h + '\nreturn ctx;')(require, root);
const { CFG, Combat, GEAR, AMMO_ITEMS } = c;

const HP = (CFG.P && CFG.P.HP) || 100;
const MAX_SHOTS = 400;
const outDir = path.join(root, 'design', 'balance', 'combat-v1');
fs.mkdirSync(outDir, { recursive: true });

const armors = [...GEAR.helmet.list, ...GEAR.body.list]
  .map(d => ({ id: d.id, name: d.name, type: d.type, lv: d.lv, material: d.material, dur: d.dur }));
const ammos = AMMO_ITEMS.map(a => ({
  id: a.id, caliber: a.caliber, level: a.level, name: a.name,
  B: a.B, P: a.P, compat: !!a.compat
}));

const rows = [];
for (const a of armors) {
  for (const m of ammos) {
    const gear = GEAR.make(a.type, a.id);
    let hp = HP, shots = 0, firstPen = null, brokenAt = null, blunt = 0, used = 0;
    while (hp > 0 && shots < MAX_SHOTS) {
      const before = gear.dur;
      const r = Combat.resolve({ B: m.B, P: m.P, part: 'body', armor: gear });
      hp -= r.health;
      if (r.blunt) blunt += r.health;
      if (r.penetrated && firstPen == null) firstPen = shots + 1;
      Combat.applyDurability(r);
      used += before - gear.dur;
      if (gear.dur <= 0 && brokenAt == null) brokenAt = shots + 1;
      shots++;
    }
    rows.push({
      armor: a.id, armorName: a.name, armorType: a.type, level: a.lv, material: a.material,
      baseDur: a.dur, ammo: m.id, caliber: m.caliber, ammoLevel: m.level,
      B: m.B, P: m.P, compat: m.compat,
      shotsToKill: hp <= 0 ? shots : null,
      shotsToPenetrate: firstPen,
      shotsToBreak: brokenAt,
      armorUsed: Math.round(used * 100) / 100,
      bluntTotal: Math.round(blunt * 100) / 100,
      hpLeft: Math.round(hp * 100) / 100
    });
  }
}

fs.writeFileSync(path.join(outDir, 'combat-v1-matrix.json'),
  JSON.stringify({ version: 1, hp: HP, constants: CFG.COMBAT_MODEL, materials: CFG.MATERIALS, rows }, null, 2), 'utf8');

const cols = ['armor', 'armorName', 'armorType', 'level', 'material', 'baseDur',
  'ammo', 'caliber', 'ammoLevel', 'B', 'P', 'shotsToKill', 'shotsToPenetrate',
  'shotsToBreak', 'armorUsed', 'bluntTotal', 'hpLeft'];
fs.writeFileSync(path.join(outDir, 'combat-v1-matrix.csv'),
  cols.join(',') + '\n' + rows.map(r => cols.map(k => r[k] == null ? '' : r[k]).join(',')).join('\n') + '\n', 'utf8');

/* 摘要：每件护甲在「最弱 / 中档 / 最强」三种弹药下的击杀枪数与累计钝伤 */
const picks = ['ammo_9mm_1', 'ammo_556_3', 'ammo_545x39_5'];
const pickLabel = { 'ammo_9mm_1': '9mm Lv1 (31/8)', 'ammo_556_3': '5.56 Lv3 (33/33)', 'ammo_545x39_5': '5.45 Lv5 (28/59)' };
let md = '# 战斗系统 V1 · 弹药 × 护甲交叉矩阵\n\n';
md += `- 目标 HP：${HP}；命中部位：身体；逐发连续命中，最多 ${MAX_SHOTS} 发。\n`;
md += '- `shotsToPenetrate` 首次穿透枪数（护甲磨薄后 A 下降）；`shotsToBreak` 护甲耐久归零枪数。\n';
md += '- `armorUsed` 护甲累计耐久消耗，`bluntTotal` 累计钝伤；`—` 表示 400 发内未击杀 / 未穿透。\n';
md += '- 12 Gauge 使用临时兼容 B/P，专项方案待定。\n\n';
md += '| 护甲 | Lv | 材质 | 原厂耐久 | ' + picks.map(p => pickLabel[p] + ' 击杀/钝伤').join(' | ') + ' |\n';
md += '|---|---|---|---|' + picks.map(() => '---').join('|') + '|\n';
for (const a of armors) {
  const cells = picks.map(p => {
    const r = rows.find(x => x.armor === a.id && x.ammo === p);
    return (r.shotsToKill == null ? '—' : r.shotsToKill + ' 发') +
      ' / ' + r.bluntTotal.toFixed(1);
  });
  md += '| ' + a.name + ' | ' + a.lv + ' | ' + CFG.MATERIALS[a.material].label + ' | ' +
    a.dur + ' | ' + cells.join(' | ') + ' |\n';
}
md += '\n## 验收备注\n\n';
md += '- 相同输入重复结算结果一致；未穿透只产生钝伤，穿透后不叠加钝伤。\n';
md += '- 本发耐久损耗按命中前耐久判定穿透，不影响本发。\n';
md += '- 维修后最大耐久单调不增（ΔDmax = (Dmax−D)·Kr）。\n';
md += '- 全量数据见 `combat-v1-matrix.csv` / `combat-v1-matrix.json`。\n';
fs.writeFileSync(path.join(outDir, 'README.md'), md, 'utf8');

const killed = rows.filter(r => r.shotsToKill != null).length;
console.log('交叉矩阵 ' + rows.length + ' 组（' + armors.length + ' 护甲 × ' + ammos.length + ' 弹药），' +
  killed + ' 组在 ' + MAX_SHOTS + ' 发内击杀');
console.log('输出：' + path.relative(root, outDir) + '/{README.md, combat-v1-matrix.csv, combat-v1-matrix.json}');
console.log('\n摘要（5.56 Lv3）：');
for (const a of armors) {
  const r = rows.find(x => x.armor === a.id && x.ammo === 'ammo_556_3');
  console.log('  ' + a.name.padEnd(8, '　') + ' Lv' + a.lv + '  击杀 ' +
    (r.shotsToKill == null ? '—' : r.shotsToKill + ' 发') +
    '  首穿 ' + (r.shotsToPenetrate == null ? '—' : r.shotsToPenetrate + ' 发') +
    '  耗甲 ' + r.armorUsed + '  累计钝伤 ' + r.bluntTotal);
}
