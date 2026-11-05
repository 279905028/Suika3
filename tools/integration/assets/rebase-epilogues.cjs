#!/usr/bin/env node
'use strict';
// 后日谈门禁变更：保留全部现行美术，只按稳定正文ID更新条件和版本。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../../compiler/compile.cjs');
const {hash}=require('../../compiler/parse.cjs');
const root=path.resolve(__dirname,'../../..'),qa='qa/epilogue-single-only-20261102';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fp=p=>({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))});
const put=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
function rebase(){
  assert(!fs.existsSync(path.join(root,qa,'snapshot.json')),'不得覆盖本次冻结证据');
  const verified=read(qa+'/content-verification.json'),C=compile({pageSize:108});
  assert.equal(verified.status,'pass');assert.equal(verified.contentBuildId,C.ir.buildId);
  const M=read('assets/current/manifest.json'),B=read('docs/整合/bindings.json');
  for(const p of ['assets/current/manifest.json','docs/整合/bindings.json','system/sui-cinema/manifest.json'])assert.equal(fp(p).sha256,fp(qa+'/before/'+p).sha256,'并行修改，不能覆盖：'+p);
  const original=read(qa+'/before/docs/整合/bindings.json');
  for(const [p,h]of Object.entries(original.sourceHashes))assert.equal(fp(qa+'/before/'+p).sha256,h,'旧绑定与本次前快照不匹配：'+p);
  const nodes=new Map(C.ir.nodes.map(n=>[n.id,n])),guards=new Map();
  const combine=(left,right)=>left.flatMap(a=>right.map(b=>[...a,...b]));
  for(const file of Object.keys(C.ir.entries)){
    const list=C.ir.nodes.filter(n=>n.source.file===file),index=new Map(list.map((n,i)=>[n.id,i]));
    for(let i=0;i<list.length;i++)if(['text','choice'].includes(list[i].op)){
      const parents=list.filter((n,j)=>n.op==='branch'&&j<i&&i<index.get(n.otherwise));
      const dnf=parents.reduce((clauses,n)=>combine(clauses,n.condition),[[]]);
      guards.set(list[i].id,dnf.map(g=>g.map(t=>t.field+t.operator+t.value).join('&')).join('|')||'ALL');
    }
  }
  const removed=[],changed=[];
  B.bindings=B.bindings.filter(b=>{
    const n=nodes.get(b.anchor.nodeId);
    if(!n){
      assert.equal(b.anchor.file,'scenario/后日谈-未写完的安排.md');assert(!b.cgId,'不能移除CG');
      removed.push({nodeId:b.anchor.nodeId,reason:'PI-LE1不再进入后日谈，删除其专属一句对话绑定'});return false;
    }
    assert.equal(n.source.sha256,b.anchor.sha256,'保留正文内容改变：'+b.anchor.nodeId);
    const condition=n.source.file.startsWith('后日谈-')?guards.get(n.id):b.condition;assert(condition);
    if(b.condition!==condition){changed.push({nodeId:n.id,file:n.source.file,before:b.condition,after:condition});b.condition=condition;}
    const old=original.bindings.find(x=>x.anchor.nodeId===n.id);
    for(const k of ['enter','exit','cgId','fullView','routeIds'])assert.deepEqual(b[k],old[k],'不得改变画面：'+n.id+'/'+k);
    return true;
  });
  assert.equal(removed.length,1);assert(changed.every(x=>x.file.startsWith('后日谈-')),'只能改变后日谈条件');
  const ids=new Set(B.bindings.map(b=>b.anchor.nodeId));
  assert.deepEqual([...ids].sort(),C.ir.nodes.filter(n=>['text','choice'].includes(n.op)).map(n=>n.id).sort(),'必须覆盖全部稳定显示节点');
  const version='sui-i01-epilogues-20261102-v6';M.version=B.version=version;
  put('assets/current/manifest.json',M);B.manifestSha256=fp('assets/current/manifest.json').sha256;
  B.contentBuildId=C.ir.buildId;B.sourceHashes=C.manifest.sourceHashes;put('docs/整合/bindings.json',B);
  const UI=read('system/sui-cinema/manifest.json');
  UI.contentBuildId=C.ir.buildId;put('system/sui-cinema/manifest.json',UI);
  // 选项内容没变；只刷新现行UI的正文版本，不重写历史选项素材来源或任何图片。
  const layout=read('assets/sources/20261030-cinema-ui/choice-layout.json');
  for(const c of Object.values(C.ir.choices)){
    const prior=layout.choices.find(x=>x.id===c.id);assert(prior);assert.equal(prior.question,c.question);
    assert.deepEqual(prior.options.map(({action,...o})=>o),c.options);
  }
  for(const a of M.assets){assert.equal(fp(a.sourcePath).sha256,a.sourceSha256);assert.equal(fp(a.runtimePath).sha256,a.runtimeSha256);}
  const prior=read('qa/portrait-gap-fill-20261030/snapshot.json');
  const allowed=new Set(['assets/current/manifest.json','docs/整合/bindings.json',...Object.keys(C.manifest.sourceHashes)]);
  const files=new Map();
  for(const f of prior.files){if(!allowed.has(f.path))assert.equal(fp(f.path).sha256,f.sha256,'受保护输入改变：'+f.path);files.set(f.path,allowed.has(f.path)?fp(f.path):f);}
  const report={status:'pass',version,contentBuildId:C.ir.buildId,bindings:B.bindings.length,assets:M.assets.length,removed,changedConditions:changed,allRetainedStageStatesIdentical:true,allImageBytesIdentical:true,choiceImagesUnchanged:true};
  put(qa+'/binding-rebase.json',report);
  for(const p of ['system/sui-cinema/manifest.json','assets/sources/20261030-cinema-ui/choice-layout.json','tools/integration/assets/rebase-epilogues.cjs','tools/verify-epilogues.cjs',qa+'/content-verification.json',qa+'/binding-rebase.json'])files.set(p,fp(p));
  put(qa+'/snapshot.json',{...prior,version,manifest:fp('assets/current/manifest.json'),bindings:fp('docs/整合/bindings.json'),files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path))});
  const checked=require('../runtime/validate.cjs').validate({root,compiled:C,snapshotPath:qa+'/snapshot.json',mode:'candidate'});
  put(qa+'/interface-check.json',{status:'pass',assets:checked.assets.length,bindings:checked.bindingsList.length,files:checked.files.length,inputFingerprint:checked.inputFingerprint});
  console.log(JSON.stringify({status:'pass',assets:M.assets.length,bindings:B.bindings.length,removed:removed.length,changedConditions:changed.length}));
}
if(require.main===module){try{rebase();}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={rebase};
