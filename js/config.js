/* ============================================================
   潮汐线 · 配置文件
   所有数值都集中在这里。改完刷新页面即生效，不用碰逻辑代码。
   标注【基准值】的都是拍出来的，只保证能让第一版跑起来。
   ============================================================ */

/* ------------------------------------------------------------
   容器品质（六档）
   pct 是"每次抽出一件物品时，六个稀有度各自的目标概率"，单位 %，合计 100。
   Loot.roll 直接把它当作该档的稀有度权重，因此最终概率就等于这张表——
   不要再乘一层基准权重，否则曲线会整体偏向白绿。
   count 抽出几件；time/noise 开箱耗时与噪声；still 是否需要站定不动。
   ------------------------------------------------------------ */
const CONTAINER_QUALITY = {
  junk:   { lv:1, name:'废弃', color:'#c6ceca', count:[1,2], time:0.0, noise:1.2, still:false,
            pct:[65,   25,   8,    1.7,  0.28, 0.02] },
  plain:  { lv:2, name:'普通', color:'#3f8b78', count:[1,2], time:0.6, noise:2.5, still:false,
            pct:[43,   32,   18,   6,    0.9,  0.1 ] },
  ample:  { lv:3, name:'充实', color:'#3f6d9b', count:[2,3], time:1.2, noise:4,   still:false,
            pct:[23,   29,   31,   14,   2.8,  0.2 ] },
  fine:   { lv:4, name:'优质', color:'#9165b3', count:[2,3], time:1.8, noise:5,   still:false,
            pct:[10,   18,   32,   30,   9.5,  0.5 ] },
  rich:   { lv:5, name:'贵重', color:'#a8862a', count:[2,3], time:2.6, noise:7,   still:true,
            pct:[4,    9,    22,   36,   27,   2   ] },
  secret: { lv:6, name:'秘藏', color:'#8d3a3a', count:[3,3], time:3.6, noise:9,   still:true,
            pct:[1,    3,    10,   28,   50,   8   ] }
};
const QUALITY_ORDER = ['junk','plain','ample','fine','rich','secret'];

const CFG = {

  /* ---------- 显示 ---------- */
  VIEW_W: 720,
  VIEW_H: 480,
  TILE: 32,                 // 每格像素（地图 72×56 格 = 2304×1792，比视口大）
  MAX_SCALE: 4,             // 最大放大倍数
  /* 像素字体（js/pixfont.js）：把系统字体栅格化成 1 位点阵再画 */
  PIXEL_FONT: {
    SS: 3,                  // 超采样倍数，调大更接近手工点阵，但首帧更慢
    TH: 0.5                 // 覆盖率阈值：调低笔画更粗、更容易粘连
  },
  RENDER_CAP_W: 2880,       // 画布内部分辨率上限（宽）= 4× 逻辑宽度，即 MAX_SCALE 对应的物理宽度
  INTEGER_SCALE: false,     // true = 只用整数倍（像素更齐，但四周黑边多）
  /* 像素吸附：把放大倍率拉回整数（2× / 3×…）。
     非整数倍（比如 1920 屏的 2.25）会让每个逻辑像素落在 2.25 个物理像素上，
     图块大小忽大忽小、HUD 文字也被拉到半像素上，看起来就是"糊"。
     只在整数倍不至于让画面太小（面积 ≥ 窗口 55%）时才吸附。 */
  PIXEL_SNAP: true,
  LOCK_SCALE: false,        // false = 窗口一变就重新按新尺寸等比缩放（比例始终 3:2）

  /* ---------- 玩家 ---------- */
  P: {
    HP: 100,
    SPEED: 120,             // px/s 正常行走
    SPRINT: 1.72,           // 冲刺倍率
    SNEAK: 0.44,            // 潜行倍率
    RADIUS: 7,
    ACCEL: 14,              // 加速度（越大越跟手）
    DODGE_SPEED: 470,       // 闪避初速
    DODGE_TIME: 0.17,       // 闪避持续
    DODGE_CD: 1.05,         // 冷却
    RELOAD_TIME: 1.5,
    WATER_SLOW: 0.62,       // 涉水减速
    WATER_DMG: 2.0,         // 溺水每秒伤害（站水里）
    WATER_DMG_DELAY: 6      // 进水后多少秒开始掉血
  },

  /* ---------- 视野 ---------- */
  FOV: {
    RADIUS: 11,             // 视锥半径（格）—— 按 32px 格调过，让锥边缘刚好在屏幕边
    ANGLE: Math.PI / 2,     // 视锥张角 90°
    NEAR: 3,                // 近身感知半径（不分方向）
    SNEAK_ANGLE: Math.PI * 0.42,
    BRIGHT_NOW: 1.0,        // 当前可见
    BRIGHT_MEM: 0.44,       // 记忆层
    BRIGHT_FOG: 0.10        // 未探索的雾（只留极淡的色块，看不出结构）
  },

  /* ---------- 噪声半径（格） ---------- */
  NOISE: {
    sneak: 2,
    walk: 5,
    sprint: 9,
    shoot: 18,
    search: 4,
    reload: 3,
    dodge: 6,
    throw: 3,               // 投掷动作本身
    stone: 6,               // 石子落地
    bottle: 9,
    door: 4,
    waterMult: 2            // 涉水时噪声倍率
  },
  NOISE_TICK: 0.1,          // 敌人多久扫一次噪声队列（秒）

  /* ---------- 敌人通用 ---------- */
  ENEMY: {
    SUSPECT_TIME: 3.0,      // 怀疑状态搜索时长
    CHASE_TIME: 8.0,        // 追击耐心
    REPATH: 0.5,            // 寻路重算间隔（会随机抖动）
    LOSE_TIME: 4.0          // 丢失目标后多久回到巡逻
  },

  /* ---------- 潮汐 ---------- */
  TIDE: {
    ROUND: 720,             // 一局 12 分钟
    PHASE: 240,             // 每阶段 4 分钟
    LEVEL: [0.0, 1.55, 3.0] // 三阶段结束时的水位
  },

  /* ---------- 背包 ---------- */
  BAG: {
    SLOTS: 24,
    SAFE: 4,
    CARRY: 45,
    // 负重档位：[上限 kg, 移速倍率, 噪声倍率, 名称]
    TIERS: [
      [15, 1.00, 1.00, '轻装'],
      [30, 0.90, 1.00, '中载'],
      [45, 0.75, 1.50, '重载'],
      [999, 0.55, 2.00, '超载']
    ]
  },

  /* ---------- 战斗 ---------- */
  WEAPON: {
    name: '制式步枪',
    dmgMin: 15, dmgMax: 22,
    rpm: 420,
    mag: 30,
    speed: 620,             // 子弹速度 px/s
    range: 640,
    falloffStart: 260,      // 超过这个距离开始衰减
    falloffEnd: 640
  },

  /* ---------- 命中部位 ----------
     同心圆：外圆是身体（= 角色碰撞半径），内圆是头部。
     子弹走的是线段，取线段到圆心的最短距离来判部位，不看贴图朝向。
     HEAD_RADIUS 是默认值，角色可以自己覆盖（P.headR / e.headR）。
     -------------------------------------------------- */
  COMBAT: {
    HEAD_RADIUS: 2,     // 头部判定半径（px），约身体半径的 28%
    HEAD_MULT: 1.5      // 爆头伤害倍率
  },

  /* ---------- 弹药口径 ----------
     口径是独立枚举，任何地方判断弹种都走 caliber 字段，不看名字。
     同一口径的枪共用这一口径下的所有等级弹药，跨口径绝对不能混用。 */
  AMMO: {
    /* 弹药等级：伤害系数与穿透等级分开存。
       本版两者数值相同，但结构上分开，后面要拆开时不用改数据。 */
    TIERS: [
      { lv: 1, name: '普通',     dmgMul: 0.90, pen: 1 },
      { lv: 2, name: '改良',     dmgMul: 1.00, pen: 2 },
      { lv: 3, name: '钢芯',     dmgMul: 1.05, pen: 3 },
      { lv: 4, name: '穿甲',     dmgMul: 1.10, pen: 4 },
      { lv: 5, name: '特种穿甲', dmgMul: 1.15, pen: 5 }
    ],

    /* 护甲穿透矩阵：行 = 弹药穿透等级（1~5），列 = 护甲等级（1~6）。
       数值是"打完护甲之后还能落到人身上的伤害比例"。
       高级护甲对低级弹药的保护是有意做得很强的，不要为了平衡把它抹平。 */
    MATRIX: {
      1: [0.80, 0.60, 0.40, 0.25, 0.15, 0.15],
      2: [1.00, 0.80, 0.60, 0.40, 0.25, 0.15],
      3: [1.00, 1.00, 0.80, 0.60, 0.40, 0.25],
      4: [1.00, 1.00, 1.00, 0.80, 0.60, 0.40],
      5: [1.00, 1.00, 1.00, 1.00, 0.80, 0.60]
    },

    /* 被护甲挡下的伤害换算成耐久损耗的系数。
       0.5 是首轮测试值，调平衡就动这里，别去改矩阵。 */
    DURABILITY_FACTOR: 0.5,

    /* 没有弹药来源的伤害（近战、敌人的制式射击）按这个穿透等级结算。 */
    UNARMED_PEN: 3
  },

  /* ---------- 后坐力 ----------
     recoil 是 0~1 的一个值，驱动准星张开与弹道散布。
     开火累加，停火衰减；移动时累加更快、恢复更慢。
     -------------------------------------------------- */
  RECOIL: {
    perShot: 0.075,         // 每发累加
    moveMult: 1.9,          // 移动中开火，累加倍率
    sprintMult: 2.6,        // 冲刺中开火
    sneakMult: 0.8,         // 潜行中开火更稳
    max: 1.0,               // 上限

    decayDelay: 0.15,       // 停火后多久开始恢复（秒）
    decay: 0.55,            // 静止时每秒恢复多少（0~1 的值）
    decayMoveMult: 0.50,    // 移动中恢复打折
    decaySneakMult: 1.30,   // 潜行时恢复更快

    spreadBase: 0.040,      // recoil=0 时的散布（弧度）
    spreadMax: 0.260,       // recoil=1 时的散布

    /* 准星：只有四条十字线，没有圆环。
       线的内端从中心点开始，散布越大四条线越往外推（整体外移，不是原地变长）。 */
    crossInner: 2.0,        // 静止时线头离中心点的距离
    crossScale: 130,        // 散布 → 内端外移多少像素
    crossArm: 7.0,          // 基础线长
    crossArmGrow: 3.2,      // 开火时线额外拉长（后坐力越高越长）
    kickMin: 3.5,           // 开火瞬间准星抖动的基准幅度
    kickScale: 13,          // 叠加后坐力后的额外幅度
    kickDecay: 17           // 抖动回弹速度（越大回正越快）
  },
  BULLET: {
    LIFE: 1.6,
    RADIUS: 2.4
  },

  /* ---------- 搜刮 ----------
     开箱时间与噪声由容器品质决定（见文件顶部的 CONTAINER_QUALITY）。
     这里保留一份派生表，方便旧代码与调试脚本按品质名取值。 */
  SEARCH: Object.fromEntries(Object.entries(CONTAINER_QUALITY).map(([k, q]) => [k, { time: q.time, noise: q.noise }])),

  /* ---------- 掉落 ----------
     catPref：容器"类别偏好"的权重倍数。容器只声明偏爱哪几类，
     倍率决定同品质容器之间的内容差异有多明显；
     某档没有该类物品时，这一档的份额自动让给其它类别，不会抽空。 */
  LOOT: {
    catPref: 9
  },

  /* ---------- 逐件搜索 ----------
     容器打开后，里面每件东西还要单独搜一遍才知道是什么。
     时间按稀有度递增，最稀有的 3 秒；打开面板期间玩家不能动，
     所以"搜到哪一件就走"本身就是个决定。
     -------------------------------------------------- */
  ITEM_SEARCH: {
    timeByRarity: [0.45, 0.85, 1.4, 1.8, 2.1, 3.0],  // 对应 r1 ~ r6
    noise: 2.5,        // 搜一件发出的噪声（格）
    noiseEvery: 0.55   // 每隔多久再发一次，持续暴露位置
  },

  /* ---------- 撤离 ---------- */
  EXTRACT_TIME: 6.0,        // 撤离读条
  EXTRACT_RADIUS: 34,

  /* ---------- 节奏工具 ---------- */
  QUIET_TIME: 30,           // 击杀后安静期
  QUIET_RADIUS: 12,         // 安静区半径（格）
  QUIET_SENSE: 0.40,        // 安静区内的敌人感知降到这个倍率

  /* ---------- 其它 ---------- */
  INTERACT_RANGE: 30,
  LOOT_SHOW_DIST: 1.6,      // 可见容器才画轮廓
  DEBUG: false              // 按 F1 切换：显示 AI 状态与视野网格
};

/* 稀有度：名字 / 颜色 / 边框类名 */
const RARITY = [
  { k: 1, name: '寻常', color: '#c6ceca', cls: 'r1' },
  { k: 2, name: '良品', color: '#3f8b78', cls: 'r2' },
  { k: 3, name: '上乘', color: '#3f6d9b', cls: 'r3' },
  { k: 4, name: '稀见', color: '#9165b3', cls: 'r4' },
  { k: 5, name: '珍罕', color: '#a8862a', cls: 'r5' },
  { k: 6, name: '孤品', color: '#8d3a3a', cls: 'r6' }
];

/* 九类收集品；gear 是装备的功能类别，不计入收集品九类。 */
const CATS = {
  life:   { name: '生活用品', color: '#6b7f78', theme:'灾前社会的日常生活', desc:'三层结构：工业时代的通用器物打底，不同社会传统的交汇做层次，环礁湾自己的机构、商业与工艺史收口。不用于代表某一种现实文化。' },
  elec:   { name: '电子产品', color: '#4a7fa0', theme:'近现代技术文明', desc:'以接近现实1990年代的技术为基础，包括随身听、收音机、录像机和通信器件；超自然研究设备也可能采用普通电子技术。' },
  ind:    { name: '工业器材', color: '#8a7d5a', theme:'城市工业基础与工程活动', desc:'金属材料、工具、机械组件和工程仪器，体现城市工业史及人为干涉灾害的潜在技术背景。' },
  med:    { name: '医疗物资', color: '#7a9b85', theme:'医疗救治与生命研究', desc:'医疗耗材、病理切片和特殊检验用品，不预设它们一定来自异常研究。' },
  collect:{ name: '文物藏品', color: '#b39a63', theme:'历史、文化与财富', desc:'古董、文物、艺术品、奢侈品和自然标本；价值可来自稀缺性、工艺、学术意义或历史背景。' },
  mil:    { name: '军事物资', color: '#7d9163', theme:'封锁、疏散与军事行动', desc:'军用通信器材、制式工具、识别设备、武器零件与军用补给，可关联首次潮汐的撤离行动及后续封锁。' },
  intel:  { name: '情报资料', color: '#a89776', theme:'信息、调查与历史记录', desc:'官方档案、实验报告、地图、信函、秘密文件及其他记录载体；部分物品还可能具有探索信息价值。' },
  occult: { name: '神秘学物品', color: '#907ba8', theme:'隐藏于历史中的超自然传统', desc:'古代仪式用品、神秘学文物、祭器、符号器具和现代神秘学实践制作的物品；能否生效不决定分类。' },
  odd:    { name: '异常遗物', color: '#a05050', theme:'无法通过常规规律解释的事物', desc:'受潮汐或其他超自然现象影响的器物、特殊物质和不明产物；可以稳定存在、周期性变化或尚未被充分理解。' },
  ammo:   { name:'弹药类', color:'#a58e61', theme:'武器弹药', desc:'用于武器装填的物资。当前为通用弹药，后续可按枪械与口径扩充分型。' },
  medical:{ name:'医疗物品', color:'#7a9b85', theme:'治疗与应急救护', desc:'恢复治疗、止痛、损伤处理、针剂和异常处理；仅恢复类已开放使用，与收集品中的医疗物资分开。' },
  gear:   { name: '装备', color: '#5f7f9b' }
};
const COLLECTION_CATS = ['life','elec','ind','med','collect','mil','intel','occult','odd'];
const SUPPLY_CATS = ['ammo','medical'];
const ITEM_GROUPS = {
  collectible:{name:'收集品',cats:COLLECTION_CATS},
  supply:{name:'物资',cats:SUPPLY_CATS}
};
const ITEM_GROUP_BY_CAT = Object.fromEntries(Object.entries(ITEM_GROUPS).flatMap(([group,meta])=>meta.cats.map(cat=>[cat,group])));
function itemGroup(item) { return item ? ITEM_GROUP_BY_CAT[item.cat] || null : null; }
function formatMoney(value) { return '¥' + Math.round(Number(value) || 0).toLocaleString('en-US'); }
function itemCategoryLabel(item) {
  const group=ITEM_GROUPS[itemGroup(item)],cat=CATS[item.cat];
  return (group?group.name+' / ':'')+(cat?cat.name:'装备');
}

/* ------------------------------------------------------------
   弹道结算
   口径 / 弹药等级 / 穿透矩阵 / 耐久损耗，全项目只此一份。
   玩家、敌人、霰弹的每一颗弹丸都调这里，不要另写一套。
   ------------------------------------------------------------ */
const CALIBERS = {
  '556': { id: '556', name: '5.56×45mm', short: '5.56', label: '5.56mm' },
  '9mm': { id: '9mm', name: '9×19mm',   short: '9mm',  label: '9mm'  },
  '12g': { id: '12g', name: '12 Gauge', short: '12G',  label: '12 号' }
};

/* config 不依赖 core.js，这里自带一个夹取，避免加载顺序问题 */
function clampNum(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

const BALLISTICS = {
  /* 弹药等级配置（1~5） */
  tier(lv) {
    const t = CFG.AMMO.TIERS.find(x => x.lv === lv);
    return t || CFG.AMMO.TIERS[0];
  },

  /* 口径 → 显示名 */
  caliber(id) { return CALIBERS[id] || null; },
  caliberName(id) { return (CALIBERS[id] || {}).name || String(id || '—'); },

  /* 弹药 id 只有这一种拼法：ammo_{口径}_{等级} */
  ammoId(caliber, lv) { return 'ammo_' + caliber + '_' + lv; },

  /* 穿透比例：没穿护甲 / 护甲已失效 = 1（全额） */
  ratio(pen, armorLevel) {
    if (!armorLevel || armorLevel < 1) return 1;
    const row = CFG.AMMO.MATRIX[clampNum(pen | 0, 1, 5)];
    if (!row) return 1;
    return row[clampNum(armorLevel, 1, 6) - 1];
  },

  /* 核心公式：给定"进护甲之前的伤害"和护甲状态，算出落在血量上的伤害与耐久损耗。
       - 完全穿透：护甲这次不掉耐久
       - 耐久不够挡住本次理论耗时，按剩余耐久折算，护甲被击毁但仍提供部分防护
     返回的 health 是浮点，展示时再取整。 */
  resolve(base, pen, armorLevel, durability) {
    base = Math.max(0, Number(base) || 0);
    const ratio = this.ratio(pen, armorLevel);
    const blocked = base * (1 - ratio);
    const theo = blocked * CFG.AMMO.DURABILITY_FACTOR;
    const dur = Math.max(0, Number(durability) || 0);

    if (theo <= 1e-9 || dur <= 0) {
      return { health: base, durabilityLoss: 0, ratio, blocked: 0 };
    }
    const eff = clampNum(dur / theo, 0, 1);
    const actualBlocked = blocked * eff;
    return {
      health: base - actualBlocked,
      durabilityLoss: Math.min(dur, theo),
      ratio,
      blocked: actualBlocked
    };
  },

  /* 带护甲实体的版本：直接吃 GEAR.make 出来的实例（可以没有）
     base 必须是"已经乘过部位倍率与弹药系数"的伤害 */
  hit(base, pen, gear) {
    if (!gear || !(gear.dur > 0)) {
      return { health: base, durabilityLoss: 0, ratio: 1, blocked: 0 };
    }
    return this.resolve(base, pen, gear.lv, gear.dur);
  }
};
