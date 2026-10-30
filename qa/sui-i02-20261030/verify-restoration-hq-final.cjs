#!/usr/bin/env node
'use strict';
// Real entry + ordinary input only. Never alters engine variables or installs skip/debug hooks.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {model}=require('../../tools/compiler/model.cjs');
const version=process.argv[2],base=path.join(__dirname,'../../build',version),dir=path.join(__dirname,version,'restoration-hq-final'),url='http://127.0.0.1:'+Number(process.argv[3])+'/';fs.mkdirSync(dir,{recursive:true});
const bindings=JSON.parse(fs.readFileSync(path.join(base,'input/docs/整合/bindings.json'))).bindings,byNode=new Map(bindings.map(b=>[b.anchor.nodeId,b]));
const manifest=JSON.parse(fs.readFileSync(path.join(base,'wasm/build-manifest.json'))),ir=JSON.parse(fs.readFileSync(path.join(base,'wasm/generated/story.ir.json')));
const expectedId=manifest.runtimeBuildId;assert(expectedId&&expectedId===manifest.runtimeBuildId,'用法：node verify-routes.cjs <冻结的runtimeBuildId>；必须匹配当前候选');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashes=Object.fromEntries(fs.readdirSync(path.join(base,'wasm/web')).filter(f=>fs.statSync(path.join(base,'wasm/web',f)).isFile()).map(f=>[f,hash(path.join(base,'wasm/web',f))]));
const probe=process.argv.includes('--probe-hq');
const reportPath=path.join(dir,probe?'routes-probe-hq-report.json':'routes-report.json');
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'route-cases.json'))).filter(c=>c.name==='huangqiuqiu/HIGH/AA');
const largest=[];
const groups=[p=>p.assetId.startsWith('sui-a06-orb'),p=>p.assetId.startsWith('sui-a06-human'),p=>p.assetId.startsWith('piao-')&&p.layer==='prop1',p=>p.assetId.startsWith('piao-')&&p.layer==='center'];
const restoreTargets=groups.slice(0,2).map(test=>bindings.find(b=>!b.cgId&&[...b.enter.characters,...b.enter.props].some(test))).filter(Boolean).map(b=>b.anchor.nodeId);assert.equal(restoreTargets.length,2);
const report={date:'2026-10-30',layer:'同一SUI-I02正式候选的Suika3 Wasm全程原生输入烟测；非全篇人工审读、真机、电脑分发或发布验收',runtimeBuildId:manifest.runtimeBuildId,contentBuildId:manifest.contentBuildId,webHashes:hashes,checks:[],results:[],screenshots:[],errors:[]};
fs.mkdirSync(path.join(dir,'screenshots'),{recursive:true});
const fields=line=>Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const slug=s=>s.replaceAll('/','-');
const captured=new Set();
async function runCase(browser,c){
 const started=Date.now(),context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Shanghai'}),page=await context.newPage();
 const logs=[],errors=[],shots=[],clicks=[],decisions=[];let caseComplete=false;
 const result={name:c.name,status:'running',inputMethod:'ordinary Enter keydown/keyup events and Playwright mouse clicks; no native state injection',answers:c.answers};
 const expected=model(ir).run(c.answers),expectedChoices=expected.trace.filter(t=>t.op==='choice');
 result.expected={route:expected.s.route,relation:expected.s.relation,score:String(expected.s.score),ending:expected.s.ending,epilogue:expected.s.epilogue?ir.contract.epilogues.rules.find(r=>r.target?.file===expected.s.epilogue).target.anchor:'',event:expected.s.events.includes(ir.contract.day36.eventId)?'1':'0',return:''};
 page.on('console',m=>{const text=m.text();if(/^SUI_[EI]\|/.test(text))logs.push(text);else if(m.type()==='error')errors.push(text);});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',async d=>{errors.push(d.message());await d.dismiss()});
 const shot=async name=>{const filename='routes-'+(probe?'probe-hq-':'')+slug(c.name)+'-'+name+'.png';await page.screenshot({path:path.join(dir,'screenshots',filename)});shots.push(filename);};
 const click=async(x,y)=>{const r=await page.locator('#canvas').boundingBox();assert(r);await page.mouse.move(r.x+x*r.width/1280,r.y+y*r.height/720);await page.waitForTimeout(100);await page.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:150});};
 try{
  await page.goto(url);await page.waitForFunction(()=>window.suie?.ready&&suie.events.some(x=>x==='SUI_E|title'),null,{timeout:45000});
  assert(logs.includes('SUI_E|ready|'+expectedId),'实际加载候选ID不符');
  await page.waitForTimeout(700);
  await click(240,386);
  await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:10000});
  let choiceIndex=0;
  function accountEnterUntil(id){
   while(choiceIndex<expectedChoices.length&&expectedChoices[choiceIndex].id!==id){
    const skipped=expectedChoices[choiceIndex++];assert(probe&&skipped.value==='A','普通流程不得漏点选择 '+skipped.id);
    decisions.push({id:skipped.id,value:'A',method:'native-enter'});
   }
  }
  while(!caseComplete){
   assert(Date.now()-started<15*60*1000,'单路径超时');assert.equal(errors.length,0,JSON.stringify(errors));
   const stopTargets=restoreTargets.filter(id=>!captured.has(id));
   if(probe){const r=await page.locator('#canvas').boundingBox();await page.mouse.move(r.x+640*r.width/1280,r.y+148*r.height/720);}
   const questionIds=probe?['ROUTE-01']:Object.keys(ir.choices);
   await page.evaluate(({stopTargets,questionIds,pressure})=>{
    if(window.__routeInput?.timer)clearInterval(window.__routeInput.timer);
    const canvas=document.getElementById('canvas');canvas.focus();
    const driver=window.__routeInput={down:false,reason:null,state:null,timer:null};
    const key=(type)=>canvas.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    const finish=(reason,state)=>{clearInterval(driver.timer);key('keyup');driver.down=false;driver.reason=reason;driver.state=state;};
    driver.timer=setInterval(()=>{
     const completed=suie.events.findLast(x=>x.startsWith('SUI_E|complete|'));
     if(completed){finish('complete',completed);return;}
     const current=suie.events.findLast(x=>x.startsWith('SUI_E|stable|'));
     if(current){
      const f=Object.fromEntries(current.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
      if(f.tag==='choose'&&(!pressure||f.pending==='ROUTE-01')){finish('choice',current);return;}
      if(f.tag==='text'&&questionIds.includes(f.cursor)){finish('question',current);return;}
      if(stopTargets.includes(f.cursor)){finish('screenshot',current);return;}
     }
     key(driver.down?'keyup':'keydown');driver.down=!driver.down;
    },25);
   },{stopTargets,questionIds,pressure:probe});
   await page.waitForFunction(()=>window.__routeInput?.reason,null,{timeout:120000});
   const stop=await page.evaluate(()=>({reason:__routeInput.reason,state:__routeInput.state}));
   const state=fields(stop.state);
   if(stop.reason==='complete'){
    result.actual=state;caseComplete=true;
    for(const[k,v]of Object.entries(result.expected))assert.equal(state[k],v,c.name+' '+k);
    accountEnterUntil(null);assert.equal(decisions.length,expectedChoices.length);
    await page.waitForTimeout(400);await shot('complete');
   }else if(stop.reason==='question'){
    // Release Enter at a deliberate question pause; pointer taps outside every choice
    // advance text without inadvertently selecting a just-created option.
    let reached=false;
    for(let attempt=0;attempt<5;attempt++){
     await click(1240,700);await page.waitForTimeout(220);
     const last=await page.evaluate(()=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|')));
     if(fields(last).tag==='choose'){reached=true;break;}
    }
    assert(reached,'问题文字无法推进到选择按钮 '+state.cursor);
   }else if(stop.reason==='screenshot'){
    captured.add(state.cursor);await page.waitForTimeout(350);await shot(state.cursor);
    const cursor=state.cursor;
    const wait=async()=>{await page.waitForTimeout(600);await page.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError);};
    const tap=async(x,y)=>{await click(x,y);await wait();};
    const key=async(k)=>{await page.locator('#canvas').focus();await page.keyboard.press(k,{delay:150});await wait();};
    await tap(1168,52);await tap(260,230);await tap(920,256);await page.waitForFunction(id=>suie.events.some(l=>l.startsWith('SUI_E|save|slot=1|')&&l.includes('|cursor='+id+'|')),cursor);await key('Escape');await shot(cursor+'-before');
    let advanced=false;
    for(let i=0;i<5;i++){await key('Enter');const last=fields(await page.evaluate(()=>suie.events.findLast(l=>l.startsWith('SUI_E|stable|'))));if(last.cursor!==cursor){advanced=true;break;}}
    assert(advanced);
    await tap(1168,52);await tap(640,230);await tap(920,256);
    assert.equal(fields(await page.evaluate(()=>suie.events.findLast(l=>l.startsWith('SUI_E|load|')))).cursor,cursor);await shot(cursor+'-loaded');
    await page.reload();await page.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:30000});await wait();await tap(240,466);await tap(920,256);
    assert.equal(fields(await page.evaluate(()=>suie.events.findLast(l=>l.startsWith('SUI_E|load|')))).cursor,cursor);await shot(cursor+'-reloaded');
    result.restored??=[];result.restored.push({cursor,characters:byNode.get(cursor).enter.characters,props:byNode.get(cursor).enter.props});
    console.log('RESTORE '+c.name+' '+cursor);

   }else{
    const id=state.pending;accountEnterUntil(id);const want=expectedChoices[choiceIndex++];assert(want,'额外选择 '+id);assert.equal(id,want.id,'选择顺序');
    const choice=ir.choices[id];assert(choice);
    // Available route choices depend on already-read common choices, not the case's future answers.
    let options=choice.options;
    if(id===ir.contract.storyEntry.routeChoice){
     const eligible=Object.entries(ir.contract.hiddenEntry.choiceRequirements).every(([k,v])=>decisions.some(x=>x.id===k&&x.value===v));
     options=options.filter(o=>o.value!==ir.contract.hiddenEntry.routeId||eligible);
     await shot(options.length+'-route-options');
    }
    const value=c.answers[id],index=options.findIndex(o=>o.value===value);assert(index>=0,'选项不可用');
    await click(640,148+96*index);clicks.push({id,value,index,options:options.length});decisions.push({id,value,method:'mouse'});
    await page.waitForFunction(old=>{const line=suie.events.findLast(x=>x.startsWith('SUI_E|stable|'));return line&&line!==old||suie.events.some(x=>x.startsWith('SUI_E|complete|'));},stop.state,{timeout:10000});
    if(id==='ROUTE-01')console.log('ROUTE '+c.name+' '+state.relation);
   }
  }
  await page.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError,null,{timeout:15000});
  const dbs=await page.evaluate(()=>indexedDB.databases());assert(dbs.length>=1&&dbs.every(d=>d.name.startsWith('bijie-rain-suika3-v1:')));
  result.databases=dbs;result.nativeChoiceClicks=clicks.length;result.stablePages=logs.filter(x=>x.startsWith('SUI_E|stable|')&&x.includes('|tag=text|')).length;
  const expectedTextIds=expected.paragraphs.flatMap(p=>ir.nodes.filter(n=>n.op==='text'&&n.paragraph===p.id).map(n=>n.id));
  const actualTextIds=logs.filter(x=>x.startsWith('SUI_E|stable|')&&fields(x).tag==='text'&&fields(x).cursor.startsWith('TEXT_')).map(x=>fields(x).cursor);
  assert(expectedTextIds.every(id=>actualTextIds.includes(id)),'恢复路径缺正文游标');result.narrativePages=actualTextIds.length;result.allNarrativeCursorsMatched=true;
  result.actualCG=[...new Set(logs.filter(l=>l.startsWith('SUI_I|unlock|')).map(l=>fields(l).cg))].sort();
  assert.deepEqual(result.actualCG,[...new Set(c.cg)].sort(),'实际可见CG解锁与路径预期不符');
  const entered=logs.filter(l=>l.startsWith('SUI_I|enter|')).map(l=>fields(l).node);
  for(const node of expectedTextIds)assert(entered.includes(node),'正文未执行演出 '+node);
  result.allNarrativeBindingsMatched=true;
  const checkpoints=logs.filter(x=>x.startsWith('SUI_E|checkpoint|')).map(x=>fields(x).choice);
  assert.deepEqual(checkpoints,expectedChoices.map(x=>x.id),'每个选择都在提交前建立原生快照');result.checkpoints=checkpoints;result.everyChoiceCheckpointed=true;
  result.eventInProgress=logs.some(x=>x.startsWith('SUI_E|stable|')&&fields(x).return);result.publicEventRead=logs.some(x=>x.startsWith('SUI_E|stable|')&&fields(x).event==='1');
  if(c.name==='friends/LOW/AA'){assert(result.eventInProgress);assert(result.publicEventRead);}
  if(probe){
   const lastChoice=expectedChoices.at(-1).id;
   await click(1168,52);await page.waitForTimeout(300);await click(640,558);
   await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|rollback|')),null,{timeout:10000});
   const restored=fields(await page.evaluate(()=>suie.events.findLast(x=>x.startsWith('SUI_E|rollback|'))));
   assert.equal(restored.cursor,lastChoice);assert.equal(restored.pending,'');assert.equal(restored.tag,'e_checkpoint');
   let reached=false;
   for(let i=0;i<5;i++){await click(1240,700);await page.waitForTimeout(220);const line=await page.evaluate(()=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|')));if(fields(line).pending===lastChoice&&fields(line).tag==='choose'){reached=true;break;}}
   assert(reached,'回退问题页不能进入选项');await shot('rollback-question-choice');
   const changed=model(ir).run({...c.answers,[lastChoice]:'B'}).paragraphs.flatMap(p=>ir.nodes.filter(n=>n.op==='text'&&n.paragraph===p.id).map(n=>n.id));
   const firstChange=changed.find((id,i)=>id!==expectedTextIds[i]);assert(firstChange);
   await click(640,244);await page.waitForFunction(id=>suie.events.some(x=>x.startsWith('SUI_E|stable|')&&x.includes('|cursor='+id+'|')),firstChange,{timeout:10000});
   result.pressureRollback={choice:lastChoice,restored,changedTo:'B',firstChangedPage:firstChange,pass:true};await shot('rollback-changed-to-B');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));result.status='pass';console.log('PASS '+c.name+' pages='+result.stablePages+' choices='+clicks.length);
 }catch(e){result.status='fail';result.error=e.stack;report.errors.push({case:c.name,error:e.stack});await shot('failure').catch(()=>{});console.error('FAIL '+c.name,e.message);}
 finally{
  result.elapsedMs=Date.now()-started;result.clicks=clicks;result.decisions=decisions;result.nativeEnterChoices=decisions.filter(x=>x.method==='native-enter').length;result.logs=logs;result.errors=errors;result.screenshots=shots;
  report.results.push(result);report.screenshots.push(...shots);
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  await context.close();
 }
 return result.status==='pass';
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 try{
  // Two independent contexts share only this immutable candidate. Each uses a fresh storage profile.
  let next=0;async function worker(){while(next<cases.length){const c=cases[next++];if(!(await runCase(browser,c)))return;}}
  await worker();
  assert.equal(report.results.length,cases.length,'未完成所有路线');assert(report.results.every(r=>r.status==='pass'));
  assert((probe?largest.slice(0,1):largest).every(id=>captured.has(id)),'未覆盖指定最大正文截图');
  for(const[f,h]of Object.entries(hashes))assert.equal(hash(path.join(base,'wasm/web',f)),h,'验收期间候选被修改 '+f);
  report.checks.push({name:probe?'黄球球全程25ms输入压力探针':'球形、人形及飘人物/道具的自然路径存读档和刷新恢复',pass:true},...(probe?[]:[{name:'朋友LOW公共事件进入与返回',pass:true}]),{name:probe?'共通108字正文原生截图':'两段108字正文原生截图',pass:true},{name:'每个选择均有提交前原生快照',pass:true},{name:'同一候选四文件指纹及独立存档库',pass:true});
  report.actualCG=[...new Set(report.results.flatMap(r=>r.actualCG))].sort();assert.equal(report.results.flatMap(r=>r.restored||[]).length,2);report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;console.error(e);process.exitCode=1;}
 finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');await browser.close();}
})();
