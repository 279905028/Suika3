#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {ROOT,QA,json,put,fp}=require('./build-v2.cjs');
const args=process.argv.slice(2);
assert(args.length===2&&args[0]==='--out','用法：node tools/integration/assets/validate-v2.cjs --out qa/sui-i01-<新批次>');
const OUT=args[1];
assert(/^qa\/sui-i01-[a-z0-9-]+$/.test(OUT)&&OUT!==QA,'检查结果须写入新的I01 QA目录');
for(const name of ['validation.json','preflight-snapshot.json','interface-preflight.json','state-witnesses.json','transition-witnesses.json','snapshot.json'])
 assert(!fs.existsSync(path.join(ROOT,OUT,name)),'禁止覆盖既有检查或冻结：'+OUT+'/'+name);
const {condition}=require('../../compiler/parse.cjs');
const {checkSchema,validate}=require('../runtime/validate.cjs');
const c=require('../../compiler/compile.cjs').compile({pageSize:108}),ir=c.ir,R=ir.contract;
const m=require('../../compiler/model.cjs').model(ir),M=json('assets/current/manifest.json'),B=json('docs/整合/bindings.json');
const nodes=new Map(ir.nodes.map(n=>[n.id,n])),byNode=new Map(B.bindings.map(b=>[b.anchor.nodeId,b]));
const assets=new Map(M.assets.map(a=>[a.assetId,a])),endings=R.routes.flatMap(r=>[...r.endings,...r.lowPathEndings||[]]);
const asts=new Map(B.bindings.map(b=>[b.bindingId,b.condition==='ALL'?[]:condition(b.condition,ir.choices,endings)]));
const report={version:B.version,status:'running',scope:'I01离线条件、逐节点演出及I02正式接口校验；不等同引擎测试',inputs:{manifest:fp('assets/current/manifest.json'),bindings:fp('docs/整合/bindings.json'),validator:fp('tools/integration/assets/validate-v2.cjs')},checks:[],counts:{}};
const witnesses=new Map(),edges=new Map(),cgSeen=new Set();
const stateAssets=s=>[s.background,...s.characters,...s.props,s.cg].filter(Boolean);
const check=(name,fn)=>{const result=fn();report.checks.push({name,status:'pass',result});console.log('PASS '+name);};
function stage(n,s){
 const b=byNode.get(n.id);assert(b,'未绑定等待节点 '+n.id);assert(!b.routeIds.length||b.routeIds.includes(s.route));
 const ast=asts.get(b.bindingId);assert(!ast.length||m.evaluate(ast,s),'当拍条件不符合 '+b.bindingId);
 if(!witnesses.has(b.bindingId)){
   witnesses.set(b.bindingId,{nodeId:n.id,state:structuredClone(s),enter:b.enter,exit:b.exit});
   assert.deepEqual(JSON.parse(JSON.stringify(b.enter)),b.enter,'序列化恢复不一致');
   const expected=structuredClone(b.enter);expected.cg=null;assert.deepEqual(b.exit.restore,expected,'CG退出未回到同场景底层');
 }
 const ids=stateAssets(b.enter).map(p=>p.assetId),bg=b.enter.background?.assetId;
 if(n.op==='choice'){assert.equal(b.cgId,null);assert.equal(b.enter.characters.length,0);assert.equal(b.enter.props.length,0);assert(!s.choices[n.choice],'选择提前提交');}
 if(n.source.file==='黄球球-门后.md'){
   if(n.source.line<509)assert(!ids.some(id=>id.startsWith('sui-a06-human')),'人形提前出现');
   if(n.source.line>=509)assert(!ids.some(id=>id.startsWith('sui-a06-orb')),'55天后退回球形');
 }
 if(bg?.startsWith('bg-zhouzhi-bijie-home-')&&!bg.includes('-door-'))assert.equal(s.choices['ZZ06-01'],'A');
 if(bg?.startsWith('bg-zhouzhi-guiyang-home-')){assert.equal(s.choices['ZZ06-01'],'A');assert.equal(s.choices['ZZ08-01'],'A');}
 if(bg?.startsWith('bg-mengyao-guiyang-home-'))assert.equal(s.choices['MY07-01'],'A');
 if(bg?.startsWith('bg-piao-bijie-room-'))assert.equal(s.relation,'HIGH');
 if(bg?.includes('fr-')||bg?.startsWith('bg-new-netcafe-')||bg?.includes('milk-tea-fr'))assert.equal(s.route,'friends');
 if(n.source.file.startsWith('后日谈')&&s.ending==='FR-E2'){assert.equal(b.enter.background,null,'FR-E2误入现场');assert.equal(b.enter.characters.length,0);assert.equal(b.enter.props.length,0);assert(!b.cgId||b.cgId==='CG100','FR-E2只允许群中婚讯CG100');}
 if(b.cgId){cgSeen.add(b.cgId);assert(b.fullView);assert.equal(b.exit.restore.cg,null);}
 return b;
}
function run(answers,{state=m.fresh(),start=ir.entry}={}){
 const s=structuredClone(state),seen=new Set(),seenCG=new Set();let pc=start,prev=null,calls=0,returns=0;
 while(pc){const n=nodes.get(pc);assert(n);pc=n.next;
 if(['text','choice'].includes(n.op)){
   const b=stage(n,s);seen.add(n.id);if(b.cgId)seenCG.add(b.cgId);
   if(prev){const key=prev.bindingId+'>'+b.bindingId;if(!edges.has(key))edges.set(key,{from:prev.bindingId,to:b.bindingId,fromCG:prev.cgId,toCG:b.cgId,
     sourceRestore:prev.exit.restore,destination:b.enter,rule:'先退上拍CG，再按已到达目标节点完整覆盖；不继承上一条选择或调用的图层'});}
   prev=b;
 }
 switch(n.op){
 case 'branch':pc=m.evaluate(n.condition,s)?n.next:n.otherwise;break;
 case 'text':case 'anchor':break;
 case 'choice':if(!Object.hasOwn(answers,n.choice))return {s,seen,seenCG,waiting:n.choice,calls,returns};m.choose(s,n.choice,answers[n.choice]);break;
 case 'freeze':m.freeze(s);break;case 'event':m.event(s,n.event);break;
 case 'call':assert(!s.frame);assert.equal(s.route,n.route);assert.equal(s.relation,'LOW');s.frame={returnTo:n.returnTo};pc=n.target;calls++;break;
 case 'return':assert(s.frame);pc=s.frame.returnTo;s.frame=null;m.event(s,R.day36.eventId);returns++;break;
 case 'ending':m.ending(s,n.ending);break;
 case 'epilogue':pc=m.dispatch(s);if(!pc)s.status='complete';break;
 case 'finish':{const i=R.storyEntry.common.indexOf(n.file);if(i>=0)pc=ir.entries[R.storyEntry.common[i+1]||R.storyEntry.routeEntry];
   else if(n.file===R.storyEntry.routeEntry)pc=ir.entries[R.routes.find(r=>r.id===s.route).file];
   else{assert(s.ending);assert(!s.frame);if(!s.dispatched)assert.equal(m.dispatch(s),null);s.status='complete';pc=null;}break;}
 default:throw Error('未知op '+n.op);
 }}m.validate(s);return {s,seen,seenCG,calls,returns};
}
function* assignments(ids){for(let mask=0;mask<2**ids.length;mask++)yield Object.fromEntries(ids.map((id,i)=>[id,mask>>i&1?'B':'A']));}
try{
 check('212项批准、A11、原衍生字节、全量节点和场景锚点',()=>{
   const approved=json('qa/sui-i01-20261029/approval.json'),ledger=json(QA+'/adoption-ledger.json');
   assert.equal(approved.decision,'approved');assert.deepEqual(M.assets.map(a=>a.assetId),approved.assetIds);
   assert.equal(fp(approved.proposalPath).sha256,approved.proposalSha256);
   for(const a of ledger.records){assert.equal(fp(a.runtime.path).sha256,a.runtime.sha256);assert.equal(fp(a.derivativeSource.path).sha256,a.runtime.sha256);}
   assert.equal(ledger.excluded.length,30);assert.equal(byNode.size,B.bindings.length);
   assert.deepEqual([...byNode.keys()].sort(),ir.nodes.filter(n=>['text','choice'].includes(n.op)).map(n=>n.id).sort());
   for(const scene of json(QA+'/scene-plan.json').scenes){assert.equal(fp(scene.file).sha256,scene.sourceSha256);for(const end of [scene.first,scene.last]){const n=nodes.get(end.nodeId);assert.equal(n.source.sha256,end.sha256);assert.equal(n.text||n.choice,end.quote);}}
   return {assets:M.assets.length,bindings:B.bindings.length,excluded:30};
 });
 const bases={},reps=new Map();
 check('32768组共通状态：所有等待页当拍评估、不预读未来选择',()=>{
   const ids=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id);let count=0;
   for(const a of assignments(ids)){const out=run(a);assert.equal(out.waiting,'ROUTE-01');if(out.s.events.includes(R.hiddenEntry.readEvent))bases[out.s.relation]??=out.s;count++;}
   report.counts.commonCombinations=count;assert.equal(count,32768);return count;
 });
 check('2818条路线展开、1280次调用返回和六线互斥',()=>{
   let count=0,calls=0,returns=0;
   for(const route of R.routes)for(const relation of ['HIGH','LOW']){
     const ids=Object.values(ir.choices).filter(ch=>ch.source.file===route.file&&(route.id!=='piao'||(ch.id===route.lowPathChoice)===(relation==='LOW'))).map(ch=>ch.id);
     for(const a of assignments(ids)){
       const out=run({...a,'ROUTE-01':route.id},{state:bases[relation],start:ir.entries[R.storyEntry.routeEntry]});assert.equal(out.s.status,'complete');
       const combo=(route.id==='piao'&&relation==='LOW'?[route.lowPathChoice]:route.keyChoices).map(k=>a[k]).join('');
       const key=route.id+'/'+relation+'/'+combo;if(!reps.has(key))reps.set(key,out);
       count++;calls+=out.calls;returns+=out.returns;
     }
   }
   assert.equal(count,2818);assert.equal(calls,1280);assert.equal(returns,calls);Object.assign(report.counts,{routeExpansions:count,sharedCalls:calls});return {count,calls,returns};
 });
 check('60CG正反覆盖、孟遥四组合、全节点见证和跨拍恢复',()=>{
   assert.deepEqual([...cgSeen].sort(),json('docs/CG当前选择.json').activeSelectedIds.sort());
   for(const relation of ['HIGH','LOW'])for(const combo of ['AA','AB','BA','BB']){
     const out=reps.get('mengyao/'+relation+'/'+combo);for(const cg of ['CG038','CG039','CG040','CG041'])assert(out.seenCG.has(cg));
     for(const [cg,want]of [['CG044',combo[0]==='A'],['CG104',combo==='AA'],['CG105',combo!=='AA']])assert.equal(out.seenCG.has(cg),want);
   }
   assert.equal(witnesses.size,B.bindings.length);assert(!R.routes.some(r=>r.id==='yelan'));
   for(const b of B.bindings){const w=witnesses.get(b.bindingId);assert(w);assert.deepEqual(stage(nodes.get(w.nodeId),JSON.parse(JSON.stringify(w.state))).enter,b.enter);}
   const b44=B.bindings.find(b=>b.cgId==='CG044'),bad=structuredClone(witnesses.get(b44.bindingId).state);bad.choices['MY07-01']='B';assert.throws(()=>stage(nodes.get(b44.anchor.nodeId),bad));
   assert.equal(byNode.get(ir.nodes.find(n=>n.op==='text').id).enter.cg,null,'重开不可继承CG');
   return {cg:cgSeen.size,serializedStates:witnesses.size,uniqueTransitions:edges.size};
 });
 check('正式SUI-I-1接口对齐、批准/资源指纹、60图鉴和快照预检',()=>{
   const paths=[...new Set(['docs/整合/interface-v1.json','assets/current/manifest.json','docs/整合/bindings.json',...json(QA+'/protected-inputs.json').map(f=>f.path),...M.assets.map(a=>a.runtimePath)])];
   const snapshot={schemaVersion:'SUI-I-1',version:B.version,scope:M.scope,interfaceSha256:fp('docs/整合/interface-v1.json').sha256,
     manifest:fp('assets/current/manifest.json'),bindings:fp('docs/整合/bindings.json'),files:paths.sort().map(fp),missing:[]};
   put(OUT+'/preflight-snapshot.json',snapshot);
   const v=validate({root:ROOT,compiled:c,snapshotPath:OUT+'/preflight-snapshot.json',mode:'candidate'});
   put(OUT+'/interface-preflight.json',{status:'pass',schemaVersion:'SUI-I-1',inputFingerprint:v.inputFingerprint,complete:v.complete,assets:v.assets.length,bindings:v.bindingsList.length,files:v.files});
   return {schemaVersion:'SUI-I-1',assets:v.assets.length,bindings:v.bindingsList.length,complete:v.complete};
 });
 check('未知版本/字段/资源/条件/坏锚点/CG/缺页/漏恢复负例',()=>{
   const defs=json('docs/整合/interface-v1.json').$defs;
   const structural=d=>{checkSchema(d,defs.bindings,defs,'bindings');assert.equal(d.bindings.length,byNode.size);const ids=new Set();for(const b of d.bindings){assert(!ids.has(b.anchor.nodeId));ids.add(b.anchor.nodeId);const n=nodes.get(b.anchor.nodeId);assert(n);assert.equal(b.anchor.sha256,n.source.sha256);for(const p of stateAssets(b.enter))assert(assets.has(p.assetId));if(b.condition!=='ALL')condition(b.condition,ir.choices,endings);if(b.cgId){assert(json('docs/CG当前选择.json').activeSelectedIds.includes(b.cgId));assert(b.fullView);}assert.equal(b.exit.restore.cg,null);}};
   const mutations=[d=>d.schemaVersion='future',d=>d.unknown=true,d=>d.bindings[0].enter.unknown=true,d=>d.bindings[0].enter.background.assetId='missing',
     d=>d.bindings[0].condition='UNKNOWN=A',d=>d.bindings[0].condition='PIAO_RELATION=MID',d=>d.bindings[0].anchor.nodeId='missing',
     d=>d.bindings[0].anchor.sha256='0'.repeat(64),d=>d.bindings.find(b=>b.cgId).cgId='CG049',d=>d.bindings.find(b=>b.cgId).fullView=false,
     d=>d.bindings[0].exit.at='eventually',d=>delete d.bindings[0].exit.restore,d=>d.bindings.pop(),d=>d.bindings[1].anchor=d.bindings[0].anchor,
     d=>d.bindings[0].exit.restore.cg=d.bindings.find(b=>b.cgId).enter.cg];
   for(const mutate of mutations){const d=structuredClone(B);mutate(d);assert.throws(()=>structural(d));}return {rejected:mutations.length+1};
 });
 check('原件、正文、编译器、GUI、I02工具及历史批准只读保护',()=>{
   const files=json(QA+'/protected-inputs.json');for(const f of files)assert.equal(fp(f.path).sha256,f.sha256,f.path);return {unchanged:files.length};
 });
 report.status='pass';Object.assign(report.counts,{boundNodes:B.bindings.length,CG:cgSeen.size,transitions:edges.size});
 put(OUT+'/state-witnesses.json',[...witnesses].map(([bindingId,w])=>({bindingId,...w})));
 put(OUT+'/transition-witnesses.json',[...edges.values()]);
}catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;console.error(e.stack);}
put(OUT+'/validation.json',report);console.log(JSON.stringify({status:report.status,counts:report.counts}));
