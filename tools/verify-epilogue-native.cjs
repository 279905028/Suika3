#!/usr/bin/env node
'use strict';
// 独立原生诊断：只验证分派及恢复状态，不作为正式游戏全流程试玩。
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {compile}=require('./compiler/compile.cjs'),{model}=require('./compiler/model.cjs'),{hash}=require('./compiler/parse.cjs');
const root=path.resolve(__dirname,'..'),q=JSON.stringify;
async function verify({qa,port=49271,attempt='native-probe'}){
  assert(/^qa\/[a-z0-9-]+$/.test(qa||''));
  assert(/^[a-z0-9-]+$/.test(attempt));
  const out=path.join(root,qa,attempt);assert(!fs.existsSync(out),'禁止覆盖探针证据');
  const stage=path.join(out,'stage'),web=path.join(out,'web');fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(web);
  const generated=compile({pageSize:108}),ir=generated.ir,m=model(ir),cases=[];
  for(const r of ir.contract.routes)for(const relation of ['HIGH','LOW'])for(const combo of r.id==='piao'&&relation==='LOW'?['A','B']:['AA','AB']){
    const answers=Object.fromEntries(Object.values(ir.choices).filter(c=>ir.contract.storyEntry.common.includes(c.source.file)||c.source.file===r.file&&(r.id!=='piao'||(c.id===r.lowPathChoice)===(relation==='LOW'))).map(c=>[c.id,'A']));
    answers['ROUTE-01']=r.id;for(const c of ir.contract.piaoRelation.choices)answers[c.id]=relation==='HIGH'?'A':'B';
    (r.id==='piao'&&relation==='LOW'?[r.lowPathChoice]:r.keyChoices).forEach((id,i)=>answers[id]=combo[i]);
    const s=m.run(answers,{collect:false}).s;
    cases.push({name:r.id+'/'+relation+'/'+combo,state:s,target:s.epilogue?ir.contract.epilogues.rules.find(x=>x.target?.file===s.epilogue).target.anchor:''});
  }
  assert.equal(cases.length,24);
  const functions=cases.map((c,i)=>{
    const s=c.state,set=(k,v)=>`sc_set(${q(k)},${q(String(v))});`;
    return `func ep_case_${i}() {\nsc_new();\n${Object.entries(s.choices).map(([k,v])=>set('c_'+k,v)).join('\n')}\n${['route','relation','score','ending'].map(k=>set(k,s[k])).join('\n')}\n${s.events.map(e=>set('e_'+e,1)).join('\n')}\nvar before=sc_validate();\nvar target=sc_dispatch();\nvar valid=before && sc_ok() && target==${q(c.target)} && sc_get("epilogue")==${q(c.target)} && sc_validate();\nprint("EPQA|case|${c.name}|target="+target+"|pass="+valid);\nsc_set("epilogue",${q(c.target?'':'EP-HIGH')});\nvar rejected=!sc_validate();\nprint("EPQA|reject|${c.name}|pass="+rejected);\n}`;
  });
  const batches=[];for(let i=0;i<24;i+=6)batches.push(`func ep_batch_${i}() { ${Array.from({length:6},(_,j)=>`ep_case_${i+j}();`).join(' ')} }`);
  const host=`\n${functions.join('\n')}\n${batches.join('\n')}\nfunc setup() {return {width:1280,height:720,title:"后日谈原生诊断",fullscreen:false};}\nfunc start() {Suika.start();sc_install();${[0,6,12,18].map(i=>`ep_batch_${i}();`).join('')} print("EPQA|done|24");}\nfunc update() {}\nfunc render() {}\n`;
  const supportManifest=JSON.parse(fs.readFileSync(path.join(root,'qa/suika3-spike-20261028/build-manifest.json')));
  const support=supportManifest.inputs.filter(e=>e.path.startsWith('system/')&&!e.path.startsWith('system/plugins/'));
  for(const e of support){const bytes=fs.readFileSync(path.join(root,'qa/suika3-spike-20261028/native',e.path));assert.equal(hash(bytes),e.sha256);const dest=path.join(stage,e.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
  fs.copyFileSync(path.join(root,'qa/suika3-spike-20261028/native/config.ini'),path.join(stage,'config.ini'));
  fs.writeFileSync(path.join(stage,'main.ray'),generated.artifacts['story.ray']+host);
  fs.writeFileSync(path.join(stage,'start.novel'),generated.artifacts['story.novel']);
  const pack=path.join(out,'suika3-pack');fs.copyFileSync(path.join(root,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);
  const files=['main.ray','start.novel','config.ini',...support.map(x=>x.path)];
  const packed=cp.spawnSync(pack,files,{cwd:stage,encoding:'utf8'});assert.equal(packed.status,0,packed.stderr||packed.stdout);
  fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
  let html=fs.readFileSync(path.join(root,'SDK/wasm/index.html'),'utf8');
  html=html.replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("bijie-epilogue-diagnostic-20261102:"+A,IDBFS.DB_VERSION)');
  html=html.replace('</head>','<link rel="icon" href="data:,"><script>window.epProbe=[];window.alert=s=>{epProbe.push(String(s));console.log(s)};</script></head>');
  fs.writeFileSync(path.join(web,'index.html'),html);
  const report={scope:'独立Suika3 Wasm原生分派与内容状态拒绝探针，非正式游戏全流程',contentBuildId:ir.buildId,archiveSha256:hash(fs.readFileSync(path.join(web,'assets.arc'))),checks:[],errors:[]};
  let server,browser;
  try{
    server=http.createServer((req,res)=>{const f=path.join(web,req.url==='/'?'index.html':'assets.arc');res.setHeader('Content-Type',f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext(),p=await context.newPage();
    p.on('pageerror',e=>report.errors.push(e.message));
    await p.goto('http://127.0.0.1:'+port+'/');await p.waitForFunction(()=>epProbe.includes('EPQA|done|24'),null,{timeout:60000});
    report.events=await p.evaluate(()=>epProbe);report.checks=report.events.filter(x=>/^EPQA\|(case|reject)\|/.test(x));
    assert.equal(report.checks.length,48);assert(report.checks.every(x=>x.endsWith('|pass=1')),report.checks.filter(x=>!x.endsWith('|pass=1')).join('\n'));
    assert.equal(report.errors.length,0);report.status='pass';report.browser=browser.version();
  }catch(e){report.status='fail';report.error=e.stack;throw e;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors.length}));return report;
}
if(require.main===module){assert.equal(process.argv[2],'--qa');verify({qa:process.argv[3],attempt:process.argv[4]||'native-probe'}).catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={verify};
