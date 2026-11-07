const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/item-art/keys-v1');
async function main(){
 const file=path.join(folder,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8')),icons=[];
 for(const [i,a] of manifest.assets.entries()){
  const input=path.join(root,a.source),{data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=140){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)throw Error('Empty key art '+a.id);
  const fitted=await sharp(data,{raw:info}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(40,40,{fit:'inside',kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
  for(let j=3;j<fitted.data.length;j+=4)fitted.data[j]=fitted.data[j]>=128?255:0;
  const png=await sharp({create:{width:48,height:48,channels:4,background:'#00000000'}}).composite([{input:fitted.data,raw:fitted.info,left:Math.floor((48-fitted.info.width)/2),top:Math.floor((48-fitted.info.height)/2)}]).png({palette:true,colours:256,dither:0}).toBuffer();
  await sharp(png).ensureAlpha().png().toFile(path.join(root,a.target));
  Object.assign(a,{sourceSize:[info.width,info.height],canvas:[48,48],subjectSize:[fitted.info.width,fitted.info.height],processing:'alpha>=140 bounding crop; lanczos3 contain40x40; binary alpha; adaptive PNG palette up to256 colors; centered48x48',status:'ready'});
  icons.push({input:await sharp(png).resize(192,192,{kernel:'nearest'}).png().toBuffer(),left:i*224+16,top:16});
 }
 fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
 const labels='<svg width="'+manifest.assets.length*224+'" height="256" xmlns="http://www.w3.org/2000/svg">'+manifest.assets.map((a,i)=>'<text x="'+(i*224+112)+'" y="242" text-anchor="middle" fill="#c5b99a" font-family="monospace" font-size="22">'+a.number+'</text>').join('')+'</svg>';
 await sharp({create:{width:manifest.assets.length*224,height:256,channels:4,background:'#19221f'}}).composite([...icons,{input:Buffer.from(labels),left:0,top:0}]).png().toFile(path.join(folder,'preview.png'));
 // Keep rarity, retail prices, durability and drop settings exactly as configured.
 const specFile=path.join(root,'design/items/keys.json'),keys=JSON.parse(fs.readFileSync(specFile,'utf8'));
 for(const a of manifest.assets){const k=keys.find(k=>k.id===a.id);if(!k)throw Error('Unknown key '+a.id);k.iconId=a.id;}
 fs.writeFileSync(specFile,JSON.stringify(keys,null,2)+'\n');
 const cards=manifest.assets.map(a=>'<article><h2>'+a.number+' · '+a.name+'</h2><div class="images"><img class="large" src="../../items/'+a.id+'.png" alt="'+a.name+'"><img width="48" height="48" src="../../items/'+a.id+'.png" alt="48像素实际大小"></div><p>'+a.design+'</p><a href="sources/'+a.id+'.png">原稿</a></article>').join('');
 fs.writeFileSync(path.join(folder,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>潮汐线 · 房间钥匙图标</title><style>body{margin:32px;background:#19221f;color:#d5d3bf;font:15px/1.6 system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}article{padding:18px;border:1px solid #546154}h2{font-size:16px}.images{display:flex;align-items:end;gap:12px;min-height:192px}img{image-rendering:pixelated}.large{width:160px;height:160px}a{color:#c5b99a}p{font-size:13px}</style><h1>房间钥匙图标 · 统一透视</h1><p>左上匙柄，右下齿尖。运行时48×48，主体40×40；大图为原始生成稿。</p><main>'+cards+'</main></html>');
 console.log('Prepared '+icons.length+' key icons, originals and item bindings');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
