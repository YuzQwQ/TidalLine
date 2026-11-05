/* Built-in image_gen originals -> compact transparent VFX. Keep partial alpha. */
const fs=require('fs'),path=require('path'),sharp=require('sharp'),vm=require('vm');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/item-art/melee-slash');
(async()=>{
 const assets=[];
 for(const id of ['melee_slash_lr','melee_slash_rl','melee_thrust']){
  const a=JSON.parse(fs.readFileSync(path.join(folder,id+'.json'))),file=path.join(folder,a.source);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let l=info.width,t=info.height,r=-1,b=-1,transparent=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const alpha=data[(y*info.width+x)*4+3];if(alpha<16)transparent++;
   if(alpha>=16){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  }
  if(r<l||transparent<info.width*info.height*.15)throw Error('Missing transparent background: '+id);
  const [w,h]=a.size;
  const body=await sharp(file).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(w-8,h-8,{fit:'fill',kernel:'nearest'}).png().toBuffer();
  const png=await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:body,left:4,top:4}]).png({palette:true,colours:32,dither:0}).toBuffer();
  a.target='assets/effects/'+id+'.png';a.sourceSize=[info.width,info.height];
  await sharp(png).ensureAlpha().png().toFile(path.join(root,a.target));assets.push(a);
 }
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({generator:'Built-in image_gen',purpose:'Directional slash + separate pointed thrust; visual only',processing:'nearest, 32 colours, preserved partial alpha, 4px safe margins',assets},null,2)+'\n');
 const ctx=vm.createContext({});for(const f of ['config.js','data.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),ctx);
 const weapons=vm.runInContext('MELEE',ctx);
 const html=[
 '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>近战范围特效 · 第二版</title>',
 '<style>*{box-sizing:border-box}body{margin:0;background:#14231b;color:#d4dfd7;font:14px/1.7 system-ui}main{max-width:1100px;margin:auto;padding:24px}a{color:#aed5c3}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{padding:16px;background:#213729;min-width:0}img{width:100%;image-rendering:pixelated}.template img{height:160px;object-fit:contain}small{color:#a6c3b3}@media(max-width:600px){.grid{grid-template-columns:1fr}main{padding:14px}}</style>',
 '<main><h1>近战范围特效 · 第二版</h1><p>骨白外缘沿挥砍方向由粗渐细，灰色内侧残影；军刺使用独立尖端刺击。前摇显示淡轮廓，出手后保持80ms、再淡出160ms。外缘按真实扇角和半径绘制，向内增加厚度。</p>',
 '<p><a href="../../../index.html#range">进入靶场</a> · <a href="manifest.json">原稿与提示词</a></p><div class="grid">',
 ...assets.map(a=>'<article class="template"><h2>'+a.direction+'</h2><img src="../../../'+a.target+'" alt="'+a.id+'"><small>'+a.id+' · <a href="'+a.source+'">生成原稿</a></small></article>'),
 '</div><h2>七把武器 · 实际绘制结果（左→右 / 右→左）</h2><p>以下截图由真实游戏绘制函数生成，按整数倍展示。军刺左右两栏均为同一尖端形状。</p><div class="grid">',
 ...weapons.map(d=>'<article><h3>'+d.name+' · '+d.angle+'° / '+d.radius+'格</h3><img src="previews/'+d.id+'.png" alt="'+d.name+'攻击特效"><small>前摇 '+d.windup+'秒 · <a href="../../../assets/gear/'+d.id+'.png">装备图标</a></small></article>'),
 '</div></main></html>'].join('\n');
 fs.writeFileSync(path.join(folder,'index.html'),html);
 console.log('Prepared 2 directional slash templates and 1 thrust template; partial alpha preserved');
})().catch(e=>{console.error(e);process.exitCode=1;});
