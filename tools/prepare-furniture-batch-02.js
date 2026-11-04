/* image_gen 原稿整理：裁透明边、原生32px/格采样、16色；不旋转或镜像。 */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/scene-furniture-batch-02');
async function main(){
 const file=path.join(folder,'manifest.json'),m=JSON.parse(fs.readFileSync(file,'utf8')),quality=[];
 for(const a of m.assets){
  const source=path.join(folder,a.source);if(!fs.existsSync(source)){if(process.argv.includes('--partial'))continue;throw Error('缺少原稿 '+a.id);}
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let l=info.width,t=info.height,r=-1,b=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  if(r<l)throw Error('空白原稿 '+a.id);
  const [w,h]=a.size;
  const {data:small,info:si}=await sharp(data,{raw:info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(w-4,h-6,{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
  for(let i=3;i<small.length;i+=4)small[i]=small[i]>=128?255:0;
  const quantized=await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:small,raw:si,left:Math.floor((w-si.width)/2),top:h-3-si.height}]).png({palette:true,colours:16,dither:0}).toBuffer();
  await sharp(quantized).ensureAlpha().png({palette:false}).toFile(path.join(root,a.target));
  a.status='ready';quality.push({id:a.id,source:[info.width,info.height],canvas:a.size,content:[si.width,si.height]});
 }
 fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify(quality,null,2)+'\n');
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
 const cards=m.assets.filter(a=>a.facing==='front').map(a=>'<article><h2>'+esc(a.name)+'</h2><p>'+a.base+' · '+a.size.join('×')+'px · '+a.size.map(v=>v/32).join('×')+'格</p><div class="views">'+m.assets.filter(x=>x.base===a.base).map(x=>'<figure><a href="'+x.source+'"><img src="../../'+x.target+'" width="'+x.size[0]*3+'" height="'+x.size[1]*3+'"></a><figcaption>'+({front:'正面',side:'侧面',back:'背面'}[x.facing])+'</figcaption></figure>').join('')+'</div></article>').join('');
 fs.writeFileSync(path.join(folder,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>潮汐线 · 场景家具第二批</title><style>*{box-sizing:border-box}body{background:#14231c;color:#cfddd3;font:14px/1.7 system-ui;margin:24px auto;padding:0 20px;max-width:1400px}a{color:#acccb6}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{background:#203329;border:1px solid #3d5548;padding:16px;min-width:0}h2{font-size:19px;margin:0}.views{display:flex;justify-content:space-around;align-items:center;gap:6px;min-height:230px;background:#102018}figure{margin:10px 0;min-width:0;text-align:center}img{image-rendering:pixelated;object-fit:contain;max-width:100%;height:auto}p,figcaption{color:#a9bdb0}@media(max-width:800px){main{grid-template-columns:1fr}}@media(max-width:390px){body{margin:12px auto;padding:0 8px}.views{min-height:150px}}</style><h1>场景家具第二批 · 12类 / 36张三向图</h1><p>32px网格 · 75°俯视 · 左上光源 · 透明背景 · 点击贴图查看原稿。家具均为不可搜索的实体物件，按占地碰撞。</p><p><a href="../scene-library/index.html">共用素材库</a> · <a href="../../design/maps/editor/index.html">地图编辑器</a> · <a href="manifest.json">规格与实际提示词</a></p><main>'+cards+'</main><h2>第二批候选 · 尚未绘制</h2><p>'+m.planned.map(a=>a.name+' '+a.size.join('×')).join(' / ')+'</p></html>');
 const thumbs=[];for(let n=0;n<m.assets.length;n++){const a=m.assets[n];if(!fs.existsSync(path.join(root,a.target)))continue;const buf=await sharp(path.join(root,a.target)).resize(a.size[0]*3,a.size[1]*3,{kernel:'nearest'}).toBuffer();thumbs.push({input:buf,left:(n%3)*220+Math.floor((220-a.size[0]*3)/2),top:Math.floor(n/3)*210+Math.floor((210-a.size[1]*3)/2)});}
 await sharp({create:{width:660,height:2520,channels:4,background:'#22382b'}}).composite(thumbs).png().toFile(path.join(folder,'contact-sheet.png'));
 console.log('已整理'+quality.length+'张三向家具图与预览页');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
