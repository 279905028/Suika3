// P4-03 收件快照；只写本包QA，不修改上游需求。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const C = require('../../tools/story-revision/p4-bindings/common.cjs');
const V = require('../../tools/story-revision/p4-bindings/validate.cjs');
const outputName = process.argv[2];
assert(/^intake-[a-z0-9-]+\.json$/.test(outputName || ''), '须指定本批新收件快照名');
const output = path.join(__dirname, outputName);
assert(!fs.existsSync(output), '不覆盖已存快照');
const ctx = V.loadContext();
const packages = [];
for (const packageId of C.PACKS) {
  const dir = 'docs/修订协作/P4-演出与美术/' + packageId;
  const names = Object.values(V.NAMES).map(n => dir + '/' + n);
  if (!names.every(n => fs.existsSync(path.join(C.ROOT, n)))) {
    packages.push({packageId, status:'not-delivered', missing: names.filter(n => !fs.existsSync(path.join(C.ROOT,n)))});
    continue;
  }
  const before = names.map(C.fp);
  const documents = V.readPackage(dir);
  const checked = V.validatePack(ctx, packageId, documents, {mode:'draft'});
  assert.deepEqual(before, names.map(C.fp), '收件期间上游仍在改写，请用新快照重试');
  packages.push({packageId, status:'draft-valid', files:before, validation:checked, needs:documents.needs.needs});
}
const grouped = new Map();
for (const pack of packages) for (const need of pack.needs || []) {
  if (need.ownerTask !== 'P4-03') continue;
  if (!grouped.has(need.resourceKey)) grouped.set(need.resourceKey, {resourceKey:need.resourceKey, kind:need.kind, needIds:[], packageIds:[], nodeIds:[], constraints:[]});
  const group = grouped.get(need.resourceKey);
  assert.equal(group.kind, need.kind, '同键不同类型');
  group.needIds.push(need.needId); group.packageIds.push(pack.packageId);
  group.nodeIds.push(...need.nodeIds); group.constraints.push(...need.constraints);
}
for (const group of grouped.values()) {
  group.nodeIds = [...new Set(group.nodeIds)];
  group.constraints = [...new Set(group.constraints)];
}
const result = {schemaVersion:'p4-03-intake-v1', date:'2026-11-03', taskId:'P4-03',
  inputFingerprint:ctx.input.inputFingerprint, interfaceFingerprint:ctx.seal.interfaceFingerprint,
  contentBuildId:ctx.input.contentBuildId, packages, groups:[...grouped.values()],
  counts:{received:packages.filter(p => p.status==='draft-valid').length, needs:[...grouped.values()].reduce((a,g)=>a+g.needIds.length,0), resourceKeys:grouped.size}};
fs.writeFileSync(output, JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(C.ROOT,output),...result.counts}));
