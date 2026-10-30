'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'motion');
(async()=>{let b;const r={scope:'Chrome实际播放一次循环；文件解码和首尾像素另见exports.json',errors:[]};try{
 b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1280,height:820}});p.on('pageerror',e=>r.errors.push(e.message));
 await p.goto('file://'+path.join(root,'assets/sources/20261030-cover-a-motion/index.html'));
 await p.waitForFunction(()=>{const v=document.querySelector('video');return v.videoWidth===1280&&v.currentTime>0.2&&!v.paused},null,{timeout:20000});
 r.initial=await p.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,muted:v.muted,loop:v.loop,paused:v.paused}));
 await p.locator('video').screenshot({path:path.join(out,'playback.png')});
 await p.waitForFunction(()=>window.motionLoops>=1,null,{timeout:12000});
 r.loops=await p.evaluate(()=>window.motionLoops);assert(r.initial.loop&&r.initial.muted&&r.loops>=1);assert.equal(r.errors.length,0);r.pass=true;
}catch(e){r.pass=false;r.failure=e.stack;process.exitCode=1}finally{fs.writeFileSync(path.join(out,'playback-report.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));if(b)await b.close()}})();
