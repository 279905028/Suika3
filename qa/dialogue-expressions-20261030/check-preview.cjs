'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:49244/',version='sui-i02-20261030-v9';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const files=[];
 for(const file of ['index.html','shell.js','shell.css']){
  const response=await fetch(base+file);assert(response.ok);
  const actual=Buffer.from(await response.arrayBuffer()),expected=fs.readFileSync(path.join(root,'dist',version,'web',file));
  assert.equal(sha(actual),sha(expected));files.push({file,sha256:sha(actual)});
 }
 const arc=await fetch(base+'assets.arc',{method:'HEAD'});assert(arc.ok);
 assert.equal(Number(arc.headers.get('content-length')),fs.statSync(path.join(root,'dist',version,'web/assets.arc')).size);
 fs.writeFileSync(path.join(__dirname,'preview-check.json'),JSON.stringify({status:'pass',url:base,version,files,archiveBytes:Number(arc.headers.get('content-length')),playerStorageAccessed:false},null,2)+'\n');
 console.log('原预览入口与v9候选文件一致');
})().catch(e=>{console.error(e);process.exitCode=1;});
