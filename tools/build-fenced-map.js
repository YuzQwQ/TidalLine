#!/usr/bin/env node
/* 把围栏区设计稿 layout.json 编译成运行时 FENCED_MAP，写回 js/data.js。
 *
 * 与 tools/build-linhai-map.js 的编译约定保持一致（容器 / 撤离点 / 出生点
 * 叠加进 rows，门洞生成 doors + doorAxes，terrain 覆盖所有出现的字符），
 * 但额外保留 buildings / clearances / plazas / routeSpecs / rooms / pois
 * 等命名字段 —— 这些正是任务系统要用的可寻址地点。
 *
 *   node tools/build-fenced-map.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MapArt = require('../design/maps/shared/map-art-map.js');
const Core = require('../design/maps/shared/map-core.js');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'design/maps/fenced-zone/layout.json');
const DATA = path.join(ROOT, 'js/data.js');
const { validate } = require(path.join(ROOT, 'design/maps/fenced-zone/validate.cjs'));
const START = '/* BEGIN GENERATED MAP CATALOG */';
const END = '/* END GENERATED MAP CATALOG */';

const center = r => [Math.round((r[0] + r[2]) / 2), Math.round((r[1] + r[3]) / 2)];

function compile() {
  const bytes = fs.readFileSync(SRC);
  const d = JSON.parse(bytes);
  validate(d);

  const grid = d.rows.map(row => [...row]);
  for (const c of d.containers) grid[c.y][c.x] = c.type;
  grid[d.spawn.y][d.spawn.x] = 'P';
  for (const e of d.exits) grid[e.y][e.x] = 'E';

  const terrain = {};
  for (const [ch, rule] of Object.entries(d.legend)) {
    terrain[ch] = {
      art: rule.art || 'floor', solid: !rule.walkable && ch !== '~', blocked: !rule.walkable,
      opaque: !!rule.opaque, permanentWater: ch === '~'
    };
  }
  /* 容器字符是编译期才叠进 rows 的，设计稿图例里没有；这里补齐地形规则，
     否则 M.load 查不到字符会退化成默认地板。 */
  for (const ch of Object.keys(d.containerTypes)) {
    if (!terrain[ch]) terrain[ch] = { art: 'floor', solid: false, blocked: false,
      opaque: false, permanentWater: false };
  }

  const doors = [], doorAxes = {};
  for (const p of d.portals.filter(p => p.kind === 'door')) {
    const [x, y] = p.cells[0];
    const axis = Core.doorAxis(d,p);
    const door = {
      id: p.id, cells: p.cells, axis, wallMaterial: Core.doorMaterial(d,p), reinforced: false,
      doorType: p.doorType || 'normal',
      kickFrom: p.kickFrom || (axis === 'vertical' ? 'w' : 'n'),
      keyId: p.keyId || ''
    };
    doors.push(door);
    for (const c of p.cells) doorAxes[c.join(',')] = axis;
  }

  /* POI 注册表：所有命名地点 + 钥匙柜。供 js/map-poi.js 查询，
     委托 / 信任解锁才能引用具体地点而不是只能「交仓库材料」。 */
  const pois = [];
  const safeAnchor = (rect, anchor) => {
    const walk = ([x,y]) => d.rows[y]?.[x] !== '~' && d.legend[d.rows[y]?.[x]]?.walkable;
    if (walk(anchor)) return anchor;
    const cells=[];for(let y=rect[1];y<=rect[3];y++)for(let x=rect[0];x<=rect[2];x++)if(walk([x,y]))cells.push([x,y]);
    cells.sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1]));
    if(!cells.length)throw Error('命名地点没有可通行标注点 '+rect.join(','));
    return cells[0];
  };
  const add = (id, name, type, rect, anchor, region, tags) => pois.push({
    id: 'fenced-zone:' + id, mapId: 'fenced-zone', name, type,
    rect, anchor: safeAnchor(rect,anchor), region, tags: tags || []
  });
  for (const b of d.buildings) add(b.id, b.name, 'building', b.rect, center(b.rect), b.id, ['loot:' + b.loot]);
  for (const r of d.rooms) add(r.id, r.name, r.type === 'bay' ? 'bay' : 'room', r.rect, r.anchor, r.building, []);
  for (const c of d.clearances) add(c.id, c.name, 'clearance', c.rect, center(c.rect), 'outdoors', []);
  for (const p of d.plazas) add(p.id, p.name, 'plaza', p.rect, center(p.rect), 'outdoors', []);
  for (const e of d.exits) add('exit-' + e.id, e.name, 'exit', [e.x, e.y, e.x, e.y], [e.x, e.y], 'outdoors', ['risk:' + (e.risk || '低')]);
  add('entrance', d.spawn.name, 'entrance',
    [d.spawn.x, d.spawn.y, d.spawn.x, d.spawn.y], [d.spawn.x, d.spawn.y], 'outdoors', ['fixed']);
  for (const c of d.containers.filter(c => c.type === 'K')) {
    add(c.id, '钥匙柜', 'container', [c.x, c.y, c.x, c.y], [c.x, c.y], c.region, ['key']);
  }

  const tileHeights = { '#': 2, r: 3, q: 2, i: 2, c: 2, v: 2, '+': 2, '~': 0, E: 3, P: 3 };
  for (const ch of Object.keys(d.containerTypes)) tileHeights[ch] = 2;

  return {
    id: 'fenced-zone', title: d.title, width: d.width, height: d.height,
    tideEnabled: true,
    source: 'design/maps/fenced-zone/layout.json',
    sourceSha256: crypto.createHash('sha256').update(String(bytes).replace(/\r\n/g, '\n')).digest('hex'),
    terrain, terrainRows: d.rows, rows: grid.map(r => r.join('')),
    spawn: d.spawn, exits: d.exits, doors, doorAxes, tileHeights,
    props: d.props.map(p=>({...MapArt.paintDefaults(MapArt.resolvePropArt(p),p.facing),...p,art:MapArt.resolvePropArt(p),ground:p.ground===true})), overlays: MapArt.resolveOverlays(d),
    containers: d.containers,
    enemies: d.enemies.map(e => ({ ...e, t: e.type })),
    lootSpawns: d.lootSpawns, rooms: d.rooms,
    districts: d.buildings.map(b => ({
      key: b.id, name: b.name, shape: b.shape, rect: b.rect,
      loot: b.loot, label: b.label, footprint: b.footprint
    })),
    buildings: d.buildings, clearances: d.clearances, plazas: d.plazas,
    routeSpecs: d.routeSpecs, tideReserve: d.tide,
    pois, fixedEntrance: true
  };
}

function build() {
  const compiled = compile();
  const source = fs.readFileSync(DATA, 'utf8');
  const a = source.indexOf(START), b = source.indexOf(END);
  if (a < 0 || b < a) throw new Error('js/data.js 缺少地图目录生成边界');
  const block = START + '\n' +
    '// 由 tools/build-fenced-map.js 生成，请修改设计稿再重建。\n' +
    'const FENCED_MAP = ' + JSON.stringify(compiled) + ';\n' +
    'const MAP_CATALOG = [RAID_MAP, FENCED_MAP];\n' + END;
  fs.writeFileSync(DATA, source.slice(0, a) + block + source.slice(b + END.length));
  console.log(`已同步围栏区地图：${compiled.width}×${compiled.height} / ` +
    `${compiled.containers.length} 容器 / ${compiled.doors.length} 门 / ` +
    `${compiled.rooms.length} 房间 / ${compiled.pois.length} POI / ${compiled.enemies.length} 敌人`);
  return compiled;
}

module.exports = { compile, build };
if (require.main === module) build();
