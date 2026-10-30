const fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const r=JSON.parse(fs.readFileSync(__dirname+'/browser-report.json'));
 const c=await chromium.launchPersistentContext(r.profile,{channel:'chrome',headless:true,viewport:{width:1440,height:900}});const p=c.pages()[0];
 p.on('console',m=>{if(m.text().startsWith('SUI_U|state'))console.log(m.text())});p.on('dialog',async d=>{console.log(d.message());await d.dismiss()});
 const wait=()=>p.waitForTimeout(400);
 async function click(x,y){const r=await p.locator('#canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:100});await wait()}
 async function state(){await p.locator('#canvas').focus();await p.keyboard.down('I');await p.waitForTimeout(100);await p.keyboard.up('I');await wait()}
 async function shot(n){await p.mouse.move(20,30);await wait();const r=await p.locator('#canvas').boundingBox();const b=await p.screenshot({clip:{x:r.x+100*r.width/1280,y:r.y+160*r.height/720,width:1000*r.width/1280,height:180*r.height/720}});console.log(n,crypto.createHash('sha256').update(b).digest('hex'));await p.screenshot({path:__dirname+'/screenshots/history-probe-'+n+'.png'})}
 await p.goto('http://127.0.0.1:49218');await p.waitForFunction(()=>window.suiu?.ready&&suiu.events.includes('SUI_U|screen|title'));await wait();await click(240,386);
 for(let i=0;i<20;i++){if(await p.evaluate(()=>suiu.events.includes('SUI_U|screen|choices')))break;await p.locator('#canvas').focus();await p.keyboard.down('Enter');await p.waitForTimeout(100);await p.keyboard.up('Enter');await wait()}
 await click(640,628);await state();await click(1168,52);await click(1020,230);await state();await shot('before');
 {const r=await p.locator('#canvas').boundingBox();await p.mouse.move(r.x+1196*r.width/1280,r.y+548*r.height/720);await p.mouse.down();await p.waitForTimeout(100);await p.mouse.move(r.x+1196*r.width/1280,r.y+168*r.height/720,{steps:12});await p.waitForTimeout(200);await p.mouse.up();await wait()};await shot('drag');
 await p.locator('#canvas').focus();await p.keyboard.press('ArrowUp');await wait();await shot('up');
 const box=await p.locator('#canvas').boundingBox();await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.wheel(0,-1000);await wait();await shot('wheel');
 await c.close();
})().catch(e=>{console.error(e);process.exit(1)});
