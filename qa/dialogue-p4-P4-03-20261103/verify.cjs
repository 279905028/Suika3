'use strict';
// 交付完整性检查，不采用正文/资源，也不代替P4-05独立图片复验。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const C = require('../../tools/story-revision/p4-bindings/common.cjs');
const V = require('../../tools/story-revision/p4-bindings/validate.cjs');
const D = 'docs/修订协作/P4-演出与美术/P4-03';
const Q = 'qa/dialogue-p4-P4-03-20261103';
const ctx = V.loadContext();
const checks = [];
function check(name, fn) { const detail = fn(); checks.push({name, status:'passed', detail:detail ?? null}); }
const intake = C.json(Q+'/intake-final.json');
const decisions = C.json(D+'/decisions.json');
const records = C.json(D+'/resource-records.json');
const catalogDoc = C.json(D+'/resources.candidate.json');
const inventory = C.json(Q+'/inventory.json');
check('冻结输入及接口保持', () => {
  const snap = C.json(Q+'/input-snapshot.json');
  for (const f of snap.files) assert.deepEqual(C.fp(f.path), f);
  assert.equal(snap.files.length,576);
  return {files:576, inputFingerprint:ctx.input.inputFingerprint, interfaceFingerprint:ctx.seal.interfaceFingerprint};
});
check('七包收件未漂移', () => {
  assert.equal(intake.packages.length,7);
  for (const p of intake.packages) {assert.equal(p.status,'draft-valid'); for (const f of p.files) assert.deepEqual(C.fp(f.path),f);}
  assert.deepEqual(intake, C.json(Q+'/intake-complete.json'));
  return {packages:7, files:28};
});
const allNeeds = intake.packages.flatMap(p=>p.needs).filter(n=>n.ownerTask==='P4-03');
check('23需求20键完整处置且保持来源条件', () => {
  V.equalSet(decisions.decisions.map(d=>d.resourceKey),intake.groups.map(g=>g.resourceKey),'资源键');
  V.equalSet(decisions.decisions.flatMap(d=>d.needIds),allNeeds.map(n=>n.needId),'需求ID');
  assert.equal(decisions.decisions.length,20); assert.equal(allNeeds.length,23);
  for (const d of decisions.decisions) {
    const g = intake.groups.find(g=>g.resourceKey===d.resourceKey);
    V.equalSet(d.requestNodeIds,g.nodeIds,d.resourceKey+'节点');
    V.equalSet(d.nodeScopes.map(n=>n.nodeId),g.nodeIds,d.resourceKey+'条件范围');
    for (const n of d.nodeScopes) {
      const frozen=ctx.byNode.get(n.nodeId);
      assert.equal(n.condition,frozen.condition); assert.equal(n.packageId,frozen.packageId); assert.equal(n.paragraphId,frozen.paragraphId);
    }
    for (const ids of Object.values(d.assetNodeScopes)) for (const id of ids) assert(g.nodeIds.includes(id),'资源适用越界');
    for (const id of d.offscreenNodeIds||[]) {
      assert(g.nodeIds.includes(id));
      for (const ids of Object.values(d.assetNodeScopes)) assert(!ids.includes(id),'画外节点又绑定资源');
    }
    for (const e of d.evidence) assert.equal(C.fp(e.path).sha256,e.sha256,'处置证据漂移');
  }
  return {needs:23,keys:20,sourceNeedsOpen:allNeeds.filter(n=>n.status==='open').length,sourceNeedsResolved:allNeeds.filter(n=>n.status==='resolved').length};
});
let resources;
check('241项候选目录通过统一格式且全部待复验', () => {
  resources=V.resourceCatalog(ctx,catalogDoc);
  assert.equal(resources.assets.size,241); assert.equal(resources.cgs.size,60);
  assert.deepEqual(catalogDoc.assets.slice(0,226),ctx.baseline.assets);
  assert.deepEqual(catalogDoc.cg,ctx.baseline.cg);
  assert(catalogDoc.assets.every(a=>a.reviewStatus==='pending'));
  for (const d of decisions.decisions) for (const id of d.assetIds) assert(resources.assets.has(id),'引用缺资源');
  return {existing:226,added:15,cgUnchanged:60,passed:0};
});
check('15张选定图与生成/复用来源闭合', () => {
  assert.equal(records.assets.length,15);
  assert.equal(records.assets.filter(a=>a.type==='character').length,2);
  assert.equal(records.assets.filter(a=>a.origin==='generated-this-batch').length,14);
  for (const r of records.assets) {
    assert(r.source.path.startsWith('assets/sources/20261103/P4-03/'));
    for (const f of [r.source,r.archiveWebP,r.productionEvidence,...r.references]) assert.equal(C.fp(f.path).sha256,f.sha256);
    assert(r.encoding.rgbaPixelEqual && r.encoding.lossless);
    assert.equal(r.reviewStatus,'pending');
    assert.equal(resources.assets.get(r.assetId).source.path,r.source.path);
    assert.equal(resources.assets.get(r.assetId).runtime.path,r.archiveWebP.path);
    assert(decisions.decisions.some(d=>d.assetIds.includes(r.assetId)),'孤立制作资源');
  }
  const reused=records.assets.find(a=>a.origin==='reused-source-copy');
  assert.equal(reused.source.sha256,reused.references[0].sha256);
  return {selected:15,newOrRepaired:14,sourceReuse:1};
});
check('关键处置边界', () => {
  const d = Object.fromEntries(decisions.decisions.map(d=>[d.resourceKey,d]));
  assert.equal(d['xiaoman-helmets-day53-continuity'].producerStatus,'escalated-to-coordinator');
  assert.equal(allNeeds.find(n=>n.needId==='P4-02-XM-N002').status,'open');
  assert.equal(d['my-guiyang-elevator'].decision,'offscreen');
  assert.deepEqual(d['my-guiyang-elevator'].assetIds,[]);
  V.equalSet(d['guiyang-bus-stop-day'].assetNodeScopes['bg-guiyang-bus-stop-evening'],['T-PI-000793_1','T-PI-000794_1','T-PI-000795_1','T-PI-000796_1'],'AA晚间站台');
  assert(d['old-netcafe-yard-door-closed-night'].offscreenNodeIds.includes('T-HQ-000277_1'));
  assert(d['zhouzhi-day30-work-skirt'].scopeExtension);
  return {headgear:'pending-text-refreeze',busStop:'4-evening-2-day-7-offscreen',hqMixedTime:'offscreen',workSkirt:'scope-extension-candidate'};
});
const report={taskId:'P4-03',date:'2026-11-03',status:'PASS_PRODUCER_DELIVERY_ONLY',inputFingerprint:ctx.input.inputFingerprint,
  contentBuildId:ctx.input.contentBuildId,interfaceFingerprint:ctx.seal.interfaceFingerprint,checks,
  inventoryCounts:inventory.counts,producerNeeds:decisions.counts,
  unperformed:['P4-05独立图片复验与运行衍生','P4-02需求/绑定闭合','头盔正文重冻结','P4-07采用','引擎/浏览器/手机/原生/存读档/发布']};
const output=path.join(C.ROOT,Q,'verification-final.json');assert(!fs.existsSync(output),'不覆盖验证记录');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.length,needs:allNeeds.length,assets:records.assets.length,frozenFiles:576}));
