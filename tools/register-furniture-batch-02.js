const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const m=require('../assets/source/scene-furniture-batch-02/manifest.json'),file=path.join(root,'design/maps/shared/scene-assets.json'),spec=JSON.parse(fs.readFileSync(file,'utf8'));
for(const a of m.assets){
 if(a.status!=='ready'||!fs.existsSync(path.join(root,a.target)))throw Error('素材尚未完成 '+a.id);
 const rec={group:'props',id:a.id,name:a.name+(a.facing==='front'?'':a.facing==='side'?' · 侧面':' · 背面'),role:a.facing==='front'?'prop':'scene-component',usage:'不可搜索实体家具；按footprint阻挡通行、弹道与视线。'};
 if(a.facing==='front')rec.paint={kind:'prop',type:a.id,label:a.name,name:a.name,footprint:a.size.map(n=>n/32)};
 else Object.assign(rec,{variantOf:a.base,facing:a.facing});
 const i=spec.assets.findIndex(x=>x.group==='props'&&x.id===a.id);if(i<0)spec.assets.push(rec);else spec.assets[i]=rec;
}
fs.writeFileSync(file,JSON.stringify(spec,null,2)+'\n');console.log('已登记12种家具与24张方向组件');
