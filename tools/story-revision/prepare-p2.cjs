#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash}=require('../compiler/parse.cjs');
const ROOT=path.resolve(__dirname,'../..'),QA=path.join(ROOT,'qa/dialogue-p2-writing-20261103');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const registry=read('qa/dialogue-p0-20261102/paragraph-registry.json');
const p1=read('qa/dialogue-p1-writing-20261102/source-paragraphs.json');
const write=(p,s)=>{assert(!fs.existsSync(p),'不覆盖已有P2资料：'+p);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
const p1Lines=new Map(p1.samples.map(s=>[s.file,[s.controlFirstLine,s.controlLastLine]]));
const report={status:'prepared',baselineFingerprint:registry.baselineFingerprint,contentBuildId:registry.contentBuildId,sourceFiles:[],quoteParagraphs:[]};
for(const [file,code] of Object.entries(registry.fileCodes)){
 const source=fs.readFileSync(path.join(ROOT,file),'utf8');
 const paragraphs=registry.paragraphs.filter(p=>p.file===file),byLine=new Map(paragraphs.map(p=>[p.line,p]));
 const lines=source.split('\n'),annotated=[];
 for(const [i,line] of lines.entries()){
  const p=byLine.get(i+1);if(p)annotated.push('<!-- P0 '+p.id+'｜'+p.condition+' -->');
  annotated.push(line);
 }
 const rel=path.basename(file,'.md')+'.md';
 write(path.join(QA,'source-review',rel),annotated.join('\n'));
 const span=p1Lines.get(file);
 for(const [index,p] of paragraphs.entries()){
  if(span&&p.line>=span[0]&&p.line<=span[1])continue;
  const original=lines[p.line-1];
  assert.equal(hash(original),p.sha256,'来源漂移：'+p.id);
  if(/[“”]/.test(original)||/(?:说|问|答|回|喊|叫|讲|提|商量|解释|答应|拒绝|道歉|邀请|坦白)/.test(original))report.quoteParagraphs.push({id:p.id,file,context:p.context,condition:p.condition,text:original,previous:paragraphs.slice(Math.max(0,index-1),index).map(x=>({id:x.id,text:lines[x.line-1]})),next:paragraphs.slice(index+1,index+2).map(x=>({id:x.id,text:lines[x.line-1]}))});
 }
 report.sourceFiles.push({file,code,sha256:hash(source),paragraphs:paragraphs.length,p1Range:span||null});
}
write(path.join(QA,'preparation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,files:report.sourceFiles.length,paragraphs:registry.paragraphs.length,reviewCandidates:report.quoteParagraphs.length,output:path.relative(ROOT,QA)}));
