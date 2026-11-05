#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {model}=require('../../compiler/model.cjs');
const ROOT=path.resolve(__dirname,'../../..'),[preview,port,out]=process.argv.slice(2),base=path.resolve(ROOT,preview),dir=path.resolve(ROOT,out);
assert(preview&&port&&out&&!fs.existsSync(dir),'提供新的证据目录');fs.mkdirSync(dir,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f))),ir=read('runtime/generated/story.ir.json'),manifest=read('runtime/build-manifest.json'),bindings=read('bindings.json');
const paths=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/dialogue-p4-P4-07-20261104/p5-paths-adopted.json'))).paths;
const fields=l=>Object.fromEntries((l||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const report={date:'2026-11-05',status:'running',runtimeBuildId:manifest.runtimeBuildId,scope:'冻结v5，从标题普通键鼠输入至指定人物节点；静候8秒完整文字后截图；限定演出取帧，不跑结局、不写引擎剧情变量',results:[]};
const write=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
async function run(browser,route,targets){
 const ctx=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'}),p=await ctx.newPage(),logs=[],errors=[],answers={...paths.find(x=>x.route===route&&x.relation==='HIGH').choices},result={route,status:'running',answers,frames:[],choices:[],startedAt:new Date().toISOString()};report.results.push(result);write();
 p.on('console',m=>{const s=m.text();if(/^SUI_[EICM]\|/.test(s))logs.push(s);else if(m.type()==='error')errors.push(s);});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
 const latest=()=>p.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)));
 const tap=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:90});await p.waitForTimeout(300);};
 async function choose(id){let s=fields(await latest());for(let i=0;i<12&&s.tag!=='choose';i++){await tap(400,700);s=fields(await latest());}assert.equal(s.pending,id);assert.equal(s.tag,'choose');const ix=ir.choices[id].options.findIndex(o=>o.value===answers[id]);assert(ix>=0);const old=await latest();await tap(1000,166+88*ix);await p.waitForFunction(old=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x))!==old,old,{timeout:15000});result.choices.push({id,value:answers[id]});result.lastChoice=id;write();}
 async function next(target){await p.evaluate(({ids,target})=>{
  const canvas=document.getElementById('canvas');canvas.focus();const d=window.frameInput={down:false,reason:null,state:null};const key=t=>canvas.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  const stop=(reason,state)=>{clearInterval(d.timer);key('keyup');d.down=false;d.reason=reason;d.state=state;};d.timer=setInterval(()=>{
   const hold=suie.events.findLast(x=>x.startsWith('SUI_I|cg-hold|'));if(hold?.startsWith('SUI_I|cg-hold|start|')||window.endingMotion?.busy()){if(d.down){key('keyup');d.down=false;}return;}
   const line=suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x));if(line){const f=Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));if(f.cursor===target){stop('target',line);return;}if(f.tag==='choose'||f.tag==='text'&&ids.includes(f.cursor)){stop('choice',line);return;}}
   if(suie.events.some(x=>x.startsWith('SUI_E|complete|'))){stop('unexpected-complete','');return;}key(d.down?'keyup':'keydown');d.down=!d.down;
  },25);
 },{ids:Object.keys(ir.choices),target});await p.waitForFunction(()=>frameInput.reason,null,{timeout:300000});return p.evaluate(()=>({reason:frameInput.reason,state:frameInput.state}));}
 try{
  await p.goto('http://127.0.0.1:'+port);await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title')&&suie.events.includes('SUI_M|ready'),null,{timeout:90000});assert(logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));await p.waitForTimeout(500);await tap(320,665);
  for(const target of targets){for(let i=0;i<100;i++){const stop=await next(target);if(stop.reason==='target')break;assert.equal(stop.reason,'choice');const f=fields(stop.state);await choose(f.pending||f.cursor);}
   const before=fields(await latest());assert.equal(before.cursor,target);await p.waitForTimeout(8000);const state=fields(await latest());assert.equal(state.cursor,target);assert.equal(state.tag,'text');
   const file=route+'-'+target+'.png';await p.screenshot({path:path.join(dir,file)});const node=ir.nodes.find(n=>n.id===target),binding=bindings.bindings.find(b=>b.anchor.nodeId===target);assert(binding);const presentationEvents=logs.filter(x=>x.startsWith('SUI_I|enter|')&&x.includes('node='+target));assert(presentationEvents.includes('SUI_I|enter|binding='+binding.bindingId+'|node='+target));
   result.frames.push({nodeId:target,text:node.text,source:node.source,state,binding,presentationEvents,screenshot:file,waitBeforeScreenshotMs:8000});console.log('FRAME '+route+' '+target);write();
   if(target!==targets.at(-1)){await p.locator('#canvas').focus();await p.keyboard.press('Enter');await p.waitForTimeout(150);}
  }
  const expected=model(ir).run(answers).paragraphs.flatMap(q=>ir.nodes.filter(n=>n.op==='text'&&n.paragraph===q.id).map(n=>n.id)),actual=logs.filter(l=>l.startsWith('SUI_E|stable|')).map(fields).filter(f=>f.tag==='text'&&f.cursor.startsWith('T-')).map(f=>f.cursor);assert.deepEqual(actual,expected.slice(0,actual.length),'到达目标正文顺序必须匹配正常路径');assert.equal(actual.at(-1),targets.at(-1));result.visitedTextNodes=actual.length;
  assert.equal(errors.length,0,errors.join('\n'));assert(!logs.some(l=>l.startsWith('SUI_C|error')));result.storage=await p.evaluate(async()=>(await indexedDB.databases()).map(x=>x.name));assert(result.storage.every(x=>x.startsWith('bijie-p5-motion-20261104:')));result.status='pass-scoped';
 }catch(e){result.status='fail';result.error=e.stack;await p.screenshot({path:path.join(dir,route+'-failure.png')}).catch(()=>{});console.error(route,e.message);}
 finally{result.errors=errors;result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,route+'-events.json'),JSON.stringify(logs,null,2)+'\n');write();await ctx.close();}
}
(async()=>{let browser;try{browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();await Promise.all([run(browser,'zhouzhi',['T-ZZ-000176_1']),run(browser,'xiaoman',['T-XM-000439_1','T-XM-000440_1','T-XM-000604_1'])]);assert(report.results.every(r=>r.status==='pass-scoped'));report.status='pass-scoped';}catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;}finally{report.finishedAt=new Date().toISOString();write();if(browser)await browser.close();}})();
