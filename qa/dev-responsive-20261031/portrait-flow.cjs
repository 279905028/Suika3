// Portrait phone: start the story by tapping the canvas, then drive it with the HTML touch bar.
const puppeteer=require('puppeteer-core'),path=require('path'),fs=require('fs');
const url=process.argv[2]||'http://127.0.0.1:49290/',out=path.join(__dirname,'shots');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  fs.rmSync(path.join(__dirname,'profile-flow'),{recursive:true,force:true});
  const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:path.join(__dirname,'profile-flow')});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.goto(url,{waitUntil:'load'});
  await page.waitForFunction(()=>window.suie?.ready,{timeout:120000});await wait(4000);
  const shot=async name=>{await page.screenshot({path:path.join(out,'flow-'+name+'.png')});};
  const c=await page.evaluate(()=>{const b=document.getElementById('canvas').getBoundingClientRect();return {x:b.x,y:b.y,s:b.width/1280};});
  const tapCanvas=async(x,y)=>page.touchscreen.tap(c.x+x*c.s,c.y+y*c.s);
  await page.click('#rotate-close');await shot('0-title');
  await tapCanvas(318,663);await wait(3000);await shot('1-started');
  for(let i=0;i<3;i++){await page.tap('#tb-next');await wait(1500);}
  await shot('2-after-next');
  const before=await page.evaluate(()=>suie.events.length);
  await page.tap('#tb-menu');await wait(2000);await shot('3-menu');
  await page.tap('#tb-menu');await wait(2000);await shot('4-menu-closed');
  // Tap the empty letterbox below the canvas: should continue like the touch bar.
  await page.touchscreen.tap(195,c.y+720*c.s+60);await wait(1500);await shot('5-letterbox-tap');
  console.log(JSON.stringify({canvas:c,events:(await page.evaluate(()=>suie.events.slice(-15))),before}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
