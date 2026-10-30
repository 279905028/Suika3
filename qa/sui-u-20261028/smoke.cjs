const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];
 p.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.text().startsWith('SUI_U'))console.log(m.text())});
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{errors.push(d.message());await d.dismiss()});
 await p.goto('http://127.0.0.1:49218');await p.waitForTimeout(4000);
 console.log(await p.evaluate(()=>({ready:suiu.ready,events:suiu.events,fs:suiu.fs?.readdir(suiu.mount),canvas:{width:canvas.width,height:canvas.height}})));
 await p.screenshot({path:__dirname+'/screenshots/00-smoke.png'});
 fs.writeFileSync(__dirname+'/smoke-errors.json',JSON.stringify(errors,null,2));console.log(errors);
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
