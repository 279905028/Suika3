#!/usr/bin/env node
'use strict';
// 正式候选的普通键盘／鼠标路径；不向引擎注入状态。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {model}=require('./compiler/model.cjs');
const root=path.resolve(__dirname,'..'),qa='qa/epilogue-single-only-20261102',version='sui-i02-20261102-epilogue-v1';
const base=path.join(root,'build',version),out=path.join(root,qa,'browser');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'wasm/build-manifest.json'))),ir=JSON.parse(fs.readFileSync(path.join(base,'wasm/generated/story.ir.json')));
const fields=line=>Object.fromEntries((line||'').split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
async function verify(){
  assert(!fs.existsSync(out),'不得覆盖浏览器证据');fs.mkdirSync(out);
  const report={version,contentBuildId:ir.buildId,runtimeBuildId:manifest.runtimeBuildId,scope:'两条正式候选路径，普通键盘鼠标，独立浏览器存储',results:[]};
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const cases=[{route:'friends',relation:'HIGH'},{route:'mengyao',relation:'LOW'}];
  async function run(c){
    const name=c.route+'-'+c.relation,context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'}),p=await context.newPage(),logs=[],errors=[];
    const answers=Object.fromEntries(Object.values(ir.choices).filter(x=>ir.contract.storyEntry.common.includes(x.source.file)||x.source.file===ir.contract.routes.find(r=>r.id===c.route).file).map(x=>[x.id,'A']));
    answers['ROUTE-01']=c.route;for(const x of ir.contract.piaoRelation.choices)answers[x.id]=c.relation==='HIGH'?'A':'B';
    const expected=model(ir).run(answers),result={name,answers,expectedEnding:expected.s.ending,expectedEpilogue:expected.s.epilogue,clicks:[],errors};
    report.results.push(result);
    p.on('console',m=>{if(/^SUI_[EIC]\|/.test(m.text()))logs.push(m.text());else if(m.type()==='error')errors.push(m.text());});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
    const click=async(x,y)=>{const b=await p.locator('#canvas').boundingBox();await p.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720,{delay:70});};
    const last=()=>p.evaluate(()=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|')));
    try{
      await p.goto('http://127.0.0.1:49270/');await p.waitForFunction(()=>window.suie?.events.includes('SUI_E|title'),null,{timeout:60000});
      assert(logs.includes('SUI_E|ready|'+manifest.runtimeBuildId));await p.waitForTimeout(700);await click(320,664);
      await p.waitForFunction(()=>suie.events.some(x=>x.startsWith('SUI_E|stable|')),null,{timeout:15000});
      let complete=false,steps=0;
      while(!complete){
        assert(++steps<100);assert.equal(errors.length,0,errors.join('\n'));
        await p.evaluate(ids=>{
          const canvas=document.getElementById('canvas');canvas.focus();
          const d=window.epInput={down:false,reason:null,state:null,timer:null};
          const key=type=>canvas.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
          const stop=(reason,state)=>{clearInterval(d.timer);key('keyup');d.reason=reason;d.state=state;};
          d.timer=setInterval(()=>{
            const done=suie.events.findLast(x=>x.startsWith('SUI_E|complete|'));if(done){stop('complete',done);return;}
            const line=suie.events.findLast(x=>x.startsWith('SUI_E|stable|'));
            if(line){const f=Object.fromEntries(line.split('|').slice(2).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));if(f.tag==='choose'){stop('choose',line);return;}if(f.tag==='text'&&ids.includes(f.cursor)){stop('question',line);return;}}
            key(d.down?'keyup':'keydown');d.down=!d.down;
          },25);
        },Object.keys(ir.choices));
        await p.waitForFunction(()=>epInput.reason,null,{timeout:120000});
        const stop=await p.evaluate(()=>({reason:epInput.reason,state:epInput.state}));
        if(stop.reason==='complete'){
          const actual=fields(stop.state);result.actual=actual;assert.equal(actual.ending,expected.s.ending);assert.equal(actual.relation,c.relation);assert.equal(actual.event,c.relation==='LOW'?'1':'0');
          const target=expected.s.epilogue?ir.contract.epilogues.rules.find(r=>r.target?.file===expected.s.epilogue).target.anchor:'';assert.equal(actual.epilogue,target);complete=true;
        }else{
          let line=stop.state;
          if(stop.reason==='question')for(let i=0;i<6&&fields(line).tag!=='choose';i++){await click(400,700);await p.waitForTimeout(200);line=await last();}
          const f=fields(line);assert.equal(f.tag,'choose','没有进入选项');const id=f.pending;
          let options=ir.choices[id].options;
          if(id==='ROUTE-01'){
            const eligible=answers['C01-02']==='A'&&answers['C02-01']==='A';options=options.filter(o=>o.value!=='huangqiuqiu'||eligible);
            await p.screenshot({path:path.join(out,name+'-route.png')});
          }
          const value=answers[id],index=options.findIndex(o=>o.value===value);assert(index>=0,id);
          await click(1000,166+88*index);result.clicks.push({id,value});
          await p.waitForFunction(old=>suie.events.findLast(x=>x.startsWith('SUI_E|stable|'))!==old,line,{timeout:15000});
          if(id==='ROUTE-01')console.log('ROUTE '+name);
        }
      }
      const expectedPages=expected.paragraphs.flatMap(x=>ir.nodes.filter(n=>n.op==='text'&&n.paragraph===x.id).map(n=>n.id));
      const actualPages=logs.filter(x=>x.startsWith('SUI_E|stable|')).map(fields).filter(x=>x.tag==='text'&&x.cursor.startsWith('TEXT_')).map(x=>x.cursor);
      assert.deepEqual(actualPages,expectedPages,'全部实际正文页必须匹配分支预期');
      assert.deepEqual(result.clicks,expected.trace.filter(t=>t.op==='choice').map(t=>({id:t.id,value:t.value})));
      assert.equal(errors.length,0);result.status='pass';result.pages=actualPages.length;result.logs=logs;
      await p.screenshot({path:path.join(out,name+'-complete.png')});console.log('PASS '+name+' pages='+result.pages+' choices='+result.clicks.length);
    }catch(e){result.status='fail';result.error=e.stack;result.logs=logs;await p.screenshot({path:path.join(out,name+'-failure.png')}).catch(()=>{});throw e;}
    finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await context.close();}
  }
  try{await Promise.all(cases.map(run));report.status='pass';report.browser=browser.version();}
  catch(e){report.status='fail';report.error=e.stack;throw e;}
  finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
if(require.main===module)verify().catch(e=>{console.error(e.stack);process.exitCode=1;});
