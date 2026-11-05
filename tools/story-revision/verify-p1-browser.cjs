#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {model}=require('../compiler/model.cjs'),{ROOT,QA}=require('./build-p1.cjs');
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
async function verify({attempt='preview-v4',port=49282,run='browser-v1'}={}){
 const base=path.join(ROOT,QA,attempt),out=path.join(base,run);assert(!fs.existsSync(out));fs.mkdirSync(out);
 const read=f=>JSON.parse(fs.readFileSync(path.join(base,f))),ir=read('runtime/generated/story.ir.json'),samples=read('samples.json'),manifest=read('runtime/build-manifest.json');
 const report={status:'running',attempt,scope:'独立P1小样，普通键鼠，临时Chrome存储；从经模型验证的片段前置状态开始',contentBuildId:ir.buildId,runtimeBuildId:manifest.runtimeBuildId,results:[]};
 const browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 const cases=[{sample:'common',combo:'A'},{sample:'common',combo:'B'},{sample:'piao',combo:'A'},{sample:'piao',combo:'B'},...['AA','AB','BA','BB'].map(combo=>({sample:'mengyao',combo}))];
 async function runCase(c){
  const context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'}),p=await context.newPage(),logs=[],errors=[];
  const name=c.sample+'-'+c.combo,seed=samples.entries.find(e=>e.id===c.sample),result={name,clicks:[],errors};report.results.push(result);
  p.on('console',m=>{if(/^SUI_/.test(m.text()))logs.push(m.text());else if(m.type()==='error')errors.push(m.text());});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
  const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:65});};
  const answers=Object.fromEntries(Object.keys(ir.choices).map(id=>[id,'A']));answers['ROUTE-01']='friends';
  if(c.sample==='common')answers['C01-01']=c.combo;
  if(c.sample==='piao')answers['PI-L06-01']=c.combo;
  if(c.sample==='mengyao'){answers['MY07-01']=c.combo[0];answers['MY09-01']=c.combo[1];answers['MY08-01']=c.combo[0];}
  const expected=model(ir).run(answers,{state:seed.state,start:seed.start});
  let expectedPages=expected.paragraphs.flatMap(x=>ir.nodes.filter(n=>n.op==='text'&&n.paragraph===x.id).map(n=>n.id));
  if(c.sample==='common')expectedPages=expectedPages.slice(0,expectedPages.indexOf(samples.commonLast)+1);
  try{
   await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});
   assert(logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));await p.waitForTimeout(600);await click(320,664);await p.waitForTimeout(500);
   for(let i=0;i<3;i++){await click(400,700);await p.waitForTimeout(250);}
   await click(1000,166+88*samples.entries.findIndex(e=>e.id===c.sample));
   await p.waitForFunction(id=>suie.events.some(x=>x.startsWith('SUI_E|stable|cursor='+id+'|')),seed.start,{timeout:20000});
   await p.waitForTimeout(350);await p.screenshot({path:path.join(out,name+'-start.png')});
   let complete=false;
   for(let step=0;step<25&&!complete;step++){
    assert.equal(errors.length,0,errors.join('\n'));
    await p.evaluate(ids=>{
     const canvas=document.getElementById('canvas');canvas.focus();const d=window.p1Input={down:false,reason:null,state:null,timer:null};
     const key=type=>canvas.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
     const stop=(reason,state)=>{clearInterval(d.timer);key('keyup');d.reason=reason;d.state=state;};
     d.timer=setInterval(()=>{
      const done=suie.events.findLast(x=>x.startsWith('SUI_E|complete|')||x.startsWith('SUI_E|p1-done|'));if(done){stop('complete',done);return;}
      const line=suie.events.findLast(x=>x.startsWith('SUI_E|stable|'));if(line){const f=Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));if(f.tag==='choose'){stop('choose',line);return;}if(f.tag==='text'&&ids.includes(f.cursor)){stop('question',line);return;}}
      if(!d.down&&line){
       const cursor=line.split('|cursor=')[1]?.split('|')[0];
       const observed=suie.events.findLast(x=>x.startsWith('SUI_E|p1-observe|'));
       if(!observed?.startsWith('SUI_E|p1-observe|cursor='+cursor+'|'))return;
      }
      key(d.down?'keyup':'keydown');d.down=!d.down;
     },45);
    },Object.keys(ir.choices));
    await p.waitForFunction(()=>p1Input.reason,null,{timeout:120000});const stop=await p.evaluate(()=>({reason:p1Input.reason,state:p1Input.state}));
    if(stop.reason==='complete'){complete=true;result.actual=fields(stop.state);break;}
    let line=stop.state;
    if(stop.reason==='question')for(let i=0;i<8&&fields(line).tag!=='choose';i++){await click(400,700);await p.waitForTimeout(180);line=await p.evaluate(()=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|')));}
    const f=fields(line);assert.equal(f.tag,'choose');const id=f.pending,index=ir.choices[id].options.findIndex(o=>o.value===answers[id]);assert(index>=0);
    await p.screenshot({path:path.join(out,name+'-'+id+'.png')});await click(1000,166+88*index);result.clicks.push({id,value:answers[id]});
    await p.waitForFunction(old=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|'))!==old,line,{timeout:15000});
   }
   assert(complete,'小样未结束');
   const actualPages=logs.filter(x=>x.startsWith('SUI_E|stable|')).map(fields).filter(f=>f.tag==='text'&&(f.cursor.startsWith('T-')||f.cursor.startsWith('TEXT_'))).map(f=>f.cursor);
   assert.deepEqual(actualPages,expectedPages,'实际正文页必须与完整条件预期逐页相同');
   if(c.sample!=='common'){assert.equal(result.actual.ending,expected.s.ending);assert.equal(result.actual.epilogue,expected.s.epilogue?'EP-LOW':'');assert.equal(result.actual.event,'1');}
   const observations=logs.filter(x=>x.startsWith('SUI_E|p1-observe|')).map(fields).filter(x=>x.tag==='text');
   const named=new Set();for(const o of observations){const n=ir.nodes.find(n=>n.id===o.cursor);if(!n)continue;
    if(o.message!==n.text)continue;assert.equal(o.native,n.textMeta?.displayName||'','原生回顾姓名不同：'+o.cursor);if(n.textMeta?.displayName)named.add(n.paragraph);
   }
   const needed=expectedPages.map(id=>ir.nodes.find(n=>n.id===id)).filter(n=>n.textMeta?.displayName);for(const n of needed)assert(named.has(n.paragraph),'未观察到原生姓名：'+n.id);
   assert.equal(errors.length,0);result.status='pass';result.pages=actualPages.length;result.namedParagraphs=named.size;result.logs=logs;
   await p.screenshot({path:path.join(out,name+'-complete.png')});console.log('PASS '+name+' '+result.pages+' pages '+named.size+' names');
  }catch(e){result.status='fail';result.error=e.stack;result.logs=logs;await p.screenshot({path:path.join(out,name+'-failure.png')}).catch(()=>{});throw e;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await context.close();}
 }
 try{for(let i=0;i<cases.length;i+=2){const settled=await Promise.allSettled(cases.slice(i,i+2).map(runCase));const failures=settled.filter(x=>x.status==='rejected');assert.equal(failures.length,0,failures.map(x=>x.reason.stack).join('\n'));}report.status='pass';}
 catch(e){report.status='fail';report.error=e.stack;throw e;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
if(require.main===module)verify({attempt:process.argv[2],port:Number(process.argv[3]||49282),run:process.argv[4]||'browser-v1'}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={verify,fields};
