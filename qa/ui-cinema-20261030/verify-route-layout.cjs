const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const version=process.argv[2],port=process.argv[3],out=path.join(__dirname,version,'route-layout');fs.mkdirSync(out,{recursive:true});
const manifest=require('../../build/'+version+'/wasm/build-manifest.json'),ir=require('../../build/'+version+'/wasm/generated/story.ir.json');
const report={version,checks:[],errors:[],results:[]};
async function run(browser,locked){
 const ctx=await browser.newContext({viewport:{width:1280,height:800}}),p=await ctx.newPage(),logs=[],errors=[];
 p.on('console',m=>{if(m.text().startsWith('SUI_'))logs.push(m.text());if(m.type()==='error'||/^Error:/.test(m.text()))errors.push(m.text())});p.on('dialog',async d=>{errors.push(d.message());await d.dismiss()});p.on('pageerror',e=>errors.push(e.message));
 const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:70});await p.waitForTimeout(150)};
 await p.goto('http://127.0.0.1:'+port);await p.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:60000});assert(logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));await p.waitForTimeout(400);await click(320,664);
 const choices=[];
 while(true){
  await p.evaluate(ids=>{const canvas=document.getElementById('canvas');canvas.focus();let down=false;window.__layoutDone=null;const timer=setInterval(()=>{const line=suie.events.findLast(l=>l.startsWith('SUI_E|stable|'));if(line){const f=Object.fromEntries(line.split('|').filter(s=>s.includes('=')).map(s=>s.split('=')));if(f.tag==='choose'||(f.tag==='text'&&ids.includes(f.cursor))){clearInterval(timer);canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,bubbles:true}));window.__layoutDone=f;return;}}canvas.dispatchEvent(new KeyboardEvent(down?'keyup':'keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true}));down=!down;},25)},Object.keys(ir.choices));
  await p.waitForFunction(()=>window.__layoutDone,null,{timeout:120000});let f=await p.evaluate(()=>__layoutDone);
  if(f.tag==='text'){
   for(let n=0;n<6;n++){await click(1240,700);f=await p.evaluate(()=>Object.fromEntries(suie.events.findLast(l=>l.startsWith('SUI_E|stable|')).split('|').filter(s=>s.includes('=')).map(s=>s.split('='))));if(f.tag==='choose')break;}
  }
  assert.equal(f.tag,'choose');
  if(f.cursor==='ROUTE-01'){
   await p.mouse.move(1,1);await p.waitForTimeout(250);const name=locked?'five-locked':'six-open';await p.locator('#canvas').screenshot({path:path.join(out,name+'.png')});
   report.results.push({name,choices,expectedVisible:locked?5:6,errors});assert.deepEqual(errors,[]);break;
  }
  const index=locked&&f.cursor==='C01-02'?1:0;choices.push({id:f.cursor,index});await click(1000,168+88*index);
 }
 await ctx.close();
}
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{await Promise.all([run(b,false),run(b,true)]);report.pass=true;}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await b.close()}})();
