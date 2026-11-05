#!/usr/bin/env node
'use strict';
// P0离线验收：现行规则、资料完整性与格式约定；不是引擎或浏览器验收。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ROOT,QA,json,read,sha,record}=require('./p0-baseline.cjs');
const {compile}=require('../compiler/compile.cjs');
const {parse}=require('../compiler/parse.cjs');
const {model}=require('../compiler/model.cjs');
const DOC='docs/修订协作/P0-基线与规则-20261102';
function out(name,data){const f=path.join(ROOT,QA,name);assert(!fs.existsSync(f),'证据已存在，不覆盖：'+name);fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n',{flag:'wx'});}
function rules(c){
  const R=c.ir.contract,m=model(c.ir),allA=Object.fromEntries(Object.keys(c.ir.choices).map(id=>[id,'A']));delete allA['ROUTE-01'];
  assert.equal(R.routes.length,6);assert.deepEqual(R.supportingOnly,['yelan']);
  assert.equal(R.mengyao.marriageEnds,false);assert.equal(R.mengyao.stoppedAtFirstChoiceCannotResume,true);
  const scores=[];
  for(let mask=0;mask<8;mask++){
    const answers={...allA},combo=R.piaoRelation.choices.map((choice,i)=>answers[choice.id]=(mask>>i)&1?'B':'A').join('');
    const result=m.run(answers,{collect:false});const score=20+[...combo].reduce((s,v)=>s+(v==='A'?10:-5),0);
    assert.equal(result.waiting,'ROUTE-01');assert.equal(result.s.score,score);assert.equal(result.s.relation,score>=35?'HIGH':'LOW');
    scores.push({combo,score,relation:result.s.relation});
  }
  const hidden=[];
  for(const first of ['A','B'])for(const second of ['A','B'])for(const neutral of ['A','B']){
    const r=m.run({...allA,'C01-02':first,'C02-01':second,'C02-07':neutral},{collect:false});
    const open=first==='A'&&second==='A';assert.equal(m.available(r.s,'ROUTE-01').length,open?6:5);
    assert.equal(r.s.events.includes(R.hiddenEntry.readEvent),open);
    if(first==='B')assert(!Object.hasOwn(r.s.choices,'C02-01'));
    hidden.push({first,second,neutral,open,meetingRead:r.s.events.includes(R.hiddenEntry.readEvent)});
  }
  const bases={};for(const relation of ['HIGH','LOW']){const a={...allA};for(const choice of R.piaoRelation.choices)a[choice.id]=relation==='HIGH'?'A':'B';bases[relation]=m.run(a,{collect:false}).s;}
  const romance=new Set(['XM-E1','ZZ-E1','MY-E1','PI-E1','PI-LE1','HQ-E1']);assert.deepEqual([...R.epilogues.romanceEndings].sort(),[...romance].sort());
  const configs=new Map();let total=0,entered=0,skipped=0;
  for(const route of R.routes)for(const relation of ['HIGH','LOW']){
    const ids=Object.values(c.ir.choices).filter(ch=>ch.source.file===route.file&&(route.id!=='piao'||(ch.id===route.lowPathChoice)===(relation==='LOW'))).map(ch=>ch.id);
    for(let mask=0;mask<2**ids.length;mask++){
      const answers={'ROUTE-01':route.id,...Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']))};
      const r=m.run(answers,{state:bases[relation],start:c.ir.entries[R.storyEntry.routeEntry]});assert.equal(r.waiting,null);assert.equal(r.s.status,'complete');
      const low=route.id==='piao'&&relation==='LOW';const key=low?r.s.choices[route.lowPathChoice]:route.keyChoices.map(k=>r.s.choices[k]).join('');
      const expected=low?(key==='A'?'PI-LE1':'PI-LE2'):route.prefix+(key==='AA'?'-E1':'-E2');assert.equal(r.s.ending,expected);
      const epilogue=romance.has(expected)?null:relation==='HIGH'?'后日谈-他们的日子.md':'后日谈-未写完的安排.md';assert.equal(r.s.epilogue,epilogue);
      assert.equal(r.s.events.includes(R.day36.eventId),relation==='LOW');assert.equal(r.s.frame,null);
      assert.equal(r.trace.filter(x=>x.op==='call').length,relation==='LOW'&&route.id!=='piao'?1:0);
      const ep=r.paragraphs.filter(p=>p.file.startsWith('后日谈-'));assert(epilogue?ep.length>0&&ep.every(p=>p.file===epilogue):ep.length===0);
      if(low)assert(!route.keyChoices.some(id=>Object.hasOwn(r.s.choices,id)));
      const config=relation+'/'+expected;
      if(!configs.has(config))configs.set(config,{route:route.id,relation,ending:expected,epilogue,mainRelationshipContinues:romance.has(expected)});
      if(epilogue)entered++;else skipped++;total++;
    }
  }
  assert.equal(total,2818);assert.equal(configs.size,24);assert.equal(new Set([...configs.values()].map(x=>x.ending)).size,14);
  return {status:'pass',method:'现行编译IR离线遍历；每条路线枚举全部路线选择组合，HIGH/LOW各用一组合法共通状态；不等于全共通组合笛卡尔积或引擎运行',routeAssignments:total,entered,skipped,scores,hiddenEntryConfigurations:hidden,dispatchConfigurations:[...configs.values()]};
}
function formats(){
  const spec=json(DOC+'/format-contract.json'),roster=json(DOC+'/speakers.json'),samples=json(QA+'/format-fixtures.json').fixtures;
  const speakerMap=new Map(roster.speakers.map(s=>[s.id,s]));assert.equal(speakerMap.size,roster.speakers.length);
  function check(records){
    const ids=new Set();
    for(const {metadata:meta,text}of records){
      assert.deepEqual(Object.keys(meta).sort(),spec.requiredFields.slice().sort(),'字段错误');
      assert(new RegExp(spec.idPattern).test(meta.id));assert(!ids.has(meta.id),'重复ID');ids.add(meta.id);
      assert(spec.channelsByKind[meta.kind]?.includes(meta.channel),'类型/媒介不符');
      assert(meta.group===null||typeof meta.group==='string'&&new RegExp(spec.groupPattern).test(meta.group));
      assert(typeof text==='string'&&text.trim()&&!/[\r\n]/.test(text),'必须单行且非空');
      if(spec.silentKinds.includes(meta.kind)){assert.equal(meta.speaker,null);assert.equal(meta.name,'');}
      else{assert(speakerMap.has(meta.speaker),'未登记人物');assert(speakerMap.get(meta.speaker).allowedNames.includes(meta.name),'未登记称呼');}
      if(meta.kind==='thought')assert(spec.thoughtSpeakers.includes(meta.speaker),'越过第一人称');
      const annotation='<!-- TEXT '+JSON.stringify(meta)+' -->';assert.equal(annotation.split('\n').length,1);assert.deepEqual(JSON.parse(annotation.slice(10,-4)),meta);
    }
  }
  check(samples);
  const invalid=[
    ['未知字段',x=>x[1].metadata.extra=true],['缺字段',x=>delete x[1].metadata.name],['重复ID',x=>x[1].metadata.id=x[0].metadata.id],
    ['旧哈希ID',x=>x[1].metadata.id='TEXT_hash_1'],['多人猜测',x=>x[1].metadata.speaker='someone'],['串姓名',x=>x[1].metadata.name='孟遥'],
    ['旁白残名',x=>x[0].metadata.name='师匠'],['消息媒介错',x=>x[1].metadata.kind='message'],['他人心声',x=>Object.assign(x[1].metadata,{kind:'thought',channel:'inner'})],
    ['一标记两段',x=>x[1].text+='\n第二段'],['空正文',x=>x[1].text=''],['非法分组',x=>x[1].metadata.group='NODE-01']
  ];
  for(const [label,mutate]of invalid){const copy=structuredClone(samples);mutate(copy);assert.throws(()=>check(copy),{name:'AssertionError'},label);}
  // 明确记录边界：正式解析器仍拒绝新语法，不能把P0约定说成已经上线。
  const c=compile({pageSize:108});const sources=Object.fromEntries(Object.keys(c.ir.entries).map(f=>[f,read('scenario/'+f).toString('utf8')]));
  const sample=samples[1],lines=sources['第一章-回到毕节.md'].split('\n');lines.splice(sample.source.line-1,0,'<!-- TEXT '+JSON.stringify(sample.metadata)+' -->');sources['第一章-回到毕节.md']=lines.join('\n');
  assert.throws(()=>parse(c.ir.contract,sources,{pageSize:108}),/未知或非单行控制标记/);
  return {status:'pass',scope:'约定字段与原句夹具的离线检查，不验证正式解析器／姓名显示',fixtures:samples.length,invalidCasesRejected:invalid.map(x=>x[0]),legacyCompilerRejectsNewFormat:true,runtimeSupport:'pending-P1'};
}
function links(){
  const files=fs.readdirSync(path.join(ROOT,DOC)).filter(f=>f.endsWith('.md')).map(f=>DOC+'/'+f);
  files.push(QA+'/交接.md');let count=0;
  for(const file of files)for(const m of read(file).toString('utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
    let target=m[1];if(/^(https?:|#)/.test(target))continue;
    target=target.split('#')[0];const resolved=path.resolve(ROOT,path.dirname(file),target);
    const generatedByThisRun=['rule-matrix.json','verification.json'].some(f=>resolved===path.join(ROOT,QA,f));
    assert(fs.existsSync(resolved)||generatedByThisRun,'断链 '+file+' → '+target);count++;
  }
  return {files:files.length,links:count};
}
function main(){
  const baseline=json(QA+'/baseline.json');for(const input of baseline.inputs)assert.deepEqual(record(input.path),input);
  const c=compile({pageSize:108});assert.equal(c.ir.buildId,baseline.contentBuildId);
  assert.deepEqual(c.artifacts,compile({pageSize:108}).artifacts,'内存编译不确定');
  const registry=json(QA+'/paragraph-registry.json');assert.equal(registry.paragraphs.length,3018);
  const pmap=new Map(registry.paragraphs.map(p=>[p.id,p]));assert.equal(pmap.size,3018);
  const controls=json(QA+'/protected-controls.json');assert.deepEqual(controls.contract,c.ir.contract);assert.deepEqual(controls.choices,c.ir.choices);
  for(const f of controls.files)for(const marker of f.markers)assert.equal(read(f.file).toString('utf8').split('\n')[marker.line-1].trim(),marker.text);
  const issues=json(DOC+'/issues.json').issues,speakers=json(DOC+'/speakers.json').speakers;
  assert.equal(new Set(issues.map(i=>i.id)).size,issues.length);
  for(const item of [...issues,...speakers])for(const e of item.evidence){
    const raw=read(QA+'/before/'+e.file).toString('utf8').split('\n')[e.line-1];assert.equal(raw,e.quote);assert.equal(sha(raw),e.sha256);
    if(e.paragraphId){const p=pmap.get(e.paragraphId);assert.equal(p?.file,e.file);assert.equal(p?.sha256,e.sha256);assert.equal(p?.line,e.line);}
  }
  const ruleCheck=rules(c),formatCheck=formats();
  const linkCheck=links();
  for(const input of baseline.inputs)assert.deepEqual(record(input.path),input,'验收期间来源变化 '+input.path);
  const authored=[...fs.readdirSync(path.join(ROOT,DOC)).map(f=>DOC+'/'+f),'tools/story-revision/p0-baseline.cjs','tools/story-revision/p0-materials.cjs','tools/story-revision/verify-p0.cjs',QA+'/交接.md','TODO-v1.1.md','docs/对白化与结尾过渡修订计划-20261102.md'].map(record);
  out('rule-matrix.json',{schemaVersion:1,date:'2026-11-02',contentBuildId:c.ir.buildId,...ruleCheck});
  const evidenceFiles=['baseline.json','paragraph-registry.json','protected-controls.json','asset-fingerprints.json','capture-verification.json','format-fixtures.json','rule-matrix.json'].map(f=>record(QA+'/'+f));
  out('verification.json',{status:'pass',date:'2026-11-02',scope:'P0离线基线、规则与交接资料检查',contentBuildId:c.ir.buildId,inputsUnchanged:baseline.inputs.length,counts:baseline.counts,issues:issues.length,speakers:speakers.length,sourceEvidenceVerified:true,controlsUnchanged:true,deterministicMemoryCompile:true,ruleCheck:{routeAssignments:ruleCheck.routeAssignments,entered:ruleCheck.entered,skipped:ruleCheck.skipped,dispatchConfigurations:24,scoreConfigurations:8,hiddenEntryConfigurations:8},formatCheck,linkCheck,authored,evidenceFiles,additionalReferences:['qa/sui-q-20261030/验收报告.md','qa/ui-cinema-20261030/验收记录.md'].map(record),notPerformed:['全稿人工审校','P1中文模型试写','正式TEXT解析和姓名显示','逐段演出重绑','图片解码或目视复验','新候选构建','引擎与浏览器运行','存读档和手机真机','发布']});
  console.log(JSON.stringify({status:'pass',protectedFiles:baseline.inputs.length,paragraphs:pmap.size,issues:issues.length,speakers:speakers.length,routeAssignments:ruleCheck.routeAssignments,formatFixtures:formatCheck.fixtures,links:linkCheck.links},null,2));
}
try{main();}catch(e){console.error(e.stack);process.exitCode=1;}
