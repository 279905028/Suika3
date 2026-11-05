#!/usr/bin/env node
'use strict';
// 部署环境冒烟：只读取发布文件，并使用临时浏览器资料保存测试档。
const fs=require('node:fs'), path=require('node:path');
const assert=require('node:assert/strict'), crypto=require('node:crypto');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../../..');
const [url,releasePath,outPath,option]=process.argv.slice(2);
assert(url&&releasePath&&outPath,'用法：verify-web.cjs <网站URL/> <部署包目录> <新QA目录>');
assert(!option||option==='--skip-reload','可选参数仅支持 --skip-reload');
const skipReload=option==='--skip-reload';
const baseUrl=new URL(url);assert(['http:','https:'].includes(baseUrl.protocol)&&baseUrl.pathname.endsWith('/'));
const release=path.resolve(ROOT,releasePath),out=path.resolve(ROOT,outPath);
assert(out.startsWith(ROOT+'/qa/')&&!fs.existsSync(out),'必须使用新的QA目录');
const manifest=JSON.parse(fs.readFileSync(path.join(release,'release-manifest.json')));
fs.mkdirSync(out,{recursive:true});
const report={status:'running',url,runtimeBuildId:manifest.runtimeBuildId,
  scope:'部署环境HTTP文件、视频分段、标题/开篇/保存'+(skipReload?'；本轮不重载大资源，刷新读取以本机独立结果为准':'/刷新读取')+'；不代表全路线或手机真机',
  headers:[],checks:[],errors:[],events:[],requests:[]};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(name,detail)=>{report.checks.push({name,detail,pass:true});console.log('PASS '+name);};
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
let browser,context,page,progressTimer;
(async()=>{try{
  // HEAD 不下载整个大资源；实际完整下载由下面的真实引擎启动覆盖。
  for(let i=0;i<manifest.files.length;i+=4){
    await Promise.all(manifest.files.slice(i,i+4).map(async item=>{
      const name=item.path.slice(4),r=await fetch(new URL(name,baseUrl),{method:'HEAD',headers:{'Accept-Encoding':'identity'},signal:AbortSignal.timeout(20000)});
      assert.equal(r.status,200,name+'不可访问');
      assert.equal(Number(r.headers.get('content-length')),item.bytes,name+'长度不符');
      const mime=r.headers.get('content-type')||'';
      if(name.endsWith('.html'))assert(mime.startsWith('text/html'));
      if(name.endsWith('.js'))assert(/javascript/.test(mime));
      if(name.endsWith('.css'))assert(mime.startsWith('text/css'));
      if(name.endsWith('.mp4'))assert(mime.startsWith('video/mp4'));
      report.headers.push({path:name,status:r.status,contentType:mime,bytes:item.bytes,
        cacheControl:r.headers.get('cache-control'),etag:r.headers.get('etag')});
    }));
  }
  check('全部67个网页文件可访问且长度正确',report.headers.length);
  const video=manifest.files.find(x=>x.path.startsWith('web/motion/')&&x.path.endsWith('.mp4'));
  const range=await fetch(new URL(video.path.slice(4),baseUrl),{headers:{Range:'bytes=0-1023','Accept-Encoding':'identity'},signal:AbortSignal.timeout(20000)});
  assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 0-1023/'+video.bytes);
  assert.equal(sha(Buffer.from(await range.arrayBuffer())),sha(fs.readFileSync(path.join(release,video.path)).subarray(0,1024)));
  check('视频字节范围请求返回206且内容一致',video.path);
  const index=await fetch(new URL('index.html',baseUrl),{headers:{'Accept-Encoding':'gzip'},signal:AbortSignal.timeout(30000)});
  assert.equal(index.status,200);
  assert.equal(sha(Buffer.from(await index.arrayBuffer())),manifest.files.find(x=>x.path==='web/index.html').sha256);
  report.htmlTransferEncoding=index.headers.get('content-encoding');
  check('HTML传输及解压后指纹一致',report.htmlTransferEncoding||'identity');
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
  context=await browser.newContext({viewport:{width:1280,height:800}});
  report.browser=browser.version();report.storage='独立临时BrowserContext，不访问玩家日常资料';
  page=await context.newPage();
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  const requestNames=new Map(),transfer={startedAt:new Date().toISOString(),coreReceivedBytes:0,coreExpectedBytes:manifest.files.find(x=>x.path==='web/assets.arc').bytes};
  cdp.on('Network.requestWillBeSent',e=>requestNames.set(e.requestId,e.request.url));
  cdp.on('Network.dataReceived',e=>{if(requestNames.get(e.requestId)===new URL('assets.arc',baseUrl).href)transfer.coreReceivedBytes+=e.dataLength;});
  progressTimer=setInterval(()=>{
    fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({...transfer,status:report.status,observedAt:new Date().toISOString()},null,2)+'\n');
    console.log('核心资源传输 '+(transfer.coreReceivedBytes/1048576).toFixed(1)+' / '+(transfer.coreExpectedBytes/1048576).toFixed(1)+' MiB');
  },30000);
  page.on('console',m=>{if(/^SUI_[EIC]\|/.test(m.text()))report.events.push(m.text());});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
  page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))report.errors.push(r.url()+': '+r.failure()?.errorText);});
  page.on('response',r=>{if(r.url().startsWith(url))report.requests.push({url:r.url(),status:r.status()});});
  const started=Date.now();
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:1800000});
  report.coldStartMs=Date.now()-started;
  assert(report.events.includes('SUI_E|ready|'+manifest.runtimeBuildId));
  await page.waitForTimeout(800);
  await page.screenshot({path:path.join(out,'title.png')});
  check('同构建标题启动',report.coldStartMs);
  const settle=async()=>{await page.waitForTimeout(350);await page.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:15000});};
  const click=async(x,y)=>{const b=await page.locator('#canvas').boundingBox();await page.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});await settle();};
  const latest=()=>page.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)));
  await click(320,665);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')));await settle();
  const opening=fields(await latest()).cursor;assert(opening);
  await page.screenshot({path:path.join(out,'opening.png')});check('从标题进入正式正文',opening);
  await click(1160,48);await click(120,270);await click(870,90);await click(950,250);await click(120,625);
  assert(report.events.some(x=>x.startsWith('SUI_E|save|slot=1|')&&fields(x).cursor===opening));
  check('独立测试存档落盘',opening);
  if(skipReload){report.reload='not-run-in-this-scope';}
  else{
    await page.reload({waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:1800000});await settle();
    await click(560,665);await click(1100,90);await click(950,250);
    assert.equal(fields(await latest()).cursor,opening);
    await page.screenshot({path:path.join(out,'restored.png')});check('刷新后读取恢复同一正文',opening);
  }
  report.databaseNames=await page.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));
  report.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})));
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);process.exitCode=1;
  if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
}finally{
  clearInterval(progressTimer);
  if(context)await context.close();if(browser)await browser.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}})();
