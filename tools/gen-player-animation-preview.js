/* 生成可暂停、调速的玩家动画预览页。 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/player-animation-prompts.json');
const dirs = { s: '正面 · 朝下', n: '背面 · 朝上', e: '右侧', w: '左侧 · 镜像' };
const rows = Object.entries(manifest.actions).map(([state, action]) => `<section><div class="heading"><b>${action.name}</b><span>${action.frames} 帧 · ${action.fps} fps · ${action.loop ? '循环' : '一次动作'}</span></div><div class="grid">${Object.entries(dirs).map(([dir, name]) => `<div class="card"><canvas width="192" height="192" data-state="${state}" data-dir="${dir}"></canvas><div>${name}</div><small></small></div>`).join('')}</div></section>`).join('');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>潮汐线 · 玩家动画</title>
<style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#0b1411;color:#c6d7cd;font:13px 'Microsoft YaHei',sans-serif}.wrap{max-width:920px;margin:auto}h1{font-size:24px;font-weight:500;margin:8px 0}p{color:#799c89;line-height:1.8}header{margin-bottom:22px}.kicker{font:11px Consolas;color:#6eaa89;letter-spacing:3px}.controls{display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:#112219;padding:14px;position:sticky;top:0;z-index:2;border:1px solid #294333}button{background:#1f6850;color:#e0f1e6;padding:7px 18px;border:0;cursor:pointer}input{vertical-align:middle;accent-color:#53a17e}section{margin-top:22px}.heading{display:flex;justify-content:space-between;margin:0 0 10px}.heading span,small{color:#6e9380}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{padding:8px;text-align:center;background:#101e17;border:1px solid #294333}.card canvas{display:block;margin:auto;max-width:100%;image-rendering:pixelated;background:repeating-conic-gradient(#12231a 0 25%,#15291e 0 50%) 0/16px 16px}.card div{margin-top:7px}small{font:10px Consolas}a{color:#8bc0a3}@media(max-width:600px){body{padding:16px}.grid{grid-template-columns:repeat(2,1fr)}}</style>
<div class="wrap"><header><div class="kicker">TIDELINE / PLAYER ANIMATION</div><h1>玩家动作预览</h1><p>7 种动作 · 三向图与朝左镜像 · 共 60 帧。此页重复预览动作；游戏内射击、受击、死亡和闪避按事件播放。<br>以人物本体校准大小与落脚点；倒地和射击增加透明画布，枪管伸出不会缩小身体。<a href="潮汐线.html">进入游戏</a> · <a href="ART_STYLE.md">美术规范</a></p></header>
<div class="controls"><button id="pause">暂停</button><button id="replay">从头播放</button><label>速度 <input id="rate" type="range" min="0.25" max="2" step="0.25" value="1"> <output id="rateValue">1×</output></label></div>${rows}<p id="error"></p></div>
<script>
const actions=${JSON.stringify(manifest.actions)};
const sheets={};let time=0,last=performance.now(),paused=false,rate=1;
const canvases=[...document.querySelectorAll('canvas')];
const loaded=[];
for(const state of Object.keys(actions))for(const dir of ['s','n','e']){
  const img=new Image();sheets[state+'_'+dir]=img;
  loaded.push(new Promise(resolve=>{img.onload=resolve;img.onerror=()=>{document.getElementById('error').textContent='图片加载失败：'+state+'_'+dir;resolve()};img.src='assets/anim/player_'+state+'_'+dir+'.png'}));
}
Promise.all(loaded).then(()=>window.previewReady=true);
function draw(){for(const canvas of canvases){const state=canvas.dataset.state,dir=canvas.dataset.dir,clip=actions[state],image=sheets[state+'_'+(dir==='w'?'e':dir)];if(!image.complete||!image.naturalWidth)continue;const size=clip.size||32,dest=size*4,view=canvas.width,offset=(view-dest)/2;const duration=clip.frames/clip.fps;const elapsed=clip.loop?time:time%(duration+0.65);const step=Math.floor(elapsed*clip.fps),frame=clip.loop?step%clip.frames:Math.min(clip.frames-1,step);const ctx=canvas.getContext('2d');ctx.clearRect(0,0,view,view);ctx.imageSmoothingEnabled=false;ctx.save();if(dir==='w'){ctx.translate(view,0);ctx.scale(-1,1)}ctx.drawImage(image,frame*size,0,size,size,offset,offset,dest,dest);ctx.restore();canvas.nextElementSibling.nextElementSibling.textContent=(frame+1)+' / '+clip.frames;}}
function tick(now){if(!paused)time+=Math.min(0.1,(now-last)/1000)*rate;last=now;draw();requestAnimationFrame(tick)}requestAnimationFrame(tick);
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'继续':'暂停'};
document.getElementById('replay').onclick=()=>{time=0;draw()};
document.getElementById('rate').oninput=e=>{rate=+e.target.value;document.getElementById('rateValue').textContent=rate+'×'};
window.previewAt=value=>{paused=true;time=value;draw()};
</script></html>`;
fs.writeFileSync(path.join(root, '玩家动画.html'), html, 'utf8');
console.log('已生成 玩家动画.html');
