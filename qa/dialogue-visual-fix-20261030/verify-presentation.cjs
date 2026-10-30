const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),crypto=require('crypto');
const{chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,version=process.argv[2],port=Number(process.argv[3]),base=path.join(dir,'../../build',version),manifest=JSON.parse(fs.readFileSync(path.join(base,'wasm/build-manifest.json'))),out=path.join(dir,version,process.argv[4]||'presentation');fs.mkdirSync(out,{recursive:true});
const report={scope:'正式候选自然开场背景/人物/CG/图库/读档；非全篇人工验收',version,runtimeBuildId:manifest.runtimeBuildId,checks:[],errors:[],shots:[],logs:[]};const profile=fs.mkdtempSync(path.join(os.tmpdir(),'suii-presentation-'));report.profile=profile;let ctx,p;
const frozen=path.join(base,'input'),adopted=JSON.parse(fs.readFileSync(path.join(frozen,'assets/current/manifest.json'))),cues=JSON.parse(fs.readFileSync(path.join(frozen,'docs/整合/bindings.json'))).bindings;
const cgCue=cues.find(c=>c.cgId==='CG001'),sceneCue=cues.find(c=>c.enter.characters.some(p=>p.assetId==='maolang-base')&&c.anchor.file.includes('第一章'));
report.inputs={adopted:adopted.assets.length,cues:cues.length,cg:cgCue,scene:cues.filter(c=>c.anchor.nodeId===sceneCue.anchor.nodeId)};
const check=(name,details)=>{report.checks.push({name,pass:true,details});console.log('PASS '+name)};
async function settle(){await p.waitForTimeout(250);await p.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:20000});}
async function click(x,y){const r=await p.locator('#canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:60});await settle()}
async function key(k){await p.locator('#canvas').focus();await p.keyboard.down(k);await p.waitForTimeout(60);await p.keyboard.up(k);await settle()}
const state=()=>report.logs.filter(l=>/^SUI_E\|(stable|load|rollback)\|/.test(l)).at(-1);
const cursor=()=>state()?.match(/\|cursor=([^|]+)/)?.[1];
async function shot(name){const box=await p.locator('#canvas').boundingBox();const file=path.join(out,name+'.png');await p.locator('#canvas').screenshot({path:file});report.shots.push({name,file,canvasBox:box,canvas:[1280,720],sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}
async function next(){const before=cursor();for(let i=0;i<10&&cursor()===before;i++){if(state()?.includes('|tag=choose|'))await click(640,148);else await key('Enter');}assert.notEqual(cursor(),before);}
async function save(slot){await click(1168,52);await click(260,230);await click(slot%2?920:280,slot<2?256:498);await key('Escape')}
async function load(slot,title=false){if(!title)await click(1168,52);await click(title?240:640,title?466:230);await click(slot%2?920:280,slot<2?256:498)}
async function launch(){ctx=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1280,height:800},deviceScaleFactor:1});p=ctx.pages()[0];p.on('console',m=>{if(/^SUI_[EIU]\|/.test(m.text()))report.logs.push(m.text());if(m.type()==='error')report.errors.push(m.text());});p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{const m=d.message();(report.dialogs??=[]).push(m);if(m.startsWith('SUI_I|'))report.logs.push(m);else report.errors.push(m);await d.dismiss()});await p.goto('http://127.0.0.1:'+port);await p.waitForFunction(()=>suie.events.some(x=>x.includes('SUI_E|title')),null,{timeout:30000});await settle();report.userAgent=await p.evaluate(()=>navigator.userAgent);assert(report.logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));}
(async()=>{try{
await launch();await click(312,546);await shot('01-gallery-locked');await click(240,220);await shot('02-locked-click');check('未遇见CG时图鉴保持锁定');for(let i=0;i<9;i++)await click(1120,616);await shot('02b-gallery-page10');check('真实图库显示60项的第10页，未遇见项目保持锁定');await key('Escape');
await click(240,386);await p.waitForFunction(()=>suie.events.some(x=>x.includes('SUI_E|stable')),null,{timeout:30000});await settle();await shot('00-opening');const opening=cursor();
while(cursor()!==sceneCue.anchor.nodeId)await next();await shot('03-character');const first=cursor();await save(1);check('自然正文第2段实际显示毛狼与站台并保存',first);
await next();await shot('03b-next-paragraph');while(cursor()!==cgCue.anchor.nodeId)await next();const cg=cursor();assert(report.logs.some(x=>x.includes('unlock|cg=CG001|phase=first-visible-frame')));await shot('04-cg');await save(2);await key('v');await shot('05-cg-full');assert.equal(cursor(),cg);assert(report.logs.some(x=>x.includes('full-view|opened')));await key('Enter');assert.equal(cursor(),cg);await click(150,52);assert.equal(cursor(),cg);await shot('05b-touch-full');await click(640,300);assert.equal(cursor(),cg);check('第4段CG首可见帧解锁，键盘/点击全图开关均不推进原段',cg);
await next();await shot('06-exit-hidden');assert.notEqual(cursor(),cg);assert(cues.find(b=>b.anchor.nodeId===cursor()).enter.characters.some(p=>p.assetId==='maolang-base'));check('CG退出后恢复同场毛狼，下一句立绘持续存在',cursor());
await load(2);assert.equal(cursor(),cg);await shot('07-cg-loaded');await key('v');await shot('08-cg-loaded-full');await key('Escape');assert.equal(cursor(),cg);check('手动档恢复CG与全图查看');await load(1);assert.equal(cursor(),first);await shot('09-character-loaded');check('手动档恢复背景/人物/站位');
await ctx.close();await launch();await load(2,true);assert.equal(cursor(),cg);await shot('10-cg-reopened');await key('v');await shot('11-cg-reopened-full');await key('Escape');check('关闭浏览器重开后CG存档与全图恢复');
// Return to title via UI confirmation, preserving global CG unlock.
await click(1168,52);await click(260,558);await click(500,430);await p.waitForFunction(()=>suie.events.some(x=>x.includes('SUI_E|title')));await click(312,546);await shot('12-gallery-unlocked');await click(240,220);await shot('13-gallery-detail');assert.equal(new Set(report.logs.filter(l=>l.includes('SUI_I|unlock|cg=')).map(l=>l.match(/cg=([^|]+)/)[1])).size,1);check('仅自然遇见CG001解锁，图库详情可用；其余59项未声称解锁');await key('Escape');await key('Escape');await click(240,386);await settle();assert.equal(cursor(),opening);check('新游戏恢复声明的站台开场，不继承旧CG舞台');

const ir=JSON.parse(fs.readFileSync(path.join(base,'wasm/generated/story.ir.json')));
const target=ir.nodes.find(n=>n.op==='text'&&n.source.file==='第一章-回到毕节.md'&&n.source.line===117);
const choice=cues.find(b=>b.anchor.nodeId==='C01-01');
while(cursor()!=='C01-01')await next();
await shot('14-choice-portraits');assert.equal(choice.enter.characters.length,2);await save(3);await next();await load(3);assert.equal(cursor(),'C01-01');await shot('15-choice-restored');check('选择前保留毛狼与师匠，保存读取正确恢复');
while(cursor()!==target.id)await next();
await p.waitForTimeout(1600);await shot('16-rain-backdrop');await save(3);await next();await load(3);assert.equal(cursor(),target.id);await shot('17-rain-backdrop-restored');check('原纯黑段117行显示雨窗阅读背景，保存读取恢复同段');

assert.deepEqual(report.errors,[]);assert.deepEqual(report.dialogs||[],[],'候选不应弹出诊断日志');check('原生/浏览器错误为零');report.status='pass';
}catch(e){report.status='fail';report.failure=e.stack;console.error(e);if(p)await shot('failure').catch(()=>{});process.exitCode=1}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(ctx)await ctx.close()}})();
