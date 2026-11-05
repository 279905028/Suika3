#!/usr/bin/env node
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../..'),[preview,gamePort,out]=process.argv.slice(2),dir=path.join(ROOT,out);assert(!fs.existsSync(dir));fs.mkdirSync(dir,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,preview,'runtime/build-manifest.json'))),items=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/current/motion/manifest.json'))).items;
const report={status:'running',runtimeBuildId:manifest.runtimeBuildId,scope:'正式网页包的独立媒体夹具：临时上下文预置29项动态解锁，仅检验图鉴播放/格式/隐藏与显示/布局；不作为剧情触发或实际获得解锁证据',checks:[],clips:[],errors:[]};let browser,proc,p,ctx;
const check=(name,value=true)=>{assert(value,name);report.checks.push(name);console.log('PASS '+name);};
(async()=>{try{
 if(process.env.P5_MEDIA_HEADLESS==='1'){browser=await chromium.launch({channel:'chrome',headless:true});ctx=await browser.newContext({viewport:{width:1280,height:800}});p=await ctx.newPage();report.browser=browser.version();report.background='独立无头媒体专项，不验证真实后台';await p.goto('http://127.0.0.1:'+gamePort);}
 else {
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'suika-p5-gallery-'));report.profile=profile;
 proc=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','http://127.0.0.1:'+gamePort],{stdio:'ignore'});
 for(let i=0;i<100&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await new Promise(r=>setTimeout(r,100));
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{noDefaults:true});ctx=browser.contexts()[0];p=ctx.pages().find(p=>p.url().includes('127.0.0.1:'+gamePort))||ctx.pages()[0];report.browser=browser.version();
 }
 p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
 await p.waitForFunction(()=>window.suie?.events.includes('SUI_M|ready'),null,{timeout:90000});await p.waitForTimeout(500);
 const requests=[];p.on('request',r=>{if(r.url().includes('/motion/')&&r.url().endsWith('.mp4'))requests.push(r.url());});
 check('标题阶段未请求剧情视频',await p.evaluate(()=>!performance.getEntriesByType('resource').some(r=>r.name.includes('/motion/')&&r.name.endsWith('.mp4'))));
 await p.evaluate(keys=>{endingMotion.unlocks=new Set(keys);},items.map(i=>i.key));
 for(let i=0;i<items.length;i++){
  const item=items[i];await p.locator('#mcg-gallery').click();await p.locator('dialog button').filter({hasText:item.title+' · 播放'}).click();await p.waitForFunction(k=>endingMotion.visible&&endingMotion.key===k,item.key,{timeout:20000});
  const before=await p.evaluate(()=>({key:endingMotion.key,width:endingMotion.video.videoWidth,height:endingMotion.video.videoHeight,duration:endingMotion.video.duration,muted:endingMotion.video.muted,hidden:document.hidden}));assert(before.muted&&before.width>=1280&&before.height>=720);
  if(i===0&&process.env.P5_MEDIA_HEADLESS!=='1'){
   const q=await ctx.newPage();await q.goto('about:blank');await q.bringToFront();await p.waitForFunction(()=>document.hidden,null,{timeout:10000});await p.waitForTimeout(250);
   const t=await p.evaluate(()=>endingMotion.video.currentTime);await p.waitForTimeout(700);check('真实后台document.hidden为true且视频时间暂停',await p.evaluate(t=>document.hidden&&endingMotion.video.paused&&Math.abs(endingMotion.video.currentTime-t)<.1,t));
   await q.close();await p.waitForFunction(()=>!document.hidden&&endingMotion.video&&!endingMotion.video.paused,null,{timeout:10000});check('关闭前台标签后实际恢复原镜头');
  }
  await p.waitForFunction(()=>endingMotion.phase==='static'&&endingMotion.gallery,null,{timeout:15000});const state=await p.evaluate(()=>({phase:endingMotion.phase,video:!!endingMotion.video,bridge:mcgBridge.state,context:endingMotion.contextKey}));assert(!state.video&&state.bridge.desired===true);
  report.clips.push({...before,finished:true});await p.locator('.mcg-close').click();console.log('PLAY '+item.key);
 }
 check('29段图鉴视频逐片完整播放且静音',report.clips.length===29);check('图鉴返回没有原生剧情推进',await p.evaluate(()=>!suie.events.some(l=>l.startsWith('SUI_E|new|')||l.startsWith('SUI_E|stable|'))));
 await p.setViewportSize({width:844,height:390});await p.locator('#mcg-gallery').click();await p.locator('dialog button').filter({hasText:items[0].title+' · 播放'}).click();await p.waitForFunction(()=>endingMotion.visible);
 check('844×390横屏媒体与画布等比对齐',await p.evaluate(()=>{const a=endingMotion.layer.getBoundingClientRect(),b=endingMotion.canvas.getBoundingClientRect();return Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2&&a.x>=0&&a.y>=0&&a.right<=innerWidth+1&&a.bottom<=innerHeight+1;}));await p.screenshot({path:path.join(dir,'landscape.png')});await p.locator('.mcg-close').click();
 await p.setViewportSize({width:1280,height:800});await p.locator('#fullscreen').click();await p.waitForFunction(()=>document.fullscreenElement?.id==='canvas_holder');await p.locator('#mcg-gallery').click();await p.locator('dialog button').filter({hasText:items[0].title+' · 播放'}).click();await p.waitForFunction(()=>endingMotion.visible);check('全屏图鉴视频与画布对齐',await p.evaluate(()=>{const a=endingMotion.layer.getBoundingClientRect(),b=endingMotion.canvas.getBoundingClientRect();return Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;}));await p.screenshot({path:path.join(dir,'fullscreen.png')});await p.locator('.mcg-close').click();await p.evaluate(()=>document.exitFullscreen());
 report.requests=requests;report.mediaEvents=await p.evaluate(()=>endingMotion.events);report.databases=await p.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));assert(report.databases.every(n=>n.startsWith(manifest.databasePrefix)));check('临时独立存储与无媒体异常',report.errors.length===0&&!report.mediaEvents.some(e=>['media-error','load-timeout','autoplay-rejected'].includes(e.type)));report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);if(p){await p.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});report.mediaEvents=await p.evaluate(()=>endingMotion.events).catch(()=>[]);}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(proc)proc.kill();}
})();
