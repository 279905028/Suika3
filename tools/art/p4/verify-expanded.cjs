#!/usr/bin/env node
'use strict';
// 最终资源复验：原245版本证据保留，新20CG单独测量/目视后联合交接。
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const V = require('../../story-revision/p4-bindings/validate.cjs');
const root = path.resolve(__dirname, '../../..');
const qa = 'qa/dialogue-p4-P4-05-20261103';
const sub = qa + '/cg110-129';
const doc = 'docs/修订协作/P4-演出与美术/P4-05';
const updoc = 'docs/修订协作/P4-演出与美术/CG扩充20张';
const output = process.argv[2];
assert(output && output.startsWith('qa/') && !output.split('/').includes('..') && !fs.existsSync(path.join(root, output)), '输出必须是新QA文件');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const fp = p => ({ path: p, sha256: hash(p) });
const checkFile = f => assert.equal(hash(f.path), f.sha256, f.path);
const ctx = V.loadContext();
const oldCatalog = read(doc + '/resources.candidate.json');
const expanded = read(doc + '/resources.expanded.candidate.json');
const oldResources = V.resourceCatalog(ctx, oldCatalog);
assert.equal(oldResources.assets.size, 242);
assert.equal(oldResources.cgs.size, 61);
assert.equal(expanded.assets.length, 262);
assert.equal(expanded.cg.length, 81);
// 原检查器对全部262项资产执行真实校验；新增20CG登记路径的门禁单列，不伪造04路径。
const assetsOnly = { ...expanded, cg: oldCatalog.cg };
const resources = V.resourceCatalog(ctx, assetsOnly);
assert.equal(resources.assets.size, 262);
assert.throws(() => V.resourceCatalog(ctx, expanded), /新CG编号须P4-04登记证据/);
assert.equal(new Set(expanded.cg.map(c => c.cgId)).size, 81);
assert.equal(new Set(expanded.cg.map(c => c.assetId)).size, 81);
const registrations = read(updoc + '/cg-registration.json');
assert.equal(registrations.nextUnallocatedId, 'CG130');
assert.equal(registrations.candidateTotal, 81);
for (const r of registrations.newRegistrations) {
  const c = expanded.cg.find(c => c.cgId === r.cgId);
  assert(c && c.assetId === r.assetId && !ctx.retiredCG.has(c.cgId));
  assert.equal(resources.assets.get(c.assetId).type, 'cg');
  assert.deepEqual(c.registrationEvidence, fp(updoc + '/cg-registration.json'));
}
const protectedFiles = new Map();
for (const p of [qa + '/input-manifest.json', sub + '/input-manifest.json']) {
  for (const f of read(p).files) {
    if (protectedFiles.has(f.path)) assert.equal(protectedFiles.get(f.path).sha256, f.sha256);
    protectedFiles.set(f.path, f);
  }
}
[...protectedFiles.values()].forEach(checkFile);
const provenance = new Map();
for (const p of [qa + '/provenance-check.json', sub + '/provenance-check.json']) {
  for (const f of read(p).files) provenance.set(f.path, f);
}
[...provenance.values()].forEach(checkFile);
const records = read(doc + '/inspection-results.expanded.json').records;
assert.equal(records.length, 265);
assert.equal(new Set(records.map(r => r.recordId)).size, 265);
assert.equal(records.filter(r => r.selected).length, 262);
const baselineObservations = read(qa + '/visual-observations.json');
const notes = new Map(baselineObservations.sheetObservations.map(r => [r.sheet, r]));
const additionalObservations = read(sub + '/visual-observations.json');
assert.equal(additionalObservations.records.length, 20);
assert(additionalObservations.records.every(r => r.status === 'passed' && r.fullImageViewed && r.overlayViewed));
const sheets = [...read(qa + '/preview-index.json').sheets, ...read(sub + '/preview-index.json').sheets];
const viewed = new Set();
for (const s of sheets) {
  checkFile(s);
  if (!s.path.includes('/cg110-129/')) assert(notes.get(path.basename(s.path, '.png')).result.startsWith('passed'));
  else assert(additionalObservations.overlaySheetsViewed.includes(s.path));
  for (const item of s.items) { assert(!viewed.has(item.recordId)); viewed.add(item.recordId); }
}
assert.equal(viewed.size, 265);
let transparent = 0;
for (const row of records) {
  assert(viewed.has(row.recordId));
  checkFile(row.checkEvidence);
  const r = read(row.checkEvidence.path);
  assert.equal(r.recordId, row.recordId);
  assert.equal(r.inspectionStatus, 'passed');
  assert.equal(r.visual.status, 'passed');
  assert(Object.values(r.checks).every(v => v === true));
  [r.source, r.runtime, r.technical.runtime, r.visual.sheet, r.visual.observationRecord].forEach(checkFile);
  assert.equal(r.technical.source.rgbaSha256, r.technical.runtime.rgbaSha256);
  assert.equal(r.runtime.sha256, r.technical.runtime.sha256);
  if (r.visual.detail) r.visual.detail.evidence.forEach(checkFile);
  if (r.visual.evidence) r.visual.evidence.forEach(checkFile);
  if (r.technical.runtime.alpha.extrema[0] < 255) {
    transparent++;
    assert.equal(r.visual.method, 'alpha-four-background-and-native-crops');
    assert.equal(r.visual.location.nativeCrops.length, 4);
    assert(r.visual.location.nativeCrops.every(c => c.scale === 1));
  }
  if (row.selected) {
    const a = resources.assets.get(row.assetId);
    assert.deepEqual(a.source, r.source);
    assert.deepEqual(a.runtime, r.runtime);
    assert.deepEqual(a.checkEvidence, row.checkEvidence);
    assert.equal(a.reviewStatus, r.catalogReviewStatus);
  }
}
assert.equal(transparent, 92);
const derivatives = ['runtime-derivatives.json', 'runtime-derivatives.cg110-129.json'].flatMap(p => read('assets/sources/20261103/P4-05/' + p).records);
assert.equal(derivatives.length, 39);
for (const d of derivatives) {
  [d.source, d.archiveWebP, d.runtimeCandidate].forEach(checkFile);
  assert.equal(d.archiveWebP.sha256, d.runtimeCandidate.sha256);
  assert(d.rgbaPixelsEqualToSource && !d.resized && !d.recompressed && d.metadata.losslessWebP);
}
const pending = expanded.assets.filter(a => a.reviewStatus === 'pending');
assert.equal(pending.length, 39);
assert(pending.every(a => a.approvalEvidence === null && a.checkEvidence));
const plans = read(updoc + '/binding-plans.json');
assert.equal(plans.inputFingerprint, ctx.input.inputFingerprint);
assert.equal(plans.contentBuildId, ctx.input.contentBuildId);
assert.equal(plans.records.length, 20);
for (const p of plans.records) {
  const n = ctx.byNode.get(p.anchor.nodeId);
  assert(n);
  assert.deepEqual(p.proposedNodeIds, [n.nodeId]);
  assert.equal(p.packageId, n.packageId);
  assert.equal(p.anchor.paragraphId, n.paragraphId);
  assert.equal(p.text, n.page.text);
  assert.equal(p.anchor.condition, n.condition);
  assert.deepEqual(p.anchor.routeIds, n.routeIds);
  assert.deepEqual(p.anchor.entryGate, n.entryGate);
  assert.deepEqual(p.anchor.source, n.source);
  assert.equal(p.plannedEnter.cg.assetId, p.assetId);
  assert.equal(p.status, 'planned-not-applied');
  assert.equal(p.readyForBinding, false);
  assert.equal(p.plannedExit.clearCg, true);
  assert.equal(p.plannedExit.destination, 'recompute-actual-target');
}
const packResults = ['COMMON', 'XM', 'ZZ', 'MY', 'PI', 'HQ', 'FR'].map(k => {
  const id = 'P4-02-' + k;
  return V.validatePack(ctx, id, V.readPackage('docs/修订协作/P4-演出与美术/' + id), { mode: 'draft', resources });
});
const report = {
  date: '2026-11-04', status: 'PASS_P4_05_OFFLINE_RESOURCE_HANDOFF_WITH_INTEGRATION_DEPENDENCIES',
  inputFingerprint: ctx.input.inputFingerprint, contentBuildId: ctx.input.contentBuildId, interfaceFingerprint: ctx.seal.interfaceFingerprint,
  counts: { versions: 265, sourceAndWebP: 530, candidateAssets: 262, transparentAssets: transparent, cg: 81,
    runtimeCandidates: 39, catalogPassed: 223, pendingAdoptionEvidence: 39,
    protectedFilesUnchanged: protectedFiles.size, checkedProvenanceFiles: provenance.size,
    contactSheetsViewed: sheets.length, additionalFullImagesViewed: 20, additionalReferenceBoardsViewed: 6,
    compatibleDraftPackages: 7, assignedBindings: packResults.reduce((n, p) => n + p.counts.assignedBindings, 0),
    additionalBindingPlansChecked: 20, additionalBindingsApplied: 0 },
  priorVerification: fp(qa + '/verification.json'), resourceCatalog: fp(doc + '/resources.expanded.candidate.json'),
  originalCompatibleCatalog: fp(doc + '/resources.candidate.json'),
  registrationInterface: { status: 'blocked-for-full-expanded-catalog', assetSchemaAndFiles: 'passed-262-assets',
    originalCGRegistration: 'passed-61-cg', additionalRegistrationIdsAndFiles: 'passed-20-cg',
    rejectedByOriginalChecker: '新CG编号须P4-04登记证据', owner: 'P4-06/P4-07',
    reason: '新增20CG真实登记位于CG扩充20张目录，不在冻结检查器的新编号登记路径白名单；未篡改旧工具或伪造04证据。' },
  packResults, handoffReadyForP4_07Adoption: false,
  pending: ['39项采用依据登记', '新增20CG登记入口接入', 'P4-02需求/边界和20计划锚点闭合及小满重冻结', 'P4-06全图提示和81项图鉴接入', 'P4-07统一采用'],
  notTested: ['引擎', '游戏浏览器', '手机真机', '电脑原生', '存档/回退/改选/刷新', '发布']
};
fs.mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
fs.writeFileSync(path.join(root, output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, ...report.counts, registrationInterface: report.registrationInterface.status }));
