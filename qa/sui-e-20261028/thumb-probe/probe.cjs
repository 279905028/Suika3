'use strict';
// Derived candidate only. Never writes production runtime or candidate artifacts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict'),os=require('node:os'),crypto=require('node:crypto');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,root=path.resolve(dir,'../../..'),formal=path.dirname(dir);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const originals=['main.ray','config.ini','start.novel','qa/sui-e-20261028/build-manifest.json','qa/sui-e-20261028/web/assets.arc'].map(p=>({path:p,sha256:hash(path.join(root,p))}));
const {build}=require('../../../tools/runtime/build.cjs');const manifest=build({out:dir});
const stage=path.join(dir,'stage'),web=path.join(dir,'web');
let ray=fs.readFileSync(path.join(stage,'main.ray'),'utf8');
const anchor='    if (!Suika.executeSaveLocal({index:slot}))';assert.equal(ray.split(anchor).length,2);
ray=ray.replace(anchor,'    Suika.drawStageToThumb();\n'+anchor);
ray=ray.replaceAll('毕节，雨停之前 · Suika3','SUI-E 缩略图专用探针');
fs.writeFileSync(path.join(stage,'main.ray'),ray);
fs.writeFileSync(path.join(stage,'config.ini'),fs.readFileSync(path.join(stage,'config.ini'),'utf8').replaceAll('毕节，雨停之前 · Suika3','SUI-E 缩略图专用探针'));
fs.writeFileSync(path.join(web,'index.html'),fs.readFileSync(path.join(web,'index.html'),'utf8').replaceAll('bijie-rain-suika3-v1:','bijie-rain-suika3-thumb-probe:'));
const packed=cp.spawnSync(path.join(dir,'bin/suika3-pack'),manifest.inputs.map(x=>x.path),{cwd:stage,encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
const report={scope:'仅缩略图一行修复派生探针，不是正式候选验收',baseRuntimeBuildId:manifest.runtimeBuildId,injection:'Suika.drawStageToThumb(); before executeSaveLocal',profile:fs.mkdtempSync(path.join(os.tmpdir(),'suie-thumb-')),logs:[],errors:[],console:[],requests:[],screenshots:[],productionHashesBefore:originals};
const server=http.createServer((req,res)=>{report.requests.push(req.url);const file=path.join(web,req.url==='/'?'index.html':req.url.slice(1));if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.arc':'application/octet-stream'})[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',fs.statSync(file).size);fs.createReadStream(file).pipe(res)});
let ctx,page;
async function settle(){await page.waitForTimeout(300);await page.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:15000});}
async function click(x,y){const r=await page.locator('#canvas').boundingBox();await page.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:70});await settle();}
async function shot(name){await page.screenshot({path:path.join(dir,name+'.png')});report.screenshots.push(name+'.png');}
(async()=>{try{
 await new Promise(resolve=>server.listen(49229,'127.0.0.1',resolve));
 ctx=await chromium.launchPersistentContext(report.profile,{channel:'chrome',headless:true,viewport:{width:1440,height:900}});page=ctx.pages()[0];
 page.on('console',m=>{report.console.push(m.text());if(m.text().startsWith('SUI_E|'))report.logs.push(m.text());if(m.type()==='error')report.errors.push(m.text());});page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});
 await page.goto('http://127.0.0.1:49229/');await page.waitForFunction(()=>suie.events.includes('SUI_E|title'),null,{timeout:45000});await settle();
 await click(240,386);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:10000});await page.waitForTimeout(3500);await shot('01-reading');
 await click(1168,52);await click(260,230);await click(920,256);assert(report.logs.some(x=>x.startsWith('SUI_E|save|slot=1|')));await shot('02-save');
 await page.locator('#canvas').focus();await page.keyboard.down('Escape');await page.waitForTimeout(65);await page.keyboard.up('Escape');await settle();await page.waitForTimeout(500);await click(1168,52);await page.waitForTimeout(500);await click(640,230);await page.waitForTimeout(750);await shot('03-load');
 report.canvasRect=await page.locator('#canvas').boundingBox();report.databases=await page.evaluate(()=>indexedDB.databases());
 assert.deepEqual(report.errors,[]);assert(report.databases.every(d=>d.name.startsWith('bijie-rain-suika3-thumb-probe:')));
 report.status='native-pass-pending-pixel-review';
}catch(e){report.status='fail';report.error=e.stack;console.error(e);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}
finally{if(ctx)await ctx.close();server.close();report.productionHashesAfter=originals.map(x=>({path:x.path,sha256:hash(path.join(root,x.path))}));assert.deepEqual(report.productionHashesAfter,originals);fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,errors:report.errors,screenshots:report.screenshots}));}})();
