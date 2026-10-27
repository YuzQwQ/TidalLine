/* 临海路设计稿的唯一手工源。所有输出独立于游戏运行数据。 */
const WIDTH = 72, HEIGHT = 56;
const legend = {
  '#': { name: '墙体 / 边界', walkable: false, opaque: true, color: '#354550' },
  X: { name: '不可进入的背景街坊', walkable: false, opaque: true, color: '#53616b' },
  '.': { name: '街坊空地', walkable: true, opaque: false, color: '#e9e6d9' },
  r: { name: '街道 / 巷道', walkable: true, opaque: false, color: '#c4ccd0' },
  q: { name: '庭院 / 前场', walkable: true, opaque: false, color: '#d8e1ce' },
  i: { name: '室内地板', walkable: true, opaque: false, color: '#f4ecd9' },
  '~': { name: '常态不可涉水的运河', walkable: false, opaque: false, color: '#438697' },
  k: { name: '石质驳岸 / 封闭临河背面', walkable: false, opaque: false, color: '#82979a' },
  '=': { name: '北石桥', walkable: true, opaque: false, color: '#c9b58e' },
  '-': { name: '南栈桥', walkable: true, opaque: false, color: '#b5895d' },
  '+': { name: '门洞（评审按打开状态）', walkable: true, opaque: false, color: '#d5a956' },
  '/': { name: '现有破口', walkable: true, opaque: false, color: '#db9472' },
  w: { name: '橱窗：不可通行、可透视', walkable: false, opaque: false, color: '#88c6d0' },
  s: { name: '河岸阶梯预留', walkable: true, opaque: false, color: '#a9b4a2' }
};
const grid = Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => x === 0 || y === 0 || x === WIDTH-1 || y === HEIGHT-1 ? '#' : '.'));
const buildings = [], rooms = [], portals = [], windows = [], clearances = [], props = [], containers = [], enemies = [];
function cells(rect) { const out=[]; for(let y=rect[1];y<=rect[3];y++) for(let x=rect[0];x<=rect[2];x++) out.push([x,y]); return out; }
function paint(rect, ch) { for(const [x,y] of cells(rect)) grid[y][x]=ch; }
function line(rect) { paint(rect, '#'); }
function clearance(id, name, rect, width, kind='outdoor') { clearances.push({ id,name,rect,width,kind }); }
// 铺装先于建筑：建筑会覆盖其占地范围内的道路，最终净宽由独立断言验证。
for(const rect of [[23,3,28,52],[37,4,42,43],[3,12,68,15],[37,11,68,16],[19,7,22,24],[15,33,18,46],[3,23,28,26],[3,29,28,32],[3,47,28,52],[55,17,58,27],[43,27,67,30],[49,43,51,53],[68,27,70,53],[49,47,70,53]]) paint(rect,'r');
paint([15,25,22,32],'q'); paint([43,31,50,38],'q'); paint([5,25,13,31],'q'); paint([58,5,67,10],'q');
paint([30,0,35,55],'~'); paint([29,0,29,55],'k'); paint([36,0,36,55],'k');
paint([29,12,36,15],'='); paint([29,40,36,42],'-');
paint([29,27,29,29],'s'); paint([36,23,36,25],'s');
paint([37,44,38,53],'k');
// 北街背景街坊仅用于收束街道空间，没有室内和搜刮入口。
paint([44,4,54,7],'X'); paint([44,8,51,10],'X');

function building(id,name,rect,notches,shape) {
  const cut = new Set(notches.flatMap(cells).map(p=>p.join(',')));
  const footprint=cells(rect).filter(p=>!cut.has(p.join(',')));
  const set=new Set(footprint.map(p=>p.join(',')));
  for(const [x,y] of footprint) grid[y][x]=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>!set.has([x+a,y+b].join(',')))?'#':'i';
  const result={id,name,rect,notches,shape,footprint}; buildings.push(result); return result;
}
function room(building,id,name,rect,anchor,role) { rooms.push({id:building+'.'+id,building,name,rect,anchor,role:role||name}); }
function portal(building,id,name,rect,connects,kind='door') {
  const ps=cells(rect); for(const [x,y] of ps) {if(grid[y][x]!=='#') throw Error('门洞没有落在墙上 '+id+' @ '+x+','+y);grid[y][x]=kind==='breach'?'/':'+';}
  portals.push({id:building+'.'+id,building,name,cells:ps,connects:connects.map(s=>s==='outside'?s:building+'.'+s),kind,width:ps.length});
}
function windowOf(building,id,rect) {const ps=cells(rect); for(const [x,y] of ps){if(grid[y][x]!=='#')throw Error('橱窗不在墙上');grid[y][x]='w';} windows.push({id,building,cells:ps,walkable:false,opaque:false});}

building('apartment','老公寓',[5,7,18,22],[[16,7,18,10]],'东北凹入后院、南侧门廊、储藏附属间');
for(const rect of [[10,8,10,11],[15,11,15,11],[6,12,17,12],[9,15,9,21],[12,15,12,19],[6,15,8,15],[13,15,17,15],[6,19,8,19],[13,19,17,19]]) line(rect);
room('apartment','bed1','卧室 1',[6,8,9,11],[8,10]);
room('apartment','bed2','卧室 2',[11,8,14,11],[13,10]);
room('apartment','hall','侧廊 · 北段',[6,13,17,14],[11,13]);
room('apartment','spine','侧廊 · 两格走廊',[10,15,11,21],[10,18]);
room('apartment','kitchen','厨房',[6,16,8,18],[7,18]);
room('apartment','store','小储藏间',[6,20,8,21],[8,20]);
room('apartment','living','客厅',[13,16,17,18],[14,17]);
room('apartment','entry','门厅',[12,20,17,21],[15,20]);
portal('apartment','bed1','卧室门',[8,12,8,12],['bed1','hall']);
portal('apartment','bed2','卧室门',[13,12,13,12],['bed2','hall']);
portal('apartment','kitchen-n','厨房北门',[8,15,8,15],['kitchen','hall']);
portal('apartment','kitchen-e','厨房侧门',[9,17,9,17],['kitchen','spine']);
portal('apartment','store','储藏间门',[9,21,9,21],['store','spine']);
portal('apartment','living-w','客厅侧门',[12,17,12,18],['living','spine']);
portal('apartment','living-n','客厅北门',[16,15,17,15],['living','hall']);
portal('apartment','living-s','客厅通门厅',[15,19,16,19],['living','entry']);
portal('apartment','front','南侧正门',[14,22,15,22],['entry','outside']);
portal('apartment','side','东侧后巷门',[18,13,18,14],['hall','outside']);

building('clinic','小诊所',[5,33,14,44],[[5,43,6,44]],'西南退角、独立后勤侧廊与东侧破口');
for(const rect of [[11,34,11,43],[6,37,10,37],[6,41,10,41]]) line(rect);
room('clinic','waiting','候诊区',[6,34,10,36],[9,35]);
room('clinic','treatment','诊疗室',[6,38,10,40],[7,38]);
room('clinic','pharmacy','药品储藏间',[6,42,10,43],[8,42]);
room('clinic','service','后勤侧廊',[12,34,13,43],[12,37]);
portal('clinic','front','北侧正门',[8,33,9,33],['waiting','outside']);
portal('clinic','treatment','候诊通诊疗',[8,37,9,37],['waiting','treatment']);
portal('clinic','waiting-side','候诊侧门',[11,35,11,36],['waiting','service']);
portal('clinic','treatment-side','诊疗后勤门',[11,39,11,40],['treatment','service']);
portal('clinic','pharmacy','药储后勤门',[11,42,11,42],['pharmacy','service']);
portal('clinic','breach','破损侧入口',[14,39,14,40],['service','outside'],'breach');

building('clockshop','钟表店',[44,17,54,26],[],'临街橱窗展示面、前店后仓与侧向连门');
line([49,18,49,25]); line([50,22,53,22]);
room('clockshop','showroom','营业展示厅',[45,18,48,22],[47,18]);
room('clockshop','counter','柜台区',[45,23,48,25],[48,24]);
room('clockshop','repair','小维修间',[50,18,53,21],[51,19]);
room('clockshop','store','后仓',[50,23,53,25],[52,23]);
portal('clockshop','front','临街正门',[44,21,44,21],['showroom','outside']);
portal('clockshop','repair','营业厅侧向连门',[49,20,49,21],['showroom','repair']);
portal('clockshop','store','维修通后仓',[51,22,52,22],['repair','store']);
portal('clockshop','counter','柜台通后仓',[49,24,49,25],['counter','store']);
portal('clockshop','rear','后仓侧巷出口',[54,24,54,24],['store','outside']);
windowOf('clockshop','clockshop.display-window',[44,18,44,19]);
windowOf('clockshop','clockshop.counter-window',[44,23,44,24]);

building('bank','银行旧址',[52,31,67,46],[[66,31,67,32],[52,45,53,46]],'东北切角、前厅门廊与南侧后勤入口');
for(const rect of [[58,32,58,36],[53,37,66,37],[57,38,57,40],[60,38,60,45],[53,41,66,41]]) line(rect);
room('bank','lobby','前厅',[53,32,57,36],[55,34]);
room('bank','counter','柜台营业区',[59,32,66,36],[62,33]);
room('bank','office','办公室',[53,38,56,40],[54,40]);
room('bank','passage','柜台后通道',[58,38,59,40],[58,38]);
room('bank','security','安保室',[61,38,66,40],[62,38]);
room('bank','service','后勤环廊',[54,42,59,45],[57,44]);
room('bank','vault','金库 / 保险区',[61,42,66,45],[64,43]);
portal('bank','front','西侧正门',[52,34,52,35],['lobby','outside']);
portal('bank','counter','前厅通柜台',[58,34,58,35],['lobby','counter']);
portal('bank','office-front','前厅通办公室',[55,37,55,37],['lobby','office']);
portal('bank','passage','柜台后通道口',[58,37,59,37],['counter','passage']);
portal('bank','office','办公室侧门',[57,39,57,40],['office','passage']);
portal('bank','security','安保过渡门',[60,39,60,40],['passage','security']);
portal('bank','vault','安保通金库',[63,41,64,41],['security','vault']);
portal('bank','office-service','办公室通后勤',[55,41,55,41],['office','service']);
portal('bank','passage-service','通道连接后勤',[58,41,59,41],['passage','service']);
portal('bank','rear','南侧后勤门',[58,46,59,46],['service','outside']);

building('warehouse','仓库兼工具铺',[39,44,48,53],[],'临河背面封闭，北侧装卸口与东侧门绕行');
room('warehouse','stock','货架与工具区',[40,45,47,52],[44,48]);
portal('warehouse','front','北侧装卸入口',[43,44,44,44],['stock','outside']);
portal('warehouse','side','东侧侧门',[48,49,48,50],['stock','outside']);

/* 容器类型 = 固定品质 + 类别奖池。品质不做二次随机：垃圾桶永远是废弃，大型保险箱永远是秘藏。 */
const containerTypes={
 Z:{name:'垃圾桶',q:'junk'},
 W:{name:'废纸篓',q:'junk'},
 b:{name:'遗弃纸箱',q:'junk'},
 U:{name:'遗落的工作服',q:'junk'},
 C:{name:'抽屉',q:'plain'},
 T:{name:'工具箱',q:'plain'},
 N:{name:'床头柜',q:'plain'},
 e:{name:'员工储物盒',q:'plain'},
 m:{name:'帆布挎包',q:'plain'},
 L:{name:'储物柜',q:'ample'},
 J:{name:'旅行箱',q:'ample'},
 F:{name:'办公文件柜',q:'ample'},
 D:{name:'运动包',q:'ample'},
 M:{name:'医疗柜',q:'fine'},
 R:{name:'电子设备柜',q:'fine'},
 H:{name:'急救器材箱',q:'fine'},
 Q:{name:'通讯设备箱',q:'fine'},
 Y:{name:'救援人员背心',q:'fine'},
 B:{name:'小型保险箱',q:'rich'},
 K:{name:'防水补给箱',q:'rich'},
 G:{name:'珠宝匣',q:'rich'},
 A:{name:'皮质旅行包',q:'rich'},
 V:{name:'大型保险箱',q:'secret'},
 I:{name:'机密封存箱',q:'secret'},
 O:{name:'密封公文包',q:'secret'}
};
/* 品质绑定在容器类型上，不做二次随机；同一品质掉率完全一致，preference 只重排类别。
   机密封存箱（I）暂不进初始地图，留给后续封锁设施。 */
function stash(region,points,preference) {for(const [type,x,y] of points) containers.push({id:'c'+String(containers.length+1).padStart(2,'0'),region,type,x,y,preference});}

/* 住宅：床头柜贴床、旅行箱与运动包是搬走前的状态、挎包挂在门厅 */
stash('apartment',[['N',6,9],['N',14,9],['C',9,10],['L',6,17],['L',6,21],['m',17,17],['J',17,18],['D',17,21]],['life']);
/* 诊所：诊疗区留医疗柜，办公角是文件柜，急救箱与救援背心来自救援队 */
stash('clinic',[['F',10,34],['C',6,35],['M',6,39],['M',7,39],['H',7,42],['Y',10,43]],['med','medical']);
stash('clockshop',[['C',45,25],['L',53,19],['R',50,18],['B',50,25],['B',53,25],['L',45,18],['G',46,21]],['collect']);
/* 银行金库：两只是大型号，一只公文包是撤离时锁进去的，保管箱业务留一只珠宝匣 */
stash('bank',[['F',53,32],['L',56,32],['F',53,38],['L',55,45],['B',61,42],['B',66,42],['V',61,44],['O',66,44],['G',61,45],['B',66,45]],['collect']);
/* 仓库：装卸口堆纸箱，员工储物盒与通讯箱在值班角 */
stash('warehouse',[['T',40,45],['T',47,45],['b',46,45],['b',41,48],['e',42,51],['Q',40,51],['A',40,52],['K',47,52]],['ind','elec']);
/* 街面：垃圾桶与废纸篓负责室外杂物，事故点留给急救箱 */
stash('outdoors',[['Z',22,19],['T',16,27],['U',64,30],['H',18,44],['W',4,47],['b',58,24],['C',67,31],['T',61,9],['K',59,50]],['life','ind']);
function host(region,type,points,patrolRadius=2) {for(const [x,y] of points) enemies.push({id:'e'+String(enemies.length+1).padStart(2,'0'),region,type,x,y,patrolRadius});}
host('apartment','scav',[[8,18],[15,17],[14,21]]);
host('clinic','scav',[[8,38],[13,42]]);
host('clockshop','scav',[[47,20],[52,20],[51,24]]);
host('bank','guard',[[55,35],[64,35],[55,40],[62,39],[65,40]]);
host('warehouse','scav',[[42,48],[46,51]]);
host('outdoors','scav',[[21,23],[62,8]],3);
host('outdoors','echo',[[18,31],[17,39],[8,27],[21,48],[58,28],[39,29],[50,40]],3);

function furniture(region,type,name,points) {for(const [x,y] of points) props.push({id:'p'+String(props.length+1).padStart(2,'0'),region,type,name,x,y,solid:true});}
furniture('apartment','bed','床',[[6,8],[11,8]]);
furniture('apartment','desk','床头柜',[[9,8],[14,11]]);
furniture('apartment','stove','灶台',[[6,16]]);
furniture('apartment','sofa','沙发',[[13,16]]);
furniture('apartment','bench','门厅长凳',[[17,20]]);
furniture('clinic','chair','候诊椅',[[7,35],[8,35]]);
furniture('clinic','bed','诊疗床',[[8,39]]);
furniture('clinic','desk','诊疗台',[[10,38]]);
furniture('clockshop','display','橱窗展柜',[[45,19],[46,19]]);
furniture('clockshop','counter','营业柜台',[[45,23],[46,23]]);
furniture('clockshop','desk','维修台',[[53,21]]);
furniture('bank','bench','前厅长凳',[[53,36]]);
furniture('bank','counter','银行柜台',[[62,34],[63,34],[64,34]]);
furniture('bank','desk','办公桌',[[56,38]]);
furniture('bank','desk','安保监控台',[[66,38]]);
furniture('bank','shelf','后勤架',[[54,43],[55,43]]);
furniture('warehouse','shelf','工具货架',[[40,47],[41,47],[46,47],[47,47]]);
furniture('outdoors','tree','院落树木',[[6,27],[10,29],[19,29],[65,7]]);
furniture('outdoors','bench','庭院长椅',[[15,29],[16,29],[45,37],[46,37]]);
furniture('outdoors','barrel','杂物桶',[[22,9],[58,18],[70,28],[67,9]]);

clearance('west-main','西岸主街',[23,5,28,50],6);
clearance('east-main','东岸商业主街',[37,6,42,42],6);
clearance('north-west','北桥西接街',[23,12,28,15],4);
clearance('north-east','北桥东接街',[37,12,42,15],4);
clearance('apartment-alley','公寓后巷净通路',[19,7,21,24],3);
clearance('courtyard-spine','小院纵向通路',[20,25,22,32],3);
clearance('courtyard-south','小院横向通路',[15,30,22,32],3);
clearance('clinic-alley','诊所后巷净通路',[15,33,17,46],3);
clearance('clock-alley','钟表店侧巷净通路',[55,17,57,27],3);
clearance('bank-north','银行北侧通路',[43,27,67,29],3);
clearance('bank-east','银行东侧通路',[68,31,70,53],3);
clearance('bank-south','东岸撤离横路',[49,51,70,53],3);
clearance('warehouse-east','仓库东侧绕行巷',[49,44,51,53],3);
clearance('warehouse-front','仓库北侧接桥通路',[39,40,51,42],3);
clearance('apartment-hall','公寓侧廊北段',[6,13,17,14],2,'indoor');
clearance('apartment-spine','公寓纵向侧廊',[10,15,11,21],2,'indoor');
clearance('apartment-entry','公寓门厅通路',[12,20,16,21],2,'indoor');
clearance('clinic-service','诊所后勤侧廊',[12,34,13,43],2,'indoor');
clearance('clock-showroom','钟表店营业厅通路',[47,18,48,25],2,'indoor');
clearance('clock-repair','钟表店维修通路',[51,18,52,21],2,'indoor');
clearance('clock-store','钟表店后仓通路',[51,23,52,25],2,'indoor');
clearance('bank-counter','银行柜台通路',[59,32,60,36],2,'indoor');
clearance('bank-passage','银行柜台后通道',[58,38,59,40],2,'indoor');
clearance('bank-office','银行办公通路',[54,39,56,40],2,'indoor');
clearance('bank-service','银行后勤通路',[58,42,59,45],2,'indoor');
clearance('bank-vault','安保 / 金库中央通路',[63,38,64,45],2,'indoor');
clearance('warehouse-spine','仓库中央通路',[43,45,44,52],2,'indoor');
clearance('warehouse-cross','仓库横向通路',[40,49,47,50],2,'indoor');

const data={
 schemaVersion:1,id:'linhai-old-quarter-draft',title:'临海路旧街区',status:'独立设计评审稿，未接入游戏',width:WIDTH,height:HEIGHT,tileSize:32,
 coordinateConvention:'左上角 (0,0)，x 向东、y 向南；所有 rect 为包含端点的 [x1,y1,x2,y2]。',
 reference:'../../../temp files/临海路旧街区·概念平面.png',legend,rows:grid.map(row=>row.join('')),
 buildings,rooms,portals,windows,clearances,props,containers,containerTypes,enemies,
 spawn:{id:'spawn',name:'西北入口',x:7,y:4},
 exits:[{id:'A',name:'西岸撤离 A',x:6,y:51,risk:'低'},{id:'B',name:'东岸撤离 B',x:67,y:51,risk:'较高，接近银行外围'}],
 bridges:[{id:'north',name:'北石桥',rect:[29,12,36,15],width:4,tile:'=',risk:'低压，无固定堵桥怪'},{id:'south',name:'南栈桥',rect:[29,40,36,42],width:3,tile:'-',risk:'暴露，邻接低地；没有固定桥头关卡'}],
 bridgeHeadReserve:{rect:[23,10,42,17],name:'北桥及桥头无固定出生点'},
 plazas:[{id:'residential-yard',name:'住宅小院',rect:[15,25,22,32]},{id:'bank-square',name:'银行前场',rect:[43,31,50,38]}],
 tide:{implemented:false,permanentWater:'~',note:'水面常态不可涉水；所有预留低地和南桥在本稿按正常可通行地形检查。',
 zones:[{id:'south-lowland',name:'南桥东端低地',rect:[37,39,48,43]},{id:'warehouse-lowland',name:'仓库东巷低地',rect:[49,43,51,49]},{id:'west-stairs',name:'西岸阶梯',rect:[29,27,29,29]},{id:'east-stairs',name:'东岸阶梯',rect:[36,23,36,25]}]},
 quotas:{containers:48,enemies:24,regions:{apartment:[8,3],clinic:[6,2],clockshop:[7,3],bank:[10,5],warehouse:[8,2],outdoors:[9,9]}},
 routeSpecs:[
 {id:'residential',name:'住宅搜刮线',color:'#21937b',waypoints:[[7,4],[19,14],[14,21],[21,26],[16,32],[9,35],[13,40],[6,51]]},
 {id:'commercial',name:'商业深入线',color:'#b47c29',waypoints:[[7,4],[19,14],[14,21],[19,14],[27,14],[38,14],[47,20],[52,24],[49,34],[55,35],[61,35],[59,39],[64,39],[64,43],[58,44],[67,51]]},
 {id:'shortcut',name:'南部捷径线',color:'#9262ab',waypoints:[[13,40],[16,41],[27,41],[38,41],[44,45],[46,51],[50,51],[58,44],[64,39],[67,51]]}
 ],
 roomFlows:{
 apartment:'南侧门厅 → 客厅 → 侧廊；厨房通过北门与侧门接入侧廊环路。侧廊通东侧后巷门；卧室与小储藏间为支路。',
 clinic:'北门 → 候诊 → 诊疗；候诊和诊疗分别连接后勤侧廊。东侧破口直入侧廊，药储入口位于破口南侧，需转向进入。',
 clockshop:'营业厅 → 维修间 → 后仓 → 柜台区 → 营业厅，形成内部环路；后仓侧门接东巷，橱窗不可通行但可透视。',
 bank:'前厅 → 柜台 / 办公室 → 柜台后通道 → 安保室 → 金库。南门接后勤环廊；办公室、后通道、后勤三者成环，金库只经安保门进入。'
 }
};
module.exports={data,cells};
