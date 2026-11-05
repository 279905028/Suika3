'use strict';
const C = require('../p4-bindings/common.cjs');
const BASE = 'docs/修订协作/P4-演出与美术';
const DOC = BASE + '/P4-07';
const QA = 'qa/dialogue-p4-P4-07-20261104';
const VERSION = 'sui-p4-07-20261104-v7';
function write(rel, value) {
  C.assert(!C.path.isAbsolute(rel) && !rel.split('/').includes('..'));
  const p = C.path.join(C.ROOT, rel);
  C.fs.mkdirSync(C.path.dirname(p), {recursive:true});
  C.fs.writeFileSync(p, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value,null,2)+'\n');
}
function walk(rel) {
  return C.fs.readdirSync(C.path.join(C.ROOT,rel),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(rel+'/'+e.name):[rel+'/'+e.name]);
}
const evidence = rel => { const f=C.fp(rel); return {path:f.path,sha256:f.sha256}; };
const clone = x => structuredClone(x);
module.exports = {...C, BASE, DOC, QA, VERSION, write, walk, evidence, clone};
