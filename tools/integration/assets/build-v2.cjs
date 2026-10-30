#!/usr/bin/env node
'use strict';
// SUI-I01 声明数据生产器。只写 I01 当前清单和本批 QA，不写运行脚本/候选。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash,condition}=require('../../compiler/parse.cjs');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/sui-i01-20261030',version='sui-i01-20261030-v2';
const read=p=>fs.readFileSync(path.join(ROOT,p));
const json=p=>JSON.parse(read(p));
const put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),JSON.stringify(v,null,2)+'\n');};
const fp=p=>({path:p,sha256:hash(read(p))});
function build(){
 assert(!fs.existsSync(path.join(ROOT,QA,'snapshot.json')),'本批已冻结，修改须使用新版本/QA，不覆盖既有快照');
 const c=require('../../compiler/compile.cjs').compile({pageSize:108}),ir=c.ir,R=ir.contract;
 const M=json(QA+'/previous-manifest.json'),B=json(QA+'/previous-bindings.json');
 assert.deepEqual(c.manifest.sourceHashes,B.sourceHashes,'相对上次已审原文变化，须重新审阅场景表');
 const scenes=require('./scenes-v2.cjs'),assets=new Map(M.records.map(a=>[a.assetId,a]));
 const endings=R.routes.flatMap(r=>[...r.endings,...r.lowPathEndings||[]]);
 const byFile=new Map(Object.keys(scenes).map(f=>[f,ir.nodes.filter(n=>n.source.file===f)]));
 const guards=new Map();
 for(const nodes of byFile.values()){
   const ix=new Map(nodes.map((n,i)=>[n.id,i]));
   nodes.forEach((n,i)=>guards.set(n.id,nodes.filter((g,j)=>g.op==='branch'&&j<i&&i<ix.get(g.otherwise)).map(g=>g.condition)));
 }
 function conjunction(asts){
   if(!asts.length)return 'ALL';
   let groups=[[]];for(const ast of asts)groups=groups.flatMap(g=>ast.map(h=>[...g,...h]));
   groups=groups.map(g=>[...new Map(g.map(t=>[JSON.stringify(t),t])).values()]);
   return groups.map(g=>g.map(t=>t.field+t.operator+t.value).join('&')).join('|');
 }
 function placement(id,layer){
   const a=assets.get(id);assert(a,'未知资源 '+id);const p=a.placement;
   return {assetId:id,layer,x:Math.round(p.x),y:Math.round(p.y),scale:p.scale,form:a.usage.form,
     costume:a.type==='character'?a.assetId:null};
 }
 const empty=()=>({background:null,characters:[],props:[],cg:null});
 const intervals=[];
 for(const [file,plans]of Object.entries(scenes)){
   const waits=byFile.get(file).filter(n=>['text','choice'].includes(n.op));
   assert(waits.length);assert(plans[0][0]<=waits[0].source.line,file+' 缺开场');
   for(let i=0;i<plans.length;i++){
     const [start,bg,note]=plans[i],end=plans[i+1]?.[0]??Infinity;
     assert(start<end,file+' 场景边界顺序错误');assert(bg||note,'文字镜头必须有理由');
     if(bg)assert.equal(assets.get('bg-'+bg)?.type,'background',bg);
     const members=waits.filter(n=>n.source.line>=start&&n.source.line<end);assert(members.length,file+':'+start+' 空场景区间');
     intervals.push({sceneId:'scene-'+String(intervals.length+1).padStart(3,'0'),file:'scenario/'+file,requestedLine:start,
       first:{nodeId:members[0].id,line:members[0].source.line,quote:members[0].text||members[0].choice,sha256:members[0].source.sha256},
       last:{nodeId:members.at(-1).id,line:members.at(-1).source.line,quote:members.at(-1).text||members.at(-1).choice,sha256:members.at(-1).source.sha256},
       sourceSha256:c.manifest.sourceHashes['scenario/'+file],backgroundId:bg?'bg-'+bg:null,
       direction:note||'按当前正文场所持续显示，至下一明确场景边界；不继承人物/道具',nodeIds:members.map(n=>n.id)});
   }
 }
 const sceneAt=new Map(intervals.flatMap(s=>s.nodeIds.map(id=>[id,s])));
 const cueAt=new Map();for(const b of B.bindings){if(assets.get(b.assetId).type==='background')continue;
   for(const id of b.visiblePageIds){const ar=cueAt.get(id)||[];ar.push(b);cueAt.set(id,ar);}
 }
 const bindings=[],audit=[];
 for(const n of ir.nodes.filter(n=>['text','choice'].includes(n.op))){
   const scene=sceneAt.get(n.id);assert(scene,'未设计节点 '+n.id);const base=empty();
   if(scene.backgroundId)base.background=placement(scene.backgroundId,'bg');
   const cues=n.op==='text'?cueAt.get(n.id)||[]:[];
   for(const b of cues){const type=assets.get(b.assetId).type;if(type==='character')base.characters.push(placement(b.assetId,'center'));if(type==='prop')base.props.push(placement(b.assetId,'prop1'));}
   const cg=cues.find(b=>b.cgId);assert(cues.filter(b=>b.cgId).length<=1);
   const enter=structuredClone(base);
   if(cg)enter.cg=placement(cg.assetId,'cg');
   const asts=[...guards.get(n.id),...cues.flatMap(b=>b.conditions.requiredExpressions.map(e=>condition(e,ir.choices,endings)))];
   const route=R.routes.find(r=>r.file===n.source.file);
   const routeIds=route?[route.id]:n.source.file===R.day36.sharedSource.file?R.day36.calls.map(c=>c.routeId):[];
   const b={bindingId:'i01v2-'+n.id,anchor:{nodeId:n.id,file:'scenario/'+n.source.file,sha256:n.source.sha256},condition:conjunction(asts),routeIds,
     enter,exit:{at:'next-node',restore:structuredClone(base)},cgId:cg?.cgId||null,fullView:Boolean(cg),
     restrictions:[scene.sceneId+': '+scene.direction,
       '完整节点状态：任意跳转/回退/读档按目标节点重建背景、人物、形态、衣装、道具；不继承另一分支',
       '人物/道具只在已审单拍特写显示；其余段落由场景和文字承载动作，不用站姿替坐姿或自动补持物',
       '选择等待保留背景，清除人物、道具和CG；等待选择时不读取本次尚未提交的答案',
       ...(cg?['CG当前段落内显示，下一节点先去CG恢复此场景，再按目标节点重算；全图查看隐藏正文/姓名/菜单且不推进正文',
          '图鉴仅真实首个可见帧解锁，注册不解锁，全局解锁不随选择回退撤销']:[])]};
   bindings.push(b);audit.push({bindingId:b.bindingId,nodeId:n.id,sceneId:scene.sceneId,op:n.op,source:n.source,text:n.text||n.choice,
      previousCueIds:cues.map(b=>b.bindingId),decision:scene.direction});
 }
 const used=new Set(bindings.flatMap(b=>[b.enter.background,...b.enter.characters,...b.enter.props,b.enter.cg].filter(Boolean).map(p=>p.assetId)));
 const scope={kind:'complete',description:'I01全正文声明式场景：六线、共通、第36天及双后日谈；持续背景、逐拍人物/道具特写、60CG；未明场所/远程/过渡使用逐项注明的文字镜头。范围不含I02引擎与Q验收。',missing:[]};
 const manifest={schemaVersion:'SUI-I-1',version,scope,assets:M.records.map(a=>({assetId:a.assetId,type:a.type,sourcePath:a.source.path,sourceSha256:a.source.sha256,
   runtimePath:a.runtime.path,runtimeSha256:a.runtime.sha256,bytes:a.runtime.bytes,width:a.runtime.width,height:a.runtime.height,format:'WEBP',alpha:a.runtime.alpha.channelPresent,
   encoding:{lossless:true,tool:'原A11已验WebP逐字节采用',parameters:JSON.stringify(a.encoding)},
   approval:{status:'approved',evidence:{path:a.approval.path,sha256:a.approval.sha256,reference:a.approval.decisionId},scope:[...new Set([a.assetId,...a.usage.restrictions.flat(Infinity)])]},
   a11:{path:a.a11.path,sha256:a.a11.sha256,assetId:a.assetId},restrictions:[...new Set(a.usage.restrictions.flat(Infinity)),
    used.has(a.assetId)?'只按本版明确节点绑定出现，不由目录自动采用':'批准备用，本版不显示；不属于必须补图缺项',
    '人物衣装/形态以本assetId固定差分为准；详细来源、提示词、版本及几何见本批adoption-ledger.json']
 }))};
 put('assets/current/manifest.json',manifest);
 const doc={schemaVersion:'SUI-I-1',version,scope,contentBuildId:ir.buildId,manifestSha256:fp('assets/current/manifest.json').sha256,sourceHashes:c.manifest.sourceHashes,bindings};
 put('docs/整合/bindings.json',doc);
 put(QA+'/scene-plan.json',{version,sourceHashes:doc.sourceHashes,style:'持续背景＋仅已审单拍特写；文字镜头逐区间注明理由',scenes:intervals});
 put(QA+'/node-audit.json',{version,nodes:audit});
 put(QA+'/adoption-ledger.json',{version,approval:M.approval,excluded:M.excluded,records:M.records.map(a=>({...a,bindingIds:bindings.filter(b=>[b.enter.background,...b.enter.characters,...b.enter.props,b.enter.cg].filter(Boolean).some(p=>p.assetId===a.assetId)).map(b=>b.bindingId),usage:{...a.usage,status:used.has(a.assetId)?'bound-v2':'approved-reserve',reserveReason:used.has(a.assetId)?null:a.usage.reserveReason||'无独立单拍出镜需求；保留获批备用，不强制铺满差分'}}))});
 put(QA+'/coverage.json',{version,scope,adopted:manifest.assets.length,active:used.size,reserves:212-used.size,scenes:intervals.length,
   textScenes:intervals.filter(s=>!s.backgroundId).length,nodes:bindings.length,textPages:bindings.filter(b=>b.anchor.nodeId.startsWith('TEXT_')).length,
   paragraphs:new Set(ir.nodes.filter(n=>n.op==='text').map(n=>n.paragraph)).size,backgroundNodes:bindings.filter(b=>b.enter.background).length,
   textOnlyNodes:bindings.filter(b=>!b.enter.background&&!b.enter.cg&&!b.enter.characters.length&&!b.enter.props.length).length,
   choices:ir.nodes.filter(n=>n.op==='choice').length,cg:new Set(bindings.map(b=>b.cgId).filter(Boolean)).size,unboundNodes:[],
   sourceHashes:doc.sourceHashes,notTested:['引擎运行','游戏浏览器','手机真机','电脑原生','发布']});
 const paths=[...new Set(['docs/整合/interface-v1.json',...Object.keys(c.manifest.sourceHashes),...Object.keys(c.manifest.compilerHashes),
   'system/sui-u/gallery.registry.json','system/sui-u/integration.json','docs/CG当前选择.json',...M.records.flatMap(a=>[a.source.path,a.derivativeSource.path,a.provenance.upstreamRecord.path,a.approval.path,a.a11.path]),
   'tools/integration/runtime/validate.cjs','tools/integration/runtime/presentation.cjs','tools/integration/runtime/presentation.ray'])];
 const prot=QA+'/protected-inputs.json';if(fs.existsSync(path.join(ROOT,prot)))for(const f of json(prot))assert.equal(fp(f.path).sha256,f.sha256);else put(prot,paths.map(fp));
 console.log(JSON.stringify(json(QA+'/coverage.json'),null,2));return {c,manifest,doc,intervals,audit};
}
if(require.main===module)build();
module.exports={build,ROOT,QA,version,read,json,put,fp};
