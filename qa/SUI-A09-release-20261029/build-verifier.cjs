'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
let code=fs.readFileSync(path.join(root,'qa/SUI-A09-selection-20261029/verify.cjs'),'utf8');
code=code.replace("review=load('qa/SUI-A09-selection-20261029/review-approved.json'),s=load('docs/CG当前选择.json')","review=load('qa/SUI-A09-release-20261029/review-released.json'),s=load('qa/SUI-A09-release-20261029/selection-released.json')");
code=code.replace("task:'SUI-A09补选集成'","task:'SUI-A09全部上游参考放行'");
code=code.replace("layer:'当前正文解析/逐镜语义与可达性/文件检查；未运行引擎或加载CG'","layer:'当前正文与双分页锚点/逐镜条件可达性/上游冻结参考及格式证据；未运行引擎或加载CG'");
function replaceCheck(startName,endName,newCode){
 const start=code.indexOf("check('"+startName),end=code.indexOf("check('"+endName,start);
 if(start<0||end<0)throw new Error('source check not found');
 code=code.slice(0,start)+newCode+'\n'+code.slice(end);
}
replaceCheck('60项正式选择','60镜当前原文',String.raw`check('60项选择不变、全部上游依赖有具体参考、7包共同放行',()=>{
 const old=load('qa/SUI-A09-selection-20261029/review-approved.json'),before=load('qa/SUI-A09-release-20261029/selection-before.json');
 assert.equal(shots.length,60);assert.equal(new Set(shots.map(r=>r.id)).size,60);
 assert.equal(s.activeCount,60);assert.equal(s.productionReady,true);
 for(const k of ['originalTarget','originalSelectedIds','retiredRouteIds','sourceSelection','sourceSha256','activeSelectedIds','approvedAdditionalIds','selectionDecision','previousSelection'])assert.deepEqual(s[k],before[k],k);
 assert.equal(s.items.length,68);assert.equal(s.items.filter(r=>r.productionReady).length,60);
 for(const row of s.items){const prev=before.items.find(x=>x.id===row.id);for(const[k,v]of Object.entries(prev)){if(s.activeSelectedIds.includes(row.id)&&['status','productionReady'].includes(k))continue;assert.deepEqual(row[k],v,row.id+' original selection '+k);}}
 assert.equal(s.currentReview,'qa/SUI-A09-release-20261029/review-released.json');
 assert.equal(review.inputSelection.sha256,hash(fs.readFileSync(path.join(root,review.inputSelection.path))));
 assert.equal(review.priorReview.sha256,hash(fs.readFileSync(path.join(root,review.priorReview.path))));
 assert.equal(old.inputSelection.sha256,hash(fs.readFileSync(path.join(__dirname,'selection-before.json'))));
 const wardrobes=new Set(['CG019','CG044','CG061']),req=new Set();let instances=0,internal=0;
 for(const r of shots){
  assert(!s.retiredRouteIds.includes(r.id));const prev=old.shots.find(x=>x.id===r.id);
  for(const k of ['source','contextSources','conditions','cast','propState','composition','referenceKeys','time','routeGroup','kind'])assert.deepEqual(r[k],prev[k],r.id+' '+k);
  if(!wardrobes.has(r.id))assert.equal(r.wardrobeAndForm,prev.wardrobeAndForm);else assert.equal(r.previousWardrobeAndForm,prev.wardrobeAndForm);
  for(const k of Object.keys(prev.lifecycle))if(k!=='snapshotBefore'||!wardrobes.has(r.id))assert.deepEqual(r.lifecycle[k],prev.lifecycle[k],r.id+' lifecycle '+k);
  assert.deepEqual(r.previousPendingDependencies,prev.pendingDependencies);
  assert.equal(r.pendingDependencies.length,0);assert.equal(r.production.blockingReasons.length,0);assert(r.production.productionReady);assert(r.production.contentReviewed&&r.production.userSelectionConfirmed);
  assert.equal(r.resolvedDependencies.length+r.internalWorkItems.length,prev.pendingDependencies.length);
  assert.deepEqual([...r.resolvedDependencies,...r.internalWorkItems].map(d=>d.requirementId).sort(),prev.pendingDependencies.map(d=>d.requirementId).sort());
  for(const d of r.resolvedDependencies){assert(d.referenceKeys.length>0);assert.equal(d.status,'resolved-reference-frozen');assert(d.frameUse);assert(!d.owner.startsWith('SUI-A10'));for(const k of d.referenceKeys)assert(review.references[k],k);req.add(d.requirementId);instances++;}
  for(const d of r.internalWorkItems){assert(d.owner.startsWith('SUI-A10'));assert.equal(d.status,'in-package-production-work');internal++;}
  assert(r.productionReferenceKeys.every(k=>review.references[k]));
  assert.equal(r.production.generatedCG,false);assert.equal(r.production.runtimeAdopted,false);
 }
 assert.equal(req.size,60);assert.equal(internal,9);
 const pk=load('qa/SUI-A09-release-20261029/package-index.json').packages;
 const counts={'SUI-A10-COMMON':15,'SUI-A10-XM':8,'SUI-A10-ZZ':9,'SUI-A10-MY':7,'SUI-A10-PI':9,'SUI-A10-HQ':7,'SUI-A10-FR':5};
 for(const[k,p]of Object.entries(pk)){assert.equal(p.selectedIds.length,counts[k]);assert.deepEqual(p.releasedForProduction,p.selectedIds);assert.equal(p.generated.length,0);assert.deepEqual(p.selectedIds,shots.filter(s=>s.production.package===k).map(s=>s.id));}
 report.counts.upstreamRequirements=req.size;report.counts.resolvedDependencyInstances=instances;report.counts.internalProductionWorkItems=internal;
 return {selected:60,productionReleased:60,upstreamRequirements:req.size,instances,internalWorkItems:internal,packages:counts};
});
check('19项新参考已实际解码/无损比较并视觉审阅，2份返修前原件不用于生产',()=>{
 const manifest=load('assets/sources/20261029-cg-preflight/resource-records.json'),format=load('qa/SUI-A10-preflight-20261029/format-check.json'),visual=load('qa/SUI-A10-preflight-20261029/visual-review.json'),alpha=load('qa/SUI-A10-preflight-20261029/alpha-check.json');
 assert.equal(format.status,'pass');assert.equal(format.selected,19);assert.equal(visual.status,'pass');assert.equal(visual.selected,19);assert.equal(alpha.status,'pass-for-reference');assert.equal(alpha.composites.length,2);
 assert.equal(manifest.records.length,21);assert.equal(manifest.records.filter(r=>r.derivativeFile).length,19);
 const used=new Set(shots.flatMap(r=>r.productionReferenceKeys));
 for(const r of manifest.records){
  assert.equal(hash(fs.readFileSync(path.join(root,r.sourceFile))),r.sourceSha256);assert.equal(hash(fs.readFileSync(path.join(root,r.generationRecord))),r.generationRecordSha256);
  if(r.derivativeFile){assert.equal(r.status,'reference-frozen-for-cg-production');assert.equal(hash(fs.readFileSync(path.join(root,r.derivativeFile))),r.derivativeSha256);assert(r.encoding.decodedRGBAEqual);assert(used.has('PRE/'+r.assetId));assert(visual.rows.some(v=>v.assetId===r.assetId&&v.sourceSha256===r.sourceSha256&&v.status==='pass-for-cg-reference'));}
  else assert(!Object.values(review.references).some(v=>v.sourceFile===r.sourceFile));
 }
 report.counts.newReferences=19;report.counts.excludedOriginals=2;
 return {newReferences:19,originals:21,excluded:2,transparentFourBackgrounds:2,runtimeAdopted:0};
});
check('60镜按120与108字素分页都保持同段进退场',()=>{
 const counts={};
 for(const pageSize of [120,108]){
  const parsed=parse(R,sources,{pageSize});counts[pageSize]=parsed.nodes.filter(n=>n.op==='text').length;
  for(const r of shots){const pages=parsed.nodes.filter(n=>n.paragraph===r.source.paragraph);assert.deepEqual(pages.map(n=>n.id),r.lifecycle.visiblePageIds,r.id+' pageSize '+pageSize);assert.equal(pages[0].id,r.lifecycle.enterBeforeId);assert.equal(pages.at(-1).next,r.lifecycle.exitBeforeId);assert.equal(pages.map(n=>n.text).join(''),r.source.quote);}
 }
 report.counts.pagesByPageSize=counts;return {shots:60,pagesByPageSize:counts,runtimeBuildPageSize:108};
});`);
replaceCheck('图鉴源登记完整','正文、历史QA',String.raw`check('图鉴60空槽保持，未绑定图像或重建运行包',()=>{
 const registry=load('system/sui-u/gallery.registry.json');assert.deepEqual(registry.items.map(r=>r.id),s.activeSelectedIds);assert(registry.items.every(r=>r.file===null&&r.unlockVariable==='sui_cg_'+r.id));
 const order=fs.readFileSync(path.join(root,'system/sui-u/gallery-order.ray'),'utf8').match(/var suiCGOrder = (\[[^;]+\]);/);assert(order);assert.deepEqual(JSON.parse(order[1]),s.activeSelectedIds);
 return {sourceSlots:60,boundImages:0,runtimeRebuilt:false,liveGalleryTested:false};
});`);
const start=code.indexOf("check('正文、历史QA"),end=code.indexOf('report.coverage=coverage;',start);
code=code.slice(0,start)+String.raw`check('本次904项已有正文、原件与运行输入保持不变',()=>{
 const before=load('qa/SUI-A10-preflight-20261029/input-before.json').files;
 for(const f of before)assert.equal(hash(fs.readFileSync(path.join(root,f.path))),f.sha256,f.path);
 report.counts.protectedInputs=before.length;return {protectedInputs:before.length,changed:0};
});
`+code.slice(end);
code=code.replace('// 沿用上一批的正文语义核验，另验本轮选择集成。仅写本批报告；不重写历史QA。','// 沿用上一批条件可达性核验，并校验本轮参考放行；仅写当前批次报告，不重写历史QA。');
fs.writeFileSync(path.join(__dirname,'verify.cjs'),code);
console.log('Created release verifier; route and negative-case checks preserved.');
