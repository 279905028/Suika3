'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../..'),out=path.join(__dirname,'browser-final');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'build/sui-i02-20261030-cover-a-v1/wasm/build-manifest.json')));
const report={version:'sui-i02-20261030-cover-a-v1',runtimeBuildId:manifest.runtimeBuildId,scope:'独立浏览器存储；标题封面、四个菜单入口、开场及尺寸模拟',checks:[],errors:[],logs:[]};
let browser,ctx,page;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name)};
async function settle(){await page.waitForTimeout(450);await page.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:30000});}
async function click(x,y){const r=await page.locator('#canvas').boundingBox();await page.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:80});await settle();}
async function key(k){await page.locator('#canvas').focus();await page.keyboard.press(k,{delay:70});await settle();}
async function shot(name){await page.mouse.move(1,1);await page.waitForTimeout(160);await page.locator('#canvas').screenshot({path:path.join(out,name+'.png')});}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});ctx=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});page=await ctx.newPage();
 page.on('console',m=>{if(m.text().startsWith('SUI_'))report.logs.push(m.text());if(m.type()==='error')report.errors.push(m.text());});page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',async d=>{if(!d.message().startsWith('SUI_'))report.errors.push(d.message());await d.dismiss()});
 await page.goto('http://127.0.0.1:49248/');await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await settle();assert(report.logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));await shot('01-title-desktop');check('新封面版本实际载入，桌面标题截图');
 await click(880,664);await shot('02-settings');await key('Escape');await shot('03-settings-return');check('底部设置入口与返回');
 await click(1040,664);await shot('04-gallery');await key('Escape');await shot('05-gallery-return');check('底部图鉴入口与返回');
 await click(640,664);await shot('06-continue-empty');await key('Escape');await shot('07-continue-return');check('底部继续入口与空档返回');
 await page.setViewportSize({width:844,height:390});await settle();await shot('08-title-mobile-landscape');const box=await page.locator('#canvas').boundingBox();assert(box.width<=844&&box.height<=390);check('844×390横屏模拟完整呈现标题与菜单');
 await page.setViewportSize({width:375,height:667});await settle();assert(await page.locator('#rotate').isVisible());await page.screenshot({path:path.join(out,'09-portrait-rotate.png')});check('375×667竖屏模拟显示旋转提示');
 await page.setViewportSize({width:1280,height:800});await settle();await click(320,664);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:30000});await shot('10-start-reading');check('底部开始入口进入正式正文');
 const before=report.logs.filter(x=>x.startsWith('SUI_E|stable|')).at(-1);let after=before;for(let i=0;i<8&&after===before;i++){await key('Enter');after=report.logs.filter(x=>x.startsWith('SUI_E|stable|')).at(-1);}assert.notEqual(before,after);await shot('11-opening-next');check('正式开场打字完成后正常推进');
 assert.equal(report.errors.length,0);report.pass=true;report.browser=await browser.version();
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e.stack)}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close()}})();
