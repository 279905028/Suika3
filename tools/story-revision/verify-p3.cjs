#!/usr/bin/env node
'use strict';
// P3全稿独立审读候选验证：P2与正式正文只读，不导出运行包，不启动引擎。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../compiler/compile.cjs');
const {hash}=require('../compiler/parse.cjs');
const {model}=require('../compiler/model.cjs');
const {textEntries}=require('./verify-p2.cjs');
const ROOT=path.resolve(__dirname,'../..');
const P2=path.join(ROOT,'docs/修订协作/P2-全稿修订-20261103');
const P3=path.join(ROOT,'docs/修订协作/P3-独立审读-20261103');
const P2QA=path.join(ROOT,'qa/dialogue-p2-closeout-20261103');
// 后续复验必须另存新批次；不覆盖冻结批次，也不重新生成带审读者身份的历史登记。
const args=process.argv.slice(2);
assert(args.length===0||(args.length===2&&args[0]==='--recheck-out'),'用法：node tools/story-revision/verify-p3.cjs [--recheck-out qa/新批次/verification]');
const recheck=args.length>0;
const historicalQA=path.join(ROOT,'qa/dialogue-p3-review-20261103');
const QA=recheck?path.resolve(ROOT,args[1]):historicalQA;
if(recheck){
 const qaRoot=path.join(ROOT,'qa');
 assert(QA.startsWith(qaRoot+path.sep),'复验输出必须位于本项目qa的新目录');
 assert(!fs.existsSync(QA),'复验目录已存在，请使用新的空目录');
 let ancestor=path.dirname(QA);while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
 assert.equal(fs.realpathSync(ancestor),ancestor,'复验输出不能经过符号链接');
}
const INPUT=path.join(QA,'input');
const REVIEW=require('./p3-review-changes.json');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const read=p=>fs.readFileSync(p,'utf8');
const compact=s=>s.replace(/\s/g,'');
const write=(name,data)=>{if(recheck&&!['static-verification.json','editorial-verification.json','chapter-stats.json','recheck-verification.json'].includes(name))return;const p=path.join(QA,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');};
const id=(code,n)=>`T-${code}-${String(n).padStart(6,'0')}`;
const changes=REVIEW.changes,changeById=new Map(changes.map(c=>[c.id,c]));
const p2Review=json(path.join(P2QA,'editorial-review.json'));
const p2Map=json(path.join(P2QA,'source-map.json'));
const p2Build=json(path.join(P2QA,'build-report.json'));
assert.equal(p2Review.contentBuildId,REVIEW.sourceContentBuildId);
assert.equal(p2Map.candidateBuildId,REVIEW.sourceContentBuildId);
assert.equal(changes.length,3);assert.equal(new Set(changes.map(c=>c.id)).size,3);
const fileNames=p2Review.reviewedFiles.map(r=>path.basename(r.candidateFile));
assert.deepEqual(fs.readdirSync(path.join(P3,'正文')).filter(f=>f.endsWith('.md')).sort(),[...fileNames].sort());
const beforeSources={},candidateSources={},changedEntries=[];
for(const row of p2Review.reviewedFiles){
 const file=path.basename(row.candidateFile),before=read(path.join(P2,'正文',file));
 assert.equal(hash(before),row.sha256,'P2只读输入漂移：'+file);
 let expected=before;
 for(const change of changes.filter(c=>path.basename(c.file)===file)){
  // 前稿文字、稳定ID和唯一性均须精确匹配。
  const block=new RegExp(`(^<!-- TEXT \\{"id":"${change.id}"[^\\n]*\\} -->\\n)([^\\n]+)`,'m');
  const match=block.exec(expected);assert(match,'P3修订锚点不存在：'+change.id);assert.equal(match[2],change.expectedText,'P2前稿文字漂移：'+change.id);
  assert.equal((expected.match(new RegExp(change.id,'g'))||[]).length,1,'ID必须唯一：'+change.id);
  expected=expected.replace(block,`$1${change.replacementText}`);
 }
 const after=read(path.join(P3,'正文',file));assert.equal(after,expected,'P3存在审定清单外变化：'+file);
 const oldEntries=textEntries(before,file),newEntries=textEntries(after,file);assert.equal(oldEntries.length,newEntries.length);
 const oldById=new Map(oldEntries.map(e=>[e.id,e]));
 for(const e of newEntries){const old=oldById.get(e.id);assert(old,'新增或换号ID：'+e.id);assert.deepEqual(e.meta,old.meta,'TEXT元数据不得变化：'+e.id);if(e.text!==old.text){const c=changeById.get(e.id);assert(c,'未审定的文字变化：'+e.id);assert.equal(e.text,c.replacementText);changedEntries.push({file:e.file,id:e.id,before:old.text,after:e.text,category:c.category});}}
 assert.equal(oldEntries.length,new Set(oldEntries.map(e=>e.id)).size);
 beforeSources[file]=before;candidateSources[file]=after;
}
assert.equal(changedEntries.length,3);
for(const file of fileNames){fs.mkdirSync(path.join(INPUT,'scenario'),{recursive:true});fs.copyFileSync(path.join(P3,'正文',file),path.join(INPUT,'scenario',file));}
const formalRoutes=read(path.join(ROOT,'scenario/routes.json'));
assert.equal(hash(formalRoutes),hash(read(path.join(P2QA,'input/scenario/routes.json'))),'路线规则相对P2发生变化');
fs.copyFileSync(path.join(ROOT,'scenario/routes.json'),path.join(INPUT,'scenario/routes.json'));
const first=compile({root:INPUT,textPolicy:'required',pageSize:108});
const second=compile({root:INPUT,textPolicy:'required',pageSize:108});
assert.deepEqual(second,first,'P3确定性双编译不一致');
const generated=first,ir=generated.ir,R=ir.contract,m=model(ir);
const baseline=compile({pageSize:108}),old=baseline.ir,prior=model(old);
const registry=json(path.join(ROOT,'qa/dialogue-p0-20261102/paragraph-registry.json'));
const sourceIds=registry.paragraphs.map(p=>p.id),sourceSet=new Set(sourceIds),bySource=new Map(registry.paragraphs.map(p=>[p.id,p]));
const mappings=p2Map.mappings.map(row=>({...row}));
for(const row of mappings)for(const newId of row.newIds){const change=changeById.get(newId);if(change){row.p3Review={batch:REVIEW.batch,category:change.category,reason:change.reason,previousOperation:row.operation};if(row.operation==='retag')row.operation='rewrite';row.reason+='；P3独立审读：'+change.reason;}}
const entries=Object.entries(candidateSources).flatMap(([f,s])=>textEntries(s,f)),byNew=new Map(entries.map(e=>[e.id,e]));
const report={status:'running',scope:'P3独立审读候选的逐段差异、静态结构、文本尺度、来源映射和规则执行；不是引擎、浏览器、真机或发布验收',checks:[],warnings:[],reviewBatch:REVIEW.batch,p2ContentBuildId:REVIEW.sourceContentBuildId,p3ReviewedChanges:changedEntries};
const check=(name,fn)=>{fn();report.checks.push({name,status:'pass'});};
check('P2只读输入保护及仅限三处最小文字修订',()=>{
 assert.equal(changedEntries.length,3);assert.equal(entries.length,4748);assert.deepEqual(changedEntries.map(e=>e.id).sort(),changes.map(c=>c.id).sort());
 for(const c of changes){assert(c.adopted);assert.equal(hash(read(path.join(P3,'正文',path.basename(c.file)))),hash(candidateSources[path.basename(c.file)]));}
 report.reviewedParagraphs=entries.length;report.changedParagraphs=changedEntries.length;report.unchangedParagraphs=entries.length-changedEntries.length;
});
check('冻结候选确定性双编译及required候选覆盖',()=>{
 assert.equal(first.ir.buildId,second.ir.buildId);assert.deepEqual(first.manifest,second.manifest);assert.equal(first.manifest.runtimeReady,false);assert.equal(Object.keys(ir.entries).length,12);
 const required=ir.nodes.filter(n=>n.textMeta);assert(required.every(n=>byNew.has(n.paragraph)));assert.equal(new Set(required.map(n=>n.paragraph)).size,entries.length);
});
check('原段映射闭合、ID唯一及required全覆盖',()=>{
 const seenSource=new Map(),seenNew=new Set();
 for(const row of mappings){assert(row.oldIds.length||row.operation==='insert');for(const oldId of row.oldIds){assert(sourceSet.has(oldId),'未知原段：'+oldId);seenSource.set(oldId,(seenSource.get(oldId)||0)+1);}for(const newId of row.newIds){assert(!seenNew.has(newId),'重复新段：'+newId);seenNew.add(newId);assert(byNew.has(newId),'映射未落入候选：'+newId);}}
 for(const sourceId of sourceIds){assert(seenSource.has(sourceId),'原段未映射：'+sourceId);const owner=bySource.get(sourceId).file;for(const row of mappings.filter(r=>r.oldIds.includes(sourceId)))assert.equal(row.file,owner,'原段跨文件映射：'+sourceId);}
 assert.equal(seenSource.size,registry.paragraphs.length);assert.equal(seenNew.size,entries.length);
 report.sourceParagraphs=sourceIds.length;report.candidateParagraphs=entries.length;
});
check('选择文案、条件、结局、计分、事件与控制标记不变',()=>{
 assert.deepEqual(R,old.contract);
 const choiceContract=choices=>Object.fromEntries(Object.entries(choices).map(([choiceId,c])=>[choiceId,{question:c.question,options:c.options.map(o=>({value:o.value,text:o.text}))}]));
 assert.deepEqual(choiceContract(ir.choices),choiceContract(old.choices));
 const protectedControls=json(path.join(ROOT,'qa/dialogue-p0-20261102/protected-controls.json'));
 for(const original of protectedControls.files){const candidate=candidateSources[path.basename(original.file)];assert(candidate,'缺候选文件：'+original.file);const actual=candidate.split('\n').map(s=>s.trim()).filter(s=>/^(<!--|\*\*选择 |#### (?:[AB]｜|共同段|结局 )|### (?:罗小满|周栀|孟遥|飘|黄球球|朋友与职业)｜)/.test(s)&&!s.startsWith('<!-- TEXT '));assert.deepEqual(actual,original.markers.map(x=>x.text),'控制标记变化：'+original.file);}
});
check('正式scenario、旧资源与资源绑定未被候选覆盖',()=>{
 const prepared=json(path.join(ROOT,'qa/dialogue-p2-writing-20261103/preparation.json'));
 for(const f of prepared.sourceFiles)assert.equal(hash(fs.readFileSync(path.join(ROOT,f.file))),f.sha256,f.file);
 assert.equal(hash(fs.readFileSync(path.join(ROOT,'scenario/routes.json'))),hash(fs.readFileSync(path.join(INPUT,'scenario/routes.json'))));
 const protectedInputs=json(path.join(ROOT,'qa/dialogue-p0-20261102/baseline.json')).inputs.filter(e=>e.path.startsWith('scenario/')||e.path.startsWith('assets/')||e.path==='docs/整合/bindings.json');
 for(const e of protectedInputs){const p=path.join(ROOT,e.path),s=fs.readFileSync(p);
  // README只说明阶段，不参与编译。复验单列其变化，不能把说明更新说成正文采用。
  if(recheck&&e.path==='scenario/README.md'){report.formalReadme={file:e.path,baselineSha256:e.sha256,currentSha256:hash(s),changed:hash(s)!==e.sha256};continue;}
  assert.equal(hash(s),e.sha256,e.path);assert.equal(s.length,e.bytes,e.path);
 }
 report.protectedSourceFiles=protectedInputs.length-(report.formalReadme?1:0);
});
const commonFile=R.storyEntry.common[0],original=candidateSources[commonFile],firstMarker=original.match(/^<!-- TEXT (.+) -->$/m)[0],meta=JSON.parse(firstMarker.slice(10,-4));
let rejected=0;
const reject=(name,mutate)=>check('拒绝非法TEXT：'+name,()=>{assert.throws(()=>require('../compiler/parse.cjs').parse(R,{...candidateSources,[commonFile]:mutate(original)},{pageSize:108,textPolicy:'required'}),name);rejected++;});
const changed=d=>s=>s.replace(firstMarker,'<!-- TEXT '+JSON.stringify({...meta,...d})+' -->');
reject('未知字段',changed({unexpected:1}));
reject('缺字段',s=>s.replace(firstMarker,'<!-- TEXT '+JSON.stringify({id:meta.id})+' -->'));
reject('重复字段',s=>s.replace(firstMarker,firstMarker.replace('{','{"kind":"dialogue",')));
reject('转义重复字段',s=>s.replace(firstMarker,firstMarker.replace('{','{"k\\u0069nd":"dialogue",')));
reject('坏JSON',s=>s.replace(firstMarker,firstMarker.replace('"kind"',"'kind'")));
reject('坏ID',changed({id:'TEXT_old'}));
reject('跨文件ID',changed({id:'T-MY-000001'}));
const other=entries.find(e=>e.id!==meta.id);assert(other);
reject('重复ID',s=>s.replace('"id":"'+other.id+'"','"id":"'+meta.id+'"'));
reject('未知speaker',changed({kind:'dialogue',channel:'face',speaker:'invented',name:'甲'}));
reject('越界称呼',changed({kind:'dialogue',channel:'face',speaker:'chensheng',name:'陈晟的妻子'}));
reject('非法媒介',changed({channel:'invented-channel'}));
reject('旁白挂名',changed({kind:'narration',speaker:'wenwen',name:'文文',channel:'none'}));
reject('他人心声',changed({kind:'thought',speaker:'mengyao',name:'孟遥',channel:'inner'}));
reject('组跨条件',s=>s.replaceAll('"group":null','"group":"G-C01-000001"'));
for(const value of ['','### 分场','<!-- IF C01-01=A -->','**选择 C01-01｜问？**',firstMarker])reject('标记跨段或边界：'+value.slice(0,16),s=>s.replace(firstMarker+'\n',firstMarker+'\n'+value+'\n'));
const firstText=entries.find(e=>e.id===meta.id).text;
reject('正文跨行',s=>s.replace(firstMarker+'\n'+firstText,firstMarker+'\n'+firstText.slice(0,1)+'\n'+firstText.slice(1)));
reject('标记跨编辑导航',s=>s.replace(firstMarker+'\n',firstMarker+'\n[导航](下一页.md)\n'));
check('legacy拒绝TEXT、required拒绝未迁移正文',()=>{
 assert.throws(()=>require('../compiler/parse.cjs').parse(R,candidateSources));
 const legacySources=Object.fromEntries(Object.keys(ir.entries).map(f=>[f,read(path.join(ROOT,'scenario',f))]));assert.throws(()=>require('../compiler/parse.cjs').parse(R,legacySources,{textPolicy:'required'}));
});
check('分页保持字素、姓名、稳定ID及页内位置',()=>{
 const small=require('../compiler/parse.cjs').parse(R,candidateSources,{textPolicy:'required',pageSize:32}),groups=new Map();let splits=0;
 for(const n of ir.nodes.filter(n=>n.textMeta)){if(!groups.has(n.paragraph))groups.set(n.paragraph,[]);groups.get(n.paragraph).push(n);}
 for(const [paragraphId,pages] of groups){pages.sort((x,y)=>x.offset-y.offset);const full=pages.map(p=>p.text).join(''),expected=byNew.get(paragraphId).text;assert.equal(full,expected,paragraphId);const smallPages=small.nodes.filter(n=>n.paragraph===paragraphId).sort((x,y)=>x.offset-y.offset);assert.equal(smallPages.map(p=>p.text).join(''),full,paragraphId);smallPages.forEach((p,i)=>{assert.equal(p.offset,i*32);assert.equal(p.id,paragraphId+'_'+(i+1));assert.deepEqual(p.textMeta,pages[0].textMeta);});if(smallPages.length>1&&pages[0].textMeta.kind==='dialogue')splits++;}
 assert.equal(groups.size,entries.length);assert(splits>0);report.splitDialogueParagraphs=splits;
});
check('正文元数据与分页策略进入版本身份',()=>{
 const alternate=compile({root:INPUT,textPolicy:'required',pageSize:32});assert.notEqual(alternate.ir.buildId,ir.buildId);assert(generated.manifest.compilerHashes['tools/compiler/speakers.json']);assert(generated.manifest.compilerHashes['tools/compiler/text-format.json']);
});
const covered=new Set(),configs=new Set();
check('32768组共通、2818条路线与24种分派同旧模型一致，新段按分支可达',()=>{
 assert.equal(R.routes.length,6);assert.deepEqual(R.supportingOnly,['yelan']);assert.equal(R.mengyao.marriageEnds,false);assert.equal(R.mengyao.stoppedAtFirstChoiceCannotResume,true);
 const answers=Object.fromEntries(Object.keys(ir.choices).map(choiceId=>[choiceId,'A'])),states={},oldStates={};
 for(const relation of ['HIGH','LOW']){const a={...answers};delete a['ROUTE-01'];for(const c of R.piaoRelation.choices)a[c.id]=relation==='HIGH'?'A':'B';states[relation]=m.run(a,{collect:false}).s;oldStates[relation]=prior.run(a,{collect:false}).s;}
 let count=0,commonCount=0;const commonIds=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id);
 for(let mask=0;mask<2**commonIds.length;mask++){const a=Object.fromEntries(commonIds.map((choiceId,i)=>[choiceId,(mask>>i)&1?'B':'A']));const now=m.run(a),was=prior.run(a);assert.deepEqual(now.s,was.s);assert.deepEqual(now.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]),was.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]));now.paragraphs.forEach(p=>covered.add(p.id));commonCount++;}
 for(const route of R.routes)for(const relation of ['HIGH','LOW']){const ids=Object.values(ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);for(let mask=0;mask<2**ids.length;mask++){const a={'ROUTE-01':route.id,...Object.fromEntries(ids.map((choiceId,i)=>[choiceId,(mask>>i)&1?'B':'A']))};const now=m.run(a,{state:states[relation],start:ir.entries[R.storyEntry.routeEntry]}),was=prior.run(a,{state:oldStates[relation],start:old.entries[R.storyEntry.routeEntry]});assert.deepEqual(now.s,was.s);assert.deepEqual(now.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]),was.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]));now.paragraphs.forEach(p=>covered.add(p.id));configs.add(relation+'/'+now.s.ending);count++;}}
 assert.equal(count,2818);assert.equal(configs.size,24);assert.equal(commonCount,32768);for(const n of ir.nodes.filter(n=>n.textMeta))assert(covered.has(n.paragraph),'不可达候选段：'+n.id);
 report.commonAssignments=commonCount;report.routeAssignments=count;report.dispatchConfigurations=configs.size;
});
const byNewMapping=new Map();for(const row of mappings)for(const newId of row.newIds)byNewMapping.set(newId,row);
const stats=[];
for(const file of p2Build.files){
 const source=read(path.join(ROOT,file.file)).split('\n'),originalParagraphs=registry.paragraphs.filter(p=>p.file===file.file),fileName=path.basename(file.file);
 const sourceChars=originalParagraphs.reduce((sum,p)=>sum+compact(source[p.line-1]).length,0),candidateChars=entries.filter(e=>e.file===fileName).reduce((sum,e)=>sum+compact(e.text).length,0),ratio=candidateChars/sourceChars;
 if(ratio<0.8)report.warnings.push({file:file.file,type:'character-shrink',ratio});
 stats.push({file:file.file,sourceParagraphs:file.sourceParagraphs,candidateParagraphs:file.candidateParagraphs,sourceCharacters:sourceChars,candidateCharacters:candidateChars,characterRatio:Number(ratio.toFixed(4))});
}
report.fileTextScale=stats;
const chapters=new Map();
for(const e of entries){const key=e.file+'／'+e.chapter;if(!chapters.has(key))chapters.set(key,{file:e.file,chapter:e.chapter,sourceIds:new Set(),retainedSourceIds:new Set(),rewrittenSourceIds:new Set(),candidateParagraphs:0,retained:0,rewritten:0,inserted:0,sourceCharacters:0,candidateCharacters:0});const row=chapters.get(key),map=byNewMapping.get(e.id),rewritten=map.operation==='rewrite'||map.operation==='split';row.candidateParagraphs++;row.candidateCharacters+=compact(e.text).length;if(map.operation==='retag')row.retained++;else if(rewritten)row.rewritten++;else if(map.operation==='insert')row.inserted++;else assert.fail('未知章节统计操作：'+map.operation);for(const oldId of map.oldIds){row.sourceIds.add(oldId);if(map.operation==='retag')row.retainedSourceIds.add(oldId);else if(rewritten)row.rewrittenSourceIds.add(oldId);}}
const chapterRows=[...chapters.values()].map(row=>{assert.equal(row.retained+row.rewritten+row.inserted,row.candidateParagraphs);assert.equal(row.retainedSourceIds.size+row.rewrittenSourceIds.size,row.sourceIds.size);for(const sourceId of row.sourceIds){const p=bySource.get(sourceId),text=read(path.join(ROOT,p.file)).split('\n')[p.line-1];row.sourceCharacters+=compact(text).length;}return {file:row.file,chapter:row.chapter,sourceParagraphs:row.sourceIds.size,candidateParagraphs:row.candidateParagraphs,retainedSourceParagraphs:row.retainedSourceIds.size,rewrittenSourceParagraphs:row.rewrittenSourceIds.size,retainedCandidateParagraphs:row.retained,rewrittenCandidateParagraphs:row.rewritten,insertedCandidateParagraphs:row.inserted,sourceCharacters:row.sourceCharacters,candidateCharacters:row.candidateCharacters,characterRatio:Number((row.candidateCharacters/row.sourceCharacters).toFixed(4))};});
const retainedQuotes=entries.filter(e=>['narration','action'].includes(e.meta.kind)&&/[“”]/.test(e.text)).map(e=>({id:e.id,file:e.file,chapter:e.chapter,kind:e.meta.kind,text:e.text,mappingReason:byNewMapping.get(e.id).reason}));
write('chapter-stats.json',{status:'generated',scope:'按P3候选正文实际章标题统计；改写数同时列出来源段和拆分后的候选段',files:stats,chapters:chapterRows,warnings:report.warnings});
write('retained-quotes.json',{status:'manual-review-completed-in-p3',scope:'P3未改保留引号；P2的57段人工分类由本轮全稿复读承接，本清单不作自动文学认证',paragraphs:retainedQuotes});
const priorQuoteReview=json(path.join(P2QA,'retained-quotes-review.json'));
assert.equal(priorQuoteReview.count,retainedQuotes.length);assert.deepEqual(priorQuoteReview.paragraphs.map(p=>({id:p.id,text:p.text})),retainedQuotes.map(p=>({id:p.id,text:p.text})));
write('retained-quotes-review.json',{...priorQuoteReview,status:'reviewed-for-p3-candidate',p2ContentBuildId:priorQuoteReview.contentBuildId,contentBuildId:ir.buildId,scope:'P3全稿复读承接P2逐段分类；三处P3修订均不涉及保留引号。保留引号不表示这些句子应显示姓名。',p3Reviewer:REVIEW.reviewer});
report.retainedQuoteParagraphs=retainedQuotes.length;report.negativeCases=rejected;report.contentBuildId=ir.buildId;report.candidateBuildIds={first:first.ir.buildId,second:second.ir.buildId};
report.notPerformed=['P4逐段演出绑定与图片目视复验','正式scenario采用','引擎运行','浏览器试玩','手机真机与电脑原生验收','发布'];
report.status=report.warnings.length?'pass-with-warnings':'pass';
write('static-verification.json',report);

// P3专项与P2编辑回归，全部直接读取P3候选。
const byId=byNew,get=paragraphId=>{assert(byId.has(paragraphId),paragraphId);return byId.get(paragraphId);};
const editorial={status:'running',scope:'P3最小修订专项及P2编辑回归；不含演出、引擎或运行验收',p2ContentBuildId:REVIEW.sourceContentBuildId,contentBuildId:ir.buildId,checks:[]};
const echeck=(name,fn)=>{fn();editorial.checks.push({name,status:'pass'});};
function scene(code,start,end){const rows=entries.filter(e=>e.id.startsWith('T-'+code+'-')),a=rows.findIndex(e=>e.id===id(code,start)),b=rows.findIndex(e=>e.id===id(code,end));assert(a>=0&&b>=a,code+'场景范围');return rows.slice(a,b+1);}
echeck('P2前稿4748段全部保留，只有3段按审定清单改文字',()=>{assert.equal(changedEntries.length,3);assert.equal(editorialChangedCount(beforeSources,candidateSources),3);for(const c of changes){assert.equal(get(c.id).text,c.replacementText);assert.equal(get(c.id).meta.id,c.id);}editorial.changedParagraphs=3;editorial.unchangedParagraphs=4745;});
function editorialChangedCount(before,after){let n=0;for(const file of fileNames){const a=textEntries(before[file],file),b=new Map(textEntries(after[file],file).map(e=>[e.id,e]));for(const e of a)if(b.get(e.id).text!==e.text)n++;}return n;}
echeck('三处审读修订与后文物品／消息动作闭合',()=>{
 assert(!get(id('XM',296)).text.includes('和练习本'));assert(get(id('XM',711)).text.includes('练习本还在店里'));assert(get(id('XM',309)).text.includes('我拿到本子'));assert(get(id('XM',310)).text.includes('她接过本子'));
 assert(get(id('ZZ',862)).text.includes('又把歌单递给我'));assert(get(id('ZZ',862)).text.includes('还给她'));assert(!get(id('ZZ',862)).text.includes('借着'));assert(get(id('ZZ',360)).text.includes('收进包里'));
 assert(get(id('PI',65)).text.includes('我回她，没再截给毛狼看'));assert(!get(id('PI',65)).text.includes('我回去'));
 editorial.targetedCorrections=changedEntries;
});
echeck('黄球球名字直到自报姓名后才显示',()=>{const rows=entries.filter(e=>e.file==='第二章-十四天.md'),intro=rows.findIndex(e=>e.id===id('C02',218));assert(intro>=0);assert(rows[intro].text.includes('黄球球'));const before=rows.slice(0,intro+1).filter(e=>e.meta.speaker==='huangqiuqiu');assert(before.length>=7);for(const e of before){assert.equal(e.meta.name,'门内的声音',e.id);assert.equal(e.meta.channel,'offscreen',e.id);}for(const e of rows.slice(intro+1).filter(e=>e.meta.speaker==='huangqiuqiu'))assert.equal(e.meta.name,'黄球球',e.id);});
echeck('乔哥未介绍前仅显示熟客；介绍后使用乔哥',()=>{assert.equal(get(id('ZZ',527)).meta.name,'熟客');const rows=entries.filter(e=>e.file==='周栀-十一点四十七分.md'),intro=rows.findIndex(e=>e.id===id('ZZ',52));assert(rows[intro].text.includes('叫乔哥的熟客'));for(const e of rows.slice(0,intro).filter(e=>e.meta.speaker==='qiaoge'))assert.equal(e.meta.name,'熟客');for(const e of rows.slice(intro+1).filter(e=>e.meta.speaker==='qiaoge'))assert.equal(e.meta.name,'乔哥');});
echeck('多人场景的回答归属与原稿上下文一致',()=>{for(const [code,num,speaker] of [['C01',192,'piao'],['C01',215,'maolang'],['XM',235,'wenwen'],['ZZ',232,'zhouzhi'],['PI',316,'piao'],['PI',317,'wenwen']])assert.equal(get(id(code,num)).meta.speaker,speaker);const background=get(id('PI',674));assert.equal(background.meta.speaker,null);assert.equal(background.meta.channel,'none');});
echeck('罗小满两场视频与非AA音频通话全段媒介一致',()=>{for(const [start,end,channel] of [[757,371,'video'],[802,412,'video'],[828,848,'phone']]){const spoken=scene('XM',start,end).filter(e=>e.meta.speaker);assert(spoken.length>=7);for(const e of spoken)assert.equal(e.meta.channel,channel,e.id);}});
echeck('周栀早饭同场、结尾电话与朋友线洗照片场景一致',()=>{for(const n of [850,851,853,854,856])assert.equal(get(id('ZZ',n)).meta.channel,'face');for(const n of [460,462,463])assert.equal(get(id('ZZ',n)).meta.channel,'phone');for(const n of [489,490,491])assert.equal(get(id('FR',n)).meta.channel,'face');});
echeck('黄球球隔门交流不伪装现场；她本人没有电话或数字消息',()=>{for(const [start,end] of [[410,138],[463,187]])for(const e of scene('HQ',start,end).filter(e=>e.meta.speaker))assert.equal(e.meta.channel,'offscreen',e.id);for(const e of entries.filter(e=>e.meta.speaker==='huangqiuqiu'))assert(['offscreen','face'].includes(e.meta.channel),e.id);assert.equal(get(id('HQ',569)).meta.channel,'face');assert(get(id('HQ',569)).text.includes('今天你不好过'));});
echeck('P0章首计分、离场时间及远程册子说明在候选中闭合',()=>{const c1=candidateSources['第一章-回到毕节.md'],c2=candidateSources['第二章-十四天.md'];assert(c1.includes('本章6处选择')&&c1.includes('C01-06记录飘的关系值'));assert(c2.includes('本章9处选择')&&c2.includes('C02-08与C02-09分别记录'));assert(get(id('ZZ',642)).text.includes('九点四十五'));assert(get(id('ZZ',196)).text.includes('十点前到了'));assert(get(id('PI',797)).text.includes('电子图'));assert(!get(id('PI',604)).text.includes('周栀'));});
echeck('沿用的66条媒介断言在P3保持通过',()=>{const priorMedia=json(path.join(ROOT,'qa/dialogue-p2-writing-20261103/targeted-media-review.json')),video=new Set([368,370,395,400,401,403,404,405,816,818,822,824,410].map(n=>id('XM',n))),face=new Set([850,851,853,854,856].map(n=>id('ZZ',n)));let count=0;editorial.mediaAssertions=[];for(const row of priorMedia.results)for(const oldMedia of row.spoken){const channel=video.has(oldMedia.id)?'video':face.has(oldMedia.id)?'face':row.expectedChannel;assert.equal(get(oldMedia.id).meta.channel,channel,oldMedia.id);count++;editorial.mediaAssertions.push({id:oldMedia.id,oldSourceId:oldMedia.oldId,channel,status:'pass'});}assert.equal(count,66);editorial.recheckedMediaParagraphs=count;});
const cases=[],endings=new Set(),endingReview=json(path.join(P2QA,'ending-review.json'));let endingAnchorsChecked=0;
echeck('六线46组关键组合、十四结局、公共事件及单身后日谈',()=>{
 for(const route of R.routes)for(const relation of ['HIGH','LOW']){
  const combos=route.id==='piao'&&relation==='LOW'?['A','B']:['AA','AB','BA','BB'];
  for(const combo of combos){
   const answers=Object.fromEntries(Object.keys(ir.choices).map(k=>[k,'A']));answers['ROUTE-01']=route.id;for(const c of R.piaoRelation.choices)answers[c.id]=relation==='HIGH'?'A':'B';if(route.id==='piao'&&relation==='LOW')answers[route.lowPathChoice]=combo;else route.keyChoices.forEach((k,i)=>answers[k]=combo[i]);
   const run=m.run(answers),ids=new Set(run.paragraphs.map(p=>p.id));assert.equal(run.s.status,'complete');endings.add(run.s.ending);const has=(code,n)=>ids.has(id(code,n));
   if(route.id==='mengyao'){assert(has('MY',531));assert.equal(has('MY',312),combo==='AA');assert.equal(has('MY',536),combo==='AA');assert.equal(has('MY',660),combo==='AB');if(combo[0]==='B')assert(!has('MY',437));if(combo==='BA')assert(has('MY',562)&&has('MY',564));assert.equal(has('MY',668),combo==='BB');assert.equal(has('MY',673),combo!=='AA');assert.equal(has('MY',372),combo!=='AA');}
   if(route.id==='piao'){assert.equal(has('PI',601),relation==='LOW');assert.equal(has('PI',832),relation==='HIGH'&&combo[0]==='A');assert.equal(has('PI',65),relation==='HIGH');if(relation==='LOW'){assert.equal(has('PI',624),combo==='A');assert.equal(has('PI',644),combo==='B');}}
   if(route.id==='xiaoman'){assert(has('XM',296));assert(has('XM',711));}
   if(route.id==='zhouzhi'){assert(has('ZZ',862));assert(has('ZZ',360));}
   if(route.id==='huangqiuqiu'){assert.equal(has('HQ',599),combo==='AA');assert.equal(has('HQ',600),combo==='AA');assert.equal(has('HQ',314),combo!=='AA');assert.equal(has('HQ',335),combo==='BA');assert(has('HQ',195));}
   if(route.id==='friends'&&combo!=='AA')for(const p of run.paragraphs.filter(p=>/^T-EP[HL]-/.test(p.id))){const e=get(p.id);if(e.meta.speaker)assert.equal(e.meta.channel,'text','FR-E2后日谈不可到现场：'+p.id);}
   if(['XM-E1','ZZ-E1','MY-E1','PI-E1','PI-LE1','HQ-E1'].includes(run.s.ending))assert.equal(run.s.epilogue,null);
   const ending=endingReview.endings.find(e=>e.id===run.s.ending);assert(ending,'结局复核缺少登记：'+run.s.ending);for(const anchor of ending.anchors){assert(ids.has(anchor),'结局锚点不可达：'+run.s.ending+'／'+anchor);endingAnchorsChecked++;}
   cases.push({route:route.id,relation,combo,ending:run.s.ending,epilogue:run.s.epilogue,status:'pass'});
  }
 }
 assert.equal(cases.length,46);assert.equal(endings.size,14);assert.equal(endingAnchorsChecked,172);editorial.keyCombinationCases=cases;editorial.distinctEndings=endings.size;editorial.endingAnchorsChecked=endingAnchorsChecked;
});
echeck('静态证据、来源映射与冻结候选为同一版本',()=>{assert.equal(report.status,'pass');assert.equal(report.contentBuildId,ir.buildId);assert.equal(mappings.length,p2Map.mappings.length);assert(mappings.every(row=>row.bindingReview==='pending-p4'&&row.conditionChanged===false));editorial.protectedFormalFiles=report.protectedSourceFiles;});
editorial.status='pass';write('editorial-verification.json',editorial);

if(recheck){
 const frozen=json(path.join(historicalQA,'input-manifest.json'));
 assert.equal(ir.buildId,frozen.contentBuildId,'当前复验与P3冻结版本不同');
 for(const row of frozen.files){
  assert.equal(hash(read(path.join(ROOT,row.candidateFile))),row.p3Sha256,row.candidateFile);
  assert.equal(hash(read(path.join(ROOT,row.readingFile))),row.readingSha256,row.readingFile);
 }
 const summary={status:'pass',scope:'Codex复跑冻结P3的文本、分支及编辑断言；原独立审读登记只读引用，不认证模型身份，也不代表本轮重新全文通读。',sourceManifest:'qa/dialogue-p3-review-20261103/input-manifest.json',contentBuildId:ir.buildId,staticChecks:report.checks.length,editorialChecks:editorial.checks.length,negativeCases:rejected,commonAssignments:report.commonAssignments,routeAssignments:report.routeAssignments,dispatchConfigurations:report.dispatchConfigurations,keyCombinations:cases.length,endings:endings.size,endingAnchorsChecked,mediaAssertions:editorial.recheckedMediaParagraphs,candidateParagraphs:entries.length,protectedFormalFiles:report.protectedSourceFiles,formalReadme:report.formalReadme,warnings:report.warnings.length,formalAdoption:false,notPerformed:report.notPerformed};
 write('recheck-verification.json',summary);console.log(JSON.stringify(summary,null,2));process.exit(0);
}

const buildReport={status:'built',phase:'P3-frozen-candidate',baselineFingerprint:p2Build.baselineFingerprint,sourceBuildId:p2Build.sourceBuildId,p2ContentBuildId:REVIEW.sourceContentBuildId,contentBuildId:ir.buildId,files:p2Build.files.map(file=>{const name=path.basename(file.file),rows=mappings.filter(row=>row.file===file.file);return {...file,p2Sha256:file.candidateSha256,candidateSha256:hash(candidateSources[name]),candidateParagraphs:rows.reduce((n,row)=>n+row.newIds.length,0),retained:rows.filter(row=>row.operation==='retag').length,rewritten:rows.filter(row=>row.operation==='rewrite').length,inserted:rows.filter(row=>row.operation==='insert').length};}),p3Changes:changedEntries,explicitParagraphs:entries.length,textNodes:ir.nodes.filter(n=>n.op==='text').length,runtimeReady:false};
write('build-report.json',buildReport);
write('source-map.json',{...p2Map,status:'built',candidateBuildId:ir.buildId,scope:'P3独立审读冻结候选；P2与正式scenario未改；全部演出待P4',editorialReview:{...p2Map.editorialReview,p3:{batch:REVIEW.batch,reviewer:REVIEW.reviewer,reviewedParagraphs:4748,changedParagraphs:3,unchangedParagraphs:4745,triage:REVIEW.triage}},mappings});
const manifestFiles=[];
for(const row of p2Review.reviewedFiles){const file=path.basename(row.candidateFile),after=candidateSources[file],reading=read(path.join(P2QA,'reading',file)).replace('> P2定稿审读副本；','> P3冻结候选审读副本；');let expectedReading=reading;for(const c of changes.filter(c=>path.basename(c.file)===file)){assert(expectedReading.includes(c.expectedText));expectedReading=expectedReading.replace(c.expectedText,c.replacementText);}const ids=[...expectedReading.matchAll(/^\*\*[^\n]+\*\*　`(T-[A-Z0-9]+-\d{6})`$/gm)].map(match=>match[1]);assert.equal(ids.length,textEntries(after,file).length,'审读副本段数不一致：'+file);assert.deepEqual(ids,textEntries(after,file).map(e=>e.id),'审读副本ID顺序不一致：'+file);for(const e of textEntries(after,file))assert(expectedReading.includes(e.text),'审读副本缺正文：'+e.id);write('reading/'+file,expectedReading);manifestFiles.push({file:'scenario/'+file,candidateFile:'docs/修订协作/P3-独立审读-20261103/正文/'+file,readingFile:'qa/dialogue-p3-review-20261103/reading/'+file,p2Sha256:hash(beforeSources[file]),p3Sha256:hash(after),readingSha256:hash(expectedReading),paragraphs:textEntries(after,file).length,characters:compact(textEntries(after,file).map(e=>e.text).join('')).length,changed:hash(after)!==hash(beforeSources[file])});}
assert.equal(manifestFiles.filter(f=>f.changed).length,3);
write('input-manifest.json',{status:'frozen',phase:'P3',p2ContentBuildId:REVIEW.sourceContentBuildId,contentBuildId:ir.buildId,algorithm:'SHA-256',sourceDirectory:'docs/修订协作/P2-全稿修订-20261103/正文',candidateDirectory:'docs/修订协作/P3-独立审读-20261103/正文',files:manifestFiles,routes:{file:'scenario/routes.json',sha256:hash(formalRoutes),unchangedFromP2:true},totalParagraphs:4748,totalCharacters:stats.reduce((n,row)=>n+row.candidateCharacters,0),changedFiles:3,changedParagraphs:3,unchangedFiles:9,unchangedParagraphs:4745});
const p3EndingReview={...endingReview,status:'reviewed-for-p3-candidate',p2ContentBuildId:REVIEW.sourceContentBuildId,contentBuildId:ir.buildId,reviewer:REVIEW.reviewer,reviewMethod:'P3完整通读后承接P2逐结局锚点，并在46组关键组合重新验证可达与边界；P3未改结局规则。',endingAnchorsChecked};write('ending-review.json',p3EndingReview);
write('review-register.json',{status:'p3-candidate-frozen',date:'2026-11-03',reviewer:REVIEW.reviewer,externalModelCalled:false,p2ContentBuildId:REVIEW.sourceContentBuildId,contentBuildId:ir.buildId,reviewedFiles:manifestFiles,paragraphsReviewed:4748,triage:REVIEW.triage,adoptedChanges:changedEntries,unchangedParagraphs:4745,endings:14,formalAdoption:false,p4:'pending',notPerformed:report.notPerformed});
console.log(JSON.stringify({status:'pass',staticChecks:report.checks.length,negativeCases:rejected,editorialChecks:editorial.checks.length,reviewedParagraphs:4748,changedParagraphs:3,unchangedParagraphs:4745,commonAssignments:report.commonAssignments,routeAssignments:report.routeAssignments,dispatchConfigurations:report.dispatchConfigurations,keyCombinations:cases.length,endings:endings.size,endingAnchorsChecked,protectedFormalFiles:report.protectedSourceFiles,warnings:report.warnings.length,contentBuildId:ir.buildId},null,2));
