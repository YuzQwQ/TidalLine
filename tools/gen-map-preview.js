/* 使用游戏地图和现有贴图绘制布局总览；需要 sharp。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({});
for (const file of ['config.js','data.js']) vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),ctx);
const { rows, districts, spawns, props, types } = vm.runInContext('({rows:MAP_ROWS,districts:MAP_DISTRICTS,spawns:SPAWNS,props:DECOR,types:CONTAINER_TYPES})',ctx);
const esc = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const size=20, left=28, top=128, width=rows[0].length*size+left*2, height=rows.length*size+top+106;
const defs=[], layers=[], images=new Map();
function sprite(group,id,x,y) {
  const key=group+'/'+id;
  if(!images.has(key)) {
    const file=path.join(root,'assets',group,id+'.png');
    if(!fs.existsSync(file)) return;
    const name='sprite'+images.size;
    defs.push(`<image id="${name}" width="${size}" height="${size}" href="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"/>`);
    images.set(key,name);
  }
  layers.push(`<use href="#${images.get(key)}" x="${left+x*size}" y="${top+y*size}"/>`);
}
for(let y=0;y<rows.length;y++) for(let x=0;x<rows[y].length;x++) {
  const ch=rows[y][x];
  sprite('tiles',ch==='#'?'wall':ch==='~'?'marsh':ch===','?'low':'floor',x,y);
  if(ch==='H') layers.push(`<rect x="${left+x*size}" y="${top+y*size}" width="20" height="20" fill="#8ab99b" opacity=".16"/>`);
  if(types[ch]) {
    sprite('props',types[ch].art,x,y);
    if(types[ch].kind==='heavy') layers.push(`<rect x="${left+x*size+1}" y="${top+y*size+1}" width="18" height="18" fill="none" stroke="#e6bf6c" stroke-width="1.5"/>`);
  }
  if(ch==='+'||ch==='S') {
    const wall=(a,b)=>rows[b]&&rows[b][a]==='#';
    const vertical=Number(wall(x,y-1))+Number(wall(x,y+1))>Number(wall(x-1,y))+Number(wall(x+1,y));
    sprite('props',(ch==='S'?'sdoor':'door')+(vertical?'_side':'')+'_open',x,y);
  }
  if(ch==='E') {
    sprite('props','exit',x,y);
    layers.push(`<rect x="${left+x*size-1}" y="${top+y*size-1}" width="22" height="22" fill="none" stroke="#7ee2b2" stroke-width="2"/>`);
  }
  if(ch==='P') {
    sprite('chars','player_s',x,y);
    layers.push(`<circle cx="${left+(x+.5)*size}" cy="${top+(y+.5)*size}" r="12" fill="none" stroke="#8affc5" stroke-width="2"/>`);
  }
}
for(const prop of props) sprite('props',prop.id,prop.x,prop.y);
const palette={scav:'#e6a364',echo:'#c390df',guard:'#81b8ef'}, names={scav:'拾',echo:'响',guard:'守'};
for(const spawn of spawns) {
  const x=left+(spawn.x+.5)*size,y=top+(spawn.y+.5)*size;
  layers.push(`<circle cx="${x}" cy="${y}" r="8.5" fill="#111b19" stroke="${palette[spawn.t]}" stroke-width="2"/><text x="${x}" y="${y+3.5}" text-anchor="middle" font-size="10" fill="${palette[spawn.t]}">${names[spawn.t]}</text>`);
}
for(const district of districts) {
  const [x,y]=district.label, text=district.name+(district.loot==='high'?' · 高物资':'');
  const w=text.length*13+20, px=left+(x+.5)*size, py=top+(y+.5)*size;
  layers.push(`<rect x="${px-w/2}" y="${py-11}" width="${w}" height="22" rx="3" fill="#10221c" stroke="${district.loot==='high'?'#a78e53':'#426e5c'}"/><text x="${px}" y="${py+4}" fill="${district.loot==='high'?'#e6ce92':'#bcd5c6'}" font-size="12" text-anchor="middle">${esc(text)}</text>`);
}
const boxes=rows.join('').split('').filter(ch=>types[ch]).length;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Microsoft YaHei, sans-serif">
<defs>${defs.join('')}</defs><rect width="100%" height="100%" fill="#0b1411"/>
<text x="28" y="36" fill="#dce7df" font-size="24" font-weight="bold">潮汐线 · 扩建街区总览</text>
<text x="28" y="64" fill="#8fae9d" font-size="14">${rows[0].length} × ${rows.length} 格 · 8 个街区 · ${boxes} 个容器 · ${spawns.length} 个敌人 · 3 个撤离点</text>
<text x="28" y="94" fill="#b0c4b7" font-size="13">黄框：重型物资　橙「拾」：拾荒者　紫「响」：回响体　蓝「守」：潮汐守卫　绿框：撤离　绿圈：出生</text>
${layers.join('')}
<text x="28" y="${height-65}" fill="#9ec7ac" font-size="14">南西避难楼保留出生缓冲；档案馆、泵房、研究所、船坞提高物资与守备密度。</text>
<text x="28" y="${height-37}" fill="#789b88" font-size="13">浅绿堤顶路连通三个撤离点。右下港池退潮可进入，平潮后深水封路；箱柜开空后仍占格。</text>
</svg>`;
(async()=>{
 const output=path.join(root,'output/map');fs.mkdirSync(output,{recursive:true});
 const file=path.join(output,'map-overview.png');
 await sharp(Buffer.from(svg)).png().toFile(file);
 console.log(file);
})().catch(error=>{console.error(error);process.exitCode=1;});
