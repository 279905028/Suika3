'use strict';
// Portrait web variant: phone portrait entry, every system page, choice, and saves crossing
// between the portrait and landscape pages of the same build (same origin = same save database).
// Usage: node verify-portrait.cjs <port> [out-dir]  (puppeteer-core from PUPPETEER or node resolution)
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),os=require('os');
const puppeteer=require(process.env.PUPPETEER||'puppeteer-core');
const port=process.argv[2]||'49310',base='http://127.0.0.1:'+port+'/',out=process.argv[3]||path.join(__dirname,'browser');
fs.mkdirSync(out,{recursive:true});
const report={port,checks:[],errors:[],logs:[],scope:'独立Chrome临时资料；竖版网页包与横竖版存档互通'};
const PHONE={width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2};
const PHONE_LANDSCAPE={width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:2,isLandscape:true};
const DESKTOP={width:1280,height:800};
let browser,page,profile;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const state=()=>report.logs.filter(x=>/^SUI_E\|(stable|load|rollback|new)\|/.test(x)).at(-1);
const cursor=()=>state()?.match(/\|cursor=([^|]*)/)?.[1];
const loads=slot=>report.logs.filter(l=>l.startsWith('SUI_E|load|slot='+slot+'|')).length;
const check=n=>{report.checks.push(n);console.log('PASS '+n);};
const settle=async()=>{await pause(450);await page.waitForFunction(()=>!suie.busy&&!suie.pending&&!suie.storageError,{timeout:20000});};
async function canvas(){return page.evaluate(()=>{const c=document.getElementById('canvas'),b=c.getBoundingClientRect();return {x:b.x,y:b.y,s:b.width/c.width,w:c.width,h:c.height};});}
// Touch on phones, mouse on desktop; coordinates are canvas pixels.
async function tap(x,y){
  const c=await canvas(),px=c.x+x*c.s,py=c.y+y*c.s;
  if(page.viewport().hasTouch)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py,{delay:80});
  await settle();
}
async function key(k){await page.focus('#canvas');await page.keyboard.press(k,{delay:70});await settle();}
async function shot(name){await page.screenshot({path:path.join(out,name+'.png')});}
async function open(url,viewport){
  await page.setViewport(viewport);
  const before=report.logs.length;
  await page.goto(url,{waitUntil:'load'});
  await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),{timeout:180000});
  await pause(1500);await settle();
  return before;
}
async function next(choose){
  const old=cursor();
  for(let i=0;i<10&&cursor()===old;i++){if(state()?.includes('|tag=choose|'))await choose();else await key('Enter');}
  assert.notEqual(cursor(),old,'正文没有前进');
}
const portraitChoose=()=>tap(360,830);
const landscapeChoose=()=>tap(980,168);
(async()=>{try{
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'suie-portrait-'));
  browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:profile,args:['--autoplay-policy=no-user-gesture-required']});
  page=await browser.newPage();
  page.on('console',m=>{const t=m.text();if(t.startsWith('SUI_'))report.logs.push(t);if(m.type()==='error'&&!/favicon/.test(t))report.errors.push(t);});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('dialog',async d=>{report.errors.push('dialog: '+d.message());await d.dismiss();});
  // Logs survive navigation: the page object is reused, and suie.events restarts per page.

  await open(base,PHONE);
  assert(page.url().endsWith('/portrait/'),'竖屏手机未进入竖版：'+page.url());
  let c=await canvas();assert.deepEqual([c.w,c.h],[720,1280]);
  report.portraitCanvasCss={width:Math.round(c.w*c.s),height:Math.round(c.h*c.s),scale:+c.s.toFixed(3)};
  await shot('01-title');check('390×844 竖屏打开根地址自动进入 720×1280 竖版');

  await tap(280,1136);await shot('02-title-settings');await key('Escape');
  await tap(440,1136);await shot('03-title-gallery');await tap(608,1072);await shot('04-title-gallery-page2');await tap(596,72);
  check('标题设置、图鉴（含翻页）与返回');

  await tap(360,972);await page.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),{timeout:30000});await settle();
  await shot('05-reading');const first=cursor();
  await tap(632,52);await shot('06-menu');
  await tap(502,1172);await shot('07-settings');
  await tap(218,1172);await shot('08-load');
  await tap(124,188);await shot('09-save');
  await tap(360,544);await shot('10-saved-slot1');await key('Escape');
  assert.equal(cursor(),first);check('菜单→设置→存读档→保存，保存不推进正文');

  await next(portraitChoose);assert.notEqual(cursor(),first);
  await tap(632,52);await tap(218,1172);await tap(360,544);assert.equal(cursor(),first);await shot('11-restored');
  check('竖版读取手动档还原正文位置');

  await tap(632,52);await tap(360,1172);await shot('12-history');await tap(644,1172);await shot('13-gallery');await tap(76,1172);await shot('14-menu-again');await key('Escape');
  assert.equal(cursor(),first);check('回顾/图鉴/菜单底部导航切换保留原段');

  while(cursor()!=='C01-01')await next(portraitChoose);
  for(let i=0;i<8&&!state().includes('|tag=choose|');i++)await key('Enter');
  assert(state().includes('|tag=choose|'),'未到达选择');await shot('15-choice');const atChoice=cursor();
  await tap(632,52);await tap(218,1172);await tap(124,188);await tap(360,960);await key('Escape');
  check('竖版选择页显示并手动保存（槽3）');

  // Portrait save → landscape page of the same build.
  await open(base+'?layout=landscape',DESKTOP);
  c=await canvas();assert.deepEqual([c.w,c.h],[1280,720]);
  const l3=loads(3);await tap(640,664);await shot('16-landscape-load');await tap(980,498);
  assert.equal(loads(3),l3+1,'横版未读取竖版槽3');assert.equal(cursor(),atChoice);await shot('17-landscape-choice');
  check('竖版存档在横版读取，停在同一选择');

  await landscapeChoose();await next(landscapeChoose);const landscapeCursor=cursor();
  await tap(1168,52);await tap(130,272);await tap(892,92);await tap(500,498);await key('Escape');
  check('横版选择后前进并手动保存（槽2）');

  await open(base,PHONE);assert(page.url().endsWith('/portrait/'));
  const l2=loads(2);await tap(360,1056);await shot('18-portrait-load');await tap(360,752);
  assert.equal(loads(2),l2+1,'竖版未读取横版槽2');assert.equal(cursor(),landscapeCursor);await shot('19-portrait-restored');
  check('横版存档在竖版读取，正文位置一致');

  // Automatic save, then rotate the phone and switch layout from the prompt.
  await next(portraitChoose);await pause(2500);await settle();const autoCursor=cursor();
  await page.setViewport(PHONE_LANDSCAPE);await pause(800);
  assert(await page.$eval('#rotate',n=>!n.hidden),'旋转后未出现切换提示');await shot('20-rotate-prompt');
  await Promise.all([page.waitForNavigation({waitUntil:'load',timeout:60000}),page.click('#switch-layout')]);
  await page.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),{timeout:180000});await pause(1500);await settle();
  assert(!page.url().includes('/portrait/'),'未切换到横版：'+page.url());
  const l0=loads(0);await tap(640,664);await tap(500,258);
  assert.equal(loads(0),l0+1,'横版未读取自动档');assert.equal(cursor(),autoCursor);await shot('21-switched-landscape');
  check('竖屏阅读中旋转→切换横版→读取自动档继续同一段');

  assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;console.error(e);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(profile)fs.rmSync(profile,{recursive:true,force:true});}})();
