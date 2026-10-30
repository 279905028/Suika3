#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parse,hash}=require('./parse.cjs');
const {emit}=require('./emit.cjs');
const ROOT=path.resolve(__dirname,'../..');
function compile({root=ROOT,pageSize=120}={}) {
  const dir=path.join(root,'scenario');const contractText=fs.readFileSync(path.join(dir,'routes.json'),'utf8'),R=JSON.parse(contractText);
  const files=[...new Set([...R.storyEntry.common,R.storyEntry.routeEntry,...R.routes.map(r=>r.file),R.day36.sharedSource.file,...R.epilogues.rules.flatMap(r=>r.target?[r.target.file]:[])])];
  for(const f of files)assert(f===path.basename(f)&&f.endsWith('.md'),'来源不在scenario白名单：'+f);
  const sources=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(dir,f),'utf8')]));
  const sourceHashes=Object.fromEntries([['routes.json',contractText],...Object.entries(sources)].map(([f,s])=>['scenario/'+f,hash(s)]));
  const compilerHashes=Object.fromEntries(fs.readdirSync(__dirname).filter(f=>/\.(cjs|ray)$/.test(f)).sort().map(f=>['tools/compiler/'+f,hash(fs.readFileSync(path.join(__dirname,f)))]));
  const ir=parse(R,sources,{pageSize});ir.buildId=hash(JSON.stringify({sourceHashes,compilerHashes,pageSize}));
  const artifacts=emit(ir);artifacts['story.ir.json']=JSON.stringify(ir,null,2)+'\n';
  const manifest={version:1,buildId:ir.buildId,contractRevision:R.revision,pageSize,sourceHashes,compilerHashes,counts:{files:files.length,choices:Object.keys(ir.choices).length,options:Object.values(ir.choices).reduce((a,c)=>a+c.options.length,0),endings:ir.nodes.filter(n=>n.op==='ending').length,pages:ir.nodes.filter(n=>n.op==='text').length,nodes:ir.nodes.length},runtimeReady:false,resourceBindings:[],outputs:Object.fromEntries(Object.entries(artifacts).map(([f,s])=>[f,{sha256:hash(s),bytes:Buffer.byteLength(s)}]))};
  artifacts['manifest.json']=JSON.stringify(manifest,null,2)+'\n';return {ir,artifacts,manifest};
}
function write(out,result) {
  const absolute=path.resolve(out);assert(absolute.startsWith(ROOT+path.sep),'输出须在当前工程内');
  assert(!['scenario','SDK','system','images','sound','suika-beat','tools'].includes(path.relative(ROOT,absolute).split(path.sep)[0]),'禁止覆盖源或示例目录');
  assert(absolute!==ROOT,'禁止覆盖根入口');fs.mkdirSync(absolute,{recursive:true});
  for(const[f,s]of Object.entries(result.artifacts))fs.writeFileSync(path.join(absolute,f),s);
}
if(require.main===module){try{
  const args=process.argv.slice(2);let out,pageSize=120;
  while(args.length){const a=args.shift();if(a==='--out')out=args.shift();else if(a==='--page-size')pageSize=Number(args.shift());else throw Error('未知参数：'+a);}
  assert(out,'用法：node tools/compiler/compile.cjs --out qa/<批次>/generated');const result=compile({pageSize});write(out,result);console.log(JSON.stringify({out,buildId:result.ir.buildId,...result.manifest.counts},null,2));
}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={compile,write};
