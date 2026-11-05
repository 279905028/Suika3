#!/usr/bin/env node
'use strict';
// P2全稿候选静态验收：不导出正式包，不运行引擎、浏览器或真机。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../compiler/compile.cjs'),{parse,hash}=require('../compiler/parse.cjs'),{model}=require('../compiler/model.cjs');
const {build,ROOT,QA:BASE_QA,DOCS,cliOutputDir}=require('./build-p2.cjs');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const compact=s=>s.replace(/\s/g,'');
function textEntries(source,file){
 const rows=[];let chapter=file.replace(/^scenario\//,'').replace(/\.md$/,'');
 const lines=source.split('\n');
 for(let i=0;i<lines.length;i++){
  const heading=/^## (第[一二三四五六七八九十]+章｜.+)$/.exec(lines[i]);if(heading)chapter=heading[1];
  const marker=/^<!-- TEXT (.+) -->$/.exec(lines[i]);if(!marker)continue;
  const meta=JSON.parse(marker[1]),text=lines[i+1];assert(typeof text==='string'&&text&&!/[\r\n]/.test(text),'正文跨行或为空：'+meta.id);
  rows.push({id:meta.id,file,chapter,line:i+1,text,meta});
 }
 return rows;
}
function verify({outputDir=BASE_QA}={}){
 const QA=outputDir;
 const write=(name,data)=>fs.writeFileSync(path.join(QA,name),JSON.stringify(data,null,2)+'\n');
 const report={status:'running',scope:'P2全稿独立候选的静态结构、文本尺度、来源映射和规则执行；不是引擎、浏览器、真机或发布验收',checks:[],warnings:[]};
 const check=(name,fn)=>{fn();report.checks.push({name,status:'pass'});};
 let first,second;
 check('确定性双构建及required候选试编译',()=>{
  first=build({outputDir:QA});const before=first.files.map(f=>fs.readFileSync(path.join(DOCS,'正文',path.basename(f.file)),'utf8'));
  second=build({outputDir:QA});const after=second.files.map(f=>fs.readFileSync(path.join(DOCS,'正文',path.basename(f.file)),'utf8'));
  assert.deepEqual(second,first);assert.deepEqual(after,before);assert.equal(first.unresolvedQuotes.length,0);assert.equal(first.files.length,12);
 });
 const input=path.join(QA,'input'),generated=compile({root:input,textPolicy:'required',pageSize:108}),ir=generated.ir,R=ir.contract;
 const baseline=compile({pageSize:108}),old=baseline.ir,m=model(ir),prior=model(old);
 const registry=json(path.join(ROOT,'qa/dialogue-p0-20261102/paragraph-registry.json'));
 const sourceMap=json(path.join(QA,'source-map.json')),mappings=sourceMap.mappings;
 const sourceIds=registry.paragraphs.map(p=>p.id),sourceSet=new Set(sourceIds),bySource=new Map(registry.paragraphs.map(p=>[p.id,p]));
 const candidateSources=Object.fromEntries(Object.keys(ir.entries).map(f=>[f,fs.readFileSync(path.join(input,'scenario',f),'utf8')]));
 const entries=Object.entries(candidateSources).flatMap(([f,s])=>textEntries(s,f));
 const byNew=new Map(entries.map(e=>[e.id,e]));
 check('原段映射闭合、ID唯一及required全覆盖',()=>{
  const seenSource=new Map(),seenNew=new Set();
  for(const row of mappings){
   assert(row.oldIds.length||row.operation==='insert','无来源的改写：'+row.newIds.join(','));
   for(const id of row.oldIds){assert(sourceSet.has(id),'未知原段：'+id);seenSource.set(id,(seenSource.get(id)||0)+1);}
   for(const id of row.newIds){assert(!seenNew.has(id),'重复新段：'+id);seenNew.add(id);assert(byNew.has(id),'映射未落入候选：'+id);}
  }
  for(const id of sourceIds){assert(seenSource.has(id),'原段未映射：'+id);const owner=bySource.get(id).file;for(const row of mappings.filter(r=>r.oldIds.includes(id)))assert.equal(row.file,owner,'原段跨文件映射：'+id);}
  assert.equal(seenSource.size,registry.paragraphs.length);assert.equal(seenNew.size,entries.length);
  const required=ir.nodes.filter(n=>n.textMeta);assert(required.every(n=>byNew.has(n.paragraph)),'required存在未登记正文');
  assert.equal(new Set(required.map(n=>n.paragraph)).size,entries.length);
  report.sourceParagraphs=sourceIds.length;report.candidateParagraphs=entries.length;
 });
 check('选择文案、条件、结局、计分、事件与控制标记不变',()=>{
  assert.deepEqual(R,old.contract);
  const choiceContract=choices=>Object.fromEntries(Object.entries(choices).map(([id,c])=>[id,{question:c.question,options:c.options.map(o=>({value:o.value,text:o.text}))}]));
  assert.deepEqual(choiceContract(ir.choices),choiceContract(old.choices));
  const protectedControls=json(path.join(ROOT,'qa/dialogue-p0-20261102/protected-controls.json'));
  for(const original of protectedControls.files){
   const candidate=candidateSources[path.basename(original.file,'.md')+'.md'];assert(candidate,'缺候选文件：'+original.file);
   const actual=candidate.split('\n').map(s=>s.trim()).filter(s=>/^(<!--|\*\*选择 |#### (?:[AB]｜|共同段|结局 )|### (?:罗小满|周栀|孟遥|飘|黄球球|朋友与职业)｜)/.test(s)&&!s.startsWith('<!-- TEXT '));
   assert.deepEqual(actual,original.markers.map(x=>x.text),'控制标记变化：'+original.file);
  }
 });
 check('正式scenario、旧资源与资源绑定未被候选覆盖',()=>{
  const prepared=json(path.join(BASE_QA,'preparation.json'));
  for(const f of prepared.sourceFiles)assert.equal(hash(fs.readFileSync(path.join(ROOT,f.file))),f.sha256,f.file);
  assert.equal(hash(fs.readFileSync(path.join(ROOT,'scenario/routes.json'))),hash(fs.readFileSync(path.join(input,'scenario/routes.json'))));
  const protectedInputs=json(path.join(ROOT,'qa/dialogue-p0-20261102/baseline.json')).inputs.filter(e=>e.path.startsWith('scenario/')||e.path.startsWith('assets/')||e.path==='docs/整合/bindings.json');
  for(const e of protectedInputs){const p=path.join(ROOT,e.path),s=fs.readFileSync(p);assert.equal(hash(s),e.sha256,e.path);assert.equal(s.length,e.bytes,e.path);}
  report.protectedSourceFiles=protectedInputs.length;
 });
 const commonFile=R.storyEntry.common[0],original=candidateSources[commonFile],firstMarker=original.match(/^<!-- TEXT (.+) -->$/m)[0],meta=JSON.parse(firstMarker.slice(10,-4));
 let rejected=0;
 const reject=(name,mutate)=>check('拒绝非法TEXT：'+name,()=>{assert.throws(()=>parse(R,{...candidateSources,[commonFile]:mutate(original)},{pageSize:108,textPolicy:'required'}),name);rejected++;});
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
  assert.throws(()=>parse(R,candidateSources));
  const legacySources=Object.fromEntries(Object.keys(ir.entries).map(f=>[f,fs.readFileSync(path.join(ROOT,'scenario',f),'utf8')]));
  assert.throws(()=>parse(R,legacySources,{textPolicy:'required'}));
 });
 check('分页保持字素、姓名、稳定ID及页内位置',()=>{
  const small=parse(R,candidateSources,{textPolicy:'required',pageSize:32}),groups=new Map();let splits=0;
  for(const n of ir.nodes.filter(n=>n.textMeta)){if(!groups.has(n.paragraph))groups.set(n.paragraph,[]);groups.get(n.paragraph).push(n);}
  for(const [id,pages] of groups){
   pages.sort((x,y)=>x.offset-y.offset);const full=pages.map(p=>p.text).join(''),expected=byNew.get(id).text;assert.equal(full,expected,id);
   const smallPages=small.nodes.filter(n=>n.paragraph===id).sort((x,y)=>x.offset-y.offset);assert.equal(smallPages.map(p=>p.text).join(''),full,id);
   smallPages.forEach((p,i)=>{assert.equal(p.offset,i*32);assert.equal(p.id,id+'_'+(i+1));assert.deepEqual(p.textMeta,pages[0].textMeta);});
   if(smallPages.length>1&&pages[0].textMeta.kind==='dialogue')splits++;
  }
  assert.equal(groups.size,entries.length);assert(splits>0);report.splitDialogueParagraphs=splits;
 });
 check('正文元数据与分页策略进入版本身份',()=>{
  const alternate=compile({root:input,textPolicy:'required',pageSize:32});assert.notEqual(alternate.ir.buildId,ir.buildId);
  assert(generated.manifest.compilerHashes['tools/compiler/speakers.json']);assert(generated.manifest.compilerHashes['tools/compiler/text-format.json']);
 });
 check('2818条路线与24种分派同旧模型一致，新段按分支可达',()=>{
  assert.equal(R.routes.length,6);assert.deepEqual(R.supportingOnly,['yelan']);assert.equal(R.mengyao.marriageEnds,false);assert.equal(R.mengyao.stoppedAtFirstChoiceCannotResume,true);
  const answers=Object.fromEntries(Object.keys(ir.choices).map(id=>[id,'A'])),states={},oldStates={};
  for(const relation of ['HIGH','LOW']){const a={...answers};delete a['ROUTE-01'];for(const c of R.piaoRelation.choices)a[c.id]=relation==='HIGH'?'A':'B';states[relation]=m.run(a,{collect:false}).s;oldStates[relation]=prior.run(a,{collect:false}).s;}
  let count=0,commonCount=0;const configs=new Set(),covered=new Set(),commonIds=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id);
  for(let mask=0;mask<2**commonIds.length;mask++){
   const a=Object.fromEntries(commonIds.map((id,i)=>[id,(mask>>i)&1?'B':'A']));
   const now=m.run(a),was=prior.run(a);assert.deepEqual(now.s,was.s);assert.deepEqual(now.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]),was.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]));
   now.paragraphs.forEach(p=>covered.add(p.id));commonCount++;
  }
  for(const route of R.routes)for(const relation of ['HIGH','LOW']){
   const ids=Object.values(ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
   for(let mask=0;mask<2**ids.length;mask++){
    const a={'ROUTE-01':route.id,...Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']))};
    const now=m.run(a,{state:states[relation],start:ir.entries[R.storyEntry.routeEntry]}),was=prior.run(a,{state:oldStates[relation],start:old.entries[R.storyEntry.routeEntry]});
    assert.deepEqual(now.s,was.s);assert.deepEqual(now.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]),was.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]));
    now.paragraphs.forEach(p=>covered.add(p.id));configs.add(relation+'/'+now.s.ending);count++;
   }
  }
  assert.equal(count,2818);assert.equal(configs.size,24);assert.equal(commonCount,32768);
  for(const n of ir.nodes.filter(n=>n.textMeta))assert(covered.has(n.paragraph),'不可达候选段：'+n.id);
  report.commonAssignments=commonCount;report.routeAssignments=count;report.dispatchConfigurations=configs.size;
 });
 const byNewMapping=new Map();for(const row of mappings)for(const id of row.newIds)byNewMapping.set(id,row);
 const stats=[];
 for(const file of first.files){
  const source=fs.readFileSync(path.join(ROOT,file.file),'utf8').split('\n'),originalParagraphs=registry.paragraphs.filter(p=>p.file===file.file);
  const sourceChars=originalParagraphs.reduce((sum,p)=>sum+compact(source[p.line-1]).length,0),candidateChars=entries.filter(e=>e.file===path.basename(file.file)).reduce((sum,e)=>sum+compact(e.text).length,0);
  const ratio=candidateChars/sourceChars;if(ratio<0.8)report.warnings.push({file:file.file,type:'character-shrink',ratio});
  stats.push({file:file.file,sourceParagraphs:file.sourceParagraphs,candidateParagraphs:file.candidateParagraphs,sourceCharacters:sourceChars,candidateCharacters:candidateChars,characterRatio:Number(ratio.toFixed(4))});
 }
 report.fileTextScale=stats;
 const chapters=new Map();
 for(const e of entries){
  const key=e.file+'／'+e.chapter;if(!chapters.has(key))chapters.set(key,{file:e.file,chapter:e.chapter,sourceIds:new Set(),retainedSourceIds:new Set(),rewrittenSourceIds:new Set(),candidateParagraphs:0,retained:0,rewritten:0,inserted:0,sourceCharacters:0,candidateCharacters:0});
  const row=chapters.get(key),map=byNewMapping.get(e.id),rewritten=map.operation==='rewrite'||map.operation==='split';row.candidateParagraphs++;row.candidateCharacters+=compact(e.text).length;
  if(map.operation==='retag')row.retained++;
  else if(rewritten)row.rewritten++;
  else if(map.operation==='insert')row.inserted++;
  else assert.fail('未知章节统计操作：'+map.operation);
  for(const id of map.oldIds){row.sourceIds.add(id);if(map.operation==='retag')row.retainedSourceIds.add(id);else if(rewritten)row.rewrittenSourceIds.add(id);}
 }
 const chapterRows=[...chapters.values()].map(row=>{
  assert.equal(row.retained+row.rewritten+row.inserted,row.candidateParagraphs,'章节候选统计不平衡：'+row.file+'／'+row.chapter);
  assert.equal(row.retainedSourceIds.size+row.rewrittenSourceIds.size,row.sourceIds.size,'章节来源统计不平衡：'+row.file+'／'+row.chapter);
  for(const id of row.sourceIds){const p=bySource.get(id),text=fs.readFileSync(path.join(ROOT,p.file),'utf8').split('\n')[p.line-1];row.sourceCharacters+=compact(text).length;}
  return {file:row.file,chapter:row.chapter,sourceParagraphs:row.sourceIds.size,candidateParagraphs:row.candidateParagraphs,retainedSourceParagraphs:row.retainedSourceIds.size,rewrittenSourceParagraphs:row.rewrittenSourceIds.size,retainedCandidateParagraphs:row.retained,rewrittenCandidateParagraphs:row.rewritten,insertedCandidateParagraphs:row.inserted,sourceCharacters:row.sourceCharacters,candidateCharacters:row.candidateCharacters,characterRatio:Number((row.candidateCharacters/row.sourceCharacters).toFixed(4))};
 });
 const retainedQuotes=entries.filter(e=>['narration','action'].includes(e.meta.kind)&&/[“”]/.test(e.text)).map(e=>({id:e.id,file:e.file,chapter:e.chapter,kind:e.meta.kind,text:e.text,mappingReason:byNewMapping.get(e.id).reason}));
 write('chapter-stats.json',{status:'generated',scope:'按候选正文实际章标题统计；改写数同时列出来源段和拆分后的候选段',files:stats,chapters:chapterRows,warnings:report.warnings});
 write('retained-quotes.json',{status:'manual-review-required',scope:'非对白段中保留的引号；须为书面文字、未发送内容、称谓或回忆标记',paragraphs:retainedQuotes});
 report.retainedQuoteParagraphs=retainedQuotes.length;report.negativeCases=rejected;report.contentBuildId=ir.buildId;report.candidateBuildIds={first:first.contentBuildId,second:second.contentBuildId};
 report.notPerformed=['语言质量与逐线总编复核（须查本批独立审校记录，本工具不自动认证）','P3独立合审','P4逐段演出绑定与图片目视复验','正式scenario采用','引擎运行','浏览器试玩','手机真机与电脑原生验收','发布'];
 report.status=report.warnings.length?'pass-with-warnings':'pass';write('static-verification.json',report);
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,negativeCases:rejected,sourceParagraphs:report.sourceParagraphs,candidateParagraphs:report.candidateParagraphs,routes:report.routeAssignments,dispatchConfigurations:report.dispatchConfigurations,retainedQuotes:report.retainedQuoteParagraphs,warnings:report.warnings.length,contentBuildId:report.contentBuildId}));
 return report;
}
if(require.main===module)verify({outputDir:cliOutputDir()});module.exports={verify,textEntries};
