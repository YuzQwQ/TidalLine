/* Lobby playlist controller. One HTMLAudioElement; long tracks never decode into SFX buffers. */
{
 const ensureAudio=Music.ensure;
 Object.assign(Music,{
  /* BEGIN MUSIC TRACKS */
  TRACKS: {
    "base": {
      "file": "assets/audio/bgm_base.mp3",
      "title": "退潮之后",
      "english": "After the Ebb",
      "name": "退潮之后 / After the Ebb",
      "duration": 203.174,
      "scene": "lobby",
      "gain": 1
    },
    "no_one_answers": {
      "file": "assets/audio/bgm_no_one_answers.mp3",
      "title": "无人应答",
      "english": "No One Answers",
      "name": "无人应答 / No One Answers",
      "duration": 229.214,
      "scene": "lobby",
      "gain": 1
    },
    "beyond_the_grey": {
      "file": "assets/audio/bgm_beyond_the_grey.mp3",
      "title": "越过灰色地带",
      "english": "Beyond the Grey",
      "name": "越过灰色地带 / Beyond the Grey",
      "duration": 189.614,
      "scene": "lobby",
      "gain": 1
    },
    "business_as_usual": {
      "file": "assets/audio/bgm_business_as_usual.mp3",
      "title": "照常营业",
      "english": "Business as Usual",
      "name": "照常营业 / Business as Usual",
      "duration": 183.214,
      "scene": "shop",
      "gain": 1
    }
  },
  /* END MUSIC TRACKS */
  active:false,volume:.45,mode:'order',blocked:false,failed:false,prefsLoaded:false,_playEpoch:0,_wake:null,_loadedId:null,dialog:null,
  scene:'lobby',_lobbyTrack:null,_positions:{},_switchEpoch:0,_switching:false,_pendingTrack:null,_resumeAt:null,
  initPrefs(){
   if(this.prefsLoaded)return;this.prefsLoaded=true;
   try{const p=JSON.parse(localStorage.getItem('tideline_music_v1')||'{}');if(this.TRACKS[p.track])this.cur=p.track;if(typeof p.on==='boolean')this.on=p.on;if(Number.isFinite(p.volume))this.volume=Math.max(0,Math.min(1,p.volume));if(['order','repeat','shuffle'].includes(p.mode))this.mode=p.mode;}catch(e){}
   if(!this.TRACKS[this.cur])this.cur=Object.keys(this.TRACKS)[0];
   this._lobbyTrack=this.cur;
  },
  savePrefs(){try{localStorage.setItem('tideline_music_v1',JSON.stringify({track:this._lobbyTrack||this.cur,on:this.on,volume:this.volume,mode:this.mode}));}catch(e){}},
  ensure(){
   const el=ensureAudio.call(this);if(this._eventsBound)return el;this._eventsBound=true;el.loop=false;el.preload='metadata';
   for(const event of ['loadedmetadata','durationchange','timeupdate','play','pause'])el.addEventListener(event,()=>this.renderPlayer());
   el.addEventListener('loadedmetadata',()=>{if(this._resumeAt?.id===this.cur){el.currentTime=Math.min(this._resumeAt.time,Number.isFinite(el.duration)?el.duration:Infinity);this._resumeAt=null;}});
   el.addEventListener('ended',()=>{if(!this.active||!this.on||this._switching)return;if(this.scene==='shop'||this.mode==='repeat'){el.currentTime=0;this._start();}else this.next(1);});
   el.addEventListener('error',()=>{this.failed=true;this.renderPlayer();});return el;
  },
  _load(){
   const el=this.ensure();if(this._loadedId!==this.cur){this._loadedId=this.cur;this.failed=false;const time=this._positions[this.cur]||0;this._resumeAt={id:this.cur,time};el.src=this.urlOf(this.cur);try{el.currentTime=time;}catch(e){}}
   this.vol=this.volume*(this.TRACKS[this.cur]?.gain??1);return el;
  },
  _remember(){if(this.el&&this.cur&&Number.isFinite(this.el.currentTime))this._positions[this.cur]=this.el.currentTime;},
  _cancelSwitch(){this._switchEpoch++;this._switching=false;this._pendingTrack=null;clearInterval(this._timer);this._timer=null;},
  /* Fade to silence before swapping the one media source; epochs reject stale scene changes. */
  _switchTo(id,smooth=true){
   if(!this.TRACKS[id])return;this._cancelSwitch();this._clearWake();this._playEpoch++;const epoch=this._switchEpoch;
   if(this.cur===id){if(this.active&&this.on)this._start();else this.renderPlayer();return;}
   this._switching=true;this._pendingTrack=id;
   const finish=()=>{if(epoch!==this._switchEpoch)return;this._remember();this.el?.pause();if(this.el)this.el.volume=0;this.cur=id;this._load();this._switching=false;this._pendingTrack=null;if(this.active&&this.on)this._start();else this.renderPlayer();};
   if(smooth&&this.active&&this.on&&this.el&&!this.el.paused&&this.el.volume>0)this.fadeTo(0,.9,finish);else finish();this.renderPlayer();
  },
  setScene(scene){
   if(!['lobby','shop'].includes(scene)||this.scene===scene)return;this.initPrefs();this.scene=scene;
   const id=scene==='shop'?Object.keys(this.TRACKS).find(id=>this.TRACKS[id].scene==='shop'):this._lobbyTrack;
   if(id)this._switchTo(id);this.renderPlayer();
  },
  enterBase(){this.initPrefs();this.active=true;if(this.scene!=='lobby'){this.setScene('lobby');return;}this._load();if(this.on)this._start();else this.renderPlayer();},
  play(id){
   this.initPrefs();if(!this.TRACKS[id])return false;this._cancelSwitch();this._remember();this._clearWake();this._playEpoch++;this.cur=id;if(this.scene==='lobby')this._lobbyTrack=id;this.on=true;this.blocked=this.failed=false;this._load();this.savePrefs();if(this.active)this._start();else this.renderPlayer();return true;
  },
  _clearWake(){if(!this._wake)return;window.removeEventListener('pointerdown',this._wake,true);window.removeEventListener('keydown',this._wake,true);this._wake=null;},
  _start(){
   if(!this.active||!this.on||this._switching)return;const el=this._load(),epoch=++this._playEpoch;this.blocked=false;this.failed=false;this._clearWake();
   let playing;try{playing=el.play();}catch(e){playing=Promise.reject(e);}
   Promise.resolve(playing).then(()=>{if(epoch===this._playEpoch&&this.active&&this.on){this.fadeTo(this.vol,.8);this.renderPlayer();}}).catch(e=>{
    if(epoch!==this._playEpoch||!this.active||!this.on)return;
    if(e.name==='NotAllowedError'){
     this.blocked=true;this._wake=()=>{this._clearWake();if(this.active&&this.on)this._start();};
     window.addEventListener('pointerdown',this._wake,{once:true,capture:true});window.addEventListener('keydown',this._wake,{once:true,capture:true});
    }else if(e.name!=='AbortError')this.failed=true;
    this.renderPlayer();
   });this.renderPlayer();
  },
  stop(fade){
   this.active=false;this._cancelSwitch();this._remember();this._playEpoch++;this._clearWake();this.closePlayer();
   this.fadeTo(0,fade??.6,()=>{if(!this.active){this.el?.pause();this.renderPlayer();}});this.renderPlayer();
  },
  setOn(on){
   this.initPrefs();this.on=!!on;this._playEpoch++;this._clearWake();this.blocked=false;
   if(this._switching&&!this.on)this._switchTo(this._pendingTrack,false);
   if(this.on&&this.active)this._start();else{clearInterval(this._timer);this._timer=null;this.el?.pause();this.renderPlayer();}this.savePrefs();
  },
  setVolume(value){
   if(!Number.isFinite(value))return;this.volume=Math.max(0,Math.min(1,value));this.vol=this.volume*(this.TRACKS[this.cur]?.gain??1);
   if(!this._switching){clearInterval(this._timer);this._timer=null;if(this.el){this.el.volume=this.active?this.vol:0;if(!this.active)this.el.pause();}}this.savePrefs();this.renderPlayer();
  },
  setMode(mode){if(!['order','repeat','shuffle'].includes(mode))return;this.mode=mode;this.savePrefs();this.renderPlayer();},
  next(direction=1){
   this.initPrefs();const ids=Object.keys(this.TRACKS).filter(id=>(this.TRACKS[id].scene||'lobby')===this.scene),i=ids.indexOf(this.cur);if(!ids.length)return;
   if(i<0){this.play(ids[direction>0?0:ids.length-1]);return;}
   const step=this.mode==='shuffle'&&direction>0&&ids.length>1?1+Math.floor(Math.random()*(ids.length-1)):direction;
   this.play(ids[(i+step+ids.length)%ids.length]);
  },
  seek(seconds){if(!this.el||!Number.isFinite(this.el.duration)||!Number.isFinite(seconds))return;this.el.currentTime=Math.max(0,Math.min(this.el.duration,seconds));this.renderPlayer();},
  clock(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');},
  mount(root){
   if(this.openButton||!root)return;this.initPrefs();const button=document.createElement('button');this.openButton=button;button.className='sh-music-toggle';button.type='button';button.setAttribute('aria-label','打开音乐播放器');
   button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></svg><span>局外音乐<small data-music-current></small></span>';
   root.querySelector('.sh-global').insertBefore(button,root.querySelector('.sh-settings'));button.onclick=()=>this.openPlayer();this.renderPlayer();
  },
  openPlayer(){
   if(!this.active)return;this.initPrefs();if(!this.dialog){
    const dlg=document.createElement('dialog');this.dialog=dlg;dlg.className='music-player';dlg.setAttribute('aria-labelledby','musicPlayerTitle');
    dlg.innerHTML='<header><div><small>SAFEHOUSE RADIO / 局外音乐</small><h2 id="musicPlayerTitle">音乐播放器</h2></div><button type="button" data-music-close aria-label="关闭音乐播放器">×</button></header>'+
     '<section class="music-now"><small data-music-status role="status"></small><h3 data-music-title></h3><p data-music-english></p></section>'+
     '<div class="music-timeline"><input type="range" min="0" max="1" step=".1" value="0" data-music-seek aria-label="播放进度"><div><span data-music-elapsed>0:00</span><span data-music-duration></span></div></div>'+
     '<div class="music-transport"><button type="button" data-music-prev aria-label="上一首">上一首</button><button type="button" data-music-play>播放</button><button type="button" data-music-next aria-label="下一首">下一首</button></div>'+
     '<div class="music-settings"><label>音量 <input type="range" min="0" max="100" step="1" data-music-volume aria-label="音乐音量"><output data-music-volume-value></output></label><label><span class="sr-only">播放方式</span><select data-music-mode aria-label="播放方式"><option value="order">顺序循环</option><option value="repeat">单曲循环</option><option value="shuffle">随机播放</option></select></label></div>'+
     '<section class="music-library"><h3>曲目列表 <small>'+Object.keys(this.TRACKS).length+'首</small></h3><div>'+Object.entries(this.TRACKS).map(([id,t],i)=>'<button type="button" data-music-track="'+id+'"><span class="music-number">'+String(i+1).padStart(2,'0')+'</span><span><b>'+esc(t.title)+'</b><small>'+esc(t.english)+'</small></span><time>'+this.clock(t.duration)+'</time></button>').join('')+'</div></section>';
    document.body.appendChild(dlg);dlg.querySelector('[data-music-close]').onclick=()=>this.closePlayer();dlg.querySelector('[data-music-prev]').onclick=()=>this.next(-1);dlg.querySelector('[data-music-next]').onclick=()=>this.next(1);dlg.querySelector('[data-music-play]').onclick=()=>this.setOn(this.blocked||this.failed||!this.on);
    dlg.querySelector('[data-music-volume]').oninput=e=>this.setVolume(Number(e.target.value)/100);dlg.querySelector('[data-music-mode]').onchange=e=>this.setMode(e.target.value);dlg.querySelector('[data-music-seek]').oninput=e=>this.seek(Number(e.target.value));
    dlg.querySelectorAll('[data-music-track]').forEach(b=>b.onclick=()=>this.play(b.dataset.musicTrack));
    dlg.addEventListener('cancel',e=>{e.preventDefault();this.closePlayer();});dlg.addEventListener('click',e=>{if(e.target!==dlg)return;const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.closePlayer();});
   }this.renderPlayer();if(!this.dialog.open)this.dialog.showModal();
  },
  closePlayer(){if(this.dialog?.open)this.dialog.close();},
  renderPlayer(){
   const track=this.TRACKS[this.cur]||Object.values(this.TRACKS)[0];if(!track)return;
   if(this.openButton){this.openButton.querySelector('[data-music-current]').textContent=track.title;this.openButton.classList.toggle('playing',this.active&&this.on&&!this.blocked&&!this.failed);}
   const d=this.dialog;if(!d)return;
   d.querySelector('[data-music-title]').textContent=track.title;d.querySelector('[data-music-english]').textContent=track.english;
   d.querySelector('[data-music-status]').textContent=this._switching?'正在淡出，切换音乐…':this.failed?'曲目暂时无法播放，可重试或切换':this.blocked?'点击播放，开始收听':!this.active?'行动中暂停音乐':!this.on?'已暂停':this.el?.paused?'正在载入…':this.scene==='shop'?'商店音乐 · 正在播放':'正在播放';
   d.querySelector('[data-music-play]').textContent=this.blocked||this.failed||!this.on?'播放':'暂停';d.querySelector('[data-music-mode]').value=this.mode;
   d.querySelector('[data-music-volume]').value=String(Math.round(this.volume*100));d.querySelector('[data-music-volume-value]').textContent=Math.round(this.volume*100)+'%';
   const duration=Number.isFinite(this.el?.duration)?this.el.duration:track.duration,seek=d.querySelector('[data-music-seek]');seek.disabled=!Number.isFinite(this.el?.duration);seek.max=String(duration||1);seek.value=String(this.el?.currentTime||0);
   d.querySelector('[data-music-elapsed]').textContent=this.clock(this.el?.currentTime);d.querySelector('[data-music-duration]').textContent=this.clock(duration);
   d.querySelectorAll('[data-music-track]').forEach(b=>{const selected=b.dataset.musicTrack===this.cur;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  }
 });
}
