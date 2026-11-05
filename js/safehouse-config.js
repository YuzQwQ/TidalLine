/* Presentation configuration only. Planned facilities never write gameplay progress. */
const SAFEHOUSE_CONFIG = {
  nav: [
    {id:'home',label:'藏身处',icon:'home',state:'live'},
    {id:'traders',label:'商人',icon:'cart',state:'live'},
    {id:'stash',label:'仓库',icon:'box',state:'live'},
    {id:'tasks',label:'任务',icon:'task',state:'planned',message:'委托、任务追踪和奖励交付尚未开放。这里将汇总各位商人的独立委托。'},
    {id:'maps',label:'地图',icon:'pin',state:'live'},
    {id:'archive',label:'档案',icon:'archive',state:'live'}
  ],
  facilities: [
    {id:'comms',name:'通讯桌',subtitle:'商人联络',icon:'radio',x:20,y:52,action:'traders',state:'live'},
    {id:'bench',name:'装备台',subtitle:'改装枪械',icon:'tool',x:42,y:38,action:'gunsmith',state:'live'},
    {id:'medical',name:'医疗角',subtitle:'医疗用品与治疗',icon:'cross',x:70,y:44,action:'doctor',state:'live'},
    {id:'storage',name:'储物区',subtitle:'入库与回收',icon:'box',x:18,y:73,action:'stash',state:'live'},
    {id:'workshop',name:'制作工位',subtitle:'设施规划',icon:'gear',x:43,y:64,action:'workshop',state:'planned',message:'制作工位已预留。配方、材料消耗、制造队列及设施升级尚未开放。'},
    {id:'living',name:'生活区',subtitle:'设施规划',icon:'bed',x:58,y:51,action:'living',state:'planned',message:'生活区已预留。伤势恢复与设施升级尚未开放，不会自动恢复生命值。'}
  ],
  broadcasts: [
    {channel:'FM 87.6',title:'环礁湾公共频道',text:'进入旧街区前，请检查随身药品与弹药。撤离路线应在行动开始前确认。'},
    {channel:'FM 87.6',title:'港区通行提示',text:'封锁区内的旧标牌不代表当前通行许可。遇到积水路段，请先确认另一条退路。'},
    {channel:'FM 87.6',title:'无线电联络提示',text:'通讯不清时请重复呼号。不要仅凭陌生频段中的指引改变预定撤离路线。'}
  ],
  rotateMs:10000,
  assets:{viktor:'assets/ui/safehouse/merchant_viktor.webp',room:'assets/ui/safehouse/room.webp',armor:'assets/ui/safehouse/merchant_armor.webp',guns:'assets/ui/safehouse/merchant_guns.webp',doctor:'assets/ui/safehouse/merchant_doctor.webp'},
  merchants:{shop:{name:'玛拉·维恩',role:'防护装备与物资供应',asset:'armor',quote:'规矩说清楚，货物交明白。'},gun:{name:'埃德加·洛克',role:'军械供应与技术维护',asset:'guns',quote:'枪不会背叛你。至于卖枪的人……那得看你出多少钱。'},doctor:{name:'林岑',role:'医疗用品与收费治疗',asset:'doctor',quote:'我见过太多人死于本可以治好的伤。至于那些治不好的……我还在想办法。'}}
};

SAFEHOUSE_CONFIG.merchants.viktor={name:'维克托·萨伦',role:'贸易商 · 零售、仓储与物资流通',asset:'viktor',quote:'哈哈！没有卖不出去的东西，只有没找对的买家！来来来，看看今天有什么好货！'};

SAFEHOUSE_CONFIG.assets.elena='assets/ui/safehouse/merchant_elena.webp';
SAFEHOUSE_CONFIG.merchants.elena={name:'伊莲娜·莫罗',role:'私人收藏家 · 地下私人事务所经营者',asset:'elena',quote:'每个人都有想找回的东西。若您愿意相信我，我们或许可以帮上一点忙。'};
