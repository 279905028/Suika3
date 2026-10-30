'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const version=process.argv[2],port=process.argv[3],out=path.join(__dirname,version,'browser');fs.mkdirSync(out,{recursive:true});
const report={version,checks:[],errors:[],logs:[],scope:'独立Chrome资料；原生游戏电影侧栏专项'};
let browser,page;
const state=()=>report.logs.filter(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)).at(-1);
const cursor=()=>state()?.match(/\|cursor=([^|]+)/)?.[1];
const check=n=>{report.checks.push(n);console.log('PASS '+n)};
const wait=async()=>{await page.waitForTimeout(400);await page.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError)};
const click=async(x,y)=>{const b=await page.locator('#canvas').boundingBox();await page.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});await wait()};
const key=async k=>{await page.locator('#canvas').focus();await page.keyboard.press(k,{delay:70});await wait()};
const shot=async n=>{if(!n.includes('keyboard'))await page.mouse.move(2,2);await page.locator('#canvas').screenshot({path:path.join(out,n+'.png')})};
async function files(){return page.evaluate(()=>{const rows=[];function walk(p){for(const n of suie.fs.readdir(p)){if(n==='.'||n==='..')continue;const q=p+'/'+n,s=suie.fs.stat(q);if(suie.fs.isDir(s.mode))walk(q);else rows.push({path:q,bytes:s.size});}}walk(suie.mount);return rows;});}
async function next(){const old=cursor();for(let i=0;i<8&&cursor()===old;i++){if(state()?.includes('|tag=choose|'))await click(980,168);else await key('Enter')}assert.notEqual(old,cursor())}
(async()=>{try{
 browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'});page=await ctx.newPage();
 page.on('console',m=>{if(m.text().startsWith('SUI_'))report.logs.push(m.text());if(m.type()==='error'||/^Error:/.test(m.text()))report.errors.push(m.text())});page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});
 await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await wait();await shot('01-title');check('原生引擎启动并保留当前封面');
 await click(880,664);await shot('02-settings-title');await key('Escape');check('标题设置进入电影侧栏并返回');
 await click(1040,664);await shot('03-gallery-title');await click(1150,616);await shot('04-gallery-page2');await key('Escape');check('标题图鉴侧栏、分页与返回');
 await click(320,664);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')));await shot('05-reading');const first=cursor();
 await click(1168,52);await shot('06-menu');await click(130,430);await shot('07-settings');await click(1000,260);await click(130,270);await shot('08-load');await click(892,92);await shot('09-save');await click(980,260);await key('Escape');assert.equal(cursor(),first);check('菜单→设置→存读档→保存切换，保存不推进正文');
 await next();const later=cursor();await click(1168,52);await click(130,270);await click(980,260);assert.equal(cursor(),first);await shot('10-restored');check('电影侧栏读取手动档还原正文位置');
 await click(1168,52);await click(130,350);await shot('11-history');await click(130,430);await shot('12-history-to-settings');await click(130,510);await shot('13-settings-to-gallery');await click(130,270);await shot('14-gallery-to-load');await key('Escape');assert.equal(cursor(),first);check('回顾/设置/图鉴/读档连续切换保留原段');
 while(cursor()!=='C01-01')await next();
 for(let i=0;i<6&&!state().includes('|tag=choose|');i++)await click(1240,700);
 assert(state().includes('|tag=choose|'));await shot('15-choice');const before=cursor();
 await click(1168,52);await click(130,270);await click(892,92);await click(980,500);await key('Escape');await click(980,168);await next();
 await click(1168,52);await click(130,270);await click(980,500);assert.equal(cursor(),before);await shot('16-choice-restored');check('原生选择页手动保存、读取后显示原选项');
 await key('ArrowDown');await shot('17-choice-keyboard');await key('Enter');assert.notEqual(cursor(),before);check('选择仍可通过方向键与回车提交');
 report.filesBeforeReload=await files();const loadsBefore=report.logs.filter(l=>l.startsWith('SUI_E|load|slot=3|')).length;
 await page.reload();await page.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:60000});await wait();report.filesAfterReload=await files();await click(640,664);await click(980,500);assert.equal(report.logs.filter(l=>l.startsWith('SUI_E|load|slot=3|')).length,loadsBefore+1);assert.equal(cursor(),before);check('刷新后从标题读取原生选择存档');
 await page.setViewportSize({width:844,height:390});await wait();await shot('18-choice-mobile');await click(1168,52);await click(130,430);await shot('19-settings-mobile');await key('Escape');check('844×390横屏模拟显示选择与系统页');
 assert.deepEqual(report.errors,[]);report.pass=true;report.databases=await page.evaluate(async()=>await indexedDB.databases());
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);if(page)await shot('failure').catch(()=>{});process.exitCode=1}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close()}})();
