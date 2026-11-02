# 三位商人立绘 · 设计批次

当前版本使用用户提供的三张新版立绘，已接入商人总览与详情；旧概念图保存在archive/initial-concept，不覆盖用户原稿。

- `merchant_armor.png`：玛拉·维恩，48岁，护甲与防护物资。
- `merchant_guns.png`：埃德加·洛克，55岁，军械技术与军火交易。
- `merchant_doctor.png`：林岑，41岁，急诊医生与医疗品供应。

用户原图均为1122×1402 PNG。预览统一为768×960 PNG、4:5画幅；游戏展示派生图为640×800 WebP。新版为油画笔触的职业肖像，保留原构图、色彩与背景。不是透明像素图标，不作为可放置场景物块登记。

`sources/`保存用户提供的原图，三个同名JSON记录来源文件与旧版归档位置；新图的提示词未知，记录为null，不沿用旧概念图提示词。`manifest.json`汇总来源和派生规格。`index.html`为当前立绘页，`preview.png`为桌面预览，`quality.json`记录检查结果。

项目根目录下可执行：

```text
node tools/build-merchant-design.js
node tools/test-merchant-design.js
node tools/prepare-merchant-portraits.js
node tools/test-merchant-design-browser.js
```

后两项需环境中可解析sharp和playwright，并安装Microsoft Edge。prepare脚本更新预览PNG及游戏WebP；随后执行`node build.js --assets-only`同步离线版，不修改存档或重编地图。完整设计入口：[商人设计包](../../../design/merchants/index.html)。
