/* ============================================================
   潮汐线 · 数据层
   地图 / 物品 / 敌人。往这里加东西不需要改逻辑代码。
   ============================================================ */

/* BEGIN GENERATED LINHAI MAP */
// 由 tools/build-linhai-map.js 生成，请修改设计稿再重建。
const RAID_MAP = {"id":"linhai-old-quarter","title":"临海路旧街区","width":72,"height":56,"source":"design/maps/linhai-old-quarter/layout.json","sourceSha256":"8983d3645712f4fb826f7741e91f843bbe8b50151576eac7cb8eb4ced8f2bb73","tideEnabled":false,"terrain":{"#":{"art":"wall","solid":true,"blocked":true,"opaque":true,"permanentWater":false},"X":{"art":"wall","solid":true,"blocked":true,"opaque":true,"permanentWater":false},".":{"art":"low","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"r":{"art":"street_stone","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"q":{"art":"courtyard_paving","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"i":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"~":{"art":"canal_water","solid":false,"blocked":true,"opaque":false,"permanentWater":true},"k":{"art":"quay_top","solid":false,"blocked":true,"opaque":false,"permanentWater":false},"=":{"art":"bridge_stone_deck","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"-":{"art":"bridge_wood_deck","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"+":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"/":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"w":{"art":"floor","solid":false,"blocked":true,"opaque":false,"permanentWater":false},"s":{"art":"canal_steps_w","solid":false,"blocked":false,"opaque":false,"permanentWater":false}},"terrainRows":["#############################k~~~~~~k###################################","#............................k~~~~~~k..................................#","#............................k~~~~~~k..................................#","#......................rrrrrrk~~~~~~k..................................#","#......................rrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX................#","#......................rrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX...qqqqqqqqqq...#","#......................rrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX...qqqqqqqqqq...#","#....###########...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX...qqqqqqqqqq...#","#....#iiii#iiii#...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXX......qqqqqqqqqq...#","#....#iiii#iiii#...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXX......qqqqqqqqqq...#","#....#iiii#iiii#...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXX......qqqqqqqqqq...#","#....#iiii#iiii####rrrrrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr###+####+#####rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr#iiiiiiiiiiii+rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr#iiiiiiiiiiii+rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr###+#ii####++#rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#....#iii#ii#iiiii#rrrrrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#....#iii+ii+iiiii#rrrrrrrrrrk~~~~~~krrrrrr.###########rrrr............#","#....#iii#ii+iiiii#rrrrrrrrrrk~~~~~~krrrrrr.wiiii#iiii#rrrr............#","#....#####ii###++##rrrrrrrrrrk~~~~~~krrrrrr.wiiii#iiii#rrrr............#","#....#iii#iiiiiiii#rrrrrrrrrrk~~~~~~krrrrrr.#iiii+iiii#rrrr............#","#....#iii+iiiiiiii#rrrrrrrrrrk~~~~~~krrrrrr.+iiii+iiii#rrrr............#","#....#########++###rrrrrrrrrrk~~~~~~krrrrrr.#iiii##++##rrrr............#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~srrrrrr.wiiii#iiii#rrrr............#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~srrrrrr.wiiii+iiii+rrrr............#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~srrrrrr.#iiii+iiii#rrrr............#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~krrrrrr.###########rrrr............#","#....qqqqqqqqq.qqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#....qqqqqqqqq.qqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~krrrrrrqqqqqqqq.##############..rrr#","#..rrrrrrrrrrrrqqqqqqqqrrrrrrk~~~~~~krrrrrrqqqqqqqq.#iiiii#iiiiii#..rrr#","#....###++#####rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.#iiiii#iiiiiii##rrr#","#....#iiiii#ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.+iiiii+iiiiiiii#rrr#","#....#iiiii+ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.+iiiii+iiiiiiii#rrr#","#....#iiiii+ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.#iiiii#iiiiiiii#rrr#","#....###++##ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.###+##++########rrr#","#....#iiiii#ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.#iiii#ii#iiiiii#rrr#","#....#iiiii+ii/rrrr....rrrrrrk~~~~~~krrrrrr.........#iiii+ii+iiiiii#rrr#","#....#iiiii+ii/rrrr....rrrrrr--------rrrrrr.........#iiii+ii+iiiiii#rrr#","#....#######ii#rrrr....rrrrrr--------rrrrrr.........###+##++###++###rrr#","#....##iiii+ii#rrrr....rrrrrr--------rrrrrr.........#iiiiiii#iiiiii#rrr#","#......#iii#ii#rrrr....rrrrrrk~~~~~~krrrrrr......rrr#iiiiiii#iiiiii#rrr#","#......########rrrr....rrrrrrk~~~~~~kkk####++####rrr##iiiiii#iiiiii#rrr#","#..............rrrr....rrrrrrk~~~~~~kkk#iiiiiiii#rrr..#iiiii#iiiiii#rrr#","#..............rrrr....rrrrrrk~~~~~~kkk#iiiiiiii#rrr..####++########rrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#............................k~~~~~~kkk##########rrrrrrrrrrrrrrrrrrrrrr#","#............................k~~~~~~k..................................#","#############################k~~~~~~k###################################"],"rows":["#############################k~~~~~~k###################################","#............................k~~~~~~k..................................#","#............................k~~~~~~k..................................#","#......................rrrrrrk~~~~~~k..................................#","#......P...............rrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX................#","#......................rrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX...qqqqqqqqqq...#","#......................rrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX...qqqqqqqqqq...#","#....###########...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXXXXX...qqqqqqqqqq...#","#....#iiii#iiii#...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXX......qqqqqqqqqq...#","#....#Ciii#iiiC#...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXX......qqqTqqqqqq...#","#....#iiii#iiii#...rrrrrrrrrrk~~~~~~krrrrrr.XXXXXXXX......qqqqqqqqqq...#","#....#iiii#iiii####rrrrrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr###+####+#####rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr#iiiiiiiiiiii+rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr#iiiiiiiiiiii+rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rr###+#ii####++#rrrrrrrrrr========rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#....#iii#ii#iiiii#rrrrrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#....#Lii+ii+iiiiC#rrrrrrrrrrk~~~~~~krrrrrr.###########rrrr............#","#....#iii#ii+iiiiL#rrrrrrrrrrk~~~~~~krrrrrr.wLiii#Riii#rrrr............#","#....#####ii###++##rrrCrrrrrrk~~~~~~krrrrrr.wiiii#iiiL#rrrr............#","#....#iii#iiiiiiii#rrrrrrrrrrk~~~~~~krrrrrr.#iiii+iiii#rrrr............#","#....#Lii+iiiiiiiM#rrrrrrrrrrk~~~~~~krrrrrr.+iiii+iiii#rrrr............#","#....#########++###rrrrrrrrrrk~~~~~~krrrrrr.#iiii##++##rrrr............#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~srrrrrr.wiiii#iiii#rrrr............#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~srrrrrr.wiiii+iiii+rrrR............#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~srrrrrr.#Ciii+BiiB#rrrr............#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~krrrrrr.###########rrrr............#","#....qqqqqqqqq.qTqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#....qqqqqqqqq.qqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrCrrrrrr#","#..rrqqqqqqqqqrqqqqqqqqrrrrrrk~~~~~~krrrrrrqqqqqqqq.##############..rrr#","#..rrrrrrrrrrrrqqqqqqqqrrrrrrk~~~~~~krrrrrrqqqqqqqq.#CiiLi#iiiiii#..rrr#","#....###++#####rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.#iiiii#iiiiiii##rrr#","#....#iiiiL#ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.+iiiii+iiiiiiii#rrr#","#....#Ciiii+ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.+iiiii+iiiiiiii#rrr#","#....#iiiii+ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.#iiiii#iiiiiiii#rrr#","#....###++##ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.###+##++########rrr#","#....#iiiii#ii#rrrr....rrrrrrk~~~~~~krrrrrrqqqqqqqq.#Liii#ii#iiiiii#rrr#","#....#Miiii+ii/rrrr....rrrrrrk~~~~~~krrrrrr.........#iiii+ii+iiiiii#rrr#","#....#iiiii+ii/rrrr....rrrrrr--------rrrrrr.........#iiii+ii+iiiiii#rrr#","#....#######ii#rrrr....rrrrrr--------rrrrrr.........###+##++###++###rrr#","#....##Miii+ii#rrrr....rrrrrr--------rrrrrr.........#iiiiiii#BiiiiB#rrr#","#......#iiM#ii#rrrr....rrrrrrk~~~~~~krrrrrr......rrr#iiiiiii#iiiiii#rrr#","#......########rrrM....rrrrrrk~~~~~~kkk####++####rrr##iiiiii#BiiiiB#rrr#","#..............rrrr....rrrrrrk~~~~~~kkk#TiiiiiiT#rrr..#Liiii#BiiiiB#rrr#","#..............rrrr....rrrrrrk~~~~~~kkk#iiiiiiii#rrr..####++########rrr#","#..rCrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrrrrrrrrrrrrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrKrrrrrrrrrrr#","#..rrrErrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#Riiiiiii#rrrrrrrrrrrrrrrrrrErrr#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#LiiiiiiK#rrrrrrrrrrrrrrrrrrrrrr#","#............................k~~~~~~kkk##########rrrrrrrrrrrrrrrrrrrrrr#","#............................k~~~~~~k..................................#","#############################k~~~~~~k###################################"],"spawn":{"id":"spawn","name":"西北入口","x":7,"y":4},"exits":[{"id":"A","name":"西岸撤离 A","x":6,"y":51,"risk":"低"},{"id":"B","name":"东岸撤离 B","x":67,"y":51,"risk":"较高，接近银行外围"}],"doors":[{"id":"apartment.bed1","cells":[[8,12]],"axis":"horizontal","reinforced":false},{"id":"apartment.bed2","cells":[[13,12]],"axis":"horizontal","reinforced":false},{"id":"apartment.kitchen-n","cells":[[8,15]],"axis":"horizontal","reinforced":false},{"id":"apartment.kitchen-e","cells":[[9,17]],"axis":"vertical","reinforced":false},{"id":"apartment.store","cells":[[9,21]],"axis":"vertical","reinforced":false},{"id":"apartment.living-w","cells":[[12,17],[12,18]],"axis":"vertical","reinforced":false},{"id":"apartment.living-n","cells":[[16,15],[17,15]],"axis":"horizontal","reinforced":false},{"id":"apartment.living-s","cells":[[15,19],[16,19]],"axis":"horizontal","reinforced":false},{"id":"apartment.front","cells":[[14,22],[15,22]],"axis":"horizontal","reinforced":false},{"id":"apartment.side","cells":[[18,13],[18,14]],"axis":"vertical","reinforced":false},{"id":"clinic.front","cells":[[8,33],[9,33]],"axis":"horizontal","reinforced":false},{"id":"clinic.treatment","cells":[[8,37],[9,37]],"axis":"horizontal","reinforced":false},{"id":"clinic.waiting-side","cells":[[11,35],[11,36]],"axis":"vertical","reinforced":false},{"id":"clinic.treatment-side","cells":[[11,39],[11,40]],"axis":"vertical","reinforced":false},{"id":"clinic.pharmacy","cells":[[11,42]],"axis":"vertical","reinforced":false},{"id":"clockshop.front","cells":[[44,21]],"axis":"vertical","reinforced":false},{"id":"clockshop.repair","cells":[[49,20],[49,21]],"axis":"vertical","reinforced":false},{"id":"clockshop.store","cells":[[51,22],[52,22]],"axis":"horizontal","reinforced":false},{"id":"clockshop.counter","cells":[[49,24],[49,25]],"axis":"vertical","reinforced":false},{"id":"clockshop.rear","cells":[[54,24]],"axis":"vertical","reinforced":false},{"id":"bank.front","cells":[[52,34],[52,35]],"axis":"vertical","reinforced":false},{"id":"bank.counter","cells":[[58,34],[58,35]],"axis":"vertical","reinforced":false},{"id":"bank.office-front","cells":[[55,37]],"axis":"horizontal","reinforced":false},{"id":"bank.passage","cells":[[58,37],[59,37]],"axis":"horizontal","reinforced":false},{"id":"bank.office","cells":[[57,39],[57,40]],"axis":"vertical","reinforced":false},{"id":"bank.security","cells":[[60,39],[60,40]],"axis":"vertical","reinforced":true},{"id":"bank.vault","cells":[[63,41],[64,41]],"axis":"horizontal","reinforced":true},{"id":"bank.office-service","cells":[[55,41]],"axis":"horizontal","reinforced":false},{"id":"bank.passage-service","cells":[[58,41],[59,41]],"axis":"horizontal","reinforced":false},{"id":"bank.rear","cells":[[58,46],[59,46]],"axis":"horizontal","reinforced":false},{"id":"warehouse.front","cells":[[43,44],[44,44]],"axis":"horizontal","reinforced":false},{"id":"warehouse.side","cells":[[48,49],[48,50]],"axis":"vertical","reinforced":false}],"doorAxes":{"8,12":"horizontal","13,12":"horizontal","8,15":"horizontal","9,17":"vertical","9,21":"vertical","12,17":"vertical","12,18":"vertical","16,15":"horizontal","17,15":"horizontal","15,19":"horizontal","16,19":"horizontal","14,22":"horizontal","15,22":"horizontal","18,13":"vertical","18,14":"vertical","8,33":"horizontal","9,33":"horizontal","8,37":"horizontal","9,37":"horizontal","11,35":"vertical","11,36":"vertical","11,39":"vertical","11,40":"vertical","11,42":"vertical","44,21":"vertical","49,20":"vertical","49,21":"vertical","51,22":"horizontal","52,22":"horizontal","49,24":"vertical","49,25":"vertical","54,24":"vertical","52,34":"vertical","52,35":"vertical","58,34":"vertical","58,35":"vertical","55,37":"horizontal","58,37":"horizontal","59,37":"horizontal","57,39":"vertical","57,40":"vertical","60,39":"vertical","60,40":"vertical","63,41":"horizontal","64,41":"horizontal","55,41":"horizontal","58,41":"horizontal","59,41":"horizontal","58,46":"horizontal","59,46":"horizontal","43,44":"horizontal","44,44":"horizontal","48,49":"vertical","48,50":"vertical"},"props":[{"id":"p01","region":"apartment","type":"bed","name":"床","x":6,"y":8,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p02","region":"apartment","type":"bed","name":"床","x":11,"y":8,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p03","region":"apartment","type":"desk","name":"床头柜","x":9,"y":8,"solid":true,"art":"desk","provisional":false,"ground":false},{"id":"p04","region":"apartment","type":"desk","name":"床头柜","x":14,"y":11,"solid":true,"art":"desk","provisional":false,"ground":false},{"id":"p05","region":"apartment","type":"stove","name":"灶台","x":6,"y":16,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p06","region":"apartment","type":"sofa","name":"沙发","x":13,"y":16,"solid":true,"art":"chair","provisional":true,"ground":false},{"id":"p07","region":"apartment","type":"bench","name":"门厅长凳","x":17,"y":20,"solid":true,"art":"chair","provisional":true,"ground":false},{"id":"p08","region":"clinic","type":"chair","name":"候诊椅","x":7,"y":35,"solid":true,"art":"chair","provisional":false,"ground":false},{"id":"p09","region":"clinic","type":"chair","name":"候诊椅","x":8,"y":35,"solid":true,"art":"chair","provisional":false,"ground":false},{"id":"p10","region":"clinic","type":"bed","name":"诊疗床","x":8,"y":39,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p11","region":"clinic","type":"desk","name":"诊疗台","x":10,"y":38,"solid":true,"art":"desk","provisional":false,"ground":false},{"id":"p12","region":"clockshop","type":"display","name":"橱窗展柜","x":45,"y":19,"solid":true,"art":"shelf","provisional":true,"ground":false},{"id":"p13","region":"clockshop","type":"display","name":"橱窗展柜","x":46,"y":19,"solid":true,"art":"shelf","provisional":true,"ground":false},{"id":"p14","region":"clockshop","type":"counter","name":"营业柜台","x":45,"y":23,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p15","region":"clockshop","type":"counter","name":"营业柜台","x":46,"y":23,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p16","region":"clockshop","type":"desk","name":"维修台","x":53,"y":21,"solid":true,"art":"desk","provisional":false,"ground":false},{"id":"p17","region":"bank","type":"bench","name":"前厅长凳","x":53,"y":36,"solid":true,"art":"chair","provisional":true,"ground":false},{"id":"p18","region":"bank","type":"counter","name":"银行柜台","x":62,"y":34,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p19","region":"bank","type":"counter","name":"银行柜台","x":63,"y":34,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p20","region":"bank","type":"counter","name":"银行柜台","x":64,"y":34,"solid":true,"art":"desk","provisional":true,"ground":false},{"id":"p21","region":"bank","type":"desk","name":"办公桌","x":56,"y":38,"solid":true,"art":"desk","provisional":false,"ground":false},{"id":"p22","region":"bank","type":"desk","name":"安保监控台","x":66,"y":38,"solid":true,"art":"desk","provisional":false,"ground":false},{"id":"p23","region":"bank","type":"shelf","name":"后勤架","x":54,"y":43,"solid":true,"art":"shelf","provisional":false,"ground":false},{"id":"p24","region":"bank","type":"shelf","name":"后勤架","x":55,"y":43,"solid":true,"art":"shelf","provisional":false,"ground":false},{"id":"p25","region":"warehouse","type":"shelf","name":"工具货架","x":40,"y":47,"solid":true,"art":"shelf","provisional":false,"ground":false},{"id":"p26","region":"warehouse","type":"shelf","name":"工具货架","x":41,"y":47,"solid":true,"art":"shelf","provisional":false,"ground":false},{"id":"p27","region":"warehouse","type":"shelf","name":"工具货架","x":46,"y":47,"solid":true,"art":"shelf","provisional":false,"ground":false},{"id":"p28","region":"warehouse","type":"shelf","name":"工具货架","x":47,"y":47,"solid":true,"art":"shelf","provisional":false,"ground":false},{"id":"p29","region":"outdoors","type":"tree","name":"院落树木","x":6,"y":27,"solid":true,"art":"barrel","provisional":true,"ground":false},{"id":"p30","region":"outdoors","type":"tree","name":"院落树木","x":10,"y":29,"solid":true,"art":"barrel","provisional":true,"ground":false},{"id":"p31","region":"outdoors","type":"tree","name":"院落树木","x":19,"y":29,"solid":true,"art":"barrel","provisional":true,"ground":false},{"id":"p32","region":"outdoors","type":"tree","name":"院落树木","x":65,"y":7,"solid":true,"art":"barrel","provisional":true,"ground":false},{"id":"p33","region":"outdoors","type":"bench","name":"庭院长椅","x":15,"y":29,"solid":true,"art":"chair","provisional":true,"ground":false},{"id":"p34","region":"outdoors","type":"bench","name":"庭院长椅","x":16,"y":29,"solid":true,"art":"chair","provisional":true,"ground":false},{"id":"p35","region":"outdoors","type":"bench","name":"庭院长椅","x":45,"y":37,"solid":true,"art":"chair","provisional":true,"ground":false},{"id":"p36","region":"outdoors","type":"bench","name":"庭院长椅","x":46,"y":37,"solid":true,"art":"chair","provisional":true,"ground":false},{"id":"p37","region":"outdoors","type":"barrel","name":"杂物桶","x":22,"y":9,"solid":true,"art":"barrel","provisional":false,"ground":false},{"id":"p38","region":"outdoors","type":"barrel","name":"杂物桶","x":58,"y":18,"solid":true,"art":"barrel","provisional":false,"ground":false},{"id":"p39","region":"outdoors","type":"barrel","name":"杂物桶","x":70,"y":28,"solid":true,"art":"barrel","provisional":false,"ground":false},{"id":"p40","region":"outdoors","type":"barrel","name":"杂物桶","x":67,"y":9,"solid":true,"art":"barrel","provisional":false,"ground":false}],"overlays":[{"art":"canal_bank_w","x":29,"y":0},{"art":"canal_bank_e","x":36,"y":0},{"art":"canal_bank_w","x":29,"y":1},{"art":"canal_bank_e","x":36,"y":1},{"art":"canal_bank_w","x":29,"y":2},{"art":"canal_bank_e","x":36,"y":2},{"art":"canal_bank_w","x":29,"y":3},{"art":"canal_bank_e","x":36,"y":3},{"art":"canal_bank_w","x":29,"y":4},{"art":"canal_bank_e","x":36,"y":4},{"art":"canal_bank_w","x":29,"y":5},{"art":"canal_bank_e","x":36,"y":5},{"art":"canal_bank_w","x":29,"y":6},{"art":"canal_bank_e","x":36,"y":6},{"art":"canal_bank_w","x":29,"y":7},{"art":"canal_bank_e","x":36,"y":7},{"art":"canal_bank_w","x":29,"y":8},{"art":"canal_bank_e","x":36,"y":8},{"art":"canal_bank_w","x":29,"y":9},{"art":"canal_bank_e","x":36,"y":9},{"art":"canal_bank_w","x":29,"y":10},{"art":"canal_bank_e","x":36,"y":10},{"art":"canal_bank_w","x":29,"y":11},{"art":"canal_bank_e","x":36,"y":11},{"art":"canal_bank_w","x":29,"y":16},{"art":"canal_bank_e","x":36,"y":16},{"art":"canal_bank_w","x":29,"y":17},{"art":"canal_bank_e","x":36,"y":17},{"art":"canal_bank_w","x":29,"y":18},{"art":"canal_bank_e","x":36,"y":18},{"art":"canal_bank_w","x":29,"y":19},{"art":"canal_bank_e","x":36,"y":19},{"art":"canal_bank_w","x":29,"y":20},{"art":"canal_bank_e","x":36,"y":20},{"art":"canal_bank_w","x":29,"y":21},{"art":"canal_bank_e","x":36,"y":21},{"art":"canal_bank_w","x":29,"y":22},{"art":"canal_bank_e","x":36,"y":22},{"art":"canal_bank_w","x":29,"y":23},{"art":"canal_bank_w","x":29,"y":24},{"art":"canal_bank_w","x":29,"y":25},{"art":"canal_bank_w","x":29,"y":26},{"art":"canal_bank_e","x":36,"y":26},{"art":"canal_bank_e","x":36,"y":27},{"art":"canal_bank_e","x":36,"y":28},{"art":"canal_bank_e","x":36,"y":29},{"art":"canal_bank_w","x":29,"y":30},{"art":"canal_bank_e","x":36,"y":30},{"art":"canal_bank_w","x":29,"y":31},{"art":"canal_bank_e","x":36,"y":31},{"art":"canal_bank_w","x":29,"y":32},{"art":"canal_bank_e","x":36,"y":32},{"art":"canal_bank_w","x":29,"y":33},{"art":"canal_bank_e","x":36,"y":33},{"art":"canal_bank_w","x":29,"y":34},{"art":"canal_bank_e","x":36,"y":34},{"art":"canal_bank_w","x":29,"y":35},{"art":"canal_bank_e","x":36,"y":35},{"art":"canal_bank_w","x":29,"y":36},{"art":"canal_bank_e","x":36,"y":36},{"art":"canal_bank_w","x":29,"y":37},{"art":"canal_bank_e","x":36,"y":37},{"art":"canal_bank_w","x":29,"y":38},{"art":"canal_bank_e","x":36,"y":38},{"art":"canal_bank_w","x":29,"y":39},{"art":"canal_bank_e","x":36,"y":39},{"art":"canal_bank_w","x":29,"y":43},{"art":"canal_bank_e","x":36,"y":43},{"art":"canal_bank_w","x":29,"y":44},{"art":"canal_bank_e","x":36,"y":44},{"art":"canal_bank_w","x":29,"y":45},{"art":"canal_bank_e","x":36,"y":45},{"art":"canal_bank_w","x":29,"y":46},{"art":"canal_bank_e","x":36,"y":46},{"art":"canal_bank_w","x":29,"y":47},{"art":"canal_bank_e","x":36,"y":47},{"art":"canal_bank_w","x":29,"y":48},{"art":"canal_bank_e","x":36,"y":48},{"art":"canal_bank_w","x":29,"y":49},{"art":"canal_bank_e","x":36,"y":49},{"art":"canal_bank_w","x":29,"y":50},{"art":"canal_bank_e","x":36,"y":50},{"art":"canal_bank_w","x":29,"y":51},{"art":"canal_bank_e","x":36,"y":51},{"art":"canal_bank_w","x":29,"y":52},{"art":"canal_bank_e","x":36,"y":52},{"art":"canal_bank_w","x":29,"y":53},{"art":"canal_bank_e","x":36,"y":53},{"art":"canal_bank_w","x":29,"y":54},{"art":"canal_bank_e","x":36,"y":54},{"art":"canal_bank_w","x":29,"y":55},{"art":"canal_bank_e","x":36,"y":55},{"art":"bridge_stone_rail_n","x":29,"y":11},{"art":"bridge_stone_rail_n","x":30,"y":11},{"art":"bridge_stone_rail_n","x":31,"y":11},{"art":"bridge_stone_rail_n","x":32,"y":11},{"art":"bridge_stone_rail_n","x":33,"y":11},{"art":"bridge_stone_rail_n","x":34,"y":11},{"art":"bridge_stone_rail_n","x":35,"y":11},{"art":"bridge_stone_rail_n","x":36,"y":11},{"art":"bridge_stone_rail_s","x":29,"y":16},{"art":"bridge_stone_rail_s","x":30,"y":16},{"art":"bridge_stone_rail_s","x":31,"y":16},{"art":"bridge_stone_rail_s","x":32,"y":16},{"art":"bridge_stone_rail_s","x":33,"y":16},{"art":"bridge_stone_rail_s","x":34,"y":16},{"art":"bridge_stone_rail_s","x":35,"y":16},{"art":"bridge_stone_rail_s","x":36,"y":16},{"art":"bridge_wood_rail_n","x":29,"y":39},{"art":"bridge_wood_rail_n","x":30,"y":39},{"art":"bridge_wood_rail_n","x":31,"y":39},{"art":"bridge_wood_rail_n","x":32,"y":39},{"art":"bridge_wood_rail_n","x":33,"y":39},{"art":"bridge_wood_rail_n","x":34,"y":39},{"art":"bridge_wood_rail_n","x":35,"y":39},{"art":"bridge_wood_rail_n","x":36,"y":39},{"art":"bridge_wood_rail_s","x":29,"y":43},{"art":"bridge_wood_rail_s","x":30,"y":43},{"art":"bridge_wood_rail_s","x":31,"y":43},{"art":"bridge_wood_rail_s","x":32,"y":43},{"art":"bridge_wood_rail_s","x":33,"y":43},{"art":"bridge_wood_rail_s","x":34,"y":43},{"art":"bridge_wood_rail_s","x":35,"y":43},{"art":"bridge_wood_rail_s","x":36,"y":43},{"art":"shop_window_ns","x":44,"y":18},{"art":"shop_window_ns","x":44,"y":19},{"art":"shop_window_ns","x":44,"y":23},{"art":"shop_window_ns","x":44,"y":24},{"art":"wall_breach_n","x":14,"y":38,"replaceWall":true},{"art":"wall_breach_s","x":14,"y":41,"replaceWall":true},{"art":"rubble_decal","x":14,"y":39},{"art":"rubble_decal","x":14,"y":40}],"containers":[{"id":"c01","region":"apartment","type":"C","x":6,"y":9,"preference":["life"]},{"id":"c02","region":"apartment","type":"C","x":14,"y":9,"preference":["life"]},{"id":"c03","region":"apartment","type":"L","x":6,"y":17,"preference":["life"]},{"id":"c04","region":"apartment","type":"L","x":6,"y":21,"preference":["life"]},{"id":"c05","region":"apartment","type":"C","x":17,"y":17,"preference":["life"]},{"id":"c06","region":"apartment","type":"L","x":17,"y":18,"preference":["life"]},{"id":"c07","region":"apartment","type":"M","x":17,"y":21,"preference":["life"]},{"id":"c08","region":"clinic","type":"M","x":7,"y":42,"preference":["med"]},{"id":"c09","region":"clinic","type":"M","x":10,"y":43,"preference":["med"]},{"id":"c10","region":"clinic","type":"M","x":6,"y":39,"preference":["med"]},{"id":"c11","region":"clinic","type":"L","x":10,"y":34,"preference":["med"]},{"id":"c12","region":"clinic","type":"C","x":6,"y":35,"preference":["med"]},{"id":"c13","region":"clockshop","type":"C","x":45,"y":25,"preference":["antiq","lux"]},{"id":"c14","region":"clockshop","type":"L","x":53,"y":19,"preference":["antiq","lux"]},{"id":"c15","region":"clockshop","type":"R","x":50,"y":18,"preference":["antiq","lux"]},{"id":"c16","region":"clockshop","type":"B","x":50,"y":25,"preference":["antiq","lux"]},{"id":"c17","region":"clockshop","type":"B","x":53,"y":25,"preference":["antiq","lux"]},{"id":"c18","region":"clockshop","type":"L","x":45,"y":18,"preference":["antiq","lux"]},{"id":"c19","region":"bank","type":"C","x":53,"y":32,"preference":["lux","antiq","art"]},{"id":"c20","region":"bank","type":"L","x":56,"y":32,"preference":["lux","antiq","art"]},{"id":"c21","region":"bank","type":"L","x":53,"y":38,"preference":["lux","antiq","art"]},{"id":"c22","region":"bank","type":"L","x":55,"y":45,"preference":["lux","antiq","art"]},{"id":"c23","region":"bank","type":"B","x":61,"y":42,"preference":["lux","antiq","art"]},{"id":"c24","region":"bank","type":"B","x":66,"y":42,"preference":["lux","antiq","art"]},{"id":"c25","region":"bank","type":"B","x":61,"y":44,"preference":["lux","antiq","art"]},{"id":"c26","region":"bank","type":"B","x":66,"y":44,"preference":["lux","antiq","art"]},{"id":"c27","region":"bank","type":"B","x":61,"y":45,"preference":["lux","antiq","art"]},{"id":"c28","region":"bank","type":"B","x":66,"y":45,"preference":["lux","antiq","art"]},{"id":"c29","region":"warehouse","type":"T","x":40,"y":45,"preference":["ind","elec"]},{"id":"c30","region":"warehouse","type":"T","x":47,"y":45,"preference":["ind","elec"]},{"id":"c31","region":"warehouse","type":"R","x":40,"y":51,"preference":["ind","elec"]},{"id":"c32","region":"warehouse","type":"L","x":40,"y":52,"preference":["ind","elec"]},{"id":"c33","region":"warehouse","type":"K","x":47,"y":52,"preference":["ind","elec"]},{"id":"c34","region":"outdoors","type":"C","x":22,"y":19,"preference":["life","ind"]},{"id":"c35","region":"outdoors","type":"T","x":16,"y":27,"preference":["life","ind"]},{"id":"c36","region":"outdoors","type":"M","x":18,"y":44,"preference":["life","ind"]},{"id":"c37","region":"outdoors","type":"C","x":4,"y":47,"preference":["life","ind"]},{"id":"c38","region":"outdoors","type":"R","x":58,"y":24,"preference":["life","ind"]},{"id":"c39","region":"outdoors","type":"C","x":64,"y":30,"preference":["life","ind"]},{"id":"c40","region":"outdoors","type":"T","x":61,"y":9,"preference":["life","ind"]},{"id":"c41","region":"outdoors","type":"K","x":59,"y":50,"preference":["life","ind"]}],"enemies":[{"id":"e01","region":"apartment","type":"scav","x":8,"y":18,"patrolRadius":2},{"id":"e02","region":"apartment","type":"scav","x":15,"y":17,"patrolRadius":2},{"id":"e03","region":"apartment","type":"scav","x":14,"y":21,"patrolRadius":2},{"id":"e04","region":"clinic","type":"scav","x":8,"y":38,"patrolRadius":2},{"id":"e05","region":"clinic","type":"scav","x":13,"y":42,"patrolRadius":2},{"id":"e06","region":"clockshop","type":"scav","x":47,"y":20,"patrolRadius":2},{"id":"e07","region":"clockshop","type":"scav","x":52,"y":20,"patrolRadius":2},{"id":"e08","region":"clockshop","type":"scav","x":51,"y":24,"patrolRadius":2},{"id":"e09","region":"bank","type":"guard","x":55,"y":35,"patrolRadius":2},{"id":"e10","region":"bank","type":"guard","x":64,"y":35,"patrolRadius":2},{"id":"e11","region":"bank","type":"guard","x":55,"y":40,"patrolRadius":2},{"id":"e12","region":"bank","type":"guard","x":62,"y":39,"patrolRadius":2},{"id":"e13","region":"bank","type":"guard","x":65,"y":40,"patrolRadius":2},{"id":"e14","region":"warehouse","type":"scav","x":42,"y":48,"patrolRadius":2},{"id":"e15","region":"warehouse","type":"scav","x":46,"y":51,"patrolRadius":2},{"id":"e16","region":"outdoors","type":"scav","x":21,"y":23,"patrolRadius":3},{"id":"e17","region":"outdoors","type":"scav","x":62,"y":8,"patrolRadius":3},{"id":"e18","region":"outdoors","type":"echo","x":18,"y":31,"patrolRadius":3},{"id":"e19","region":"outdoors","type":"echo","x":17,"y":39,"patrolRadius":3},{"id":"e20","region":"outdoors","type":"echo","x":8,"y":27,"patrolRadius":3},{"id":"e21","region":"outdoors","type":"echo","x":21,"y":48,"patrolRadius":3},{"id":"e22","region":"outdoors","type":"echo","x":58,"y":28,"patrolRadius":3},{"id":"e23","region":"outdoors","type":"echo","x":39,"y":29,"patrolRadius":3},{"id":"e24","region":"outdoors","type":"echo","x":50,"y":40,"patrolRadius":3}],"rooms":[{"id":"apartment.bed1","building":"apartment","name":"卧室 1","rect":[6,8,9,11],"anchor":[8,10],"role":"卧室 1"},{"id":"apartment.bed2","building":"apartment","name":"卧室 2","rect":[11,8,14,11],"anchor":[13,10],"role":"卧室 2"},{"id":"apartment.hall","building":"apartment","name":"侧廊 · 北段","rect":[6,13,17,14],"anchor":[11,13],"role":"侧廊 · 北段"},{"id":"apartment.spine","building":"apartment","name":"侧廊 · 两格走廊","rect":[10,15,11,21],"anchor":[10,18],"role":"侧廊 · 两格走廊"},{"id":"apartment.kitchen","building":"apartment","name":"厨房","rect":[6,16,8,18],"anchor":[7,18],"role":"厨房"},{"id":"apartment.store","building":"apartment","name":"小储藏间","rect":[6,20,8,21],"anchor":[8,20],"role":"小储藏间"},{"id":"apartment.living","building":"apartment","name":"客厅","rect":[13,16,17,18],"anchor":[14,17],"role":"客厅"},{"id":"apartment.entry","building":"apartment","name":"门厅","rect":[12,20,17,21],"anchor":[15,20],"role":"门厅"},{"id":"clinic.waiting","building":"clinic","name":"候诊区","rect":[6,34,10,36],"anchor":[9,35],"role":"候诊区"},{"id":"clinic.treatment","building":"clinic","name":"诊疗室","rect":[6,38,10,40],"anchor":[7,38],"role":"诊疗室"},{"id":"clinic.pharmacy","building":"clinic","name":"药品储藏间","rect":[6,42,10,43],"anchor":[8,42],"role":"药品储藏间"},{"id":"clinic.service","building":"clinic","name":"后勤侧廊","rect":[12,34,13,43],"anchor":[12,37],"role":"后勤侧廊"},{"id":"clockshop.showroom","building":"clockshop","name":"营业展示厅","rect":[45,18,48,22],"anchor":[47,18],"role":"营业展示厅"},{"id":"clockshop.counter","building":"clockshop","name":"柜台区","rect":[45,23,48,25],"anchor":[48,24],"role":"柜台区"},{"id":"clockshop.repair","building":"clockshop","name":"小维修间","rect":[50,18,53,21],"anchor":[51,19],"role":"小维修间"},{"id":"clockshop.store","building":"clockshop","name":"后仓","rect":[50,23,53,25],"anchor":[52,23],"role":"后仓"},{"id":"bank.lobby","building":"bank","name":"前厅","rect":[53,32,57,36],"anchor":[55,34],"role":"前厅"},{"id":"bank.counter","building":"bank","name":"柜台营业区","rect":[59,32,66,36],"anchor":[62,33],"role":"柜台营业区"},{"id":"bank.office","building":"bank","name":"办公室","rect":[53,38,56,40],"anchor":[54,40],"role":"办公室"},{"id":"bank.passage","building":"bank","name":"柜台后通道","rect":[58,38,59,40],"anchor":[58,38],"role":"柜台后通道"},{"id":"bank.security","building":"bank","name":"安保室","rect":[61,38,66,40],"anchor":[62,38],"role":"安保室"},{"id":"bank.service","building":"bank","name":"后勤环廊","rect":[54,42,59,45],"anchor":[57,44],"role":"后勤环廊"},{"id":"bank.vault","building":"bank","name":"金库 / 保险区","rect":[61,42,66,45],"anchor":[64,43],"role":"金库 / 保险区"},{"id":"warehouse.stock","building":"warehouse","name":"货架与工具区","rect":[40,45,47,52],"anchor":[44,48],"role":"货架与工具区"}],"bridges":[{"id":"north","name":"北石桥","rect":[29,12,36,15],"width":4,"tile":"=","risk":"低压，无固定堵桥怪"},{"id":"south","name":"南栈桥","rect":[29,40,36,42],"width":3,"tile":"-","risk":"暴露，邻接低地；没有固定桥头关卡"}],"tideReserve":{"implemented":false,"permanentWater":"~","note":"水面常态不可涉水；所有预留低地和南桥在本稿按正常可通行地形检查。","zones":[{"id":"south-lowland","name":"南桥东端低地","rect":[37,39,48,43]},{"id":"warehouse-lowland","name":"仓库东巷低地","rect":[49,43,51,49]},{"id":"west-stairs","name":"西岸阶梯","rect":[29,27,29,29]},{"id":"east-stairs","name":"东岸阶梯","rect":[36,23,36,25]}]},"districts":[{"key":"apartment","name":"老公寓","shape":"东北凹入后院、南侧门廊、储藏附属间","rect":[5,7,18,22],"loot":"normal","label":[12,6],"footprint":[[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[15,8],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],[12,10],[13,10],[14,10],[15,10],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11],[12,11],[13,11],[14,11],[15,11],[16,11],[17,11],[18,11],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],[15,12],[16,12],[17,12],[18,12],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],[12,13],[13,13],[14,13],[15,13],[16,13],[17,13],[18,13],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],[14,14],[15,14],[16,14],[17,14],[18,14],[5,15],[6,15],[7,15],[8,15],[9,15],[10,15],[11,15],[12,15],[13,15],[14,15],[15,15],[16,15],[17,15],[18,15],[5,16],[6,16],[7,16],[8,16],[9,16],[10,16],[11,16],[12,16],[13,16],[14,16],[15,16],[16,16],[17,16],[18,16],[5,17],[6,17],[7,17],[8,17],[9,17],[10,17],[11,17],[12,17],[13,17],[14,17],[15,17],[16,17],[17,17],[18,17],[5,18],[6,18],[7,18],[8,18],[9,18],[10,18],[11,18],[12,18],[13,18],[14,18],[15,18],[16,18],[17,18],[18,18],[5,19],[6,19],[7,19],[8,19],[9,19],[10,19],[11,19],[12,19],[13,19],[14,19],[15,19],[16,19],[17,19],[18,19],[5,20],[6,20],[7,20],[8,20],[9,20],[10,20],[11,20],[12,20],[13,20],[14,20],[15,20],[16,20],[17,20],[18,20],[5,21],[6,21],[7,21],[8,21],[9,21],[10,21],[11,21],[12,21],[13,21],[14,21],[15,21],[16,21],[17,21],[18,21],[5,22],[6,22],[7,22],[8,22],[9,22],[10,22],[11,22],[12,22],[13,22],[14,22],[15,22],[16,22],[17,22],[18,22]]},{"key":"clinic","name":"小诊所","shape":"西南退角、独立后勤侧廊与东侧破口","rect":[5,33,14,44],"loot":"normal","label":[10,32],"footprint":[[5,33],[6,33],[7,33],[8,33],[9,33],[10,33],[11,33],[12,33],[13,33],[14,33],[5,34],[6,34],[7,34],[8,34],[9,34],[10,34],[11,34],[12,34],[13,34],[14,34],[5,35],[6,35],[7,35],[8,35],[9,35],[10,35],[11,35],[12,35],[13,35],[14,35],[5,36],[6,36],[7,36],[8,36],[9,36],[10,36],[11,36],[12,36],[13,36],[14,36],[5,37],[6,37],[7,37],[8,37],[9,37],[10,37],[11,37],[12,37],[13,37],[14,37],[5,38],[6,38],[7,38],[8,38],[9,38],[10,38],[11,38],[12,38],[13,38],[14,38],[5,39],[6,39],[7,39],[8,39],[9,39],[10,39],[11,39],[12,39],[13,39],[14,39],[5,40],[6,40],[7,40],[8,40],[9,40],[10,40],[11,40],[12,40],[13,40],[14,40],[5,41],[6,41],[7,41],[8,41],[9,41],[10,41],[11,41],[12,41],[13,41],[14,41],[5,42],[6,42],[7,42],[8,42],[9,42],[10,42],[11,42],[12,42],[13,42],[14,42],[7,43],[8,43],[9,43],[10,43],[11,43],[12,43],[13,43],[14,43],[7,44],[8,44],[9,44],[10,44],[11,44],[12,44],[13,44],[14,44]]},{"key":"clockshop","name":"钟表店","shape":"临街橱窗展示面、前店后仓与侧向连门","rect":[44,17,54,26],"loot":"normal","label":[49,16],"footprint":[[44,17],[45,17],[46,17],[47,17],[48,17],[49,17],[50,17],[51,17],[52,17],[53,17],[54,17],[44,18],[45,18],[46,18],[47,18],[48,18],[49,18],[50,18],[51,18],[52,18],[53,18],[54,18],[44,19],[45,19],[46,19],[47,19],[48,19],[49,19],[50,19],[51,19],[52,19],[53,19],[54,19],[44,20],[45,20],[46,20],[47,20],[48,20],[49,20],[50,20],[51,20],[52,20],[53,20],[54,20],[44,21],[45,21],[46,21],[47,21],[48,21],[49,21],[50,21],[51,21],[52,21],[53,21],[54,21],[44,22],[45,22],[46,22],[47,22],[48,22],[49,22],[50,22],[51,22],[52,22],[53,22],[54,22],[44,23],[45,23],[46,23],[47,23],[48,23],[49,23],[50,23],[51,23],[52,23],[53,23],[54,23],[44,24],[45,24],[46,24],[47,24],[48,24],[49,24],[50,24],[51,24],[52,24],[53,24],[54,24],[44,25],[45,25],[46,25],[47,25],[48,25],[49,25],[50,25],[51,25],[52,25],[53,25],[54,25],[44,26],[45,26],[46,26],[47,26],[48,26],[49,26],[50,26],[51,26],[52,26],[53,26],[54,26]]},{"key":"bank","name":"银行旧址","shape":"东北切角、前厅门廊与南侧后勤入口","rect":[52,31,67,46],"loot":"high","label":[60,30],"footprint":[[52,31],[53,31],[54,31],[55,31],[56,31],[57,31],[58,31],[59,31],[60,31],[61,31],[62,31],[63,31],[64,31],[65,31],[52,32],[53,32],[54,32],[55,32],[56,32],[57,32],[58,32],[59,32],[60,32],[61,32],[62,32],[63,32],[64,32],[65,32],[52,33],[53,33],[54,33],[55,33],[56,33],[57,33],[58,33],[59,33],[60,33],[61,33],[62,33],[63,33],[64,33],[65,33],[66,33],[67,33],[52,34],[53,34],[54,34],[55,34],[56,34],[57,34],[58,34],[59,34],[60,34],[61,34],[62,34],[63,34],[64,34],[65,34],[66,34],[67,34],[52,35],[53,35],[54,35],[55,35],[56,35],[57,35],[58,35],[59,35],[60,35],[61,35],[62,35],[63,35],[64,35],[65,35],[66,35],[67,35],[52,36],[53,36],[54,36],[55,36],[56,36],[57,36],[58,36],[59,36],[60,36],[61,36],[62,36],[63,36],[64,36],[65,36],[66,36],[67,36],[52,37],[53,37],[54,37],[55,37],[56,37],[57,37],[58,37],[59,37],[60,37],[61,37],[62,37],[63,37],[64,37],[65,37],[66,37],[67,37],[52,38],[53,38],[54,38],[55,38],[56,38],[57,38],[58,38],[59,38],[60,38],[61,38],[62,38],[63,38],[64,38],[65,38],[66,38],[67,38],[52,39],[53,39],[54,39],[55,39],[56,39],[57,39],[58,39],[59,39],[60,39],[61,39],[62,39],[63,39],[64,39],[65,39],[66,39],[67,39],[52,40],[53,40],[54,40],[55,40],[56,40],[57,40],[58,40],[59,40],[60,40],[61,40],[62,40],[63,40],[64,40],[65,40],[66,40],[67,40],[52,41],[53,41],[54,41],[55,41],[56,41],[57,41],[58,41],[59,41],[60,41],[61,41],[62,41],[63,41],[64,41],[65,41],[66,41],[67,41],[52,42],[53,42],[54,42],[55,42],[56,42],[57,42],[58,42],[59,42],[60,42],[61,42],[62,42],[63,42],[64,42],[65,42],[66,42],[67,42],[52,43],[53,43],[54,43],[55,43],[56,43],[57,43],[58,43],[59,43],[60,43],[61,43],[62,43],[63,43],[64,43],[65,43],[66,43],[67,43],[52,44],[53,44],[54,44],[55,44],[56,44],[57,44],[58,44],[59,44],[60,44],[61,44],[62,44],[63,44],[64,44],[65,44],[66,44],[67,44],[54,45],[55,45],[56,45],[57,45],[58,45],[59,45],[60,45],[61,45],[62,45],[63,45],[64,45],[65,45],[66,45],[67,45],[54,46],[55,46],[56,46],[57,46],[58,46],[59,46],[60,46],[61,46],[62,46],[63,46],[64,46],[65,46],[66,46],[67,46]]},{"key":"warehouse","name":"仓库兼工具铺","shape":"临河背面封闭，北侧装卸口与东侧门绕行","rect":[39,44,48,53],"loot":"normal","label":[44,43],"footprint":[[39,44],[40,44],[41,44],[42,44],[43,44],[44,44],[45,44],[46,44],[47,44],[48,44],[39,45],[40,45],[41,45],[42,45],[43,45],[44,45],[45,45],[46,45],[47,45],[48,45],[39,46],[40,46],[41,46],[42,46],[43,46],[44,46],[45,46],[46,46],[47,46],[48,46],[39,47],[40,47],[41,47],[42,47],[43,47],[44,47],[45,47],[46,47],[47,47],[48,47],[39,48],[40,48],[41,48],[42,48],[43,48],[44,48],[45,48],[46,48],[47,48],[48,48],[39,49],[40,49],[41,49],[42,49],[43,49],[44,49],[45,49],[46,49],[47,49],[48,49],[39,50],[40,50],[41,50],[42,50],[43,50],[44,50],[45,50],[46,50],[47,50],[48,50],[39,51],[40,51],[41,51],[42,51],[43,51],[44,51],[45,51],[46,51],[47,51],[48,51],[39,52],[40,52],[41,52],[42,52],[43,52],[44,52],[45,52],[46,52],[47,52],[48,52],[39,53],[40,53],[41,53],[42,53],[43,53],[44,53],[45,53],[46,53],[47,53],[48,53]]}]};
/* END GENERATED LINHAI MAP */

/* BEGIN GENERATED MAP CATALOG */
const FENCED_MAP = {"id":"fenced-zone","title":"围栏区","width":64,"height":44,"tideEnabled":true,"source":"64×44 围栏区的已存在游戏数据，保留原街区、点位与潮汐高度","terrain":{"#":{"art":"wall","solid":true,"blocked":true,"opaque":true,"permanentWater":false},".":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"H":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"E":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"+":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"T":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"C":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"L":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"B":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"R":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"K":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"M":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},",":{"art":"low","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"S":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"~":{"art":"marsh","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"P":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false}},"terrainRows":["################################################################","#....................HH.........E.........H....................#","#....................HH...................H....................#","#..################..HH.########+########.H....##########......#","#..#......#.......#..HH.#...............#.H...#.....#....#.....#","#..#.T....#.C...T.#..HH.#.C......L....C.#.H..#...B..#...B.#....#","#..#......+.......+..HH.#...............#.H.#.......#......#...#","#..#......#.......#..HH.#....#######....#.H.#.......#.......#..#","#..#..........#####..HH.#...#.......#...#.H.#.......#.......#..#","#..#.........#.......HH.#...#.......#...#.H.+.......+.....R.#..#","#..+.........#.......HH.#...#.......#...#.H.#.###+###.......+..#","#..#.......L.#.......HH.#...+.......+...#.H.#..L....#.......#..#","#..#.C.......#.......HH.#.C.#.......#.L.#.H.#.......#......#...#","#..#.........#.......HH.#...#.......#...#.H..#....C.#.B...#....#","#..######+####.......HH.#####.......#####.H...#.....#....#.....#","#....................HH...................H....#####+####......#","#....................HH...................H....................#","#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#","#....................HH...................H....................#","#..#################.HH.....####+###......H...###+###..........#","#..#......#........#.HH.....#.K....#......H...#.R...#..........#","#..#.M....#......M.#.HH.....#......#......H...#.....#..........#","#..+......+........+.HH.####........#####.H...#......#######...#","#..#......#C.......#.HH.#...............#.H...#.....#......#...#","#E.#####......######.HH.#.T...........R.#.H...+.....#....R.#...#","#.......#....#.......HH.+........L......+.H...#...B.+......#...#","#.......#.M..#.......HH.#...............#.H...#.M...#......+...#","#.......#....#.......HH.####........#####.H...#######......#...#","#.......#..L.#.......HH.....#......#......H..........#.....#...#","#.......#....#.......HH.....#....B.#......H..........#.B..K#...#","#.......###+##.......HH.....####+###......H..........###+###...#","#....................HH...................H....................#","#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHE#","#....................HH.................,,H,,,,,,,,,,,,,,,,,,,,#","#....................HH.................,,H,#################,,#","#..#####S###.........HH.................,,H,#~K~~~~B~~~~~K~~#,,#","#..#.C.....#.........HH.................,,H,+~~~~~~~~~~~~~~~#,,#","#..#.......#.........HH.................,,H,#~~R~~~~~~~T~~~~+,,#","#..#........#######..HH.................,,H,##########~~~~~~#,,#","#..#.P..........L.S..HH.................,,H,,,,,,,,,,,#~~~~~#,,#","#..#.....M........#..HH.................,,H,,,,,,,,,,,#~~~K~#,,#","#..################..HH.................,,H,,,,,,,,,,,###+###,,#","#....................HH.................,,H,,,,,,,,,,,,,,,,,,,,#","################################################################"],"rows":["################################################################","#....................HH.........E.........H....................#","#....................HH...................H....................#","#..################..HH.########+########.H....##########......#","#..#......#.......#..HH.#...............#.H...#.....#....#.....#","#..#.T....#.C...T.#..HH.#.C......L....C.#.H..#...B..#...B.#....#","#..#......+.......+..HH.#...............#.H.#.......#......#...#","#..#......#.......#..HH.#....#######....#.H.#.......#.......#..#","#..#..........#####..HH.#...#.......#...#.H.#.......#.......#..#","#..#.........#.......HH.#...#.......#...#.H.+.......+.....R.#..#","#..+.........#.......HH.#...#.......#...#.H.#.###+###.......+..#","#..#.......L.#.......HH.#...+.......+...#.H.#..L....#.......#..#","#..#.C.......#.......HH.#.C.#.......#.L.#.H.#.......#......#...#","#..#.........#.......HH.#...#.......#...#.H..#....C.#.B...#....#","#..######+####.......HH.#####.......#####.H...#.....#....#.....#","#....................HH...................H....#####+####......#","#....................HH...................H....................#","#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#","#....................HH...................H....................#","#..#################.HH.....####+###......H...###+###..........#","#..#......#........#.HH.....#.K....#......H...#.R...#..........#","#..#.M....#......M.#.HH.....#......#......H...#.....#..........#","#..+......+........+.HH.####........#####.H...#......#######...#","#..#......#C.......#.HH.#...............#.H...#.....#......#...#","#E.#####......######.HH.#.T...........R.#.H...+.....#....R.#...#","#.......#....#.......HH.+........L......+.H...#...B.+......#...#","#.......#.M..#.......HH.#...............#.H...#.M...#......+...#","#.......#....#.......HH.####........#####.H...#######......#...#","#.......#..L.#.......HH.....#......#......H..........#.....#...#","#.......#....#.......HH.....#....B.#......H..........#.B..K#...#","#.......###+##.......HH.....####+###......H..........###+###...#","#....................HH...................H....................#","#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHE#","#....................HH.................,,H,,,,,,,,,,,,,,,,,,,,#","#....................HH.................,,H,#################,,#","#..#####S###.........HH.................,,H,#~K~~~~B~~~~~K~~#,,#","#..#.C.....#.........HH.................,,H,+~~~~~~~~~~~~~~~#,,#","#..#.......#.........HH.................,,H,#~~R~~~~~~~T~~~~+,,#","#..#........#######..HH.................,,H,##########~~~~~~#,,#","#..#.P..........L.S..HH.................,,H,,,,,,,,,,,#~~~~~#,,#","#..#.....M........#..HH.................,,H,,,,,,,,,,,#~~~K~#,,#","#..################..HH.................,,H,,,,,,,,,,,###+###,,#","#....................HH.................,,H,,,,,,,,,,,,,,,,,,,,#","################################################################"],"spawn":{"x":5,"y":39},"exits":[{"id":"A","name":"撤离点 A","x":32,"y":1},{"id":"B","name":"撤离点 B","x":1,"y":24},{"id":"C","name":"撤离点 C","x":62,"y":32}],"doors":[],"doorAxes":{},"tileHeights":{"#":2,".":2,",":1,"~":0,"H":3,"+":2,"S":2,"C":2,"L":2,"B":2,"T":2,"M":2,"R":2,"K":2,"P":2,"E":3},"props":[{"id":"desk","x":7,"y":5,"art":"desk"},{"id":"chair","x":7,"y":6,"art":"chair"},{"id":"shelf","x":16,"y":7,"art":"shelf"},{"id":"barrel","x":5,"y":9,"art":"barrel"},{"id":"shelf","x":5,"y":13,"art":"shelf"},{"id":"shelf","x":25,"y":9,"art":"shelf"},{"id":"shelf","x":39,"y":9,"art":"shelf"},{"id":"desk","x":31,"y":5,"art":"desk"},{"id":"chair","x":31,"y":6,"art":"chair"},{"id":"barrel","x":32,"y":10,"art":"barrel"},{"id":"barrel","x":34,"y":12,"art":"barrel"},{"id":"chair","x":30,"y":12,"art":"chair"},{"id":"desk","x":55,"y":7,"art":"desk"},{"id":"chair","x":55,"y":8,"art":"chair"},{"id":"shelf","x":46,"y":8,"art":"shelf"},{"id":"shelf","x":58,"y":11,"art":"shelf"},{"id":"desk","x":49,"y":12,"art":"desk"},{"id":"desk","x":7,"y":21,"art":"desk"},{"id":"chair","x":7,"y":22,"art":"chair"},{"id":"shelf","x":17,"y":23,"art":"shelf"},{"id":"chair","x":12,"y":28,"art":"chair"},{"id":"blood","x":9,"y":27,"ground":true,"art":"blood"},{"id":"barrel","x":30,"y":24,"art":"barrel"},{"id":"barrel","x":35,"y":24,"art":"barrel"},{"id":"shelf","x":38,"y":26,"art":"shelf"},{"id":"desk","x":33,"y":21,"art":"desk"},{"id":"chair","x":32,"y":26,"art":"chair"},{"id":"desk","x":49,"y":22,"art":"desk"},{"id":"chair","x":49,"y":23,"art":"chair"},{"id":"shelf","x":57,"y":27,"art":"shelf"},{"id":"barrel","x":55,"y":24,"art":"barrel"},{"id":"blood","x":55,"y":28,"ground":true,"art":"blood"},{"id":"desk","x":7,"y":37,"art":"desk"},{"id":"chair","x":7,"y":38,"art":"chair"},{"id":"shelf","x":14,"y":40,"art":"shelf"},{"id":"barrel","x":49,"y":36,"art":"barrel"},{"id":"shelf","x":59,"y":35,"art":"shelf"},{"id":"barrel","x":56,"y":40,"art":"barrel"},{"id":"blood","x":58,"y":38,"ground":true,"art":"blood"},{"id":"barrel","x":20,"y":16,"art":"barrel"},{"id":"barrel","x":43,"y":29,"art":"barrel"},{"id":"chair","x":16,"y":33,"art":"chair"}],"containers":[{"id":"f1","type":"T","x":5,"y":5},{"id":"f2","type":"C","x":12,"y":5},{"id":"f3","type":"T","x":16,"y":5},{"id":"f4","type":"C","x":26,"y":5},{"id":"f5","type":"L","x":33,"y":5},{"id":"f6","type":"C","x":38,"y":5},{"id":"f7","type":"B","x":49,"y":5},{"id":"f8","type":"B","x":56,"y":5},{"id":"f9","type":"R","x":58,"y":9},{"id":"f10","type":"L","x":11,"y":11},{"id":"f11","type":"L","x":47,"y":11},{"id":"f12","type":"C","x":5,"y":12},{"id":"f13","type":"C","x":26,"y":12},{"id":"f14","type":"L","x":38,"y":12},{"id":"f15","type":"C","x":50,"y":13},{"id":"f16","type":"B","x":54,"y":13},{"id":"f17","type":"K","x":30,"y":20},{"id":"f18","type":"R","x":48,"y":20},{"id":"f19","type":"M","x":5,"y":21},{"id":"f20","type":"M","x":17,"y":21},{"id":"f21","type":"C","x":11,"y":23},{"id":"f22","type":"T","x":26,"y":24},{"id":"f23","type":"R","x":38,"y":24},{"id":"f24","type":"R","x":57,"y":24},{"id":"f25","type":"L","x":33,"y":25},{"id":"f26","type":"B","x":50,"y":25},{"id":"f27","type":"M","x":10,"y":26},{"id":"f28","type":"M","x":48,"y":26},{"id":"f29","type":"L","x":11,"y":28},{"id":"f30","type":"B","x":33,"y":29},{"id":"f31","type":"B","x":55,"y":29},{"id":"f32","type":"K","x":58,"y":29},{"id":"f33","type":"K","x":46,"y":35},{"id":"f34","type":"B","x":51,"y":35},{"id":"f35","type":"K","x":57,"y":35},{"id":"f36","type":"C","x":5,"y":36},{"id":"f37","type":"R","x":47,"y":37},{"id":"f38","type":"T","x":55,"y":37},{"id":"f39","type":"L","x":16,"y":39},{"id":"f40","type":"M","x":9,"y":40},{"id":"f41","type":"K","x":58,"y":40}],"enemies":[{"t":"scav","x":7,"y":11,"patrolRadius":3,"type":"scav"},{"t":"scav","x":15,"y":6,"patrolRadius":3,"type":"scav"},{"t":"scav","x":26,"y":9,"patrolRadius":2,"type":"scav"},{"t":"scav","x":38,"y":10,"patrolRadius":2,"type":"scav"},{"t":"scav","x":34,"y":5,"patrolRadius":3,"type":"scav"},{"t":"guard","x":48,"y":7,"patrolRadius":2,"type":"guard"},{"t":"guard","x":56,"y":11,"patrolRadius":2,"type":"guard"},{"t":"echo","x":48,"y":13,"patrolRadius":2,"type":"echo"},{"t":"echo","x":58,"y":6,"patrolRadius":2,"type":"echo"},{"t":"scav","x":6,"y":23,"patrolRadius":3,"type":"scav"},{"t":"scav","x":11,"y":27,"patrolRadius":2,"type":"scav"},{"t":"guard","x":32,"y":23,"patrolRadius":2,"type":"guard"},{"t":"echo","x":26,"y":26,"patrolRadius":2,"type":"echo"},{"t":"echo","x":34,"y":28,"patrolRadius":2,"type":"echo"},{"t":"guard","x":49,"y":24,"patrolRadius":2,"type":"guard"},{"t":"guard","x":56,"y":26,"patrolRadius":2,"type":"guard"},{"t":"echo","x":50,"y":20,"patrolRadius":2,"type":"echo"},{"t":"echo","x":58,"y":23,"patrolRadius":2,"type":"echo"},{"t":"echo","x":47,"y":36,"patrolRadius":2,"type":"echo"},{"t":"echo","x":52,"y":37,"patrolRadius":2,"type":"echo"},{"t":"echo","x":58,"y":36,"patrolRadius":2,"type":"echo"},{"t":"echo","x":56,"y":39,"patrolRadius":2,"type":"echo"},{"t":"scav","x":21,"y":10,"patrolRadius":3,"type":"scav"},{"t":"echo","x":21,"y":27,"patrolRadius":3,"type":"echo"}],"districts":[{"key":"workshop","name":"修理铺","shape":"L形","polygon":[[3,3],[19,3],[19,9],[14,9],[14,15],[3,15]],"loot":"normal","label":[11,2]},{"key":"market","name":"旧集市","shape":"U形与开放庭院","polygon":[[24,3],[41,3],[41,15],[36,15],[36,8],[29,8],[29,15],[24,15]],"loot":"normal","label":[32,2]},{"key":"archive","name":"档案馆","shape":"切角大厅","polygon":[[48,3],[57,3],[61,7],[61,12],[57,16],[48,16],[44,12],[44,7]],"loot":"high","label":[52,2]},{"key":"clinic","name":"诊所","shape":"T形","polygon":[[3,19],[20,19],[20,25],[14,25],[14,31],[8,31],[8,25],[3,25]],"loot":"normal","label":[11,18]},{"key":"pump","name":"泵房","shape":"十字形","polygon":[[28,19],[36,19],[36,22],[41,22],[41,28],[36,28],[36,31],[28,31],[28,28],[24,28],[24,22],[28,22]],"loot":"high","label":[32,18]},{"key":"lab","name":"潮汐研究所","shape":"错位双翼","polygon":[[46,19],[53,19],[53,22],[60,22],[60,31],[53,31],[53,28],[46,28]],"loot":"high","label":[53,18]},{"key":"shelter","name":"避难楼","shape":"L形","polygon":[[3,35],[12,35],[12,38],[19,38],[19,42],[3,42]],"loot":"safe","label":[11,34]},{"key":"dock","name":"低洼船坞","shape":"折线仓台与淹水港池","polygon":[[44,34],[61,34],[61,42],[54,42],[54,39],[44,39]],"floor":"~","loot":"high","label":[52,33]}],"overlays":[]};
const MAP_CATALOG = [RAID_MAP, FENCED_MAP];
/* END GENERATED MAP CATALOG */

/* 运行地图来自已验收的 72×56 设计稿；容器/P/E 与地面视觉分层。 */
const MAP_ROWS = RAID_MAP.rows;
const MAP_DISTRICTS = RAID_MAP.districts;
const DOOR_AXES = RAID_MAP.doorAxes;
const TILE_H = { "#":3, ".":2, ",":1, "~":0, H:3, "+":2, S:2, P:2, E:3 };

/* 容器外观、搜刮档位与掉落偏好。实体始终占一个完整格子，开空后仍保留。 */
const CONTAINER_TYPES = {
  C: { kind: 'fast', art: 'crate_fast', name: '抽屉' },
  L: { kind: 'std', art: 'crate_std', name: '储物柜' },
  B: { kind: 'heavy', art: 'crate_heavy', name: '保险箱' },
  T: { kind: 'fast', art: 'crate_tool', name: '工具箱', cats: ['ind'] },
  M: { kind: 'std', art: 'crate_med', name: '医疗柜', cats: ['med'] },
  R: { kind: 'std', art: 'crate_elec', name: '电子设备柜', cats: ['elec', 'ind'] },
  K: { kind: 'heavy', art: 'crate_supply', name: '防水补给箱', cats: ['life', 'med', 'ind'] }
};
const BOX_KIND = Object.fromEntries(Object.entries(CONTAINER_TYPES).map(([ch, type]) => [ch, type.kind]));

/* ------------------------------------------------------------
   物品表
   cat  类别   r 稀有度(1-5)   w 重量(kg)   price 售价
   stack 堆叠上限(1=不可堆叠)  use 可使用（消耗品）
   ------------------------------------------------------------ */
/* short：背包格子只有 38px 宽，名字超过四个字的写一个简称（没写就退回全名） */
const ITEMS = [
  /* --- 生活用品 --- */
  { id:'life01', name:'搪瓷缸',       cat:'life', r:1, w:0.4, price:18,  desc:'磕掉了一块瓷，露出底下的铁。里面的水早就干了。' },
  { id:'life02', name:'旧报纸',       cat:'life', r:1, w:0.2, price:9,   desc:'日期停在事故前三天。头版是一场没人关心的听证会。' },
  { id:'life03', name:'老式台灯',     cat:'life', r:2, w:1.6, price:65,  desc:'灯罩烧黑了。插头还在墙上，墙已经不在了。' },
  { id:'life04', name:'铁皮饼干盒', short:'铁皮盒',   cat:'life', r:2, w:0.7, price:88,  desc:'里面是针线，不是饼干。主人显然更常用针线。' },
  { id:'life05', name:'未拆封的毛巾', short:'新毛巾', cat:'life', r:1, w:0.3, price:22,  desc:'二十年前的赠品，包装上还印着商场开业广告。' },

  /* --- 电子产品 --- */
  { id:'elec01', name:'收音机',       cat:'elec', r:3, w:0.9, price:240, desc:'调到中波能听见东西。不是电台，是回响。' },
  { id:'elec02', name:'随身听',       cat:'elec', r:4, w:0.35,price:520, desc:'磁带还在里面。按播放键能出声，所以它很值钱——也很有用。' },
  { id:'elec03', name:'计算器',       cat:'elec', r:2, w:0.2, price:72,  desc:'屏幕上留着最后一次运算的结果：0。' },
  { id:'elec04', name:'电路板',       cat:'elec', r:2, w:0.5, price:130, desc:'实验所的标准件，外面已经没人生产了。' },

  /* --- 工业器材 --- */
  { id:'ind01',  name:'铜管',         cat:'ind',  r:1, w:3.4, price:55,  desc:'很沉，很值钱，很占地方。典型的让人犹豫的东西。' },
  { id:'ind02',  name:'轴承',         cat:'ind',  r:2, w:2.2, price:110, desc:'转起来还是顺的。手指一推能转很久。' },
  { id:'ind03',  name:'压力表',       cat:'ind',  r:3, w:1.1, price:280, desc:'指针卡在最右端，说明它最后读到的东西很大。' },

  /* --- 医疗物资 --- */
  { id:'med01',  name:'绷带',         cat:'med',  r:1, w:0.2, price:30,  stack:5, use:true, desc:'还能用。在这种地方，这就够了。' },
  { id:'med02',  name:'注射器',       cat:'med',  r:2, w:0.15,price:140, desc:'未拆封。标签上的字被水泡糊了。' },
  { id:'med03',  name:'X 光片',       cat:'med',  r:3, w:0.1, price:190, desc:'对着光能看见一副肋骨。右下角有个马克笔写的日期。' },

  /* --- 古董文物 --- */
  { id:'antiq01',name:'座钟',         cat:'antiq',r:4, w:4.5, price:960, desc:'停了。指针停在潮水涨满的那一刻，纯属巧合。' },
  { id:'antiq02',name:'黄铜怀表',     cat:'antiq',r:3, w:0.2, price:410, desc:'表盖内侧刻着两个字母，磨得只剩下一个。' },
  { id:'antiq03',name:'磨损的硬币', short:'旧硬币',   cat:'antiq',r:1, w:0.02,price:12,  desc:'通缩时代的零钱。到处都有。' },
  { id:'antiq04',name:'错版硬币',     cat:'antiq',r:4, w:0.02,price:1240,desc:'当年压错了模具。据说存世不到百枚，但谁也没数过。' },
  { id:'antiq05',name:'门牌铜片',     cat:'antiq',r:2, w:0.3, price:96,  desc:'“临海路 7 号”。门牌还在，路早就没了。' },

  /* --- 艺术藏品 --- */
  { id:'art01',  name:'黑胶唱片',     cat:'art',  r:3, w:0.3, price:330, desc:'B 面第三首有明显的划痕，说明有人很爱听这一首。' },
  { id:'art02',  name:'小幅油画',     cat:'art',  r:4, w:1.2, price:1420,desc:'画的是一片没有海鸥的海。右下角有签名，认不出。' },
  { id:'art03',  name:'摄影底片',     cat:'art',  r:3, w:0.05,price:260, desc:'对着光看不出什么。需要显影，但你可能舍不得用掉它。' },

  /* --- 奢侈珍品 --- */
  { id:'lux01',  name:'机械腕表',     cat:'lux',  r:5, w:0.1, price:2100,desc:'还在走。这是这栋楼里唯一还在正常运转的东西。' },
  { id:'lux02',  name:'金条',         cat:'lux',  r:4, w:5.0, price:1680,desc:'一公斤。拿一块就够走一趟了，但你就走不动了。' },
  { id:'lux03',  name:'钢笔',         cat:'lux',  r:3, w:0.05,price:450, desc:'笔尖还是好的，墨囊空了。' },

  /* --- 自然标本 --- */
  { id:'spec01', name:'贝壳',         cat:'spec', r:1, w:0.1, price:16,  desc:'从海里来的，出现在三楼。水真的上来过。' },
  { id:'spec02', name:'矿石标本',     cat:'spec', r:2, w:0.6, price:120, desc:'标签写着产地和编号。编号被人划掉了。' },
  { id:'spec03', name:'干燥的植物', short:'干植物',   cat:'spec', r:1, w:0.05,price:24,  desc:'夹在一本书里，压得很平。叶子还是绿的。' },

  /* --- 异常遗物 --- */
  { id:'odd01',  name:'回响结晶',     cat:'odd',  r:4, w:0.6, price:0,   desc:'放在包里会自己出声。很轻，很吵。' },
  { id:'odd02',  name:'潮汐仪', short:'潮汐仪', cat:'odd',  r:5, w:0.8, price:0, desc:'一台精巧的黄铜仪器，三重刻度环围绕着一颗悬浮的微型海洋缓缓旋转。\n无论将它倒置、摇晃还是拆下底座，那颗海洋始终维持着自己的水平面。\n偶尔，海面上会出现一座灯塔。\n至今没人知道那座灯塔在哪里。' },
  { id:'odd03',  name:'停摆的怀表', short:'停摆表',   cat:'odd',  r:3, w:0.2, price:0,   desc:'停在涨潮那一秒。每天都停在那一秒。' },

  /* --- 消耗品（不进图鉴，也不进随机掉落池） --- */
  { id:'ammo',   name:'弹药',         cat:'ind',  r:1, w:0.012,price:1, stack:120, noCodex:true, noLoot:true, desc:'口径通用，散装。' }
];

/* 稀有度 → 掉落权重（越低越少见） */
const RARITY_WEIGHT = { 1: 100, 2: 55, 3: 20, 4: 6, 5: 1.2 };

/* 容器档位 → 抽出几件 */
const BOX_COUNT = {
  fast:  [1, 2],
  std:   [2, 3],
  heavy: [2, 4]
};

/* ------------------------------------------------------------
   敌人
   sight  视野格数（0=全盲）    fov 视野弧度
   hear   听觉倍率             dmg 单次伤害
   range  攻击距离(px)          cd  攻击间隔
   faction 阵营（同阵营不互打）
   ------------------------------------------------------------ */
const ENEMY_TYPES = {
  scav: {
    name: '拾荒者', short: '拾', color: '#b07a4a',
    hp: 34, speed: 54, sight: 11, fov: 1.7, hear: 1.0,
    dmg: 9, range: 235, cd: 0.85, faction: 'scav',
    arrow: true,            // 远程
    desc: '和你一样进来找东西的人，只是他们先到。'
  },
  echo: {
    name: '回响体', short: '响', color: '#8f5f7a',
    hp: 22, speed: 44, sight: 0, fov: 0, hear: 1.65,
    dmg: 14, range: 30, cd: 0.75, faction: 'echo',
    arrow: false,
    desc: '溺死者的声音聚成的形体。没有眼睛，只听得见。'
  },
  guard: {
    name: '潮汐守卫', short: '守', color: '#5f7f9b',
    hp: 72, speed: 36, sight: 15, fov: 2.0, hear: 0.6,
    dmg: 13, range: 300, cd: 1.05, faction: 'guard',
    arrow: true,
    desc: '事故当天留下的自动化安保，还在执行早已失效的指令。'
  }
};

/* 敌人按街区分散：普通街区 2–3 只，高物资区 3–4 只，出生楼无敌人。
   patrolRadius 为巡逻选点半径（格）；追击/调查不受此限制。 */
const SPAWNS = RAID_MAP.enemies.map(s => ({ ...s, t:s.type }));

/* 敌人可用的行为（加权选择，v0.4 建议的做法）
   首版只实现 patrol / hunt / hold，其它留作扩展 */
const BEHAVIOR_POOL = {
  scav:  [ {k:'patrol',w:1}, {k:'loot',w:1} ],
  echo:  [ {k:'patrol',w:1} ],
  guard: [ {k:'patrol',w:1}, {k:'hold',w:0.4} ]
};

/* ------------------------------------------------------------
   藏身处补给
   itemId 为 null 表示这种物资不进仓库（石子是捡的/买的散装货）
   携带时先从仓库扣，不够的按 price 用信用点补
   ------------------------------------------------------------ */
const SUPPLY = {
  ammo:    { key:'ammo',    itemId:'ammo',  name:'弹药', unit:'发', price:2,  max:120, step:10, start:60 },
  bandage: { key:'bandage', itemId:'med01', name:'绷带', unit:'个', price:25, max:5,   step:1,  start:3  },
  stone:   { key:'stone',   itemId:null,    name:'石子', unit:'颗', price:5,  max:5,   step:1,  start:3  }
};

/* 初始信用点（只在第一次玩、还没有存档时给） */
const START_CREDITS = 600;

/* 信用点低于这个数时，补给免费（防止连败之后彻底玩不下去） */
const BROKE_LINE = 200;

/* 仓库格数（仅显示，不做硬限制） */
const STASH_SLOTS = 600;     // 藏身处仓库容量；一页显示多少格由屏幕尺寸算

/* ------------------------------------------------------------
   场景资源清单（文件名去掉 .png）
   放在 assets/{group}/{id}.png，尺寸 32×32。缺图会退回成代码绘制的临时图形。
   ------------------------------------------------------------ */
/* 玩家动画：每张图为横向连续帧，通常 32×32，死亡为 48×48；朝左镜像。 */
const PLAYER_ANIMS = {
  idle:  { frames: 2, fps: 2, loop: true },
  walk:  { frames: 4, fps: 8, loop: true },
  shoot: { frames: 2, fps: 16, loop: false, size: 64 },
  hurt:  { frames: 2, fps: 10, loop: false },
  death: { frames: 4, fps: 6, loop: false, hold: 0.2, size: 48 },
  loot:  { frames: 3, fps: 6, loop: true },
  dodge: { frames: 3, fps: 18, loop: false }
};

const ART = {
  /* 角色是三向图，文件名 {id}_{dir}.png：
       _s 正面（朝画面下方，朝着玩家）
       _n 背面（朝画面上方，背对玩家）
       _e 侧面（朝右；朝左时由代码水平镜像，不需要单独画 _w）
     三张都不强制：缺哪张就退到别的方向，全缺则退回代码画的圆点。 */
  chars: ['player', 'scav', 'echo', 'guard'],
  charDirs: ['s', 'n', 'e'],

  /* 场景统一 75° 倾斜俯视，见 ART_STYLE.md。门有正向/侧向及开关状态。
     尸体按敌人种类分开：corpse_{scav|echo|guard}，缺图退回通用 corpse。 */
  props: ['crate_fast', 'crate_std', 'crate_heavy', 'crate_tool', 'crate_med', 'crate_elec', 'crate_supply',
          'door', 'door_open', 'sdoor', 'sdoor_open',
          'door_side', 'door_side_open', 'sdoor_side', 'sdoor_side_open',
          'exit',
          'corpse', 'corpse_scav', 'corpse_echo', 'corpse_guard',
          'desk', 'shelf', 'barrel', 'chair', 'blood',
          'canal_bank_w', 'canal_bank_e', 'bridge_stone_rail_n', 'bridge_stone_rail_s',
          'bridge_wood_rail_n', 'bridge_wood_rail_s', 'shop_window_ns',
          'wall_breach_n', 'wall_breach_s', 'rubble_decal'],
  tiles: ['floor', 'low', 'marsh', 'wall', 'street_stone', 'courtyard_paving', 'canal_water',
          'quay_top', 'bridge_stone_deck', 'bridge_wood_deck', 'canal_steps_w', 'canal_steps_e'],

  /* 装备图标：48×48，见 assets/gear/README.md。
     缺图会退回文字，不影响游戏。 */
  gear: ['rifle', 'shotgun', 'smg', 'pistol',
         'helmet1', 'helmet2', 'helmet3', 'helmet4', 'helmet5', 'helmet6',
         'body1', 'body2', 'body3', 'body4', 'body5', 'body6',
         'bag']
};

/* 场景摆设：默认实体占一格；仅 ground:true 的地面贴花可穿过。 */
const DECOR = RAID_MAP.props;

/* ------------------------------------------------------------
   武器
   两个主武器槽 + 一个副武器位。slot 决定它能放进哪个位置。
   数值直接驱动 Player.tryShoot / 换弹 / HUD。
   ------------------------------------------------------------ */
const WEAPONS = {
  rifle: {
    id: 'rifle', name: '制式步枪', short: '步枪', slot: 'primary', w: 3.2,
    dmgMin: 15, dmgMax: 22, rpm: 420, mag: 30, speed: 620, range: 640,
    spreadBase: 0.040, spreadMax: 0.260, recoilPerShot: 0.075, pellets: 1,
    value: 160,
    desc: '口径通用，射速中等。什么都能打，什么都不精。'
  },
  shotgun: {
    id: 'shotgun', name: '短管霰弹枪', short: '霰弹', slot: 'primary', w: 3.6,
    dmgMin: 7, dmgMax: 10, rpm: 80, mag: 6, speed: 560, range: 300,
    spreadBase: 0.105, spreadMax: 0.30, recoilPerShot: 0.22, pellets: 6,
    value: 180,
    desc: '六颗弹丸，近距离两枪一个。远了就是放烟花。'
  },
  smg: {
    id: 'smg', name: '冲锋枪', short: '冲锋', slot: 'primary', w: 2.4,
    dmgMin: 9, dmgMax: 13, rpm: 780, mag: 25, speed: 600, range: 420,
    spreadBase: 0.050, spreadMax: 0.280, recoilPerShot: 0.055, pellets: 1,
    value: 140,
    desc: '快、轻、飘。适合边走边打，但不适合站定对枪。'
  },
  pistol: {
    id: 'pistol', name: '手枪', short: '手枪', slot: 'secondary', w: 1.1,
    dmgMin: 14, dmgMax: 19, rpm: 300, mag: 12, speed: 600, range: 460,
    spreadBase: 0.045, spreadMax: 0.220, recoilPerShot: 0.100, pellets: 1,
    value: 90,
    desc: '主武器空仓时的最后一句。'
  }
};

/* 默认配装：两个主武器位 + 一个副武器位 */
const DEFAULT_WEAPONS = ['rifle', 'shotgun', 'pistol'];

/* ------------------------------------------------------------
   护甲：六级头盔 / 六级身体护甲
   dr = 基础减伤率，dur = 最大耐久，move = 移速倍率（只有身体护甲有）
   价格 = 基础价 × [1, 1.8, 3, 5, 9, 16]
   ------------------------------------------------------------ */
const HELMETS = [
  { lv: 1, name: '布面工帽',   short: '工帽',   dr: 0.08, dur: 20,  w: 0.5, move: 1,    price: 120  },
  { lv: 2, name: '工程安全帽', short: '安全帽', dr: 0.16, dur: 30,  w: 0.8, move: 1,    price: 216  },
  { lv: 3, name: '防撞头盔',   short: '防撞盔', dr: 0.24, dur: 45,  w: 1.2, move: 1,    price: 360  },
  { lv: 4, name: '防弹头盔',   short: '防弹盔', dr: 0.32, dur: 65,  w: 1.8, move: 1,    price: 600  },
  { lv: 5, name: '重型防弹盔', short: '重盔',   dr: 0.40, dur: 85,  w: 2.5, move: 1,    price: 1080 },
  { lv: 6, name: '攻坚头盔',   short: '攻坚盔', dr: 0.50, dur: 110, w: 3.5, move: 1,    price: 1920 }
];

const BODIES = [
  { lv: 1, name: '帆布护胸',   short: '护胸',   dr: 0.10, dur: 40,  w: 1.5, move: 1.00, price: 200  },
  { lv: 2, name: '防刺背心',   short: '防刺',   dr: 0.20, dur: 60,  w: 2.5, move: 0.98, price: 360  },
  { lv: 3, name: '轻型战术背心', short: '轻甲', dr: 0.30, dur: 85,  w: 4.0, move: 0.96, price: 600  },
  { lv: 4, name: '战术防弹衣', short: '战术甲', dr: 0.40, dur: 115, w: 6.0, move: 0.94, price: 1000 },
  { lv: 5, name: '重型防弹衣', short: '重甲',   dr: 0.50, dur: 150, w: 9.0, move: 0.91, price: 1800 },
  { lv: 6, name: '攻坚装甲',   short: '攻坚甲', dr: 0.60, dur: 190, w: 13.0, move: 0.88, price: 3200 }
];

/* 护甲表的查表工具 */
const GEAR = {
  helmet: { list: HELMETS, label: '头盔', short: '盔' },
  body:   { list: BODIES,  label: '护甲', short: '甲' },

  /* 按类型和等级取模板 */
  def(type, lv) {
    const g = this[type];
    if (!g) return null;
    return g.list.find(x => x.lv === lv) || null;
  },

  /* 造一个实例：装备要记住自己的耐久，不能和模板共用 */
  make(type, lv, dur) {
    const d = this.def(type, lv);
    if (!d) return null;
    return {
      type, lv: d.lv, name: d.name, short: d.short,
      dr: d.dr, max: d.dur, dur: (dur == null ? d.dur : U.clamp(dur, 0, d.dur)),
      w: d.w, move: d.move, price: d.price
    };
  },

  /* 当前有效减伤：完好 100%，破损 50%，失效 0 */
  reduction(g) {
    if (!g || g.dur <= 0) return 0;
    return (g.dur / g.max >= 0.5) ? g.dr : g.dr * 0.5;
  },

  /* 耐久状态 */
  state(g) {
    if (!g) return 'none';
    if (g.dur <= 0) return 'broken';
    return (g.dur / g.max >= 0.5) ? 'ok' : 'worn';
  }
};

/* ------------------------------------------------------------
   装备 → 背包条目
   装备不能堆叠（同型号的耐久也不一样），但背包 / 仓库 / 结算那一整套
   都只认"物品"字段，所以把装备包成一个伪物品。
     equip.kind = 'armor' | 'gun'   穿回去时用这个判断
     icon       装备图标名（assets/gear/）
     sell       能卖多少钱 —— 不超过买价，并按剩余耐久打折
   ------------------------------------------------------------ */
function gearRarity(lv) {
  return [1, 1, 2, 2, 3, 4, 5][U.clamp(lv, 0, 6)] || 1;
}

const EQUIP = {
  /* 回收价：买价的一半为上限，再乘剩余耐久比例；最少 1 块 */
  sellPrice(price, dur, max) {
    const ratio = (max > 0) ? U.clamp(dur / max, 0, 1) : 1;
    return Math.max(1, Math.min(price, Math.floor(price * 0.5 * ratio)));
  },

  /* 头盔 / 护甲实例 → 伪物品 */
  armor(g) {
    if (!g) return null;
    return {
      id: 'g_' + g.type + g.lv,
      name: g.name, short: g.short,
      cat: 'gear', r: gearRarity(g.lv),
      w: g.w, price: g.price,
      sell: this.sellPrice(g.price, g.dur, g.max),
      stack: 1,
      icon: g.type + g.lv,
      equip: { kind: 'armor', gear: Object.assign({}, g) }
    };
  },

  /* 枪（id + 余弹）→ 伪物品。枪没有耐久，回收价固定半价 */
  gun(id, mag) {
    const w = WEAPONS[id];
    if (!w) return null;
    const m = Math.max(0, mag || 0);
    return {
      id: 'g_' + id,
      name: w.name, short: w.short,
      cat: 'gear', r: w.value >= 170 ? 4 : (w.value >= 140 ? 3 : 2),
      w: w.w, price: w.value,
      sell: this.sellPrice(w.value, 1, 1),
      stack: 1,
      icon: id,
      equip: { kind: 'gun', gun: id, mag: m },
      note: m > 0 ? String(m) : ''
    };
  }
};
