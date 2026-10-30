// Focused checks for native settings actions and reading-mode controls.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const report={date:'2026-10-28',layer:'Chrome desktop, isolated native UI fixture',checks:[],errors:[],screenshots:[],build:JSON.parse(fs.readFileSync(__dirname+'/build-manifest.json'))};
let c,p;
const settle=()=>p.waitForTimeout(300);
async function click(x,y){const r=await p.locator('#canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:90});await settle()}
async function drag(x,y,dx){const r=await p.locator('#canvas').boundingBox();await p.mouse.move(r.x+x*r.width/1280,r.y+y*r.height/720);await p.mouse.down();await p.waitForTimeout(100);await p.mouse.move(r.x+dx*r.width/1280,r.y+y*r.height/720,{steps:12});await p.waitForTimeout(180);await p.mouse.up();await settle()}
async function key(k){await p.locator('#canvas').focus();await p.keyboard.down(k);await p.waitForTimeout(100);await p.keyboard.up(k);await settle()}
async function state(){const n=await p.evaluate(()=>suiu.events.length);await key('i');return p.evaluate(n=>suiu.events.slice(n).find(e=>e.startsWith('SUI_U|state|')),n)}
async function shot(name){await p.screenshot({path:path.join(__dirname,'screenshots',name+'.png')});report.screenshots.push(name+'.png')}
const check=(name,details)=>{report.checks.push({name,pass:true,details});console.log('PASS '+name)};
(async()=>{try{
 c=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'sui-u-controls-')),{channel:'chrome',headless:true,timezoneId:'Asia/Shanghai',viewport:{width:1440,height:900}});
 p=c.pages()[0];p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});
 await p.goto('http://127.0.0.1:49218');await p.waitForFunction(()=>window.suiu?.ready&&suiu.events.includes('SUI_U|screen|title'));await settle();
 await click(160,542);await drag(512,235,240);await drag(512,359,280);await drag(512,483,320);await drag(930,235,800);await shot('24-settings-adjusted');
 const changed=await state();assert(changed.includes('textspeed=0.')&&!changed.includes('bgm=1|'),changed);
 await click(810,594);await shot('25-settings-defaults');const reset=await state();assert(reset.includes('textspeed=0.5|')&&reset.includes('autospeed=0.5|'),reset);assert.equal(reset.match(/bgm=([^|]+)/)[1],changed.match(/bgm=([^|]+)/)[1]);check('重置阅读速度恢复文字速度与自动间隔',reset);
 await click(188,594);await p.waitForFunction(()=>!!document.fullscreenElement,{},{timeout:5000});check('原生全屏按钮进入浏览器全屏');
 await p.evaluate(()=>document.exitFullscreen());await settle();await key('Escape');
 await click(240,386);await click(1168,52);await click(260,374);await shot('26-auto-mode');const auto=await state();assert(auto.includes('|auto=1|'),auto);check('自动阅读原生模式启动并显示状态',auto);
 await key('Space');await click(1168,52);await click(640,374);await shot('27-skip-mode');const skip=await state();assert(skip.includes('|skip=1|'),skip);check('快进已读原生模式启动并显示状态',skip);await click(24,400);
 assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=e.stack;console.error(e);if(p)await shot('controls-failure').catch(()=>{});process.exitCode=1}
 finally{if(p)report.events=await p.evaluate(()=>suiu.events).catch(()=>[]);fs.writeFileSync(__dirname+'/controls-report.json',JSON.stringify(report,null,2)+'\n');if(c)await c.close()}
})()
