const fs=require('fs');
const path=require('path');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const dir=__dirname;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext();
 const page=await ctx.newPage();
 const report={date:'2026-10-30',scope:'独立UI方案预览；未运行游戏，未访问玩家存档',errors:[],checks:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.setContent(fs.readFileSync(path.join(dir,'ui-options.html'),'utf8'));
 const variants=page.locator('[data-variant]');
 for(const width of [736,375,320]){
  await page.setViewportSize({width,height:1300});
  for(let i=0;i<3;i++){
   await page.evaluate(n=>document.querySelectorAll('[data-variant]').forEach((s,j)=>s.hidden=n!==j),i);
   const v=variants.nth(i);
   await v.locator('[data-choice="2"]').click();
   if(await v.locator('[data-choice="2"]').getAttribute('aria-pressed')!=='true')throw Error('聚焦未更新');
   await v.locator('[data-tab="1"]').click();
   if(await v.locator('.sui-save').count()!==4)throw Error('槽位数量错误');
   await v.locator('[data-mode="保存"]').click();
   if(!(await v.locator('[data-mode-status]').textContent()).includes('不可手动覆盖'))throw Error('自动档说明缺失');
   for(const tab of [2,3,0])await v.locator(`[data-tab="${tab}"]`).click();
   await v.locator('[data-range="music"]').fill('75');
   if(await v.locator('output').first().textContent()!=='75%')throw Error('滑杆未更新');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   if(overflow)throw Error('横向溢出 '+width+' '+i);
   await page.screenshot({path:path.join(dir,'screenshots',`variant-${i+1}-${width}.png`),fullPage:true});
   report.checks.push({variant:await v.getAttribute('data-variant'),width,choice:true,menu:true,saveLoad:true,slider:true,noHorizontalOverflow:true});
  }
 }
 report.sourceBytes=fs.statSync(path.join(dir,'ui-options.html')).size;
 report.browser=browser.version();
 fs.writeFileSync(path.join(dir,'validation.json'),JSON.stringify(report,null,2)+'\n');
 await browser.close();
 console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,sourceBytes:report.sourceBytes}));
})().catch(e=>{console.error(e);process.exit(1)});
