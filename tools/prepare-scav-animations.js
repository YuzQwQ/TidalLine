/* Generated action atlases -> hard-alpha, anchored 64px animation strips. No character drawing. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),spec=require('../assets/source/prompts/scav-animations-v1.json'),out=path.join(root,'design/enemies/scav-animation-v1'),source=path.join(root,'assets/source/scav-batch-01');
const names={walk:'行走',aim:'抬枪瞄准',shoot:'射击',reload:'装填',pump:'泵动'},directions={s:'正面',e:'右侧',n:'背面'};
function measure(data,w,h){
 let left=w,top=h,right=-1,bottom=-1;const rows=Array(h).fill(0);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;data[i+3]=data[i+3]>=128?255:0;if(!data[i+3]){data[i]=data[i+1]=data[i+2]=0;continue;}rows[y]++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left)throw Error('Empty frame');
 const peak=Math.max(...rows),headTop=rows.findIndex(n=>n>=peak*.20);let foot=bottom;
 while(foot>headTop&&rows[foot]<peak*.08)foot--;
 let hl=w,hr=-1;for(let y=headTop;y<headTop+(foot-headTop)*.18;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]){hl=Math.min(hl,x);hr=Math.max(hr,x);}
 return {bounds:{left,top,width:right-left+1,height:bottom-top+1},headTop,foot,headCenter:(hl+hr)/2,bodyHeight:foot-headTop+1};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const assets=[];
 for(const job of spec.assets){const meta=await sharp(path.join(root,job.source)).metadata();for(const [row,dir]of spec.directions.entries()){
  const cells=[];for(let f=0;f<job.frames;f++){
   const left=Math.round(f*meta.width/job.frames),right=Math.round((f+1)*meta.width/job.frames),top=Math.round(row*meta.height/3),bottom=Math.round((row+1)*meta.height/3);
   const {data,info}=await sharp(path.join(root,job.source)).extract({left,top,width:right-left,height:bottom-top}).ensureAlpha().raw().toBuffer({resolveWithObject:true});cells.push({data,info,...measure(data,info.width,info.height),sourceCell:[left,top,right-left,bottom-top]});
  }
  const heights=cells.map(f=>f.bodyHeight).sort((a,b)=>a-b),scale=26/heights[Math.floor(heights.length/2)],layers=[],frames=[];
  for(const [frame,f]of cells.entries()){
   const b=f.bounds,width=Math.max(1,Math.round(b.width*scale)),height=Math.max(1,Math.round(b.height*scale));
   const left=Math.round(32-(f.headCenter-b.left)*scale),top=Math.round(44-(f.foot-b.top)*scale);
   if(left<1||top<1||left+width>63||top+height>63)throw Error('Clipped '+job.state+'/'+dir+'/'+frame);
   const png=await sharp(f.data,{raw:f.info}).extract(b).resize(width,height,{kernel:'nearest'}).png().toBuffer();layers.push({input:png,left:left+frame*64,top});
   frames.push({sourceCell:f.sourceCell,foot:[32,44],bodyHeight:+(f.bodyHeight*scale).toFixed(2),headX:+(left+(f.headCenter-b.left)*scale).toFixed(2),bounds:[left,top,width,height]});
  }
  const id='scav_'+job.state+'_'+dir,target='assets/anim/'+id+'.png';
  // A native 4-bit PNG palette keeps all frames on a small, consistent pixel-art palette.
  await sharp({create:{width:job.frames*64,height:64,channels:4,background:'#00000000'}}).composite(layers).png({palette:true,colours:16,dither:0}).toFile(path.join(root,target));
  assets.push({id,unit:'scav',state:job.state,direction:dir,target,source:job.source,frameSize:64,frameCount:job.frames,scale,alphaThreshold:128,paletteEntries:16,normalization:'one scale per strip; broad head-to-foot body span excludes narrow gun/muzzle pixels; head center x32, foot y44',frames});
 }}
 const manifest={generator:'built-in image_gen',prompts:'assets/source/prompts/scav-animations-v1.json',sourceDirectory:'assets/source/scav-batch-01',status:'ready',strips:assets.length,frames:assets.reduce((n,a)=>n+a.frameCount,0),directions:spec.directions,west:'mirror east in existing renderer',assets};for(const folder of [out,source])fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const W=660,H=510,labels=['<rect width="660" height="510" fill="#142019"/>','<text x="18" y="28" fill="#e0d1a5" font-size="19">拾荒者 · 动画总览</text>'];
 for(const [col,dir]of spec.directions.entries())labels.push(`<text x="${240+col*150}" y="52" text-anchor="middle" fill="#b9c7af" font-size="13">${directions[dir]}</text>`);
 for(const [row,job]of spec.assets.entries()){labels.push(`<text x="18" y="${95+row*86}" fill="#dbc796" font-size="14">${names[job.state]}</text>`);for(let col=0;col<3;col++)labels.push(`<rect x="${174+col*150}" y="${60+row*86}" width="132" height="80" fill="#203327" stroke="#617252"/>`);}
 const base=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Microsoft YaHei, sans-serif">${labels.join('')}</svg>`)).png().toBuffer(),sprites={};
 for(const a of assets)for(let f=0;f<a.frameCount;f++)sprites[a.id+'_'+f]=await sharp(path.join(root,a.target)).extract({left:f*64,top:0,width:64,height:64}).resize(128,128,{kernel:'nearest'}).extract({left:24,top:24,width:80,height:80}).png().toBuffer();
 const pages=[];for(let i=0;i<24;i++){const layers=[];for(const [row,job]of spec.assets.entries())for(const [col,dir]of spec.directions.entries()){const frame=job.state==='walk'?i%job.frames:Math.min(job.frames-1,Math.floor(i%8/2));layers.push({input:sprites['scav_'+job.state+'_'+dir+'_'+frame],left:200+col*150,top:60+row*86});}pages.push(await sharp(base).composite(layers).ensureAlpha().raw().toBuffer());}
 await sharp(pages[0],{raw:{width:W,height:H,channels:4}}).png().toFile(path.join(source,'preview.png'));
 await sharp(Buffer.concat(pages),{raw:{width:W,height:H*pages.length,channels:4,pageHeight:H}}).gif({loop:0,delay:Array(pages.length).fill(140),colours:128,dither:0,effort:5}).toFile(path.join(source,'preview.gif'));
 const cards=assets.map(a=>`<article><h3>${names[a.state]} · ${directions[a.direction]}</h3><div class="sprite" data-frames="${a.frameCount}" style="background-image:url('../../../${a.target}')"></div><small>${a.frameCount}帧 · 64×64</small></article>`).join('');
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>拾荒者动画</title><style>*{box-sizing:border-box}body{margin:0;background:#142019;color:#d9dfca;font:14px/1.7 system-ui}main{max-width:1020px;margin:auto;padding:24px}a{color:#dfc78d}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}article{background:#203327;border:1px solid #596a4e;padding:12px}h3{font-size:14px}.sprite{width:192px;height:192px;background-repeat:no-repeat;background-size:auto 192px;image-rendering:pixelated;margin:auto}small{color:#adbaa0}@media(max-width:720px){.grid{grid-template-columns:1fr}main{padding:16px}}</style><main><h1>拾荒者 · 五种动作</h1><p>15条动画、39帧，向左镜像右侧。保留原有静态外观与战斗参数。</p><p><a href="../human-units-v1/test.html">进入独立实战场景，选择“拾荒者 · 短点射”</a> · <a href="../../../assets/source/scav-batch-01/preview.gif">GIF总览</a> · <a href="manifest.json">素材登记</a></p><div class="grid">${cards}</div></main><script>let f=0;setInterval(()=>{for(const el of document.querySelectorAll('.sprite'))el.style.backgroundPosition=(-f%Number(el.dataset.frames)*192)+'px 0';f++;},180);</script></html>`);
 console.log('Prepared '+assets.length+' scav strips / '+manifest.frames+' frames, gallery and animated preview');
})().catch(e=>{console.error(e);process.exitCode=1;});
