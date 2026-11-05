#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),[port]=process.argv.slice(2);
const base=new URL('http://127.0.0.1:'+port+'/'),web=path.join(__dirname,'extracted/web/v1.1.0-beta.2/web');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/dialogue-p5-motion-20261104/build-my56-libtv-20261105/runtime/build-manifest.json')));
const report={status:'running',runtimeBuildId:manifest.runtimeBuildId,checks:[],files:[]};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
(async()=>{try{
 for(const x of manifest.outputs){const relative=x.path.slice(4),r=await fetch(new URL(relative,base),{method:'HEAD'});assert.equal(r.status,200);assert.equal(Number(r.headers.get('content-length')),x.bytes);assert.equal(sha(fs.readFileSync(path.join(web,relative))),x.sha256);report.files.push(relative);}
 await check('67项解压网页文件长度与原冻结指纹一致',()=>assert.equal(report.files.length,67));
 for(const relative of ['motion/KCG-MY-03.mp4','title-motion.mp4','assets.arc'])await check(relative+'分段206',async()=>{const r=await fetch(new URL(relative,base),{headers:{Range:'bytes=0-1023'}});assert.equal(r.status,206);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(fs.readFileSync(path.join(web,relative)).subarray(0,1024)));});
 await check('网页首页200且内容一致',async()=>{const r=await fetch(base);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(fs.readFileSync(path.join(web,'index.html'))));});
 await check('越界分段416',async()=>assert.equal((await fetch(new URL('title-motion.mp4',base),{headers:{Range:'bytes=9999999999-'}})).status,416));
 await check('无效方法405',async()=>assert.equal((await fetch(base,{method:'POST'})).status,405));
 await check('缺失文件404',async()=>assert.equal((await fetch(new URL('missing-test-file',base))).status,404));
 await check('编码越界路径403',async()=>assert.equal((await fetch(new URL('..%2f..%2fconfig.ini',base))).status,403));
 report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;console.error(e.stack);}
finally{fs.writeFileSync(path.join(__dirname,'http-check.json'),JSON.stringify(report,null,2)+'\n');}})();
