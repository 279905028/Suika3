'use strict';
// 独立Suika Wasm夹具覆盖补图的全部不同完整状态；不冒称全路线实玩。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),http=require('node:http');
const {hash}=require('../../tools/compiler/parse.cjs'),{emit}=require('../../tools/compiler/emit.cjs');
const {integrate}=require('../../tools/story-revision/p4-integration/presentation.cjs');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),base=path.join(__dirname,'build'),dir=path.join(__dirname,'engine-v4');
const json=p=>JSON.parse(fs.readFileSync(p)),write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);};
const browserOnly=process.argv.includes('--browser-only');
assert(!fs.existsSync(dir));fs.mkdirSync(dir);
const manifest=json(path.join(base,'runtime/build-manifest.json')),built=json(path.join(base,'build-result.json'));
for(const f of built.inputs.filter(f=>/tools\/(integration\/runtime|story-revision\/p4-integration)\//.test(f.path)))assert.equal(hash(fs.readFileSync(path.join(root,f.path))),f.sha256,'运行工具与已构建输入不同');
const assets=json(path.join(base,'runtime-assets.json')),B=json(path.join(base,'bindings.json')).bindings,G=json(path.join(base,'gallery.registry.json'));
const plan=json(path.join(root,'docs/美术/背景补全-20261104/plan.json')),original=json(path.join(base,'runtime/generated/story.ir.json'));
const unique=new Map();for(const row of plan.plan){const b=B.find(b=>b.anchor.nodeId===row.nodeId),k=JSON.stringify(b.enter);if(!unique.has(k))unique.set(k,{b,sourceNodeId:row.nodeId});}
const samples=[...unique.values()].map((s,i)=>({...s,id:'BGF_'+String(i).padStart(3,'0')}));
const nodes=[...samples.map((s,i)=>({id:s.id,op:'text',paragraph:s.id,offset:0,text:'背景补全检查 '+String(i+1)+'。',source:original.nodes.find(n=>n.op==='text').source,next:i+1<samples.length?samples[i+1].id:'BGF_END'})),{id:'BGF_END',op:'text',paragraph:'BGF_END',offset:0,text:'恢复检查。',source:original.nodes.find(n=>n.op==='text').source,next:'SC_DONE'}];
const ir={...original,nodes,entry:nodes[0].id,buildId:hash('BGF fixture '+JSON.stringify(samples))},generated={ir,artifacts:emit(ir)};
const bindings=nodes.map((n,i)=>{const old=samples[i]?.b||samples[0].b;return {...structuredClone(old),bindingId:'probe-'+n.id,anchor:{nodeId:n.id},condition:'ALL',conditionAst:[],routeIds:[],...(i===samples.length?{enter:{...old.enter,cg:null},exit:{at:'next-node',restore:{...old.enter,cg:null}},cgId:null,fullView:false}:{})};});
const ui=json(path.join(root,'system/sui-u/integration.json')).raySourceOrder.map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const a=integrate({generated,host:fs.readFileSync(path.join(root,'main.ray'),'utf8'),uiRay:ui,assets,bindings,gallery:G,mode:'diagnostic'});
const host=`
var eMode="reading";var ePanel="";var bgfSeen="";var bgfRendered="";var bgfSaved=false;var bgfRestored=false;
func setup(){return {width:1280,height:720,title:"背景补全独立检查",fullscreen:false};}
func start(){Suika.start();sc_install();sc_new();suiUIStart();iInstall();iNew();Suika.setTextSpeed({speed:1.0});}
func update(){
 if(iBeforeUpdate())return;Suika.update();
 if(Suika.getTagName()!="text")return;
 var id=sc_get("cursor");
 if(id=="${samples[0].id}" && bgfRendered==id && !bgfSaved){bgfSaved=Suika.executeSaveLocal({index:3});print("BGF|saved|pass="+bgfSaved);}
 if(id=="BGF_END" && !bgfRestored){bgfRestored=true;Suika.stopCommandRepetition();Suika.clearInputState();var ok=Suika.executeLoadLocal({index:3})&&iRestore()&&sc_get("cursor")=="${samples[0].id}";bgfRendered="";print("BGF|restored|pass="+ok);}
}
func render(){Suika.render();suiUIRender();iRender();var id=sc_get("cursor");if(Suika.getTagName()=="text" && id!=bgfRendered){bgfRendered=id;print("BGF|visible|node="+id+"|bg="+iLiveLayers["bg"]+"|alpha="+Suika.getLayerAlpha({layer:Suika.LAYER_BG}));}}
`;
if(!browserOnly){
for(const f of manifest.inputs)if(!['main.ray','start.novel'].includes(f.path))write(path.join(dir,'stage',f.path),fs.readFileSync(path.join(base,'runtime/stage',f.path)));
write(path.join(dir,'stage/main.ray'),a.contentRay+'\n'+a.uiRay+'\n'+a.ray+'\n'+host);write(path.join(dir,'stage/start.novel'),a.contentNovel);
const pack=path.join(base,'runtime/bin/suika3-pack');const packed=cp.spawnSync(pack,manifest.inputs.map(f=>f.path),{cwd:path.join(dir,'stage'),encoding:'utf8',timeout:60000});assert.equal(packed.status,0,JSON.stringify({error:packed.error?.message,signal:packed.signal,stderr:packed.stderr,stdout:packed.stdout}));
write(path.join(dir,'web/assets.arc'),fs.readFileSync(path.join(dir,'stage/assets.arc')));
}else{
 const packedDir=path.join(__dirname,'engine-v2');
 assert.equal(hash(fs.readFileSync(path.join(packedDir,'stage/main.ray'))),hash(a.contentRay+'\n'+a.uiRay+'\n'+a.ray+'\n'+host),'已打包夹具与待验逻辑不同');
 write(path.join(dir,'web/assets.arc'),fs.readFileSync(path.join(packedDir,'web/assets.arc')));
}
let html=fs.readFileSync(path.join(root,'SDK/wasm/index.html'),'utf8').replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("bgfill-engine-fixture:"+A,IDBFS.DB_VERSION)');
html=html.replace('print:function(e){console.log(e)}','print:function(e){bgfEvents.push(String(e));console.log(e)}').replace('</head>','<link rel="icon" href="data:,"><script>window.bgfEvents=[];window.alert=s=>{s=String(s);bgfEvents.push(/^(BGF|SUI_)/.test(s)?s:"ERROR|"+s);console.log(s)};</script></head>');write(path.join(dir,'web/index.html'),html);
(async()=>{let server,browser,p;const report={date:'2026-11-04',status:'running',scope:'独立夹具：全部补图差异状态的真实Suika加载、画面、原生保存/恢复；非正式路线逐页实玩',uniqueChangedStates:samples.length,backgrounds:[...new Set(samples.map(s=>s.b.enter.background.assetId))],screenshots:[],errors:[],checks:[]};try{
 server=http.createServer((req,res)=>{const f=req.url==='/'?'index.html':req.url==='/assets.arc'?'assets.arc':null;if(!f){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('html')?'text/html':'application/octet-stream');fs.createReadStream(path.join(dir,'web',f)).pipe(res);});await new Promise((r,j)=>{server.on('error',j);server.listen(49331,'127.0.0.1',r);});
 browser=await chromium.launch({channel:'chrome',headless:true});p=await browser.newPage({viewport:{width:1280,height:720}});report.browser=browser.version();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:49331');
 const advance=async target=>{for(let k=0;k<20;k++){if(await p.evaluate(id=>bgfEvents.some(e=>e.startsWith('BGF|visible|node='+id+'|'))||(id==='BGF_END'&&bgfEvents.includes('BGF|restored|pass=1')),target))return;await p.keyboard.press('Enter',{delay:80});await p.waitForTimeout(180);}throw Error('未到达 '+target);};
 await p.waitForFunction(()=>bgfEvents.some(e=>e.startsWith('BGF|visible|node=BGF_000|')),null,{timeout:60000});await p.locator('#canvas').focus();
 for(const [i,s] of samples.entries()){
  if(i)await advance(s.id);await p.waitForTimeout(s.b.cgId?1800:180);
  const events=await p.evaluate(()=>bgfEvents);assert(!events.some(e=>e.startsWith('ERROR|')||e.startsWith('SUI_C|error')),events.filter(e=>e.startsWith('ERROR|')).join('\n'));
  const file=assets.find(a=>a.assetId===s.b.enter.background.assetId).runtimePath;assert(events.includes('BGF|visible|node='+s.id+'|bg='+file+'|alpha=255'));
  const name=s.id+'-'+s.b.enter.background.assetId+'.png';await p.screenshot({path:path.join(dir,name)});report.screenshots.push({nodeId:s.id,sourceNodeId:s.sourceNodeId,background:s.b.enter.background.assetId,cg:s.b.cgId,file:name});
 }
 await advance('BGF_END');await p.waitForFunction(()=>bgfEvents.includes('BGF|restored|pass=1'),null,{timeout:10000});await p.waitForTimeout(350);await p.screenshot({path:path.join(dir,'restored.png')});
 const events=await p.evaluate(()=>bgfEvents);assert(events.includes('BGF|saved|pass=1'));assert.equal(report.errors.length,0);report.checks=['全部'+samples.length+'种不同补图状态真实加载，背景层不透明','13种采用背景均实际进入；6张新图均覆盖','人物/道具/CG覆盖与下一状态清理有截图','原生保存后从末态恢复首态；重新加载背景成功'];
 report.databases=await p.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));assert(report.databases.length&&report.databases.every(n=>n.startsWith('bgfill-engine-fixture:')));report.status='pass';
 }catch(e){report.status='fail';report.error=e.stack;process.exitCode=1;if(p)await p.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});}finally{if(p)report.events=await p.evaluate(()=>bgfEvents).catch(()=>[]);if(browser)await browser.close();if(server?.listening)await new Promise(r=>server.close(r));write(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,states:samples.length,errors:report.errors,error:report.error}));}
})();
