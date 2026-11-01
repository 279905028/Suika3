#!/usr/bin/env node
'use strict';
// Measures every compiled page (108 graphemes) against the portrait message box.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const {compile}=require('../../tools/compiler/compile.cjs');
const ir=compile({pageSize:108}).ir;
const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'suie-ir-')),'story.ir.json');
fs.writeFileSync(file,JSON.stringify(ir));
const p=cp.spawnSync(process.platform==='win32'?'python':'python3',[path.join(__dirname,'pagination-portrait.py'),file],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
fs.rmSync(path.dirname(file),{recursive:true,force:true});
process.stdout.write(p.stdout);process.stderr.write(p.stderr);
if(p.status===0)fs.writeFileSync(path.join(__dirname,'pagination-report.json'),JSON.stringify({contentBuildId:ir.buildId,...JSON.parse(p.stdout)},null,2)+'\n');
process.exitCode=p.status;
