#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),TMP=path.join(__dirname,'package-test-work');
const {verify}=require('../../tools/integration/runtime/verify-package.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(TMP,{recursive:true});
const results=[];
function cli(script,args,re){const r=cp.spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',timeout:20000});assert.notEqual(r.status,0);assert.match(r.stderr,re);results.push({name:script+' '+args.join(' '),result:'rejected-as-required'});}
cli('tools/integration/runtime/build.cjs',[],/必须指定 --version/);
cli('tools/integration/runtime/build.cjs',['--version'],/参数缺值/);
cli('tools/integration/runtime/build.cjs',['--version','package-test','--mode','unknown'],/mode须为/);
cli('tools/integration/runtime/build.cjs',['--version','package-test','--mode','diagnostic','--out',path.relative(ROOT,TMP)],/版本目录已存在/);
cli('tools/integration/runtime/build.cjs',['--version','package-test','--mode','diagnostic','--out','dist/package-test'],/诊断只允许/);
cli('tools/integration/runtime/build.cjs',['--version','package-test','--mode','candidate'],/必须指定 I01 冻结快照/);
cli('tools/runtime/build.cjs',[],/必须显式指定/);
cli('tools/runtime/build.cjs',['--out','qa/sui-e-20261028'],/拒绝覆盖/);
cli('tools/runtime/serve.cjs',[],/必须显式指定/);
cli('tools/runtime/serve.cjs',['--web','scenario'],/仅服务本工程/);
const fake=path.join(TMP,'missing-web-executables');fs.mkdirSync(fake,{recursive:true});const payload=Buffer.from('TEST ONLY NOT A GAME ARCHIVE');const outputs=[];
for(const platform of ['macos','windows-x64','windows-arm64']){const rel=platform+'/assets.arc';fs.mkdirSync(path.dirname(path.join(fake,rel)),{recursive:true});fs.writeFileSync(path.join(fake,rel),payload);outputs.push({path:rel,bytes:payload.length,sha256:hash(payload)});}
const m={task:'SUI-I02',schemaVersion:1,version:'synthetic-review-only',mode:'candidate',complete:true,scope:{kind:'complete',description:'synthetic missing web/executable test',missing:[]},contentBuildId:'fake',inputFingerprint:'fake',runtimeBuildIds:{web:'fake-web',desktop:'fake-desktop'},inputs:[],outputs};fs.writeFileSync(path.join(fake,'candidate-manifest.json'),JSON.stringify(m));
let fakeResult;try{fakeResult={result:'unexpected-pass',returned:verify(fake)};}catch(e){fakeResult={result:'rejected-as-required',message:e.message};}results.push({name:'没有网页/可执行文件且身份指纹非法的伪候选必须拒绝',...fakeResult});
const report={scope:'静态只读审查及小型负例；未构建或改写正式候选',checks:results,knownIssue:fakeResult.result==='unexpected-pass'?'verify-package未校验必要产物/指纹格式与身份约束':null};fs.writeFileSync(path.join(__dirname,'package-test-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
