# 五档背包装备图标

[五图并排与原生尺寸预览](index.html) · [实际提示词及原稿记录](manifest.json) · [质量检查](quality.json)

使用内置image_gen分别绘制5张原稿，原稿副本保存在sources/；交付为48×48透明PNG，中央40×40以内、≥4px透明边、16色、二值alpha、最近邻采样。统一左上光源及略俯视的三分之四展示角度，无人物、地面、文字、等级徽标或烘焙稀有度底色。

| 稳定ID | 文件 | 名称 | 档位 | 容量 | 重量 | 参考售价 |
| --- | --- | --- | --- | --- | --- | --- |
| bag01 | assets/gear/bag01.png | 旧帆布挎包 | 寻常 | 8格 | 0.7kg | ¥6,000 |
| bag02 | assets/gear/bag02.png | 民用旅行背包 | 良品 | 12格 | 1.2kg | ¥18,000 |
| bag03 | assets/gear/bag03.png | 加固登山背包 | 上乘 | 16格 | 1.9kg | ¥45,000 |
| bag04 | assets/gear/bag04.png | 战术突击背包 | 稀见 | 20格 | 2.8kg | ¥110,000 |
| bag05 | assets/gear/bag05.png | 远征模块背包 | 珍罕 | 24格 | 3.8kg | ¥260,000 |

五档图标已按稳定ID接入游戏预加载表，供藏身处装备槽、仓库、装备选择、商人货架和交易框、局内装备条共用；离线版内嵌相同PNG。前三档由护甲商人出售，后两档沿用搜刮获取规则。稀有度底色由界面绘制，旧bag.png保留为空槽图标。

修改定义后运行 `node gen-gear-sheet.js` 更新装备清单与Wiki，再运行 `node build.js` 更新离线版。图标接入回归为 `node tools/test-gear-icons.js`，背包逻辑回归为 `node tools/test-backpack.js`。

制作脚本：`node tools/prepare-backpack-art.js`。图像检查：`node tools/test-backpack-art.js`，包含尺寸、颜色数、透明留边、不同图像身份、原稿记录、并排展示与320/390px窄屏。

这些是装备图标，不是地图摆设；按项目AGENTS.md范围，不作为可放置场景物件登记到场景素材库。
