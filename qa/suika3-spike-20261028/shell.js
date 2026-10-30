// SUI-T: host controls and native-file persistence only. No story state lives here.
window.suit = {
  events: [], pending: false, storageError: null, ready: false, flushCount: 0,
  status(text) { document.getElementById('storage-status').textContent = text; },
  log(line) { this.events.push(String(line)); if (this.events.length > 4000) this.events.shift(); },
  fail(error) { this.storageError = String(error); this.status('存档写入失败：'+this.storageError+'。请保留当前页面。'); },
  install(FS, IDBFS) {
    this.fs = FS; this.idb = IDBFS;
    const close = FS.close;
    FS.close = function(stream) {
      const write = stream && (stream.flags & 3) !== 0 && stream.node?.mount?.type === IDBFS;
      const result = close.call(FS, stream);
      if (write) suit.requestFlush();
      return result;
    };
  },
  restored(error, mount) {
    this.mount = mount;
    if (error) {
      this.storageError=String(error); this.status('无法读取存档库，请保留原档并刷新重试：'+error);
      document.querySelectorAll('#controls button').forEach(b=>b.disabled=true);
      return false;
    }
    this.ready = true; this.status('独立存档库已读取'); return true;
  },
  requestFlush() {
    this.pending = true; this.dirty = true; this.status('正在写入浏览器存档…');
    clearTimeout(this.timer); this.timer = setTimeout(()=>this.drain(), 0);
  },
  drain() {
    if (this.busy || !this.ready || !this.dirty) return;
    this.busy = true; this.dirty = false;
    this.fs.syncfs(false, error => {
      this.busy = false;
      if (error) { this.pending = true; this.fail(error); return; }
      this.flushCount++; this.storageError = null;
      if (this.dirty) this.drain();
      else { this.pending = false; this.status('存档已写入浏览器，可刷新或关闭'); }
    });
  },
  key(key) {
    const canvas = document.getElementById('canvas'); canvas.focus();
    const code = key==='Enter' ? 'Enter' : /^[0-9]$/.test(key) ? 'Digit'+key : 'Key'+key.toUpperCase();
    const keyCode = key==='Enter' ? 13 : key.toUpperCase().charCodeAt(0);
    const nativeKey=key==='Enter'?'Enter':key.toUpperCase();
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key:nativeKey,code,keyCode,which:keyCode,bubbles:true}));
    setTimeout(()=>canvas.dispatchEvent(new KeyboardEvent('keyup',{key:nativeKey,code,keyCode,which:keyCode,bubbles:true})),80);
  },
  resize() {
    const canvas = document.getElementById('canvas'), holder = document.getElementById('canvas_holder');
    let scale = Math.min(holder.clientWidth/canvas.width, holder.clientHeight/canvas.height);
    if (window.innerHeight<=500 && window.innerWidth>=600) scale = Math.min(holder.clientWidth/canvas.width,0.55);
    canvas.style.width = Math.floor(canvas.width*scale)+'px'; canvas.style.height = Math.floor(canvas.height*scale)+'px';
  }
};
const originalAlert=window.alert.bind(window);
window.alert = message => {
  if (String(message).startsWith('SUI_T|')) { suit.log(message); console.log(message); }
  else originalAlert(message);
};
document.addEventListener('DOMContentLoaded',()=>{
  for (const type of ['keydown','keyup']) canvas.addEventListener(type,event=>{
    if (event.ctrlKey || event.metaKey || event.altKey || !/^[a-z]$/.test(event.key)) return;
    event.stopImmediatePropagation(); event.preventDefault();
    canvas.dispatchEvent(new KeyboardEvent(type,{key:event.key.toUpperCase(),code:event.code,keyCode:event.keyCode,which:event.which,bubbles:true}));
  },true);
  document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('click',()=>suit.key(b.dataset.key)));
  document.getElementById('retry-save').addEventListener('click',()=>suit.requestFlush());
  new ResizeObserver(()=>suit.resize()).observe(document.getElementById('canvas_holder'));
});
window.addEventListener('beforeunload',event=>{if(suit.pending){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden' && suit.dirty)suit.drain();});
