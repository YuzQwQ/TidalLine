/* 七类调色板：把已有字段映射成界面分组，不改数据。
 * M2 起每个条目可以带 paint 载荷——点它就"拿起这个材质"，画笔/放置用的就是它。
 * 不带的（结构 / 交互 / 区域）只做高亮，因为它们不是刷出来的。
 * 容器按**类型**列而不是按品质分组：编辑器要放的是类型，品质只是它的属性色。 */
(function (root) {
  'use strict';
  const Library=root.SceneLibrary||{grounds:[],decals:[]};

  const QUALITY = {
    junk: { name: '垃圾', color: '#8b8f7a', order: 0 },
    plain: { name: '普通', color: '#6f8f6a', order: 1 },
    ample: { name: '充裕', color: '#5f8fa8', order: 2 },
    fine: { name: '精良', color: '#5a7fbf', order: 3 },
    rich: { name: '贵重', color: '#b08a3e', order: 4 },
    secret: { name: '机密', color: '#8a5fa8', order: 5 }
  };
  const ENEMY = {
    scav: { name: '拾荒者', color: '#b96a36', glyph: 'S' },
    echo: { name: '回响体', color: '#855da3', glyph: 'E' },
    guard: { name: '潮汐守卫', color: '#3e789c', glyph: 'G' },
    holdout: { name: '据点看守', color: '#b8a26b', glyph: 'H' },
    retriever: { name: '受雇回收员', color: '#7c9684', glyph: 'R' }
  };
  const ITEM_COLOR = {
    ground: '#7aa38a', structure: '#6b7f8a', container: '#a07a4a',
    prop: '#8a6f9a', interact: '#3e8a7a', enemy: '#b04f3a', region: '#c2a24a'
  };

  function countChar(rows, ch) {
    let n = 0;
    for (const row of rows) for (const c of row) if (c === ch) n++;
    return n;
  }

  const CATEGORIES = [
    {
      id: 'ground', name: '地面', hint: '地形字符', unit: '种', paintable: true,
      items(data) {
        const legend = { ...data.legend };
        for(const a of Library.grounds)if(!legend[a.ch])legend[a.ch]=a.rule;
        return Object.entries(legend).map(([ch, rule]) => ({
          key: ch, label: rule.name, art:rule.art||root.MapArtMap.TILE_ART[ch], count: countChar(data.rows, ch), swatch: rule.color,
          detail: ch + ' · ' + (rule.walkable ? '可通行' : '不可通行') + ' · ' + (rule.opaque ? '挡视线' : '可透视'),
          paint: { kind: 'terrain', ch, label: rule.name },
          match: e => e.kind === 'cell' && e.ch === ch
        }));
      }
    },
    {
      id: 'container', name: '容器', hint: '按类型放置', paintable: true,
      items(data) {
        const types = Object.keys(data.containerTypes);
        const stat = new Map(types.map(t => [t, { count: 0, prefs: new Set() }]));
        for (const c of data.containers) {
          const s = stat.get(c.type);
          if (!s) continue;
          s.count++;
          if (Array.isArray(c.preference)) s.prefs.add(c.preference.join(','));
        }
        return types
          .map(t => {
            const type = data.containerTypes[t] || {};
            const q = QUALITY[type.q] || QUALITY.plain;
            const s = stat.get(t);
            return {
              key: 'type.' + t, label: type.name || t, count: s.count, swatch: q.color,
              order: q.order * 1000 - s.count,
              detail: q.name + ' · 代号 ' + t + (s.prefs.size ? ' · 偏好 ' + [...s.prefs].join(' / ') : ''),
              paint: { kind: 'container', type: t, label: type.name || t },
              match: e => e.kind === 'container' && e.ref.type === t
            };
          })
          .sort((a, b) => a.order - b.order);
      }
    },
    {
      id: 'prop', name: '装饰', hint: '家具与摆设', paintable: true,
      /* 这一组以**素材库**为准，不以地图为准。
       * 以前是从 data.props 反推类型，结果"图上放过的才看得见"：
       * 诊所的诊疗床被归到通用「床」、银行柜台被归到通用「柜台」，
       * 新画好的家具（bed_clinic / counter_bank…）在地图上没出现过就永远放不出来。
       * 现在遍历 SceneLibrary.placeables（每一条都在登记表里声明了 footprint），
       * 只把"图上有、但素材库没登记"的旧类型补在后面，保证没有选不中的东西。 */
      items(data) {
        const Art = root.MapArtMap;
        const resolve = p => (Art && Art.resolvePropArt ? Art.resolvePropArt(p) : (p.art || p.type));
        const used = new Map();          // 贴图基名 → 件数
        const usedFoot = new Map();      // 贴图基名 → 出现过的占地
        for (const p of data.props) {
          const art = resolve(p);
          used.set(art, (used.get(art) || 0) + 1);
          const s = usedFoot.get(art) || new Set();
          s.add((p.footprint || [1, 1]).join('×'));
          usedFoot.set(art, s);
        }

        const out = [];
        const placeables = [...(Library.placeables || []), ...(Library.decals || [])];
        for (const a of placeables) {
          const paint = a.paint;
          const isDecal = paint.ground === true;
          const foot = paint.footprint || [1, 1];
          const next = {
            key: 'prop.' + a.id, label: a.name, art: a.id,
            count: used.get(a.id) || 0,
            swatch: ITEM_COLOR.prop,
            detail: isDecal
              ? a.id + ' · 透明贴花 · 可通行 · 不挡视线'
              : a.id + ' · 占地 ' + foot.join('×') +
                (usedFoot.has(a.id) ? ' · 图上 ' + [...usedFoot.get(a.id)].join(' / ') : ' · 本图未使用'),
            /* 原样带上 paint：footprint、碰撞格、树冠参数都要跟着放下去，
               否则摆一棵树会变成 3×3 的实心方块。 */
            paint: Object.assign({}, paint, { kind: 'prop', type: paint.type, footprint: foot.slice() }),
            match: e => e.kind === 'prop' && (e.ref.type === a.id || resolve(e.ref) === a.id)
          };
          out.push(next);
        }

        /* 兜底：图上在用、但素材库没登记的老类型（历史家具）。不补的话点不中、也改不了。 */
        const known = new Set(out.map(i => i.paint.type));
        for (const p of data.props) {
          const art = resolve(p);
          if (known.has(art) || known.has(p.type)) continue;
          known.add(art); known.add(p.type);
          const foots = [...(usedFoot.get(art) || new Set(['1×1']))];
          out.push({
            key: 'prop.' + p.type, label: p.name || p.type, swatch: ITEM_COLOR.prop,
            count: used.get(art) || 0,
            detail: p.type + ' → ' + art + ' · 占地 ' + foots.join(' / ') + ' · 未登记到素材库',
            paint: { kind: 'prop', type: p.type, label: p.name || p.type, footprint: foots[0].split('×').map(Number) },
            match: e => e.kind === 'prop' && resolve(e.ref) === art
          });
        }
        return out.sort((a, b) => {
          /* 有图的排前面，再用占地格数把"大件"排上去，最后按名字 */
          if (!a.art !== !b.art) return a.art ? -1 : 1;
          const area = i => (i.paint.footprint || [1, 1]).reduce((x, y) => x * y, 1);
          return (b.art ? area(b) - area(a) : 0) || a.label.localeCompare(b.label, 'zh');
        });
      }
    },
    {
      id: 'enemy', name: '敌人', hint: '类型与巡逻', paintable: true,
      items(data) {
        return Object.keys(ENEMY).map(t => ({
          key: 'enemy.' + t, label: ENEMY[t].name,
          count: data.enemies.filter(e => e.type === t).length,
          swatch: ENEMY[t].color,
          detail: '巡逻半径默认 2 格',
          paint: { kind: 'enemy', type: t, label: ENEMY[t].name },
          match: e => e.kind === 'enemy' && e.ref.type === t
        }));
      }
    },
    {
      id: 'structure', name: '结构', hint: '门 / 窗 / 桥 / 净宽', paintable: false,
      items(data) {
        const out = [];
        const byKind = {};
        for (const p of data.portals) (byKind[p.kind] = byKind[p.kind] || []).push(p);
        for (const [kind, list] of Object.entries(byKind)) {
          out.push({
            key: 'portal.' + kind, label: kind === 'door' ? '门洞' : kind === 'breach' ? '破口' : kind,
            count: list.length, swatch: kind === 'breach' ? '#b0402f' : '#6b7f8a',
            detail: '点墙开一个洞口；两侧空间自动推断，可在检查器里改名与类型',
            /* 门可以放：点在墙上就开一扇，两侧空间自动推断。桥与净宽仍只读 */
            paint: { kind: 'portal', portalKind: kind, label: kind === 'door' ? '门洞' : '破口' },
            match: e => e.kind === 'portal' && e.ref.kind === kind
          });
        }
        out.push({ key: 'window', label: '橱窗', count: data.windows.length, swatch: '#4a929c', match: e => e.kind === 'window' });
        out.push({ key: 'bridge', label: '桥', count: data.bridges.length, swatch: '#b2a07f', match: e => e.kind === 'bridge' });
        out.push({ key: 'clearance', label: '净宽区', count: data.clearances.length, swatch: '#9aa8a0', match: e => e.kind === 'clearance' });
        return out;
      }
    },
    {
      id: 'interact', name: '交互', hint: '出生 / 撤离 / 路线', paintable: true,
      items(data) {
        return [
          { key: 'spawn', label: '出生点', count: 1, swatch: '#2f8f6a', match: e => e.kind === 'spawn' },
          {
            key: 'exit', label: '撤离点', count: data.exits.length, swatch: '#2f8f9a',
            detail: '点空地新增一个撤离点；每局随机挑一个当入场点并封闭，必须去别的撤离点撤离',
            paint: { kind: 'exit', label: '撤离点' },
            match: e => e.kind === 'exit'
          },
          { key: 'route', label: '推荐路线', count: data.routeSpecs.length, swatch: '#21937b', match: e => e.kind === 'route' },
          { key: 'room', label: '房间锚点', count: data.rooms.length, swatch: '#c2a24a', match: e => e.kind === 'room' }
        ];
      }
    },
    {
      id: 'region', name: '区域', hint: '建筑与室外', paintable: false,
      items(data) {
        const out = data.buildings.map(b => ({
          key: 'region.' + b.id, label: b.name, count: data.containers.filter(c => c.region === b.id).length,
          detail: '容器数', swatch: ITEM_COLOR.region,
          match: e => e.kind === 'region' && e.ref === b.id
        }));
        out.push({
          key: 'region.outdoors', label: '室外', count: data.containers.filter(c => c.region === 'outdoors').length,
          detail: '容器数', swatch: '#9aa8a0', match: e => e.kind === 'region' && e.ref === 'outdoors'
        });
        return out;
      }
    }
  ];

  root.EditorPalette = { CATEGORIES, QUALITY, ENEMY, ITEM_COLOR };
})(window);
