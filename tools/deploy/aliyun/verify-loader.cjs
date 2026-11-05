#!/usr/bin/env node
'use strict';
// 用中断的数据流与损坏缓存，验证用户实际可能遇到的恢复路径。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/core-loader.js','utf8');
const payload=crypto.randomBytes(16384),expected={bytes:payload.length,sha256:crypto.createHash('sha256').update(payload).digest('hex')};
const url='https://example.test/r/release/assets.arc',checks=[];
async function run(name,options={}){
  const requests=[],entries=new Map(),deleted=[];
  if(options.corrupt)entries.set(url,Buffer.alloc(payload.length));
  entries.set('https://example.test/unrelated-player-data',Buffer.from('preserve'));
  const cache={match:async key=>entries.has(key)?new Response(entries.get(key)):undefined,
    delete:async key=>{key=key.url||key;deleted.push(key);return entries.delete(key);},
    keys:async()=>[...entries.keys()].map(url=>({url})),
    put:async(key,response)=>{if(options.quota)throw new Error('QuotaExceededError');entries.set(key,Buffer.from(await response.arrayBuffer()));}};
  const sandbox={console,URL,Uint8Array,Response,ReadableStream,AbortController,performance,crypto:crypto.webcrypto,
    location:new URL(url),setTimeout:(f,ms)=>setTimeout(f,ms===45000?ms:1),clearTimeout,
    caches:{open:async()=>cache},isSecureContext:true,suie:{ready:false,status:()=>{}},
    fetch:async(address,request)=>{
      requests.push({address,range:request.headers.Range});
      if(options.alwaysFail)throw new Error('offline');
      if(options.interrupted&&requests.length===1){let count=0;return new Response(new ReadableStream({pull(controller){
        if(!count++){controller.enqueue(payload.subarray(0,4096));}else controller.error(new Error('network interrupted'));
      }}));}
      const start=request.headers.Range&&!options.ignoreRange?+request.headers.Range.match(/\d+/)[0]:0;
      const data=options.badDigest?Buffer.alloc(payload.length):payload.subarray(start);
      return new Response(data,{status:start?206:200,headers:start?{'Content-Range':`bytes ${start}-${payload.length-1}/${payload.length}`}:{}});
    }};
  sandbox.window=sandbox;vm.runInNewContext(source,sandbox);
  let error;
  try{const data=await sandbox.suiLoadCoreArchive(url,expected);assert.deepEqual(Buffer.from(data),payload);await sandbox.suiCoreLoadStats.cacheWrite;}catch(e){error=e;}
  if(options.alwaysFail){assert(error);assert.equal(requests.length,4);}
  else if(options.badDigest){assert.match(String(error),/checksum/);assert(!entries.has(url));}
  else{
    assert.ifError(error);assert(entries.has('https://example.test/unrelated-player-data'));
    if(options.interrupted){assert.equal(requests.length,2);assert.equal(requests[1].range,'bytes=4096-');assert.equal(sandbox.suiCoreLoadStats.retries,1);}
    if(options.corrupt)assert(deleted.includes(url));
    if(options.quota)assert.match(sandbox.suiCoreLoadStats.cacheWriteError,/Quota/);
    else assert.equal(sandbox.suiCoreLoadStats.cacheStored,true);
  }
  checks.push({name,pass:true,requests:requests.length,retries:sandbox.suiCoreLoadStats.retries});
}
(async()=>{
  await run('下载中断后以 Range 续传',{interrupted:true});
  await run('源站忽略 Range 时安全重下',{interrupted:true,ignoreRange:true});
  await run('缓存损坏后重下且保留其他缓存',{corrupt:true});
  await run('存储配额不足仍可打开游戏',{quota:true});
  await run('持续断网达到重试上限后退出',{alwaysFail:true});
  await run('内容指纹错误时拒绝启动',{badDigest:true});
  const report={status:'pass',checks};console.log(JSON.stringify(report,null,2));
  if(process.argv[2]){assert(!fs.existsSync(process.argv[2]));fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
