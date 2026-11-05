#!/usr/bin/env node
'use strict';
// A raw CDP connection does not install Playwright's focus emulation.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,process.argv[2]);assert(process.argv[2]?.startsWith('qa/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let proc,ws,id=0;const pending=new Map();
const report={date:'2026-11-05',status:'running',scope:'正式v5播放器的独立媒体夹具；独立临时Chrome、原始CDP、没有焦点或可见性模拟；不是完整剧情或存档测试',checks:[],events:[]};
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method))},15000);pending.set(key,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})}));});}
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS '+name)};
(async()=>{try{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'suika-p5-raw-background-'));report.profile=profile;
 proc=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','http://127.0.0.1:49357/'],{stdio:'ignore'});report.pid=proc.pid;
 const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(100);assert(fs.existsSync(active),'Chrome调试端口未启动');const [port,route]=fs.readFileSync(active,'utf8').trim().split('\n');ws=new WebSocket('ws://127.0.0.1:'+port+route);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method)report.events.push({method:m.method,params:m.params,sessionId:m.sessionId});};
 report.browser=await send('Browser.getVersion');let target;for(let i=0;i<100&&!target;i++){target=(await send('Target.getTargets')).targetInfos.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:49357'));if(!target)await sleep(100);}assert(target,'未找到本机媒体夹具标签');
 const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});report.targetId=target.targetId;
 await send('Runtime.enable',{},sessionId);await send('Page.enable',{},sessionId);
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async(expression,limit=10000)=>{const end=Date.now()+limit;while(!await evaluate(expression)){if(Date.now()>end)throw Error('等待超时 '+expression);await sleep(60);}};
 await until('window.endingMotion?.ready && document.getElementById("background")');report.before=await evaluate('({hidden:document.hidden,state:document.visibilityState,focus:document.hasFocus()})');
 await send('Target.activateTarget',{targetId:target.targetId});
 await evaluate('document.getElementById("background").click()');await until('endingMotion.visible && !!endingMotion.video');report.visibleBefore=await evaluate('({hidden:document.hidden,key:endingMotion.key,time:endingMotion.video.currentTime,paused:endingMotion.video.paused})');check('首帧确实在前台播放',!report.visibleBefore.hidden&&!report.visibleBefore.paused);
 const other=await send('Target.createTarget',{url:'about:blank',background:false,newWindow:false});report.otherTargetId=other.targetId;await send('Target.activateTarget',{targetId:other.targetId});
 await until('document.hidden');await sleep(150);const paused=await evaluate('({hidden:document.hidden,time:endingMotion.video?.currentTime,paused:endingMotion.video?.paused,key:endingMotion.key})');await sleep(1200);report.hidden={before:paused,after:await evaluate('({hidden:document.hidden,time:endingMotion.video?.currentTime,paused:endingMotion.video?.paused,key:endingMotion.key})')};check('真实隐藏并暂停，1.2秒内媒体时间不推进',paused.hidden&&paused.paused&&report.hidden.after.hidden&&report.hidden.after.paused&&Math.abs(report.hidden.after.time-paused.time)<.1);
 await send('Target.closeTarget',{targetId:other.targetId});await send('Target.activateTarget',{targetId:target.targetId});await until('!document.hidden && endingMotion.video && !endingMotion.video.paused');const resumed=await evaluate('({hidden:document.hidden,time:endingMotion.video.currentTime,paused:endingMotion.video.paused,key:endingMotion.key})');await sleep(500);report.resumed={before:resumed,after:await evaluate('({hidden:document.hidden,time:endingMotion.video?.currentTime,paused:endingMotion.video?.paused,key:endingMotion.key})')};check('实际回到原标签后继续同镜头',!resumed.hidden&&!resumed.paused&&resumed.key===paused.key&&report.resumed.after.time>resumed.time+.2);
 report.fixture=await evaluate('compatReport');report.mediaEvents=await evaluate('endingMotion.events');report.naturalEndScope='29片自然结束在gallery-v5-headless报告验证；本项只验证真实后台暂停恢复与退出';await evaluate('endingMotion.closeGallery()');check('恢复后退出清理播放器并释放暂停',await evaluate('!endingMotion.video && !endingMotion.gallery && !fixtureHold'));
 const screenshot=await send('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(out,'returned.png'),Buffer.from(screenshot.data,'base64'));report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(ws?.readyState===1){try{await send('Browser.close')}catch{}ws.close();}if(proc)proc.kill();}
})();
