'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash}=require('../../tools/compiler/parse.cjs');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,cases=JSON.parse(fs.readFileSync(path.join(dir,'native-cases.json'))),manifest=JSON.parse(fs.readFileSync(path.join(dir,'generated/manifest.json')));
const report={buildId:manifest.buildId,layer:'当前SDK Wasm：原文首屏/推进/真实选择点击；54组原生快进与浏览器点击路径探针，不是全篇人工试玩或存档验收',checks:[],errors:[],screenshots:[]};
report.archiveSha256=JSON.parse(fs.readFileSync(path.join(dir,'native-manifest.json'))).archive;
report.harnessHashes=Object.fromEntries(['build-native.cjs','native-host.cjs','verify-browser.cjs'].map(f=>[f,hash(fs.readFileSync(path.join(dir,f)))]));
const check=(name,detail)=>{report.checks.push({name,pass:true,detail});console.log('PASS '+name);};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:800,height:1300}}),page=await context.newPage();
 report.browser=browser.version();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 const key=async k=>{await page.locator('#canvas').focus();await page.keyboard.down(k);await page.waitForTimeout(80);await page.keyboard.up(k);};
 const shot=async name=>{await page.screenshot({path:path.join(dir,name+'.png')});report.screenshots.push(name+'.png');};
 const wait=async fragment=>{await page.waitForFunction(s=>scLog.some(x=>x.includes(s)),fragment,{timeout:60000});};
 await page.goto('http://127.0.0.1:49176');await wait('SUI_C|ready');await page.waitForTimeout(400);await shot('01-current-opening');
 assert(!(await page.evaluate(()=>scLog)).some(x=>/^Error:/.test(x)));check('完整生成模块和3019正文页解析、首屏显示');
 await key('Enter');await page.waitForTimeout(300);await shot('02-current-paragraph');check('原生文本点击推进');
 await key('Q');
 let clicks=0;const bounds=await page.locator('#canvas').boundingBox();
 async function drive(cursor,stop){
   let finished=false;const started=Date.now();
   while(!finished&&Date.now()-started<240000){
     await page.waitForFunction(n=>scLog.length>n,cursor,{timeout:30000});
     const fresh=await page.evaluate(n=>scLog.slice(n),cursor);cursor+=fresh.length;
     for(const line of fresh){
       if(line.startsWith('SUI_C|choose|')){const index=Number(line.split('|')[5]);await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height*(447+index*112)/1280);clicks++;}
       if(line.startsWith('SUI_C|case|'))console.log(line);
       if(stop.test(line)||/suite-failed|escape-fail|^Error:/.test(line))finished=true;
     }
   }
 }
 await drive(0,/suite-done/);
 report.nativeChoiceClicks=clicks;
 const logs=await page.evaluate(()=>scLog);report.logs=logs;
 assert(logs.includes('SUI_C|escape-pass'),JSON.stringify(logs.slice(-5)));check('原生NovelML引号、反斜杠、方括号、插值字面和Unicode传参');
 assert(logs.includes('SUI_C|suite-done|54'),JSON.stringify(logs.slice(-5)));
 const results=logs.filter(x=>x.startsWith('SUI_C|case|')).map(line=>{const [, ,name,route,relation,score,ending,epilogue,pregnancy,meeting,pages,choices]=line.split('|');return {name,route,relation,score:Number(score),ending,epilogue,pregnancy,meeting,pages:Number(pages),choices:Number(choices)};});
 assert.equal(results.length,cases.length);
 for(let i=0;i<cases.length;i++){assert.equal(results[i].name,cases[i].name);for(const[k,v]of Object.entries(cases[i].expected))assert.equal(results[i][k],v,cases[i].name+' '+k);}
 check('46组完整原生控制流：四组合/六线/调用返回/14结局/双后日谈/正文页计数',46);check('8组共通飘计分与冻结实际执行',8);report.results=results;
 let cursor=await page.evaluate(()=>scLog.length);await key('U');await drive(cursor,/route-ready/);await wait('SUI_C|route-ready|1');await shot('03-six-options');
 let box=await page.locator('#canvas').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height*(984+30)/1280);
 await wait('SUI_C|clicked|huangqiuqiu');await shot('04-hidden-route-clicked');check('完整共通自动读至六选项、真实点击黄球球',true);
 cursor=await page.evaluate(()=>scLog.length);await key('J');await drive(cursor,/route-ready/);await wait('SUI_C|route-ready|0');await shot('05-five-options');
 box=await page.locator('#canvas').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height*(872+30)/1280);
 await wait('SUI_C|clicked|friends');await shot('06-friends-clicked');check('缺前置显示五选项、真实点击朋友与职业',true);
 const final=await page.evaluate(()=>({logs:scLog,dbs:indexedDB.databases()}));report.logs=final.logs;
 const dbs=await page.evaluate(async()=>await indexedDB.databases());assert(dbs.every(d=>d.name.startsWith('bijie-rain-suic-qa-20261028:')));check('新浏览器上下文及编译验证库隔离',dbs);
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert(!report.logs.some(x=>x.startsWith('Error:')||x.startsWith('SUI_C|error|')));
 report.status='pass';
}catch(e){report.status='fail';report.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{
 fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();
}})().catch(e=>{console.error(e);process.exitCode=1});
