/* 每张地图的专属规则：配额、净宽、敌人间距、特殊检查开关与专有编号。
 * 通用规则写在 map-validator.js 里；这里只放"只有这张图才成立"的部分。
 * 新建地图时 rules 可以为空，此时全部条目取 null / 空数组，只跑通用规则。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* 默认值：全部"不检查"。null 表示该条目不约束，数字表示必须相等。 */
  const DEFAULT_RULES = {
    id: null,
    expect: {
      width: null, height: null, tileSize: null,
      buildings: null, rooms: null, portals: null, windows: null,
      props: null, containers: null, enemies: null, containerTypes: null,
      containerTypesUsed: null, exits: null, bridges: null, routes: null,
      windowsMin: null
    },
    enemySpacing: { between: 3, fromSpawn: 12, fromExit: 6 },
    portal: { maxWidth: 3 },
    canal: { x: null },
    specialChecks: [],
    special: {
      bank: null,
      tide: { southBridge: null },
      routing: { pairs: [], sealed: null }
    }
  };

  const isPlain = v => v && typeof v === 'object' && !Array.isArray(v);

  function merge(base, patch) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!isPlain(patch)) return out;
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      if (isPlain(v) && isPlain(out[k])) out[k] = merge(out[k], v);
      else if (v !== undefined) out[k] = v;
    }
    return out;
  }

  function normalize(raw) {
    return merge(DEFAULT_RULES, raw || {});
  }

  /* 特殊检查是否开启。没写进 specialChecks 的一律跳过，避免新图一建就报错。 */
  function enabled(rules, name) {
    return Array.isArray(rules.specialChecks) && rules.specialChecks.includes(name);
  }

  /* windowsMin 是下限而非计数，由 M1 单独判，不参与 G11 的等值比对。 */
  const NON_COUNT = ['windowsMin'];

  /* 把 expect 里非 null 的条目转成键名列表，供 G11 逐条比对。
   * 这里宽容接受未归一化的对象（{} 或直接是 expect 本身）：
   * 调用方忘了 normalize 时应该"少检查几条"，而不是让整张图打不开。 */
  function expectations(rules) {
    const expect = (rules && rules.expect) || {};
    return Object.keys(expect)
      .filter(k => !NON_COUNT.includes(k))
      .filter(k => expect[k] !== null && expect[k] !== undefined);
  }

  return { DEFAULT_RULES, normalize, enabled, expectations, merge };
});
