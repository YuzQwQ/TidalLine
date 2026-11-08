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
    WATER_DMG_DELAY: 6,     // 进水后多少秒开始掉血

    /* 鼠标离玩家小于这个距离时，朝向保持上一帧。
       压在角色身上时 atan2 本来就抖，双轴后坐力把准星推远之后，玩家为了压枪
       会把鼠标往自己身上拉，很容易一不小心就跨过去 —— 之前这一跨就是 180° 转身。 */
    AIM_DEAD: 12
  },

  /* ---------- 体力 ----------
     上限先按满级给（成长系统落地后按角色等级取一段，条会跟着变短：
     弧长 = ARC.SPAN × (当前上限 / MAX)，所以上限低的人条也短一截）。 */
  STAMINA: {
    MAX: 100,               // 满级上限
    REGEN: 17,              // 每秒恢复
    REGEN_DELAY: 0.7,       // 停手多久开始回
    SPRINT_DRAIN: 13,       // 冲刺每秒消耗（还要乘负重倍率）
    DODGE_COST: 22,         // 闪避一次性扣除
    /* 负重对体力消耗的影响：中载及以下不额外消耗，重载变贵，超载最贵。
       档位顺序跟着 BAG.TIERS：轻装 / 中载 / 重载 / 超载 */
    LOAD_MULT: [1, 1, 1.45, 2.4],
    NO_DODGE_TIER: 3,       // 超载（档位 3）直接不能闪避
    EXHAUST_EXIT: 0.25,     // 力竭后回到这个比例才能重新冲刺
    HOLD: 0.5,              // 回满后再亮多久
    FADE: 0.9,              // 淡出耗时（慢慢化掉，不是啪一下没了）
    FADE_IN: 0.1,           // 淡入要快，一消耗就得看得见
    ARC: {
      /* 一条竖着的浅弧，不是套在身上的半圈：
         圆心挪到玩家左边，弧凸向右，看着就是右侧竖着的一条。
         弧长固定，弧度（圆心角）单独调 —— 想更直就把 SWEEP 调小，
         半径会自己变大（R = 弧长 / 弧度），长度不变。 */
      LEN: 40,                // 满上限时的弧长（px）
      SWEEP: 1.22,            // 圆心角 ≈70°：再大就弯回去成半圆了
      GAP: 17,                // 弧离玩家中心多远（贴着角色外圈）
      W: 3,                   // 条带粗细
      MIN: 0.3                // 上限再低也留这么长，免得只剩一个点
    }
  },

  /* ---------- 损伤状态 / 医疗 ----------
     本轮只做流血 / 重伤 / 骨折 / 疼痛（次生）+ 镇痛。感染、异常侵蚀、
     肢体独立血量、水分能量、成瘾耐药都先留字段，不接逻辑。
     致残率只挂在「攻击」上：与伤害、护甲穿透、弹药等级、武器稀有度完全解耦。
     节奏基准：HP100；敌人单发 4~14、攻击间隔 0.75~1.6s；全自动 800~1000rpm
     （60~75ms/发）；霰弹一发 6 弹丸；护甲最低仍留 15% 蹭伤。 */
  DEBUFF: {
    /* 触发门槛与去重。现有 AMMO.MATRIX 最低穿透比例 0.15，护甲不可能
       把生命伤害压到 0；MIN_HEALTH_DMG 只拦真正的零伤害，为将来矩阵里
       出现 0 项时的「完全抵挡不触发」预留语义。 */
    MIN_HEALTH_DMG: 0.5,       // 低于这个实际掉血不判致残
    DEDUP_WINDOW: 0.20,        // 同 attackId 的弹丸去重窗口（秒），覆盖霰弹飞行差
    INJURY_JUDGE_CD: 0.45,     // 每目标致伤判定节流（秒）；中否都锁，压住高射速与 burst

    /* 攻击类型 → 默认致残率与损伤权重（权重和不必为 1，内部归一）。
       单次攻击只掷一次，最多生成一种新损伤。 */
    ATTACK_TYPES: {
      bullet:  { chance: 0.18, weights: { bleeding: 0.55, severe: 0.30, fracture: 0.15 } }, // 普通枪弹：偏流血兼顾其余
      shotgun: { chance: 0.22, weights: { bleeding: 0.68, severe: 0.22, fracture: 0.10 } }, // 霰弹：更易流血
      sharp:   { chance: 0.30, weights: { bleeding: 0.80, severe: 0.15, fracture: 0.05 } }, // 锐器：高流血
      blunt:   { chance: 0.26, weights: { bleeding: 0.08, severe: 0.22, fracture: 0.70 } }, // 钝器：高骨折
      heavy:   { chance: 0.30, weights: { bleeding: 0.10, severe: 0.40, fracture: 0.50 } }  // 冲撞 / 重击：高骨折+重伤
    },

    /* 敌人致残率按攻击频率归一：间隔越长单次概率越高，单位时间期望相近。
       chance = clamp(BASE_CHANCE * cd / CD_REF, MIN, MAX)，在 Debuff.enemyChance 现算。 */
    ENEMY: { BASE_CHANCE: 0.16, CD_REF: 1.0, MIN: 0.10, MAX: 0.32 },

    /* 流血：持续掉血，不影响移动 / 瞄准 / 翻滚，不叠层，最低保留 1 HP 不致死。
       1.5 HP/s 从满血流到 1 约 66 秒：有压迫感，也留得及找止血带。 */
    BLEED: { DPS: 1.5, MIN_HP: 1, HEAL_CAP_COST: 50 }, // 恢复药优先止血的容量消耗

    /* 重伤：固定每层降 15% 基础最大生命，最多 4 层 → 100/85/70/55/40%。
       当前 HP 超过新上限时截断到 max(1, 上限)，不额外扣血、不致死。
       人形敌人不截断（没有治疗 AI，截断等于变相增伤），只留层数与疼痛派生。 */
    SEVERE: { MAX_LAYERS: 4, PER_LAYER: 0.15, TRUNCATE_ENEMIES: false },

    /* 骨折：不叠层。移动 / 翻滚距离 / 冷却的下降统一走疼痛链（可被镇痛压制），
       所以下面三个倍率默认中性、只作预留，避免重复惩罚。
       翻滚额外掉血属于实际损伤，止痛药不能免除。 */
    FRACTURE: {
      ROLL_DMG: 4,            // 每次翻滚固定自伤，无视护甲、不触发致残、下限 1 HP
      MOVE_MULT: 1, DODGE_DIST_MULT: 1, DODGE_CD_MULT: 1,
      STACK_WITH_PAIN: false
    },

    /* 疼痛：由重伤 / 骨折 / 短期疼痛动态派生，不单独掷概率、不随层数叠加。
       这是唯一的操作惩罚来源，镇痛完全屏蔽。 */
    PAIN: {
      MOVE_MULT: 0.78,        // 移速 -22%（在所有速度系数乘完之后）
      DODGE_DIST_MULT: 0.75,  // 翻滚距离 -25%
      DODGE_CD_MULT: 1.35,    // 翻滚冷却 +35%（1.05s → 1.42s）
      SWAY: 1.6,              // 准星持续抖动倍率（crossKick 每帧注入）
      SPREAD_ADD: 0.025       // 真实散布额外弧度，约为 spreadBase 的六成
    },

    /* 镇痛三档时长写在 medical.json 的 effect.duration（90 / 180 / 300 秒）。
       WATER_MULT 是「药效期间水分消耗倍率」的预留参数，本轮没有任何读取点。 */
    ANALGESIC: { WATER_MULT: 1 },

    /* 受击打断的医疗动作白名单：本轮只打断手术，其余沿用既有「受击不打断」。 */
    INTERRUPT_ON_HIT: ['surgery']
  },

  /* ---------- 视野 ---------- */
  FOV: {
    RADIUS: 11,             // 视锥半径（格）—— 按 32px 格调过，让锥边缘刚好在屏幕边
    ANGLE: Math.PI / 2,     // 视锥张角 90°
    NEAR: 3,                // 近身感知半径（不分方向）
    SNEAK_ANGLE: Math.PI * 0.42,
    BRIGHT_NOW: 1.0,        // 当前可见
    BRIGHT_MEM: 0.40,       // 兼容旧配置；场景统一使用 BRIGHT_FOG
    BRIGHT_FOG: 0.40        // 当前未观察区域亮度：可辨识场景，不再绘制探索黑块
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
    LOSE_TIME: 4.0,         // 丢失目标后多久回到巡逻
    /* 全盲敌人（回响体，sight=0）没有视觉，靠"近身存在感"察觉玩家：
       贴到这么多格以内就算发现，潜行时打对折；隔墙只认 1.2 格内的贴身距离。 */
    BLIND_SENSE: 3.0
  },

  /* ---------- 潮汐 ---------- */
  TIDE: {
    ROUND: 720,             // 一局 12 分钟
    PHASE: 240,             // 每阶段 4 分钟
    LEVEL: [0.0, 1.55, 3.0] // 三阶段结束时的水位
  },
  RAID: {
    DURATION: { 'linhai-old-quarter': 1200 },
    WARN_REMAINING: [300, 180, 60]
  },

  /* ---------- 背包 ----------
     携带容量不在这里：它取决于装的是哪个背包（data.js 的 BAGS，
     取值走 common.js 的 bagSlots()）。这里只放安全箱与负重。 */
  BAG: {
    SAFE: 4,
    /* 钥匙链：只放钥匙，不占背包格、不计负重与背包价值，
       但钥匙的耐久消耗照常算进局内战损。只在局外调整。 */
    CHAIN: 6,
    CARRY: 45,
    // 负重档位：[上限 kg, 移速倍率, 噪声倍率, 名称]
    TIERS: [
      [15, 1.00, 1.00, '轻装'],
      [30, 0.90, 1.00, '中载'],
      [45, 0.75, 1.50, '重载'],
      [999, 0.55, 2.00, '超载']
    ]
  },

  /* ---------- 护甲修理 ----------
     每修一次都把耐久补满到「当前上限」，同时吃掉一部分上限：护甲不是无限修的。
     一件甲的耐修程度 rep（0~100，写在护甲数据里）决定同样的损伤要付多少上限：
       上限损耗 = round(缺失耐久 × (1 - rep/100) × WEAR)
       修理费   = 护甲原价 ÷ 原厂耐久 × 缺失耐久 × COST，取整到 10，最低 MIN_FEE
     费用拿「原厂耐久」当分母：当前上限会越修越低，用它折算会让同一件甲越修越便宜。
     上限掉到 MIN_MAX 就不能再修了，那时只剩卖掉或换新。 */
  REPAIR: {
    WEAR: 0.55,      // 上限损耗系数：rep 越高，同样的缺失耐久只掉更少的上限
    COST: 0.45,      // 每点缺失耐久的修理费占「原价/原厂耐久」的比例
    MIN_FEE: 100,    // 最低收费，免得修一级甲收个位数
    MIN_MAX: 4       // 上限跌到这里就判为结构报废，不再接受修理
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
     身体按移动线段首次接触判命中；部位按圆心到弹道直线的垂直距离判断，不看贴图朝向。
     HEAD_RADIUS 是默认值，角色可以自己覆盖（P.headR / e.headR）。
     -------------------------------------------------- */
  COMBAT: {
    HEAD_RADIUS: 2,     // 头部判定半径（px），约身体半径的 28%
    HEAD_BULLET_ALLOWANCE: 1, // 子弹对头部的扩张上限（px）；默认有效爆头半径 3px
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
    kickDecay: 17,          // 抖动回弹速度（越大回正越快）

    /* ---------- 双轴后坐力 ----------
       上面那个 recoil 是 0~1 的"热度"，只负责散布；这里另开一套"准星位移"，
       单位是像素，在鼠标瞄准点 M 的局部坐标系里作用：
           D = 玩家→鼠标 的单位向量，N = D 的垂线 (-D.y, D.x)
           R = M + D * v + N * h
       v 沿瞄准线把准星往外推，P→R 的方向不变 —— 所以它只是"看着飘"，
       在 2D 射线模型里不改弹道；h 把准星推向侧面，方向真的变了，才会打偏。
       两轴各自累加、各自封顶、各自恢复，互不干扰。
       R 不设最小半径：鼠标可以穿过玩家，准星就跟着到另一侧（贴身近战要甩枪）。 */
    axis: {
      h: {
        kick: 2.4,          // 每发水平冲击（像素）
        rand: 0.9,          // 每发额外的 ±随机扰动（比 kick 小，保留可预测性）
        bias: 0,            // −1 恒偏 N 负向 / 0 纯随机 / 1 恒偏 N 正向
        max: 16,            // 累计上限（正负都夹在这个绝对值内）
        decayDelay: 0.10,   // 停火多久后开始回正（秒）
        decay: 7.5,         // 回正速度（1/秒，指数衰减，先快后慢）
        moveMult: 1.25,     // 移动中开火的冲击倍率
        sprintMult: 1.7,
        sneakMult: 0.75
      },
      v: {
        kick: 3.4,
        max: 30,
        /* 比水平长一截：步枪 420rpm 是 143ms 一发，延迟必须大于射速间隔，
           否则每发之间都在回正，连射永远攒不起来（实测只能堆到 12px）。 */
        decayDelay: 0.18,
        decay: 5.0,
        moveMult: 1.30,
        sprintMult: 1.80,
        sneakMult: 0.80
      }
    }
  },
  BULLET: {
    LIFE: 1.6,
    RADIUS: 2.4
  },

  /* ---------- 伤害飘字 ----------
     命中的数字从目标头顶冒起来、上浮、淡出。整套动画（升起 + 淡出）都是纯时间函数，
     没有物理：连射时十几条数字同时在跑，一条一个积分器没必要，动画也不会更自然。

     字号是素材包的位图字体（16px 字形，见 tools/build-floatfont.js）：
     按伤害类型分色 —— 普通命中骨白、爆头橙金、近战真实伤害蓝色。
     光靠变大不够，一局打下来颜色在余光里就能分清；
     玩家挨打也不再单配一套，走同一张类型表。

     LIFE/RISE  停留多久、上浮多高（逻辑像素，720×480 的画面）
     POP        弹出时长：从 1.35 倍缩回 1 倍，只在开场这一下
     CRIT_*     爆头的那一条：飘得更高、留得更久
     SPREAD     出生点左右的随机偏移，同一个人连吃几发不会叠成一个数字
     DRIFT      上浮时往两边飘的幅度，免得整列数字像排队
     STAIR      连续命中时按命中次数往上错开几像素，全自动扫射时不至于糊成一坨
     MERGE      连击合并窗口：同一个目标隔不到这么久再中，就累加到同一条上。
                取 0.15s —— 800RPM（75ms）和 600RPM（100ms）的全自动都会合并，
                手枪 360RPM（167ms）和半自动霰弹（200ms+）则发发单独显示。
                霰弹一发八颗弹丸是同一帧结算的，8 个数字也并成一条总伤害。
     MAX        同屏上限，超出丢最早的（霰弹一发 8 颗弹丸，很容易撞上限）

     字号保持 1 倍：素材包的字形是 16px 点阵，放大 1.25 倍就会出现宽窄不一的
     像素块，和场上其它像素图不在一个网格上。换类型就是换一套字体图集
     （普通骨白 / 爆头橙金 / 近战蓝），靠颜色 + 爆头更高的上浮与更久的停留
     区分，不靠放大。 */
  DMG_TEXT: {
    LIFE: 0.85,
    CRIT_LIFE: 1.1,
    RISE: 15,
    CRIT_RISE: 22,
    SCALE: 1,
    CRIT_SCALE: 1,
    POP: 0.12,
    SPREAD: 3,
    CRIT_SPREAD: 2.5,
    DRIFT: 5,
    STAIR: 5,
    MERGE: 0.15,
    MAX: 40
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
    catPref: 9,

    /* 彩蛋：容器抽到红色（r6）物品之后再掷一次，中签就从彩蛋池等概率挑一件。
       red 的总概率一格不动 —— 中签率是从「红色」内部再分出去的，
       所以调这里只改「摸到的是哪一件红」，不改出货率。
       概率**按容器品质给**（eggByQuality）：好东西才配藏彩蛋。
       废弃 / 普通箱子 0，充实 1%、优质 4%、贵重 12%、秘藏 25%。
       秘藏箱红里四件就有一件是彩蛋，摸钥匙房的人才是主要受众。
       eggChance 是没有品质信息的抽取（尸体、指定池）的兜底值，
       同时是总开关：置 0 = 关闭彩蛋掉落，不用改调用点。 */
    eggChance: 0.02,
    eggByQuality: { junk: 0, plain: 0, ample: 0.01, fine: 0.04, rich: 0.12, secret: 0.25 },
    eggRarity: 6,

    /* 红色内部的价值档位权重（tier 1 普通 / 2 良好 / 3 稀有）。
       权重只作用于「同一稀有度、同一类别」内部：稀有度曲线由 pct 锁死，
       类别占比由 cellW 锁死，所以调这里不会影响出货率，只影响「摸到哪一种红」。
       彩蛋是抽完之后另掷一次的支线（见 eggByQuality），不占这里的份额。
       单件还可以用 item.lootW 做微调（默认 1）。 */
    redTiers: { 1: 45, 2: 35, 3: 18 },

    /* 钥匙内部档位权重：只决定「摸到的是哪一档钥匙」，
       不影响「会不会摸到钥匙」—— 后者由容器自己的 keyPool.chance 决定。
       权重是**按单把**计的，同档有多把会叠加：当前紫档 1 把、金档 1 把、
       红档 1 把（银行）、金档 3 把（老公寓 / 钟表店 / 仓库）、紫档 1 把（诊所），
       有效权重合计 96：紫 67.7%、金 28.1%（三把各 9.4%）、红 4.2%。
       同档内等权；单把可用 key.lootW 微调（默认 1）。 */
    keyTiers: { 4: 65, 5: 27, 6: 4 }
  },

  /* ---------- 尸体容器 ----------
     人类（拾荒者）身上背着一个随机等级的背包：这只包**本身也是战利品**，
     摸出来就能背；同时它的等级决定这具尸体能搜出几件普通物品。
     子弹和身上穿的枪/头/甲不占这几格 —— 那是他带的东西，不是从包里翻出来的。
     所以 Lv1 = 子弹 + 1 件、Lv2 = 子弹 + 2 件、Lv3 = 子弹 + 3 件，背包另算。 */
  CORPSE_BAG: {
    factions: ['scav'],                   // 会背包的敌人；回响体是异常体、守卫是机械
    levelWeights: [52, 32, 16],           // Lv1 / Lv2 / Lv3 的出现权重
    itemsByLevel: { 1: 1, 2: 2, 3: 3 }    // 每级能搜出几件普通物品（上限）
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
  key:    { name: '钥匙', color: '#b39a63' },
  gear:   { name: '装备', color: '#5f7f9b' }
};
const COLLECTION_CATS = ['life','elec','ind','med','collect','mil','intel','occult','odd'];
const SUPPLY_CATS = ['ammo','medical','key'];
const ITEM_GROUPS = {
  collectible:{name:'收集品',cats:COLLECTION_CATS},
  supply:{name:'物资',cats:SUPPLY_CATS}
};
const ITEM_GROUP_BY_CAT = Object.fromEntries(Object.entries(ITEM_GROUPS).flatMap(([group,meta])=>meta.cats.map(cat=>[cat,group])));
function itemGroup(item) { return item ? ITEM_GROUP_BY_CAT[item.cat] || null : null; }
function formatMoney(value) { return '¥' + Math.round(Number(value) || 0).toLocaleString('en-US'); }
function itemCategoryLabel(item) {
  if(item?.equip?.kind==='attachment')return '装备 / 枪械配件';
  const group=ITEM_GROUPS[itemGroup(item)],cat=CATS[item.cat];
  return (group?group.name+' / ':'')+(cat?cat.name:'装备');
}

/* ------------------------------------------------------------
   堆叠规则：全项目只有子弹能叠在一起。
   药物、收集品、装备一律一件占一格——仓库、背包、安全箱、
   地面物品堆都按这个来，别处不要自己看 item.stack。
   ------------------------------------------------------------ */
function stackLimit(item) {
  if (!item) return 1;
  if (item.cat === 'ammo') return Math.max(1, item.stack || 1);
  return 1;
}
function isStackable(item) { return stackLimit(item) > 1; }

/* ------------------------------------------------------------
   仓库筛选：全部 / 收集品 / 子弹 / 药物 / 枪械 / 护甲
   ------------------------------------------------------------ */
const STASH_FILTERS = [
  { k: 'all',   name: '全部' },
  { k: 'col',   name: '收集品' },
  { k: 'ammo',  name: '子弹' },
  { k: 'med',   name: '药物' },
  { k: 'key',   name: '钥匙' },
  { k: 'gun',   name: '枪械' },
  { k: 'armor', name: '护甲' }
];
function stashFilterMatch(item, f) {
  if (!item) return false;
  switch (f) {
    case 'col':   return itemGroup(item) === 'collectible';
    case 'ammo':  return item.cat === 'ammo';
    case 'med':   return item.cat === 'medical';
    case 'key':   return item.cat === 'key';
    case 'gun':   return !!(item.equip && item.equip.kind === 'gun');
    case 'armor': return !!(item.equip && item.equip.kind === 'armor');
    default:      return true;
  }
}

/* ------------------------------------------------------------
   弹道结算
   口径 / 弹药等级 / 穿透矩阵 / 耐久损耗，全项目只此一份。
   玩家、敌人、霰弹的每一颗弹丸都调这里，不要另写一套。
   ------------------------------------------------------------ */
const CALIBERS = {
  "556": {
    "id": "556",
    "name": "5.56×45mm",
    "short": "5.56",
    "label": "5.56mm",
    "damage": [
      15,
      22
    ],
    "stack": 60,
    "weight": 0.012,
    "prices": [
      60,
      140,
      320,
      800,
      2000
    ]
  },
  "762x39": {
    "id": "762x39",
    "name": "7.62×39mm",
    "short": "7.62",
    "label": "7.62mm",
    "damage": [
      20,
      27
    ],
    "stack": 60,
    "weight": 0.016,
    "prices": [
      80,
      180,
      420,
      1000,
      2500
    ]
  },
  "9mm": {
    "id": "9mm",
    "name": "9×19mm",
    "short": "9mm",
    "label": "9mm",
    "damage": [
      11,
      15
    ],
    "stack": 90,
    "weight": 0.012,
    "prices": [
      35,
      80,
      180,
      450,
      1100
    ]
  },
  "45acp": {
    "id": "45acp",
    "name": ".45 ACP",
    "short": ".45",
    "label": ".45 ACP",
    "damage": [
      15,
      20
    ],
    "stack": 90,
    "weight": 0.015,
    "prices": [
      50,
      110,
      250,
      600,
      1500
    ]
  },
  "12g": {
    "id": "12g",
    "name": "12 Gauge",
    "short": "12G",
    "label": "12号",
    "damage": [
      7,
      10
    ],
    "stack": 20,
    "weight": 0.012,
    "prices": [
      80,
      180,
      400,
      900,
      2200
    ]
  },
  "545x39": {
    "id": "545x39",
    "name": "5.45×39mm",
    "short": "5.45",
    "label": "5.45mm",
    "damage": [
      17,
      24
    ],
    "stack": 60,
    "weight": 0.013,
    "prices": [
      70,
      160,
      370,
      900,
      2250
    ]
  }
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
