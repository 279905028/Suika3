#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../compiler/compile.cjs'),{hash}=require('../compiler/parse.cjs');
const {applyEditorial,corrections}=require('./p2-editorial.cjs');
const ROOT=path.resolve(__dirname,'../..'),QA=path.join(ROOT,'qa/dialogue-p2-writing-20261103'),DOCS=path.join(ROOT,'docs/修订协作/P2-全稿修订-20261103');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');};
const registry=read('qa/dialogue-p0-20261102/paragraph-registry.json'),p1Sources=read('qa/dialogue-p1-writing-20261102/source-paragraphs.json'),p1Map=read('qa/dialogue-p1-writing-20261102/source-map.json');
const sourceById=new Map(registry.paragraphs.map(p=>[p.id,p]));
function silentKind(text){
 if(/(?:我想|我想说|我觉得|我想起|我才知道|我这才知道|我没敢|我不敢|我记得|我记起|我明白|我不明白|我忽然|突然明白|没分清|不知道|我不知道|我希望|我后悔|有点后悔|心里|念头|想象中|像要|像在等)/.test(text))return 'narration';
 return 'action';
}
function build({outputDir=QA}={}){
 const report={status:'building',baselineFingerprint:registry.baselineFingerprint,sourceBuildId:registry.contentBuildId,files:[],mappings:[],warnings:[],unresolvedQuotes:[]};
 const input=path.join(outputDir,'input'),candidates=path.join(DOCS,'正文');
 const revisionFiles=fs.existsSync(path.join(__dirname,'p2-revisions'))?fs.readdirSync(path.join(__dirname,'p2-revisions')).filter(f=>f.endsWith('.cjs')&&f!=='helpers.cjs'):[];
 const modules=new Map();
 for(const f of revisionFiles){
  const m=require(path.join(__dirname,'p2-revisions',f));assert(m.file,'修订模块缺文件名：'+f);
  const target=modules.get(m.file)||{file:m.file,quotes:{},edits:{},after:{},lineEdits:{},keepNarration:[],reasons:{},insertReasons:{}};modules.set(m.file,target);
  for(const key of ['quotes','edits','after','lineEdits','reasons','insertReasons'])for(const [id,value] of Object.entries(m[key]||{})){assert(!(id in target[key]),'同文件修订键重复：'+m.file+'／'+key+'／'+id);target[key][id]=value;}
  target.keepNarration.push(...(m.keepNarration||[]));
 }
 const allP1Ids=new Set(p1Map.samples.flatMap(s=>[...s.retainedIds,...s.changes.flatMap(c=>c.newIds)]));
 for(const [file,code] of Object.entries(registry.fileCodes)){
  const original=fs.readFileSync(path.join(ROOT,file),'utf8'),sample=p1Sources.samples.find(s=>s.file===file),map=sample&&p1Map.samples.find(s=>s.sourceFile===file);
  const prepared=read('qa/dialogue-p2-writing-20261103/preparation.json').sourceFiles.find(f=>f.file===file);
  assert.equal(hash(original),prepared.sha256,'全稿来源漂移：'+file);
  const lines=original.split('\n'),paragraphs=registry.paragraphs.filter(p=>p.file===file),byLine=new Map(paragraphs.map(p=>[p.line,p]));
  const mod=modules.get(file)||{quotes:{},edits:{},after:{},keepNarration:[],reasons:{}};
  for(const key of ['quotes','edits','after'])assert(mod[key]&&typeof mod[key]==='object',file+' 缺 '+key);
  const serialStart=registry.nextSerial[file],p1Next=sample?{C01:276,PI:646,MY:556}[code]:serialStart;
  let serial=p1Next;
  const usedIds=new Set(allP1Ids),alloc=()=>{let id;do{id=`T-${code}-${String(serial++).padStart(6,'0')}`;}while(usedIds.has(id)||sourceById.has(id));return id;};
  const replacements=new Map();
  if(sample){
   const draft=fs.readFileSync(path.join(ROOT,map.candidateFile),'utf8'),start=code==='C01'?draft.indexOf('<!-- TEXT '):draft.indexOf('\n## ')+1;
   let replacement=draft.slice(start).trim();
   replacement=replacement.replace(/^(#{2,3} 第[三四五六七八九十]+章｜.+)$/gm,'$1\n\n### 完整内容');
   replacements.set(sample.controlFirstLine,{end:sample.controlLastLine,lines:replacement.split('\n')});
   const consumed=new Set(map.retainedIds);for(const c of map.changes){c.oldIds.forEach(id=>consumed.add(id));for(const id of c.newIds)report.mappings.push({file,operation:c.operation,oldIds:c.oldIds,newIds:[id],reason:c.reason,conditionChanged:false,bindingReview:'pending-p4',source:'P1'});}
   for(const id of map.retainedIds)report.mappings.push({file,operation:'retag',oldIds:[id],newIds:[id],reason:'沿用P1已验收小样；只补显式正文信息',conditionChanged:false,bindingReview:'pending-p4',source:'P1'});
   const expected=paragraphs.filter(p=>p.line>=sample.controlFirstLine&&p.line<=sample.controlLastLine).map(p=>p.id);
   assert.deepEqual([...consumed].sort(),expected.sort(),'P1来源未闭合：'+file);
  }
  const emitText=(out,p,e,oldId,reason)=>{
   assert(e&&typeof e.text==='string'&&e.text.length&&!/[\r\n]/.test(e.text),'正文必须为非空单行：'+oldId);
   const keep=e.retain===true;
   const id=keep?oldId:alloc();assert(!usedIds.has(id)||keep,'重复候选ID：'+id);if(keep)usedIds.add(id);
   const data={id,kind:e.kind,speaker:e.speaker,name:e.name,channel:e.channel,group:null};
   out.push('<!-- TEXT '+JSON.stringify(data)+' -->',e.text,'');
   report.mappings.push({file,operation:keep?'retag':oldId?'rewrite':'insert',oldIds:oldId?[oldId]:[],newIds:[id],reason:reason||(keep?'原句保留，仅拆显式正文类型':mod.reasons?.[oldId]||'拆出转述或对白，保持当场事实与条件'),conditionChanged:false,bindingReview:'pending-p4',source:sample&&sourceById.get(oldId)?.line>=sample?.controlFirstLine&&sourceById.get(oldId)?.line<=sample?.controlLastLine?'P1':'P2'});
   return id;
  };
  for(const [id,list] of Object.entries(mod.edits)){
   const p=sourceById.get(id);assert(p&&p.file===file,'编辑ID不属于当前文件：'+id);assert(Array.isArray(list)&&list.length,'空编辑：'+id);
   const out=[];for(const e of list)emitText(out,p,e,id);replacements.set(p.line,{end:p.line,lines:out.slice(0,-1)});
  }
  for(const [id,list] of Object.entries(mod.after)){
   const p=sourceById.get(id);assert(p&&p.file===file,'插入锚点不属于当前文件：'+id);assert(!mod.edits[id],'插入锚点不能同时改写：'+id);
  }
  const lineEdits=new Map();
  for(const [from,to] of Object.entries(mod.lineEdits||{})){
   assert(from.startsWith('> ')&&to.startsWith('> '),'lineEdits只能修改非正文说明行：'+file);
   assert(!/<!--|\*\*选择 |^#{1,4} /.test(to),'lineEdits不得改控制标记、选项或正文：'+file);
   const matches=[];lines.forEach((line,index)=>{if(line===from)matches.push(index+1);});assert.equal(matches.length,1,'说明行须恰好匹配一次：'+file+'／'+from);assert(!byLine.has(matches[0]),'说明行不能覆盖正文：'+file);lineEdits.set(matches[0],to);
  }
  const out=[],explicit=new Set();
  for(let i=0;i<lines.length;i++){
   const line=lines[i],ln=i+1,r=replacements.get(ln);if(r){out.push(...r.lines);i=r.end-1;continue;}
   if(sample&&ln>sample.controlFirstLine&&ln<sample.controlLastLine)continue;
   const p=byLine.get(ln);if(!p){out.push(lineEdits.get(ln)||line);continue;}
   assert.equal(hash(line),p.sha256,'原段漂移：'+p.id);
   const quote=mod.quotes[p.id];
   if(quote){
    const pure=/^“([^”]+)”(?:(?:我|她|他|小满|阿俊|毛狼|飘)(?:(?:低声|压低声音)?(?:说|问|回|答|喊)|压低声音))?[。]?$/.exec(line);assert(pure,'quotes仅接受纯引号或单一发言归属尾注：'+p.id);
    const [speaker,channel='face']=quote,h=require('./p2-revisions/helpers.cjs');
    const helper=channel==='text'?h.m(speaker,pure[1]):h.d(speaker,pure[1],channel);
    emitText(out,p,helper,p.id,'原有直接发言移除整句外层引号，明确说话人与媒介');
    helper.retain=true; // ID retention is recorded below; content was already emitted with a fresh ID.
    const last=report.mappings.at(-1);usedIds.delete(last.newIds[0]);last.newIds=[p.id];last.operation='retag';
    const at=out.length-3;out[at]=out[at].replace(/"id":"T-[^"]+"/,'"id":"'+p.id+'"');usedIds.add(p.id);explicit.add(p.id);continue;
   }
   const keepN=(mod.keepNarration||[]).includes(p.id);
   if(/[“”]/.test(line)&&!keepN){
    report.unresolvedQuotes.push({id:p.id,file,context:p.context,text:line});
   }
   const kind=keepN?'narration':silentKind(line);
   out.push('<!-- TEXT '+JSON.stringify({id:p.id,kind,speaker:null,name:'',channel:'none',group:null})+' -->',line,'');usedIds.add(p.id);explicit.add(p.id);
   report.mappings.push({file,operation:'retag',oldIds:[p.id],newIds:[p.id],reason:keepN?'保留引号用于称谓、文字或叙述标记；经逐段复核':'原句保留；仅区分叙述与动作，不推断说话人',conditionChanged:false,bindingReview:'pending-p4',source:'P2'});
   for(const e of mod.after[p.id]||[])emitText(out,null,e,null,mod.insertReasons?.[p.id]||'补齐当场回应或既有结尾的生活落点；不新增关系结果');
  }
  for(const n of registry.paragraphs.filter(p=>p.file===file))assert(report.mappings.some(m=>m.oldIds.includes(n.id)),'来源段未映射：'+n.id);
  const result=applyEditorial(file,out.join('\n').replace(/\n{4,}/g,'\n\n\n'),report.mappings);
  write(path.join(candidates,path.basename(file)),result);
  const dest=path.join(input,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,result);
  const rows=report.mappings.filter(m=>m.file===file);
  report.files.push({file,code,sourceSha256:hash(original),candidateSha256:hash(result),sourceParagraphs:paragraphs.length,candidateParagraphs:rows.reduce((n,m)=>n+m.newIds.length,0),retained:rows.filter(m=>m.operation==='retag').length,rewritten:rows.filter(m=>m.operation==='rewrite').length,inserted:rows.filter(m=>m.operation==='insert').length});
 }
 fs.copyFileSync(path.join(ROOT,'scenario/routes.json'),path.join(input,'scenario/routes.json'));
 const generated=compile({root:input,textPolicy:'required',pageSize:108});
 report.contentBuildId=generated.ir.buildId;report.explicitParagraphs=new Set(generated.ir.nodes.filter(n=>n.textMeta).map(n=>n.paragraph)).size;report.textNodes=generated.ir.nodes.filter(n=>n.op==='text').length;
 report.status=report.unresolvedQuotes.length?'review-required':'built';
 report.editorialReview={batch:corrections.batch,correctedParagraphs:corrections.corrections.length,restoredTransitions:corrections.insertBefore.length,correctedNotes:corrections.notes.length};
 write(path.join(outputDir,'source-map.json'),{schemaVersion:1,status:report.status,baselineFingerprint:registry.baselineFingerprint,sourceBuildId:registry.contentBuildId,candidateBuildId:report.contentBuildId,scope:'P2全稿候选，未写正式scenario；全部演出待P4',editorialReview:report.editorialReview,mappings:report.mappings});
 write(path.join(outputDir,'build-report.json'),report);
 console.log(JSON.stringify({status:report.status,files:report.files.length,sourceParagraphs:registry.paragraphs.length,candidateParagraphs:report.explicitParagraphs,unresolvedQuotes:report.unresolvedQuotes.length,contentBuildId:report.contentBuildId}));
 return report;
}
function cliOutputDir(){
 const args=process.argv.slice(2);if(!args.length)return QA;
 assert(args.length===2&&args[0]==='--qa','用法：--qa qa/<本批目录>');
 const outputDir=path.resolve(ROOT,args[1]);assert(outputDir.startsWith(path.join(ROOT,'qa')+path.sep),'证据目录必须在项目qa内');return outputDir;
}
if(require.main===module)build({outputDir:cliOutputDir()});module.exports={build,ROOT,QA,DOCS,cliOutputDir};
