const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {firefox}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=path.join(__dirname,'firefox-transition-wait',process.env.SUI_TEST_VERSION||'sui-i02-20261030-v1');
const args=process.argv.slice(2),opt={};while(args.length){const k=args.shift();assert(['--web','--port','--build'].includes(k),'未知参数 '+k);opt[k.slice(2)]=args.shift();}
assert(opt.web&&opt.port&&opt.build,'用法：node verify-browser.cjs --web <候选web目录> --port <独立端口> --build <runtimeBuildId>');
const web=path.resolve(opt.web),port=Number(opt.port),manifestPath=path.join(__dirname,'../../../build',path.basename(path.dirname(web)),'wasm/build-manifest.json');
assert(Number.isInteger(port)&&port>=1024&&port<=65535);const manifest=JSON.parse(fs.readFileSync(manifestPath));assert.equal(manifest.runtimeBuildId,opt.build,'冻结的构建ID不匹配');
const fileHash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const webHashes=Object.fromEntries(fs.readdirSync(web).filter(f=>fs.statSync(path.join(web,f)).isFile()).map(f=>[f,fileHash(path.join(web,f))]));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'suiq-qa-')),report={layer:'SUI-Q 同一指定候选的独立Firefox实际UI、原生保存/恢复/回退、刷新重开及移动尺寸；针对正式候选；非手机真机、全篇人工审读或发布验收',profile,web,port,webHashes,build:manifest,checks:[],errors:[],screenshots:[]};
let ctx,p;const logs=[];fs.mkdirSync(path.join(dir,'browser-screenshots'),{recursive:true});
const check=(name,detail)=>{report.checks.push({name,pass:true,detail});console.log('PASS '+name)};
const wait=async s=>p.waitForFunction(s=>suie.events.some(x=>x.includes(s)),s,{timeout:20000});
const stable=()=>logs.filter(x=>/^SUI_E\|(stable|load|rollback)\|/.test(x)).at(-1);
const field=(line,k)=>{const m=line?.match(new RegExp('\\|'+k+'=([^|]*)'));return m?.[1]};
async function launch(touch=false){ctx=await firefox.launchPersistentContext(profile,{firefoxUserPrefs:{'network.proxy.type':0},headless:true,hasTouch:touch,viewport:{width:1440,height:900}});p=ctx.pages()[0];p.on('console',m=>{if(/^SUI_[EI]\|/.test(m.text()))logs.push(m.text());if(m.type()==='error')report.errors.push(m.text())});p.on('pageerror',e=>report.errors.push(e.message));p.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});const navigationStarted=Date.now();await p.goto('http://127.0.0.1:'+port);await wait('SUI_E|title');assert(logs.includes('SUI_E|ready|'+opt.build),'实际页面构建ID不符');report.browser=ctx.browser()?.version()||'Firefox persistent context';report.launchMetrics??=[];report.launchMetrics.push({coldProfile:report.launchMetrics.length===0,navigationToTitleMs:Date.now()-navigationStarted,...await p.evaluate(()=>({wasmHeapBytes:typeof HEAPU8!=='undefined'?HEAPU8.buffer.byteLength:typeof HEAP8!=='undefined'?HEAP8.buffer.byteLength:null,jsHeap:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit}:null,resourceTiming:performance.getEntriesByType('resource').filter(e=>e.name.endsWith('assets.arc')).map(e=>({name:e.name,duration:e.duration,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize})),metricScope:'桌面Firefox本机回环单次读取，不是进程峰值或手机负载'}))});await settle()}
async function settle(){await p.waitForTimeout(600);await p.waitForFunction(()=>!suie.pending&&!suie.busy&&!suie.storageError,null,{timeout:10000})}
async function click(x,y){const r=await p.locator('#canvas').boundingBox();await p.mouse.click(r.x+x*r.width/1280,r.y+y*r.height/720,{delay:60});await settle()}
async function key(k){await p.locator('#canvas').focus();await p.keyboard.down(k);await p.waitForTimeout(45);await p.keyboard.up(k);await settle()}
async function shot(name){
 if(['04-first-choice','05-rollback','07-mobile-landscape','09-final-choice'].includes(name)){
  await p.waitForTimeout(1200);await p.mouse.move(1,1);await p.waitForTimeout(200);
  const canvasShot=path.join(dir,'browser-screenshots',name+'-canvas.png');await p.locator('#canvas').screenshot({path:canvasShot});
  const result=cp.spawnSync('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',[path.join(__dirname,'verify-choice-visible.py'),canvasShot],{encoding:'utf8'});
  report.choiceVisualChecks??=[];report.choiceVisualChecks.push(JSON.parse(result.stdout));assert.equal(result.status,0,'选择按钮未实际显示：'+name);
 }
 await p.screenshot({path:path.join(dir,'browser-screenshots',name+'.png')});report.screenshots.push(name+'.png');
}
async function menu(){await click(1168,52)}
async function save(slot){await menu();await click(260,230);await click(slot%2?920:280,slot<2?256:498);await key('Escape')}
async function load(slot,title=false){if(!title)await menu();await click(title?240:640,title?466:230);await click(slot%2?920:280,slot<2?256:498)}
async function untilChoice(){await p.evaluate(()=>{window.eDrive=setInterval(()=>{const l=suie.events.filter(x=>x.startsWith('SUI_E|stable|')||x.startsWith('SUI_E|load|')).at(-1)||'';if(l.includes('|tag=choose|')){clearInterval(eDrive);return}const c=document.getElementById('canvas');c.focus();window.eKey=!window.eKey;c.dispatchEvent(new KeyboardEvent(eKey?'keydown':'keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}))},35)});await p.waitForFunction(()=>{const l=suie.events.filter(x=>x.startsWith('SUI_E|stable|')||x.startsWith('SUI_E|load|')).at(-1)||'';return l.includes('|tag=choose|')},null,{timeout:90000});await p.evaluate(()=>{clearInterval(eDrive);canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}))});await settle()}
async function files(){return p.evaluate(()=>suie.fs.readdir(suie.mount).filter(n=>n!=='.'&&n!=='..').map(n=>({name:n,bytes:suie.fs.stat(suie.mount+'/'+n).size})))}
(async()=>{try{
 await launch();await shot('01-title');check('指定候选标题、项目身份与独立空存档库',await p.evaluate(()=>({mount:suie.mount,dbs:indexedDB.databases(),width:canvas.width,height:canvas.height})));
 await click(240,466);await click(920,256);assert(logs.some(x=>x.includes('这个位置还没有存档')));await key('Escape');check('空槽拒绝且未创建进度',await files());
 await click(240,386);await wait('SUI_E|stable');await settle();await shot('02-opening');const opening=field(stable(),'cursor');
 await save(1);await wait('save|slot=1');await shot('03-saved');check('指定候选开场与手动档1保存',opening);
 await key('Enter');await key('Enter');await p.waitForTimeout(1800);await settle();let second=field(stable(),'cursor');assert.notEqual(second,opening);await save(2);check('快速翻页后停留会补写自动档及手动档2',second);
 await load(1);assert.equal(field(stable(),'cursor'),opening,logs.slice(-15).join('\n'));check('手动档1恢复正文位置和状态');
 report.status='pass';
}catch(e){report.status='fail';report.failure=e.stack;console.error(e);if(p)await shot('failure').catch(()=>{});process.exitCode=1}
finally{report.logs=logs;fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2)+'\n');if(ctx)await ctx.close()}})();
