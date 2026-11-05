/* ============================================================
   潮汐线 · 数据层
   地图 / 物品 / 敌人。往这里加东西不需要改逻辑代码。
   ============================================================ */

/* BEGIN GENERATED LINHAI MAP */
// 由 tools/build-linhai-map.js 生成，请修改设计稿再重建。
const RAID_MAP = {"id":"linhai-old-quarter","title":"临海路旧街区","width":72,"height":56,"source":"design/maps/linhai-old-quarter/layout.json","sourceSha256":"ac9c0d1e1c6d5d1c3ec02c5d3f4c2a5785555a72a15bc6a114ee5fe9e5e5115b","tideEnabled":false,"terrain":{"1":{"art":"ground_concrete_plain_01","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"2":{"art":"ground_concrete_plain_02","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"3":{"art":"ground_soil_compact_01","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"4":{"art":"ground_soil_compact_02","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"#":{"art":"wall","solid":true,"blocked":true,"opaque":true,"permanentWater":false},"X":{"art":"wall","solid":true,"blocked":true,"opaque":true,"permanentWater":false},".":{"art":"low","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"r":{"art":"street_stone","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"q":{"art":"courtyard_paving","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"i":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"~":{"art":"canal_water","solid":false,"blocked":true,"opaque":false,"permanentWater":true},"k":{"art":"quay_top","solid":false,"blocked":true,"opaque":false,"permanentWater":false},"=":{"art":"bridge_stone_deck","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"-":{"art":"bridge_wood_deck","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"+":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"/":{"art":"floor","solid":false,"blocked":false,"opaque":false,"permanentWater":false},"w":{"art":"floor","solid":false,"blocked":true,"opaque":false,"permanentWater":false},"s":{"art":"canal_steps_w","solid":false,"blocked":false,"opaque":false,"permanentWater":false}},"terrainRows":["#############################k~~~~~~k###################################","#............................k~~~~~~k..................................#","#............................k~~~~~~k..................................#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~krrrrrrrXXXXXXXXXXX###rrrrrrrrrrr..#","#..rr###################rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#iiiii#iiiii#iiiii#rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#iiiii#iiiii#iiiii#rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#iiiii#iiiii#iiiii#rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#iiiii#iiiii#iiiii#rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#iiiii#iiiii#iiiii#rrrrrk~~~~~~krrrrrrrX#####i###########//#####..#","#..rr#iiiii#iiiii#iiiii#rrrrrk~~~~~~krrrrrrr#iiiiiiiiiiii#iiiiiiiiii#..#","#..rr###+#####+#####/###rrrrr========rrrrrrr#iiiiiiiiiiii#iiiiiiiiii#..#","#..rr#22222222222222222#rrrrr========rrrrrrr.iiiiiiiiiiiiiiiiiiiiiii#..#","#..rr#22222222222222222#rrrrr========rrrrrrr.iiiiiiiiiiiiiiiiiiiiiii#..#","#..rr###+######22#######rrrrr========rrrrrrr#iiiiiiiiiiii#iiiiiiiiii#..#","#..rr#iii#iiiiiiiiiiii#rrrrrrk~~~~~~krrrrrrr#iiiiiiiiiiii#iiiiiiiiii#..#","#..rr#iii+iiiiiiiiiiii#rrrrrrk~~~~~~krrrrrr.###############ii########..#","#..rr#iii#iiiiiiiiiiii+rrrrrrk~~~~~~krrrrrr.w2111#11111#iiiii#111111#..#","#..rr#####iiiiiiiiiiii#rrrrrrk~~~~~~krrrrrr.w2111111111#iiiii#111111#..#","#.rrr#333#######+######rrrrrrk~~~~~~krrrrrr.#2111111111#iiiii#111111#..#","#.rrr#333+222222222222#rrrrrrk~~~~~~krrrrrr.#2111#11111#iiiii#111111#..#","#rrrr#333#222222222222#rrrrrrk~~~~~~krrrrrr.#2111#######iiiii#####+##..#","#rrrr#########+########rrrrrrk~~~~~~srrrrrr.w2111#11111#iiiii#111111#..#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~srrrrrr.w2111+11111+iiiii+111111#..#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrk~~~~~~srrrrrr.#2222#11111#iiiii#111111#..#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrk~~~~~~krrrrrr.#########################..#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#rrrrq.qqqqqqqqq.qqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrk~~~~~~krrrrrrrrrrrrrrr#################rr#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr########+#########rrrrrrk~~~~~~krrrrrrqqqqqqqq.#444444444444444#rr#","#rrrr#2222222222222222#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr#2222222222222222#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr#2222222222222222#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr########22#####22#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr#333333#22#222#22#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr#333333#22#222#22#rrrrrrk~~~~~~krrrrrr.........+44444#4444#4444#rr#","#rrrr#333333#22#222#22#rrrrrr--------rrrrrr.........#44444#4444#4444#rr#","#rrrr#333333+22#222#22#rrrrrr--------rrrrrr.........#44444#4444#4444#rr#","#rrrr#333333#22+222#22+rrrrrr--------rrrrrr.........#44444#4444#4444#rr#","#rrrr#333333#22#222#22#rrrrrrk~~~~~~krrrrrr......rrr#44444###########rr#","#rrrr#333333#22#222#22#rrrrrrk~~~~~~kkk####++####rrr#444444444444444#rr#","#rrrr#333333#22#222#22#rrrrrrk~~~~~~kkk#iiiiiiii#rrr#444444444444444#rr#","#rrrr##################rrrrrrk~~~~~~kkk#iiiiiiii#rrr#444444444444444#rr#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrr##############+##rr#","#rrqqqqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#rrqqqqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrrrrrrrrrrrrr#","#rrqqqqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrrrrrrrrrrrrr#","#rrqqqqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#rrq.qqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrrrrrrrrrrrrrrrrrrrrr#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk##########rrrrrrrrrrrrrrrrrrrrrr#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~k..................................#","#############################k~~~~~~k###################################"],"rows":["#############################k~~~~~~k###################################","#......................Z.Ub..k~~~~~~k..................................#","#..........................Zbk~~~~~~k..................................#","#..rrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..#","#..rrrrPrrrrrrrrrrrrrrrrrrrrrk~~~~~~krrrrrrrXXXXXXXXXXX###rrrrrrrrrrr..#","#..rr###################rrrrrk~~~~~~krrrrrrrX111B111B11Q1#qqqqqqqqqrr..#","#..rr#iiiNi#iiiNi#iiiNi#rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#iiiii#iiiii#iiiiJ#rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#Biiii#iiiii#OiiiB#rrrrrk~~~~~~krrrrrrrX111111111111#qqqqqqqqqrr..#","#..rr#iiiii#iiiii#iiiiQ#rrrrrk~~~~~~krrrrrrrX1111W1111R11#qqqTqqqqqrr..#","#..rr#iiiii#iiiii#iiiii#rrrrrk~~~~~~krrrrrrrX#####i###########//#####..#","#..rr#iiiii#iiiiA#iiiii#rrrrrk~~~~~~krrrrrrr#iiiiiiiiiQUi#iiMiiiiiii#..#","#..rr###+#####+#####/###rrrrr========rrrrrrr#Jiiiiiiiiiii#iiiiiiiiiT#..#","#..rr#222222222222b2222#rrrrr========rrrrrrr.iiiiiiiiiiiiiiiiiiiiiii#..#","#..rr#22222222222222222#rrrrr========rrrrrrr.iiiiiiiiiiiiiiiiiiiiiii#..#","#..rr###+######22#######rrrrr========rrrrrrr#iiiiiiiiiiii#iiiiiiiiiG#..#","#..rr#iTi#iiiWiiiiiCim#rrrrrrk~~~~~~krrrrrrr#WiiiiiiiieFD#iiiiiiiiii#..#","#..rr#iii+iiiiiiiiiiii#rrrrrrk~~~~~~krrrrrr.###############ii########..#","#..rr#iii#iiiiiiiiiiii+rrrrrrk~~~~~~krrrrrr.w2B11#1RVVG#iiiii#O1111K#..#","#..rr#####DiiiiLiiiTii#rrrrrrk~~~~~~krrrrrr.w2111111111#iiiii#111111#..#","#.rrr#JeH#######+######Zrrrrrk~~~~~~krrrrrr.#2111111111#iiiii#111111#..#","#.rrr#333+2222222D2222#rrrrrrk~~~~~~krrrrrr.#2111#11111#iiiii#W1111B#..#","#rrrr#333#b222222C2222#rrrrrrk~~~~~~krrrrrr.#2111#######iiiii#####+##..#","#rrrr#########+########rrrrrrk~~~~~~srrrrrr.w2111#11111#iiiii#111111#..#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~srrrrrr.w2111+11111+iiiii+111111#..#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrk~~~~~~srrrrrr.#2222#11111#iiiii#bL1111#..#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrk~~~~~~krrrrrr.#########################..#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#","#rrrrq.qqqqqqqqq.qqqqqqrrrrrrs~~~~~~krrrrrrrrrrrrrrrrrrrrrrrrrrrrUrrrrr#","#rrrrqqqqDqqqqqqqqqqqqqrrrrrrk~~~~~~krrrrrrrrrrrrrrr#################rr#","#rrrrqqqqqqqqqqqqqqqqqqrrrrrrk~~~~~~krrrrrrqqqqqqqq.#444L4#444K#CBR4#rr#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#444b#rr#","#rrrr########+#########rrrrrrk~~~~~~krrrrrrqqqqqqqq.#444444444444444#rr#","#rrrr#2C222W22222FH22T#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr#2222222222222222#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#F44G#4444#rr#","#rrrr#R222222222222222#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr########22#####22#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#V44b#rr#","#rrrr#Y33333#22#V22#22#rrrrrrk~~~~~~krrrrrrqqqqqqqq.#44444#4444#4444#rr#","#rrrr#33333H#22#222#22#rrrrrrk~~~~~~krrrrrr.........+44444#4444#4444#rr#","#rrrr#333333#22#222#22#rrrrrr--------rrrrrr.........#44444#4444#4444#rr#","#rrFr#333333+22#222#22#rrrrrr--------rrrrrr.........#F444T#G444#4444#rr#","#rrrr#333333#22+222#22+rrrrrr--------rrrrrr.........#44444#444R#OBTb#rr#","#rrrr#M33333#22#222#22#rrrrrrk~~~~~~krrrrrr......rrr#44444###########rr#","#rrrr#M33333#22#22D#22#rrrrrrk~~~~~~kkk####++####rrr#444444444444e44#rr#","#rrrr#3Q333b#2H#22J#D2#rrrrrrk~~~~~~kkk#Tiiiiiii#rrr#444444444444444#rr#","#rrrr##################rrrrrrk~~~~~~kkk#iiiiiiii#rrr#444L44444444444#rr#","#rrbrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii#rrr##############+##rr#","#rrqqqqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#eiiiiiTi#brrrrrrrrrrrrrrrrrrrrr#","#rrTqqqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrrrrrrrrrrrrr#","#rrqqqqqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#iiiiiiii+rrrrrrrrrrrrrrrrrrrrrr#","#rrqqqEqqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#Qiiiiiii#rrrrrrrrrrrrrrrrrrErrr#","#rrq.qqWqqqqqqqqrrrrrrrrrrrrrk~~~~~~kkk#KiiiQiQA#rrrrrrrrrrrrrrrrrrrrrr#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~kkk##########rrrrrrrrrrrrrrrrrrrrrr#","#rrrrrrrrrrrrrrrrrrrrrrrrrrrrk~~~~~~k..................................#","#############################k~~~~~~k###################################"],"spawn":{"id":"spawn","name":"西北入口","x":7,"y":4},"exits":[{"id":"A","name":"西岸撤离 A","x":6,"y":51,"risk":"低"},{"id":"B","name":"东岸撤离 B","x":67,"y":51,"risk":"较高，接近银行外围"}],"doors":[{"id":"apartment.bed1","cells":[[8,12]],"axis":"horizontal","reinforced":false},{"id":"apartment.kitchen-n","cells":[[8,15]],"axis":"horizontal","reinforced":false},{"id":"apartment.kitchen-e","cells":[[9,17]],"axis":"vertical","reinforced":false},{"id":"apartment.store","cells":[[9,21]],"axis":"vertical","reinforced":false},{"id":"warehouse.front","cells":[[43,44],[44,44]],"axis":"horizontal","reinforced":false},{"id":"warehouse.side","cells":[[48,49],[48,50]],"axis":"vertical","reinforced":false},{"id":"outdoor.door1","cells":[[55,24]],"axis":"vertical","reinforced":false},{"id":"outdoor.door2","cells":[[14,23]],"axis":"horizontal","reinforced":false},{"id":"apartment.door1","cells":[[16,20]],"axis":"horizontal","reinforced":false},{"id":"apartment.door2","cells":[[14,12]],"axis":"horizontal","reinforced":false},{"id":"outdoor.door3","cells":[[22,18]],"axis":"vertical","reinforced":false},{"id":"clinic.door1","cells":[[13,33]],"axis":"horizontal","reinforced":false},{"id":"outdoor.door4","cells":[[22,42]],"axis":"vertical","reinforced":false},{"id":"outdoor.door5","cells":[[15,42]],"axis":"vertical","reinforced":false},{"id":"clinic.door2","cells":[[12,41]],"axis":"vertical","reinforced":false},{"id":"bank.door1","cells":[[49,24]],"axis":"vertical","reinforced":false},{"id":"outdoor.door6","cells":[[61,24]],"axis":"vertical","reinforced":false},{"id":"outdoor.door7","cells":[[66,22]],"axis":"horizontal","reinforced":false},{"id":"clockshop.door3","cells":[[58,33]],"axis":"vertical","reinforced":false},{"id":"clockshop.door4","cells":[[63,33]],"axis":"vertical","reinforced":false},{"id":"clockshop.door1","cells":[[52,39]],"axis":"vertical","reinforced":false},{"id":"outdoor.door8","cells":[[66,47]],"axis":"horizontal","reinforced":false}],"doorAxes":{"8,12":"horizontal","8,15":"horizontal","9,17":"vertical","9,21":"vertical","43,44":"horizontal","44,44":"horizontal","48,49":"vertical","48,50":"vertical","55,24":"vertical","14,23":"horizontal","16,20":"horizontal","14,12":"horizontal","22,18":"vertical","13,33":"horizontal","22,42":"vertical","15,42":"vertical","12,41":"vertical","49,24":"vertical","61,24":"vertical","66,22":"horizontal","58,33":"vertical","63,33":"vertical","52,39":"vertical","66,47":"horizontal"},"props":[{"id":"p51","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":44,"y":32,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p52","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":46,"y":31,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p53","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":52,"y":14,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p54","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":59,"y":5,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p55","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":66,"y":9,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p56","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":65,"y":9,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p57","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":66,"y":5,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p58","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":13,"y":27,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p59","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":20,"y":28,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p60","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":13,"y":31,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p61","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":22,"y":25,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p62","region":"apartment","type":"decal_surface_crack_01","name":"细裂纹","x":16,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p63","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":58,"y":24,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p64","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":60,"y":18,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p65","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":63,"y":14,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p66","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":52,"y":11,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"facing":"side","art":"decal_surface_crack_01","provisional":false},{"id":"p67","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":46,"y":16,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p68","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":38,"y":30,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p69","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":43,"y":16,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p70","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":42,"y":26,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p71","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":43,"y":29,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p72","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":41,"y":35,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p73","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":41,"y":41,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p74","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":39,"y":43,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p75","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":23,"y":46,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p76","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":26,"y":30,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p77","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":18,"y":35,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p78","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":20,"y":42,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p79","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":23,"y":36,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p80","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":24,"y":40,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p81","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":27,"y":20,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p82","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":24,"y":9,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p83","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":24,"y":6,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p84","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":20,"y":19,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p85","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":24,"y":11,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p86","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":24,"y":22,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p87","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":39,"y":9,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p88","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":42,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p89","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":38,"y":17,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p90","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":69,"y":30,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p91","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":68,"y":29,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p92","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":70,"y":45,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p93","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":69,"y":44,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p94","region":"clockshop","type":"decal_surface_crack_01","name":"细裂纹","x":65,"y":41,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p95","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":17,"y":50,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p96","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":22,"y":52,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p97","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":23,"y":52,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p98","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":28,"y":49,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p99","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":16,"y":53,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p100","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":3,"y":43,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p101","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":4,"y":34,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p102","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":3,"y":26,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p103","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":4,"y":25,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p104","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":3,"y":14,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p105","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":55,"y":50,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p106","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":51,"y":52,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p107","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":51,"y":48,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p108","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":63,"y":53,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p109","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":64,"y":49,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p128","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":11,"y":17,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p129","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":7,"y":17,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p130","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":7,"y":18,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p131","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":8,"y":21,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p132","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":7,"y":22,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p133","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":13,"y":21,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p134","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":16,"y":22,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p148","region":"apartment","type":"decal_surface_crack_01","name":"细裂纹","x":18,"y":14,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p149","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":20,"y":12,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p150","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":19,"y":11,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p152","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":19,"y":8,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p154","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":21,"y":7,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p156","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":21,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p159","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":19,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p161","region":"outdoors","type":"decal_surface_crack_01","name":"细裂纹","x":21,"y":10,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_crack_01","provisional":false},{"id":"p162","region":"apartment","type":"decal_surface_damp_01","name":"潮湿痕迹","x":18,"y":14,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p163","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":21,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p165","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":19,"y":10,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p168","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":21,"y":7,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p169","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":21,"y":9,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p170","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":22,"y":11,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p171","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":16,"y":10,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p172","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":19,"y":9,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p173","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":18,"y":7,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p175","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":19,"y":7,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p176","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":21,"y":8,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p177","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":19,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p178","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":19,"y":14,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p180","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":21,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p181","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":20,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p182","region":"outdoors","type":"decal_surface_damp_01","name":"潮湿痕迹","x":21,"y":13,"solid":false,"ground":true,"opaque":false,"footprint":[1,1],"collisionCells":[],"art":"decal_surface_damp_01","provisional":false},{"id":"p01","region":"outdoors","type":"bed","name":"床","x":8,"y":6,"solid":true,"footprint":[1,2],"art":"bed_home","provisional":false,"ground":false},{"id":"p02","region":"outdoors","type":"bed","name":"床","x":14,"y":6,"solid":true,"footprint":[1,2],"art":"bed_home","provisional":false,"ground":false},{"id":"p04","region":"apartment","type":"desk","name":"床头柜","x":12,"y":11,"solid":true,"footprint":[1,1],"facing":"side","art":"desk","provisional":false,"ground":false},{"id":"p05","region":"apartment","type":"stove","name":"灶台","x":6,"y":17,"solid":true,"footprint":[1,1],"facing":"side","art":"stove_home","provisional":false,"ground":false},{"id":"p06","region":"apartment","type":"sofa","name":"沙发","x":11,"y":16,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p08","region":"clinic","type":"chair","name":"候诊椅","x":6,"y":34,"solid":true,"footprint":[1,1],"art":"chair","provisional":false,"ground":false},{"id":"p09","region":"clinic","type":"chair","name":"候诊椅","x":13,"y":43,"solid":true,"footprint":[1,1],"art":"chair","provisional":false,"ground":false},{"id":"p10","region":"clinic","type":"bed","name":"诊疗床","x":6,"y":39,"solid":true,"footprint":[2,1],"facing":"side","art":"bed_clinic","provisional":false,"ground":false},{"id":"p11","region":"outdoors","type":"desk","name":"诊疗台","x":16,"y":40,"solid":true,"footprint":[2,1],"art":"desk","provisional":false,"ground":false},{"id":"p12","region":"bank","type":"display","name":"橱窗展柜","x":45,"y":21,"solid":true,"facing":"side","footprint":[1,2],"art":"display_clock","provisional":false,"ground":false},{"id":"p13","region":"bank","type":"display","name":"橱窗展柜","x":45,"y":19,"solid":true,"facing":"side","footprint":[1,2],"art":"display_clock","provisional":false,"ground":false},{"id":"p14","region":"outdoors","type":"counter","name":"营业柜台","x":53,"y":15,"solid":true,"footprint":[1,2],"facing":"side","art":"counter_shop","provisional":false,"ground":false},{"id":"p15","region":"outdoors","type":"counter","name":"营业柜台","x":53,"y":11,"solid":true,"footprint":[1,2],"facing":"side","art":"counter_shop","provisional":false,"ground":false},{"id":"p17","region":"outdoors","type":"bench","name":"前厅长凳","x":45,"y":32,"solid":true,"footprint":[2,1],"art":"bench_wood","provisional":false,"ground":false},{"id":"p18","region":"outdoors","type":"counter","name":"银行柜台","x":53,"y":7,"solid":true,"footprint":[2,1],"art":"counter_bank","provisional":false,"ground":false},{"id":"p19","region":"outdoors","type":"counter","name":"银行柜台","x":46,"y":5,"solid":true,"footprint":[2,1],"art":"counter_bank","provisional":false,"ground":false},{"id":"p20","region":"outdoors","type":"counter","name":"银行柜台","x":46,"y":7,"solid":true,"footprint":[2,1],"art":"counter_bank","provisional":false,"ground":false},{"id":"p21","region":"warehouse","type":"desk","name":"办公桌","x":40,"y":50,"solid":true,"footprint":[2,1],"art":"desk","provisional":false,"ground":false},{"id":"p22","region":"clockshop","type":"desk","name":"安保监控台","x":59,"y":40,"solid":true,"footprint":[1,1],"facing":"side","art":"console_security","provisional":false,"ground":false},{"id":"p23","region":"warehouse","type":"shelf","name":"后勤架","x":42,"y":52,"solid":true,"footprint":[2,1],"art":"shelf","provisional":false,"ground":false},{"id":"p24","region":"clockshop","type":"shelf","name":"后勤架","x":53,"y":44,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p25","region":"warehouse","type":"shelf","name":"工具货架","x":40,"y":46,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p26","region":"warehouse","type":"shelf","name":"工具货架","x":42,"y":46,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p27","region":"warehouse","type":"shelf","name":"工具货架","x":44,"y":46,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p28","region":"warehouse","type":"shelf","name":"工具货架","x":46,"y":46,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p29","region":"outdoors","type":"tree","name":"院落树木","x":5,"y":27,"solid":true,"footprint":[3,3],"collisionCells":[[1,2]],"canopy":{"fadeRows":2,"opacity":0.3},"art":"tree_courtyard_canopy","provisional":false,"ground":false},{"id":"p30","region":"outdoors","type":"tree","name":"院落树木","x":3,"y":50,"solid":true,"footprint":[3,3],"collisionCells":[[1,2]],"canopy":{"fadeRows":2,"opacity":0.3},"art":"tree_courtyard_canopy","provisional":false,"ground":false},{"id":"p31","region":"outdoors","type":"tree","name":"院落树木","x":15,"y":27,"solid":true,"footprint":[3,3],"collisionCells":[[1,2]],"canopy":{"fadeRows":2,"opacity":0.3},"art":"tree_courtyard_canopy","provisional":false,"ground":false},{"id":"p33","region":"outdoors","type":"bench","name":"庭院长椅","x":7,"y":26,"solid":true,"footprint":[2,1],"art":"bench_wood","provisional":false,"ground":false},{"id":"p34","region":"outdoors","type":"bench","name":"庭院长椅","x":18,"y":26,"solid":true,"footprint":[2,1],"art":"bench_wood","provisional":false,"ground":false},{"id":"p35","region":"outdoors","type":"bench","name":"庭院长椅","x":45,"y":36,"solid":true,"footprint":[2,1],"art":"bench_wood","provisional":false,"ground":false},{"id":"p36","region":"outdoors","type":"bench","name":"庭院长椅","x":8,"y":52,"solid":true,"footprint":[2,1],"art":"bench_wood","provisional":false,"ground":false},{"id":"p37","region":"outdoors","type":"barrel","name":"杂物桶","x":42,"y":43,"solid":true,"facing":"side","footprint":[1,1],"art":"barrel","provisional":false,"ground":false},{"id":"p38","region":"outdoors","type":"barrel","name":"杂物桶","x":52,"y":29,"solid":true,"footprint":[1,1],"art":"barrel","provisional":false,"ground":false},{"id":"p39","region":"outdoors","type":"barrel","name":"杂物桶","x":68,"y":27,"solid":true,"footprint":[1,1],"art":"barrel","provisional":false,"ground":false},{"id":"p40","region":"outdoors","type":"barrel","name":"杂物桶","x":67,"y":9,"solid":true,"footprint":[1,1],"art":"barrel","provisional":false,"ground":false},{"id":"p41","region":"outdoors","type":"bench","name":"庭院长椅","x":38,"y":35,"solid":true,"footprint":[1,2],"facing":"side","art":"bench_wood","provisional":false,"ground":false},{"id":"p42","region":"outdoors","type":"bench","name":"庭院长椅","x":7,"y":30,"solid":true,"footprint":[2,1],"art":"bench_wood","provisional":false,"ground":false},{"id":"p43","region":"outdoors","type":"bench","name":"庭院长椅","x":18,"y":30,"solid":true,"footprint":[2,1],"art":"bench_wood","provisional":false,"ground":false},{"id":"p44","region":"outdoors","type":"bench","name":"庭院长椅","x":27,"y":35,"solid":true,"footprint":[1,2],"facing":"side","art":"bench_wood","provisional":false,"ground":false},{"id":"p45","region":"outdoors","type":"bench","name":"庭院长椅","x":28,"y":29,"solid":true,"footprint":[1,2],"facing":"side","art":"bench_wood","provisional":false,"ground":false},{"id":"p46","region":"outdoors","type":"tree","name":"院落树木","x":64,"y":6,"solid":true,"footprint":[3,3],"collisionCells":[[1,2]],"canopy":{"fadeRows":2,"opacity":0.3},"art":"tree_courtyard_canopy","provisional":false,"ground":false},{"id":"p47","region":"outdoors","type":"counter","name":"银行柜台","x":53,"y":5,"solid":true,"footprint":[2,1],"facing":"back","art":"counter_bank","provisional":false,"ground":false},{"id":"p48","region":"outdoors","type":"sofa","name":"沙发","x":46,"y":11,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p49","region":"outdoors","type":"sofa","name":"沙发","x":48,"y":11,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p50","region":"outdoors","type":"tree","name":"院落树木","x":45,"y":33,"solid":true,"footprint":[3,3],"collisionCells":[[1,2]],"canopy":{"fadeRows":2,"opacity":0.3},"art":"tree_courtyard_canopy","provisional":false,"ground":false},{"id":"p110","region":"outdoors","type":"sofa","name":"沙发","x":62,"y":19,"solid":true,"footprint":[1,2],"facing":"side","art":"sofa_home","provisional":false,"ground":false},{"id":"p111","region":"clockshop","type":"workbench_industrial","name":"重型工作台","x":59,"y":36,"solid":true,"footprint":[1,2],"facing":"side","art":"workbench_industrial","provisional":false,"ground":false},{"id":"p113","region":"outdoors","type":"barrier_queue","name":"银行排队围栏","x":52,"y":12,"solid":true,"footprint":[1,1],"facing":"back","art":"barrier_queue","provisional":false,"ground":false},{"id":"p114","region":"outdoors","type":"barrier_queue","name":"银行排队围栏","x":51,"y":12,"solid":true,"footprint":[1,1],"facing":"back","art":"barrier_queue","provisional":false,"ground":false},{"id":"p115","region":"outdoors","type":"barrier_queue","name":"银行排队围栏","x":51,"y":15,"solid":true,"footprint":[1,1],"facing":"back","art":"barrier_queue","provisional":false,"ground":false},{"id":"p116","region":"outdoors","type":"barrier_queue","name":"银行排队围栏","x":52,"y":15,"solid":true,"footprint":[1,1],"facing":"back","art":"barrier_queue","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p118","region":"apartment","type":"clock_grandfather","name":"落地钟","x":10,"y":16,"solid":true,"footprint":[1,1],"art":"clock_grandfather","provisional":false,"ground":false},{"id":"p119","region":"apartment","type":"sink_kitchen","name":"厨房水槽","x":6,"y":18,"solid":true,"footprint":[1,1],"facing":"side","art":"sink_kitchen","provisional":false,"ground":false},{"id":"p120","region":"outdoors","type":"sink_kitchen","name":"厨房水槽","x":3,"y":15,"solid":true,"footprint":[1,1],"art":"sink_kitchen","provisional":false,"ground":false},{"id":"p121","region":"apartment","type":"fridge_home","name":"老式冰箱","x":6,"y":16,"solid":true,"footprint":[1,1],"facing":"back","art":"fridge_home","provisional":false,"ground":false},{"id":"p122","region":"outdoors","type":"wardrobe_home","name":"旧衣柜","x":6,"y":6,"solid":true,"footprint":[2,1],"art":"wardrobe_home","provisional":false,"ground":false},{"id":"p123","region":"outdoors","type":"wardrobe_home","name":"旧衣柜","x":12,"y":6,"solid":true,"footprint":[2,1],"art":"wardrobe_home","provisional":false,"ground":false},{"id":"p124","region":"apartment","type":"table_dining","name":"老式餐桌","x":12,"y":18,"solid":true,"footprint":[2,2],"art":"table_dining","provisional":false,"ground":false},{"id":"p125","region":"apartment","type":"chair_wood","name":"普通木椅","x":11,"y":19,"solid":true,"footprint":[1,1],"facing":"side","art":"chair_wood","provisional":false,"ground":false},{"id":"p126","region":"apartment","type":"chair_wood","name":"普通木椅","x":14,"y":19,"solid":true,"footprint":[1,1],"facing":"back","art":"chair_wood","provisional":false,"ground":false},{"id":"p127","region":"outdoors","type":"pallet_stack","name":"木质托盘堆","x":27,"y":1,"solid":true,"footprint":[2,1],"art":"pallet_stack","provisional":false,"ground":false},{"id":"p135","region":"outdoors","type":"bed","name":"床","x":20,"y":6,"solid":true,"footprint":[1,2],"art":"bed_home","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p136","region":"outdoors","type":"clock_grandfather","name":"落地钟","x":10,"y":6,"solid":true,"footprint":[1,1],"facing":"side","art":"clock_grandfather","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p137","region":"outdoors","type":"clock_grandfather","name":"落地钟","x":16,"y":6,"solid":true,"footprint":[1,1],"facing":"side","art":"clock_grandfather","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p138","region":"outdoors","type":"clock_grandfather","name":"落地钟","x":22,"y":6,"solid":true,"footprint":[1,1],"facing":"side","art":"clock_grandfather","provisional":false,"ground":false},{"id":"p139","region":"apartment","type":"sofa","name":"沙发","x":6,"y":9,"solid":true,"footprint":[1,2],"facing":"side","art":"sofa_home","provisional":false,"ground":false},{"id":"p140","region":"apartment","type":"sofa","name":"沙发","x":12,"y":9,"solid":true,"footprint":[1,2],"facing":"side","art":"sofa_home","provisional":false,"ground":false},{"id":"p141","region":"outdoors","type":"sofa","name":"沙发","x":18,"y":9,"solid":true,"footprint":[1,2],"facing":"side","art":"sofa_home","provisional":false,"ground":false},{"id":"p142","region":"apartment","type":"desk","name":"床头柜","x":18,"y":11,"solid":true,"footprint":[1,1],"facing":"side","art":"desk","provisional":false,"ground":false},{"id":"p143","region":"apartment","type":"desk","name":"床头柜","x":6,"y":11,"solid":true,"footprint":[1,1],"facing":"side","art":"desk","provisional":false,"ground":false},{"id":"p144","region":"outdoors","type":"wardrobe_home","name":"旧衣柜","x":18,"y":6,"solid":true,"footprint":[2,1],"art":"wardrobe_home","provisional":false,"ground":false},{"id":"p145","region":"outdoors","type":"pallet_stack","name":"木质托盘堆","x":21,"y":14,"solid":true,"footprint":[2,1],"art":"pallet_stack","provisional":false,"ground":false},{"id":"p146","region":"outdoors","type":"barrel","name":"杂物桶","x":22,"y":13,"solid":true,"footprint":[1,1],"art":"barrel","provisional":false,"ground":false},{"id":"p147","region":"apartment","type":"barrel","name":"杂物桶","x":17,"y":13,"solid":true,"footprint":[1,1],"facing":"back","art":"barrel","provisional":false,"ground":false},{"id":"p183","region":"outdoors","type":"sofa","name":"沙发","x":16,"y":44,"solid":true,"footprint":[1,2],"art":"sofa_home","provisional":false,"ground":false},{"id":"p184","region":"clinic","type":"cart_medical","name":"医疗器械推车","x":11,"y":42,"solid":true,"footprint":[1,1],"art":"cart_medical","provisional":false,"ground":false},{"id":"p185","region":"clinic","type":"cart_medical","name":"医疗器械推车","x":11,"y":38,"solid":true,"footprint":[1,1],"art":"cart_medical","provisional":false,"ground":false},{"id":"p186","region":"clinic","type":"cart_medical","name":"医疗器械推车","x":11,"y":44,"solid":true,"footprint":[1,1],"art":"cart_medical","provisional":false,"ground":false},{"id":"p187","region":"outdoors","type":"chair_wood","name":"普通木椅","x":16,"y":39,"solid":true,"footprint":[1,1],"art":"chair_wood","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p188","region":"outdoors","type":"clock_grandfather","name":"落地钟","x":18,"y":38,"solid":true,"footprint":[1,1],"facing":"side","art":"clock_grandfather","provisional":false,"ground":false},{"id":"p190","region":"clinic","type":"screen_clinic","name":"医用屏风","x":6,"y":40,"solid":true,"footprint":[2,1],"art":"screen_clinic","provisional":false,"ground":false},{"id":"p191","region":"clinic","type":"screen_clinic","name":"医用屏风","x":6,"y":42,"solid":true,"footprint":[2,1],"art":"screen_clinic","provisional":false,"ground":false},{"id":"p192","region":"clinic","type":"sofa","name":"沙发","x":9,"y":38,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p193","region":"clinic","type":"sofa","name":"沙发","x":9,"y":34,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p194","region":"outdoors","type":"sofa","name":"沙发","x":15,"y":34,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p195","region":"clinic","type":"bed_clinic","name":"诊疗床","x":6,"y":41,"solid":true,"footprint":[2,1],"facing":"side","art":"bed_clinic","provisional":false,"ground":false},{"id":"p196","region":"bank","type":"barrier_queue","name":"银行排队围栏","x":45,"y":23,"solid":true,"footprint":[1,1],"facing":"side","art":"barrier_queue","provisional":false,"ground":false},{"id":"p197","region":"bank","type":"barrier_queue","name":"银行排队围栏","x":45,"y":24,"solid":true,"footprint":[1,1],"facing":"side","art":"barrier_queue","provisional":false,"ground":false},{"id":"p198","region":"bank","type":"barrier_queue","name":"银行排队围栏","x":48,"y":22,"solid":true,"footprint":[1,1],"facing":"side","art":"barrier_queue","provisional":false,"ground":false},{"id":"p199","region":"bank","type":"barrier_queue","name":"银行排队围栏","x":45,"y":25,"solid":true,"footprint":[1,1],"facing":"side","art":"barrier_queue","provisional":false,"ground":false},{"id":"p200","region":"outdoors","type":"desk","name":"桌子","x":64,"y":19,"solid":true,"footprint":[1,2],"facing":"side","art":"desk","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p201","region":"outdoors","type":"clock_grandfather","name":"落地钟","x":65,"y":18,"solid":true,"footprint":[1,1],"art":"clock_grandfather","provisional":false,"ground":false},{"id":"p202","region":"bank","type":"console_security","name":"安保监控台","x":50,"y":23,"solid":true,"footprint":[1,1],"facing":"side","art":"console_security","provisional":false,"ground":false},{"id":"p203","region":"clockshop","type":"workbench_clock","name":"钟表维修台","x":62,"y":38,"solid":true,"footprint":[1,2],"facing":"side","art":"workbench_clock","provisional":false,"ground":false},{"id":"p204","region":"clockshop","type":"counter_shop","name":"营业柜台","x":56,"y":38,"solid":true,"footprint":[1,2],"facing":"side","art":"counter_shop","provisional":false,"ground":false},{"id":"p205","region":"clockshop","type":"display_clock","name":"橱窗展柜","x":55,"y":33,"solid":true,"footprint":[1,2],"facing":"side","art":"display_clock","provisional":false,"ground":false},{"id":"p206","region":"clockshop","type":"display_clock","name":"橱窗展柜","x":55,"y":42,"solid":true,"footprint":[1,2],"facing":"side","art":"display_clock","provisional":false,"ground":false},{"id":"p207","region":"clockshop","type":"workbench_clock","name":"钟表维修台","x":59,"y":38,"solid":true,"footprint":[1,2],"facing":"side","art":"workbench_clock","provisional":false,"ground":false},{"id":"p208","region":"clockshop","type":"sofa_home","name":"沙发","x":60,"y":31,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p209","region":"clockshop","type":"chair_wood","name":"普通木椅","x":61,"y":39,"solid":true,"footprint":[1,1],"facing":"side","art":"chair_wood","provisional":false,"ground":false},{"id":"p210","region":"clockshop","type":"chair_wood","name":"普通木椅","x":61,"y":41,"solid":true,"footprint":[1,1],"art":"chair_wood","provisional":false,"ground":false},{"id":"p211","region":"clockshop","type":"desk","name":"桌子","x":60,"y":42,"solid":true,"footprint":[2,1],"art":"desk","provisional":false,"ground":false},{"id":"p212","region":"clockshop","type":"shelf","name":"货架","x":62,"y":36,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p213","region":"clockshop","type":"counter_shop","name":"营业柜台","x":59,"y":31,"solid":true,"footprint":[1,2],"facing":"side","art":"counter_shop","provisional":false,"ground":false},{"id":"p214","region":"clockshop","type":"display_clock","name":"橱窗展柜","x":56,"y":36,"solid":true,"footprint":[1,2],"facing":"side","art":"display_clock","provisional":false,"ground":false},{"id":"p215","region":"clockshop","type":"display_clock","name":"橱窗展柜","x":54,"y":46,"solid":true,"footprint":[2,1],"art":"display_clock","provisional":false,"ground":false},{"id":"p216","region":"clockshop","type":"display_clock","name":"橱窗展柜","x":54,"y":31,"solid":true,"footprint":[2,1],"facing":"back","art":"display_clock","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p217","region":"clockshop","type":"clock_grandfather","name":"落地钟","x":53,"y":31,"solid":true,"footprint":[1,1],"art":"clock_grandfather","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p218","region":"outdoors","type":"clock_grandfather","name":"落地钟","x":53,"y":46,"solid":true,"footprint":[1,1],"facing":"side","art":"clock_grandfather","provisional":false,"ground":false},{"visual":[1,1.5],"id":"p219","region":"clockshop","type":"clock_grandfather","name":"落地钟","x":53,"y":38,"solid":true,"footprint":[1,1],"facing":"side","art":"clock_grandfather","provisional":false,"ground":false},{"id":"p220","region":"clockshop","type":"shelf","name":"货架","x":66,"y":33,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p221","region":"clockshop","type":"shelf","name":"货架","x":66,"y":36,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p222","region":"clockshop","type":"shelf","name":"货架","x":66,"y":39,"solid":true,"footprint":[1,2],"facing":"side","art":"shelf","provisional":false,"ground":false},{"id":"p223","region":"outdoors","type":"fridge_home","name":"老式冰箱","x":67,"y":31,"solid":true,"footprint":[1,1],"facing":"side","art":"fridge_home","provisional":false,"ground":false},{"id":"p224","region":"clockshop","type":"display_clock","name":"橱窗展柜","x":58,"y":46,"solid":true,"footprint":[2,1],"facing":"back","art":"display_clock","provisional":false,"ground":false},{"id":"p225","region":"clockshop","type":"display_clock","name":"橱窗展柜","x":62,"y":46,"solid":true,"footprint":[2,1],"facing":"back","art":"display_clock","provisional":false,"ground":false},{"id":"p226","region":"clockshop","type":"sofa_home","name":"沙发","x":60,"y":44,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p227","region":"clockshop","type":"sofa_home","name":"沙发","x":63,"y":44,"solid":true,"footprint":[2,1],"art":"sofa_home","provisional":false,"ground":false},{"id":"p228","region":"clockshop","type":"sofa_home","name":"沙发","x":53,"y":35,"solid":true,"footprint":[1,2],"facing":"side","art":"sofa_home","provisional":false,"ground":false}],"overlays":[{"art":"canal_bank_w","x":29,"y":0},{"art":"canal_bank_e","x":36,"y":0},{"art":"canal_bank_w","x":29,"y":1},{"art":"canal_bank_e","x":36,"y":1},{"art":"canal_bank_w","x":29,"y":2},{"art":"canal_bank_e","x":36,"y":2},{"art":"canal_bank_w","x":29,"y":3},{"art":"canal_bank_e","x":36,"y":3},{"art":"canal_bank_w","x":29,"y":4},{"art":"canal_bank_e","x":36,"y":4},{"art":"canal_bank_w","x":29,"y":5},{"art":"canal_bank_e","x":36,"y":5},{"art":"canal_bank_w","x":29,"y":6},{"art":"canal_bank_e","x":36,"y":6},{"art":"canal_bank_w","x":29,"y":7},{"art":"canal_bank_e","x":36,"y":7},{"art":"canal_bank_w","x":29,"y":8},{"art":"canal_bank_e","x":36,"y":8},{"art":"canal_bank_w","x":29,"y":9},{"art":"canal_bank_e","x":36,"y":9},{"art":"canal_bank_w","x":29,"y":10},{"art":"canal_bank_e","x":36,"y":10},{"art":"canal_bank_w","x":29,"y":11},{"art":"canal_bank_e","x":36,"y":11},{"art":"canal_bank_w","x":29,"y":16},{"art":"canal_bank_e","x":36,"y":16},{"art":"canal_bank_w","x":29,"y":17},{"art":"canal_bank_e","x":36,"y":17},{"art":"canal_bank_w","x":29,"y":18},{"art":"canal_bank_e","x":36,"y":18},{"art":"canal_bank_w","x":29,"y":19},{"art":"canal_bank_e","x":36,"y":19},{"art":"canal_bank_w","x":29,"y":20},{"art":"canal_bank_e","x":36,"y":20},{"art":"canal_bank_w","x":29,"y":21},{"art":"canal_bank_e","x":36,"y":21},{"art":"canal_bank_w","x":29,"y":22},{"art":"canal_bank_e","x":36,"y":22},{"art":"canal_bank_w","x":29,"y":23},{"art":"canal_bank_w","x":29,"y":24},{"art":"canal_bank_w","x":29,"y":25},{"art":"canal_bank_w","x":29,"y":26},{"art":"canal_bank_e","x":36,"y":26},{"art":"canal_bank_e","x":36,"y":27},{"art":"canal_bank_e","x":36,"y":28},{"art":"canal_bank_e","x":36,"y":29},{"art":"canal_bank_w","x":29,"y":30},{"art":"canal_bank_e","x":36,"y":30},{"art":"canal_bank_w","x":29,"y":31},{"art":"canal_bank_e","x":36,"y":31},{"art":"canal_bank_w","x":29,"y":32},{"art":"canal_bank_e","x":36,"y":32},{"art":"canal_bank_w","x":29,"y":33},{"art":"canal_bank_e","x":36,"y":33},{"art":"canal_bank_w","x":29,"y":34},{"art":"canal_bank_e","x":36,"y":34},{"art":"canal_bank_w","x":29,"y":35},{"art":"canal_bank_e","x":36,"y":35},{"art":"canal_bank_w","x":29,"y":36},{"art":"canal_bank_e","x":36,"y":36},{"art":"canal_bank_w","x":29,"y":37},{"art":"canal_bank_e","x":36,"y":37},{"art":"canal_bank_w","x":29,"y":38},{"art":"canal_bank_e","x":36,"y":38},{"art":"canal_bank_w","x":29,"y":39},{"art":"canal_bank_e","x":36,"y":39},{"art":"canal_bank_w","x":29,"y":43},{"art":"canal_bank_e","x":36,"y":43},{"art":"canal_bank_w","x":29,"y":44},{"art":"canal_bank_e","x":36,"y":44},{"art":"canal_bank_w","x":29,"y":45},{"art":"canal_bank_e","x":36,"y":45},{"art":"canal_bank_w","x":29,"y":46},{"art":"canal_bank_e","x":36,"y":46},{"art":"canal_bank_w","x":29,"y":47},{"art":"canal_bank_e","x":36,"y":47},{"art":"canal_bank_w","x":29,"y":48},{"art":"canal_bank_e","x":36,"y":48},{"art":"canal_bank_w","x":29,"y":49},{"art":"canal_bank_e","x":36,"y":49},{"art":"canal_bank_w","x":29,"y":50},{"art":"canal_bank_e","x":36,"y":50},{"art":"canal_bank_w","x":29,"y":51},{"art":"canal_bank_e","x":36,"y":51},{"art":"canal_bank_w","x":29,"y":52},{"art":"canal_bank_e","x":36,"y":52},{"art":"canal_bank_w","x":29,"y":53},{"art":"canal_bank_e","x":36,"y":53},{"art":"canal_bank_w","x":29,"y":54},{"art":"canal_bank_e","x":36,"y":54},{"art":"canal_bank_w","x":29,"y":55},{"art":"canal_bank_e","x":36,"y":55},{"art":"bridge_stone_rail_n","x":29,"y":11},{"art":"bridge_stone_rail_n","x":30,"y":11},{"art":"bridge_stone_rail_n","x":31,"y":11},{"art":"bridge_stone_rail_n","x":32,"y":11},{"art":"bridge_stone_rail_n","x":33,"y":11},{"art":"bridge_stone_rail_n","x":34,"y":11},{"art":"bridge_stone_rail_n","x":35,"y":11},{"art":"bridge_stone_rail_n","x":36,"y":11},{"art":"bridge_stone_rail_s","x":29,"y":16},{"art":"bridge_stone_rail_s","x":30,"y":16},{"art":"bridge_stone_rail_s","x":31,"y":16},{"art":"bridge_stone_rail_s","x":32,"y":16},{"art":"bridge_stone_rail_s","x":33,"y":16},{"art":"bridge_stone_rail_s","x":34,"y":16},{"art":"bridge_stone_rail_s","x":35,"y":16},{"art":"bridge_stone_rail_s","x":36,"y":16},{"art":"bridge_wood_rail_n","x":29,"y":39},{"art":"bridge_wood_rail_n","x":30,"y":39},{"art":"bridge_wood_rail_n","x":31,"y":39},{"art":"bridge_wood_rail_n","x":32,"y":39},{"art":"bridge_wood_rail_n","x":33,"y":39},{"art":"bridge_wood_rail_n","x":34,"y":39},{"art":"bridge_wood_rail_n","x":35,"y":39},{"art":"bridge_wood_rail_n","x":36,"y":39},{"art":"bridge_wood_rail_s","x":29,"y":43},{"art":"bridge_wood_rail_s","x":30,"y":43},{"art":"bridge_wood_rail_s","x":31,"y":43},{"art":"bridge_wood_rail_s","x":32,"y":43},{"art":"bridge_wood_rail_s","x":33,"y":43},{"art":"bridge_wood_rail_s","x":34,"y":43},{"art":"bridge_wood_rail_s","x":35,"y":43},{"art":"bridge_wood_rail_s","x":36,"y":43},{"art":"shop_window_ns","x":44,"y":18},{"art":"shop_window_ns","x":44,"y":19},{"art":"shop_window_ns","x":44,"y":23}],"containers":[{"id":"c01","region":"outdoors","type":"N","x":9,"y":6,"preference":["life"]},{"id":"c02","region":"outdoors","type":"N","x":15,"y":6,"preference":["life"]},{"id":"c06","region":"outdoors","type":"m","x":21,"y":16,"preference":["life"]},{"id":"c07","region":"apartment","type":"J","x":6,"y":20,"preference":["life"]},{"id":"c08","region":"apartment","type":"D","x":17,"y":21,"preference":["life"]},{"id":"c09","region":"outdoors","type":"F","x":3,"y":41,"preference":["med","medical"]},{"id":"c11","region":"outdoors","type":"M","x":6,"y":43,"preference":["med","medical"]},{"id":"c12","region":"outdoors","type":"M","x":6,"y":44,"preference":["med","medical"]},{"id":"c13","region":"clinic","type":"H","x":11,"y":39,"preference":["med","medical"]},{"id":"c14","region":"clinic","type":"Y","x":6,"y":38,"preference":["med","medical"]},{"id":"c16","region":"outdoors","type":"B","x":48,"y":5,"preference":["collect"]},{"id":"c17","region":"bank","type":"R","x":51,"y":18,"preference":["collect"]},{"id":"c18","region":"outdoors","type":"B","x":67,"y":21,"preference":["collect"]},{"id":"c19","region":"bank","type":"B","x":46,"y":18,"preference":["collect"]},{"id":"c20","region":"outdoors","type":"B","x":52,"y":5,"preference":["collect"]},{"id":"c21","region":"bank","type":"G","x":54,"y":18,"preference":["collect"]},{"id":"c22","region":"clockshop","type":"F","x":59,"y":35,"preference":["collect"]},{"id":"c23","region":"clockshop","type":"L","x":56,"y":31,"preference":["collect"]},{"id":"c24","region":"clockshop","type":"F","x":53,"y":41,"preference":["collect"]},{"id":"c25","region":"clockshop","type":"L","x":56,"y":46,"preference":["collect"]},{"id":"c27","region":"clockshop","type":"B","x":65,"y":31,"preference":["collect"]},{"id":"c28","region":"bank","type":"V","x":53,"y":18,"preference":["collect"]},{"id":"c29","region":"clockshop","type":"O","x":64,"y":42,"preference":["collect"]},{"id":"c30","region":"clockshop","type":"G","x":62,"y":35,"preference":["collect"]},{"id":"c31","region":"clockshop","type":"B","x":65,"y":42,"preference":["collect"]},{"id":"c32","region":"warehouse","type":"T","x":40,"y":45,"preference":["ind","elec"]},{"id":"c33","region":"warehouse","type":"T","x":46,"y":48,"preference":["ind","elec"]},{"id":"c34","region":"outdoors","type":"b","x":3,"y":47,"preference":["ind","elec"]},{"id":"c35","region":"outdoors","type":"b","x":49,"y":48,"preference":["ind","elec"]},{"id":"c36","region":"warehouse","type":"e","x":40,"y":48,"preference":["ind","elec"]},{"id":"c37","region":"warehouse","type":"Q","x":44,"y":52,"preference":["ind","elec"]},{"id":"c38","region":"warehouse","type":"A","x":47,"y":52,"preference":["ind","elec"]},{"id":"c39","region":"warehouse","type":"K","x":40,"y":52,"preference":["ind","elec"]},{"id":"c40","region":"outdoors","type":"Z","x":23,"y":20,"preference":["life","ind"]},{"id":"c41","region":"outdoors","type":"T","x":3,"y":49,"preference":["life","ind"]},{"id":"c42","region":"outdoors","type":"U","x":65,"y":29,"preference":["life","ind"]},{"id":"c43","region":"outdoors","type":"H","x":14,"y":45,"preference":["life","ind"]},{"id":"c44","region":"outdoors","type":"W","x":7,"y":52,"preference":["life","ind"]},{"id":"c45","region":"outdoors","type":"b","x":62,"y":25,"preference":["life","ind"]},{"id":"c46","region":"clockshop","type":"C","x":64,"y":31,"preference":["life","ind"]},{"id":"c47","region":"outdoors","type":"T","x":61,"y":9,"preference":["life","ind"]},{"id":"c48","region":"clockshop","type":"K","x":62,"y":31,"preference":["life","ind"]},{"id":"c49","region":"outdoors","type":"W","x":49,"y":9,"preference":["life","ind"]},{"id":"c50","region":"outdoors","type":"W","x":45,"y":16,"preference":["life","ind"]},{"id":"c51","region":"outdoors","type":"T","x":67,"y":12,"preference":["ind","elec"]},{"id":"c52","region":"outdoors","type":"U","x":55,"y":11,"preference":["life","ind"]},{"id":"c53","region":"outdoors","type":"e","x":54,"y":16,"preference":["ind","elec"]},{"id":"c54","region":"outdoors","type":"D","x":56,"y":16,"preference":["life"]},{"id":"c55","region":"outdoors","type":"J","x":45,"y":12,"preference":["life"]},{"id":"c56","region":"outdoors","type":"Q","x":54,"y":11,"preference":["ind","elec"]},{"id":"c57","region":"outdoors","type":"Q","x":55,"y":5,"preference":["ind","elec"]},{"id":"c58","region":"outdoors","type":"R","x":54,"y":9,"preference":["collect"]},{"id":"c59","region":"outdoors","type":"F","x":55,"y":16,"preference":["collect"]},{"id":"c60","region":"apartment","type":"A","x":16,"y":11,"preference":["ind","elec"]},{"id":"c61","region":"apartment","type":"B","x":6,"y":8,"preference":["collect"]},{"id":"c62","region":"apartment","type":"T","x":7,"y":16,"preference":["ind","elec"]},{"id":"c63","region":"outdoors","type":"M","x":60,"y":11,"preference":["med","medical"]},{"id":"c64","region":"outdoors","type":"G","x":67,"y":15,"preference":["collect"]},{"id":"c65","region":"outdoors","type":"K","x":67,"y":18,"preference":["ind","elec"]},{"id":"c67","region":"outdoors","type":"W","x":62,"y":21,"preference":["life","ind"]},{"id":"c68","region":"outdoors","type":"O","x":62,"y":18,"preference":["collect"]},{"id":"c69","region":"outdoors","type":"L","x":63,"y":25,"preference":["collect"]},{"id":"c70","region":"apartment","type":"D","x":10,"y":19,"preference":["life"]},{"id":"c71","region":"apartment","type":"H","x":8,"y":20,"preference":["med","medical"]},{"id":"c72","region":"apartment","type":"e","x":7,"y":20,"preference":["ind","elec"]},{"id":"c73","region":"apartment","type":"W","x":13,"y":16,"preference":["life","ind"]},{"id":"c74","region":"apartment","type":"L","x":15,"y":19,"preference":["collect"]},{"id":"c75","region":"apartment","type":"C","x":17,"y":22,"preference":["life"]},{"id":"c76","region":"apartment","type":"b","x":10,"y":22,"preference":["ind","elec"]},{"id":"c77","region":"outdoors","type":"Z","x":23,"y":1,"preference":["life","ind"]},{"id":"c78","region":"outdoors","type":"Z","x":27,"y":2,"preference":["life","ind"]},{"id":"c79","region":"outdoors","type":"b","x":28,"y":2,"preference":["ind","elec"]},{"id":"c80","region":"outdoors","type":"b","x":26,"y":1,"preference":["ind","elec"]},{"id":"c81","region":"outdoors","type":"U","x":25,"y":1,"preference":["life","ind"]},{"id":"c82","region":"outdoors","type":"D","x":9,"y":30,"preference":["life"]},{"id":"c83","region":"outdoors","type":"N","x":21,"y":6,"preference":["life"]},{"id":"c84","region":"outdoors","type":"O","x":18,"y":8,"preference":["collect"]},{"id":"c85","region":"outdoors","type":"J","x":22,"y":7,"preference":["life"]},{"id":"c86","region":"outdoors","type":"B","x":22,"y":8,"preference":["collect"]},{"id":"c87","region":"outdoors","type":"Q","x":22,"y":9,"preference":["ind","elec"]},{"id":"c88","region":"apartment","type":"b","x":18,"y":13,"preference":["ind","elec"]},{"id":"c89","region":"outdoors","type":"C","x":19,"y":16,"preference":["med","medical"]},{"id":"c90","region":"outdoors","type":"T","x":19,"y":19,"preference":["ind","elec"]},{"id":"c91","region":"clinic","type":"W","x":11,"y":34,"preference":["life","ind"]},{"id":"c92","region":"outdoors","type":"Q","x":7,"y":45,"preference":["ind","elec"]},{"id":"c93","region":"outdoors","type":"V","x":16,"y":38,"preference":["collect"]},{"id":"c94","region":"outdoors","type":"F","x":17,"y":34,"preference":["collect"]},{"id":"c95","region":"outdoors","type":"J","x":18,"y":45,"preference":["life"]},{"id":"c96","region":"outdoors","type":"D","x":18,"y":44,"preference":["life"]},{"id":"c97","region":"clinic","type":"R","x":6,"y":36,"preference":["collect"]},{"id":"c98","region":"outdoors","type":"H","x":18,"y":34,"preference":["med","medical"]},{"id":"c99","region":"outdoors","type":"D","x":20,"y":45,"preference":["life"]},{"id":"c100","region":"outdoors","type":"T","x":21,"y":34,"preference":["ind","elec"]},{"id":"c101","region":"clinic","type":"C","x":7,"y":34,"preference":["collect"]},{"id":"c102","region":"outdoors","type":"b","x":11,"y":45,"preference":["ind","elec"]},{"id":"c103","region":"outdoors","type":"b","x":67,"y":32,"preference":["ind","elec"]},{"id":"c104","region":"clockshop","type":"b","x":67,"y":42,"preference":["ind","elec"]},{"id":"c105","region":"clockshop","type":"b","x":67,"y":37,"preference":["ind","elec"]},{"id":"c106","region":"clockshop","type":"T","x":66,"y":42,"preference":["ind","elec"]},{"id":"c107","region":"clockshop","type":"T","x":57,"y":41,"preference":["ind","elec"]},{"id":"c108","region":"clockshop","type":"R","x":62,"y":42,"preference":["collect"]},{"id":"c109","region":"outdoors","type":"R","x":66,"y":31,"preference":["collect"]},{"id":"c110","region":"clockshop","type":"G","x":59,"y":41,"preference":["collect"]},{"id":"c111","region":"clockshop","type":"V","x":64,"y":37,"preference":["collect"]},{"id":"c112","region":"bank","type":"V","x":52,"y":18,"preference":["collect"]},{"id":"c113","region":"clockshop","type":"e","x":65,"y":44,"preference":["ind","elec"]},{"id":"c114","region":"warehouse","type":"Q","x":40,"y":51,"preference":["ind","elec"]},{"id":"c115","region":"warehouse","type":"Q","x":46,"y":52,"preference":["ind","elec"]}],"enemies":[{"id":"e01","region":"apartment","type":"scav","x":8,"y":18,"patrolRadius":2},{"id":"e02","region":"apartment","type":"scav","x":15,"y":17,"patrolRadius":2},{"id":"e03","region":"apartment","type":"scav","x":14,"y":21,"patrolRadius":2},{"id":"e04","region":"clinic","type":"scav","x":14,"y":44,"patrolRadius":2},{"id":"e05","region":"clinic","type":"scav","x":14,"y":39,"patrolRadius":2},{"id":"e06","region":"bank","type":"scav","x":46,"y":21,"patrolRadius":2},{"id":"e08","region":"bank","type":"scav","x":51,"y":24,"patrolRadius":2},{"id":"e09","region":"clockshop","type":"guard","x":60,"y":38,"patrolRadius":2},{"id":"e11","region":"clockshop","type":"guard","x":60,"y":33,"patrolRadius":2},{"id":"e12","region":"clockshop","type":"guard","x":65,"y":39,"patrolRadius":2},{"id":"e13","region":"clockshop","type":"guard","x":65,"y":35,"patrolRadius":2},{"id":"e14","region":"outdoors","type":"scav","x":39,"y":41,"patrolRadius":2},{"id":"e15","region":"outdoors","type":"scav","x":42,"y":24,"patrolRadius":2},{"id":"e16","region":"outdoors","type":"scav","x":13,"y":28,"patrolRadius":3},{"id":"e17","region":"outdoors","type":"scav","x":62,"y":8,"patrolRadius":3},{"id":"e18","region":"outdoors","type":"echo","x":18,"y":31,"patrolRadius":3},{"id":"e19","region":"outdoors","type":"echo","x":16,"y":36,"patrolRadius":3},{"id":"e20","region":"outdoors","type":"echo","x":8,"y":27,"patrolRadius":3},{"id":"e21","region":"outdoors","type":"echo","x":15,"y":51,"patrolRadius":3},{"id":"e22","region":"outdoors","type":"echo","x":58,"y":28,"patrolRadius":3},{"id":"e23","region":"outdoors","type":"echo","x":37,"y":35,"patrolRadius":3},{"id":"e24","region":"outdoors","type":"echo","x":50,"y":40,"patrolRadius":3},{"id":"e25","region":"bank","type":"scav","x":53,"y":19,"patrolRadius":2},{"id":"e26","region":"outdoors","type":"scav","x":65,"y":24,"patrolRadius":2},{"id":"e27","region":"outdoors","type":"scav","x":58,"y":23,"patrolRadius":2},{"id":"e28","region":"outdoors","type":"scav","x":65,"y":19,"patrolRadius":2},{"id":"e29","region":"outdoors","type":"scav","x":54,"y":12,"patrolRadius":2},{"id":"e30","region":"outdoors","type":"scav","x":66,"y":15,"patrolRadius":2},{"id":"e31","region":"outdoors","type":"scav","x":48,"y":7,"patrolRadius":2},{"id":"e32","region":"outdoors","type":"scav","x":53,"y":6,"patrolRadius":2},{"id":"e33","region":"outdoors","type":"scav","x":41,"y":8,"patrolRadius":2},{"id":"e34","region":"apartment","type":"scav","x":15,"y":14,"patrolRadius":2},{"id":"e35","region":"outdoors","type":"scav","x":19,"y":11,"patrolRadius":2},{"id":"e36","region":"outdoors","type":"echo","x":25,"y":38,"patrolRadius":2},{"id":"e37","region":"outdoors","type":"echo","x":25,"y":33,"patrolRadius":2},{"id":"e38","region":"outdoors","type":"scav","x":21,"y":8,"patrolRadius":2},{"id":"e39","region":"clinic","type":"echo","x":11,"y":41,"patrolRadius":2},{"id":"e40","region":"clinic","type":"echo","x":8,"y":39,"patrolRadius":2},{"id":"e41","region":"clinic","type":"echo","x":8,"y":42,"patrolRadius":2},{"id":"e42","region":"outdoors","type":"echo","x":17,"y":41,"patrolRadius":2},{"id":"e43","region":"clinic","type":"echo","x":10,"y":36,"patrolRadius":2},{"id":"e45","region":"outdoors","type":"echo","x":17,"y":44,"patrolRadius":2},{"id":"e46","region":"bank","type":"scav","x":50,"y":21,"patrolRadius":2},{"id":"e47","region":"warehouse","type":"retriever","x":42,"y":50,"patrolRadius":2,"facing":"s"},{"id":"e48","region":"warehouse","type":"retriever","x":43,"y":47,"patrolRadius":2,"facing":"s"},{"id":"e49","region":"warehouse","type":"retriever","x":45,"y":50,"patrolRadius":2,"facing":"s"}],"rooms":[{"id":"apartment.bed1","building":"apartment","name":"卧室 1","rect":[6,8,9,11],"anchor":[8,10],"role":"卧室 1"},{"id":"apartment.bed2","building":"apartment","name":"卧室 2","rect":[11,8,14,11],"anchor":[13,10],"role":"卧室 2"},{"id":"apartment.hall","building":"apartment","name":"侧廊 · 北段","rect":[6,13,17,14],"anchor":[11,13],"role":"侧廊 · 北段"},{"id":"apartment.spine","building":"apartment","name":"侧廊 · 两格走廊","rect":[10,15,11,21],"anchor":[10,18],"role":"侧廊 · 两格走廊"},{"id":"apartment.kitchen","building":"apartment","name":"厨房","rect":[6,16,8,18],"anchor":[7,18],"role":"厨房"},{"id":"apartment.store","building":"apartment","name":"小储藏间","rect":[6,20,8,21],"anchor":[8,20],"role":"小储藏间"},{"id":"apartment.living","building":"apartment","name":"客厅","rect":[13,16,17,18],"anchor":[14,17],"role":"客厅"},{"id":"apartment.entry","building":"apartment","name":"门厅","rect":[12,20,17,21],"anchor":[15,20],"role":"门厅"},{"id":"clinic.waiting","building":"clinic","name":"候诊区","rect":[6,34,10,36],"anchor":[9,35],"role":"候诊区"},{"id":"clinic.treatment","building":"clinic","name":"诊疗室","rect":[6,38,10,40],"anchor":[7,38],"role":"诊疗室"},{"id":"clinic.pharmacy","building":"clinic","name":"药品储藏间","rect":[6,42,10,43],"anchor":[8,42],"role":"药品储藏间"},{"id":"clinic.service","building":"clinic","name":"后勤侧廊","rect":[12,34,13,43],"anchor":[12,37],"role":"后勤侧廊"},{"id":"bank.lobby","building":"bank","name":"营业厅","rect":[45,18,48,22],"anchor":[47,18],"role":"营业厅"},{"id":"bank.counter","building":"bank","name":"柜台区","rect":[45,23,48,25],"anchor":[48,24],"role":"柜台区"},{"id":"bank.office","building":"bank","name":"值班室","rect":[50,18,53,21],"anchor":[51,19],"role":"值班室"},{"id":"bank.store","building":"bank","name":"后仓","rect":[50,23,53,25],"anchor":[52,23],"role":"后仓"},{"id":"clockshop.lobby","building":"clockshop","name":"前厅","rect":[53,32,57,36],"anchor":[55,34],"role":"前厅"},{"id":"clockshop.counter","building":"clockshop","name":"柜台营业区","rect":[59,32,66,36],"anchor":[62,33],"role":"柜台营业区"},{"id":"clockshop.office","building":"clockshop","name":"办公室","rect":[53,38,56,40],"anchor":[54,40],"role":"办公室"},{"id":"clockshop.passage","building":"clockshop","name":"柜台后通道","rect":[58,38,59,40],"anchor":[58,38],"role":"柜台后通道"},{"id":"clockshop.security","building":"clockshop","name":"安保室","rect":[61,38,66,40],"anchor":[62,38],"role":"安保室"},{"id":"clockshop.service","building":"clockshop","name":"后勤环廊","rect":[54,42,59,45],"anchor":[57,44],"role":"后勤环廊"},{"id":"clockshop.vault","building":"clockshop","name":"金库 / 保险区","rect":[61,42,66,45],"anchor":[64,43],"role":"金库 / 保险区"},{"id":"warehouse.stock","building":"warehouse","name":"货架与工具区","rect":[40,45,47,52],"anchor":[44,48],"role":"货架与工具区"}],"bridges":[{"id":"north","name":"北石桥","rect":[29,12,36,15],"width":4,"tile":"=","risk":"低压，无固定堵桥怪"},{"id":"south","name":"南栈桥","rect":[29,40,36,42],"width":3,"tile":"-","risk":"暴露，邻接低地；没有固定桥头关卡"}],"tideReserve":{"implemented":false,"permanentWater":"~","note":"水面常态不可涉水；所有预留低地和南桥在本稿按正常可通行地形检查。","zones":[{"id":"south-lowland","name":"南桥东端低地","rect":[37,39,48,43]},{"id":"warehouse-lowland","name":"仓库东巷低地","rect":[49,43,51,49]},{"id":"west-stairs","name":"西岸阶梯","rect":[29,27,29,29]},{"id":"east-stairs","name":"东岸阶梯","rect":[36,23,36,25]}]},"districts":[{"key":"apartment","name":"老公寓","shape":"东北凹入后院、南侧门廊、储藏附属间","rect":[5,7,18,22],"loot":"normal","label":[12,6],"footprint":[[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[15,8],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],[12,10],[13,10],[14,10],[15,10],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11],[12,11],[13,11],[14,11],[15,11],[16,11],[17,11],[18,11],[5,12],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12],[12,12],[13,12],[14,12],[15,12],[16,12],[17,12],[18,12],[5,13],[6,13],[7,13],[8,13],[9,13],[10,13],[11,13],[12,13],[13,13],[14,13],[15,13],[16,13],[17,13],[18,13],[5,14],[6,14],[7,14],[8,14],[9,14],[10,14],[11,14],[12,14],[13,14],[14,14],[15,14],[16,14],[17,14],[18,14],[5,15],[6,15],[7,15],[8,15],[9,15],[10,15],[11,15],[12,15],[13,15],[14,15],[15,15],[16,15],[17,15],[18,15],[5,16],[6,16],[7,16],[8,16],[9,16],[10,16],[11,16],[12,16],[13,16],[14,16],[15,16],[16,16],[17,16],[18,16],[5,17],[6,17],[7,17],[8,17],[9,17],[10,17],[11,17],[12,17],[13,17],[14,17],[15,17],[16,17],[17,17],[18,17],[5,18],[6,18],[7,18],[8,18],[9,18],[10,18],[11,18],[12,18],[13,18],[14,18],[15,18],[16,18],[17,18],[18,18],[5,19],[6,19],[7,19],[8,19],[9,19],[10,19],[11,19],[12,19],[13,19],[14,19],[15,19],[16,19],[17,19],[18,19],[5,20],[6,20],[7,20],[8,20],[9,20],[10,20],[11,20],[12,20],[13,20],[14,20],[15,20],[16,20],[17,20],[18,20],[5,21],[6,21],[7,21],[8,21],[9,21],[10,21],[11,21],[12,21],[13,21],[14,21],[15,21],[16,21],[17,21],[18,21],[5,22],[6,22],[7,22],[8,22],[9,22],[10,22],[11,22],[12,22],[13,22],[14,22],[15,22],[16,22],[17,22],[18,22]]},{"key":"clinic","name":"小诊所","shape":"西南退角、独立后勤侧廊与东侧破口","rect":[5,33,14,44],"loot":"normal","label":[10,32],"footprint":[[5,33],[6,33],[7,33],[8,33],[9,33],[10,33],[11,33],[12,33],[13,33],[14,33],[5,34],[6,34],[7,34],[8,34],[9,34],[10,34],[11,34],[12,34],[13,34],[14,34],[5,35],[6,35],[7,35],[8,35],[9,35],[10,35],[11,35],[12,35],[13,35],[14,35],[5,36],[6,36],[7,36],[8,36],[9,36],[10,36],[11,36],[12,36],[13,36],[14,36],[5,37],[6,37],[7,37],[8,37],[9,37],[10,37],[11,37],[12,37],[13,37],[14,37],[5,38],[6,38],[7,38],[8,38],[9,38],[10,38],[11,38],[12,38],[13,38],[14,38],[5,39],[6,39],[7,39],[8,39],[9,39],[10,39],[11,39],[12,39],[13,39],[14,39],[5,40],[6,40],[7,40],[8,40],[9,40],[10,40],[11,40],[12,40],[13,40],[14,40],[5,41],[6,41],[7,41],[8,41],[9,41],[10,41],[11,41],[12,41],[13,41],[14,41],[5,42],[6,42],[7,42],[8,42],[9,42],[10,42],[11,42],[12,42],[13,42],[14,42],[7,43],[8,43],[9,43],[10,43],[11,43],[12,43],[13,43],[14,43],[7,44],[8,44],[9,44],[10,44],[11,44],[12,44],[13,44],[14,44]]},{"key":"bank","name":"银行旧址","shape":"临街橱窗展示面、前店后仓与侧向连门","rect":[44,17,54,26],"loot":"high","label":[49,16],"footprint":[[44,17],[45,17],[46,17],[47,17],[48,17],[49,17],[50,17],[51,17],[52,17],[53,17],[54,17],[44,18],[45,18],[46,18],[47,18],[48,18],[49,18],[50,18],[51,18],[52,18],[53,18],[54,18],[44,19],[45,19],[46,19],[47,19],[48,19],[49,19],[50,19],[51,19],[52,19],[53,19],[54,19],[44,20],[45,20],[46,20],[47,20],[48,20],[49,20],[50,20],[51,20],[52,20],[53,20],[54,20],[44,21],[45,21],[46,21],[47,21],[48,21],[49,21],[50,21],[51,21],[52,21],[53,21],[54,21],[44,22],[45,22],[46,22],[47,22],[48,22],[49,22],[50,22],[51,22],[52,22],[53,22],[54,22],[44,23],[45,23],[46,23],[47,23],[48,23],[49,23],[50,23],[51,23],[52,23],[53,23],[54,23],[44,24],[45,24],[46,24],[47,24],[48,24],[49,24],[50,24],[51,24],[52,24],[53,24],[54,24],[44,25],[45,25],[46,25],[47,25],[48,25],[49,25],[50,25],[51,25],[52,25],[53,25],[54,25],[44,26],[45,26],[46,26],[47,26],[48,26],[49,26],[50,26],[51,26],[52,26],[53,26],[54,26]]},{"key":"clockshop","name":"钟表店","shape":"东北切角、前厅门廊与南侧后勤入口","rect":[52,31,67,46],"loot":"normal","label":[60,30],"footprint":[[52,31],[53,31],[54,31],[55,31],[56,31],[57,31],[58,31],[59,31],[60,31],[61,31],[62,31],[63,31],[64,31],[65,31],[52,32],[53,32],[54,32],[55,32],[56,32],[57,32],[58,32],[59,32],[60,32],[61,32],[62,32],[63,32],[64,32],[65,32],[52,33],[53,33],[54,33],[55,33],[56,33],[57,33],[58,33],[59,33],[60,33],[61,33],[62,33],[63,33],[64,33],[65,33],[66,33],[67,33],[52,34],[53,34],[54,34],[55,34],[56,34],[57,34],[58,34],[59,34],[60,34],[61,34],[62,34],[63,34],[64,34],[65,34],[66,34],[67,34],[52,35],[53,35],[54,35],[55,35],[56,35],[57,35],[58,35],[59,35],[60,35],[61,35],[62,35],[63,35],[64,35],[65,35],[66,35],[67,35],[52,36],[53,36],[54,36],[55,36],[56,36],[57,36],[58,36],[59,36],[60,36],[61,36],[62,36],[63,36],[64,36],[65,36],[66,36],[67,36],[52,37],[53,37],[54,37],[55,37],[56,37],[57,37],[58,37],[59,37],[60,37],[61,37],[62,37],[63,37],[64,37],[65,37],[66,37],[67,37],[52,38],[53,38],[54,38],[55,38],[56,38],[57,38],[58,38],[59,38],[60,38],[61,38],[62,38],[63,38],[64,38],[65,38],[66,38],[67,38],[52,39],[53,39],[54,39],[55,39],[56,39],[57,39],[58,39],[59,39],[60,39],[61,39],[62,39],[63,39],[64,39],[65,39],[66,39],[67,39],[52,40],[53,40],[54,40],[55,40],[56,40],[57,40],[58,40],[59,40],[60,40],[61,40],[62,40],[63,40],[64,40],[65,40],[66,40],[67,40],[52,41],[53,41],[54,41],[55,41],[56,41],[57,41],[58,41],[59,41],[60,41],[61,41],[62,41],[63,41],[64,41],[65,41],[66,41],[67,41],[52,42],[53,42],[54,42],[55,42],[56,42],[57,42],[58,42],[59,42],[60,42],[61,42],[62,42],[63,42],[64,42],[65,42],[66,42],[67,42],[52,43],[53,43],[54,43],[55,43],[56,43],[57,43],[58,43],[59,43],[60,43],[61,43],[62,43],[63,43],[64,43],[65,43],[66,43],[67,43],[52,44],[53,44],[54,44],[55,44],[56,44],[57,44],[58,44],[59,44],[60,44],[61,44],[62,44],[63,44],[64,44],[65,44],[66,44],[67,44],[54,45],[55,45],[56,45],[57,45],[58,45],[59,45],[60,45],[61,45],[62,45],[63,45],[64,45],[65,45],[66,45],[67,45],[54,46],[55,46],[56,46],[57,46],[58,46],[59,46],[60,46],[61,46],[62,46],[63,46],[64,46],[65,46],[66,46],[67,46]]},{"key":"warehouse","name":"仓库兼工具铺","shape":"临河背面封闭，北侧装卸口与东侧门绕行","rect":[39,44,48,53],"loot":"normal","label":[44,43],"footprint":[[39,44],[40,44],[41,44],[42,44],[43,44],[44,44],[45,44],[46,44],[47,44],[48,44],[39,45],[40,45],[41,45],[42,45],[43,45],[44,45],[45,45],[46,45],[47,45],[48,45],[39,46],[40,46],[41,46],[42,46],[43,46],[44,46],[45,46],[46,46],[47,46],[48,46],[39,47],[40,47],[41,47],[42,47],[43,47],[44,47],[45,47],[46,47],[47,47],[48,47],[39,48],[40,48],[41,48],[42,48],[43,48],[44,48],[45,48],[46,48],[47,48],[48,48],[39,49],[40,49],[41,49],[42,49],[43,49],[44,49],[45,49],[46,49],[47,49],[48,49],[39,50],[40,50],[41,50],[42,50],[43,50],[44,50],[45,50],[46,50],[47,50],[48,50],[39,51],[40,51],[41,51],[42,51],[43,51],[44,51],[45,51],[46,51],[47,51],[48,51],[39,52],[40,52],[41,52],[42,52],[43,52],[44,52],[45,52],[46,52],[47,52],[48,52],[39,53],[40,53],[41,53],[42,53],[43,53],[44,53],[45,53],[46,53],[47,53],[48,53]]}]};
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

/* 容器类型 = 固定品质 + 固定类别奖池。品质绑定在类型上，不做二次随机：
   垃圾桶永远是废弃，医疗柜永远是优质，大型保险箱永远是秘藏。
   同一品质的容器掉率完全一致，cats 只决定"这一档里偏向哪个类别"。
   品质的具体概率见 js/config.js 的 CONTAINER_QUALITY。
   字模说明：单字符网格里 P / E / S / X 已被占用（P 出生点、E 撤离点、S 安全门、X 背景街坊），
   容器字模一律避开它们。三个同品质的"个人容器"用小写补位：b 纸箱、e 员工储物盒、m 帆布挎包。 */
/* ------------------------------------------------------------
   容器的独立奖池
   只有显式挂上 ammoPool / gearPool 的容器才会出弹药与装备，
   其余容器沿用原来的通用物品池。
   两个池的等级分布都由容器品质推导（见 Loot.rollAmmo / Loot.rollGear）：
   红档（r6）的份额并入金档（r5），所以只出到五级。
   ------------------------------------------------------------ */

/* 弹药池：chance 是「每次抽取走这个池」的概率；count 是各口径每组发数区间。 */
const AMMO_POOL = {
  chance: 0.25,
  count: { '545x39': [10, 20], '556': [10, 20], '762x39': [10,20], '9mm': [10, 20], '45acp': [10,20], '12g': [4, 8] }
};

/* 装备池：kinds 里等概率抽一种（头盔 / 护甲 / 背包 / 枪械），等级分布与同容器的弹药池一致。 */
const GEAR_POOL = {
  chance: 0.10,
  kinds: ['helmet', 'body', 'bag', 'gun']
};

/* 收藏近战：每具回收员尸体/每个防水补给箱额外判定一次，成功后等概率出一把。 */
const RARE_MELEE_POOL = { chance: 0.01, ids: ['melee03', 'melee07'] };

const CONTAINER_TYPES = {
  /* Ⅰ 废弃 */
  Z: { q: 'junk',   art: 'crate_trash',      name: '垃圾桶' },
  W: { q: 'junk',   art: 'crate_wastepaper', name: '废纸篓',     cats: ['intel', 'life'] },
  b: { q: 'junk',   art: 'crate_cardboard',  name: '遗弃纸箱' },
  U: { q: 'junk',   art: 'crate_workwear',   name: '遗落的工作服', cats: ['life', 'ind'] },

  /* Ⅱ 普通 */
  C: { q: 'plain',  art: 'crate_fast',       name: '抽屉' },
  T: { q: 'plain',  art: 'crate_tool',       name: '工具箱',     cats: ['ind'] },
  N: { q: 'plain',  art: 'crate_bedside',    name: '床头柜',     cats: ['life', 'med'] },
  e: { q: 'plain',  art: 'crate_staff',      name: '员工储物盒', cats: ['life', 'ind'] },
  m: { q: 'plain',  art: 'crate_satchel',    name: '帆布挎包',   cats: ['life', 'intel'] },

  /* Ⅲ 充实 */
  L: { q: 'ample',  art: 'crate_std',        name: '储物柜' },
  J: { q: 'ample',  art: 'crate_luggage',    name: '旅行箱',     cats: ['life', 'collect'] },
  F: { q: 'ample',  art: 'crate_filing',     name: '办公文件柜', cats: ['intel', 'life'] },
  D: { q: 'ample',  art: 'crate_schoolbag',  name: '运动包',     cats: ['life', 'intel'] },

  /* Ⅳ 优质 */
  M: { q: 'fine',   art: 'crate_med',        name: '医疗柜',     cats: ['med', 'medical'] },
  R: { q: 'fine',   art: 'crate_elec',       name: '电子设备柜', cats: ['elec', 'ind'] },
  H: { q: 'fine',   art: 'crate_emergency',  name: '急救器材箱', cats: ['med', 'medical'] },
  Q: { q: 'fine',   art: 'crate_military_supply', name: '军用物资箱',
       cats: ['elec', 'mil', 'intel'], rolls: [3, 4], ammoPool: AMMO_POOL, gearPool: GEAR_POOL },
  Y: { q: 'fine',   art: 'crate_rescuevest', name: '救援人员背心', cats: ['med', 'medical', 'ind'] },

  /* Ⅴ 贵重 */
  B: { q: 'rich',   art: 'crate_heavy',      name: '小型保险箱' },
  K: { q: 'rich',   art: 'crate_supply',     name: '防水补给箱',
       cats: ['life', 'med', 'medical', 'ind'], rolls: [3, 6], ammoPool: AMMO_POOL, gearPool: GEAR_POOL,
       bonusMeleePool: RARE_MELEE_POOL },
  G: { q: 'rich',   art: 'crate_jewelry',    name: '珠宝匣',     cats: ['collect', 'life'] },
  A: { q: 'rich',   art: 'crate_leatherbag', name: '皮质旅行包', cats: ['life', 'collect', 'med'] },

  /* Ⅵ 秘藏 —— 机密封存箱（I）暂时不进初始地图，留给封锁设施 */
  V: { q: 'secret', art: 'crate_safe_big',      name: '大型保险箱' },
  I: { q: 'secret', art: 'crate_sealed',     name: '机密封存箱', cats: ['intel', 'occult', 'odd'] },
  O: { q: 'secret', art: 'crate_diplomatic', name: '密封公文包', cats: ['intel', 'collect', 'occult'] }
};
/* 图格字符 → 容器品质（运行时 box.kind 存的就是品质名） */
const BOX_KIND = Object.fromEntries(Object.entries(CONTAINER_TYPES).map(([ch, type]) => [ch, type.q]));

/* ------------------------------------------------------------
   物品表
   cat  类别   r 稀有度(1-6)   w 重量(kg)   price 售价
   stack 堆叠上限——只有子弹写这个字段（其它物品一律一件一格，
         判定统一走 config.js 的 stackLimit()，别处别直接看 item.stack）
   use 可使用（消耗品）
   ------------------------------------------------------------ */
/* short：背包格子只有 38px 宽，名字超过四个字的写一个简称（没写就退回全名） */
/* BEGIN MEDICAL DATA */
const MEDICAL_GROUPS = {"recovery":"恢复治疗","painkiller":"止痛","trauma":"损伤处理","injection":"针剂","anomaly":"异常处理"};
const MEDICAL_ITEMS = [
  {
    "id": "heal01",
    "name": "绷带",
    "r": 1,
    "w": 0.2,
    "price": 2000,
    "medicalGroup": "recovery",
    "source": "通用医疗耗材",
    "heal": 20,
    "healStart": 2,
    "healRate": 10,
    "healCap": 20,
    "iconId": "heal01",
    "desc": "采用脱脂棉纱制成的标准医用绷带。工业化生产使得这种曾经昂贵的外科耗材成为每个家庭都能够负担的日用品。\n\n过去的纱布工厂常将质量不合格但仍可使用的边角料低价出售给附近居民。部分家庭会拿它们擦桌子、包裹易碎品，甚至制作窗帘。\n\n对纺织厂来说，这大概不算最理想的产品用途。",
    "visual": "白色卷状绷带，纸质封条，有一截松开的纱布。",
    "cat": "medical",
    "noCodex": true,
    "use": true
  },
  {
    "id": "heal02",
    "name": "安禾无菌敷料",
    "short": "无菌敷料",
    "r": 2,
    "w": 0.15,
    "price": 5000,
    "medicalGroup": "recovery",
    "source": "安禾制药",
    "heal": 60,
    "healStart": 1.8,
    "healRate": 12,
    "healCap": 60,
    "desc": "安禾制药的标准复合敷料，采用独立灭菌包装与防粘连吸收层。\n\n产品最初以「比母亲的拥抱更温柔」作为宣传口号，在上市后遭到家长团体投诉，认为该广告对母亲这一角色进行了不恰当的商品化。\n\n安禾随后将广告改为：\n\n「轻轻覆盖，让伤口安心休息。」\n\n但旧版包装依然在部分偏远地区流通。",
    "visual": "米白色医用纸袋，浅绿色安禾标志，一角印有旧式花朵广告图案。",
    "iconId": "heal02",
    "cat": "medical",
    "noCodex": true,
    "use": true
  },
  {
    "id": "heal03",
    "name": "家庭急救包",
    "short": "家庭急救",
    "r": 3,
    "w": 0.6,
    "price": 12000,
    "medicalGroup": "recovery",
    "source": "环礁湾公共卫生署",
    "heal": 120,
    "healStart": 1.5,
    "healRate": 15,
    "healCap": 120,
    "desc": "环礁湾公共卫生署发行的标准家庭急救套装，由多家本地医疗企业共同供应。\n\n盒盖上印有当年的公益宣传语：\n\n「意外无法预告，准备可以提前！家中常备急救包，平安健康每一天！」\n\n如遇紧急情况，请立即联系您所在街道的急救服务处。\n\n急救服务热线：123-1234\n\n服务时间：每周七天，全天候接听。\n\n该号码曾连续十三年出现在环礁湾的电视公益广告中。由于广告过于频繁，当地小学生甚至会把它编进跳绳歌里。",
    "visual": "红色硬塑料急救盒，白色十字和公益宣传贴纸，带有折叠提手。",
    "iconId": "heal03",
    "cat": "medical",
    "noCodex": true,
    "use": true
  },
  {
    "id": "heal04",
    "name": "制式野战医疗包",
    "short": "野战医包",
    "r": 4,
    "w": 1.2,
    "price": 35000,
    "medicalGroup": "recovery",
    "source": "军方制式物资",
    "heal": 200,
    "healStart": 1.2,
    "healRate": 20,
    "healCap": 200,
    "desc": "M-17 型野战医疗包，采用耐磨帆布与可拆卸内部隔层，适用于高湿度、低照度及缺乏固定医疗设施的环境。\n\n军需部门曾为这一型号提出二十七项改进要求，其中包括：\n\n「所有主要器械必须能够在佩戴手套时取出。」\n\n「包装开启时不得产生过量噪声。」\n\n「医疗标识应当在泥水浸泡后仍保持可辨认。」\n\n最后一项测试因采购部门忘记准备泥水，最终改在军营后方的排水沟内完成。",
    "visual": "深橄榄绿帆布包，白色医疗十字，黑色 M-17 编号及织带扣具。",
    "iconId": "heal04",
    "cat": "medical",
    "noCodex": true,
    "use": true
  },
  {
    "id": "heal05",
    "name": "HV-300 精密医疗箱",
    "short": "精密医箱",
    "r": 5,
    "w": 2.5,
    "price": 95000,
    "medicalGroup": "recovery",
    "source": "赫尔维恩医疗集团",
    "heal": 400,
    "healStart": 0.8,
    "healRate": 25,
    "healCap": 400,
    "desc": "赫尔维恩医疗集团为远洋科考船、极地研究站及特殊作业团队开发的模块化医疗系统。\n\nHV-300 的每个内部组件均经过独立编号，并附有对应的维护记录。根据制造商的宣传资料，其标准配置能够满足一支小型科考团队在远离医疗设施期间的基本急救需求。\n\n产品保修卡提供五年全球维修服务。\n\n在保修条款的第二十七条中，赫尔维恩特别注明：\n\n「因异常空间位移、不可预测的物理环境变化及未经认证的超自然干涉造成的损坏，不在标准保修范围内。」\n\n这条规定首次出现于环礁湾事故发生之前。",
    "visual": "银灰色硬质医疗箱，深翡翠绿品牌标志，黑色防撞包角和编号铭牌。",
    "iconId": "heal05",
    "cat": "medical",
    "noCodex": true,
    "use": true
  },
  {
    "id": "heal06",
    "name": "安禾止痛片",
    "short": "止痛片",
    "r": 1,
    "w": 0.05,
    "price": 2500,
    "medicalGroup": "painkiller",
    "source": "安禾制药",
    "reservedEffect": "基础镇痛，持续90秒。",
    "desc": "安禾制药最畅销的非处方药物之一，适用于常见的轻度疼痛症状。\n\n其早期电视广告因一句过于朗朗上口的宣传语而广为人知：\n\n「头疼？牙疼？哪儿都疼？安禾止痛，轻轻松松！」\n\n广告中的男演员在服药后立刻从病床上跳起，并连续完成了三个后空翻。\n\n卫生部门后来要求制造商撤下这一画面，理由是其可能对药物效果产生误导。",
    "visual": "银色六粒装药板，外包装为橙白配色，印有安禾的绿色叶形标志。",
    "iconId": "heal06",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal07",
    "name": "复方镇痛胶囊",
    "short": "镇痛胶囊",
    "r": 2,
    "w": 0.08,
    "price": 6000,
    "medicalGroup": "painkiller",
    "source": "广谱仿制药",
    "reservedEffect": "中等镇痛，持续180秒。",
    "desc": "一种采用缓释工艺生产的复方镇痛制剂，曾广泛供应工厂医疗站与职业健康机构。\n\n在工业化快速发展的年代，许多企业将缓解职业性肌肉疼痛视为提高生产效率的重要手段。某家大型机械厂甚至制定过专门的药品发放标准：\n\n「因连续作业而出现疼痛者，可向医务室领取两粒胶囊。若症状反复，应由车间主管决定是否调整工作岗位。」\n\n这项制度后来被废止。\n\n废止的不是药品发放标准，而是调整岗位的部分。",
    "visual": "棕色塑料药瓶，橙白双色胶囊，瓶身贴有蓝色条纹标签和通用药品编号。",
    "iconId": "heal07",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal08",
    "name": "强效镇痛剂",
    "short": "强效镇痛",
    "r": 3,
    "w": 0.12,
    "price": 18000,
    "medicalGroup": "painkiller",
    "source": "医院专供制剂",
    "reservedEffect": "强效镇痛，持续300秒。",
    "desc": "专供医疗机构使用的强效镇痛制剂，包装标有受控药物识别条纹。\n\n在一项临床观察中，一名受试者表示，药物让他能够平静地观察自己的伤口。\n\n研究人员询问他的疼痛程度，他回答：\n\n「我知道它应该很疼，但那似乎是另一个人的事情。」\n\n研究人员认为这是一次值得记录的主观体验变化，而不是异常现象。另一位研究者则在报告边缘批注：\n\n「请确认他说的『另一个人』是否仅为比喻。」",
    "visual": "深蓝色医药纸盒，白色药瓶，红色受控药物条纹与防误开瓶盖。",
    "iconId": "heal08",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal09",
    "name": "止血带",
    "r": 1,
    "w": 0.15,
    "price": 3000,
    "medicalGroup": "trauma",
    "source": "北辰医械",
    "reservedEffect": "控制严重肢体出血。",
    "desc": "北辰医械生产的标准应急止血带，采用高强度织带与金属旋紧机构。\n\n其产品手册的扉页引用了一位战地外科医生的话：\n\n「医学的首要任务并不是让人免于痛苦，而是让人活到能够讨论痛苦的时候。」\n\n这句话后来成为北辰医械的非正式企业格言。\n\n据说董事会曾提议把它印在公司年报封面上，最终因为市场部门认为「不够积极」而遭到否决。",
    "visual": "黑色止血带，暗银色旋杆，红色拉环，侧面有北辰的蓝色十字标志。",
    "iconId": "heal09",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal10",
    "name": "医用夹板",
    "r": 2,
    "w": 0.5,
    "price": 6000,
    "medicalGroup": "trauma",
    "source": "北辰医械",
    "reservedEffect": "临时固定骨折部位。",
    "desc": "采用柔性铝合金骨架与高密度泡棉制成的通用固定夹板。\n\n北辰医械曾邀请二百名普通市民参加产品测试，要求他们在没有专业指导的情况下完成模拟固定操作。\n\n最终测试表明，绝大多数受试者都能正确理解产品的基本用途。\n\n但有七人将夹板固定在了假人的另一条腿上，还有一人将它卷起来当作了枕头。",
    "visual": "蓝色泡棉包覆的长条夹板，银色金属边缘，附两条灰色固定带。",
    "iconId": "heal10",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal11",
    "name": "创伤处理包",
    "short": "创伤包",
    "r": 4,
    "w": 0.9,
    "price": 40000,
    "medicalGroup": "trauma",
    "source": "环礁湾紧急医疗部门",
    "reservedEffect": "综合处理常见创伤，具体适用状态待定。",
    "desc": "环礁湾首次大规模撤离期间发放的紧急创伤处理套装，包含多种独立封装的止血和创伤固定器材。\n\n最初的医疗保障计划要求每个避难点至少储备十二套。随着疏散人数增加，最低配额先后调整为六套、三套，最终改为「由各避难点根据实际情况自行决定」。\n\n最后一批物资清单注明：\n\n领取单位：第十七临时避难所\n\n发放数量：24 套\n\n签收日期：缺失\n\n清单末尾有一行手写备注：「货车司机把东西留在门口了。里面没有人出来领。」",
    "visual": "橙色帆布医疗包，黑色织带和白色十字，正面粘有物流标签与避难所编号。",
    "iconId": "heal11",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal12",
    "name": "外科手术包",
    "short": "手术包",
    "r": 5,
    "w": 1.6,
    "price": 110000,
    "medicalGroup": "trauma",
    "source": "北辰医械专业系列",
    "reservedEffect": "处理严重创伤，可能需要安全环境。",
    "desc": "专门为偏远地区医务人员开发的便携外科器械套装，配备多种无菌器械和基础手术用品。\n\n随箱手册的第一章并不介绍任何手术技巧，而是列举了十七种不应当在缺乏正规医疗条件的情况下实施手术的情形。\n\n第十八条写道：\n\n「如果您正在阅读本条，以判断自己是否具备手术资格，请立即寻求专业医疗援助。」",
    "visual": "深绿色手提式金属器械箱，内部排列着独立密封的外科工具和医用耗材。",
    "iconId": "heal12",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal13",
    "name": "H-7 应急医疗针",
    "short": "应急医针",
    "r": 3,
    "w": 0.15,
    "price": 25000,
    "medicalGroup": "injection",
    "source": "赫尔维恩医疗集团",
    "reservedEffect": "效果待定。",
    "desc": "赫尔维恩第七代自动注射系统，采用预装式药筒和弹簧驱动机构，旨在缩短紧急给药所需的准备时间。\n\n产品发布会上，首席工程师曾将一支注射器投入冰水桶，待众人确认它完全浸湿后取出，成功完成模拟注射。\n\n一名记者询问：\n\n「如果您的产品如此可靠，为什么还需要进行这种表演？」\n\n工程师回答：\n\n「因为我们无法把真正的紧急情况搬到发布会上。」",
    "visual": "象牙白笔状自动注射器，深绿色环形标识，银色保险盖。",
    "iconId": "heal13",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal14",
    "name": "M-4 代谢激活剂",
    "short": "代谢剂",
    "r": 4,
    "w": 0.1,
    "price": 65000,
    "medicalGroup": "injection",
    "source": "赫尔维恩特殊环境医学部门",
    "reservedEffect": "效果待定。",
    "desc": "赫尔维恩特殊环境医学部门开发的实验制剂，原定研究目标为短期生理状态调节。\n\n该项目经历了多次重新命名。\n\n第一版报告：《可控的代谢加速研究》\n\n第三版报告：《代谢加速与调节研究》\n\n第五版报告：《特殊生理状态观察》\n\n最新的内部档案只保留了一个名称：\n\nM-4。\n\n集团发言人对此表示：「项目名称的简化并不意味着研究方向发生变化。」",
    "visual": "透明玻璃安瓿瓶，琥珀色药液，翡翠绿细环及 M-4 字样。",
    "iconId": "heal14",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal15",
    "name": "R-9 再生试验剂",
    "short": "再生试剂",
    "r": 5,
    "w": 0.12,
    "price": 180000,
    "medicalGroup": "injection",
    "source": "赫尔维恩授权实验供应",
    "reservedEffect": "效果待定。",
    "desc": "R 系列组织修复研究的第九号候选制剂，仅向授权实验机构供应。\n\n一份内部实验报告记录：\n\n「受试组织在二十七小时内完成损伤区域的闭合。新生组织具有正常的细胞活性，但血管与神经纤维的排列方式和原始样本存在明显差异。」\n\n主任研究员在报告末尾批注：\n\n「我们要求的是修复，不是重新设计。」\n\n三天后，一份新的研究计划获得了批准。\n\n计划标题：《再生组织的功能独立性研究》。",
    "visual": "暗红色药液，银色保护框架，贴有红色 R-9 编号和实验警告标识。",
    "iconId": "heal15",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal16",
    "name": "镇静香膏",
    "r": 2,
    "w": 0.2,
    "price": 7000,
    "medicalGroup": "anomaly",
    "source": "百草堂",
    "reservedEffect": "效果待定。",
    "desc": "百草堂出售的传统草本香膏，据称配方来自沿海地区流传已久的「归魂术」。\n\n民间传说认为，人的灵魂在睡眠时会短暂离开躯体，某些受惊的灵魂则可能忘记返回的道路。\n\n香膏的气味能够引导迷失者回家。\n\n传统使用说明要求在睡前将少量香膏置于枕边，再由一位熟悉病人的亲属念出他的全名。\n\n使用说明的最后一行写着：\n\n「若有人从屋外应答，切勿开门。」",
    "visual": "深绿色玻璃药罐，黄铜旋盖，内有灰白色膏体，贴着百草堂的旧式草药标签。",
    "iconId": "heal16",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal17",
    "name": "认知稳定剂",
    "short": "认知剂",
    "r": 4,
    "w": 0.1,
    "price": 55000,
    "medicalGroup": "anomaly",
    "source": "不明研究机构",
    "reservedEffect": "效果待定。",
    "desc": "一种用于研究异常感知症状的试验性制剂，生产机构未在现存包装上完整标明。\n\n第十四次临床观察中，受试者在使用药物后恢复了正常的空间定位能力，能够准确辨认观察室内的家具与研究人员。\n\n但他仍然坚持认为房间里有第六个人。\n\n研究人员确认观察室内只有五人，并要求受试者指出第六人的位置。\n\n他指向一面镜子。\n\n记录人员随即询问：「您看到的是谁？」\n\n受试者回答：\n\n「就是你们正在记录的那个人。」",
    "visual": "白色小药瓶，蓝灰色几何图案，研究批次编号，内部装有淡蓝色片剂。",
    "iconId": "heal17",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  },
  {
    "id": "heal18",
    "name": "祛咒圣露",
    "r": 5,
    "w": 0.25,
    "price": 150000,
    "medicalGroup": "anomaly",
    "source": "来源不明的神秘学传承",
    "reservedEffect": "效果待定。",
    "desc": "一种在多个古代神秘学传统中均有记载的净化液。\n\n不同传承对其原料与配制步骤存在明显分歧。一些手抄本要求使用山泉水，另一些则主张取自退潮后的岩缝。\n\n然而，所有已知配方都保留着同一条规定：\n\n「最后一次祝祷，不得由配制者亲自完成。」\n\n某位神秘学研究者曾提出，所谓「最后一次祝祷」并非真正的仪式步骤，而是一个关于施术者身份的限制。\n\n他在论文末尾写道：\n\n「净化的对象不能同时成为净化的执行者。至少在仪式结束以前不能。」",
    "visual": "深蓝色细颈玻璃瓶，银色瓶口，古老封蜡，内部装有淡金色液体。",
    "iconId": "heal18",
    "cat": "medical",
    "noCodex": true,
    "use": false,
    "noLoot": true
  }
];
/* END MEDICAL DATA */

/* BEGIN ECONOMY SETTINGS */
const ECONOMY = {"version":1,"collectionBands":[{"rarity":1,"role":"基础杂物","min":1000,"max":3000},{"rarity":2,"role":"普通收益","min":4000,"max":9200},{"rarity":3,"role":"稳定收益","min":9000,"max":38000},{"rarity":4,"role":"主力收益","min":22000,"max":110000},{"rarity":5,"role":"高额收益","min":80000,"max":480000},{"rarity":6,"role":"极稀有大奖","min":200000,"max":null,"referenceUpper":3000000}],"doctor":{"serviceRate":0.25,"minimumBandageFraction":0.5}};
/* END ECONOMY SETTINGS */

const ITEMS = [
  ...MEDICAL_ITEMS,
  /* --- 生活用品（29 件）------------------------------------------------
     三层结构：基础层＝工业时代通用生活；文化层＝不同社会传统的交汇；
     独有层＝环礁湾自己的公共机构、商业传统与工艺史。
     逐件说明与移出 / 迁移记录见 design/items/LIFE_COLLECTIBLES.md。
     原 life34 搬家木箱及 17 件地域指向过强的器物已移出本类；
     life40 → elec05（掌机）、life42 → elec06（即影相机）、life35 → antiq06（釉色母版）。 */

  /* 餐饮与储物 */
  { id:'life01', name:'搪瓷缸',       cat:'life', r:1, w:0.4, price:1800,
    desc:'磕掉了一块瓷，露出底下的铁。里面的水早就干了。' },
  { id:'life06', name:'铝饭盒',       cat:'life', r:1, w:0.35, price:1400,
    desc:'盖子上敲了一串工号，敲得很深。厂子关了，号还留着。' },
  { id:'life04', name:'铁皮饼干盒', short:'铁皮盒',   cat:'life', r:2, w:0.7, price:5400,
    desc:'里面是针线，不是饼干。主人显然更常用针线。' },
  { id:'life08', name:'玻璃糖罐',     cat:'life', r:2, w:0.9,  price:4600,
    desc:'还剩半罐话梅糖，糖化了又凝住，把罐底和糖粘成一块。摇不动，也倒不出来。' },
  { id:'life20', name:'纪念瓷器套装', short:'瓷套装', cat:'life', r:4, w:4.2, price:45000,
    desc:'某家陶瓷厂为建厂纪念烧的礼盒，三十二件，一件没少。盘沿一圈海鸟和海浪，印花转贴，颜色压得很匀。摆开来能坐满一桌——桌子早就不在了。' },
  { id:'life28', name:'银餐具一套',   short:'银餐具', cat:'life', r:5, w:2.2, price:250000,
    desc:'纯银的。刀叉勺各十二副，一格一副压在绒布上，手柄背面都打着成色印记。绒布只有浅浅的压痕，看来没人真的用过。' },

  /* 家居与衣物 */
  { id:'life03', name:'老式台灯',     cat:'life', r:2, w:1.6, price:4800,
    desc:'灯罩烧黑了。插头还在墙上，墙已经不在了。' },
  { id:'life05', name:'未拆封的毛巾', short:'新毛巾', cat:'life', r:2, w:0.3, price:4000,
    desc:'二十年前的赠品，包装上还印着商场开业广告。' },
  { id:'life11', name:'双铃闹钟',     cat:'life', r:3, w:0.6, price:12000,
    desc:'分针的传动齿轮缺了一齿，每转到 5:47 就卡住。上紧发条还能走，走到那个位置照样停。修表匠在背面贴了张纸条：齿轮缺一齿，非磁化，非进水。' },
  { id:'life15', name:'古董电熨斗',   short:'电熨斗', cat:'life', r:3, w:1.6, price:11500,
    desc:'厚重金属壳，胶木手柄，调温旋钮只剩三档还标得出温度。底面磨得发亮，像一面照不出人的镜子。' },
  { id:'life19', name:'老式缝纫机头', short:'缝纫机', cat:'life', r:4, w:2.8, price:48000,
    desc:'黑色铸铁机头，侧面的金色贴花磨得只剩几段线。转一圈手轮，针还跟着上下，线早没了。铸铁底座留在原地——只搬得动机头。' },
  { id:'life22', name:'手工丝绸礼服', short:'礼服',   cat:'life', r:4, w:0.4, price:62000,
    desc:'深色丝绸。立领和盘扣是手工缝的，肩线与袖笼却按另一种裁剪法做成——两种做法在一件衣服上并存，看不出是谁改的。挂在衣柜最里面，樟脑味还没散。袖口有一块同色补丁，针脚比原厂的还细。' },

  /* 儿童与娱乐 */
  { id:'life10', name:'玻璃弹珠袋',   short:'弹珠',   cat:'life', r:2, w:0.15, price:4200,
    desc:'布袋里二十六颗，数过。最大的那颗里面有三道彩纹，谁赢到它就不肯再玩了。' },
  { id:'life13', name:'铁皮玩具火车', short:'小火车', cat:'life', r:3, w:0.5,  price:14500,
    desc:'发条还能转。放手之后它往左歪，一直歪，撞到墙才停。' },
  { id:'life41', name:'家庭磁带盒',   short:'磁带盒', cat:'life', r:3, w:0.65, price:13000,
    desc:'塑料收纳盒里装着六盘录音磁带，标签分别写着「生日」「夏季旅行」「电话录音」「音乐」「会议」和「不要听」。\n\n最后一盘被倒着放进盒里，标签上的字迹已经被擦掉了一半。' },
  { id:'life43', name:'发条旋转木马', short:'木马',   cat:'life', r:5, w:0.8,  price:110000,
    desc:'限量生产的机械玩具，手工上色的金属底座，微型齿轮传动。\n\n厂里的记录写着：最初版本要连续转动发条二十三圈才能奏完一首乐曲，后来调整齿轮比，减到十一圈。\n\n部分收藏者坚持认为，第一版的速度更接近真正的游乐场。' },

  /* 城市公共生活 */
  { id:'antiq03',name:'磨损的硬币', short:'旧硬币',   cat:'life', r:1, w:0.02, price:1200,
    desc:'通缩时代的零钱。到处都有。' },
  { id:'life36', name:'折叠城市地图', short:'城市地图', cat:'life', r:2, w:0.08, price:4400,
    desc:'环礁湾旅游事务局发行的第十二版城市导览图。地图背面列有四十七处值得游览的地点，其中二十三处是餐厅，十五处是购物中心。\n\n印刷商在封底写道：\n\n「环礁湾，一座不会让您迷路的城市。」' },
  { id:'life37', name:'售票检票钳',   short:'检票钳', cat:'life', r:3, w:0.35, price:10000,
    desc:'曾用于城市公交与近郊铁路的机械检票工具，不同线路采用不同的打孔形状。\n\n交通部门曾规定，检票员每班至少要检查一次设备，以防乘客使用事先打孔的旧车票冒充新票。\n\n一位工作了三十二年的老检票员在退休采访中表示：\n\n「我从来没有抓到过这样的乘客，但我每天都检查。」' },
  { id:'life38', name:'按键式电话机', short:'电话机', cat:'life', r:3, w:0.9,  price:13500,
    desc:'广泛安装于办公室、旅馆和私人住宅的固定电话机，带重拨功能，可储存十组常用电话号码。\n\n制造商建议把第一个储存位置设为紧急联系人。\n\n这台电话的第一个号码是 123-1234。' },
  { id:'life47', name:'经理日程簿',   short:'日程簿', cat:'life', r:4, w:0.4, price:26000,
    desc:'皮面日程簿，附金属书签和地址索引页。每年的最后一页都印着同一句话：\n\n「明年的今天，您会感谢今天努力的自己。」\n\n这一页被原主人撕掉了。其余页面保留着整齐的会议安排、聚餐记录和私人约会。某个星期五的下午被反复涂改了六次，最后写成「休息」。' },

  /* 港口、旅馆与服务业 */
  { id:'life44', name:'船员帆布包',   short:'帆布包', cat:'life', r:3, w:1.1, price:15000,
    desc:'厚帆布缝的圆筒形行李包，常见于远洋货船与沿海客轮。包底印过三个船名，最早的两个已经被墨水涂掉。\n\n船员们习惯说，行李包只要还能用，就没有理由跟着主人一起退休。' },
  { id:'life45', name:'旅馆服务铃',   short:'服务铃', cat:'life', r:2, w:0.35, price:5200,
    desc:'旅馆前台、邮政窗口和小型商店常见的机械呼叫铃。\n\n某家旅馆的服务守则规定：旅客第一次按铃后，接待员应在三十秒内作出回应；第二次按铃后，则应立即出现。\n\n守则没有规定第三次按铃该怎么办。' },
  { id:'life46', name:'旅行洗漱套装', short:'洗漱包', cat:'life', r:4, w:0.65, price:22000,
    desc:'深色皮革包，内装折叠牙刷、金属剃须刀、便携镜和几个小型容器。皮包内侧烫着旅馆的名称与房间号码。\n\n这不是酒店赠品。房间号码下面还印着一句：\n\n「请您在离店时将本套用品留在房间内。」' },
  { id:'life39', name:'旅行保温杯',   short:'保温杯', cat:'life', r:3, w:0.45, price:11000,
    desc:'双层不锈钢保温容器，旋转式密封盖，曾受到长途司机、通勤职员和夜班工人的欢迎。\n\n盖子里卡着一小片纸，上面写着：\n\n「别再把咖啡洒在车上了。——维修部」' },
  { id:'life32', name:'真皮手提箱',   short:'手提箱', cat:'life', r:5, w:1.8, price:125000,
    desc:'黄铜锁扣，钥匙还插在锁上。里面是空的，衬里还留着香水味。' },

  /* 高价值器物 */
  { id:'life33', name:'金丝眼镜',     cat:'life', r:5, w:0.03, price:95000,
    desc:'实金细框，镜腿内侧打着成色戳记，两片镜片都是手工磨边的。左眼的度数比右眼深很多。' },
  { id:'life48', name:'便携式打字机', short:'打字机', cat:'life', r:5, w:3.1, price:160000,
    desc:'早期便携式机械打字机，全金属机芯，可折叠字杆，机身是制造商特有的深蓝色烤漆。\n\n这一型号因键盘手感极佳，受到记者、作家和外勤工作人员的欢迎。原厂宣传册里写着：\n\n「它不能代替您思考，但能保证您的思想以最清晰的方式留在纸上。」\n\n某位评论家对此的评价是：\n\n「能够清晰地印下蠢话，恐怕算不上什么进步。」' },
  { id:'life49', name:'零号打火机',   short:'零号机', cat:'life', r:6, w:0.15, price:900000,
    desc:'某金属制品厂正式量产前做的第一件机械打火机原型。底部没有商标，只有一行手工敲出的编号：NO. 000。\n\n与后来的量产型号不同，原型机的点火机构完全外露，开盖时会发出两声清脆的金属碰响。\n\n厂史记载，这个设计最初被董事会否决。理由不是成本，也不是结构可靠性，而是一位董事认为：\n\n「打火机的声音不应该比使用者说话的声音更好听。」\n\n后来的市场调查表明，消费者恰恰非常喜欢这种声音。' },

  /* --- 电子产品 --- */
  { id:'elec01', name:'收音机',       cat:'elec', r:2, w:0.9, price:7500, desc:'调到中波能听见东西。不是电台，是回响。' },
  { id:'elec02', name:'随身听',       cat:'elec', r:4, w:0.35,price:30000, desc:'磁带还在里面。按播放键能出声，所以它很值钱——也很有用。' },
  { id:'elec03', name:'计算器',       cat:'elec', r:2, w:0.2, price:5000,  desc:'屏幕上留着最后一次运算的结果：0。' },
  { id:'elec04', name:'电路板',       cat:'elec', r:2, w:0.5, price:6200, desc:'实验所的标准件，外面已经没人生产了。' },
  /* 家用电子：从生活用品库迁入，消费电子需要娱乐分支，而不是只有电路板与仪器 */
  { id:'elec05', name:'掌上电子游戏机', short:'掌机', cat:'elec', r:4, w:0.28, price:36000,
    desc:'单色液晶显示屏的便携电子游戏设备，内置一款航海题材的小游戏：控制一艘小船，在涨潮之前收集散落在海面上的货物。\n\n某家游戏杂志给它打了三分，满分十分。编辑写道：\n\n「操作迟钝，画面简陋，但潮水来临时的音效令人印象深刻。」' },
  { id:'elec06', name:'即影相机',     short:'即影相机', cat:'elec', r:4, w:0.75, price:52000,
    desc:'使用专用感光材料的即时成像相机。按下快门后，照片会从机身前端缓慢吐出，并在数分钟内显现影像。\n\n制造商在产品广告中承诺：\n\n「不必等待冲洗，让美好的瞬间立即成为永恒。」\n\n环礁湾一家婚礼摄影工作室曾一次采购八十台，其中三十七台在不到一个月内被顾客带走，再未归还。' },

  /* 精选电子：专业设备与记录器材，价格明显高于家用消费电子。
     见 design/items/ELECTRONICS.md */
  { id:'elec07', name:'电子宠物机', short:'宠物机', cat:'elec', r:3, w:0.08, price:18000,
    desc:'一款已经停产的初代电子宠物机，拥有单色点阵屏幕和三枚功能按钮。\n\n产品最初以「培养孩子的责任心」为宣传卖点。\n\n某所小学后来禁止学生携带这种玩具进入课堂，因为期末考试期间，考场里连续响起了十七次电子宠物的求救提示音。校方要求制造商提供静音功能。制造商回复：\n\n「我们认为，责任不应该被静音。」' },
  { id:'elec08', name:'微型录像机', short:'录像机', cat:'elec', r:3, w:1.3,  price:24000,
    desc:'一台使用小型录像带的便携式录像设备，能够连接摄像机或电视进行录制与播放。\n\n机身贴着一张租赁公司的标签，背面印有使用须知：\n\n「退还设备前，请确认已取出私人录像带。」\n\n下方有人用圆珠笔添了一句：\n\n「尤其是婚礼录像。」' },

  { id:'elec09', name:'加密寻呼机', short:'寻呼机', cat:'elec', r:4, w:0.18, price:48000,
    desc:'一款面向企业和公共机构的特殊寻呼终端，能够接收经过编码处理的短消息。与普通寻呼机不同，设备需要配套的解码模块才能完整显示消息内容。\n\n生产商曾将其宣传为「让重要信息只被重要的人看见」。\n\n某家企业采购了四百台，随后发现所有管理人员都忘记了自己的识别密码。技术支持部门建议统一重置密码。企业最终决定恢复使用纸质通知。' },
  { id:'elec10', name:'便携式计算机', short:'便携电脑', cat:'elec', r:4, w:3.2, price:86000,
    desc:'一种早期便携式个人计算机，配备单色液晶显示屏、内置软盘驱动器和可更换电池组。\n\n制造商在产品发布会上宣称：\n\n「从今天起，办公室将不再受墙壁限制。」\n\n一位科技记者在评测中指出，这台电脑虽然确实能够带出办公室，但电池只能支持约两个小时，而充电器比机器附赠的公文包还重。' },
  { id:'elec11', name:'短波通信电台', short:'短波电台', cat:'elec', r:4, w:2.6,  price:72000,
    desc:'一种用于远距离无线电通信的便携式短波电台，常见于远洋船舶、野外调查队和专业无线电爱好者。\n\n频率调节旋钮旁贴着一张旧纸条：\n\n「听到第三次呼叫，再回答。」\n\n纸条没有署名。设备的维修记录则表明，它曾被送修过两次，故障原因均为发射功率不足。' },

  { id:'elec12', name:'航海电子定位仪', short:'定位仪', cat:'elec', r:5, w:1.6, price:165000,
    desc:'一种用于远洋船舶的专业电子导航设备，能够保存航点坐标、航行路线与历史定位数据。\n\n设备曾安装于一艘退役的海洋调查船，内部存储着十二条航行路线。十一条以港口名称命名，最后一条只有一个数字编号。\n\n维修人员曾尝试恢复该路线的目的地信息，但储存区已经被覆盖。' },
  { id:'elec13', name:'多通道数据记录器', short:'记录器', cat:'elec', r:5, w:2.8, price:260000,
    desc:'一种用于科研机构的多通道实验数据采集设备，能够同时读取多个传感器的测量结果，并将其保存于磁性存储介质。\n\n设备的校准单记录着最近一次检测结果：\n\n「输入通道正常，存储单元正常，内部时钟误差在允许范围内。」\n\n检测员在签名栏下方另加了一行：\n\n「下次请把传感器也一起送来。我们只能保证机器正常，不能保证你测量的东西正常。」' },

  { id:'elec14', name:'原型信号分析终端', short:'分析终端', cat:'elec', r:6, w:4.6, price:880000,
    desc:'一台采用模块化结构的实验性信号处理终端，配备高精度时钟、独立数据采集系统与可替换的模拟滤波组件。\n\n设备没有正式产品型号，金属铭牌上仅刻着：\n\n「工程验证机 · 01」\n\n随附的技术交接文件表明，该设备原本用于测试一种尚未投入量产的宽频信号采集方案。项目最后一次审查中，研发组认为设备已经验证了技术可行性，应该继续投入资金完善。财务部门则指出，相同预算足以采购六台性能更好的现成设备。\n\n审查结论只有两行：\n\n「终止量产计划。」\n「保留原型机及全部测试数据。」' },
  { id:'elec15', name:'「远望者」深海探测核心', short:'远望者', cat:'elec', r:6, w:3.8, price:2650000,
    desc:'「远望者」是某项深海探测工程中唯一完成全部海试的原型信号处理核心。\n\n其主体采用钛合金耐压壳体，内部装有多层陶瓷电路板、精密石英时钟和专为深海弱信号采集设计的模拟放大组件。制造过程中，工程师必须将每个信号通道单独校准，再以人工焊接的方式完成最终连接。\n\n整套设备原计划用于海底地质勘测，以解决深水环境下微弱电磁信号难以稳定记录的问题。\n\n项目历时十一年，经历四次设计推翻、七次原型试制。最初的六台原型机分别因为耐压壳体失效、信号干扰和制造误差而被淘汰。第七台，也就是「远望者」，最终完成了全部预定测试。\n\n在工程验收仪式上，项目负责人没有发表演讲，只播放了一段来自海底的原始探测数据。整整四分钟，显示屏上只有极其微弱的波形。\n\n有人问他：\n\n「花了十一年，就为了得到这些？」\n\n他回答：\n\n「十一年前，我们连这些都看不见。」\n\n后来，项目因经费与设备维护成本问题被迫终止。「远望者」作为唯一完成验收的原型机，被保存在工程档案库中。随设备保存的最后一份文件，是项目组的解散通知。通知末尾附有一段没有署名的手写文字：\n\n「我们并没有找到想找的东西。」\n「但至少，现在我们知道该往哪里看了。」' },

  /* --- 工业器材 --- */
  { id:'ind01',  name:'铜管',         cat:'ind',  r:1, w:3.4, price:3000,  desc:'一段从旧管道上切下来的铜管，切口还留着锯齿。外壁氧化发暗，内侧却依然泛着金属光泽。管口残留着一圈干硬的密封材料。' },
  { id:'ind02',  name:'轴承',         cat:'ind',  r:2, w:2.2, price:5600, desc:'转起来还是顺的。手指一推能转很久。' },
  { id:'ind03',  name:'压力表',       cat:'ind',  r:3, w:1.1, price:14500, desc:'一只工业弹簧管压力表，表盘玻璃已经碎裂，指针停在量程上限。内部测压机构可能曾遭受过载，单凭指针位置已无法判断最后一次实际压力。' },
  /* 工业器材扩充：基础耗材 → 精密计量，见 design/items/INDUSTRIAL.md */
  { id:'ind04',  name:'生锈的螺栓', short:'螺栓', cat:'ind', r:1, w:0.3, price:1200,
    desc:'一把大小不一的六角螺栓，螺纹上沾满了红褐色铁锈。其中有一颗的螺母怎么拧也拧不下来。' },
  { id:'ind05',  name:'混凝土试块', short:'试块', cat:'ind', r:1, w:2.4, price:1600,
    desc:'建筑工地浇筑的混凝土强度试样，侧面喷着施工批次和取样日期。试块一角已经崩落，露出内部粗细不一的骨料。原本用于抗压检测，如今已经无法确认是否通过验收。' },
  { id:'ind06',  name:'钢筋边角料', short:'钢筋', cat:'ind', r:1, w:2.8, price:2400,
    desc:'几段施工后留下的螺纹钢筋，切口参差不齐，其中一根已经弯了。\n\n长度不够用于正常施工，重量倒是一点没少。' },

  { id:'ind07',  name:'绝缘胶带', short:'胶带', cat:'ind', r:2, w:0.2, price:4200,
    desc:'两卷黑色工业绝缘胶带，外包装已经拆开。其中一卷只剩不到一半，胶带边缘沾着细小的金属粉末。另一卷还保留着原厂包装，塑封上印着耐压等级与生产批号。' },
  { id:'ind08',  name:'黄铜阀门', short:'阀门', cat:'ind', r:2, w:1.4, price:6800,
    desc:'一只拆卸下来的黄铜截止阀，阀杆仍能正常转动。连接口残留着旧密封材料。\n\n阀体侧面有一道扳手留下的深划痕。看来拆下来比装上去费劲。' },
  { id:'ind09',  name:'电焊面罩', short:'面罩', cat:'ind', r:2, w:0.7, price:7200,
    desc:'一只手持式焊接防护面罩，深绿色滤光玻璃已经被烟尘熏得发暗，观察窗边缘布满细小的焊渣灼痕。手柄外面缠着一层旧胶布，掌心接触的位置磨得格外光滑。' },

  { id:'ind10',  name:'精密游标卡尺', short:'卡尺', cat:'ind', r:3, w:0.35, price:16000,
    desc:'一把经过精细研磨的不锈钢游标卡尺，量爪闭合时几乎看不见缝隙。游标刻线清晰，滑尺移动平稳。木质收纳盒里附有校准证书，记录的测量误差仍处于规定公差范围内。' },
  { id:'ind11',  name:'工业陶瓷轴套', short:'轴套', cat:'ind', r:3, w:0.8, price:24000,
    desc:'采用高纯度氧化铝陶瓷烧结而成的精密轴套，内孔经过精细研磨，表面呈均匀的乳白色。它能够在高温、腐蚀性介质和长期摩擦环境中保持尺寸稳定，但陶瓷材料仍然容易因剧烈冲击而破裂。' },

  { id:'ind12',  name:'液压控制阀组', short:'阀组', cat:'ind', r:4, w:3.2, price:58000,
    desc:'一套从港口起重设备上拆卸下来的液压控制阀组。钢制阀体采用模块化结构，多个黄铜接头分别连接不同的压力回路。\n\n其中两组接头的密封圈曾被更换，拆卸螺栓上留下了反复拧紧的痕迹。阀体底部仍积着一层黏稠的旧液压油。' },
  { id:'ind13',  name:'高纯度钛合金锭', short:'钛合金锭', cat:'ind', r:4, w:1.6, price:85000,
    desc:'一块经过真空熔炼与成分检验的航空级钛合金材料，表面保留着铸造批号与检测钢印。\n\n这种材料兼具高比强度和良好的耐腐蚀性能，常用于对重量和结构可靠性要求严格的精密制造项目。原厂附带的材料合格证明仍封存在包装袋中。' },

  { id:'ind14',  name:'精密陀螺组件', short:'陀螺组件', cat:'ind', r:5, w:2.1, price:240000,
    desc:'用于高精度惯性导航设备的机械陀螺组件，内部由高速转子、精密轴承和稳定支架构成。\n\n该型号原本只供应专业航空及海洋工程设备制造商。为降低旋转阻力，制造厂要求转子在专用恒温车间内完成最终动平衡校准。\n\n厂方出具的检测证明显示：\n\n「高速运转稳定性：合格。」\n「动平衡校准：合格。」\n「环境适应性测试：合格。」\n\n最后一栏是检测员的签名。签名下方另有一行小字：\n\n「请务必确认运输人员知道，这不是普通机械零件。」' },

  { id:'ind15',  name:'零号标准量块组', short:'零号量块', cat:'ind', r:6, w:3.6, price:720000,
    desc:'一套由环礁湾某精密制造联合实验室保存的原始长度标准量块，采用高稳定性合金制造，经过长期温度控制、精密研磨及多次计量校准。\n\n该套量块最初用于建立实验室内部的长度测量基准。在随后的三十多年里，数以千计的工业测量工具通过与这一套标准量块进行比较，完成校准和误差修正。\n\n实验室曾计划更换新的基准体系，但由于原有量块精度长期保持稳定，更新计划被多次推迟。\n\n在最后一次年度检定中，技术人员发现其中一块量块的表面出现了一道极浅的划痕。按照规定，这块量块应立即退出最高精度用途。\n\n会议记录显示，主任工程师拒绝了继续修磨的建议：\n\n「它已经告诉过我们三十多年，一毫米应该有多长。」\n\n「现在轮到我们尊重它的误差了。」\n\n整套量块最终被封存于专用恒温箱中，并附有完整的计量记录。' },

  /* --- 医疗物资 --- */
  { id:'med02',  name:'注射器',       cat:'med',  r:2, w:0.15,price:5800,
    desc:'一支保存于独立包装中的医用注射器。针筒刻度清晰，推杆仍能正常活动。' },
  { id:'med03',  name:'X 光片',       cat:'med',  r:2, w:0.1, price:6000,
    desc:'一张装在牛皮纸袋里的医学 X 光胶片。边角微微卷起，透过光线还能辨认出骨骼轮廓。' },

  /* 医疗收集品扩充：科室器材与科研标本，均不可用于局内治疗。见 design/items/MEDICAL_COLLECTIBLES.md */
  { id:'med06',  name:'组织切片标本盒', short:'切片盒', cat:'med', r:4, w:0.6, price:42000,
    desc:'十二张玻璃载片，一张不少。盒盖内侧贴着病理研究项目的原始分类表，切片顺序与实验室留存的图谱完全一致。\n\n右下角那格空着，旁边写了个很小的「借出」，又被划掉了。' },
  { id:'med07',  name:'多参数生命监护仪', short:'监护仪', cat:'med', r:4, w:3.4, price:76000,
    desc:'赫尔维恩的床旁监护设备，能够同时显示心电、血氧、脉搏和血压。\n\n外壳已经发黄，导联线却是后换的，颜色新得扎眼。设备科在保养记录里写过一句：\n\n「报警太频繁，不一定是机器的问题。」' },
  { id:'med08',  name:'精密显微镜物镜组', short:'物镜组', cat:'med', r:4, w:0.8, price:88000,
    desc:'四枚由专业光学工坊制造的高倍显微镜物镜，分别采用不同的光学结构和校正方式。\n\n最高倍率的一枚为油浸物镜，前端镜片经过特殊镀膜处理。四枚物镜均保留原厂编号，金属镜筒上的倍率刻字清晰可辨。\n\n防潮盒内衬已经发黄，镜片倒是干净得很。' },
  { id:'med13',  name:'便携式心脏除颤仪', short:'除颤仪', cat:'med', r:4, w:5.5, price:98000,
    desc:'北辰医械为院前急救开发的轻量化除颤监护仪，采用紧凑式储能组件与可更换电池组。\n\n箱体四角都有磕痕，两只电极板的手柄磨得发白。它曾固定在急救车左侧柜的第二层，连同固定支架一起被拆了下来。' },

  { id:'med10',  name:'精密注射泵', short:'注射泵', cat:'med', r:3, w:1.8, price:28000,
    desc:'北辰医械生产的精密注射泵，利用步进电机和机械推进机构控制药液输注速度。机身采用耐消毒剂的工程塑料，推进滑轨经过长期使用，仍没有明显松动。\n\n夹臂内侧留着两道不同规格注射器的压痕，调速按键上的数字却已经磨得不太清楚。' },
  { id:'med15',  name:'便携式心电图机', short:'心电图机', cat:'med', r:3, w:2.4, price:32000,
    desc:'前端还卡着半截热敏纸，纸上印着一串突然中断的波形。\n\n机身背面贴着资产标签和清洁规程，提手位置磨得最厉害。看来它经常被拎着跑。' },

  { id:'med09',  name:'人工心脏瓣膜', short:'瓣膜', cat:'med', r:5, w:0.15, price:175000,
    desc:'独立无菌包装，批号、规格、植入方向标识都还清楚。\n\n医用热解碳制成的两片瓣叶在透明保护壳中闭合，薄得像两片削过的黑色指甲。外周缝合环完整，尚未留下使用痕迹。\n\n赫尔维恩将这类植入器械的质检记录单独归档，不与普通耗材混放。' },
  { id:'med11',  name:'机械循环辅助泵', short:'循环泵', cat:'med', r:5, w:3.2, price:360000,
    desc:'赫尔维恩医疗集团实验部门研发的离心式血液循环辅助泵原型总成，采用精密驱动组件与特殊表面处理工艺，旨在降低血液流经泵体时受到的机械损伤。\n\n早期测试采用五档控制模式，后来逐步简化为两档，以减少临床人员在紧急情况下的操作负担。\n\n该型号未进入大规模生产，但相关测试成果被用于后续生命支持设备的研发。' },
  { id:'med14',  name:'重症呼吸机控制主机', short:'呼吸机', cat:'med', r:5, w:4.5, price:230000,
    desc:'北辰医械后期生产的重症呼吸机控制主机，能够调节通气参数并监测气道压力，原本安装于医院重症监护病房。\n\n这一代产品以电子控制模块替代了部分传统气动调节机构，操作面板因此比旧型号简洁许多。\n\n机身侧面仍保留着一次升级改造的检修标签。标签上的设备编号已经褪色，型号栏却被重新描过。' },

  { id:'med12',  name:'「初生」零号培养样本', short:'初生样本', cat:'med', r:6, w:1.1, price:1200000,
    desc:'一件早期组织工程研究计划遗留下来的原始实验标本，由透明树脂包埋块、固定保存的人工培养组织及完整的编号铭牌组成。\n\n它是该研究机构首次证明特定三维组织培养方法具备实际可行性的原始实物。后续研究论文、技术改进与专利资料均可追溯到这次实验，随标本保存的还有完整的培养记录与检验数据。\n\n透明树脂里封着一小块浅粉色组织，编号是「00」。\n\n它不是最成熟的样本，也不是最好看的那一个。后来制造出的成品比它更稳定、更规整，也更接近研究目标。\n\n它被保留下来，只因为它是第一次。\n\n研究记录里，项目负责人最初写的是：\n\n「结构不理想。」\n\n后面又改成：\n\n「已形成稳定三维形态。」\n\n再后来，那两句都被划掉，只剩下一行字：\n\n「可以继续了。」' },

  /* --- 文物藏品 --- */
  { id:'antiq01',name:'座钟',         cat:'collect',r:4, w:4.5, price:56000,
    desc:'一台采用实木雕花外壳与黄铜机械机芯的老式座钟，钟摆由独立玻璃门保护。\n\n指针停在一个接近满潮的时刻。没人知道它究竟停了多久，发条早已松尽。' },
  { id:'antiq02',name:'黄铜怀表',     cat:'collect',r:3, w:0.2, price:17000,
    desc:'表盖内侧刻着两个字母，磨得只剩下一个。' },
  { id:'antiq04',name:'错版硬币',     cat:'collect',r:5, w:0.02,price:80000,
    desc:'一枚发生明显偏心冲印的流通硬币，图案偏离币面中心，部分外缘没有完整压出。\n\n据钱币收藏者整理的资料，同批次确认存世的错版币不足百枚。至于还有多少枚流落在外，始终没有定论。' },
  { id:'antiq05',name:'门牌铜片',     cat:'collect',r:2, w:0.3, price:5500,
    desc:'「临海路 7 号」。\n\n门牌还在，路早就没了。' },
  /* 工艺史孤品：从生活用品库迁入，靠制作身份而非材质立足 */
  { id:'antiq06',name:'工业釉色母版', short:'釉色母版', cat:'collect', r:6, w:0.5, price:400000,
    desc:'一块用于制定工业釉色标准的原始金属母版，表面分格烧制了十余种釉面试样，每格旁边都用耐热颜料标注着编号。\n\n它出自环礁湾一家曾以特殊釉面工艺闻名的老牌制造厂，是该厂首次完成相关工艺标准化时保留下来的原始实物。\n\n当年的技术人员先在金属基板上反复试烧，再根据最终的颜色、光泽和附着性能确定生产标准。后续工厂生产的同系列产品，均以这块母版作为最初的色彩参照。\n\n母版上的最后一格没有烧制成功。\n\n颜色停在了半路。\n\n工厂后来改进了烧制流程，也制作了许多新的标准样板，但这块最初的母版始终没有被替换。它被封存在工艺档案室中，连同原始配方记录一起保存。\n\n随着旧工艺被新技术取代，早期生产线逐渐停用。曾经用于大规模制造的技术，最终只剩下这件能够完整追溯工艺起点的实物。' },
  { id:'antiq07',name:'手绘航海图', short:'航海图', cat:'collect', r:4, w:0.35, price:96000,
    desc:'一幅绘制于环礁湾港口扩建之前的近海航行图，使用耐潮绘图纸和多种颜色的防水墨水，标注了暗礁、测深点、灯塔和旧航道。\n\n制图师对港湾内的浅水区域进行了格外细致的测量，部分水深数据后来被红色墨水修订。\n\n如今地图上的几处码头已经不复存在，但海底的礁石并不会因为岸上的建筑改变位置。' },
  { id:'antiq08',name:'彩绘陶瓷面具', short:'陶瓷面具', cat:'collect', r:2, w:0.4, price:7200,
    desc:'以白色陶土烧制的节庆面具，额头与脸颊绘有对称的蓝色花纹，眼角各悬着一滴金色泪珠。\n\n旧时的节庆演员会在夜间巡游时佩戴此类面具。不同花色代表不同角色，但如今大多数人已经分不清它们的含义。\n\n这一件的系绳曾断过，后来换成了普通的棉线。' },
  { id:'antiq09',name:'环礁湾雕刻铜版', short:'城市铜版', cat:'collect', r:6, w:2.4, price:1650000,
    desc:'一块用于印制《环礁湾城市全景图》初版的原始雕刻铜版。\n\n铜版采用传统凹版雕刻工艺制作，表面密布着建筑、街道、港口和船只的精细线条。制版师使用不同规格的刻刀完成建筑轮廓与阴影，再通过腐蚀工艺修整部分细节。\n\n作品最初由城市建设部门委托制作，用于纪念环礁湾一次重要的城市扩建工程。\n\n与当时流行的航空摄影制图不同，主雕版师坚持亲自走访旧城区。为了完整表现城市生活，他在画面中保留了菜市场、旧电影院、沿街书店，以及许多即将在城市改造中被拆除的建筑。\n\n这一决定曾引起委托方的不满。\n\n经过反复修改，最终印刷版本删除了部分旧建筑，但原始铜版中的雕刻线条仍然保留着它们的位置。\n\n铜版完成后，印刷厂使用它制作了首批限量版画。随后，随着复制工艺更新，原版被封存保存。\n\n如今，这块铜版已成为整套城市全景图唯一留存的手工原始母版。' },
  { id:'art01',  name:'黑胶唱片',     cat:'collect',  r:3, w:0.3, price:16000,
    desc:'一张早期压制的黑胶唱片，附有原版纸质封套。封套背面的曲目表上，B 面第三首被人用铅笔圈了起来。\n\n唱片的同一位置留有一道明显划痕。' },
  { id:'art02',  name:'小幅油画',     cat:'collect',  r:4, w:1.2, price:65000,
    desc:'画的是一片没有海鸥的海。\n\n灰蓝色的水面占据了画布大半，远处的地平线低得几乎看不见。厚重的油彩堆积在浪尖上，近看才发现画面用了十几种不同的灰色。\n\n右下角有签名，已经认不出。' },
  { id:'art04',  name:'限量游戏卡带', short:'游戏卡带', cat:'collect', r:4, w:0.18, price:78000,
    desc:'家用游戏《最后一班列车》的初回限定版卡带，附带彩色说明书、编号证书和原厂收藏盒。\n\n这款冒险游戏以复杂的分支剧情闻名。玩家需要在列车抵达终点站之前完成调查，但游戏没有设置中途存档功能。\n\n当年有杂志专门刊登了通关流程。整整十二页，最后一页印错了。' },
  { id:'art05',  name:'电影首映海报', short:'首映海报', cat:'collect', r:3, w:0.25, price:21000,
    desc:'悬疑电影《灯塔以北》的首映宣传海报，采用多色胶印工艺印制。画面中只有一座亮着灯的灯塔，几乎占满背景的海面完全没有船只。\n\n影片发行时票房平平，后来却因为独特的摄影风格在录像带租赁市场重新流行起来。这张首映版本的海报保留了早期被发行商撤换的原始片名字体。' },
  { id:'lux01',  name:'机械腕表',     cat:'collect',  r:5, w:0.1, price:220000,
    desc:'一枚采用贵金属表壳与复杂机械机芯制作的高级腕表，配备自动上链机构与精密调校的摆轮组件。\n\n表盘上的夜光涂层已经泛黄，表镜却几乎没有划痕。\n\n还在走。\n\n这是这栋楼里唯一还在正常运转的东西。' },
  { id:'lux02',  name:'金条',         cat:'collect',  r:5, w:1.0, price:200000,
    desc:'一公斤，成色足，钢印完整。\n\n没有来历不明的秘密，也没有动人的故事。熔了以后，还是一公斤金子。' },
  { id:'lux03',  name:'钢笔',         cat:'collect',  r:3, w:0.05,price:18000,
    desc:'黑色树脂笔身，金质笔尖，笔帽采用精细的金属螺纹连接结构。笔夹有一道浅浅的划痕。\n\n笔尖还是好的，墨囊空了。' },
  { id:'lux04',  name:'珐琅音乐盒', short:'音乐盒', cat:'collect',  r:5, w:0.8, price:268000,
    desc:'一件采用银质胎体与手工珐琅彩装饰的机械音乐盒。盒盖绘有一座悬崖庄园，深蓝色天空使用多次烧制的透明釉层表现，转动角度时能够看到不同的光泽。\n\n内部装有精密滚筒式音乐机芯，演奏一首流传已久的圆舞曲。\n\n它出自某家历史悠久的钟表工坊，为纪念工坊成立周年而限量制作。不同于后续采用彩绘外壳的普及版本，这一批仍使用传统珐琅烧制工艺。\n\n音乐盒底部保留着工匠签名与发行编号。机芯运转正常，只是其中一枚梳齿的音色稍显沉闷。' },
  { id:'lux05',  name:'蓝宝石胸针', short:'胸针', cat:'collect',  r:5, w:0.12,price:340000,
    desc:'一枚以展翼海鸟为原型设计的高级珠宝胸针，中央镶嵌一颗天然蓝宝石，双翼由铂金与细小钻石构成。\n\n主石采用阶梯式切割，深蓝色内部带有轻微的天然色带。左右两翼的钻石排列并不完全对称，这是设计师在原始设计稿中就确定的造型。\n\n胸针曾作为私人珠宝展的重点展品，附有完整的宝石鉴定资料及工坊制作记录。' },
  { id:'spec01', name:'贝壳',         cat:'collect', r:1, w:0.1, price:1600,
    desc:'从海里来的，出现在三楼。水真的上来过。' },
  { id:'spec02', name:'矿石标本',     cat:'collect', r:2, w:0.6, price:5700,
    desc:'深色岩体上生长着一簇蓝绿色晶体，晶面完整，部分边缘因搬运而崩裂。\n\n标签写着产地和编号。编号被人划掉了。' },
  { id:'spec03', name:'干燥的植物', short:'干植物',   cat:'collect', r:1, w:0.05,price:2000,
    desc:'夹在一本书里，压得很平。叶子还是绿的。' },
  { id:'spec04', name:'菊石化石',     cat:'collect', r:3, w:0.9, price:26000,
    desc:'菊石的螺旋外壳嵌在灰黑色石灰岩中，经过局部清理，隔室线仍然清晰。\n\n这块化石没有经过完全抛光。标本师只清除了外壳周围的岩层，让原始沉积面保留在背面。' },

  /* --- 军事物资 --- */
  /* 军事收集品：单兵装具 → 光电与通信，见 design/items/MILITARY_COLLECTIBLES.md */
  { id:'mil01',  name:'旧弹链盒',     short:'弹链盒', cat:'mil', r:1, w:1.5, price:1800,
    desc:'绿色铁盒，提手弯了，盒盖扣得很紧。里面的弹链早已取走，只剩几枚生锈的连接片和一层干硬的油污。' },
  { id:'mil02',  name:'制式军用水壶', short:'军用水壶', cat:'mil', r:1, w:0.45, price:2300,
    desc:'壶身压着几道深浅不一的凹痕，橄榄绿色的漆面磨出了底下的铝色。壶盖用一截旧绳系在壶颈上，免得再丢一次。' },
  { id:'mil03',  name:'军用身份牌',   short:'身份牌', cat:'mil', r:2, w:0.08, price:5400,
    desc:'两片薄金属牌挂在同一条链上。\n\n姓名、服役编号、血型，除此以外没有别的内容。其中一片的编号被反复摩擦，刻痕比另一片浅得多。' },
  { id:'mil04',  name:'制式信号灯',   short:'信号灯', cat:'mil', r:2, w:0.7, price:6500,
    desc:'一种带有可更换彩色滤镜的手持信号灯，常用于夜间引导与临时交通管制。金属外壳上还贴着使用单位的器材标签。\n\n灯罩保存完好，电池仓的弹簧已经锈死。' },
  { id:'mil05',  name:'封锁区标识牌', short:'封锁标识', cat:'mil', r:2, w:0.6, price:7100,
    desc:'一块从临时封锁线拆下的金属标识牌，正面印有军方警戒图案和禁止通行标志。\n\n背面留着不同型号的固定螺孔。它曾被装在铁丝围栏上，后来又被重新安装到路障支架上。' },

  { id:'mil06',  name:'军用罗盘',     cat:'mil', r:3, w:0.25, price:19000,
    desc:'采用液体阻尼结构的精密军用罗盘，带有可折叠瞄准镜片和夜光方位刻度。\n\n保护盖内侧固定着一面小镜子，外壳的防滑涂层已经磨损。与普通旅行指南针相比，它更耐碰撞，也更适合长时间野外测绘。' },
  { id:'mil07',  name:'野战电话机',   short:'野战电话', cat:'mil', r:3, w:2.1, price:28000,
    desc:'一部便携式有线野战电话，采用坚固的金属机箱和独立手柄，侧面设有线路接线端子。\n\n连接线已经被整齐地剪断，手柄却仍被扣在原来的位置。箱盖内侧贴着一份简易故障检查表，最下面的两项被反复打过勾。' },
  { id:'mil08',  name:'制式枪机组件', short:'枪机组件', cat:'mil', r:3, w:0.65, price:34000,
    desc:'一套封存在防锈纸中的制式枪械枪机总成，表面涂有薄薄的防护油脂。关键接触部位经过精密加工，金属零件保留着统一的检验钢印。\n\n外包装没有拆封痕迹。' },

  { id:'mil09',  name:'单筒夜视仪',   short:'夜视仪', cat:'mil', r:4, w:1.1, price:90000,
    desc:'一台采用像增强技术的单筒夜视观察设备，能够在低照度环境下提供绿色调的增强图像。\n\n镜筒外侧的橡胶防护层已经开裂，目镜边缘留有长期佩戴留下的磨损。镜片没有明显划伤，配套的遮光盖也还在。' },
  { id:'mil10',  name:'通信密钥模块', short:'密钥模块', cat:'mil', r:4, w:0.55, price:74000,
    desc:'一种用于专用军用通信系统的可拆卸电子模块，采用金属屏蔽外壳，外部仅保留状态指示灯和设备识别接口。\n\n它本身不保存完整的通信记录。离开配套主机后，也无法独立完成通信。\n\n此件模块的保管封签完好，外壳上却贴着两种不同颜色的资产标签，分别来自通信部门和后勤部门。' },
  { id:'mil11',  name:'野战剂量仪',   short:'剂量仪', cat:'mil', r:4, w:1.4, price:68000,
    desc:'一台军用便携式辐射剂量测量仪，使用模拟指针显示测量结果，外壳具有防潮和防冲击结构。\n\n这类仪器原本服务于部队的常规危险环境防护工作，并不意味着使用它的地区一定存在放射性污染。\n\n探头接口处的橡胶保护盖已经脱落，携行箱中的校准附件却保存得十分完整。' },

  { id:'mil12',  name:'热成像观察仪', short:'热成像仪', cat:'mil', r:5, w:2.4, price:240000,
    desc:'早期便携式军用热成像观察设备，使用专用红外探测器和低分辨率电子显示系统。\n\n在光学夜视设备仍占据主流的年代，热成像技术的高昂成本限制了它的普及。其红外探测组件和专用电子处理单元，需要复杂的制造与校准工艺。\n\n与后来的轻型设备不同，这个型号体积笨重，机身后部还保留着独立供电接口。' },
  { id:'mil13',  name:'光学测距仪',   short:'测距仪', cat:'mil', r:5, w:1.5, price:190000,
    desc:'一台军用精密光学测距设备，采用高品质棱镜和复杂的光学测量机构，主要用于远距离目标观测与工程测量。\n\n它出自一家长期生产军用测量设备的专业光学厂。由于制造过程中需要严格控制光轴误差，同系列产品的产量始终不高。\n\n此件设备保存着原厂调校证书，镜组未见明显霉斑。' },
  { id:'mil14',  name:'指挥通信主机', short:'通信主机', cat:'mil', r:5, w:3.8, price:420000,
    desc:'从军用指挥车辆中拆卸下来的专用通信控制主机，采用模块化电子结构，负责协调多路无线电设备的音频、状态与控制信号。\n\n设备面板上的频道选择开关已经被拆除，内部电子组件却保存完整。金属框架上刻有原厂制造编号，不同模块的检验封漆颜色也不相同。\n\n这类设备通常按照特定指挥通信系统配套制造，脱离原有车辆后，很难由普通民用设备替代。' },

  { id:'mil15',  name:'首潮撤离标图板', short:'撤离标图', cat:'mil', r:6, w:2.6, price:1600000,
    desc:'一块曾用于环礁湾首次大规模撤离行动的原始军事指挥标图板。\n\n它由金属框架和可更换的透明标绘板组成，底层压着一张当时使用的城市地图。不同颜色的标记分别代表道路管制区、人员集中点、后勤集结区与撤离路线。\n\n标图板经历过多次人工修改。部分标记被擦去后重新绘制，旧线条仍隐约透在下面。板面边缘的时间栏中，几次更新的记录间隔越来越短。\n\n这块标图板属于首次撤离行动的原始指挥器材，而不是事后根据档案制作的纪念复制品。与它同时保存的还有使用登记、交接记录，以及后来对撤离路线变更过程的整理资料。\n\n其中一条通往港口的线路，被连续修改了三次。\n\n最后的版本没有画到港口。\n\n标图板右下角还留着一小片没有被覆盖的区域，那里标注着最早设定的一处人员集合点。后续更新中，这个位置既没有被涂掉，也没有重新标记。\n\n它只是留在那里。' },

  /* 弹药不在这里逐条写：见本表之后的 AMMO_TABLE（五口径 × 五等级，
     属性统一从 BALLISTICS / CALIBERS 派生）。 */

  /* --- 情报资料 --- */
  /* 13 件情报收集品：城市记录 → 灾变行政 → 专业调查 → 首潮观测，见 design/items/INTEL_COLLECTIBLES.md */
  { id:'intel01',name:'港口货运清单', short:'货运清单', cat:'intel', r:2, w:0.15, price:5200,
    desc:'一张港口仓库的货物交接清单，列着箱号、重量、运输方式与收货单位。\n\n大部分货物已经签收，只有最底下那一批被划去，重新安排了运输日期。' },
  { id:'intel02',name:'旧电话簿',     cat:'intel', r:1, w:0.35, price:1800,
    desc:'电话号码按街区排列。许多号码旁边都被打了勾，最后几页的空白处则写满了临时联络方式。\n\n纸页被翻得发软，书脊却还完整。' },
  { id:'intel03',name:'撤离登记卡',   short:'登记卡', cat:'intel', r:2, w:0.08, price:6800,
    desc:'卡片正面留有姓名、年龄、同行人数和指定集合地点。背面的交通方式一栏先是填了「汽车」，后来改成了「步行」。' },

  { id:'intel04',name:'城市建设蓝图', short:'建设蓝图', cat:'intel', r:3, w:0.4, price:24000,
    desc:'一份旧城区地下排水设施的施工蓝图。暗蓝色图纸上印着白色管线、检查井和泵站位置，工程变更部分用红笔单独标出。\n\n图纸边缘留着设计院与施工单位的签章。' },
  { id:'intel05',name:'磁带录音',     short:'录音磁带', cat:'intel', r:3, w:0.12, price:29000,
    desc:'一盘贴着会议日期的录音磁带，透明外壳内能看见两卷深褐色磁带。\n\n标签上的会议地点被改过一次。录音内容尚未整理成文字。' },
  { id:'intel07',name:'电报码底稿',   short:'电报稿', cat:'intel', r:3, w:0.1, price:32000,
    desc:'一张从通信台留存的电报底稿，正文由短语和数字代码组成。原始报文已经发出，纸张下端保留着收发时间与操作员签名。\n\n最后一组代码写得很挤，几乎碰到了纸边。' },

  { id:'intel06',name:'潮位观测日志', short:'潮位日志', cat:'intel', r:4, w:0.6, price:58000,
    desc:'一本港口水文站使用的潮位观测簿，按日期记录海面高度、气压、风向与观测时间。\n\n前半部分的记录间隔十分规律。后来，观测员开始在原定时刻之外增加测量次数，并在部分数据旁画上红圈。\n\n最后几页附着一张从自动记录仪上剪下来的纸带。纸带上的曲线没有超出量程，却与当天的人工记录存在明显差异。' },
  { id:'intel08',name:'封锁区通行名册', short:'通行名册', cat:'intel', r:4, w:0.35, price:82000,
    desc:'一份供封锁区检查站核验的人员通行名册，记录获准通行的单位、人员及证件有效期限。\n\n名册最初按单位排列，后来改为按通行区域分类。重新装订时，有几页被放错了位置。\n\n同一个名字出现在两个不同区域的名单上，签发日期相隔一天。' },
  { id:'intel09',name:'实验原始数据盘', short:'数据盘', cat:'intel', r:4, w:0.2, price:96000,
    desc:'一组装有研究数据的 3.5 英寸软盘，记录着实验仪器输出的原始测量结果。\n\n软盘标签依次编号，日期跨越数个月。最后一张盘片贴有重新复制的标识，说明原始数据曾经过一次迁移或备份。\n\n没有对应的软件和设备，磁盘里的内容很难直接查看。' },

  { id:'intel10',name:'撤离电台录音带', short:'撤离录音', cat:'intel', r:5, w:0.18, price:220000,
    desc:'一盘由紧急通信中心保存的专业录音带，记录了某次撤离行动中的无线电调度通信。\n\n录音并不是连续的。为了节约磁带，值班人员使用了语音触发录音装置，只有出现通信信号时才启动记录。\n\n因此，部分对话之间只隔着数秒，实际时间却可能相差数十分钟。\n\n后来的调查人员为录音重新制作了时间索引，并将几段关键通信单独标出。\n\n原始磁带没有经过剪辑。' },
  { id:'intel11',name:'异常区域勘测报告', short:'勘测报告', cat:'intel', r:5, w:0.7, price:310000,
    desc:'一份关于环礁湾特殊环境区域的联合勘测报告，内容包括地形测量、环境取样、仪器校准记录及不同时间的观测结果。\n\n报告没有直接使用「超自然」一词，而是将无法用既有模型解释的测量结果统一列入待复核项目。\n\n几处观测地点的坐标被反复修订。\n\n附录中的测量方法没有变化，修订的却是测量对象的位置。' },
  { id:'intel12',name:'未公开调查卷宗', short:'调查卷宗', cat:'intel', r:5, w:1.1, price:460000,
    desc:'一份尚未公开的联合调查卷宗，汇集了证人陈述、现场照片、机构往来文件及数次调查会议的记录。\n\n卷宗中的部分证言存在矛盾，调查人员没有将其删除，而是按照不同证据来源分别归档。\n\n最厚的一部分并非现场报告，而是关于资料真实性的核查记录。\n\n调查最终没有形成统一结论。封面原定用于填写结案意见的位置，至今仍然空白。' },

  { id:'intel13',name:'首潮原始观测记录', short:'首潮记录', cat:'intel', r:6, w:0.45, price:1850000,
    desc:'这是环礁湾首次大规模异常潮汐事件发生期间，一处早期观测站保存的原始记录。\n\n载体是一册普通的线装观测簿，纸张已经发黄，封面上留着潮湿环境造成的水渍。记录从日常水文数据开始，包含潮位、气压、风速及定时人工观测结果。\n\n最初几页没有任何特别之处。\n\n随后，记录开始出现密集的修订。观测员在同一时间段内反复测量，将自动记录仪的数据抄写到纸面，再用不同颜色的笔补充人工读数。\n\n两组数据持续出现差异。\n\n负责记录的人员没有立即将其判定为仪器故障，而是补做了校准检查。\n\n校准结果正常。\n\n直到记录簿的最后几页，原本用于登记潮位的表格逐渐不够使用。观测员开始借用空白区域，绘制建筑物、道路和水位之间的位置关系。\n\n最后一页的记录并没有写完。\n\n表格中的时间和日期完整，测量结果的位置却只画了一道横线。\n\n这册记录簿并不能独立解释灾变的起因，但它保存了人们第一次尝试用熟悉的测量方法理解异常现象时，留下的原始观测过程。\n\n后来的调查报告引用了其中的部分数据，而原始记录始终只有这一册。' },

  { id:'life02', name:'旧报纸',       cat:'intel', r:1, w:0.2, price:1000,   desc:'日期停在事故前三天。头版是一场没人关心的听证会。' },
  { id:'art03',  name:'摄影底片',     cat:'intel',  r:3, w:0.05,price:14000, desc:'对着光看不出什么。需要显影，但你可能舍不得用掉它。' },

  /* --- 神秘学物品 --- */
  /* 15 件：民俗实践 → 仪式器具 → 传承文献，见 design/items/OCCULT_COLLECTIBLES.md */
  { id:'occ01',  name:'褪色祈愿绳', short:'祈愿绳', cat:'occult', r:1, w:0.05, price:1800,
    desc:'一截用红、白、黑三色棉线编成的细绳，绳结已经松散。按照一种古老的民间习惯，系绳时应当默念愿望，解开时则不许回头。\n\n现在它只剩下五个结。' },
  { id:'occ02',  name:'仪式粉笔',   cat:'occult', r:1, w:0.2, price:2400,
    desc:'由白垩粉、少量矿物颜料和植物胶压制而成的粗短粉笔。某些仪式传统认为，描绘符号时应当一笔完成，中途断裂便需从头开始。\n\n这截粉笔已经断了三次。' },

  { id:'occ03',  name:'七结护符',   cat:'occult', r:2, w:0.08, price:6800,
    desc:'七枚小铜环由一根黑线依次穿过，每环之间系着不同的结。\n\n佩戴者相信它可以挡住不愿被看见的东西。制作这种护符的匠人则认为，结打错了也没关系，只要佩戴者不知道。' },
  { id:'occ04',  name:'铜制占卜盘', short:'占卜盘', cat:'occult', r:2, w:0.5, price:8500,
    desc:'一面刻有十二个等距符号的黄铜圆盘。中心安装着可以自由转动的短指针，盘面被反复摩擦，边缘逐渐磨得光滑。\n\n不同流派对第七个符号的解释始终无法达成一致。' },
  { id:'occ05',  name:'灰烬香炉',   cat:'occult', r:2, w:0.8, price:9200,
    desc:'一只三足陶制香炉，内壁凝着厚厚的灰白色残留物。\n\n炉口周围分布着四处指尖大小的黑色印记。长期主持仪式的人习惯在点火前触摸这四个位置，后来即使炉身更换，动作也不会改变。' },

  { id:'occ06',  name:'观星仪式尺', short:'仪式尺', cat:'occult', r:3, w:0.35, price:22000,
    desc:'一把以黄铜和硬木制作的折叠测量尺，刻度并不对应普通的长度单位，而是按照星辰位置与季节划分。\n\n尺臂可以展开成特定角度，用于在仪式开始前确定祭坛方向。至于它是否真的能测出什么，使用者之间从来没有统一说法。' },
  { id:'occ07',  name:'银丝封印针', short:'封印针', cat:'occult', r:3, w:0.12, price:34000,
    desc:'细长的银质仪式针，针柄缠绕着三股极细的银丝，末端嵌有一粒深红色玻璃珠。\n\n某些封缄传统使用它在蜡封尚未凝固时穿过封面，象征誓言已经固定。它封住的通常不是门，也不是箱子，而是一份不得轻易撤回的约定。' },
  { id:'occ08',  name:'密仪蜡印',   short:'密仪印章', cat:'occult', r:3, w:0.18, price:38000,
    desc:'印面由一整块黑色硬石雕成，刻着三组彼此嵌套的几何图形。\n\n它的主人似乎特别在意印迹的完整性。手柄边缘已经磨圆，印面的尖角却几乎没有损伤。' },

  { id:'occ09',  name:'黑曜石卜镜', short:'卜镜', cat:'occult', r:4, w:0.7, price:78000,
    desc:'一面以整块黑曜石磨制的圆形镜子，背面嵌在银质支架中。\n\n普通玻璃镜追求清晰，这种卜镜却特意保留了暗淡的反射效果。使用者会在微弱烛光下凝视镜面，借由模糊的倒影进行冥想与象征解读。' },
  { id:'occ10',  name:'潮蚀符板',   cat:'occult', r:4, w:0.6, price:95000,
    desc:'一块从沿海旧祭坛遗址中发现的石质符板，表面刻着交错的弧形纹路，局部留下长期盐蚀形成的细小孔洞。\n\n研究者曾将这些纹路解释为海浪、月相或季节循环。后来发现，不同地区出土的类似器物，其纹路组合并不完全相同。\n\n没有人能确定它们是否属于同一种传统。' },
  { id:'occ11',  name:'逆序祷文卷', short:'祷文卷', cat:'occult', r:4, w:0.25, price:110000,
    desc:'一份书写在薄皮纸上的仪式祷文，采用一种古老文字的变体。\n\n常规文本从开头向结尾排列，这份祷文却将每个句群的内部顺序倒置。研究者已经完成了词语对照，却始终无法确认正确的诵读顺序。\n\n其中一些句子在不同的排列方式下，意义恰好相反。' },

  { id:'occ12',  name:'镀金星盘核心', short:'星盘核心', cat:'occult', r:5, w:1.1, price:260000,
    desc:'一件从大型仪式星盘中拆卸下来的中央机械组件，由多层同心黄铜环、镀金刻度盘与精密转轴组成。\n\n它既可以按照传统天文学的方式表示星辰位置，也保留了若干无法与已知星图对应的符号。\n\n从机械结构来看，这些额外刻度并非后人随意添加，而是在制造时便已纳入整套传动系统。' },
  { id:'occ13',  name:'三重誓约戒', short:'誓约戒', cat:'occult', r:5, w:0.08, price:340000,
    desc:'三枚由不同金属制作的窄戒被精巧地连接在一起，可以独立旋转，却无法在不破坏结构的情况下完全分开。\n\n据一支古老誓约传统的传承记录，这种戒指只会在三名参与者共同完成仪式后制作。每枚戒指都代表一种不同的义务。\n\n现存的完整三环戒极少，多数藏品只剩下一环或两环。' },
  { id:'occ14',  name:'无声祈祷铃', short:'祈祷铃', cat:'occult', r:5, w:0.45, price:480000,
    desc:'这只银质小铃没有安装铃舌。\n\n它属于一种已经式微的守夜传统。仪式主持者会在祈祷结束时轻轻举起铃身，以没有发出的铃声象征某种不可言说的回应。\n\n后世仿制品通常会在铃内悬挂短链，以产生细微声响。这只早期原件的内壁没有任何安装痕迹。\n\n它从制作之初，就没有被设计成会响的东西。' },

  { id:'occ15',  name:'第零页圣典', short:'零页圣典', cat:'occult', r:6, w:0.65, price:1800000,
    desc:'一页保存于特殊防潮夹层中的古老手写文献，书写材料由植物纤维与薄皮层复合制成，边缘保留着曾经装订的针孔。\n\n它原本属于一部已经散佚的仪式圣典。\n\n根据后世留下的抄本记录，这部圣典共有十二章。各地流传的版本虽然在内容上存在差异，却都从相同的第一章开始。\n\n直到某次文献整理中，研究者发现了一份更早的目录。\n\n目录的最前面，还有一个没有编号的章节。\n\n这页文献便被认为是该章节仅存的原始残页。\n\n它使用的文字与后世抄本一致，但书写方向、段落结构和部分符号形态却明显不同。研究者对其中大部分词语已经形成了相对一致的释读。\n\n真正存在分歧的是它的用途。\n\n有人认为它是整部圣典的序言，有人认为它是一套独立仪式的残存说明。还有一种较少被接受的解释认为，后世十二章实际上是对这页文献内容的不断重新阐释。\n\n无论哪一种观点成立，它都可能改变人们对某个古老神秘学传统起源的理解。\n\n文献的最后一段只剩下半行。\n\n缺失的部分恰好位于原始装订边缘，无法判断是破损造成，还是原作者从未写完。' },

  /* --- 异常遗物 --- */
  // 价格是"研究样本收购价"，不是市面零售价：买主只有极少数收藏者与研究机构。
  { id:'odd01',  name:'回响结晶',     cat:'odd',  r:4, w:0.6, price:42000,   desc:'放在包里会自己出声。很轻，很吵。' },
  { id:'odd02',  name:'潮汐仪', short:'潮汐仪', cat:'odd',  r:6, w:0.8, price:3000000, desc:'一台精巧的黄铜仪器，三重刻度环围绕着一颗悬浮的微型海洋缓缓旋转。\n无论将它倒置、摇晃还是拆下底座，那颗海洋始终维持着自己的水平面。\n偶尔，海面上会出现一座灯塔。\n至今没人知道那座灯塔在哪里。' },
  { id:'odd03',  name:'停摆的怀表', short:'停摆表',   cat:'odd',  r:4, w:0.2, price:60000,   desc:'停在涨潮那一秒。每天都停在那一秒。' },
];

/* ------------------------------------------------------------
   弹药：三种口径 × 五个等级
   id 固定是 ammo_{口径}_{等级}，等级数值只在 BALLISTICS / CALIBERS 定义一次，
   这里只登记名称与单发价格，系数、穿透、显示名全部派生。
   贴图还没画，先按字符占格（Icons 认不到图会退回带等级数字的色块）。
   掉落与商店供货数量本轮未定，所以 noLoot，不参与容器抽取。
   ------------------------------------------------------------ */
const AMMO_TABLE = [
  [
    "556",
    1,
    "5.56mm普通弹",
    60
  ],
  [
    "556",
    2,
    "5.56mm改良弹",
    140
  ],
  [
    "556",
    3,
    "5.56mm钢芯弹",
    320
  ],
  [
    "556",
    4,
    "5.56mm硬芯穿甲弹",
    800
  ],
  [
    "556",
    5,
    "5.56mm特种穿甲弹",
    2000
  ],
  [
    "762x39",
    1,
    "7.62mm普通弹",
    80
  ],
  [
    "762x39",
    2,
    "7.62mm改良弹",
    180
  ],
  [
    "762x39",
    3,
    "7.62mm钢芯弹",
    420
  ],
  [
    "762x39",
    4,
    "7.62mm穿甲弹",
    1000
  ],
  [
    "762x39",
    5,
    "7.62mm特种穿甲弹",
    2500
  ],
  [
    "9mm",
    1,
    "9mm普通弹",
    35
  ],
  [
    "9mm",
    2,
    "9mm强化弹",
    80
  ],
  [
    "9mm",
    3,
    "9mm钢芯弹",
    180
  ],
  [
    "9mm",
    4,
    "9mm穿甲弹",
    450
  ],
  [
    "9mm",
    5,
    "9mm特种穿甲弹",
    1100
  ],
  [
    "45acp",
    1,
    ".45 ACP普通弹",
    50
  ],
  [
    "45acp",
    2,
    ".45 ACP改良弹",
    110
  ],
  [
    "45acp",
    3,
    ".45 ACP钢芯弹",
    250
  ],
  [
    "45acp",
    4,
    ".45 ACP穿甲弹",
    600
  ],
  [
    "45acp",
    5,
    ".45 ACP特种穿甲弹",
    1500
  ],
  [
    "12g",
    1,
    "普通鹿弹",
    80
  ],
  [
    "12g",
    2,
    "强化鹿弹",
    180
  ],
  [
    "12g",
    3,
    "硬质鹿弹",
    400
  ],
  [
    "12g",
    4,
    "穿甲霰弹",
    900
  ],
  [
    "12g",
    5,
    "特种穿甲霰弹",
    2200
  ],
  [
    "545x39",
    1,
    "5.45mm普通弹",
    70
  ],
  [
    "545x39",
    2,
    "5.45mm改良弹",
    160
  ],
  [
    "545x39",
    3,
    "5.45mm钢芯弹",
    370
  ],
  [
    "545x39",
    4,
    "5.45mm穿甲弹",
    900
  ],
  [
    "545x39",
    5,
    "5.45mm特种穿甲弹",
    2250
  ]
];

const AMMO_STACK_LIMITS = {"556":60,"762x39":60,"9mm":90,"45acp":90,"12g":20,"545x39":60};
const AMMO_ITEMS = AMMO_TABLE.map(([caliber, level, name, price]) => {
  const t = BALLISTICS.tier(level);
  const cal = BALLISTICS.caliber(caliber);
  return {
    id: BALLISTICS.ammoId(caliber, level),
    iconId: 'ammo_' + caliber,
    name, short: cal.short + '·' + level,
    cat: 'ammo', r: level, w: cal.weight || 0.012, price, stack: AMMO_STACK_LIMITS[caliber],
    noCodex: true, noLoot: true,
    caliber, level, penLevel: t.pen, dmgMul: t.dmgMul,
    desc: cal.name + ' 制式弹药，' + t.name + '级。\n\n' +
      '伤害系数 ×' + t.dmgMul.toFixed(2) + '，穿透等级 ' + t.pen + '。' +
      '同口径的枪都能装，口径不对的装不进去。'
  };
});
ITEMS.push(...AMMO_ITEMS);
const AMMO_BY_ID = Object.fromEntries(AMMO_ITEMS.map(i => [i.id, i]));

/* 某口径某等级的弹药物品 */
function ammoItem(caliber, level) {
  return AMMO_BY_ID[BALLISTICS.ammoId(caliber, level)] || null;
}
/* 某口径的默认弹药（Lv1），武器没指定时兜底 */
function defaultAmmo(caliber) { return ammoItem(caliber, 1); }

/* 稀有度 → 掉落权重（越低越少见） */
const RARITY_WEIGHT = { 1: 100, 2: 55, 3: 20, 4: 10, 5: 6, 6: 1.2 };

/* 容器品质 → 抽出几件（与 CONTAINER_QUALITY.count 同源） */
const BOX_COUNT = Object.fromEntries(Object.entries(CONTAINER_QUALITY).map(([k, q]) => [k, q.count]));

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
    human: true,            // 人：会自己穿戴头甲、配对应等级的弹
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

/* ------------------------------------------------------------
   人类敌人的装备等级
   一次掷出一个等级 L（1~4），头、甲、身上带的弹全部按 L 走：
   穿了 Lv3 的头就一定是 Lv3 的甲、Lv3 的弹，不会出现混搭。
   Lv5 只留给玩家自己造，敌人不会有。
   levelWeights 是 L=1..4 的权重（越低越常见），
   helmetChance / bodyChance 是"到底穿不穿"，穿了就按 L 定级。
   ------------------------------------------------------------ */
const ENEMY_LOADOUT = {
  levelWeights: [42, 30, 19, 9],
  helmetChance: 0.55,
  bodyChance: 0.65,
  ammoMin: 10,        // 尸体上掉的弹药数量区间（含两端）
  ammoMax: 30,
  /* 按权重抽一个 1~4 的等级 */
  rollLevel() {
    const w = this.levelWeights;
    let total = 0;
    for (const x of w) total += x;
    let r = Math.random() * total;
    for (let i = 0; i < w.length; i++) {
      r -= w[i];
      if (r <= 0) return i + 1;
    }
    return 1;
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
   藏身处已经不再有"携带数量"这套配置：
   带什么下场完全取决于背包里放了多少（子弹、药物留在包里跨局保留），
   数量、单价都直接来自物品表，这里只留起始信用点。
   ------------------------------------------------------------ */

/* 初始信用点（只在第一次玩、还没有存档时给） */
const START_CREDITS = 60000;

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
          /* 第二批容器（2026-10）：废弃 4 / 普通 3 / 充实 3 / 优质 3 / 贵重 2 / 秘藏 2 */
          'crate_trash', 'crate_wastepaper', 'crate_cardboard', 'crate_workwear',
          'crate_bedside', 'crate_staff', 'crate_satchel',
          'crate_luggage', 'crate_filing', 'crate_schoolbag',
          'crate_emergency', 'crate_comms', 'crate_rescuevest',
          'crate_jewelry', 'crate_leatherbag', 'crate_sealed', 'crate_diplomatic',
          'door', 'door_open', 'sdoor', 'sdoor_open',
          'door_side', 'door_side_open', 'sdoor_side', 'sdoor_side_open',
          'exit',
          'corpse', 'corpse_scav', 'corpse_echo', 'corpse_guard',
          'desk', 'shelf', 'barrel', 'chair', 'blood',
          'bed_home_side', 'bed_home_back', 'bed_clinic_side', 'bed_clinic_back', 'stove_home_side', 'stove_home_back', 'sofa_home_side', 'sofa_home_back', 'bench_wood_side', 'bench_wood_back', 'display_clock_side', 'display_clock_back', 'counter_shop_side', 'counter_shop_back', 'counter_bank_side', 'counter_bank_back', 'console_security_side', 'console_security_back', 'tree_courtyard_side', 'tree_courtyard_back', 'desk_side', 'desk_back', 'chair_side', 'chair_back', 'shelf_side', 'shelf_back', 'barrel_side', 'barrel_back',
          'bed_home_large', 'bed_home_large_side', 'bed_home_large_back', 'bed_clinic_large', 'bed_clinic_large_side', 'bed_clinic_large_back', 'sofa_home_large', 'sofa_home_large_side', 'sofa_home_large_back', 'bench_wood_large', 'bench_wood_large_side', 'bench_wood_large_back', 'display_clock_large', 'display_clock_large_side', 'display_clock_large_back', 'counter_shop_large', 'counter_shop_large_side', 'counter_shop_large_back', 'counter_bank_large', 'counter_bank_large_side', 'counter_bank_large_back', 'desk_large', 'desk_large_side', 'desk_large_back', 'shelf_large', 'shelf_large_side', 'shelf_large_back',
          'tree_courtyard_canopy', 'tree_courtyard_canopy_side', 'tree_courtyard_canopy_back',
          'bed_home', 'bed_clinic', 'stove_home', 'sofa_home', 'bench_wood',
          'display_clock', 'counter_shop', 'counter_bank', 'console_security', 'tree_courtyard',
          'canal_bank_w', 'canal_bank_e', 'bridge_stone_rail_n', 'bridge_stone_rail_s',
          'bridge_wood_rail_n', 'bridge_wood_rail_s', 'shop_window_ns',
          'wall_breach_n', 'wall_breach_s', 'rubble_decal'],
  tiles: ['floor', 'low', 'marsh', 'wall', 'wall_face_s', 'wall_face_e', 'street_stone', 'courtyard_paving', 'canal_water',
          'quay_top', 'bridge_stone_deck', 'bridge_wood_deck', 'canal_steps_w', 'canal_steps_e',
          /* 通用地面素材第一批（assets/source/ground-batch-01）：图早就画好放进 assets/tiles 了，
             但没登记在这里就等于没加载 —— 地图设计稿引用它们时地面会画成空白 */
          'ground_concrete_plain_01', 'ground_concrete_plain_02',
          'ground_soil_compact_01', 'ground_soil_compact_02'],

  /* 装备图标：48×48，见 assets/gear/README.md。
     缺图会退回文字，不影响游戏。 */
  gear: ['rifle', 'shotgun', 'smg', 'pistol',
         'helmet1', 'helmet2', 'helmet3', 'helmet4', 'helmet5', 'helmet6',
         'body1', 'body2', 'body3', 'body4', 'body5', 'body6',
         'bag'],

  /* 飘字用的位图字体图集（assets/effects/float_*.png）。
     由 tools/build-floatfont.js 从素材包生成，键要和 FLOAT_FONTS 里的 sheet 对上。 */
  effects: ['float_damage', 'float_crit', 'float_melee']
};
/* 容器贴图自动并入预加载表：新增容器只要 CONTAINER_TYPES 写了 art，
   就不会因为忘了登记白名单而在游戏里变成代码画的色块。 */
ART.props = [...new Set([...ART.props, ...Object.values(CONTAINER_TYPES).map(t => t.art)])];

/* 场景摆设：默认实体占一格；仅 ground:true 的地面贴花可穿过。 */
const DECOR = RAID_MAP.props;

/* ------------------------------------------------------------
   武器
   两个主武器槽 + 一个副武器位。slot 决定它能放进哪个位置。
   数值直接驱动 Player.tryShoot / 换弹 / HUD。
   ------------------------------------------------------------ */
/* BEGIN ARSENAL */
const WEAPON_ALIASES = {"rifle":"m4a1","smg":"pp19_01","shotgun":"mp155","pistol":"glock17"};
function canonicalWeaponId(id){return WEAPON_ALIASES[id]||id;}
const WEAPONS = {
  "m4a1": {
    "id": "m4a1",
    "name": "M4A1",
    "short": "M4A1",
    "category": "rifle",
    "caliber": "556",
    "rpm": 800,
    "mag": 30,
    "reloadTime": 2.4,
    "price": 168000,
    "rarity": 5,
    "w": 3.2,
    "recoilVMul": 1,
    "recoilHMul": 1,
    "spreadMul": 1,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "M4A1，使用5.56×45mm弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "黑色AR式卡宾枪，直线伸缩枪托、短护木、顶部提把和弧形弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.4,
    "spreadBase": 0.04,
    "spreadMax": 0.26,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "akm": {
    "id": "akm",
    "name": "AKM",
    "short": "AKM",
    "category": "rifle",
    "caliber": "762x39",
    "rpm": 600,
    "mag": 30,
    "reloadTime": 2.7,
    "price": 125000,
    "rarity": 4,
    "w": 3.6,
    "recoilVMul": 1.35,
    "recoilHMul": 1.2,
    "spreadMul": 1.1,
    "recoilPerShot": 0.085,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "AKM，使用7.62×39mm弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "深色钢制机匣，旧胡桃木枪托与护木，明显弯曲的7.62弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_762x39_1",
    "dmgMin": 20,
    "dmgMax": 27,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.4,
    "spreadBase": 0.044000000000000004,
    "spreadMax": 0.28600000000000003,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "famas_f1": {
    "id": "famas_f1",
    "name": "FAMAS F1",
    "short": "FAMAS F1",
    "category": "rifle",
    "caliber": "556",
    "rpm": 1000,
    "mag": 25,
    "reloadTime": 2.9,
    "price": 215000,
    "rarity": 5,
    "w": 3.7,
    "recoilVMul": 1.1,
    "recoilHMul": 1.25,
    "spreadMul": 1.05,
    "recoilPerShot": 0.09,
    "modes": [
      "semi",
      "burst3",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "FAMAS F1，使用5.56×45mm弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "黑色无托步枪，顶部高提把，弹匣位于握把后方，短枪管。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.4,
    "spreadBase": 0.042,
    "spreadMax": 0.273,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "pp19_01": {
    "id": "pp19_01",
    "name": "PP-19-01 Vityaz",
    "short": "PP-19-01",
    "category": "smg",
    "caliber": "9mm",
    "rpm": 700,
    "mag": 30,
    "reloadTime": 2.1,
    "price": 72000,
    "rarity": 3,
    "w": 2.4,
    "recoilVMul": 0.7,
    "recoilHMul": 0.8,
    "spreadMul": 1.05,
    "recoilPerShot": 0.055,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "PP-19-01 Vityaz，使用9×19mm弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "黑色短管AK式冲锋枪，三角折叠托，细长弯曲弹匣，不采用螺旋弹筒。",
    "attackType": "bullet",
    "injuryChanceMul": 0.8,
    "slot": "primary",
    "ammo": "ammo_9mm_1",
    "dmgMin": 11,
    "dmgMax": 15,
    "pellets": 1,
    "speed": 600,
    "range": 420,
    "aimTime": 0.3,
    "spreadBase": 0.052500000000000005,
    "spreadMax": 0.29400000000000004,
    "recoilBaseV": 2.6,
    "recoilBaseH": 1.8,
    "pelletSpread": 0
  },
  "mp5a3": {
    "id": "mp5a3",
    "name": "MP5A3",
    "short": "MP5A3",
    "category": "smg",
    "caliber": "9mm",
    "rpm": 800,
    "mag": 30,
    "reloadTime": 2.3,
    "price": 115000,
    "rarity": 4,
    "w": 2.6,
    "recoilVMul": 0.6,
    "recoilHMul": 0.65,
    "spreadMul": 0.8,
    "recoilPerShot": 0.06,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "MP5A3，使用9×19mm弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "圆筒形护木，双导杆伸缩枪托，细弯弹匣，深色滚轮闭锁机匣轮廓。",
    "attackType": "bullet",
    "injuryChanceMul": 0.8,
    "slot": "primary",
    "ammo": "ammo_9mm_1",
    "dmgMin": 11,
    "dmgMax": 15,
    "pellets": 1,
    "speed": 600,
    "range": 420,
    "aimTime": 0.3,
    "spreadBase": 0.04000000000000001,
    "spreadMax": 0.22400000000000003,
    "recoilBaseV": 2.6,
    "recoilBaseH": 1.8,
    "pelletSpread": 0
  },
  "ump45": {
    "id": "ump45",
    "name": "UMP45",
    "short": "UMP45",
    "category": "smg",
    "caliber": "45acp",
    "rpm": 600,
    "mag": 25,
    "reloadTime": 2.3,
    "price": 108000,
    "rarity": 4,
    "w": 2.3,
    "recoilVMul": 0.95,
    "recoilHMul": 0.9,
    "spreadMul": 1,
    "recoilPerShot": 0.07,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "UMP45，使用.45 ACP弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "方正深灰聚合物机匣，镂空折叠托，粗直弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 0.8,
    "slot": "primary",
    "ammo": "ammo_45acp_1",
    "dmgMin": 15,
    "dmgMax": 20,
    "pellets": 1,
    "speed": 600,
    "range": 420,
    "aimTime": 0.3,
    "spreadBase": 0.05,
    "spreadMax": 0.28,
    "recoilBaseV": 2.6,
    "recoilBaseH": 1.8,
    "pelletSpread": 0
  },
  "mp155": {
    "id": "mp155",
    "name": "MP-155",
    "short": "MP-155",
    "category": "shotgun",
    "caliber": "12g",
    "rpm": 240,
    "mag": 5,
    "reloadTime": 0.65,
    "price": 78000,
    "rarity": 3,
    "w": 3.6,
    "recoilVMul": 1.85,
    "recoilHMul": 1.4,
    "spreadMul": 1,
    "recoilPerShot": 0.22,
    "modes": [
      "semi"
    ],
    "defaultMode": "semi",
    "reloadType": "tube",
    "cycleTime": 0,
    "desc": "MP-155，使用12 Gauge弹药。六枚弹丸；装填方式与动作循环依型号区分。",
    "visual": "长枪管半自动猎枪，胡桃木枪托和前护木，下方细长管式弹仓，无盒式弹匣。",
    "attackType": "shotgun",
    "injuryChanceMul": 1,
    "slot": "primary",
    "ammo": "ammo_12g_1",
    "dmgMin": 7,
    "dmgMax": 10,
    "pellets": 6,
    "speed": 560,
    "range": 300,
    "aimTime": 0.45,
    "spreadBase": 0.025,
    "spreadMax": 0.14,
    "recoilBaseV": 4.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0.1785
  },
  "rem870": {
    "id": "rem870",
    "name": "Remington 870",
    "short": "R870",
    "category": "shotgun",
    "caliber": "12g",
    "rpm": 75,
    "mag": 6,
    "reloadTime": 0.75,
    "price": 58000,
    "rarity": 3,
    "w": 3.4,
    "recoilVMul": 2.2,
    "recoilHMul": 1.25,
    "spreadMul": 0.85,
    "recoilPerShot": 0.24,
    "modes": [
      "pump"
    ],
    "defaultMode": "pump",
    "reloadType": "tube",
    "cycleTime": 0.8,
    "desc": "Remington 870，使用12 Gauge弹药。六枚弹丸；装填方式与动作循环依型号区分。",
    "visual": "深色木枪托，长条肋纹泵动护木，钢制机匣和管式弹仓，无盒式弹匣。",
    "attackType": "shotgun",
    "injuryChanceMul": 1,
    "slot": "primary",
    "ammo": "ammo_12g_1",
    "dmgMin": 7,
    "dmgMax": 10,
    "pellets": 6,
    "speed": 560,
    "range": 300,
    "aimTime": 0.45,
    "spreadBase": 0.02125,
    "spreadMax": 0.11900000000000001,
    "recoilBaseV": 4.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0.1785
  },
  "saiga12": {
    "id": "saiga12",
    "name": "Saiga-12",
    "short": "Saiga-12",
    "category": "shotgun",
    "caliber": "12g",
    "rpm": 300,
    "mag": 8,
    "reloadTime": 3.3,
    "price": 175000,
    "rarity": 5,
    "w": 3.8,
    "recoilVMul": 2.1,
    "recoilHMul": 1.75,
    "spreadMul": 1.2,
    "recoilPerShot": 0.26,
    "modes": [
      "semi"
    ],
    "defaultMode": "semi",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "Saiga-12，使用12 Gauge弹药。六枚弹丸；装填方式与动作循环依型号区分。",
    "visual": "黑色AK式霰弹枪，聚合物固定托，较粗枪管，明显的宽盒式弹匣。",
    "attackType": "shotgun",
    "injuryChanceMul": 1,
    "slot": "primary",
    "ammo": "ammo_12g_1",
    "dmgMin": 7,
    "dmgMax": 10,
    "pellets": 6,
    "speed": 560,
    "range": 300,
    "aimTime": 0.45,
    "spreadBase": 0.03,
    "spreadMax": 0.168,
    "recoilBaseV": 4.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0.1785
  },
  "glock17": {
    "id": "glock17",
    "name": "Glock 17",
    "short": "Glock",
    "category": "pistol",
    "caliber": "9mm",
    "rpm": 360,
    "mag": 17,
    "reloadTime": 1.5,
    "price": 32000,
    "rarity": 2,
    "w": 1.1,
    "recoilVMul": 0.75,
    "recoilHMul": 0.8,
    "spreadMul": 0.95,
    "recoilPerShot": 0.1,
    "modes": [
      "semi"
    ],
    "defaultMode": "semi",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "Glock 17，使用9×19mm弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "黑色方形套筒，简洁聚合物枪身与双排弹匣握把，短枪管。",
    "attackType": "bullet",
    "injuryChanceMul": 1,
    "slot": "secondary",
    "ammo": "ammo_9mm_1",
    "dmgMin": 11,
    "dmgMax": 15,
    "pellets": 1,
    "speed": 600,
    "range": 460,
    "aimTime": 0.2,
    "spreadBase": 0.042749999999999996,
    "spreadMax": 0.209,
    "recoilBaseV": 2.4,
    "recoilBaseH": 1.6,
    "pelletSpread": 0
  },
  "m1911a1": {
    "id": "m1911a1",
    "name": "M1911A1",
    "short": "M1911A1",
    "category": "pistol",
    "caliber": "45acp",
    "rpm": 300,
    "mag": 7,
    "reloadTime": 1.8,
    "price": 37000,
    "rarity": 3,
    "w": 1.2,
    "recoilVMul": 1.2,
    "recoilHMul": 1,
    "spreadMul": 0.9,
    "recoilPerShot": 0.12,
    "modes": [
      "semi"
    ],
    "defaultMode": "semi",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "M1911A1，使用.45 ACP弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "细长钢制套筒，棕色单排握把，外露击锤与圆弧扳机护圈。",
    "attackType": "bullet",
    "injuryChanceMul": 1,
    "slot": "secondary",
    "ammo": "ammo_45acp_1",
    "dmgMin": 15,
    "dmgMax": 20,
    "pellets": 1,
    "speed": 600,
    "range": 460,
    "aimTime": 0.2,
    "spreadBase": 0.0405,
    "spreadMax": 0.198,
    "recoilBaseV": 2.4,
    "recoilBaseH": 1.6,
    "pelletSpread": 0
  },
  "beretta92": {
    "id": "beretta92",
    "name": "Beretta 92FS",
    "short": "92FS",
    "category": "pistol",
    "caliber": "9mm",
    "rpm": 360,
    "mag": 15,
    "reloadTime": 1.7,
    "price": 44000,
    "rarity": 3,
    "w": 1.2,
    "recoilVMul": 0.7,
    "recoilHMul": 0.65,
    "spreadMul": 0.8,
    "recoilPerShot": 0.09,
    "modes": [
      "semi"
    ],
    "defaultMode": "semi",
    "reloadType": "magazine",
    "cycleTime": 0,
    "desc": "Beretta 92FS，使用9×19mm弹药。同口径弹药统一决定基础伤害与穿透，型号决定射击节奏与操控。",
    "visual": "较长开放式套筒，露出的枪管，深色握把与圆弧护圈。",
    "attackType": "bullet",
    "injuryChanceMul": 1,
    "slot": "secondary",
    "ammo": "ammo_9mm_1",
    "dmgMin": 11,
    "dmgMax": 15,
    "pellets": 1,
    "speed": 600,
    "range": 460,
    "aimTime": 0.2,
    "spreadBase": 0.036,
    "spreadMax": 0.17600000000000002,
    "recoilBaseV": 2.4,
    "recoilBaseH": 1.6,
    "pelletSpread": 0
  },
  "m16a1": {
    "id": "m16a1",
    "name": "M16A1",
    "short": "M16A1",
    "category": "rifle",
    "caliber": "556",
    "rpm": 750,
    "mag": 20,
    "w": 3.2,
    "reloadTime": 2.8,
    "price": 35000,
    "rarity": 1,
    "recoilVMul": 1.1,
    "recoilHMul": 1.15,
    "spreadMul": 0.95,
    "aimTimeMul": 1.15,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": true,
    "desc": "枪身上的编号已经磨得模糊，但护木和枪托仍然完整。老式装备并不意味着它已经失去了用途。",
    "visual": "固定枪托、三角护木、长枪管、提把、20发短弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.45999999999999996,
    "spreadBase": 0.038,
    "spreadMax": 0.247,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "galil_arm": {
    "id": "galil_arm",
    "name": "Galil ARM",
    "short": "Galil ARM",
    "category": "rifle",
    "caliber": "556",
    "rpm": 650,
    "mag": 35,
    "w": 4.2,
    "reloadTime": 3,
    "price": 30000,
    "rarity": 1,
    "recoilVMul": 1.25,
    "recoilHMul": 1.2,
    "spreadMul": 1.15,
    "aimTimeMul": 1.15,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": true,
    "desc": "厚实的机匣、沉重的枪身，以及一个比多数同类武器更宽裕的弹匣。它从来不以轻巧著称。",
    "visual": "钢机匣、木护木、管式折叠枪托、折叠两脚架、大弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.45999999999999996,
    "spreadBase": 0.046,
    "spreadMax": 0.299,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "aks74u": {
    "id": "aks74u",
    "name": "AKS-74U",
    "short": "AKS-74U",
    "category": "rifle",
    "caliber": "545x39",
    "rpm": 700,
    "mag": 30,
    "w": 2.7,
    "reloadTime": 2.4,
    "price": 65000,
    "rarity": 2,
    "recoilVMul": 1.25,
    "recoilHMul": 1.2,
    "spreadMul": 1.15,
    "aimTimeMul": 0.8,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": true,
    "desc": "短小的枪身和折叠枪托让它很适合狭窄空间。至于连续射击时那股不安分的劲头，最好亲自试试。",
    "visual": "短枪管、膨大消焰器、短木护木、三角折叠枪托。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_545x39_1",
    "dmgMin": 17,
    "dmgMax": 24,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.32000000000000006,
    "spreadBase": 0.046,
    "spreadMax": 0.299,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "g36c": {
    "id": "g36c",
    "name": "G36C",
    "short": "G36C",
    "category": "rifle",
    "caliber": "556",
    "rpm": 750,
    "mag": 30,
    "w": 2.8,
    "reloadTime": 2.5,
    "price": 78000,
    "rarity": 2,
    "recoilVMul": 0.95,
    "recoilHMul": 1.1,
    "spreadMul": 1.1,
    "aimTimeMul": 0.85,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": true,
    "desc": "聚合物枪身减轻了负担，紧凑的结构也方便携行。它原本就是为行动迅速的人设计的。",
    "visual": "黑色聚合物短枪身、镂空折叠枪托、透明弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.34,
    "spreadBase": 0.044000000000000004,
    "spreadMax": 0.28600000000000003,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "fn_fnc": {
    "id": "fn_fnc",
    "name": "FN FNC",
    "short": "FN FNC",
    "category": "rifle",
    "caliber": "556",
    "rpm": 650,
    "mag": 30,
    "w": 3.8,
    "reloadTime": 2.7,
    "price": 100000,
    "rarity": 3,
    "recoilVMul": 0.9,
    "recoilHMul": 0.95,
    "spreadMul": 0.95,
    "aimTimeMul": 1.05,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": true,
    "desc": "坚实的结构和朴素的设计让它在制式武器中占有一席之地。没有什么花哨之处，也很少令人失望。",
    "visual": "朴素钢机匣、深色护木、管式折叠枪托、长枪管。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.42000000000000004,
    "spreadBase": 0.038,
    "spreadMax": 0.247,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "sig550": {
    "id": "sig550",
    "name": "SIG SG 550",
    "short": "SIG SG 550",
    "category": "rifle",
    "caliber": "556",
    "rpm": 700,
    "mag": 30,
    "w": 4.1,
    "reloadTime": 2.8,
    "price": 125000,
    "rarity": 3,
    "recoilVMul": 0.85,
    "recoilHMul": 0.8,
    "spreadMul": 0.8,
    "aimTimeMul": 1.15,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": true,
    "desc": "精密的制造工艺带来了良好的射击一致性。即使经历长时间存放，保养得当的枪械依然值得信赖。",
    "visual": "橄榄绿护木和镂空折叠枪托、灰色机匣、透明弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.45999999999999996,
    "spreadBase": 0.032,
    "spreadMax": 0.20800000000000002,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "an94": {
    "id": "an94",
    "name": "AN-94",
    "short": "AN-94",
    "category": "rifle",
    "caliber": "545x39",
    "rpm": 600,
    "mag": 30,
    "w": 3.9,
    "reloadTime": 2.8,
    "price": 165000,
    "rarity": 4,
    "recoilVMul": 1.05,
    "recoilHMul": 0.95,
    "spreadMul": 0.9,
    "aimTimeMul": 1.1,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "burst2",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": false,
    "desc": "复杂的内部机构实现了惊人的短时射速。它并不好维护，但对于熟悉它的人而言，那两声几乎重叠的枪响足以说明价值。",
    "visual": "黑色非对称机匣、倾斜弹匣、长枪管组件。",
    "burstRPM": 1800,
    "burstDelayRecoil": true,
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_545x39_1",
    "dmgMin": 17,
    "dmgMax": 24,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.44000000000000006,
    "spreadBase": 0.036000000000000004,
    "spreadMax": 0.234,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "aug_a1": {
    "id": "aug_a1",
    "name": "AUG A1",
    "short": "AUG A1",
    "category": "rifle",
    "caliber": "556",
    "rpm": 700,
    "mag": 30,
    "w": 3.6,
    "reloadTime": 2.7,
    "price": 230000,
    "rarity": 5,
    "recoilVMul": 0.8,
    "recoilHMul": 0.75,
    "spreadMul": 0.75,
    "aimTimeMul": 1.05,
    "recoilPerShot": 0.075,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "shopAvailable": false,
    "desc": "紧凑的无托结构、独特的外形和一体式光学瞄具，使它即使混在一整排枪械中，也很难被认错。",
    "visual": "橄榄绿无托枪身、一体式光学提把、垂直折叠握把。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_556_1",
    "dmgMin": 15,
    "dmgMax": 22,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.42000000000000004,
    "spreadBase": 0.03,
    "spreadMax": 0.195,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "groza1": {
    "category": "rifle",
    "mag": 30,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "id": "groza1",
    "name": "OTs-14-1A Groza-1「雷暴」",
    "short": "Groza-1",
    "caliber": "762x39",
    "rpm": 700,
    "w": 3.2,
    "reloadTime": 2.6,
    "price": 250000,
    "rarity": 5,
    "recoilVMul": 1.4,
    "recoilHMul": 1.25,
    "spreadMul": 1.05,
    "aimTimeMul": 0.75,
    "recoilPerShot": 0.085,
    "shopAvailable": false,
    "desc": "无托结构将7.62毫米火力压进了短小的枪身。抬枪迅速，穿行狭窄通道时也不易磕碰，但连续射击时的跳动需要用力压住。环礁湾的旧装备箱上只给它留了一个简短的译名：雷暴。",
    "visual": "紧凑黑色无托枪身、高提把、握把后方的弯曲AK弹匣、短枪管与前握把。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_762x39_1",
    "dmgMin": 20,
    "dmgMax": 27,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.30000000000000004,
    "spreadBase": 0.042,
    "spreadMax": 0.273,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "ak12": {
    "category": "rifle",
    "mag": 30,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "id": "ak12",
    "name": "AK-12",
    "short": "AK-12",
    "caliber": "545x39",
    "rpm": 700,
    "w": 3.5,
    "reloadTime": 2.5,
    "price": 115000,
    "rarity": 3,
    "recoilVMul": 0.9,
    "recoilHMul": 0.85,
    "spreadMul": 0.9,
    "aimTimeMul": 1,
    "recoilPerShot": 0.075,
    "shopAvailable": true,
    "desc": "导轨护木、可调枪托和重新布置的操控部件，让这支现代制式步枪比它的前辈更容易上手。使用5.45×39毫米弹药，连续射击较为平稳，也给携行者留下了充足的改装余地。",
    "visual": "黑色现代AK机匣、连续顶轨、开槽聚合物护木、可调枪托和较直的5.45弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_545x39_1",
    "dmgMin": 17,
    "dmgMax": 24,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.4,
    "spreadBase": 0.036000000000000004,
    "spreadMax": 0.234,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  },
  "mk47_mod2": {
    "category": "rifle",
    "mag": 30,
    "modes": [
      "semi",
      "auto"
    ],
    "defaultMode": "auto",
    "reloadType": "magazine",
    "cycleTime": 0,
    "id": "mk47_mod2",
    "name": "MK47 MOD.2「Mutant」",
    "short": "MK47 MOD.2",
    "caliber": "762x39",
    "rpm": 650,
    "w": 3.5,
    "reloadTime": 2.6,
    "price": 175000,
    "rarity": 4,
    "recoilVMul": 1.05,
    "recoilHMul": 0.9,
    "spreadMul": 0.8,
    "aimTimeMul": 1.05,
    "recoilPerShot": 0.08,
    "shopAvailable": false,
    "desc": "环礁湾一家武器工坊基于Mk47构思试制的全自动改型。AR式操控布局配合7.62×39毫米弹药和弯曲弹匣，着重改善射击一致性与后坐力控制。MOD.2是工坊自编的改型编号，现存样枪的零件与加工痕迹并不完全一致。",
    "visual": "黑色AR式机匣、细长M-LOK护木、可调镂空枪托与明显弯曲的AK式7.62弹匣。",
    "attackType": "bullet",
    "injuryChanceMul": 1.1,
    "slot": "primary",
    "ammo": "ammo_762x39_1",
    "dmgMin": 20,
    "dmgMax": 27,
    "pellets": 1,
    "speed": 620,
    "range": 640,
    "aimTime": 0.42000000000000004,
    "spreadBase": 0.032,
    "spreadMax": 0.20800000000000002,
    "recoilBaseV": 3.4,
    "recoilBaseH": 2.4,
    "pelletSpread": 0
  }
};
for(const [old,id]of Object.entries(WEAPON_ALIASES))Object.defineProperty(WEAPONS,old,{get:()=>WEAPONS[id],enumerable:false});
ART.gear=[...new Set([...ART.gear.filter(id=>!WEAPON_ALIASES[id]),...Object.keys(WEAPONS)])];
/* END ARSENAL */

/* 三个武器位：0/1 主武器，2 副武器（副武器必须一直有枪，见 Base.ensureSidearm） */
const DEFAULT_WEAPONS = ['m4a1','mp155','glock17'];
const SIDEARM_SLOT = 2;
const MELEE = [
 {id:'melee01',attackType:'sharp',hitSfx:'melee_hit_small',name:'旧式折叠刀',short:'折叠刀',r:1,w:.15,price:45000,damage:12,interval:.55,windup:.12,angle:55,radius:.65,available:true,desc:"一种带锁定机构的普通折叠刀，刀身不长，折叠后能够轻松放进衣袋。\n\n事故发生后，环礁湾的五金店曾出现过短暂的折叠刀抢购潮。店主们最初以为人们需要它来割断绳索、拆开包装，或者处理其他生活琐事。\n\n直到有人开始询问，刀刃究竟能不能刺穿厚重的冬季外套。"},
 {id:'melee02',attackType:'sharp',hitSfx:'melee_hit_medium',name:'M-9 制式战斗刀',short:'战斗刀',r:3,w:.35,price:270000,damage:18,interval:.85,windup:.20,angle:75,radius:.80,available:true,desc:"军用标准固定刃刀具，采用一体式刀身与防滑握柄，配有可固定在腰带上的硬质刀鞘。\n\nM-9 的采购报告曾将其定义为「具备多功能野外作业能力的辅助工具」，并特别强调其不应被视作步兵的主要作战武器。\n\n但军需部门始终没有明确解释，为什么这把辅助工具需要在每批产品出厂前接受穿刺性能检验。"},
 {id:'melee03',attackType:'sharp',lootSource:'受雇回收员背包 / 防水补给箱（1%总概率额外掉落）',hitSfx:'melee_hit_large',name:'重型丛林砍刀',short:'砍刀',r:4,w:.85,price:675000,damage:26,interval:1.40,windup:.35,angle:100,radius:.95,available:false,desc:"面向热带林地清障与野外作业设计的大型砍刀，采用加厚刀背与宽幅刀身，能够有效处理藤蔓、灌木及较粗的木质枝条。\n\n环礁湾沿海植被在灾害发生后出现过几轮异常生长，部分原本需要数月才能恢复的灌木，在短短几周内便重新覆盖了清理过的道路。\n\n林业部门因此采购了一批加重型砍刀。\n\n采购记录显示，最后一批货物的收货单位并非林业部门，而是环礁湾特别治安署。"},
 {"id":"melee04",attackType:'sharp',"vfx":"thrust","name":"三棱军刺","short":"军刺","r":4,"w":0.45,"price":570000,"damage":32,"interval":1.65,"windup":0.3,"angle":25,"radius":1,"available":true,"hitSfx":"melee_hit_stab","positioning":"远距精准刺击","desc":"旧式军用穿刺武器，采用狭长的三棱截面刺身，刀尖坚硬，缺乏适合劈砍的刃口。\n\n环礁湾特别治安署的装备清单中，这种武器早已被标注为淘汰品。然而灾害发生后，一批封存多年的军刺重新出现在临时检查站。据说，有些执勤人员发现，面对某些不应该继续活动的东西，刺得足够深，比砍得足够重更重要。"},
 {"id":"melee05",attackType:'sharp',"name":"应急救援刀","short":"救援刀","r":2,"w":0.25,"price":127500,"damage":10,"interval":0.42,"windup":0.1,"angle":65,"radius":0.55,"available":true,"hitSfx":"melee_hit_small","positioning":"快速贴身反击","desc":"专为紧急救援作业设计的短刃工具，配有醒目的橙色防滑握柄。刀刃较短，却能在狭窄空间内快速完成切割动作。\n\n灾害初期，环礁湾的消防与医疗队伍曾大量配发这种刀具。它们原本用于切断安全带、衣物和绳索。后来，有人发现救援现场留下的刀痕并不全在这些东西上。"},
 {"id":"melee06",attackType:'blunt',"name":"工业撬棍","short":"撬棍","r":2,"w":1.2,"price":165000,"damage":22,"interval":1.2,"windup":0.32,"angle":85,"radius":0.85,"available":true,"hitSfx":"melee_hit_medium","positioning":"中型钝器挥击","descEmphasis":"「科研」。","desc":"采用高强度合金钢锻造的工业撬棍，一端弯曲并设有拔钉槽，广泛用于建筑施工、设备维修与物理学研究。\n\n据说，某位沉默寡言的理论物理学博士曾凭借类似的工具，在一场严重的科研事故中解决了大量超出其专业范畴的问题，也因此它获得了物理学圣剑的称号。\n\n尽管这一传闻的真实性无从考证，但环礁湾某研究所的内部采购清单显示，他们确实曾一次性订购了二十四根撬棍。\n\n采购用途一栏只写着两个字：\n\n「科研」。"},
 {"id":"melee07",attackType:'sharp',"lootSource":"受雇回收员背包 / 防水补给箱（1%总概率额外掉落）","name":"廓尔喀弯刀","short":"弯刀","r":5,"w":0.75,"price":1080000,"damage":30,"interval":1.5,"windup":0.38,"angle":110,"radius":0.85,"available":false,"hitSfx":"melee_hit_large","positioning":"重型广角挥砍","desc":"刀身向前弯曲的传统重型刀具，重心集中于刀刃前段，适合大幅度挥砍。刀柄保留了传统木质结构，经过多次打磨，表面已有明显的使用痕迹。\n\n这把弯刀曾属于一名在环礁湾定居的外籍退役军人。灾害发生后，他拒绝接受治安署提供的制式武器，只带着这把刀离开了安置营。数周后，搜救队在一处废弃哨站找到了它，刀鞘完好，刀身却留下了无法辨认的深色污迹。"}
];
ART.gear.push(...MELEE.map(m=>m.id));

/* ------------------------------------------------------------
   护甲：六级头盔 / 六级身体护甲
   lv = 防护等级（对应 BALLISTICS.MATRIX 的列），dur = 最大耐久，
   aimPenaltyPct = 身体护甲的瞄准准备时间惩罚；move仅保留为1的兼容字段。
   已经没有"固定减伤率"这回事：挡多少只看弹药穿透等级 × 护甲等级 × 剩余耐久。
   价格采用 economy.json 中六级代表价；同级变体后续可围绕代表价浮动。
   ------------------------------------------------------------ */
const HELMETS = [
  { lv: 1, name: '布面工帽',   short: '工帽',   dur: 20,  w: 0.5, move: 1,    price: 2000  },
  { lv: 2, name: '工程安全帽', short: '安全帽', dur: 30,  w: 0.8, move: 1,    price: 6000  },
  { lv: 3, name: '防撞头盔',   short: '防撞盔', dur: 45,  w: 1.2, move: 1,    price: 15000  },
  { lv: 4, name: '防弹头盔',   short: '防弹盔', dur: 65,  w: 1.8, move: 1,    price: 48000  },
  { lv: 5, name: '重型防弹盔', short: '重盔',   dur: 85,  w: 2.5, move: 1,    price: 120000 },
  { lv: 6, name: '攻坚头盔',   short: '攻坚盔', dur: 110, w: 3.5, move: 1,    price: 350000 }
];

const BODIES = [
  { lv: 1, name: '帆布护胸',   short: '护胸',   dur: 40,  w: 1.5, move: 1.00, price: 3000  },
  { lv: 2, name: '防刺背心',   short: '防刺',   dur: 60,  w: 2.5, move: 0.98, price: 9000  },
  { lv: 3, name: '轻型战术背心', short: '轻甲', dur: 85,  w: 4.0, move: 0.96, price: 28000  },
  { lv: 4, name: '战术防弹衣', short: '战术甲', dur: 115, w: 6.0, move: 0.94, price: 85000 },
  { lv: 5, name: '重型防弹衣', short: '重甲',   dur: 150, w: 9.0, move: 0.91, price: 220000 },
  { lv: 6, name: '攻坚装甲',   short: '攻坚甲', dur: 190, w: 13.0, move: 0.88, price: 650000 }
];

/* ------------------------------------------------------------
   背包：独立的背包槽，只提升携带容量，不加别的属性
   未装备时是 BASE_BAG_SLOTS 格；装上背包后总容量 = 背包容量，
   不做「基础 + N」的叠加。五档对应白绿蓝紫金。
   背包不能套娃：塞不进背包格子（Bag.canAdd 会拦），只能回藏身处换。
   前 3 档护甲商人有售，紫金两档得自己下去找。
   基础格数从 4 抬到 6：药品不再叠放，一件一格，
   三口径弹药 + 两件药就要占 5 格，4 格根本装不下出门的那套。
   ------------------------------------------------------------ */
/* BEGIN ARMOR VARIANTS */
const ARMOR_VARIANTS = [
  {
    "id": "helmet1_motorcycle",
    "type": "helmet",
    "lv": 1,
    "name": "旧式摩托盔",
    "short": "摩托盔",
    "dur": 28,
    "w": 0.85,
    "price": 2400,
    "aimPenaltyPct": 0,
    "desc": "早年常见的开放式摩托车头盔，硬壳下面填着已经变硬的泡棉，耳侧的衬布还能拆下来清洗。\n\n内衬上印着一排尺码，原主人把其中两个划掉，旁边补了一句：戴围巾时用大的。",
    "visual": "米白色圆鼓硬壳，宽阔的开放面部缺口，短小黑色前檐，耳侧棕色软垫和垂下的下颚带；一道褪色橙条，漆面少量磕碰。没有面罩、导轨或军用附件。与原软布工帽形成圆硬壳／软帽的剪影差别。",
    "source": "民用骑行用品"
  },
  {
    "id": "body1_leather",
    "type": "body",
    "lv": 1,
    "name": "皮革作业背心",
    "short": "皮革背心",
    "dur": 55,
    "w": 2,
    "price": 3600,
    "aimPenaltyPct": 4,
    "desc": "用厚皮革和帆布衬里缝成的作业背心，胸前有两片重叠的护片。扣具很大，戴着手套也能解开。\n\n左下角的工具袋被补了三次。最后一次修补的人没有再缝袋口，而是把整只袋子封死了。",
    "visual": "深红棕皮革，宽肩、深V领、三枚粗金属扣，胸前大块叠皮，腰侧一只扁工具袋；轮廓上宽下直，皮面有折痕与浅色擦伤。区别原土黄帆布护胸，不画成带钢板的重甲。",
    "source": "船厂、机械维修作业用品"
  },
  {
    "id": "helmet2_rescue",
    "type": "helmet",
    "lv": 2,
    "name": "轻型救援盔",
    "short": "救援盔",
    "dur": 24,
    "w": 0.6,
    "price": 7200,
    "aimPenaltyPct": 0,
    "desc": "面向狭窄空间作业的轻型头盔，采用短檐外壳与四点式固定带，蹲下或低头时不容易从头上滑落。\n\n培训说明要求每次使用前检查扣具。实际留在盔上的检查贴纸，已经把能填写的地方全部用完了。",
    "visual": "褪色暗橙色低矮硬壳，短檐、两道宽散热槽，细黑色四点下颚带，后缘小块米白反光贴。没有医疗十字、不配置现代灯具导轨。比黄色工程帽更贴头、轮廓更低。",
    "source": "城市救援与检修作业用品"
  },
  {
    "id": "body2_concealed",
    "type": "body",
    "lv": 2,
    "name": "隐蔽式软甲",
    "short": "隐蔽软甲",
    "dur": 45,
    "w": 1.8,
    "price": 10800,
    "aimPenaltyPct": 4,
    "desc": "可以穿在衬衣下面的薄型防护背心，肩部和侧腰采用宽幅粘扣，外层布套允许单独拆洗。\n\n销售手册特意展示了它藏在西装下面的照片。照片中的人把外套扣得很紧，双臂始终没有放下来。",
    "visual": "灰白或浅米色薄软甲，圆领、窄肩、两侧宽粘扣片，胸前平整只有一条浅缝；没有外挂袋和硬插板轮廓。紧凑、贴身、短下摆，与黑色厚层防刺背心分开。",
    "source": "民用安保与通勤防护用品"
  },
  {
    "id": "helmet3_riot",
    "type": "helmet",
    "lv": 3,
    "name": "治安防暴盔",
    "short": "防暴盔",
    "dur": 60,
    "w": 1.7,
    "price": 18000,
    "aimPenaltyPct": 0,
    "desc": "深色防暴头盔，面罩由两侧转轴固定，后方缝着一片可折起的护颈。面罩上的擦痕比盔壳上的多得多。\n\n储藏室的交接表将面罩列作可更换耗材。最后几次记录里，这一栏都写着：缺货，保留旧件。",
    "visual": "深海军蓝厚圆壳，两侧大圆转轴，透明烟灰面罩抬到额头前上方，后缘短黑色护颈。用粗轮廓与两道冷灰反光表现透明面罩，不把整张脸涂成白块。没有未来电子装备。",
    "source": "旧公共安全装备库存"
  },
  {
    "id": "body3_fragmentation",
    "type": "body",
    "lv": 3,
    "name": "旧式军用防片衣",
    "short": "防片衣",
    "dur": 110,
    "w": 5.2,
    "price": 33600,
    "aimPenaltyPct": 30,
    "desc": "上一代军用防护服，厚实的纤维填充层分成数个独立区域，衣领和腹部留有柔软的延伸护片。体积不小，口袋却只有两个。\n\n内侧标签要求在干燥通风处悬挂存放。它被找到时，恰好挂在一间已经没有屋顶的库房里。",
    "visual": "褪色灰橄榄绿厚布衣，短立领、宽肩、分段绗缝与下腹软护片，胸部仅两个扁平斜袋；整体宽厚、长下摆，不画现代织带矩阵或成排弹匣袋，与原窄身战术背心明显区分。",
    "source": "退役军用库存与旧式护送装备"
  },
  {
    "id": "helmet4_light",
    "type": "helmet",
    "lv": 4,
    "name": "短沿轻型防弹盔",
    "short": "轻型弹盔",
    "dur": 50,
    "w": 1.35,
    "price": 57600,
    "aimPenaltyPct": 0,
    "desc": "采用较薄壳体与简化悬挂系统的防弹盔，取消了不必要的外部安装座，主要面向需要长时间佩戴的人员。\n\n采购目录将它称作轻型。包装箱的搬运提示却没有随之修改，仍然要求两人共同抬运。",
    "visual": "砂灰色紧凑圆壳，极短前檐、较低耳侧轮廓、黑色窄包边与细下颚带，侧面露出一颗小固定螺钉；没有导轨、前挂点、耳机和护颈。靠简洁剪影与浅砂色区别原厚重军绿防弹盔。",
    "source": "专业安保采购与轻装护送装备"
  },
  {
    "id": "body4_lightplate",
    "type": "body",
    "lv": 4,
    "name": "轻型插板背心",
    "short": "轻型板甲",
    "dur": 90,
    "w": 4.7,
    "price": 102000,
    "aimPenaltyPct": 14,
    "desc": "围绕前后防护板设计的简化载具，只保留必要的固定带和调节扣。侧腰没有厚软垫，活动时会露出里面的衬衣。\n\n卖方附送了一张可另行订购的附件清单。清单上的配件全部装齐以后，它就不再比普通型号轻了。",
    "visual": "深石墨灰窄身板袋，前部一块清晰的切角矩形插板轮廓，两条宽肩带和侧腰开放式织带扣；短下摆、无腹甲、无护颈、没有密集外挂袋。局部旧卡其色缝线，不与浅砂色头盔做成同色套装。",
    "source": "专业承包队与高端安保装备"
  }
];
for (const [type,list] of [['helmet',HELMETS],['body',BODIES]]) {
  list.forEach(d=>{d.id=type+d.lv;d.icon=d.id;d.type=type;d.move=1;d.aimPenaltyPct=type==='body'?[0,0,10,20,30,45,60][d.lv]:0;});
  list.push(...ARMOR_VARIANTS.filter(d=>d.type===type).map(d=>({...d,icon:d.id,move:1})));
}
for(const w of Object.values(WEAPONS))w.aimTime??={rifle:.40,shotgun:.45,smg:.30,pistol:.20}[w.id]??.4;
ART.gear=[...new Set([...ART.gear,...ARMOR_VARIANTS.map(d=>d.id)])];
/* END ARMOR VARIANTS */

const BASE_BAG_SLOTS = 6;

const BAGS = [
  { id: 'bag01', name: '旧帆布挎包',   short: '挎包',  r: 1, slots: 8,  w: 0.7, price: 6000,
    desc: '翻盖、金属搭扣，肩带磨得发亮。装不下一趟完整的搜刮，但比口袋强。' },
  { id: 'bag02', name: '民用旅行背包', short: '旅行包', r: 2, slots: 12, w: 1.2, price: 18000,
    desc: '双肩、分层、拉链没坏。灾前它代表“出门几天”，现在只代表“最好真能带点东西回来”。' },
  { id: 'bag03', name: '加固登山背包', short: '登山包', r: 3, slots: 16, w: 1.9, price: 45000,
    desc: '高包体、顶盖、侧袋和束带。它认真考虑过“背着东西走很远会不会累死”。' },
  { id: 'bag04', name: '战术突击背包', short: '突击包', r: 4, slots: 20, w: 2.8, price: 110000,
    desc: '满身织带和压缩结构，跑起来不会摇得东倒西歪。多装两盒弹，或者一件能改变下周计划的东西。' },
  { id: 'bag05', name: '远征模块背包', short: '远征包', r: 5, slots: 24, w: 3.8, price: 260000,
    desc: '外挂仓、压缩带、金属支撑。宣传语说它“能陪你去地图边缘之外”——现在这句话不太好笑了。' }
];

/* 图标与背包定义同步注册，仓库、商人和局内装备槽共用。 */
ART.gear = [...new Set([...ART.gear, ...BAGS.map(b => b.id)])];

const BACKPACK = {
  list: BAGS,
  def(id) { return BAGS.find(b => b.id === id) || null; },
  /* 穿在身上的实例：只留显示与容量要用的字段，没有耐久 */
  make(id) {
    const d = this.def(id);
    if (!d) return null;
    return { id: d.id, name: d.name, short: d.short, slots: d.slots, w: d.w, price: d.price, r: d.r };
  }
};

/* 护甲表的查表工具 */
const GEAR = {
  helmet: { list: HELMETS, label: '头盔', short: '盔' },
  body:   { list: BODIES,  label: '护甲', short: '甲' },

  /* 按稳定型号ID取模板；旧数字等级继续解析为该级原款。 */
  def(type, lv) {
    const g = this[type];
    if (!g) return null;
    if(lv&&typeof lv==='object')lv=lv.id||lv.lv;
    return g.list.find(x => typeof lv==='string' ? x.id===lv : x.lv===lv) || null;
  },

  icon(g) { return g ? (g.id || g.type+g.lv) : null; },
  atLevel(type,lv) { return (this[type]?.list||[]).filter(d=>d.lv===lv); },
  random(type,lv) { const list=this.atLevel(type,lv);return list.length?this.make(type,list[Math.floor(Math.random()*list.length)].id):null; },

  /* 造一个实例：装备要记住自己的耐久，不能和模板共用 */
  make(type, lv, dur) {
    const d = this.def(type, lv);
    if (!d) return null;
    return {
      id:d.id||type+d.lv, icon:d.icon||d.id||type+d.lv, type, lv: d.lv, name: d.name, short: d.short,
      max: d.dur, dur: (dur == null ? d.dur : U.clamp(dur, 0, d.dur)),
      w: d.w, move: 1, aimPenaltyPct:d.aimPenaltyPct||0, price: d.price, desc:d.desc||''
    };
  },

  /* 耐久状态：只影响显示（颜色 / 提示），不再改变防护数值。
     防护能力只由穿透矩阵和剩余耐久决定，没有"破损减半"这一档。 */
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
  /* 防护等级 → 稀有度：I 寻常、II 良品、III 上乘、IV 稀见、V 珍罕、VI 孤品。
     IV 原本跟上乘同档，四级头甲在仓库和商店里和三级一个颜色，看不出差一档。 */
  return [1, 1, 2, 3, 4, 5, 6][Math.max(0, Math.min(6, lv))] || 1;
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
    g = GEAR.make(g.type, g.id || g.lv, g.dur);
    if (!g) return null;
    return {
      id: 'g_' + g.id,
      name: g.name, short: g.short,
      cat: 'gear', r: gearRarity(g.lv),
      w: g.w, price: g.price,
      sell: this.sellPrice(g.price, g.dur, g.max),
      stack: 1,
      icon: GEAR.icon(g), desc:g.desc,
      equip: { kind: 'armor', gear: Object.assign({}, g) }
    };
  },

  /* 枪（id + 余弹）→ 伪物品。枪没有耐久，回收价固定半价。
     余弹存在 equip.mag 里，所以换下来的枪不会把子弹丢掉。 */
  gun(id, mag, ammoId, rounds, state = {}) {
    const w = typeof Attachments!=='undefined'?Attachments.resolve(id,state.attachments):WEAPONS[canonicalWeaponId(id)];
    if (!w) return null;
    id=w.id;
    const m = Math.max(0, Math.min(w.mag, mag | 0));
    /* 弹匣里装的是哪一档弹药；没写就回落到武器的默认（同口径 Lv1） */
    const a = (ammoId && AMMO_BY_ID[ammoId] && AMMO_BY_ID[ammoId].caliber === w.caliber)
      ? ammoId : w.ammo;
    return {
      id: 'g_' + id,
      name: w.name, short: w.short,
      cat: 'gear', r: w.rarity || 2,
      w: w.w, price: w.price,
      sell: this.sellPrice(w.price, 1, 1),
      stack: 1,
      icon: id,
      equip: { kind: 'gun', gun: id, attachments:{...(w.attachments||{})}, mag: m, ammo: a, rounds: magazineRounds(w, m, a, rounds),fireMode:w.modes.includes(state.fireMode)?state.fireMode:w.defaultMode,cycleRemaining:Math.max(0,Math.min(w.cycleTime,Number(state.cycleRemaining)||0)) },
      note: m > 0 ? String(m) : ''
    };
  },

  /* 背包 id → 伪物品。背包没有耐久，回收价固定半价。
     容量写在 equip.slots 里，穿回去时直接读它。 */
  melee(id, bound=false) {
    const d=MELEE.find(x=>x.id===id); if(!d)return null;
    return {id:'g_'+id,name:d.name,short:d.short,cat:'gear',r:d.r,w:d.w,price:d.price,
      sell:bound?0:Math.floor(d.price/2),stack:1,icon:id,noCodex:true,
      desc:d.desc,descEmphasis:d.descEmphasis,
      equip:{kind:'melee',melee:id,bound:!!bound},note:bound?'绑定':''};
  },
  bag(id) {
    const d = BACKPACK.def(id);
    if (!d) return null;
    return {
      id: 'g_' + d.id,
      name: d.name, short: d.short,
      cat: 'gear', r: d.r,
      w: d.w, price: d.price,
      sell: this.sellPrice(d.price, 1, 1),
      stack: 1,
      icon: d.id,
      equip: { kind: 'bag', bag: d.id, slots: d.slots },
      note: d.slots + '格'
    };
  }
};
/* 队首是下一发；旧存档按原弹种展开，过滤异口径并补齐缺失记录。 */
function magazineRounds(w, n, ammo, rounds) {
  n = Math.max(0, Math.min(w.mag, n|0));
  const fallback = AMMO_BY_ID[ammo]?.caliber === w.caliber ? ammo : w.ammo;
  const out = (Array.isArray(rounds) ? rounds : []).filter(id => AMMO_BY_ID[id]?.caliber === w.caliber).slice(0,n);
  while(out.length < n) out.push(fallback);
  return out;
}/* BEGIN PROP BOUNDS */
const PROP_SPRITE_BOUNDS = {"bed_home":[10,3,11,26],"bed_clinic":[10,3,11,26],"stove_home":[2,12,28,17],"sofa_home":[2,14,28,15],"bench_wood":[2,15,28,14],"display_clock":[2,16,28,13],"counter_shop":[2,15,28,14],"counter_bank":[2,19,28,10],"console_security":[4,3,23,26],"tree_courtyard":[3,3,26,26],"desk":[2,9,28,13],"chair":[2,4,28,24],"shelf":[2,4,28,23],"barrel":[5,2,22,28],"bed_home_side":[2,13,28,16],"bed_home_back":[9,3,14,26],"bed_clinic_side":[2,15,28,14],"bed_clinic_back":[10,3,11,26],"stove_home_side":[6,3,19,26],"stove_home_back":[2,12,28,17],"sofa_home_side":[8,3,15,26],"sofa_home_back":[2,15,28,14],"bench_wood_side":[12,3,7,26],"bench_wood_back":[2,11,28,18],"display_clock_side":[12,3,8,26],"display_clock_back":[2,17,28,12],"counter_shop_side":[11,3,9,26],"counter_shop_back":[2,15,28,14],"counter_bank_side":[13,4,6,25],"counter_bank_back":[2,15,28,14],"console_security_side":[2,4,27,25],"console_security_back":[2,3,27,26],"tree_courtyard_side":[3,3,26,26],"tree_courtyard_back":[3,3,25,26],"desk_side":[12,3,8,26],"desk_back":[2,17,28,12],"chair_side":[2,4,28,25],"chair_back":[2,3,28,26],"shelf_side":[13,4,5,25],"shelf_back":[2,5,28,24],"barrel_side":[4,3,23,26],"barrel_back":[4,3,24,26],"bed_home_large":[3,3,25,58],"bed_home_large_side":[10,3,44,26],"bed_home_large_back":[2,11,28,50],"bed_clinic_large":[3,3,25,58],"bed_clinic_large_side":[7,3,50,26],"bed_clinic_large_back":[3,3,25,58],"sofa_home_large":[8,3,48,26],"sofa_home_large_side":[2,15,28,46],"sofa_home_large_back":[6,3,52,26],"bench_wood_large":[8,3,48,26],"bench_wood_large_side":[8,3,16,58],"bench_wood_large_back":[12,3,40,26],"display_clock_large":[4,3,55,26],"display_clock_large_side":[7,3,18,58],"display_clock_large_back":[2,3,60,26],"counter_shop_large":[6,3,51,26],"counter_shop_large_side":[7,3,19,58],"counter_shop_large_back":[6,3,52,26],"counter_bank_large":[2,7,60,22],"counter_bank_large_side":[9,3,13,58],"counter_bank_large_back":[7,3,49,26],"desk_large":[4,3,55,26],"desk_large_side":[7,3,18,58],"desk_large_back":[2,3,60,26],"shelf_large":[16,3,32,26],"shelf_large_side":[10,4,12,57],"shelf_large_back":[17,3,30,26],"tree_courtyard_canopy":[3,3,90,90],"tree_courtyard_canopy_side":[3,3,89,90],"tree_courtyard_canopy_back":[3,4,89,89],"table_dining":[6,3,51,58],"table_dining_side":[6,3,52,58],"table_dining_back":[6,3,52,58],"chair_wood":[8,3,15,26],"chair_wood_side":[8,3,16,26],"chair_wood_back":[8,3,15,26],"wardrobe_home":[8,3,47,26],"wardrobe_home_side":[5,3,21,58],"wardrobe_home_back":[8,3,47,26],"sink_kitchen":[7,3,17,26],"sink_kitchen_side":[8,3,16,26],"sink_kitchen_back":[6,3,19,26],"fridge_home":[7,3,17,26],"fridge_home_side":[8,3,16,26],"fridge_home_back":[7,3,17,26],"cart_medical":[5,3,21,26],"cart_medical_side":[10,4,12,25],"cart_medical_back":[5,3,21,26],"screen_clinic":[2,6,60,23],"screen_clinic_side":[12,4,8,57],"screen_clinic_back":[2,6,60,23],"workbench_clock":[8,3,48,26],"workbench_clock_side":[6,3,19,58],"workbench_clock_back":[8,3,48,26],"clock_grandfather":[10,4,11,25],"clock_grandfather_side":[12,3,8,26],"clock_grandfather_back":[10,3,11,26],"barrier_queue":[2,15,28,14],"barrier_queue_side":[13,4,6,25],"barrier_queue_back":[2,15,28,14],"workbench_industrial":[7,3,50,26],"workbench_industrial_side":[8,3,17,58],"workbench_industrial_back":[9,4,46,25],"pallet_stack":[14,3,36,26],"pallet_stack_side":[5,3,22,58],"pallet_stack_back":[14,3,35,26]};
/* END PROP BOUNDS */
/* BEGIN SCENE LIBRARY */
for(const a of [{"group":"tiles","id":"ground_concrete_plain_01"},{"group":"tiles","id":"ground_concrete_plain_02"},{"group":"tiles","id":"ground_soil_compact_01"},{"group":"tiles","id":"ground_soil_compact_02"},{"group":"props","id":"barrel"},{"group":"props","id":"barrel_back"},{"group":"props","id":"barrel_side"},{"group":"props","id":"bed_clinic"},{"group":"props","id":"bed_clinic_back"},{"group":"props","id":"bed_clinic_side"},{"group":"props","id":"bed_home"},{"group":"props","id":"bed_home_back"},{"group":"props","id":"bed_home_side"},{"group":"props","id":"bench_wood"},{"group":"props","id":"bench_wood_back"},{"group":"props","id":"bench_wood_side"},{"group":"props","id":"chair"},{"group":"props","id":"chair_back"},{"group":"props","id":"chair_side"},{"group":"props","id":"console_security"},{"group":"props","id":"console_security_back"},{"group":"props","id":"console_security_side"},{"group":"props","id":"counter_bank"},{"group":"props","id":"counter_bank_back"},{"group":"props","id":"counter_bank_side"},{"group":"props","id":"counter_shop"},{"group":"props","id":"counter_shop_back"},{"group":"props","id":"counter_shop_side"},{"group":"props","id":"decal_surface_crack_01"},{"group":"props","id":"decal_surface_damp_01"},{"group":"props","id":"desk"},{"group":"props","id":"desk_back"},{"group":"props","id":"desk_side"},{"group":"props","id":"display_clock"},{"group":"props","id":"display_clock_back"},{"group":"props","id":"display_clock_side"},{"group":"props","id":"shelf"},{"group":"props","id":"shelf_back"},{"group":"props","id":"shelf_side"},{"group":"props","id":"sofa_home"},{"group":"props","id":"sofa_home_back"},{"group":"props","id":"sofa_home_side"},{"group":"props","id":"stove_home"},{"group":"props","id":"stove_home_back"},{"group":"props","id":"stove_home_side"},{"group":"props","id":"tree_courtyard_back"},{"group":"props","id":"tree_courtyard_canopy"},{"group":"props","id":"tree_courtyard_canopy_back"},{"group":"props","id":"tree_courtyard_canopy_side"},{"group":"props","id":"tree_courtyard_side"},{"group":"props","id":"table_dining"},{"group":"props","id":"table_dining_side"},{"group":"props","id":"table_dining_back"},{"group":"props","id":"chair_wood"},{"group":"props","id":"chair_wood_side"},{"group":"props","id":"chair_wood_back"},{"group":"props","id":"wardrobe_home"},{"group":"props","id":"wardrobe_home_side"},{"group":"props","id":"wardrobe_home_back"},{"group":"props","id":"sink_kitchen"},{"group":"props","id":"sink_kitchen_side"},{"group":"props","id":"sink_kitchen_back"},{"group":"props","id":"fridge_home"},{"group":"props","id":"fridge_home_side"},{"group":"props","id":"fridge_home_back"},{"group":"props","id":"cart_medical"},{"group":"props","id":"cart_medical_side"},{"group":"props","id":"cart_medical_back"},{"group":"props","id":"screen_clinic"},{"group":"props","id":"screen_clinic_side"},{"group":"props","id":"screen_clinic_back"},{"group":"props","id":"workbench_clock"},{"group":"props","id":"workbench_clock_side"},{"group":"props","id":"workbench_clock_back"},{"group":"props","id":"clock_grandfather"},{"group":"props","id":"clock_grandfather_side"},{"group":"props","id":"clock_grandfather_back"},{"group":"props","id":"barrier_queue"},{"group":"props","id":"barrier_queue_side"},{"group":"props","id":"barrier_queue_back"},{"group":"props","id":"workbench_industrial"},{"group":"props","id":"workbench_industrial_side"},{"group":"props","id":"workbench_industrial_back"},{"group":"props","id":"pallet_stack"},{"group":"props","id":"pallet_stack_side"},{"group":"props","id":"pallet_stack_back"}]){if(!ART[a.group].includes(a.id))ART[a.group].push(a.id);}
/* END SCENE LIBRARY */
