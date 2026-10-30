'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),http=require('http'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {build}=require('../../tools/runtime/build.cjs');
const dir=__dirname,base=path.join(dir,'audit-runtime'),stage=path.join(base,'stage'),web=path.join(base,'web');
const manifest=build({out:base});
const injected=`
// AUDIT ONLY. Never included in the formal candidate.
var auditPhase=0;
var auditChoice="";
var auditSlot=0;
var auditGen="";
var auditAutoChecked=false;
var auditAutoCursor="";
var auditAutoPending="";
var auditAutoIndex=0;
func start() { auditOriginalStart(); if(eGet("audit_persistent")=="after-save") { auditPhase=4; print("AUDIT_E|observation|sdk-cache-slot11="+Suika.checkSaveExists({index:11})); var ok=eLoad(11,eGet("meta_gen_11")); auditCheck("reload-hidden-slot-via-host",ok); if(ok)auditCheck("reload-hidden-state-valid",eValidateLoad()); print("AUDIT_E|RELOAD_DONE"); } }
func auditCheck(name,pass) { print("AUDIT_E|check|"+name+"|pass="+pass); }
func auditRestore() { eLoad(1,""); }
func auditReject(name,key,value) {
 var old=Suika.getVariableString({name:key});
 Suika.setVariableString({name:key,value:value});
 auditCheck(name,!eValidateLoad());
 Suika.setVariableString({name:key,value:old});
 sc_set("error","");sc_set("status","running");
}
func auditTextChecks() {
 auditCheck("baseline-text-valid",eValidateLoad());
 auditCheck("manual-save-1",eSave(1));
 auditReject("reject-runtime-version","e_save_build","other");
 auditReject("reject-script-file","e_save_file","other.novel");
 auditReject("reject-native-position","e_save_index","999999");
 auditReject("reject-native-tag","e_save_tag","choose");
 auditReject("reject-source-cursor","e_save_cursor","wrong");
 auditReject("reject-content-build","sc_build","other");
 auditReject("reject-score","sc_score","999");
 auditReject("reject-unearned-freeze","sc_relation","HIGH");
 auditReject("reject-cross-route-choice","sc_c_MY07-01","A");
 auditReject("reject-route-without-entry","sc_route","xiaoman");
 auditReject("reject-event-without-route","sc_e_PIAO-PREGNANCY-READ","1");
 auditReject("reject-illegal-return","sc_return","wrong");
 auditReject("reject-text-pending","sc_pending","C01-01");
 auditReject("reject-undispatched-epilogue","sc_epilogue","EP-HIGH");
 var cursor=sc_get("cursor");sc_set("cursor","C01-01");eSet("save_cursor","C01-01");
 auditCheck("reject-consistent-but-wrong-position-map",!eValidateLoad());sc_set("cursor",cursor);eSet("save_cursor",cursor);
 var index=Suika.getTagIndex();
 eGlobal("meta_build_1","other");auditCheck("reject-old-version-before-load",!eLoad(1,""));
 auditCheck("old-version-keeps-current-position",Suika.getTagIndex()==index&&sc_get("cursor")==cursor);
 eGlobal("meta_build_1",e_build_id);
 auditCheck("reject-expired-generation-before-load",!eLoad(1,"other-generation"));
 auditCheck("expired-generation-keeps-current-position",Suika.getTagIndex()==index&&sc_get("cursor")==cursor);
 eSet("depth",1);eSet("cp_slot_1",1);eSet("cp_gen_1",123);eSet("cp_id_1","bad");eRollback();
 auditCheck("invalid-checkpoint-slot-keeps-current-position",Suika.getTagIndex()==index&&sc_get("cursor")==cursor);
 eSet("depth",0);eRollback();auditCheck("empty-checkpoint-keeps-current-position",Suika.getTagIndex()==index);
 eGlobal("audit_persistent","after-save");
 auditCheck("valid-load-restores",eLoad(1,""));
 auditCheck("global-not-rewound",eGet("audit_persistent")=="after-save");
 auditCheck("depth-restored",eInt("depth")==0);
 auditCheck("slot-preserved",Suika.checkSaveExists({index:1}));
 auditPhase=1;
}
func auditChoiceChecks() {
 if(!auditAutoChecked) { auditCheck("autosave-baseline-before-old-version",eSave(0)); auditAutoCursor=sc_get("cursor");auditAutoPending=sc_get("pending");auditAutoIndex=Suika.getTagIndex();auditPhase=10;print("AUDIT_E|AUTO_BEFORE");return; }
 auditChoice=sc_get("pending");auditSlot=eInt("cp_slot_1");auditGen=eGet("cp_gen_1");
 auditCheck("choice-waiting-valid",eValidateLoad());
 auditCheck("checkpoint-created",eInt("depth")==1&&auditSlot>=10&&auditSlot<=99&&Suika.checkSaveExists({index:auditSlot}));
 auditReject("reject-choice-already-answered","sc_c_"+auditChoice,"A");
 auditReject("reject-choice-uncommitted-input","sc_input","A");
 auditReject("reject-choice-wrong-pending","sc_pending","C02-01");
 eSet("audit_unrelated_local","new-after-snapshot");
 sc_set("c_"+auditChoice,"A");sc_set("c_C02-01","B");sc_set("pending","");sc_set("input","");
 auditCheck("checkpoint-load",eLoad(auditSlot,auditGen));
 auditCheck("rollback-clears-current-and-future-answer",sc_get("c_"+auditChoice)==""&&sc_get("c_C02-01")=="");
 auditCheck("rollback-restores-unanswered-question",sc_get("cursor")==auditChoice&&sc_get("pending")==""&&sc_get("input")=="");
 auditCheck("rollback-restores-full-trail",eInt("depth")==1&&eGet("cp_gen_1")==auditGen);
 auditCheck("global-still-not-rewound",eGet("audit_persistent")=="after-save");
 // Seed only completion state for a focused end-handler test, not full story evidence.
 sc_set("c_"+auditChoice,"A");sc_set("pending","");sc_set("status","complete");eMode="complete";eJump("e_complete");
 auditPhase=2;
}
func update() {
 if(auditPhase==10) { if(Engine.isBKeyPressed) { eGlobal("meta_build_0","old-version");auditCheck("old-version-auto-write-rejected",!eSave(0));auditCheck("old-auto-preserves-current-choice-state",sc_get("cursor")==auditAutoCursor&&sc_get("pending")==auditAutoPending&&Suika.getTagIndex()==auditAutoIndex);auditCheck("old-auto-blocks-repeated-background-write",eAutoBlocked);auditPhase=11;print("AUDIT_E|AUTO_AFTER"); } return; }
 if(auditPhase==11) { if(Engine.isNKeyPressed) { eGlobal("meta_build_0",e_build_id);eAutoBlocked=false;auditAutoChecked=true;auditPhase=1; } return; }
 auditOriginalUpdate();
 if(auditPhase==0 && eStable() && Suika.getTagName()=="text")auditTextChecks();
 else if(auditPhase==1 && eStable()) {
  if(Suika.getTagName()=="choose")auditChoiceChecks();
  else Suika.startSkipMode();
 } else if(auditPhase==2 && eMode=="complete" && Suika.getTagName()=="text" && Suika.isInCommandRepetition()) {
  eSet("finish","rollback");Tag_e_finish({});
  auditCheck("finish-handler-restores-last-choice",eMode=="reading"&&sc_get("status")=="running"&&sc_get("cursor")==auditChoice&&sc_get("pending")==""&&sc_get("c_"+auditChoice)=="");
  auditCheck("native-checkpoint-position-restored",Suika.getTagName()=="e_checkpoint");
  auditPhase=3;print("AUDIT_E|DONE");
 }
}
`;
const main=fs.readFileSync(path.join(stage,'main.ray'),'utf8');assert.equal(main.match(/func update\(\)/g).length,1);
fs.writeFileSync(path.join(stage,'main.ray'),main.replace('func update()','func auditOriginalUpdate()').replace('func start()','func auditOriginalStart()')+injected);
let config=fs.readFileSync(path.join(stage,'config.ini'),'utf8').replace('msgbox.skip_unseen=false','msgbox.skip_unseen=true');fs.writeFileSync(path.join(stage,'config.ini'),config);
const packed=cp.spawnSync(path.join(base,'bin/suika3-pack'),manifest.inputs.map(x=>x.path),{cwd:stage,encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);
fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
let html=fs.readFileSync(path.join(web,'index.html'),'utf8').replaceAll('bijie-rain-suika3-v1:','sui-e-negative-audit:');fs.writeFileSync(path.join(web,'index.html'),html);
let shell=fs.readFileSync(path.join(web,'shell.js'),'utf8').replace("String(message).startsWith('SUI_E|')","/^(SUI_E|SUI_C|AUDIT_E)\\|/.test(String(message))");fs.writeFileSync(path.join(web,'shell.js'),shell);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const report={date:'2026-10-28',scope:'独立原生负例注入探针；不是正式候选试玩或完整结局路径',hostBuild:manifest.runtimeBuildId,sourceHashes:manifest.sourceHashes,injectionSha256:hash(injected),archiveSha256:hash(fs.readFileSync(path.join(web,'assets.arc'))),checks:[],events:[],errors:[]};let browser,server;
(async()=>{try{
 server=http.createServer((req,res)=>{let f=path.join(web,req.url==='/'?'index.html':req.url);if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise(r=>server.listen(49232,'127.0.0.1',r));
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',async d=>{report.errors.push(d.message());await d.dismiss()});page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});await page.goto('http://127.0.0.1:49232');await page.waitForFunction(()=>window.suie?.events.some(x=>x==='SUI_E|title'),{},{timeout:30000});
 await page.waitForTimeout(800);const r=await page.locator('#canvas').boundingBox();await page.mouse.click(r.x+240*r.width/1280,r.y+386*r.height/720,{delay:90});
 await page.waitForFunction(()=>suie.events.includes('AUDIT_E|AUTO_BEFORE'),{},{timeout:30000});
 const autoBytes=async()=>Buffer.from(await page.evaluate(()=>Array.from(suie.fs.readFile(suie.mount+'/'+Array.from('000.sav').map(x=>x.charCodeAt(0).toString(16)).join('')))));
 const autoBefore=hash(await autoBytes());await page.locator('#canvas').focus();await page.keyboard.down('b');await page.waitForTimeout(90);await page.keyboard.up('b');await page.waitForFunction(()=>suie.events.includes('AUDIT_E|AUTO_AFTER'));const autoAfter=hash(await autoBytes());report.autoProtection={beforeSha256:autoBefore,afterSha256:autoAfter,unchanged:autoBefore===autoAfter};assert.equal(autoBefore,autoAfter,'旧版自动存档字节被改写');await page.keyboard.down('n');await page.waitForTimeout(90);await page.keyboard.up('n');
 await page.waitForFunction(()=>suie.events.includes('AUDIT_E|DONE'),{},{timeout:30000}).catch(e=>report.errors.push(e.message));
 await page.waitForFunction(()=>!suie.pending&&!suie.busy);report.filesBeforeReload=await page.evaluate(()=>suie.fs.readdir(suie.mount));const prior=await page.evaluate(()=>suie.events);await page.reload();await page.waitForFunction(()=>suie.events.includes('AUDIT_E|RELOAD_DONE'),{},{timeout:15000}).catch(e=>report.errors.push(e.message));report.filesAfterReload=await page.evaluate(()=>suie.fs.readdir(suie.mount));report.events=[...prior,...await page.evaluate(()=>suie.events)];report.checks=report.events.filter(x=>x.startsWith('AUDIT_E|check|')).map(x=>({name:x.split('|')[2],pass:x.endsWith('|pass=1')}));report.checks.push({name:'old-auto-native-file-sha256-unchanged',pass:report.autoProtection?.unchanged===true});report.passed=report.errors.length===0&&report.checks.length>=30&&report.checks.every(x=>x.pass);report.databases=await page.evaluate(()=>indexedDB.databases());
 await page.screenshot({path:path.join(dir,'audit-runtime-negative.png')});console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors},null,2));
 }catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(dir,'audit-runtime-negative.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)server.close();if(!report.passed)process.exitCode=1;}})();
