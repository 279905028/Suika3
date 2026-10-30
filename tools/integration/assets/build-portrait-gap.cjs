#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash}=require('../../compiler/parse.cjs');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/portrait-gap-fill-20261030';
const VERSION='sui-i01-portraits-20261030-v5';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const fp=p=>({path:p,sha256:hash(fs.readFileSync(path.join(ROOT,p)))});
const put=(p,v)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(v,null,2)+'\n');

function build(){
 assert(!fs.existsSync(path.join(ROOT,QA,'snapshot.json')),'不能覆盖本批冻结证据');
 const beforeB=QA+'/before/docs__整合__bindings.json',beforeM=QA+'/before/assets__current__manifest.json';
 assert.equal(fp('docs/整合/bindings.json').sha256,fp(beforeB).sha256,'其他工作已修改绑定，须重新审阅');
 assert.equal(fp('assets/current/manifest.json').sha256,fp(beforeM).sha256,'其他工作已修改采用清单，须重新审阅');
 const B=read(beforeB),M=read(beforeM),C=require('../../compiler/compile.cjs').compile({pageSize:108});
 assert.deepEqual(C.manifest.sourceHashes,B.sourceHashes);
 const review=read(QA+'/review.json'),selected=read('assets/sources/20261030-portrait-gap-fill/selected.json');
 const imageChecks=read(QA+'/image-checks.json'),visual=read(QA+'/visual-review.json');
 assert.deepEqual(visual.assetIds.slice().sort(),selected.assets.map(a=>a.assetId).sort());
 assert.equal(visual.status,'pass');
 assert.deepEqual(review.counts,{keep:722,new:54,reuse:10});
 assert.equal(review.paragraphs.length,786);
 const approvalPath=QA+'/adoption.json';
 put(approvalPath,{date:'2026-10-30',reference:'portrait-gap-delegated-adoption-20261030',
  userRequests:['帮我逐段筛定真正需要补画的段数并补充，最后告诉我补充的数量结果','由你按正文身份设计并补入游戏','配角的形象不要太好看，做成普通人就行'],
  basis:'用户委托设计及接入，助手按普通人外形方向与实际离线检查选用。非用户逐图选型。',
  assets:selected.assets.map(a=>a.assetId),visualReview:fp(QA+'/visual-review.json'),imageChecks:fp(QA+'/image-checks.json')});
 for(const a of M.assets){assert.equal(fp(a.runtimePath).sha256,a.runtimeSha256);assert.equal(fp(a.sourcePath).sha256,a.sourceSha256);}
 for(const s of selected.assets){
  const r=imageChecks.records.find(r=>r.assetId===s.assetId);assert(r&&r.offlineStatus==='通过'&&r.rgbaPixelsEqual);
  const meta=r.webpMetadata;
  assert.equal(fp(s.sourcePath).sha256,r.expectedSourceSha256);assert.equal(fp(s.runtimePath).sha256,meta.sha256);
  assert(!M.assets.some(a=>a.assetId===s.assetId));
  M.assets.push({assetId:s.assetId,type:'character',sourcePath:s.sourcePath,sourceSha256:r.expectedSourceSha256,
   runtimePath:s.runtimePath,runtimeSha256:meta.sha256,bytes:meta.bytes,width:meta.width,height:meta.height,format:'WEBP',alpha:true,
   encoding:{lossless:true,tool:'Pillow / libwebp',parameters:JSON.stringify(imageChecks.encoding)},
   approval:{status:'approved',evidence:{...fp(approvalPath),reference:'portrait-gap-delegated-adoption-20261030'},scope:[s.assetId,'用户委托按正文身份设计的普通人配角基础肖像，仅本批明确现场绑定；不新增经历。']},
   a11:{...fp(QA+'/image-checks.json'),assetId:s.assetId},
   restrictions:['只作当面对话肖像，不把站姿当作正在理发、搬运或交钥匙的动作。','电话、群聊、回忆、离场与隔门不自动延续；保持原CG、形态与路线规则。','不从图像补造精确年龄、家庭、婚史、疾病或其他剧情设定。']});
 }
 const assets=new Map(M.assets.map(a=>[a.assetId,a]));
 const ledger=new Map(read('qa/sui-i01-20261030/adoption-ledger.json').records.map(a=>[a.assetId,a]));
 const nodes=new Map(C.ir.nodes.map(n=>[n.id,n]));
 const decisions=new Map(review.paragraphs.map(p=>[p.file+':'+p.line,p]));
 const additional=require('./portrait-gap-plan.cjs').additional;
 const changes=[];let addedBlankText=0,extraText=0,choices=0;
 for(const b of B.bindings){
  const n=nodes.get(b.anchor.nodeId),key='scenario/'+n.source.file+':'+n.source.line;
  const d=decisions.get(key),adds=[];
  if(d&&d.decision!=='keep')adds.push({assetId:d.assetId,reason:d.reason});
  for(const r of additional)if(r.file===n.source.file&&r.start<=n.source.line&&n.source.line<=r.end)adds.push(r);
  if(!adds.length)continue;
  const before=structuredClone(b.enter.characters),ids=[...new Set([...before.map(p=>p.assetId),...adds.map(p=>p.assetId)])];
  if(ids.length===before.length)continue;
  assert(ids.length<=3,'人物槽超过3个 '+key);
  const centers=ids.length===1?[640]:ids.length===2?[360,920]:[260,640,1020];
  const layers=ids.length===1?['center']:ids.length===2?['left','right']:['left','center','right'];
  b.enter.characters=ids.map((id,i)=>{
   const a=assets.get(id);assert(a?.type==='character');
   const old=before.find(p=>p.assetId===id),geometry=ledger.get(id)?.placement;
   const scale=old?.scale??geometry?.scale??.38,y=old?.y??geometry?.y??42;
   return{assetId:id,layer:layers[i],x:Math.round(centers[i]-a.width*scale/2),y:Math.round(y),scale,form:old?.form??'human',costume:old?.costume??id};
  });
  b.exit.restore={...structuredClone(b.enter),cg:null};
  b.restrictions.push('本批逐段筛定后补入明确在场人物；下一段按目标绑定清除/恢复，不在远程或另一场景自动延续。');
  changes.push({nodeId:n.id,source:n.source,op:n.op,text:n.text||n.choice,before,after:b.enter.characters,reasons:[...new Set(adds.map(r=>r.reason))]});
  if(n.op==='choice')choices++;else if(!before.length&&!b.enter.cg)addedBlankText++;else extraText++;
 }
 // Every reviewed background paragraph remains as decided; no lost cases or broad inheritance.
 const changedNodes=new Set(changes.map(c=>c.nodeId));
 for(const p of review.paragraphs)for(const part of p.parts){
  assert.equal(changedNodes.has(part.nodeId),p.decision!=='keep',p.file+':'+p.line+' 审阅决定与应用不符');
 }
 assert.equal(addedBlankText,64);
 M.version=B.version=VERSION;
 M.scope.description='六线完整演出：保留既有连续立绘/表情及60CG；逐段复核786段后补14名普通配角和明确现场肖像，远程/门外/亲密留白按正文保留。';
 B.scope=structuredClone(M.scope);
 put('assets/current/manifest.json',M);B.manifestSha256=fp('assets/current/manifest.json').sha256;put('docs/整合/bindings.json',B);
 const summary={reviewed:786,newDrawingParagraphs:54,reuseParagraphs:10,keptBackgroundParagraphs:722,newImages:14,changedNodes:changes.length,newPortraitTextPages:addedBlankText,additionalExistingTextPages:extraText,choiceNodes:choices,assets:M.assets.length};
 put(QA+'/binding-changes.json',{version:VERSION,summary,changes});
 // Freeze current technical/UI sources at runtime-build time. Art/source inputs are explicit here.
 const paths=new Set(['docs/整合/interface-v1.json','assets/current/manifest.json','docs/整合/bindings.json','docs/CG当前选择.json','system/sui-u/gallery.registry.json',
  ...Object.keys(C.manifest.sourceHashes),...Object.keys(C.manifest.compilerHashes),
  ...M.assets.flatMap(a=>[a.sourcePath,a.runtimePath,a.a11.path,a.approval.evidence.path]),
  QA+'/review.json',QA+'/image-checks.json',QA+'/visual-review.json',approvalPath,QA+'/binding-changes.json',
  'tools/art/portrait-gap-review.cjs','tools/art/portrait-gap-assets.py','tools/integration/assets/portrait-gap-plan.cjs','tools/integration/assets/build-portrait-gap.cjs',
  'assets/sources/20261030-portrait-gap-fill/selected.json','assets/sources/20261030-portrait-gap-fill/prompts-final.json']);
 put(QA+'/snapshot.json',{schemaVersion:'SUI-I-1',version:VERSION,scope:M.scope,interfaceSha256:fp('docs/整合/interface-v1.json').sha256,
  manifest:fp('assets/current/manifest.json'),bindings:fp('docs/整合/bindings.json'),files:[...paths].sort().map(fp),missing:[]});
 const result=require('../runtime/validate.cjs').validate({root:ROOT,compiled:C,snapshotPath:QA+'/snapshot.json',mode:'candidate'});
 put(QA+'/interface-check.json',{status:'pass',inputFingerprint:result.inputFingerprint,summary,originalImagesByteExact:212});
 console.log(JSON.stringify(summary,null,2));
}
if(require.main===module)build();
module.exports={build};
