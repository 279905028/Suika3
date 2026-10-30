'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),name=process.argv[2];assert(/^[a-z0-9.-]+$/.test(name||''));
const source=path.join(__dirname,name),frozen=path.join(source,'input'),out=path.join(__dirname,name+'-rebuild');assert(!fs.existsSync(out),'禁止覆盖重建证据');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const m=JSON.parse(fs.readFileSync(path.join(source,'candidate-manifest.json')));
for(const item of m.inputs){assert.equal(hash(path.join(frozen,item.path)),item.sha256,'冻结输入变化');if(/^(tools\/compiler\/.*|tools\/runtime\/.*|tools\/integration\/runtime\/.*)$/.test(item.path))assert.equal(hash(path.join(root,item.path)),item.sha256,'执行工具已变化，须从新批次构建');}
const compiled=require('../../tools/compiler/compile.cjs').compile({root:frozen,pageSize:108});
assert.equal(compiled.ir.buildId,m.contentBuildId);
const producer=m.producerHandoff===false;
assert(producer,'本重建检查针对I01诊断包');
const v=require('../../tools/integration/runtime/validate-i01.cjs').validate({root:frozen,compiled,manifestPath:m.handoff.manifest.path,bindingsPath:m.handoff.bindings.path,snapshotPath:m.handoff.snapshot.path,mode:'diagnostic',outputDir:out,outputRoot:root});
const {build}=require('../../tools/runtime/build.cjs');
const {integrateI01}=require('../../tools/integration/runtime/i01-compose.cjs');
const checks=[];
for(const platform of ['wasm','desktop']){
 const dest=path.join(out,platform);
 const result=build({out:dest,projectRoot:frozen,compiled,databasePrefix:'bijie-rain-suika3-i02-diagnostic:',integration:{diagnostic:true,extraFiles:['tools/runtime/neutral.png'],assets:v.assets,bindings:v.bindingsList,fingerprint:sha(m.inputFingerprint+platform),adapt:args=>integrateI01({...args,assets:v.assets,rawBindings:v.rawBindings,contract:compiled.ir.contract,mode:'diagnostic',sdkPlatform:platform})}});
 assert.equal(result.runtimeBuildId,m.runtimeBuildIds[platform==='wasm'?'web':'desktop']);
 for(const f of ['stage/main.ray','stage/start.novel','stage/config.ini','runtime-positions.json','web/assets.arc','web/index.html','web/shell.js','web/shell.css']){assert.equal(hash(path.join(dest,f)),hash(path.join(source,platform,f)),'重建字节不一致：'+platform+'/'+f);checks.push(platform+'/'+f);}
}
fs.writeFileSync(path.join(__dirname,'rebuild-'+name+'-report.json'),JSON.stringify({pass:true,version:name,inputFingerprint:m.inputFingerprint,contentBuildId:m.contentBuildId,checks,scope:'两端从同一冻结输入重新编译打包，16个最终脚本/位置/网页与资源产物逐字节一致；非运行验收'},null,2)+'\n');
console.log('PASS fixed-input rebuild: '+checks.length);
