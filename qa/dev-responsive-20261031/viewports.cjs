// Load the patched shell at several viewports; record layout metrics and screenshots.
const puppeteer=require('puppeteer-core'),path=require('path'),fs=require('fs');
const url=process.argv[2]||'http://127.0.0.1:49290/',out=process.argv[3]||path.join(__dirname,'shots');
fs.mkdirSync(out,{recursive:true});
const views=[
  ['desktop-1920',{width:1920,height:1080}],
  ['laptop-1366',{width:1366,height:768}],
  ['tablet-1024x768',{width:1024,height:768,isMobile:true,hasTouch:true,deviceScaleFactor:2}],
  ['phone-land-844x390',{width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:3,isLandscape:true}],
  ['phone-port-390x844',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:3}],
];
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:path.join(__dirname,'profile'),args:['--autoplay-policy=no-user-gesture-required']});
  const results=[];
  for(const [name,viewport] of views){
    const page=await browser.newPage();await page.setViewport(viewport);
    const logs=[];page.on('console',m=>logs.push(m.text()));
    await page.goto(url,{waitUntil:'load'});
    await page.waitForFunction(()=>window.suie?.ready,{timeout:120000});
    await new Promise(r=>setTimeout(r,4000));
    const m=await page.evaluate(()=>{
      const r=e=>{const b=document.getElementById(e)?.getBoundingClientRect();return b&&{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
      const vis=e=>{const n=document.getElementById(e);return !!n&&getComputedStyle(n).display!=='none'&&!n.hidden;};
      return {canvas:r('canvas'),holder:r('canvas_holder'),touchbar:vis('touchbar')?r('touchbar'):null,rotate:vis('rotate'),header:vis('header')||getComputedStyle(document.querySelector('header')).display!=='none',
        hscroll:document.documentElement.scrollWidth>innerWidth,vw:innerWidth,vh:innerHeight};
    });
    await page.screenshot({path:path.join(out,name+'.png')});
    results.push({name,...m,errors:logs.filter(l=>/error/i.test(l)).slice(0,3)});
    await page.close();
  }
  console.log(JSON.stringify(results,null,1));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
