/* Isolated manual arenas; never registered in the production map catalog. */
(function(root){
  const names={field:'开阔地',hall:'门厅',loop:'双出口房间',pair:'双人交叉射界'};
  function make(kind='field'){
    const width=50,height=36,g=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
    let spawn={x:10,y:18},enemies=[];
    const line=(x1,y1,x2,y2)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)g[y][x]='#';};
    if(kind==='field')enemies=[{id:'watch-1',type:'holdout',x:20,y:18,facing:'w',patrolRadius:2,guardAnchor:[20,18]}];
    if(kind==='hall'){
      line(20,10,34,10);line(20,26,34,26);line(20,10,20,26);line(34,10,34,26);g[18][20]='+';
      spawn={x:15,y:18};enemies=[{id:'watch-1',type:'holdout',x:25,y:18,facing:'w',patrolRadius:1,guardAnchor:[23,18]}];
    }
    if(kind==='loop'){
      line(20,10,34,10);line(20,26,34,26);line(20,10,20,26);line(34,10,34,26);g[14][20]='.';g[23][20]='.';line(27,15,27,22);
      enemies=[{id:'recover-1',type:'retriever',x:29,y:18,facing:'w',patrolRadius:2}];
    }
    if(kind==='pair'){
      line(18,14,20,14);line(22,22,24,22);line(27,15,27,20);
      enemies=[{id:'recover-a',type:'retriever',x:24,y:16,facing:'w',squadId:'team-1',patrolRadius:1},{id:'recover-b',type:'retriever',x:25,y:23,facing:'w',squadId:'team-1',patrolRadius:1}];
    }
    const terrainRows=g.map(r=>r.join('')),terrain={'.':{art:'low',solid:false,blocked:false,opaque:false},'#':{art:'wall',solid:true,blocked:true,opaque:true},'+':{art:'floor',solid:false,blocked:false,opaque:false}};
    g[spawn.y][spawn.x]='P';g[32][4]='E';return{id:'human-test-'+kind,title:'人类敌人测试 · '+names[kind],width,height,terrainRows,terrain,rows:g.map(r=>r.join('')),spawn,enemies,props:[],overlays:[],containers:[],doors:[],doorAxes:{},rooms:[],bridges:[],exits:[{id:'test-exit',name:'测试出口',x:4,y:32}],districts:[],tideEnabled:false};
  }
  function start(kind){
    if(Save.key!=='tideline_human_units_test_v1'){Save.flush();Save.key='tideline_human_units_test_v1';}
    Save.hp=100;Save.stash=[];Save.meleeGiftClaimed=true;
    Save.gear={weapons:[EQUIP.gun('rifle',30,'ammo_556_2'),EQUIP.gun('shotgun',6,'ammo_12g_2'),EQUIP.gun('pistol',12,'ammo_9mm_2')],helmet:GEAR.make('helmet',2),body:GEAR.make('body',2),back:BACKPACK.make('bag03'),melee:EQUIP.melee('melee02')};
    Save.bag=[{id:'ammo_556_2',n:60},{id:'ammo_9mm_2',n:90},{id:'ammo_12g_2',n:20},...Array.from({length:3},()=>({id:'heal01',n:1,cap:ITEM_BY_ID.heal01.healCap}))];Save.save();Save.flush();
    const map=make(kind);MAP_CATALOG.push(map);
    try{Game.startRun(null,map.id);}finally{MAP_CATALOG.pop();}
    document.getElementById('startVeil')?.classList.add('hidden');
    Game.toast('测试存档独立 · F1查看状态与最后目击点');
  }
  root.HumanFixtures={make,start,names};
  if(typeof Save!=='undefined'&&document.documentElement.dataset.humanTest==='true')Save.key='tideline_human_units_test_v1';
})(globalThis);
