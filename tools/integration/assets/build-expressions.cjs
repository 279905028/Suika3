#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash}=require('../../compiler/parse.cjs');
const {families,plans}=require('./expressions.cjs');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/dialogue-expressions-20261030';
const BASE='build/sui-i02-20261030-v8/input/';
const VERSION='sui-i01-expressions-20261030-v4';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const fp=p=>({path:p,sha256:hash(fs.readFileSync(path.join(ROOT,p)))});
const put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),JSON.stringify(v,null,2)+'\n');};
function build(){
 assert(!fs.existsSync(path.join(ROOT,QA,'snapshot.json')),'不得覆盖冻结证据');
 const compiled=require('../../compiler/compile.cjs').compile({pageSize:108});
 const M=read(BASE+'assets/current/manifest.json'),B=read(BASE+'docs/整合/bindings.json');
 assert.deepEqual(compiled.manifest.sourceHashes,B.sourceHashes,'正文改变，必须重新审阅表情');
 assert.equal(fp('docs/整合/bindings.json').sha256,fp(BASE+'docs/整合/bindings.json').sha256,'当前绑定不是已审v8，停止以免覆盖其他工作');
 assert.equal(fp('assets/current/manifest.json').sha256,fp(BASE+'assets/current/manifest.json').sha256,'采用清单已变化');
 const assets=new Map(M.assets.map(a=>[a.assetId,a])),nodes=new Map(compiled.ir.nodes.map(n=>[n.id,n]));
 const original=new Map(read('build/sui-i02-20261030-v7/input/docs/整合/bindings.json').bindings.map(b=>[b.anchor.nodeId,b]));
 const familyOf=new Map();
 for(const [key,ids]of Object.entries(families))for(const id of ids){
  assert(!familyOf.has(id),'重复差分族');familyOf.set(id,key);
  const a=assets.get(id),base=assets.get(ids[0]);assert(a?.type==='character'&&a.approval.status==='approved','未批准的立绘 '+id);
  for(const field of ['width','height','alpha','format'])assert.equal(a[field],base[field],id+' 差分画布不一致');
 }
 const rows=Object.entries(plans).flatMap(([file,list])=>list.map(r=>({...r,file,matched:0,changed:0,protected:0})));
 for(const r of rows){assert(r.start<=r.end&&r.reason&&families[r.family].includes(r.assetId));assert(compiled.ir.entries[r.file]);}
 const changes=[],beforeCounts={},afterCounts={};
 for(const b of B.bindings){
  const n=nodes.get(b.anchor.nodeId),before=structuredClone(b.enter.characters);
  b.enter.characters=b.enter.characters.map(p=>{
   beforeCounts[p.assetId]=(beforeCounts[p.assetId]||0)+1;
   const family=familyOf.get(p.assetId),matched=rows.filter(r=>r.file===n.source.file&&r.family===family&&r.start<=n.source.line&&n.source.line<=r.end);
   assert(matched.length<=1,'同人情绪区间重叠 '+n.source.file+':'+n.source.line);
   if(!matched.length)return p;
   const r=matched[0];r.matched++;
   // 原单拍差分/持物/特殊衣装不被连续表情覆盖。
   const protectedShot=original.get(n.id).enter.characters.find(c=>c.assetId===p.assetId&&c.assetId!==families[family][0]);
   if(protectedShot){r.protected++;return p;}
   if(p.assetId===r.assetId)return p;
   r.changed++;
   // 同族画布一致：保留槽位、坐标、缩放、形态，仅改图像及其固定差分标识。
   return {...p,assetId:r.assetId,costume:r.assetId};
  });
  for(const p of b.enter.characters)afterCounts[p.assetId]=(afterCounts[p.assetId]||0)+1;
  b.exit.restore=structuredClone(b.enter);b.exit.restore.cg=null;
  if(JSON.stringify(before)!==JSON.stringify(b.enter.characters))changes.push({nodeId:n.id,source:n.source,text:n.text||n.choice,before,after:b.enter.characters});
 }
 for(const r of rows)assert(r.matched>0,'表情区间无在场同衣装人物 '+JSON.stringify(r));
 const summary={ranges:rows.length,changedNodes:changes.length,changedPortraits:rows.reduce((s,r)=>s+r.changed,0),protectedShots:rows.reduce((s,r)=>s+r.protected,0),beforeCounts,afterCounts};
 const previous=read('qa/dialogue-visual-fix-20261030/snapshot.json'),allowed=new Set(['assets/current/manifest.json','docs/整合/bindings.json']);
 for(const f of previous.files)if(!allowed.has(f.path))assert.equal(fp(f.path).sha256,f.sha256,'受保护输入变动 '+f.path);
 M.version=B.version=VERSION;
 M.scope.description='六线完整演出：明确在场人物连续显示；按正文情绪转折切换同衣装表情；特殊衣装/持物/形态及60CG保持原规则。';B.scope=structuredClone(M.scope);
 put('assets/current/manifest.json',M);B.manifestSha256=fp('assets/current/manifest.json').sha256;put('docs/整合/bindings.json',B);
 put(QA+'/expression-plan.json',{version:VERSION,sourceHashes:B.sourceHashes,families,rows});
 put(QA+'/binding-changes.json',{version:VERSION,summary,changes});
 const files=new Map(previous.files.map(f=>[f.path,allowed.has(f.path)?fp(f.path):f]));
 for(const p of ['tools/integration/assets/expressions.cjs','tools/integration/assets/build-expressions.cjs',QA+'/expression-plan.json',QA+'/binding-changes.json'])files.set(p,fp(p));
 const snapshot={...previous,version:VERSION,scope:M.scope,manifest:fp('assets/current/manifest.json'),bindings:fp('docs/整合/bindings.json'),files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path))};
 put(QA+'/snapshot.json',snapshot);
 const validation=require('../runtime/validate.cjs').validate({root:ROOT,compiled,snapshotPath:QA+'/snapshot.json',mode:'candidate'});
 put(QA+'/interface-check.json',{status:'pass',inputFingerprint:validation.inputFingerprint,bindings:validation.bindingsList.length,assets:validation.assets.length,protectedFiles:previous.files.length-allowed.size,summary});
 console.log(JSON.stringify({version:VERSION,...summary},null,2));
}
if(require.main===module)build();
module.exports={build};
