'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),version=process.argv[2],port=Number(process.argv[3]),out=path.join(__dirname,process.argv[4]||'browser');
fs.mkdirSync(out,{recursive:true});const manifest=JSON.parse(fs.readFileSync(path.join(root,'build',version,'wasm/build-manifest.json')));
const report={version,runtimeBuildId:manifest.runtimeBuildId,checks:[],errors:[],logs:[],scope:'独立浏览器存储；标题动画、真实菜单/正文/存读档、尺寸模拟、媒体失败回退'};
let browser,ctx,p;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name)};
const settle=async()=>{await p.waitForTimeout(400);await p.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:30000});};
const click=async(x,y)=>{const r=await p.locator('#canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:90});await settle();};
const key=async(k)=>{await p.locator('#canvas').focus();await p.keyboard.press(k,{delay:80});await settle();};
const visible=()=>p.waitForFunction(()=>suiTitleMotion.visible&&!suiTitleMotion.video.paused&&suiTitleMotion.video.currentTime>0.15,null,{timeout:20000});
const hidden=()=>p.waitForFunction(()=>!suiTitleMotion.visible&&suiTitleMotion.video.hidden&&suiTitleMotion.video.paused,null,{timeout:10000});
const state=()=>report.logs.findLast(x=>x.startsWith('SUI_E|stable|'));
const cursor=()=>state()?.match(/\|cursor=([^|]+)/)?.[1];
const shot=async n=>{await p.mouse.move(1,1);await p.locator('#canvas_holder').screenshot({path:path.join(out,n+'.png')});};
async function open(blockMedia=false){
 ctx=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});p=await ctx.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.text().startsWith('SUI_'))report.logs.push(m.text());if(m.type()==='error'&&!blockMedia)report.errors.push(m.text());});p.on('dialog',async d=>{if(!d.message().startsWith('SUI_'))report.errors.push(d.message());await d.dismiss()});
 if(blockMedia)await p.route('**/title-motion.mp4',r=>r.abort('failed'));
 await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await settle();
 assert(report.logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));
}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});await open();await visible();
 assert.equal(await p.locator('#title-motion').evaluate(v=>getComputedStyle(v).pointerEvents),'none');
 const before=await p.locator('#title-motion').evaluate(v=>v.currentTime);await p.waitForTimeout(1000);assert(await p.locator('#title-motion').evaluate(v=>v.currentTime)>before);await shot('01-animated-title');check('实际游戏标题自动静音播放方案一，视频不拦截菜单输入');
 await p.waitForFunction(()=>suiTitleMotion.loops>=1,null,{timeout:12000});report.loop=await p.evaluate(()=>({loops:suiTitleMotion.loops,duration:suiTitleMotion.video.duration,muted:suiTitleMotion.video.muted}));assert(report.loop.muted&&report.loop.duration===8);check('8秒动画至少完成一次真实循环');
 for(const [name,x] of [['settings',880],['gallery',1040],['continue',640]]){await click(x,664);await hidden();await shot('02-'+name+'-paused');await key('Escape');await visible();check(name+'面板打开暂停，返回标题恢复');}
 await p.setViewportSize({width:844,height:390});await settle();const fit=await p.evaluate(()=>{const a=document.querySelector('canvas').getBoundingClientRect(),b=document.querySelector('#title-motion').getBoundingClientRect();return {dx:Math.abs(a.x-b.x),dy:Math.abs(a.y-b.y),dw:Math.abs(a.width-b.width),dh:Math.abs(a.height-b.height)}});assert(Object.values(fit).every(x=>x<1));await shot('03-landscape');report.fit=fit;check('844×390横屏模拟动画与原生菜单画布重合');
 await p.setViewportSize({width:375,height:667});await settle();assert(await p.locator('#rotate').isVisible());await p.screenshot({path:path.join(out,'04-portrait.png')});check('竖屏模拟旋转提示保持可见');await p.setViewportSize({width:1280,height:800});await settle();
 await click(320,664);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:30000});await hidden();await shot('05-reading');const saved=cursor();check('开始正文后动画立即隐藏并暂停');
 await click(1168,52);await click(130,270);await click(892,92);await click(980,260);await key('Escape');assert(report.logs.some(x=>x.startsWith('SUI_E|save|slot=1|')));check('正文通过电影侧栏保存独立手动档');
 await click(1168,52);await click(980,350);await click(520,430);await visible();await shot('06-return-title');check('通过实际菜单返回标题，方案一重新循环');
 await click(640,664);await hidden();await click(980,260);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|load|slot=1|')),null,{timeout:30000});assert.equal(cursor(),saved);await hidden();check('从标题读取手动档后恢复正文且动画保持暂停');
 await ctx.close();await open(true);await p.waitForFunction(()=>suiTitleMotion.failed,null,{timeout:20000});await hidden();await shot('07-media-fallback');await click(320,664);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:30000});check('媒体请求失败回退静态B，开始按钮仍进入正文');
 assert.equal(report.errors.length,0,report.errors.join('\n'));report.pass=true;report.browser=await browser.version();
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e.stack);if(p)try{await shot('failure')}catch{}}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close()}})();
