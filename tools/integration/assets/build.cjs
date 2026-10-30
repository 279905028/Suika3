#!/usr/bin/env node
'use strict';
// I01仅生成声明式资源数据。不会生成NovelML或调用运行构建。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parse,condition,hash}=require('../../compiler/parse.cjs');
const decisions=require('./decisions.cjs');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/sui-i01-20261029';
const read=p=>fs.readFileSync(path.join(ROOT,p)),json=p=>JSON.parse(read(p));
const put=(p,x)=>{fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),JSON.stringify(x,null,2)+'\n');};
const fingerprint=p=>({path:p,sha256:hash(read(p))});
const A11='qa/SUI-A11-20261029/pending-adoption.json',all=json(A11).records;
const approved=json(QA+'/approval.json'),proposal=json(approved.proposalPath);
assert.equal(approved.decision,'approved');assert.equal(hash(read(approved.proposalPath)),approved.proposalSha256);
assert.equal(hash(read(A11)),proposal.a11.sha256);
const selected=all.filter(r=>r.role==='pending_adoption_review');
assert.deepEqual(approved.assetIds,selected.map(r=>r.assetId));assert.equal(selected.length,212);
const R=json('scenario/routes.json'),files=[...new Set([...R.storyEntry.common,R.storyEntry.routeEntry,...R.routes.map(r=>r.file),R.day36.sharedSource.file,...R.epilogues.rules.flatMap(r=>r.target?[r.target.file]:[])])];
const sources=Object.fromEntries(files.map(f=>[f,read('scenario/'+f).toString()]));
const ir=parse(R,sources,{pageSize:108}),endings=R.routes.flatMap(r=>[...r.endings,...r.lowPathEndings||[]]);
const sourceHashes=Object.fromEntries(['scenario/routes.json',...files.map(f=>'scenario/'+f)].map(p=>[p,hash(read(p))]));
const paragraphs=new Map();for(const n of ir.nodes.filter(n=>n.op==='text')){if(!paragraphs.has(n.paragraph))paragraphs.set(n.paragraph,[]);paragraphs.get(n.paragraph).push(n);}
const byFile=Object.fromEntries(files.map(f=>[f,ir.nodes.filter(n=>n.source.file===f)]));
const guards=new Map();for(const nodes of Object.values(byFile)){
  const indices=new Map(nodes.map((n,i)=>[n.id,i]));
  for(let i=0;i<nodes.length;i++)guards.set(nodes[i].id,nodes.filter((n,j)=>n.op==='branch'&&j<i&&i<indices.get(n.otherwise)).map(n=>n.condition));
}
const expr=ast=>ast.map(g=>g.map(t=>t.field+t.operator+t.value).join('&')).join('|');
function locate(file,quote){const matches=[...paragraphs.values()].filter(p=>p[0].source.file===file&&p.map(n=>n.text).join('').includes(quote));assert.equal(matches.length,1,`${file} 锚点非唯一/缺失：${quote}`);return matches[0];}
function gates(file){
 const route=R.routes.find(r=>r.file===file);if(route)return [{type:'route',value:route.id},...(route.id==='huangqiuqiu'?[{type:'event',value:R.hiddenEntry.readEvent}]:[])];
 if(file===R.day36.sharedSource.file)return [{type:'sharedEvent',value:'PIAO-D36',routes:R.day36.calls.map(c=>c.routeId),relation:'LOW'}];
 if(R.epilogues.rules.some(r=>r.target?.file===file))return [{type:'epilogue',value:file}];return [];
}
function kind(r){return r.assetId.startsWith('cg-')?'cg':r.assetId.startsWith('bg-')?'background':r.assetId.startsWith('prop-')||r.assetId.startsWith('piao-prop-')?'prop':'character';}
function identity(r){const u=r.upstreamSnapshot.record;return u.characterOrSceneKey||u.character||(r.package==='SUI-A05'?'piao':null);}
function layout(r){
 const k=kind(r),w=r.webpMetadata.width,h=r.webpMetadata.height,p=r.placement||{};
 if(k==='cg'||k==='background'){const scale=Math.min(1280/w,720/h);return {layer:k==='cg'?30:0,slot:k,mode:'contain',x:(1280-w*scale)/2,y:(720-h*scale)/2,scale,width:w*scale,height:h*scale,matte:'#10181c',crop:false};}
 if(k==='prop'){const scale=Math.min(560/w,340/h);return {layer:20,slot:'prop-center',mode:'contain',x:(1280-w*scale)/2,y:110,scale,width:w*scale,height:h*scale,crop:false};}
 const scale=p.staticPreview?.placement?.scale||p.previewPlacement?.scale||p.offlineUI?.scale||p.previewScale||0.38;
 const y=p.staticPreview?.placement?.imageTop??p.previewPlacement?.y??p.offlineUI?.spriteRect?.[1]??p.previewXY?.[1]??42;
 return {layer:10,slot:'character-center',mode:'portrait',x:(1280-w*scale)/2,y,scale,width:w*scale,height:h*scale,crop:false};
}
const bindings=[],records=selected.map(r=>{
 const u=r.upstreamSnapshot.record,proposed=proposal.records.find(p=>p.assetId===r.assetId);
 for(const [p,sha]of [[r.sourceFile,r.sourceMetadata.sha256],[r.existingWebP,r.webpMetadata.sha256],[r.upstreamSnapshot.recordFile,r.upstreamSnapshot.recordFileSha256]])assert.equal(hash(read(p)),sha,p+' 指纹不符');
 assert.equal(r.offlineStatus,'通过');assert(r.pixelComparison.exactRGBAEqual);
 const target=path.join(ROOT,proposed.runtimePath);fs.mkdirSync(path.dirname(target),{recursive:true});
 if(fs.existsSync(target))assert.equal(hash(fs.readFileSync(target)),r.webpMetadata.sha256,'拒绝覆盖不同字节 '+target);else fs.copyFileSync(path.join(ROOT,r.existingWebP),target);
 return {assetId:r.assetId,type:kind(r),version:typeof u.version==='number'?'v'+String(u.version).padStart(3,'0'):u.version||r.sourceFile.match(/v\d+/g)?.at(-1)||'v001',package:r.package,
  source:{...r.sourceMetadata},runtime:{...r.webpMetadata,path:proposed.runtimePath},derivativeSource:fingerprint(r.existingWebP),encoding:r.upstreamEncoding||u.encoding||{lossless:true,process:'复用A11已验证VP8L；字节不变'},
  approval:{...fingerprint(QA+'/approval.json'),decisionId:approved.decisionId,scope:'本文件及下列使用限制；不含运行验收'},
  a11:{...fingerprint(A11),assetId:r.assetId,recordIndex:all.indexOf(r),offlineStatus:r.offlineStatus,visualEvidence:r.visualEvidence,checks:r.checks},
  provenance:{upstreamRecord:fingerprint(r.upstreamSnapshot.recordFile),recordIndex:r.upstreamSnapshot.recordIndex,promptOrProcessRecord:r.promptOrProcessRecord},
  usage:{restrictions:[r.usage,r.binding?.condition,r.exitRule,...r.integrationNotes||[]].filter(Boolean),upstreamConditions:r.conditions,wardrobeAndForm:r.wardrobeAndForm||u.form||r.usage||r.binding?.condition,propState:r.propState||'仅保留本图既有物件；不跨拍继承',character:identity(r),form:u.form||(r.assetId.startsWith('sui-a06-orb')?'orb':kind(r)==='character'?'human':null)},
  placement:layout(r),criticalRegions:r.placement?.criticalRects||r.criticalSourceRegions||{},sourcePlacement:r.placement,
  adoptionStatus:'approved-and-imported',runtimeVerified:false};
});
const assetMap=new Map(records.map(r=>[r.assetId,r]));
function make(r,pages,extra={}){
 const first=pages[0],last=pages.at(-1),quote=pages.map(n=>n.text).join('');
 const predicates=guards.get(first.id).map(expr);predicates.forEach(e=>condition(e,ir.choices,endings));
 const b={bindingId:`i01-${r.assetId}-${first.paragraph}`,assetId:r.assetId,
   source:{path:'scenario/'+first.source.file,paragraphId:first.paragraph,contextAnchor:first.source.anchor,lineHint:first.source.line,quote,quoteSha256:hash(quote),sourceSha256:sourceHashes['scenario/'+first.source.file]},
   conditions:{entryGates:gates(first.source.file),requiredExpressions:predicates},
   display:{...assetMap.get(r.assetId).placement,hideAtChoice:true,fullViewWithinSameParagraph:true},
   enter:{phase:'before-first-page',cursor:first.id},visiblePageIds:pages.map(n=>n.id),
   exit:{phase:'before-any-cursor-outside-visible-pages',lexicalNextCursor:last.next,restore:'resolve-destination-base-scene',clear:['asset','form','wardrobe','props','cg'],doNotWaitForLexicalSuccessor:true},
   restore:{target:'destination-cursor',baseScene:'resolve-all-non-cg-bindings-at-destination',missingBackground:{color:'#10181c'},missingCharacters:[],missingProps:[],cg:null,formAndWardrobe:'from-destination-asset-only',neverCarryAcrossParagraph:true},
   save:{stablePageOnly:true,fields:['bindingId','cursor','assetId','baseScene','cgId','viewMode'],validate:['interface','manifest','binding','source','conditions'],recomputeOnLoad:true,rollback:'resolve-restored-cursor',restart:'clear-all-layers'},
   ...extra};bindings.push(b);return b;
}
const shots=json('qa/SUI-A10-production-20261029/resource-records.json').records;
const relocations=[];
for(const r of selected){if(kind(r)!=='cg')continue;const s=shots.find(s=>s.assetId===r.assetId);assert(s);const pages=locate(path.basename(s.source.path),s.source.quote);
 const b=make(r,pages,{cgId:s.cgId,conditions:s.conditions,sceneFacts:{before:s.lifecycle.snapshotBefore,wardrobeAndForm:s.wardrobeAndForm,propState:s.propState,special:s.lifecycle.special},gallery:{id:s.cgId,unlock:'on-actual-first-visible-frame',variable:'sui_cg_'+s.cgId,global:true,registrationUnlocks:false,rollbackRelocks:false},reveal:{hide:['message','name','menu','auto-status'],sameParagraphOnly:true,addsPage:false}});
 b.conditions.requiredExpressions.forEach(e=>condition(e,ir.choices,endings));
 relocations.push({cgId:s.cgId,oldSourceSha256:s.source.sourceSha256,currentSourceSha256:b.source.sourceSha256,oldParagraphId:s.source.paragraph,currentParagraphId:b.source.paragraphId,oldLine:s.source.line,currentLine:b.source.lineHint,quoteUnchanged:true,oldExit:s.lifecycle.exitBeforeId,currentExit:b.exit.lexicalNextCursor});
}
for(const [id,picks]of Object.entries(decisions.anchorPicks)){
 const r=selected.find(r=>r.assetId===id);assert(r,id);
 for(const i of picks){const a=r.anchors[i];assert(a?.path.startsWith('scenario/'),id+' 非正文锚点');make(r,locate(path.basename(a.path),a.quote),{decisionBasis:'人工逐项选用上游anchors['+i+']；按当前IR推导完整条件'});}
}
for(const[id,file,quote]of decisions.overrides){const r=selected.find(r=>r.assetId===id);assert(r);make(r,locate(file,quote),{decisionBasis:'I01逐拍回读当前正文重选锚点；原件与上游记录保留'});}
// 所有采用项都有明确去向：启用到限定拍点，或批准备用，不能隐式扫目录启用。
const reserves=[];for(const r of records){r.bindingIds=bindings.filter(b=>b.assetId===r.assetId).map(b=>b.bindingId);r.usage.status=r.bindingIds.length?'bound-to-explicit-paragraphs':'approved-reserve';if(!r.bindingIds.length){const reason=decisions.reserveReasons[r.assetId]||'上游仅提供人物资料/场景族或可选昼夜差分；本版没有确认适用的独立拍点，禁止自动替换。';r.usage.reserveReason=reason;reserves.push({assetId:r.assetId,reason});}}
const schemaVersion='sui-i01-data-v1';
const manifest={schemaVersion,revision:'sui-i01-20261029-v1',scope:'用户批准的212项WebP；限定拍点绑定及批准备用；不宣称全正文连续演出',approval:fingerprint(QA+'/approval.json'),records,excluded:proposal.excluded};
put('assets/current/manifest.json',manifest);
const bindingDoc={schemaVersion,revision:'sui-i01-20261029-v1',pageSize:108,sourceHashes,manifest:fingerprint('assets/current/manifest.json'),
 interfaceStatus:'I01声明式数据合同；待I02消费与共同接口对齐，不是已完成运行接口验收',
 candidatePolicy:{fullCandidateAllowed:false,allowedUse:'I02限定拍点诊断与接口适配',blockers:['I02共同接口未对齐','全正文连续背景/人物演出未覆盖；中性空场仅为诊断回退默认值，不是正式演出批准']},
 semantics:{mode:'explicit-paragraph-cues',absence:'neutral-stage-no-inherited-art',baseScene:{background:{color:'#10181c'},characters:[],props:[],cg:null},priority:['background','character','prop','cg'],cgHidesBaseScene:true,exitBeforeAnyNonMemberCursor:true,conditionsEvaluatedOnlyAfterCursorMatch:true,unknownOrMissingState:'error',choicesHideArt:true,fullViewDoesNotAdvanceStory:true,galleryUnlockRequiresActualVisibleFrame:true},bindings,reserves};
put('docs/整合/bindings.json',bindingDoc);
put(QA+'/anchor-recheck.json',{pageSize:108,pages:ir.nodes.filter(n=>n.op==='text').length,paragraphs:paragraphs.size,sourceHashes,cg:relocations});
put(QA+'/source-map.json',Object.fromEntries(ir.nodes.map(n=>[n.id,{op:n.op,source:n.source,paragraph:n.paragraph,next:n.next}])));
put(QA+'/coverage.json',{scope:bindingDoc.semantics.mode,adopted:records.length,cg:bindings.filter(b=>b.cgId).length,bindings:bindings.length,boundAssets:records.filter(r=>r.bindingIds.length).length,reserves:reserves.length,coveredParagraphs:new Set(bindings.map(b=>b.source.paragraphId)).size,totalParagraphs:paragraphs.size,unboundParagraphs:[...paragraphs.keys()].filter(p=>!bindings.some(b=>b.source.paragraphId===p)),reserveDetails:reserves,fullContinuousStaging:false,interfaceAlignedWithI02:false,notTested:['引擎','游戏浏览器','手机真机','电脑原生','发布']});
const inputs=[...new Set([A11,approved.proposalPath,QA+'/approval.json','tools/integration/assets/build.cjs','tools/integration/assets/decisions.cjs',...Object.keys(sourceHashes),'tools/compiler/parse.cjs','tools/compiler/model.cjs','system/sui-u/integration.json','system/sui-u/gallery.registry.json','qa/SUI-A10-production-20261029/resource-records.json','docs/CG当前选择.json',...selected.flatMap(r=>[r.sourceFile,r.existingWebP,r.upstreamSnapshot.recordFile]),'main.ray','start.novel','config.ini','tools/runtime/build.cjs'])];
const protectedSnapshot=QA+'/input-before.json';if(!fs.existsSync(path.join(ROOT,protectedSnapshot)))put(protectedSnapshot,inputs.filter(p=>!p.startsWith('tools/integration/')&&!p.startsWith(QA)).map(fingerprint));
put(QA+'/build-inputs.json',inputs.map(fingerprint));
console.log(JSON.stringify({adopted:records.length,bindings:bindings.length,cg:60,reserves:reserves.length,output:'docs/整合/bindings.json'}));
module.exports={ROOT,QA,read,json,put,fingerprint,ir,records,bindings,sourceHashes};
