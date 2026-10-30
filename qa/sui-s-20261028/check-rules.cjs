#!/usr/bin/env node
'use strict';
// SUI-S 编辑稿控制流审阅器：不生成 NovelML，不运行引擎，不访问玩家存档。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'), DIR=path.join(ROOT,'scenario'), OUT=__dirname;
const {choices,parseCondition,ids}=require(path.join(ROOT,'tools/check-content.cjs'));
const inputTexts=new Map(fs.readdirSync(DIR).filter(f=>/\.(md|json)$/.test(f)).map(f=>[f,fs.readFileSync(path.join(DIR,f),'utf8')]));
const read=f=>{assert(inputTexts.has(f),'未登记输入 '+f);return inputTexts.get(f);};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const han=x=>(x.match(/\p{Script=Han}/gu)||[]).length;
const R=JSON.parse(read('routes.json'));
const files=[...new Set([...R.storyEntry.common,R.storyEntry.routeEntry,...R.routes.map(r=>r.file),R.day36.sharedSource.file,...R.epilogues.rules.flatMap(r=>r.target?[r.target.file]:[])])];
const sources=Object.fromEntries(files.map(f=>[f,read(f)]));
const choiceFiles=[...R.storyEntry.common,R.storyEntry.routeEntry,...R.routes.map(r=>r.file)];
const allChoices=choiceFiles.flatMap(f=>choices(sources[f],f));
const choiceMap=new Map(allChoices.map(c=>[c.id,c]));
const knownChoices=new Set(choiceMap.keys());
const allEndings=R.routes.flatMap(r=>[...r.endings,...(r.lowPathEndings||[])]),knownEndings=new Set(allEndings);
const routes=new Map(R.routes.map(r=>[r.id,r]));
const scoreRules=new Map(R.piaoRelation.choices.map(x=>[x.id,x]));
const nodes=new Map(), programs=new Map(), covered=new Map(files.map(f=>[f,new Set()]));
const report={scope:'SUI-S 源稿的状态、选择、调用返回、结局及后日谈静态展开；不是 Suika3 引擎/存档/浏览器/手机/发布验收',revision:R.revision,status:'running',checks:[],errors:[],counts:{},samples:[],sourceHashes:{},engineStatus:'未运行引擎；未访问玩家存档'};
const check=(name,fn)=>{try{const detail=fn();report.checks.push({name,status:'pass',detail});return detail;}catch(e){report.checks.push({name,status:'fail'});report.errors.push({check:name,message:e.message});return null;}};
function compile(file,text){
  const out=[],stack=[];
  text.split('\n').forEach((raw,i)=>{
    const line=raw.trim(), loc={file,line:i+1};let m;
    const add=(type,data={})=>out.push({type,...loc,...data});
    if((m=/^<!-- IF (.+) -->$/.exec(line))){stack.push(i+1);add('if',{ast:parseCondition(m[1],knownChoices,knownEndings)});}
    else if(line==='<!-- ENDIF -->'){assert(stack.length,`${file}:${i+1} 多余ENDIF`);stack.pop();add('endif');}
    else if((m=/^<!-- NODE ([A-Za-z0-9_-]+) -->$/.exec(line))){assert(!nodes.has(m[1]),'锚点重复 '+m[1]);nodes.set(m[1],loc);add('node',{id:m[1]});}
    else if(line==='<!-- CALL PIAO-D36 -->')add('call');
    else if(line==='<!-- RETURN -->')add('return');
    else if((m=/^<!-- EVENT ([A-Za-z0-9_-]+) -->$/.exec(line))){assert(R.stateContract.events.includes(m[1]),'未知事件 '+m[1]);add('event',{id:m[1]});}
    else if(line==='<!-- FREEZE PIAO_RELATION -->')add('freeze');
    else if(line==='<!-- EPILOGUE PM -->')add('epilogue');
    else if(line.startsWith('<!--'))throw Error(`${file}:${i+1} 未知控制标记 ${line}`);
    else if(/^#{2,3} 第[三四五六七八九十]+章｜/.test(line))add('chapter');
    else if(/^(?:#{2,3} 剧情简介|\*\*剧情简介\*\*)/.test(line))add('body',{on:false});
    else if(/^(?:#{2,3} 完整内容|\*\*完整内容\*\*)/.test(line))add('body',{on:true});
    else if((m=/^\*\*选择 ([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2})｜(.+)\*\*$/.exec(line)))add('choice',{id:m[1]});
    else if((m=/^#### ([AB])｜/.exec(line)))add('option',{value:m[1]});
    else if((m=/^### (.+)｜/.exec(line))&&file===R.storyEntry.routeEntry){const r=R.routes.find(r=>r.name===m[1]);assert(r,'未知路线标题 '+m[1]);add('option',{value:r.id});}
    else if(line==='#### 共同段')add('shared');
    else if((m=/^#### 结局 ([A-Z]+-(?:L)?E[12])｜/.exec(line))){assert(knownEndings.has(m[1]),'未知结局 '+m[1]);add('ending',{id:m[1]});}
    else if(line&&!/^(#|>|→)/.test(line)&&!/^\[.+\]\(.+\)(?: · .*)?$/.test(line))add('text',{text:line});
  });
  assert.equal(stack.length,0,file+' 条件未闭合');return out;
}
function fresh(){return {choices:{},score:R.piaoRelation.initialScore,relation:'UNSET',frozen:false,events:[],route:null,ending:null,epilogue:null,dispatched:false};}
const clone=s=>JSON.parse(JSON.stringify(s));
function stateValid(s){
  assert(Number.isInteger(s.score),'分数不是整数');
  assert(['UNSET','HIGH','LOW'].includes(s.relation),'非法关系值');
  let score=R.piaoRelation.initialScore;
  for(const [id,value] of Object.entries(s.choices)){
    assert(choiceMap.has(id),'未知选择状态 '+id);
    if(id===R.storyEntry.routeChoice)assert(routes.has(value),'非法路线选择值');
    else assert(['A','B'].includes(value),'非法选择值 '+id);
    const owner=R.routes.find(r=>r.file===choiceMap.get(id).file);if(owner){
      assert.equal(s.route,owner.id,'跨路线选择状态 '+id);
      if(owner.id==='piao')assert.equal(id===owner.lowPathChoice,s.relation==='LOW','飘高低路径混入选择 '+id);
    }
    if(scoreRules.has(id))score+=scoreRules.get(id).effects[value];
  }
  assert.equal(s.score,score,'分数与已访问选择不一致');
  assert.equal(new Set(s.events).size,s.events.length,'重复事件');
  s.events.forEach(x=>assert(R.stateContract.events.includes(x),'未知事件状态'));
  if(s.events.includes(R.day36.eventId)){assert.equal(s.relation,'LOW','HIGH携带怀孕事件');assert(s.route,'怀孕事件无所属路线');}
  if(s.events.includes(R.hiddenEntry.readEvent)){
    for(const[k,v]of Object.entries(R.hiddenEntry.choiceRequirements))assert.equal(s.choices[k],v,'相识已读缺少前置');
    assert(Object.hasOwn(s.choices,R.hiddenEntry.neutralChoice),'相识已读缺少C02-07');
  }
  assert.equal(s.frozen,s.relation!=='UNSET','关系冻结状态不一致');
  if(s.frozen){R.piaoRelation.choices.forEach(x=>assert(Object.hasOwn(s.choices,x.id),'冻结缺少已访问选择'));assert.equal(s.relation,s.score>=R.piaoRelation.freeze.highAtLeast?'HIGH':'LOW','冻结关系与分数不一致');}
  if(s.route){assert(routes.has(s.route),'未知路线');assert(s.frozen,'路线开始前关系未冻结');assert.equal(s.choices[R.storyEntry.routeChoice],s.route,'路线与选择状态不一致');}
  if(s.route===R.hiddenEntry.routeId){
    for(const[k,v]of Object.entries(R.hiddenEntry.choiceRequirements))assert.equal(s.choices[k],v,'隐藏路线缺前置');
    assert(s.events.includes(R.hiddenEntry.readEvent),'隐藏路线缺相识已读');
  }
  if(s.ending)assert.equal(s.ending,expectedEnding(s),'跨线或非法结局');
}
function evalCondition(ast,s){return ast.some(group=>group.every(({field,operator,value})=>{
  let actual;
  if(field==='PIAO_RELATION'){assert(s.frozen&&['HIGH','LOW'].includes(s.relation),'缺少已冻结关系');actual=s.relation;}
  else if(field==='ENDING'){assert(s.ending&&knownEndings.has(s.ending),'缺少合法已读结局');actual=s.ending;}
  else{assert(Object.hasOwn(s.choices,field),'条件提前读取未访问选择 '+field);actual=s.choices[field];assert(['A','B'].includes(actual),'非法选择值 '+field);}
  return operator==='='?actual===value:actual!==value;
}));}
function freeze(s){assert(!s.frozen,'关系重复冻结');R.piaoRelation.choices.forEach(x=>assert(Object.hasOwn(s.choices,x.id),'冻结缺少已访问选择 '+x.id));s.relation=s.score>=R.piaoRelation.freeze.highAtLeast?'HIGH':'LOW';s.frozen=true;}
function choose(s,id,value){
  assert(choiceMap.has(id),'未知选择 '+id);assert(!Object.hasOwn(s.choices,id),'重复提交选择 '+id);
  if(id===R.storyEntry.routeChoice){assert(s.frozen,'路线入口关系未冻结');assert(routes.has(value),'非法路线选择值');assert(!s.route,'路线重复选择');if(value===R.hiddenEntry.routeId){for(const [id,v]of Object.entries(R.hiddenEntry.choiceRequirements))assert.equal(s.choices[id],v,'隐藏入口缺少前置');assert(s.events.includes(R.hiddenEntry.readEvent),'隐藏入口缺少相识已读');}s.route=value;}
  else assert(['A','B'].includes(value),'非法选择值 '+id);
  if(scoreRules.has(id)){assert(!s.frozen,'冻结后计分');s.score+=scoreRules.get(id).effects[value];}
  s.choices[id]=value;
}
function expectedEnding(s){
  assert(s.route&&routes.has(s.route),'结局没有当前路线');const r=routes.get(s.route);
  if(s.route==='piao'&&s.relation==='LOW'){assert(Object.hasOwn(s.choices,r.lowPathChoice),'低路径缺关键选择');return r.lowPathOutcomes[s.choices[r.lowPathChoice]];}
  const combination=r.keyChoices.map(id=>{assert(Object.hasOwn(s.choices,id),'缺关键选择 '+id);return s.choices[id];}).join('');
  assert(Object.hasOwn(r.outcomes,combination),'非法关键组合');return r.outcomes[combination];
}
function ending(s,id){assert(!s.ending,'重复结局');assert.equal(id,expectedEnding(s),'跨线或非法结局');s.ending=id;}
function event(s,id){assert(R.stateContract.events.includes(id),'未知事件');assert(!s.events.includes(id),'重复事件');if(id===R.hiddenEntry.readEvent){for(const[k,v]of Object.entries(R.hiddenEntry.choiceRequirements))assert.equal(s.choices[k],v,'相识事件缺前置');assert(Object.hasOwn(s.choices,R.hiddenEntry.neutralChoice),'相识事件未完整读');}else{assert.equal(s.relation,'LOW','高关系发生怀孕');assert(s.route,'事件无路线');}s.events.push(id);}
function dispatchRule(s){stateValid(s);assert(s.ending,'后日谈缺少结局');const matches=R.epilogues.rules.filter(r=>r.relation===s.relation&&r.endings.includes(s.ending));assert.equal(matches.length,1,'后日谈分派不唯一');const rule=matches[0];if(rule.requiresEvent)assert(s.events.includes(rule.requiresEvent),'后日谈缺少怀孕事件');return rule;}
function walk(file,s,answers,run,frame=null){
  const stack=[];let inBody=false,currentChoice=null,option=null,lastNode=null,pendingReturn=null;
  const out=[]; const trace=(type,t,extra={})=>run.trace.push({type,file,line:t.line,...extra});
  for(const t of programs.get(file)){
    if(t.type==='if'){stack.push(stack.every(Boolean)&&evalCondition(t.ast,s));continue;}
    if(t.type==='endif'){assert(stack.length,'多余ENDIF');stack.pop();continue;}
    const active=stack.every(Boolean);
    if(t.type==='chapter'){inBody=false;currentChoice=null;option=null;continue;}
    if(t.type==='body'){inBody=t.on;currentChoice=null;option=null;continue;}
    if(t.type==='choice'){currentChoice=t.id;option=null;if(active&&inBody){assert(Object.hasOwn(answers,t.id),'缺少选择答案 '+t.id);choose(s,t.id,answers[t.id]);trace('choice',t,{id:t.id,value:answers[t.id]});}continue;}
    if(t.type==='option'){assert(currentChoice,'选项无选择');option=t.value;continue;}
    if(t.type==='shared'){option=null;continue;}
    const eligible=active&&(!option||s.choices[currentChoice]===option);
    if(!eligible)continue;
    if(t.type==='node'){lastNode=t.id;trace('node',t,{id:t.id});if(pendingReturn){assert.equal(t.id,pendingReturn,'CALL没有返回指定锚点');trace('resume',t,{id:t.id});pendingReturn=null;}continue;}
    if(t.type==='freeze'){assert.equal(file,R.piaoRelation.freeze.file);assert.equal(lastNode,R.piaoRelation.freeze.anchor);freeze(s);trace('freeze',t,{score:s.score,relation:s.relation});continue;}
    if(t.type==='event'){
      if(t.id===R.hiddenEntry.readEvent){assert.equal(file,R.hiddenEntry.source.file);assert.equal(lastNode,R.hiddenEntry.source.anchor);}
      else{assert.equal(s.route,'piao');assert.equal(file,R.day36.piaoSource.file);assert.equal(lastNode,R.day36.piaoSource.completeAnchor);assert(Object.hasOwn(s.choices,'PI-L06-01'),'飘事件早于回应');}
      event(s,t.id);trace('event',t,{id:t.id});continue;
    }
    if(t.type==='call'){
      assert(!frame,'禁止嵌套day36调用');assert.equal(s.relation,'LOW');assert.notEqual(s.route,'piao');
      assert(!s.events.includes(R.day36.eventId),'重复事件调用');
      const c=R.day36.calls.find(c=>c.routeId===s.route);assert(c&&c.file===file&&c.callAnchor===lastNode,'未登记CALL来源');
      const before=JSON.stringify(s);trace('call',t,{target:R.day36.sharedSource.anchor,returnAnchor:c.returnAnchor});
      const child=walk(R.day36.sharedSource.file,s,answers,run,{caller:file,returnAnchor:c.returnAnchor});assert(child.returned,'公共事件未RETURN');assert.equal(JSON.stringify(s),before,'公共事件改写主线状态');
      assert(han(child.text)>0,'公共事件正文为空');out.push(child.text);event(s,R.day36.eventId);trace('event-complete',t,{id:R.day36.eventId});pendingReturn=c.returnAnchor;continue;
    }
    if(t.type==='return'){assert(frame,'RETURN没有调用栈');assert.equal(file,R.day36.sharedSource.file);assert.equal(stack.length,0,'RETURN跨越未闭合条件');trace('return',t,{to:frame.returnAnchor});return{text:out.join('\n\n'),returned:true};}
    if(t.type==='ending'){if(inBody){ending(s,t.id);trace('ending',t,{id:t.id});}continue;}
    if(t.type==='epilogue'){
      assert(inBody,'后日谈标记不在正文');assert(!s.dispatched,'重复后日谈');const rule=dispatchRule(s);s.dispatched=true;trace('dispatch',t,{target:rule.target?.anchor??null});
      if(rule.target){s.epilogue=rule.target.file;const before=JSON.stringify(s);const ep=walk(rule.target.file,s,answers,run);assert(han(ep.text)>0,'后日谈正文为空');assert.equal(JSON.stringify(s),before,'后日谈改写主线状态');run.epilogueText=ep.text;out.push(ep.text);}continue;
    }
    if(t.type==='text'&&inBody){out.push(t.text);covered.get(file).add(t.line);}
  }
  assert.equal(stack.length,0,'未闭合条件');assert(!pendingReturn,'缺少返回锚点');return{text:out.join('\n\n'),returned:false};
}
const answersFor=names=>Object.fromEntries(names.map(id=>[id,'A']));
function common(answers){const s=fresh(),run={trace:[],epilogueText:''};for(const f of R.storyEntry.common)walk(f,s,answers,run);stateValid(s);assert(s.frozen,'共通结束仍未冻结');return{s,run};}
function complete(base,routeId,routeAnswers){
  const s=clone(base),run={trace:[],epilogueText:''},answers={...routeAnswers,[R.storyEntry.routeChoice]:routeId};
  walk(R.storyEntry.routeEntry,s,answers,run);const r=routes.get(routeId);const result=walk(r.file,s,answers,run);stateValid(s);assert(s.ending,'主线未产生结局');const rule=dispatchRule(s);
  assert.equal(s.epilogue,rule.target?.file??null,'后日谈目标错误');if(rule.target)assert(s.dispatched,'未执行后日谈标记');
  const calls=run.trace.filter(x=>x.type==='call').length,returns=run.trace.filter(x=>x.type==='return').length,resumes=run.trace.filter(x=>x.type==='resume').length;
  const expectedCalls=s.relation==='LOW'&&routeId!=='piao'?1:0;assert.equal(calls,expectedCalls);assert.equal(returns,expectedCalls);assert.equal(resumes,expectedCalls);
  assert.equal(s.events.includes(R.day36.eventId),s.relation==='LOW');
  if(s.ending==='FR-E2'){assert(!run.epilogueText.includes('后来我碰到他们'));assert(!run.epilogueText.includes('饭后她问大家'));assert(!run.epilogueText.includes('毛狼把婚后的第一顿朋友饭约在小店'));if(s.relation==='LOW')assert(run.epilogueText.includes('那顿饭我没去'));}
  if(s.relation==='LOW'){assert(!run.epilogueText.includes('我们结婚了'));assert.equal(run.epilogueText.includes('我现在和文文试着交往'),s.ending==='PI-LE1');}
  return{s,run,text:result.text};
}
function* assignments(names){for(let i=0;i<2**names.length;i++)yield Object.fromEntries(names.map((id,j)=>[id,(i>>j)&1?'B':'A']));}
const keyNames=R.piaoRelation.choices.map(x=>x.id),commonIds=R.storyEntry.common.flatMap(f=>ids(sources[f]));
function main(){
  const staticOK=check('契约、稳定锚点与控制标记',()=>{
    assert.equal(R.schemaVersion,2);assert.equal(R.contentContract.status,'frozen');assert.equal(R.status,'manuscript-only');assert.equal(R.runtimeReady,false);assert.deepEqual(R.unresolved,[]);
    assert.equal(R.routes.length,6);assert(!routes.has('yelan'));assert(R.supportingOnly.includes('yelan'));
    assert.equal(knownChoices.size,allChoices.length,'选择ID重复');assert.equal(knownEndings.size,allEndings.length,'结局ID重复');
    assert.equal(R.piaoRelation.initialScore,20);assert.equal(R.piaoRelation.freeze.highAtLeast,35);assert.equal(R.piaoRelation.clamp,null);assert.deepEqual(keyNames,['C01-06','C02-08','C02-09']);
    for(const x of R.piaoRelation.choices){assert(choiceMap.has(x.id),'新选择未写入 '+x.id);assert.equal(choiceMap.get(x.id).file,x.file);assert.deepEqual(x.effects,{A:10,B:-5});}
    for(const file of files)programs.set(file,compile(file,sources[file]));
    const required=[{file:R.piaoRelation.freeze.file,anchor:R.piaoRelation.freeze.anchor},R.hiddenEntry.source,R.day36.sharedSource,...R.day36.calls.flatMap(c=>[{file:c.file,anchor:c.callAnchor},{file:c.file,anchor:c.returnAnchor}]),{file:R.day36.piaoSource.file,anchor:R.day36.piaoSource.startAnchor},{file:R.day36.piaoSource.file,anchor:R.day36.piaoSource.completeAnchor},...R.epilogues.rules.flatMap(r=>r.target?[r.target]:[]),...Object.values(routes.get('piao').pathAnchors).map(anchor=>({file:routes.get('piao').file,anchor}))];
    for(const x of required){assert(nodes.has(x.anchor),'缺锚点 '+x.anchor);assert.equal(nodes.get(x.anchor).file,x.file,'锚点来源不符');}
    for(const c of R.day36.calls){assert(c.afterDay<=36&&c.beforeDay>=36,'day36时序范围非法');assert(nodes.get(c.callAnchor).line<nodes.get(c.returnAnchor).line);}
    assert.deepEqual(R.mengyao.outcomes,{AA:'MY-E1',AB:'MY-E2',BA:'MY-E2',BB:'MY-E2'});assert.equal(R.mengyao.marriageEnds,false);assert(R.mengyao.stoppedAtFirstChoiceCannotResume);
    report.counts.choices=allChoices.length;report.counts.options=allChoices.reduce((n,x)=>n+x.options.length,0);report.counts.declaredEndings=allEndings.length;
    report.sourceLocations={choices:allChoices.map(({id,file,line})=>({id,file,line})),nodes:Object.fromEntries(nodes)};
    return{files:files.length,nodes:nodes.size,choices:allChoices.length};
  });
  if(!staticOK)return;
  check('选择索引逐字一致',()=>{const rows=[...read('选择设计.md').matchAll(/^\| ([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2}) · [^|]+ \| ([^|]+) \| ([^|]+) \|$/gm)];assert.equal(rows.length,allChoices.length);assert.equal(new Set(rows.map(x=>x[1])).size,rows.length);for(const c of allChoices){const row=rows.find(r=>r[1]===c.id);assert(row,c.id+'索引缺失');assert.equal(row[2].trim(),c.question,c.id+'问题不一致');assert.deepEqual(row[3].trim().split(/<br\s*\/?\s*>/).map(s=>s.trim()),c.options.map(([a,b])=>a+'：'+b),c.id+'选项不一致');}return{matched:rows.length};});
  const baseAnswers=answersFor(commonIds),bases={};
  check('关系8组合、初值与阈值边界',()=>{
    const rows=[];for(const flags of assignments(keyNames)){const {s}=common({...baseAnswers,...flags});const aa=keyNames.map(k=>flags[k]).join('');const count=Object.values(flags).filter(v=>v==='A').length;assert.equal(s.score,5+15*count);assert.equal(s.relation,count>=2?'HIGH':'LOW');rows.push({combination:aa,score:s.score,relation:s.relation});bases[s.relation]??=s;}
    assert.equal(34>=R.piaoRelation.freeze.highAtLeast,false);assert.equal(35>=R.piaoRelation.freeze.highAtLeast,true);assert.equal(36>=R.piaoRelation.freeze.highAtLeast,true);
    report.relationMatrix=rows;return{combinations:8,reachableScores:[5,20,35,50],boundary:'35含等号；34/36为阈值函数边界，不伪称正文可达分数'};
  });
  check('共通全赋值、黄球球门禁与真实相识标记',()=>{
    let count=0,unlocked=0;const unique=new Set(),relationCounts={HIGH:0,LOW:0};
    for(const flags of assignments(commonIds)){const {s,run}=common(flags);const eligible=flags['C01-02']==='A'&&flags['C02-01']==='A';assert.equal(Object.hasOwn(s.choices,'C02-01'),flags['C01-02']==='A');assert.equal(Object.hasOwn(s.choices,'C02-07'),eligible);assert.equal(s.events.includes(R.hiddenEntry.readEvent),eligible);assert.equal(run.trace.filter(t=>t.type==='freeze').length,1);if(eligible)unlocked++;relationCounts[s.relation]++;unique.add(JSON.stringify(s.choices));count++;}
    const good=clone(bases.HIGH);choose(good,'ROUTE-01','huangqiuqiu');const bad=clone(bases.HIGH);bad.events=[];assert.throws(()=>choose(bad,'ROUTE-01','huangqiuqiu'),/相识已读/);
    report.counts.commonAssignments=count;report.counts.commonDistinctReadings=unique.size;return{assignments:count,distinctReadings:unique.size,unlockedAssignments:unlocked,relationCounts,guards:'直接执行源稿IF，不使用commonGuard临时注入'};
  });
  check('全路线、高低关系、调用返回、结局及双后日谈',()=>{
    let count=0,calls=0,epilogues=0;const distributions={},sampleKeys=new Set();
    for(const r of R.routes)for(const rel of ['HIGH','LOW']){
      const names=rel==='LOW'&&r.id==='piao'?[r.lowPathChoice]:ids(sources[r.file].split('## 低好感路径｜')[0]);let n=0;
      for(const answers of assignments(names)){
        const result=complete(bases[rel],r.id,answers);const combo=(rel==='LOW'&&r.id==='piao'?[r.lowPathChoice]:r.keyChoices).map(id=>answers[id]).join('');
        const key=`${r.id}/${rel}/${combo}`;if(!sampleKeys.has(key)){sampleKeys.add(key);report.samples.push({route:r.id,relation:rel,combination:combo,ending:result.s.ending,epilogue:result.s.epilogue,sourceTrace:result.run.trace,textSha256:hash(result.text),han:han(result.text),epilogueHan:han(result.run.epilogueText)});}
        calls+=result.run.trace.filter(x=>x.type==='call').length;epilogues+=result.s.epilogue?1:0;count++;n++;
      }distributions[`${r.id}/${rel}`]=n;
    }
    assert.equal(count,2818);report.counts.routeAssignments=count;report.counts.sharedCalls=calls;report.counts.sharedReturns=calls;report.counts.epilogueReads=epilogues;report.counts.representativeTraces=report.samples.length;
    return{assignments:count,distributions,sharedCalls:calls,sharedReturns:calls,epilogueReads:epilogues,representativeTraces:report.samples.length};
  });
  check('拒绝非法状态、未访问条件及不合法跳转',()=>{
    let n=0;const rejects=(fn,re)=>{assert.throws(fn,re);n++;};const state=clone(bases.HIGH);
    rejects(()=>stateValid({...state,relation:'garbage'}),/非法关系/);
    rejects(()=>stateValid({...state,score:state.score+1}),/分数与/);
    rejects(()=>choose(fresh(),'C01-06','C'),/非法选择值/);
    const twice=fresh();choose(twice,'C01-06','A');rejects(()=>choose(twice,'C01-06','A'),/重复提交/);
    rejects(()=>freeze(fresh()),/缺少已访问/);rejects(()=>freeze(state),/重复冻结/);
    rejects(()=>choose(fresh(),'ROUTE-01','friends'),/未冻结/);
    rejects(()=>evalCondition(parseCondition('MY07-01=A',knownChoices,knownEndings),state),/未访问/);
    rejects(()=>evalCondition(parseCondition('PIAO_RELATION=LOW',knownChoices,knownEndings),fresh()),/冻结关系/);
    rejects(()=>parseCondition('UNKNOWN=A',knownChoices,knownEndings),/未知选择/);
    rejects(()=>parseCondition('PIAO_RELATION=MID',knownChoices,knownEndings),/未知飘关系/);
    const future=clone(state);future.route='friends';future.choices['ROUTE-01']='friends';rejects(()=>ending(future,'MY-E1'),/缺关键选择|跨线/);
    const routeAnswers=answersFor(ids(sources[routes.get('friends').file]));const done=complete(bases.LOW,'friends',routeAnswers).s;
    rejects(()=>event(done,R.day36.eventId),/重复事件/);
    const missing=clone(done);missing.events=missing.events.filter(e=>e!==R.day36.eventId);rejects(()=>dispatchRule(missing),/缺少怀孕/);
    const wrong=clone(done);wrong.ending='MY-E1';rejects(()=>dispatchRule(wrong),/跨线或非法结局/);
    rejects(()=>walk(R.day36.sharedSource.file,clone(done),{}, {trace:[],epilogueText:''}),/RETURN没有调用栈/);
    rejects(()=>complete(bases.HIGH,'friends',{}),/缺少选择答案/);
    const repeated=clone(done);rejects(()=>walk(routes.get('friends').file,repeated,routeAnswers,{trace:[],epilogueText:''}),/重复提交/);
    const highPreg=clone(state);highPreg.events.push(R.day36.eventId);rejects(()=>stateValid(highPreg),/HIGH携带怀孕/);
    const falseMeeting=clone(state);falseMeeting.choices['C01-02']='B';rejects(()=>stateValid(falseMeeting),/相识已读缺少前置/);
    const missingMeetingChoice=clone(state);delete missingMeetingChoice.choices['C02-07'];rejects(()=>stateValid(missingMeetingChoice),/相识已读缺少C02-07/);
    const injectedHQ=clone(state);injectedHQ.route='huangqiuqiu';injectedHQ.choices['ROUTE-01']='huangqiuqiu';injectedHQ.events=[];rejects(()=>stateValid(injectedHQ),/隐藏路线缺相识/);
    const highLowChoice=clone(state);highLowChoice.route='piao';highLowChoice.choices['ROUTE-01']='piao';highLowChoice.choices['PI-L06-01']='A';rejects(()=>stateValid(highLowChoice),/飘高低路径混入/);
    const lowHighChoice=clone(bases.LOW);lowHighChoice.route='piao';lowHighChoice.choices['ROUTE-01']='piao';lowHighChoice.choices['PI03-01']='A';rejects(()=>stateValid(lowHighChoice),/飘高低路径混入/);
    const commonB=common({...baseAnswers,'C01-02':'B'}).s;assert(!Object.hasOwn(commonB.choices,'C02-01'));assert.equal(evalCondition(parseCondition('C01-02=A & C02-01=A',knownChoices,knownEndings),commonB),false);
    report.counts.rejectedNegativeCases=n;return{rejected:n,validShortCircuit:'C01-02=B时短路，不读取未访问C02-01'};
  });
  check('历史SDK与检查工具保护',()=>{const before=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/route-merge-20261028/sdk-before.json'),'utf8'));for(const[f,h]of Object.entries(before))assert.equal(hash(fs.readFileSync(path.join(ROOT,f))),h,'SDK变化 '+f);const inputBefore=JSON.parse(fs.readFileSync(path.join(OUT,'input-before.json'),'utf8'));
    assert.equal(hash(fs.readFileSync(path.join(ROOT,'tools/check-content.cjs'))),inputBefore['tools/check-content.cjs'],'原检查工具被修改');
    return{sdkFilesUnchanged:Object.keys(before).length,oldToolSha256Matches:true,oldToolBaseline:'qa/sui-s-20261028/input-before.json',oldAudit:'仅import解析函数，未调用audit或重写旧QA'};});
}
try{main();}catch(e){report.errors.push({check:'检查器运行',message:e.stack});}
for(const f of fs.readdirSync(DIR).filter(f=>/\.(md|json)$/.test(f)).sort())report.sourceHashes['scenario/'+f]=hash(inputTexts.get(f));
report.sourceHashes['tools/check-content.cjs']=hash(fs.readFileSync(path.join(ROOT,'tools/check-content.cjs')));
report.sourceHashes['qa/sui-s-20261028/check-rules.cjs']=hash(fs.readFileSync(__filename));
report.coverage=Object.fromEntries([...covered].map(([file,lines])=>[file,{readNarrativeLines:lines.size}]));
report.status=report.errors.length?'fail':'pass';
fs.writeFileSync(path.join(OUT,'content-audit.json'),JSON.stringify(report,null,2)+'\n');
const rows=report.checks.map(c=>`| ${c.name} | ${c.status==='pass'?'通过':'失败'} |`).join('\n');
fs.writeFileSync(path.join(OUT,'content-audit.md'),`# SUI-S 源稿规则核查\n\n范围：${report.scope}。\n\n结果：${report.status==='pass'?'通过':'存在失败'}。\n\n| 检查 | 结果 |\n| --- | --- |\n${rows}\n\n实际计数：${JSON.stringify(report.counts)}。\n\n${report.errors.map(e=>'- '+e.check+'：'+e.message).join('\n')}\n\n输入指纹、来源行号、代表轨迹与分派结果见 [content-audit.json](content-audit.json)。\n\n运行：\`node qa/sui-s-20261028/check-rules.cjs\`。仅证明本审阅器对源稿契约的展开；不证明人物动机、完整语义、引擎执行、存档恢复或真机表现。日序的 afterDay/beforeDay 检查为契约范围核查，正文时序仍须独立审读。\n`);
console.log(JSON.stringify({status:report.status,counts:report.counts,errors:report.errors},null,2));process.exitCode=report.errors.length?1:0;
