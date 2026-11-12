/* 战斗系统 V1 验收：确定性穿透、钝伤、护甲磨损、维修与迁移。
   跑法：node tools/test-combat-v1.js
   复用 run-test.js 的 vm harness（同一份脚本加载顺序与全局导出）。 */
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const h = fs.readFileSync(path.join(root, 'run-test.js'), 'utf8').split('let pass = 0')[0];
const c = new Function('require', '__dirname', h + '\nreturn ctx;')(require, root);
const { CFG, Combat, GEAR, EQUIP, AMMO_ITEMS, Player, Enemy, Game, Save, BALLISTICS } = c;

let pass = 0, fail = 0;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL ' + name + (extra != null ? '  ' + extra : '')); }
}
const M = CFG.COMBAT_MODEL;

/* ------------------------------------------------------------
   A. 配置表：材质、弹药、护甲，逐项对齐规范
   ------------------------------------------------------------ */
console.log('\n=== A. 统一配置表 ===');
const MAT = {
  aramid:  [1.25, 0.75, 0.035],
  pe:      [0.90, 0.90, 0.050],
  ceramic: [0.55, 1.35, 0.090],
  steel:   [0.75, 0.70, 0.015]
};
for (const [id, [Kb, Kd, Kr]] of Object.entries(MAT)) {
  const m = CFG.MATERIALS[id];
  ok('材质 ' + id, m && m.Kb === Kb && m.Kd === Kd && m.Kr === Kr,
    m ? [m.Kb, m.Kd, m.Kr].join('/') : 'missing');
}

const FLESH = {
  '556':    [[37,16],[35,24],[33,33],[31,43],[28,55]],
  '545x39': [[40,15],[37,24],[35,34],[32,45],[28,59]],
  '762x39': [[47,18],[44,27],[41,35],[38,45],[35,58]],
  '9mm':    [[31,8],[29,15],[27,22],[25,30],[23,39]],
  '45acp':  [[40,9],[38,17],[35,25],[33,32],[30,39]]
};
for (const [cal, rows] of Object.entries(FLESH)) {
  rows.forEach(([B, P], i) => {
    const s = Combat.ammo(cal, i + 1);
    ok('弹药 ' + cal + ' Lv' + (i + 1), s.B === B && s.P === P, s.B + '/' + s.P);
    const item = AMMO_ITEMS.find(x => x.caliber === cal && x.level === i + 1);
    ok('弹药物品带固定 B/P ' + cal + ' Lv' + (i + 1),
      item && item.B === B && item.P === P && item.dmgMul === 1);
  });
}
for (let lv = 1; lv <= 5; lv++) {
  const s = Combat.ammo('12g', lv);
  ok('12 Gauge 兼容数据 Lv' + lv + ' 不失效', s.B > 0 && s.P > 0 && s.compat === true, s.B + '/' + s.P);
}

/* id -> material / dur / rep / aimPenaltyPct */
const ARMOR = {
  helmet1: ['aramid',20,94,0],   helmet2: ['pe',30,92,0],
  helmet3: ['aramid',45,94,0],   helmet4: ['aramid',65,94,0],
  helmet5: ['ceramic',85,84,0],  helmet6: ['steel',110,97,0],
  body1: ['aramid',40,94,0],     body2: ['aramid',60,94,10],
  body3: ['aramid',85,94,12],    body4: ['ceramic',110,84,22],
  body5: ['steel',135,97,32],    body6: ['steel',165,97,45],
  helmet1_motorcycle: ['pe',28,91,0],       body1_leather: ['aramid',55,95,4],
  helmet2_rescue: ['pe',24,91,0],           body2_concealed: ['aramid',45,95,4],
  helmet3_riot: ['pe',60,90,0],             body3_fragmentation: ['aramid',100,93,22],
  helmet4_light: ['pe',50,91,0],            body4_lightplate: ['pe',90,91,10]
};
const allDefs = [...GEAR.helmet.list, ...GEAR.body.list];
ok('护甲共 20 件', allDefs.length === 20, allDefs.length);
for (const [id, [mat, dur, rep, aim]] of Object.entries(ARMOR)) {
  const d = allDefs.find(x => x.id === id);
  ok('护甲 ' + id + ' 材质/耐久/耐修/瞄准',
    d && d.material === mat && d.dur === dur && d.rep === rep && (d.aimPenaltyPct || 0) === aim,
    d ? [d.material,d.dur,d.rep,d.aimPenaltyPct].join('/') : 'missing');
  const g = GEAR.make(d.type, d.id);
  ok('护甲实例带材质 ' + id, g.material === mat && g.dur === dur && g.max === dur && g.rep === rep);
}
ok('REPAIR 不再使用 WEAR/rep 公式', CFG.REPAIR.WEAR === undefined && CFG.REPAIR.MIN_MAX === 4);
ok('结算常量', M.LV_SCALE === 10 && M.WEAR_SPAN === 10 && M.BLUNT_RATIO === 0.08 &&
  M.DUR_BASE === 0.035 && M.DUR_PER_PEN === 0.009);

/* ------------------------------------------------------------
   B. 四个核心公式
   ------------------------------------------------------------ */
console.log('\n=== B. 核心公式 ===');
for (let L = 1; L <= 6; L++) {
  const d = allDefs.find(x => x.type === 'body' && x.lv === L && /^body\d$/.test(x.id));
  const g = GEAR.make('body', d.id);
  ok('满耐久 A = 10L (Lv' + L + ')', near(Combat.effectiveArmor(g), 10 * L), Combat.effectiveArmor(g));
  g.dur = g.max / 2;
  ok('半耐久 A = 10L−5 (Lv' + L + ')', near(Combat.effectiveArmor(g), 10 * L - 5), Combat.effectiveArmor(g));
  g.dur = 0;
  ok('D=0 护甲失效 (Lv' + L + ')', Combat.effectiveArmor(g) === 0);
}
ok('无甲 A = 0', Combat.effectiveArmor(null) === 0);

/* 穿透 / 钝伤二选一 */
{
  const g = GEAR.make('helmet', 4);            // A=40，芳纶 Kb1.25
  const pen = Combat.resolve({ B: 31, P: 40, part: 'body', armor: g });
  ok('P=A 判定为穿透', pen.penetrated && !pen.blunt);
  ok('穿透 H = B（不带钝伤）', near(pen.health, 31), pen.health);
  const blunt = Combat.resolve({ B: 31, P: 39, part: 'body', armor: g });
  ok('P<A 判定为未穿透', !blunt.penetrated && blunt.blunt);
  ok('未穿透 H = 0.08·B·Kb', near(blunt.health, 0.08 * 31 * 1.25), blunt.health);
  ok('穿透后不再叠加钝伤', !near(pen.health, 31 + 0.08 * 31 * 1.25));
}
/* 部位倍率与距离衰减都在结算之后乘，且不放大 ΔD */
{
  const g = GEAR.make('body', 3);              // A=30，芳纶
  const body = Combat.resolve({ B: 37, P: 16, part: 'body', armor: g });
  const head = Combat.resolve({ B: 37, P: 16, part: 'head', armor: g });
  const far  = Combat.resolve({ B: 37, P: 16, part: 'body', armor: g, mul: 0.55 });
  ok('爆头倍率另行处理 ×1.5', near(head.health, body.health * CFG.COMBAT.HEAD_MULT));
  ok('距离衰减另行处理', near(far.health, body.health * 0.55));
  ok('倍率不放大磨甲量', near(head.durabilityLoss, body.durabilityLoss) &&
    near(far.durabilityLoss, body.durabilityLoss));
  ok('baseHealth 未乘任何倍率', near(body.baseHealth, body.health) &&
    near(head.baseHealth, body.baseHealth));
}
/* ΔD 精确等于公式，四种材质各验一次 */
for (const [id, [Kb, Kd, Kr]] of Object.entries(MAT)) {
  const B = 40, P = 25;
  const r = Combat.resolve({ B, P, part: 'body', armor: Object.assign(GEAR.make('body', 3), { material: id }) });
  ok('ΔD = B(0.035+0.009P)Kd · ' + id,
    near(r.durabilityLoss, B * (0.035 + 0.009 * P) * Kd), r.durabilityLoss);
  if (!r.penetrated) ok('钝伤倍率 Kb · ' + id, near(r.health, 0.08 * B * Kb), r.health);
}
/* resolve 是纯函数 */
{
  const g = GEAR.make('body', 5);
  const before = { dur: g.dur, max: g.max, material: g.material };
  const r = Combat.resolve({ B: 47, P: 18, part: 'body', armor: g });
  ok('resolve 不改护甲状态', g.dur === before.dur && g.max === before.max && g.material === before.material);
  ok('resolve 预演了写回后的耐久', near(r.armorDurAfter, before.dur - r.durabilityLoss));
  Combat.applyDurability(r);
  ok('applyDurability 才写回', near(g.dur, r.armorDurAfter));
}

/* ------------------------------------------------------------
   C. 部署验收标准（规范第六节 9 条，逐条）
   ------------------------------------------------------------ */
console.log('\n=== C. V1 验收标准 ===');
const snap = r => JSON.stringify([r.health, r.baseHealth, r.A, r.penetrated, r.blunt, r.durabilityLoss, r.material]);

/* 1 确定性 */
{
  const g = GEAR.make('body', 4);
  const first = snap(Combat.resolve({ B: 35, P: 24, part: 'body', armor: g }));
  let same = true;
  for (let i = 0; i < 200; i++)
    if (snap(Combat.resolve({ B: 35, P: 24, part: 'body', armor: g })) !== first) same = false;
  ok('① 相同输入得到相同结算结果，不存在随机穿透', same);
  /* 运行时链路：同一弹药连发，子弹 B/P 完全相同 */
  const ammo = AMMO_ITEMS.find(x => x.id === 'ammo_556_3');
  const w = c.WEAPONS.m4a1;
  const old = Game.bullets; Game.bullets = [];
  for (let i = 0; i < 8; i++)
    c.Firearms.emit(w, { x: 10, y: 10, angle: 0, spread: 0, ammo, faction: 'player', meta: null });
  const bs = Game.bullets.map(b => b.dmg), ps = Game.bullets.map(b => b.pen);
  Game.bullets = old;
  ok('① 同弹药连发子弹 B/P 固定（无随机肉伤）',
    bs.length === 8 && bs.every(v => v === ammo.B) && ps.every(v => v === ammo.P),
    bs.join(','));
}
/* 2 未穿透只有钝伤，穿透不叠加 */
{
  const g = GEAR.make('helmet', 4);
  const a = Combat.resolve({ B: 33, P: 20, part: 'body', armor: g });
  const b = Combat.resolve({ B: 33, P: 60, part: 'body', armor: g });
  ok('② 未穿透只有钝伤 / 穿透不再叠加钝伤',
    a.blunt && near(a.health, 0.08 * 33 * 1.25) && b.penetrated && near(b.health, 33));
}
/* 3 全额基础肉伤 + 部位倍率另行处理 */
{
  const g = GEAR.make('helmet', 4);
  const body = Combat.resolve({ B: 28, P: 55, part: 'body', armor: g });
  const head = Combat.resolve({ B: 28, P: 55, part: 'head', armor: g });
  ok('③ 穿透全额 B，头部倍率另行处理',
    body.penetrated && near(body.health, 28) && near(head.health, 28 * CFG.COMBAT.HEAD_MULT));
}
/* 4 本发 ΔD 不影响本发判定 */
{
  /* 构造临界：D 使得 A 刚好比 P 高一点；本发 ΔD 远大于剩余耐久 */
  const g = GEAR.make('body', 3, 0.4);         // A≈20.05，P=19 仍是钝伤
  const r = Combat.resolve({ B: 47, P: 19, part: 'body', armor: g });
  ok('④ 命中前判钝伤', r.blunt && r.A > 19 && near(r.health, 0.08 * 47 * MAT.aramid[0]), r.A);
  ok('④ 本发 ΔD 按剩余耐久封顶', near(r.durabilityLoss, 0.4), r.durabilityLoss);
  Combat.applyDurability(r);
  const next = Combat.resolve({ B: 47, P: 19, part: 'body', armor: g });
  ok('④ 下一发才按失效处理', next.penetrated && near(next.health, 47));
}
/* 5 耐久归零后下一发全额 */
{
  const g = GEAR.make('body', 3);
  let shots = 0;
  while (g.dur > 0 && shots < 500) {
    const r = Combat.resolve({ B: 47, P: 18, part: 'body', armor: g });
    Combat.applyDurability(r); shots++;
  }
  const r = Combat.resolve({ B: 47, P: 18, part: 'body', armor: g });
  ok('⑤ 耐久归零后下一发直接全额伤害',
    g.dur === 0 && r.penetrated && near(r.health, 47), '磨了 ' + shots + ' 发');
}
/* 6 耐久 clamp */
{
  const g = GEAR.make('body', 1, 0.2);
  const r = Combat.resolve({ B: 47, P: 58, part: 'body', armor: g });
  Combat.applyDurability(r);
  ok('⑥ 护甲耐久不低于 0', g.dur >= 0 && g.dur === 0);
  const g2 = GEAR.make('body', 1, 999);
  ok('⑥ 当前耐久不得超过最大耐久', g2.dur <= g2.max, g2.dur + '/' + g2.max);
  ok('⑥ 修过的甲 max 不超过模板 dur', GEAR.make('body', 1, 20, 999).max <= GEAR.def('body', 1).dur);
}
/* 7 维修后 max 不高于维修前 */
{
  for (const [id, [, , Kr]] of Object.entries(MAT)) {
    const g = Object.assign(GEAR.make('body', 3, 20), { material: id });
    const q = c.Repair.quote(g);
    /* quote 把上限损耗保留两位小数，允许 ±0.01 的取整误差 */
    ok('⑦ 维修上限损耗 = (Dmax−D)·Kr · ' + id,
      Math.abs(q.capLoss - q.lost * Kr) < 0.01 &&
      Math.abs(q.newMax - (q.max - q.capLoss)) < 1e-9 && q.newMax < q.max,
      q.max + '→' + q.newMax);
  }
  const g = GEAR.make('body', 3, 20);
  let prev = g.max;
  for (let i = 0; i < 12; i++) {
    const q = c.Repair.quote(g);
    if (!q.ok) break;
    g.dur = q.dur; g.max = q.newMax; g.dur = g.max;
    ok('⑦ 第 ' + (i + 1) + ' 次修理上限单调不增', g.max <= prev, prev + '→' + g.max);
    prev = g.max;
    g.dur = Math.max(0, g.max - 20);
  }
}
/* 8 玩家与敌人同规则 */
{
  const P = new Player(100, 100);
  const E = new Enemy('scav', 100, 100, 2);
  const cases = [[37,16,'body',1],[31,43,'head',1],[47,18,'body',0.55],[23,39,'head',1]];
  for (const [B, Pn, part, mul] of cases) {
    const g1 = GEAR.make(part === 'head' ? 'helmet' : 'body', 4);
    const g2 = GEAR.make(part === 'head' ? 'helmet' : 'body', 4);
    P.helmet = part === 'head' ? g1 : null; P.body = part === 'body' ? g1 : null;
    P.hp = 100; P.dead = false;
    E.helmet = part === 'head' ? g2 : null; E.body = part === 'body' ? g2 : null;
    E.hp = 100; E.dead = false;
    const d1 = P.hurt(B, part, Pn, undefined, null, mul);
    const d2 = E.hurt(B, 'player', part, Pn, undefined, null, mul);
    ok('⑧ 玩家/敌人掉血一致 B' + B + ' P' + Pn + ' ' + part,
      near(d1, d2), d1 + ' vs ' + d2);
    ok('⑧ 玩家/敌人磨甲一致 B' + B + ' P' + Pn + ' ' + part,
      near(g1.dur, g2.dur), g1.dur + ' vs ' + g2.dur);
  }
}
/* 9 12 Gauge 独立兼容逻辑不失效 */
{
  const w = c.WEAPONS.rem870;
  const ammo = AMMO_ITEMS.find(x => x.id === 'ammo_12g_3');
  const old = Game.bullets; Game.bullets = [];
  c.Firearms.emit(w, { x: 10, y: 10, angle: 0, spread: 0, ammo, faction: 'player', meta: null });
  const bullets = Game.bullets; Game.bullets = old;
  ok('⑨ 12 Gauge 仍生成 6 颗弹丸', bullets.length === 6, bullets.length);
  ok('⑨ 每颗弹丸都带有效 B/P', bullets.every(b => b.dmg === ammo.B && b.pen === ammo.P));
  const r = Combat.resolve({ B: ammo.B, P: ammo.P, part: 'body', armor: GEAR.make('body', 1) });
  ok('⑨ 12 Gauge 弹丸能正常结算伤害', r.health > 0 && r.durabilityLoss > 0,
    r.health + '/' + r.durabilityLoss);
}

/* ------------------------------------------------------------
   D. 兼容与迁移：旧存档、专属伤害、致残条件、无甲敌人
   ------------------------------------------------------------ */
console.log('\n=== D. 兼容与迁移 ===');
{
  /* 旧存档只有 {type, lv, dur}：读档时 GEAR.make 会补材质/上限/耐修，
     并把超出新模板的旧 max 夹回新 dur。 */
  const legacy = { type: 'body', lv: 6, dur: 180 };   // 旧攻坚装甲 190 耐久
  const g = GEAR.make(legacy.type, legacy.lv, legacy.dur, legacy.max);
  ok('旧存档补齐材质', g.material === 'steel', g.material);
  ok('旧存档补齐最大耐久并夹到新模板', g.max === 165 && g.dur === 165, g.dur + '/' + g.max);
  ok('旧存档补齐耐修度', g.rep === 97);
  ok('伪物品也带材质', EQUIP.armor(g).equip.gear.material === 'steel');
}
{
  /* 近战真伤：绕过护甲与爆头倍率，只吃距离衰减 */
  const E = new Enemy('scav', 100, 100, 2);
  E.helmet = GEAR.make('helmet', 4); E.body = null; E.hp = 100; E.dead = false;
  const dur = E.helmet.dur;
  const dealt = E.hurt(18, 'player', 'head', null, 'trueDamage', null, 1);
  ok('真伤绕过护甲与爆头倍率', dealt === 18 && E.hp === 82 && E.helmet.dur === dur, dealt + '/' + E.hp);
  const dealt2 = E.hurt(18, 'player', 'head', null, 'trueDamage', null, 0.5);
  ok('真伤仍吃距离衰减', dealt2 === 9, dealt2);
}
{
  /* 异常体 / 机械造物无甲 → 全额伤害 */
  const E = new Enemy('guard', 100, 100, 2);
  E.helmet = null; E.body = null; E.hp = E.maxHp; E.dead = false;
  const r = Combat.resolve({ B: 37, P: 16, part: 'body', armor: null });
  ok('无甲敌人直接受全额肉伤', r.penetrated && near(r.health, 37) && r.durabilityLoss === 0);
  ok('机械造物结构免疫仍在', !E.debuffs);
}
{
  /* 头部倍率、距离衰减、致残门槛都保留 */
  ok('HEAD_MULT 仍为 1.5', CFG.COMBAT.HEAD_MULT === 1.5);
  ok('距离衰减参数仍在', CFG.WEAPON.falloffStart === 260 && CFG.WEAPON.falloffEnd === 640);
  ok('致残仍按实际掉血判定', CFG.DEBUFF.MIN_HEALTH_DMG === 0.5 &&
    Array.isArray(CFG.DEBUFF.INTERRUPT_ON_HIT));
  const g = GEAR.make('body', 1);
  const r = Combat.resolve({ B: 31, P: 8, part: 'body', armor: g });
  ok('低穿透钝伤仍可能触发致残（实际掉血 ≥ 0.5）', r.health >= CFG.DEBUFF.MIN_HEALTH_DMG, r.health);
}
{
  /* 旧运行时不再调用遗留矩阵 */
  ok('运行时不再使用 BALLISTICS.ratio/resolve/hit',
    !/BALLISTICS\.(hit|resolve)\s*\(/.test(fs.readFileSync(path.join(root, 'js/entities.js'), 'utf8')));
}

console.log('\n---------------------------------------');
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log('---------------------------------------\n');
if (fail) process.exit(1);
