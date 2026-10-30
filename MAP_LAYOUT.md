# 临海路旧街区 · 游戏地图

新增临海路地图为 **72×56 格**（2304×1792px），首批18张地块已接入开发版和离线版。布局源见[评审页](design/maps/linhai-old-quarter/index.html)，素材见[清单](design/maps/linhai-old-quarter/art-requirements.html)。

| 区域 | 容器 | 敌人 |
| --- | ---: | ---: |
| 老公寓 | 7 | 3名拾荒者 |
| 小诊所 | 5 | 2名拾荒者 |
| 钟表店 | 6 | 3名拾荒者 |
| 银行旧址 | 10 | 5名守卫 |
| 仓库兼工具铺 | 5 | 2名拾荒者 |
| 街巷、小院与河岸 | 8 | 2名拾荒者、7只回响体 |

共41个容器、24个敌人、40处实体家具。出生点(7,4)，西岸撤离A(6,51)、东岸撤离B(67,51)。敌人固定出生间距至少3格、距玩家至少12格、距撤离点至少6格，巡逻半径采用设计稿的2–3格，追击和调查沿用现有AI。

运河x30–35全宽六格，不可涉水；北石桥y12–15四格净宽、南栈桥y40–42三格净宽，是唯一跨河路线。栏杆在桥面外侧，不侵占桥面；阶梯沿岸连铺三格，不构成新的跨河入口。

两格门洞共用状态与门框，按格裁切遵守迷雾；门口有人时不能关闭。安保和金库使用强化门外观，不增加钥匙或门禁。橱窗阻挡行动、允许视线通过，完整玻璃阻挡子弹；运河和驳岸阻挡行走但不挡视线或弹道。容器和家具按一格实体参与碰撞与A*，开空的容器仍占格，碎石地贴可穿过。

当前稳定水位，保留12分钟行动计时，超时按行动失败结算。南桥、低地和阶梯不发生潮汐减速、封路或失效。原潮汐基础实现保留，当前地图通过tideEnabled:false关闭，未来再启用局部潮汐。

七类家具（床、灶台、沙发、长椅、展示柜、柜台、树）暂复用桌、椅、货架、桶作为临时外观，40处实体点位全部保留；后续再绘制专用家具和整体建筑室外图。

游戏沿用原存档键和局外结构，旧收藏、信用点、配装和仓库保留。地图每局重建，不迁移旧局的地图坐标。

查看与编辑：`python -m http.server 8765` 后打开 `http://127.0.0.1:8765/design/maps/editor/`（地形/实体编辑、实时校验、Ctrl+S 写回）；加 `?selftest=1` 跑 44 项自测。也可直接双击 `design/maps/editor/index.html`，把 layout.json 拖进页面（此时只能导出，不能直接写盘）。

数据链：layout.json（唯一手工源，schemaVersion 2）→ tools/build-linhai-map.js → js/data.js 中的 RAID_MAP；`routes` 不再入库，由校验器按实体占格现场计算。校验规则在 `design/maps/shared/map-validator.js`（18 条：通用 G1–G12 + 本图 M1–M6，本图部分配置在 `design/maps/linhai-old-quarter/rules.json`），浏览器与 node 共用同一份，`design/maps/linhai-old-quarter/validate.cjs` 只是 node 壳。保留地形与容器/P/E两层行数据，避免容器格丢失室内、庭院、街道材质；保存设计稿SHA-256，可检测快照过期。修改设计源后先构建设计目录，再运行node build.js，自动验收、同步快照并生成离线包，不直接修改生成区块。

验证命令：

- node tools/test-map-layout.js：设计与运行碰撞逐格一致、双桥唯一跨河、出生缓冲、全容器操作面、全部入口与撤离可达。
- node smoke-test.js、node run-test.js：基础逻辑与完整流程。
- node tools/test-expanded-map.js：Playwright/Edge，开发版与离线版、旧档、贴图、实走撤离路径、门组、搜刮、双撤离及迷雾。
- node tools/gen-map-preview.js：用sharp生成实际地图总览。

实机截图在output/map/linhai/，总览在output/map/map-overview.png。

## 游戏地图选择

藏身处点击“进入游戏”进入地图选择页，提供“临海路旧街区”和“围栏区”。可返回藏身处或按Escape，浏览、切换、返回均不扣费；点击“出发”才按携带配置结算补给。页面显示地形示意、尺寸、建筑、撤离点和潮汐信息。

围栏区保留64×44布局、41容器、24敌人、42处摆设、三个撤离点及原潮汐高度。数据快照在design/maps/fenced-zone/runtime.json，构建时与临海路共同打入MAP_CATALOG，运行时切换地形、家具、敌人和潮汐，不需要联网。可运行node tools/test-map-selection.js验证两图往返与补给结算。
