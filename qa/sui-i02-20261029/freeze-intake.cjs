#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');
const {validate}=require('../../tools/integration/runtime/validate-i01.cjs');
const {hash}=require('../../tools/integration/runtime/validate.cjs');
const compiled=require('../../tools/compiler/compile.cjs').compile({pageSize:108});
const out=process.argv[2]||'qa/sui-i02-20261029/intake-snapshot.json';assert(/^qa\/sui-i02-[^/]+\//.test(out)&&!out.split('/').includes('..'));assert(!fs.existsSync(path.join(ROOT,out)),'intake已存在，禁止覆盖；改用新批次文件');
const pre=validate({compiled,preflight:true});
const ref=p=>({path:p,sha256:pre.files.find(x=>x.path===p).sha256});
const snapshot={schemaVersion:'sui-i02-intake-v1',revision:pre.manifest.revision,actor:'SUI-I02',notProducerHandoff:true,contract:ref('tools/integration/assets/contract.json'),manifest:ref('assets/current/manifest.json'),bindings:ref('docs/整合/bindings.json'),files:pre.files.map(({path,sha256})=>({path,sha256}))};
for(const f of pre.files)assert.equal(hash(fs.readFileSync(path.join(ROOT,f.path))),f.sha256,'冻结时输入漂移：'+f.path);
fs.writeFileSync(path.join(ROOT,out),JSON.stringify(snapshot,null,2)+'\n');
const v=validate({compiled,snapshotPath:out,outputDir:path.join(ROOT,'qa/sui-i02-20261029/intake-diagnostic')});
const report={status:'passed',actor:'SUI-I02',notProducerHandoff:true,snapshotPath:out,snapshotSha256:hash(fs.readFileSync(path.join(ROOT,out))),inputFingerprint:v.inputFingerprint,scope:v.scope,coverageKind:v.coverageKind,counts:v.counts,files:v.files.length};
fs.writeFileSync(path.join(ROOT,out.replace(/\.json$/,'-report.json')),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
