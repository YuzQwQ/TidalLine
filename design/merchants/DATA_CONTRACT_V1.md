# 商人数据与后续接入约定 v1.0

`design-v1.json` 为设计资料，不导入当前游戏，不读写玩家localStorage。角色ID沿用merchant_armor、merchant_guns、merchant_doctor；军火商姓名升级为埃德加，不改稳定ID。

## 静态与玩家数据分离

静态定义包括人物、台词、商品引用、条件、任务图和奖励。玩家数据仅保存信誉、交易累计、任务状态、分支、剧情标记、限购周期、预留和旧档继承权限；不把人物简介或整份商品定义反复写入存档。

玩家数据草案（另外两人使用各自独立的相同结构）：

```json
{
  "version": 1,
  "merchants": {
    "merchant_armor": {
      "reputation": 0,
      "tradeCredits": 0,
      "earnedLevel": 1,
      "quests": {},
      "choices": {},
      "storyFlags": [],
      "quotaCycleId": 0,
      "purchased": {},
      "reservation": null,
      "legacyUnlockedProducts": []
    }
  }
}
```

## 后续最小接口建议

- `getMerchantProgress(id)`：返回当前等级和三项晋级条件的满足情况。
- `getMerchantOffers(id)`：返回已开放、已锁定、功能待实现的商品及明确原因。
- `commitMerchantTransaction(id, offerId, quantity, transactionId)`：重新校验价格、余额、容量、限购和条件，一次性扣款／扣库存／发货／累计交易。相同transactionId不能重复结算。
- `acceptQuest(id)`、`submitQuest(id, choice)`：验证前置、证据及所选替代路径；提交物品和发放奖励同一事务，重复提交不重复奖励。
- `recordQuestEvidence(runId, eventId, evidence)`：只收明确事件，不根据普通敌人击杀或玩家文字推断善恶；未撤离证据不转为永久完成。

## 等级与剧情标记

等级是信誉、交易额、指定resolved标记的AND判定；对已获得的常规访问权做保留，不因拒绝可选剧情或一次违约永久降级锁货。cooperate和alternative写入同一任务resolved标记，并额外保存不同choice，不能用cooperate专属标记控制毕业货架。

护送、医疗损伤、改装等依赖用requiresFeature显式标注；本轮仅有文档标记，不创建对应运行时功能。

## 容量、失败与恢复

交易前检查全部新增格数和负重，拆堆后仍使用现有口径上限。退款同步回滚交易累计；进度与限购保存应复用原存档键下的新命名空间，不覆盖资金、装备、弹匣顺序、绑定近战或安全箱。沿用当前死亡装备损失，不让任务失败隐式再扣装备。

## 设计校验

`node tools/test-merchant-design.js` 验证18项任务、前置无环、两种关键分支同权、三组四级门槛、18医疗品与15弹药引用、尚无功能的占位不伪装成可用商品。文档与可视化页由 `node tools/build-merchant-design.js` 同源生成；不会运行build.js，也不会同步到离线游戏。
