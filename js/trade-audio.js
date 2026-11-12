/* 局外交易结算音：任何花钱的购买、卖出、付费服务成交都只响一次 trade_settle。
   放在所有交易模块之后、boot.js 之前加载；对白 / 视觉稿等独立入口用 typeof 兜住。

   两条来源：
   1) 购买入口（Base.buy* / Trader.buy / Clinic.pay / Repair.apply）统一包一层：
      调用前后比 Save.credits，真的扣了钱就播，并在调用期间把内部的
      pickup / sell / buy 吞掉，避免「物品入手声 + 结算声」叠成两下。
   2) 卖出、委托领奖、改枪付款不经过购买入口，它们原本调 Game.sfx('sell' / 'buy')，
      这里把这两个语义名重定向到 trade_settle。改枪工坊 finishPlan 已按
      plan.total 区分「付款买配件」与「只装已有配件」，无需再包一层。 */
const TradeAudio = {
  active: false,

  play() {
    if (typeof SFX !== 'undefined' && typeof Game !== 'undefined' && Game.state === 'base')
      SFX.play('trade_settle');
  },

  wrap(obj, name) {
    if (!obj || typeof obj[name] !== 'function' || obj[name].__tradeSettled) return;
    const fn = obj[name];
    const wrapped = function () {
      const before = Save.credits, outer = TradeAudio.active;
      TradeAudio.active = true;
      let r;
      try { r = fn.apply(this, arguments); }
      finally { TradeAudio.active = outer; }
      /* 只有最外层、且确实花了钱才结算；免费领取 / 失败不改余额，不发声 */
      if (!outer && Save.credits < before) TradeAudio.play();
      return r;
    };
    wrapped.__tradeSettled = true;
    obj[name] = wrapped;
  }
};

{
  const buys = ['buyGun', 'buyAmmo', 'buyMelee', 'buyAttachment',
    'buyMedical', 'buyArmor', 'buyBag', 'treat'];
  if (typeof Base !== 'undefined') for (const name of buys) TradeAudio.wrap(Base, name);
  if (typeof TradeMerchant !== 'undefined') TradeAudio.wrap(TradeMerchant, 'buy');
  if (typeof Clinic !== 'undefined') TradeAudio.wrap(Clinic, 'pay');
  if (typeof Repair !== 'undefined') TradeAudio.wrap(Repair, 'apply');

  if (typeof Game !== 'undefined' && typeof SFX !== 'undefined') {
    const sfx = Game.sfx;
    Game.sfx = function (name, opts) {
      /* 交易期间由外层统一结算，内部的成交音不再重复 */
      if (TradeAudio.active && (name === 'pickup' || name === 'sell' || name === 'buy')) return;
      /* 出售 / 委托领奖 / 改枪付款：旧语义名换成新的结算音 */
      if (name === 'sell' || name === 'buy') return sfx.call(this, 'trade_settle', opts);
      return sfx.apply(this, arguments);
    };
  }
}
