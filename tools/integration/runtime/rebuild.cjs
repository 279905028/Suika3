#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const version=process.argv[2],relative=process.argv[3];
assert(/^[a-z0-9][a-z0-9._-]{2,79}$/.test(version||''));
assert(/^qa\/sui-i02-[^/]+\/[a-z0-9-]+$/.test(relative||''),'显式指定新的I02 QA重建目录');
const source=path.join(ROOT,'build',version),frozen=path.join(source,'input'),out=path.join(ROOT,relative),m=JSON.parse(fs.readFileSync(path.join(source,'candidate-manifest.json')));
assert(!fs.existsSync(out),'禁止覆盖重建证据');assert.equal(m.mode,'candidate');assert(m.producerHandoff&&m.complete);
for(const item of m.inputs){assert.equal(hash(path.join(frozen,item.path)),item.sha256,'冻结输入变化：'+item.path);if(/^(tools\/compiler|tools\/runtime|tools\/integration\/runtime)\//.test(item.path)&&!item.path.endsWith('.md'))assert.equal(hash(path.join(ROOT,item.path)),item.sha256,'执行工具已变化：'+item.path);}
const compiled=require('../../compiler/compile.cjs').compile({root:frozen,pageSize:108});assert.equal(compiled.ir.buildId,m.contentBuildId);
const v=require('./validate.cjs').validate({root:frozen,compiled,manifestPath:m.handoff.manifest.path,bindingsPath:m.handoff.bindings.path,snapshotPath:m.handoff.snapshot.path,mode:'candidate'});
const {build}=require('../../runtime/build.cjs'),{integrate}=require('./presentation-full.cjs'),checks=[];
for(const platform of ['wasm','desktop']){
 const result=build({out:path.join(out,platform),projectRoot:frozen,compiled,databasePrefix:'bijie-rain-suika3-v1:',integration:{diagnostic:false,assets:v.assets,bindings:v.bindingsList,fingerprint:sha(m.inputFingerprint+platform),adapt:args=>integrate({...args,assets:v.assets,bindings:v.bindingsList,mode:'candidate',sdkPlatform:platform})}});
 assert.equal(result.runtimeBuildId,m.runtimeBuildIds[platform==='wasm'?'web':'desktop']);
 for(const file of ['stage/main.ray','stage/start.novel','stage/config.ini','runtime-positions.json','web/assets.arc','web/index.html','web/shell.js','web/shell.css']){assert.equal(hash(path.join(out,platform,file)),hash(path.join(source,platform,file)),'重建不一致：'+file);checks.push({path:platform+'/'+file,sha256:hash(path.join(out,platform,file))});}
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({pass:true,version,inputFingerprint:m.inputFingerprint,contentBuildId:m.contentBuildId,checks},null,2)+'\n');
console.log('固定输入重建通过：'+checks.length+' 项产物字节一致');
