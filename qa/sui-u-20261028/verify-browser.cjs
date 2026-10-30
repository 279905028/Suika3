const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,url='http://127.0.0.1:49218',profile=fs.mkdtempSync(path.join(os.tmpdir(),'sui-u-qa-'));
const report={date:'2026-10-28',layer:'Suika3 Wasm; Chrome desktop + mobile viewport emulation; not physical phones',profile,build:JSON.parse(fs.readFileSync(path.join(dir,'build-manifest.json'))),checks:[],errors:[],screenshots:[]};
let context,page;
async function launch(touch=false){
 context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,hasTouch:touch,timezoneId:'Asia/Shanghai',viewport:{width:1440,height:900}});
 page=context.pages()[0];
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
}
async function ready(){await page.waitForFunction(()=>window.suiu?.ready&&suiu.events.includes('SUI_U|screen|title'),{},{timeout:30000});await settle()}
async function settle(){await page.waitForTimeout(260);await page.waitForFunction(()=>!suiu.pending&&!suiu.busy&&!suiu.storageError,{},{timeout:10000})}
async function key(k){await page.locator('#canvas').focus();await page.keyboard.down(k);await page.waitForTimeout(90);await page.keyboard.up(k);await settle()}
async function click(x,y){const r=await page.locator('#canvas').boundingBox();await page.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:90});await settle()}
async function drag(x1,y1,x2,y2){const r=await page.locator('#canvas').boundingBox();await page.mouse.move(r.x+x1*r.width/1280,r.y+y1*r.height/720);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.move(r.x+x2*r.width/1280,r.y+y2*r.height/720,{steps:12});await page.waitForTimeout(180);await page.mouse.up();await settle()}
async function eventAction(action,pattern){const n=await page.evaluate(()=>suiu.events.length);await action();await page.waitForFunction(({n,pattern})=>suiu.events.slice(n).some(e=>e.includes(pattern)),{n,pattern},{timeout:7000});return page.evaluate(({n,pattern})=>suiu.events.slice(n).find(e=>e.includes(pattern)),{n,pattern})}
async function state(){return eventAction(()=>key('i'),'SUI_U|state|')}
async function advanceTo(pattern){
 const n=await page.evaluate(()=>suiu.events.length);
 await key('Enter');
 if(!(await page.evaluate(({n,pattern})=>suiu.events.slice(n).some(e=>e.includes(pattern)),{n,pattern})))await key('Enter');
 await page.waitForFunction(({n,pattern})=>suiu.events.slice(n).some(e=>e.includes(pattern)),{n,pattern},{timeout:7000});
}
async function shot(name){await page.screenshot({path:path.join(dir,'screenshots',name+'.png')});report.screenshots.push(name+'.png')}
async function historyContentHash(){await page.mouse.move(20,30);await settle();const r=await page.locator('#canvas').boundingBox();const b=await page.screenshot({clip:{x:r.x+100*r.width/1280,y:r.y+160*r.height/720,width:1000*r.width/1280,height:180*r.height/720}});return crypto.createHash('sha256').update(b).digest('hex')}
const check=(name,details)=>{report.checks.push({name,pass:true,details});console.log('PASS '+name)};
async function nativeFiles(){const list=await page.evaluate(()=>suiu.fs.readdir(suiu.mount).filter(n=>n!=='.'&&n!=='..').map(name=>({name,bytes:suiu.fs.stat(suiu.mount+'/'+name).size})));return list.map(f=>({...f,decodedName:Buffer.from(f.name,'hex').toString('utf8')}))}
async function menu(){await click(1168,52);assert.equal(field(await state(),'gui'),'1')}
async function closeGUI(){await key('Escape')}
function field(line,name){const m=line.match(new RegExp('(?:\\||^)'+name+'=([^|]+)'));assert(m,line);return m[1]}

(async()=>{try{
 await launch();await page.goto(url);await ready();
 report.runtime=await page.evaluate(()=>({mount:suiu.mount,canvas:[canvas.width,canvas.height],wasmBytes:wasmMemory.buffer.byteLength}));
 await shot('01-title');check('标题页原生启动、1280×720与独立存档库',report.runtime);

 await click(240,466);await shot('02-load-empty');
 const emptyBefore=await state();await click(280,256);const emptyAfter=await state();
 assert.equal(field(emptyBefore,'stage'),field(emptyAfter,'stage'));
 assert.deepEqual(await nativeFiles(),[]);await closeGUI();check('继续阅读进入读档，空档不读取也不创建进度');

 await click(160,542);await shot('03-settings');const initialSettings=await state();
 await drag(726+408*Number(field(initialSettings,'textspeed')),235,820,235);await drag(512,235,260,235);await drag(726+408*(1-Number(field(initialSettings,'autospeed'))),359,1070,359);
 await closeGUI();const settings=await state();assert(Number(field(settings,'textspeed'))<0.99,settings);assert(Number(field(settings,'bgm'))<0.99,settings);assert(Number(field(settings,'autospeed'))!==0.5,settings);
 check('设置滑块拖动后保持值',settings);

 await eventAction(()=>click(320,542),'SUI_U|screen|gallery');await shot('04-gallery-locked');
 await eventAction(()=>click(240,235),'gallery-locked|index=0');check('无解锁标记的CG拒绝打开');
 for(let i=2;i<=9;i++)await eventAction(()=>key('PageDown'),'gallery-page|page='+i);
 await shot('05-gallery-last-page');let n=await page.evaluate(()=>suiu.events.length);await key('PageDown');
 assert(!(await page.evaluate(n=>suiu.events.slice(n).some(e=>e.includes('gallery-page')),n)));
 for(let i=8;i>=1;i--)await eventAction(()=>key('PageUp'),'gallery-page|page='+i);
 check('52项图鉴九页、末页边界和返回首页');
 await eventAction(()=>key('u'),'fixture-unlock|value=1');await shot('06-gallery-unlocked-fixture');
 await eventAction(()=>click(640,235),'gallery-locked|index=1');
 await eventAction(()=>click(1040,235),'gallery-locked|index=2');check('缺少资源或解锁值非法时仍不能打开CG');
 await key('ArrowLeft');await key('ArrowLeft');
 await eventAction(()=>key('Enter'),'gallery-open|id=CG001');await shot('07-gallery-view-fixture');
 await eventAction(()=>key('Escape'),'gallery-close|grid');
 await eventAction(()=>click(1148,60),'gallery-close|title');check('图鉴解锁样本、键盘打开、全图等比展示和返回');

 await eventAction(()=>click(240,386),'screen|reading-1');await shot('08-reading');
 let files=await nativeFiles();assert(files.some(f=>f.decodedName==='000.sav'));check('正文显示与自动档写回',files);
 await menu();await shot('09-menu');await click(260,230);await shot('10-save-empty');
 await click(920,256);files=await nativeFiles();assert(files.some(f=>f.decodedName==='001.sav'),JSON.stringify(files));await shot('11-save-filled');await closeGUI();
 check('手动档1原生保存、缩略图、时间与章节',files);
 await advanceTo('screen|reading-2');await shot('12-namebox');
 await menu();await click(260,230);await click(280,498);await closeGUI();
 for(let i=0;i<20;i++){if(await page.evaluate(()=>suiu.events.includes('SUI_U|screen|choices')))break;await key('Enter')}
 await page.waitForFunction(()=>suiu.events.includes('SUI_U|screen|choices'));await shot('13-six-choices');
 await eventAction(()=>click(640,628),'screen|selected');assert.equal(field(await state(),'choice'),'friends');
 await menu();await click(260,230);await click(920,498);await closeGUI();const slots=await nativeFiles();for(const n of ['000.sav','001.sav','002.sav','003.sav'])assert(slots.some(f=>f.decodedName===n),n);check('三个手动档均可保存，自动档保留独立槽位',slots);

 await menu();await eventAction(()=>click(1020,230),'history-open|entries=8|pages=4');await shot('14-history');
 await eventAction(()=>click(640,420),'history-voice|ok=1|file=sound/se/click.ogg');check('回顾重听原生调用成功，声音为点击音效fixture');
 const historyBefore=await historyContentHash();
 await eventAction(()=>drag(1196,548,1196,168),'history-page|page=1');const historyAfter=await historyContentHash();assert.notEqual(historyBefore,historyAfter);await shot('15-history-scroll');
 await eventAction(()=>key('PageDown'),'history-page|page=2');await eventAction(()=>click(152,616),'history-page|page=1');
 await closeGUI();assert.equal(field(await state(),'stage'),'selected');check('回顾拖动、页键和按钮改变实际内容，返回保留阅读位置',{before:historyBefore,after:historyAfter});
 await menu();await click(1020,374);await shot('16-settings-in-game');await closeGUI();
 await menu();await click(640,230);await shot('17-load-filled');await click(920,256);let loaded=await state();
 assert.equal(field(loaded,'stage'),'reading-1');check('读档1恢复原生脚本位置',loaded);
 await menu();await click(640,230);await click(280,498);loaded=await state();assert.equal(field(loaded,'stage'),'reading-2');check('读档2恢复带姓名正文',loaded);
 await menu();await click(640,230);await click(920,498);loaded=await state();assert.equal(field(loaded,'choice'),'friends');assert.equal(field(loaded,'stage'),'selected');check('读档3恢复选择变量与选后正文',loaded);

 await menu();await click(260,558);await shot('18-confirm-title');await click(772,430);assert.equal(field(await state(),'stage'),'selected');
 await menu();await click(260,558);await eventAction(()=>click(500,430),'screen|title');check('返回标题确认与取消');
 await page.reload();await ready();await click(320,542);await eventAction(()=>key('Enter'),'gallery-open|id=CG001');await key('Escape');await click(1148,60);
 await click(240,466);await click(920,498);loaded=await state();assert.equal(field(loaded,'choice'),'friends');assert.equal(field(loaded,'stage'),'selected');
 check('刷新后手动档及全局图鉴解锁保持',loaded);
 await menu();await click(1020,374);await closeGUI();const afterReload=await state();
 for(const k of ['textspeed','autospeed','bgm'])assert(Math.abs(Number(field(afterReload,k))-Number(field(settings,k)))<0.00001,afterReload);check('设置值跨刷新保持，允许原生浮点序列化精度差',afterReload);

 const databases=await page.evaluate(async()=>await indexedDB.databases());
 assert(databases.every(d=>d.name.startsWith('bijie-rain-suika3-ui-20261028:')));check('浏览器数据库全部属于SUI-U独立命名空间',databases);
 await context.close();await launch();await page.goto(url);await ready();await click(240,466);await click(920,498);
 assert.equal(field(await state(),'choice'),'friends');check('关闭独立浏览器后重新打开仍可读档');

 await context.close();await launch(true);await page.goto(url);await ready();await click(240,466);await click(920,498);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);assert(await page.locator('#rotate').isVisible());await shot('19-mobile-portrait');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);assert(!(await page.locator('#rotate').isVisible()));
 const mobile=await page.evaluate(()=>{const r=canvas.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,innerWidth,innerHeight}});
 assert(mobile.x>=0&&mobile.y>=0&&mobile.x+mobile.w<=844&&mobile.y+mobile.h<=390);await shot('20-mobile-landscape');
 assert.equal(field(await state(),'choice'),'friends');check('手机尺寸竖屏提示、横屏等比完整显示，旋转保留状态',mobile);
 const r=await page.locator('#canvas').boundingBox();await page.touchscreen.tap(r.x+1168*r.width/1280,r.y+52*r.height/720);await settle();assert.equal(field(await state(),'gui'),'1');await shot('20b-mobile-touch-menu');
 await page.touchscreen.tap(r.x+1148*r.width/1280,r.y+60*r.height/720);await settle();const mobileReturn=await state();assert.equal(field(mobileReturn,'gui'),'0');assert.equal(field(mobileReturn,'choice'),'friends');check('手机模拟短触真正打开菜单并返回',mobileReturn);
 await advanceTo('screen|choices');await eventAction(()=>page.touchscreen.tap(r.x+640*r.width/1280,r.y+628*r.height/720),'screen|selected');assert.equal(field(await state(),'choice'),'friends');check('手机模拟短触实际选择第六项');
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(250);await shot('21-desktop-1280');
 await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(250);await shot('22-desktop-1920');
 check('1280与1920桌面尺寸完整显示');
 assert.deepEqual(report.errors,[]);check('原生错误、浏览器错误和异常弹窗为零');
 report.events=await page.evaluate(()=>suiu.events);report.passed=true;
 }catch(e){report.failure=e.stack;console.error(e);if(page)await shot('failure').catch(()=>{});process.exitCode=1}
 finally{if(page)report.events=await page.evaluate(()=>suiu.events).catch(()=>[]);fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2)+'\n');if(context)await context.close()}
})()
