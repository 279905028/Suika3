#!/usr/bin/env node
'use strict';
const vm=require('node:vm');
const C=require('./common.cjs'),V=require('../p4-bindings/validate.cjs');
const {assert,json,read,fp,write,freshOutput,QA,BASE,CATALOG,digest,unchanged}=C;
const {resourceCatalog}=require('./catalog.cjs'),{assemble}=require('./assemble.cjs'),{compareChoices}=require('./choices.cjs'),{integrate}=require('./presentation.cjs');
function verify({preview=QA+'/preview-v2',out=QA+'/static-v1'}={}) {
 const dir=freshOutput(out),ctx=V.loadContext(),catalog=json(CATALOG),checks=[];
 const check=(name,fn)=>{try{fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',error:e.stack});}};
 const reject=(name,fn,re)=>check(name,()=>assert.throws(fn,re));
 const a=assemble({ctx}),resources=a.resources;
 const generated={ir:json(preview+'/runtime/generated/story.ir.json'),artifacts:{'story.ray':read(preview+'/runtime/generated/story.ray').toString(),'story.novel':read(preview+'/runtime/generated/story.novel').toString()}};
 const args={generated,host:read('main.ray').toString(),uiRay:json('system/sui-u/integration.json').raySourceOrder.map(p=>read(p).toString()).join('\n'),assets:a.assets,bindings:a.bindings,gallery:a.gallery};
 const adapted=integrate(args),again=integrate(args);
 check('4814节点/七包精确覆盖',()=>assert.equal(a.bindings.length,4814));
 check('81图鉴/14页/原60项顺序及解锁变量保持',()=>{assert.equal(a.gallery.items.length,81);assert.deepEqual(a.gallery.items.slice(0,60).map(i=>i.id),json('system/sui-u/gallery.registry.json').items.map(i=>i.id));});
 check('生成确定性',()=>assert.deepEqual(adapted,again));
 check('压缩登记与旧生成器4814条完整状态逐项等价',()=>{
   const legacy=require('../../integration/runtime/presentation-full.cjs').integrate(args);
   function execute(ray,entry){
     const data=ray.slice(0,ray.indexOf('// SUI-I02 presentation executor.')).replace(/^func /gm,'function ');
     const v={iStates:{},iBindings:{},iLayers:{},Array:{push:(a,x)=>a.push(x)},String:{from:x=>String(x)},Engine:{createTextTexture:()=>false},suiHistoryText:()=>false,suiUIRegisterCG:()=>true,sc_fail:x=>{throw Error(x);},Suika:Object.fromEntries(Object.values(require('../../integration/runtime/presentation-full.cjs').LAYERS).map(x=>['LAYER_'+x,x]))};
     v.iRegister=b=>v.iBindings[b.id]=b;vm.createContext(v);vm.runInContext(data,v);v[entry]();return JSON.parse(JSON.stringify({states:v.iStates,bindings:v.iBindings,layers:v.iLayers,webp:v.iWebpFiles}));
   }
   assert.deepEqual(execute(adapted.ray,'p4InstallBindings'),execute(legacy.ray,'iInstall'));
 });
 check('独立目录选择版本/65题134图完全复用',()=>{const r=compareChoices(generated.ir);assert.equal(r.choices,65);assert.equal(r.options,134);assert.equal(r.regenerated,0);});
 for(const count of [60,61])check(count+'项目录兼容（无固定81项上限）',()=>{const c=structuredClone(catalog);c.cg=c.cg.slice(0,count);const used=new Set(c.cg.map(x=>x.assetId));c.assets=c.assets.filter(x=>x.type!=='cg'||used.has(x.assetId));assert.equal(resourceCatalog(ctx,c).gallery.items.length,count);});
 const mutate=(f)=>()=>{const c=structuredClone(catalog);f(c);resourceCatalog(ctx,c);};
 reject('重复CG拒绝',mutate(c=>c.cg.push(c.cg[0])),/重复CG|重复项/);
 reject('旧编号换资源拒绝',mutate(c=>c.cg[0].assetId=c.cg[1].assetId),/旧CG编号/);
 reject('退役CG复用拒绝',mutate(c=>c.cg.at(-1).cgId='CG049'),/退役CG/);
 reject('未登记新编号拒绝',mutate(c=>c.cg.at(-1).cgId='CG130'),/未登记/);
 reject('新增编号错配图片拒绝',mutate(c=>c.cg.at(-1).assetId=c.cg.at(-2).assetId),/重复编号|登记图片/);
 reject('伪造04证据入口拒绝',mutate(c=>c.cg.at(-1).registrationEvidence=c.cg.find(x=>x.cgId==='CG109').registrationEvidence),/真实来源/);
 reject('新增登记错误指纹拒绝',mutate(c=>c.cg.at(-1).registrationEvidence.sha256='0'.repeat(64)),/指纹/);
 reject('漏旧CG拒绝',mutate(c=>c.cg.shift()),/缺失旧CG/);
 reject('漏CG登记拒绝',mutate(c=>c.cg.pop()),/未登记/);
 reject('路径穿越拒绝',mutate(c=>c.assets[0].runtime.path='assets/current/../../config.ini'),/非法工程相对路径/);
 reject('资源指纹漂移拒绝',mutate(c=>c.assets[0].runtime.sha256='0'.repeat(64)),/冻结输入漂移/);
 reject('资源检查错配拒绝',mutate(c=>c.assets[0].checkEvidence=c.assets[1].checkEvidence),/另一资源/);
 reject('passed无批准依据拒绝',mutate(c=>{const a=c.assets.find(a=>a.reviewStatus==='pending');a.reviewStatus='passed';}),/批准/);
 reject('资源清单版本漂移拒绝',mutate(c=>c.inputFingerprint='0'.repeat(64)),/来源版本/);
 const p='P4-02-MY',docs=V.readPackage(BASE+'/'+p);
 const badPack=(f)=>()=>{const d=structuredClone(docs);f(d);V.validatePack(ctx,p,d,{mode:'draft',resources});};
 reject('条件放宽拒绝',badPack(d=>d.bindings.bindings.find(x=>x.binding.condition!=='ALL').binding.condition='ALL'),/条件须逐字/);
 reject('目标路线串线拒绝',badPack(d=>d.bindings.bindings[0].binding.routeIds=['piao']),/路线归属/);
 reject('锚点指纹漂移拒绝',badPack(d=>d.bindings.bindings[0].binding.anchor.sha256='0'.repeat(64)),/锚点/);
 reject('恢复状态残留CG拒绝',badPack(d=>{const b=d.bindings.bindings.find(x=>x.binding.enter.cg).binding;b.exit.restore.cg=b.enter.cg;}),/exit.restore/);
 reject('未知显示资源拒绝',badPack(d=>{d.bindings.bindings.find(x=>x.binding.enter.background).binding.enter.background.assetId='unknown';}),/未知资源/);
 reject('缺显示节点拒绝',badPack(d=>d.bindings.bindings.pop()),/覆盖/);
 reject('未知包字段拒绝',badPack(d=>d.bindings.unknown=true),/未知字段/);
 reject('真实未闭合包不能交正式采用',()=>assemble({ctx,mode:'handoff'}),/未决需求|未审|阻塞|未闭合|未通过/);
 reject('选择文案变化不能偷用旧图',()=>{const ir=structuredClone(generated.ir);Object.values(ir.choices)[0].options[0].text+='修改';compareChoices(ir);},/文案/);
 reject('选项顺序变化拒绝',()=>{const ir=structuredClone(generated.ir);Object.values(ir.choices)[0].options.reverse();compareChoices(ir);},/顺序/);
 // Execute unmodified function bodies extracted from the generated Ray. Native decode/UI is tested separately.
 function extract(name){const start=adapted.ray.indexOf('func '+name+'(');assert(start>=0);const paren=adapted.ray.indexOf(')',start),params=adapted.ray.slice(adapted.ray.indexOf('(',start)+1,paren),first=adapted.ray.indexOf('{',paren);let depth=1,i=first+1;while(depth){if(adapted.ray[i]==='{')depth++;if(adapted.ray[i]==='}')depth--;i++;}return 'function '+name+'('+params+'){'+adapted.ray.slice(first+1,i-1).replace(/for\s*\((\w+) in ([^)]+)\)/g,'for(const $1 of $2)')+'}';}
 let stage={},stored={},failure='',applied='',gui=false,tag='text',saves=0;
 const globals=new Map(),bindings=Object.fromEntries(a.bindings.map(b=>[b.bindingId,{id:b.bindingId,node:b.anchor.nodeId,routes:b.routeIds,condition:C.parseCondition(b.condition,generated.ir),cg:b.cgId||'',full:b.fullView,enter:b.bindingId+':enter',restore:b.bindingId+':restore'}]));
 const states={empty:[]};for(const b of a.bindings){states[b.bindingId+':enter']=b.enter;states[b.bindingId+':restore']=b.exit.restore;}
 const m=require('../../compiler/model.cjs').model(generated.ir);
 const sandbox={iBindings:bindings,iNodes:Object.fromEntries(a.bindings.map(b=>[b.anchor.nodeId,[b.bindingId]])),iStates:states,iFullView:false,iLiveLayers:{},eMode:'reading',suiGalleryActive:false,suiHistoryActive:false,
  Dict:{hasKey:(o,k)=>Object.hasOwn(o,k)},Array:{size:a=>a.length},iGet:k=>stored[k]||'',iSet:(k,v)=>stored[k]=v,sc_get:k=>stage[k]||'',sc_has:(a,v)=>a.includes(v),sc_ok:()=>!failure,sc_fail:e=>{failure=e;return false;},sc_condition:ast=>m.evaluate(ast,{...m.fresh(),route:stage.route,choices:stage.choices||{},relation:stage.relation||'HIGH',frozen:true}),
  iApply:s=>{assert(states[s]);applied=s;stored.state=s;return true;},print:()=>{},Suika:{getTagName:()=>tag,isGUIRunning:()=>gui,checkVariableExists:({name})=>globals.has(name),isGlobalVariable:({name})=>globals.get(name)?.global===true,getVariableInt:({name})=>globals.get(name)?.value,setVariableInt:({name,value})=>globals.set(name,{value,global:false}),makeVariableGlobal:({name,isGlobal})=>globals.get(name).global=isGlobal,executeSaveGlobal:()=>{saves++;return true;}}};
 vm.createContext(sandbox);for(const name of ['iMatches','iValidate','iExit','iAt','iRestore','iCanView','iUnlockVisible'])vm.runInContext(extract(name),sandbox);
 const first=a.bindings.find(b=>b.cgId==='CG001'),next=a.bindings.find(b=>!b.cgId&&b.routeIds.length===0&&b.condition==='ALL');
 check('登记/进入不提前解锁',()=>{stage={cursor:first.anchor.nodeId};assert(sandbox.iAt(stage.cursor));assert.equal(globals.size,0);});
 check('菜单/回顾/图鉴遮挡不解锁',()=>{gui=true;sandbox.iUnlockVisible();gui=false;sandbox.suiHistoryActive=true;sandbox.iUnlockVisible();sandbox.suiHistoryActive=false;sandbox.suiGalleryActive=true;sandbox.iUnlockVisible();sandbox.suiGalleryActive=false;assert.equal(globals.size,0);});
 check('仅正文可见帧解锁一次',()=>{tag='choose';sandbox.iUnlockVisible();assert.equal(globals.size,0);tag='text';sandbox.iUnlockVisible();sandbox.iUnlockVisible();assert.equal(saves,1);assert.equal(globals.get('sui_cg_CG001').global,true);});
 check('跨节点清CG/关闭全图/目标完整重算',()=>{sandbox.iFullView=true;stage.cursor=next.anchor.nodeId;assert(sandbox.iAt(stage.cursor));assert.equal(sandbox.iFullView,false);assert.equal(applied,next.bindingId+':enter');assert.equal(states[applied].cg,null);});
 check('回退/恢复不撤销全局解锁',()=>{stage.cursor=first.anchor.nodeId;sandbox.iAt(stage.cursor);assert(sandbox.iRestore());assert.equal(applied,first.bindingId+':enter');assert.equal(saves,1);});
 check('错误active/恢复状态组合拒绝',()=>{stored.state=first.bindingId+':restore';assert.equal(sandbox.iRestore(),false);failure='';});
 check('其他路线状态不能通过恢复',()=>{const b=a.bindings.find(b=>b.routeIds[0]==='mengyao'&&b.cgId);stage={cursor:b.anchor.nodeId,route:'piao'};stored={active:b.bindingId,state:b.bindingId+':enter'};assert.equal(sandbox.iRestore(),false);failure='';});
 check('受保护正式/冻结输入保持',()=>unchanged(json(preview+'/protected-inputs.json')));
 const failures=checks.filter(c=>c.status==='fail');
 write(dir,'verification.json',{status:failures.length?'fail':'pass',checks,passed:checks.length-failures.length,counts:a.manifest.counts,pendingCounts:Object.fromEntries([...new Set(a.manifest.pending.map(x=>x.kind))].map(k=>[k,a.manifest.pending.filter(x=>x.kind===k).length])),sourceFiles:C.walk('tools/story-revision/p4-integration').map(fp),runtimeRayFingerprint:digest(adapted),scope:'候选/非法输入/确定性/抽取Ray逻辑检查；原生浏览器另录'});
 assert.equal(failures.length,0,failures.map(x=>x.name+': '+x.error).join('\n'));
 console.log(JSON.stringify({status:'pass',checks:checks.length,out}));
}
if(require.main===module)verify({preview:process.argv[2]||undefined,out:process.argv[3]||undefined});
module.exports={verify};
