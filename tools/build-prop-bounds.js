const fs=require('fs'),path=require('path'),{read}=require('./lib/png-read');
function build(){
 const root=path.resolve(__dirname,'..'),m=require('../assets/scene-furniture-directions/manifest.json'),large=require('../assets/scene-furniture-large/manifest.json'),ids=[...m.bases.map(b=>b.id),...m.assets.map(a=>a.id),...large.assets.map(a=>a.id),...require('../assets/tree-canopy/manifest.json').assets.map(a=>a.id)],bounds={};
 for(const id of ids){const file=path.join(root,'assets/props',id+'.png'),bytes=fs.readFileSync(file);if(bytes[24]!==8)throw Error('家具PNG需为8位: '+id);const a=read(file);let l=a.w,t=a.h,r=-1,b=-1;for(let y=0;y<a.h;y++)for(let x=0;x<a.w;x++)if(a.px[y][x][3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<l)throw Error('空家具图: '+id);bounds[id]=[l,t,r-l+1,b-t+1];}
 const file=path.join(root,'js/data.js');let s=fs.readFileSync(file,'utf8');s=s.replace(/\n\/\* BEGIN PROP BOUNDS \*\/[\s\S]*?\/\* END PROP BOUNDS \*\//,'');s+='\n/* BEGIN PROP BOUNDS */\nconst PROP_SPRITE_BOUNDS = '+JSON.stringify(bounds)+';\n/* END PROP BOUNDS */\n';fs.writeFileSync(file,s);
}
module.exports={build};if(require.main===module)build();
