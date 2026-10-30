'use strict';
// Native state and save containers stay in Suika. This shell only persists its files.
window.suie={
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
  document.getElementById('fullscreen').addEventListener('click',()=>document.getElementById('canvas_holder').requestFullscreen?.());
  document.getElementById('retry-save').addEventListener('click',()=>suie.retry());
  new ResizeObserver(()=>suie.resize()).observe(document.getElementById('canvas_holder'));
});
window.addEventListener('beforeunload',event=>{if(suie.pending){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&suie.dirty&&!suie.storageError)suie.drain();});
