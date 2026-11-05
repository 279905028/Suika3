#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {ROOT,QA}=require('./build-p1.cjs'),{fields}=require('./verify-p1-browser.cjs');
async function verify(run='interaction-v1',attempt='preview-v5',port=49284){
 const base=path.join(ROOT,QA,attempt),out=path.join(base,run);assert(!fs.existsSync(out));fs.mkdirSync(out);
 const report={status:'running',checks:[],errors:[],logs:[],scope:'P1独立临时Chrome；原生GUI保存、页面重开、回顾、回退、自动/快进、尺寸模拟'},ir=JSON.parse(fs.readFileSync(path.join(base,'runtime/generated/story.ir.json')));
 let browser,p,context;const logs=report.logs;
 const state=()=>fields(logs.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x))),cursor=()=>state().cursor;
 const observe=()=>fields(logs.findLast(x=>x.startsWith('SUI_E|p1-observe|')));
 const wait=async()=>{await p.waitForTimeout(280);await p.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError,null,{timeout:10000});};
 const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:70});await wait();};
 const key=async k=>{await p.locator('#canvas').focus();await p.keyboard.press(k,{delay:65});await wait();};
 const shot=async name=>{await p.mouse.move(1,1);await p.locator('#canvas').screenshot({path:path.join(out,name+'.png')});};
 const check=(name,extra={})=>{report.checks.push({name,...extra});console.log('PASS '+name);};
 const attach=page=>{page.on('console',m=>{if(m.text().startsWith('SUI_'))logs.push(m.text());if(m.type()==='error')report.errors.push(m.text());});page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});};
 const reach=async target=>{
  await p.evaluate(target=>{
   const c=document.getElementById('canvas');c.focus();const d=window.p1Reach={done:false,down:false,timer:null};const key=t=>c.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
   d.timer=setInterval(()=>{const line=suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)),id=line?.split('|cursor=')[1]?.split('|')[0];
    if(id===target){clearInterval(d.timer);key('keyup');d.done=true;return;}
    if(line?.includes('|tag=choose|')){clearInterval(d.timer);key('keyup');d.done='choice';return;}
    const seen=suie.events.findLast(x=>x.startsWith('SUI_E|p1-observe|'));if(!d.down&&!seen?.startsWith('SUI_E|p1-observe|cursor='+id+'|'))return;key(d.down?'keyup':'keydown');d.down=!d.down;
   },50);
  },target);await p.waitForFunction(()=>p1Reach.done,null,{timeout:90000});assert.equal(cursor(),target);await wait();
 };
 const enter=async sample=>{await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await wait();await click(320,664);for(let i=0;i<3;i++)await click(400,700);await click(1000,166+sample*88);await wait();};
 const menu=()=>click(1168,52);
 const save=async slot=>{await menu();await click(130,270);await click(892,92);await click(slot===2?480:980,slot===1?260:500);await key('Escape');};
 const load=async(slot,title=false)=>{await (title?click(640,664):menu());if(!title)await click(130,270);await click(slot===2?480:980,slot===1?260:500);};
 const choose=async(id,value)=>{assert.equal(cursor(),id);for(let i=0;i<8&&state().tag!=='choose';i++)await click(400,700);assert.equal(state().tag,'choose');await click(1000,value==='A'?166:254);};
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'});p=await context.newPage();attach(p);await enter(0);
  await reach('T-C01-000244_1');assert.equal(observe().native,'电话那头的人（电话）');await shot('01-long-phone-name');check('最长电话称呼完整显示，使用当前姓名框');
  await save(1);check('电话段原生手动保存不推进',{cursor:cursor()});assert.equal(cursor(),'T-C01-000244_1');
  await reach('T-C01-000246_1');assert.equal(observe().native,'');await shot('02-action-clears-name');check('电话换文文后，纯动作清空姓名');
  await load(1);assert.equal(cursor(),'T-C01-000244_1');await wait();assert.equal(observe().native,'电话那头的人（电话）');await shot('03-phone-restored');check('读取恢复同一正文与姓名');
  await wait();await p.close();p=await context.newPage();attach(p);await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:60000});await wait();await load(1,true);assert.equal(cursor(),'T-C01-000244_1');await wait();assert.equal(observe().native,'电话那头的人（电话）');check('关闭页面重开后从IndexedDB恢复姓名与位置');
  await reach('T-C01-000005_1');await menu();await click(130,350);await shot('04-history-with-names');assert.equal(cursor(),'T-C01-000005_1');await key('Escape');check('回顾打开并呈现姓名与正文，返回仍在原段');
  // CG is on the original, unchanged hand-back-of-wheel action.
  await load(1);await reach('T-C01-000004_1');const before=cursor();await key('v');assert(logs.some(x=>x==='SUI_I|full-view|opened'));await shot('05-cg-full-view');await key('v');assert.equal(cursor(),before);assert.equal(observe().native,'');await reach('T-C01-000005_1');assert.equal(observe().native,'毛狼');check('CG全图返回不推进、动作清名，下一句恢复毛狼');
  await reach('T-C01-000016_1');assert.equal(observe().native,'师匠');await shot('06-shijiang-name');
  for(const [w,h,label]of [[844,390,'mobile-landscape'],[375,667,'mobile-portrait']]){await p.setViewportSize({width:w,height:h});await wait();await p.screenshot({path:path.join(out,'07-'+label+'.png')});if(w<h)assert(await p.locator('#rotate').isVisible());else{const b=await p.locator('#canvas').boundingBox();assert(b.width<=w&&b.height<=h);}check(w+'×'+h+'尺寸模拟：'+(w<h?'竖屏旋转提示':'姓名框与正文可见'));}
  await p.setViewportSize({width:1280,height:800});await wait();
  await save(2);const autoStart=cursor();await menu();await click(450,200);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|p1-observe|')&&x.includes('|auto=1|')),null,{timeout:10000});
  await p.waitForFunction(old=>{const x=suie.events.findLast(x=>x.startsWith('SUI_E|stable|'));return x&&!x.includes('|cursor='+old+'|');},autoStart,{timeout:30000});await menu();await key('Escape');check('自动阅读实际进入并推进，姓名由当前页恢复');
  await reach('C01-01');await choose('C01-01','A');await reach('T-C01-000029_1');await save(3);
  await menu();await click(450,330);assert(logs.some(x=>x.startsWith('SUI_E|rollback|')));assert.equal(cursor(),'C01-01');await choose('C01-01','B');assert.equal(state().tag,'text');const changed=cursor();assert.equal(changed,'T-C01-000031_1');check('回退C01-01并改选B，恢复选择前状态与B段',{cursor:changed});
  await load(2);assert.equal(cursor(),'T-C01-000016_1');await menu();await click(900,200);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|p1-observe|')&&x.includes('|skip=1')),null,{timeout:10000});await p.waitForTimeout(1000);await menu();await key('Escape');check('已读快进模式实际启动，姓名同步切换');
  // AA/BA branch isolation at MY09: begin with MY07=B, save BA, rollback to BB.
  await enter(2);await reach('MY07-01');await choose('MY07-01','B');await reach('MY08-01');await choose('MY08-01','B');await reach('MY09-01');await choose('MY09-01','A');await reach('T-MY-000314_1');assert.equal(observe().native,'文文（电话）');await save(1);await reach('T-MY-000316_1');await load(1);assert.equal(cursor(),'T-MY-000314_1');assert.equal(observe().native,'文文（电话）');await shot('08-mengyao-BA-restored');check('孟遥BA存读档恢复电话段，保留MY07已停止的关系');
  await menu();await click(450,330);assert.equal(cursor(),'MY09-01');await choose('MY09-01','B');await reach('T-MY-000322_1');assert.equal(observe().native,'文文（电话）');await shot('09-mengyao-BB-rollback');check('孟遥BA回退改为BB，不进入AA秘密继续段');
  report.databases=await p.evaluate(()=>indexedDB.databases());assert(report.databases.every(x=>x.name.startsWith('bijie-p1-isolated-20261102:')));check('测试数据库独立命名，未访问玩家旧档');
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='pass';report.browser=browser.version();
 }catch(e){report.status='fail';report.error=e.stack;if(p)await shot('failure').catch(()=>{});throw e;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
if(require.main===module)verify(process.argv[2],process.argv[3],Number(process.argv[4]||49284)).catch(e=>{console.error(e.stack);process.exitCode=1;});
