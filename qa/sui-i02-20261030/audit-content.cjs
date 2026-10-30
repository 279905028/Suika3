#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {compile,write}=require('../../tools/compiler/compile.cjs');
const {parse,condition,hash}=require('../../tools/compiler/parse.cjs');
const {quoted}=require('../../tools/compiler/emit.cjs');
const {model}=require('../../tools/compiler/model.cjs');
const root=path.resolve(__dirname,'../..'),result=compile({pageSize:108}),ir=result.ir,R=ir.contract,m=model(ir);
const report={buildId:ir.buildId,layer:'SUI-I02 当前正文与108字素编译/中间表示全路径对照；不等同引擎、存档、资源绑定、真机或发布',checks:[],counts:{},samples:[]};
const check=(name,fn)=>{const detail=fn();report.checks.push({name,status:'pass',detail});console.log('PASS '+name);};
const assignments=function*(ids){for(let mask=0;mask<2**ids.length;mask++)yield Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']));};
const sources=Object.fromEntries(Object.keys(ir.entries).map(f=>[f,fs.readFileSync(path.join(root,'scenario',f),'utf8')]));
function oracle(){
  const dir=path.join(root,'qa/sui-s-20261028'),target=path.join(__dirname,'audit-oracle');fs.mkdirSync(target,{recursive:true});
  const original=fs.readFileSync(path.join(dir,'check-rules.cjs'),'utf8');
  // Execute the reviewer with outputs redirected; historical SDK baseline is limited to SDK/ because old sample root entry was legitimately replaced by SUI-E. Current input protection is separately checked below.
  const fakefs={...fs,readFileSync:(p,...rest)=>{if(path.resolve(p)===path.join(root,'qa/route-merge-20261028/sdk-before.json')){const old=JSON.parse(fs.readFileSync(p,'utf8'));return JSON.stringify(Object.fromEntries(Object.entries(old).filter(([f])=>f.startsWith('SDK/'))));}return fs.readFileSync(p,...rest);},writeFileSync:(p,...rest)=>{assert(path.dirname(p)===dir,'oracle写入越界');return fs.writeFileSync(path.join(target,path.basename(p)),...rest);}};
  const wrapped=vm.runInThisContext('(function(require,__dirname,__filename,console,process){'+original.replace(/^#![^\n]*/,'')+'\nreturn {common,complete,baseAnswers:answersFor(commonIds),report,covered};})',{filename:'SUI-S只读对照'});
  const actual=wrapped(id=>id==='node:fs'?fakefs:require(id),dir,path.join(dir,'check-rules.cjs'),{log(){}},{exitCode:0});
  assert.equal(actual.report.status,'pass',JSON.stringify(actual.report.errors));
  return actual;
}
const norm=x=>JSON.parse(JSON.stringify(x));
const contentState=s=>Object.fromEntries(['choices','score','relation','frozen','events','route','ending','epilogue'].map(k=>[k,norm(s[k])]));
try{
  const reference=oracle();
  check('当前SUI-S只读复核',()=>({status:reference.report.status,counts:reference.report.counts}));
  check('可重建、白名单与生成结构',()=>{
    assert.deepEqual(result.artifacts,compile({pageSize:108}).artifacts);
    assert.equal(Object.keys(ir.choices).length,65);assert.equal(ir.nodes.filter(n=>n.op==='ending').length,14);
    const novel=result.artifacts['story.novel'];assert(!novel.includes('${'));assert(!novel.includes('EPILOGUE PM'));
    const labels=[...novel.matchAll(/^\[label name="([^"]+)"\]$/gm)].map(x=>x[1]);assert.equal(new Set(labels).size,labels.length);
    for(const x of novel.matchAll(/^\[goto name="([^"]+)"\]$/gm))assert(labels.includes(x[1]),'悬空goto');
    return {...result.manifest.counts,labels:labels.length};
  });
  check('原文、选项与来源映射完整',()=>{
    const map=JSON.parse(result.artifacts['source-map.json']);assert.equal(Object.keys(map.units).length,ir.nodes.length);
    const grouped=new Map();for(const n of ir.nodes.filter(n=>n.op==='text')){const key=n.source.file+':'+n.source.line;grouped.set(key,(grouped.get(key)||'')+n.text);}
    for(const[key,text]of grouped){const i=key.lastIndexOf(':'),file=key.slice(0,i),line=Number(key.slice(i+1));assert.equal(text,sources[file].split('\n')[line-1].trim(),key);}
    for(const[file,covered]of reference.covered){const actual=new Set(ir.nodes.filter(n=>n.op==='text'&&n.source.file===file).map(n=>n.source.line));assert.deepEqual([...actual].sort((a,b)=>a-b),[...covered].sort((a,b)=>a-b),file+'正文漏读/误编');}
    const novelLines=result.artifacts['story.novel'].split('\n'),rayLines=result.artifacts['story.ray'].split('\n');
    for(const[id,unit]of Object.entries(map.units)){assert.equal(novelLines[unit.novelStart-1],`[label name="${id}"]`);if(unit.rayLine)assert(rayLines[unit.rayLine-1].includes('sc_ops["'+id+'"]'));}
    return {paragraphs:grouped.size,mappedUnits:Object.keys(map.units).length,allNarrativeLinesMatch:true};
  });
  const commonIds=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id),bases={};
  check('共通32768赋值与黄球球门禁逐组对照',()=>{
    let count=0,unlocked=0;for(const a of assignments(commonIds)){
      const expected=reference.common(a).s,actual=m.run(a,{collect:false});
      assert.equal(actual.waiting,R.storyEntry.routeChoice);assert.deepEqual(contentState(actual.s),contentState(expected));
      if(m.available(actual.s,'ROUTE-01').some(o=>o.value==='huangqiuqiu')){unlocked++;bases[actual.s.relation]??=actual.s;}
      count++;
    }report.counts.commonAssignments=count;assert.equal(count,32768);return {count,unlocked};
  });
  check('全部2818路线展开、文字与结局逐组对照',()=>{
    let count=0,calls=0,returns=0;const selected=new Set(),coverage=new Set();
    for(const r of R.routes)for(const relation of ['HIGH','LOW']){
      const ids=Object.values(ir.choices).filter(c=>c.source.file===r.file&&(r.id!=='piao'||(c.id===r.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
      for(const answers of assignments(ids)){
        const expected=reference.complete(norm(bases[relation]),r.id,answers),a={...answers,'ROUTE-01':r.id};
        const actual=m.run(a,{state:bases[relation],start:ir.entries[R.storyEntry.routeEntry]});
        assert.equal(actual.s.status,'complete');assert.equal(actual.waiting,null);assert.deepEqual(contentState(actual.s),contentState(expected.s));
        const text=actual.paragraphs.filter(p=>p.file!==R.storyEntry.routeEntry).map(p=>p.text).join('\n\n');assert.equal(text,expected.text,`${r.id}/${relation}逐字对照`);
        actual.paragraphs.forEach(p=>coverage.add(p.file+':'+p.line));
        calls+=actual.trace.filter(t=>t.op==='call').length;returns+=actual.trace.filter(t=>t.op==='return').length;
        const combo=(r.id==='piao'&&relation==='LOW'?[r.lowPathChoice]:r.keyChoices).map(id=>answers[id]).join(''),key=`${r.id}/${relation}/${combo}`;
        if(!selected.has(key)){selected.add(key);report.samples.push({key,route:r.id,relation,combination:combo,ending:actual.s.ending,epilogue:actual.s.epilogue,textSha256:hash(text),choices:actual.s.choices,trace:actual.trace});}
        count++;
      }
    }
    assert.equal(count,2818);assert.equal(calls,returns);report.counts.routeAssignments=count;report.counts.calls=calls;report.counts.returns=returns;report.counts.representativeTraces=selected.size;
    return {count,calls,returns,representatives:selected.size,readLines:coverage.size};
  });
  check('稳定ID不依赖行号或排版空行',()=>{
    const moved=Object.fromEntries(Object.entries(sources).map(([f,s])=>[f,'\n\n'+s.replaceAll('\n\n','\n\n\n')]));
    const other=parse(R,moved,{pageSize:108});assert.deepEqual(ir.nodes.map(n=>n.id),other.nodes.map(n=>n.id));
    return {stableNodes:other.nodes.length};
  });
  check('编译负例与Unicode/引号/标签转义',()=>{
    let rejected=0;const reject=(fn)=>{assert.throws(fn);rejected++;};
    const mutate=(file,from,to)=>{assert(sources[file].includes(from));return {...sources,[file]:sources[file].replace(from,to)};};
    const f=R.storyEntry.common[0],g=R.storyEntry.common[1];
    for(const marker of ['<!-- IF UNKNOWN=A -->','<!-- IF PIAO_RELATION=MID -->','<!-- IF C01-01=C -->','<!-- IF (C01-01=A) -->','<!-- ENDIF -->','<!-- UNKNOWN -->','<!-- EVENT UNKNOWN -->','<!-- FREEZE OTHER -->','<!-- CALL UNKNOWN -->','<!-- RETURN -->'])reject(()=>parse(R,{...sources,[f]:marker+'\n'+sources[f]}));
    reject(()=>parse(R,mutate(f,'**选择 C01-02｜','**选择 C01-01｜')));
    reject(()=>parse(R,mutate(f,'#### B｜先核对上班和休息的时间','#### A｜先核对上班和休息的时间')));
    reject(()=>parse(R,mutate(g,'<!-- NODE HQ-MEETING-COMPLETE -->','<!-- NODE PIAO-RELATION-FREEZE -->')));
    reject(()=>parse(R,mutate(g,'<!-- NODE PIAO-RELATION-FREEZE -->','')));
    reject(()=>parse(R,mutate(g,'<!-- IF C01-02=A -->','<!-- IF C01-02=A -->\n<!-- IF C01-02=A -->')));
    reject(()=>parse(R,{...sources,[R.routes[0].file]:sources[R.routes[0].file].replace('XM-E1｜','XX-E1｜')}));
    reject(()=>parse(R,sources,{pageSize:0}));
    reject(()=>condition('ENDING=NOPE',ir.choices,[]));
    for(const text of ['中文"双引号" \\n [goto name="oops"] ${raw}','a\nb\tc','👨‍👩‍👧‍👦 é 🧑🏽‍💻'])assert.equal(JSON.parse(quoted(text)),text);
    reject(()=>quoted('坏\u0000字'));
    report.counts.compileNegatives=rejected;return {rejected};
  });
  check('运行内容语义拒绝负例与短路',()=>{
    let rejected=0;const reject=fn=>{assert.throws(fn);rejected++;},copy=x=>structuredClone(x);
    reject(()=>m.freeze(m.fresh()));reject(()=>m.freeze(copy(bases.HIGH)));reject(()=>m.choose(m.fresh(),'ROUTE-01','friends'));
    reject(()=>m.choose(m.fresh(),'UNKNOWN','A'));reject(()=>m.choose(m.fresh(),'C01-06','C'));
    const s=m.fresh();m.choose(s,'C01-06','A');reject(()=>m.choose(s,'C01-06','A'));
    const bad=copy(bases.HIGH);bad.events=[];reject(()=>m.choose(bad,'ROUTE-01','huangqiuqiu'));
    reject(()=>m.evaluate(condition('MY07-01=A',ir.choices,[]),bases.HIGH));
    const short=copy(bases.HIGH);short.choices['C01-02']='B';delete short.choices['C02-01'];assert.equal(m.evaluate(condition('C01-02=A & C02-01=A',ir.choices,[]),short),false);
    for(const patch of [{score:900},{relation:'MID'},{route:'yelan'},{unexpected:1},{events:['unknown']},{events:[R.hiddenEntry.readEvent,R.hiddenEntry.readEvent]},{events:[R.day36.eventId]},{frozen:false}])reject(()=>m.validate({...copy(bases.HIGH),...patch}));
    const keys={...Object.fromEntries(Object.keys(ir.choices).map(k=>[k,'A'])),'ROUTE-01':'friends'};
    const done=m.run(keys,{state:bases.LOW,start:ir.entries[R.storyEntry.routeEntry]}).s;
    reject(()=>m.event(copy(done),R.day36.eventId));reject(()=>m.dispatch(copy(done)));reject(()=>m.ending(copy(done),'MY-E1'));
    reject(()=>m.run({}, {state:bases.LOW,start:ir.entries[R.day36.sharedSource.file]}));
    reject(()=>m.validate({...copy(done),frame:{returnTo:'BAD'}}));reject(()=>m.validate({...copy(done),ending:'MY-E1'}));
    reject(()=>m.validate({...copy(done),epilogue:'后日谈-他们的日子.md'}));
    const future=copy(bases.HIGH);future.choices['MY07-01']='A';reject(()=>m.validate(future));
    const low=copy(bases.LOW);m.choose(low,'ROUTE-01','piao');reject(()=>m.choose(low,'PI03-01','A'));
    const high=copy(bases.HIGH);m.choose(high,'ROUTE-01','piao');reject(()=>m.choose(high,'PI-L06-01','A'));
    report.counts.stateNegatives=rejected;return {rejected,shortCircuit:true};
  });
  check('本批正文、SDK、编译器和U接口输入保护',()=>{
    const before=JSON.parse(fs.readFileSync(path.join(__dirname,'protected-before.json'),'utf8'));
    for(const[f,h]of Object.entries(before))assert.equal(hash(fs.readFileSync(path.join(root,f))),h,'受保护来源变化：'+f);
    return {unchangedFiles:Object.keys(before).length};
  });
  write(path.join(__dirname,'audit-generated'),result);report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);process.exitCode=1;}
fs.writeFileSync(path.join(__dirname,'audit-compiler-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,counts:report.counts}));
