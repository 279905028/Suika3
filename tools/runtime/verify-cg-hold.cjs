#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../..');
async function verify(preview,out){
  assert(preview&&out&&!fs.existsSync(path.join(ROOT,out)),'指定已有构建及新的QA目录');
  const dir=path.join(ROOT,out);fs.mkdirSync(dir,{recursive:true});
  const buildFile=path.join(ROOT,preview,'build-result.json');
  const build=fs.existsSync(buildFile)?JSON.parse(fs.readFileSync(buildFile,'utf8')):null;
  const databasePrefix=build?.databasePrefix||'bijie-p4-07-isolated:';
  const report={status:'running',runtimeBuildId:build?.runtimeBuildId||null,databasePrefix,checks:[],errors:[],events:[]};let server,browser,p;
  const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log(name);};
  try{
    const web=path.join(ROOT,preview,'runtime/web');
    server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(name.includes('/')||name.includes('..')){res.writeHead(404);return res.end();}const file=path.join(web,name);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.mp4')?'video/mp4':'application/octet-stream');fs.createReadStream(file).pipe(res);});
    await new Promise((r,j)=>{server.on('error',j);server.listen(0,'127.0.0.1',r);});
    browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
    const ctx=await browser.newContext({viewport:{width:1280,height:800}});p=await ctx.newPage();
    p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss();});
    p.on('console',m=>{if(/^SUI_[EI]\|/.test(m.text()))report.events.push({at:Date.now(),line:m.text()});});
    const click=async(x=420,y=700,delay=35)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay});};
    const key=async k=>{await p.locator('#canvas').focus();await p.keyboard.press(k,{delay:60});};
    const events=()=>p.evaluate(()=>suie.events);
    const node=async()=>{const line=(await events()).findLast(x=>x.startsWith('SUI_I|enter|')||x.startsWith('SUI_E|load|'));return line?.match(/\|(?:node|cursor)=([^|]+)/)?.[1];};
    const cg='T-C01-000004_1',start='SUI_I|cg-hold|start|node='+cg+'|ms=1500',ready='SUI_I|cg-hold|ready|node='+cg;
    await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});await p.waitForTimeout(700);
    await click(320,665,100);await p.waitForTimeout(350);
    await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|new|')),{},{timeout:5000});
    for(let i=0;i<90&&!(await events()).includes(start);i++){await click();await p.waitForTimeout(55);}
    check('真实正文到达CG001并启动保护',(await events()).includes(start));
    const began=report.events.find(x=>x.line===start).at;
    let clicks=0;while(Date.now()-began<1150){await click();clicks++;await p.waitForTimeout(15);assert.equal(await node(),cg,'锁定期间连点跨过CG');}
    check('1.5秒内鼠标连点均被丢弃',clicks>=5&&await node()===cg);
    await p.waitForFunction(line=>suie.events.includes(line),ready);
    const release=report.events.find(x=>x.line===ready).at;report.firstHoldMs=release-began;
    check('首个可见帧起至少1.5秒',report.firstHoldMs>=1480);
    await p.waitForTimeout(350);check('解锁后旧点击不会自动翻页',await node()===cg);
    await p.screenshot({path:path.join(dir,'cg001-ready.png')});
    // Save through the same menu used by players, then verify re-entry protection.
    await click(1160,48,80);await p.waitForTimeout(300);await click(120,270,80);await p.waitForTimeout(280);await click(870,90,80);await p.waitForTimeout(280);await click(950,250,80);
    await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|save|slot=1|')));
    await p.waitForTimeout(350);await click(120,625,100);await p.waitForTimeout(350);check('CG页手动保存成功',(await events()).some(x=>x.startsWith('SUI_E|save|slot=1|')));
    await click(120,48,80);await p.waitForTimeout(300);check('仍可打开全图',(await events()).includes('SUI_I|full-view|opened'));
    await key('Escape');await p.waitForTimeout(350);check('关闭全图保持当前CG',await node()===cg);
    for(let i=0;i<3&&await node()===cg;i++){await click();await p.waitForTimeout(160);}
    check('新点击可以正常进入下一段',await node()!==cg);
    const ordinary=await node(),ordinaryAt=Date.now();
    for(let i=0;i<4&&await node()===ordinary;i++){await click();await p.waitForTimeout(50);}
    report.ordinaryAdvanceMs=Date.now()-ordinaryAt;check('普通正文不增加1.5秒等待',await node()!==ordinary&&report.ordinaryAdvanceMs<1400);
    const restore=async()=>{const count=(await events()).filter(x=>x===start).length;await click(1160,48,80);await p.waitForTimeout(280);await click(120,270,80);await p.waitForTimeout(280);await click(1100,90,80);await p.waitForTimeout(280);await click(950,250,80);await p.waitForFunction(({line,count})=>suie.events.filter(x=>x===line).length>count,{line:start,count});};
    await restore();await p.locator('#canvas').focus();for(let i=0;i<18;i++){await p.keyboard.down('Enter');await p.waitForTimeout(100);}
    check('读档重计时且长按确认键不能越过CG',await node()===cg);
    await p.keyboard.up('Enter');await p.waitForTimeout(350);check('松开确认键不触发补发翻页',await node()===cg);
    await restore();await p.mouse.move(420,700);await p.mouse.down();await p.waitForTimeout(1750);await p.mouse.up();await p.waitForTimeout(350);
    check('鼠标按住跨过期限后松开不翻页',await node()===cg);
    await restore();const b=await p.locator('#canvas').boundingBox(),cdp=await ctx.newCDPSession(p);
    for(let i=0;i<6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.4,y:b.y+b.height*.9}]});await p.waitForTimeout(25);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80);}
    check('触控连续轻点受同一保护',await node()===cg);
    await p.waitForTimeout(1300);
    await restore();await p.locator('#canvas').focus();await p.keyboard.down('Control');await p.waitForTimeout(1750);check('按住快进键不能绕过等待',await node()===cg);await p.keyboard.up('Control');await p.waitForTimeout(350);
    check('快进键松开后仍停在CG',await node()===cg);
    const dbs=await p.evaluate(async()=>(await indexedDB.databases()).map(x=>x.name));report.databases=dbs;check('使用独立存储',dbs.length>0&&dbs.every(n=>n.startsWith(databasePrefix)));
    check('无浏览器或引擎错误',report.errors.length===0&&!(await events()).some(x=>x.startsWith('SUI_C|error')));report.status='pass';
  }catch(e){report.status='fail';report.error=e.stack;if(p)await p.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});throw e;}
  finally{if(p)report.nativeEvents=await p.evaluate(()=>window.suie?.events||[]).catch(()=>[]);if(browser)await browser.close();if(server?.listening)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
if(require.main===module)verify(process.argv[2],process.argv[3]).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={verify};
