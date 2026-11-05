#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {json,put,QA}=require('./adopt-motion.cjs');
const {compile}=require('../../compiler/compile.cjs'),{model}=require('../../compiler/model.cjs');
const ir=compile({pageSize:108,textPolicy:'required'}).ir,m=model(ir),R=ir.contract;
const motion=json('docs/整合/motion-bindings.json').bindings,staticB=json('docs/整合/bindings.json').bindings;
const initial=json('qa/dialogue-p4-P4-07-20261104/p5-paths-adopted.json').paths;
const byParagraph=new Map(ir.nodes.filter(n=>n.op==='text').map(n=>[n.id,n.paragraph]));
const targets=new Map([...staticB.filter(b=>b.cgId).map(b=>[b.cgId,byParagraph.get(b.anchor.nodeId)]),...motion.map(b=>[b.key,byParagraph.get(b.node)])]);
const seen=new Set(),paragraphs=new Set(),endings=new Set(),witnesses=new Map(),paths=[];
function record(result,answers,extra=false){const pages=new Set(result.paragraphs.map(p=>p.id));result.paragraphs.forEach(p=>paragraphs.add(p.id));if(result.s.ending)endings.add(result.s.ending);const covered=[...targets].filter(([,p])=>pages.has(p)).map(([k])=>k);for(const key of covered){if(!witnesses.has(key))witnesses.set(key,{answers,state:result.s});}if(extra&&covered.every(k=>seen.has(k)))return;covered.forEach(k=>seen.add(k));if(extra)paths.push({name:'coverage-'+String(paths.length+1).padStart(2,'0')+'-'+result.s.route+'-'+result.s.ending,route:result.s.route,relation:result.s.relation,ending:result.s.ending,choices:answers,covers:covered});}
for(const p of initial)record(m.run(p.choices),p.choices);
const initiallyMissing=[...targets.keys()].filter(k=>!seen.has(k));let commonCount=0,routeCount=0;
const answers=Object.fromEntries(Object.keys(ir.choices).map(k=>[k,'A'])),states={};
for(const relation of ['HIGH','LOW']){const a={...answers};delete a['ROUTE-01'];for(const c of R.piaoRelation.choices)a[c.id]=relation==='HIGH'?'A':'B';states[relation]=m.run(a,{collect:false}).s;}
const ids=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id);
for(let mask=0;mask<2**ids.length;mask++){const a=Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']));record(m.run(a),a);commonCount++;}
for(const route of R.routes)for(const relation of ['HIGH','LOW']){
 const ids=Object.values(ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
 for(let mask=0;mask<2**ids.length;mask++){
  const a={'ROUTE-01':route.id,...Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']))};
  const result=m.run(a,{state:states[relation],start:ir.entries[R.storyEntry.routeEntry]});routeCount++;
  record(result,{...states[relation].choices,...a},true);
 }
}
assert.equal(commonCount,32768);assert.equal(routeCount,2818);assert.equal(endings.size,14);assert.equal(seen.size,110);assert.equal(paragraphs.size,4748);
const rejected=[];
const eligible=(b,s,node)=>node===b.node&&b.route===s.route&&(!b.relation||b.relation===s.relation)&&Object.entries(b.choices).every(([k,v])=>s.choices[k]===v)&&(!b.meeting||s.events.includes(R.hiddenEntry.readEvent))&&(!b.conditionAst.length||m.evaluate(b.conditionAst,s));
for(const b of motion){
 const s=witnesses.get(b.key).state;assert(eligible(b,s,b.node),'正例条件错误 '+b.key);
 const deny=(name,state,node=b.node)=>{assert(!eligible(b,state,node),name);rejected.push({key:b.key,name});};
 deny('错误节点',s,'T-C01-000001_1');deny('错误路线',{...s,route:'friends'});
 if(b.relation)deny('错误HIGH/LOW',{...s,relation:b.relation==='HIGH'?'LOW':'HIGH'});
 for(const k of Object.keys(b.choices)){deny('改选 '+k,{...s,choices:{...s.choices,[k]:b.choices[k]==='A'?'B':'A'}});const choices={...s.choices};delete choices[k];deny('未访问 '+k,{...s,choices});}
 if(b.meeting)deny('未读相识事件',{...s,events:s.events.filter(e=>e!==R.hiddenEntry.readEvent)});
}
put(QA+'/coverage-model.json',{status:'pass',scope:'当前正文模型穷举与条件拒绝；不是浏览器实玩',contentBuildId:ir.buildId,commonCount,routeCount,paragraphs:paragraphs.size,endings:[...endings],staticCG:81,motionCG:29,initiallyMissing,additionalPaths:paths.length,negativeCases:rejected});
put(QA+'/additional-paths.json',{contentBuildId:ir.buildId,paths});console.log(JSON.stringify({commonCount,routeCount,initiallyMissing,additionalPaths:paths.length,negativeCases:rejected.length}));
