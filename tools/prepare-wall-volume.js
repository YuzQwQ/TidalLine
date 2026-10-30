const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/wall-volume'),file=path.join(folder,'manifest.json');
(async()=>{const m=JSON.parse(fs.readFileSync(file,'utf8'));for(const a of m.assets){const source=path.join(folder,a.source),meta=await sharp(source).metadata(),[width,height]=a.size;let input=sharp(source);
 if(a.id==='wall_face_e'){const {data,info}=await input.ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,r=-1,t=info.height,b=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;if(Math.max(data[i],data[i+1],data[i+2])<220){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}if(r<l)throw Error('侧面原稿为空');a.sourceCrop={left:l,top:t,width:r-l+1,height:b-t+1};input=sharp(source).extract(a.sourceCrop);}
 if(a.id==='wall_face_e')input=input.modulate({brightness:.8});
 let data=await input.resize(width,height,{fit:'fill',kernel:'nearest'}).flatten({background:'#667264'}).ensureAlpha().png({palette:true,colours:16,dither:0}).toBuffer();data=await sharp(data).ensureAlpha().raw().toBuffer();
 // 配对相接边的像素，避免模型原稿的边界差异形成每格一道接缝。
 if(a.id==='wall'||a.id==='wall_face_s')for(let y=0;y<height;y++)data.copy(data,(y*width+width-1)*4,y*width*4,y*width*4+4);
 if(a.id==='wall'||a.id==='wall_face_e')data.copy(data,(height-1)*width*4,0,width*4);
 await sharp(data,{raw:{width,height,channels:4}}).png().toFile(path.join(root,a.target));a.status='ready';a.sourceSize=[meta.width,meta.height];a.processing='nearest-neighbour native-size sampling; 16-color quantization; joining-edge pixel pairing'+(a.id==='wall_face_e'?'; white canvas crop; east-face brightness 80%':'');}fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');console.log('墙顶与两种立面已整理');})().catch(e=>{console.error(e);process.exitCode=1;});
