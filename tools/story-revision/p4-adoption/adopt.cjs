#!/usr/bin/env node
'use strict';
const C=require('./common.cjs');
const {fs,path,ROOT,BASE,DOC,QA,VERSION,assert,read,json,fp,evidence,write,clone,digest}=C;
const {validate,checkFile}=require('./validate.cjs');
function adopt(){
  assert(!fs.existsSync(path.join(ROOT,DOC+'/resources.adopted.json')),'本批已经采用，不重写');
  const verification=json(QA+'/verification-candidate.json');assert.equal(verification.status,'pass');
  const a=validate(),catalog=clone(a.catalog);assert.equal(verification.contentBuildId,a.ctx.input.contentBuildId);
  const pre=json(QA+'/preflight.json');pre.files.forEach(checkFile);
  const approval=evidence(DOC+'/adoption-decision.json'),oldManifest=json(QA+'/before/assets/current/manifest.json'),transfers=[];
  // 图片均另建版本，不覆盖旧采用图；先核对目标为空，再写入。
  for(const art of catalog.assets)if(!art.runtime.path.startsWith('assets/current/')){
    const dest='assets/current/P4-07-20261104/'+art.assetId+'.webp';assert(!fs.existsSync(path.join(ROOT,dest)));
    write(dest,read(art.runtime.path));assert.equal(fp(dest).sha256,art.runtime.sha256);transfers.push({assetId:art.assetId,from:art.runtime,to:evidence(dest)});art.runtime=evidence(dest);
  }
  write(DOC+'/resource-transfers.json',{version:VERSION,policy:'逐字节采用；不重新缩放/压缩，不覆盖旧文件',transfers});
  const scope={kind:'complete',description:'P4静态版：P3十二份对白正文与已确认头盔移段，七包完整演出、262资源、81CG；P5运行另验。',missing:[]};
  const assets=catalog.assets.map(art=>{
    const old=oldManifest.assets.find(x=>x.assetId===art.assetId),check=json(art.checkEvidence.path),tech=check.technical?.runtime||check;
    return {assetId:art.assetId,type:art.type,sourcePath:art.source.path,sourceSha256:art.source.sha256,runtimePath:art.runtime.path,runtimeSha256:art.runtime.sha256,bytes:fp(art.runtime.path).bytes,width:tech.width,height:tech.height,format:'WEBP',alpha:tech.alphaChannel??tech.alpha??false,encoding:{lossless:true,tool:'P4已验无损WebP逐字节采用',parameters:'不缩放、不二次压缩；保留源色彩信息与alpha'},approval:{status:'approved',evidence:{...art.approvalEvidence,reference:art.approvalEvidence.path===approval.path?'用户完成P4-07任务授权；总协调按复验/正文范围采用':'保留既有采用依据；P4逐节点使用范围见本批绑定'},scope:[art.assetId,'仅按P4-07实际绑定节点使用；不由图库登记推导出场或关系']},inspection:{...art.checkEvidence,task:check.taskId},...(old&&old.sourceSha256===art.source.sha256&&old.a11?{a11:old.a11}:{}),restrictions:[...(old?.restrictions||[]),'P4-07当前范围以绑定与cg-anchors.json为准；历史说明不覆盖新冻结节点。']};
  });
  for(const file of Object.keys(a.ctx.ir.entries))write('scenario/'+file,read(DOC+'/正文/'+file));
  const manifest={schemaVersion:'p4-adopted-assets-v1',version:VERSION,contentBuildId:a.ctx.input.contentBuildId,scope,assets};write('assets/current/manifest.json',manifest);
  write('docs/整合/bindings.json',{schemaVersion:'SUI-I-1',version:VERSION,scope,contentBuildId:a.ctx.input.contentBuildId,manifestSha256:fp('assets/current/manifest.json').sha256,sourceHashes:a.ctx.generated.manifest.sourceHashes,bindings:a.bindings});
  const gallery=clone(a.gallery);for(const item of gallery.items)item.file=catalog.assets.find(x=>x.assetId===item.assetId).runtime.path;
  write('system/sui-u/gallery.registry.json',gallery);write('system/sui-u/gallery-order.ray','var suiCGOrder = '+JSON.stringify(gallery.items.map(i=>i.id))+';\n');
  const cinema=json('system/sui-cinema/manifest.json');cinema.contentBuildId=a.ctx.input.contentBuildId;write('system/sui-cinema/manifest.json',cinema);
  const selection=json('docs/CG当前选择.json'),anchors=json(DOC+'/cg-anchors.json').records;
  selection.revision=VERSION;selection.activeSelectedIds=gallery.items.map(i=>i.id);selection.activeCount=81;selection.approvedAdditionalIds=[...new Set([...selection.approvedAdditionalIds,...anchors.filter(r=>Number(r.cgId.slice(2))>=109).map(r=>r.cgId)])];
  selection.currentReview=DOC+'/cg-anchors.json';selection.currentAdoption={date:'2026-11-04',version:VERSION,staticCG:81,nextId:'CG130',evidence:approval,contentBuildId:a.ctx.input.contentBuildId,P5:'pending'};
  for(const r of anchors){let item=selection.items.find(x=>x.id===r.cgId);if(!item){item={id:r.cgId};selection.items.push(item);}Object.assign(item,{status:'P4-07静态采用；P5运行待验',assetId:r.assetId,adoptedNodeId:r.nodeId,currentAnchor: r,adoptionEvidence:approval});}
  selection.sourceSemantics='original*与productionRelease保留历史；当前81项采用以currentAdoption、currentReview和P4-07同版本清单为准。';write('docs/CG当前选择.json',selection);
  for(const f of ['docs/CG制作当前状态.json','docs/CG扩充当前状态.json']){const d=json(f);d.currentAdoption={date:'2026-11-04',task:'P4-07',version:VERSION,adoptedCG:81,contentBuildId:a.ctx.input.contentBuildId,anchors: DOC+'/cg-anchors.json',P5:'pending',note:'本对象为当前状态；原制作字段保留所属批次。CG116已在07改为正文明确的清晨。'};write(f,d);}
  write(DOC+'/resources.adopted.json',catalog);
  const final=validate({adopted:true});write(QA+'/adoption-result.json',{task:'P4-07',status:'adopted',version:VERSION,contentBuildId:a.ctx.input.contentBuildId,counts:{paragraphs:4748,displayNodes:4814,assets:262,cg:81,transfers:transfers.length},handoff:final.results,verification:evidence(QA+'/verification-candidate.json'),notP5Acceptance:true});
  console.log(JSON.stringify({status:'adopted',version:VERSION,transfers:transfers.length}));
}
if(require.main===module)adopt();
module.exports={adopt};
