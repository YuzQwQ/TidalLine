#!/usr/bin/env node
/* 围栏区地形原型：64×44；仅建筑、道路、场地、水域与出入口。
 * node tools/build-fenced-layout.js
 * 容器、散落物、敌人与家具留空，后续由编辑器另行布置。 */
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),W=64,H=44;
const g=Array.from({length:H},()=>Array(W).fill('q'));
const set=(x,y,c)=>{if(x>=0&&y>=0&&x<W&&y<H)g[y][x]=c;};
const fill=(x1,y1,x2,y2,c)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)set(x,y,c);};
const inside=(x,y,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
/* 水沿东南围栏形成不规则岸线，泵站在岸线前突出；不是方形水池。 */
const water=[[40,34],[45,34],[45,36],[50,36],[50,38],[54,38],[54,35],[58,35],[58,31],[63,31],[63,43],[31,43],[31,40],[33,40],[33,38],[35,38],[35,36],[38,36],[38,34]];
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(inside(x+.5,y+.5,water))set(x,y,'~');
/* 主路 4 格，次路 2–3 格；连贯折线路网而非三横三纵棋盘。 */
const clearances=[];
const road=(id,name,rect,width=3)=>{fill(...rect,'r');clearances.push({id,name,rect,width,kind:'outdoor'});};
road('north-gate','北门主通道',[30,1,33,9],4);
road('north-cross','北侧横向主路',[26,7,57,9],3);
road('central-causeway','中央主堤',[30,9,33,33],4);
road('registry-front','登记所前路',[6,15,24,17],3);
road('registry-link','登记所东侧连接道',[24,13,26,16],3);
road('registry-north-link','北段弯道',[25,9,27,13],3);
road('west-bend','西北转角',[4,17,7,19],3);
road('west-causeway','营地西侧环路',[4,19,6,34],3);
road('west-gate','西门撤离支路',[1,24,8,26],3);
road('camp-south','营地南侧环路',[6,35,25,37],3);
road('south-bend','南段回转道',[25,33,28,36],3);
road('south-link','主路南侧弯道',[28,31,31,34],3);
road('entrance-road','主入口道路',[13,36,16,42],4);
road('yard-west-link','堆场西侧支路',[33,17,36,18],2);
road('yard-east-north','堆场东北转角',[57,9,59,12],3);
road('yard-east','堆场东侧环路',[58,12,60,25],3);
road('yard-east-south','堆场东南转角',[56,25,59,28],3);
road('yard-south','堆场南侧道路',[36,27,56,29],3);
road('yard-south-link','堆场西南转角',[33,29,37,31],3);
road('yard-north-link','堆场北侧支路',[49,10,50,12],2);
road('pump-approach','泵站北侧支路',[45,29,47,31],3);
road('se-causeway','东南撤离堤道',[60,26,61,40],2);
road('se-bottom','东南沿岸堤道',[53,40,61,42],3);
/* 场地内的地坪与预留设施基座均为地形，不生成实体。 */
fill(8,19,26,32,'c');fill(36,12,54,25,'v');
const campPads=[[10,21,13,23],[20,20,23,22],[9,27,12,29],[15,29,18,30],[21,28,24,30]];
const yardPads=[[39,14,42,16],[49,13,52,14],[38,21,41,23],[49,21,52,23]];
for(const r of campPads)fill(...r,'i');for(const r of yardPads)fill(...r,'c');
const makeBuilding=(id,name,spans,shape)=>{
const footprint=spans.flatMap(([y,l,r])=>Array.from({length:r-l+1},(_,i)=>[l+i,y]));
const keys=new Set(footprint.map(p=>p.join(',')));
for(const [x,y]of footprint)set(x,y,[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!keys.has([x+dx,y+dy].join(',')))?'#':'i');
const xs=footprint.map(p=>p[0]),ys=footprint.map(p=>p[1]),rect=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
return {id,name,rect,shape,loot:'normal',label:[rect[0]+2,rect[1]+2],notches:[],footprint};
};
const registrySpans=Array.from({length:12},(_,i)=>{const y=i+3;return [y,...(y<=4?[12,14]:y===5?[7,17]:y===6?[5,18]:y<=12?[5,19]:y===13?[7,17]:[10,15])];});
const pumpSpans=Array.from({length:11},(_,i)=>{const y=i+29;return [y,...(y===29?[49,51]:y===30?[41,52]:y<=35?[39,52]:y<=37?[39,55]:y===38?[47,52]:[47,49])];});
const A=makeBuilding('a-registry','登记所',registrySpans,'北侧凸出、南侧凹口的不规则登记主楼');
const D=makeBuilding('d-pump','泵站',pumpSpans,'沿岸突出、东侧检修凸台的阶梯机房');
const zone=(id,name,rect,shape)=>({id,name,rect,shape,loot:'normal',label:[rect[0]+2,rect[1]+2],notches:[],footprint:Array.from({length:(rect[2]-rect[0]+1)*(rect[3]-rect[1]+1)},(_,i)=>[rect[0]+i%(rect[2]-rect[0]+1),rect[1]+Math.floor(i/(rect[2]-rect[0]+1))])});
const buildings=[A,zone('b-camp','安置营地',[8,19,26,32],'开放营区，五处帐篷地坪预留'),zone('c-yard','物资堆场',[36,12,54,25],'开放碎石堆场，四处作业基座'),D];
/* 墙体分区；只设普通门洞，不依赖尚未布置的钥匙或物资。 */
fill(12,6,12,12,'#');fill(6,9,11,9,'#');
fill(46,31,46,37,'#');fill(40,34,45,34,'#');
const portals=[];
const portal=(id,building,name,x,y,connects)=>{set(x,y,'+');portals.push({id,building,name,cells:[[x,y]],connects,kind:'door',width:1,doorType:'normal'});};
portal('a.entry',A.id,'登记所南门',9,13,['a.duty','outside']);
portal('a.east-entry',A.id,'登记所东门',19,10,['a.archive','outside']);
portal('a.hall-duty',A.id,'大厅通值班室',9,9,['a.hall','a.duty']);
portal('a.hall-archive',A.id,'大厅通档案室',12,8,['a.hall','a.archive']);
portal('a.duty-archive',A.id,'值班室通档案室',12,11,['a.duty','a.archive']);
portal('d.entry',D.id,'泵站北门',44,30,['d.pump','outside']);
portal('d.east-entry',D.id,'泵站检修门',52,33,['d.valve','outside']);
portal('d.pump-power',D.id,'泵房通配电室',43,34,['d.pump','d.power']);
portal('d.pump-valve',D.id,'泵房通阀组',46,32,['d.pump','d.valve']);
portal('d.power-valve',D.id,'配电通阀组',46,36,['d.power','d.valve']);
const room=(id,building,name,rect,anchor,type='room')=>({id,building,name,rect,anchor,type,role:name});
const rooms=[
room('a.hall',A.id,'登记大厅',[6,6,11,8],[9,7]),
room('a.duty',A.id,'值班室',[6,10,11,12],[9,11]),
room('a.archive',A.id,'档案室',[13,6,18,12],[15,10]),
room('d.pump',D.id,'泵机房',[40,31,45,33],[43,32]),
room('d.power',D.id,'配电室',[40,35,45,37],[43,36]),
room('d.valve',D.id,'阀组间',[47,31,51,37],[49,34]),
...campPads.map((r,i)=>room('b.tent'+(i+1),'b-camp','帐篷基座 '+(i+1),r,[r[0]+1,r[1]+1],'bay')),
...yardPads.map((r,i)=>room('c.pad'+(i+1),'c-yard','作业基座 '+(i+1),r,[r[0]+1,r[1]+1],'bay'))
];
/* 单格围栏闭合边界，四角做阶梯削角。 */
for(let x=0;x<W;x++){set(x,0,'#');set(x,H-1,'#');}for(let y=0;y<H;y++){set(0,y,'#');set(W-1,y,'#');}
for(const [x,y]of [[1,1],[2,1],[1,2],[62,1],[61,1],[62,2],[1,42],[2,42],[1,41],[62,42],[61,42],[62,41]])set(x,y,'#');
fill(30,1,33,2,'r');fill(1,24,2,26,'r');fill(13,41,16,42,'r');fill(53,41,55,42,'r');
const spawn={id:'entrance',name:'安置区主入口',x:14,y:42};
const exits=[{id:'N',name:'北侧撤离点',x:31,y:1,risk:'低'},{id:'W',name:'西侧撤离点',x:1,y:25,risk:'低'},{id:'SE',name:'东南撤离点',x:54,y:42,risk:'中'}];
set(spawn.x,spawn.y,'P');for(const e of exits)set(e.x,e.y,'E');
const legend={
'#':{name:'围栏 / 建筑墙体',art:'wall',walkable:false,opaque:true,color:'#777d78'},
q:{name:'场内压实土空地',art:'ground_soil_compact_01',walkable:true,opaque:false,color:'#303b33'},
r:{name:'道路 / 高架堤道',art:'street_stone',walkable:true,opaque:false,color:'#85867e'},
i:{name:'室内地板 / 帐篷基座',art:'floor',walkable:true,opaque:false,color:'#696b65'},
c:{name:'营地压实地坪',art:'ground_soil_compact_02',walkable:true,opaque:false,color:'#68604b'},
v:{name:'堆场作业地坪',art:'ground_concrete_plain_02',walkable:true,opaque:false,color:'#575c54'},
'+':{name:'普通门洞',art:'floor',walkable:true,opaque:false,color:'#c1a878'},
'~':{name:'河水 · 不可通行',art:'canal_water',walkable:false,opaque:false,color:'#438697'},
P:{name:'固定主入口',art:'street_stone',walkable:true,opaque:false,color:'#da7564'},
E:{name:'撤离点',art:'street_stone',walkable:true,opaque:false,color:'#71ba7d'}
};
const layout={schemaVersion:2,id:'fenced-zone',title:'围栏区 · 临时安置点',status:'地形原型；不布置容器、敌人、散落物或家具',width:W,height:H,tileSize:32,coordinateConvention:'左上角(0,0)，rect包含端点。',reference:'reference-concept.png',
legend,rows:g.map(r=>r.join('')),buildings,rooms,roomFlows:Object.fromEntries(buildings.map(b=>[b.id,rooms.filter(r=>r.building===b.id).map(r=>r.id)])),portals,windows:[],clearances,props:[],containers:[],containerTypes:{},lootSpawns:[],enemies:[],spawn,exits,bridges:[],bridgeHeadReserve:null,
plazas:[{id:'camp-center',name:'营地中央空地',rect:[14,24,20,27]},{id:'yard-center',name:'堆场集散空地',rect:[43,17,48,20]}],
tide:{implemented:true,permanentWater:true,note:'保留原有潮汐系统；东南为永久水域，主路及撤离堤道抬高。此轮不新增开泵玩法。',zones:[{id:'se-water',rect:[31,34,62,42],level:3}]},
quotas:{containers:0,enemies:0,regions:Object.fromEntries([...buildings.map(b=>b.id),'outdoors'].map(id=>[id,[0,0]]))},
routeSpecs:[{id:'west-loop',name:'主入口—营地—登记所—西门',color:'#c2ab70',waypoints:[[14,42],[14,36],[5,25],[6,16],[9,13],[1,25]]},{id:'central-road',name:'主入口—中央主堤—北门',color:'#72a899',waypoints:[[14,42],[25,36],[31,31],[31,18],[31,1]]},{id:'east-loop',name:'中央主堤—堆场—泵站—东南门',color:'#83b6ce',waypoints:[[31,18],[36,18],[47,28],[44,30],[52,33],[60,38],[54,42]]}],fixedEntrance:true};
fs.writeFileSync(path.join(ROOT,'design/maps/fenced-zone/layout.json'),JSON.stringify(layout,null,2)+'\n');
console.log('围栏区：64×44 / 4功能区 / 15房间及预留基座 / 10普通门 / 0容器 / 0散落物 / 0敌人');
module.exports={layout};
