#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {ROOT,write,read}=require('./prepare.cjs'),{items,eligible}=require('./manifest.cjs');
async function verify(preview='qa/ending-motion-P4-V-T-20261104/probe-v1',out='qa/ending-motion-P4-V-T-20261104/check-v1'){
 assert(!fs.existsSync(path.join(ROOT,out)));fs.mkdirSync(path.join(ROOT,out),{recursive:true});
 const report={status:'running',scope:'条件单元验证与独立Suika Wasm视频技术夹具，不是六段成片或P5全路线验收',checks:[],errors:[],negativeCases:0};let server,browser,p;
 const check=(name,value=true)=>{assert(value,name);report.checks.push(name);};
 try{
  const freeze=read('qa/ending-motion-P4-V00-20261104/freeze-resume.json');
  for(const item of items){const s={route:item.route,node:item.node,choices:item.choices,relation:item.relation,meeting:true};check(item.ending+'准确节点与选择通过',eligible(item,s));
   const bad=[{...s,node:'wrong'},{...s,route:'friend'},{...s,choices:{}}];
   for(const k of Object.keys(item.choices))bad.push({...s,choices:{...s.choices,[k]:'B'}});
   if(item.relation)bad.push({...s,relation:item.relation==='HIGH'?'LOW':'HIGH'});if(item.meeting)bad.push({...s,meeting:false});
   for(const state of bad){assert(!eligible(item,state));report.negativeCases++;}
   assert.equal(freeze.items.find(x=>x.ending===item.ending).source.sha256,read('docs/修订协作/P4-演出与美术/P4-07/context.json').nodes.find(x=>x.nodeId===item.node).source.sha256);
  }
  const my=items.find(x=>x.ending==='MY-E1');for(const pair of ['AB','BA','BB']){check('孟遥'+pair+'禁止播放',!eligible(my,{route:my.route,node:my.node,choices:{'MY07-01':pair[0],'MY09-01':pair[1]}}));}
  check('不依赖尚未提交的ENDING',items.every(i=>eligible(i,{route:i.route,node:i.node,choices:i.choices,relation:i.relation,meeting:true})));
  server=http.createServer((req,res)=>{
   const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(name.includes('..')||name.includes('/')){res.writeHead(404);res.end();return;}
   const f=path.join(ROOT,preview,'web',name);if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.mp4')?'video/mp4':'application/octet-stream');fs.createReadStream(f).pipe(res);
  });await new Promise((r,j)=>{server.on('error',j);server.listen(0,'127.0.0.1',r);});const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1280,height:800}});p=await ctx.newPage();report.browser=browser.version();p.on('pageerror',e=>report.errors.push(e.message));
  const key=async k=>{await p.locator('#canvas').focus();await p.keyboard.press(k,{delay:100});await p.waitForTimeout(280);};
  await p.goto(url);await p.waitForFunction(()=>window.endingMotion?.visible||window.p4vEvents?.some(s=>!s.startsWith('P4V|')&&!s.startsWith('SUI_M|')),null,{timeout:60000});
  let events=await p.evaluate(()=>p4vEvents);assert(events.includes('P4V|started'),events.join('\n'));assert(await p.evaluate(()=>endingMotion.visible),events.join('\n'));check('真实Suika启动并显示H.264首帧');
  check('首个可见帧才解锁',await p.evaluate(()=>endingMotion.unlocks.size===1&&endingMotion.unlocks.has('MCG-XM-E1')));
  const bounds=await p.locator('#canvas').boundingBox();
  for(let i=0;i<6;i++){await p.mouse.click(bounds.x+bounds.width*.4,bounds.y+bounds.height*.5,{delay:20});await p.waitForTimeout(30);}
  check('视频首帧后快速连点不结束视频',await p.evaluate(()=>endingMotion.visible&&endingMotion.busy()&&!endingMotion.events.some(e=>e.type==='skip')));
  await p.locator('#canvas').focus();await p.keyboard.down('Enter');await p.waitForTimeout(1600);
  await p.keyboard.down('Enter');
  check('长按及键盘重复事件越过1.5秒仍不跳过',await p.evaluate(()=>!endingMotion.skipLocked()&&endingMotion.busy()));
  await p.keyboard.up('Enter');await p.waitForTimeout(250);
  check('释放旧按键不会补发跳过',await p.evaluate(()=>endingMotion.busy()));
  await p.screenshot({path:path.join(ROOT,out,'engine-playing.png')});
  await p.waitForFunction(()=>!endingMotion.skipLocked());
  await key('Enter');check('首次确认只跳视频、保留正文节点',await p.evaluate(()=>endingMotion.phase==='static'&&p4vEvents.filter(s=>s.startsWith('P4V|node|')).at(-1)==='P4V|node|T-XM-000826_1'));
  await key('Enter');await key('Enter');check('后续确认允许正文继续',await p.evaluate(()=>p4vEvents.includes('P4V|node|AFTER-XM-E1')));
  await key('R');await p.waitForFunction(()=>endingMotion.busy());
  await key('M');await p.waitForFunction(()=>endingMotion.menu);const t=await p.evaluate(()=>endingMotion.video?.currentTime);await p.waitForTimeout(400);check('原生菜单暂停视频并遮住媒体层',await p.evaluate(t=>endingMotion.video?.paused&&Math.abs(endingMotion.video.currentTime-t)<.08&&endingMotion.layer.hidden,t));
  await key('Escape');await p.waitForFunction(()=>!endingMotion.menu&&endingMotion.video&&!endingMotion.video.paused);check('原生菜单返回恢复同一视频');
  await key('S');check('原生存档成功',(await p.evaluate(()=>p4vEvents)).includes('P4V|save|ok=1'));
  await key('T');check('返回标题清理媒体与回调',await p.evaluate(()=>endingMotion.key===''&&endingMotion.video===null));
  await key('L');check('原生读档恢复静态且不自动播放',await p.evaluate(()=>p4vEvents.includes('P4V|load|ok=1')&&endingMotion.phase==='static'&&endingMotion.video===null&&endingMotion.contextKey==='MCG-XM-E1'));
  await p.locator('.mcg-replay').click();await p.waitForFunction(()=>endingMotion.visible);check('同节点手动重播');
  await p.waitForFunction(()=>endingMotion.phase==='static',null,{timeout:8000});check('自然结束留在原节点',await p.evaluate(()=>endingMotion.contextKey==='MCG-XM-E1'&&endingMotion.events.some(e=>e.type==='ended')));
  // Isolated lifecycle edge cases use the same actual HTMLVideoElement implementation.
  await p.evaluate(()=>{endingMotion.setContext('MCG-ZZ-E1','enter','background-test');});await p.waitForFunction(()=>endingMotion.visible);
  const cdp=await ctx.newCDPSession(p);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await p.waitForTimeout(250);await cdp.send('Page.setWebLifecycleState',{state:'active'});
  check('浏览器冻结与恢复后没有换节点',await p.evaluate(()=>endingMotion.contextKey==='MCG-ZZ-E1'));report.backgroundBoundary='CDP生命周期冻结/恢复；实际切标签另验';
  await p.evaluate(()=>{endingMotion.setContext('MCG-MY-E1','restore');mcgConfig.items['MCG-MY-E1'].src='missing.mp4';endingMotion.play('MCG-MY-E1');});await p.waitForFunction(()=>endingMotion.phase==='static');
  check('缺失视频回退、不中断正文、不解锁',await p.evaluate(()=>endingMotion.events.some(e=>e.type==='media-error')&&!endingMotion.unlocks.has('MCG-MY-E1')&&endingMotion.contextKey==='MCG-MY-E1'));
  await p.evaluate(()=>{mcgConfig.items['MCG-PI-E1'].src='controller.css';endingMotion.setContext('MCG-PI-E1','enter','decode');});await p.waitForFunction(()=>endingMotion.phase==='static');check('解码失败回退且不解锁',await p.evaluate(()=>!endingMotion.unlocks.has('MCG-PI-E1')));
  await p.evaluate(()=>{window.savedPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Blocked','NotAllowedError'));};endingMotion.setContext('MCG-PI-LE1','enter','autoplay');});await p.waitForFunction(()=>endingMotion.phase==='static');
  check('自动播放被拒时回退且不解锁',await p.evaluate(()=>endingMotion.events.some(e=>e.type==='autoplay-rejected')&&!endingMotion.unlocks.has('MCG-PI-LE1')));await p.evaluate(()=>HTMLMediaElement.prototype.play=savedPlay);
  await p.route('**/delayed.mp4',async route=>{await new Promise(r=>setTimeout(r,2000));await route.fulfill({path:path.join(ROOT,preview,'web/probe.mp4'),contentType:'video/mp4'});});
  await p.evaluate(()=>{mcgConfig.items['MCG-HQ-E1'].src='delayed.mp4';endingMotion.setContext('MCG-HQ-E1','enter','late');endingMotion.stop();});await p.waitForTimeout(2300);check('退出后迟到回调不复活视频、不解锁',await p.evaluate(()=>endingMotion.phase==='idle'&&!endingMotion.unlocks.has('MCG-HQ-E1')));
  await p.evaluate(()=>endingMotion.openGallery());check('图鉴只有已可见视频可重播',await p.locator('dialog button[disabled]').count()===4);await p.locator('dialog button').first().click();await p.waitForFunction(()=>endingMotion.visible);await p.locator('.mcg-close').click();check('图鉴返回清理播放器',await p.evaluate(()=>!endingMotion.gallery&&endingMotion.video===null));
  await p.setViewportSize({width:844,height:390});await p.evaluate(()=>{mcgConfig.items['MCG-HQ-E1'].src='probe.mp4';endingMotion.setContext('MCG-HQ-E1','enter','mobile');});await p.waitForFunction(()=>endingMotion.visible);await p.screenshot({path:path.join(ROOT,out,'mobile-landscape.png')});
  check('横屏模拟画面等比对齐',await p.evaluate(()=>{const a=endingMotion.canvas.getBoundingClientRect(),b=endingMotion.layer.getBoundingClientRect();return Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;}));
  report.beforeReload={engineEvents:await p.evaluate(()=>p4vEvents),mediaEvents:await p.evaluate(()=>endingMotion.events)};
  const oldUnlocks=await p.evaluate(()=>[...endingMotion.unlocks]);await p.reload();await p.waitForFunction(()=>window.endingMotion?.ready);check('刷新保留解锁记录、不持久化播放器对象',await p.evaluate(old=>old.every(k=>endingMotion.unlocks.has(k)),oldUnlocks));
  const dbs=await p.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name));check('仅独立测试存储',dbs.every(n=>n.startsWith('suika3-p4v-engine-probe:')));report.databases=dbs;
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;if(p)await p.screenshot({path:path.join(ROOT,out,'failure.png')}).catch(()=>{});throw e;}
 finally{if(p){report.engineEvents=await p.evaluate(()=>window.p4vEvents||[]).catch(()=>[]);report.mediaEvents=await p.evaluate(()=>window.endingMotion?.events||[]).catch(()=>[]);}if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));write(out+'/report.json',report);}
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,negativeCases:report.negativeCases}));
}
if(require.main===module)verify(process.argv[2],process.argv[3]).catch(e=>{console.error(e.stack);process.exitCode=1;});
