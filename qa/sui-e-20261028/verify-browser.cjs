const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,profile=fs.mkdtempSync(path.join(os.tmpdir(),'suie-runtime-')),report={layer:'同一正式候选：独立Chrome实际UI、原生保存/恢复/回退、刷新重开及移动尺寸；非手机真机',profile,build:JSON.parse(fs.readFileSync(path.join(dir,'build-manifest.json'))),checks:[],errors:[],screenshots:[]};
let ctx,p;const logs=[];fs.mkdirSync(path.join(dir,'screenshots'),{recursive:true});
const check=(name,detail)=>{report.checks.push({name,pass:true,detail});console.log('PASS '+name)};
const wait=async s=>p.waitForFunction(s=>suie.events.some(x=>x.includes(s)),s,{timeout:20000});
const stable=()=>logs.filter(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)).at(-1);
const field=(line,k)=>{const m=line?.match(new RegExp('\\|'+k+'=([^|]*)'));return m?.[1]};
async function launch(touch=false){ctx=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,hasTouch:touch,viewport:{width:1440,height:900}});p=ctx.pages()[0];p.on('console',m=>{if(m.text().startsWith('SUI_E|'))logs.push(m.text());if(m.type()==='error')report.errors.push(m.text())});p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});await p.goto('http://127.0.0.1:49221');await wait('SUI_E|title');await settle()}
async function settle(){await p.waitForTimeout(220);await p.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:10000})}
async function click(x,y){const r=await p.locator('#canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:60});await settle()}
async function key(k){await p.locator('#canvas').focus();await p.keyboard.down(k);await p.waitForTimeout(45);await p.keyboard.up(k);await settle()}
async function shot(name){await p.screenshot({path:path.join(dir,'screenshots',name+'.png')});report.screenshots.push(name+'.png')}
async function menu(){await click(1168,52)}
async function save(slot){await menu();await click(260,230);await click(slot%2?920:280,slot<2?256:498);await key('Escape')}
async function load(slot,title=false){if(!title)await menu();await click(title?240:640,title?466:230);await click(slot%2?920:280,slot<2?256:498)}
async function untilChoice(){await p.evaluate(()=>{window.eDrive=setInterval(()=>{const l=suie.events.filter(x=>x.startsWith('SUI_E|stable|')||x.startsWith('SUI_E|load|')).at(-1)||'';if(l.includes('|tag=choose|')){clearInterval(eDrive);return}const c=document.getElementById('canvas');c.focus();window.eKey=!window.eKey;c.dispatchEvent(new KeyboardEvent(eKey?'keydown':'keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}))},35)});await p.waitForFunction(()=>{const l=suie.events.filter(x=>x.startsWith('SUI_E|stable|')||x.startsWith('SUI_E|load|')).at(-1)||'';return l.includes('|tag=choose|')},null,{timeout:90000});await p.evaluate(()=>{clearInterval(eDrive);canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}))});await settle()}
async function files(){return p.evaluate(()=>suie.fs.readdir(suie.mount).filter(n=>n!=='.'&&n!=='..').map(n=>({name:n,bytes:suie.fs.stat(suie.mount+'/'+n).size})))}
(async()=>{try{
 await launch();await shot('01-title');check('正式标题、项目身份与独立空存档库',await p.evaluate(()=>({mount:suie.mount,dbs:indexedDB.databases(),width:canvas.width,height:canvas.height})));
 await click(240,466);await click(920,256);assert(logs.some(x=>x.includes('这个位置还没有存档')));await key('Escape');check('空槽拒绝且未创建进度',await files());
 await click(240,386);await wait('SUI_E|stable');await settle();await shot('02-opening');const opening=field(stable(),'cursor');
 await save(1);await wait('save|slot=1');await shot('03-saved');check('正式开场与手动档1保存',opening);
 await key('Enter');await key('Enter');await p.waitForTimeout(1800);await settle();let second=field(stable(),'cursor');assert.notEqual(second,opening);await save(2);check('快速翻页后停留会补写自动档及手动档2',second);
 await load(1);assert.equal(field(stable(),'cursor'),opening,logs.slice(-15).join('\n'));check('手动档1恢复正文位置和状态');
 await load(2);assert.equal(field(stable(),'cursor'),second);check('手动档2恢复另一正文位置');
 await untilChoice();let choice=field(stable(),'pending');assert(choice);await shot('04-first-choice');await save(3);check('选择等待态自动快照及手动档3',choice);
 await click(640,148);await p.waitForTimeout(600);await menu();await click(640,558);await wait('SUI_E|rollback');assert.equal(field(stable(),'cursor'),choice);assert(['text','choose','e_checkpoint'].includes(field(stable(),'tag')));await untilChoice();await shot('05-rollback');check('真实菜单回到选择前完整快照，下游选择可重选',stable());
 await click(640,244);await p.waitForTimeout(500);const branched=stable();assert.notEqual(field(branched,'cursor'),choice);await load(3);assert.equal(field(stable(),'pending'),choice);check('重选另一分支后，手动档3仍恢复原选择前状态');
 await p.reload();await wait('SUI_E|title');await settle();await load(3,true);assert.equal(field(stable(),'pending'),choice);check('页面刷新后选择存档保留并恢复');
 await ctx.close();await launch();await load(3,true);assert.equal(field(stable(),'pending'),choice);check('关闭独立浏览器重新打开后存档持久化');
 await click(640,148);await untilChoice();const nextChoice=field(stable(),'pending');assert.notEqual(nextChoice,choice);await menu();await click(640,558);assert.equal(field(stable(),'cursor'),choice);await untilChoice();check('当前未选节点的回退跳过自身，回到上一已读选择');
 await load(2);await p.waitForTimeout(1700);await p.reload();await wait('SUI_E|title');await settle();await load(0,true);check('自动档可从标题恢复',stable());
 const dbs=await p.evaluate(()=>indexedDB.databases());assert(dbs.every(d=>d.name.startsWith('bijie-rain-suika3-v1:')));check('数据库名与所有存档均属本作独立命名空间',dbs);
 await ctx.close();await launch(true);await load(3,true);await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);assert(await p.locator('#rotate').isVisible());await shot('06-mobile-portrait');await p.setViewportSize({width:844,height:390});await p.waitForTimeout(250);assert(!(await p.locator('#rotate').isVisible()));await shot('07-mobile-landscape');const r=await p.locator('#canvas').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=845&&r.y+r.height<=391);await p.touchscreen.tap(r.x+640*r.width/1280,r.y+244*r.height/720);await settle();assert.notEqual(field(stable(),'cursor'),choice);check('手机尺寸旋转保留选择位置，短触完成真实分支选择');
 await p.setViewportSize({width:1440,height:900});await settle();await menu();await click(260,558);await click(500,430);await wait('SUI_E|title');await click(240,386);await untilChoice();await load(3);assert.equal(field(stable(),'pending'),choice);await click(640,148);await menu();await click(640,558);assert.equal(field(stable(),'cursor'),choice);await untilChoice();check('新游戏保留旧手动档和对应快照，读取旧档后回退不会串入新一轮');
 const beforeFiles=await files();await p.evaluate(()=>{window.eSyncOriginal=suie.fs.syncfs;suie.fs.syncfs=(populate,cb)=>{if(!populate)cb(new Error('QA injected write failure'));else eSyncOriginal(populate,cb)};suie.requestFlush()});await p.waitForFunction(()=>suie.storageError&&suie.pending);assert(await p.locator('#retry-save').isVisible());await shot('08-storage-error');await p.evaluate(()=>{suie.fs.syncfs=eSyncOriginal});await p.locator('#retry-save').click();await settle();assert.equal(await p.evaluate(()=>suie.storageError),null);assert.deepEqual(await files(),beforeFiles);check('浏览器实际写回失败可见、保留文件和待写状态，重试恢复');
 await shot('09-final-choice');assert.deepEqual(report.errors,[]);check('运行期间原生弹错与浏览器错误为零');report.status='pass';
}catch(e){report.status='fail';report.failure=e.stack;console.error(e);if(p)await shot('failure').catch(()=>{});process.exitCode=1}
finally{report.logs=logs;fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2)+'\n');if(ctx)await ctx.close()}})();
