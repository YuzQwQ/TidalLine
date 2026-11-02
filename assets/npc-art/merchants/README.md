# 三位商人立绘 · 设计批次

本批次仅作角色设计和后续商店界面的立绘参考，尚未接入游戏。

- `merchant_armor.png`：玛拉·维恩，48岁，护甲与防护物资。
- `merchant_guns.png`：埃德加·洛克，55岁，军械技术与军火交易。
- `merchant_doctor.png`：林岑，41岁，急诊医生与医疗品供应。

三图统一768×960像素、4:5画幅。采用写实概念风、90年代职业服装、低饱和工业色、左上光源，保留简化的职业环境背景。不是透明像素图标，不作为可放置场景物块登记。

`sources/`保存生成原稿，三个同名JSON记录实际提示词与原稿路径；`manifest.json`汇总交付规格。生成工具为内置image_gen，未使用API脚本。`index.html`为立绘评审页，`preview.png`为桌面预览，`quality.json`记录检查结果。

项目根目录下可执行：

```text
node tools/build-merchant-design.js
node tools/test-merchant-design.js
node tools/prepare-merchant-portraits.js
node tools/test-merchant-design-browser.js
```

后两项需环境中可解析sharp和playwright，并安装Microsoft Edge。构建仅更新设计文件和本批次派生图，不修改游戏、存档或离线版。完整设计入口：[商人设计包](../../../design/merchants/index.html)。
