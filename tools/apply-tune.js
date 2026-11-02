#!/usr/bin/env node
/* ============================================================
   把开发者靶场导出的 tide-tune.json 写回配置文件
   ------------------------------------------------------------
   靶场里的调参只存在浏览器 localStorage，刷新不丢，但不会改游戏文件。
   把「导出 .json」得到的文件放进来跑一遍，数值才真正落到：
     js/data.js     WEAPONS 里四把枪的 rpm / 散布 / 射程 …
     js/config.js   CFG.RECOIL 与 RECOIL.axis 的各轴参数

   用法：
     node tools/apply-tune.js tide-tune.json           写入
     node tools/apply-tune.js tide-tune.json --dry     只列出会改什么
     node tools/apply-tune.js tide-tune.json --test    写完后跑 run-test.js

   只替换数字字面量，其余字符（注释、字段顺序、同行排布）原样保留，
   所以改完 git diff 只会看到那几个数字的变化。
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'js/data.js');
const CONFIG = path.join(ROOT, 'js/config.js');

/* ---------------- 文本工具 ---------------- */

/* 从 `{` 找到配对的 `}`；跳过字符串与注释，别被 desc 里的中文引号或注释里的花括号骗了 */
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl < 0) return -1;
      i = nl;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) return -1;
      i = e + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/* 数字写回源码时的样子：去掉浮点尾巴，避免 0.04000000000000001 */
function fmtNum(v) {
  const n = Number(v);
  if (!isFinite(n)) return null;
  const s = String(Math.round(n * 1e6) / 1e6);
  return s;
}

/* 在 block 里把 `field: 数字` 换掉；找不到就原样返回 */
function setField(block, field, value) {
  const re = new RegExp('(\\b' + field + '\\s*:\\s*)(-?\\d+(?:\\.\\d+)?)');
  const m = re.exec(block);
  if (!m) return { text: block, replaced: false };
  const from = Number(m[2]);
  const to = fmtNum(value);
  if (to === null) return { text: block, replaced: false };
  return {
    text: block.slice(0, m.index) + m[1] + to + block.slice(m.index + m[0].length),
    replaced: true,
    from
  };
}

/* 在 block 里定位 `name: { … }`，把它内部交给 fn 处理 */
function withSection(block, name, fn) {
  const re = new RegExp('(\\b' + name + '\\s*:\\s*)\\{');
  const m = re.exec(block);
  if (!m) return block;
  const open = m.index + m[0].length - 1;
  const end = matchBrace(block, open);
  if (end < 0) return block;
  const inner = block.slice(open, end + 1);
  return block.slice(0, open) + fn(inner) + block.slice(end + 1);
}

/* ---------------- data.js：WEAPONS ---------------- */

const WEAPON_FIELDS = ['rpm', 'windup', 'recoilPerShot', 'spreadBase', 'spreadMax', 'speed', 'range', 'pellets'];

function patchData(src, tune, changes, warn) {
  const head = src.indexOf('const WEAPONS = {');
  if (head < 0) throw new Error('js/data.js 里找不到 `const WEAPONS = {`');
  const open = src.indexOf('{', head);
  const end = matchBrace(src, open);
  if (end < 0) throw new Error('WEAPONS 块的花括号不配对');

  let block = src.slice(open, end + 1);

  for (const id in tune.weapons || {}) {
    const diff = tune.weapons[id];
    /* 定位这把枪的对象：行首的 `  rifle: {` */
    const re = new RegExp('(\\n[ \\t]*)' + id + '(\\s*:\\s*)\\{');
    const m = re.exec(block);
    if (!m) {
      warn('js/data.js 里没有武器 `' + id + '`，跳过');
      continue;
    }
    const wOpen = m.index + m[0].length - 1;
    const wEnd = matchBrace(block, wOpen);
    if (wEnd < 0) { warn('武器 `' + id + '` 的花括号不配对，跳过'); continue; }

    let wBlock = block.slice(wOpen, wEnd + 1);
    for (const field of WEAPON_FIELDS) {
      if (!(field in diff)) continue;
      const r = setField(wBlock, field, diff[field]);
      if (r.replaced) {
        if (r.from !== Number(diff[field])) {
          changes.push({ file: 'js/data.js', where: id + '.' + field, from: r.from, to: Number(diff[field]) });
        }
        wBlock = r.text;
      } else if (field === 'windup') {
        /* data.js 原本没有 windup 字段，用户调过才需要补一个 */
        const v = Number(diff[field]);
        if (!v) continue;
        const rpmM = /\brpm\s*:\s*-?\d+(?:\.\d+)?,/.exec(wBlock);
        if (!rpmM) { warn(id + '.windup 无法插入（找不到 rpm 字段）'); continue; }
        wBlock = wBlock.replace(rpmM[0], rpmM[0] + ' windup: ' + fmtNum(v) + ',');
        changes.push({ file: 'js/data.js', where: id + '.windup', from: 0, to: v });
      } else {
        warn('js/data.js 的 ' + id + ' 里没有字段 `' + field + '`，跳过');
      }
    }
    block = block.slice(0, wOpen) + wBlock + block.slice(wEnd + 1);
  }

  return src.slice(0, open) + block + src.slice(end + 1);
}

/* ---------------- config.js：RECOIL ---------------- */

/* 靶场面板的扁平 key → axis 里的 [轴, 字段] */
const AXIS_MAP = {
  hKick: ['h', 'kick'], hRand: ['h', 'rand'], hMax: ['h', 'max'],
  hDecayDelay: ['h', 'decayDelay'], hDecay: ['h', 'decay'],
  vKick: ['v', 'kick'], vMax: ['v', 'max'],
  vDecayDelay: ['v', 'decayDelay'], vDecay: ['v', 'decay']
};

/* 这几个在 RECOIL 顶层，和 axis 里的同名字段重名，必须分段处理 */
const TOP_FIELDS = ['max', 'decayDelay', 'decay', 'moveMult', 'sprintMult', 'sneakMult',
  'kickMin', 'kickScale', 'kickDecay'];

function patchConfig(src, tune, changes, warn) {
  const recoil = tune.recoil || {};
  if (!Object.keys(recoil).length) return src;

  const head = src.indexOf('RECOIL: {');
  if (head < 0) throw new Error('js/config.js 里找不到 `RECOIL: {`');
  const open = src.indexOf('{', head);
  const end = matchBrace(src, open);
  if (end < 0) throw new Error('RECOIL 块的花括号不配对');

  let block = src.slice(open, end + 1);

  /* 第一步：把 axis 整个子块摘出来改。
     必须摘掉，否则紧接着改顶层 max / decay 时会命中 axis 里的同名项。 */
  const PLACEHOLDER = '/*@@AXIS@@*/';
  const am = /(\baxis\s*:\s*)\{/.exec(block);
  let axisInner = null;
  if (am) {
    const aOpen = am.index + am[0].length - 1;
    const aEnd = matchBrace(block, aOpen);
    let ax = block.slice(aOpen, aEnd + 1);
    for (const key in AXIS_MAP) {
      if (!(key in recoil)) continue;
      const which = AXIS_MAP[key][0], field = AXIS_MAP[key][1];
      ax = withSection(ax, which, sub => {
        const r = setField(sub, field, recoil[key]);
        if (r.replaced && r.from !== Number(recoil[key])) {
          changes.push({
            file: 'js/config.js',
            where: 'RECOIL.axis.' + which + '.' + field,
            from: r.from, to: Number(recoil[key])
          });
        }
        return r.text;
      });
    }
    axisInner = ax;
    block = block.slice(0, aOpen) + PLACEHOLDER + block.slice(aEnd + 1);
  } else if (Object.keys(recoil).some(k => k in AXIS_MAP)) {
    warn('js/config.js 里没有 RECOIL.axis 段，双轴参数无法写回');
  }

  /* 第二步：顶层字段（此刻 block 里已经没有 axis） */
  for (const f of TOP_FIELDS) {
    if (!(f in recoil)) continue;
    const r = setField(block, f, recoil[f]);
    if (!r.replaced) { warn('js/config.js 的 RECOIL 里没有字段 `' + f + '`'); continue; }
    block = r.text;
    if (r.from !== Number(recoil[f])) {
      changes.push({ file: 'js/config.js', where: 'RECOIL.' + f, from: r.from, to: Number(recoil[f]) });
    }
  }

  /* 第三步：把改好的 axis 放回去 */
  if (axisInner) block = block.replace(PLACEHOLDER, axisInner);

  if ('anim' in recoil) {
    warn('recoil.anim（开火动作速度）是运行时字段，没有对应的配置项，已忽略');
  }

  return src.slice(0, open) + block + src.slice(end + 1);
}

/* ---------------- 主流程 ---------------- */

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const runTest = argv.includes('--test');
  const file = argv.find(a => !a.startsWith('--'));

  if (!file) {
    console.error('用法: node tools/apply-tune.js <tide-tune.json> [--dry] [--test]');
    process.exit(1);
  }
  const jsonPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(jsonPath)) {
    console.error('找不到文件: ' + jsonPath);
    process.exit(1);
  }

  let tune;
  try {
    tune = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error('JSON 解析失败: ' + e.message);
    process.exit(1);
  }
  /* 兼容最早的导出格式 { weapon, weaponDiff, recoil } */
  if (!tune.weapons && tune.weaponDiff && tune.weapon) {
    tune.weapons = { [tune.weapon]: tune.weaponDiff };
  }
  if (!tune.weapons) tune.weapons = {};
  if (!tune.recoil) tune.recoil = {};

  const changes = [];
  const warnings = [];
  const warn = msg => { if (!warnings.includes(msg)) warnings.push(msg); };

  let dataSrc = fs.readFileSync(DATA, 'utf8');
  let cfgSrc = fs.readFileSync(CONFIG, 'utf8');
  const newData = patchData(dataSrc, tune, changes, warn);
  const newCfg = patchConfig(cfgSrc, tune, changes, warn);

  if (!changes.length) {
    console.log('没有需要改的数值：导出文件和配置文件已经一致。');
    if (warnings.length) warnings.forEach(w => console.log('  ! ' + w));
    return;
  }

  console.log('来自 ' + path.basename(jsonPath) + ' 的改动（' + changes.length + ' 处）：\n');
  for (const c of changes) {
    console.log('  ' + c.file.padEnd(14) + (c.where + ' ').padEnd(32) + c.from + ' → ' + c.to);
  }
  if (warnings.length) {
    console.log('\n提醒：');
    warnings.forEach(w => console.log('  ! ' + w));
  }

  if (dry) {
    console.log('\n--dry：预览模式，没有写入任何文件。');
    return;
  }

  if (newData !== dataSrc) fs.writeFileSync(DATA, newData);
  if (newCfg !== cfgSrc) fs.writeFileSync(CONFIG, newCfg);
  console.log('\n已写回。' + (newData !== dataSrc ? ' js/data.js' : '') +
    (newCfg !== cfgSrc ? ' js/config.js' : ''));

  if (runTest) {
    console.log('\n跑一遍回归…');
    const { execFileSync } = require('child_process');
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'run-test.js')], { stdio: 'inherit' });
    } catch (e) {
      console.error('回归未通过，检查上面的改动。');
      process.exit(1);
    }
  } else {
    console.log('建议跑一遍 node run-test.js 确认没打坏别的东西。');
  }
}

main();
