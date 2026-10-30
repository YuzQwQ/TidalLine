/* 设计稿验收（node 壳）。真正的规则在 ../shared/map-validator.js，浏览器与 node 共用同一份。
 * 本文件只做三件事：读 rules.json、把 error 折成异常、命令行输出。 */
const fs = require('fs');
const path = require('path');
const { validateMap, assertValid, RULES } = require('../shared/map-validator.js');

const rulesPath = path.join(__dirname, 'rules.json');
const rules = fs.existsSync(rulesPath) ? JSON.parse(fs.readFileSync(rulesPath, 'utf8')) : {};

/* 有 error 就抛；无 error 时返回完整结果（issues 里可能还有 warn）。 */
function validate(data) {
  return assertValid(data, rules);
}

module.exports = { validate, validateMap: data => validateMap(data, rules), rules, RULES };

if (require.main === module) {
  const file = path.join(__dirname, 'layout.json');
  if (!fs.existsSync(file)) throw new Error('缺少 layout.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = validateMap(data, rules);
  if (result.counts.errors) {
    console.error(`校验失败：${result.counts.errors} 项错误 / ${result.counts.warnings} 项提醒`);
    for (const issue of result.issues) console.error(`  ${issue.level === 'error' ? '✕' : '!'} [${issue.rule}] ${issue.message}`);
    process.exitCode = 1;
  } else {
    console.log(`通过 ${result.checks.length} 项设计验收（错误 0 / 提醒 ${result.counts.warnings}）`);
    if (result.counts.warnings) for (const issue of result.issues) console.warn(`  ! [${issue.rule}] ${issue.message}`);
    console.log(JSON.stringify(result.stats, null, 2));
  }
}
