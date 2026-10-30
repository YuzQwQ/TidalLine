/* 地图数据核心：解析、序列化、坐标与视图变换。
 * 浏览器（file:// 双击）与 node（require）共用，UMD 包装，无 fs、无 DOM。
 * 浏览器加载顺序：map-core.js → map-rules.js → map-validator.js */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* schemaVersion 2：routes 不再入库，改由校验器按实体占格现场计算。 */
  const SCHEMA_VERSION = 2;

  /* 序列化用的规范字段顺序。未知字段按原插入顺序追加在末尾，保证向前兼容。 */
  const FIELD_ORDER = [
    'schemaVersion', 'id', 'title', 'status', 'width', 'height', 'tileSize',
    'coordinateConvention', 'reference', 'legend', 'rows',
    'buildings', 'rooms', 'roomFlows', 'portals', 'windows', 'clearances',
    'props', 'containers', 'containerTypes', 'enemies',
    'spawn', 'exits', 'bridges', 'bridgeHeadReserve', 'plazas',
    'tide', 'quotas', 'routeSpecs'
  ];

  /* 曾经入过库、现在只算不存的字段。存在即视为过期数据。 */
  const DERIVED_FIELDS = ['routes'];

  const key = (x, y) => x + ',' + y;
  const parseKey = k => k.split(',').map(Number);

  function cellsOfRect(rect) {
    const out = [];
    for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++) out.push([x, y]);
    return out;
  }

  function rectSize(rect) {
    return [rect[2] - rect[0] + 1, rect[3] - rect[1] + 1];
  }

  function terrainAt(data, x, y) {
    const rows = data.rows || [];
    if (x < 0 || y < 0 || x >= data.width || y >= data.height) return null;
    const row = rows[y];
    return typeof row === 'string' ? row[x] : null;
  }

  function isWalkableTerrain(data, x, y) {
    const ch = terrainAt(data, x, y);
    const rule = ch && data.legend && data.legend[ch];
    return !!(rule && rule.walkable);
  }

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  /* 只保留规范字段顺序，不接受 routes。用于保存，不用来校验。 */
  function normalizeForSave(data) {
    const out = {};
    for (const field of FIELD_ORDER) if (data[field] !== undefined) out[field] = data[field];
    for (const field of Object.keys(data)) if (!(field in out) && !DERIVED_FIELDS.includes(field)) out[field] = data[field];
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }

  function parse(text) {
    const data = JSON.parse(text);
    return data;
  }

  function serialize(data) {
    return JSON.stringify(normalizeForSave(data), null, 2) + '\n';
  }

  /* 校验器只管语义：缺字段、字段类型不对时给出空值，不在这里抛。 */
  function coerce(data) {
    const d = Object.assign({}, data);
    if (!Number.isInteger(d.width)) d.width = Array.isArray(d.rows) && d.rows[0] ? d.rows[0].length : 0;
    if (!Number.isInteger(d.height)) d.height = Array.isArray(d.rows) ? d.rows.length : 0;
    for (const field of ['buildings', 'rooms', 'portals', 'windows', 'clearances', 'props', 'containers', 'enemies', 'exits', 'bridges', 'plazas', 'routeSpecs']) {
      if (!Array.isArray(d[field])) d[field] = [];
    }
    if (!d.legend || typeof d.legend !== 'object') d.legend = {};
    if (!d.containerTypes || typeof d.containerTypes !== 'object') d.containerTypes = {};
    if (!d.quotas || typeof d.quotas !== 'object') d.quotas = {};
    if (!d.quotas.regions || typeof d.quotas.regions !== 'object') d.quotas.regions = {};
    if (!d.spawn || typeof d.spawn !== 'object') d.spawn = { x: -1, y: -1 };
    if (!d.tide || typeof d.tide !== 'object') d.tide = { implemented: false, zones: [] };
    if (!Array.isArray(d.tide.zones)) d.tide.zones = [];
    if (!d.roomFlows || typeof d.roomFlows !== 'object') d.roomFlows = {};
    return d;
  }

  /* 视图旋转：rot 为顺时针角度 0/90/180/270，返回屏幕坐标。
   * 90/270 时画布宽高互换，用 rotatedSize 取新尺寸。 */
  function project(x, y, rot, w, h) {
    switch (((rot % 360) + 360) % 360) {
      case 90: return [h - 1 - y, x];
      case 180: return [w - 1 - x, h - 1 - y];
      case 270: return [y, w - 1 - x];
      default: return [x, y];
    }
  }

  function unproject(sx, sy, rot, w, h) {
    switch (((rot % 360) + 360) % 360) {
      case 90: return [sy, h - 1 - sx];
      case 180: return [w - 1 - sx, h - 1 - sy];
      case 270: return [w - 1 - sy, sx];
      default: return [sx, sy];
    }
  }

  function rotatedSize(w, h, rot) {
    return ((rot % 360) + 360) % 360 % 180 === 0 ? [w, h] : [h, w];
  }

  function summary(data) {
    const d = coerce(data);
    return {
      id: d.id, title: d.title, status: d.status,
      size: d.width + '×' + d.height, tileSize: d.tileSize,
      buildings: d.buildings.length, rooms: d.rooms.length,
      portals: d.portals.length, windows: d.windows.length,
      props: d.props.length, containers: d.containers.length, containerTypes: Object.keys(d.containerTypes).length,
      enemies: d.enemies.length, exits: d.exits.length, bridges: d.bridges.length,
      routes: d.routeSpecs.length, schemaVersion: d.schemaVersion
    };
  }

  return {
    SCHEMA_VERSION, FIELD_ORDER, DERIVED_FIELDS,
    key, parseKey, cellsOfRect, rectSize, terrainAt, isWalkableTerrain,
    clone, normalizeForSave, parse, serialize, coerce,
    project, unproject, rotatedSize, summary
  };
});
