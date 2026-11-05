/* Generated originals -> native pixel sprites. Never invent or draw replacement raster art. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/item-art/melee');
function bounds(data,w,h,accept){let l=w,t=h,r=-1,b=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(data[i+3]>=160&&(!accept||accept(x,y,i))){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}if(r<l)throw Error('Empty original');return {l,t,r,b,w:r-l+1,h:b-t+1};}
async function quant(input,colours){const q=await sharp(input).png({palette:true,colours,dither:0}).toBuffer();return sharp(q).ensureAlpha().png().toBuffer();}
(async()=>{
  const assets=fs.readdirSync(folder).filter(f=>f.endsWith('.json')&&!['manifest.json','quality.json'].includes(f)).map(f=>JSON.parse(fs.readFileSync(path.join(folder,f)))).filter(a=>a.id&&a.source&&['icon','sheet'].includes(a.type));
  for(const a of assets){
    const file=path.join(folder,a.source),meta=await sharp(file).metadata();a.sourceSize=[meta.width,meta.height];
    if(a.type==='icon'){
      const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=bounds(data,info.width,info.height);
      const {data:p,info:s}=await sharp(data,{raw:info}).extract({left:b.l,top:b.t,width:b.w,height:b.h}).resize(40,40,{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
      for(let i=3;i<p.length;i+=4)p[i]=p[i]>=160?255:0;
      const composed=await sharp({create:{width:48,height:48,channels:4,background:'#00000000'}}).composite([{input:p,raw:s,left:Math.floor((48-s.width)/2),top:Math.floor((48-s.height)/2)}]).png().toBuffer();
      a.target='assets/gear/'+a.id+'.png';await fs.promises.writeFile(path.join(root,a.target),await quant(composed,16));
    }else{
      const frames=[];
      for(let f=0;f<a.frames;f++){
        const left=Math.round(f*meta.width/a.frames),right=Math.round((f+1)*meta.width/a.frames);
        const {data,info}=await sharp(file).extract({left,top:0,width:right-left,height:meta.height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
        const b=bounds(data,info.width,info.height),central=bounds(data,info.width,info.height,x=>x>info.width*.32&&x<info.width*.68);
        const blue=bounds(data,info.width,info.height,(x,y,i)=>x>info.width*.30&&x<info.width*.70&&data[i+2]>data[i]+8&&data[i+2]>data[i+1]+3);
        let sum=0,count=0;
        for(let y=blue.t;y<Math.min(blue.t+central.h*.24,info.height);y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;if(data[i+3]>=160&&data[i+2]>data[i]+8&&data[i+2]>data[i+1]+3){sum+=x;count++;}}
        frames.push({data,info,b,head:blue.t,foot:central.b,center:count?sum/count:info.width/2});
      }
      // Normalize each generated frame by its body, never by the raised blade.
      const bodyHeight=28;
      const layers=[];a.anchors=[];
      for(let f=0;f<frames.length;f++){
        const src=frames[f],scale=bodyHeight/(src.foot-src.head+1),b=src.b,w=Math.max(1,Math.round(b.w*scale)),h=Math.max(1,Math.round(b.h*scale));
        const {data,info}=await sharp(src.data,{raw:src.info}).extract({left:b.l,top:b.t,width:b.w,height:b.h}).resize(w,h,{kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});
        for(let i=3;i<data.length;i+=4)data[i]=data[i]>=160?255:0;
        const x=Math.round(32-(src.center-b.l)*scale),y=Math.round(46-(src.foot-b.t)*scale);
        if(x<1||y<1||x+w>63||y+h>63)throw Error(a.id+' frame '+f+' exceeds native canvas '+[x,y,w,h]);
        layers.push({input:data,raw:info,left:f*64+x,top:y});a.anchors.push({bodyHeight:Math.round((src.foot-src.head+1)*scale),feet:[32,46],bbox:[x,y,w,h]});
      }
      const composed=await sharp({create:{width:a.frames*64,height:64,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
      a.target='assets/anim/'+a.id+'.png';await fs.promises.writeFile(path.join(root,a.target),await quant(composed,32));
    }
    a.status='ready';console.log(a.id);
  }
  const manifest={generator:'Built-in image_gen',processing:'alpha >=160, nearest neighbour, binary alpha; body normalized by blue hood to foot, feet anchor 32/46',assets};
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const icons=assets.filter(a=>a.type==='icon'),sheets=assets.filter(a=>a.type==='sheet');
  fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>近战武器 · 美术与动画</title><style>*{box-sizing:border-box}body{margin:0;background:#14231b;color:#d4dfd7;font:14px/1.7 system-ui}main{max-width:1100px;margin:auto;padding:24px}a{color:#a8d4c4}.icons,.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}article{background:#213729;padding:14px;min-width:0;overflow:hidden}img{image-rendering:pixelated;max-width:100%;object-fit:contain}.icons img{width:144px;height:144px}.strip{width:100%;background:repeating-conic-gradient(#23342b 0 25%,#1d2c24 0 50%) 0/16px 16px}.native{width:auto;height:64px}.live{width:128px;height:128px;image-rendering:pixelated;background-repeat:no-repeat;margin:auto}h2{font-size:19px}small{color:#93b4a4}@media(max-width:700px){.grid,.icons{grid-template-columns:1fr}main{padding:14px}}</style><main><h1>近战武器 · 正式美术</h1><p>${icons.length} 张 48×48 图标；${sheets.length} 张三向持刀动画条，64×64 单帧，身体约 28px、脚底固定，左向镜像。前两帧前摇，后两帧命中与恢复；实际判定由状态机驱动。</p><p><a href="manifest.json">提示词与原稿</a> · <a href="../../../装备清单.html">装备清单</a> · <a href="../../../index.html#base">游戏</a></p><div class="icons">${icons.map(a=>`<article><h2>${a.id}</h2><img src="../../../${a.target}" alt="${a.id}"><p>透明图标 · 无稀有度底色</p></article>`).join('')}</div><h2>持刀动作</h2><div class="grid">${sheets.map(a=>`<article><h3>${a.state} · ${a.dir}</h3><div class="live" data-frames="${a.frames}" style="background-image:url('../../../${a.target}');background-size:${a.frames*128}px 128px"></div><img class="strip" src="../../../${a.target}" alt="${a.id}"><small>${a.frames} 帧 · 64×64 · <a href="${a.source}">原稿</a></small></article>`).join('')}</div></main><script>setInterval(()=>document.querySelectorAll('.live').forEach(e=>{const n=+e.dataset.frames,f=((+e.dataset.frame||0)+1)%n;e.dataset.frame=f;e.style.backgroundPosition=(-f*128)+'px 0'}),180)</script></html>`);
})().catch(e=>{console.error(e);process.exitCode=1;});
