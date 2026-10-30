#!/usr/bin/env node
'use strict';
// Technical load only: this intentionally makes no story/art adoption claim.
const fs=require('node:fs'),path=require('node:path');
const {compile}=require('../../tools/compiler/compile.cjs');
const {validate,hash,INTERFACE}=require('../../tools/integration/runtime/validate.cjs');
const ROOT=path.resolve(__dirname,'../..'),BASE='qa/sui-i02-20261029/fixture';
function generate(){
const compiled=compile({pageSize:108}),sourceMap=JSON.parse(compiled.artifacts['source-map.json']);
const a11Path='qa/SUI-A11-20261029/pending-adoption.json',a11Bytes=fs.readFileSync(path.join(ROOT,a11Path)),a11=JSON.parse(a11Bytes);
const scope={kind:'diagnostic',description:'仅验证I02加载/演出/恢复的三张真实图技术负载；非剧情采用或I01正式绑定',missing:['I01冻结采用清单与完整演出绑定尚未交接','完整60项真实CG注册/全作负载与六线逐段演出未验证']};
const selections=[['bg-bijie-arrival-platform-day-rain','background'],['char-xiaoman-base','character'],['cg-common-cg001','cg']];
fs.mkdirSync(path.join(ROOT,BASE,'resources'),{recursive:true});
const assets=selections.map(([id,type])=>{const r=a11.records.find(x=>x.assetId===id);if(!r)throw Error('样本丢失 '+id);const m=r.webpMetadata,runtimePath=BASE+'/resources/'+id+'.webp';fs.copyFileSync(path.join(ROOT,r.existingWebP),path.join(ROOT,runtimePath));return {assetId:id,type,sourcePath:r.sourceFile,sourceSha256:r.expectedSourceSha256,runtimePath,runtimeSha256:m.sha256,bytes:m.bytes,width:m.width,height:m.height,format:'WEBP',alpha:Boolean(m.alpha?.channelPresent),encoding:{lossless:true,tool:'复用A11已验WebP；无转换',parameters:'原字节复制'},approval:{status:'diagnostic-only',evidence:null,scope:[id]},a11:{path:a11Path,sha256:hash(a11Bytes),assetId:id},restrictions:['仅技术测试，出现人物与正文情节不建立正式关系']};});
const manifest={schemaVersion:'SUI-I-1',version:'i02-diagnostic-fixture-1',scope,assets};
const manifestPath=BASE+'/manifest.json',bindingsPath=BASE+'/bindings.json',snapshotPath=BASE+'/snapshot.json';
function write(p,v){fs.writeFileSync(path.join(ROOT,p),JSON.stringify(v,null,2)+'\n');}
write(manifestPath,manifest);
const placement=(assetId,layer,x,y,scale,form=null,costume=null)=>({assetId,layer,x,y,scale,form,costume});
const empty=()=>({background:null,characters:[],props:[],cg:null});
const bg=placement(selections[0][0],'bg',0,0,1280/assets[0].width);
const char=placement(selections[1][0],'center',451,50,0.37,'human','diagnostic-base');
const scene={background:bg,characters:[char],props:[],cg:null};
const cgScene={...scene,cg:placement(selections[2][0],'cg',0,0,1280/assets[2].width)};
const texts=compiled.ir.nodes.filter(n=>n.op==='text'),choice=compiled.ir.nodes.find(n=>n.op==='choice');
const bindings=[];
function bind(node,id,enter,restore,cgId=null){const unit=sourceMap.units[node.id];bindings.push({bindingId:id,anchor:{nodeId:node.id,file:'scenario/'+unit.source.file,sha256:unit.source.sha256},condition:'ALL',routeIds:[],enter,exit:{at:'next-node',restore},cgId,fullView:Boolean(cgId),restrictions:['诊断绑定：仅技术演出，不作为本段剧情美术采用']});}
bind(texts[0],'diagnostic-scene',scene,scene);
bind(texts[1],'diagnostic-cg',cgScene,scene,'CG001');
bind(texts[2],'diagnostic-clear-character',{...scene,characters:[]},scene);
bind(texts[3],'diagnostic-scene-return',scene,scene);
bind(choice,'diagnostic-first-choice',{...scene,characters:[]},scene);
const bindingDoc={schemaVersion:'SUI-I-1',version:'i02-diagnostic-fixture-1',scope,contentBuildId:compiled.ir.buildId,manifestSha256:hash(fs.readFileSync(path.join(ROOT,manifestPath))),sourceHashes:compiled.manifest.sourceHashes,bindings};write(bindingsPath,bindingDoc);
const required=[INTERFACE,manifestPath,bindingsPath,a11Path,...assets.flatMap(a=>[a.sourcePath,a.runtimePath])];
const files=[...new Set(required)].sort().map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(ROOT,p)))}));
const snapshot={schemaVersion:'SUI-I-1',version:'i02-diagnostic-fixture-1',scope,interfaceSha256:hash(fs.readFileSync(path.join(ROOT,INTERFACE))),manifest:files.find(x=>x.path===manifestPath),bindings:files.find(x=>x.path===bindingsPath),files,missing:scope.missing};write(snapshotPath,snapshot);
const validated=validate({root:ROOT,manifestPath,bindingsPath,snapshotPath,compiled,mode:'diagnostic',outputDir:path.join(ROOT,'qa/sui-i02-20261029/diagnostic')});
const result={manifestPath,bindingsPath,snapshotPath,inputFingerprint:validated.inputFingerprint,assets:assets.length,bindings:bindings.length,scope};write(BASE+'/fixture-report.json',result);return result;
}
if(require.main===module)console.log(JSON.stringify(generate(),null,2));
module.exports={generate};
