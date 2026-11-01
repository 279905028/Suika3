'use strict';
// Native state and save containers stay in Suika. This shell only persists its files.
// The landscape page is the web root; the 720x1280 portrait page is portrait/ on the same origin.
const PORTRAIT_QUERY='(orientation:portrait) and (max-width:900px)';
window.suie={
  layout:document.documentElement.dataset.layout||'landscape',
  wanted(){return matchMedia(PORTRAIT_QUERY).matches?'portrait':'landscape';},
  url(layout){
    const search=new URLSearchParams(location.search);search.delete('layout');const q=search.toString();
    return (layout===this.layout?'./':layout==='portrait'?'portrait/':'../')+(q?'?'+q:'');
  },
  events:[],ready:false,pending:false,dirty:false,busy:false,storageError:null,flushCount:0,restoreBusy:false,
  status(message,error=false){
    const node=document.getElementById('storage-status');
    if(node){node.textContent=message;node.classList.toggle('error',error);}
  },
  log(line){this.events.push(String(line));if(this.events.length>4000)this.events.shift();window.suiTitleMotion?.onLog(line);},
  fail(error,restoring=false){
    this.storageError=String(error);this.pending=!restoring;
    this.status(restoring?'无法读取存档，请保留原档并重试。':'保存失败，请保留当前页面并重试。',true);
    const retry=document.getElementById('retry-save');retry.hidden=false;retry.textContent=restoring?'重试读取':'重试保存';
  },
  install(FS,IDBFS){
    this.fs=FS;this.idb=IDBFS;
    const close=FS.close;
    FS.close=function(stream){
      const write=stream&&(stream.flags&3)!==0&&stream.node?.mount?.type===IDBFS;
      const result=close.call(FS,stream);
      if(write&&suie.ready)suie.requestFlush();
      return result;
    };
  },
  restore(mount,resume){
    if(this.ready||this.restoreBusy)return;
    this.mount=mount;this.resume=resume;this.restoreBusy=true;
    this.status('正在读取存档…');
    this.fs.syncfs(true,error=>{
      this.restoreBusy=false;
      if(error){this.fail(error,true);return;}
      this.ready=true;this.storageError=null;
      document.getElementById('retry-save').hidden=true;
      this.status('存档已读取');
      const start=this.resume;this.resume=null;start();
    });
  },
  requestFlush(){
    this.pending=true;this.dirty=true;
    if(!this.storageError)this.status('正在保存进度…');
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.drain(),0);
  },
  drain(){
    if(this.busy||!this.ready||!this.dirty)return;
    this.busy=true;this.dirty=false;
    this.fs.syncfs(false,error=>{
      this.busy=false;
      if(error){this.dirty=true;this.fail(error);return;}
      this.flushCount++;
      if(this.dirty){this.drain();return;}
      this.pending=false;this.storageError=null;
      document.getElementById('retry-save').hidden=true;
      this.status('进度已保存');
    });
  },
  retry(){if(!this.ready)this.restore(this.mount,this.resume);else this.requestFlush();},
  // The engine maps KeyboardEvent.key; hold briefly so a frame-polled key state sees the press.
  press(key){
    const canvas=document.getElementById('canvas');if(!canvas)return;
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,bubbles:true,cancelable:true}));
    setTimeout(()=>canvas.dispatchEvent(new KeyboardEvent('keyup',{key,code:key,bubbles:true,cancelable:true})),80);
  },
  // Click a point given in canvas coordinates (e.g. the native menu button).
  tap(x,y){
    const canvas=document.getElementById('canvas');if(!canvas||!canvas.width)return;
    const b=canvas.getBoundingClientRect(),clientX=b.left+x*b.width/canvas.width,clientY=b.top+y*b.height/canvas.height;
    for(const type of ['mousemove','mousedown'])canvas.dispatchEvent(new MouseEvent(type,{clientX,clientY,button:0,buttons:1,bubbles:true,cancelable:true}));
    setTimeout(()=>canvas.dispatchEvent(new MouseEvent('mouseup',{clientX,clientY,button:0,buttons:0,bubbles:true,cancelable:true})),80);
  },
  fullscreen(){
    const holder=document.getElementById('canvas_holder');
    Promise.resolve(holder.requestFullscreen?.()).then(()=>screen.orientation?.lock?.(this.layout)).catch(()=>{});
  },
  hint(){
    const node=document.getElementById('rotate');if(!node)return;
    let dismissed=false;try{dismissed=sessionStorage.getItem('suie-rotate-hint')==='1';}catch{}
    const want=this.wanted();
    node.querySelector('span').textContent=want==='portrait'?'竖屏可改用竖版阅读，进度会保留':'横屏可改用横版阅读，进度会保留';
    document.getElementById('switch-layout').textContent=want==='portrait'?'切换竖版':'切换横版';
    node.hidden=dismissed||want===this.layout;
  },
  // Wait for the engine's automatic save (written at most 1.5s after a page) to reach storage.
  switchLayout(){
    if(this.switching)return;this.switching=true;
    const target=this.url(this.wanted()===this.layout?(this.layout==='portrait'?'landscape':'portrait'):this.wanted()),started=Date.now();
    this.status('正在保存进度…');
    const go=()=>{if(this.pending&&!this.storageError&&Date.now()-started<10000){setTimeout(go,100);return;}location.replace(target);};
    setTimeout(go,1600);
  },
  resize(){
    const canvas=document.getElementById('canvas'),holder=document.getElementById('canvas_holder');
    if(!canvas||!holder||!canvas.width||!canvas.height)return;
    const scale=Math.min(holder.clientWidth/canvas.width,holder.clientHeight/canvas.height);
    canvas.style.width=Math.floor(canvas.width*scale)+'px';canvas.style.height=Math.floor(canvas.height*scale)+'px';
  }
};
const nativeAlert=window.alert.bind(window);
window.alert=message=>{
  if(/^SUI_[EI]\|/.test(String(message))){suie.log(message);console.log(message);}
  else nativeAlert(message);
};
document.addEventListener('DOMContentLoaded',()=>{
  const canvas=document.getElementById('canvas');
  for(const type of ['keydown','keyup'])canvas.addEventListener(type,event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||!/^[a-z]$/.test(event.key))return;
    event.stopImmediatePropagation();event.preventDefault();
    canvas.dispatchEvent(new KeyboardEvent(type,{key:event.key.toUpperCase(),code:event.code,keyCode:event.keyCode,which:event.which,bubbles:true}));
  },true);
  const holder=document.getElementById('canvas_holder');
  document.getElementById('fullscreen').addEventListener('click',()=>suie.fullscreen());
  document.getElementById('retry-save').addEventListener('click',()=>suie.retry());
  // Native reading-menu button: config.ini sysbtn.x/y/width/height = 1104/24/128/56.
  document.getElementById('tb-menu')?.addEventListener('click',()=>suie.layout==='portrait'?suie.tap(632,52):suie.tap(1168,52));
  document.getElementById('tb-next')?.addEventListener('click',()=>suie.press('Enter'));
  document.getElementById('tb-fullscreen')?.addEventListener('click',()=>suie.fullscreen());
  document.getElementById('rotate-close')?.addEventListener('click',()=>{try{sessionStorage.setItem('suie-rotate-hint','1');}catch{}suie.hint();});
  document.getElementById('switch-layout')?.addEventListener('click',()=>suie.switchLayout());
  // Letterbox space below the canvas acts as a large "continue" target on touch screens.
  holder.addEventListener('click',event=>{if(event.target===holder&&matchMedia('(pointer:coarse)').matches)suie.press('Enter');});
  matchMedia(PORTRAIT_QUERY).addEventListener('change',()=>suie.hint());
  suie.hint();
  new ResizeObserver(()=>suie.resize()).observe(holder);
});
// Phones open the layout matching their orientation before the engine starts; ?layout=… pins one.
if(!new URLSearchParams(location.search).has('layout')&&suie.wanted()!==suie.layout)location.replace(suie.url(suie.wanted()));
window.addEventListener('beforeunload',event=>{if(suie.pending){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&suie.dirty&&!suie.storageError)suie.drain();});
