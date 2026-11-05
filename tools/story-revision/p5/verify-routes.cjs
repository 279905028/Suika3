#!/usr/bin/env node
'use strict';
// Ordinary DOM keyboard and mouse inputs only. Read-only engine telemetry.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PW=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {model}=require('../../compiler/model.cjs');
const ROOT=path.resolve(__dirname,'../../..');
const [preview,port,out,browserName='chrome']=process.argv.slice(2);assert(preview&&port&&out,'preview port out [chrome|firefox|webkit]');
const base=path.resolve(ROOT,preview),dir=path.resolve(ROOT,out);assert(!fs.existsSync(dir),'不覆盖已有证据');fs.mkdirSync(dir,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(base,'runtime/build-manifest.json'))),ir=JSON.parse(fs.readFileSync(path.join(base,'runtime/generated/story.ir.json')));
const bindings=JSON.parse(fs.readFileSync(path.join(base,'bindings.json'))).bindings,byNode=new Map(bindings.map(b=>[b.anchor.nodeId,b]));
const motionBindings=fs.existsSync(path.join(base,'motion-bindings.json'))?JSON.parse(fs.readFileSync(path.join(base,'motion-bindings.json'))).bindings:[];
const paths=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/dialogue-p4-P4-07-20261104/p5-paths-adopted.json'))).paths;
assert.equal(ir.buildId,JSON.parse(fs.readFileSync(path.join(ROOT,'qa/dialogue-p4-P4-07-20261104/p5-paths-adopted.json'))).contentBuildId);
const cases=paths.map((p,i)=>({name:String(i+1).padStart(2,'0')+'-'+p.route+'-'+p.relation+'-'+p.ending,answers:p.choices}));
for(const relation of ['HIGH','LOW'])for(const combo of ['AB','BB']){const p=paths.find(p=>p.route==='mengyao'&&p.relation===relation);cases.push({name:'mengyao-'+relation+'-'+combo,answers:{...p.choices,'MY07-01':combo[0],'MY09-01':combo[1]}});}
if(process.env.P5_CASE_FILTER){const re=new RegExp(process.env.P5_CASE_FILTER);cases.splice(0,cases.length,...cases.filter(c=>re.test(c.name)));}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const webRoot=path.join(base,'runtime/web');function filesUnder(dir,prefix=''){return fs.readdirSync(dir).flatMap(name=>fs.statSync(path.join(dir,name)).isDirectory()?filesUnder(path.join(dir,name),prefix+name+'/'):[prefix+name]);}
const webHashes=Object.fromEntries(filesUnder(webRoot).map(f=>[f,hash(path.join(webRoot,f))]));
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(s=>s.includes('=')).map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
const report={status:'running',date:'2026-11-04',runtimeBuildId:manifest.runtimeBuildId,contentBuildId:ir.buildId,webHashes,scope:'正式完整构建，独立浏览器上下文，从标题开始，普通键盘鼠标逐页对照；不注入引擎状态，不代替人工全稿审读或真机',plannedCases:cases.map(c=>c.name),results:[],errors:[]};
const write=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
const capturedCG=new Set(),capturedMotion=new Set();
async function runCase(browser,c){
 const started=Date.now(),context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'}),p=await context.newPage(),logs=[],errors=[];
 const expected=model(ir).run(c.answers),choices=expected.trace.filter(t=>t.op==='choice');
 const wantedPages=expected.paragraphs.flatMap(p=>ir.nodes.filter(n=>n.op==='text'&&n.paragraph===p.id).map(n=>n.id));
 const wantedCG=[...new Set(wantedPages.map(id=>byNode.get(id)?.cgId).filter(Boolean))].sort();
 const restoreTargets=new Map();
 if(process.env.P5_RESTORE==='1'){
  const add=(label,test)=>{const id=wantedPages.find(id=>test(ir.nodes.find(n=>n.id===id),byNode.get(id)));if(id)restoreTargets.set(id,label);};
  if(expected.s.relation==='LOW'&&expected.s.route!=='piao')add('day36-event',n=>n.source.file===ir.contract.day36.sharedSource.file);
  if(expected.s.route==='xiaoman'){for(const id of ['T-XM-000296_1','T-XM-000794_1'])if(wantedPages.includes(id))restoreTargets.set(id,'helmet-'+id);}
  if(expected.s.route==='huangqiuqiu'){add('hq-orb',(n,b)=>b?.enter.characters.some(a=>/orb/.test(a.assetId)));add('hq-human',(n,b)=>b?.enter.characters.some(a=>/^sui-a06-human-/.test(a.assetId)));for(const id of ['T-HQ-000278_1','T-HQ-000342_1'])if(wantedPages.includes(id))restoreTargets.set(id,'hq-late-human-'+id);}
  if(expected.s.route==='piao'){add('piao-prop',(n,b)=>b?.enter.props.some(a=>/piao|pi-/.test(a.assetId)));add('piao-portrait',(n,b)=>n.source.file==='飘-空白页.md'&&b?.enter.characters.some(a=>/piao|pi-/.test(a.assetId)));}
 }
 const restored=new Set();
 const result={name:c.name,status:'running',answers:c.answers,clicks:[],expected:{route:expected.s.route,relation:expected.s.relation,score:String(expected.s.score),ending:expected.s.ending,epilogue:expected.s.epilogue?ir.contract.epilogues.rules.find(r=>r.target?.file===expected.s.epilogue).target.anchor:'',event:expected.s.events.includes(ir.contract.day36.eventId)?'1':'0',return:''},errors};report.results.push(result);write();
 p.on('console',m=>{const s=m.text();if(/^SUI_[EICM]\|/.test(s))logs.push(s);else if(m.type()==='error')errors.push(s);});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
 const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();assert(b);await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});};
 const last=()=>p.evaluate(()=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|')));
 const screenshot=async suffix=>{const file=c.name+'-'+suffix+'.png';await p.screenshot({path:path.join(dir,file)});(result.screenshots??=[]).push(file);};
 try{
  await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:90000});
  assert(logs.includes('SUI_E|ready|'+manifest.runtimeBuildId),'构建ID不符');if(motionBindings.length)await p.waitForFunction(()=>suie.events.includes('SUI_M|ready'),null,{timeout:20000});result.coldLoadMs=Date.now()-started;await p.evaluate(()=>{window.p5Heartbeat={frames:0,ticks:0,lastFrame:performance.now(),lastTick:performance.now()};function frame(){p5Heartbeat.frames++;p5Heartbeat.lastFrame=performance.now();requestAnimationFrame(frame);}requestAnimationFrame(frame);setInterval(()=>{p5Heartbeat.ticks++;p5Heartbeat.lastTick=performance.now();},250);});
  result.loadMetrics=await p.evaluate(()=>({wasmHeapBytes:typeof HEAPU8!=='undefined'?HEAPU8.buffer.byteLength:null,resources:performance.getEntriesByType('resource').filter(e=>e.name.endsWith('assets.arc')).map(e=>({duration:e.duration,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize}))}));
  await p.waitForTimeout(600);await click(320,665);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:15000});
  let complete=false,steps=0;
  while(!complete){
   assert(++steps<300);assert(Date.now()-started<25*60*1000,'单路径超时');assert.equal(errors.length,0,errors.join('\n'));
   const targets=bindings.filter(b=>b.cgId&&!capturedCG.has(b.cgId)).map(b=>b.anchor.nodeId);
   await p.evaluate(({ids,targets,motions,restores})=>{
    const canvas=document.getElementById('canvas');canvas.focus();
    const d=window.p5Input={down:false,reason:null,state:null,timer:null};
    const key=type=>canvas.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    const stop=(reason,state)=>{clearInterval(d.timer);key('keyup');d.reason=reason;d.state=state;};
    d.timer=setInterval(()=>{
     if(window.endingMotion?.busy()&&endingMotion.visible&&motions.includes(endingMotion.key)){stop('motion',endingMotion.key);return;}
     const hold=suie.events.findLast(x=>x.startsWith('SUI_I|cg-hold|'));
     if(hold?.startsWith('SUI_I|cg-hold|start|')||window.endingMotion?.busy()){if(d.down){key('keyup');d.down=false;}return;}
     const done=suie.events.findLast(x=>x.startsWith('SUI_E|complete|'));if(done){stop('complete',done);return;}
     const line=suie.events.findLast(x=>x.startsWith('SUI_E|stable|'));
     if(line){const f=Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));if(restores.includes(f.cursor)){stop('restore',line);return;}if(f.tag==='choose'){stop('choose',line);return;}if(f.tag==='text'&&ids.includes(f.cursor)){stop('question',line);return;}if(targets.includes(f.cursor)){stop('screenshot',line);return;}}
     key(d.down?'keyup':'keydown');d.down=!d.down;
    },25);
   },{ids:Object.keys(ir.choices),targets,restores:[...restoreTargets.keys()].filter(id=>!restored.has(id)),motions:motionBindings.map(b=>b.key).filter(k=>!capturedMotion.has(k))});
   await p.waitForFunction(()=>p5Input.reason,null,{timeout:180000});
   const stop=await p.evaluate(()=>({reason:p5Input.reason,state:p5Input.state}));
   if(stop.reason==='complete'){
    result.actual=fields(stop.state);for(const[k,v]of Object.entries(result.expected))assert.equal(result.actual[k],v,k);complete=true;await screenshot('complete');
   }else if(stop.reason==='restore'){
    const state=fields(stop.state),id=state.cursor,label=restoreTargets.get(id);restored.add(id);const startLog=logs.length;
    const settle=async()=>{await p.waitForTimeout(300);await p.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError,null,{timeout:15000});};
    const tap=async(x,y)=>{await click(x,y);await settle();};
    const snapshot=async()=>fields(await p.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x))));
    const compare=async()=>{const a=await snapshot();for(const field of ['cursor','pending','route','relation','score','return','event','ending','epilogue'])assert.equal(a[field],state[field],label+' '+field);};
    await p.waitForTimeout(1900);await tap(1160,48);await tap(120,270);await tap(870,90);await tap(950,250);await tap(120,625);await compare();await screenshot(label+'-saved');
    await p.locator('#canvas').focus();for(let i=0;i<6&&(await snapshot()).cursor===id;i++){await p.keyboard.press('Enter',{delay:90});await settle();}assert.notEqual((await snapshot()).cursor,id,'保存后不能正常推进');
    await tap(1160,48);await tap(120,270);await tap(1100,90);await tap(950,250);await compare();await screenshot(label+'-loaded');
    await p.reload();await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:90000});if(motionBindings.length)await p.waitForFunction(()=>suie.events.includes('SUI_M|ready'),null,{timeout:20000});await settle();await tap(560,665);await tap(1100,90);await tap(950,250);await compare();await screenshot(label+'-refreshed');
    (result.restorations??=[]).push({label,node:id,expected:state,binding:byNode.get(id).enter,pass:true,events:logs.slice(startLog)});
    // Keep restore/revisited-page evidence separately; the main traversal continues from the saved node.
    logs.splice(startLog);console.log('RESTORE '+c.name+' '+label);write();if(process.env.P5_STOP_AFTER===label){result.status='pass-scoped';result.scopedStop={label,node:id,scope:'仅到达与存读档刷新恢复，不是本次完整结局路径'};return true;}
   }else if(stop.reason==='motion'){capturedMotion.add(stop.state);await screenshot(stop.state+'-playing');
   }else if(stop.reason==='screenshot'){
    const id=fields(stop.state).cursor,b=byNode.get(id);capturedCG.add(b.cgId);await p.waitForTimeout(200);await screenshot(b.cgId);
   }else{
    let line=stop.state;
    if(stop.reason==='question')for(let i=0;i<12&&fields(line).tag!=='choose';i++){await click(400,700);await p.waitForTimeout(220);line=await last();}
    const f=fields(line);assert.equal(f.tag,'choose','没有进入选项');const id=f.pending;assert.equal(id,choices[result.clicks.length]?.id,'选择顺序');
    let options=ir.choices[id].options;if(id==='ROUTE-01'){
     const eligible=Object.entries(ir.contract.hiddenEntry.choiceRequirements).every(([k,v])=>result.clicks.some(x=>x.id===k&&x.value===v));options=options.filter(o=>o.value!==ir.contract.hiddenEntry.routeId||eligible);await screenshot('route-options');
    }
    const value=c.answers[id],index=options.findIndex(o=>o.value===value);assert(index>=0,'选项不可用 '+id);
    await click(1000,166+88*index);result.clicks.push({id,value});
    await p.waitForFunction(old=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|'))!==old,line,{timeout:15000});
    console.log('CHOICE '+c.name+' '+id+'='+value);result.lastChoice=id;result.motionProgress=await p.evaluate(()=>window.endingMotion?{unlocks:[...endingMotion.unlocks],phase:endingMotion.phase}:null);result.elapsedMs=Date.now()-started;write();
   }
  }
  const actualPages=logs.filter(x=>x.startsWith('SUI_E|stable|')).map(fields).filter(x=>x.tag==='text'&&byNode.has(x.cursor)&&ir.nodes.some(n=>n.id===x.cursor&&n.op==='text')).map(x=>x.cursor);
  assert.deepEqual(actualPages,wantedPages,'所有正文页游标顺序');result.pages=actualPages.length;
  assert.deepEqual(result.clicks,choices.map(t=>({id:t.id,value:t.value})),'完整选择表');
  const entered=new Set(logs.filter(l=>l.startsWith('SUI_I|enter|')).map(l=>fields(l).node));assert(wantedPages.every(id=>entered.has(id)),'逐页演出绑定');
  const visibleLogs=[...logs,...(result.restorations||[]).flatMap(r=>r.events)];result.actualCG=[...new Set(visibleLogs.filter(l=>l.startsWith('SUI_I|unlock|')).map(l=>fields(l).cg))].sort();assert.deepEqual(result.actualCG,wantedCG,'实际CG解锁');
  const checkpoints=logs.filter(x=>x.startsWith('SUI_E|checkpoint|')).map(x=>fields(x).choice);assert.deepEqual(checkpoints,choices.map(t=>t.id),'选择快照');
  result.eventInProgress=logs.some(x=>x.startsWith('SUI_E|stable|')&&fields(x).return);result.eventComplete=result.actual.event==='1';
  if(expected.s.relation==='LOW'&&expected.s.route!=='piao')assert(result.eventInProgress,'第36天事件缺调用栈');
  await p.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError,null,{timeout:20000});result.databases=await p.evaluate(async()=>(await indexedDB.databases()).map(x=>x.name));
  assert(result.databases.length>0&&!result.databases.some(n=>n.startsWith('bijie-rain-suika3-v1:')),'必须独立测试库');
  result.motion=await p.evaluate(()=>window.endingMotion?{events:endingMotion.events,unlocks:[...endingMotion.unlocks],phase:endingMotion.phase,contextKey:endingMotion.contextKey}:null);
  const wantedMotion=motionBindings.filter(b=>wantedPages.includes(b.node)&&b.route===expected.s.route&&(!b.relation||b.relation===expected.s.relation)&&Object.entries(b.choices||{}).every(([k,v])=>c.answers[k]===v)).map(b=>b.key).sort();result.expectedMotion=wantedMotion;assert.deepEqual((result.motion?.unlocks||[]).sort(),wantedMotion,'动态首帧解锁应且仅应覆盖当前路径');assert(!result.motion?.events.some(e=>['media-error','autoplay-rejected','load-timeout'].includes(e.type)),'动态播放失败');
  assert.equal(errors.length,0);assert(!logs.some(l=>l.startsWith('SUI_C|error')));result.status='pass';console.log('PASS '+c.name+' pages='+result.pages+' motions='+result.motion?.unlocks?.length);
 }catch(e){result.status='fail';result.error=e.stack;result.diagnostic=await p.evaluate(()=>({now:performance.now(),bridge:window.mcgBridge?.state,heartbeat:window.p5Heartbeat,visibility:document.visibilityState,focus:document.hasFocus(),input:window.p5Input?{down:p5Input.down,reason:p5Input.reason,state:p5Input.state}:null,motion:window.endingMotion?{phase:endingMotion.phase,key:endingMotion.key,contextKey:endingMotion.contextKey,busy:endingMotion.busy(),menu:endingMotion.menu,drainUntil:endingMotion.drainUntil,events:endingMotion.events}:null,lastEvents:window.suie?.events.slice(-30)})).catch(()=>null);report.errors.push({case:c.name,error:e.message});await screenshot('failure').catch(()=>{});console.error('FAIL '+c.name,e.message);}
 finally{result.elapsedMs=Date.now()-started;fs.writeFileSync(path.join(dir,c.name+'-events.json'),JSON.stringify(logs,null,2)+'\n');write();await context.close();}
 return result.status==='pass';
}
(async()=>{
 let browser;
 try{
  browser=await (browserName==='chrome'?PW.chromium:PW[browserName]).launch({headless:true,...(process.env.P5_SOFTWARE==='1'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}) ,...(browserName==='chrome'?{channel:'chrome'}:{}),...(browserName==='firefox'?{firefoxUserPrefs:{'network.proxy.type':0}}:{})});report.browser=browserName+' '+browser.version();report.softwareRendering=process.env.P5_SOFTWARE==='1';
  let next=0;async function worker(){while(next<cases.length){const c=cases[next++];if(!await runCase(browser,c))return;}}
  await Promise.all(Array.from({length:Number(process.env.P5_WORKERS||3)},()=>worker()));
  assert.equal(report.results.length,cases.length,'路径尚未全部执行');assert(report.results.every(r=>r.status==='pass'||process.env.P5_STOP_AFTER&&r.status==='pass-scoped'));
  for(const[f,h]of Object.entries(webHashes))assert.equal(hash(path.join(base,'runtime/web',f)),h,'验收期间文件改变 '+f);
  if(process.env.P5_STOP_AFTER){report.scope='限定恢复专项：只验到'+process.env.P5_STOP_AFTER+'，不计入完整结局路线';report.status='pass-scoped';return;}
  report.endings=[...new Set(report.results.map(r=>r.actual.ending))].sort();report.actualCG=[...new Set(report.results.flatMap(r=>r.actualCG))].sort();report.motionUnlocks=[...new Set(report.results.flatMap(r=>r.motion?.unlocks||[]))].sort();report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;console.error(e.message);process.exitCode=1;}
 finally{report.finishedAt=new Date().toISOString();write();if(browser)await browser.close();}
})();
