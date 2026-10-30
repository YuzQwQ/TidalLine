/* 将评审 JSON 编译为游戏快照；不在浏览器 fetch，file:// 和单文件版共用同一数据。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const draftDir = path.join(root, 'design/maps/linhai-old-quarter');
const { validate } = require(path.join(draftDir, 'validate.cjs'));
const MapArt = require(path.join(root, 'design/maps/shared/map-art-map.js'));
const START = '/* BEGIN GENERATED LINHAI MAP */';
const END = '/* END GENERATED LINHAI MAP */';
function compile(layoutOverride) {
  const bytes = layoutOverride ? Buffer.from(JSON.stringify(layoutOverride)) : fs.readFileSync(path.join(draftDir, 'layout.json'));
  const d = JSON.parse(bytes); validate(d);
  const grid = d.rows.map(row => [...row]);
  for (const box of d.containers) grid[box.y][box.x] = box.type;
  grid[d.spawn.y][d.spawn.x] = 'P';
  for (const ex of d.exits) grid[ex.y][ex.x] = 'E';
  const terrain = Object.fromEntries(Object.entries(d.legend).map(([ch, rule]) => [ch, {art:rule.art||MapArt.TILE_ART[ch]||'low',solid:ch==='#'||ch==='X',blocked:!rule.walkable,opaque:rule.opaque,permanentWater:ch==='~'}]));
  const doorAxes = {}, doors = [];
  for (const p of d.portals.filter(p => p.kind === 'door')) {
    const [x,y] = p.cells[0];
    const wall = (x,y) => ['#','X','w'].includes(d.rows[y]?.[x]);
    const axis = p.cells.length > 1 ? (p.cells[1][0]===x?'vertical':'horizontal')
      : Number(wall(x,y-1))+Number(wall(x,y+1)) > Number(wall(x-1,y))+Number(wall(x+1,y))?'vertical':'horizontal';
    const door = {id:p.id,cells:p.cells,axis,reinforced:['bank.security','bank.vault'].includes(p.id)};
    doors.push(door); for (const c of p.cells) doorAxes[c.join(',')] = axis;
  }
  const props = d.props.map(p => ({...p,id:p.id,art:MapArt.resolvePropArt(p),provisional:false,ground:p.ground===true})).sort((a,b)=>Number(b.ground)-Number(a.ground));
  const overlays = MapArt.resolveOverlays(d);
  return {id:'linhai-old-quarter',title:d.title,width:d.width,height:d.height,source:'design/maps/linhai-old-quarter/layout.json',sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),tideEnabled:false,
    terrain,terrainRows:d.rows,rows:grid.map(r=>r.join('')),spawn:d.spawn,exits:d.exits,doors,doorAxes,props,overlays,
    containers:d.containers,enemies:d.enemies,rooms:d.rooms,bridges:d.bridges,tideReserve:d.tide,
    districts:d.buildings.map(b=>({key:b.id,name:b.name,shape:b.shape,rect:b.rect,loot:b.id==='bank'?'high':'normal',label:[Math.round((b.rect[0]+b.rect[2])/2),b.rect[1]-1],footprint:b.footprint}))};
}
function build() {
  const file = path.join(root,'js/data.js'), source = fs.readFileSync(file,'utf8');
  const start = source.indexOf(START), end = source.indexOf(END);
  if(start<0 || end<start) throw Error('js/data.js 缺少地图生成边界');
  const compiled = compile();
  const block = START+'\n// 由 tools/build-linhai-map.js 生成，请修改设计稿再重建。\nconst RAID_MAP = '+JSON.stringify(compiled)+';\n'+END;
  let next=source.slice(0,start)+block+source.slice(end+END.length);
  const legacy=JSON.parse(fs.readFileSync(path.join(root,'design/maps/fenced-zone/runtime.json'),'utf8'));
  if(legacy.id!=='fenced-zone'||legacy.rows.length!==44||legacy.rows.some(row=>row.length!==64))throw Error('围栏区快照不完整');
  const catalogStart='/* BEGIN GENERATED MAP CATALOG */',catalogEnd='/* END GENERATED MAP CATALOG */';
  const ca=next.indexOf(catalogStart),cb=next.indexOf(catalogEnd);
  if(ca<0||cb<ca)throw Error('缺少地图目录生成边界');
  const catalog=catalogStart+'\nconst FENCED_MAP = '+JSON.stringify(legacy)+';\nconst MAP_CATALOG = [RAID_MAP, FENCED_MAP];\n'+catalogEnd;
  next=next.slice(0,ca)+catalog+next.slice(cb+catalogEnd.length);
  fs.writeFileSync(file,next);
  console.log(`已同步临海路地图：${compiled.width}×${compiled.height} / ${compiled.containers.length} 容器 / ${compiled.enemies.length} 敌人 / ${compiled.exits.length} 撤离点`);
  return compiled;
}
module.exports = {compile,build};
if(require.main===module)build();
