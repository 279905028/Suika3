#!/usr/bin/env node
'use strict';
// Editorial regression checks on the final candidate, separate from engine QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../compiler/compile.cjs'),{model}=require('../compiler/model.cjs');
const {hash}=require('../compiler/parse.cjs'),{textEntries}=require('./verify-p2.cjs');
const {ROOT,DOCS}=require('./build-p2.cjs'),{corrections}=require('./p2-editorial.cjs');
const QA=path.join(ROOT,'qa/dialogue-p2-closeout-20261103');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const generated=compile({root:path.join(QA,'input'),textPolicy:'required',pageSize:108});
const ir=generated.ir,R=ir.contract,m=model(ir);
const entries=Object.keys(ir.entries).flatMap(file=>textEntries(fs.readFileSync(path.join(DOCS,'正文',file),'utf8'),file));
const byId=new Map(entries.map(e=>[e.id,e])),get=id=>{assert(byId.has(id),id);return byId.get(id);};
const id=(code,n)=>`T-${code}-${String(n).padStart(6,'0')}`;
const report={status:'running',scope:'P2候选编辑复核与文本回归；不含P3外部独立审读、演出或引擎运行',contentBuildId:ir.buildId,checks:[]};
function check(name,fn){fn();report.checks.push({name,status:'pass'});}
function scene(code,start,end){
 const rows=entries.filter(e=>e.id.startsWith('T-'+code+'-')),a=rows.findIndex(e=>e.id===id(code,start)),b=rows.findIndex(e=>e.id===id(code,end));
 assert(a>=0&&b>=a,code+'场景范围');return rows.slice(a,b+1);
}
check('前稿保留，既有4745个ID未丢失或换号，变化仅限审定清单',()=>{
 const before=Object.keys(ir.entries).flatMap(file=>textEntries(fs.readFileSync(path.join(QA,'before/docs/修订协作/P2-全稿修订-20261103/正文',file),'utf8'),file));
 const edits=new Map(corrections.corrections.map(c=>[c.id,c]));let changed=0;
 for(const old of before){const now=get(old.id),c=edits.get(old.id);if(c){assert.deepEqual({meta:old.meta,text:old.text},c.expected);assert.deepEqual({meta:now.meta,text:now.text},c.replacement);changed++;}else{assert.deepEqual(now.meta,old.meta);assert.equal(now.text,old.text);}}
 assert.equal(changed,130);assert.equal(before.length,4745);assert.equal(entries.length,4748);
 const oldIds=new Set(before.map(e=>e.id)),added=entries.filter(e=>!oldIds.has(e.id));
 assert.deepEqual(added.map(e=>e.id).sort(),corrections.insertBefore.map(i=>i.entry.meta.id).sort());
 const historic=path.join(QA,'before/qa/dialogue-p2-writing-20261103');
 for(const file of fs.readdirSync(historic)){assert.equal(hash(fs.readFileSync(path.join(historic,file))),hash(fs.readFileSync(path.join(ROOT,'qa/dialogue-p2-writing-20261103',file))),'旧P2报告被覆盖：'+file);}
 report.correctedParagraphs=changed;report.restoredTransitions=added.length;report.correctedNotes=corrections.notes.length;
});
check('黄球球名字直到自报姓名后才显示',()=>{
 const rows=entries.filter(e=>e.file==='第二章-十四天.md'),intro=rows.findIndex(e=>e.id===id('C02',218));assert(intro>=0);
 assert(rows[intro].text.includes('黄球球'));
 const before=rows.slice(0,intro+1).filter(e=>e.meta.speaker==='huangqiuqiu');assert(before.length>=7);
 for(const e of before){assert.equal(e.meta.name,'门内的声音',e.id);assert.equal(e.meta.channel,'offscreen',e.id);}
 for(const e of rows.slice(intro+1).filter(e=>e.meta.speaker==='huangqiuqiu'))assert.equal(e.meta.name,'黄球球',e.id);
});
check('乔哥未介绍前仅显示熟客；介绍后使用乔哥',()=>{
 assert.equal(get(id('ZZ',527)).meta.name,'熟客');
 const rows=entries.filter(e=>e.file==='周栀-十一点四十七分.md'),intro=rows.findIndex(e=>e.id===id('ZZ',52));
 assert(rows[intro].text.includes('叫乔哥的熟客'));
 for(const e of rows.slice(0,intro).filter(e=>e.meta.speaker==='qiaoge'))assert.equal(e.meta.name,'熟客');
 for(const e of rows.slice(intro+1).filter(e=>e.meta.speaker==='qiaoge'))assert.equal(e.meta.name,'乔哥');
});
check('多人场景的回答归属与原稿上下文一致',()=>{
 for(const [code,num,speaker] of [['C01',192,'piao'],['C01',215,'maolang'],['XM',235,'wenwen'],['ZZ',232,'zhouzhi'],['PI',316,'piao'],['PI',317,'wenwen']])assert.equal(get(id(code,num)).meta.speaker,speaker);
 const background=get(id('PI',674));assert.equal(background.meta.speaker,null);assert.equal(background.meta.channel,'none');
});
check('罗小满两场视频与非AA音频通话全段媒介一致',()=>{
 for(const [start,end,channel] of [[757,371,'video'],[802,412,'video'],[828,848,'phone']]){
  const spoken=scene('XM',start,end).filter(e=>e.meta.speaker);assert(spoken.length>=7);
  for(const e of spoken)assert.equal(e.meta.channel,channel,e.id);
 }
});
check('周栀早饭同场、结尾电话与朋友线洗照片场景一致',()=>{
 for(const n of [850,851,853,854,856])assert.equal(get(id('ZZ',n)).meta.channel,'face');
 for(const n of [460,462,463])assert.equal(get(id('ZZ',n)).meta.channel,'phone');
 for(const n of [489,490,491])assert.equal(get(id('FR',n)).meta.channel,'face');
});
check('黄球球隔门交流不伪装现场；她本人没有电话或数字消息',()=>{
 for(const [start,end] of [[410,138],[463,187]])for(const e of scene('HQ',start,end).filter(e=>e.meta.speaker))assert.equal(e.meta.channel,'offscreen',e.id);
 for(const e of entries.filter(e=>e.meta.speaker==='huangqiuqiu'))assert(['offscreen','face'].includes(e.meta.channel),e.id);
 assert.equal(get(id('HQ',569)).meta.channel,'face');assert(get(id('HQ',569)).text.includes('今天你不好过'));
});
check('P0章首计分、离场时间及远程册子说明在候选中闭合',()=>{
 const c1=fs.readFileSync(path.join(DOCS,'正文/第一章-回到毕节.md'),'utf8'),c2=fs.readFileSync(path.join(DOCS,'正文/第二章-十四天.md'),'utf8');
 assert(c1.includes('本章6处选择')&&c1.includes('C01-06记录飘的关系值'));
 assert(c2.includes('本章9处选择')&&c2.includes('C02-08与C02-09分别记录'));
 assert(get(id('ZZ',642)).text.includes('九点四十五'));assert(get(id('ZZ',196)).text.includes('十点前到了'));
 assert(get(id('PI',797)).text.includes('电子图'));
 assert(!get(id('PI',604)).text.includes('周栀'));
});
check('沿用的66条媒介断言重新复核，修正旧报告18条错误预期',()=>{
 const prior=json(path.join(ROOT,'qa/dialogue-p2-writing-20261103/targeted-media-review.json'));
 const video=new Set([368,370,395,400,401,403,404,405,816,818,822,824,410].map(n=>id('XM',n)));
 const face=new Set([850,851,853,854,856].map(n=>id('ZZ',n)));let count=0,updated=0;
 report.mediaAssertions=[];
 for(const row of prior.results)for(const old of row.spoken){
  const channel=video.has(old.id)?'video':face.has(old.id)?'face':row.expectedChannel;
  assert.equal(get(old.id).meta.channel,channel,old.id);count++;if(channel!==row.expectedChannel)updated++;
  report.mediaAssertions.push({id:old.id,oldSourceId:row.oldId,channel,previousExpectation:row.expectedChannel,status:'pass'});
 }
 assert.equal(count,66);assert.equal(updated,18);report.recheckedMediaParagraphs=count;report.correctedPriorMediaExpectations=updated;
});
check('六线关键组合的正文边界、十四结局与单身后日谈',()=>{
 const cases=[],endings=new Set();
 for(const route of R.routes)for(const relation of ['HIGH','LOW']){
  const combos=route.id==='piao'&&relation==='LOW'?['A','B']:['AA','AB','BA','BB'];
  for(const combo of combos){
   const answers=Object.fromEntries(Object.keys(ir.choices).map(k=>[k,'A']));answers['ROUTE-01']=route.id;
   for(const c of R.piaoRelation.choices)answers[c.id]=relation==='HIGH'?'A':'B';
   if(route.id==='piao'&&relation==='LOW')answers[route.lowPathChoice]=combo;else route.keyChoices.forEach((k,i)=>answers[k]=combo[i]);
   const run=m.run(answers),ids=new Set(run.paragraphs.map(p=>p.id));assert.equal(run.s.status,'complete');endings.add(run.s.ending);
   const has=(code,n)=>ids.has(id(code,n));
   if(route.id==='mengyao'){
    assert(has('MY',531),'选择前必须说明婚姻尚未结束');
    assert.equal(has('MY',312),combo==='AA','只有AA实际答应继续秘密关系');
    assert.equal(has('MY',536),combo==='AA');
    assert.equal(has('MY',660),combo==='AB','过夜红笔仅出现在AB的归还物品');
    if(combo[0]==='B')assert(!has('MY',437),'首次已断开者不得读到过夜');
    if(combo==='BA')assert(has('MY',562)&&has('MY',564),'BA必须明确没有回教室，也没有新的条件');
    assert.equal(has('MY',668),combo==='BB');
    assert.equal(has('MY',673),combo!=='AA','所有非AA均收束最后一次私人通话');
    assert.equal(has('MY',372),combo!=='AA');
   }
   if(route.id==='piao'){
    assert.equal(has('PI',601),relation==='LOW');assert.equal(has('PI',832),relation==='HIGH'&&combo[0]==='A');
    if(relation==='LOW'){assert.equal(has('PI',624),combo==='A');assert.equal(has('PI',644),combo==='B');}
   }
   if(route.id==='huangqiuqiu'){
    assert.equal(has('HQ',599),combo==='AA');assert.equal(has('HQ',600),combo==='AA');assert.equal(has('HQ',314),combo!=='AA');
    assert.equal(has('HQ',335),combo==='BA');assert(has('HQ',195),'形态日所有分支均保留');
   }
   if(route.id==='friends'&&combo!=='AA')for(const p of run.paragraphs.filter(p=>/^T-EP[HL]-/.test(p.id))){const e=get(p.id);if(e.meta.speaker)assert.equal(e.meta.channel,'text','FR-E2后日谈不可到现场：'+p.id);}
   if(['XM-E1','ZZ-E1','MY-E1','PI-E1','PI-LE1','HQ-E1'].includes(run.s.ending))assert.equal(run.s.epilogue,null);
   cases.push({route:route.id,relation,combo,ending:run.s.ending,epilogue:run.s.epilogue,status:'pass'});
  }
 }
 assert.equal(cases.length,46);assert.equal(endings.size,14);report.keyCombinationCases=cases;report.distinctEndings=endings.size;
});
check('静态证据与最后候选为同一版本',()=>{
 const staticReport=json(path.join(QA,'static-verification.json'));assert.equal(staticReport.status,'pass');assert.equal(staticReport.contentBuildId,ir.buildId);
 const sourceMap=json(path.join(QA,'source-map.json'));assert.equal(sourceMap.candidateBuildId,ir.buildId);
 assert(sourceMap.mappings.every(row=>row.bindingReview==='pending-p4'&&row.conditionChanged===false));
 report.protectedFormalFiles=staticReport.protectedSourceFiles;
});
report.status='pass';
fs.writeFileSync(path.join(QA,'editorial-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:report.checks.length,correctedParagraphs:report.correctedParagraphs,keyCombinations:report.keyCombinationCases.length,endings:report.distinctEndings,contentBuildId:ir.buildId}));
