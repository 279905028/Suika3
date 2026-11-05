'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),qa=path.join(root,'qa/dialogue-p4-P4-07-20261104'),web=path.join(qa,'build-adopted/runtime/web'),out=path.join(qa,'namebox-adopted');
assert(!fs.existsSync(out));fs.mkdirSync(out);
(async()=>{let browser,server,p;const r={status:'running',errors:[],scope:'同冻结正式包，独立Chrome仅复看电话结束到CG001的稳定姓名画面'};try{
server=http.createServer((req,res)=>{const f=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['index.html','assets.arc','shell.js','shell.css','title-motion.mp4','title-motion.js'].includes(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('html')?'text/html':f.endsWith('js')?'text/javascript':f.endsWith('css')?'text/css':'application/octet-stream');fs.createReadStream(path.join(web,f)).pipe(res);});await new Promise((a,b)=>{server.on('error',b);server.listen(49318,'127.0.0.1',a);});
browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1280,height:800}});p=await ctx.newPage();p.on('pageerror',e=>r.errors.push(e.message));p.on('dialog',async d=>{r.errors.push(d.message());await d.dismiss();});
const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:100});};
await p.goto('http://127.0.0.1:49318');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await p.waitForTimeout(700);await click(320,665);await p.waitForTimeout(400);
for(let i=0;i<90;i++){if((await p.evaluate(()=>suie.events)).some(x=>x.startsWith('SUI_I|unlock|cg=CG001|')))break;await click(420,700);await p.waitForTimeout(200);}
assert((await p.evaluate(()=>suie.events)).some(x=>x.startsWith('SUI_I|unlock|cg=CG001|')));
await p.waitForTimeout(2500);await p.screenshot({path:path.join(out,'01-cg001-settled.png')});r.settledEvents=(await p.evaluate(()=>suie.events)).slice(-10);
await click(120,48);await p.waitForTimeout(300);await p.keyboard.press('Escape');await p.waitForTimeout(600);await p.screenshot({path:path.join(out,'02-cg001-returned.png')});
await click(420,700);await p.waitForTimeout(2500);await p.screenshot({path:path.join(out,'03-next-settled.png')});r.nextEvents=(await p.evaluate(()=>suie.events)).slice(-10);
r.databases=await p.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name));assert(r.databases.every(x=>x.startsWith('bijie-p4-07-isolated:')));r.status='captured';r.browser=browser.version();
} catch(e){r.status='error';r.error=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();if(server?.listening)await new Promise(a=>server.close(a));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));}})();
