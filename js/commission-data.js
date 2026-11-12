/* Private commissions: quality tiers are independent of item rarity. */
const COMMISSION_WEIGHTS={1:[85,15,0],2:[65,33,2],3:[40,50,10],4:[20,55,25]};
const COMMISSION_TIERS={1:'一般委托',2:'珍稀委托',3:'秘藏委托'};
const COMMISSION_DEFS=[
 {id:'elena_small_memories',title:'旧日小物',tier:1,description:'一位客户想找回家中曾经摆过的小物件。它们未必贵重，却有难以替代的意义。',objectives:[{id:'life08',n:1},{id:'life10',n:1}],rewards:{cash:12000,items:[]}},
 {id:'elena_workshop_parts',title:'工坊备件',tier:1,description:'一间小工坊需要恢复设备。请带回仍能用于检修的仪表与耗材。',objectives:[{id:'ind03',n:1},{id:'ind07',n:1}],rewards:{cash:25000,items:[]}},
 {id:'elena_clinic_archive',title:'诊所旧藏',tier:2,description:'委托人希望整理旧诊所留下的影像资料与器材，用于核对一段医疗记录。',objectives:[{id:'med03',n:2},{id:'med02',n:2}],rewards:{cash:22000,items:[{kind:'item',id:'heal03',n:1}]}},
 {id:'elena_clock_collection',title:'钟表收藏',tier:2,description:'一位私人收藏家正在补全自己的机械钟表陈列，请留意完整的旧座钟与怀表。',objectives:[{id:'antiq01',n:1},{id:'antiq02',n:1}],rewards:{cash:90000,items:[{kind:'attachment',id:'att_optic02',n:1}]}},
 {id:'elena_evacuation_voices',title:'撤离之声',tier:3,description:'事务所正在核对一段撤离通信。委托人需要原始录音及可用于整理影像的设备。',objectives:[{id:'elec08',n:1},{id:'intel10',n:1}],rewards:{cash:310000,items:[{kind:'attachment',id:'att_mag_556_60',n:1}]}},
 {id:'elena_mirror_records',title:'镜中的记录',tier:3,description:'一项谨慎的文献比较需要卜镜实物与勘测报告。我们不会要求您亲自尝试任何仪式。',objectives:[{id:'occ09',n:1},{id:'intel11',n:1}],rewards:{cash:450000,items:[{kind:'armor',id:'body4',type:'body',n:1}]}}
];
