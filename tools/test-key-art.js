const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm');
const {read}=require('./lib/png-read'),root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/item-art/keys-v1');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8')),keys=JSON.parse(fs.readFileSync(path.join(root,'design/items/keys.json'),'utf8')),hashes=new Set(),results=[];
const c=vm.createContext({});for(const f of ['config','data'])vm.runInContext(fs.readFileSync(path.join(root,'js/'+f+'.js'),'utf8'),c);const items=vm.runInContext('KEY_ITEMS',c);
assert.equal(manifest.assets.length,5);assert.deepEqual(manifest.assets.map(a=>a.number),['002','005','007','006','008']);
for(const a of manifest.assets){
 const k=keys.find(k=>k.id===a.id),runtime=items.find(k=>k.id===a.id);assert(k&&runtime);assert.equal(k.iconId,a.id);assert.equal(runtime.iconId,a.id);
 const file=path.join(root,a.target),hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert(!hashes.has(hash),'duplicate icon');hashes.add(hash);
 const png=read(file),points=[],colors=new Set();assert.deepEqual([png.w,png.h],[48,48]);
 for(let y=0;y<48;y++)for(let x=0;x<48;x++){const p=png.px[y][x];assert([0,255].includes(p[3]));if(p[3]){assert(x>=4&&x<44&&y>=4&&y<44,'central40x40');points.push([x,y]);colors.add(p.join(','));}}
 assert(points.length>180&&colors.size<=256);const mx=points.reduce((s,p)=>s+p[0],0)/points.length,my=points.reduce((s,p)=>s+p[1],0)/points.length;
 const xx=points.reduce((s,p)=>s+(p[0]-mx)**2,0),yy=points.reduce((s,p)=>s+(p[1]-my)**2,0),xy=points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0);
 const angle=.5*Math.atan2(2*xy,xx-yy)*180/Math.PI;assert(angle>=30&&angle<=60,'inconsistent diagonal pose '+a.id+' '+angle);
 assert(fs.existsSync(path.join(root,a.source)));results.push({id:a.id,number:a.number,canvas:[48,48],colors:colors.size,opaquePixels:points.length,principalAngle:+angle.toFixed(2),sha256:hash});
}
fs.writeFileSync(path.join(folder,'quality.json'),JSON.stringify({passed:true,orientation:'bow upper-left, tip lower-right',results},null,2)+'\n');console.log('PASS: five distinct key icons, central40x40 in48x48, transparent margins, consistent diagonal pose, originals and runtime bindings');
