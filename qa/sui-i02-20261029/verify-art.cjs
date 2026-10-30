#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,args=process.argv.slice(2),opt={};while(args.length){const k=args.shift();assert(['--web','--port','--build'].includes(k));opt[k.slice(2)]=args.shift();}
assert(opt.web&&opt.port&&opt.build);const web=path.resolve(opt.web),base=path.dirname(web),manifest=JSON.parse(fs.readFileSync(path.join(base,'build-manifest.json')));assert.equal(manifest.runtimeBuildId,opt.build);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const hashes=Object.fromEntries(fs.readdirSync(web).map(f=>[f,hash(path.join(web,f))]));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'suii02-art-')),shotDir=path.join(dir,'browser-art-screenshots');fs.mkdirSync(shotDir,{recursive:true});
const report={layer:'三张真实美术技术诊断包：实际Wasm加载/CG全图/解锁/退出/存读档；不是剧情采用和全量资源验收',build:opt.build,contentBuildId:manifest.contentBuildId,profile,web,hashes,checks:[],shots:[],errors:[],logs:[]};let ctx,p;
const check=(name,detail)=>{report.checks.push({name,pass:true,detail});console.log('PASS '+name)};
const fields=line=>Object.fromEntries((line||'').split('|').filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
async function stable(){return p.evaluate(()=>suie.events.filter(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)).at(-1));}
async function settle(){await p.waitForTimeout(300);await p.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:15000});}
async function launch(){ctx=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1440,height:900}});p=ctx.pages()[0];p.on('console',m=>{const s=m.text();if(/^SUI_[EI]\|/.test(s))report.logs.push(s);if(m.type()==='error')report.errors.push(s)});p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});await p.goto('http://127.0.0.1:'+opt.port);await p.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:30000});assert(report.logs.includes('SUI_E|ready|'+opt.build));await settle();}
async function click(x,y){const r=await p.locator('#canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:70});await settle();}
async function key(k){await p.locator('#canvas').focus();await p.keyboard.down(k);await p.waitForTimeout(70);await p.keyboard.up(k);await settle();}
async function shot(name){await p.mouse.move(1,1);await p.waitForTimeout(350);const box=await p.locator('#canvas').boundingBox();await p.locator('#canvas').screenshot({path:path.join(shotDir,name+'.png')});report.shots.push({name,path:'browser-art-screenshots/'+name+'.png',box,stable:await stable()});}
async function save(slot){await click(1168,52);await click(260,230);await click(slot%2?920:280,slot<2?256:498);await key('Escape');}
async function load(slot,title=false){if(!title)await click(1168,52);await click(title?240:640,title?466:230);await click(slot%2?920:280,slot<2?256:498);}
async function advanceTo(id){for(let i=0;i<15;i++){if(fields(await stable()).cursor===id)return;await key('Enter');}assert.fail('无法到达 '+id);}
async function title(){await click(1168,52);await click(260,558);await click(500,430);await p.waitForFunction(()=>suie.events.at(-1)==='SUI_E|title'||suie.events.some(x=>x==='SUI_E|title'));await settle();}
(async()=>{try{
 await launch();await click(320,546);await shot('01-gallery-locked');await click(240,240);await shot('01b-gallery-locked-click');assert.equal(hash(path.join(shotDir,'01-gallery-locked.png')),hash(path.join(shotDir,'01b-gallery-locked-click.png')),'锁定格不能打开详情');assert(!report.logs.some(x=>x.startsWith('SUI_I|unlock|')));check('登记CG前未进入镜头时没有解锁事件，图鉴为锁定态');await click(1140,60);
 await click(240,386);await advanceTo('TEXT_12e9affe350b12038970_1');await p.waitForTimeout(1400);await save(1);await shot('02-scene-original');const scene=fields(await stable()).cursor;assert(report.logs.some(x=>x.includes('SUI_I|enter|binding=diagnostic-scene|')));check('真实WebP背景与透明人物图层进入，并保存手动1',scene);
 await advanceTo('TEXT_f5354c41d01bf0d95a4c_1');await p.waitForTimeout(1400);const cg=fields(await stable()).cursor;assert(report.logs.some(x=>x==='SUI_I|unlock|cg=CG001'));await shot('03-cg-reading');await save(2);check('实际遇到CG001后才解锁并保存手动2',cg);
 await key('V');assert(report.logs.includes('SUI_I|full-view|opened'));await shot('04-cg-full');assert.equal(fields(await stable()).cursor,cg);await key('Enter');await p.waitForTimeout(350);assert.equal(fields(await stable()).cursor,cg,'退出全图按键不得透传推进正文');check('V查看全图，隐藏UI；Enter退出后仍停留原段');
 await advanceTo('TEXT_04f2fe2301318a26493d_1');await shot('05-character-cleared');assert(report.logs.some(x=>x.includes('SUI_I|exit|binding=diagnostic-cg|')));check('下一段退出CG并应用明确的无人物状态');
 await advanceTo('TEXT_982d9ac0f683c6bbb52b_1');await shot('06-character-return');check('后续节点重新显示人物与背景');
 await load(1);assert.equal(fields(await stable()).cursor,scene);await shot('07-scene-restored');await load(2);assert.equal(fields(await stable()).cursor,cg);await key('V');await shot('08-cg-restored-full');await key('V');assert.equal(fields(await stable()).cursor,cg);check('场景/CG手动档恢复正确节点，恢复后全图可用');
 await p.reload();await p.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:30000});await settle();await load(2,true);assert.equal(fields(await stable()).cursor,cg);await key('V');await shot('09-cg-reloaded-full');await key('V');check('刷新后CG存档与全图恢复');
 await ctx.close();ctx=null;await launch();await load(1,true);assert.equal(fields(await stable()).cursor,scene);await shot('10-scene-reopened');check('关闭独立浏览器重开后，背景/人物存档恢复');
 await title();await click(320,546);await shot('11-gallery-unlocked');await click(240,240);await shot('12-gallery-detail');check('全局CG001解锁持久化且图鉴详情可打开');await key('Escape');await click(1140,60);
 await click(240,386);await advanceTo(scene);await shot('13-newgame-scene');check('新游戏重置演出并重新进入开场技术绑定');
 for(const[f,h]of Object.entries(hashes))assert.equal(hash(path.join(web,f)),h);assert.deepEqual(report.errors,[]);check('网页产物指纹未变且无浏览器/原生弹错');report.status='pass';
}catch(e){report.status='fail';report.failure=e.stack;console.error(e);if(p)await shot('failure').catch(()=>{});process.exitCode=1;}finally{fs.writeFileSync(path.join(dir,'browser-art-report.json'),JSON.stringify(report,null,2)+'\n');if(ctx)await ctx.close();}})();
