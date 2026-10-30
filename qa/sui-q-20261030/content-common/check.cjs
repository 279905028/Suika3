#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {compile}=require(path.join(root,'tools/compiler/compile.cjs'));
const {model}=require(path.join(root,'tools/compiler/model.cjs'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const candidate='sui-i02-20261030-v7';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist',candidate,'candidate-manifest.json')));
const report={candidate,layer:'新编译与内容模型的独立规则断言；不是浏览器/原生试玩',status:'running',checks:[],inputs:[],counts:{},cases:[]};
const check=(name,fn)=>{const detail=fn();report.checks.push({name,status:'pass',detail});};
const assign=function*(ids){for(let mask=0;mask<2**ids.length;mask++)yield Object.fromEntries(ids.map((id,i)=>[id,mask>>i&1?'B':'A']));};
try {
  check('冻结源、当前源和候选清单逐字节一致',()=>{
    for(const x of manifest.inputs.filter(x=>x.path.startsWith('scenario/')||x.path.startsWith('tools/compiler/'))){
      const live=fs.readFileSync(path.join(root,x.path)),frozen=fs.readFileSync(path.join(root,'build',candidate,'input',x.path));
      assert.equal(sha(live),x.sha256,x.path);assert.equal(sha(frozen),x.sha256,x.path);
      report.inputs.push({path:x.path,sha256:x.sha256,bytes:live.length});
    }return {files:report.inputs.length};
  });
  const built=compile({pageSize:108}),ir=built.ir,m=model(ir);
  check('重新编译身份与候选一致',()=>{assert.equal(ir.buildId,manifest.contentBuildId);return {buildId:ir.buildId,...built.manifest.counts};});
  const commonIds=Object.values(ir.choices).filter(c=>['第一章-回到毕节.md','第二章-十四天.md'].includes(c.source.file)).map(c=>c.id),bases={};
  check('共通分值、冻结和隐藏路线门禁独立公式穷举',()=>{
    let cases=0,unlocked=0;const relations={HIGH:0,LOW:0},scores={};
    for(const a of assign(commonIds)){
      const got=m.run(a,{collect:false});assert.equal(got.waiting,'ROUTE-01');
      const score=20+['C01-06','C02-08','C02-09'].reduce((sum,k)=>sum+(a[k]==='A'?10:-5),0),rel=score>=35?'HIGH':'LOW';
      assert.equal(got.s.score,score);assert.equal(got.s.relation,rel);assert.equal(got.s.frozen,true);
      const open=a['C01-02']==='A'&&a['C02-01']==='A';
      const available=m.available(got.s,'ROUTE-01').map(x=>x.value);
      assert.equal(available.length,open?6:5);assert.equal(available.includes('huangqiuqiu'),open);assert(!available.includes('yelan'));
      assert.equal(got.s.events.includes('day14-meeting-read'),open);
      assert.equal(Object.hasOwn(got.s.choices,'C02-01'),a['C01-02']==='A');
      assert.equal(Object.hasOwn(got.s.choices,'C02-07'),open);
      assert(!got.s.events.includes('PIAO-PREGNANCY-READ'));
      cases++;if(open)unlocked++;relations[rel]++;scores[score]=(scores[score]||0)+1;bases[rel]??=got.s;
    }
    report.counts.commonAssignments=cases;return {cases,unlocked,relations,scores};
  });
  check('小满、周栀、朋友全部普通/关键选择与双关系展开',()=>{
    const config=[{id:'xiaoman',prefix:'XM',file:'罗小满-练习本.md',keys:['XM07-01','XM08-01']},{id:'zhouzhi',prefix:'ZZ',file:'周栀-十一点四十七分.md',keys:['ZZ06-01','ZZ08-01']},{id:'friends',prefix:'FR',file:'朋友与职业-夜班.md',keys:['FR06-01','FR08-01']}];
    let cases=0,calls=0,returns=0;const coverage=new Set(),summaries=[];
    for(const r of config)for(const rel of ['HIGH','LOW']){
      const ids=Object.values(ir.choices).filter(x=>x.source.file===r.file).map(x=>x.id),summary={route:r.id,relation:rel,cases:0,endings:{},combos:{}};
      assert.equal(ids.length,8);
      for(const a of assign(ids)){
        const got=m.run({...a,'ROUTE-01':r.id},{state:bases[rel],start:ir.entries['第三章-选一条路.md']});
        const combo=r.keys.map(k=>a[k]).join(''),ending=r.prefix+(combo==='AA'?'-E1':'-E2'),ep=rel==='HIGH'?'后日谈-他们的日子.md':'后日谈-未写完的安排.md';
        assert.equal(got.s.status,'complete');assert.equal(got.s.route,r.id);assert.equal(got.s.ending,ending);assert.equal(got.s.epilogue,ep);
        assert.equal(got.s.events.includes('PIAO-PREGNANCY-READ'),rel==='LOW');
        const c=got.trace.filter(t=>t.op==='call'),ret=got.trace.filter(t=>t.op==='return');
        assert.equal(c.length,rel==='LOW'?1:0);assert.equal(ret.length,c.length);if(ret.length)assert.equal(ret[0].returnTo,r.prefix+'-D36-RETURN');
        assert.deepEqual(got.trace.filter(t=>t.op==='ending').map(t=>t.id),[ending]);
        const otherRouteFiles=config.filter(v=>v.id!==r.id).map(v=>v.file);assert(!got.paragraphs.some(p=>otherRouteFiles.includes(p.file)));
        for(const p of got.paragraphs)coverage.add(p.file+':'+p.line);
        if(ending==='FR-E2'){
          const eptext=got.paragraphs.filter(p=>p.file===ep).map(p=>p.text).join('\n');
          if(rel==='HIGH'){assert(eptext.includes('我没有赴一场让大家重新亲近的饭局'));assert(!eptext.includes('毛狼把婚后的第一顿朋友饭约在小店'));}
          else {assert(eptext.includes('那顿饭我没去'));assert(!eptext.includes('后来我碰到他们'));}
        }
        if(!summary.combos[combo])report.cases.push({route:r.id,relation:rel,combination:combo,ending,epilogue:ep,paragraphs:got.paragraphs.length,textSha256:sha(got.paragraphs.map(p=>p.text).join('\n\n'))});
        cases++;summary.cases++;summary.endings[ending]=(summary.endings[ending]||0)+1;summary.combos[combo]=(summary.combos[combo]||0)+1;calls+=c.length;returns+=ret.length;
      }summaries.push(summary);
    }
    report.counts.routeAssignments=cases;report.counts.calls=calls;report.counts.returns=returns;report.coveredSourceLines=[...coverage].sort();return {cases,calls,returns,uniqueSourceParagraphs:coverage.size,summaries};
  });
  check('章首旧选择计数未进入玩家正文',()=>{
    const counts={};for(const file of ['第一章-回到毕节.md','第二章-十四天.md']){
      counts[file]=Object.values(ir.choices).filter(c=>c.source.file===file).length;
      assert(!ir.nodes.some(n=>n.op==='text'&&n.source.file===file&&n.source.line===5));
    }assert.deepEqual(Object.values(counts),[6,9]);return counts;
  });
  report.status='pass';
} catch(e) {report.status='fail';report.error=e.stack;process.exitCode=1;}
fs.writeFileSync(path.join(__dirname,'check-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,counts:report.counts,checks:report.checks.map(x=>({name:x.name,status:x.status})),error:report.error},null,2));
