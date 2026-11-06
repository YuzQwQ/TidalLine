/* Normalize the built-in imagegen source into the game's native scene sprite. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/source/loot-batch-01');
(async()=>{
 const input=process.argv[2];if(!input)throw Error('Provide the generated PNG path');
 fs.mkdirSync(path.join(folder,'sources'),{recursive:true});const source=path.join(folder,'sources/loot_pile.png');fs.copyFileSync(input,source);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 if(r<l)throw Error('Empty generated sprite');
 const {data:p,info:s}=await sharp(data,{raw:info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(26,24,{fit:'inside',kernel:'nearest'}).raw().toBuffer({resolveWithObject:true});for(let i=3;i<p.length;i+=4)p[i]=p[i]>=160?255:0;
 const buffer=await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite([{input:p,raw:s,left:Math.floor((32-s.width)/2),top:Math.floor((32-s.height)/2)}]).png({palette:true,colours:16,dither:0}).toBuffer();
 await sharp(buffer).ensureAlpha().png().toFile(path.join(root,'assets/props/loot_pile.png'));
 await sharp(buffer).resize(256,256,{kernel:'nearest'}).png().toFile(path.join(folder,'preview.png'));
 const file=path.join(root,'design/maps/shared/scene-assets.json'),spec=JSON.parse(fs.readFileSync(file));
 if(!spec.assets.some(a=>a.group==='props'&&a.id==='loot_pile'))spec.assets.push({group:'props',id:'loot_pile',name:'散落物品堆',role:'scene-component',footprint:[1,1],usage:'运行时动态生成的遗落物品堆，占1格；不作为静态家具放置。'});
 fs.writeFileSync(file,JSON.stringify(spec,null,2)+'\n');
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({id:'loot-batch-01',generator:'built-in image_gen',assets:[{id:'loot_pile',name:'散落物品堆',source:'sources/loot_pile.png',target:'assets/props/loot_pile.png',canvas:[32,32],visibleFit:[s.width,s.height],footprint:[1,1],processing:'alpha>=160 crop; nearest contain26x24; 16 colors; binary alpha; native32 transparent centered'}]},null,2)+'\n');
 console.log('Prepared loot_pile: native32, subject '+s.width+'x'+s.height+', scene registry updated');
})().catch(e=>{console.error(e);process.exitCode=1;});
