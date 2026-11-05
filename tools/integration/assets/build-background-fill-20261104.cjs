#!/usr/bin/env node
'use strict';
const C=require('./fill-backgrounds-20261104.cjs'),{fs}=require('../../story-revision/p4-bindings/common.cjs');
const path=require('node:path'),assert=require('node:assert/strict');
const {ROOT,QA,DOC,VERSION,BUILD,read,json,write,fp}=C;
const {compile}=require('../../compiler/compile.cjs');
const {hash}=require('../../compiler/parse.cjs');
const {integrate}=require('../../story-revision/p4-integration/presentation.cjs');
const {build:runtimeBuild}=require('../../runtime/build.cjs');
function verify(){
  const M=json(DOC+'/manifest.candidate.json'),B=json(DOC+'/bindings.candidate.json'),oldM=json(QA+'/before/assets/current/manifest.json'),oldB=json(QA+'/before/docs/整合/bindings.json'),P=json(DOC+'/plan.json');
  const generated=compile({pageSize:108,textPolicy:'required'});assert.equal(generated.ir.buildId,oldB.contentBuildId);assert.equal(B.contentBuildId,oldB.contentBuildId);assert.equal(M.version,VERSION);assert.equal(B.version,VERSION);assert.equal(B.manifestSha256,fp(DOC+'/manifest.candidate.json').sha256);
  assert.deepEqual(B.sourceHashes,generated.manifest.sourceHashes);assert.equal(M.assets.length,268);assert.equal(B.bindings.length,4814);
  const planned=new Map(P.plan.map(p=>[p.nodeId,p])),assets=new Map(M.assets.map(a=>[a.assetId,a])),oldByNode=new Map(oldB.bindings.map(b=>[b.anchor.nodeId,b]));
  for(const old of oldM.assets){const next=assets.get(old.assetId);assert.deepEqual({...next,backgroundFillUsage:undefined},{...old,backgroundFillUsage:undefined});assert.equal(fp(old.runtimePath).sha256,old.runtimeSha256);}
  let changed=0;for(const b of B.bindings){const old=oldByNode.get(b.anchor.nodeId);assert(old);assert(b.enter.background,'仍缺背景 '+b.anchor.nodeId);assert.deepEqual(b.exit.restore,{...b.enter,cg:null});
    const p=planned.get(b.anchor.nodeId);
    if(p){changed++;assert.equal(old.enter.background,null);assert.equal(b.enter.background.assetId,p.assetId);assert.deepEqual({...b,enter:old.enter,exit:old.exit,restrictions:old.restrictions},old);assert.deepEqual({...b.enter,background:null},old.enter);assert.deepEqual({...b.exit.restore,background:null},old.exit.restore);}
    else assert.deepEqual(b,old);
    for(const s of [b.enter,b.exit.restore])for(const a of [s.background,...s.characters,...s.props,s.cg].filter(Boolean)){const asset=assets.get(a.assetId);assert(asset);assert(Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.scale>0);assert.equal(fp(asset.runtimePath).sha256,asset.runtimeSha256);}
  }
  assert.equal(changed,495);assert.deepEqual(M.assets.filter(a=>a.type==='cg'),oldM.assets.filter(a=>a.type==='cg'));
  const G=json('system/sui-u/gallery.registry.json');assert.equal(G.items.length,81);assert.deepEqual(G,json('qa/dialogue-p4-P4-07-20261104/build-adopted/gallery.registry.json'));
  const allCG=B.bindings.filter(b=>b.cgId);assert.equal(allCG.length,81);for(const g of G.items){const b=allCG.find(b=>b.cgId===g.id);assert(b&&b.enter.cg.assetId===g.assetId);}
  for(const s of Object.keys(generated.manifest.sourceHashes))assert.equal(fp(s).sha256,generated.manifest.sourceHashes[s]);
  const report={date:'2026-11-04',status:'pass',version:VERSION,contentBuildId:generated.ir.buildId,counts:{displayNodes:4814,paragraphs:4748,assets:268,staticCG:81,changedBackgroundNodes:495,onlyRainNodes:0,missingBackgroundNodes:0,newImages:6,reusedBackgrounds:7,reuseNodes:78,newImageNodes:417},checks:['全稿显示绑定完整','仅495处背景及其退出底层改变','正文/姓名/媒介/分页/条件/路线/选择/人物/道具/CG/81图鉴不变','旧262份资源元数据及字节保持；允许附加本批复用范围','268份运行图指纹及状态几何有效','495处进入与退出全量状态一致'],sourceHashes:generated.manifest.sourceHashes,scope:'静态结构和文件核对；真实呈现见引擎夹具与完整包浏览器记录。'};
  write(QA+'/static-verification.json',report);return {M,B,G,generated,report};
}
function build(){
  const v=verify();assert(!fs.existsSync(path.join(ROOT,BUILD)),'不覆盖已有构建');
  const parent=json('qa/dialogue-p4-P4-07-20261104/build-adopted/build-result.json'),paths=new Set(parent.inputs.map(f=>f.path));
  for(const a of v.M.assets)paths.add(a.runtimePath);
  for(const p of ['assets/current/manifest.json','docs/整合/bindings.json','tools/integration/assets/fill-backgrounds-20261104.cjs','tools/integration/assets/build-background-fill-20261104.cjs'])paths.add(p);
  const snapshots=[...paths].sort().map(fp),src=BUILD+'/input';
  for(const p of paths){const target=path.join(ROOT,src,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(ROOT,p),target);}
  write(src+'/assets/current/manifest.json',v.M);write(src+'/docs/整合/bindings.json',v.B);
  const generated=compile({root:path.join(ROOT,src),pageSize:108,textPolicy:'required'});assert.equal(generated.ir.buildId,v.generated.ir.buildId);
  const fingerprint=hash(JSON.stringify({inputs:snapshots,manifest:v.M,bindings:v.B}));
  const runtime=runtimeBuild({out:path.join(ROOT,BUILD,'runtime'),projectRoot:path.join(ROOT,src),compiled:generated,databasePrefix:'bijie-background-fill-20261104:',integration:{diagnostic:false,assets:v.M.assets,bindings:v.B.bindings,fingerprint,adapt:args=>integrate({...args,assets:v.M.assets,bindings:v.B.bindings,gallery:v.G,mode:'candidate'})}});
  for(const f of snapshots)assert.equal(fp(f.path).sha256,f.sha256,'构建期间输入变化 '+f.path);
  const functions=(read(BUILD+'/runtime/stage/main.ray').toString().match(/^func /gm)||[]).length;assert(functions<1024);
  write(BUILD+'/runtime-assets.json',v.M.assets);write(BUILD+'/bindings.json',v.B);write(BUILD+'/gallery.registry.json',v.G);
  const r={date:'2026-11-04',version:VERSION,contentBuildId:generated.ir.buildId,runtimeBuildId:runtime.runtimeBuildId,databasePrefix:runtime.databasePrefix,functionCount:functions,inputs:snapshots,entry:BUILD+'/runtime/web',counts:v.report.counts,concurrentInputs:json(QA+'/concurrent-inputs.json'),verification:{packaging:'pass',engine:'pending',browser:'pending',mobile:'not-tested',native:'not-tested',release:'not-executed'}};
  write(BUILD+'/build-result.json',r);console.log(JSON.stringify({status:'built',functionCount:functions,entry:r.entry}));return r;
}
if(require.main===module){if(process.argv[2]==='verify'){const r=verify();console.log(JSON.stringify(r.report.counts));}else build();}
module.exports={verify,build};
