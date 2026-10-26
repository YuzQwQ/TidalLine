/* ============================================================
   潮汐线 · 数据层
   地图 / 物品 / 敌人。往这里加东西不需要改逻辑代码。
   ============================================================ */

/* ------------------------------------------------------------
   地图图例
     #  墙            .  地板（高度2）      ,  低地（高度1）
     ~  洼地（高度0）  H  高地（高度3）      +  门
     S  避难间门      C  快取容器            L  标准容器
     B  重型容器      P  出生点              E  撤离点
     T  工具箱        M  医疗柜              R  电子设备柜      K  防水补给箱
   ------------------------------------------------------------ */
/* 扩建街区：64×44。南西为出生缓冲区，四条主路串联八种建筑。 */
const MAP_ROWS = [
  '################################################################',
  '#....................HH.........E.........H....................#',
  '#....................HH...................H....................#',
  '#..################..HH.########+########.H....##########......#',
  '#..#......#.......#..HH.#...............#.H...#.....#....#.....#',
  '#..#.T....#.C...T.#..HH.#.C......L....C.#.H..#...B..#...B.#....#',
  '#..#......+.......+..HH.#...............#.H.#.......#......#...#',
  '#..#......#.......#..HH.#....#######....#.H.#.......#.......#..#',
  '#..#..........#####..HH.#...#.......#...#.H.#.......#.......#..#',
  '#..#.........#.......HH.#...#.......#...#.H.+.......+.....R.#..#',
  '#..+.........#.......HH.#...#.......#...#.H.#.###+###.......+..#',
  '#..#.......L.#.......HH.#...+.......+...#.H.#..L....#.......#..#',
  '#..#.C.......#.......HH.#.C.#.......#.L.#.H.#.......#......#...#',
  '#..#.........#.......HH.#...#.......#...#.H..#....C.#.B...#....#',
  '#..######+####.......HH.#####.......#####.H...#.....#....#.....#',
  '#....................HH...................H....#####+####......#',
  '#....................HH...................H....................#',
  '#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#',
  '#....................HH...................H....................#',
  '#..#################.HH.....####+###......H...###+###..........#',
  '#..#......#........#.HH.....#.K....#......H...#.R...#..........#',
  '#..#.M....#......M.#.HH.....#......#......H...#.....#..........#',
  '#..+......+........+.HH.####........#####.H...#......#######...#',
  '#..#......#C.......#.HH.#...............#.H...#.....#......#...#',
  '#E.#####......######.HH.#.T...........R.#.H...+.....#....R.#...#',
  '#.......#....#.......HH.+........L......+.H...#...B.+......#...#',
  '#.......#.M..#.......HH.#...............#.H...#.M...#......+...#',
  '#.......#....#.......HH.####........#####.H...#######......#...#',
  '#.......#..L.#.......HH.....#......#......H..........#.....#...#',
  '#.......#....#.......HH.....#....B.#......H..........#.B..K#...#',
  '#.......###+##.......HH.....####+###......H..........###+###...#',
  '#....................HH...................H....................#',
  '#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHE#',
  '#....................HH.................,,H,,,,,,,,,,,,,,,,,,,,#',
  '#....................HH.................,,H,#################,,#',
  '#..#####S###.........HH.................,,H,#~K~~~~B~~~~~K~~#,,#',
  '#..#.C.....#.........HH.................,,H,+~~~~~~~~~~~~~~~#,,#',
  '#..#.......#.........HH.................,,H,#~~R~~~~~~~T~~~~+,,#',
  '#..#........#######..HH.................,,H,##########~~~~~~#,,#',
  '#..#.P..........L.S..HH.................,,H,,,,,,,,,,,#~~~~~#,,#',
  '#..#.....M........#..HH.................,,H,,,,,,,,,,,#~~~K~#,,#',
  '#..################..HH.................,,H,,,,,,,,,,,###+###,,#',
  '#....................HH.................,,H,,,,,,,,,,,,,,,,,,,,#',
  '################################################################'
];

/* 街区边界用于布局检查与总览图；实际通行以 MAP_ROWS / DECOR 为准。 */
const MAP_DISTRICTS = [
  {"key":"workshop","name":"修理铺","shape":"L形","polygon":[[3,3],[19,3],[19,9],[14,9],[14,15],[3,15]],"loot":"normal","label":[11,2]},
  {"key":"market","name":"旧集市","shape":"U形与开放庭院","polygon":[[24,3],[41,3],[41,15],[36,15],[36,8],[29,8],[29,15],[24,15]],"loot":"normal","label":[32,2]},
  {"key":"archive","name":"档案馆","shape":"切角大厅","polygon":[[48,3],[57,3],[61,7],[61,12],[57,16],[48,16],[44,12],[44,7]],"loot":"high","label":[52,2]},
  {"key":"clinic","name":"诊所","shape":"T形","polygon":[[3,19],[20,19],[20,25],[14,25],[14,31],[8,31],[8,25],[3,25]],"loot":"normal","label":[11,18]},
  {"key":"pump","name":"泵房","shape":"十字形","polygon":[[28,19],[36,19],[36,22],[41,22],[41,28],[36,28],[36,31],[28,31],[28,28],[24,28],[24,22],[28,22]],"loot":"high","label":[32,18]},
  {"key":"lab","name":"潮汐研究所","shape":"错位双翼","polygon":[[46,19],[53,19],[53,22],[60,22],[60,31],[53,31],[53,28],[46,28]],"loot":"high","label":[53,18]},
  {"key":"shelter","name":"避难楼","shape":"L形","polygon":[[3,35],[12,35],[12,38],[19,38],[19,42],[3,42]],"loot":"safe","label":[11,34]},
  {"key":"dock","name":"低洼船坞","shape":"折线仓台与淹水港池","polygon":[[44,34],[61,34],[61,42],[54,42],[54,39],[44,39]],"floor":"~","loot":"high","label":[52,33]}
];

/* 高度表：字符 → 地形高度（水位超过它就淹） */
// 歧义门洞可在此覆盖墙体走向。vertical = 南北墙/左右通行；horizontal = 东西墙/上下通行。
const DOOR_AXES = {};

const TILE_H = { '#': 2, '.': 2, ',': 1, '~': 0, 'H': 3,
                 '+': 2, 'S': 2, 'C': 2, 'L': 2, 'B': 2, 'T': 2, 'M': 2,
                 'R': 2, 'K': 2, 'P': 2, 'E': 3 };

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
const SPAWNS = [
  {"t":"scav","x":7,"y":11,"patrolRadius":3},
  {"t":"scav","x":15,"y":6,"patrolRadius":3},
  {"t":"scav","x":26,"y":9,"patrolRadius":2},
  {"t":"scav","x":38,"y":10,"patrolRadius":2},
  {"t":"scav","x":34,"y":5,"patrolRadius":3},
  {"t":"guard","x":48,"y":7,"patrolRadius":2},
  {"t":"guard","x":56,"y":11,"patrolRadius":2},
  {"t":"echo","x":48,"y":13,"patrolRadius":2},
  {"t":"echo","x":58,"y":6,"patrolRadius":2},
  {"t":"scav","x":6,"y":23,"patrolRadius":3},
  {"t":"scav","x":11,"y":27,"patrolRadius":2},
  {"t":"guard","x":32,"y":23,"patrolRadius":2},
  {"t":"echo","x":26,"y":26,"patrolRadius":2},
  {"t":"echo","x":34,"y":28,"patrolRadius":2},
  {"t":"guard","x":49,"y":24,"patrolRadius":2},
  {"t":"guard","x":56,"y":26,"patrolRadius":2},
  {"t":"echo","x":50,"y":20,"patrolRadius":2},
  {"t":"echo","x":58,"y":23,"patrolRadius":2},
  {"t":"echo","x":47,"y":36,"patrolRadius":2},
  {"t":"echo","x":52,"y":37,"patrolRadius":2},
  {"t":"echo","x":58,"y":36,"patrolRadius":2},
  {"t":"echo","x":56,"y":39,"patrolRadius":2},
  {"t":"scav","x":21,"y":10,"patrolRadius":3},
  {"t":"echo","x":21,"y":27,"patrolRadius":3}
];

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
const STASH_SLOTS = 40;

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
          'desk', 'shelf', 'barrel', 'chair', 'blood'],
  tiles: ['floor', 'low', 'marsh', 'wall'],

  /* 装备图标：48×48，见 assets/gear/README.md。
     缺图会退回文字，不影响游戏。 */
  gear: ['rifle', 'shotgun', 'smg', 'pistol',
         'helmet1', 'helmet2', 'helmet3', 'helmet4', 'helmet5', 'helmet6',
         'body1', 'body2', 'body3', 'body4', 'body5', 'body6',
         'bag']
};

/* 场景摆设：默认实体占一格；仅 ground:true 的地面贴花可穿过。 */
const DECOR = [
  {"id":"desk","x":7,"y":5},
  {"id":"chair","x":7,"y":6},
  {"id":"shelf","x":16,"y":7},
  {"id":"barrel","x":5,"y":9},
  {"id":"shelf","x":5,"y":13},
  {"id":"shelf","x":25,"y":9},
  {"id":"shelf","x":39,"y":9},
  {"id":"desk","x":31,"y":5},
  {"id":"chair","x":31,"y":6},
  {"id":"barrel","x":32,"y":10},
  {"id":"barrel","x":34,"y":12},
  {"id":"chair","x":30,"y":12},
  {"id":"desk","x":55,"y":7},
  {"id":"chair","x":55,"y":8},
  {"id":"shelf","x":46,"y":8},
  {"id":"shelf","x":58,"y":11},
  {"id":"desk","x":49,"y":12},
  {"id":"desk","x":7,"y":21},
  {"id":"chair","x":7,"y":22},
  {"id":"shelf","x":17,"y":23},
  {"id":"chair","x":12,"y":28},
  {"id":"blood","x":9,"y":27,"ground":true},
  {"id":"barrel","x":30,"y":24},
  {"id":"barrel","x":35,"y":24},
  {"id":"shelf","x":38,"y":26},
  {"id":"desk","x":33,"y":21},
  {"id":"chair","x":32,"y":26},
  {"id":"desk","x":49,"y":22},
  {"id":"chair","x":49,"y":23},
  {"id":"shelf","x":57,"y":27},
  {"id":"barrel","x":55,"y":24},
  {"id":"blood","x":55,"y":28,"ground":true},
  {"id":"desk","x":7,"y":37},
  {"id":"chair","x":7,"y":38},
  {"id":"shelf","x":14,"y":40},
  {"id":"barrel","x":49,"y":36},
  {"id":"shelf","x":59,"y":35},
  {"id":"barrel","x":56,"y":40},
  {"id":"blood","x":58,"y":38,"ground":true},
  {"id":"barrel","x":20,"y":16},
  {"id":"barrel","x":43,"y":29},
  {"id":"chair","x":16,"y":33}
];

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
