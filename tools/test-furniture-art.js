const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const sharp=require('sharp'),{chromium}=require('playwright'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),m=require('../assets/scene-furniture/manifest.json');
(async()=>{
 const c=vm.createContext({console,performance});for(const f of ['config.js','data.js','core.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),c);
 const {map,M}=vm.runInContext('({map:RAID_MAP,M})',c);M.load(map.rows,map.doorAxes,map.props,map);
 assert.equal(m.assets.length,10);assert.equal(map.props.length,40);assert.equal(map.props.filter(p=>m.assets.some(a=>a.id===p.art||a.id==='tree_courtyard'&&p.type==='tree')).length,23);
 for(const p of map.props){assert(!p.provisional);assert(M.propCollisionCells(p).every(([x,y])=>!M.walkable(x,y)));assert(!M.at(p.x,p.y).container);}
 for(const a of m.assets){assert.equal(a.status,'ready');const {data,info}=await sharp(path.join(root,a.target)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,32);assert.equal(info.height,32);let n=0;const colors=new Set();for(let y=0;y<32;y++)for(let x=0;x<32;x++){let k=(y*32+x)*4;assert([0,255].includes(data[k+3]));if(data[k+3]){assert(x>=2&&x<30&&y>=2&&y<30);n++;colors.add(data.subarray(k,k+4).toString('hex'));}}assert(n>30);assert(colors.size<=15);}
 console.log('OK: 10张32px透明图，23处替换，40处实体碰撞与不可搜索属性');
 const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const file of ['index.html','潮汐线.html']){const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.join(root,file)).href+'#base');await page.waitForFunction(ids=>typeof Game!=='undefined'&&ids.every(id=>Art.get('props',id)),m.assets.map(a=>a.id));assert(await page.evaluate(({ids,offline})=>ids.every(id=>{const i=Art.get('props',id);return i.naturalWidth===32&&(!offline||i.src.startsWith('data:'));}),{ids:m.assets.map(a=>a.id),offline:file!=='index.html'}));await page.evaluate(()=>{Base.close();Game.startRun({ammo:0,bandage:0,stone:0});Game.enemies=[];Game.state='ended';});assert.deepEqual(errors,[]);await page.close();console.log('OK: '+file+' 全部家具载入');}
 const p=await browser.newPage({viewport:{width:1280,height:1000}});await p.goto(pathToFileURL(path.join(root,'assets/scene-furniture/index.html')).href);await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:path.join(root,'assets/scene-furniture/contact-sheet.png'),fullPage:true});for(const width of [320,390]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}console.log('OK: 美术总览与窄屏布局');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
