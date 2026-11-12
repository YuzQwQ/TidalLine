# 全枪械消音处理 · 靶场版

沿用用户确认的M4模板：音调+9半音、同一滤波和130ms包络。每把枪保留自己的原采样，再应用独立响度补偿。M4=1.00、AKM=1.55保持已确认值。

进入靶场选择枪械，在“音效试听”点击“为当前枪械装配消音器”。原声／消音单发与三连发均针对当前手持枪械；装配后正常开火也自动应用。

目前22款有兼容消音器的枪械全部覆盖。MP-155、Remington 870、Saiga-12没有兼容消音器，试听按钮禁用，本轮不扩大配件接口。SPEAR优先装SLX，RM277优先装BREVIS，其余使用兼容通用消音器。

本轮继续仅在靶场启用；正式地图、未安装消音器的原声、AI听觉半径、枪械射速与真实库存均保持既有规则。独立补偿仅作用于处理后的采样，不把高倍采样补偿应用到合成兜底。

## 逐枪补偿

以下是M4模板之后的独立声音增益，不是AI听觉半径。按现有采样、原播放倍率、型号音量和采样基准增益离线测量。手枪的三个随机变体按平均能量校准。

| 枪械 | ID | 采样组 | 补偿 × | 处理后能量相对M4 |
|---|---|---|---:|---:|
| M4A1 | m4a1 | rifle | 1.00 | 100.0% |
| AKM | akm | ak47 | 1.55 | 101.6% |
| FAMAS F1 | famas_f1 | famas | 0.83 | 100.2% |
| PP-19-01 Vityaz | pp19_01 | smg | 1.29 | 100.4% |
| MP5A3 | mp5a3 | mp5 | 2.31 | 100.2% |
| UMP45 | ump45 | ump45 | 0.66 | 100.5% |
| Glock 17 | glock17 | pistol | 2.16 | 99.9% |
| M1911A1 | m1911a1 | pistol | 2.16 | 99.9% |
| Beretta 92FS | beretta92 | pistol | 2.16 | 99.9% |
| M16A1 | m16a1 | m16a1 | 4.39 | 99.9% |
| Galil ARM | galil_arm | galil_arm | 0.53 | 100.9% |
| AKS-74U | aks74u | aks74u | 0.61 | 100.2% |
| G36C | g36c | g36c | 0.88 | 100.2% |
| FN FNC | fn_fnc | fn_fnc | 1.14 | 100.1% |
| SIG SG 550 | sig550 | sig550 | 0.53 | 100.3% |
| AN-94 | an94 | an94 | 1.04 | 99.9% |
| AUG A1 | aug_a1 | aug_a1 | 1.09 | 100.2% |
| OTs-14-1A Groza-1「雷暴」 | groza1 | groza1 | 1.44 | 99.8% |
| AK-12 | ak12 | ak12 | 0.77 | 100.2% |
| MK47 MOD.2「Mutant」 | mk47_mod2 | mk47_mod2 | 4.06 | 100.0% |
| SIG MCX SPEAR | mcx_spear | spear | 0.61 | 99.6% |
| GD RM277 | rm277 | rm277 | 0.79 | 100.1% |

平均能量对齐不等于主观听感完全相同，实际仍保留各录音的起音、质感与动态差异。可继续按试听反馈单独调整补偿值。

## 数据与验证

- js/ui.js：RANGE_M4_SUPPRESSOR共享音色、RANGE_SUPPRESSOR_GAINS逐枪增益。
- node tools/calibrate-suppressed-guns.js --write：复测原采样并更新增益表；保留M4和AKM已确认值。
- calibration.json：输入采样、测得能量／峰值、实际增益与对齐结果。
- node tools/test-suppressed-guns-range.js：普通／离线版22枪实射、全部对比／三连、专属接口、三把无兼容枪的禁用、波形能量／峰值／尾音、存档与正式场景隔离。
- 旧M4和AKM测试入口均转发到完整测试。

[验收记录](verification.json) · [补偿数据](calibration.json) · [普通版面板](runtime.png) · [离线版面板](offline.png)
