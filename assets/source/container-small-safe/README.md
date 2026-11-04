# 小型保险箱体量调整

原32×32贴图备份在 `sources/crate_heavy-before.png`。通过内置image_gen编辑保留保险箱身份及视角，并将成品整理至20×21范围；最终可见主体17×21，画布仍为32×32，底边仍在y28。

成品：`../props/crate_heavy.png`。一格碰撞、容器B、搜索规则与掉落保持原样。大型保险箱仍使用独立的 `crate_safe_big.png`。

[大小对照](../container-large-safe/index.html) · [实际提示词与原稿](manifest.json) · [检查结果](quality.json)

重新整理：`node tools/prepare-small-safe.js`。

检查：`node tools/test-small-safe.js`，覆盖像素尺寸、透明边、共同落脚位置、编辑器放置/撤销/保存重开，以及开发版和离线版资源加载。

本次同步场景登记表、素材库、清单和离线图片。地图草稿处于编辑状态且未通过布局校验，离线版使用 `node build.js --assets-only` 沿用已有游戏快照，仅更新素材；不会修改草稿或把未校验的布局写入游戏。
