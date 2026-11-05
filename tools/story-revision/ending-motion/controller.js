'use strict';
// Media only; the Suika VM owns story position, choices, and saves.
(()=>{
 const config=window.mcgConfig;if(!config)return;
 const MIN_DISPLAY_MS=1500;
 const m=window.endingMotion={events:[],key:'',contextKey:'',phase:'idle',video:null,menu:false,generation:0,visible:false,unlocks:new Set(),gallery:false,contextToken:'',blockedInputs:new Set(),displayElapsed:0,displayClock:null,
  emit(type,extra={}){this.events.push({type,key:this.key,phase:this.phase,time:performance.now(),...extra});if(this.events.length>1500)this.events.shift();},
  init(){
   this.holder=document.getElementById('canvas_holder');this.canvas=document.getElementById('canvas');
   this.layer=document.createElement('div');this.layer.id='ending-motion';this.layer.hidden=true;
   this.image=document.createElement('img');this.image.alt='当前镜头静态回退画面';this.image.draggable=false;
   this.hint=document.createElement('div');this.hint.className='mcg-hint';this.hint.textContent='点击 / 确认键跳过';
   this.layer.append(this.image,this.hint);this.holder.append(this.layer);
   this.replay=document.createElement('button');this.replay.className='mcg-replay';this.replay.textContent='重播本段';this.replay.hidden=true;
   this.replay.onclick=()=>{if(this.contextKey&&!this.menu)this.play(this.contextKey);};this.holder.append(this.replay);
   this.galleryButton=document.createElement('button');this.galleryButton.id='mcg-gallery';this.galleryButton.textContent='动态CG';this.galleryButton.onclick=()=>this.openGallery();this.holder.append(this.galleryButton);
   this.galleryClose=document.createElement('button');this.galleryClose.className='mcg-close';this.galleryClose.textContent='返回';this.galleryClose.hidden=true;this.galleryClose.onclick=()=>this.closeGallery();this.layer.append(this.galleryClose);
   try{const saved=JSON.parse(localStorage.getItem(config.storageKey)||'[]');if(Array.isArray(saved))this.unlocks=new Set(saved.filter(k=>Object.hasOwn(config.items,k)));}catch{}
   for(const type of ['pointerdown','pointerup','pointercancel','click','touchstart','touchend','touchcancel','keydown','keyup'])document.addEventListener(type,e=>this.input(e),true);
   document.addEventListener('visibilitychange',()=>this.applyPause());window.addEventListener('pagehide',()=>this.stop());
   new ResizeObserver(()=>this.sync()).observe(this.canvas);window.addEventListener('resize',()=>this.sync());document.addEventListener('fullscreenchange',()=>this.sync());this.sync();
   this.ready=true;for(const line of config.pendingLogs||[])this.onLog(line);
  },
  sync(){const c=this.canvas.getBoundingClientRect(),h=this.holder.getBoundingClientRect();Object.assign(this.layer.style,{left:c.left-h.left+'px',top:c.top-h.top+'px',width:c.width+'px',height:c.height+'px'});},
  busy(){return this.phase==='playing'||this.phase==='loading';},
  displayTime(){return this.displayElapsed+(this.displayClock===null?0:performance.now()-this.displayClock);},
  skipLocked(){return !this.visible||this.displayTime()<MIN_DISPLAY_MS;},
  updateHoldHint(){
   this.displayElapsed=this.displayTime();
   this.displayClock=this.visible&&this.video&&!this.video.paused&&!this.menu&&!document.hidden?performance.now():null;
   clearTimeout(this.holdTimer);
   const remaining=Math.max(0,MIN_DISPLAY_MS-this.displayElapsed);
   this.hint.textContent=remaining>0?'欣赏片刻…':'点击 / 确认键跳过';
   if(this.displayClock!==null&&remaining>0)this.holdTimer=setTimeout(()=>this.updateHoldHint(),remaining+10);
  },
  input(e){
   if(e.target.closest?.('button,dialog'))return;
   if(this.gallery&&e.type==='keydown'&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.closeGallery();return;}
   const keyboard=e.type.startsWith('key'),onCanvas=this.layer.contains(e.target)||e.target===this.canvas;
   const confirm=keyboard?['Enter',' ','ArrowDown'].includes(e.key):onCanvas&&(e.button===undefined||e.button===0);
   const id=keyboard?'key:'+(e.code||e.key):e.type.startsWith('pointer')?'pointer:'+e.pointerId:'touch';
   if(e.type==='pointercancel'||e.type==='touchcancel'){this.blockedInputs.delete(id);return;}
   const down=['pointerdown','keydown','touchstart'].includes(e.type),up=['pointerup','keyup','touchend','pointercancel','touchcancel'].includes(e.type);
   const blocked=this.blockedInputs.has(id),active=this.busy()&&!this.menu,draining=performance.now()<(this.drainUntil||0);
   if(confirm&&(active||draining||blocked||this.gallery)){
    e.preventDefault();e.stopImmediatePropagation();
    if(up)this.blockedInputs.delete(id);
    if(down){
     if(blocked||draining||e.repeat||(active&&this.skipLocked()))this.blockedInputs.add(id);
     else if(active)this.finish('skip');
    }
    if(active)this.drainUntil=performance.now()+180;
   }
  },
  disposeVideo(){
   this.generation++;clearTimeout(this.timeout);this.timeout=null;clearTimeout(this.holdTimer);
   if(this.video){const v=this.video;this.video=null;v.pause();v.removeAttribute('src');v.load();v.remove();}
   this.visible=false;this.image.hidden=false;this.framePending=false;this.displayElapsed=0;this.displayClock=null;
  },
  setContext(key,reason='enter',token=key){
   if(key&&!Object.hasOwn(config.items,key))key='';
   if(reason==='enter'&&key===this.contextKey&&token===this.contextToken)return;
   this.dialog?.close();this.dialog?.remove();this.dialog=null;this.disposeVideo();this.gallery=false;this.galleryClose.hidden=true;this.contextKey=key;this.contextToken=token;this.key=key;this.phase=key?'static':'idle';this.layer.hidden=true;
   this.replay.hidden=!key||this.menu;
   if(!key){window.mcgBridge?.hold?.(false);this.emit('cleanup');return;}
   this.image.src=config.items[key].fallback;
   if(reason==='restore'){window.mcgBridge?.hold?.(false);this.emit('restore-static');return;}
   this.play(key);
  },
  play(key){
   if(!Object.hasOwn(config.items,key)||(!this.gallery&&key!==this.contextKey))return false;
   this.disposeVideo();this.key=key;this.phase='loading';this.image.src=config.items[key].fallback;
   this.hint.textContent='欣赏片刻…';
   this.layer.hidden=this.menu;this.replay.hidden=true;this.galleryClose.hidden=!this.gallery;
   window.mcgBridge?.hold?.(true);this.emit('start');
   if(!config.items[key].src){this.finish('unavailable');return false;}
   const v=this.video=document.createElement('video'),gen=this.generation;
   v.muted=true;v.defaultMuted=true;v.playsInline=true;v.preload='auto';v.setAttribute('playsinline','');v.setAttribute('muted','');v.hidden=true;
   this.layer.insertBefore(v,this.hint);const current=()=>gen===this.generation&&this.video===v;
   const visibleFrame=()=>{
    if(!current())return;
    this.framePending=false;if(this.menu||document.hidden||v.paused)return;
    v.hidden=false;this.image.hidden=true;this.visible=true;this.updateHoldHint();
    this.emit('minimum-display-start',{minimumMs:MIN_DISPLAY_MS});
    if(!this.unlocks.has(key)){
     this.unlocks.add(key);try{localStorage.setItem(config.storageKey,JSON.stringify([...this.unlocks]));}catch{this.emit('unlock-storage-failed');}
     this.emit('first-visible-frame');
    }
   };
   this.armFrame=()=>{if(!current()||this.visible||this.framePending)return;this.framePending=true;if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(visibleFrame);else v.addEventListener('timeupdate',visibleFrame,{once:true});};
   v.addEventListener('error',()=>{if(current())this.finish('media-error');});
   v.addEventListener('ended',()=>{if(current())this.finish('ended');});
   v.addEventListener('loadeddata',()=>{if(current()){clearTimeout(this.timeout);this.phase='playing';this.applyPause();}});
   v.src=config.items[key].src;v.load();
   this.timeout=setTimeout(()=>{if(current()&&this.phase==='loading')this.finish('load-timeout');},config.loadTimeoutMs||12000);return true;
  },
  finish(reason){
   if(!this.key)return;this.disposeVideo();this.phase='static';
   this.image.src=config.items[this.key].fallback;this.layer.hidden=!this.gallery||this.menu;
   this.replay.hidden=this.gallery||!this.contextKey||this.menu;window.mcgBridge?.hold?.(this.gallery);this.emit(reason);
  },
  stop(){this.dialog?.close();this.dialog?.remove();this.dialog=null;this.disposeVideo();this.key='';this.contextKey='';this.contextToken='';this.phase='idle';this.gallery=false;this.layer.hidden=true;this.replay.hidden=true;this.galleryClose.hidden=true;window.mcgBridge?.hold?.(false);this.emit('cleanup');},
  applyPause(){
   this.updateHoldHint();
   const v=this.video;this.layer.hidden=this.menu||(!this.busy()&&!this.gallery);this.replay.hidden=this.menu||!this.contextKey||this.busy()||this.gallery;
   if(!v)return;
   if(this.menu||document.hidden){v.pause();this.updateHoldHint();this.emit('pause',{menu:this.menu,hidden:document.hidden});return;}
   const gen=this.generation;v.play().then(()=>{if(gen===this.generation){this.armFrame?.();this.updateHoldHint();}}).catch(()=>{if(gen===this.generation)this.finish('autoplay-rejected');});
  },
  onLog(line){
   if(!this.ready){(config.pendingLogs??=[]).push(line);return;}
   const p=String(line).split('|');if(p[0]!=='SUI_M')return;
   if(p[1]==='context')this.setContext(p[2],p[3],p[4]||p[2]);
   if(p[1]==='menu'){this.menu=p[2]==='1';this.applyPause();}
   if(p[1]==='exit')this.stop();
  },
  openGallery(){
   if(this.dialog)return;if(this.busy())this.finish('gallery-open');window.mcgBridge?.gallery?.(true);
   const box=this.dialog=document.createElement('dialog');box.className='mcg-dialog';const h=document.createElement('h2');h.textContent='动态CG';box.append(h);
   for(const [key,item]of Object.entries(config.items)){
    const b=document.createElement('button');b.textContent=(item.title||key)+(this.unlocks.has(key)?' · 播放':' · 未解锁');b.disabled=!this.unlocks.has(key);
    b.onclick=()=>{box.close();box.remove();this.dialog=null;this.gallery=true;this.galleryClose.hidden=false;this.play(key);};box.append(b);
   }
   const close=document.createElement('button');close.textContent='返回';close.onclick=()=>this.closeGallery();box.append(close);box.addEventListener('cancel',e=>{e.preventDefault();this.closeGallery();});document.body.append(box);box.showModal();
  },
  closeGallery(){
   this.dialog?.close();this.dialog?.remove();this.dialog=null;this.disposeVideo();this.gallery=false;this.galleryClose.hidden=true;this.layer.hidden=true;
   this.key=this.contextKey;this.phase=this.key?'static':'idle';this.replay.hidden=!this.key||this.menu;window.mcgBridge?.hold?.(false);window.mcgBridge?.gallery?.(false);this.emit('gallery-return');
  }
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>m.init(),{once:true});else m.init();
})();
