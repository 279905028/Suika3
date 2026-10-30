const fs=require('fs'),path=require('path'),cp=require('child_process'),http=require('http');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),d=path.join(__dirname,'audit-probe'),stage=path.join(d,'stage'),web=path.join(d,'web');fs.mkdirSync(web,{recursive:true});fs.cpSync(path.join(root,'qa/sui-u-20261028/stage'),stage,{recursive:true});
fs.writeFileSync(path.join(stage,'main.ray'),`
var phase=0;
func setup() { return {width:1280,height:720,title:"SUI-E API独立探针",fullscreen:false}; }
func start() { Suika.start(); }
func update() {
 if (phase>0 && phase<4)print("AUDIT|frame="+phase+"|before="+Suika.checkRightAfterLoad()+"|tag="+Suika.getTagIndex()+"|repeat="+Suika.isInCommandRepetition());
 Suika.update();
 if (phase>0 && phase<4){ print("AUDIT|frame="+phase+"|after="+Suika.checkRightAfterLoad()+"|tag="+Suika.getTagIndex()+"|repeat="+Suika.isInCommandRepetition());phase=phase+1;if(phase==4)print("AUDIT|DONE"); }
 if (phase==0 && Suika.isInCommandRepetition() && Suika.getTagName()=="choose") {
  Suika.setVariableString({name:"probe",value:"原始快照"});
  Suika.setVariableString({name:"global_probe",value:"保存之前"});
  Suika.makeVariableGlobal({name:"global_probe",isGlobal:true});
  Suika.addHistory({name:"",message:"存档之前的回顾",voice:"",bodyColor:16777215,bodyOutlineColor:0,nameColor:16777215,nameOutlineColor:0});
  print("AUDIT|save99="+Suika.executeSaveLocal({index:99}));
  print("AUDIT|has99="+Suika.checkSaveExists({index:99}));
  var before=Suika.getTagIndex();
  print("AUDIT|file="+Suika.getTagFile()+"|line="+Suika.getTagLine());
  Suika.setVariableString({name:"probe",value:"已改变"});
  Suika.setVariableString({name:"global_probe",value:"保存之后"});
  Suika.setVariableString({name:"new_after_save",value:"读档应消失"});
  Suika.addHistory({name:"",message:"存档之后的未来回顾",voice:"",bodyColor:16777215,bodyOutlineColor:0,nameColor:16777215,nameOutlineColor:0});
  print("AUDIT|historyBeforeLoad="+Suika.getHistoryCount());
  Suika.stopCommandRepetition();
  print("AUDIT|load99="+Suika.executeLoadLocal({index:99}));
  print("AUDIT|loaded="+Suika.getVariableString({name:"probe"})+"|global="+Suika.getVariableString({name:"global_probe"})+"|newExists="+Suika.checkVariableExists({name:"new_after_save"})+"|after="+Suika.checkRightAfterLoad()+"|tagBefore="+before+"|tag="+Suika.getTagIndex()+"|name="+Suika.getTagName());
  print("AUDIT|historyAfterLoad="+Suika.getHistoryCount()+"|latest="+Suika.getHistoryMessage({index:0}));
  print("AUDIT|save100="+Suika.executeSaveLocal({index:100}));
  print("AUDIT|has100="+Suika.checkSaveExists({index:100}));
  phase=1;
 }
}
func render(){Suika.render();}
`);
fs.writeFileSync(path.join(stage,'start.novel'),'[config name="game.locale" value="zh-cn"]\n[choose name="probe_choice" text1="A" value1="A" text2="B" value2="B"]\n[goto name="end"]\n[label name="end"]\n[text text="测试结束"]\n[goto name="end"]\n');
const files=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(p,e.name)):[path.join(p,e.name)]);
const inputs=files(stage).map(f=>path.relative(stage,f)).filter(f=>f!=='assets.arc');const pack=path.join(root,'qa/sui-u-20261028/bin/suika3-pack');
let p=cp.spawnSync(pack,inputs,{cwd:stage,encoding:'utf8'});if(p.status)throw Error(p.stderr+p.stdout);fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
let html=fs.readFileSync(path.join(root,'SDK/wasm/index.html'),'utf8').replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("sui-e-audit-isolated:"+A,IDBFS.DB_VERSION)').replace('</head>','<link rel="icon" href="data:,"><script>window.auditLog=[];window.alert=(s)=>{auditLog.push(String(s));console.log(s)};</script></head>');fs.writeFileSync(path.join(web,'index.html'),html);
const report={scope:'独立API探针，非正式运行包验收',events:[],errors:[]};let server,browser;
(async()=>{try{server=http.createServer((req,res)=>{const f=path.join(web,req.url==='/'?'index.html':req.url);if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res)});await new Promise(r=>server.listen(49231,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:49231');await page.waitForFunction(()=>auditLog.some(x=>x.includes('AUDIT|DONE')),{},{timeout:15000}).catch(e=>report.errors.push(e.message));report.events=await page.evaluate(()=>auditLog);report.files=await page.evaluate(()=>Object.keys(FS.mounts||{})).catch(()=>[]);console.log(JSON.stringify(report,null,2));fs.writeFileSync(path.join(__dirname,'audit-api-result.json'),JSON.stringify(report,null,2)+'\n');}finally{if(browser)await browser.close();if(server)server.close();}})();
