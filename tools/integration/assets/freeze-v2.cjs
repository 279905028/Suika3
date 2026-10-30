#!/usr/bin/env node
'use strict';
// 冻结已完成静态审阅的 SUI-I-1 输入；不改运行数据，不覆盖既有QA。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ROOT,QA:SOURCE_QA,json,fp}=require('./build-v2.cjs');
const {validate,safeFile}=require('../runtime/validate.cjs');
const MANIFEST='assets/current/manifest.json',BINDINGS='docs/整合/bindings.json';
const sameRef=(actual,expected,label)=>assert.deepEqual(actual,expected,label);
function verifyReview(review,{manifest,bindings,staticChecks}){
 assert.equal(review.status,'passed','新版组合目视复核未通过');
 assert.equal(review.version,manifest.version);assert.equal(review.version,bindings.version);
 sameRef(review.inputs.manifest,fp(MANIFEST),'目视复核后采用清单已变');
 sameRef(review.inputs.bindings,fp(BINDINGS),'目视复核后绑定已变');
 sameRef(review.staticEvidence,fp(SOURCE_QA+'/static-checks.json'),'静态材料已变');
 assert.equal(review.blockers.length,0,'目视复核仍有阻塞项');
 assert.equal(review.cgFrames,staticChecks.cgFrames);assert.equal(review.portraitStates,staticChecks.uniquePortraitStates);
 assert.deepEqual(review.sheets.map(s=>s.path).sort(),staticChecks.sheets.map(s=>s.path).sort(),'目视复核未覆盖全部联系表');
 for(const sheet of review.sheets){
  assert.equal(sheet.status,'passed');assert.equal(sheet.actuallyViewed,true);
  const original=staticChecks.sheets.find(s=>s.path===sheet.path);
  assert.equal(sheet.sha256,original.sha256);assert.equal(fp(sheet.path).sha256,sheet.sha256,'联系表已变');
  assert.deepEqual(sheet.bindingIds,original.bindingIds,'联系表绑定清单已变');
 }
}
function freeze({qaDir}){
 assert(/^qa\/sui-i01-[a-z0-9-]+$/.test(qaDir)&&qaDir!==SOURCE_QA,'冻结输出须为新的I01 QA批次');
 const out=qaDir+'/snapshot.json',reportPath=qaDir+'/freeze-report.json';
 for(const p of [out,reportPath])assert(!fs.existsSync(path.join(ROOT,p)),'禁止覆盖既有冻结：'+p);
 const manifest=json(MANIFEST),bindings=json(BINDINGS),review=json(qaDir+'/visual-review.json');
 const staticChecks=json(SOURCE_QA+'/static-checks.json'),validation=json(qaDir+'/validation.json');
 verifyReview(review,{manifest,bindings,staticChecks});
 sameRef(staticChecks.pixelAndAlphaEvidence.path?fp(staticChecks.pixelAndAlphaEvidence.path):null,
  {path:staticChecks.pixelAndAlphaEvidence.path,sha256:staticChecks.pixelAndAlphaEvidence.sha256},'引用的像素证据已变');
 const toolChecks=json(qaDir+'/freeze-tool-checks.json');
 assert.equal(toolChecks.status,'passed','冻结工具检查未通过');
 const protectedQA=json(qaDir+'/protected-qa-before.json');
 for(const f of protectedQA)assert.equal(fp(f.path).sha256,f.sha256,'历史QA被修改：'+f.path);
 assert.equal(validation.status,'pass','离线校验未通过');assert.equal(validation.version,manifest.version);
 sameRef(validation.inputs.manifest,fp(MANIFEST),'校验后采用清单已变');
 sameRef(validation.inputs.bindings,fp(BINDINGS),'校验后绑定已变');
 sameRef(validation.inputs.validator,fp('tools/integration/assets/validate-v2.cjs'),'校验工具已变');
 const compiled=require('../../compiler/compile.cjs').compile({pageSize:108});
 const preflightPath=qaDir+'/preflight-snapshot.json';
 const pre=validate({root:ROOT,compiled,snapshotPath:preflightPath,mode:'candidate'});
 assert(pre.complete,'只冻结本版完整声明范围');
 const expected=new Map(pre.files.map(f=>[f.path,f.sha256]));
 const evidence=[
  SOURCE_QA+'/adoption-ledger.json',SOURCE_QA+'/coverage.json',SOURCE_QA+'/scene-plan.json',SOURCE_QA+'/node-audit.json',
  SOURCE_QA+'/previous-manifest.json',SOURCE_QA+'/previous-bindings.json',SOURCE_QA+'/protected-inputs.json',
  review.staticEvidence.path,...review.sheets.map(s=>s.path),staticChecks.pixelAndAlphaEvidence.path,
  qaDir+'/visual-review.json',qaDir+'/validation.json',qaDir+'/interface-preflight.json',
  qaDir+'/state-witnesses.json',qaDir+'/transition-witnesses.json',qaDir+'/freeze-tool-checks.json',qaDir+'/protected-qa-before.json',
  'tools/integration/assets/build-v2.cjs','tools/integration/assets/scenes-v2.cjs',
  'tools/integration/assets/validate-v2.cjs','tools/integration/assets/review-v2.py','tools/integration/assets/freeze-v2.cjs'
 ];
 for(const p of evidence){safeFile(ROOT,p);expected.set(p,fp(p).sha256);}
 const ledger=json(SOURCE_QA+'/adoption-ledger.json');
 for(const a of ledger.records){
  for(const p of [a.derivativeSource.path,a.provenance.upstreamRecord.path,a.provenance.promptOrProcessRecord].filter(Boolean)){
   safeFile(ROOT,p);expected.set(p,fp(p).sha256);
  }
 }
 const snapshot={schemaVersion:'SUI-I-1',version:manifest.version,scope:manifest.scope,
  interfaceSha256:fp('docs/整合/interface-v1.json').sha256,manifest:fp(MANIFEST),bindings:fp(BINDINGS),
  files:[...expected].sort(([a],[b])=>a.localeCompare(b)).map(([path,sha256])=>({path,sha256})),missing:[]};
 for(const f of snapshot.files)assert.equal(fp(f.path).sha256,f.sha256,'冻结期间输入已变：'+f.path);
 fs.writeFileSync(path.join(ROOT,out),JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
 const checked=validate({root:ROOT,compiled,snapshotPath:out,mode:'candidate'});
 for(const f of snapshot.files)assert.equal(fp(f.path).sha256,f.sha256,'冻结后输入已变：'+f.path);
 const report={status:'passed',task:'SUI-I01',version:manifest.version,completedAt:new Date().toISOString(),
  snapshot:fp(out),inputFingerprint:checked.inputFingerprint,scope:checked.scope,
  counts:{assets:checked.assets.length,bindings:checked.bindingsList.length,cg:new Set(checked.bindingsList.map(b=>b.cgId).filter(Boolean)).size,snapshotFiles:snapshot.files.length,validatedFiles:checked.files.length},
  visualReview:fp(qaDir+'/visual-review.json'),validation:fp(qaDir+'/validation.json'),
  notTested:['引擎运行','游戏浏览器','手机真机','电脑原生','发布']};
 fs.writeFileSync(path.join(ROOT,reportPath),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return report;
}
if(require.main===module){
 try{const args=process.argv.slice(2);assert(args.length===2&&args[0]==='--qa','用法：node tools/integration/assets/freeze-v2.cjs --qa qa/sui-i01-<收尾批次>');console.log(JSON.stringify(freeze({qaDir:args[1]}),null,2));}
 catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={freeze,verifyReview};
