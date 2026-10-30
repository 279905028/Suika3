'use strict';
// 沿用上一批条件可达性核验，并校验本轮参考放行；仅写当前批次报告，不重写历史QA。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parse,condition,hash}=require('../../tools/compiler/parse.cjs');
const {model}=require('../../tools/compiler/model.cjs');
const root=path.resolve(__dirname,'../..'),load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const R=load('scenario/routes.json'),sources=Object.fromEntries(fs.readdirSync(path.join(root,'scenario')).filter(f=>f.endsWith('.md')).map(f=>[f,fs.readFileSync(path.join(root,'scenario',f),'utf8')]));
const ir=parse(R,sources),m=model(ir),review=load('qa/SUI-A09-release-20261029/review-released.json'),s=load('qa/SUI-A09-release-20261029/selection-released.json'),shots=review.shots;
const report={task:'SUI-A09全部上游参考放行',date:'2026-10-29',layer:'当前正文与双分页锚点/逐镜条件可达性/上游冻结参考及格式证据；未运行引擎或加载CG',status:'running',checks:[],counts:{},notTested:['CG图像生成及视觉终审','正式美术采用','NovelML演出绑定','进入退出/回退读档的实际引擎效果','浏览器/手机真机/桌面','发布']};
const check=(name,fn)=>{const detail=fn();report.checks.push({name,status:'pass',detail});console.log('PASS '+name);};
const assignments=function*(ids){for(let mask=0;mask<2**ids.length;mask++)yield Object.fromEntries(ids.map((id,i)=>[id,mask>>i&1?'B':'A']));};
const routeShots=shots.filter(r=>r.routeGroup!=='COMMON'||r.kind==='approved-addition');
const coverage=Object.fromEntries(shots.map(r=>[r.id,{present:0,absent:0,witnesses:[]}])) ,representatives=new Map();
const endings=R.routes.flatMap(r=>[...r.endings,...r.lowPathEndings||[]]);
function expected(row,state){
  for(const gate of row.conditions.entryGates){
    if(gate.type==='route'&&state.route!==gate.value)return false;
    if(gate.type==='epilogue'&&state.epilogue!==gate.value)return false;
    if(gate.type==='sharedEvent'&&(!gate.routes.includes(state.route)||state.relation!==gate.relation))return false;
  }
  return row.conditions.requiredExpressions.every(e=>m.evaluate(condition(e,ir.choices,endings),state));
}
function compare(rows,out,label){
  const visited=new Set(out.paragraphs.map(p=>p.id));
  for(const r of rows){const actual=visited.has(r.source.paragraph),want=expected(r,out.s);assert.equal(actual,want,label+' / '+r.id+' 条件误配');
    const c=coverage[r.id];c[actual?'present':'absent']++;if(actual&&c.witnesses.length<2)c.witnesses.push(label);
  }
}
try {
check('60项选择不变、全部上游依赖有具体参考、7包共同放行',()=>{
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
});
check('60镜当前原文、段落ID、分页及退场位置准确',()=>{
  const nodes=new Map(ir.nodes.map(n=>[n.id,n]));let exact=0,reanchored=[];
  for(const r of shots){
    const src=sources[path.basename(r.source.path)];assert.equal(hash(src),r.source.sourceSha256,r.id+'来源过期');
    const lines=src.split('\n');assert.equal(lines[r.source.line-1].trim(),r.source.quote,r.id+'行文不符');
    assert.equal(lines.filter(l=>l.includes(r.source.matchText)).length,1,r.id+'锚点非唯一');
    const pages=ir.nodes.filter(n=>n.paragraph===r.source.paragraph);
    assert(pages.length);assert.deepEqual(pages.map(n=>n.id),r.lifecycle.visiblePageIds);
    assert.equal(pages[0].id,r.lifecycle.enterBeforeId);assert.equal(pages.map(n=>n.text).join(''),r.source.quote);
    assert.equal(pages.at(-1).next,r.lifecycle.exitBeforeId);assert(nodes.has(r.lifecycle.exitBeforeId));
    assert.equal(new Set(pages.map(n=>n.source.file)).size,1);
    for(const c of r.contextSources){const text=sources[path.basename(c.path)];assert.equal(hash(text),c.sourceSha256);assert.equal(text.split('\n')[c.line-1].trim(),c.quote);}
    if(r.kind==='retained-selection'){if(r.source.oldAnchorExact)exact++;else reanchored.push(r.id);}
  }
  assert.equal(exact,48);assert.deepEqual(reanchored,['CG006','CG040','CG041','CG044']);
  const meeting=shots.find(r=>r.id==='CG012');
  assert(ir.nodes.findIndex(n=>n.id===meeting.lifecycle.enterBeforeId)<ir.nodes.findIndex(n=>n.op==='event'&&n.event===R.hiddenEntry.readEvent));
  return {shots:60,oldAnchorsStillExact:exact,reanchored,currentParagraphs:ir.nodes.filter(n=>n.op==='text'&&n.offset===0).length,currentPages:ir.nodes.filter(n=>n.op==='text').length};
});
check('人物参考文件与前置版本存在且指纹吻合',()=>{
  for(const[k,v]of Object.entries(review.references)){
    assert.equal(hash(fs.readFileSync(path.join(root,v.sourceFile))),v.sourceSha256,k);
    assert.equal(hash(fs.readFileSync(path.join(root,v.recordPath))),v.recordSha256,k+'上游记录改变');
    assert(v.sourceFile.includes(v.version));
    assert(!/option-b.*mengyao|option-a.*zhouzhi|piao.*option-a|chensheng.*option-a/.test(v.sourceFile));
  }
  for(const r of shots)for(const k of r.referenceKeys)assert(review.references[k],k);
  return {references:Object.keys(review.references).length,actualImagesDecodedInA09:0,meaning:'检查文件与版本；不复述其他批次视觉结果为本次验收'};
});
const allDefault=Object.fromEntries(Object.keys(ir.choices).filter(k=>k!=='ROUTE-01').map(k=>[k,'A']));
const bases={};
check('32组共通相关组合：相识门禁与三处关系计分',()=>{
  const ids=['C01-02','C02-01',...R.piaoRelation.choices.map(c=>c.id)];let count=0;
  const commonShots=shots.filter(r=>r.kind==='retained-selection'&&r.routeGroup==='COMMON');
  for(const a of assignments(ids)){
    const out=m.run({...allDefault,...a});assert.equal(out.waiting,'ROUTE-01');
    compare(commonShots,out,'COMMON/'+ids.map(k=>a[k]).join(''));
    if(out.s.events.includes(R.hiddenEntry.readEvent))bases[out.s.relation]??=out.s;
    count++;
  }
  assert.equal(count,32);assert(bases.HIGH&&bases.LOW);report.counts.commonCombinations=count;return {count,scope:'5个影响当前CG入口或关系分流的选择全组合，其余共通选择用A代表'};
});
check('2818条路线展开：60项正式选集的可达性/排除条件',()=>{
  let count=0,calls=0,returns=0;
  for(const route of R.routes)for(const relation of ['HIGH','LOW']){
    const ids=Object.values(ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
    for(const a of assignments(ids)){
      const out=m.run({...a,'ROUTE-01':route.id},{state:bases[relation],start:ir.entries[R.storyEntry.routeEntry]});
      assert.equal(out.s.status,'complete');const combo=(route.id==='piao'&&relation==='LOW'?[route.lowPathChoice]:route.keyChoices).map(k=>a[k]).join('');
      const key=route.id+'/'+relation+'/'+combo;compare(routeShots,out,key);
      if(!representatives.has(key))representatives.set(key,new Set(out.paragraphs.map(p=>p.id)));
      calls+=out.trace.filter(n=>n.op==='call').length;returns+=out.trace.filter(n=>n.op==='return').length;count++;
    }
  }
  assert.equal(count,2818);assert.equal(calls,returns);assert.equal(calls,1280);
  assert(Object.values(coverage).every(c=>c.present>0),'存在无人可达镜头');
  report.counts.routeExpansions=count;report.counts.sharedCalls=calls;report.counts.sharedReturns=returns;
  return {count,calls,returns,all60Reachable:true,representativeCombinations:representatives.size};
});
check('重点反例：不误套最终AA、形态不由结局奖励、后日谈不串视角',()=>{
  const row=id=>shots.find(s=>s.id===id),has=(key,id)=>representatives.get(key).has(row(id).source.paragraph);
  let assertions=0;const yes=(key,id,value)=>{assert.equal(has(key,id),value,key+' '+id);assertions++;};
  for(const rel of ['HIGH','LOW'])for(const combo of ['AA','AB','BA','BB']){
    yes('mengyao/'+rel+'/'+combo,'CG044',combo[0]==='A');
    for(const id of ['CG038','CG039','CG040','CG041'])yes('mengyao/'+rel+'/'+combo,id,true);
    yes('mengyao/'+rel+'/'+combo,'CG104',combo==='AA');yes('mengyao/'+rel+'/'+combo,'CG105',combo!=='AA');
    yes('xiaoman/'+rel+'/'+combo,'CG019',combo[0]==='A');
    yes('huangqiuqiu/'+rel+'/'+combo,'CG077',combo[0]==='A');
    yes('huangqiuqiu/'+rel+'/'+combo,'CG078',true);yes('huangqiuqiu/'+rel+'/'+combo,'CG079',true);
    yes('friends/'+rel+'/'+combo,'CG100',rel==='HIGH'&&combo!=='AA');
    if(combo!=='AA')for(const id of ['CG095','CG096','CG098','CG099'])yes('friends/'+rel+'/'+combo,id,false);
  }
  for(const combo of ['AA','AB','BA','BB'])yes('piao/HIGH/'+combo,'CG066',true);
  for(const rel of ['HIGH','LOW'])for(const combo of rel==='HIGH'?['AA','AB','BA','BB']:['A','B'])yes('piao/'+rel+'/'+combo,'CG101',false);
  for(const id of ['CG095','CG096','CG098','CG099','CG100'])yes('piao/HIGH/AA',id,false);
  report.counts.focusedAssertions=assertions;return {assertions};
});
check('非法状态不会默认放行',()=>{
  let rejected=0;const reject=fn=>{assert.throws(fn);rejected++;};
  const cg=shots.find(r=>r.id==='CG044'),unknown=structuredClone(bases.HIGH);unknown.route='mengyao';
  reject(()=>expected(cg,unknown));
  for(const relation of ['UNSET','MID']){const state={...structuredClone(bases.LOW),route:'piao',relation};reject(()=>expected(shots.find(r=>r.id==='CG067'),state));}
  reject(()=>m.run({}, {state:bases.LOW,start:ir.entries[R.day36.sharedSource.file]}));
  return {rejected};
});
check('图鉴60空槽保持，未绑定图像或重建运行包',()=>{
 const registry=load('system/sui-u/gallery.registry.json');assert.deepEqual(registry.items.map(r=>r.id),s.activeSelectedIds);assert(registry.items.every(r=>r.file===null&&r.unlockVariable==='sui_cg_'+r.id));
 const order=fs.readFileSync(path.join(root,'system/sui-u/gallery-order.ray'),'utf8').match(/var suiCGOrder = (\[[^;]+\]);/);assert(order);assert.deepEqual(JSON.parse(order[1]),s.activeSelectedIds);
 return {sourceSlots:60,boundImages:0,runtimeRebuilt:false,liveGalleryTested:false};
});
check('本次904项已有正文、原件与运行输入保持不变',()=>{
 const before=load('qa/SUI-A10-preflight-20261029/input-before.json').files;
 for(const f of before)assert.equal(hash(fs.readFileSync(path.join(root,f.path))),f.sha256,f.path);
 report.counts.protectedInputs=before.length;return {protectedInputs:before.length,changed:0};
});
report.coverage=coverage;report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);process.exitCode=1;}
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,counts:report.counts}));
