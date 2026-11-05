'use strict';
const C = require('../p4-bindings/common.cjs');
const {fs, path, assert, ROOT, fp, read, json, digest} = C;
const BASE = 'docs/修订协作/P4-演出与美术';
const QA = 'qa/dialogue-p4-P4-06-20261104';
const CATALOG = BASE + '/P4-05/resources.expanded.candidate.json';
function freshOutput(rel) {
  assert(/^qa\/dialogue-p4-P4-06-[^/]+(?:\/[^/]+)*$/.test(rel), '输出须在P4-06的新QA目录');
  assert(!rel.split('/').some(x => ['.', '..', ''].includes(x)) && !rel.includes('\\'), '非法输出路径');
  let p = ROOT;
  for (const part of rel.split('/')) { p = path.join(p, part); if (fs.existsSync(p)) assert(!fs.lstatSync(p).isSymbolicLink(), '禁止链接输出'); }
  assert(!fs.existsSync(p), '不覆盖已有候选/验收目录：' + rel);
  fs.mkdirSync(p, {recursive:true}); return p;
}
function write(dir, file, value) {
  assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
  const p = path.join(dir, file); fs.mkdirSync(path.dirname(p), {recursive:true});
  fs.writeFileSync(p, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
}
function walk(rel) {
  return fs.readdirSync(path.join(ROOT, rel), {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(rel+'/'+e.name):[rel+'/'+e.name]);
}
function protect() {
  const paths = new Set(['main.ray','start.novel','config.ini','docs/整合/bindings.json','docs/CG当前选择.json']);
  for (const d of ['scenario','assets/current','system','tools/compiler','tools/runtime','tools/story-revision/p4-bindings',BASE]) for (const p of walk(d)) if (!p.startsWith(BASE+'/P4-06/')) paths.add(p);
  for (const p of ['tools/integration/runtime/presentation-full.cjs','tools/integration/runtime/presentation-full.ray','tools/integration/runtime/validate.cjs']) paths.add(p);
  return [...paths].sort().map(fp);
}
function unchanged(records) { for (const r of records) assert.equal(fp(r.path).sha256,r.sha256,'受保护输入变化：'+r.path); }
module.exports = {...C, BASE, QA, CATALOG, freshOutput, write, walk, protect, unchanged};
