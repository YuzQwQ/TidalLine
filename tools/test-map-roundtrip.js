/* 字段往返测试：编辑器存盘不能丢字段、不能改字段顺序、不能把 routes 写回文件。
 * 同时验证 shared/ 三个 UMD 文件在没有 module 的浏览器环境里能正常挂载并使用。 */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require('../design/maps/shared/map-core.js');
const { validateMap } = require('../design/maps/shared/map-validator.js');

const mapPath = path.join(__dirname, '../design/maps/linhai-old-quarter/layout.json');
const rules = require('../design/maps/linhai-old-quarter/rules.json');
const text = fs.readFileSync(mapPath, 'utf8');
const data = JSON.parse(text);

let failed = 0;
const check = (ok, label, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) failed++;
};

/* 1. 逐字段往返 */
const round = JSON.parse(Core.serialize(Core.parse(text)));
const beforeKeys = Object.keys(data);
const afterKeys = Object.keys(round);
check(JSON.stringify(beforeKeys.slice().sort()) === JSON.stringify(afterKeys.slice().sort()),
  '字段集合完全一致', beforeKeys.length + ' → ' + afterKeys.length);
const lost = beforeKeys.filter(k => !(k in round));
check(lost.length === 0, '没有字段丢失', lost.join(',') || '—');
check(JSON.stringify(round) === JSON.stringify(data), '序列化结果与原文件语义相同');

/* 2. 幂等：存两次必须逐字节一致 */
const once = Core.serialize(data);
const twice = Core.serialize(JSON.parse(once));
check(once === twice, 'serialize 幂等');

/* 3. 字段顺序稳定：规范顺序靠前，未知字段追加在后 */
const order = Object.keys(round);
check(order[0] === 'schemaVersion' && order[1] === 'id', '规范顺序以 schemaVersion/id 开头', order.slice(0, 3).join(','));
check(order[order.length - 1] === 'routeSpecs', '规范顺序以 routeSpecs 收尾', order[order.length - 1]);

/* 4. routes 不许再入库 */
const withRoutes = Object.assign({}, data, { routes: [{ id: 'x', points: [] }] });
check(!('routes' in JSON.parse(Core.serialize(withRoutes))), 'serialize 会丢弃 routes');
check(!('routes' in data), 'layout.json 本身不含 routes');

/* 5. schemaVersion 已升级 */
check(data.schemaVersion === Core.SCHEMA_VERSION, 'schemaVersion = ' + Core.SCHEMA_VERSION, String(data.schemaVersion));

/* 6. 浏览器环境：没有 module，只能靠全局挂载 */
const browser = vm.createContext({ console });
for (const file of ['map-core.js', 'map-rules.js', 'map-validator.js', 'map-art-map.js', 'map-templates.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../design/maps/shared', file), 'utf8'), browser, { filename: file });
}
check(vm.runInContext('!!MapCore && !!MapRules && !!MapValidator', browser), '三个 UMD 文件在无 module 环境挂载为全局');
check(vm.runInContext('!!MapArtMap && !!MapTemplates', browser), '美术表与模板也挂载为全局');
browser.__mapText = text;
browser.__rules = rules;
const browserResult = vm.runInContext('MapValidator.validateMap(JSON.parse(__mapText), __rules).counts', browser);
check(browserResult.errors === 0, '浏览器环境跑出的校验结果与 node 一致（0 error）', JSON.stringify(browserResult));
const browserChecks = vm.runInContext('MapValidator.validateMap(JSON.parse(__mapText), __rules).checks.length', browser);
check(browserChecks === 18, '浏览器环境规则数 = 18', String(browserChecks));

/* 6b. 模板生成器在浏览器环境里也能建出干净的新图 */
const browserNew = vm.runInContext(
  'JSON.stringify(MapValidator.validateMap(' +
  'MapTemplates.create({id:"browser-map",width:48,height:36,template:"building"}).data,' +
  'MapTemplates.create({id:"browser-map",width:48,height:36,template:"building"}).rules).counts)',
  browser
);
check(JSON.parse(browserNew).errors === 0, '浏览器环境新建的图 0 错误', browserNew);

/* 7. node 环境结果与浏览器一致 */
const nodeResult = validateMap(data, rules);
/* 提醒不算失败：这张图是手工设计稿，孤立格/分区/配额一类只提示不拦 */
check(nodeResult.counts.errors === 0, 'node 环境 0 error（提醒 ' + nodeResult.counts.warnings + ' 项不阻断）');
check(nodeResult.routes.length === 3 && nodeResult.routes.every(r => r.connected), 'routes 由校验器现场算出 3 条');

console.log(failed ? '\n往返测试失败 ' + failed + ' 项' : '\n往返测试全部通过');
process.exitCode = failed ? 1 : 0;
