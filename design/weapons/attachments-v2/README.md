# 配件系统 V2 · 实装记录

正式物品、交易、掉落、改枪及旧档迁移已接入；新姿态、键位、镜头与 ADS 专属精度已同步正式战局；靶场保留独立调参。
数据源沿用 design/weapons/attachments-v1/attachments.json（version 2），运行时 attachment-data.js 为构建产物。

## 逐枪接口表

| 接口族 | 兼容武器 | 原厂容量 | 扩容 | 弹鼓 |
|---|---|---|---:|---:|
| STANAG | M4A1 / M16A1 / FN FNC | 30 / 20 / 30 | 40 | 60 |
| AK 5.45 | AKS-74U / AN-94 / AK-12 | 30 / 30 / 30 | 45 | 60 |
| AK 7.62 | AKM / OTs-14-1A Groza-1「雷暴」 / MK47 MOD.2「Mutant」 | 30 / 30 / 30 | 40 | 75 |
| FAMAS | FAMAS F1 | 25 | — | — |
| Galil | Galil ARM | 35 | 50 | 75 |
| G36 | G36C | 30 | 40 | 60 |
| SIG 550 | SIG SG 550 | 30 | 40 | 60 |
| AUG | AUG A1 | 30 | 42 | 60 |
| Vityaz | PP-19-01 Vityaz | 30 | 40 | 50 |
| MP5 | MP5A3 | 30 | 40 | 50 |
| UMP | UMP45 | 25 | 35 | 50 |
| Glock | Glock 17 | 17 | — | — |
| Beretta 92 | Beretta 92FS | 15 | — | — |
| M1911 | M1911A1 | 7 | — | — |
| Saiga-12 | Saiga-12 | 8 | 12 | 20 |
| SR-25 | SIG MCX SPEAR | 20 | 25 | — |
| RM277 | GD RM277 | 20 | 25 | — |

MP-155 与 Remington 870 为管式供弹，不开放弹匣槽。接口与容量是本游戏适配设定。
竞赛型只降低装填时间18%，聚合物只降低瞄准时间10%，容量均为该枪原厂容量。
扩容型固定容量，举枪+8%、装填+5%；弹鼓固定容量，举枪+20%、装填+25%。
军火商出售 r1–r3，r4–r5 沿用现有配件掉落渠道，未提高容器抽取占比。

## 迁移规则

迁移在任何旧件过滤、配件归一化、弹量裁剪之前执行，原文备份到 tideline_save_v1_attachments_v1_backup。
attachmentsVersion=2 与新存档原子写入；备份或存储失败中止加载，原存档不变。
安装中的 quick / ext / quick_ext 分别转接口竞赛型 / 扩容 / 弹鼓；不兼容或该族未开放则卸下并按旧基础售价补信用点。
散装旧件仅在口径可唯一确定接口时换新，否则补信用点。不根据当前背包中的枪猜测接口。
覆盖装备、仓库、背包、安全箱、未领取信件与恢复记录；已领取信件不再次补偿。
缩容保持先装入的混装弹药顺序，余弹完整退仓；迁移可产生超额仓库存量，正常购买/转入仍受容量约束。
既有伊莲娜委托的旧弹鼓奖励更新为 STANAG 60 发；未完成委托只替换奖励，不提前发放。

## 效果与测试

同属性加算后统一应用下限：双轴后坐、散布与连射增长最低0.5，举枪与装填最低0.6，噪声最低0.32（支持SLX −68%）。
adsSpread 在稳定进度55%之后渐入，hipSpread 在到达55%时退出；枪械自己的 adsPrecisionMul 单独插值一次。
正式战局同样在55%肩射节点后渐入瞄具精度；hipSpread在到达肩射节点前退出。噪声修正改变AI听觉半径，不改变音量。
瞄具倍率沿用已试玩版本；肩射1.08×；无镜、反射、全息、开放式机瞄画面1.15×；光学镜画面统一1.4×。视距独立于画面放大，远程战术镜2.4的视距参数提供最大的有限观察区，允许角色离屏。

验证命令：node tools/test-attachments-v2.js、node tools/test-attachments.js、node tools/test-attachments-v2-browser.js。
图标成品 assets/gear/，新原稿 assets/item-art/attachments-v2/sources/，提示词 assets/source/prompts/attachments-v2.json。

验收结果：V2及后续扩充专项、主回归通过；既有配件事务、装填、改枪、邮件、伊莲娜服务和人形枪械回归通过。
普通版与离线版均通过八种瞄具、远处聚焦和有限观察窗口测试，正式战局启用共享镜头与键位，并扩展实际可见距离，保留墙体遮挡。
新增68张图标均为48×48透明PNG，素材体检0错误、0警告；离线版已重建。
验收截图：[商店](runtime-shop.png)、[改枪](runtime-gunsmith.png)、[靶场](runtime-range.png)、[离线改枪](offline-gunsmith.png)、[图标总览](gallery.png)。
浏览器结构化记录见 [browser-verification.json](browser-verification.json)。

## 完整物品表（93件）

| ID | 名称 | r | kg | 售价 | 效果 |
|---|---|---:|---:|---:|---|
| att_optic01 | 微型反射瞄具 | 2 | 0.08 | 7500 | aimTime -12%；镜头 1.15×；视距 1.15× |
| att_optic02 | 全息瞄具 | 3 | 0.25 | 13500 | aimTime +2%；adsSpread -12%；镜头 1.15×；视距 1.15× |
| att_optic03 | 低倍率光学瞄具 | 3 | 0.32 | 18000 | aimTime +5%；adsSpread -20%；镜头 1.4×；视距 1.6× |
| att_optic04 | 精密光学瞄具 | 4 | 0.48 | 30000 | aimTime +8%；adsSpread -30%；镜头 1.4×；视距 2× |
| att_optic05 | 开放式机械瞄具 | 1 | 0.05 | 3000 | aimTime -5%；adsSpread -5%；镜头 1.15×；视距 1.15× |
| att_optic06 | 紧凑棱镜瞄具 | 3 | 0.28 | 19500 | aimTime +6%；adsSpread -15%；镜头 1.4×；视距 1.45× |
| att_optic07 | 低倍可变光学瞄具 | 4 | 0.42 | 32000 | aimTime +12%；adsSpread -22%；镜头 1.4×；视距 1.8× |
| att_optic08 | 远程战术瞄准镜 | 5 | 0.65 | 48000 | aimTime +22%；adsSpread -35%；镜头 1.4×；视距 2.4× |
| att_grip01 | 垂直握把 | 2 | 0.12 | 6750 | recoilVertical -18%；aimTime +2% |
| att_grip02 | 斜角握把 | 2 | 0.1 | 7500 | recoilHorizontal -16% |
| att_grip03 | 紧凑握把 | 3 | 0.08 | 10500 | aimTime -10%；recoilHorizontal +3% |
| att_grip04 | 人体工学握把 | 3 | 0.14 | 13500 | recoilHorizontal -8%；recoilVertical -8% |
| att_grip05 | 短型阻手器 | 2 | 0.07 | 8500 | aimTime -8%；hipSpread -6% |
| att_grip06 | 加重垂直握把 | 3 | 0.21 | 16000 | recoilVertical -24%；aimTime +8% |
| att_grip07 | 稳定战术握把 | 4 | 0.25 | 23000 | spreadGrowth -18%；recoilHorizontal -8%；aimTime +6% |
| att_grip08 | 轻型竞技握把 | 4 | 0.09 | 20000 | aimTime -16%；recoilHorizontal +7%；recoilVertical +7% |
| att_stock01 | 固定枪托 | 2 | 0.3 | 9000 | recoilHorizontal -12%；recoilVertical -12%；aimTime +3% |
| att_stock02 | 伸缩枪托 | 2 | 0.22 | 8250 | aimTime -12%；recoilHorizontal +3%；recoilVertical +3% |
| att_stock03 | 精密枪托 | 4 | 0.45 | 22500 | baseSpread -8%；spreadGrowth -20%；aimTime +5% |
| att_stock04 | 轻量镂空枪托 | 2 | 0.16 | 11000 | aimTime -15%；recoilHorizontal +8%；recoilVertical +8% |
| att_stock05 | 加重稳定枪托 | 3 | 0.52 | 17500 | recoilHorizontal -16%；recoilVertical -16%；aimTime +10% |
| att_stock06 | 缓冲减震枪托 | 4 | 0.48 | 26000 | spreadGrowth -22%；recoilVertical -7%；aimTime +9% |
| att_stock07 | 精英战术枪托 | 5 | 0.36 | 38000 | recoilHorizontal -12%；recoilVertical -12%；spreadGrowth -10%；aimTime +5% |
| att_muzzle01 | 标准制退器 | 2 | 0.08 | 6000 | recoilVertical -15% |
| att_muzzle02 | 横向补偿器 | 3 | 0.1 | 10500 | recoilHorizontal -18%；aimTime +2% |
| att_muzzle03 | 复合补偿器 | 3 | 0.12 | 13500 | recoilHorizontal -10%；recoilVertical -10%；aimTime +3% |
| att_muzzle04 | 精密枪口装置 | 4 | 0.1 | 18000 | baseSpread -12%；aimTime +4% |
| att_muzzle05 | 收束器 | 3 | 0.06 | 12000 | pelletSpread -20%；aimTime +2% |
| att_muzzle06 | 扩散器 | 2 | 0.05 | 5250 | pelletSpread +25% |
| att_muzzle07 | 鸟笼式消焰器 | 2 | 0.09 | 7500 | recoilHorizontal -6%；noiseRadius -10% |
| att_muzzle08 | 紧凑型消音器 | 3 | 0.2 | 24000 | noiseRadius -45%；recoilVertical -5%；aimTime +6% |
| att_muzzle09 | 重型战术消音器 | 4 | 0.48 | 39000 | noiseRadius -60%；recoilHorizontal -10%；recoilVertical -10%；aimTime +14% |
| att_muzzle10 | 高效多孔制退器 | 5 | 0.19 | 32000 | recoilVertical -23%；recoilHorizontal -13%；aimTime +8%；noiseRadius +15% |
| att_mag_556_competition | STANAG 竞赛型弹匣 | 3 | 0.12 | 15000 | reloadTime -18% |
| att_mag_556_polymer | STANAG 聚合物弹匣 | 2 | 0.07 | 9000 | aimTime -10% |
| att_mag_556_40 | STANAG 40发扩容弹匣 | 3 | 0.19 | 19000 | 固定 40 发；aimTime +8%；reloadTime +5% |
| att_mag_556_60 | STANAG 60发弹鼓 | 4 | 0.42 | 36000 | 固定 60 发；aimTime +20%；reloadTime +25% |
| att_mag_545x39_competition | AK 5.45 竞赛型弹匣 | 3 | 0.12 | 15500 | reloadTime -18% |
| att_mag_545x39_polymer | AK 5.45 聚合物弹匣 | 2 | 0.07 | 9500 | aimTime -10% |
| att_mag_545x39_45 | AK 5.45 45发扩容弹匣 | 3 | 0.21 | 22500 | 固定 45 发；aimTime +8%；reloadTime +5% |
| att_mag_545x39_60 | AK 5.45 60发弹鼓 | 4 | 0.42 | 38000 | 固定 60 发；aimTime +20%；reloadTime +25% |
| att_mag_762x39_competition | AK 7.62 竞赛型弹匣 | 3 | 0.15 | 16000 | reloadTime -18% |
| att_mag_762x39_polymer | AK 7.62 聚合物弹匣 | 2 | 0.09 | 10000 | aimTime -10% |
| att_mag_762x39_40 | AK 7.62 40发扩容弹匣 | 3 | 0.24 | 21000 | 固定 40 发；aimTime +8%；reloadTime +5% |
| att_mag_762x39_75 | AK 7.62 75发弹鼓 | 4 | 0.69 | 50000 | 固定 75 发；aimTime +20%；reloadTime +25% |
| att_mag_556_famas_competition | FAMAS 竞赛型弹匣 | 3 | 0.12 | 15000 | reloadTime -18% |
| att_mag_556_famas_polymer | FAMAS 聚合物弹匣 | 2 | 0.07 | 9000 | aimTime -10% |
| att_mag_556_galil_competition | Galil 竞赛型弹匣 | 3 | 0.12 | 15000 | reloadTime -18% |
| att_mag_556_galil_polymer | Galil 聚合物弹匣 | 2 | 0.07 | 9000 | aimTime -10% |
| att_mag_556_galil_50 | Galil 50发扩容弹匣 | 3 | 0.24 | 23750 | 固定 50 发；aimTime +8%；reloadTime +5% |
| att_mag_556_galil_75 | Galil 75发弹鼓 | 4 | 0.53 | 45000 | 固定 75 发；aimTime +20%；reloadTime +25% |
| att_mag_556_g36_competition | G36 竞赛型弹匣 | 3 | 0.12 | 15000 | reloadTime -18% |
| att_mag_556_g36_polymer | G36 聚合物弹匣 | 2 | 0.07 | 9000 | aimTime -10% |
| att_mag_556_g36_40 | G36 40发扩容弹匣 | 3 | 0.19 | 19000 | 固定 40 发；aimTime +8%；reloadTime +5% |
| att_mag_556_g36_60 | G36 60发弹鼓 | 4 | 0.42 | 36000 | 固定 60 发；aimTime +20%；reloadTime +25% |
| att_mag_556_sig550_competition | SIG 550 竞赛型弹匣 | 3 | 0.12 | 15000 | reloadTime -18% |
| att_mag_556_sig550_polymer | SIG 550 聚合物弹匣 | 2 | 0.07 | 9000 | aimTime -10% |
| att_mag_556_sig550_40 | SIG 550 40发扩容弹匣 | 3 | 0.19 | 19000 | 固定 40 发；aimTime +8%；reloadTime +5% |
| att_mag_556_sig550_60 | SIG 550 60发弹鼓 | 4 | 0.42 | 36000 | 固定 60 发；aimTime +20%；reloadTime +25% |
| att_mag_556_aug_competition | AUG 竞赛型弹匣 | 3 | 0.12 | 15000 | reloadTime -18% |
| att_mag_556_aug_polymer | AUG 聚合物弹匣 | 2 | 0.07 | 9000 | aimTime -10% |
| att_mag_556_aug_42 | AUG 42发扩容弹匣 | 3 | 0.2 | 19950 | 固定 42 发；aimTime +8%；reloadTime +5% |
| att_mag_556_aug_60 | AUG 60发弹鼓 | 4 | 0.42 | 36000 | 固定 60 发；aimTime +20%；reloadTime +25% |
| att_mag_9mm_vityaz_competition | Vityaz 竞赛型弹匣 | 3 | 0.1 | 11000 | reloadTime -18% |
| att_mag_9mm_vityaz_polymer | Vityaz 聚合物弹匣 | 2 | 0.06 | 7500 | aimTime -10% |
| att_mag_9mm_vityaz_40 | Vityaz 40发扩容弹匣 | 3 | 0.15 | 15000 | 固定 40 发；aimTime +8%；reloadTime +5% |
| att_mag_9mm_vityaz_50 | Vityaz 50发弹鼓 | 4 | 0.27 | 24150 | 固定 50 发；aimTime +20%；reloadTime +25% |
| att_mag_9mm_mp5_competition | MP5 竞赛型弹匣 | 3 | 0.1 | 11000 | reloadTime -18% |
| att_mag_9mm_mp5_polymer | MP5 聚合物弹匣 | 2 | 0.06 | 7500 | aimTime -10% |
| att_mag_9mm_mp5_40 | MP5 40发扩容弹匣 | 3 | 0.15 | 15000 | 固定 40 发；aimTime +8%；reloadTime +5% |
| att_mag_9mm_mp5_50 | MP5 50发弹鼓 | 4 | 0.27 | 24150 | 固定 50 发；aimTime +20%；reloadTime +25% |
| att_mag_45acp_ump_competition | UMP 竞赛型弹匣 | 3 | 0.12 | 12000 | reloadTime -18% |
| att_mag_45acp_ump_polymer | UMP 聚合物弹匣 | 2 | 0.08 | 8000 | aimTime -10% |
| att_mag_45acp_ump_35 | UMP 35发扩容弹匣 | 3 | 0.17 | 14900 | 固定 35 发；aimTime +8%；reloadTime +5% |
| att_mag_45acp_ump_50 | UMP 50发弹鼓 | 4 | 0.33 | 27500 | 固定 50 发；aimTime +20%；reloadTime +25% |
| att_mag_9mm_glock_competition | Glock 竞赛型弹匣 | 3 | 0.1 | 11000 | reloadTime -18% |
| att_mag_9mm_glock_polymer | Glock 聚合物弹匣 | 2 | 0.06 | 7500 | aimTime -10% |
| att_mag_9mm_beretta92_competition | Beretta 92 竞赛型弹匣 | 3 | 0.1 | 11000 | reloadTime -18% |
| att_mag_9mm_beretta92_polymer | Beretta 92 聚合物弹匣 | 2 | 0.06 | 7500 | aimTime -10% |
| att_mag_45acp_m1911_competition | M1911 竞赛型弹匣 | 3 | 0.12 | 12000 | reloadTime -18% |
| att_mag_45acp_m1911_polymer | M1911 聚合物弹匣 | 2 | 0.08 | 8000 | aimTime -10% |
| att_mag_12g_saiga_competition | Saiga-12 竞赛型弹匣 | 3 | 0.15 | 15000 | reloadTime -18% |
| att_mag_12g_saiga_polymer | Saiga-12 聚合物弹匣 | 2 | 0.1 | 9000 | aimTime -10% |
| att_mag_12g_saiga_12 | Saiga-12 12发扩容弹匣 | 3 | 0.24 | 18000 | 固定 12 发；aimTime +8%；reloadTime +5% |
| att_mag_12g_saiga_20 | Saiga-12 20发弹鼓 | 4 | 0.45 | 30000 | 固定 20 发；aimTime +20%；reloadTime +25% |
| att_mag_68x51_sr25_pattern_competition | SR-25 竞赛型弹匣 | 3 | 0.18 | 28000 | reloadTime -18% |
| att_mag_68x51_sr25_pattern_polymer | SR-25 聚合物弹匣 | 2 | 0.12 | 19000 | aimTime -10% |
| att_mag_68x51_sr25_pattern_25 | SR-25 25发扩容弹匣 | 3 | 0.25 | 38000 | 固定 25 发；aimTime +8%；reloadTime +5% |
| att_mag_68x51_rm277_competition | RM277 竞赛型弹匣 | 3 | 0.18 | 28000 | reloadTime -18% |
| att_mag_68x51_rm277_polymer | RM277 聚合物弹匣 | 2 | 0.12 | 19000 | aimTime -10% |
| att_mag_68x51_rm277_25 | RM277 25发扩容弹匣 | 3 | 0.25 | 38000 | 固定 25 发；aimTime +8%；reloadTime +5% |
| att_muzzle11 | SIG SLX 战术抑制器 | 5 | 0.4 | 155000 | noiseRadius -68%；recoilVertical -16%；recoilHorizontal -15%；aimTime +10% |
| att_muzzle12 | Delta P BREVIS II 抑制器 | 5 | 0.34 | 135000 | noiseRadius -60%；recoilVertical -12%；recoilHorizontal -18%；aimTime +7% |
