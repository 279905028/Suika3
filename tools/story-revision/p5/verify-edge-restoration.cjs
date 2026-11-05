#!/usr/bin/env node
'use strict';
// Frozen product; ordinary input only. No native story-variable writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {model}=require('../../compiler/model.cjs');
const ROOT=path.resolve(__dirname,'../../..'),[preview,port,out]=process.argv.slice(2),base=path.resolve(ROOT,preview),dir=path.resolve(ROOT,out);
assert(preview&&port&&out&&!fs.existsSync(dir),'提供新的输出目录');fs.mkdirSync(dir,{recursive:true});
const ir=JSON.parse(fs.readFileSync(path.join(base,'runtime/generated/story.ir.json'))),manifest=JSON.parse(fs.readFileSync(path.join(base,'runtime/build-manifest.json')));
const paths=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/dialogue-p4-P4-07-20261104/p5-paths-adopted.json'))).paths;
const fields=l=>Object.fromEntries((l||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const report={date:'2026-11-05',status:'running',runtimeBuildId:manifest.runtimeBuildId,scope:'冻结v5，从标题普通键鼠输入；隐藏选项门禁负例、关键路线逐级回退/改选，下游与后日谈重新计算；不写引擎剧情变量',results:[]};
const write=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
async function run(browser,name,answers,kind){
 const ctx=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'}),p=await ctx.newPage(),logs=[],errors=[],result={name,status:'running',checks:[],answers,choices:[]};report.results.push(result);write();
 p.on('console',m=>{const s=m.text();if(/^SUI_[EICM]\|/.test(s))logs.push(s);else if(m.type()==='error')errors.push(s);});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
 const check=(n,d)=>{result.checks.push({name:n,pass:true,detail:d});console.log('PASS '+name+' '+n);write();};
 const latest=()=>p.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)));
 const tap=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:90});await p.waitForTimeout(300);};
 const shot=async n=>{const file=name+'-'+n+'.png';await p.screenshot({path:path.join(dir,file)});(result.screenshots??=[]).push(file);};
 const current=async()=>fields(await latest());
 const choose=async(id,value)=>{
  let s=await current();for(let i=0;i<12&&s.tag!=='choose';i++){await tap(400,700);s=await current();}
  assert.equal(s.pending,id);assert.equal(s.tag,'choose');let options=ir.choices[id].options;
  if(id==='ROUTE-01')options=options.filter(o=>o.value!=='huangqiuqiu'||answers['C01-02']==='A'&&answers['C02-01']==='A');
  const ix=options.findIndex(o=>o.value===value);assert(ix>=0);const old=await latest();await tap(1000,166+88*ix);await p.waitForFunction(old=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x))!==old,old,{timeout:15000});
  result.choices.push({id,value});result.lastChoice=id;write();
 };
 async function next(stopNode='',epilogue=''){
  await p.evaluate(({ids,stopNode,epilogue})=>{
   const canvas=document.getElementById('canvas');canvas.focus();const d=window.edgeInput={down:false,reason:null,state:null};
   const key=type=>canvas.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
   const stop=(reason,state)=>{clearInterval(d.timer);key('keyup');d.down=false;d.reason=reason;d.state=state;};
   d.timer=setInterval(()=>{
    const hold=suie.events.findLast(x=>x.startsWith('SUI_I|cg-hold|'));if(hold?.startsWith('SUI_I|cg-hold|start|')||window.endingMotion?.busy()){if(d.down){key('keyup');d.down=false;}return;}
    const line=suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x));if(line){const f=Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
     if(stopNode&&f.cursor===stopNode){stop('node',line);return;}if(epilogue&&f.epilogue===epilogue&&f.tag==='text'){stop('epilogue',line);return;}if(f.tag==='choose'||f.tag==='text'&&ids.includes(f.cursor)){stop('choice',line);return;}}
    const complete=suie.events.findLast(x=>x.startsWith('SUI_E|complete|'));if(complete){stop('complete',complete);return;}
    key(d.down?'keyup':'keydown');d.down=!d.down;
   },25);
  },{ids:Object.keys(ir.choices),stopNode,epilogue});
  await p.waitForFunction(()=>edgeInput.reason,null,{timeout:300000});return p.evaluate(()=>({reason:edgeInput.reason,state:edgeInput.state}));
 }
 async function drive({stopNode='',stopChoice='',epilogue=''}={}){
  for(let i=0;i<100;i++){const stop=await next(stopNode,epilogue);if(stop.reason!=='choice')return stop;const f=fields(stop.state),id=f.pending||f.cursor;if(id===stopChoice)return stop;await choose(id,answers[id]);}throw Error('路径没有结束');
 }
 async function rollbackTo(target){
  const trail=[];for(let i=0;i<8;i++){
   const before=logs.filter(l=>l.startsWith('SUI_E|rollback|')).length;await tap(1160,48);await tap(450,350);
   for(let w=0;w<20&&logs.filter(l=>l.startsWith('SUI_E|rollback|')).length===before;w++)await p.waitForTimeout(100);
   assert(logs.filter(l=>l.startsWith('SUI_E|rollback|')).length>before,'菜单回退没有游戏内回退日志');const state=fields(logs.findLast(l=>l.startsWith('SUI_E|rollback|')));trail.push(state);
   assert.equal(state.ending,'','回退必须清除已结束状态');assert.equal(state.epilogue,'','回退必须清除后日谈状态');
   if(state.cursor===target){check('游戏内逐级回退至'+target+'并清除结局/后日谈',trail);await shot('rollback-'+target);return;}
  }throw Error('未回退到'+target);
 }
 const motionSnapshot=()=>p.evaluate(()=>({phase:endingMotion.phase,contextKey:endingMotion.contextKey,unlocks:[...endingMotion.unlocks],events:endingMotion.events}));
 try{
  await p.goto('http://127.0.0.1:'+port);await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title')&&suie.events.includes('SUI_M|ready'),null,{timeout:90000});assert(logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));await p.waitForTimeout(500);await tap(320,665);
  if(kind==='hidden'){
   await drive({stopChoice:'ROUTE-01'});let state=await current();for(let i=0;i<12&&state.tag!=='choose';i++){await tap(400,700);state=await current();}assert.equal(state.pending,'ROUTE-01');
   await shot('five-options');const before=await latest();await tap(1000,606);assert.equal(await latest(),before,'隐藏第六项区域不应选中路线');check('未满足前置时第六项位置无可选路线',state);
   await choose('ROUTE-01','xiaoman');assert.equal((await current()).route,'xiaoman');assert(!logs.some(l=>/^SUI_E\|stable\|/.test(l)&&fields(l).route==='huangqiuqiu'));check('五项界面可正常选择小满且没有进入隐藏路线');
  }else{
   const target='T-MY-000349_1';await drive({stopNode:target});const first=await motionSnapshot();assert(first.events.some(e=>e.key==='MCG-MY-E1'&&e.type==='ended'));assert.equal((await current()).cursor,target);assert(!logs.some(l=>l.startsWith('SUI_E|complete|')));check('AA路径已完整播放继续关系动态并留在原节点');await shot('AA-ended');
   await rollbackTo('MY09-01');const rolled=await motionSnapshot();assert.equal(rolled.contextKey,'');check('回退清除当前动态上下文，保留已经获得的图鉴',rolled.unlocks);
   answers['MY09-01']='B';const abExpected=model(ir).run(answers),abEpilogue=ir.contract.epilogues.rules.find(r=>r.target?.file===abExpected.s.epilogue).target.anchor,abStart=logs.length,abMotionStart=(await motionSnapshot()).events.length;
   const ab=await drive({epilogue:abEpilogue});assert.equal(ab.reason,'epilogue');const abState=fields(ab.state);assert.equal(abState.ending,'MY-E2');assert.equal(abState.epilogue,abEpilogue);
   const abEvents=(await motionSnapshot()).events.slice(abMotionStart);assert(!abEvents.some(e=>e.type==='start'),'AB改选后不应触发继续关系动态');assert(logs.slice(abStart).some(l=>l.startsWith('SUI_E|checkpoint|choice=MY10-01|')),'MY10下游选择须重新建立快照');
   check('AA改AB后重新经过MY10并转入单身后日谈，未重复播放继续动态',abState);await shot('AB-epilogue');
   await rollbackTo('MY07-01');answers['MY07-01']='B';answers['MY09-01']='A';const baStart=logs.length,baMotionStart=(await motionSnapshot()).events.length,choicesStart=result.choices.length;
   const ba=await drive();assert.equal(ba.reason,'complete');const baState=fields(ba.state),baExpected=model(ir).run(answers),baEpilogue=ir.contract.epilogues.rules.find(r=>r.target?.file===baExpected.s.epilogue).target.anchor;
   assert.equal(baState.ending,'MY-E2');assert.equal(baState.epilogue,baEpilogue);assert.equal(baState.route,'mengyao');assert.equal(baState.relation,'HIGH');assert.equal(baState.return,'');
   const changed=result.choices.slice(choicesStart);assert.deepEqual(changed.map(x=>x.id),['MY07-01','MY08-01','MY09-01','MY10-01']);assert(!((await motionSnapshot()).events.slice(baMotionStart).some(e=>e.type==='start')),'MY07=B后不得重启私密动态');
   for(const id of ['MY08-01','MY09-01','MY10-01'])assert(logs.slice(baStart).some(l=>l.startsWith('SUI_E|checkpoint|choice='+id+'|')),'旧下游选择必须重新生成 '+id);
   const expectedSuffix=baExpected.paragraphs.flatMap(q=>ir.nodes.filter(n=>n.op==='text'&&n.paragraph===q.id).map(n=>n.id));
   const actualSuffix=logs.slice(baStart).filter(l=>l.startsWith('SUI_E|stable|')).map(fields).filter(f=>f.tag==='text'&&f.cursor.startsWith('T-')).map(f=>f.cursor);const firstAt=expectedSuffix.indexOf(actualSuffix[0]);assert(firstAt>=0);assert.deepEqual(actualSuffix,expectedSuffix.slice(firstAt),'BA后续正文必须与新选择一致');
   check('上游改B后MY08/09/10全部重问，BA到断开结局且下游正文无旧分支',baState);result.final=baState;result.changedChoices=changed;await shot('BA-complete');
  }
  assert.equal(errors.length,0,errors.join('\n'));assert(!logs.some(l=>l.startsWith('SUI_C|error')));result.status='pass';result.motion=await motionSnapshot();result.storage=await p.evaluate(async()=>(await indexedDB.databases()).map(x=>x.name));assert(result.storage.every(x=>x.startsWith('bijie-p5-motion-20261104:')));console.log('DONE '+name);
 }catch(e){result.status='fail';result.error=e.stack;await shot('failure').catch(()=>{});result.motion=await motionSnapshot().catch(()=>null);console.error('FAIL '+name,e.message);}
 finally{result.errors=errors;result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,name+'-events.json'),JSON.stringify(logs,null,2)+'\n');write();await ctx.close();}
}
(async()=>{let browser;try{
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();const common=paths.find(x=>x.route==='xiaoman'&&x.relation==='HIGH').choices,my=paths.find(x=>x.route==='mengyao'&&x.relation==='HIGH'&&x.ending==='MY-E1').choices;
 await Promise.all([run(browser,'hidden-C01-B',{...common,'C01-02':'B'},'hidden'),run(browser,'hidden-C02-B',{...common,'C02-01':'B'},'hidden'),run(browser,'mengyao-AA-AB-BA',{...my},'rollback')]);assert(report.results.every(r=>r.status==='pass'));report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;}finally{report.finishedAt=new Date().toISOString();write();if(browser)await browser.close();}})();
