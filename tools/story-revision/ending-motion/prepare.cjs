#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..'),{items}=require('./manifest.cjs');
const qa='qa/ending-motion-P4-V00-20261104',doc='docs/美术/恋爱结局动态CG-20261104';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2)+'\n');};
function prepare(){
 if(fs.existsSync(path.join(ROOT,qa+'/freeze-resume.json'))){
  const existing=read(qa+'/freeze-resume.json');
  for(const f of existing.inputs)assert.equal(hash(f.path),f.sha256,'冻结输入漂移：'+f.path);
  assert.equal(existing.contentBuildId,read('docs/修订协作/P4-演出与美术/P4-07/context.json').input.contentBuildId);
  console.log(JSON.stringify({status:'existing-freeze-verified',items:existing.items.length}));return existing;
 }
 const latest=read('docs/修订协作/P4-演出与美术/P4-07/context.json');
 const old=read('qa/dialogue-p4-P4-07-20261104/parent-context.json');
 const prompts=fs.readdirSync(path.join(ROOT,doc)).filter(x=>/^0[1-6]-/.test(x)).sort();
 const records=items.map((item,i)=>{
  const n=latest.nodes.find(n=>n.nodeId===item.node),prior=old.nodes.find(n=>n.nodeId===item.node);
  assert(n&&prior);assert.equal(n.page.text,prior.page.text);assert.equal(n.condition,prior.condition);assert.deepEqual(n.routeIds,[item.route]);
  const source=doc+'/'+prompts[i],text=fs.readFileSync(path.join(ROOT,source),'utf8');
  const quotes=text.split('\n').filter(x=>x.startsWith('> '));
  const motion=quotes.at(-1).slice(2),negative=text.split('\n').find(x=>x.startsWith('禁止项：')||x.startsWith('特别禁止：'))||'';
  const dir='assets/sources/20261104/P4-V/'+item.ending;
  write(dir+'/video-v001-prompt.txt',motion+'\n'+negative+'\n最终交付无音轨。人物、衣装、场景保持参考。单一连续镜头，不切镜。\n');
  const record={...item,paragraphId:n.paragraphId,condition:n.condition,entryGate:n.entryGate,text:n.page.text,source:n.source,contentBuildId:latest.input.contentBuildId,firstFrame:{path:item.fallback,sha256:hash(item.fallback)},prompt:{path:dir+'/video-v001-prompt.txt',sha256:hash(dir+'/video-v001-prompt.txt')},spec:{duration:5,tolerance:[4.5,5.5],ratio:'16:9',minimumSize:[1280,720],runtimeCodec:'h264',runtimePixelFormat:'yuv420p',runtimeFps:24,audio:false},status:'first-frame-reviewed; video-not-generated',formalBinding:false};
  write(dir+'/candidate.json',record);return record;
 });
 const result={task:'P4-V00',date:'2026-11-04',status:'prepared',contentBuildId:latest.input.contentBuildId,parentBuildId:latest.input.parentBuildId,sixAnchorsUnchanged:true,inputs:[...latest.input.sourceFiles,...records.map(x=>x.firstFrame),...records.map(x=>x.prompt)],items:records,adopted:false};
 for(const f of result.inputs)assert.equal(hash(f.path),f.sha256,f.path);
 write(qa+'/freeze-resume.json',result);console.log(JSON.stringify({status:'prepared',items:records.length,build:result.contentBuildId}));return result;
}
if(require.main===module)prepare();module.exports={ROOT,qa,doc,hash,read,write,prepare};
