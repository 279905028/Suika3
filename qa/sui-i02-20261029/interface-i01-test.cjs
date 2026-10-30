#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {validate}=require('../../tools/integration/runtime/validate-i01.cjs'),{hash}=require('../../tools/integration/runtime/validate.cjs');
const ROOT=path.resolve(__dirname,'../..'),TMP=path.join(__dirname,'interface-i01-test-work'),snapshotPath='qa/sui-i02-20261029/intake-snapshot.json';
const compiled=require('../../tools/compiler/compile.cjs').compile({pageSize:108});
const live=validate({compiled,snapshotPath,outputDir:path.join(__dirname,'test-diagnostic')});
fs.mkdirSync(TMP,{recursive:true});for(const f of live.files){const dest=path.join(TMP,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest))fs.unlinkSync(dest);fs.linkSync(path.join(ROOT,f.path),dest);}
const manifestPath='assets/current/manifest.json',bindingsPath='docs/整合/bindings.json';
const clone=x=>JSON.parse(JSON.stringify(x));
function write(p,obj){const dest=path.join(TMP,p);if(fs.existsSync(dest))fs.unlinkSync(dest);fs.writeFileSync(dest,JSON.stringify(obj,null,2)+'\n');}
function reset(edit=()=>{}){const m=clone(live.manifest),b=clone(live.bindings);edit(m,b);write(manifestPath,m);b.manifest.sha256=hash(fs.readFileSync(path.join(TMP,manifestPath)));write(bindingsPath,b);}
const opts={root:TMP,compiled,mode:'diagnostic',preflight:true,outputRoot:ROOT,outputDir:path.join(__dirname,'test-diagnostic')},checks=[];
function good(name,fn){fn();checks.push({name,status:'pass'});}
function bad(name,edit,re,extra={}){reset(edit);assert.throws(()=>validate({...opts,...extra}),re);checks.push({name,status:'rejected-as-required'});}
good('212真实批准项、174cue、60CG与1100冻结输入',()=>{assert(live.frozen&&live.notProducerHandoff);assert.deepEqual(live.counts,{assets:212,cues:174,reserves:52,cg:60,cursors:155});assert.equal(live.coverageKind,'partial');assert.equal(live.scope.kind,'diagnostic');});
bad('禁止生产者数据直接生成candidate',()=>{},/仅授权限定拍点诊断/,{mode:'candidate'});
bad('禁止诊断写入dist',()=>{},/仅可输出/,{outputDir:path.join(ROOT,'dist/no')});
bad('禁止缺快照构建',()=>{},/必须等待I01/,{preflight:false});
bad('未知生产者版本',(m)=>m.schemaVersion='future',/strictly equal/);
bad('修改fullCandidateAllowed不得静默放行',(m,b)=>b.candidatePolicy.fullCandidateAllowed=true,/放行范围变化/);
bad('丢失连续演出阻塞',(m,b)=>b.candidatePolicy.blockers=[],/assert/);
bad('修改未绑定页行为',(m,b)=>b.semantics.absence='inherit',/演出语义/);
bad('删除真实帧解锁要求',(m,b)=>b.semantics.galleryUnlockRequiresActualVisibleFrame=false,/演出语义/);
bad('正文sourceHashes漂移',(m,b)=>b.sourceHashes['scenario/routes.json']='f'.repeat(64),/正文版本变化/);
bad('未知生产者字段',(m,b)=>b.allowFallback=true,/未知字段/);
bad('运行采用hash漂移',(m)=>m.records[0].runtime.sha256='f'.repeat(64),/输入指纹变化/);
bad('未获批准assetId',(m)=>m.records[0].assetId='unknown',/批准集合/);
bad('图片大小不同A11',(m)=>m.records[0].runtime.width++,/A11元数据/);
bad('禁止裁切原立绘',(m)=>m.records[0].placement.crop=true,/strictly equal/);
bad('禁止非法浮点坐标',(m)=>m.records[0].placement.x='450.56',/非法排版数字/);
bad('未知typed gate',(m,b)=>b.bindings[0].conditions.entryGates.push({type:'mystery',value:'x'}),/未知entryGate/);
bad('取消叶岚路线gate',(m,b)=>b.bindings[0].conditions.entryGates.push({type:'route',value:'yelan'}),/assert/);
bad('未知event gate',(m,b)=>b.bindings[0].conditions.entryGates.push({type:'event',value:'unknown'}),/assert/);
bad('未知条件字段',(m,b)=>b.bindings[0].conditions.requiredExpressions.push('UNKNOWN=A'),/未知条件字段/);
bad('未来条件不能用括号改语法',(m,b)=>b.bindings[0].conditions.requiredExpressions.push('(MY07-01=A)'),/不支持的条件/);
bad('visibilePageIds必须覆盖来源整段',(m,b)=>b.bindings[0].visiblePageIds=['TEXT_unknown_1'],/可见页集合/);
bad('quote摘要变化',(m,b)=>b.bindings[0].source.quote+='x',/quote摘要/);
bad('退出不能等待lexical successor',(m,b)=>b.bindings[0].exit.doNotWaitForLexicalSuccessor=false,/deep-equal/);
bad('读档必须目标页重算',(m,b)=>b.bindings[0].save.recomputeOnLoad=false,/deep-equal/);
bad('恢复不可继承前段背景',(m,b)=>b.bindings[0].restore.baseScene='inherit',/deep-equal/);
bad('注册不能直接解锁',(m,b)=>b.bindings[0].gallery.registrationUnlocks=true,/deep-equal/);
bad('取消CG不准接入',(m,b)=>b.bindings[0].cgId='CG049',/assert/);
bad('全图不能新增页面',(m,b)=>b.bindings[0].reveal.addsPage=true,/deep-equal/);
bad('备用图不可丢失排除理由',(m,b)=>b.reserves[0].reason='',/文本不能为空/);
good('source expressions保持逐条AST避免CG106 OR泄漏',()=>{const cg=live.rawBindings.find(b=>b.cgId==='CG106');assert(cg.requiredAsts.length>1);assert(cg.requiredAsts.some(a=>a.length===2));});
good('浮点布局不取整、嵌套限制不丢失',()=>{const a=live.rawAssets.find(a=>a.assetId==='char-xiaoman-base');assert.equal(a.placement.x,450.56);const bg=live.rawAssets.find(a=>a.type==='background');assert(bg.usage.restrictions.some(Array.isArray));assert(live.assets.find(a=>a.assetId===bg.assetId).restrictions.every(x=>typeof x==='string'));});
fs.rmSync(TMP,{recursive:true,force:true});
const result={task:'SUI-I02',scope:'真实I01数据静态消费/拒绝检查；不是运行验收',interfaceSha256:hash(fs.readFileSync(path.join(ROOT,'docs/整合/interface-i01-v1.json'))),snapshotSha256:hash(fs.readFileSync(path.join(ROOT,snapshotPath))),passed:checks.length,failed:0,checks};fs.writeFileSync(path.join(__dirname,'interface-i01-test-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:checks.length,failed:0}));
