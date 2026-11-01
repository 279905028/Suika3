// Edit a scenario line while the dev page is open; expect an automatic reload showing the new text.
const puppeteer=require('puppeteer-core'),path=require('path'),fs=require('fs');
const url='http://127.0.0.1:49300/',out=path.join(__dirname,'shots');
const file='F:/galgame_wen/suika3/scenario/第一章-回到毕节.md';
const OLD='银行的电话打到第三遍时，我的箱子轮子掉了。',NEW='银行的电话打到第三遍时，我的箱子轮子掉了。【开发热更新测试】';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function firstPage(page,name){
  await page.waitForFunction(()=>window.suie?.ready,{timeout:120000});await wait(3000);
  await page.evaluate(()=>suie.tap(318,663));
  await page.waitForFunction(()=>suie.events.some(e=>e.startsWith('SUI_E|stable|')),{timeout:30000});await wait(800);
  await page.screenshot({path:path.join(out,'live-'+name+'.png')});
  return page.evaluate(()=>suie.events.find(e=>e.startsWith('SUI_E|stable|')).split('|')[2]);
}
(async()=>{
  fs.rmSync(path.join(__dirname,'profile-live'),{recursive:true,force:true});
  const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:path.join(__dirname,'profile-live')});
  const page=await browser.newPage();await page.setViewport({width:1280,height:800});
  await page.goto(url,{waitUntil:'load'});
  const before=await firstPage(page,'before');
  const text=fs.readFileSync(file,'utf8');if(!text.includes(OLD))throw Error('anchor missing');
  const t0=Date.now();
  const reloaded=page.waitForNavigation({timeout:120000});
  fs.writeFileSync(file,text.replace(OLD,NEW));
  try{await reloaded;}finally{}
  const reloadMs=Date.now()-t0;
  const after=await firstPage(page,'after');
  // Restore the original text and wait for the rebuild that follows.
  const restored=page.waitForNavigation({timeout:120000});
  fs.writeFileSync(file,text);await restored;
  console.log(JSON.stringify({before,after,changed:before!==after,reloadMs}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
