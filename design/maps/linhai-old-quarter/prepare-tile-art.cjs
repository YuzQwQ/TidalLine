/* 地面按整幅整理；岸线按透明条段裁切并对齐格边。仅做交付规格整理。 */
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const manifestFile=path.join(__dirname,'tile-generation.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const batch=Number(process.argv[2]||1);
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const selected=manifest.assets.filter(a=>a.batch===batch);
if(!selected.length)throw Error('没有该批次的原稿：'+batch);
const folder=path.join(__dirname,'tile-previews');
const batchKey='batch-'+String(batch).padStart(2,'0');
const catalog=require('./tile-art-catalog.json');
function analyse(data){
 const colors=new Set();let opaque=0,partial=0,left=32,right=-1,top=32,bottom=-1;
 for(let i=0;i<data.length;i+=4){if(data[i+3]){colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);const p=i/4,x=p%32,y=Math.floor(p/32);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(data[i+3]===255)opaque++;else if(data[i+3])partial++;}
 const diff=(a,b)=>Math.abs(data[a]-data[b])+Math.abs(data[a+1]-data[b+1])+Math.abs(data[a+2]-data[b+2]);
 let edgeX=0,edgeY=0,innerX=0,innerY=0;
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const a=(y*32+x)*4;
  if(x===0)edgeX+=diff(a,(y*32+31)*4);
  if(y===0)edgeY+=diff(a,(31*32+x)*4);
  if(x<31)innerX+=diff(a,a+4);
  if(y<31)innerY+=diff(a,a+128);
 }
 return {width:32,height:32,colors:colors.size,opaquePixels:opaque,transparentPixels:1024-opaque-partial,partialAlphaPixels:partial,bounds:{left,top,right,bottom},
  wrapDifference:{horizontal:+(edgeX/96).toFixed(2),vertical:+(edgeY/96).toFixed(2)},
  interiorDifference:{horizontal:+(innerX/(32*31*3)).toFixed(2),vertical:+(innerY/(32*31*3)).toFixed(2)}};
}
async function normalize(entry,source,kind){
 if(kind==='ground')return sharp(source).resize(32,32,{fit:'fill',kernel:'nearest'}).flatten({background:'#31493f'}).png({palette:true,colours:16,dither:0}).toBuffer();
 const isBank=['canal_bank_w','canal_bank_e'].includes(entry.id);
 const rail=entry.id.match(/^bridge_(stone|wood)_rail_([ns])$/);
 const breach=entry.id.match(/^wall_breach_([ns])$/),window=entry.id==='shop_window_ns',rubble=entry.id==='rubble_decal';
 if(!isBank&&!rail&&!breach&&!window&&!rubble)throw Error('尚未定义此透明结构的规格整理：'+entry.id);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,right=-1,top=info.height,bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left)throw Error('结构原稿为空');
 const width=isBank?6:window?12:rubble?24:32,height=isBank||window?32:breach?24:rubble?20:rail[1]==='stone'?6:8;
 const strip=await sharp(data,{raw:info}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(width,height,{fit:'fill',kernel:'nearest'}).raw().toBuffer();
 for(let i=3;i<strip.length;i+=4)strip[i]=strip[i]>=128?255:0;
 const atRight=entry.id==='canal_bank_w',atBottom=!!rail&&rail[2]==='n'||!!breach&&breach[1]==='s';
 const padLeft=isBank?(atRight?26:0):Math.floor((32-width)/2),padTop=rubble?6:atBottom?32-height:0;
 entry.preparation={mode:'alpha-trim, nearest-neighbour fit, binary alpha, fixed edge alignment',stripWidth:width,stripHeight:height,anchor:isBank?(atRight?'right':'left'):window||rubble?'center':atBottom?'bottom':'top',canvas:32,paletteColours:16};
 return sharp(strip,{raw:{width,height,channels:4}}).extend({left:padLeft,right:32-width-padLeft,top:padTop,bottom:32-height-padTop,background:'#00000000'}).png({palette:true,colours:16,dither:0}).toBuffer();
}
async function repeat(png,cols,rows){
 const layers=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)layers.push({input:png,left:x*32,top:y*32});
 return sharp({create:{width:cols*32,height:rows*32,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
async function bankContext(entry,png){
 const quay=fs.readFileSync(path.join(root,'assets/tiles/quay_top.png')),water=fs.readFileSync(path.join(root,'assets/tiles/canal_water.png'));
 const layers=[],west=entry.id==='canal_bank_w';
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)layers.push({input:(x===(west?0:2)?quay:water),left:x*32,top:y*32});
 for(let y=0;y<3;y++)layers.push({input:png,left:west?0:64,top:y*32});
 return sharp({create:{width:96,height:96,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
async function stepsContext(entry,png){
 const road=fs.readFileSync(path.join(root,'assets/tiles/street_stone.png')),water=fs.readFileSync(path.join(root,'assets/tiles/canal_water.png'));
 const west=entry.id.endsWith('_w'),layers=[];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)layers.push({input:x===1?png:x===(west?0:2)?road:water,left:x*32,top:y*32});
 return sharp({create:{width:96,height:96,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
async function stepsAssembly(){
 const read=(dir,id)=>fs.readFileSync(path.join(root,'assets',dir,id+'.png'));
 const road=read('tiles','street_stone'),water=read('tiles','canal_water'),quay=read('tiles','quay_top');
 const west=read('tiles','canal_steps_w'),east=read('tiles','canal_steps_e'),banks=['w','e'].map(d=>read('props','canal_bank_'+d)),layers=[];
 // 截取草案 x27–38、y20–31，保留六格水道及两岸阶梯实际错位关系。
 for(let y=0;y<12;y++)for(let x=0;x<12;x++){
  const ws=x===2&&y>=7&&y<=9,es=x===9&&y>=3&&y<=5;
  layers.push({input:ws?west:es?east:x===2||x===9?quay:x>=3&&x<=8?water:road,left:x*32,top:y*32});
  if(!ws&&!es&&(x===2||x===9))layers.push({input:banks[x===2?0:1],left:x*32,top:y*32});
 }
 return sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
async function railContext(entry,png){
 const stone=entry.id.includes('_stone_'),north=entry.id.endsWith('_n');
 const deck=fs.readFileSync(path.join(root,'assets/tiles',stone?'bridge_stone_deck.png':'bridge_wood_deck.png'));
 const water=fs.readFileSync(path.join(root,'assets/tiles/canal_water.png')),layers=[];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)layers.push({input:y===(north?0:2)?water:deck,left:x*32,top:y*32});
 for(let x=0;x<3;x++)layers.push({input:png,left:x*32,top:north?0:64});
 return sharp({create:{width:96,height:96,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
async function bridgesContext(withRails=false){
 const read=id=>fs.readFileSync(path.join(root,'assets/tiles',id+'.png'));
 const water=read('canal_water'),road=read('street_stone'),quay=read('quay_top'),stone=read('bridge_stone_deck'),wood=read('bridge_wood_deck');
 const banks=['w','e'].map(dir=>fs.readFileSync(path.join(root,'assets/props/canal_bank_'+dir+'.png')));
 const layers=[];
 for(let y=0;y<14;y++)for(let x=0;x<12;x++){
  const onStone=y>=2&&y<=5,onWood=y>=9&&y<=11,onBridge=x>=2&&x<=9&&(onStone||onWood);
  layers.push({input:onBridge?(onStone?stone:wood):x===2||x===9?quay:x>=3&&x<=8?water:road,left:x*32,top:y*32});
  if(!onBridge&&(x===2||x===9))layers.push({input:banks[x===2?0:1],left:x*32,top:y*32});
 }
 if(withRails)for(const [id,row]of [['bridge_stone_rail_n',1],['bridge_stone_rail_s',6],['bridge_wood_rail_n',8],['bridge_wood_rail_s',12]]){
  const png=fs.readFileSync(path.join(root,'assets/props',id+'.png'));
  for(let x=2;x<10;x++)layers.push({input:png,left:x*32,top:row*32});
 }
 const png=await sharp({create:{width:384,height:448,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
 await sharp(png).resize(768,896,{kernel:'nearest'}).png().toFile(path.join(folder,withRails?'bridges-with-rails.png':'banks-and-bridges.png'));
}
async function clinicContext(){
 const read=(dir,id)=>fs.readFileSync(path.join(root,'assets',dir,id+'.png'));
 const wall=read('tiles','wall'),floor=read('tiles','floor'),road=read('tiles','street_stone'),layers=[];
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)layers.push({input:x>2?road:floor,left:x*32,top:y*32});
 layers.push({input:read('props','wall_breach_n'),left:64,top:0},{input:read('props','wall_breach_s'),left:64,top:96},{input:wall,left:64,top:128});
 for(const [x,y]of [[2,1],[3,2]])layers.push({input:read('props','rubble_decal'),left:x*32,top:y*32});
 return sharp({create:{width:160,height:160,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
async function windowContext(png){
 const read=id=>fs.readFileSync(path.join(root,'assets/tiles',id+'.png')),layers=[];
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
  const windowCell=x===1&&(y===1||y===2);
  layers.push({input:x===0?read('street_stone'):x===1&&!windowCell?read('wall'):read('floor'),left:x*32,top:y*32});
  if(windowCell)layers.push({input:png,left:x*32,top:y*32});
 }
 return sharp({create:{width:128,height:128,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const results=[],contactLayers=[];
 for(const [index,entry]of selected.entries()){
  const output=path.resolve(root,entry.output);
  if(!['tiles','props'].some(dir=>output.startsWith(path.join(root,'assets',dir)+path.sep)))throw Error('输出路径越界');
  if(fs.existsSync(output)&&(!entry.outputSha256||sha(fs.readFileSync(output))!==entry.outputSha256))throw Error('成品已存在且不匹配绘制记录，停止覆盖：'+entry.id);
  const source=path.resolve(__dirname,entry.source);
  const kind=entry.kind||catalog.core.find(a=>a.id===entry.id).kind;
  const png=await normalize(entry,source,kind);
  const {data}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const quality=analyse(data);
  const woodRail=/bridge_wood_rail_/.test(entry.id);
  const breach=entry.id.startsWith('wall_breach_'),window=entry.id==='shop_window_ns',rubble=entry.id==='rubble_decal';
  const minVisible=woodRail?72:breach?500:rubble?40:100,minTransparent=breach?256:window?640:rubble?600:800;
  if(quality.partialAlphaPixels||quality.colors>16||kind==='ground'&&quality.opaquePixels!==1024||kind==='overlay'&&(quality.transparentPixels<minTransparent||quality.opaquePixels<minVisible))throw Error('地块规格不合格：'+entry.id);
  if(woodRail&&quality.opaquePixels>208)throw Error('木栏杆缺少透明空隙：'+entry.id);
  const nextSha=sha(png),reviewStillValid=entry.status==='verified'&&entry.outputSha256===nextSha;
  fs.writeFileSync(output,png);entry.outputSha256=nextSha;entry.quality=quality;entry.status=reviewStillValid?'verified':'prepared';
  if(!reviewStillValid)delete entry.visualReview;
  const repeatPNG=await repeat(png,3,3);
  await sharp(repeatPNG).resize(768,768,{kernel:'nearest'}).png().toFile(path.join(folder,entry.id+'-repeat.png'));
  await sharp(png).resize(256,256,{kernel:'nearest'}).png().toFile(path.join(folder,entry.id+'-large.png'));
  let display=repeatPNG;
  if(entry.id.startsWith('canal_steps_')){
   display=await stepsContext(entry,png);
   await sharp(display).resize(768,768,{kernel:'nearest'}).png().toFile(path.join(folder,entry.id+'-context.png'));
  }
  if(kind==='overlay'){
   if(window)display=await windowContext(png);
   else if(breach||rubble){const ground=fs.readFileSync(path.join(root,'assets/tiles',rubble?'floor.png':'street_stone.png'));display=await sharp(await repeat(ground,3,3)).composite([{input:png,left:32,top:32}]).png().toBuffer();}
   else display=await (entry.id.startsWith('bridge_')?railContext:bankContext)(entry,png);
   await sharp(display).resize(768,768,{kernel:'nearest'}).png().toFile(path.join(folder,entry.id+'-context.png'));
  }
  contactLayers.push({input:await sharp(display).resize(288,288,{kernel:'nearest'}).png().toBuffer(),left:32+(index%3)*336,top:100+Math.floor(index/3)*400});
  if(entry.id==='canal_water')await sharp(await repeat(png,6,8)).resize(384,512,{kernel:'nearest'}).png().toFile(path.join(folder,'canal_water-canal.png'));
  results.push({id:entry.id,output:entry.output,...quality});
 }
 if(batch===4){
  const clinic=await clinicContext();
  await sharp(clinic).resize(800,800,{kernel:'nearest'}).png().toFile(path.join(folder,'clinic-breach-assembly.png'));
  for(const id of ['wall_breach_n','wall_breach_s','rubble_decal']){
   await sharp(clinic).resize(768,768,{kernel:'nearest'}).png().toFile(path.join(folder,id+'-context.png'));
  }
 }
 const height=100+Math.ceil(selected.length/3)*400;
 const label='第 '+batch+' 批 · '+((manifest.batches||[]).find(b=>b.id===batch)?.label||manifest.label);
 const svg=[`<rect width="1024" height="${height}" fill="#0b1411"/>`,`<text x="28" y="36" fill="#e1e9e0" font-size="24">${label}</text>`,'<text x="28" y="65" fill="#8aa590" font-size="13">每张 32×32 · 地面连铺 / 结构叠加 · 连铺区不叠加网格线</text>'];
 for(const [i,entry]of selected.entries()){const name=catalog.core.find(c=>c.id===entry.id).name,cx=176+(i%3)*336,dy=Math.floor(i/3)*400;svg.push(`<text x="${cx}" y="${426+dy}" text-anchor="middle" fill="#d8e4d7" font-size="16">${esc(name)}</text><text x="${cx}" y="${453+dy}" text-anchor="middle" fill="#799a82" font-family="Consolas,monospace" font-size="12">${entry.id} · 32×32 PNG</text>`);}
 await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="${height}" font-family="Microsoft YaHei,sans-serif">${svg.join('')}</svg>`)).composite(contactLayers).png().toFile(path.join(folder,batchKey+'-contact.png'));
 if(batch===2)await bridgesContext();
 if(batch===3)await bridgesContext(true);
 if(batch===5)await sharp(await stepsAssembly()).resize(768,768,{kernel:'nearest'}).png().toFile(path.join(folder,'canal-steps-assembly.png'));
 fs.writeFileSync(path.join(folder,batchKey+'-qa.json'),JSON.stringify({batch,preparation:'nearest-neighbour, <=16 colours; opaque grounds, binary-alpha edge overlays',assets:results},null,2)+'\n','utf8');
 fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n','utf8');
 console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
