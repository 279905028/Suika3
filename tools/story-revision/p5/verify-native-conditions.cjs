#!/usr/bin/env node
'use strict';
// Isolated Suika VM condition probe. It is not a full-story playthrough.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict');
const {ROOT,QA,json,put,hash}=require('./adopt-motion.cjs');
const {compile}=require('../../compiler/compile.cjs');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=QA+'/conditions-engine',dir=path.join(ROOT,out),stage=path.join(dir,'stage'),web=path.join(dir,'web');assert(!fs.existsSync(dir));fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(web);
const generated=compile({pageSize:108,textPolicy:'required'}),items=json('docs/整合/motion-bindings.json').bindings,source=fs.readFileSync(path.join(ROOT,'tools/runtime/motion-host.ray'),'utf8');
const fn=source.slice(source.indexOf('func mEligible('),source.indexOf('func mAt('));assert(fn.includes('sc_condition'));
const q=JSON.stringify,literal=x=>q(x).replace(/"([a-zA-Z_][a-zA-Z_0-9]*)":/g,'$1:');let count=0;const checks=[];
const reportLine=(key,label,expr)=>{count++;checks.push({key,label});return 'print("P5COND|'+key+'|'+label+'|pass="+('+expr+'));';};
const cases=items.map((b,i)=>{
 const obj={...b,relation:b.relation||'',condition:b.conditionAst};delete obj.conditionAst;
 const lines=['sc_new();','sc_set("route",'+q(b.route)+');','sc_set("relation",'+q(b.relation||'HIGH')+');',...Object.entries(b.choices).map(([k,v])=>'sc_set('+q('c_'+k)+','+q(v)+');')];
 if(b.meeting)lines.push('sc_set("e_day14-meeting-read","1");');
 lines.push('var b='+literal(obj)+';',reportLine(b.key,'positive','mEligible(b)'));
 lines.push('sc_set("route","friends");',reportLine(b.key,'wrong-route','!mEligible(b)'),'sc_set("route",'+q(b.route)+');');
 if(b.relation)lines.push('sc_set("relation",'+q(b.relation==='HIGH'?'LOW':'HIGH')+');',reportLine(b.key,'wrong-relation','!mEligible(b)'),'sc_set("relation",'+q(b.relation)+');');
 for(const [k,v]of Object.entries(b.choices)){
  lines.push('sc_set('+q('c_'+k)+','+q(v==='A'?'B':'A')+');',reportLine(b.key,'changed-'+k,'!mEligible(b)'),'sc_set('+q('c_'+k)+',"");',reportLine(b.key,'unvisited-'+k,'!mEligible(b)'),'sc_set('+q('c_'+k)+','+q(v)+');');
 }
 if(b.meeting)lines.push('sc_set("e_day14-meeting-read","");',reportLine(b.key,'no-meeting','!mEligible(b)'));
 return 'func case_'+i+'(){\n'+lines.join('\n')+'\n}';
});
const batch=[];for(let i=0;i<items.length;i+=5)batch.push('func batch_'+i+'(){'+items.slice(i,i+5).map((_,j)=>'case_'+(i+j)+'();').join('')+'}');
const host='\n'+fn+'\n'+cases.join('\n')+'\n'+batch.join('\n')+'\nfunc setup(){return {width:1280,height:720,title:"P5动态条件独立夹具",fullscreen:false};}\nfunc start(){Suika.start();sc_install();'+batch.map((_,i)=>'batch_'+(i*5)+'();').join('')+'print("P5COND|done");}\nfunc update(){}\nfunc render(){}\n';
const old=json('qa/suika3-spike-20261028/build-manifest.json'),support=old.inputs.filter(x=>x.path.startsWith('system/')&&!x.path.startsWith('system/plugins/')).map(x=>x.path);
for(const rel of ['config.ini',...support]){const dest=path.join(stage,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(ROOT,'qa/suika3-spike-20261028/native',rel),dest);}
fs.writeFileSync(path.join(stage,'main.ray'),generated.artifacts['story.ray']+host);fs.writeFileSync(path.join(stage,'start.novel'),generated.artifacts['story.novel']);
const pack=path.join(dir,'suika3-pack');fs.copyFileSync(path.join(ROOT,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);
const packed=cp.spawnSync(pack,['main.ray','start.novel','config.ini',...support],{cwd:stage,encoding:'utf8'});assert.equal(packed.status,0,packed.stderr||packed.stdout);fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
let html=fs.readFileSync(path.join(ROOT,'SDK/wasm/index.html'),'utf8').replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("p5-motion-conditions:"+A,IDBFS.DB_VERSION)');html=html.replace('</head>','<link rel="icon" href="data:,"><script>window.conditionEvents=[];window.alert=s=>{conditionEvents.push(String(s));console.log(s)};</script></head>');fs.writeFileSync(path.join(web,'index.html'),html);
(async()=>{let server,browser,p;const report={status:'running',scope:'独立Suika Wasm引擎夹具；执行正式mEligible源函数的29正例与125负例，不代表完整路线、设备或发布',contentBuildId:generated.ir.buildId,conditionSourceSha256:hash(fn),expectedChecks:count};try{
 server=http.createServer((req,res)=>{const f=path.join(web,req.url==='/'?'index.html':'assets.arc');res.setHeader('Content-Type',f.endsWith('html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
 browser=await chromium.launch({channel:'chrome',headless:true});p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>conditionEvents.includes('P5COND|done'),null,{timeout:60000});report.events=await p.evaluate(()=>conditionEvents);report.checks=report.events.filter(x=>x.startsWith('P5COND|')&&x!=='P5COND|done');assert.equal(report.checks.length,count);assert(report.checks.every(x=>x.endsWith('|pass=1')),report.checks.filter(x=>!x.endsWith('|pass=1')).join('\n'));report.status='pass';report.browser=browser.version();
}catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;console.error(e.stack);if(p)report.events=await p.evaluate(()=>window.conditionEvents).catch(()=>[]);}finally{put(out+'/report.json',report);if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));console.log(JSON.stringify({status:report.status,checks:report.checks?.length}));}})();
