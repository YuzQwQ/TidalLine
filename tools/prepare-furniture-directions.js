/* 整理 image_gen 原稿，不绘制/替换内容：裁透明边、最近邻缩放、二值 alpha、16色。 */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/scene-furniture-directions');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
async function main(){
 const report=[];
 for(const a of manifest.assets){
  const source=path.join(folder,a.source);if(!fs.existsSync(source))continue;
  const target=path.join(root,a.target);
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=-1,y1=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x1<x0)throw Error(a.id+' empty source');
  const {data:pixels,info:small}=await sharp(data,{raw:info}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(a.fit[0],a.fit[1],{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
  for(let k=3;k<pixels.length;k+=4)pixels[k]=pixels[k]>=128?255:0;
  const indexed=await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite([{input:pixels,raw:small,left:Math.floor((32-small.width)/2),top:29-small.height}]).png({palette:true,colours:16,dither:0}).toBuffer();
  // 使用8位RGBA封装，兼容项目现有的轻量PNG预览器；颜色仍保留量化后的16色。
  await sharp(indexed).ensureAlpha().png({palette:false}).toFile(target);
  a.status='ready';report.push({id:a.id,sourceSize:[info.width,info.height],spriteSize:[small.width,small.height],canvas:[32,32]});console.log(a.id+' ready');
 }
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
