# 军火商弹药数量购买

弹药货架取消固定“×30”和盒装价格，改为显示单发价格。选中弹药后点击“购买”，打开数量弹窗，用滑条或数字输入选择1发至6组；默认一组。数量与总价实时更新，点击“确定购买”才扣款入库，“取消”或Esc关闭不改变资金与库存。

| 口径 | 每组 | 单次上限 |
|---|---:|---:|
| 12G | 20发 | 120发 |
| 5.56×45mm、7.62×39mm、5.45×39mm | 60发 | 360发 |
| 9mm、.45 ACP | 90发 | 540发 |

组容量读取现有`stackLimit`，上限由`Base.SHOP_AMMO_MAX_STACKS`控制。仍仅出售原有六种口径的一、二级弹药，单发价格沿用物品定义。仓库优先补齐已有堆叠，其余按各自容量拆组。

弹窗确认时重新核对数量、余额、容量与所在商店，防止弹窗开启后条件变化导致错误扣款；重复点击只成交一次，切换商人、页签或离开藏身处会清除未确认订单。

实现：`js/base.js`中的`Base.ammoQuote`／`Base.buyAmmo`与`AmmoPurchase`，`js/merchant-ui.js`中的单价和数量上限展示，`assets/ui/merchant.css`中的弹窗样式。

验证通过：

- `node tools/test-ammo-purchase.js`：全部12类在售弹药、单发／一组／六组、越界及非法数量、余额不足、仓库补齐与满仓拒绝、存档读取。
- `node tools/test-ammo-purchase-browser.js`：开发版与离线版真实滑条、金额、数字输入、取消／Esc、重复点击、开窗后余额／容量变化、切换商人、保存重载；1440／390／320px布局；离线无外部素材请求。
- `node tools/test-ammo-stack-limits.js`、`node tools/test-merchant-ui.js`、`node run-test.js`（416项）通过，素材体检0错误。

浏览器结果见[verification.json](verification.json)，桌面与手机截图保存于本目录。开发版与离线单文件版均已同步。
