'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'motion');
(async()=>{let b;const r={scope:'两个独立动画在Chrome实际自动循环；像素与时长另见各exports.json',errors:[]};try{
 b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1500,height:700}});p.on('pageerror',e=>r.errors.push(e.message));
 await p.goto('file://'+path.join(root,'assets/sources/20261030-cover-b-motion/index.html'));
 await p.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.videoWidth===1280&&v.currentTime>0.2&&!v.paused),null,{timeout:20000});
 r.videos=await p.locator('video').evaluateAll(vs=>vs.map(v=>({id:v.id,width:v.videoWidth,height:v.videoHeight,duration:v.duration,muted:v.muted,loop:v.loop,paused:v.paused})));
 await p.waitForTimeout(2500);await p.screenshot({path:path.join(out,'two-options-playback.png')});
 await p.waitForFunction(()=>motionLoops.b1>=1&&motionLoops.b2>=1,null,{timeout:15000});r.loops=await p.evaluate(()=>motionLoops);
 assert.equal(r.videos.length,2);assert(r.videos.every(v=>v.loop&&v.muted&&v.duration===8));assert(r.loops.b1>=1&&r.loops.b2>=1);assert.equal(r.errors.length,0);r.pass=true;
}catch(e){r.pass=false;r.failure=e.stack;process.exitCode=1}finally{fs.writeFileSync(path.join(out,'playback-report.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));if(b)await b.close()}})();
