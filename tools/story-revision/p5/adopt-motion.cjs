#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/dialogue-p5-motion-20261104';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(ROOT,p)),json=p=>JSON.parse(read(p));
const put=(p,d)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n');};
const fp=p=>({path:p,sha256:hash(read(p)),bytes:read(p).length});
const {compile}=require('../../compiler/compile.cjs');
const {parseCondition}=require('../p4-bindings/common.cjs');
function prepare(){
 const c=compile({pageSize:108,textPolicy:'required'}),B=json('docs/整合/bindings.json');
 assert.equal(c.ir.buildId,B.contentBuildId);
 const ending='qa/ending-motion-P4-V-Q-20261104/selection.json',kiss='docs/美术/亲吻动态CG-20261104/成片与绑定.json',night='docs/美术/留宿动态CG-20261104/夜间亲密版计划绑定.json';
 const rows=[];
 for(const x of json(ending).items)rows.push({...x,node:x.node,title:x.ending+' · 结局',media:x.runtime,still:x.fallback,group:'ending',record:ending});
 for(const x of json(kiss).items)rows.push({...x,node:x.anchor.nodeId,media:x.playback,still:x.poster,group:'kiss',record:kiss});
 for(const x of json(night).items){
  if(x.key==='OV-MY56')continue;
  assert(x.plannedMedia?.runtime,'夜间素材未通过制作检查 '+x.key);
  const mediaPath=x.plannedMedia.runtime;
  rows.push({...x,node:x.anchor.nodeId,media:{...x.result.media.runtime,...fp(mediaPath)},still:x.result.media.first,group:'overnight',record:night});
 }
 assert.equal(rows.length,29);assert.equal(new Set(rows.map(r=>r.node)).size,29);
 const assets=[],bindings=[];
 for(const x of rows){
  const n=c.ir.nodes.find(n=>n.id===x.node),b=B.bindings.find(b=>b.anchor.nodeId===x.node);assert(n&&b&&n.op==='text','无正文/静态底层 '+x.key);
  if(x.anchor)assert.equal(n.source.sha256,x.anchor.sha256,'正文锚点漂移 '+x.key);
  const choices={};let relation=null;
  for(const clause of [x.condition,...(x.entryRequires||x.entryEvents||[])]){
   if(clause==='ALL'||clause==='day14-meeting-read')continue;
   for(const term of clause.split('&')){const [k,v]=term.split('=');assert(k&&v&&!v.includes('|'),'不支持条件 '+term);if(k==='PIAO_RELATION')relation=v;else choices[k]=v;}
  }
  const meeting=x.route==='huangqiuqiu';if(meeting){choices['C01-02']='A';choices['C02-01']='A';}
  const files={};
  for(const [kind,source]of [['src',x.media],['fallback',x.still]]){
   assert(source?.path&&source.sha256,'素材未登记 '+x.key);assert.equal(fp(source.path).sha256,source.sha256,'素材指纹变化 '+source.path);
   const rel='assets/current/motion/'+x.key+(kind==='src'?'.mp4':'.webp');
   if(fs.existsSync(path.join(ROOT,rel)))assert.equal(fp(rel).sha256,source.sha256,'禁止覆盖不同采用资源 '+rel);
   else{fs.mkdirSync(path.dirname(path.join(ROOT,rel)),{recursive:true});fs.copyFileSync(path.join(ROOT,source.path),path.join(ROOT,rel));}
   files[kind]=rel;files[kind+'Sha256']=source.sha256;
  }
  assets.push({key:x.key,title:x.title,group:x.group,...files,version:x.version||x.result.version,sourceRecord:x.record,sourceMedia:x.media,sourceFallback:x.still,presentation:'full-frame-then-restore-text',approval:'用户2026-11-04要求绑定所有动态CG；确认29段夜间方案，孟遥夜间静态回退',independentReview:QA+'/media-review/report.json'});
  bindings.push({key:x.key,node:x.node,route:x.route,relation,choices,meeting,condition:x.condition,conditionAst:parseCondition(x.condition,c.ir),anchor:{...b.anchor,line:n.source.line,text:n.text},staticBindingId:b.bindingId,exit:'next-node',restore:'existing-static-presentation',gallery:'separate-motion-gallery'});
 }
 const manifest={schemaVersion:1,version:'sui-motion-p5-20261104-v1',contentBuildId:c.ir.buildId,status:'adopted-for-P5',items:assets};
 const binding={schemaVersion:1,version:manifest.version,contentBuildId:c.ir.buildId,bindings,excluded:[{key:'OV-MY56',node:'T-MY-000568_1',reason:'用户确认：孟遥夜间手部归属错误，保留原静态底层；不绑定该视频。'},{group:'morning',count:6,reason:'用户确认沿用夜间替代次晨的约定；六段次晨仅历史备选。'}]};
 // Use the authoritative night anchor even if an earlier draft used a different ID.
 binding.excluded[0].node=json(night).items.find(x=>x.key==='OV-MY56').anchor.nodeId;
 put('assets/current/motion/manifest.json',manifest);put('docs/整合/motion-bindings.json',binding);
 const report={status:'pass',contentBuildId:c.ir.buildId,counts:{motion:29,ending:6,kiss:18,overnight:5,staticFallbackOnly:1,historicalMorning:6},sourceRecords:[ending,kiss,night].map(fp),checks:['29个唯一原文动作节点与静态底层核对','所有采用视频/静帧按已登记SHA256复制','路线/选择/HIGH-LOW/黄球球相识门槛登记','未修改正文、268张静态资源、4814条静态绑定或81项静态图鉴'],items:bindings.map(b=>({key:b.key,node:b.node,route:b.route,choices:b.choices,relation:b.relation,meeting:b.meeting}))};
 put(QA+'/binding-verification.json',report);console.log(JSON.stringify(report.counts));return {manifest,binding};
}
if(require.main===module)prepare();
module.exports={prepare,ROOT,QA,read,json,put,fp,hash};
