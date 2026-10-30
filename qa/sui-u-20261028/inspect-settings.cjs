const fs=require('node:fs');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const previous=JSON.parse(fs.readFileSync(__dirname+'/browser-report.json'));
 const c=await chromium.launchPersistentContext(previous.profile,{channel:'chrome',headless:true,viewport:{width:1440,height:900}});
 const p=c.pages()[0];p.on('console',m=>{if(m.text().startsWith('SUI_U|state'))console.log(m.text())});p.on('dialog',async d=>{console.log(d.message());await d.dismiss()});
 await p.goto('http://127.0.0.1:49218');await p.waitForFunction(()=>window.suiu?.ready&&suiu.events.includes('SUI_U|screen|title'));
 await p.locator('#canvas').focus();await p.keyboard.down('I');await p.waitForTimeout(100);await p.keyboard.up('I');await p.waitForTimeout(500);
 console.log(await p.evaluate(()=>({pending:suiu.pending,busy:suiu.busy,error:suiu.storageError})));
 await c.close();
})().catch(e=>{console.error(e);process.exit(1)});
