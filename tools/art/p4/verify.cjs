#!/usr/bin/env node
'use strict';
// 本批目录与P4-01/02接口实接检查；不写其他任务，不执行游戏。
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const V = require('../../story-revision/p4-bindings/validate.cjs');
const root = path.resolve(__dirname, '../../..');
const qa = 'qa/dialogue-p4-P4-05-20261103';
const doc = 'docs/修订协作/P4-演出与美术/P4-05';
const output = process.argv[2];
assert(output && output.startsWith('qa/') && !output.split('/').includes('..') && !fs.existsSync(path.join(root, output)), '输出必须是尚不存在的工程QA文件');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const checkFile = p => assert.equal(hash(p.path), p.sha256, p.path);
const ctx = V.loadContext();
const candidate = read(doc + '/resources.candidate.json');
const resources = V.resourceCatalog(ctx, candidate);
assert.equal(resources.assets.size, 242);
assert.equal(resources.cgs.size, 61);
const approvalsPending = candidate.assets.filter(a => a.reviewStatus === 'pending');
assert.equal(approvalsPending.length, 19);
assert(approvalsPending.every(a => a.approvalEvidence === null && a.checkEvidence));
const protectedFiles = read(qa + '/input-manifest.json').files;
protectedFiles.forEach(checkFile);
const provenance = read(qa + '/provenance-check.json');
provenance.files.forEach(checkFile);
assert.equal(provenance.records.length, 245);
const results = read(doc + '/inspection-results.json');
assert.equal(results.records.length, 245);
assert.equal(new Set(results.records.map(r => r.recordId)).size, 245);
assert.equal(results.records.filter(r => r.selected).length, 242);
const observations = read(qa + '/visual-observations.json');
const notes = new Map(observations.sheetObservations.map(x => [x.sheet, x]));
const previews = read(qa + '/preview-index.json');
const viewed = new Map();
for (const sheet of previews.sheets) {
  checkFile(sheet);
  assert(notes.get(path.basename(sheet.path, '.png')).result.startsWith('passed'));
  for (const item of sheet.items) {
    assert(!viewed.has(item.recordId));
    viewed.set(item.recordId, item);
  }
}
assert.equal(viewed.size, 245);
let alphaCount = 0;
for (const record of results.records) {
  checkFile(record.checkEvidence);
  const r = read(record.checkEvidence.path);
  assert.equal(r.recordId, record.recordId);
  assert.equal(r.inspectionStatus, 'passed');
  assert.equal(r.visual.status, 'passed');
  assert(Object.values(r.checks).every(x => x === true));
  checkFile(r.source); checkFile(r.runtime); checkFile(r.visual.sheet);
  checkFile(r.visual.observationRecord);
  assert.equal(r.technical.source.rgbaSha256, r.technical.runtime.rgbaSha256);
  assert.equal(r.runtime.sha256, r.technical.runtime.sha256, '运行候选须与实查归档字节相同');
  if (r.visual.detail) r.visual.detail.evidence.forEach(checkFile);
  if (r.technical.runtime.alpha.extrema[0] < 255) {
    alphaCount++;
    assert.equal(r.visual.method, 'alpha-four-background-and-native-crops');
    assert.equal(r.visual.location.nativeCrops.length, 4);
    assert(r.visual.location.nativeCrops.every(x => x.scale === 1));
  }
  if (record.selected) {
    const a = resources.assets.get(record.assetId);
    assert.deepEqual(a.source, r.source);
    assert.deepEqual(a.runtime, r.runtime);
    assert.equal(a.reviewStatus, r.catalogReviewStatus);
    assert.deepEqual(a.checkEvidence, record.checkEvidence);
  }
}
assert.equal(alphaCount, 92);
const derivativeFile = 'assets/sources/20261103/P4-05/runtime-derivatives.json';
const derivatives = read(derivativeFile).records;
assert.equal(derivatives.length, 19);
for (const d of derivatives) {
  [d.source, d.archiveWebP, d.runtimeCandidate].forEach(checkFile);
  assert.equal(d.runtimeCandidate.sha256, d.archiveWebP.sha256);
  assert(d.rgbaPixelsEqualToSource && !d.resized && !d.recompressed && d.metadata.losslessWebP);
  assert.equal(d.adoptionStatus, 'not-adopted');
}
const packResults = [];
for (const key of ['COMMON', 'XM', 'ZZ', 'MY', 'PI', 'HQ', 'FR']) {
  const id = 'P4-02-' + key;
  packResults.push(V.validatePack(ctx, id, V.readPackage('docs/修订协作/P4-演出与美术/' + id), { mode: 'draft', resources }));
}
// 实际新目录验证缺批准不得伪装passed、错误字节不得作为复验文件。
const bogusPass = structuredClone(candidate);
bogusPass.assets.find(a => a.approvalEvidence === null).reviewStatus = 'passed';
assert.throws(() => V.resourceCatalog(ctx, bogusPass), /缺批准/);
const bogusHash = structuredClone(candidate);
bogusHash.assets[0].runtime.sha256 = '0'.repeat(64);
assert.throws(() => V.resourceCatalog(ctx, bogusHash), /漂移/);
const report = {
  date: '2026-11-04', status: 'PASS_P4_05_OFFLINE_RESOURCE_HANDOFF',
  inputFingerprint: ctx.input.inputFingerprint, contentBuildId: ctx.input.contentBuildId,
  interfaceFingerprint: ctx.seal.interfaceFingerprint,
  counts: { versions: 245, sourceAndWebP: 490, candidateAssets: 242, transparentAssets: alphaCount,
    cg: 61, runtimeCandidates: derivatives.length, catalogPassed: 223, pendingAdoptionEvidence: 19,
    protectedFilesUnchanged: protectedFiles.length, checkedProvenanceFiles: provenance.files.length,
    contactSheetsViewed: previews.sheets.length, detailedAssetsViewed: observations.detailObservations.length,
    compatibleDraftPackages: 7, assignedBindings: packResults.reduce((n, p) => n + p.counts.assignedBindings, 0) },
  resourceCatalog: { path: doc + '/resources.candidate.json', sha256: hash(doc + '/resources.candidate.json') },
  checks: ['P4-01输入与接口指纹', '1686份受保护文件保持', '逐文件来源记录和SHA-256',
    '245个版本解码/像素测量证据与实际文件对应', '40张目视表及92项四底/原像素裁片覆盖',
    '19份运行候选与上游无损归档逐字节一致', '242项目录/61CG格式和编号', '七包draft使用新目录实接',
    '缺批准冒充passed被拒绝', '错误运行指纹被拒绝'],
  packResults, handoffReadyForP4_07Adoption: false,
  pending: ['19项采用依据登记', 'P4-02资源/边界闭合及小满重冻结', 'P4-06提示和61项图鉴接入', 'P4-07统一采用'],
  notTested: ['引擎', '浏览器', '手机真机', '电脑原生', '存档/回退/改选/刷新', '发布']
};
fs.mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
fs.writeFileSync(path.join(root, output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, ...report.counts }));
