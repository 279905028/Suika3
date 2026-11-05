#!/usr/bin/env node
'use strict';
// Small native-engine fixtures; the text is explicitly diagnostic, not story.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {compile}=require('../compiler/compile.cjs'),{parse,hash}=require('../compiler/parse.cjs'),{emit}=require('../compiler/emit.cjs'),{ROOT,QA}=require('./build-p1.cjs');
async function verify(run='native-v1'){
 assert(/^[a-z0-9-]+$/.test(run));const out=path.join(ROOT,QA,run);assert(!fs.existsSync(out));const stage=path.join(out,'stage'),web=path.join(out,'web');fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(web);
 const baseline=compile(),R=baseline.ir.contract,sources=Object.fromEntries(Object.keys(baseline.ir.entries).map(f=>[f,fs.readFileSync(path.join(ROOT,'scenario',f),'utf8')]));
 const fixture=(kind,speaker,name,channel,text)=>({kind,speaker,name,channel,group:null,text});
 const fixtures=[fixture('dialogue','shijiang','师匠','face','晚上十点到早上六点，月薪两千。休班提前排，工资每月固定一天结。夜里管一顿饭。愿意做，我们把话讲清楚。'),fixture('action',null,'','none','技术夹具：动作应清除上一位发言人的姓名。'),fixture('dialogue','phone-c01-001','电话那头的人','phone','技术夹具：最长电话称呼完整显示。'),fixture('message','piao','飘','text','技术夹具：消息单独标明发送者。'),fixture('thought','wenwen','文文','inner','技术夹具：这是明确心声，不是实际发言。'),fixture('dialogue','huangqiuqiu','门内的声音','offscreen','技术夹具：尚未揭示身份，不提前显示姓名。'),fixture('dialogue','huangqiuqiu','黄球球','face','技术夹具：身份已经由正文揭示。'),fixture('dialogue','yelan','叶岚','voice','技术夹具：语音发言，不推断现场立绘。'),fixture('dialogue','mengyao','孟遥','video','技术夹具：视频媒介后缀。'),fixture('narration',null,'','none','技术夹具：结束前旁白不保留上一位发言人。')];
 const source=fixtures.map((f,i)=>{const {text,...meta}=f;return '<!-- TEXT '+JSON.stringify({id:'T-C01-'+(900001+i),...meta})+' -->\n'+text;}).join('\n\n');
 sources[R.storyEntry.common[0]]=sources[R.storyEntry.common[0]].replace('## 完整内容\n','## 完整内容\n\n'+source+'\n');
 const full=parse(R,sources,{textPolicy:'mixed',pageSize:32}),nodes=full.nodes.filter(n=>n.textMeta?.id.startsWith('T-C01-9'));
 nodes.at(-1).next='P1_NATIVE_END';const ir={...full,entry:nodes[0].id,nodes,buildId:hash(source)};const artifacts=emit(ir);
 let config=fs.readFileSync(path.join(ROOT,'config.ini'),'utf8').replace(/^namebox.font.size=.*$/m,'namebox.font.size=20');
 const support=new Set(['system/font/OFL.txt']);for(const l of config.split('\n')){const value=l.slice(l.indexOf('=')+1).trim();if(/^[a-z]/.test(l)&&/\.(png|anime|ogg|ttc|ttf)$/.test(value))support.add(value);}
 for(const rel of support){const target=path.join(stage,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(ROOT,rel),target);}
 fs.writeFileSync(path.join(stage,'config.ini'),config);
 const expected=nodes.map(n=>({id:n.id,name:n.textMeta.displayName,text:n.text,offset:n.offset}));
 const q=JSON.stringify,registrations=expected.map((n,i)=>`func p1_n_${i}(){p1Expected[${q(n.id)}]={name:${q(n.name)},text:${q(n.text)}};}`);
 const host=`
var p1Expected={};var p1Last="";var p1Until=0;var p1Ready=false;var p1Saved=false;var p1Restored=false;
${registrations.join('\n')}
func setup(){return {width:1280,height:720,title:"P1边界夹具，非正文",fullscreen:false};}
func start(){Suika.start();sc_install();sc_new();${expected.map((_,i)=>`p1_n_${i}();`).join('')}Suika.setTextSpeed({speed:1.0});}
func update(){Suika.update();var id=sc_get("cursor");if(!Dict.hasKey(p1Expected,id)||Suika.getTagName()!="text")return;
 if(p1Last!=id){p1Last=id;p1Until=Engine.millisec+800;p1Ready=false;}
 if(Engine.millisec<p1Until||p1Ready)return;p1Ready=true;
 var e=p1Expected[id];var name=Suika.getHistoryName({index:0});var message=Suika.getHistoryMessage({index:0});var alpha=Suika.getLayerAlpha({layer:Suika.LAYER_NAMEBOX});
 var pass=name==e.name&&message==e.text; if(e.name=="")pass=pass&&alpha==0;else pass=pass&&alpha==255;
 print("P1N|page|id="+id+"|name="+name+"|alpha="+alpha+"|message="+message+"|pass="+pass);
 if(id=="T-C01-900001_2"&&!p1Saved){p1Saved=true;var saved=Suika.executeSaveLocal({index:3});print("P1N|save-page2|pass="+saved);}
 if(id=="T-C01-900002_1"&&p1Saved&&!p1Restored){p1Restored=true;Suika.stopCommandRepetition();Suika.clearInputState();var loaded=Suika.executeLoadLocal({index:3});var valid=loaded&&sc_validate()&&sc_get("cursor")=="T-C01-900001_2";print("P1N|restore-page2|pass="+valid);return;}
 Suika.stopCommandRepetition();Suika.moveToNextTag();}
func render(){Suika.render();}
func Tag_p1_native_end(params){print("P1N|done");Suika.startCommandRepetition();return true;}
`;
 fs.writeFileSync(path.join(stage,'main.ray'),artifacts['story.ray']+host);fs.writeFileSync(path.join(stage,'start.novel'),artifacts['story.novel']+'\n[label name="P1_NATIVE_END"]\n[p1_native_end]\n');
 const pack=path.join(out,'suika3-pack');fs.copyFileSync(path.join(ROOT,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);const packed=cp.spawnSync(pack,['main.ray','start.novel','config.ini',...support],{cwd:stage,encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);
 fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));let html=fs.readFileSync(path.join(ROOT,'SDK/wasm/index.html'),'utf8');html=html.replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("p1-native-boundary:"+A,IDBFS.DB_VERSION)').replace('</head>','<link rel="icon" href="data:,"><script>window.p1Events=[];window.alert=s=>{p1Events.push(String(s));console.log(s)};</script></head>');fs.writeFileSync(path.join(web,'index.html'),html);
 const report={scope:'独立Suika3 Wasm边界夹具，不是游戏正文或电脑原生运行',expected,errors:[]};let server,browser;
 try{
  server=http.createServer((req,res)=>{const f=path.join(web,req.url==='/'?'index.html':'assets.arc');res.setHeader('Content-Type',f.endsWith('html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise(r=>server.listen(49283,'127.0.0.1',r));
  browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:49283');await p.waitForFunction(()=>p1Events.includes('P1N|done'),null,{timeout:60000});
  report.events=await p.evaluate(()=>p1Events);const checks=report.events.filter(x=>x.startsWith('P1N|page|'));assert.equal(checks.length,expected.length+2);assert(checks.every(x=>x.endsWith('|pass=1')),checks.filter(x=>!x.endsWith('|pass=1')).join('\n'));assert(report.events.includes('P1N|save-page2|pass=1'));assert(report.events.includes('P1N|restore-page2|pass=1'));assert.equal(report.errors.length,0);assert(report.events.every(x=>x.startsWith('P1N|')));report.status='pass';report.pages=checks.length;report.browser=browser.version();await p.screenshot({path:path.join(out,'complete.png')});
 }catch(e){report.status='fail';report.error=e.stack;throw e;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({status:report.status,pages:report.pages}));
}
if(require.main===module)verify(process.argv[2]).catch(e=>{console.error(e.stack);process.exitCode=1;});
