#!/usr/bin/env node
'use strict';
// I01 owns the producer snapshot.  It freezes only validated, current inputs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const out='qa/sui-i01-20261029/snapshot.json';
const {validate}=require(path.join(ROOT,'tools/integration/runtime/validate-i01.cjs'));
const {hash}=require(path.join(ROOT,'tools/compiler/parse.cjs'));
assert(!fs.existsSync(path.join(ROOT,out)),'I01冻结快照已存在；禁止覆盖，应新开批次');
const compiled=require(path.join(ROOT,'tools/compiler/compile.cjs')).compile({pageSize:108});
const pre=validate({root:ROOT,compiled,preflight:true});
const ref=p=>{const b=fs.readFileSync(path.join(ROOT,p));return {path:p,sha256:hash(b)}};
const snapshot={schemaVersion:'sui-i01-snapshot-v1',revision:pre.manifest.revision,contract:ref('tools/integration/assets/contract.json'),manifest:ref('assets/current/manifest.json'),bindings:ref('docs/整合/bindings.json'),files:pre.files.map(({path,sha256})=>({path,sha256}))};
fs.writeFileSync(path.join(ROOT,out),JSON.stringify(snapshot,null,2)+'\n');
const checked=validate({root:ROOT,compiled,snapshotPath:out,preflight:true});
const report={status:'passed',task:'SUI-I01',snapshotPath:out,snapshotSha256:hash(fs.readFileSync(path.join(ROOT,out))),inputFingerprint:checked.inputFingerprint,scope:checked.scope,coverageKind:checked.coverageKind,counts:checked.counts,files:checked.files.length};
fs.writeFileSync(path.join(ROOT,'qa/sui-i01-20261029/freeze-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
