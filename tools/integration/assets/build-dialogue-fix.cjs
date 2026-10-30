#!/usr/bin/env node
'use strict';
// Explicit, source-locked portrait continuity. Never infer attendance at runtime.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash}=require('../../compiler/parse.cjs');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/dialogue-visual-fix-20261030';
const BASE='build/sui-i02-20261030-v7/input/';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const fp=p=>({path:p,sha256:hash(fs.readFileSync(path.join(ROOT,p)))});
const put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),JSON.stringify(v,null,2)+'\n');};
function person(id){
 for(const [prefix,key] of [['char-xiaoman-','xiaoman'],['char-zhouzhi-','zhouzhi'],['char-mengyao-','mengyao'],['piao-','piao'],['sui-a06-','huangqiuqiu'],['maolang-','maolang'],['shijiang-','shijiang'],['yelan-','yelan'],['chensheng-','chensheng']])if(id.startsWith(prefix))return key;
 throw Error('未登记角色 '+id);
}
function build(){
 assert(!fs.existsSync(path.join(ROOT,QA,'snapshot.json')),'禁止覆盖本批冻结证据');
 const compiled=require('../../compiler/compile.cjs').compile({pageSize:108});
 const M=read(BASE+'assets/current/manifest.json'),B=read(BASE+'docs/整合/bindings.json');
 assert.deepEqual(compiled.manifest.sourceHashes,B.sourceHashes,'正文变化，须复核在场区间');
 const plans={...require('./portraits-common.cjs'),...require('./portraits-other.cjs'),...require('./portraits-special.cjs')};
 assert.deepEqual(Object.keys(plans).sort(),Object.keys(compiled.ir.entries).sort(),'必须逐文件审阅全部正文');
 const nodes=new Map(compiled.ir.nodes.map(n=>[n.id,n]));
 const assets=new Map(M.assets.map(a=>[a.assetId,a]));
 const ledger=new Map(read('qa/sui-i01-20261030/adoption-ledger.json').records.map(a=>[a.assetId,a]));
 for(const [file,ranges]of Object.entries(plans))for(const [start,end,id,note]of ranges){
  assert(Number.isInteger(start)&&end>=start&&note,'区间缺审阅说明');assert.equal(assets.get(id)?.type,'character',id);
  assert(compiled.ir.nodes.some(n=>n.source.file===file&&n.source.line>=start&&n.source.line<=end&&['text','choice'].includes(n.op)),file+':'+start+' 空区间');
 }
 const changed=[],summary={before:{portraitNodes:0,emptyStages:0},after:{portraitNodes:0,emptyStages:0},byFile:{}};
 function place(id,layer,center){const a=assets.get(id),old=ledger.get(id).placement;return {assetId:id,layer,x:Math.round(center-a.width*old.scale/2),y:Math.round(old.y),scale:old.scale,form:ledger.get(id).usage.form,costume:id};}
 for(const b of B.bindings){
  const n=nodes.get(b.anchor.nodeId),before=structuredClone(b.enter),ranges=plans[n.source.file].filter(([s,e])=>n.source.line>=s&&n.source.line<=e);
  if(before.characters.length)summary.before.portraitNodes++;
  if(!before.background&&!before.cg&&!before.characters.length&&!before.props.length)summary.before.emptyStages++;
  const chars=new Map();for(const [, , id]of ranges){const who=person(id);assert(!chars.has(who),'同人区间重叠 '+n.id+' '+who);chars.set(who,id);}
  // Existing approved close-ups retain expression, costume and exact timing.
  for(const p of before.characters)chars.set(person(p.assetId),p.assetId);
  assert(chars.size<=3,'人物槽超过3个 '+n.source.file+':'+n.source.line);
  const ids=[...chars.values()],slots=ids.length===1?['center']:ids.length===2?['left','right']:['left','center','right'];
  const centers=ids.length===1?[640]:ids.length===2?[360,920]:[260,640,1020];
  b.enter.characters=ids.map((id,i)=>place(id,slots[i],centers[i]));
  b.exit.restore=structuredClone(b.enter);b.exit.restore.cg=null;
  b.restrictions=b.restrictions.filter(s=>!s.startsWith('人物/道具只在已审单拍')&&!s.startsWith('选择等待保留背景'));
  b.restrictions.push('人物按本批逐文件审阅的明确在场区间持续显示；选择保持在场人物，既有单拍差分优先；远程、离场、门外和跨日不继承人物',
   '无明确地点的段落使用UI雨窗阅读底图，不指定新场所；CG退出和读档仍完整重建目标节点');
  if(b.enter.characters.length)summary.after.portraitNodes++;
  // UI fallback exists even when the narrative location is intentionally null.
  if(JSON.stringify(before.characters)!==JSON.stringify(b.enter.characters))changed.push({nodeId:n.id,source:n.source,text:n.text||n.choice,before:before.characters,after:b.enter.characters,reasons:ranges.map(r=>r[3])});
  summary.byFile[n.source.file]??={nodes:0,portraitNodes:0,ranges:plans[n.source.file].length};
  summary.byFile[n.source.file].nodes++;if(b.enter.characters.length)summary.byFile[n.source.file].portraitNodes++;
 }
 const version='sui-i01-dialogue-20261030-v3';M.version=B.version=version;
 M.scope.description='六线完整节点演出：显式在场人物连续显示、选择保留人物、60CG单拍进退；未明场所使用UI雨窗阅读底图。';B.scope=structuredClone(M.scope);
 for(const a of M.assets)a.restrictions=a.restrictions.map(s=>s.startsWith('批准备用，本版不显示')?'批准资源按本版明确节点绑定采用；未使用者继续备用':s);
 put('assets/current/manifest.json',M);B.manifestSha256=fp('assets/current/manifest.json').sha256;put('docs/整合/bindings.json',B);
 put(QA+'/portrait-plan.json',{version,sourceHashes:B.sourceHashes,plans});
 put(QA+'/binding-changes.json',{version,summary,changed});
 const previous=read('qa/sui-i01-closeout-20261030/snapshot.json');
 const allowed=new Set(['assets/current/manifest.json','docs/整合/bindings.json']);
 for(const f of previous.files)if(!allowed.has(f.path))assert.equal(fp(f.path).sha256,f.sha256,'受保护输入变化 '+f.path);
 const files=new Map(previous.files.map(f=>[f.path,allowed.has(f.path)?fp(f.path):f]));
 for(const p of ['tools/integration/assets/build-dialogue-fix.cjs','tools/integration/assets/portraits-common.cjs','tools/integration/assets/portraits-other.cjs','tools/integration/assets/portraits-special.cjs','tools/integration/runtime/presentation-full.cjs','tools/integration/runtime/presentation-full.ray',QA+'/portrait-plan.json',QA+'/binding-changes.json'])files.set(p,fp(p));
 const snapshot={schemaVersion:'SUI-I-1',version,scope:M.scope,interfaceSha256:fp('docs/整合/interface-v1.json').sha256,manifest:fp('assets/current/manifest.json'),bindings:fp('docs/整合/bindings.json'),files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),missing:[]};
 put(QA+'/snapshot.json',snapshot);
 const result=require('../runtime/validate.cjs').validate({root:ROOT,compiled,snapshotPath:QA+'/snapshot.json',mode:'candidate'});
 put(QA+'/interface-check.json',{status:'pass',inputFingerprint:result.inputFingerprint,bindings:result.bindingsList.length,assets:result.assets.length,protectedFiles:previous.files.length-allowed.size,summary});
 console.log(JSON.stringify(summary,null,2));
}
if(require.main===module)build();
module.exports={build,person};
