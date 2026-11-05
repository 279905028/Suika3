'use strict';
// Download cache is independent of the engine's player-save databases.
window.suiLoadCoreArchive = async function (url, expected) {
  const stats = window.suiCoreLoadStats = {startedAt: performance.now(), source: 'network', networkBytes: 0, retries: 0, cacheStored: false};
  const status = message => { if (!window.suie?.ready) window.suie?.status(message); };
  const digest = async bytes => {
    if (!globalThis.crypto?.subtle) return;
    const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (actual !== expected.sha256) throw new Error('Downloaded game resource checksum mismatch');
  };
  let cache;
  try {
    if (window.isSecureContext && 'caches' in window) {
      cache = await caches.open('suika3-core-downloads-v1');
      const saved = await cache.match(url);
      if (saved) {
        status('正在读取已缓存的游戏资源…');
        const bytes = new Uint8Array(await saved.arrayBuffer());
        if (bytes.length !== expected.bytes) throw new Error('Cached game resource size mismatch');
        await digest(bytes);
        stats.source = 'local-cache'; stats.completedAt = performance.now(); stats.cacheStored = true;
        status('游戏资源已就绪，正在打开…');
        return bytes;
      }
    }
  } catch (error) {
    stats.cacheReadError = String(error);
    if (cache) await cache.delete(url).catch(() => {});
  }
  const bytes = new Uint8Array(expected.bytes);
  let offset = 0;
  for (let attempt = 0; offset < bytes.length; attempt++) {
    const controller = new AbortController();
    let timer;
    const heartbeat = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), 45000); };
    try {
      heartbeat();
      const response = await fetch(url, {credentials: 'same-origin', headers: offset ? {Range: 'bytes=' + offset + '-'} : {}, signal: controller.signal});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      if (response.status === 206) {
        const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
        if (!range || Number(range[1]) !== offset || Number(range[3]) !== bytes.length) throw new Error('Invalid download range');
      } else if (response.status === 200) offset = 0;
      else throw new Error('Unexpected resource response');
      const reader = response.body.getReader();
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        heartbeat();
        if (offset + value.length > bytes.length) throw new Error('Game resource exceeds expected size');
        bytes.set(value, offset); offset += value.length; stats.networkBytes += value.length;
        stats.receivedBytes = offset;
        status('正在载入游戏资源：' + Math.floor(offset / bytes.length * 100) + '%（' + (offset / 1048576).toFixed(1) + ' / ' + (bytes.length / 1048576).toFixed(1) + ' MB）');
      }
      if (offset !== bytes.length) throw new Error('Incomplete game resource');
    } catch (error) {
      controller.abort();
      if (attempt >= 3) throw error;
      stats.retries++; status('连接暂时中断，正在继续下载…');
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    } finally { clearTimeout(timer); }
  }
  status('正在校验游戏资源…');
  await digest(bytes);
  stats.completedAt = performance.now();
  if (cache) {
    stats.cacheWrite = cache.put(url, new Response(bytes, {headers: {'Content-Type': 'application/octet-stream'}})).then(async () => {
      stats.cacheStored = true;
      for (const key of await cache.keys()) {
        const old = new URL(key.url);
        if (key.url !== url && old.origin === location.origin && /^\/r\/[^/]+\/assets\.arc$/.test(old.pathname)) await cache.delete(key);
      }
    }).catch(error => { stats.cacheWriteError = String(error); });
  }
  status('游戏资源已就绪，正在打开…');
  return bytes;
};
window.suiLoadCoreError = function () {
  window.suie?.status('游戏资源未能下载完成，请刷新页面重试。', true);
};
