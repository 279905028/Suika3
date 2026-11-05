#!/usr/bin/env node
'use strict';
// 对照变更前源稿，遍历完整路线；只向显式指定的新QA批次写报告。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('./compiler/compile.cjs');
const {parse}=require('./compiler/parse.cjs');
const {model}=require('./compiler/model.cjs');
const root=path.resolve(__dirname,'..');
function verify({qa}){
  assert(/^qa\/[a-z0-9-]+$/.test(qa||''),'须指定本工程QA批次');
  const output=path.join(root,qa,'content-verification.json');assert(!fs.existsSync(output),'不覆盖已有核对证据');
  const current=compile({pageSize:108}),R=current.ir.contract,m=model(current.ir);
  const oldR=JSON.parse(fs.readFileSync(path.join(root,qa,'before/scenario/routes.json')));
  const sources=Object.fromEntries(Object.keys(current.ir.entries).map(f=>[f,fs.readFileSync(path.join(root,qa,'before/scenario',f),'utf8')]));
  const before=parse(oldR,sources,{pageSize:108}),old=model(before);
  const romance=new Set(['XM-E1','ZZ-E1','MY-E1','PI-E1','PI-LE1','HQ-E1']);
  assert.equal(R.epilogues.entryPolicy,'no-ongoing-romance-at-ending');
  assert.deepEqual([...R.epilogues.romanceEndings].sort(),[...romance].sort());
  assert.deepEqual(R.routes,oldR.routes,'不能改变主线结局／选择规则');
  for(const field of ['piaoRelation','hiddenEntry','day36','mengyao','supportingOnly'])assert.deepEqual(R[field],oldR[field],field+'不能改变');
  assert.deepEqual(current.ir.choices,before.choices,'本次不改变选择与选项');
  const allA=Object.fromEntries(Object.keys(current.ir.choices).map(id=>[id,'A']));
  const epFiles=new Set(R.epilogues.rules.filter(r=>r.target).map(r=>r.target.file));
  const narrative=items=>items.map(({line,...p})=>p);
  const bases={},oldBases={};
  for(const relation of ['HIGH','LOW']){
    const answers={...allA};for(const c of R.piaoRelation.choices)answers[c.id]=relation==='HIGH'?'A':'B';
    delete answers['ROUTE-01'];
    const now=m.run(answers,{collect:false}),prior=old.run(answers,{collect:false});
    assert.equal(now.waiting,'ROUTE-01');assert.deepEqual(now.s,prior.s);
    bases[relation]=now.s;oldBases[relation]=prior.s;
  }
  const endings=new Set(),configs=new Map();let total=0,entered=0,skipped=0;
  for(const route of R.routes)for(const relation of ['HIGH','LOW']){
    const ids=Object.values(current.ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
    for(let mask=0;mask<2**ids.length;mask++){
      const answers={'ROUTE-01':route.id,...Object.fromEntries(ids.map((id,i)=>[id,(mask>>i)&1?'B':'A']))};
      const now=m.run(answers,{state:bases[relation],start:current.ir.entries[R.storyEntry.routeEntry]});
      const prior=old.run(answers,{state:oldBases[relation],start:before.entries[oldR.storyEntry.routeEntry]});
      assert.equal(now.s.status,'complete');assert.equal(now.waiting,null);
      const expected=romance.has(now.s.ending)?null:relation==='HIGH'?'后日谈-他们的日子.md':'后日谈-未写完的安排.md';
      assert.equal(now.s.epilogue,expected,route.id+'/'+relation+'/'+mask);
      const main=x=>x.paragraphs.filter(p=>!epFiles.has(p.file));
      assert.deepEqual(main(now),main(prior),'主线正文或顺序改变');
      for(const k of ['choices','score','relation','frozen','events','route','ending','frame'])assert.deepEqual(now.s[k],prior.s[k],k+'改变');
      const extras=now.paragraphs.filter(p=>epFiles.has(p.file));
      if(expected){
        assert(extras.length>0);assert(extras.every(p=>p.file===expected));
        assert.deepEqual(narrative(extras),narrative(prior.paragraphs.filter(p=>epFiles.has(p.file))),'保留入口后日谈正文改变');
        entered++;
      }else{assert.equal(extras.length,0,'恋爱结局读入后日谈正文');skipped++;}
      assert.equal(now.trace.filter(t=>t.op==='call').length,route.id!=='piao'&&relation==='LOW'?1:0);
      assert.equal(now.s.events.includes(R.day36.eventId),relation==='LOW');
      const key=relation+'/'+now.s.ending;
      if(!configs.has(key)){
        const rules=R.epilogues.rules.filter(r=>r.relation===relation&&r.endings.includes(now.s.ending));
        assert.equal(rules.length,1);assert.equal(rules[0].target?.file??null,expected);
        // 即使误从后日谈入口开始，源稿外层条件也应阻止恋爱结局读取任何正文。
        for(const anchor of expected?[]:['EP-HIGH','EP-LOW']){
          const state={...structuredClone(now.s),dispatched:false,epilogue:null,status:'running'};
          const forced=m.run({}, {state,start:anchor});
          if(!expected)assert.equal(forced.paragraphs.length,0,'正文门禁未阻止恋爱结局');
        }
        if(relation==='LOW'&&expected){
          const invalid={...structuredClone(now.s),dispatched:false,epilogue:null,events:now.s.events.filter(e=>e!==R.day36.eventId)};
          assert.throws(()=>m.dispatch(invalid),'LOW后日谈必须有事件');
        }
        configs.set(key,{relation,ending:now.s.ending,epilogue:expected});
      }
      endings.add(now.s.ending);total++;
    }
  }
  assert.equal(total,2818);assert.equal(endings.size,14);assert.equal(configs.size,24);
  const eligible=new Set([...configs.values()].filter(x=>x.epilogue).map(x=>x.ending));assert.equal(eligible.size,8);
  assert.deepEqual(current.artifacts,compile({pageSize:108}).artifacts,'重建不确定');
  const report={status:'pass',date:'2026-11-02',contentBuildId:current.ir.buildId,routeAssignments:total,entered,skipped,endingTypes:14,eligibleEndingTypes:eligible.size,excludedEndingTypes:romance.size,dispatchConfigurations:[...configs.values()],mainNarrativeUnchanged:true,retainedEpilogueNarrativeUnchanged:true,choicesAndEndingRulesUnchanged:true,day36Preserved:true,sourceGuardsVerified:true,deterministic:true,sourceHashes:current.manifest.sourceHashes};
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,routeAssignments:total,entered,skipped,eligibleEndingTypes:eligible.size,excludedEndingTypes:romance.size,contentBuildId:current.ir.buildId}));
  return report;
}
if(require.main===module){try{assert.equal(process.argv[2],'--qa');assert.equal(process.argv.length,4);verify({qa:process.argv[3]});}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={verify};
