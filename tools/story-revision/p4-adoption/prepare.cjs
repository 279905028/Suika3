#!/usr/bin/env node
'use strict';
// 另建采用版本；不改P3、P4-01～06或其历史交付。
const C=require('./common.cjs');
const {fs,path,assert,ROOT,BASE,DOC,QA,VERSION,read,json,fp,evidence,write,clone,digest,guards,neutral}=C;
const {compile}=require('../../compiler/compile.cjs');
const V=require('../p4-bindings/validate.cjs');
const {boundaries:makeBoundaries}=require('../p4-bindings/freeze.cjs');
function prepare(){
  assert(!fs.existsSync(path.join(ROOT,DOC+'/context.json')),'不覆盖已冻结采用输入');
  const parent=V.loadContext(),old=json(QA+'/parent-context.json');
  const amendment=json(BASE+'/P4-02/approved-text-amendment.json');
  assert.equal(fp(amendment.source).sha256,amendment.sourceSha256);
  assert.equal(fp(amendment.preview).sha256,amendment.previewSha256);
  for(const file of Object.keys(parent.ir.entries)){
    const source=BASE.replace('/P4-演出与美术','/P3-独立审读-20261103')+'/正文/'+file;
    const body=read(file==='罗小满-练习本.md'?amendment.preview:source);
    write(DOC+'/正文/'+file,body);write(QA+'/input/scenario/'+file,body);
  }
  write(QA+'/input/scenario/routes.json',read('scenario/routes.json'));
  const generated=compile({root:path.join(ROOT,QA+'/input'),pageSize:108,textPolicy:'required'});
  assert.deepEqual(compile({root:path.join(ROOT,QA+'/input'),pageSize:108,textPolicy:'required'}),generated);
  write(QA+'/compiled-manifest.json',generated.manifest);
  const ir=generated.ir,g=guards(ir),byIR=new Map(ir.nodes.map(n=>[n.id,n]));
  const nodes=ir.nodes.filter(n=>['text','choice'].includes(n.op)).map(n=>{
    const prev=parent.byNode.get(n.id);assert(prev,'不得新造正文节点');
    assert.equal(g.get(n.id),prev.condition);assert.equal(n.source.sha256,prev.source.sha256);
    return {...clone(prev),source:{...prev.source,candidateFile:DOC+'/正文/'+n.source.file,lineHint:n.source.line,context:n.source.anchor},lexicalNextNodeId:n.next||null};
  });
  V.equalSet(nodes.map(n=>n.nodeId),parent.nodes.map(n=>n.nodeId),'重冻结节点');
  const nodeMap=new Map(nodes.map(n=>[n.nodeId,n]));
  const paragraphs=old.paragraphs.map(p=>({...p,source:nodeMap.get(p.nodeIds[0]).source,bindingReview:'reviewed'})).sort((a,b)=>nodes.indexOf(nodeMap.get(a.nodeIds[0]))-nodes.indexOf(nodeMap.get(b.nodeIds[0])));
  const packages=old.packages.map(p=>({...p,files:[...new Set(nodes.filter(n=>n.packageId===p.packageId).map(n=>n.source.candidateFile))],paragraphIds:paragraphs.filter(n=>n.packageId===p.packageId).map(n=>n.paragraphId),nodeIds:nodes.filter(n=>n.packageId===p.packageId).map(n=>n.nodeId)}));
  const bounds=makeBoundaries(ir,{paragraphs});
  V.equalSet(bounds.map(b=>b.boundaryId),old.boundaries.map(b=>b.boundaryId),'重冻结边界');
  const sourceFiles=Object.keys(ir.entries).map(f=>fp(DOC+'/正文/'+f));
  const input={schemaVersion:'p4-adoption-input-v1',contentBuildId:ir.buildId,parentInputFingerprint:old.input.inputFingerprint,parentBuildId:old.input.contentBuildId,amendment:evidence(BASE+'/P4-02/approved-text-amendment.json'),sourceFiles,compilerHashes:generated.manifest.compilerHashes,routeContract:fp('scenario/routes.json'),pageSize:108,textPolicy:'required'};
  input.inputFingerprint=digest(input);
  const context={input,nodes,paragraphs,packages,boundaries:bounds,baseline:old.baseline,retiredCG:old.retiredCG};
  write(DOC+'/context.json',context);write(DOC+'/paragraph-registry.json',{inputFingerprint:input.inputFingerprint,contentBuildId:ir.buildId,paragraphs});
  const amendmentResult={status:'applied-in-new-freeze',decision:amendment.decision,paragraphId:amendment.moveParagraphId,oldBuild:old.input.contentBuildId,newBuild:ir.buildId,textChanged:false,controlsChanged:false,conditionsChanged:false,evidence:evidence(BASE+'/P4-02/approved-text-amendment.json'),result:evidence(DOC+'/正文/罗小满-练习本.md')};
  write(DOC+'/text-amendment.json',amendmentResult);
  const catalog=clone(json(BASE+'/P4-05/resources.expanded.candidate.json'));catalog.inputFingerprint=input.inputFingerprint;
  const check116=json(QA+'/cg116-inspection.json');
  const art116=catalog.assets.find(a=>a.assetId==='cg-zz-cg116');Object.assign(art116,{source:check116.source,runtime:check116.runtime,checkEvidence:evidence(QA+'/cg116-inspection.json')});
  const approval={task:'P4-07',date:'2026-11-04',userInstruction:'完成 P4-07',interpretation:'本任务包含统一合并与正式采用；据任务授权在已复验资源中选择实际版本，并处理整合发现的CG116清晨光线修正。这是任务范围内的采用决定，不宣称用户逐图审美确认。',parentCatalog:evidence(BASE+'/P4-05/resources.expanded.candidate.json'),assets:catalog.assets.filter(a=>a.reviewStatus!=='passed').map(a=>({assetId:a.assetId,source:a.source,runtime:a.runtime,inspection:a.checkEvidence})),scopeExtensions:json(BASE+'/P4-03/decisions.json').decisions.filter(d=>d.scopeExtension||d.decision==='reuse').map(d=>({resourceKey:d.resourceKey,evidence:evidence(BASE+'/P4-03/decisions.json'),scopes:d.assetNodeScopes})),limitations:['静态版采用；动态结局CG附加包未接入','P5另验引擎全线、存档、浏览器及设备','不发布、不访问玩家旧档']};
  write(DOC+'/adoption-decision.json',approval);
  for(const a of catalog.assets){if(a.reviewStatus!=='passed')a.approvalEvidence=evidence(DOC+'/adoption-decision.json');a.reviewStatus='passed';}
  for(const cg of catalog.cg)if(cg.registrationEvidence.path==='docs/CG当前选择.json')cg.registrationEvidence=evidence(QA+'/before/docs/CG当前选择.json');
  const assets=new Map(catalog.assets.map(a=>[a.assetId,a]));
  const dimensions=id=>{const a=assets.get(id),c=json(a.checkEvidence.path);return c.technical?.runtime||c;};
  const placement=(id,layer='bg',x=0,y=0,scale)=>{const a=assets.get(id);assert(a);const d=dimensions(id);return {assetId:id,layer,x,y,scale:scale??Math.min(1280/d.width,720/d.height),form:a.type==='character'?'human':null,costume:a.type==='character'?id:null};};
  const docs=Object.fromEntries(packages.map(p=>[p.packageId,clone(V.readPackage(BASE+'/'+p.packageId))]));
  const allBindings=new Map(Object.values(docs).flatMap(d=>d.bindings.bindings).map(r=>[r.nodeId,r.binding]));
  const changes=[];
  const change=(id,reason,fn)=>{const b=allBindings.get(id);assert(b,id);const before=clone(b.enter);fn(b);b.exit.restore={...clone(b.enter),cg:null};changes.push({nodeId:id,reason,before,after:clone(b.enter)});};
  // 逐段回看后确定空手立绘的可见集合；理发、洗头、扫发和持镜段保留画外。
  const xmIdle=new Set(['T-C01-000305','T-C01-000080','T-C01-000081','T-C01-000307','T-C01-000309','T-C01-000310','T-C01-000312','T-C01-000313','T-C01-000314','T-C01-000087','T-C01-000088','T-C01-000315','T-C01-000317','T-C01-000090','T-C01-000091','T-C01-000092','T-C01-000093','T-C01-000095','C01-03','T-XM-000443','T-XM-000444','T-XM-000445','T-XM-000015','T-XM-000032','T-XM-000033','T-XM-000034','T-XM-000602','T-XM-000604','T-XM-000606','XM03-01']);
  const piaoOff=new Set(['T-D36-000001_1','T-D36-000012_1','T-D36-000013_1','T-D36-000014_1','T-D36-000034_1']);
  const decisions=json(BASE+'/P4-03/decisions.json').decisions;
  for(const d of decisions){
    for(const [assetId,ids] of Object.entries(d.assetNodeScopes))for(const id of ids){
      const a=assets.get(assetId),n=nodeMap.get(id);
      if(a.type==='background')change(id,d.resourceKey,b=>{b.enter.background=placement(assetId);});
      else if(assetId==='char-xiaoman-work-apron-empty-hands'){
        if(xmIdle.has(n.paragraphId||id))change(id,'小满空手讲话；动作段另留画外',b=>{b.enter.characters=b.enter.characters.filter(p=>!p.assetId.includes('xiaoman'));assert(!b.enter.characters.some(p=>p.layer==='center'));b.enter.characters.push(placement(assetId,'center',380,50,.5));});
      }else if(assetId==='piao-seated-base'){
        if(!piaoOff.has(id))change(id,'第36天坐谈；相机/包带动作不由空手坐姿表演',b=>{b.enter.characters=b.enter.characters.filter(p=>!p.assetId.startsWith('piao-')).map(p=>p.assetId.startsWith('maolang')?{...p,layer:'right',x:810,y:42,scale:.38}:p);b.enter.characters.push(placement(assetId,'left',80,110,.43));});
      }else if(d.resourceKey==='zhouzhi-day30-work-skirt')change(id,'已审工作裙复用；营业礼貌不代表关系承诺',b=>{b.enter.characters=b.enter.characters.filter(p=>!p.assetId.includes('zhouzhi'));const layer=b.enter.characters.some(p=>p.layer==='center')?'left':'center';b.enter.characters.push(placement(assetId,layer,layer==='left'?80:445,64,.4));});
      else assert.fail('未处理人物处置：'+assetId);
    }
    for(const id of d.offscreenNodeIds||[])change(id,d.resourceKey+'：画外',b=>{b.enter=neutral();b.cgId=null;b.fullView=false;});
  }
  // 头盔寄放段只移动，画面保留画外；其余告别段的道具先后不再冲突。
  change('T-XM-000296_1','先告别后寄放；不造取回头盔事件',b=>{b.enter=neutral();b.cgId=null;b.fullView=false;});
  const cgRecords=[...json(BASE+'/P4-04/cg-review.json').records,...json(BASE+'/CG扩充20张/binding-plans.json').records];
  cgRecords.find(r=>r.cgId==='CG116').restrictions[0]='周栀与阿英搬箱，关闭卷帘门；T-ZZ-000237已明确天亮，采用清晨修图与次晨街道底层，纠正上游夜景推断。';
  for(const b of allBindings.values()){b.enter.cg=null;b.cgId=null;b.fullView=false;b.exit.restore=clone(b.enter);}
  for(const r of cgRecords){
    const id=r.anchor.nodeId,n=nodeMap.get(id);assert.equal(n.condition,r.anchor.condition);assert.equal(n.source.sha256,r.anchor.source.sha256);
    change(id,r.cgId+'：'+(r.basis||r.restrictions.join('；')),b=>{b.enter.cg=placement(r.assetId,'cg');b.cgId=r.cgId;b.fullView=true;});
  }
  // CG116是次晨搬箱，依据000237而不是上游“营业结束=夜间”的推断。
  change('T-ZZ-000240_1','CG116清晨修图；清CG后恢复次晨街道',b=>{b.enter.background=placement('bg-bijie-slope-street-day-overcast');});
  // 收到照片与告别回忆保留当前时空底层，绝不带入图中人物。
  for(const id of ['T-PI-000436_1','T-HQ-000342_1'])assert.equal(allBindings.get(id).enter.characters.length,0);
  const needResponses=new Map(json(BASE+'/P4-04/need-responses.json').responses.map(r=>[r.needId,r]));
  for(const [packageId,d] of Object.entries(docs)){
    for(const doc of Object.values(d)){doc.schemaVersion='p4-package-v2';doc.inputFingerprint=input.inputFingerprint;doc.contentBuildId=ir.buildId;}
    d.bindings.bindings=packages.find(p=>p.packageId===packageId).nodeIds.map(nodeId=>({nodeId,binding:allBindings.get(nodeId)}));
    for(const need of d.needs.needs){
      const decision=decisions.find(r=>r.needIds.includes(need.needId)),reply=needResponses.get(need.needId);
      assert(decision||reply,'缺处置：'+need.needId);
      let assetId,reason,ev=[];
      if(decision){assetId=decision.assetIds[0]||null;reason=decision.reason;ev=[evidence(BASE+'/P4-03/decisions.json')];
        if(['offscreen','escalated'].includes(decision.decision)){need.action='offscreen';assetId=null;reason=decision.decision==='escalated'?'已在新冻结版落实先告别、后寄放；文字/ID/条件保持；道具画外。':reason;}
        if(decision.decision==='escalated')ev.push(evidence(DOC+'/text-amendment.json'));
      }else{assetId=reply.assetId;reason=reply.basis;ev=[evidence(BASE+'/P4-04/cg-review.json')];if(need.needId==='P4-02-HQ-N010')need.cgId='CG109';}
      if(assetId)ev.push(assets.get(assetId).checkEvidence);
      need.status='resolved';need.resolution={assetId,reason:reason+'；采用限定节点及实际目标重建，P5运行另验。',evidence:ev};
    }
    for(const r of cgRecords.filter(r=>Number(r.cgId.slice(2))>=110&&r.packageId===packageId)){
      const needId=packageId+'-P407-'+r.cgId,nodeId=r.anchor.nodeId;
      d.needs.needs.push({needId,resourceKey:r.cgId,kind:'cg',action:'new',ownerTask:'P4-04',nodeIds:[nodeId],reason:r.restrictions[0],constraints:r.restrictions,existingAssetIds:[],proposedAssetId:r.assetId,cgId:r.cgId,status:'resolved',resolution:{assetId:r.assetId,reason:r.cgId==='CG116'?'已按天亮正文修为清晨，旧夜图退选；仅本段。':'接受冻结锚点；本页首可见帧解锁，下一实际目标重建。',evidence:[evidence(BASE+'/CG扩充20张/binding-plans.json'),assets.get(r.assetId).checkEvidence]}});
      d.review.reviews.find(v=>v.nodeIds.includes(nodeId)).needIds.push(needId);
    }
    for(const r of d.review.reviews){
      const reasons=d.needs.needs.filter(n=>r.needIds.includes(n.needId)).map(n=>n.resolution.reason);
      const local=changes.filter(c=>r.nodeIds.includes(c.nodeId)).map(c=>c.reason);
      if(r.status==='blocked'||local.length){r.basis='承接P4-02逐段判断；本次闭合：'+[...new Set([...reasons,...local])].join('；');}
      assert(r.basis.trim());r.status='reviewed';r.unresolved=[];
      r.decision=r.nodeIds.every(id=>JSON.stringify(allBindings.get(id).enter)===JSON.stringify(neutral()))?'neutral':'rebind';
    }
    for(const row of d.bindings.bindings){const b=row.binding,n=nodeMap.get(row.nodeId);b.anchor={nodeId:n.nodeId,file:n.source.file,sha256:n.source.sha256};
      // 保留具体演出限制；历史“待补/待检”的原句仍在原包，当前记录写实际结论。
      b.restrictions=b.restrictions.filter(s=>!/(?:待制|待交|待P4|待独立|尚待|尚未|等待|缺坐姿|未达到最终|须P4-05)/.test(s));
      const applied=changes.filter(c=>c.nodeId===row.nodeId);if(applied.length)b.restrictions.push(...[...new Set(applied.map(c=>c.reason))]);
      b.restrictions.push('P4-07静态采用；每次进入/读档/回退按目标完整重建，CG仅本页可见帧解锁；P5运行另验。');
    }
    for(const row of d.boundaries.boundaries){row.status='reviewed';row.unresolved=[];row.basis+='；P4-07已按新控制图重核，来源与目标完整状态分别登记；不将词法后继作为固定跳转。';}
    for(const [key,name] of Object.entries(V.NAMES))write(DOC+'/packages/'+packageId+'/'+name,d[key]);
    write(DOC+'/packages/'+packageId+'/交接.md',`# ${packageId} 采用闭合\n\n承接原包逐段审阅。${d.review.reviews.length}项审阅、${d.bindings.bindings.length}条绑定、${d.needs.needs.length}条需求和${d.boundaries.boundaries.length}项边界已闭合。资源检查/锚点/限制见对应JSON与P4-07总交接；P5运行另验。\n`);
  }
  write(DOC+'/resources.candidate.json',catalog);
  write(DOC+'/binding-changes.json',{task:'P4-07',parentInput:old.input.inputFingerprint,inputFingerprint:input.inputFingerprint,changes});
  write(DOC+'/cg-anchors.json',{contentBuildId:ir.buildId,records:cgRecords.map(r=>({cgId:r.cgId,assetId:r.assetId,nodeId:r.anchor.nodeId,condition:nodeMap.get(r.anchor.nodeId).condition,entryGate:nodeMap.get(r.anchor.nodeId).entryGate,depictionMode:r.depictionMode||'scene',basis:r.cgId==='CG116'?'以T-ZZ-000237天亮为准，已另制清晨版。':r.basis||r.restrictions.join('；')}))});
  console.log(JSON.stringify({status:'prepared',buildId:ir.buildId,paragraphs:paragraphs.length,nodes:nodes.length,changes:changes.length,assets:assets.size,cg:cgRecords.length}));
}
if(require.main===module)prepare();
module.exports={prepare};
