'use strict';
const C=require('./common.cjs');
const {fs,path,ROOT,BASE,DOC,QA,assert,read,json,fp,digest,evidence}=C;
const V=require('../p4-bindings/validate.cjs');
const {schemas,defs}=require('../p4-bindings/schema.cjs');
const {compile}=require('../../compiler/compile.cjs');
const {validatePack}=require('./package-check.cjs');
function checkFile(f){const now=fp(f.path);assert.equal(now.sha256,f.sha256,'文件漂移：'+f.path);if(f.bytes!==undefined)assert.equal(now.bytes,f.bytes);}
function loadContext({adopted=false}={}){
  const ctx=json(DOC+'/context.json'),{inputFingerprint,...body}=ctx.input;assert.equal(digest(body),inputFingerprint,'新冻结指纹');
  ctx.input.sourceFiles.forEach(checkFile);checkFile(ctx.input.routeContract);checkFile(ctx.input.amendment);
  for(const [p,h]of Object.entries(ctx.input.compilerHashes))checkFile({path:p,sha256:h});
  const generated=compile({root:adopted?ROOT:path.join(ROOT,QA+'/input'),pageSize:108,textPolicy:'required'});
  assert.equal(generated.ir.buildId,ctx.input.contentBuildId,'正文版本不符');
  if(adopted)for(const f of ctx.input.sourceFiles)assert.equal(fp('scenario/'+path.basename(f.path)).sha256,f.sha256,'采用正文未同步');
  ctx.ir=generated.ir;ctx.generated=generated;ctx.byNode=new Map(ctx.nodes.map(n=>[n.nodeId,n]));ctx.checkFile=checkFile;ctx.retiredCG=new Set(ctx.retiredCG);
  V.equalSet(ctx.nodes.map(n=>n.nodeId),ctx.ir.nodes.filter(n=>['text','choice'].includes(n.op)).map(n=>n.id),'新冻结节点');
  const guards=C.guards(ctx.ir),byIR=new Map(ctx.ir.nodes.map(n=>[n.id,n]));
  for(const row of ctx.nodes){const node=byIR.get(row.nodeId);assert.equal(row.condition,guards.get(row.nodeId),'映射条件漂移');assert.equal(row.source.sha256,node.source.sha256);assert.equal(row.source.file,'scenario/'+node.source.file);assert.deepEqual(row.textMeta,node.textMeta||null);const route=ctx.ir.contract.routes.find(r=>r.file===node.source.file);assert.deepEqual(row.routeIds,route?[route.id]:[]);}
  return ctx;
}
function resourceCatalog(ctx,catalog){
  C.checkSchema(catalog,schemas.resources,defs,'resources');assert.equal(catalog.inputFingerprint,ctx.input.inputFingerprint);
  const parent=json(BASE+'/P4-05/resources.expanded.candidate.json');
  V.equalSet(catalog.assets.map(a=>a.assetId),parent.assets.map(a=>a.assetId),'采用资产集合');
  const approval=json(DOC+'/adoption-decision.json'),assets=new Map(),cgs=new Map(),paths=new Set();
  for(const a of catalog.assets){
    const prev=parent.assets.find(p=>p.assetId===a.assetId);assert.equal(a.type,prev.type);
    assert.equal(a.reviewStatus,'passed','未采用资源');assert(!paths.has(a.runtime.path),'重复运行文件');paths.add(a.runtime.path);
    for(const row of [a.source,a.runtime,a.checkEvidence,a.approvalEvidence]){assert(row,'缺复验/采用依据');checkFile(row);}
    const check=json(a.checkEvidence.path);assert.equal(check.assetId,a.assetId);assert.equal(check.inspectionStatus,'passed');assert.equal(check.visual.status,'passed');assert(Object.values(check.checks).every(x=>x===true));
    assert.deepEqual(a.source,check.source,'原件与复验不符');assert.equal(a.runtime.sha256,check.runtime.sha256,'衍生与复验不符');
    if(a.assetId==='cg-zz-cg116'){
      assert.equal(a.checkEvidence.path,QA+'/cg116-inspection.json');assert.equal(check.taskId,'P4-07');
      assert.equal(check.reason.includes('天亮'),true);
    }else{
      assert.deepEqual(a.checkEvidence,prev.checkEvidence);assert.equal(check.taskId,'P4-05');assert.deepEqual(a.source,prev.source);
    }
    const original=a.assetId==='cg-zz-cg116'?check.runtime:prev.runtime;
    assert(a.runtime.path===original.path||a.runtime.path==='assets/current/P4-07-20261104/'+a.assetId+'.webp','未经登记的运行迁移路径');
    if(prev.reviewStatus==='passed')assert.deepEqual(a.approvalEvidence,prev.approvalEvidence);
    else{assert.deepEqual(a.approvalEvidence,evidence(DOC+'/adoption-decision.json'));const row=approval.assets.find(r=>r.assetId===a.assetId);assert(row);assert.deepEqual(row.source,a.source);assert.equal(row.runtime.sha256,a.runtime.sha256);}
    assets.set(a.assetId,a);
  }
  const originalRegistration=new Map(parent.cg.map(c=>[c.cgId,c]));
  V.equalSet(catalog.cg.map(c=>c.cgId),parent.cg.map(c=>c.cgId),'CG登记');
  for(const cg of catalog.cg){const old=originalRegistration.get(cg.cgId);assert(!ctx.retiredCG.has(cg.cgId));assert.equal(cg.assetId,old.assetId);assert.equal(assets.get(cg.assetId)?.type,'cg');checkFile(cg.registrationEvidence);
    const expected=old.registrationEvidence.path==='docs/CG当前选择.json'?evidence(QA+'/before/docs/CG当前选择.json'):old.registrationEvidence;
    assert.deepEqual(cg.registrationEvidence,expected,'CG登记不得冒用证据');cgs.set(cg.cgId,cg.assetId);
  }
  const oldOrder=json(QA+'/before/system/sui-u/gallery.registry.json').items.map(i=>i.id);
  const order=[...oldOrder,...[...cgs.keys()].filter(id=>!oldOrder.includes(id)).sort((a,b)=>Number(a.slice(2))-Number(b.slice(2)))];
  const gallery={schemaVersion:1,orderSource:'P4-07：保留原编号与顺序；追加CG109～129',pageSize:6,items:order.map(id=>({id,assetId:cgs.get(id),unlockVariable:'sui_cg_'+id,file:assets.get(cgs.get(id)).runtime.path}))};
  return {assets,cgs,gallery,fingerprint:digest(catalog)};
}
function validate({adopted=false,catalog,documents}={}){
  const ctx=loadContext({adopted});catalog=catalog||json(DOC+(adopted?'/resources.adopted.json':'/resources.candidate.json'));
  const resources=resourceCatalog(ctx,catalog),results=[],bindings=[];
  for(const pack of ctx.packages){const docs=documents?.[pack.packageId]||V.readPackage(DOC+'/packages/'+pack.packageId);results.push(validatePack(ctx,pack.packageId,docs,{mode:'handoff',resources}));bindings.push(...docs.bindings.bindings.map(r=>r.binding));}
  V.equalSet(bindings.map(b=>b.anchor.nodeId),ctx.nodes.map(n=>n.nodeId),'合并覆盖');
  V.equalSet(bindings.map(b=>b.cgId).filter(Boolean),[...resources.cgs.keys()],'81CG单节点绑定');
  const assets=catalog.assets.map(a=>({assetId:a.assetId,type:a.type,sourcePath:a.source.path,sourceSha256:a.source.sha256,runtimePath:a.runtime.path,runtimeSha256:a.runtime.sha256}));
  if(adopted){
    const manifest=json('assets/current/manifest.json'),b=json('docs/整合/bindings.json');assert.deepEqual(b.bindings,bindings);assert.equal(b.contentBuildId,ctx.input.contentBuildId);assert.equal(b.manifestSha256,fp('assets/current/manifest.json').sha256);
    assert.deepEqual(manifest.assets.map(a=>Object.fromEntries(Object.keys(assets[0]).map(k=>[k,a[k]]))),assets);
    assert.deepEqual(json('system/sui-u/gallery.registry.json'),resources.gallery);assert.deepEqual(json('docs/CG当前选择.json').activeSelectedIds,resources.gallery.items.map(i=>i.id));
    assert.equal(json('system/sui-cinema/manifest.json').contentBuildId,ctx.input.contentBuildId);
  }
  return {ctx,catalog,assets,bindings,gallery:resources.gallery,results,adoptionReady:true};
}
module.exports={validate,loadContext,resourceCatalog,checkFile};
if(require.main===module){try{const a=validate({adopted:process.argv.includes('--adopted')});console.log(JSON.stringify({status:'pass',adoptionReady:true,assets:a.assets.length,bindings:a.bindings.length,cg:a.gallery.items.length}));}catch(e){console.error(e.stack);process.exitCode=1;}}
