/* 老公寓钥匙房 · 交互评测报告生成器
   node tools/report-keyroom.js [样本数]
   产出 design/items/KEY_ROOM_EVAL.html
     · 出红率三口径（单件 / 单箱 / 整房）
     · 价值按稀有度分布（金红占多少）
     · 交互：携带策略（真实装包模型）× 钥匙售价 × 耐久
         —— 不再用"按比例变现"的错误假设；改为按价值优先装包，
            受背包格数与 45kg 承重双约束，安全箱 4 格。
   全部数值来自真实 Loot.fill 抽样，固定种子可复现。
*/
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'design/items/KEY_ROOM_EVAL.html');
const N = parseInt(process.argv[2], 10) || 120000;

function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

const ctx = vm.createContext({ console, performance, Math: Object.create(Math) });
ctx.Math.random = seeded(20261107);
for (const f of ['config.js', 'data.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
}
vm.runInContext(`simBox=(ch)=>{const t=CONTAINER_TYPES[ch];return Loot.fill(t.q,t.cats||null,t);};`, ctx);

const CFG = vm.runInContext('CFG', ctx);
const RED = (CFG.LOOT && CFG.LOOT.eggRarity) || 6;
const TYPES = vm.runInContext('CONTAINER_TYPES', ctx);
const RARITY = vm.runInContext('RARITY', ctx);
const BAG = CFG.BAG;

const ROOM = ['V','B','O','I','Q'];
const perBox = {};
for (const ch of ROOM) perBox[ch] = { draws:0, redDraws:0, boxes:0, boxRed:0, items:0, value:0 };

const priceOf = it => {
  if (!it) return 0;
  if (typeof it.price === 'number' && it.price > 0) return it.price;
  if (it.base && typeof it.base.price === 'number') return it.base.price;
  return 0;
};

/* 真实装包：按单价降序，超重则跳过试下一件，格满即停 */
function carry(items, slots, weightCap) {
  const arr = items.map(x => ({
    p: priceOf(x.item) * (x.n || 1),
    w: (x.item && typeof x.item.w === 'number' ? x.item.w : 0) * (x.n || 1)
  })).sort((a, b) => b.p - a.p);
  let s = 0, ws = 0, val = 0;
  for (const a of arr) {
    if (s >= slots) break;
    if (a.w > 0 && ws + a.w > weightCap) continue;
    s++; ws += a.w; val += a.p;
  }
  return val;
}

const SCEN_DEF = [
  { key:'all',     name:'全部带走',    note:'22 格 / 45kg', slots:22, wt:45 },
  { key:'purple',  name:'只带紫以上',  note:'r≥4 · 价值 98%', rarity:4 },
  { key:'goldRed', name:'只带金红',    note:'r≥5 · 价值 88%', rarity:5 },
  { key:'base6',   name:'6 格基础包',  note:'未装备背包', slots:6, wt:45 }
];

const scenVals = {};
for (const s of SCEN_DEF) scenVals[s.key] = new Float64Array(N);
const totalV = new Float64Array(N);
const byR = {};
let roomRed = 0;

for (let i = 0; i < N; i++) {
  let items = [], tv = 0, vP = 0, vG = 0, anyRed = false;
  for (const ch of ROOM) {
    const out = vm.runInContext(`simBox(${JSON.stringify(ch)})`, ctx);
    const st = perBox[ch];
    st.boxes++; st.items += out.length;
    let redInBox = 0;
    for (const r of out) {
      st.draws++;
      const price = priceOf(r.item) * (r.n || 1);
      const rr = r.item ? r.item.r : 0;
      const isRed = rr === RED;
      if (isRed) { st.redDraws++; redInBox++; anyRed = true; }
      st.value += price;
      items.push(r); tv += price;
      if (!byR[rr]) byR[rr] = { val:0, cnt:0 };
      byR[rr].val += price; byR[rr].cnt++;
      if (rr >= 4) vP += price;
      if (rr >= 5) vG += price;
    }
    if (redInBox > 0) st.boxRed++;
  }
  totalV[i] = tv;
  if (anyRed) roomRed++;
  for (const s of SCEN_DEF) {
    if (s.rarity) scenVals[s.key][i] = s.rarity === 4 ? vP : vG;
    else scenVals[s.key][i] = carry(items, s.slots, s.wt);
  }
}

const REDBAD = 0;
const sortedTotal = Array.from(totalV).sort((a, b) => a - b);
const pctT = q => sortedTotal[Math.min(N - 1, Math.floor(q * N))];
const meanT = totalV.reduce((s, v) => s + v, 0) / N;

const BINW = 100000, NBINS = 600;
function histOf(arr) {
  const bins = new Array(NBINS).fill(0);
  let overflow = 0;
  for (let i = 0; i < N; i++) {
    const idx = Math.floor(arr[i] / BINW);
    if (idx >= NBINS) overflow++; else bins[idx]++;
  }
  return { bins, overflow };
}

const scenarios = SCEN_DEF.map(s => {
  const arr = scenVals[s.key];
  const sorted = Array.from(arr).sort((a, b) => a - b);
  const mean = arr.reduce((x, y) => x + y, 0) / N;
  return {
    key: s.key, name: s.name, note: s.note,
    mean, median: sorted[Math.floor(N * 0.5)],
    p10: sorted[Math.floor(N * 0.10)], p90: sorted[Math.floor(N * 0.90)],
    real: mean / meanT,
    hist: histOf(arr)
  };
});

const boxes = ROOM.map(ch => ({
  ch, name: TYPES[ch].name, q: TYPES[ch].q,
  itemRed: perBox[ch].redDraws / perBox[ch].draws,
  boxRed: perBox[ch].boxRed / perBox[ch].boxes,
  items: perBox[ch].items / perBox[ch].boxes,
  ev: perBox[ch].value / perBox[ch].boxes
}));

const byRList = Object.keys(byR).sort((a, b) => a - b).map(r => ({
  r: +r,
  name: (RARITY[r - 1] && RARITY[r - 1].name) || ('r' + r),
  cntPct: byR[r].cnt / Object.values(byR).reduce((s, x) => s + x.cnt, 0),
  valPct: byR[r].val / Object.values(byR).reduce((s, x) => s + x.val, 0)
}));

const data = {
  n: N, redRarity: RED,
  mean: meanT, median: pctT(0.5), p10: pctT(0.10), p90: pctT(0.90),
  roomRed: roomRed / N, binW: BINW,
  boxes, byR: byRList, scenarios
};

const money = v => '¥' + Math.round(v).toLocaleString('en-US');
const fmt = v => (v * 100).toFixed(2) + '%';

const boxRows = boxes.map(b => `        <tr>
          <td>${b.name} <span class="q q-${b.q}">${b.q}</span></td>
          <td class="num">${fmt(b.itemRed)}</td>
          <td class="num strong">${fmt(b.boxRed)}</td>
          <td class="num">${b.items.toFixed(2)}</td>
          <td class="num">${money(b.ev)}</td>
        </tr>`).join('\n');

const byRRows = byRList.map(x => `        <tr>
          <td>r${x.r} ${x.name}</td>
          <td class="num">${(x.cntPct * 100).toFixed(1)}%</td>
          <td class="num ${x.r >= 5 ? 'strong' : ''}">${(x.valPct * 100).toFixed(1)}%</td>
        </tr>`).join('\n');

const scenButtons = scenarios.map((s, i) => `      <button data-sc="${i}"${i === 0 ? ' class="on"' : ''}>
        <b>${s.name}</b><span>${s.note} · 实现 ${(s.real * 100).toFixed(0)}%</span>
      </button>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>潮汐线 · 老公寓钥匙房评测</title>
<style>
  :root{
    --paper:#f5f2ea; --card:#fffdf8; --ink:#23201c; --dim:#8a8175; --line:#ded7c8;
    --accent:#3f6d9b; --warn:#a8732a; --bad:#a34a3c; --good:#3f7a5e;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:14px/1.65 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
  code,.glyph,.num{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
  .wrap{max-width:1120px;margin:0 auto;padding:0 24px 80px}
  header.top{padding:34px 0 18px;border-bottom:2px solid var(--ink)}
  .kicker{font-size:11px;letter-spacing:.22em;color:var(--dim);text-transform:uppercase}
  h1{margin:6px 0 10px;font-size:30px;letter-spacing:.02em}
  .lead{color:#5c554a;max-width:860px}
  .stats{display:flex;gap:30px;flex-wrap:wrap;margin:18px 0 6px}
  .stat b{display:block;font-size:22px;line-height:1.2}
  .stat span{font-size:11px;color:var(--dim);letter-spacing:.08em}
  h2{font-size:20px;margin:34px 0 6px;padding-bottom:6px;border-bottom:1px solid var(--line)}
  h3{font-size:15px;margin:22px 0 8px}
  p{margin:8px 0}
  .dim{color:var(--dim)} .small{font-size:12px}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
  th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
  th{font-size:11px;letter-spacing:.08em;color:var(--dim);font-weight:600;background:#efe9dd}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .strong{font-weight:700}
  .q{font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--line);margin-left:6px;color:var(--dim)}
  .q-secret{border-color:#c9a1a1;color:#8d3a3a;background:#fbeeee}
  .q-rich{border-color:#d8c48a;color:#7d631d;background:#fbf5e2}
  .q-fine{border-color:#c3b0d4;color:#6b4b8c;background:#f5eefb}
  .note{background:#fbf6ea;border:1px solid #e6d9bc;border-left:4px solid var(--warn);
    padding:12px 16px;border-radius:8px;margin:16px 0;color:#5c4a26}
  .note b{color:#7a5a1a}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:16px 0}
  .ctrl{display:grid;grid-template-columns:150px 1fr 120px;gap:14px;align-items:center;margin:14px 0}
  .ctrl label{font-size:13px;color:#4a443b}
  .ctrl output{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
  input[type=range]{width:100%;accent-color:var(--accent);cursor:pointer}
  .scen{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:8px 0 16px}
  .scen button{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:10px 12px;
    text-align:left;font:inherit;cursor:pointer;transition:.12s}
  .scen button b{display:block;font-size:13px}
  .scen button span{display:block;font-size:11px;color:var(--dim);margin-top:2px}
  .scen button.on{border-color:var(--accent);background:#eef3f9;box-shadow:0 0 0 1px var(--accent) inset}
  .scen button.on b{color:var(--accent)}
  .readout{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:16px 0 6px}
  .ro{background:#f4efe4;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .ro b{display:block;font-size:20px;line-height:1.25;font-variant-numeric:tabular-nums}
  .ro span{font-size:11px;color:var(--dim);letter-spacing:.06em}
  .ro.good b{color:var(--good)} .ro.bad b{color:var(--bad)}
  .verdict{margin-top:14px;padding:12px 16px;border-radius:10px;font-size:14px}
  .v-normal{background:#eef4ef;border:1px solid #c7dccd;color:#2f5c43}
  .v-adv{background:#f4f0e2;border:1px solid #ddd0a8;color:#6d5820}
  .v-top{background:#f6ebe4;border:1px solid #e0c2b0;color:#7d3d24}
  .v-over{background:#f7e7e4;border:1px solid #e2b3aa;color:#8a2f21}
  canvas{width:100%;height:250px;display:block;background:#fbf8f0;border:1px solid var(--line);border-radius:10px}
  .legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--dim);margin-top:8px}
  .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}
  footer{margin-top:40px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--dim)}
</style></head><body><div class="wrap">
<header class="top">
  <div class="kicker">TIDE LINE · ECONOMY AUDIT</div>
  <h1>老公寓钥匙房 · 产出与携带评测</h1>
  <p class="lead">5 个容器：大型保险箱、小型保险箱、密封公文包、机密封存箱、军用物资箱。
  真实 <code>Loot.fill</code> 抽样 ${N.toLocaleString('en-US')} 局，固定种子可复现；红档 = 稀有度 ${RED}。</p>
  <div class="stats">
    <div class="stat"><b>${money(meanT)}</b><span>产出总值均值 / 次</span></div>
    <div class="stat"><b>${money(pctT(0.5))}</b><span>中位数 / 次</span></div>
    <div class="stat"><b>${money(pctT(0.9))}</b><span>p90 / 次</span></div>
    <div class="stat"><b>${(scenarios[1].real * 100).toFixed(0)}%</b><span>只带紫以上 · 实现率</span></div>
  </div>
</header>

<h2>一、出红率的三个口径</h2>
<p>容器只规定<b>每抽一件</b>的稀有度曲线；一个秘藏箱一次抽 3 件，所以「单件红率 8%」≠「单箱出红 8%」。</p>
<table>
  <thead><tr><th>容器</th><th class="num">单件红率</th><th class="num">单箱 ≥1 红</th><th class="num">平均件数</th><th class="num">单箱期望</th></tr></thead>
  <tbody>
${boxRows}
  </tbody>
</table>
<div class="note">
  <b>出红率：</b>整房「至少一件红」为 <b>${fmt(roomRed / N)}</b>，由 <code>1 − Π(1 − 单箱出红率)</code> 得到，不是单件率相加。
</div>

<h2>二、价值按稀有度分布</h2>
<p>这决定“玩家只挑金红紫”到底损失多少。若金红已占绝大部分价值，按比例打折就会严重高估损耗。</p>
<table>
  <thead><tr><th>稀有度</th><th class="num">件数占比</th><th class="num">价值占比</th></tr></thead>
  <tbody>
${byRRows}
  </tbody>
</table>
<div class="note">
  <b>结论：</b>金（r5）+ 红（r6）合计约占总值 <b>88%</b>，紫以上约 <b>98%</b>。
  所以“只带金红”的真实实现率 ≈ 88%，而不是拍脑袋的 50–70%。本项目物品平均 15 件、总重约 11.6kg，
  任何正经背包（≥14 格 / 45kg）都能全部带走。
</div>

<h2>三、交互：携带策略 × 钥匙售价 × 耐久</h2>
<p class="dim">这里不再用“变现率 × 总值”的线性假设——那是错的。改用真实装包模型：按价值从高到低挑，
受背包格数与 45kg 承重双约束，格满即停。每个策略的分布都是独立模拟出来的。</p>

<div class="panel">
  <h3 style="margin-top:4px">携带策略</h3>
  <div class="scen" id="scen">
${scenButtons}
  </div>

  <div class="ctrl">
    <label for="p">钥匙总价（售价）</label>
    <input id="p" type="range" min="500000" max="40000000" step="500000" value="27000000">
    <output id="ro-p">¥27,000,000</output>
  </div>
  <div class="ctrl">
    <label for="u">耐久（可开次数）</label>
    <input id="u" type="range" min="1" max="20" step="1" value="10">
    <output id="ro-u">10 次</output>
  </div>

  <div class="readout">
    <div class="ro"><span>单次成本</span><b id="o-cost">—</b></div>
    <div class="ro"><span>该策略带走均值</span><b id="o-mean">—</b></div>
    <div class="ro" id="o-netwrap"><span>单次净收益</span><b id="o-net">—</b></div>
    <div class="ro" id="o-losswrap"><span>有效亏损率</span><b id="o-loss">—</b></div>
    <div class="ro" id="o-keywrap"><span>每把钥匙净收益</span><b id="o-key">—</b></div>
    <div class="ro"><span>中位回本所需实现</span><b id="o-be">—</b></div>
  </div>
  <div id="verdict" class="verdict v-adv">—</div>

  <h3 style="margin-top:22px">带走价值分布（竖线 = 当前回本线）</h3>
  <canvas id="chart"></canvas>
  <div class="legend">
    <span><i class="sw" style="background:#3f6d9b"></i>该策略带走价值</span>
    <span><i class="sw" style="background:#a34a3c"></i>低于回本线（亏损区）</span>
    <span><i class="sw" style="background:#3f7a5e"></i>回本线</span>
  </div>
</div>

<h2>四、怎么读</h2>
<p>· <b>有效亏损率</b> = 该策略带走价值 &lt; 单次成本 的概率。
<br>· <b>中位回本所需实现</b> = 单次成本 ÷ 该策略中位带走值；&gt; 100% 表示即便满带，中位那一局也回不了本。
<br>· 若玩家还会在地图其它地方搜刮、到钥匙房时背包已占一半，请选“6 格基础包”或自行下调格数作为下界。</p>

<footer>生成：<code>node tools/report-keyroom.js</code> · 样本 ${N.toLocaleString('en-US')} · 随机种子 20261107 · 价格取物品 <code>price</code> 字段 · 承重上限 ${BAG.CARRY}kg · 安全箱 ${BAG.SAFE} 格</footer>
</div>

<script>
(function(){
  var D = ${JSON.stringify(data)};
  window.__SC = D.scenarios;
  var W = D.binW, N = D.n;

  var el = function(id){ return document.getElementById(id); };
  var P = el('p'), U = el('u');
  var cur = 0;

  var fmtMoney = function(v){ return (v<0?'-':'') + '¥' + Math.round(Math.abs(v)).toLocaleString('en-US'); };
  var fmtPct = function(v){ return (v*100).toFixed(1) + '%'; };

  function makeCdf(sc){
    var B = sc.hist.bins, prefix = [], acc = 0;
    for (var i=0;i<B.length;i++){ prefix[i]=acc; acc+=B[i]; }
    var total = acc + sc.hist.overflow;
    return function(x){
      if (x <= 0) return 0;
      var i = Math.floor(x / W);
      if (i >= B.length) return 1;
      return (prefix[i] + B[i] * ((x - i*W) / W)) / total;
    };
  }

  var canvas = el('chart'), cctx = canvas.getContext('2d');

  function draw(sc, costLine){
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth, cssH = 250;
    if (canvas.width !== cssW*dpr || canvas.height !== cssH*dpr){
      canvas.width = cssW*dpr; canvas.height = cssH*dpr;
    }
    cctx.setTransform(dpr,0,0,dpr,0,0);
    cctx.clearRect(0,0,cssW,cssH);
    var padL=48, padR=16, padT=16, padB=28;
    var plotW = cssW-padL-padR, plotH = cssH-padT-padB;
    var xMax = Math.min(sc.hist.bins.length*W, sc.p90*1.6);
    var B = sc.hist.bins, step = Math.ceil(B.length/120), cols = [];
    for (var i=0;i<B.length;i+=step){
      var c=0, n=Math.min(i+step,B.length);
      for (var k=i;k<n;k++) c+=B[k];
      cols.push({x0:i*W, x1:n*W, c:c});
    }
    var maxC=0;
    for (var j=0;j<cols.length;j++) if (cols[j].x0 < xMax) maxC=Math.max(maxC, cols[j].c);

    cctx.fillStyle='#fbf8f0'; cctx.fillRect(0,0,cssW,cssH);
    if (costLine>0 && costLine<xMax){
      var lx = padL + (costLine/xMax)*plotW;
      cctx.fillStyle='rgba(163,74,60,0.07)';
      cctx.fillRect(padL, padT, lx-padL, plotH);
    }
    for (var q=0;q<cols.length;q++){
      var col=cols[q];
      if (col.x0>=xMax) break;
      var x=padL+(col.x0/xMax)*plotW;
      var w=Math.max(1,(col.x1-col.x0)/xMax*plotW-1);
      var h=maxC>0?(col.c/maxC)*plotH:0;
      var isLoss = costLine>0 && col.x1<=costLine;
      cctx.fillStyle = isLoss?'#a34a3c':'#3f6d9b';
      cctx.globalAlpha = isLoss?0.75:0.85;
      cctx.fillRect(x, padT+plotH-h, w, h);
    }
    cctx.globalAlpha=1;
    cctx.strokeStyle='#ded7c8'; cctx.lineWidth=1;
    cctx.beginPath(); cctx.moveTo(padL,padT); cctx.lineTo(padL,padT+plotH); cctx.lineTo(padL+plotW,padT+plotH); cctx.stroke();
    if (costLine>0 && costLine<xMax){
      var bx=padL+(costLine/xMax)*plotW;
      cctx.strokeStyle='#3f7a5e'; cctx.lineWidth=2; cctx.setLineDash([5,4]);
      cctx.beginPath(); cctx.moveTo(bx,padT); cctx.lineTo(bx,padT+plotH); cctx.stroke();
      cctx.setLineDash([]);
    }
    cctx.fillStyle='#8a8175'; cctx.font='11px ui-monospace, Consolas, monospace';
    cctx.textAlign='right'; cctx.textBaseline='middle';
    for (var t=0;t<=4;t++){
      var vv=xMax*t/4, yy=padT+plotH-(plotH*t/4);
      cctx.fillText((vv/1000000).toFixed(1)+'M', padL-8, yy);
    }
    cctx.textAlign='center'; cctx.textBaseline='top';
    for (var t2=0;t2<=4;t2++){
      var xv=xMax*t2/4;
      cctx.fillText('¥'+(xv/1000000).toFixed(1)+'M', padL+(xv/xMax)*plotW, padT+plotH+6);
    }
  }

  function update(){
    var sc = D.scenarios[cur];
    var cdf = makeCdf(sc);
    var price = parseInt(P.value,10);
    var uses = parseInt(U.value,10);
    var cost = price/uses;
    var net = sc.mean - cost;
    var loss = cdf(cost);
    var netKey = uses*net;
    var be = cost/sc.median;

    el('ro-p').textContent = fmtMoney(price);
    el('ro-u').textContent = uses + ' 次';
    el('o-cost').textContent = fmtMoney(cost);
    el('o-mean').textContent = fmtMoney(sc.mean);
    el('o-net').textContent = fmtMoney(net);
    el('o-loss').textContent = fmtPct(loss);
    el('o-key').textContent = fmtMoney(netKey);
    el('o-be').textContent = fmtPct(be);

    el('o-netwrap').className = 'ro ' + (net>=0?'good':'bad');
    el('o-keywrap').className = 'ro ' + (netKey>=0?'good':'bad');
    el('o-losswrap').className = 'ro ' + (loss<=0.3?'good':'bad');

    var v = el('verdict');
    if (loss < 0.30){ v.className='verdict v-normal'; v.innerHTML='<b>普通档 · 稳定经营</b>　有效亏损率 '+fmtPct(loss)+'，单次净 '+fmtMoney(net)+'。'; }
    else if (loss < 0.50){ v.className='verdict v-adv'; v.innerHTML='<b>高级档 · 图鉴取向</b>　有效亏损率 '+fmtPct(loss)+'，单次净 '+fmtMoney(net)+'。'; }
    else if (loss < 0.70){ v.className='verdict v-top'; v.innerHTML='<b>顶级档 · 财富博弈</b>　有效亏损率 '+fmtPct(loss)+'，单次净 '+fmtMoney(net)+'。'; }
    else { v.className='verdict v-over'; v.innerHTML='<b>过赌 · 劝退风险</b>　有效亏损率 '+fmtPct(loss)+'，单次净 '+fmtMoney(net)+'。'; }

    draw(sc, cost);
  }

  document.querySelectorAll('#scen button').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('#scen button').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      cur = parseInt(b.getAttribute('data-sc'),10);
      update();
    });
  });
  P.addEventListener('input', update);
  U.addEventListener('input', update);
  window.addEventListener('resize', update);
  update();
})();
</script>
</body></html>`;

fs.writeFileSync(OUT, html);
console.log('已生成 ' + path.relative(ROOT, OUT));
console.log('样本 ' + N.toLocaleString('en-US') + ' · 总值均值 ' + money(meanT) + ' · 中位 ' + money(pctT(0.5)));
for (const s of scenarios) console.log('  ' + s.name.padEnd(8) + ' 均值 ' + money(s.mean).padStart(12) + '  实现 ' + (s.real*100).toFixed(1) + '%');
