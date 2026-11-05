#!/usr/bin/env node
'use strict';
const C=require('../p4-integration/common.cjs');
const {fs,path,assert,ROOT,write}=C;
const QA='qa/dialogue-p4-P4-07-20261104';
function freshOutput(rel){assert(rel.startsWith(QA+'/'));const dir=path.join(ROOT,rel);assert(!fs.existsSync(dir),'不覆盖检查');fs.mkdirSync(dir,{recursive:true});return dir;}
const http=require('node:http');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function verify({preview=QA+'/build-candidate',out=QA+'/browser-candidate'}={}) {
 const dir=freshOutput(out),web=path.join(ROOT,preview,'runtime/web'),report={status:'running',scope:'P4-07完整静态候选启动、图鉴和CG001全图冒烟；不是P5全路线/存档验收',checks:[],errors:[]};let server,browser,p;
 try {
  server=http.createServer((req,res)=>{const rel=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['index.html','assets.arc','shell.js','shell.css','title-motion.mp4','title-motion.js'].includes(rel)){res.writeHead(404);res.end();return;}const f=path.join(web,rel);res.setHeader('Content-Type',rel.endsWith('html')?'text/html':rel.endsWith('js')?'text/javascript':rel.endsWith('css')?'text/css':rel.endsWith('mp4')?'video/mp4':'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise((r,j)=>{server.on('error',j);server.listen(49317,'127.0.0.1',r);});
  browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'});p=await ctx.newPage();report.browser=browser.version();
  p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
  const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:100});};
  const key=async value=>{await p.locator('#canvas').focus();await p.keyboard.press(value,{delay:100});await p.waitForTimeout(200);};
  await p.goto('http://127.0.0.1:49317');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await p.waitForTimeout(800);
  await click(1040,665);await p.waitForTimeout(500);
  await p.mouse.move(1250,710);
  const pageHashes=[];
  const capturePage=async()=>require('node:crypto').createHash('sha256').update(await p.locator('#canvas').screenshot()).digest('hex');
  pageHashes.push(await capturePage());
  for(let i=0;i<13;i++){await key('PageDown');pageHashes.push(await capturePage());}
  assert.equal(new Set(pageHashes).size,14,'14次图鉴分页未产生不同页面');report.galleryPageHashes=pageHashes;
  await p.mouse.move(1250,710);await p.screenshot({path:path.join(dir,'cinema-gallery-page14-locked.png')});
  const last=await p.locator('#canvas').screenshot();await key('PageDown');assert(last.equals(await p.locator('#canvas').screenshot()),'末页越界改变画面');report.checks.push('电影图鉴末页无越界');
  await click(600,230);await p.waitForTimeout(250);assert((await p.evaluate(()=>suie.events)).every(x=>!x.startsWith('SUI_I|unlock|')));report.checks.push('登记和锁定缩略图点击不解锁');
  await p.setViewportSize({width:844,height:390});await p.waitForTimeout(300);await p.screenshot({path:path.join(dir,'cinema-gallery-844x390.png')});await p.setViewportSize({width:1280,height:800});await p.waitForTimeout(300);
  await click(125,625);await p.waitForTimeout(400);await click(320,665);await p.waitForTimeout(400);
  for(let i=0;i<80;i++){
    const events=await p.evaluate(()=>suie.events);if(events.some(x=>x.startsWith('SUI_I|unlock|cg=CG001|')))break;
    assert(!events.some(x=>x.startsWith('SUI_C|error')),'候选引擎报错');await click(420,700);await p.waitForTimeout(160);
  }
  let ev=await p.evaluate(()=>suie.events);assert(ev.some(x=>x.startsWith('SUI_I|unlock|cg=CG001|')),'CG001未可见');
  await p.screenshot({path:path.join(dir,'candidate-CG001-hint.png')});const stable=ev.findLast(x=>x.startsWith('SUI_E|stable|'));
  await click(120,48);await p.waitForTimeout(400);await p.screenshot({path:path.join(dir,'candidate-CG001-full.png')});await key('Escape');await p.waitForTimeout(400);
  await key('v');await key('v');await p.waitForTimeout(350);
  ev=await p.evaluate(()=>suie.events);assert(ev.includes('SUI_I|full-view|opened'));assert(ev.includes('SUI_I|full-view|closed'));assert.equal(ev.findLast(x=>x.startsWith('SUI_E|stable|')),stable);report.checks.push('真实候选CG001全图开关不推进正文');
  const dbs=await p.evaluate(async()=> (await indexedDB.databases()).map(d=>d.name));assert(dbs.length>0&&dbs.every(n=>n.startsWith('bijie-p4-07-isolated:')));report.databases=dbs;report.checks.push('仅独立测试存储');
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;if(p)await p.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});throw e;}
 finally{if(p)report.events=await p.evaluate(()=>window.suie?.events||[]).catch(()=>[]);if(browser)await browser.close();if(server?.listening)await new Promise(r=>server.close(r));write(dir,'report.json',report);}
 console.log(JSON.stringify({status:report.status,checks:report.checks.length}));
}
if(require.main===module)verify({preview:process.argv[2]||undefined,out:process.argv[3]||undefined}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={verify};
