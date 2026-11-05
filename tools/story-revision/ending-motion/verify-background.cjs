#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {ROOT,write}=require('./prepare.cjs'),{items}=require('./manifest.cjs');
async function run(){
 const base='qa/ending-motion-P4-V-T-20261104',web=path.join(ROOT,base,'probe-v4/web'),out=base+(process.argv.includes('--six-only')?'/six-nodes-v2':'/background-v2');assert(!fs.existsSync(path.join(ROOT,out)));fs.mkdirSync(path.join(ROOT,out));
 const r={status:'running',scope:'本机Chrome临时资料目录；真实切标签与六个合成触发点',checks:[],errors:[]};let browser,server,p;
 try{
  server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(name.includes('/')||name.includes('..')){res.writeHead(404);res.end();return;}const f=path.join(web,name);if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.mp4')?'video/mp4':name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome',headless:process.argv.includes('--six-only')});const ctx=await browser.newContext({viewport:{width:1280,height:800}});p=await ctx.newPage();p.on('pageerror',e=>r.errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>window.endingMotion?.visible,null,{timeout:60000});
  if(!process.argv.includes('--six-only')){
  const away=await ctx.newPage();await away.goto('about:blank');await away.bringToFront();await p.waitForFunction(()=>document.hidden&&endingMotion.video.paused);const t=await p.evaluate(()=>endingMotion.video.currentTime);await p.waitForTimeout(600);assert(Math.abs(await p.evaluate(()=>endingMotion.video.currentTime)-t)<.08);r.checks.push('真实切标签时document.hidden=true，视频暂停');
  await p.bringToFront();await p.waitForFunction(()=>!document.hidden&&!endingMotion.video.paused);r.checks.push('返回原标签仅恢复当前镜头');await away.close();
  }else r.scope='独立Suika Wasm六个合成触发点；真实切标签待验';
  const key=async k=>{await p.locator('#canvas').focus();await p.keyboard.press(k,{delay:90});await p.waitForTimeout(260);};
  for(let i=0;i<items.length;i++){
   const item=items[i];await p.waitForFunction(k=>endingMotion.contextKey===k&&endingMotion.visible,item.key);
   await key('Enter');assert.equal(await p.evaluate(()=>endingMotion.phase),'static');
   for(let n=0;n<3;n++){if(await p.evaluate(()=>endingMotion.contextKey===''))break;await key('Enter');}
   assert(await p.evaluate(()=>endingMotion.contextKey===''));r.checks.push(item.ending+'真实引擎入镜、跳过、出镜清理');
   if(i<items.length-1)for(let n=0;n<3;n++){await key('Enter');if(await p.evaluate(()=>endingMotion.contextKey!==''))break;}
  }
  assert.equal(await p.evaluate(()=>endingMotion.unlocks.size),6);r.checks.push('六个合成正例可见后各解锁一次');
  await p.evaluate(()=>{endingMotion.openGallery();endingMotion.onLog('SUI_M|exit');});assert.equal(await p.locator('dialog').count(),0);r.checks.push('宿主退出通知同时清理图鉴对话框');
  assert.equal(r.errors.length,0);r.status='pass';r.browser=browser.version();await p.screenshot({path:path.join(ROOT,out,'complete.png')});
 }catch(e){r.status='fail';r.error=e.stack;throw e;}finally{if(p){r.engineEvents=await p.evaluate(()=>p4vEvents).catch(()=>[]);r.mediaEvents=await p.evaluate(()=>endingMotion.events).catch(()=>[]);}if(browser)await browser.close();if(server)await new Promise(x=>server.close(x));write(out+'/report.json',r);}
 console.log(JSON.stringify({status:r.status,checks:r.checks.length}));
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
