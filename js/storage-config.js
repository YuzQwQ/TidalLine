const STORAGE_UI_CONFIG={
  categories:[
    {id:'all',name:'全部物品',icon:'box'},
    {id:'weapons',name:'武器',icon:'tool'},
    {id:'ammo',name:'弹药',icon:'box'},
    {id:'protection',name:'防护装备',icon:'person'},
    {id:'bags',name:'背包',icon:'box'},
    {id:'medical',name:'医疗物品',icon:'cross'},
    {id:'collectibles',name:'收集品',icon:'archive'}
  ],
  planned:{lock:'物品锁定尚未开放。绑定赠送刀具仍沿用现有不可出售规则，与手动锁定无关。',repair:'维修与改装服务尚未开放。当前只展示物品实际耐久，不扣除维修费用。',batch:'多选、批量转移等操作尚未开放。本轮可确认出售寻常收集品，不处理医疗、弹药或装备。'},
  demo:[
    {name:'突击步枪',file:'gear/rifle.png',category:'weapons',rarity:3,desc:'演示装备，实际枪械属性由游戏定义提供。'},
    {name:'M-9 制式战斗刀',file:'gear/melee02.png',category:'weapons',rarity:2},
    {name:'5.56×45mm 弹药',file:'items/ammo_556.png',category:'ammo',rarity:2,quantity:60},
    {name:'9×19mm 弹药',file:'items/ammo_9mm.png',category:'ammo',rarity:1,quantity:90},
    {name:'12 Gauge 霰弹',file:'items/ammo_12g.png',category:'ammo',rarity:3,quantity:20},
    {name:'防撞头盔',file:'gear/helmet3.png',category:'protection',rarity:3},
    {name:'轻型战术背心',file:'gear/body3.png',category:'protection',rarity:3},
    {name:'民用旅行背包',file:'gear/bag02.png',category:'bags',rarity:2},
    {name:'绷带',file:'items/heal01.png',category:'medical',rarity:1},
    {name:'家庭急救包',file:'items/heal03.png',category:'medical',rarity:3},
    {name:'潮汐仪',file:'items/odd02.png',category:'collectibles',cat:'odd',rarity:6},
    {name:'收音机',file:'items/elec02.png',category:'collectibles',cat:'elec',rarity:2}
  ]
};
