#!/usr/bin/env node
'use strict';
// Real bundled Suika Wasm, deliberately synthetic sequence. No story route claims.
const C=require('./common.cjs');
const {fs,path,assert,ROOT,QA,write,freshOutput,json,read,hash}=C;
const cp=require('node:child_process'),http=require('node:http');
const {chromium}=require('/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {emit}=require('../../compiler/emit.cjs'),{integrate}=require('./presentation.cjs');
async function verify({preview=QA+'/preview-v2',out=QA+'/engine-v1'}={}) {
  const dir=freshOutput(out),stage=path.join(dir,'stage'),web=path.join(dir,'web'),base=path.join(ROOT,preview);
  const assets=json(preview+'/runtime-assets.json'),gallery=json(preview+'/gallery.registry.json'),original=json(preview+'/runtime/generated/story.ir.json');
  const source=original.nodes.find(n=>n.op==='text').source;
  const nodes=[...gallery.items.map(i=>i.id),'CLEAR'].map((id,n)=>({id:'P4_'+id,op:'text',text:'P4-06 技术夹具 · '+id+'。本页只验证图片与交互，不是剧情。',paragraph:'P4_'+id,offset:0,source,next:n<gallery.items.length?'P4_'+([...gallery.items.map(i=>i.id),'CLEAR'][n+1]):'SC_DONE'}));
  const ir={...original,nodes,entry:nodes[0].id,buildId:hash('P4-06 synthetic engine fixture '+JSON.stringify(gallery))};
  const generated={ir,artifacts:emit(ir)};
  const bindings=nodes.map((n,i)=>{
    const item=gallery.items[i],a=item?assets.find(a=>a.assetId===item.assetId):null;
    const evidence=a?json(C.CATALOG).assets.find(x=>x.assetId===a.assetId).checkEvidence:null;
    const meta=evidence?json(evidence.path).technical.runtime:null;
    const scale=meta?Math.min(1280/meta.width,720/meta.height):1;
    const enter={background:null,characters:[],props:[],cg:item?{assetId:item.assetId,layer:'cg',x:(1280-meta.width*scale)/2,y:(720-meta.height*scale)/2,scale}:null};
    return {bindingId:'probe-'+n.id,anchor:{nodeId:n.id},condition:'ALL',routeIds:[],enter,exit:{at:'next-node',restore:{...enter,cg:null}},cgId:item?.id||null,fullView:!!item};
  });
  const ui=json('system/sui-u/integration.json').raySourceOrder.map(p=>read(p).toString()).join('\n');
  const a=integrate({generated,host:read('main.ray').toString(),uiRay:ui,assets,bindings,gallery,mode:'diagnostic'});
  const host=`
var eMode="reading";var ePanel="";var p4Seen="";var p4Until=0;var p4Saved=false;var p4Restored=false;var p4Done=false;
func setup(){return {width:1280,height:720,title:"P4-06技术夹具",fullscreen:false};}
func start(){Suika.start();sc_install();sc_new();suiUIStart();iInstall();iNew();Suika.setTextSpeed({speed:1.0});suiUIDiagnostics=true;print("P4E|registered|count="+Array.size(suiCGOrder));}
func update(){
 if(iBeforeUpdate()) return;
 if(p4Done){Tag_sui_gallery({});return;}
 Suika.update();
 var id=sc_get("cursor");if(Suika.getTagName()!="text")return;
 if(p4Seen!=id){p4Seen=id;p4Until=Engine.millisec+250;print("P4E|entered|id="+id+"|unlocked="+suiGalleryIsUnlocked(Array.size(suiCGOrder)-1));}
 if(id=="P4_CG001" || Engine.millisec<p4Until || iFullView)return;
 if(id=="P4_CG129" && !p4Saved){p4Saved=Suika.executeSaveLocal({index:3});print("P4E|saved|pass="+p4Saved);}
 if(id=="P4_CLEAR"){
  print("P4E|cleared|alpha="+Suika.getLayerAlpha({layer:Suika.LAYER_EFF3})+"|full="+iFullView);
  if(!p4Restored){p4Restored=true;Suika.stopCommandRepetition();Suika.clearInputState();var loaded=Suika.executeLoadLocal({index:3});var valid=loaded&&iRestore()&&sc_get("cursor")=="P4_CG129";print("P4E|restored|pass="+valid);return;}
  p4Done=true;eMode="gallery";Tag_sui_gallery({});print("P4E|done");return;
 }
 Suika.stopCommandRepetition();Suika.moveToNextTag();
}
func render(){Suika.render();suiUIRender();iRender();}
`;
  const runtime=json(preview+'/runtime/build-manifest.json');
  for(const f of runtime.inputs)if(!['main.ray','start.novel'].includes(f.path))write(stage,f.path,fs.readFileSync(path.join(base,'runtime/stage',f.path)));
  write(stage,'main.ray',a.contentRay+'\n'+a.uiRay+'\n'+a.ray+'\n'+host);
  write(stage,'start.novel',a.contentNovel);
  const pack=path.join(dir,'suika3-pack');fs.copyFileSync(path.join(ROOT,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);
  const packed=cp.spawnSync(pack,runtime.inputs.map(f=>f.path),{cwd:stage,encoding:'utf8',timeout:60000});assert.equal(packed.status,0,packed.stderr);
  write(web,'assets.arc',fs.readFileSync(path.join(stage,'assets.arc')));
  let html=read('SDK/wasm/index.html').toString().replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("p4-06-engine-fixture:"+A,IDBFS.DB_VERSION)');
  html=html.replace('print:function(e){console.log(e)}','print:function(e){p4Events.push(String(e));console.log(e)}').replace('</head>','<link rel="icon" href="data:,"><script>window.p4Events=[];window.alert=s=>{s=String(s);p4Events.push(/^(P4E|SUI_)/.test(s)?s:"ERROR|"+s);console.log(s)};</script></head>');write(web,'index.html',html);
  const report={scope:'独立Suika Wasm合成技术夹具；81张实图逐帧、图鉴、全图与原生存读档；不验证剧情路径',status:'running',results:[],errors:[],contentBuildId:ir.buildId};let server,browser,p;
  try {
    server=http.createServer((req,res)=>{const file=req.url==='/'?'index.html':req.url==='/assets.arc'?'assets.arc':null;if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('html')?'text/html':'application/octet-stream');fs.createReadStream(path.join(web,file)).pipe(res);});await new Promise(r=>server.listen(49306,'127.0.0.1',r));
    browser=await chromium.launch({channel:'chrome',headless:true});p=await browser.newPage({viewport:{width:1280,height:720}});report.browser=browser.version();
    // The production shell normalizes letters; this bare SDK fixture uses its uppercase API directly.
    const key=async value=>{await p.keyboard.press(value.length===1?value.toUpperCase():value,{delay:100});await p.waitForTimeout(120);};
    p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(/^P4E\|(registered|saved|restored|done)/.test(m.text()))console.log(m.text());});
    await p.goto('http://127.0.0.1:49306');await p.waitForFunction(()=>p4Events.includes('SUI_I|unlock|cg=CG001|phase=first-visible-frame'),null,{timeout:60000});
    await p.locator('#canvas').focus();await p.screenshot({path:path.join(dir,'hint-CG001.png')});await key('v');await p.waitForTimeout(350);await p.screenshot({path:path.join(dir,'full-CG001.png')});await key('v');await p.waitForTimeout(450);
    let ev=await p.evaluate(()=>p4Events);assert(ev.includes('SUI_I|full-view|opened'));assert(ev.includes('SUI_I|full-view|closed'));assert(!ev.some(x=>x.includes('binding=probe-P4_CG004')),'全图操作推进正文');report.results.push('V打开/关闭全图保持原页');
    await p.mouse.click(120,48,{delay:100});await p.waitForTimeout(350);await p.mouse.click(640,400,{delay:100});await p.waitForTimeout(400);ev=await p.evaluate(()=>p4Events);assert.equal(ev.filter(x=>x==='SUI_I|full-view|opened').length,2);assert(!ev.some(x=>x.includes('binding=probe-P4_CG004')));report.results.push('点击入口/退出无穿透');
    await key('Enter');await p.waitForTimeout(300);await key('Enter');
    await p.waitForFunction(()=>p4Events.includes('P4E|done')||p4Events.some(x=>x.startsWith('ERROR|')),null,{timeout:180000});
    ev=await p.evaluate(()=>p4Events);assert(!ev.some(x=>x.startsWith('ERROR|')),ev.filter(x=>x.startsWith('ERROR|')).join('\n'));
    assert.deepEqual(ev.filter(x=>x.startsWith('SUI_I|unlock|')).map(x=>x.split('|cg=')[1].split('|')[0]),gallery.items.map(i=>i.id));
    assert(ev.includes('P4E|saved|pass=1'));assert(ev.includes('P4E|restored|pass=1'));assert(ev.includes('P4E|cleared|alpha=0|full=0'));report.results.push('81张实图按可见帧各解锁一次','清CG/关闭全图','原生保存后恢复CG129且不重复解锁');
    for(let i=0;i<13;i++){await key('PageDown');await p.waitForTimeout(250);}await p.screenshot({path:path.join(dir,'gallery-page14.png')});
    await key('PageDown');await p.waitForTimeout(200);await key('ArrowDown');await key('ArrowRight');await key('ArrowRight');await key('ArrowRight');await key('Enter');await p.waitForTimeout(250);await p.screenshot({path:path.join(dir,'gallery-CG129.png')});
    ev=await p.evaluate(()=>p4Events);assert(ev.includes('SUI_U|gallery-page|page=14'));assert(!ev.includes('SUI_U|gallery-page|page=15'));assert(ev.includes('SUI_U|gallery-open|id=CG129'));report.results.push('第14页仅3格/末页越界拒绝/键盘打开CG129');
    assert.equal(report.errors.length,0);report.status='pass';
  } catch(e){report.status='fail';report.error=e.stack;if(p)await p.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});throw e;}
  finally{if(p)report.events=await p.evaluate(()=>window.p4Events||[]).catch(()=>[]);if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));write(dir,'report.json',report);}
  console.log(JSON.stringify({status:report.status,checks:report.results.length}));
}
if(require.main===module)verify({preview:process.argv[2]||undefined,out:process.argv[3]||undefined}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={verify};
