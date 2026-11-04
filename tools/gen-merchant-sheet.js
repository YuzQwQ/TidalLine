/* 生成根目录「商人档案.html」：四位商人的设定、背景、职责与全部台词。
   数据只有一个来源，页面不手写内容：
     design/merchants/design-v1.json      三位商人的设定稿（身份/背景/性格/等级/任务/设定台词）
     js/merchant-config.js                运行时商店配置与语音池（MERCHANT_UI_CONFIG / MERCHANT_DIALOGUE）
     js/safehouse-config.js               藏身处里的姓名、职业与招牌台词
     js/sales.js                          收购偏好（MERCHANT_BUYBACK）
     js/trader.js                         贸易商固定货架（MERCHANT_INVENTORY）
     js/data.js                           货架物品名称
     design/merchants/STORY_LINKS_V1.md   四人共享的"夜间转运"暗线（表格为手工摘要）
   用法：node tools/gen-merchant-sheet.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '¥' + Number(n || 0).toLocaleString('en-US');

/* ---------- 数据 ---------- */
function loadContext(files, expr) {
  const ctx = vm.createContext({ console, performance });
  for (const f of files) vm.runInContext(read(f), ctx);
  return vm.runInContext(expr, ctx);
}
const design = JSON.parse(read('design/merchants/design-v1.json'));
const { cfg: UI, dlg: DIALOGUE } = loadContext(['js/merchant-config.js'], '({cfg:MERCHANT_UI_CONFIG,dlg:MERCHANT_DIALOGUE})');
const SAFE = loadContext(['js/safehouse-config.js'], 'SAFEHOUSE_CONFIG');
const BUYBACK = loadContext(['js/sales.js'], 'MERCHANT_BUYBACK');
const INVENTORY = loadContext(['js/trader.js'], 'MERCHANT_INVENTORY');
const ITEM = loadContext(['js/config.js', 'js/data.js', 'js/common.js'], 'ITEM_BY_ID');

/* BRIEF_V1.md 的"关键人物弧光"三行，设定稿 JSON 里没有，这里单独摘出（改了设定记得同步）。 */
const ARC = {
  shop: ['可靠、专业，像个精明的供应商', '逐渐显露她对资源分配的冷酷逻辑', '理解她并非嗜血，只是把"秩序"放得比"仁慈"高'],
  gun: ['专业、有趣，看起来很可靠', '发现他在拿别人测试风险的边界', '理解他并非杀戮狂，只是把生命的成本过度工具化'],
  doctor: ['温和、可靠，像真正的医生', '发现她隐藏了大量异常病例资料', '理解她的执念与痛苦，并面对"救人是否该有边界"'],
  viktor: null
};

/* 端口 key → 立绘 / 设计稿 id */
const KEYS = ['viktor', 'shop', 'gun', 'doctor'];
const PORTRAIT = {
  viktor: 'assets/ui/safehouse/merchant_viktor.webp',
  shop: 'assets/ui/safehouse/merchant_armor.webp',
  gun: 'assets/ui/safehouse/merchant_guns.webp',
  doctor: 'assets/ui/safehouse/merchant_doctor.webp'
};
const DESIGN_ID = { shop: 'merchant_armor', gun: 'merchant_guns', doctor: 'merchant_doctor' };

/* 运行时语音池：键 → 场景名与触发时机（按 js/merchant-dialogue.js 的实现） */
const RUNTIME_SCENES = [
  { key: 'greeting', label: '进入商店', when: '每次打开商人界面随机一条，避开上一次说过的那句', wired: true },
  { key: 'idle', label: '站桩闲置', when: '界面停留 45 秒无操作，之后每 90 秒一条', wired: true },
  { key: 'purchase', label: '成交之后', when: '扣款成功的瞬间播报', wired: true },
  { key: 'procurement', label: '改枪结算', when: '改枪结算页的供应商引言；不进随机语音', wired: true },
  { key: 'beforeTreatment', label: '治疗开单前', when: '诊台结账页上的引言（静态展示）', wired: true },
  { key: 'afterTreatment', label: '治疗付款后', when: '治疗扣款成功后追加到血量卡片下方', wired: true },
  { key: 'reserved.sell', label: '收购 · 交出货', when: '贸易商对高价回收的反应', wired: false },
  { key: 'reserved.priceUp', label: '收购 · 行情上涨', when: '贸易商对涨价物品的反应', wired: false },
  { key: 'reserved.priceDown', label: '收购 · 行情下跌', when: '贸易商对跌价物品的反应', wired: false }
];

/* 设定稿里的八个对话节点（design-v1.json characters[].dialogue） */
const DESIGN_SCENES = [
  ['initial', '初识'], ['purchase', '普通购买'], ['lowTrust', '低信任'], ['midTrust', '中信任'],
  ['highTrust', '高信任'], ['questAccept', '接取委托'], ['questComplete', '完成委托'], ['keyStory', '关键剧情']
];

const lines = arr => (Array.isArray(arr) ? arr : arr ? [arr] : []);

function runtimeBlocks(key) {
  const pool = DIALOGUE[key] || {};
  const out = [];
  for (const scene of RUNTIME_SCENES) {
    let value;
    if (scene.key.startsWith('reserved.')) value = pool.reserved?.[scene.key.slice(9)];
    else value = pool[scene.key];
    const list = lines(value).filter(Boolean);
    if (!list.length) continue;
    out.push({ ...scene, list });
  }
  return out;
}

const items = {};
for (const m of ['viktor']) {
  const inv = INVENTORY[m];
  if (!inv) continue;
  items[m] = {
    multiplier: inv.priceMultiplier,
    rows: inv.items.map(id => ITEM[id]).filter(Boolean)
  };
}

const merchants = KEYS.map(key => {
  const ui = UI[key] || {};
  const safe = SAFE.merchants[key] || {};
  const designChar = design.characters.find(c => c.id === DESIGN_ID[key]) || null;
  const quests = designChar ? designChar.quests.map(id => design.quests.find(q => q.id === id)).filter(Boolean) : [];
  const products = designChar ? design.products.filter(p => p.merchantId === designChar.id) : [];
  const byLevel = {};
  for (const p of products) (byLevel[p.trustLevel] = byLevel[p.trustLevel] || []).push(p);
  return {
    key, ui, safe, design: designChar, quests, products, byLevel,
    name: safe.name || ui.label || key,
    en: ui.english || '',
    tag: ui.tag || '',
    roleLine: safe.role || '',
    quote: safe.quote || '',
    portrait: PORTRAIT[key],
    runtime: runtimeBlocks(key),
    designDialogue: designChar ? designChar.dialogue : null,
    buyback: BUYBACK[key] || null,
    shelf: items[key] || null,
    arc: ARC[key]
  };
});

const totalRuntime = m => m.runtime.reduce((n, s) => n + s.list.length, 0);
const totalDesign = m => (m.designDialogue ? DESIGN_SCENES.filter(([k]) => m.designDialogue[k]).length : 0);
const totalQuests = m => m.quests.length;

/* ---------- 片段 ---------- */
function quoteList(list) {
  return list.map(t => `<p class="q">“${esc(t)}”</p>`).join('');
}

function runtimeTable(m) {
  if (!m.runtime.length) {
    return `<p class="empty"><code>MERCHANT_DIALOGUE</code> 里没有 <code>${esc(m.key)}</code> 这一组键——她是商人界面默认打开的那位，进店却一句台词都不会说。其余三人都有独立语音池。</p>`;
  }
  return `<div class="lines">${m.runtime.map(s => `
    <section class="line-row${s.wired ? '' : ' unwired'}">
      <div class="line-head"><b>${esc(s.label)}</b><small>${esc(s.when)}</small>${s.wired ? '' : '<i class="badge warn">已写未接线</i>'}<i class="badge">${s.list.length} 条</i></div>
      <div class="line-body">${quoteList(s.list)}</div>
    </section>`).join('')}</div>`;
}

function designTable(m) {
  if (!m.designDialogue) {
    return `<p class="empty">这位商人还没有设定稿台词。当前只在 <code>MERCHANT_DIALOGUE</code> 里有 ${totalRuntime(m)} 条运行时语音，八节点（初识／购买／低中高信任／接取／完成／关键剧情）全部空缺。</p>`;
  }
  return `<div class="lines">${DESIGN_SCENES.map(([k, label]) => {
    const text = m.designDialogue[k];
    if (!text) return '';
    return `<section class="line-row"><div class="line-head"><b>${esc(label)}</b><small>设定稿 · 尚未接入运行时</small><i class="badge design">设计</i></div>
      <div class="line-body">${quoteList(lines(text))}</div></section>`;
  }).join('')}</div>`;
}

function levelTable(m) {
  if (!m.design) return `<p class="empty">信任等级未设计：当前没有信誉、交易额和任务门槛，货架固定开放。</p>`;
  return `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>等级</th><th>信誉</th><th>累计交易额</th><th>关键任务</th><th>价格系数</th></tr></thead>
    <tbody>${m.design.levels.map(lv => `<tr>
      <td><b>Lv.${lv.level} ${esc(lv.name)}</b></td>
      <td>${lv.minReputation}</td>
      <td>${money(lv.minTrade)}</td>
      <td>${lv.requiredFlags.length ? lv.requiredFlags.map(f => {
        const q = design.quests.find(x => f.startsWith(x.id));
        return esc(q ? q.title : f);
      }).join('<br>') : '<span class="dim">无</span>'}</td>
      <td>${lv.priceMultiplier === 1 ? '1.00' : lv.priceMultiplier.toFixed(2)}</td>
    </tr>`).join('')}</tbody></table></div>
    <p class="foot-note">晋级三项同时满足：信誉 + 累计有效交易额 + 关键任务标记。数值为设计建议，未实装。</p>`;
}

function stockTable(m) {
  if (!m.design) {
    const s = m.shelf;
    if (!s) return '<p class="empty">货架未配置。</p>';
    const cats = [...new Set(s.rows.map(i => i.cat))];
    return `<p>固定货架：${s.rows.length} 件白至紫收集品，售价为参考价值的 <b>${Math.round(s.multiplier * 100)}%</b>，买下直接进仓库。没有等级、限购或信任门槛。</p>
      <div class="chips">${cats.map(c => `<span class="chip">${esc(catName(c))} · ${s.rows.filter(i => i.cat === c).length}</span>`).join('')}</div>
      <details class="fold"><summary>展开 18 件在售清单</summary><div class="shelf">${s.rows.map(i => `<span class="shelf-item"><img src="assets/items/${i.id}.png" alt="" loading="lazy"><b>${esc(i.name)}</b><small>${money(i.price)}</small></span>`).join('')}</div></details>`;
  }
  const levels = [1, 2, 3, 4];
  return `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>等级</th><th>货架内容</th></tr></thead><tbody>
    ${levels.map(lv => {
      const rows = m.byLevel[lv] || [];
      if (!rows.length) return '';
      return `<tr><td><b>Lv.${lv}</b></td><td>${rows.map(p => `<span class="goods${p.status === 'existing' ? '' : ' placeholder'}">${esc(p.name)}${p.status === 'existing' ? '' : '<i>占位</i>'}</span>`).join('')}</td></tr>`;
    }).join('')}
    </tbody></table></div>
    <p class="foot-note">仅未来分级映射，当前货架不变。标「占位」的条目没有物品 ID，需等对应系统实装。</p>`;
}

function questCards(m) {
  if (!m.quests.length) return `<p class="empty">没有委托线。贸易商只做零售与收购，尚未设计任务、信任或剧情节点。</p>`;
  return `<div class="quests">${m.quests.map(q => `
    <article class="quest">
      <header><span class="phase">${esc(q.phase)}</span><i>最低 Lv.${q.minTrust}</i></header>
      <h4>${esc(q.title)} <code>${esc(q.id)}</code></h4>
      <p>${esc(q.objective)}</p>
      <dl class="facts">
        <div><dt>地点</dt><dd>${esc(q.location)}</dd></div>
        <div><dt>前置</dt><dd>${q.prerequisites.length ? q.prerequisites.map(esc).join('、') : '无'}</dd></div>
        <div><dt>依赖能力</dt><dd><code>${esc(q.requiresFeature || '—')}</code></dd></div>
        <div><dt>奖励</dt><dd>信誉 +${q.rewards.reputation} · ${money(q.rewards.credits)}</dd></div>
      </dl>
      <p class="story">人物信息：${esc(q.story)}</p>
      ${q.branch ? `<div class="branch">
        <p><b>合作路径</b>${esc(q.branch.cooperate.description)}<br><small>${esc(q.branch.cooperate.bonus)}</small></p>
        <p><b>替代路径</b>${esc(q.branch.alternative.description)}<br><small>${esc(q.branch.alternative.bonus)}</small></p>
        <p class="branch-note">两路核心信誉与解锁完全相同，都不会永久锁货。</p>
      </div>` : ''}
    </article>`).join('')}</div>`;
}

/* 收购白名单里的内部代码 → 中文，避免页面直接露出 collectible / attachment */
const ALLOW_LABEL = { gun: '枪械', melee: '近战', ammo: '弹药', attachment: '枪械配件', armor: '防具', bag: '背包', medical: '医疗品', collectible: '收集品（九类）' };

function catName(id) {
  const map = { life: '生活用品', elec: '电子产品', ind: '工业器材', collect: '文物藏品', med: '医疗收集品', antiq: '文物藏品', art: '文物藏品' };
  return map[id] || id;
}

function merchantView(m, idx) {
  const d = m.design || {};
  const meta = [
    ['姓名', m.name], ['英文名', m.en || '未定'], ['年龄', d.age ? d.age + ' 岁' : '未定'], ['性别', d.gender || '未定'],
    ['职业标签', m.tag || '未定'], ['阵营倾向', d.alignment || '未定']
  ];
  const dutyChips = (m.ui.categories || []).filter(([id]) => id !== 'all' && id !== 'planned').map(([, label]) => label);

  return `<section class="view" id="m-${m.key}" data-view="${m.key}" hidden>
  <div class="dossier">
    <figure class="portrait">
      <img src="${m.portrait}" alt="${esc(m.name)}" loading="lazy">
      <figcaption>${esc(m.en || 'PORTRAIT PENDING')}</figcaption>
    </figure>
    <div class="dossier-main">
      <div class="name-row"><h2>${esc(m.name)}</h2><span class="tagline">${esc(m.tag)}</span></div>
      <blockquote class="theme">${esc(d.theme || '主题句未定')}</blockquote>
      ${m.quote ? `<p class="shop-quote">柜台口头禅：「${esc(m.quote)}」</p>` : ''}
      <dl class="meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="role-line"><b>${esc(m.safe.role || m.tag)}</b>${m.ui.summary ? ' · ' + esc(m.ui.summary) : ''}</p>
      <nav class="anchor-nav" aria-label="章节跳转">
        <a href="#m-${m.key}" data-jump="identity">身份与职责</a>
        <a href="#m-${m.key}" data-jump="past">背景</a>
        <a href="#m-${m.key}" data-jump="persona">性格与矛盾</a>
        <a href="#m-${m.key}" data-jump="trust">信任成长</a>
        <a href="#m-${m.key}" data-jump="quests">委托线</a>
        <a href="#m-${m.key}" data-jump="lines">台词全集</a>
      </nav>
    </div>
  </div>

  <section class="block" id="m-${m.key}-identity">
    <h3><i>01</i>身份与职责</h3>
    <p class="para">${esc(d.publicIdentity || '公开身份未定。')}</p>
    <div class="cols">
      <div class="panel">
        <h4>售卖与经营</h4>
        <div class="chips">${dutyChips.length ? dutyChips.map(c => `<span class="chip">${esc(c)}</span>`).join('') : '<span class="dim">未配置分类</span>'}</div>
        <p class="mini">${esc(m.ui.notice || '')}</p>
      </div>
      <div class="panel">
        <h4>收购偏好</h4>
        <p class="mini">${esc(m.buyback?.label || '不收购')}</p>
        <p class="mini dim">可收类别：${(m.buyback?.allow || []).map(a => ALLOW_LABEL[a] || a).join('、') || '—'}</p>
      </div>
      <div class="panel">
        <h4>后续扩展</h4>
        <p class="mini">${esc(m.ui.future || '—')}</p>
      </div>
    </div>
  </section>

  <section class="block" id="m-${m.key}-past">
    <h3><i>02</i>背景与过去</h3>
    <p class="para">${esc(d.biography || '背景未定。这位商人的来历、灾前身份、与第一次潮汐的关系都还没有写。')}</p>
    ${m.arc ? `<ol class="arc">${m.arc.map((t, i) => `<li><b>${['前期', '中期', '后期'][i]}</b>${esc(t)}</li>`).join('')}</ol>` : '<p class="empty">人物弧光未设计。</p>'}
  </section>

  <section class="block" id="m-${m.key}-persona">
    <h3><i>03</i>性格与矛盾</h3>
    ${d.traits ? `<ul class="traits">${d.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="empty">性格条目未定。</p>'}
    <div class="cols three">
      <div class="panel"><h4>隐瞒</h4><p class="mini">${esc(d.concealment || '未定')}</p></div>
      <div class="panel"><h4>原则</h4><p class="mini">${esc(d.principle || '未定')}</p></div>
      <div class="panel"><h4>危险</h4><p class="mini">${esc(d.risk || '未定')}</p></div>
    </div>
    <div class="cols">
      <div class="panel"><h4>最看重</h4><p class="mini">${esc(d.preference || '未定')}</p></div>
      <div class="panel"><h4>高信任意味着</h4><p class="mini">${esc(d.trustMeaning || '未定')}</p></div>
    </div>
    ${d.appearance ? `<details class="fold"><summary>外形与立绘参考</summary><p class="mini">${esc(d.appearance)}</p><p class="mini dim">立绘：<code>${esc(m.portrait)}</code> · 要求见 <a href="design/merchants/BRIEF_V1.md">BRIEF_V1.md</a> 第七、八节</p></details>` : ''}
  </section>

  <section class="block" id="m-${m.key}-trust">
    <h3><i>04</i>信任成长</h3>
    ${levelTable(m)}
    <h4 class="sub">商品分级</h4>
    ${stockTable(m)}
  </section>

  <section class="block" id="m-${m.key}-quests">
    <h3><i>05</i>委托线 <em>${m.quests.length} 项 · 设计稿，未实装</em></h3>
    ${questCards(m)}
  </section>

  <section class="block" id="m-${m.key}-lines">
    <h3><i>06</i>台词全集 <em>运行 ${totalRuntime(m)} 条 · 设定稿 ${totalDesign(m)} 节点</em></h3>
    <h4 class="sub">运行时语音（游戏里真的会说）</h4>
    ${runtimeTable(m)}
    <h4 class="sub">设定稿台词（还没接进游戏）</h4>
    ${designTable(m)}
    ${m.quests.length ? `<p class="foot-note">委托的「人物信息」是叙述、不是台词，写在上面的任务卡里；任务完成/失败台词尚未撰写。</p>` : ''}
  </section>
</section>`;
}

/* ---------- 总览 ---------- */
const overviewRows = merchants.map(m => `<tr>
  <td><a href="#${m.key}"><b>${esc(m.name)}</b></a><br><small>${esc(m.en || '—')}</small></td>
  <td>${esc(m.tag || '—')}</td>
  <td>${esc((m.design?.theme) || '未定')}</td>
  <td>${esc(m.design?.alignment || '未定')}</td>
  <td>${esc(m.design?.preference || '未定')}</td>
  <td>${esc((m.ui.categories || []).filter(([id]) => !['all', 'planned'].includes(id)).map(([, l]) => l).join('、') || '—')}</td>
  <td>${totalRuntime(m)} / ${totalDesign(m)} / ${totalQuests(m)}</td>
</tr>`).join('');

const coverageRows = RUNTIME_SCENES.map(s => {
  const cells = merchants.map(m => {
    const hit = m.runtime.find(r => r.key === s.key);
    return `<td class="${hit ? '' : 'miss'}">${hit ? hit.list.length : '—'}</td>`;
  }).join('');
  return `<tr><td>${esc(s.label)}<br><small>${esc(s.when)}</small></td>${cells}<td>${s.wired ? '' : '<span class="badge warn">未接线</span>'}</td></tr>`;
}).join('');

const designCoverRows = DESIGN_SCENES.map(([k, label]) => {
  const cells = merchants.map(m => `<td class="${m.designDialogue?.[k] ? '' : 'miss'}">${m.designDialogue?.[k] ? '✓' : '—'}</td>`).join('');
  return `<tr><td>${esc(label)}</td>${cells}</tr>`;
}).join('');

const gapList = merchants.filter(m => !m.design).map(m => `
  <li><b>${esc(m.name)}</b>（${esc(m.tag)}）还没有设定稿：没有年龄、阵营、主题句、背景、性格、信任等级、委托线与八节点台词。
  目前只有藏身处里的姓名/职业/招牌台词、一张立绘（<code>${esc(m.portrait)}</code>）、固定货架（${m.shelf ? m.shelf.rows.length + ' 件，' + Math.round(m.shelf.multiplier * 100) + '% 溢价' : '未配置'}）和 ${totalRuntime(m)} 条运行时语音。
  收购反应台词 <code>reserved.*</code> 已写但代码里没有调用点。</li>`).join('');

const runtimeGaps = merchants.filter(m => !m.runtime.length).map(m =>
  `<li><b>${esc(m.name)}没有运行时语音</b>：<code>js/merchant-config.js</code> 的 <code>MERCHANT_DIALOGUE</code> 只有 <code>gun</code> / <code>doctor</code> / <code>viktor</code> 三组，缺 <code>shop</code>。
  她又正好是商人界面的默认页，所以进店、站桩、成交全程静默。补齐成本很低：照另外三人的结构写 greeting / idle / purchase 三组即可。</li>`).join('');

const unwired = '<li><code>procurement</code> 只在改枪结算页当引言用，<code>MerchantSpeech.say()</code> 明确跳过这个键，所以不会在随机语音里出现。</li>'
  + '<li><code>beforeTreatment</code> 是诊台结账页上的静态引言，不经过语音池。</li>'
  + '<li>贸易商的 <code>reserved.sell / priceUp / priceDown</code> 三条收购反应没有被任何代码调用。</li>';

const nightRows = [
  ['初识', '三条职业委托', '各自能供货且讲究交付', '为何如此重视部分旧记录'],
  ['熟客', '仓单／样枪日志／隔离记录', '记录存在修改或信息缺口', '谁作出修改、动机是什么'],
  ['合作者', '运输名单、试射说明、维持读数', '三人各自承担过职责，也有省略', '省略是否足以改变对其行为的评价'],
  ['关键分支', '完整原件与独立核对路径', '玩家可选择合作或提出异议', '真相的不同部分如何相互印证'],
  ['核心关系', '三份高信任补充材料', '各人的隐瞒与价值判断更明确', '不强行给出唯一统一叙述']
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>潮汐线 Wiki · 商人档案</title>
<style>
  .lede a, .foot a, .foot-note a { color: #7fb6a3; }
  .tabs { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px;
    max-width: 1240px; margin: 22px auto 0; padding: 12px 0; background: #0b1210; border-bottom: 1px solid #1a2a25; }
  .tabs button { font: inherit; font-size: 12.5px; letter-spacing: 1px; color: #8fa79f; cursor: pointer;
    background: #101a17; border: 1px solid #1f332c; padding: 8px 15px; }
  .tabs button:hover { border-color: #3a5c50; color: #cfe0da; }
  .tabs button.on { background: #1b332b; border-color: #4f8574; color: #e2f0ea; }
  .tabs .spacer { margin-left: auto; display: flex; gap: 8px; }
  .cards { max-width: 1240px; margin: 18px auto 0; display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); }
  .card { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding: 12px; text-align: left;
    background: #0f1916; border: 1px solid #1c2e28; border-left: 3px solid #2f5a4b; cursor: pointer; color: inherit; font: inherit; }
  .card:hover { border-color: #4f8574; background: #12201b; }
  .card img { width: 96px; height: 120px; object-fit: cover; object-position: top center; background: #0b1411; filter: saturate(.9); }
  .card h2 { margin: 2px 0 2px; font-size: 16px; letter-spacing: 1px; color: #e2ece8; }
  .card small { font-size: 10.5px; color: #5d817a; letter-spacing: .5px; }
  .card em { display: block; margin-top: 6px; font-style: normal; font-size: 11.5px; color: #9fb5ae; line-height: 1.7;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .card b.tag { display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 400; color: #c8b184;
    border: 1px solid #4a3f28; padding: 1px 5px; }

  .view[hidden] { display: none; }
  .dossier { max-width: 1240px; margin: 22px auto 0; display: grid; grid-template-columns: 240px 1fr; gap: 24px;
    background: #101a17; border: 1px solid #1c2e28; padding: 18px; }
  .portrait { margin: 0; }
  .portrait img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; object-position: top center; background: #0b1411; border: 1px solid #223a32; }
  .portrait figcaption { margin-top: 6px; font-size: 10px; letter-spacing: 2px; color: #4d7d70; }
  .name-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .name-row h2 { margin: 0; font-size: 26px; letter-spacing: 4px; color: #e6f1ec; font-weight: 600; }
  .tagline { font-size: 11px; letter-spacing: 1px; color: #c8b184; border: 1px solid #4a3f28; padding: 2px 7px; }
  .theme { margin: 12px 0 6px; padding-left: 14px; border-left: 2px solid #6b8f6b; font-size: 15px; color: #d6c79a; }
  .shop-quote { margin: 0 0 14px; font-size: 12px; color: #7d948c; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px 18px; margin: 0 0 12px; }
  .meta div { border-top: 1px solid #1a2a25; padding-top: 6px; }
  .meta dt { font-size: 10px; letter-spacing: 1px; color: #4d7d70; }
  .meta dd { margin: 3px 0 0; font-size: 12.5px; color: #cfdcd7; }
  .role-line { font-size: 12px; color: #8fa79f; margin: 0 0 10px; }
  .role-line b { color: #b9cac4; font-weight: 500; }
  .anchor-nav { display: flex; flex-wrap: wrap; gap: 6px; }
  .anchor-nav a { font-size: 11px; color: #8fa79f; text-decoration: none; border: 1px solid #223a32; padding: 3px 8px; }
  .anchor-nav a:hover { color: #dcf0e8; border-color: #4f8574; }

  .block { max-width: 1240px; margin: 26px auto 0; scroll-margin-top: 78px; }
  .block h3 { display: flex; align-items: center; gap: 10px; font-size: 14px; letter-spacing: 1px; color: #cfdcd7;
    margin: 0 0 14px; padding-bottom: 9px; border-bottom: 1px solid #1a2a25; }
  .block h3 i { font-style: normal; font-size: 11px; color: #4d7d70; letter-spacing: 2px; }
  .block h3 em { margin-left: auto; font-style: normal; font-size: 10.5px; color: #4d7d70; letter-spacing: 1px; }
  .block h4.sub { margin: 22px 0 10px; font-size: 12px; letter-spacing: 1px; color: #79a394; font-weight: 600; }
  .para { font-size: 13px; line-height: 2; color: #a9bdb6; margin: 0 0 14px; max-width: 980px; }
  .cols { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); margin-bottom: 12px; }
  .panel { background: #0f1916; border: 1px solid #1a2a25; padding: 12px 14px; }
  .panel h4 { margin: 0 0 8px; font-size: 11px; letter-spacing: 1px; color: #6fa093; font-weight: 600; }
  .mini { margin: 0 0 6px; font-size: 12px; line-height: 1.85; color: #93aaa2; }
  .mini:last-child { margin-bottom: 0; }
  .dim { color: #5d7a72; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
  .chip { font-size: 11px; color: #a8c4ba; background: #17241f; border: 1px solid #223a32; padding: 2px 7px; }
  .traits { margin: 0 0 14px; padding-left: 18px; font-size: 12.5px; line-height: 2; color: #a9bdb6; }
  .arc { margin: 6px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; max-width: 980px; }
  .arc li { display: grid; grid-template-columns: 44px 1fr; gap: 10px; font-size: 12.5px; color: #a9bdb6;
    background: #0f1916; border-left: 2px solid #2f5a4b; padding: 8px 12px; }
  .arc b { color: #79a394; font-weight: 500; }
  .fold { margin-top: 10px; background: #0f1916; border: 1px solid #1a2a25; padding: 10px 12px; }
  .fold summary { cursor: pointer; font-size: 11.5px; color: #7fb6a3; }
  .shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-top: 10px; }
  .shelf-item { display: grid; grid-template-columns: 32px 1fr; grid-template-rows: auto auto; gap: 0 8px; align-items: center;
    background: #0b1411; border: 1px solid #1a2a25; padding: 6px 8px; }
  .shelf-item img { grid-row: span 2; width: 32px; height: 32px; image-rendering: pixelated; }
  .shelf-item b { font-size: 11.5px; color: #cfdcd7; font-weight: 500; }
  .shelf-item small { font-size: 10.5px; color: #6f8d85; }

  .table-wrap { overflow: auto; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
  .tbl th, .tbl td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #1a2a25; vertical-align: top; }
  .tbl th { background: #121f1a; color: #79a394; font-weight: 600; font-size: 11px; letter-spacing: .5px; }
  .tbl td { color: #a9bdb6; }
  .tbl td.miss { color: #4b5f58; text-align: center; }
  .goods { display: inline-block; margin: 0 6px 6px 0; font-size: 11.5px; color: #a8c4ba; background: #131f1a; border: 1px solid #223a32; padding: 2px 6px; }
  .goods.placeholder { color: #8d8264; border-color: #3a3325; }
  .goods i { font-style: normal; font-size: 9px; margin-left: 4px; color: #8d8264; }
  .foot-note { font-size: 11px; color: #5d7a72; line-height: 1.8; margin: 8px 0 0; }

  .quests { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); }
  .quest { background: #0f1916; border: 1px solid #1a2a25; border-top: 2px solid #2f5a4b; padding: 14px; align-self: start; }
  .quest header { display: flex; justify-content: space-between; font-size: 10.5px; color: #6f8d85; letter-spacing: .5px; }
  .quest header .phase { color: #c8b184; }
  .quest h4 { margin: 6px 0 8px; font-size: 14px; color: #dce7e3; font-weight: 600; }
  .quest h4 code { font-size: 10px; }
  .quest p { font-size: 12px; line-height: 1.85; color: #9fb5ae; margin: 0 0 8px; }
  .facts { margin: 0 0 10px; display: grid; gap: 4px; }
  .facts div { display: grid; grid-template-columns: 68px 1fr; gap: 8px; font-size: 11.5px; }
  .facts dt { color: #4d7d70; }
  .facts dd { margin: 0; color: #a9bdb6; }
  .story { border-left: 2px solid #3f5c4d; padding-left: 10px; color: #b6a97f; }
  .branch { margin-top: 10px; background: #101c17; border: 1px dashed #27403a; padding: 10px; }
  .branch p { margin: 0 0 8px; }
  .branch p b { display: block; color: #79a394; font-size: 11px; letter-spacing: .5px; margin-bottom: 2px; }
  .branch small { color: #6f8d85; }
  .branch-note { color: #6f8d85 !important; font-size: 11px !important; }

  .lines { display: grid; gap: 8px; }
  .line-row { display: grid; grid-template-columns: 260px 1fr; gap: 14px; background: #0f1916; border: 1px solid #1a2a25; padding: 10px 12px; }
  .line-row.unwired { border-style: dashed; opacity: .82; }
  .line-head b { display: block; font-size: 12.5px; color: #cfdcd7; font-weight: 600; }
  .line-head small { display: block; font-size: 10.5px; color: #5d7a72; line-height: 1.7; margin-top: 3px; }
  .badge { display: inline-block; margin: 5px 5px 0 0; font-style: normal; font-size: 9px; color: #7fb6a3;
    border: 1px solid #2f5a4b; padding: 0 5px; }
  .badge.warn { color: #c8b184; border-color: #4a3f28; }
  .badge.design { color: #9a8ab5; border-color: #3d3350; }
  .line-body .q { margin: 0 0 4px; font-size: 13px; line-height: 1.9; color: #d6c79a; }
  .line-body .q:last-child { margin-bottom: 0; }
  .empty { font-size: 12px; color: #5d7a72; border: 1px dashed #24382f; padding: 12px 14px; margin: 0 0 12px; }

  .gaps { margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 2; color: #a9bdb6; }
  .gaps li { margin-bottom: 8px; }
  footer { max-width: 1240px; margin: 40px auto 0; padding-top: 14px; border-top: 1px solid #1a2a25;
    font-size: 11px; line-height: 2; color: #5d7a72; }
  footer code { font-size: 10.5px; }
  @media (max-width: 860px) {
    .dossier { grid-template-columns: 1fr; }
    .portrait img { max-height: 360px; }
    .line-row { grid-template-columns: 1fr; gap: 6px; }
    .card { grid-template-columns: 76px 1fr; }
    .card img { width: 76px; height: 96px; }
  }
</style>
</head>
<body>
<header>
  <div class="kicker">TIDELINE · MERCHANT DOSSIER</div>
  <h1>商人档案</h1>
  <div class="lede">
    四位商人的身份、背景、职责、成长与台词，集中在一页里核对文案。台词按「游戏里真的会说」和「设定稿里写好但还没接线」分开列，
    缺口直接标出来。<br>
    角色设定来源 <a href="design/merchants/BRIEF_V1.md">BRIEF_V1</a> 与 <a href="design/merchants/design-v1.json">design-v1.json</a>；
    运行时台词直接读 <code>js/merchant-config.js</code>，所以游戏里改了台词，重跑 <code>node tools/gen-merchant-sheet.js</code> 这页就会跟着变。
    设计评审入口：<a href="design/merchants/index.html">商人系统设计总览</a> · <a href="design/merchants/QUEST_LINES_V1.md">任务框架</a> · <a href="design/merchants/STOCK_UNLOCKS_V1.md">商品与限购</a> · <a href="design/merchants/STORY_LINKS_V1.md">剧情关系</a>
  </div>
</header>

<div class="cards">${merchants.map(m => `<a class="card" href="#${m.key}" data-open="${m.key}">
  <img src="${m.portrait}" alt="${esc(m.name)}" loading="lazy">
  <div><h2>${esc(m.name)}</h2><small>${esc(m.en || 'PORTRAIT PENDING')}</small>
  <b class="tag">${esc(m.tag || '未定')}</b><em>${esc(m.design?.theme || m.quote || '设定未定')}</em></div>
</a>`).join('')}</div>

<nav class="tabs" aria-label="商人与分节跳转">
  <button data-tab="overview" class="on">总览</button>
  ${merchants.map(m => `<button data-tab="${m.key}">${esc(m.name)}</button>`).join('')}
  <span class="spacer"><button data-tab="gaps">待补与缺口</button></span>
</nav>

<section class="view" id="m-overview" data-view="overview">
  <section class="block">
    <h3><i>00</i>四人对照</h3>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>商人</th><th>职业</th><th>主题句</th><th>阵营倾向</th><th>最看重</th><th>主营</th><th>台词<br>运行/设定/委托</th></tr></thead>
      <tbody>${overviewRows}</tbody></table></div>
    <p class="foot-note">台词列：游戏内语音条数 / 设定稿已完成节点数（共 8）/ 委托数量。三人的设计稿来自 design-v1.json，贸易商只有运行时配置。</p>
  </section>
  <section class="block">
    <h3><i>01</i>运行时台词覆盖</h3>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>场景</th>${merchants.map(m => `<th>${esc(m.name)}</th>`).join('')}<th>状态</th></tr></thead>
      <tbody>${coverageRows}</tbody></table></div>
    <p class="foot-note">数字是该场景的台词条数，“—”表示这个场景没有写。运行时的规则：同一场景不会连续说同一条。</p>
  </section>
  <section class="block">
    <h3><i>02</i>设定稿台词覆盖</h3>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>节点</th>${merchants.map(m => `<th>${esc(m.name)}</th>`).join('')}</tr></thead>
      <tbody>${designCoverRows}</tbody></table></div>
  </section>
  <section class="block">
    <h3><i>03</i>共享暗线 · 夜间转运</h3>
    <p class="para">三人的过去指向同一次夜间转运，但证据只建立弱关联：没有人完全说谎，也没有人说全。共享剧情不要求三人同时满级，也不当毕业门槛。</p>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>阶段</th><th>证据或节点</th><th>玩家可知</th><th>保留的疑问</th></tr></thead>
      <tbody>${nightRows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </section>
  <section class="block">
    <h3><i>04</i>待补与缺口</h3>
    <ul class="gaps">
      ${runtimeGaps}
      ${gapList}
      <li><b>三人共有的接线问题</b>：设定稿里的八节点台词（初识／低中高信任／接取／完成／关键剧情）只有 <code>design-v1.json</code> 里有，
      游戏内商店只跑 <code>MERCHANT_DIALOGUE</code> 的随机池，两套词还没合并。需要定：哪套作为正式口径，另一套是否保留为设计注释。</li>
      <li><b>委托台词</b>：六项委托只有「人物信息」一句叙述，接取、进行中、交付、失败、两条分支的结算台词都还没写。</li>
      <li><b>任务系统未实装</b>：<code>tasks</code> 在藏身处标记为 planned，六项委托的地点多为「拟新增／待设计」，不能当作现有地图已有设施。</li>
      <li><b>语音池现状</b>：${unwired}</li>
    </ul>
  </section>
</section>

${merchants.map(merchantView).join('\n')}

<section class="view" id="m-gaps" data-view="gaps" hidden>
  <section class="block">
    <h3><i>01</i>设定缺口</h3>
    <ul class="gaps">${runtimeGaps}${gapList || '<li>四位商人都已有设定稿。</li>'}</ul>
  </section>
  <section class="block">
    <h3><i>02</i>需要你拍板的几件事</h3>
    <ul class="gaps">
      <li><b>贸易商要不要写整份设定？</b>他目前是唯一没有信任等级与委托线的商人，也是唯一收购全部九类收集品的人。若保持“只做零售”，需要在文案上明确他为何不碰任务；若要补齐，参照另外三人 6 项委托的结构。</li>
      <li><b>两套台词怎么合？</b>设定稿八节点偏性格，运行时池偏营业口吻。建议：进店／闲置／成交用运行时池，剧情推进用八节点，接取与完成委托时插入对应节点台词。</li>
      <li><b>收购反应要不要接线？</b><code>reserved.*</code> 三条已写，但没有调用点；接上后成交出售时会有人味，代价是文案要覆盖更多物品类别。</li>
      <li><b>阈值与折扣</b>：Lv2/3/4 的信誉 25/60/85、交易额 30 万／120 万／300 万这一档，是设计建议，尚未按实际收益节奏校准。</li>
    </ul>
  </section>
</section>

<footer>
  由 <code>node tools/gen-merchant-sheet.js</code> 生成，请勿手改；改设定请改 <code>design/merchants/design-v1.json</code>、<code>js/merchant-config.js</code> 或 <code>js/safehouse-config.js</code> 后重跑。<br>
  运行时台词与商店配置同源，文案改完这里立刻能看到；设定稿部分标注“未实装”的内容不会出现在游戏里。
</footer>
<script>
(() => {
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const views = [...document.querySelectorAll('[data-view]')];
  const KEYS = ${JSON.stringify(merchants.map(m => m.key).concat(['overview', 'gaps']))};
  function show(key, scroll) {
    if (!KEYS.includes(key)) key = 'overview';
    for (const v of views) v.hidden = v.dataset.view !== key;
    for (const t of tabs) t.classList.toggle('on', t.dataset.tab === key);
    if (scroll) {
      /* 切到某位商人时把吸顶的标签栏顶到视口上方，免得还要手动划过首屏卡片。 */
      const bar = document.querySelector('.tabs');
      window.scrollTo(0, key === 'overview' ? 0 : Math.max(0, bar.offsetTop - 1));
    }
  }
  function fromHash() {
    const raw = decodeURIComponent(location.hash.slice(1));
    const key = raw.split('/')[0] || 'overview';
    const sub = raw.split('/')[1];
    show(key, true);
    if (sub) {
      const target = document.getElementById('m-' + key + '-' + sub);
      if (target) target.scrollIntoView({ block: 'start' });
    }
  }
  for (const t of tabs) t.addEventListener('click', () => { location.hash = t.dataset.tab; });
  for (const a of document.querySelectorAll('[data-jump]')) {
    a.addEventListener('click', e => { e.preventDefault(); location.hash = a.closest('[data-view]').dataset.view + '/' + a.dataset.jump; });
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
</script>
</body>
</html>
`;

/* 外壳（导航、wiki.css、main 容器）统一由 wiki-layout 提供，写文件时顺带刷新 wiki.html。 */
require('./wiki-layout').writeSheet('商人档案.html', html, 'merchants');
const counts = merchants.map(m => `${m.name} 运行${totalRuntime(m)}/设定${totalDesign(m)}/委托${totalQuests(m)}`).join(' · ');
console.log('已生成 商人档案.html：' + counts);
