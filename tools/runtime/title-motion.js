'use strict';
// Browser-only media layer. Native GUI and all save state remain in Suika.
(()=>{
  const config=window.suiTitleMotionConfig;if(!config)return;
  const motion=window.suiTitleMotion={
    desired:false,visible:false,failed:false,sequence:0,loops:0,lastTime:0,video:null,
    onLog(line){
      const match=/^SUI_E\|title-motion\|visible=([01])$/.exec(String(line));if(!match)return;
      const next=match[1]==='1';
      if(next===this.desired)return;
      this.desired=next;
      if(next&&this.video?.readyState>=1){try{this.video.currentTime=0;}catch{}}
      this.apply();
    },
    pause(){this.sequence++;if(this.video){this.video.pause();this.video.hidden=true;}this.visible=false;},
    apply(){
      const v=this.video;if(!v)return;
      if(!this.desired||document.hidden||this.failed){this.pause();return;}
      if(v.readyState<2)return;
      const sequence=++this.sequence;
      v.play().then(()=>{
        if(sequence!==this.sequence)return;
        if(!this.desired||document.hidden||this.failed){this.pause();return;}
        this.sync();v.hidden=false;this.visible=true;
      }).catch(()=>{if(sequence===this.sequence){this.failed=true;this.pause();}});
    },
    sync(){
      if(!this.video)return;const canvas=document.getElementById('canvas'),holder=document.getElementById('canvas_holder');if(!canvas||!holder)return;
      const c=canvas.getBoundingClientRect(),h=holder.getBoundingClientRect();
      Object.assign(this.video.style,{left:(c.left-h.left)+'px',top:(c.top-h.top)+'px',width:c.width+'px',height:c.height+'px'});
    },
    init(){
      const holder=document.getElementById('canvas_holder'),canvas=document.getElementById('canvas');if(!holder||!canvas)return;
      const v=this.video=document.createElement('video');v.id='title-motion';v.hidden=true;v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.setAttribute('aria-hidden','true');v.setAttribute('muted','');v.setAttribute('playsinline','');
      const mask='linear-gradient(to bottom,#000 0%,#000 '+(config.fadeStart*100)+'%,transparent '+(config.fadeEnd*100)+'%,transparent 100%)';v.style.maskImage=mask;v.style.webkitMaskImage=mask;
      v.addEventListener('loadeddata',()=>this.apply());
      v.addEventListener('canplay',()=>this.apply());
      v.addEventListener('seeked',()=>this.apply());
      v.addEventListener('error',()=>{this.failed=true;this.pause();});
      v.addEventListener('timeupdate',()=>{if(v.currentTime<this.lastTime-1)this.loops++;this.lastTime=v.currentTime;});
      holder.appendChild(v);new ResizeObserver(()=>this.sync()).observe(canvas);window.addEventListener('resize',()=>this.sync());document.addEventListener('fullscreenchange',()=>this.sync());document.addEventListener('visibilitychange',()=>this.apply());
      for(const line of window.suie?.events||[])this.onLog(line);
      v.src=config.src;this.sync();this.apply();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>motion.init(),{once:true});else motion.init();
})();
