#!/usr/bin/env node
'use strict';
const C=require('./common.cjs');
const {fs,path,ROOT,BASE,DOC,QA,assert,read,json,write,clone,guards}=C;
const {validate,resourceCatalog}=require('./validate.cjs');
const {validatePack}=require('./package-check.cjs');
const V=require('../p4-bindings/validate.cjs');
const {parse}=require('../../compiler/parse.cjs');
const {compile}=require('../../compiler/compile.cjs');
const {model}=require('../../compiler/model.cjs');
function verify({adopted=false,out=QA+'/verification-candidate.json'}={}){
  assert(!fs.existsSync(path.join(ROOT,out)),'不覆盖验收证据');
  const a=validate({adopted}),ctx=a.ctx,ir=ctx.ir,parent=json(QA+'/parent-context.json');
  const sources=Object.fromEntries(Object.keys(ir.entries).map(f=>[f,read(BASE.replace('/P4-演出与美术','/P3-独立审读-20261103')+'/正文/'+f).toString()]));
  const priorIR=parse(ir.contract,sources,{pageSize:108,textPolicy:'required'}),m=model(ir),prior=model(priorIR);
  const report={task:'P4-07',status:'running',adopted,contentBuildId:ir.buildId,scope:'结构、分支模型、资源指纹和完整演出状态；不是P5运行验收',checks:[],negativeCases:[],warnings:[]};
  const check=(name,fn)=>{fn();report.checks.push({name,status:'pass'});};
  check('确定性双编译',()=>assert.deepEqual(compile({root:adopted?ROOT:path.join(ROOT,QA+'/input'),pageSize:108,textPolicy:'required'}),ctx.generated));
  check('4748段原文/姓名/媒介/条件不变；仅头盔整段移位',()=>{
    const oldNodes=new Map(priorIR.nodes.map(n=>[n.id,n])),oldGuards=guards(priorIR),newGuards=guards(ir);
    for(const n of ir.nodes.filter(n=>n.op==='text')){const p=oldNodes.get(n.id);assert(p);for(const key of ['text','paragraph','textMeta','offset'])assert.deepEqual(n[key],p[key]);assert.equal(newGuards.get(n.id),oldGuards.get(n.id));}
    for(const f of Object.keys(ir.entries)){
      const before=priorIR.nodes.filter(n=>n.source.file===f&&n.op==='text').map(n=>n.id),after=ir.nodes.filter(n=>n.source.file===f&&n.op==='text').map(n=>n.id);
      if(f==='罗小满-练习本.md'){assert.deepEqual(before.filter(i=>i!=='T-XM-000296_1'),after.filter(i=>i!=='T-XM-000296_1'));assert(after.indexOf('T-XM-000296_1')>after.indexOf('T-XM-000302_1'));assert(after.indexOf('T-XM-000296_1')<after.indexOf('T-XM-000710_1'));}else assert.deepEqual(after,before);
      const controls=s=>s.split('\n').map(x=>x.trim()).filter(x=>/^(<!--|\*\*选择 |#### (?:[AB]｜|共同段|结局 )|### (?:罗小满|周栀|孟遥|飘|黄球球|朋友与职业)｜)/.test(x)&&!x.startsWith('<!-- TEXT '));
      assert.deepEqual(controls(read(DOC+'/正文/'+f).toString()),controls(sources[f]));
    }
    assert.equal(ctx.paragraphs.length,4748);assert.deepEqual(ir.contract,json(QA+'/before/scenario/routes.json'));
  });
  check('3018原段来源与4748新段映射闭合',()=>{
    const map=json('qa/dialogue-p3-review-20261103/source-map.json').mappings;const old=new Set(map.flatMap(r=>r.oldIds)),next=map.flatMap(r=>r.newIds);assert.equal(old.size,3018);V.equalSet(next,ctx.paragraphs.map(p=>p.paragraphId),'来源闭合');
  });
  check('七包handoff与81CG唯一锚点',()=>{assert.equal(a.results.length,7);assert(a.results.every(r=>r.handoffReady));assert.equal(a.bindings.length,4814);assert.equal(a.gallery.items.length,81);assert.equal(a.results.reduce((n,r)=>n+r.counts.boundaries,0),654);});
  check('65题134张选项贴图逐字/顺序/值及文件不变',()=>{const r=require('../p4-integration/choices.cjs').compareChoices(ir);assert.equal(r.choices,65);assert.equal(r.options,134);assert.equal(r.regenerated,0);write(QA+(adopted?'/choices-adopted.json':'/choices-candidate.json'),r);});
  const covered=new Set(),cgs=new Set(),endings=new Set(),configs=new Set(),examples={},byParagraph=new Map();
  for(const b of a.bindings)if(b.cgId)byParagraph.set(ctx.byNode.get(b.anchor.nodeId).paragraphId,b.cgId);
  const record=r=>{r.paragraphs.forEach(p=>{covered.add(p.id);if(byParagraph.has(p.id))cgs.add(byParagraph.get(p.id));});};
  check('32768组共通与2818条路线同P3分支结果；全部段落/14结局/81CG可达',()=>{
    const R=ir.contract,answers=Object.fromEntries(Object.keys(ir.choices).map(i=>[i,'A'])),states={},oldStates={};
    for(const relation of ['HIGH','LOW']){const ans={...answers};delete ans['ROUTE-01'];for(const c of R.piaoRelation.choices)ans[c.id]=relation==='HIGH'?'A':'B';states[relation]=m.run(ans,{collect:false}).s;oldStates[relation]=prior.run(ans,{collect:false}).s;}
    let common=0,routes=0;const ids=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id);
    for(let mask=0;mask<2**ids.length;mask++){const ans=Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']));const now=m.run(ans),old=prior.run(ans);assert.deepEqual(now.s,old.s);record(now);common++;}
    for(const route of R.routes)for(const relation of ['HIGH','LOW']){
      const choices=Object.values(ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
      for(let mask=0;mask<2**choices.length;mask++){
        const ans={'ROUTE-01':route.id,...Object.fromEntries(choices.map((id,i)=>[id,(mask>>i)&1?'B':'A']))};const now=m.run(ans,{state:states[relation],start:ir.entries[R.storyEntry.routeEntry]}),old=prior.run(ans,{state:oldStates[relation],start:priorIR.entries[R.storyEntry.routeEntry]});assert.deepEqual(now.s,old.s);record(now);routes++;endings.add(now.s.ending);configs.add(relation+'/'+now.s.ending);
        examples[relation+'/'+now.s.ending]??={relation,route:route.id,ending:now.s.ending,choices:{...states[relation].choices,...ans},epilogue:now.s.epilogue,cg:now.paragraphs.map(p=>byParagraph.get(p.id)).filter(Boolean)};
        if(route.id==='mengyao'){const key=route.keyChoices.map(k=>ans[k]).join('');assert.equal(now.s.ending,key==='AA'?'MY-E1':'MY-E2');}
        if(route.id==='xiaoman'){const p=now.paragraphs.map(p=>p.id);const farewell=ans['XM07-01']==='A'?'T-XM-000300':'T-XM-000302';assert(p.indexOf('T-XM-000296')>p.indexOf(farewell));}
      }
    }
    assert.equal(common,32768);assert.equal(routes,2818);assert.equal(endings.size,14);assert.equal(configs.size,24);V.equalSet([...covered],ctx.paragraphs.map(p=>p.paragraphId),'可达段落');V.equalSet([...cgs],a.gallery.items.map(i=>i.id),'可达CG');
    Object.assign(report,{commonAssignments:common,routeAssignments:routes,endingCount:endings.size,dispatchConfigurations:configs.size,reachableCG:cgs.size,reachableParagraphs:covered.size});
  });
  const byNode=new Map(a.bindings.map(b=>[b.anchor.nodeId,b]));
  check('照片/回忆/形态/远程与CG116清晨专项',()=>{
    for(const id of ['T-PI-000436_1','T-HQ-000342_1'])assert.equal(byNode.get(id).enter.characters.length,0);
    assert.equal(byNode.get('T-HQ-000342_1').cgId,'CG126');assert.equal(byNode.get('T-PI-000436_1').cgId,'CG122');
    assert.equal(byNode.get('T-MY-000508_1').condition,'MY07-01=B');assert.equal(byNode.get('T-MY-000508_1').cgId,'CG120');
    for(const id of ['T-PI-000793_1','T-PI-000794_1','T-PI-000795_1','T-PI-000796_1']){assert.equal(byNode.get(id).enter.background.assetId,'bg-guiyang-bus-stop-evening');assert.equal(byNode.get(id).enter.characters.length,0);}
    assert.equal(byNode.get('T-HQ-000351_1').enter.characters[0].form,'orb');assert.equal(byNode.get('T-HQ-000194_1').enter.characters[0].form,'orb');
    assert.equal(byNode.get('T-ZZ-000240_1').enter.background.assetId,'bg-bijie-slope-street-day-overcast');
    for(const id of ['T-D36-000038_1','T-D36-000039_1','T-D36-000040_1'])assert(!byNode.get(id).enter.characters.some(p=>p.assetId==='piao-seated-base'));
    for(const b of a.bindings){assert.deepEqual(b.exit.restore,{...b.enter,cg:null});if(ctx.byNode.get(b.anchor.nodeId).op==='choice')assert.equal(b.cgId,null);}
  });
  const pack='P4-02-COMMON',original=V.readPackage(DOC+'/packages/'+pack),res=resourceCatalog(ctx,a.catalog);
  const reject=(name,fn)=>{assert.throws(fn,name);report.negativeCases.push({name,status:'rejected'});};
  for(const [name,mutation]of [
    ['旧P3版本头',d=>d.bindings.contentBuildId=parent.input.contentBuildId],['过期输入指纹',d=>d.review.inputFingerprint=parent.input.inputFingerprint],['漏绑定',d=>d.bindings.bindings.pop()],['重复绑定',d=>d.bindings.bindings.push(d.bindings.bindings[0])],['未审段落',d=>d.review.reviews[0].status='pending'],['开放需求',d=>{d.needs.needs[0].status='open';d.needs.needs[0].resolution=null;}],['放宽条件',d=>d.bindings.bindings[0].binding.condition='C01-01=A'],['假锚点',d=>d.bindings.bindings[0].binding.anchor.sha256='0'.repeat(64)],['跨路线',d=>d.bindings.bindings[0].binding.routeIds=['mengyao']],['CG退出残留',d=>{const b=d.bindings.bindings.find(r=>r.binding.cgId).binding;b.exit.restore.cg=b.enter.cg;}],['选择带CG',d=>{const b=d.bindings.bindings.find(r=>ctx.byNode.get(r.nodeId).op==='choice').binding;b.enter.cg=d.bindings.bindings.find(r=>r.binding.cgId).binding.enter.cg;b.cgId='CG001';b.fullView=true;}],['未知资源',d=>d.bindings.bindings[0].binding.enter.background.assetId='missing-art'],['边界待审',d=>d.boundaries.boundaries[0].status='blocked']]){
    const d=clone(original);mutation(d);reject(name,()=>validatePack(ctx,pack,d,{mode:'handoff',resources:res}));
  }
  for(const [name,mutation]of [['CG漏登记',c=>c.cg.pop()],['资源指纹漂移',c=>c.assets[0].runtime.sha256='0'.repeat(64)],['未批准资产',c=>c.assets[0].reviewStatus='pending'],['错误新CG依据',c=>c.cg.at(-1).registrationEvidence=c.cg[0].registrationEvidence]]){const c=clone(a.catalog);mutation(c);reject(name,()=>resourceCatalog(ctx,c));}
  check('历史冻结与来源原件保护',()=>{
    const pre=json(QA+'/preflight.json'),allowed=new Set(pre.mutable);let immutable=0;
    for(const f of pre.files)if(!allowed.has(f.path)){require('./validate.cjs').checkFile(f);immutable++;}
    report.protectedFiles=immutable;
  });
  report.status='pass';write(out,report);write(QA+(adopted?'/p5-paths-adopted.json':'/p5-paths.json'),{contentBuildId:ir.buildId,scope:'P5待运行代表路径；不是已玩结果',paths:Object.values(examples)});
  console.log(JSON.stringify({status:'pass',checks:report.checks.length,negatives:report.negativeCases.length,common:report.commonAssignments,routes:report.routeAssignments,cg:report.reachableCG}));return report;
}
if(require.main===module){const args=process.argv.slice(2),adopted=args.includes('--adopted'),i=args.indexOf('--out');verify({adopted,out:i>=0?args[i+1]:(adopted?QA+'/verification-adopted.json':undefined)});}
module.exports={verify};
