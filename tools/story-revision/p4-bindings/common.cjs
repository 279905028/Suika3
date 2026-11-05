'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { hash, condition } = require('../../compiler/parse.cjs');
const { safeFile, checkSchema } = require('../../integration/runtime/validate.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const DOC = 'docs/修订协作/P4-演出与美术/P4-01';
const QA = 'qa/dialogue-p4-P4-01-20261103';
const P3 = 'qa/dialogue-p3-review-20261103';
const P3_BUILD = 'b673eebf2a587ad557c97e56aea67859888c94862c8dcb6869a40579a3510353';
const PACKS = ['COMMON', 'XM', 'ZZ', 'MY', 'PI', 'HQ', 'FR'].map(x => 'P4-02-' + x);
const EXPECTED = [997, 681, 803, 566, 721, 500, 480];
const read = p => fs.readFileSync(safeFile(ROOT, p));
const json = p => JSON.parse(read(p));
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
const digest = x => hash(JSON.stringify(canonical(x)));
const fp = p => { const b = read(p); return { path: p, sha256: hash(b), bytes: b.length }; };
function write(p, value) {
  assert(p.startsWith(DOC + '/') || p.startsWith(QA + '/'), '只写P4-01独占目录');
  const target = path.join(ROOT, p);
  let parent = path.dirname(target);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  assert.equal(fs.realpathSync(parent), parent, '输出禁止符号链接');
  if (fs.existsSync(target)) assert(!fs.lstatSync(target).isSymbolicLink(), '输出文件禁止符号链接');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}
function owner(file, R) {
  const code = { xiaoman: 'XM', zhouzhi: 'ZZ', mengyao: 'MY', piao: 'PI', huangqiuqiu: 'HQ', friends: 'FR' };
  const r = R.routes.find(r => r.file === path.basename(file));
  return 'P4-02-' + (r ? code[r.id] : 'COMMON');
}
function guards(ir) {
  const result = new Map();
  for (const file of Object.keys(ir.entries)) {
    const list = ir.nodes.filter(n => n.source.file === file);
    const index = new Map(list.map((n, i) => [n.id, i]));
    for (const [i, n] of list.entries()) {
      const parents = list.filter((b, j) => b.op === 'branch' && j < i && i < index.get(b.otherwise));
      const dnf = parents.reduce((a, b) => a.flatMap(g => b.condition.map(h => [...g, ...h])), [[]]);
      result.set(n.id, dnf.map(g => g.map(t => t.field + t.operator + t.value).join('&')).join('|') || 'ALL');
    }
  }
  return result;
}
function parseCondition(expr, ir) {
  return expr === 'ALL' ? [] : condition(expr, ir.choices, ir.contract.routes.flatMap(r => [...r.endings, ...(r.lowPathEndings || [])]));
}
function envelope(packageId, inputFingerprint) {
  return { schemaVersion: 'p4-package-v1', packageId, inputFingerprint, contentBuildId: P3_BUILD };
}
const neutral = () => ({ background: null, characters: [], props: [], cg: null });
module.exports = { fs, path, assert, hash, ROOT, DOC, QA, P3, P3_BUILD, PACKS, EXPECTED, read, json, canonical, digest, fp, write, owner, guards, parseCondition, envelope, neutral, checkSchema };
