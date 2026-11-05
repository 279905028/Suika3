'use strict';
// Binaryen Asyncify bridge for this frozen Emscripten build. Only archive reads suspend.
// Design reference: https://emscripten.org/docs/porting/asyncify.html
window.suiDemandAsync = {
  raw: null, depth: 0, pending: false, data: 0, value: null, wrappers: new WeakMap(),
  install(exports) {
    this.raw = exports;
    const wrapped = {};
    for (const [name, value] of Object.entries(exports)) {
      wrapped[name] = typeof value === 'function' && !name.startsWith('asyncify_') ? this.wrap(value) : value;
    }
    return wrapped;
  },
  wrap(fn) {
    if (this.wrappers.has(fn)) return this.wrappers.get(fn);
    const bridge = this;
    const wrapped = function (...args) {
      if (bridge.depth) return fn(...args);
      // Input callbacks are blocked while suspended; allocator/stack helpers may
      // still be called by the shell and must keep their normal synchronous ABI.
      bridge.depth++;
      let result;
      try { result = fn(...args); } finally { bridge.depth--; }
      if (bridge.raw.asyncify_get_state() !== 1) return result;
      bridge.pending = true;
      window.suiDemand?.showBusy(true);
      return (async () => {
        try {
          while (bridge.raw.asyncify_get_state() === 1) {
            bridge.raw.asyncify_stop_unwind();
            bridge.value = await bridge.value;
            bridge.raw.asyncify_start_rewind(bridge.data);
            bridge.depth++;
            try { result = fn(...args); } finally { bridge.depth--; }
          }
          if (bridge.raw.asyncify_get_state() !== 0) throw Error('Unexpected archive resume state');
          return result;
        } finally {
          bridge.pending = false;
          window.suiDemand?.showBusy(false);
        }
      })();
    };
    this.wrappers.set(fn, wrapped);
    return wrapped;
  },
  importRead(read, environment) {
    return (...args) => {
      if (this.raw.asyncify_get_state() === 2) {
        this.raw.asyncify_stop_rewind();
        return this.value;
      }
      const {FS, HEAPU32} = environment(), stream = FS.streams[args[0]];
      if (stream?.path !== '/assets.arc') return read(...args);
      let length = 0;
      for (let i = 0; i < args[2]; i++) length += HEAPU32[(args[1] + i * 8 + 4) >> 2];
      const missing = suiDemand.missing(stream.position, length);
      if (!missing.length) return read(...args);
      if (!this.data) {
        const capacity = 1024 * 1024;
        this.data = this.raw.malloc(capacity + 8);
        if (!this.data) throw Error('Unable to allocate archive continuation stack');
        new Uint32Array(this.raw.memory.buffer, this.data, 2).set([this.data + 8, this.data + 8 + capacity]);
      }
      this.value = suiDemand.ensure(missing).then(() => read(...args));
      this.raw.asyncify_start_unwind(this.data);
      return 0;
    };
  },
  frame(callback, args, next) {
    if (this.pending) { requestAnimationFrame(() => this.frame(callback, args, next)); return; }
    const result = callback(...args);
    if (result && typeof result.then === 'function') {
      result.then(again => { if (again) requestAnimationFrame(next); }).catch(error => suiDemand.fail(error));
    } else if (result) requestAnimationFrame(next);
  }
};
