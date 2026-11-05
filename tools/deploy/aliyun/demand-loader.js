'use strict';
// Resource cache is separate from all player save databases and the prior full-package cache.
window.suiDemand = {
  chunks: new Map(), inflight: new Map(), cache: null, cacheReady: null, config: null, retry: null, retryWait: null,
  stats: {networkBytes: 0, cachedBytes: 0, downloads: 0, retries: 0, suspensions: 0, loadedChunks: []},
  async digest(bytes, expected) {
    if (!crypto.subtle) return; // Plain HTTP retains the original engine's compatibility.
    const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw Error('Resource checksum mismatch');
  },
  status(message) {
    const node = document.getElementById('demand-message');
    if (node) node.textContent = message;
    if (!window.suie?.ready) window.suie?.status(message);
  },
  fail(error) {
    this.stats.error = String(error);
    this.showBusy(true);
    this.status('资源暂时无法读取，请刷新页面重试。');
    console.error(error);
  },
  showBusy(busy) {
    let overlay = document.getElementById('demand-loading');
    if (!overlay) {
      overlay = document.createElement('div'); overlay.id = 'demand-loading';
      overlay.setAttribute('role', 'status'); overlay.setAttribute('aria-live', 'polite');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;background:rgba(12,17,22,.72);color:#fff;font:16px/1.6 system-ui;text-align:center';
      const label = document.createElement('div'); label.id = 'demand-message'; label.textContent = '正在加载当前场景…';
      const button = document.createElement('button'); button.id = 'demand-retry'; button.textContent = '重试加载'; button.hidden = true;
      button.style.cssText = 'padding:10px 24px;border:0;border-radius:8px;font:inherit;cursor:pointer';
      button.addEventListener('click', () => { button.hidden = true; const resume = this.retry; this.retry = null; resume?.(); });
      overlay.append(label, button); document.body.append(overlay);
    }
    overlay.hidden = !busy; overlay.style.display = busy ? 'flex' : 'none';
    if (busy) this.stats.suspensions++;
  },
  async fetchVerified(relative, item) {
    if (!this.cacheReady) this.cacheReady = (async () => {
      try { if (window.isSecureContext && 'caches' in window) this.cache = await caches.open('suika3-demand-v1'); } catch (error) { this.stats.cacheError = String(error); }
    })();
    await this.cacheReady;
    const url = new URL(relative, document.baseURI).href;
    if (this.cache) {
      try {
        const saved = await this.cache.match(url);
        if (saved) {
          const bytes = new Uint8Array(await saved.arrayBuffer());
          if (bytes.length !== item.bytes) throw Error('Invalid cached resource size');
          await this.digest(bytes, item.sha256); this.stats.cachedBytes += bytes.length;
          return bytes;
        }
      } catch (error) { this.stats.cacheError = String(error); await this.cache.delete(url).catch(() => {}); }
    }
    const bytes = new Uint8Array(item.bytes);
    let offset = 0;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      let timeout;
      const heartbeat = () => { clearTimeout(timeout); timeout = setTimeout(() => controller.abort(), 45000); };
      try {
        heartbeat();
        const response = await fetch(url, {signal: controller.signal, credentials: 'same-origin', headers: offset ? {Range:'bytes='+offset+'-'} : {}});
        if (!response.ok) throw Error('HTTP ' + response.status);
        if (response.status === 206) {
          const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
          if (!range || +range[1] !== offset || +range[3] !== item.bytes) { offset = 0; throw Error('Invalid resource range'); }
        } else if (response.status === 200) offset = 0;
        else throw Error('Unexpected resource status');
        const reader = response.body.getReader();
        while (true) {
          const part = await reader.read(); if (part.done) break;
          heartbeat();
          if (offset + part.value.length > bytes.length) { offset = 0; throw Error('Oversized resource'); }
          bytes.set(part.value, offset); offset += part.value.length; this.stats.networkBytes += part.value.length;
          if (relative === 'bootstrap.bin') this.status('正在准备标题画面：'+Math.floor(offset/bytes.length*100)+'%');
        }
        if (offset !== item.bytes) throw Error('Incomplete resource');
        try { await this.digest(bytes, item.sha256); } catch (error) { offset = 0; throw error; }
        this.stats.downloads++;
        if (this.cache) await this.cache.put(url, new Response(bytes)).catch(error => { this.stats.cacheWriteError = String(error); });
        return bytes;
      } catch (error) {
        controller.abort(); clearTimeout(timeout);
        this.stats.retries++;
        if (attempt % 3 === 2) {
          this.showBusy(true); this.status('连接暂时中断，已加载内容会保留。请重试。');
          document.getElementById('demand-retry').hidden = false;
          if (!this.retryWait) this.retryWait = new Promise(resolve => { this.retry = () => { this.retryWait = null; resolve(); }; });
          await this.retryWait;
        } else await new Promise(resolve => setTimeout(resolve, 400 * (attempt % 3 + 1)));
      } finally { clearTimeout(timeout); }
    }
  },
  missing(position, length) {
    const result = [], end = Math.min(this.config.bytes, position + length);
    for (let i = Math.floor(position / this.config.chunkSize); i < Math.ceil(end / this.config.chunkSize); i++) if (!this.chunks.has(i)) result.push(i);
    return result;
  },
  async ensure(ids) {
    // At most four requests per read. The first request starts only when the engine needs it.
    let cursor = 0;
    await Promise.all(Array.from({length: Math.min(4, ids.length)}, async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        if (!this.inflight.has(id)) this.inflight.set(id, (async () => {
          const item = this.config.chunks[id];
          const bytes = await this.fetchVerified(item.path, item);
          this.chunks.set(id, bytes); this.stats.loadedChunks.push(id);
        })());
        await this.inflight.get(id);
      }
    }));
  },
  async install(FS, config) {
    this.config = config;
    this.showBusy(true); this.status('正在准备标题画面…');
    const bootstrap = await this.fetchVerified(config.bootstrap.path, config.bootstrap);
    let cursor = 0;
    for (const id of config.bootstrap.chunks) {
      const bytes = bootstrap.slice(cursor, cursor + config.chunks[id].bytes); cursor += bytes.length;
      this.chunks.set(id, bytes); this.stats.loadedChunks.push(id);
    }
    if (cursor !== bootstrap.length) throw Error('Invalid bootstrap layout');
    FS.createDataFile('/', 'assets.arc', new Uint8Array(), true, false);
    const node = FS.lookupPath('/assets.arc').node;
    node.usedBytes = config.bytes;
    node.stream_ops = {...node.stream_ops, read: (stream, buffer, offset, length, position) => {
      const count = Math.min(length, config.bytes - position);
      if (count <= 0) return 0;
      if (this.missing(position, count).length) throw Error('Archive read was not awaited');
      for (let done = 0; done < count;) {
        const id = Math.floor((position + done) / config.chunkSize), inside = (position + done) % config.chunkSize;
        const chunk = this.chunks.get(id), part = Math.min(count - done, chunk.length - inside);
        buffer.set(chunk.subarray(inside, inside + part), offset + done); done += part;
      }
      return count;
    }};
    this.stats.bootstrapBytes = bootstrap.length; this.stats.bootstrapReadyAt = performance.now();
    this.showBusy(false);
  }
};
// Keep the suspended engine state stable. Release events are replayed after the
// resource read, so a key held before the wait cannot remain stuck afterwards.
(() => {
  const releases = new Map();
  for (const type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'wheel']) {
    window.addEventListener(type, event => {
      if (!suiDemandAsync.pending || event.target?.closest?.('#demand-loading')) return;
      if (type === 'keyup' || type === 'mouseup') releases.set(type + ':' + (event.code || event.button), {target:event.target, event});
      event.stopImmediatePropagation(); if (event.cancelable) event.preventDefault();
    }, {capture:true, passive:false});
  }
  const original = suiDemand.showBusy.bind(suiDemand);
  suiDemand.showBusy = busy => {
    original(busy);
    if (!busy) for (const [key, item] of releases) {
      releases.delete(key);
      const event = item.event;
      item.target.dispatchEvent(event.type === 'keyup' ? new KeyboardEvent(event.type, {key:event.key,code:event.code,keyCode:event.keyCode,which:event.which,bubbles:true}) : new MouseEvent(event.type, {button:event.button,clientX:event.clientX,clientY:event.clientY,bubbles:true}));
    }
  };
})();
