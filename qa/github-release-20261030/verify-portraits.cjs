'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const version=process.argv[2],port=Number(process.argv[3]),ROOT=path.resolve(__dirname,'../..');
const base=path.join(ROOT,'build',version),out=path.join(__dirname,version,'portraits');fs.mkdirSync(out,{recursive:true});
const ir=JSON.parse(fs.readFileSync(path.join(base,'wasm/generated/story.ir.json'))),manifest=JSON.parse(fs.readFileSync(path.join(base,'wasm/build-manifest.json')));
const cue=(file,line)=>ir.nodes.find(n=>n.op==='text'&&n.source.file===file&&n.source.line===line).id;
const target=cue('第一章-回到毕节.md',109),door=cue('第一章-回到毕节.md',117);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'suika-portrait-fill-'));
const report={version,runtimeBuildId:manifest.runtimeBuildId,scope:'本批新增陈孃的自然到达、退场、保存读取、关闭重开、选择回退改选；独立临时资料，无玩家旧档访问。',profile,checks:[],errors:[],logs:[],shots:[]};
let ctx,p;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const check=(name,details)=>{report.checks.push({name,pass:true,details});console.log('PASS '+name)};
const state=()=>report.logs.filter(l=>/^SUI_E\|(stable|load|rollback)\|/.test(l)).at(-1);
const cursor=()=>state()?.match(/\|cursor=([^|]+)/)?.[1];
async function settle(){await p.waitForTimeout(330);await p.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:20000});}
async function click(x,y){const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:65});await settle();}
async function key(k){await p.locator('#canvas').focus();await p.keyboard.press(k,{delay:65});await settle();}
async function next(){const old=cursor();for(let i=0;i<8&&cursor()===old;i++){if(state()?.includes('|tag=choose|'))await click(1000,168);else await key('Enter');}assert.notEqual(cursor(),old);}
async function reach(id){let safety=0;while(cursor()!==id){assert(++safety<200);await next();}}
async function shot(name,face=false){await p.waitForTimeout(650);await p.mouse.move(2,2);const file=path.join(out,name+'.png');const b=await p.locator('#canvas').boundingBox();if(face)await p.screenshot({path:file,clip:{x:b.x+410*b.width/1280,y:b.y+70*b.height/720,width:460*b.width/1280,height:350*b.height/720}});else await p.locator('#canvas').screenshot({path:file});report.shots.push({name,file,sha256:hash(file)});return file;}
async function launch(){ctx=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1280,height:800}});p=ctx.pages()[0];p.on('console',m=>{if(m.text().startsWith('SUI_'))report.logs.push(m.text());if(m.type()==='error')report.errors.push(m.text());});p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});await p.goto('http://127.0.0.1:'+port);await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await settle();assert(report.logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));}
async function save(){await click(1168,52);await click(130,270);await click(892,92);await click(980,260);await key('Escape');}
async function load(title=false){if(title)await click(640,664);else{await click(1168,52);await click(130,270);}const count=report.logs.filter(l=>l.startsWith('SUI_E|load|slot=1|')).length;await click(980,260);assert.equal(report.logs.filter(l=>l.startsWith('SUI_E|load|slot=1|')).length,count+1);}
(async()=>{try{
 await launch();await click(320,664);await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')));await reach(target);
 await shot('01-chenniang');const face=await shot('face-before',true);await save();assert.equal(cursor(),target);check('自然开场到陈孃送汤段，保存不推进正文',target);
 await reach(door);await shot('02-door-no-npc');await load();assert.equal(cursor(),target);const restored=await shot('face-restored',true);assert.equal(hash(face),hash(restored));check('明确退场后清除；读取恢复陈孃及人物区域像素');
 await ctx.close();ctx=null;await launch();await load(true);assert.equal(cursor(),target);const reopened=await shot('face-reopened',true);assert.equal(hash(face),hash(reopened));check('关闭浏览器后重开，从标题读取同一NPC存档像素一致');
 const rollbacks=report.logs.filter(l=>l.startsWith('SUI_E|rollback|')).length;
 await click(1168,52);await click(480,350);assert.equal(report.logs.filter(l=>l.startsWith('SUI_E|rollback|')).length,rollbacks+1);assert.equal(cursor(),'C01-01');
 for(let i=0;i<8&&!state().includes('|tag=choose|');i++)await click(1240,700);assert(state().includes('|tag=choose|'));await click(1000,256);await reach(target);await shot('03-rollback-B-chenniang');check('回退C01-01改选B后仍在正确现场恢复陈孃，不沿旧分支继承舞台');
 await reach(door);await shot('04-door-after-rollback');check('再次离场保持门外画面与黄球球开门边界');
 assert.deepEqual(report.errors,[]);report.status='pass';
}catch(e){report.status='fail';report.failure=e.stack;console.error(e);if(p)await shot('failure').catch(()=>{});process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(ctx)await ctx.close();}})();
