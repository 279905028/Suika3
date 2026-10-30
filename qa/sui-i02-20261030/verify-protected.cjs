#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'protected-before.json')));
const changed=[],missing=[];
for(const [file,expected] of Object.entries(before)){
  const p=path.join(root,file);
  if(!fs.existsSync(p)){missing.push(file);continue;}
  const actual=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  if(actual!==expected)changed.push({file,expected,actual});
}
const report={layer:'SUI-I02开始时scenario/SDK/compiler/U输入指纹前后比较；不包含允许本批变更的宿主和工具',status:changed.length||missing.length?'fail':'pass',files:Object.keys(before).length,changed,missing};
fs.writeFileSync(path.join(__dirname,'protected-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));assert.equal(report.status,'pass');
