/* 已完成批次的像素规格、透明边界和最近邻连铺检查。 */
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const manifest=require('./tile-generation.json');
const status=require('./tile-art-status.json');
(async()=>{
 const selected=manifest.assets.filter(a=>a.status==='verified');
 assert.equal(selected.length,status.stats.requiredVerifiedFiles);
 assert.equal(selected.filter(a=>a.batch===1).length,3);assert.equal(selected.filter(a=>a.batch===2).length,5);
 assert.equal(selected.filter(a=>a.batch===3).length,4);
 assert.equal(selected.filter(a=>a.batch===4).length,4);
 assert.equal(selected.filter(a=>a.batch===5).length,2);
 for(const entry of selected){
  assert.equal(entry.status,'verified');assert(entry.prompt&&entry.prompt.length>100);assert(fs.existsSync(path.join(__dirname,entry.source)));
  const png=fs.readFileSync(path.join(root,entry.output));
  assert.equal(crypto.createHash('sha256').update(png).digest('hex'),entry.outputSha256);
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,32);assert.equal(info.height,32);assert.equal(info.channels,4);
  const overlay=entry.kind==='overlay';
  const colors=new Set();let visible=0;
  for(let i=0;i<data.length;i+=4){assert(data[i+3]===0||data[i+3]===255);if(!overlay)assert.equal(data[i+3],255);if(data[i+3]){visible++;colors.add(data.slice(i,i+3).join(','));}}assert(colors.size<=16);
  assert.equal(colors.size,entry.quality.colors);assert(colors.size>=3,entry.id+' 不能是纯色占位');
  const rail=entry.id.match(/^bridge_(stone|wood)_rail_([ns])$/);
  const bank=entry.id.startsWith('canal_bank_'),window=entry.id==='shop_window_ns',breach=entry.id.match(/^wall_breach_([ns])$/),rubble=entry.id==='rubble_decal';
  const steps=entry.id.startsWith('canal_steps_');
  if(!overlay||bank||window)for(const direction of overlay||steps?['vertical']:['horizontal','vertical'])assert(entry.quality.wrapDifference[direction]<=Math.max(12,entry.quality.interiorDifference[direction]*2),entry.id+' 纹理边界差异异常');
  if(bank){
   assert.equal(visible,192);const west=entry.id==='canal_bank_w';
   for(let y=0;y<32;y++)for(let x=0;x<32;x++)assert.equal(data[(y*32+x)*4+3],(west?x>=26:x<=5)?255:0,entry.id+' 岸线未对齐边缘或侵入透明区');
   assert.deepEqual(entry.quality.bounds,{left:west?26:0,top:0,right:west?31:5,bottom:31});
  }
  if(window){
   assert(visible>=192&&visible<=384,'橱窗需要保留可辨识的框与玻璃');
   for(let y=0;y<32;y++){
    for(let x=0;x<32;x++)if(x<10||x>21)assert.equal(data[(y*32+x)*4+3],0,'橱窗侵入格外背景');
    assert(Array.from({length:12},(_,dx)=>data[(y*32+10+dx)*4+3]).some(Boolean),'橱窗竖向连接有断行');
   }
  }
  if(breach){
   assert(visible>=500&&visible<=768,'断墙端头应有实体顶面与透明端缘');
   const first=breach[1]==='n'?24:0,last=breach[1]==='n'?31:7;
   for(let y=first;y<=last;y++)for(let x=0;x<32;x++)assert.equal(data[(y*32+x)*4+3],0,'断墙端头越过定位带');
  }
  if(rubble){
   assert(visible>=40&&visible<=320,'碎石应为稀疏地贴');
   for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(x<4||x>27||y<6||y>25)assert.equal(data[(y*32+x)*4+3],0,'碎石越过留白');
  }
  if(rail){
   const height=rail[1]==='stone'?6:8,north=rail[2]==='n',top=north?32-height:0;
   for(let y=0;y<32;y++)if(y<top||y>=top+height)for(let x=0;x<32;x++)assert.equal(data[(y*32+x)*4+3],0,entry.id+' 栏杆越过外侧定位带');
   for(let x=0;x<32;x++)assert(Array.from({length:height},(_,y)=>data[((top+y)*32+x)*4+3]).some(Boolean),entry.id+' 水平连接出现断列');
   if(rail[1]==='wood'){
    assert(visible>=72&&visible<=208,'木栏杆需保留足够透明空隙');
    assert(Array.from({length:height},(_,dy)=>Array.from({length:32},(_,x)=>data[((top+dy)*32+x)*4+3]).filter(a=>a===0).length).some(n=>n>=24),'木栏杆没有透水空隙');
   }else assert(visible>=144&&visible<=192,'石栏应为连续低石缘');
   // 栏柱可位于重复边界：比较实际接缝与内部最大结构跳变，避免把栏柱误判为接缝缺陷。
   const columnDiff=(a,b)=>{let total=0;for(let y=0;y<32;y++)for(let c=0;c<4;c++){const p=(y*32+a)*4,q=(y*32+b)*4;const av=c===3?data[p+3]:data[p+3]?data[p+c]:0,bv=c===3?data[q+3]:data[q+3]?data[q+c]:0;total+=Math.abs(av-bv);}return total/128;};
   const interiorMax=Math.max(...Array.from({length:31},(_,x)=>columnDiff(x,x+1)));
   assert(columnDiff(31,0)<=Math.max(12,interiorMax+2),entry.id+' 横向衔接差异异常');
  }
  const {data:repeat,info:repeatInfo}=await sharp(path.join(__dirname,'tile-previews',entry.id+'-repeat.png')).resize(96,96,{kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(repeatInfo.width,96);assert.equal(repeatInfo.height,96);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
   const to=(y*96+x)*4,from=((y%32)*32+(x%32))*4;
   assert.equal(repeat[to+3],data[from+3],entry.id+' 预览改变透明度');
   // 全透明调色板项的 RGB 不参与显示，合成时可被规范为零。
   if(data[from+3])for(let c=0;c<3;c++)assert.equal(repeat[to+c],data[from+c],entry.id+' 预览改变可见像素');
  }
  const large=await sharp(path.join(__dirname,'tile-previews',entry.id+'-large.png')).metadata();assert.equal(large.width,256);assert.equal(large.height,256);
 }
 const clinic=await sharp(path.join(__dirname,'tile-previews/clinic-breach-assembly.png')).resize(160,160,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
 const floor=await sharp(path.join(root,'assets/tiles/floor.png')).ensureAlpha().raw().toBuffer();
 const rubble=await sharp(path.join(root,'assets/props/rubble_decal.png')).ensureAlpha().raw().toBuffer();
 // 两个开口格保持完整地面，仅在其中一格叠加非阻挡碎石；断墙在相邻的实体墙格。
 for(let y=32;y<96;y++)for(let x=64;x<96;x++){
  const at=(y*160+x)*4,from=((y%32)*32+x%32)*4,chip=y<64&&rubble[from+3];
  for(let c=0;c<4;c++)assert.equal(clinic[at+c],chip?rubble[from+c]:floor[from+c],'断墙侵入两格破口通路');
 }
 const canal=await sharp(path.join(__dirname,'tile-previews/canal_water-canal.png')).metadata();assert.equal(canal.width,384);assert.equal(canal.height,512);
 const stepsScene=await sharp(path.join(__dirname,'tile-previews/canal-steps-assembly.png')).resize(384,384,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
 const water=await sharp(path.join(root,'assets/tiles/canal_water.png')).ensureAlpha().raw().toBuffer();
 // 只在既定六个阶梯格画三格连铺；水道保持完整，避免图像造成第三条跨河路线。
 const layout=require('./layout.json');
 for(const [id,x,first]of [['canal_steps_w',2,7],['canal_steps_e',9,3]]){
  const stair=await sharp(path.join(root,'assets/tiles',id+'.png')).ensureAlpha().raw().toBuffer();
  const panel=await sharp(path.join(__dirname,'tile-previews',id+'-context.png')).resize(96,96,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let row=0;row<3;row++)assert.equal(layout.rows[20+first+row][27+x],'s');
  for(let y=first*32;y<(first+3)*32;y++)for(let px=x*32;px<(x+1)*32;px++)for(let c=0;c<4;c++)assert.equal(stepsScene[(y*384+px)*4+c],stair[((y%32)*32+px%32)*4+c],id+' 原坐标三格阶梯不一致');
  for(let y=0;y<96;y++)for(let px=32;px<64;px++)for(let c=0;c<4;c++)assert.equal(panel[(y*96+px)*4+c],stair[((y%32)*32+px%32)*4+c],id+' 连铺高度或像素改变');
 }
 for(let y=0;y<384;y++)for(let x=96;x<288;x++)for(let c=0;c<4;c++)assert.equal(stepsScene[(y*384+x)*4+c],water[((y%32)*32+x%32)*4+c],'阶梯或岸线侵入六格水面');
 const context=await sharp(path.join(__dirname,'tile-previews/banks-and-bridges.png')).resize(384,448,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
 for(const [id,from,to]of [['bridge_stone_deck',2,5],['bridge_wood_deck',9,11]]){
  const tile=await sharp(path.join(root,'assets/tiles',id+'.png')).ensureAlpha().raw().toBuffer();
  for(let y=from*32;y<(to+1)*32;y++)for(let x=2*32;x<10*32;x++)for(let c=0;c<4;c++)assert.equal(context[(y*384+x)*4+c],tile[((y%32)*32+(x%32))*4+c],id+' 桥面被岸线侵占或桥宽错误');
 }
 const railed=await sharp(path.join(__dirname,'tile-previews/bridges-with-rails.png')).resize(384,448,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
 const railRows=new Map();
 for(const [id,row]of [['bridge_stone_rail_n',1],['bridge_stone_rail_s',6],['bridge_wood_rail_n',8],['bridge_wood_rail_s',12]])railRows.set(row,await sharp(path.join(root,'assets/props',id+'.png')).ensureAlpha().raw().toBuffer());
 for(let y=0;y<448;y++)for(let x=0;x<384;x++){
  const at=(y*384+x)*4,rail=railRows.get(Math.floor(y/32)),r=((y%32)*32+(x%32))*4;
  const draw=rail&&x>=64&&x<320&&rail[r+3];
  for(let c=0;c<4;c++)assert.equal(railed[at+c],draw?rail[r+c]:context[at+c],'桥栏侵入桥面或透明空隙未透出河水');
 }
 console.log(`OK: ${selected.length} 张成品/原稿/提示词一致、32×32、16 色以内、透明岸线边界、连续拼接与像素一致、6 格河面及 4/3 格桥面组合预览；进度 ${selected.length}/18`);
})().catch(error=>{console.error(error);process.exitCode=1;});
