#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PW=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../../..');
const [url,releasePath,outPath,browserName='chrome',mode='local']=process.argv.slice(2);
const out=path.resolve(ROOT,outPath),release=path.resolve(ROOT,releasePath);
assert(out.startsWith(ROOT+'/qa/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(release,'release-manifest.json')));
const report={status:'running',url,browserName,distributionId:manifest.distributionId,mode,checks:[],errors:[],events:[],requests:[]};
const check=(name,detail)=>{report.checks.push({name,detail,pass:true});console.log('PASS',name,JSON.stringify(detail));};
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
let browser,context,page;
(async()=>{try{
 browser=await (browserName==='chrome'?PW.chromium:PW[browserName]).launch({headless:true,...(browserName==='chrome'?{channel:'chrome',args:['--no-proxy-server']}:{}),...(browserName==='firefox'?{firefoxUserPrefs:{'network.proxy.type':0}}:{})});
 context=await browser.newContext({viewport:{width:1280,height:800}});page=await context.newPage();report.browser=browser.version();
 page.on('console',m=>{if(/^SUI_/.test(m.text()))report.events.push(m.text());});page.on('pageerror',e=>report.errors.push(e.stack));page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
 page.on('request',r=>report.requests.push(r.url()));
 const ready=async(address)=>{const start=Date.now();await page.goto(address,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:180000});return Date.now()-start;};
 const settle=async(ms=250)=>{await page.waitForTimeout(ms);await page.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError&&!window.suiDemandAsync?.pending,null,{timeout:30000});};
 const click=async(x,y)=>{const b=await page.locator('#canvas').boundingBox();await page.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});await settle();};
 const latest=async()=>fields(await page.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x))));
 const save=async()=>{await click(1160,48);await click(120,270);await click(870,90);await click(950,250);await click(120,625);};
 const load=async()=>{await click(560,665);await click(1100,90);await click(950,250);await settle(1800);};
 const pixels=async()=>{const b=await page.locator('#canvas').boundingBox();return crypto.createHash('sha256').update(await page.screenshot({clip:{x:b.x,y:b.y+b.height*100/720,width:b.width,height:b.height*400/720}})).digest('hex');};
 const advance=async()=>{await page.locator('#canvas').focus();await page.keyboard.press('Enter',{delay:90});await settle(100);};
 let savedCursor,baselinePixels;
 if(mode==='local'){
  await ready(new URL('baseline/',url).href);await click(320,665);
  for(let i=0;i<20&&(await latest()).cursor!=='T-C01-000004_1';i++)await advance();
  assert.equal((await latest()).cursor,'T-C01-000004_1');await settle(1900);await save();savedCursor=(await latest()).cursor;baselinePixels=await pixels();
  check('原线上版本通过正常操作保存CG位置',savedCursor);
 }
 const requestStart=report.requests.length;
 report.coldTitleMs=await ready(url);await settle(300);
 assert(await page.evaluate(id=>suie.events.includes('SUI_E|ready|'+id),manifest.runtimeBuildId));
 report.coldStats=await page.evaluate(()=>suiDemand.stats);
 assert.equal(report.coldStats.bootstrapBytes,manifest.demand.bootstrap.bytes);
 assert.equal(report.requests.slice(requestStart).filter(x=>x.endsWith('/assets.arc')).length,0);
 assert.equal(report.coldStats.loadedChunks.length,manifest.demand.bootstrap.chunks.length);
 check('仅下载首屏分块，没有整包请求',{titleMs:report.coldTitleMs,bootstrapBytes:report.coldStats.bootstrapBytes});
 await page.screenshot({path:path.join(out,'title.png')});
 if(mode==='local'){
  await load();assert.equal((await latest()).cursor,savedCursor);assert.equal(await pixels(),baselinePixels);
  check('旧存档按需恢复CG且舞台像素一致',savedCursor);
 }else{
  await click(320,665);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')));await save();savedCursor=(await latest()).cursor;
 }
 const initial=(await latest()).cursor;
 for(let i=0;i<25;i++)await advance();
 assert.notEqual((await latest()).cursor,initial);await page.screenshot({path:path.join(out,'reading.png')});
 check('按需读取后可连续阅读',{cursor:(await latest()).cursor,chunks:(await page.evaluate(()=>suiDemand.stats)).loadedChunks.length});
 await page.locator('#canvas').focus();await page.keyboard.press('R',{delay:90});await settle();
 check('回退操作无资源异常',(await latest()).cursor);
 report.warmTitleMs=await ready(url);await settle();report.warmStats=await page.evaluate(()=>suiDemand.stats);
 assert.equal(report.warmStats.networkBytes,0);await load();assert.equal((await latest()).cursor,savedCursor);
 check('刷新复用资源缓存并保持存档',{titleMs:report.warmTitleMs,downloadedBodyBytes:report.warmStats.networkBytes});
 if(mode==='local'){
  // Delete this adapter's resource cache only; save databases remain untouched.
  await page.evaluate(()=>caches.delete('suika3-demand-v1'));await ready(url);await settle();
  let fail=true;const blocked=[];
  await page.route('**/chunks/*.bin',route=>{if(fail){blocked.push(route.request().url());return route.abort('failed');}return route.continue();});
  await click(560,665);await click(1100,90);
  const b=await page.locator('#canvas').boundingBox();await page.mouse.click(b.x+950*b.width/1280,b.y+250*b.height/720,{delay:80});
  await page.waitForFunction(()=>!document.getElementById('demand-retry')?.hidden,null,{timeout:20000});
  assert(await page.evaluate(()=>suiDemandAsync.pending));
  await page.setViewportSize({width:844,height:390});
  await page.locator('#canvas').focus();await page.keyboard.press('Enter',{delay:90});
  fail=false;await page.locator('#demand-retry').click();await settle(1900);
  await page.setViewportSize({width:1280,height:800});await settle();
  assert.equal((await latest()).cursor,savedCursor);assert.equal(await pixels(),baselinePixels);
  check('场景断网后手动重试恢复，期间输入与缩放不破坏进度',{failedRequests:blocked.length,retries:await page.evaluate(()=>suiDemand.stats.retries)});
  await page.unroute('**/chunks/*.bin');
 }
 report.finalStats=await page.evaluate(()=>suiDemand.stats);report.databaseNames=await page.evaluate(async()=>(await indexedDB.databases()).map(x=>x.name));
 assert(report.databaseNames.every(n=>n.startsWith(manifest.databasePrefix)));assert.equal(report.errors.length,0,report.errors.join('\n'));
 check('独立测试存储且无运行异常',report.databaseNames);report.status='pass';
}catch(error){report.status='fail';report.error=error.stack;console.error(error.stack);process.exitCode=1;if(page){report.debug=await page.evaluate(()=>({stats:window.suiDemand?.stats,async:window.suiDemandAsync?{pending:suiDemandAsync.pending,state:suiDemandAsync.raw?.asyncify_get_state()}:null,events:window.suie?.events.slice(-20)})).catch(()=>null);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}})();
