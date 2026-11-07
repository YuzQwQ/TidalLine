const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/item-art/keys-v1'),assets=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8')).assets;
async function main(){
 const b=await chromium.launch({channel:'msedge',headless:true}),results=[];
 try{for(const file of ['index.html','潮汐线.html']){
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(path.join(root,file)).href+'#base');
  await p.waitForFunction(ids=>typeof Icons!=='undefined'&&ids.every(id=>Icons.get(id)?.complete),assets.map(a=>a.id));
  const result=await p.evaluate(ids=>{
   const check=(c,m)=>{if(!c)throw Error(m);};
   for(const id of ids){const it=ITEM_BY_ID[id],im=Icons.get(id);check(im.naturalWidth===48&&im.naturalHeight===48,'icon dimensions');check(Icons.bagTag(it,'').includes(im.src),'inventory still using generic icon');check(Icons.detailSource(it)?.includes('/keys-v1/sources/'+id+'.png'),'missing original detail source');}
   Game.state='base';Base.open();Save.stash=ids.map(id=>({id,n:1,cap:ITEM_BY_ID[id].maxDur}));Save.bag=[];Save.safe=[];Safehouse.route('stash');Base.renderStash();
   return{loaded:ids.length,inventoryBindings:true,originalDetails:true};
  },assets.map(a=>a.id));
  assert(await p.locator('#stashGrid img').count()>=5);assert.deepEqual(errors,[]);
  await p.screenshot({path:path.join(folder,file==='index.html'?'runtime.png':'offline-runtime.png')});results.push({file,...result,errors});await p.close();
 }}finally{await b.close();}
 fs.writeFileSync(path.join(folder,'browser-verification.json'),JSON.stringify({passed:true,results},null,2)+'\n');
 console.log('PASS: five key images loaded in warehouse and detail views, development + offline, no page errors');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
