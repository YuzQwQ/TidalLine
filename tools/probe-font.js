document.getElementById('startVeil').style.display = 'none';
const bag = document.getElementById('hudPanel');
if (bag) bag.style.display = 'none';

const text = '头盔护甲搜索撤离背包';
const root = document.createElement('div');
root.style.cssText =
  'position:fixed;left:0;top:0;right:0;bottom:0;background:#0b1210;z-index:99999;' +
  'padding:6px 8px;overflow:hidden;font:10px monospace;color:#5d7d73';
document.body.appendChild(root);

/* 与 js/pixfont.js 同一套算法：SS 倍栅格化 → 覆盖率降采样 → 二值化 */
function bitmapped(str, px, fam, thr, ss) {
  const pad = 4, GW = Math.ceil(px * str.length * 1.1) + pad * 2, GH = Math.round(px * 2.4) + pad * 2;
  const W = GW * ss, H = GH * ss;
  const src = document.createElement('canvas');
  src.width = W; src.height = H;
  const c = src.getContext('2d');
  c.font = px * ss + 'px "' + fam + '"';
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#fff';
  c.fillText(str, pad * ss, (px + pad) * ss);
  const d = c.getImageData(0, 0, W, H).data;

  const out = document.createElement('canvas');
  out.width = GW; out.height = GH;
  const oc = out.getContext('2d');
  const od = oc.createImageData(GW, GH);
  const lim = thr * ss * ss * 255;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      let sum = 0;
      for (let dy = 0; dy < ss; dy++) {
        const row = (y * ss + dy) * W;
        for (let dx = 0; dx < ss; dx++) sum += d[(row + x * ss + dx) * 4 + 3];
      }
      if (sum > lim) {
        const i = (y * GW + x) * 4;
        od.data[i] = 210; od.data[i + 1] = 235;
        od.data[i + 2] = 226; od.data[i + 3] = 255;
      }
    }
  }
  oc.putImageData(od, 0, 0);
  return out;
}

function row(label, px, thr, ss) {
  const cv = bitmapped(text, px, 'Microsoft YaHei', thr, ss);
  const zoom = 2;
  const shown = document.createElement('canvas');
  shown.width = cv.width * zoom;
  shown.height = cv.height * zoom;
  const sc = shown.getContext('2d');
  sc.imageSmoothingEnabled = false;
  sc.drawImage(cv, 0, 0, shown.width, shown.height);
  shown.style.cssText = 'display:block;background:#0f1a16;border:1px solid #1e312b';

  const line = document.createElement('div');
  line.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px';
  const tag = document.createElement('span');
  tag.style.cssText = 'width:150px;color:#7fb0a3;flex:0 0 auto;font-size:11px';
  tag.textContent = label;
  line.appendChild(tag);
  line.appendChild(shown);
  root.appendChild(line);
}

row('12px  直接栅格化', 12, 0.5, 1);
row('12px  2x 超采样', 12, 0.5, 2);
row('12px  3x 超采样', 12, 0.5, 3);
row('14px  2x 超采样', 14, 0.5, 2);
row('16px  2x 超采样', 16, 0.5, 2);
row('16px  3x 超采样', 16, 0.5, 3);
row('16px  3x 超采样 t=0.42', 16, 0.42, 3);
'ok';
