#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../../..');
const [url,releasePath,outPath,option]=process.argv.slice(2);
assert(url&&releasePath&&outPath);
const release=path.resolve(ROOT,releasePath),out=path.resolve(ROOT,outPath);
assert(out.startsWith(ROOT+'/qa/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(release,'release-manifest.json')));
const report={status:'running',url,runtimeBuildId:manifest.runtimeBuildId,distributionId:manifest.distributionId,
  storage:'临时独立BrowserContext',scope:option==='--public'?'线上首载、缓存重载、存读档':'原发布包存档→新分发包读取、冷/热加载、正文与字体',checks:[],errors:[],events:[],coreResponses:[]};
const check=(name,detail)=>{report.checks.push({name,detail,pass:true});console.log('PASS '+name,JSON.stringify(detail));};
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
let browser,context,page,timer;
(async()=>{try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
  context=await browser.newContext({viewport:{width:1280,height:800}});page=await context.newPage();
  report.browser=browser.version();
  page.on('console',m=>{if(/^SUI_[EIC]\|/.test(m.text()))report.events.push(m.text());});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
  page.on('response',async r=>{if(r.url().endsWith('/assets.arc'))report.coreResponses.push({url:r.url(),status:r.status(),headers:await r.allHeaders()});});
  timer=setInterval(async()=>{if(page&&!page.isClosed())console.log('加载状态',JSON.stringify(await page.evaluate(()=>window.suiCoreLoadStats?{source:suiCoreLoadStats.source,receivedBytes:suiCoreLoadStats.receivedBytes,cacheStored:suiCoreLoadStats.cacheStored}:null).catch(()=>null)));},30000);
  const open=async address=>{const start=Date.now();await page.goto(address,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:1800000});await page.waitForTimeout(500);return Date.now()-start;};
  const settle=async()=>{await page.waitForTimeout(350);await page.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:15000});};
  const click=async(x,y)=>{const b=await page.locator('#canvas').boundingBox();await page.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});await settle();};
  const latest=()=>page.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)));
  let opening;
  if(option!=='--public'){
    report.baselineMs=await open(new URL('baseline/',url).href);
    await click(320,665);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')));await settle();
    opening=fields(await latest()).cursor;assert(opening);
    await page.screenshot({path:path.join(out,'baseline-opening.png')});
    await click(1160,48);await click(120,270);await click(870,90);await click(950,250);await click(120,625);
    assert(report.events.some(x=>x.startsWith('SUI_E|save|slot=1|')&&fields(x).cursor===opening));
    check('原发布包写入独立测试存档',opening);
  }
  report.coldStartMs=await open(url);
  assert(report.events.includes('SUI_E|ready|'+manifest.runtimeBuildId));
  report.coldStats=await page.evaluate(()=>{const {cacheWrite,...stats}=suiCoreLoadStats;return stats;});
  assert.equal(report.coldStats.source,'network');assert.equal(report.coldStats.networkBytes,manifest.core.bytes);
  await page.screenshot({path:path.join(out,'title.png')});check('优化包冷启动及完整校验',report.coldStartMs);
  if(option==='--public'){
    await click(320,665);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')));await settle();
    opening=fields(await latest()).cursor;assert(opening);
    await click(1160,48);await click(120,270);await click(870,90);await click(950,250);await click(120,625);
    assert(report.events.some(x=>x.startsWith('SUI_E|save|slot=1|')&&fields(x).cursor===opening));
  }else{
    await click(560,665);await click(1100,90);await click(950,250);
    assert.equal(fields(await latest()).cursor,opening);check('原发布包存档跨分发版本读取',opening);
  }
  await page.screenshot({path:path.join(out,'restored.png')});
  await page.waitForFunction(()=>suiCoreLoadStats.cacheStored,null,{timeout:60000});
  const count=report.coreResponses.length;
  report.warmStartMs=await open(url);await settle();
  report.warmStats=await page.evaluate(()=>{const {cacheWrite,...stats}=suiCoreLoadStats;return stats;});
  assert.equal(report.warmStats.source,'local-cache');assert.equal(report.warmStats.networkBytes,0);assert.equal(report.coreResponses.length,count);
  check('重载复用本机已校验资源且没有重复下载',report.warmStartMs);
  await click(560,665);await click(1100,90);await click(950,250);assert.equal(fields(await latest()).cursor,opening);
  check('缓存重载后存档位置保持',opening);
  report.databaseNames=await page.evaluate(async()=>(await indexedDB.databases()).map(x=>x.name));
  report.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})));
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='pass';
}catch(error){report.status='fail';report.error=error.stack;console.error(error.stack);process.exitCode=1;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
}finally{clearInterval(timer);if(context)await context.close();if(browser)await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}})();
