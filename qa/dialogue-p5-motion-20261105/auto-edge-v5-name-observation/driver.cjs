#!/usr/bin/env node
'use strict';
// Frozen-package acceptance: ordinary inputs, isolated storage, read-only telemetry.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PW=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {model}=require('../../compiler/model.cjs');
const ROOT=path.resolve(__dirname,'../../..');
const [preview,port,out]=process.argv.slice(2);assert(preview&&port&&out,'preview port out');
const base=path.resolve(ROOT,preview),dir=path.resolve(ROOT,out);assert(dir.startsWith(path.join(ROOT,'qa')+path.sep));assert(!fs.existsSync(dir),'不覆盖历史验收');fs.mkdirSync(dir,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p));
const manifest=read(path.join(base,'runtime/build-manifest.json')),ir=read(path.join(base,'runtime/generated/story.ir.json'));
const bindings=read(path.join(base,'bindings.json')).bindings,byNode=new Map(bindings.map(b=>[b.anchor.nodeId,b]));
const paths=read(path.join(ROOT,'qa/dialogue-p4-P4-07-20261104/p5-paths-adopted.json'));
assert.equal(paths.contentBuildId,ir.buildId);
const selected=paths.paths.find(p=>p.route==='xiaoman'&&p.relation==='LOW');assert(selected);
const answers=selected.choices,expected=model(ir).run(answers),wantedChoices=expected.trace.filter(t=>t.op==='choice');
const eventNode=ir.nodes.find(n=>n.op==='text'&&n.source.file===ir.contract.day36.sharedSource.file).id;
const targets=new Map([['T-C01-000004_1','cg-auto-slot0'],[eventNode,'day36-auto-slot0']]);
const observeName=process.env.P5_NAME_OBSERVATION==='1';
const observations=new Map(observeName?[['T-D36-000016_1','d36-piao-seated-maolang'],['T-D36-000038_1','d36-after-conversation']]:[]);
assert.equal(byNode.get('T-C01-000004_1').cgId,'CG001');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const web=path.join(base,'runtime/web');
function list(d,prefix=''){return fs.readdirSync(d).flatMap(n=>fs.statSync(path.join(d,n)).isDirectory()?list(path.join(d,n),prefix+n+'/'):[prefix+n]);}
const hashes=Object.fromEntries(list(web).map(f=>[f,hash(fs.readFileSync(path.join(web,f)))]));
const fields=l=>Object.fromEntries((l||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const report={status:'running',createdAt:new Date().toISOString(),runtimeBuildId:manifest.runtimeBuildId,contentBuildId:ir.buildId,scope:'冻结正式包从标题正常选择；CG001和第36天事件内自动槽0即时读取及刷新恢复；不是新增完整结局路线或手机真机验收',driverSource:'tools/story-revision/p5/verify-routes.cjs',webHashes:hashes,answers,choices:[],checks:[],restorations:[],errors:[],events:[]};
const write=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
let browser,context,p;
const settle=async(ms=300)=>{await p.waitForTimeout(ms);await p.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError,null,{timeout:20000});};
const latest=async()=>fields(await p.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x))));
const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();assert(b);await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});await settle();};
const shot=async name=>{const f=name+'.png';await p.screenshot({path:path.join(dir,f)});return f;};
const stagePixels=async name=>{const b=await p.locator('#canvas').boundingBox();const pixels=await p.screenshot({clip:{x:b.x,y:b.y+b.height*100/720,width:b.width,height:b.height*400/720}});fs.writeFileSync(path.join(dir,name+'.png'),pixels);return hash(pixels);};
const ready=async()=>{await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:90000});await p.waitForFunction(()=>suie.events.includes('SUI_M|ready'),null,{timeout:20000});assert(await p.evaluate(id=>suie.events.includes('SUI_E|ready|'+id),manifest.runtimeBuildId));await settle(600);};
const compare=(actual,wanted,label)=>{for(const k of ['cursor','pending','route','relation','score','return','event','ending','epilogue','depth','tag','index'])assert.equal(actual[k],wanted[k],label+' '+k);};
async function loadAuto(title,state){
 const mark=report.events.length;
 if(title)await click(560,665);else{await click(1160,48);await click(120,270);}
 await click(1100,90);await click(470,250);
 await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|load|slot=0|')),null,{timeout:15000});
 const load=report.events.slice(mark).findLast(x=>x.startsWith('SUI_E|load|slot=0|'));assert(load,'必须实际触发槽0加载日志');compare(fields(load),state,'slot0 load');
 await settle(1900);compare(await latest(),state,'slot0 stable');return load;
}
async function restoreTarget(state,label){
 const start=report.events.length;
 if(label==='cg-auto-slot0')assert(report.events.some(l=>l.startsWith('SUI_I|unlock|cg=CG001|')),'CG须真实可见解锁');
 else {assert.equal(state.route,'xiaoman');assert.equal(state.relation,'LOW');assert(state.return,'事件内必须有调用栈');assert.equal(state.event,'0','事件内尚未完成');}
 await p.waitForFunction(id=>suie.events.some(x=>x.startsWith('SUI_E|save|slot=0|')&&x.includes('|cursor='+id+'|')),state.cursor,{timeout:20000});
 await settle(1900);compare(await latest(),state,'auto captured');
 const saved=report.events.findLast(x=>x.startsWith('SUI_E|save|slot=0|'));compare(fields(saved),state,'auto saved');
 const originalStage=await stagePixels(label+'-original-stage'),original=await shot(label+'-original');
 const immediate=await loadAuto(false,state),loaded=await shot(label+'-loaded'),loadedStage=await stagePixels(label+'-loaded-stage');
 assert.equal(loadedStage,originalStage,'自动槽恢复同一舞台像素');
 await p.reload();await ready();const refreshed=await loadAuto(true,state),refresh=await shot(label+'-refreshed'),refreshedStage=await stagePixels(label+'-refreshed-stage');
 assert.equal(refreshedStage,originalStage,'刷新后自动槽恢复同一舞台像素');
 const item={label,node:state.cursor,expected:state,binding:byNode.get(state.cursor).enter,saved,immediate,refreshed,stageHashes:{original:originalStage,loaded:loadedStage,refreshed:refreshedStage},screenshots:[original,loaded,refresh],events:report.events.slice(start),pass:true};
 report.restorations.push(item);report.checks.push({name:label+'-immediate-and-refresh',pass:true});targets.delete(state.cursor);write();console.log('PASS '+label+' '+state.cursor);
}
async function drive(){
 await p.evaluate(({choiceIds,targetIds,observationIds,afterEvent})=>{
  const canvas=document.getElementById('canvas');canvas.focus();const d=window.p5AutoInput={down:false,reason:null,state:null};
  const key=type=>canvas.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  const stop=(reason,state)=>{clearInterval(d.timer);key('keyup');d.reason=reason;d.state=state;};
  d.timer=setInterval(()=>{
   const hold=suie.events.findLast(x=>x.startsWith('SUI_I|cg-hold|'));
   if(hold?.startsWith('SUI_I|cg-hold|start|')||window.endingMotion?.busy()){if(d.down){key('keyup');d.down=false;}return;}
   const line=suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x));
   if(line){const f=Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
    if(targetIds.includes(f.cursor)){stop('target',line);return;}
    if(observationIds.includes(f.cursor)){stop('observation',line);return;}
    if(afterEvent&&f.event==='1'&&!f.return){stop('event-returned',line);return;}
    if(f.tag==='choose'){stop('choose',line);return;}
    if(f.tag==='text'&&choiceIds.includes(f.cursor)){stop('question',line);return;}
   }
   key(d.down?'keyup':'keydown');d.down=!d.down;
  },25);
 },{choiceIds:Object.keys(ir.choices),targetIds:[...targets.keys()],observationIds:[...observations.keys()],afterEvent:!targets.has(eventNode)});
 await p.waitForFunction(()=>p5AutoInput.reason,null,{timeout:180000});return p.evaluate(()=>({reason:p5AutoInput.reason,state:p5AutoInput.state}));
}
(async()=>{try{
 browser=await PW.chromium.launch({headless:true,channel:'chrome'});report.browser='Chrome '+browser.version();context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'});p=await context.newPage();
 p.on('console',m=>{const s=m.text();if(/^SUI_[EICM]\|/.test(s))report.events.push(s);else if(m.type()==='error')report.errors.push(s);});p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
 write();await p.goto('http://127.0.0.1:'+port+'/');await ready();await click(320,665);
 for(let steps=0;steps<100;steps++){
  assert.equal(report.errors.length,0,report.errors.join('\n'));const stopped=await drive();let state=fields(stopped.state);
  if(stopped.reason==='target'){await restoreTarget(state,targets.get(state.cursor));continue;}
  if(stopped.reason==='observation'){
   await settle(1500);compare(await latest(),state,'observation stays at node');
   (report.visualObservations??=[]).push({node:state.cursor,textMeta:ir.nodes.find(n=>n.id===state.cursor).textMeta,binding:byNode.get(state.cursor).enter,screenshot:await shot(observations.get(state.cursor))});observations.delete(state.cursor);write();continue;
  }
  if(stopped.reason==='event-returned'){
   assert.equal(targets.size,0);assert.equal(state.route,'xiaoman');assert.equal(state.relation,'LOW');assert.equal(state.event,'1');assert.equal(state.return,'');
   assert.equal(ir.nodes.find(n=>n.id===state.cursor)?.source.file,'罗小满-练习本.md');report.eventReturn={state,screenshot:await shot('event-returned-to-route')};
   if(observeName){
    report.nameObservation={scope:'仅观察正式包正常输入后的姓名框淡出时序，不读取或修改引擎内部变量；是否残留由截图目视判定',node:state.cursor,text:ir.nodes.find(n=>n.id===state.cursor).text,textMeta:ir.nodes.find(n=>n.id===state.cursor).textMeta,hideAnimation:'system/sui-u/anime/namebox-hide.anime: 0.12 seconds, alpha 255 to 0',samples:[{elapsedLowerBoundMs:0,screenshot:report.eventReturn.screenshot}]};
    let previous=0;for(const ms of [250,1000,3000]){await p.waitForTimeout(ms-previous);previous=ms;compare(await latest(),state,'same narration during wait');report.nameObservation.samples.push({elapsedLowerBoundMs:ms,state:await latest(),screenshot:await shot('event-returned-after-'+ms+'ms')});}write();
   }
   report.checks.push({name:'event-call-stack-returns-once',pass:true});break;
  }
  if(stopped.reason==='question')for(let i=0;i<12&&state.tag!=='choose';i++){await click(400,700);state=await latest();}
  assert.equal(state.tag,'choose');const id=state.pending;assert.equal(id,wantedChoices[report.choices.length]?.id,'正常路线选择顺序');
  let options=ir.choices[id].options;if(id==='ROUTE-01'){const eligible=Object.entries(ir.contract.hiddenEntry.choiceRequirements).every(([k,v])=>report.choices.some(c=>c.id===k&&c.value===v));options=options.filter(o=>o.value!==ir.contract.hiddenEntry.routeId||eligible);}
  const value=answers[id],index=options.findIndex(o=>o.value===value);assert(index>=0,'目标选项可达 '+id);await click(1000,166+88*index);report.choices.push({id,value});write();console.log('CHOICE '+id+'='+value);
 }
 assert(report.eventReturn,'事件未返回');assert.equal(report.restorations.length,2);assert(!report.events.some(x=>x.startsWith('SUI_C|error')));assert.equal(report.errors.length,0);
 report.databases=await p.evaluate(async()=>(await indexedDB.databases()).map(x=>x.name));assert(report.databases.length&&!report.databases.some(n=>n.startsWith('bijie-rain-suika3-v1:')));report.checks.push({name:'isolated-browser-storage',pass:true});
 for(const[f,h]of Object.entries(hashes))assert.equal(hash(fs.readFileSync(path.join(web,f))),h,'冻结包被改动 '+f);report.checks.push({name:'frozen-web-bytes-unchanged',pass:true});report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);process.exitCode=1;if(p){report.diagnostic=await p.evaluate(()=>({visibility:document.visibilityState,focus:document.hasFocus(),input:window.p5AutoInput?{down:p5AutoInput.down,reason:p5AutoInput.reason,state:p5AutoInput.state}:null,lastEvents:window.suie?.events.slice(-40),storageError:window.suie?.storageError,motion:window.endingMotion?{phase:endingMotion.phase,key:endingMotion.key,busy:endingMotion.busy()}:null})).catch(()=>null);await shot('failure').catch(()=>{});}}
 finally{report.finishedAt=new Date().toISOString();write();if(browser)await browser.close();}
})();
