#!/usr/bin/env node
'use strict';
// Public-event save recovery using only ordinary keyboard and mouse input.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,expectedId='b5df1a77814c02b173d77fb7fe0022e7d113e056ea64daa41d50a0c786a21391';
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'build-manifest.json'))),ir=JSON.parse(fs.readFileSync(path.join(dir,'generated/story.ir.json')));
assert.equal(manifest.runtimeBuildId,expectedId,'只能测试冻结候选');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashes=Object.fromEntries(manifest.outputs.map(o=>[o.path,hash(path.join(dir,o.path))]));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'suie-event-save-'));
const report={date:'2026-10-28',layer:'正式候选原生输入：朋友LOW公共事件内存档、读档、独立浏览器关闭重开、调用返回；非手机真机或全篇人工审读',runtimeBuildId:expectedId,contentBuildId:manifest.contentBuildId,webHashes:hashes,profile,checks:[],clicks:[],screenshots:[],errors:[],logs:[]};
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
let context,page,session=0;
const current=()=>fields(report.logs.filter(x=>/^SUI_E\|(stable|load)\|/.test(x.line)).at(-1)?.line);
const check=(name,detail)=>{report.checks.push({name,pass:true,detail});console.log('PASS '+name);};
const saveReport=()=>fs.writeFileSync(path.join(dir,'event-save-report.json'),JSON.stringify(report,null,2)+'\n');
async function settle(){await page.waitForTimeout(240);await page.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:15000});}
async function click(x,y){const r=await page.locator('#canvas').boundingBox();assert(r);await page.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:70});await settle();}
async function key(k){await page.locator('#canvas').focus();await page.keyboard.down(k);await page.waitForTimeout(55);await page.keyboard.up(k);await settle();}
async function shot(name){const rel='screenshots/event-'+name+'.png';await page.screenshot({path:path.join(dir,rel)});report.screenshots.push(rel);}
async function launch(){
 session++;context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1440,height:900},timezoneId:'Asia/Shanghai'});page=context.pages()[0];
 page.on('console',m=>{if(m.text().startsWith('SUI_E|'))report.logs.push({session,line:m.text()});else if(m.type()==='error')report.errors.push(m.text());});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
 await page.goto('http://127.0.0.1:49221/');await page.waitForFunction(()=>suie.ready&&suie.events.includes('SUI_E|title'),null,{timeout:45000});
 assert(await page.evaluate(id=>suie.events.includes('SUI_E|ready|'+id),expectedId));await settle();
}
async function advance(mode,startCursor=''){
 await page.evaluate(({mode,startCursor})=>{
  const canvas=document.getElementById('canvas');canvas.focus();let down=false,last=startCursor,pages=0;
  const driver=window.__eventDriver={reason:null,line:null,timer:null};
  const key=type=>canvas.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  const finish=(reason,line)=>{clearInterval(driver.timer);key('keyup');driver.reason=reason;driver.line=line;};
  driver.timer=setInterval(()=>{
   const line=suie.events.findLast(x=>/^SUI_E\|(stable|load)\|/.test(x));
   const f=Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
   if(f.tag==='choose'){finish('choice',line);return;}
   if(mode==='event'&&f.return){finish('event',line);return;}
   if(mode==='returned'&&f.event==='1'&&f.return===''){finish('returned',line);return;}
   if(mode==='pages'&&f.cursor&&f.cursor!==last){last=f.cursor;pages++;if(pages>=3){finish('pages',line);return;}}
   if(suie.events.some(x=>x.startsWith('SUI_E|complete|'))){finish('complete',line);return;}
   key(down?'keyup':'keydown');down=!down;
  },25);
 },{mode,startCursor});
 await page.waitForFunction(()=>window.__eventDriver?.reason,null,{timeout:120000});
 const result=await page.evaluate(()=>({reason:__eventDriver.reason,line:__eventDriver.line}));
 await settle();assert.deepEqual(report.errors,[]);return{...result,state:fields(result.line)};
}
async function loadOne(title=false){if(!title)await click(1168,52);await click(title?240:640,title?466:230);const before=report.logs.length;await click(920,256);assert(report.logs.slice(before).some(x=>x.line.startsWith('SUI_E|load|slot=1|')),'缺少真实槽位1读取成功日志');}
(async()=>{try{
 fs.mkdirSync(path.join(dir,'screenshots'),{recursive:true});await launch();await click(240,386);
 await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:10000});
 let stopped;
 while(true){
  stopped=await advance('event');if(stopped.reason==='event')break;assert.equal(stopped.reason,'choice');
  const id=stopped.state.pending,choice=ir.choices[id];assert(choice);
  const value=id==='ROUTE-01'?'friends':['C01-06','C02-08','C02-09'].includes(id)?'B':'A';
  let options=choice.options;
  if(id==='ROUTE-01'){
   const eligible=Object.entries(ir.contract.hiddenEntry.choiceRequirements).every(([k,v])=>report.clicks.some(x=>x.id===k&&x.value===v));
   options=options.filter(o=>o.value!==ir.contract.hiddenEntry.routeId||eligible);
  }
  const index=options.findIndex(o=>o.value===value);assert(index>=0);await click(640,148+96*index);
  await page.waitForFunction(old=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|'))!==old,stopped.line,{timeout:10000});
  report.clicks.push({id,value,index});if(id==='ROUTE-01')console.log('朋友 LOW 已选线');saveReport();
 }
 const beforeSave=stopped.state;assert.equal(beforeSave.route,'friends');assert.equal(beforeSave.relation,'LOW');assert.equal(beforeSave.score,'5');assert.equal(beforeSave.event,'0');assert(beforeSave.return);
 assert.equal(ir.nodes.find(n=>n.id===beforeSave.cursor).source.file,ir.contract.day36.sharedSource.file);
 await page.waitForTimeout(3500);await shot('01-in-progress');
 await click(1168,52);await click(260,230);const saveLogStart=report.logs.length;await click(920,256);await key('Escape');
 const savedLine=report.logs.slice(saveLogStart).find(x=>x.line.startsWith('SUI_E|save|slot=1|'))?.line;assert(savedLine,'手动保存成功日志缺失');
 const saved=fields(savedLine);for(const field of ['cursor','return','event','route','relation','score'])assert.equal(saved[field],beforeSave[field]);
 check('公共事件内通过菜单保存完整原生位置和返回锚点',saved);await shot('02-saved');
 stopped=await advance('pages',saved.cursor);assert.equal(stopped.reason,'pages');assert.notEqual(stopped.state.cursor,saved.cursor);assert.equal(stopped.state.return,saved.return);
 const progressed=stopped.state;await loadOne();const restored=current();
 for(const field of ['cursor','return','event','route','relation','score','index','tag'])assert.equal(restored[field],saved[field],field);
 check('事件正文推进后读档恢复游标、返回锚点和未读事件标记',{progressed,restored});await shot('03-restored');
 await settle();await context.close();context=null;await launch();await loadOne(true);const reopened=current();
 for(const field of ['cursor','return','event','route','relation','score','index','tag'])assert.equal(reopened[field],saved[field],field);
 check('关闭独立浏览器并使用同一临时资料重开后，事件内档持久恢复',reopened);await shot('04-reopened');
 const afterReopen=report.logs.length;stopped=await advance('returned');assert.equal(stopped.reason,'returned');
 const returned=stopped.state;assert.equal(returned.route,'friends');assert.equal(returned.event,'1');assert.equal(returned.return,'');
 const returnedNode=ir.nodes.find(n=>n.id===returned.cursor);assert.equal(returnedNode.source.file,ir.contract.routes.find(r=>r.id==='friends').file);
 const eventIds=ir.nodes.filter(n=>n.op==='text'&&n.source.file===ir.contract.day36.sharedSource.file).map(n=>n.id);
 const seenEventIds=[reopened.cursor,...report.logs.slice(afterReopen).filter(x=>x.line.startsWith('SUI_E|stable|')).map(x=>fields(x.line).cursor).filter(id=>eventIds.includes(id))];
 assert.deepEqual(seenEventIds,eventIds,'关闭重开后事件正文应顺序执行一次');
 check('从恢复位置顺序读完事件后返回朋友路线，只在RETURN后置已读',{returned,expectedEventPages:eventIds.length,seenEventIds});await shot('05-returned');
 stopped=await advance('choice');assert.equal(stopped.reason,'choice');assert.equal(stopped.state.event,'1');assert.equal(stopped.state.return,'');assert.equal(stopped.state.route,'friends');
 const allAfter=[reopened.cursor,...report.logs.slice(afterReopen).filter(x=>x.line.startsWith('SUI_E|stable|')).map(x=>fields(x.line).cursor).filter(id=>eventIds.includes(id))];assert.deepEqual(allAfter,eventIds);
 check('返回后推进到下一处朋友线选择，公共事件未重复',{nextChoice:stopped.state.pending,eventPageCount:allAfter.length});await shot('06-next-route-choice');
 const dbs=await page.evaluate(()=>indexedDB.databases());assert(dbs.length&&dbs.every(d=>d.name.startsWith('bijie-rain-suika3-v1:')));check('使用独立临时浏览器资料与本作数据库',dbs);
 for(const[file,digest]of Object.entries(hashes))assert.equal(hash(path.join(dir,file)),digest,'验收期间候选改变：'+file);
 assert.deepEqual(report.errors,[]);check('冻结候选指纹不变、原生弹错与浏览器错误均为零');report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;console.error(e);process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{report.finishedAt=new Date().toISOString();saveReport();if(context)await context.close();}})();
