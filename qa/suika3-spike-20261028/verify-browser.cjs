const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const report={date:'2026-10-28',layer:'Chrome desktop and mobile viewport emulation; not physical phone',checks:[],errors:[],screenshots:[]};
const dir=__dirname,profile=fs.mkdtempSync(path.join(os.tmpdir(),'suit-qa-')),url='http://127.0.0.1:49173';
let context,page;
async function launch(){context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1280,height:1000}});page=context.pages()[0];page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',async d=>{report.errors.push('dialog:'+d.message());await d.dismiss()});page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});}
async function ready(){await page.waitForFunction(()=>window.suit?.ready&&suit.events.some(e=>e.startsWith('SUI_T|save|')||e.startsWith('SUI_T|load|')),{},{timeout:30000});await stable()}
async function stable(){await page.waitForTimeout(300);await page.waitForFunction(()=>!suit.pending&&!suit.busy&&!suit.storageError);}
async function eventAction(action,pattern){const n=await page.evaluate(()=>suit.events.length);await action();await page.waitForFunction(({n,pattern})=>suit.events.slice(n).some(e=>e.includes(pattern)),{n,pattern},{timeout:7000});await stable();return page.evaluate(({n,pattern})=>suit.events.slice(n).find(e=>e.includes(pattern)),{n,pattern});}
const key=async(k)=>{await page.locator('#canvas').focus();await page.keyboard.down(k);await page.waitForTimeout(100);await page.keyboard.up(k)};
async function shot(name){await page.screenshot({path:path.join(dir,name+'.png')});report.screenshots.push(name+'.png')}
function check(name,details){report.checks.push({name,pass:true,details});console.log('PASS '+name)}
async function nativeTop(){return crypto.createHash('sha256').update(await page.screenshot({clip:await page.evaluate(()=>{const r=canvas.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height*0.48}})})).digest('hex')}
async function save(slot){const s=await eventAction(()=>key(['','s','d','f'][slot]),`SUI_T|save|slot=${slot}|ok=1`);return s}
async function load(slot){return eventAction(()=>key(slot===0?'a':String(slot)),`SUI_T|load|slot=${slot}|ok=1`)}
async function choose(index){const r=await page.locator('#canvas').boundingBox();await page.mouse.click(r.x+r.width*0.5,r.y+r.height*(447+index*112)/1280)}
(async()=>{try{
 await launch();report.browser=context.browser()?.version()||'Chrome persistent';report.profile=profile;await page.goto(url);await ready();report.load=await page.evaluate(()=>({resource:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('assets.arc')).map(r=>({durationMs:r.duration,bytes:r.encodedBodySize})),wasmBytes:wasmMemory.buffer.byteLength,readyMs:performance.now()}));await shot('01-chinese-page1');check('原生Wasm启动与中文第一页',await page.evaluate(()=>({width:canvas.width,height:canvas.height,mount:suit.mount,flushCount:suit.flushCount})));
 await eventAction(()=>key('Enter'),'checkpoint|intro-page2');await shot('02-chinese-page2');check('中文长段第二页与来源映射');
 const empty=await eventAction(()=>key('3'),'reason=empty');check('空槽拒绝读档',empty);
 await eventAction(()=>key('c'),'checkpoint|choice');await shot('03-five-choices');
 let previous='000';const combinations=['100','110','010','011','111','101','001','000'];
 for(const bits of combinations){for(let i=0;i<3;i++)if(bits[i]!==previous[i])await eventAction(()=>key(String(i+4)),'checkpoint|choice');const e=await page.evaluate(()=>suit.events.filter(e=>e.includes('condition|eligible=')).at(-1));assert(e.includes('bits='+bits),e);assert(e.includes('eligible='+(bits==='111'?'1':'0')),e);previous=bits;}
 check('黄球球三前置八组合，仅111解锁',combinations);
 await eventAction(()=>key('u'),'checkpoint|choice');await shot('04-six-choices');
 const routeIds=['xiaoman','zhouzhi','mengyao','piao','huangqiuqiu','friends'];const baselines={};
 for(let i=0;i<6;i++){
  if(i)await eventAction(()=>key('c'),'checkpoint|choice');
  const e=await eventAction(()=>choose(i),'SUI_T|choice|id='+routeIds[i]);assert(e.includes('hq=1'));
  await page.waitForFunction(()=>suit.events.at(-1)?.includes('stage=selected'));await stable();
  if(i===0){await save(1);baselines[1]={route:'xiaoman',image:await nativeTop()};await shot('05-selected-transparent');}
  if(i===2){await save(2);baselines[2]={route:'mengyao',image:await nativeTop()};}
  if(i===5){await save(3);baselines[3]={route:'friends',image:await nativeTop()};}
 }
 check('六个原生选择逐一点击且返回稳定ID',routeIds);
 await eventAction(()=>key('r'),'checkpoint|intro');
 for(const slot of [1,2,3]){const e=await load(slot);assert(e.includes('route='+baselines[slot].route),e);assert(e.includes('hq=1'),e);assert.equal(await nativeTop(),baselines[slot].image);}
 check('重开保留三个手动槽；路线/前置/背景/立绘恢复',Object.keys(baselines));
 // Loading a choice checkpoint must show working choices again.
 await eventAction(()=>key('c'),'checkpoint|choice');await save(2);await eventAction(()=>choose(4),'choice|id=huangqiuqiu');await load(2);await eventAction(()=>choose(5),'choice|id=friends');check('选择页存档恢复后仍可点击');
 for(let i=0;i<10;i++){await eventAction(()=>key('n'),'SUI_T|resource|');const e=await page.evaluate(()=>suit.events.filter(e=>e.startsWith('SUI_T|resource|')).at(-1));assert(e.includes('gallery='+i),e);if(i===7)await shot('06-orb-transparent');}
 await shot('07-cg');await save(3);const cg=await nativeTop();check('10张代表资源均由原生逐张解码/展示',await page.evaluate(()=>suit.events.filter(e=>e.startsWith('SUI_T|resource|'))));
 const locals=await page.evaluate(()=>suit.fs.readdir(suit.mount).filter(n=>/^[0-9a-f]+$/.test(n)).map(n=>n.match(/../g).map(c=>String.fromCharCode(parseInt(c,16))).join('')).filter(n=>/^\d{3}\.sav$/.test(n)));assert.deepEqual(locals.sort(),['000.sav','001.sav','002.sav','003.sav']);check('恰好1自动+3手动原生槽',locals);
 const dbs=await page.evaluate(async()=>await indexedDB.databases());assert(dbs.some(x=>x.name.startsWith('bijie-rain-suika3-spike-20261028:')));check('独立数据库命名',dbs);
 // Seed unrelated same-origin database to prove it is preserved.
 await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('suit-unrelated-sentinel',1);r.onupgradeneeded=()=>r.result.createObjectStore('keep');r.onsuccess=()=>{const db=r.result,tx=db.transaction('keep','readwrite');tx.objectStore('keep').put('preserve','sentinel');tx.oncomplete=()=>{db.close();resolve()}};r.onerror=()=>reject(r.error)}));
 await page.reload();await ready();const reload=await page.evaluate(()=>suit.events.find(e=>e.includes('load|slot=0|ok=1')));assert(reload?.includes('gallery=9'),reload);assert.equal(await nativeTop(),cg);check('刷新自动恢复CG/脚本位置',reload);
 await context.close();await launch();await page.goto(url);await ready();assert.equal(await nativeTop(),cg);await load(1);assert.equal(await nativeTop(),baselines[1].image);check('关闭浏览器并重开后自动档与手动档持久恢复');
 const sentinel=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('suit-unrelated-sentinel');r.onsuccess=()=>{const db=r.result,q=db.transaction('keep').objectStore('keep').get('sentinel');q.onsuccess=()=>{db.close();resolve(q.result)}}}));assert.equal(sentinel,'preserve');check('同源其他存档库未受影响');
 // Verify persistence failure is visible and retry works (controlled fault only in this isolated test).
 await page.evaluate(()=>{suit.realSync=suit.fs.syncfs;suit.fs.syncfs=(populate,cb)=>cb(new Error('QA injected write failure'))});await key('s');await page.waitForFunction(()=>!!suit.storageError);
 assert(await page.evaluate(()=>suit.pending&&!!suit.storageError));await shot('08-write-failure');await page.evaluate(()=>suit.fs.syncfs=suit.realSync);await page.getByRole('button',{name:'重试写入',exact:true}).click();await stable();check('写回失败不会假报成功，重试可恢复');
 // Phone emulation uses independent context, never the persistent QA saves.
 const mobile=await context.browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const mp=await mobile.newPage();await mp.goto(url);await mp.waitForFunction(()=>window.suit?.events.some(e=>e.includes('save|slot=0')));await mp.waitForTimeout(500);
 await mp.screenshot({path:path.join(dir,'09-phone-portrait.png')});report.screenshots.push('09-phone-portrait.png');
 const portrait=await mp.evaluate(()=>{const c=canvas.getBoundingClientRect();return{canvas:{x:c.x,y:c.y,w:c.width,h:c.height},textPx:c.width/720*32,buttonHeight:Math.min(...[...document.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)),overflow:document.documentElement.scrollWidth>innerWidth}});assert(!portrait.overflow);assert(portrait.textPx>=15);assert(portrait.buttonHeight>=44);
 await mp.getByRole('button',{name:'切换前置',exact:true}).tap();await mp.waitForFunction(()=>suit.events.some(e=>e.includes('bits=111')));await mp.waitForTimeout(400);
 await mp.setViewportSize({width:844,height:390});await mp.waitForTimeout(300);const landscape=await mp.evaluate(()=>{const c=canvas.getBoundingClientRect(),h=document.querySelector('#canvas_holder');return{textPx:c.width/720*32,scrollable:h.scrollHeight>h.clientHeight,bodyOverflow:document.documentElement.scrollWidth>innerWidth}});assert(landscape.textPx>=16);assert(landscape.scrollable);assert(!landscape.bodyOverflow);
 await mp.locator('#canvas_holder').evaluate(e=>e.scrollTop=230);await mp.screenshot({path:path.join(dir,'10-phone-landscape.png')});report.screenshots.push('10-phone-landscape.png');await mp.setViewportSize({width:390,height:844});await mp.waitForTimeout(300);await mp.screenshot({path:path.join(dir,'11-phone-rotated-back.png')});report.screenshots.push('11-phone-rotated-back.png');
 const r=await mp.locator('#canvas').boundingBox();await mp.touchscreen.tap(r.x+r.width*.5,r.y+r.height*(447+4*112)/1280);await mp.waitForFunction(()=>suit.events.some(e=>e.includes('choice|id=huangqiuqiu')));check('手机尺寸竖屏触摸、横屏滚动阅读、旋转返回条件不丢失',{portrait,landscape});await mobile.close();
 assert.equal(report.errors.length,0,report.errors.join('\n'));check('完整运行无引擎弹错和浏览器异常');report.pass=true;
 }catch(e){report.pass=false;report.failure=e.stack;console.error(e);if(page&&!page.isClosed())await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});process.exitCode=1}finally{if(page&&!page.isClosed())report.finalEvents=await page.evaluate(()=>window.suit?.events).catch(()=>[]);fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2));await context?.close();console.log('REPORT '+report.pass+' '+report.checks.length)}})();
