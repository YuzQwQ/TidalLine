const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/doors-batch-06'),record=require('../assets/source/prompts/blue-steel-doors-v6.json');
(async()=>{
 fs.mkdirSync(path.join(folder,'sources'),{recursive:true});fs.mkdirSync(path.join(folder,'previous'),{recursive:true});const specFile=path.join(root,'design/maps/shared/scene-assets.json'),spec=JSON.parse(fs.readFileSync(specFile)),assets=[];let aperture;
 for(const job of record.assets){const f=path.join(folder,'sources',job.id+'.png');if(!fs.existsSync(f))fs.copyFileSync(job.originalSource,f);}
 // Slice all three variants by the open-frame proportions, retaining the old3px borders.
 const opened=await sharp(path.join(folder,'sources/sdoor_open.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),ai=(x,y)=>opened.data[(y*opened.info.width+x)*4+3]>=180;
 let ol=opened.info.width,ot=opened.info.height,or=-1,ob=-1;for(let y=0;y<opened.info.height;y++)for(let x=0;x<opened.info.width;x++)if(ai(x,y)){ol=Math.min(ol,x);or=Math.max(or,x);ot=Math.min(ot,y);ob=Math.max(ob,y);}
 const center=Math.floor((ol+or)/2),middle=Math.floor((ot+ob)/2);let il=center,ir=center,it=ot;while(il>=ol&&!ai(il,middle))il--;while(ir<=or&&!ai(ir,middle))ir++;while(it<=ob&&ai(center,it))it++;const ratios=[(il+1-ol)/(or-ol+1),(ir-ol)/(or-ol+1),(it-ot)/(ob-ot+1)];
 for(const job of record.assets){
  const source=path.join(folder,'sources',job.id+'.png'),target=path.join(root,'assets/props',job.id+'.png'),old=path.join(folder,'previous',job.id+'.png');if(!fs.existsSync(source))fs.copyFileSync(job.originalSource,source);if(!fs.existsSync(old))fs.copyFileSync(target,old);
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=180){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<l)throw Error('Empty '+job.id);
  const sw=r-l+1,sh=b-t+1,xs=[0,Math.round(sw*ratios[0]),Math.round(sw*ratios[1]),sw],ys=[0,Math.round(sh*ratios[2]),sh],dx=[6,9,22],dy=[4,7],dw=[3,13,3],dh=[3,23],pieces=[];
  for(let yy=0;yy<2;yy++)for(let xx=0;xx<3;xx++){const{data:p,info:s}=await sharp(data,{raw:info}).extract({left:l+xs[xx],top:t+ys[yy],width:xs[xx+1]-xs[xx],height:ys[yy+1]-ys[yy]}).resize(dw[xx],dh[yy],{fit:'fill',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});for(let i=3;i<p.length;i+=4)p[i]=p[i]>=180?255:0;pieces.push({input:p,raw:s,left:dx[xx],top:dy[yy]});}
  const png=await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite(pieces).png({palette:true,colours:16,dither:0}).toBuffer();const{data:n,info:ni}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});await sharp(n,{raw:ni}).png().toFile(target);
  if(job.id==='sdoor_open'){
   const alpha=(x,y)=>n[(y*32+x)*4+3],spans=[];let last;
   for(let y=4;y<32;y++){if(alpha(16,y)){if(last)throw Error('Frame contains leaf/threshold');continue;}let left=15,right=16;while(left>=0&&!alpha(left,y))left--;while(right<32&&!alpha(right,y))right++;if(left>=0&&right<32&&right-left>6)last=[left+1,y,right-left-1,1];else if(last)last=[last[0],y,last[2],1];else continue;if(spans.length&&spans.at(-1)[0]===last[0]&&spans.at(-1)[2]===last[2])spans.at(-1)[3]++;else spans.push([...last]);}
   if(spans.reduce((sum,r)=>sum+r[3],0)<16)throw Error('No open aperture');aperture=spans;
  }
  const a=spec.assets.find(a=>a.id===job.id&&a.group==='props');if(!a)throw Error('Unregistered '+job.id);a.canvas=[32,32];a.generationManifest='assets/source/doors-batch-06/manifest.json';assets.push({id:job.id,source:'sources/'+job.id+'.png',target:'assets/props/'+job.id+'.png',canvas:[32,32],visibleBounds:[6,4,19,26],previous:'previous/'+job.id+'.png'});
 }
 fs.writeFileSync(specFile,JSON.stringify(spec,null,2)+'\n');const visualFile=path.join(root,'js/door-visual.js'),visual=require(visualFile);visual.openings.sdoor_open=aperture;let code=fs.readFileSync(visualFile,'utf8');code=code.replace(/\/\/ BEGIN PREPARED DOOR OPENINGS[\s\S]*?\/\/ END PREPARED DOOR OPENINGS/,'// BEGIN PREPARED DOOR OPENINGS\n    openings:'+JSON.stringify(visual.openings)+',\n    // END PREPARED DOOR OPENINGS');fs.writeFileSync(visualFile,code);
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({generator:'built-in image_gen',assets,aperture},null,2)+'\n');const layers=[];for(let i=0;i<assets.length;i++)layers.push({input:await sharp(path.join(root,assets[i].target)).resize(160,160,{kernel:'nearest'}).png().toBuffer(),left:8+i*176,top:8});await sharp({create:{width:528,height:176,channels:4,background:'#1f2d29'}}).composite(layers).png().toFile(path.join(folder,'preview.png'));console.log('Prepared three blue-steel sprites',JSON.stringify(aperture));
})().catch(e=>{console.error(e);process.exitCode=1;});
