#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function verify(directory){
  const root=path.resolve(directory),m=JSON.parse(fs.readFileSync(path.join(root,'candidate-manifest.json'),'utf8'));
  assert.equal(m.task,'SUI-I02');assert.equal(m.schemaVersion,1);
  const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
  assert(['candidate','diagnostic'].includes(m.mode),'非法候选模式');
  assert(m.scope&&['complete','partial','diagnostic'].includes(m.scope.kind),'缺范围');
  assert(Array.isArray(m.scope.missing)&&typeof m.scope.description==='string'&&m.scope.description.length,'缺范围说明');
  assert.equal(m.mode==='diagnostic',m.scope.kind==='diagnostic','诊断范围不一致');
  assert.equal(m.complete,m.mode==='candidate'&&m.scope.kind==='complete','完整状态不一致');
  assert(m.scope.kind==='complete'?m.scope.missing.length===0:m.scope.missing.length>0,'缺项声明不一致');
  assert(sha(m.contentBuildId)&&sha(m.inputFingerprint)&&sha(m.interfaceSha256),'非法构建指纹');
  assert(Array.isArray(m.inputs)&&m.inputs.length>0,'缺输入清单');
  for(const i of m.inputs)assert(sha(i.sha256)&&Number.isInteger(i.bytes)&&i.bytes>=0,'非法输入记录');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(m.inputs)).digest('hex'),m.inputFingerprint,'输入总指纹不一致');
  for(const p of ['web','desktop'])assert(sha(m.runtimeBuildIds?.[p]),'非法运行指纹');
  const required=['web/index.html','web/assets.arc','web/shell.js','web/shell.css','阅读说明.md','macos/suika3','macos/启动.command','windows-x64/suika3.exe','windows-x64/启动.bat','windows-arm64/suika3.exe','windows-arm64/启动.bat',...['macos','windows-x64','windows-arm64'].map(p=>p+'/assets.arc')];
  assert(Array.isArray(m.outputs),'缺产物清单');
  for(const p of required)assert(m.outputs.some(i=>i.path===p),'缺必需产物：'+p);
  const known=new Set(['candidate-manifest.json']);
  for(const item of m.outputs){
    assert(sha(item.sha256)&&Number.isInteger(item.bytes)&&item.bytes>0,'非法产物指纹或字节数');
    assert(!path.isAbsolute(item.path)&&!item.path.split('/').includes('..')&&!item.path.includes('\\'),'非法产物路径');
    assert(!known.has(item.path),'重复产物');known.add(item.path);
    const file=path.join(root,item.path);assert(fs.realpathSync(file).startsWith(root+path.sep),'链接越界');
    assert.equal(fs.statSync(file).size,item.bytes,'产物长度变化：'+item.path);
    assert.equal(hash(file),item.sha256,'产物指纹变化：'+item.path);
  }
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.relative(root,path.join(dir,e.name))]);
  assert.deepEqual(walk(root).sort(),[...known].sort(),'分发包出现清单外文件');
  const native=hash(path.join(root,'macos/assets.arc'));
  for(const platform of ['windows-x64','windows-arm64'])assert.equal(hash(path.join(root,platform,'assets.arc')),native,'电脑平台资源包不一致');
  assert.equal(m.inputs.length,new Set(m.inputs.map(i=>i.path)).size,'输入重复');
  assert(m.runtimeBuildIds.web&&m.runtimeBuildIds.desktop,'缺构建身份');
  return {pass:true,version:m.version,mode:m.mode,scope:m.scope,contentBuildId:m.contentBuildId,inputFingerprint:m.inputFingerprint,outputs:m.outputs.length,bytes:m.outputs.reduce((sum,item)=>sum+item.bytes,0),runtimeBuildIds:m.runtimeBuildIds,nativeArchiveIdentical:true};
}
if(require.main===module){try{assert(process.argv[2],'用法：node tools/integration/runtime/verify-package.cjs <分发目录>');console.log(JSON.stringify(verify(process.argv[2]),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={verify};
