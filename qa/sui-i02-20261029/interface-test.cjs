#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../../tools/compiler/compile.cjs');
const {validate,hash,INTERFACE}=require('../../tools/integration/runtime/validate.cjs');
const ROOT=path.resolve(__dirname,'../..'),BATCH=path.join(ROOT,'qa/sui-i02-20261029'),FIX='qa/sui-i02-20261029/fixture',TMP=path.join(BATCH,'interface-test-work');
const compiled=compile({pageSize:108});
const opts={root:ROOT,compiled,manifestPath:FIX+'/manifest.json',bindingsPath:FIX+'/bindings.json',snapshotPath:FIX+'/snapshot.json',mode:'diagnostic',outputDir:path.join(BATCH,'diagnostic')};
const input=validate(opts);fs.mkdirSync(TMP,{recursive:true});
for(const f of input.files){const to=path.join(TMP,f.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(ROOT,f.path),to);}
const records=[],base={manifest:input.manifest,bindings:input.bindings,snapshot:input.snapshot};
const read=p=>fs.readFileSync(path.join(TMP,p)),write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(TMP,p)),{recursive:true});fs.writeFileSync(path.join(TMP,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const clone=x=>JSON.parse(JSON.stringify(x));
function documents(edit=()=>{},sync=true){const d=clone(base);edit(d);write(opts.manifestPath,d.manifest);if(sync)d.bindings.manifestSha256=hash(read(opts.manifestPath));write(opts.bindingsPath,d.bindings);{d.snapshot.manifest={path:opts.manifestPath,sha256:hash(read(opts.manifestPath))};d.snapshot.bindings={path:opts.bindingsPath,sha256:hash(read(opts.bindingsPath))};d.snapshot.files=d.snapshot.files.map(x=>({...x,sha256:hash(read(x.path))}));}write(opts.snapshotPath,d.snapshot);return d;}
const testOpts={...opts,root:TMP,outputRoot:ROOT};
function pass(name,fn){fn();records.push({name,result:'pass'});}
function fail(name,edit,pattern,sync=true,extra={}){documents(edit,sync);assert.throws(()=>validate({...testOpts,...extra}),pattern);records.push({name,result:'rejected-as-required'});}
pass('真实三图诊断合法输入',()=>{documents();const r=validate(testOpts);assert.equal(r.assets.length,3);assert.equal(r.bindingsList.length,5);assert.equal(r.diagnostic,true);});
fail('未知schema版本',d=>d.manifest.schemaVersion='SUI-I-2',/版本|不支持/);
fail('未知顶层字段',d=>d.bindings.script='eval()',/未知字段/);
fail('缺少必要字段',d=>delete d.manifest.assets[0].approval,/缺字段/);
fail('缺少快照参数',()=>{},/缺少I01/,true,{snapshotPath:null});
fail('接口指纹漂移',d=>d.snapshot.interfaceSha256='a'.repeat(64),/接口指纹/);
fail('绑定正文旧版本',d=>d.bindings.contentBuildId='a'.repeat(64),/正文构建版本/);
fail('绑定采用清单旧指纹',d=>d.bindings.manifestSha256='a'.repeat(64),/绑定采用清单/,false);
fail('正文来源缺项',d=>delete d.bindings.sourceHashes['scenario/routes.json'],/正文输入指纹/);
fail('范围不一致',d=>d.bindings.scope.description='different',/范围不一致/);
fail('阶段缺项不明确',d=>{d.manifest.scope.missing=[];d.bindings.scope=d.manifest.scope;d.snapshot.scope=d.manifest.scope;d.snapshot.missing=[];},/须明确缺项/);
fail('正式候选不能消费诊断',()=>{},/身份与构建模式/,true,{mode:'candidate'});
fail('诊断不能写入dist',()=>{},/诊断只允许/,true,{outputDir:path.join(ROOT,'dist/no')});
fail('重复资源ID',d=>d.manifest.assets.push(d.manifest.assets[0]),/重复assetId/);
fail('重复运行路径',d=>d.manifest.assets[1].runtimePath=d.manifest.assets[0].runtimePath,/重复映射/);
fail('运行字节sha漂移',d=>d.manifest.assets[0].runtimeSha256='a'.repeat(64),/指纹不符/);
fail('路径逃逸',d=>d.manifest.assets[0].runtimePath=FIX+'/resources/../../escape.webp',/非法工程相对路径/);
fail('运行文件绝对路径',d=>d.manifest.assets[0].runtimePath='/tmp/escape.webp',/目录\/身份/);
fail('运行文件错误大小',d=>d.manifest.assets[0].bytes++,/字节数不符/);
fail('真实编码与声明不符',d=>d.manifest.assets[0].format='PNG',/PNG签名/);
fail('批准范围不含资源ID',d=>d.manifest.assets[0].approval.scope=['other-id'],/批准范围/);
fail('诊断不得假冒approved',d=>d.manifest.assets[0].approval.status='approved',/诊断不可伪装/);
fail('失效A11项目ID',d=>d.manifest.assets[0].a11.assetId='unknown',/A11记录/);
fail('尺寸不符A11',d=>d.manifest.assets[0].width++,/尺寸\/字节/);
fail('透明标记不符A11',d=>d.manifest.assets[1].alpha=false,/alpha标记/);
fail('重复绑定ID',d=>d.bindings.bindings.push(d.bindings.bindings[0]),/重复bindingId/);
fail('重复节点绑定',d=>{d.bindings.bindings.push({...d.bindings.bindings[0],bindingId:'another'});},/多条重叠/);
fail('失效源锚点',d=>d.bindings.bindings[0].anchor.nodeId='TEXT_unknown_1',/失效正文锚点/);
fail('锚点来源错文件',d=>d.bindings.bindings[0].anchor.file='scenario/孟遥-旧题.md',/来源文件/);
fail('锚点摘要漂移',d=>d.bindings.bindings[0].anchor.sha256='a'.repeat(64),/摘要指纹/);
fail('取消叶岚路线',d=>d.bindings.bindings[0].routeIds=['yelan'],/未知或取消路线/);
fail('未知条件字段',d=>d.bindings.bindings[0].condition='UNKNOWN=A',/未知条件字段/);
fail('非法选择值',d=>d.bindings.bindings[0].condition='MY07-01=C',/非法条件值/);
fail('非法条件括号',d=>d.bindings.bindings[0].condition='(MY07-01=A)',/不支持的条件/);
fail('未知资源ID',d=>d.bindings.bindings[0].enter.background.assetId='unknown',/未知资源/);
fail('资源类型错层',d=>d.bindings.bindings[0].enter.background.assetId='char-xiaoman-base',/类型不匹配/);
fail('负数缩放',d=>d.bindings.bindings[0].enter.background.scale=-1,/过小/);
fail('人物重复图层',d=>d.bindings.bindings[0].enter.characters.push(d.bindings.bindings[0].enter.characters[0]),/重复显示层/);
fail('人物使用背景层',d=>d.bindings.bindings[0].enter.characters[0].layer='bg',/显示层不匹配/);
fail('恢复目标遗留CG',d=>d.bindings.bindings[1].exit.restore.cg=d.bindings.bindings[1].enter.cg,/不能保留CG/);
fail('取消CG编号',d=>d.bindings.bindings[1].cgId='CG049',/未知或取消CG/);
fail('CG禁止全图查看',d=>d.bindings.bindings[1].fullView=false,/必须支持/);
fail('无CG却虚报解锁',d=>d.bindings.bindings[0].cgId='CG001',/没有CG画面/);
fail('不支持退出时点',d=>d.bindings.bindings[1].exit.at='chapter-end',/不支持的值/);
fail('快照缺资源',d=>d.snapshot.files=d.snapshot.files.filter(f=>f.path!==d.manifest.assets[0].runtimePath),/快照缺项/);
fail('快照重复项',d=>d.snapshot.files.push(d.snapshot.files[0]),/快照重复路径/);
pass('拒绝符号链接输入',()=>{documents();const p=input.assets[0].runtimePath;fs.renameSync(path.join(TMP,p),path.join(TMP,p+'.preserved'));fs.symlinkSync(path.basename(p)+'.preserved',path.join(TMP,p));assert.throws(()=>validate(testOpts),/符号链接/);fs.unlinkSync(path.join(TMP,p));fs.renameSync(path.join(TMP,p+'.preserved'),path.join(TMP,p));});
pass('批准证据存在且范围匹配的阶段校验',()=>{
  const d=clone(base),scope={kind:'partial',description:'仅测试校验器；不是用户批准与正式采用',missing:['仅测试']};d.manifest.scope=d.bindings.scope=d.snapshot.scope=scope;d.snapshot.missing=scope.missing;
  write('qa/sui-i02-test/TEST-NOT-USER-APPROVAL.txt','TEST ONLY. Synthetic validator evidence, not user approval.');
  const evidence={path:'qa/sui-i02-test/TEST-NOT-USER-APPROVAL.txt',sha256:hash(read('qa/sui-i02-test/TEST-NOT-USER-APPROVAL.txt')),reference:'synthetic-test'};
  for(const a of d.manifest.assets){const old=a.runtimePath;a.runtimePath='assets/current/'+path.basename(old);fs.mkdirSync(path.dirname(path.join(TMP,a.runtimePath)),{recursive:true});fs.copyFileSync(path.join(TMP,old),path.join(TMP,a.runtimePath));a.approval={status:'approved',evidence,scope:[a.assetId]};}
  const mp='assets/current/manifest.json',bp='docs/整合/bindings.json',sp='qa/sui-i01-test/snapshot.json';
  write(mp,d.manifest);d.bindings.manifestSha256=hash(read(mp));write(bp,d.bindings);
  const required=[INTERFACE,mp,bp,evidence.path,...d.manifest.assets.flatMap(a=>[a.sourcePath,a.runtimePath,a.a11.path])];d.snapshot.files=[...new Set(required)].map(p=>({path:p,sha256:hash(read(p))}));d.snapshot.manifest={path:mp,sha256:hash(read(mp))};d.snapshot.bindings={path:bp,sha256:hash(read(bp))};write(sp,d.snapshot);
  const r=validate({...testOpts,manifestPath:mp,bindingsPath:bp,snapshotPath:sp,mode:'candidate'});assert.equal(r.complete,false);assert.equal(r.diagnostic,false);
});
fs.writeFileSync(path.join(BATCH,'interface-test-report.json'),JSON.stringify({task:'SUI-I02',scope:'静态接口/负例与诊断样本；无用户采用、引擎或浏览器验收',interfaceSha256:hash(fs.readFileSync(path.join(ROOT,INTERFACE))),passed:records.length,failed:0,checks:records},null,2)+'\n');
fs.rmSync(TMP,{recursive:true,force:true});console.log(JSON.stringify({passed:records.length,failed:0}));
