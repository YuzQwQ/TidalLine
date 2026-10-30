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
    guard: { name: '潮汐守卫', color: '#3e789c', glyph: 'G' }
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
      items(data) {
        const byType = new Map();
        for (const p of data.props) {
          const s = byType.get(p.type) || { count: 0, names: new Set(), foot: new Set() };
          s.count++;
          if (p.name) s.names.add(p.name);
          s.foot.add((p.footprint || [1, 1]).join('×'));
          byType.set(p.type, s);
        }
        const out = [...byType.entries()].map(([type, s]) => ({
          key: 'prop.' + type, label: [...s.names][0] || type, count: s.count, swatch: ITEM_COLOR.prop,
          detail: type + ' · 占地 ' + [...s.foot].join(' / '),
          paint: { kind: 'prop', type, label: [...s.names][0] || type },
          match: e => e.kind === 'prop' && e.ref.type === type
        }));
        /* 新图里一件家具都没有，类型无从推导；补上目录里的标准家具，否则放不出东西。
         * 已用到的类型在前，未使用的排在后面并标 0。 */
        const catalog = (root.MapTemplates && root.MapTemplates.PROP_CATALOG) || [];
        for (const c of catalog) {
          if (byType.has(c.type)) continue;
          out.push({
            key: 'prop.' + c.type, label: c.name, count: 0, swatch: ITEM_COLOR.prop,
            detail: c.type + ' · 占地 ' + c.footprint.join('×') + ' · 本图未使用',
            paint: { kind: 'prop', type: c.type, label: c.name, name: c.name, footprint: c.footprint.slice() },
            match: e => e.kind === 'prop' && e.ref.type === c.type
          });
        }
        for(const a of Library.placeables||Library.decals)if(!byType.has(a.id))out.push({
          key:'prop.'+a.id,label:a.name,art:a.id,count:0,swatch:ITEM_COLOR.prop,
          detail:a.paint.ground?'透明地面贴花 · 可通行 · 不挡视线':'场景物件 · 占地 '+a.paint.footprint.join('×'),paint:a.paint,
          match:e=>e.kind==='prop'&&e.ref.type===a.id
        });
        for(const item of out){const a=Library.decals.find(a=>'prop.'+a.id===item.key);if(a){item.art=a.id;item.paint=a.paint;item.detail='透明地面贴花 · 可通行 · 不挡视线';}}
        return out;
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
      id: 'interact', name: '交互', hint: '出生 / 撤离 / 路线', paintable: false,
      items(data) {
        return [
          { key: 'spawn', label: '出生点', count: 1, swatch: '#2f8f6a', match: e => e.kind === 'spawn' },
          { key: 'exit', label: '撤离点', count: data.exits.length, swatch: '#2f8f9a', match: e => e.kind === 'exit' },
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
