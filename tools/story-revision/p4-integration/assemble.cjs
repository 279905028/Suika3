#!/usr/bin/env node
'use strict';
const C=require('./common.cjs'),V=require('../p4-bindings/validate.cjs');
const {assert,json,fp,BASE,CATALOG,write,freshOutput,digest}=C;
const {resourceCatalog}=require('./catalog.cjs');
function assemble({mode='draft',catalogPath=CATALOG,packagesRoot=BASE,ctx=V.loadContext(),catalog=json(catalogPath),documents}={}) {
  assert(['draft','handoff'].includes(mode),'模式须为draft或handoff');
  const resources=resourceCatalog(ctx,catalog),bindings=[],packages=[],pending=[],inputs=[fp(catalogPath),...resources.registrations];
  for(const asset of catalog.assets)for(const row of [asset.source,asset.runtime,asset.approvalEvidence,asset.checkEvidence].filter(Boolean))inputs.push(fp(row.path));
  for(const cg of catalog.cg)inputs.push(fp(cg.registrationEvidence.path));
  for(const pack of ctx.packages) {
    const dir=packagesRoot+'/'+pack.packageId,docs=documents?.[pack.packageId]||V.readPackage(dir);
    packages.push(V.validatePack(ctx,pack.packageId,docs,{mode,resources}));
    if(!documents)for(const name of Object.values(V.NAMES))inputs.push(fp(dir+'/'+name));
    for(const row of docs.bindings.bindings){assert(row.binding,'技术候选不能有空绑定');bindings.push(row.binding);}
    for(const n of docs.needs.needs)if(n.status==='open')pending.push({kind:'need',packageId:pack.packageId,id:n.needId});
    for(const r of docs.review.reviews)if(r.status!=='reviewed')pending.push({kind:'review',packageId:pack.packageId,id:r.unitId});
    for(const b of docs.boundaries.boundaries)if(b.status!=='reviewed')pending.push({kind:'boundary',packageId:pack.packageId,id:b.boundaryId});
  }
  const byNode=new Map(bindings.map(b=>[b.anchor.nodeId,b]));V.equalSet([...byNode.keys()],ctx.nodes.map(n=>n.nodeId),'全量绑定');assert.equal(byNode.size,bindings.length,'跨包重复绑定');
  const bound=new Set(bindings.map(b=>b.cgId).filter(Boolean));
  for(const item of resources.gallery.items)if(!bound.has(item.id))pending.push({kind:'unbound-cg',id:item.id});
  for(const a of catalog.assets)if(a.reviewStatus!=='passed')pending.push({kind:'adoption-evidence',id:a.assetId});
  if(mode==='handoff')assert.equal(pending.length,0,'仍有未闭合项，禁止采用候选');
  const assets=catalog.assets.map(a=>({assetId:a.assetId,type:a.type,sourcePath:a.source.path,runtimePath:a.runtime.path,sourceSha256:a.source.sha256,runtimeSha256:a.runtime.sha256}));
  const manifest={schemaVersion:'p4-runtime-candidate-v1',mode,adoptionReady:mode==='handoff',inputFingerprint:ctx.input.inputFingerprint,interfaceFingerprint:ctx.seal.interfaceFingerprint,contentBuildId:ctx.input.contentBuildId,resourceFingerprint:resources.fingerprint,
    counts:{assets:assets.length,bindings:bindings.length,cg:resources.gallery.items.length,galleryPages:Math.ceil(resources.gallery.items.length/6),boundCG:bound.size},pending,inputs:[...new Map(inputs.map(r=>[r.path,r])).values()].sort((a,b)=>a.path.localeCompare(b.path)),packages};
  return {ctx,catalog,resources,assets,bindings,gallery:resources.gallery,manifest};
}
function emitCandidate(dir,a){write(dir,'manifest.json',a.manifest);write(dir,'resources.json',a.catalog);write(dir,'runtime-assets.json',a.assets);write(dir,'bindings.json',{contentBuildId:a.manifest.contentBuildId,bindings:a.bindings});write(dir,'gallery.registry.json',a.gallery);write(dir,'candidate-fingerprint.json',{fingerprint:digest({manifest:a.manifest,bindings:a.bindings,gallery:a.gallery})});}
if(require.main===module){try{const args=process.argv.slice(2),o={};while(args.length){const flag=args.shift();assert(['--out','--mode','--resources','--packages'].includes(flag),'未知参数');assert(args.length,'缺参数');o[flag.slice(2)]=args.shift();}assert(o.out,'须指定新--out');const a=assemble({mode:o.mode,catalogPath:o.resources,packagesRoot:o.packages});const dir=freshOutput(o.out);emitCandidate(dir,a);console.log(JSON.stringify({status:'pass',...a.manifest.counts,adoptionReady:a.manifest.adoptionReady,pending:a.manifest.pending.length}));}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={assemble,emitCandidate};
