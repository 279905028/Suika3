#!/usr/bin/env node
'use strict';
// 离线声明式合同验证器；不是运行演出适配器，也不生成脚本。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parse,condition,hash}=require('../../compiler/parse.cjs');
const {model}=require('../../compiler/model.cjs');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/sui-i01-20261029';
const read=p=>fs.readFileSync(path.join(ROOT,p)),load=p=>JSON.parse(read(p));
const write=(p,v)=>fs.writeFileSync(path.join(ROOT,p),JSON.stringify(v,null,2)+'\n');
const R=load('scenario/routes.json'),B=load('docs/整合/bindings.json'),M=load('assets/current/manifest.json');
const sources=Object.fromEntries(Object.keys(B.sourceHashes).filter(p=>p.endsWith('.md')).map(p=>[path.basename(p),read(p).toString()]));
const ir=parse(R,sources,{pageSize:B.pageSize}),m=model(ir),nodes=new Map(ir.nodes.map(n=>[n.id,n]));
const endings=R.routes.flatMap(r=>[...r.endings,...r.lowPathEndings||[]]);
function structural(manifest,doc){
 const contract=load('tools/integration/assets/contract.json');
 const shape=(value,schema)=>{assert(value&&typeof value==='object'&&!Array.isArray(value));for(const key of schema.required)assert(Object.hasOwn(value,key),'缺少字段 '+key);for(const[key,v]of Object.entries(value)){assert(schema.properties[key],'未知字段 '+key);const t=schema.properties[key].type;if(t)assert(t==='array'?Array.isArray(v):typeof v===t,'字段类型 '+key);}};
 shape(manifest,contract.manifest);shape(doc,contract.bindings);manifest.records.forEach(r=>shape(r,contract.asset));doc.bindings.forEach(b=>shape(b,contract.binding));
 assert.equal(manifest.schemaVersion,'sui-i01-data-v1');assert.equal(doc.schemaVersion,manifest.schemaVersion);
 assert.equal(doc.pageSize,108);assert.equal(doc.manifest.sha256,hash(read(doc.manifest.path)));
 for(const[p,sha]of Object.entries(doc.sourceHashes))assert.equal(hash(read(p)),sha,'正文变动 '+p);
 const assets=new Map(manifest.records.map(r=>[r.assetId,r]));assert.equal(assets.size,manifest.records.length);
 assert.equal(new Set(doc.bindings.map(b=>b.bindingId)).size,doc.bindings.length);
 const validCG=new Set(load('docs/CG当前选择.json').activeSelectedIds);
 const pages=new Map();
 for(const b of doc.bindings){
  assert(assets.has(b.assetId),'未知资源');const asset=assets.get(b.assetId);
  assert(asset.bindingIds.includes(b.bindingId));assert.equal(b.source.sourceSha256,doc.sourceHashes[b.source.path]);
  const p=ir.nodes.filter(n=>n.paragraph===b.source.paragraphId);
  assert(p.length,'失效锚点');assert.equal(p[0].source.file,path.basename(b.source.path));
  assert.equal(p.map(n=>n.text).join(''),b.source.quote);assert.equal(hash(b.source.quote),b.source.quoteSha256);
  assert.deepEqual(p.map(n=>n.id),b.visiblePageIds);assert.equal(p[0].id,b.enter.cursor);assert.equal(p.at(-1).next,b.exit.lexicalNextCursor);
  assert.equal(b.exit.phase,'before-any-cursor-outside-visible-pages');assert(b.exit.doNotWaitForLexicalSuccessor);
  assert.equal(b.restore.target,'destination-cursor');assert.equal(b.restore.cg,null);assert(b.restore.neverCarryAcrossParagraph);
  assert.deepEqual(b.restore.missingCharacters,[]);assert.deepEqual(b.restore.missingProps,[]);
  assert(b.display.hideAtChoice);assert(b.display.fullViewWithinSameParagraph);
  for(const k of ['x','y','scale','width','height','layer'])assert(Number.isFinite(b.display[k]),'非法坐标');assert(b.display.scale>0);assert.equal(b.display.crop,false);
  assert.deepEqual(b.display.mode,asset.placement.mode);
  b.conditions.requiredExpressions.forEach(e=>condition(e,ir.choices,endings));
  for(const g of b.conditions.entryGates){assert(['route','event','epilogue','sharedEvent'].includes(g.type),'未知门禁');
   if(g.type==='route')assert(R.routes.some(r=>r.id===g.value),'非法路线');
   if(g.type==='event')assert(R.stateContract.events.includes(g.value));
   if(g.type==='epilogue')assert(R.epilogues.rules.some(r=>r.target?.file===g.value));
   if(g.type==='sharedEvent'){assert.equal(g.value,'PIAO-D36');assert.equal(g.relation,'LOW');assert.deepEqual([...g.routes].sort(),R.day36.calls.map(c=>c.routeId).sort());}
  }
  if(b.cgId){assert(validCG.has(b.cgId),'取消/未知CG');assert.equal(asset.type,'cg');assert.equal(b.gallery.unlock,'on-actual-first-visible-frame');assert.equal(b.gallery.registrationUnlocks,false);assert.equal(b.reveal.addsPage,false);}
  for(const id of b.visiblePageIds){if(!pages.has(id))pages.set(id,[]);pages.get(id).push(b);}
 }
 for(const [id,bs]of pages){const slots=bs.map(b=>b.display.slot);assert.equal(new Set(slots).size,slots.length,'同页层冲突 '+id);}
 assert.deepEqual(doc.bindings.filter(b=>b.cgId).map(b=>b.cgId).sort(),[...validCG].sort());
 return pages;
}
function allowed(b,s){
 for(const g of b.conditions.entryGates){
  if(g.type==='route'&&s.route!==g.value)return false;
  if(g.type==='event'&&!s.events.includes(g.value))return false;
  if(g.type==='epilogue'&&s.epilogue!==g.value)return false;
  if(g.type==='sharedEvent'&&(!g.routes.includes(s.route)||s.relation!==g.relation))return false;
 }
 return b.conditions.requiredExpressions.every(e=>m.evaluate(condition(e,ir.choices,endings),s));
}
function resolve(cursor,s,doc=B){
 const n=nodes.get(cursor);assert(n,'未知游标');if(n.op!=='text')return {background:null,characters:[],props:[],cg:null};
 const bs=doc.bindings.filter(b=>b.visiblePageIds.includes(cursor));
 for(const b of bs)assert(allowed(b,s),'到达绑定但状态不符 '+b.bindingId);
 const a=t=>bs.filter(b=>M.records.find(a=>a.assetId===b.assetId).type===t).map(b=>b.assetId);
 return {background:a('background')[0]??null,characters:a('character'),props:a('prop'),cg:a('cg')[0]??null};
}
function run(answers,{state=m.fresh(),start=ir.entry}={}){
 const s=structuredClone(state),visited=new Set(),seen=new Set();let pc=start,calls=0,returns=0;
 while(pc){const n=nodes.get(pc);assert(n);pc=n.next;
 switch(n.op){
 case 'branch':pc=m.evaluate(n.condition,s)?n.next:n.otherwise;break;
 case 'text':{
  visited.add(n.paragraph);for(const b of indexed.get(n.id)||[]){assert(allowed(b,s),b.bindingId+' 在当拍读取未访问/错误条件');hits[b.bindingId]++;seen.add(b.bindingId);witnesses[b.bindingId]??={cursor:n.id,state:structuredClone(s)};}
  break;}
 case 'choice':if(!Object.hasOwn(answers,n.choice))return {s,visited,seen,waiting:n.choice,calls,returns};m.choose(s,n.choice,answers[n.choice]);break;
 case 'anchor':break;case 'freeze':m.freeze(s);break;
 case 'event':m.event(s,n.event);break;
 case 'call':assert(!s.frame);assert.equal(s.route,n.route);assert.equal(s.relation,'LOW');s.frame={returnTo:n.returnTo};pc=n.target;calls++;break;
 case 'return':assert(s.frame);pc=s.frame.returnTo;s.frame=null;m.event(s,R.day36.eventId);returns++;break;
 case 'ending':m.ending(s,n.ending);break;
 case 'epilogue':pc=m.dispatch(s);if(!pc)s.status='complete';break;
 case 'finish':{const i=R.storyEntry.common.indexOf(n.file);if(i>=0)pc=ir.entries[R.storyEntry.common[i+1]||R.storyEntry.routeEntry];else if(n.file===R.storyEntry.routeEntry)pc=ir.entries[R.routes.find(r=>r.id===s.route).file];else{assert(s.ending);assert(!s.frame);if(!s.dispatched)assert.equal(m.dispatch(s),null);s.status='complete';pc=null;}break;}
 default:throw Error('未知操作');
 }}m.validate(s);return {s,visited,seen,calls,returns};
}
const report={status:'running',scope:'I01声明式数据与离线参考状态验证；不是引擎/存档实测',checks:[],counts:{}};
let indexed,hits=Object.fromEntries(B.bindings.map(b=>[b.bindingId,0])),witnesses={};
const check=(name,fn)=>{const result=fn();report.checks.push({name,result,status:'pass'});console.log('PASS '+name);};
try{
check('版本、来源、条件、层冲突及60项图鉴集合',()=>{indexed=structural(M,B);return {bindings:B.bindings.length,sourceFiles:Object.keys(B.sourceHashes).length};});
check('212项导入字节/批准/A11证据与30项参考排除',()=>{
 const proposal=load(QA+'/adoption-proposal.json'),approval=load(QA+'/approval.json');assert.equal(approval.proposalSha256,hash(read(approval.proposalPath)));assert.equal(approval.decision,'approved');assert.deepEqual(M.records.map(r=>r.assetId),approval.assetIds);
 for(const r of M.records){assert.equal(hash(read(r.source.path)),r.source.sha256);assert.equal(hash(read(r.derivativeSource.path)),r.derivativeSource.sha256);assert.equal(hash(read(r.runtime.path)),r.runtime.sha256);assert.equal(r.runtime.sha256,r.derivativeSource.sha256);assert.equal(r.approval.sha256,hash(read(r.approval.path)));assert.equal(r.a11.sha256,hash(read(r.a11.path)));assert.equal(r.runtime.format,'WEBP');assert(r.runtime.webpChunks.includes('VP8L'));}
 assert.equal(M.records.length,212);assert.equal(M.excluded.length,30);assert(!M.records.some(r=>M.excluded.some(e=>e.assetId===r.assetId)));return {adopted:212,excluded:30,bytes:M.records.reduce((n,r)=>n+r.runtime.bytes,0)};
});
const allDefault=Object.fromEntries(Object.keys(ir.choices).filter(k=>k!=='ROUTE-01').map(k=>[k,'A'])),bases={},reps=new Map();
function* assignments(ids){for(let mask=0;mask<2**ids.length;mask++)yield Object.fromEntries(ids.map((id,i)=>[id,mask>>i&1?'B':'A']));}
check('共通全部32768组：当拍条件/门禁，不预读未来答案',()=>{
 const ids=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id);let count=0;
 for(const a of assignments(ids)){const out=run(a);assert.equal(out.waiting,'ROUTE-01');if(out.s.events.includes(R.hiddenEntry.readEvent))bases[out.s.relation]??=out.s;count++;}
 assert.equal(count,32768);report.counts.commonCombinations=count;return count;
});
check('2818条路线：六线/飘HIGH-LOW/后日谈及CG正反覆盖',()=>{
 let count=0,calls=0,returns=0;const commonFiles=new Set(R.storyEntry.common);
 const rows=B.bindings.filter(b=>b.cgId&&!commonFiles.has(path.basename(b.source.path)));
 for(const r of R.routes)for(const relation of ['HIGH','LOW']){
  const ids=Object.values(ir.choices).filter(c=>c.source.file===r.file&&(r.id!=='piao'||(c.id===r.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
  for(const a of assignments(ids)){
   const out=run({...a,'ROUTE-01':r.id},{state:bases[relation],start:ir.entries[R.storyEntry.routeEntry]});assert.equal(out.s.status,'complete');
   for(const b of rows)assert.equal(out.visited.has(b.source.paragraphId),allowed(b,out.s),b.cgId+' 可达性不符');
   const combo=(r.id==='piao'&&relation==='LOW'?[r.lowPathChoice]:r.keyChoices).map(k=>a[k]).join('');
   if(!reps.has(r.id+'/'+relation+'/'+combo))reps.set(r.id+'/'+relation+'/'+combo,out);
   count++;calls+=out.calls;returns+=out.returns;
  }
 }
 assert.equal(count,2818);assert.equal(calls,1280);assert.equal(calls,returns);report.counts.routeExpansions=count;report.counts.sharedCalls=calls;return {count,calls,returns};
});
check('孟遥四组合、黄球球形态、FR-E2及全镜进退/恢复声明',()=>{
 let checks=0;const has=(key,cg)=>reps.get(key).seen.has(B.bindings.find(b=>b.cgId===cg).bindingId);
 for(const relation of ['HIGH','LOW'])for(const combo of ['AA','AB','BA','BB']){
  const k='mengyao/'+relation+'/'+combo;for(const cg of ['CG038','CG039','CG040','CG041']){assert(has(k,cg));checks++;}
  for(const[cg,want]of [['CG044',combo[0]==='A'],['CG104',combo==='AA'],['CG105',combo!=='AA']]){assert.equal(has(k,cg),want);checks++;}
  for(const cg of ['CG078','CG079']){assert(has('huangqiuqiu/'+relation+'/'+combo,cg));checks++;}
  if(combo!=='AA')for(const cg of ['CG095','CG096','CG098','CG099']){assert(!has('friends/'+relation+'/'+combo,cg));checks++;}
 }
 const hqHuman=B.bindings.filter(b=>b.assetId.startsWith('sui-a06-human'));assert(hqHuman.every(b=>b.source.path==='scenario/黄球球-门后.md'&&b.source.lineHint>=511));
 const hqOrb=B.bindings.filter(b=>b.assetId.startsWith('sui-a06-orb'));assert(hqOrb.every(b=>b.source.lineHint<511));
 assert(B.bindings.every(b=>!b.conditions.entryGates.some(g=>g.type==='route'&&g.value==='yelan')));
 // 任意离开镜头页均必须按目标游标重算，不能等待可能跳过的线性下一页。
 for(const b of B.bindings){assert(b.exit.doNotWaitForLexicalSuccessor);assert(b.restore.neverCarryAcrossParagraph);assert(!b.visiblePageIds.includes(b.exit.lexicalNextCursor));checks++;}
 assert(B.bindings.filter(b=>b.cgId).every(b=>b.gallery.global&&!b.gallery.rollbackRelocks&&!b.gallery.registrationUnlocks));return {assertions:checks,humanCues:hqHuman.length,orbCues:hqOrb.length};
});
check('离线状态序列化/跨CG回退与重开按目标页重算',()=>{
 let count=0;for(const b of B.bindings){const w=witnesses[b.bindingId];assert(w,'无见证');const expected=resolve(w.cursor,w.state);assert.deepEqual(resolve(w.cursor,JSON.parse(JSON.stringify(w.state))),expected);for(const cursor of b.visiblePageIds)assert.deepEqual(resolve(cursor,w.state),expected);assert.equal(resolve('ROUTE-01',w.state).cg,null);count++;}
 const c44=B.bindings.find(b=>b.cgId==='CG044'),w=witnesses[c44.bindingId];assert(resolve(w.cursor,w.state).cg);const bad=structuredClone(w.state);bad.choices['MY07-01']='B';assert.throws(()=>resolve(w.cursor,bad));
 assert.deepEqual(resolve(ir.entry,m.fresh()),{background:null,characters:[],props:[],cg:null});
 return {serializedStates:count,scope:'构建期参考状态；不等同真实引擎读档、回退与重开'};
});
check('拒绝未知版本/字段/资产/条件/取消CG/坏锚点/正文指纹与漏恢复',()=>{
 const mutations=[d=>d.schemaVersion='future',d=>d.unrecognized=true,d=>d.bindings[0].unknown=true,d=>d.bindings[0].assetId='missing',d=>d.bindings[0].conditions.requiredExpressions=['UNKNOWN=A'],d=>d.bindings[0].conditions.requiredExpressions=['PIAO_RELATION=MID'],d=>d.bindings[0].cgId='CG049',d=>d.bindings[0].source.paragraphId='missing',d=>d.bindings[0].source.quoteSha256='0'.repeat(64),d=>d.sourceHashes['scenario/routes.json']='0'.repeat(64),d=>d.bindings[0].exit.doNotWaitForLexicalSuccessor=false,d=>d.bindings[0].restore.neverCarryAcrossParagraph=false,d=>d.bindings[0].conditions.entryGates=[{type:'mystery'}],d=>d.bindings.push(structuredClone(d.bindings[0]))];
 for(const mutate of mutations){const d=structuredClone(B);mutate(d);assert.throws(()=>structural(M,d));}
 const cg=B.bindings.find(b=>b.cgId==='CG044'),state={...m.fresh(),route:'mengyao'};assert.throws(()=>allowed(cg,state));
 assert.throws(()=>resolve('unknown',m.fresh()));return {rejected:mutations.length+2};
});
check('每个启用绑定至少可达一次，备用无自动出镜',()=>{const missed=Object.entries(hits).filter(([,n])=>!n);assert.deepEqual(missed,[]);assert(M.records.filter(r=>r.usage.status==='approved-reserve').every(r=>!B.bindings.some(b=>b.assetId===r.assetId)));return {reachable:Object.keys(hits).length,reserves:B.reserves.length};});
check('正文、原件、C/U/E和历史QA受保护输入未改',()=>{const before=load(QA+'/input-before.json');for(const f of before)assert.equal(hash(read(f.path)),f.sha256,f.path);return {unchanged:before.length};});
report.status='pass';report.bindingHits=hits;
}catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;console.error(e.stack);}
write(QA+'/validation.json',report);console.log(JSON.stringify({status:report.status,counts:report.counts}));
