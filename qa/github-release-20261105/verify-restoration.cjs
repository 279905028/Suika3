#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const PW=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../..'),[preview,port,out,browserName='chrome']=process.argv.slice(2),base=path.resolve(ROOT,preview),dir=path.resolve(ROOT,out);
assert(!fs.existsSync(dir),'不覆盖证据');fs.mkdirSync(dir,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(base,'runtime/build-manifest.json'))),profile=fs.mkdtempSync(path.join(os.tmpdir(),'suika-p5-restoration-'));
const report={status:'running',runtimeBuildId:manifest.runtimeBuildId,profile,scope:'正式完整包的普通/CG/选择手动自动档、刷新重开、改选回退、图鉴和模拟横屏；不含手机真机',checks:[],errors:[],events:[]};let ctx,p;
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const latest=()=>p.evaluate(()=>suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)));
const settle=async()=>{await p.waitForTimeout(500);await p.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:15000});};
const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:80});await settle();};
const key=async k=>{await p.locator('#canvas').focus();await p.keyboard.press(k,{delay:80});await settle();};
const check=(name,detail)=>{report.checks.push({name,detail,pass:true});console.log('PASS '+name);};
const shot=async name=>p.screenshot({path:path.join(dir,name+'.png')});
const launch=async()=>{
 ctx=await (browserName==='chrome'?PW.chromium:PW[browserName]).launchPersistentContext(profile,{headless:true,viewport:{width:1280,height:800},hasTouch:true,...(browserName==='chrome'?{channel:'chrome'}:{}),...(browserName==='firefox'?{firefoxUserPrefs:{'network.proxy.type':0}}:{})});p=ctx.pages()[0];report.browser=browserName+' '+ctx.browser()?.version();
 p.on('console',m=>{if(/^SUI_[EIC]\|/.test(m.text()))report.events.push(m.text());else if(m.type()==='error')report.errors.push(m.text());});p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
 await p.goto('http://127.0.0.1:'+port);await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:90000});await settle();assert(report.events.includes('SUI_E|ready|'+manifest.runtimeBuildId));
};
const menu=async()=>click(1160,48),slots=[[470,250],[950,250],[470,490],[950,490]];
const save=async slot=>{await menu();await click(120,270);await click(870,90);await click(...slots[slot]);await click(120,625);};
const load=async(slot,title=false)=>{if(title){await p.waitForTimeout(1500);await click(560,665);}else{await menu();await click(120,270);}await click(1100,90);await click(...slots[slot]);};
async function untilChoice(){
 await p.evaluate(()=>{const c=document.getElementById('canvas');c.focus();window.p5Drive={down:false,done:false};const d=p5Drive;d.timer=setInterval(()=>{const hold=suie.events.findLast(x=>x.startsWith('SUI_I|cg-hold|'));if(hold?.startsWith('SUI_I|cg-hold|start|')||window.endingMotion?.busy()){if(d.down){c.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));d.down=false;}return;}const l=suie.events.findLast(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x))||'';if(l.includes('|tag=choose|')||/\|cursor=C\d\d-\d\d\|/.test(l)){clearInterval(d.timer);c.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));d.done=true;return;}c.dispatchEvent(new KeyboardEvent(d.down?'keyup':'keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));d.down=!d.down;},30);});
 await p.waitForFunction(()=>p5Drive.done,null,{timeout:120000});await settle();for(let i=0;i<10&&fields(await latest()).tag!=='choose';i++)await click(400,700);assert.equal(fields(await latest()).tag,'choose');
}
(async()=>{try{
 await launch();await shot('title');
 // Locked gallery and all 14 pages, without story unlocks.
 await click(1040,665);const hashes=[];for(let i=0;i<14;i++){hashes.push(require('node:crypto').createHash('sha256').update(await p.locator('#canvas').screenshot()).digest('hex'));if(i<13)await key('PageDown');}assert.equal(new Set(hashes).size,14);await shot('gallery-page14');
 const before=await p.locator('#canvas').screenshot();await key('PageDown');assert(before.equals(await p.locator('#canvas').screenshot()));assert(!report.events.some(l=>l.startsWith('SUI_I|unlock|')));check('81项图鉴14页与末页边界，浏览不解锁');await click(120,625);
 await click(320,665);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')));await settle();const opening=fields(await latest()).cursor;await save(1);assert(report.events.some(x=>x.startsWith('SUI_E|save|slot=1|')&&fields(x).cursor===opening));check('普通正文手动档1保存',opening);
 for(let i=0;i<6&&fields(await latest()).cursor===opening;i++)await key('Enter');const advanced=fields(await latest()).cursor;assert.notEqual(advanced,opening);await save(2);await load(1);assert.equal(fields(await latest()).cursor,opening);await load(2);assert.equal(fields(await latest()).cursor,advanced);check('两个手动档恢复各自正文及状态');
 // CG001 restoration and full view.
 while(!report.events.some(x=>x.startsWith('SUI_I|unlock|cg=CG001|')))await key('Enter');await p.waitForTimeout(1700);const cg=fields(await latest()).cursor;await save(2);await key('v');assert(report.events.includes('SUI_I|full-view|opened'));await key('Escape');assert.equal(fields(await latest()).cursor,cg);await key('Enter');await key('Enter');await load(2);assert.equal(fields(await latest()).cursor,cg);await shot('cg-loaded');check('CG全图进退不翻页，手动档恢复同一CG',cg);
 await untilChoice();const choice=fields(await latest()).pending;await save(3);await shot('choice');await click(1000,166);await menu();await click(450,350);assert.equal(fields(await latest()).cursor,choice);await untilChoice();await click(1000,254);const changed=fields(await latest()).cursor;assert.notEqual(changed,choice);check('上一选择恢复并改选另一分支',choice);
 await load(3);assert.equal(fields(await latest()).pending,choice);await p.reload();await p.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:90000});await settle();await load(3,true);assert.equal(fields(await latest()).pending,choice);check('刷新恢复选择等待态');
 await ctx.close();await launch();await load(3,true);assert.equal(fields(await latest()).pending,choice);check('关闭重开独立浏览器后恢复手动档');
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);assert(await p.locator('#rotate').isVisible());await shot('portrait');await p.setViewportSize({width:844,height:390});await p.waitForTimeout(300);assert(!await p.locator('#rotate').isVisible());await shot('landscape');const box=await p.locator('#canvas').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=845&&box.y+box.height<=391);await p.touchscreen.tap(box.x+1000*box.width/1280,box.y+254*box.height/720);await settle();assert.notEqual(fields(await latest()).cursor,choice);check('模拟手机横竖屏与真实触控输入，未冒充真机');
 await p.setViewportSize({width:1280,height:800});await p.waitForTimeout(2000);await settle();const auto=fields(report.events.findLast(l=>l.startsWith('SUI_E|save|slot=0|'))).cursor;assert(auto);await p.reload();await p.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:90000});await settle();await load(0,true);assert.equal(fields(await latest()).cursor,auto);check('自动档落盘与刷新后读取',auto);
 const dbs=await p.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));assert(dbs.length&&!dbs.some(n=>n.startsWith('bijie-rain-suika3-v1:')));check('只使用独立测试存储',dbs);assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);if(p)await shot('failure').catch(()=>{});process.exitCode=1;}
 finally{fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');if(ctx)await ctx.close();}
})();
