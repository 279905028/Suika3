'use strict';
// 正式完整包，从标题经普通输入进入共通的新电脑与手机背景；不注入引擎变量。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),web=path.join(__dirname,'build/runtime/web'),out=path.join(__dirname,'browser-v2');assert(!fs.existsSync(out));fs.mkdirSync(out);
const json=p=>JSON.parse(fs.readFileSync(p)),B=json(path.join(__dirname,'build/bindings.json')).bindings,ir=json(path.join(__dirname,'build/runtime/generated/story.ir.json'));
const targets=['T-C01-000368_1','T-C02-000332_1'],cgs=B.filter(b=>b.cgId).map(b=>b.anchor.nodeId),questions=Object.keys(ir.choices);
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
(async()=>{let server,browser,p;const r={date:'2026-11-04',status:'running',scope:'同版本完整包从标题实际进入共通新背景、CG全图、选择与手动保存/刷新恢复；非P5六线14结局全量运行',checks:[],screenshots:[],errors:[]};try{
 server=http.createServer((req,res)=>{const f=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['index.html','assets.arc','shell.js','shell.css','title-motion.mp4','title-motion.js'].includes(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('html')?'text/html':f.endsWith('js')?'text/javascript':f.endsWith('css')?'text/css':f.endsWith('mp4')?'video/mp4':'application/octet-stream');fs.createReadStream(path.join(web,f)).pipe(res);});await new Promise((a,b)=>{server.on('error',b);server.listen(49332,'127.0.0.1',a);});
 browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'});p=await ctx.newPage();r.browser=browser.version();p.on('pageerror',e=>r.errors.push(e.message));p.on('dialog',async d=>{r.errors.push(d.message());await d.dismiss();});
 const events=()=>p.evaluate(()=>suie.events);const current=async()=>fields((await events()).findLast(x=>x.startsWith('SUI_E|stable|')));const entered=async()=>fields((await events()).findLast(x=>x.startsWith('SUI_I|enter|'))).node;
 const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});};
 const shot=async name=>{await p.screenshot({path:path.join(out,name)});r.screenshots.push(name);};
 await p.goto('http://127.0.0.1:49332');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await p.waitForTimeout(700);await click(320,665);await p.waitForTimeout(400);
 const captured=new Set(),handledCG=new Set();let cgFull=false;const started=Date.now();
 while(captured.size<targets.length){
  assert(Date.now()-started<300000,'实际共通路径超时');assert.equal(r.errors.length,0);
  await p.evaluate(({targets,cgs,questions,handled})=>{
   if(window.bgfDriver?.timer)clearInterval(bgfDriver.timer);const canvas=document.getElementById('canvas');canvas.focus();const d=window.bgfDriver={down:false,reason:null,state:null,timer:null};
   const key=t=>canvas.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
   const stop=(reason,state)=>{clearInterval(d.timer);key('keyup');d.reason=reason;d.state=state;};
   d.timer=setInterval(()=>{const enter=suie.events.findLast(x=>x.startsWith('SUI_I|enter|'));if(enter){const id=enter.split('|node=')[1];if(cgs.includes(id)&&!handled.includes(id)){stop('cg',enter);return;}}const line=suie.events.findLast(x=>x.startsWith('SUI_E|stable|'));if(line){const f=Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));if(targets.includes(f.cursor)){stop('target',line);return;}if(f.tag==='choose'){stop('choice',line);return;}if(f.tag==='text'&&questions.includes(f.cursor)){stop('question',line);return;}}key(d.down?'keyup':'keydown');d.down=!d.down;},25);
  },{targets:targets.filter(x=>!captured.has(x)),cgs,questions,handled:[...handledCG]});
  await p.waitForFunction(()=>window.bgfDriver?.reason,null,{timeout:60000});const stop=await p.evaluate(()=>({reason:bgfDriver.reason,state:bgfDriver.state})),s=fields(stop.state);if(stop.reason==='cg')s.cursor=s.node;
  if(stop.reason==='target'){captured.add(s.cursor);await p.waitForTimeout(500);await shot(s.cursor+'.png');if(captured.size<targets.length)await click(420,700);}
  else if(stop.reason==='cg'){
   await p.waitForFunction(id=>suie.events.some(e=>e.startsWith('SUI_I|cg-hold|ready|node='+id)),s.cursor,{timeout:10000});
   if(!cgFull){await click(120,48);await p.waitForTimeout(250);await shot('cg001-full.png');await p.keyboard.press('Escape');await p.waitForTimeout(250);assert.equal(await entered(),s.cursor);cgFull=true;}
   for(let i=0;i<6&&(await entered())===s.cursor;i++){await click(420,700);await p.waitForTimeout(180);}assert.notEqual(await entered(),s.cursor);handledCG.add(s.cursor);
  }else if(stop.reason==='question'){
   for(let i=0;i<8&&(await current()).tag!=='choose';i++){await click(1240,700);await p.waitForTimeout(150);}assert.equal((await current()).tag,'choose');
  }else{await click(1000,164);await p.waitForTimeout(200);}
 }
 r.checks.push('标题进入真实共通路径，两种新增背景实际显示','自然选择与CG首可见帧/1.5秒保护正常','CG全图关闭仍停在原页');
 // 在新手机背景页使用真实存档面板，然后刷新并恢复同一节点。
 const savedCursor=(await current()).cursor;await click(1168,52);await p.waitForTimeout(250);await click(125,272);await p.waitForTimeout(250);await click(900,90);await p.waitForTimeout(250);await click(960,250);
 await p.waitForFunction(()=>suie.events.some(e=>e.startsWith('SUI_E|save|')&&e.includes('slot=1')),null,{timeout:10000});await p.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError,null,{timeout:10000});await shot('manual-save.png');
 await p.reload();await p.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:60000});await p.waitForTimeout(500);await click(560,665);await p.waitForTimeout(300);await click(960,250);
 await p.waitForFunction(id=>suie.events.some(e=>(e.startsWith('SUI_E|stable|')||e.startsWith('SUI_E|load|'))&&e.includes('|cursor='+id+'|')),savedCursor,{timeout:10000});await p.waitForTimeout(500);await shot('restored-phone.png');r.checks.push('正式包手机背景页手动保存、刷新与恢复');
 await p.setViewportSize({width:844,height:390});await p.waitForTimeout(250);await shot('phone-844x390.png');r.checks.push('844×390横屏尺寸模拟');
 r.databases=await p.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));assert(r.databases.length&&r.databases.every(n=>n.startsWith('bijie-background-fill-20261104:')));assert.equal(r.errors.length,0);r.status='pass';
 }catch(e){r.status='fail';r.error=e.stack;process.exitCode=1;if(p)await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}finally{if(p)r.events=await p.evaluate(()=>window.suie?.events||[]).catch(()=>[]);if(browser)await browser.close();if(server?.listening)await new Promise(a=>server.close(a));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({status:r.status,checks:r.checks,errors:r.errors,error:r.error}));}
})();
