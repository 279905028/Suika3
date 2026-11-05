'use strict';
// Retry native hold/release until the VM acknowledges; startup/image decoding can
// span a short input pulse. No story or save variables are modified by JavaScript.
(()=>{
 let active=null,ready=false,desired=false,acknowledged=null,timer=null;
 function pump(){
  if(!ready||active!==null||acknowledged===desired)return;
  const value=desired;active=value;
  const key=value?'Y':'Q',canvas=document.getElementById('canvas');
  const send=type=>canvas.dispatchEvent(new KeyboardEvent(type,{key,code:'Key'+key,keyCode:key.charCodeAt(0),which:key.charCodeAt(0),bubbles:true}));
  send('keydown');setTimeout(()=>{send('keyup');active=null;},90);
 }
 window.mcgBridge={
  get state(){return {ready,desired,acknowledged,active};},
  hold(value){desired=!!value;pump();},
  gallery(value){this.hold(value);},
  onLog(line){
   line=String(line);
   if(line.startsWith('SUI_E|ready|')){ready=true;desired=false;acknowledged=null;pump();timer=setInterval(pump,250);}
   if(line==='SUI_M|held|1')acknowledged=true;
   if(line==='SUI_M|held|0')acknowledged=false;
   if(line.startsWith('SUI_M|'))window.endingMotion?.onLog(line);
  }
 };
 for(const line of window.suie?.events||[])window.mcgBridge.onLog(line);
 window.addEventListener('pagehide',()=>clearInterval(timer));
})();
