#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../compiler/compile.cjs'),{parse,hash}=require('../compiler/parse.cjs'),{model}=require('../compiler/model.cjs');
const {ROOT,QA}=require('./build-p1.cjs');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function verify(attempt='preview-v2'){
 const base=path.join(ROOT,QA,attempt),report={status:'running',attempt,checks:[]},out=path.join(base,'static-verification.json');assert(!fs.existsSync(out));
 const generated=compile({root:path.join(base,'input'),textPolicy:'mixed',pageSize:108}),ir=generated.ir,R=ir.contract;
 const baseline=compile({pageSize:108}),old=baseline.ir,m=model(ir),prior=model(old);
 const check=(name,fn)=>{fn();report.checks.push({name,status:'pass'});};
 check('确定性重建',()=>assert.deepEqual(generated.artifacts,compile({root:path.join(base,'input'),textPolicy:'mixed',pageSize:108}).artifacts));
 check('468段元数据与来源覆盖',()=>{
  const samples=json(path.join(base,'samples.json')),ids=samples.samples.flatMap(s=>s.ids),nodes=ir.nodes.filter(n=>n.textMeta);
  assert.deepEqual(nodes.map(n=>n.paragraph).sort(),ids.sort());
  for(const n of nodes){assert.equal(n.id,n.paragraph+'_1');assert.equal(n.offset,0);assert(!n.textMeta.name.includes('丈夫'));}
 });
 check('控制契约、原稿与资源未被采用小样覆盖',()=>{
  assert.deepEqual(ir.contract,old.contract);
  const before=json(path.join(base,'input-manifest.json')).inputs;
  for(const e of before.filter(e=>e.path.startsWith('scenario/')||e.path.startsWith('assets/')||e.path==='docs/整合/bindings.json'))assert.equal(hash(fs.readFileSync(path.join(ROOT,e.path))),e.sha256,e.path);
 });
 const sources=Object.fromEntries(Object.keys(ir.entries).map(f=>[f,fs.readFileSync(path.join(base,'input/scenario',f),'utf8')]));
 const file=R.storyEntry.common[0],original=sources[file],first=original.match(/^<!-- TEXT (.+) -->$/m)[0],meta=JSON.parse(first.slice(10,-4));
 let rejected=0;
 const reject=(name,mutate)=>check('拒绝：'+name,()=>{assert.throws(()=>parse(R,{...sources,[file]:mutate(original)},{pageSize:108,textPolicy:'mixed'}));rejected++;});
 const changed=(d)=>s=>s.replace(first,'<!-- TEXT '+JSON.stringify({...meta,...d})+' -->');
 reject('未知字段',changed({unexpected:1}));reject('缺字段',s=>s.replace(first,'<!-- TEXT '+JSON.stringify({id:meta.id})+' -->'));
 reject('重复字段',s=>s.replace(first,first.replace('{','{"kind":"dialogue",')));
 reject('转义重复字段',s=>s.replace(first,first.replace('{','{"k\\u0069nd":"dialogue",')));
 reject('坏JSON',s=>s.replace(first,first.replace('"kind"',"'kind'")));
 reject('坏ID',changed({id:'TEXT_old'}));reject('跨文件ID',changed({id:'T-MY-000001'}));
 reject('重复ID',s=>s.replace('"T-C01-000243"','"'+meta.id+'"'));
 reject('未知speaker',changed({kind:'dialogue',channel:'face',speaker:'invented',name:'甲'}));
 reject('越界称呼',changed({kind:'dialogue',channel:'face',speaker:'mengyao',name:'陈晟的妻子'}));
 reject('非法媒介',changed({channel:'phone'}));reject('旁白挂名',changed({speaker:'wenwen',name:'文文'}));
 reject('他人心声',changed({kind:'thought',speaker:'mengyao',name:'孟遥',channel:'inner'}));
 reject('组跨条件',s=>s.replaceAll('"group":null','"group":"G-C01-000001"'));
 for(const value of ['','### 分场','<!-- IF C01-01=A -->','**选择 C01-01｜问？**','<!-- TEXT '+JSON.stringify(meta)+' -->'])reject('标记跨段或边界：'+value.slice(0,16),s=>s.replace(first+'\n',first+'\n'+value+'\n'));
 reject('正文跨行',s=>s.replace('银行的电话打到第三遍时，我的箱子轮子掉了。','银行的电话打到第三遍时，\n我的箱子轮子掉了。'));
 reject('标记跨编辑导航',s=>s.replace(first+'\n',first+'\n[导航](下一页.md)\n'));
 check('legacy拒绝TEXT、required拒绝未迁移正文',()=>{assert.throws(()=>parse(R,sources));assert.throws(()=>parse(R,sources,{textPolicy:'required'}));});
 check('完整required格式可用且不猜旧说话人',()=>{
  const legacy=old.nodes.filter(n=>n.op==='text');assert(legacy.every(n=>!n.textMeta));
  const full={};for(const[f,source]of Object.entries(sources)){
   const lines=source.split('\n'),byLine=new Map(ir.nodes.filter(n=>n.op==='text'&&n.source.file===f&&n.offset===0&&!n.textMeta).map(n=>[n.source.line,n]));
   let serial=800000;const code=require('../compiler/text.cjs').fileCodes(R)[f];
   full[f]=lines.flatMap((l,i)=>byLine.has(i+1)?['<!-- TEXT '+JSON.stringify({id:`T-${code}-${serial++}`,kind:'narration',speaker:null,name:'',channel:'none',group:null})+' -->',l]:[l]).join('\n');
  }
  assert(parse(R,full,{textPolicy:'required'}).nodes.filter(n=>n.op==='text').every(n=>n.textMeta));
 });
 check('分页保持字素、姓名、稳定ID及页内位置',()=>{
  const small=parse(R,sources,{textPolicy:'mixed',pageSize:32});let splits=0;
  for(const n of ir.nodes.filter(n=>n.textMeta)){
   const pages=small.nodes.filter(p=>p.paragraph===n.paragraph);assert.equal(pages.map(p=>p.text).join(''),n.text);
   pages.forEach((p,i)=>{assert.equal(p.offset,i*32);assert.equal(p.id,n.paragraph+'_'+(i+1));assert.deepEqual(p.textMeta,n.textMeta);});
   if(pages.length>1&&n.textMeta.kind==='dialogue')splits++;
  }assert(splits>0);report.splitDialogueParagraphs=splits;
 });
 check('metadata与分页策略进入版本身份',()=>{
  const alternate=compile({root:path.join(base,'input'),textPolicy:'mixed',pageSize:32});assert.notEqual(alternate.ir.buildId,ir.buildId);assert(generated.manifest.compilerHashes['tools/compiler/speakers.json']);assert(generated.manifest.compilerHashes['tools/compiler/text-format.json']);
 });
 check('2818条路线及24种分派与旧规则完全一致',()=>{
  const answers=Object.fromEntries(Object.keys(ir.choices).map(id=>[id,'A'])),states={},oldStates={};
  for(const relation of ['HIGH','LOW']){const a={...answers};delete a['ROUTE-01'];for(const c of R.piaoRelation.choices)a[c.id]=relation==='HIGH'?'A':'B';states[relation]=m.run(a,{collect:false}).s;oldStates[relation]=prior.run(a,{collect:false}).s;}
  let count=0;const configs=new Set(),covered=new Set();
  for(const route of R.routes)for(const relation of ['HIGH','LOW']){
   const ids=Object.values(ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
   for(let mask=0;mask<2**ids.length;mask++){
    const a={'ROUTE-01':route.id,...Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']))};
    const now=m.run(a,{state:states[relation],start:ir.entries[R.storyEntry.routeEntry]}),was=prior.run(a,{state:oldStates[relation],start:old.entries[R.storyEntry.routeEntry]});
    assert.deepEqual(now.s,was.s);assert.deepEqual(now.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]),was.trace.filter(t=>t.op==='choice').map(t=>[t.id,t.value]));
    now.paragraphs.forEach(p=>covered.add(p.id));configs.add(relation+'/'+now.s.ending);count++;
   }
  }assert.equal(count,2818);assert.equal(configs.size,24);report.routeAssignments=count;report.dispatchConfigurations=configs.size;
  for(const n of ir.nodes.filter(n=>n.textMeta&&!n.paragraph.startsWith('T-C01-')))assert(covered.has(n.paragraph),'不可达小样段：'+n.id);
 });
 report.negativeCases=rejected;report.contentBuildId=ir.buildId;report.status='pass';fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,negativeCases:rejected,routes:2818}));
}
if(require.main===module)verify(process.argv[2]);module.exports={verify};
