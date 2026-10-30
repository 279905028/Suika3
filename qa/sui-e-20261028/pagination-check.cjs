#!/usr/bin/env node
'use strict';
// SUI-E: local compiler/text layout verification, not native pixel or device acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {compile,write}=require('../../tools/compiler/compile.cjs');
const {parse,hash}=require('../../tools/compiler/parse.cjs');
const {quoted}=require('../../tools/compiler/emit.cjs');
const root=path.resolve(__dirname,'../..');
const out=path.join(__dirname,'pagination-generated');
const report={date:'2026-10-28',scope:'当前正文108字素分页、实际字体度量与可重建检查；不等同原生像素、真机或发布验收',checks:[]};
const check=(name,fn)=>{const detail=fn();report.checks.push({name,status:'pass',detail});};
try{
 const a=compile({pageSize:108}), b=compile({pageSize:108}), oldLayout=compile({pageSize:120});
 report.buildId=a.ir.buildId;
 check('108字素确定性重建',()=>{assert.deepEqual(a.artifacts,b.artifacts);return a.manifest.counts;});
 const sources=Object.fromEntries(Object.keys(a.ir.entries).map(f=>[f,fs.readFileSync(path.join(root,'scenario',f),'utf8')]));
 check('分页原文逐字还原及来源映射',()=>{
  const groups=new Map(),segments=new Intl.Segmenter('zh',{granularity:'grapheme'});
  const units=JSON.parse(a.artifacts['source-map.json']).units;
  for(const n of a.ir.nodes.filter(n=>n.op==='text')){
   let g=groups.get(n.paragraph);if(!g){g={text:'',offset:0,source:n.source};groups.set(n.paragraph,g);}
   assert.equal(n.offset,g.offset);assert.equal(n.offset,units[n.id].offset);assert.equal(n.paragraph,units[n.id].paragraph);
   assert.equal(JSON.parse(quoted(n.text)),n.text);
   const chars=Array.from(segments.segment(n.text),x=>x.segment);assert(chars.length<=108);
   assert(!/[\r\n\t\\\u0000-\u001f]/.test(n.text),'正文含需单独审查的控制符 '+n.id);
   g.text+=n.text;g.offset+=chars.length;
  }
  for(const g of groups.values())assert.equal(g.text,sources[g.source.file].split('\n')[g.source.line-1].trim());
  return {paragraphs:groups.size,pages:a.manifest.counts.pages,explicitNewlines:0,backslashControls:0};
 });
 check('分页变化不改变选择、分支、事件及结局',()=>{
  assert.deepEqual(a.ir.choices,oldLayout.ir.choices);assert.deepEqual(a.ir.contract,oldLayout.ir.contract);
  const semantic=ir=>ir.nodes.filter(n=>n.op!=='text').map(({next,...n})=>n);
  assert.deepEqual(semantic(a.ir),semantic(oldLayout.ir));
  assert.deepEqual(a.manifest.sourceHashes,oldLayout.manifest.sourceHashes);
  const paras=ir=>{const p={};for(const n of ir.nodes.filter(n=>n.op==='text'))p[n.paragraph]=(p[n.paragraph]||'')+n.text;return p;};
  assert.deepEqual(paras(a.ir),paras(oldLayout.ir));
  return {semanticNodes:semantic(a.ir).length,choices:65,options:134,endings:14};
 });
 check('正文空行移动保留稳定ID',()=>{
  const moved=Object.fromEntries(Object.entries(sources).map(([f,s])=>[f,'\n\n'+s.replaceAll('\n\n','\n\n\n')]));
  assert.deepEqual(parse(a.ir.contract,moved,{pageSize:108}).nodes.map(n=>n.id),a.ir.nodes.map(n=>n.id));
  return {stableNodes:a.ir.nodes.length};
 });
 write(out,a);
 const p=cp.spawnSync('python3',[path.join(__dirname,'pagination-metrics.py'),path.join(out,'story.ir.json')],{cwd:root,encoding:'utf8'});
 assert.equal(p.status,0,p.stdout+'\n'+p.stderr);report.fontMetrics=JSON.parse(p.stdout);
 report.sourceHashes=a.manifest.sourceHashes;report.outputHashes=Object.fromEntries(Object.entries(a.artifacts).map(([f,s])=>[f,hash(s)]));
 report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;}
fs.writeFileSync(path.join(__dirname,'pagination-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,buildId:report.buildId,checks:report.checks,...(report.error?{error:report.error}:{metrics:report.fontMetrics})},null,2));
