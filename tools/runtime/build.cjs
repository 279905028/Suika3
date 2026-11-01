#!/usr/bin/env node
'use strict';
// Build the current scenario + E host + U GUI. SDK and source GUI files stay read-only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {compile,write:writeCompiled}=require('../compiler/compile.cjs');
const ROOT=path.resolve(__dirname,'../..');
const PROJECT='毕节，雨停之前 · Suika3';
const DATABASE_PREFIX='bijie-rain-suika3-v1:';
const SDK_SHA='f589ca123faccada973c65cd560f4d3bb0207ae3f701d4017fcf46d094ee74c0';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const fileHash=p=>hash(fs.readFileSync(p));
const mkdir=p=>fs.mkdirSync(p,{recursive:true});
// Archive/GUI paths are always '/'-separated, also on Windows.
const posix=p=>p.split(path.sep).join('/');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
// Save identity shared by the landscape and portrait web builds of one input set: story, host/state
// logic, UI manifests (which fingerprint every UI texture), SDK and build tools — not layout output.
function saveIdentity({projectRoot=ROOT,compiled,integration=null,dev=false}){
  const root=path.resolve(projectRoot),ui=JSON.parse(fs.readFileSync(path.join(root,'system/sui-u/integration.json'),'utf8'));
  const files=['main.ray','start.novel','config.ini','system/sui-u/integration.json',...ui.raySourceOrder,'tools/runtime/build.cjs','tools/runtime/cinema-theme.cjs','tools/runtime/portrait-theme.cjs','tools/runtime/title-motion.cjs','system/sui-cinema/manifest.json','system/sui-cinema/runtime.ray','system/sui-portrait/manifest.json','system/sui-title/manifest.json','tools/integration/runtime/presentation-full.cjs','tools/integration/runtime/presentation-full.ray'].filter(p=>fs.existsSync(path.join(root,p)));
  const hashes=Object.fromEntries(files.map(p=>[p,dev?(s=>s.size+':'+s.mtimeMs)(fs.statSync(path.join(root,p))):fileHash(path.join(root,p))]));
  return hash(JSON.stringify({contentBuildId:compiled.ir.buildId,hashes,sdk:SDK_SHA,integration:integration?integration.fingerprint:null}));
}
// dev: reuse build/dev (cleared each run), tolerate a stale cinema choice layout, reuse unchanged archive entries.
// layout 'portrait' builds the 720x1280 web variant; saveId (from saveIdentity) lets both variants read each other's saves.
function build({out,projectRoot=ROOT,compiled,integration,databasePrefix=DATABASE_PREFIX,dev=null,layout='landscape',saveId=null}={}){
  assert(out,'必须显式指定新输出目录；SUI-I02 请使用 tools/integration/runtime/build.cjs');
  assert(['landscape','portrait'].includes(layout),'layout 只能是 landscape 或 portrait');
  const root=path.resolve(projectRoot);
  const base=path.resolve(out),relative=path.relative(ROOT,base);
  assert(['qa','build'].includes(relative.split(path.sep)[0])&&!relative.split(path.sep).includes('..'),'仅输出至当前工程 qa/ 或 build/');
  if(dev){
    assert(posix(relative).startsWith('build/dev'),'开发构建只能输出到 build/dev*');
    assert(databasePrefix!==DATABASE_PREFIX,'开发构建须使用独立存档前缀');
    // Keep the previous archive outside the output so unchanged entries can be reused by pack().
    dev.previousArc=path.join(path.dirname(base),'.cache-'+path.basename(base)+'.arc');
    const prior=path.join(base,'stage/assets.arc');
    if(fs.existsSync(prior+'.json')){fs.renameSync(prior,dev.previousArc);fs.renameSync(prior+'.json',dev.previousArc+'.json');}
    // Retry: on Windows the dev server or browser may still hold the old archive for a moment.
    fs.rmSync(base,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }
  assert(!fs.existsSync(base)||fs.readdirSync(base).length===0,'输出目录非空，拒绝覆盖已有候选或历史证据');
  const sdk=path.join(root,'SDK/wasm/index.html');
  assert.equal(fileHash(sdk),SDK_SHA,'SDK已变化，需重新审查网页兼容补丁');
  const ui=JSON.parse(fs.readFileSync(path.join(root,'system/sui-u/integration.json'),'utf8'));
  const titleCover=require('./title-cover.cjs').load(root);
  // The title video is landscape-only; the portrait title is a still in the portrait UI set.
  const titleMotion=layout==='landscape'&&titleCover?.motion?require('./title-motion.cjs'):null;
  const cinemaModule=require('./cinema-theme.cjs'),cinema=cinemaModule.load(root);
  const portraitModule=require('./portrait-theme.cjs'),portrait=layout==='portrait'?portraitModule.load(root):null;
  if(layout==='portrait')assert(portrait&&cinema&&integration,'竖版需要竖版UI清单、电影UI与美术整合');
  let config=fs.readFileSync(path.join(root,'config.ini'),'utf8');
  assert(config.split('\n').includes('game.title='+PROJECT),'根 config.ini 尚未使用冻结的 SUI-E 项目身份');
  assert(config.includes('msgbox.image=system/sui-u/png/message.png'),'根 config.ini 尚未接入 SUI-U 配置');
  if(cinema)config=cinemaModule.config(config);
  if(portrait)config=portraitModule.config(config);
  const generated=compiled||compile({root,pageSize:108});
  if(cinema&&cinema.contentBuildId!==generated.ir.buildId){
    assert(dev,'电影UI选项图与正文版本不符；请先运行 tools/ui-cinema/build.cjs');
    dev.warnings.push('电影UI选项图来自旧正文版本；选项文字有改动时运行 node tools/ui-cinema/build.cjs');
  }
  if(portrait&&portrait.contentBuildId!==generated.ir.buildId){
    assert(dev,'竖版UI选项图与正文版本不符；请先运行 tools/ui-portrait/build.cjs');
    dev.warnings.push('竖版UI选项图来自旧正文版本；选项文字有改动时运行 node tools/ui-portrait/build.cjs');
  }
  const stage=path.join(base,'stage'),web=path.join(base,'web');
  for(const dir of [stage,web])mkdir(dir);
  writeCompiled(path.join(base,'generated'),generated);
  const inputs=new Set(),sources=new Set(['main.ray','start.novel','config.ini','system/sui-u/integration.json']);
  if(titleCover)for(const rel of titleCover.inputFiles)sources.add(rel);
  if(titleMotion)for(const rel of ['tools/runtime/title-motion.cjs','tools/runtime/title-motion.js'])sources.add(rel);
  if(cinema)for(const rel of cinema.inputFiles)sources.add(rel);
  if(portrait)for(const rel of portrait.inputFiles)sources.add(rel);
  function write(rel,data){assert(!path.isAbsolute(rel)&&!rel.split('/').includes('..'));mkdir(path.dirname(path.join(stage,rel)));fs.rmSync(path.join(stage,rel),{force:true});fs.writeFileSync(path.join(stage,rel),data);inputs.add(rel);} // unlink first: dev stage files may be hard links to sources
  function copy(rel,source=rel){
    if(titleCover&&rel==='system/sui-u/gui/title.gui')source=titleCover.gui;
    // dev: binary assets are never transformed, so hard-link them instead of copying hundreds of MB.
    if(dev&&/.(?:png|webp|jpg|ogg|ttc|ttf|otf|mp4)$/.test(source)){sources.add(source);const dest=path.join(stage,rel);mkdir(path.dirname(dest));fs.rmSync(dest,{force:true});fs.linkSync(path.join(root,source),dest);inputs.add(rel);return;}
    sources.add(source);let data=fs.readFileSync(path.join(root,source));
    if(titleMotion&&rel==='system/sui-u/gui/title.gui')data=titleMotion.gui(data.toString());
    if(rel==='system/sui-u/gui/title.gui'||source==='system/sui-u/gui/sysmenu.gui'){
      const buttons=rel==='system/sui-u/gui/title.gui'?{CONTINUE:'L'}:{SAVE:'V',LOAD:'L'};
      data=data.toString();
      for(const [button,action]of Object.entries(buttons)){
        const pattern=new RegExp('^'+button+'\\s*\\{[^}]+\\}','m');
        assert(pattern.test(data),'缺少原生GUI按钮：'+button);
        data=data.replace(pattern,block=>{
          assert(block.includes('type: gui;'));
          return block.replace('type: gui;','type: char;\n    var: e_action;\n    msg: '+action+';\n    max: 1;').replace(/^\s*file:.*;\s*$/m,'');
        });
      }
      // Keep the menu's Back button outside the reading-menu opener's hit area.
      // Otherwise a held opening click can immediately activate Back on release.
      if(integration && source.endsWith('/sysmenu.gui')) {
        const back=/^BACK\s*\{[^}]+\}/m;
        assert(back.test(data),'缺少系统菜单返回按钮');
        data=data.replace(back,block=>{
          assert(block.includes('x: 1080;'),'系统菜单返回位置已变化');
          return block.replace('x: 1080;','x: 944;');
        });
      }
      if(source.endsWith('/sysmenu.gui'))data+='\nROLLBACK {\n    id: 9;\n    type: char;\n    x: 476;\n    y: 518;\n    image-idle: system/sui-e/rollback-idle.png;\n    image-hover: system/sui-e/rollback-hover.png;\n    image-press: system/sui-e/rollback-press.png;\n    var: e_action;\n    msg: R;\n    max: 1;\n}\n';
    }
    if(source==='system/sui-u/gui/save.gui'||source==='system/sui-u/gui/load.gui'){
      const mode=source.endsWith('/save.gui')?'save':'load';
      const actions=mode==='save'?{1:'S',2:'D',3:'F'}:{0:'A',1:'1',2:'2',3:'3'};
      let changed=0;
      data=data.toString().replace(/SLOT([0-3])\s*\{[^}]+\}/g,block=>{
        const slot=Number(block.match(/^SLOT([0-3])/)[1]);assert(actions[slot]);
        assert(block.includes('type: '+mode+';'));changed++;
        return block.replace('type: '+mode+';','type: char;\n    var: e_action;\n    msg: '+actions[slot]+';\n    max: 1;');
      });
      assert.equal(changed,Object.keys(actions).length,'存读档回调转换未覆盖全部槽位');
    }
    if(cinema)data=cinemaModule.gui(root,cinema,rel,data);
    if(portrait)data=portraitModule.gui(root,portrait,rel,data);
    write(rel,data);
  }
  write('config.ini',config);
  let host=fs.readFileSync(path.join(root,'main.ray'),'utf8');
  let uiRay=ui.raySourceOrder.map(rel=>{sources.add(rel);return fs.readFileSync(path.join(root,rel),'utf8');}).join('\n');
  let adapted=integration?integration.adapt({generated,host,uiRay}):{host,uiRay,ray:'',contentRay:generated.artifacts['story.ray'],contentNovel:generated.artifacts['story.novel']};
  if(cinema)adapted=cinemaModule.adapt(root,cinema,adapted);
  if(portrait)adapted=portraitModule.adapt(root,portrait,adapted);
  host=titleMotion?titleMotion.host(adapted.host):adapted.host;uiRay=adapted.uiRay;
  // Saves carry box positions (SDK "local save" config); a save from the other layout would bring its own.
  // Re-apply this build's values right after every load, before the restored tag draws.
  const layoutLines=portraitModule.LAYOUT_KEYS.map(k=>{const m=config.match(new RegExp('^'+k.replaceAll('.','\\.')+'=(.*)$','m'));assert(m,'缺少配置项：'+k);return '    Suika.setConfig({key:'+JSON.stringify(k)+',value:'+JSON.stringify(m[1].trim())+'});';});
  const layoutCode=[];for(let i=0;i<layoutLines.length;i+=12)layoutCode.push('func eApplyLayout_'+i/12+'() {',...layoutLines.slice(i,i+12),'}');
  layoutCode.push('func eApplyLayout() {',...layoutCode.filter(l=>l.startsWith('func eApplyLayout_')).map(l=>'    '+l.slice(5,l.indexOf('(')+1)+');'),'    Suika.reloadStageImages(); Suika.reloadStagePositions();','}');
  host=host.replace('    if (!Suika.executeLoadLocal({index:slot})) { eMode="error"; eJump("e_error"); eMessage("存档无法读取，原档已保留。"); return false; }\n',m=>m+'    eApplyLayout();\n');
  assert(host.includes('    eApplyLayout();\n'),'读档版式恢复锚点丢失');
  host+='\n'+layoutCode.join('\n')+'\n';
  const contentRay=adapted.contentRay.replace('func Tag_sc_choose(params)', 'func sc_content_choose(params)');
  assert.notEqual(contentRay,generated.artifacts['story.ray'],'选择入口包装锚点丢失');
  write('main.ray',contentRay+'\n'+uiRay+'\n'+adapted.ray+'\n'+host);
  let checkpointCount=0;
  const contentNovel=adapted.contentNovel.replace(/^\[sc_choose id=("[^"]+")\]$/gm,(line,id)=>{checkpointCount++;return '[e_checkpoint id='+id+']\n'+line;});
  assert.equal(checkpointCount,generated.manifest.counts.choices);
  write('start.novel',fs.readFileSync(path.join(root,'start.novel'),'utf8')+'\n'+contentNovel);
  const positions={};let cursor='';
  fs.readFileSync(path.join(stage,'start.novel'),'utf8').split('\n').forEach((line,index)=>{
    const at=line.match(/^\[sc_at id="([^"]+)"\]/);if(at)cursor=at[1];
    if(/^\[label name="SC_(?:DONE|ERROR)"/.test(line))cursor='';
    if(cursor&&/^\[e_checkpoint /.test(line))positions[String(index+1)]={cursor,pending:'',tag:'e_checkpoint'};
    if(cursor&&/^\[text /.test(line))positions[String(index+1)]={cursor,pending:'',tag:'text'};
    if(cursor&&/^\[choose name="sc_input"/.test(line))positions[String(index+1)]={cursor,pending:cursor,tag:'choose'};
  });
  assert.equal(Object.values(positions).filter(p=>p.tag==='text').length,generated.manifest.counts.pages+generated.manifest.counts.choices,'正文位置登记数量异常');
  const registrations=Object.entries(positions).map(([line,p])=>'    e_positions['+JSON.stringify(line)+'] = {cursor: '+JSON.stringify(p.cursor)+', pending: '+JSON.stringify(p.pending)+', tag: '+JSON.stringify(p.tag)+'};');
  const positionCode=['var e_positions = {};'],batches=[];
  for(let i=0;i<registrations.length;i+=12)batches.push(registrations.slice(i,i+12));
  const groups=[];
  for(let i=0;i<batches.length;i+=12)groups.push(batches.slice(i,i+12).map((_,j)=>'    eInstallPositions_'+(i+j)+'();'));
  positionCode.push('func eInstallPositions() {',...groups.map((_,i)=>'    eInstallPositionsGroup_'+i+'();'),'}');
  for(const[i,calls]of groups.entries())positionCode.push('func eInstallPositionsGroup_'+i+'() {',...calls,'}');
  for(const[i,lines]of batches.entries())positionCode.push('func eInstallPositions_'+i+'() {',...lines,'}');
  write('main.ray',positionCode.join('\n')+'\n'+fs.readFileSync(path.join(stage,'main.ray'),'utf8'));
  fs.writeFileSync(path.join(base,'runtime-positions.json'),JSON.stringify({script:'start.novel',lineBase:1,positions},null,2)+'\n');
  for(const dir of ['png','gui','anime'])for(const f of files(path.join(root,'system/sui-u',dir)))copy(posix(path.relative(root,f)));
  for(const [target,source] of Object.entries(ui.fixedGUIAliases))copy(target,source);
  for(const state of ['idle','hover','press'])copy('system/sui-e/rollback-'+state+'.png','tools/runtime/rollback-'+state+'.png');
  if(titleCover)for(const resource of titleCover.resources)copy(resource.path);
  // Portrait: the cinema GUI paths still exist (cinemaAction opens them) but carry portrait content.
  if(cinema)for(const rel of [...Object.values(cinema.gui),...(portrait?[]:cinema.resources.filter(r=>r.path.endsWith('.png')).map(r=>r.path))])copy(rel);
  if(portrait)for(const rel of portrait.resources.filter(r=>r.path.endsWith('.png')).map(r=>r.path))copy(rel);
  sources.add('tools/runtime/rollback-button.py');
  // Include only explicitly configured support assets; never package sample story/art folders.
  for(const line of config.split('\n')){
    if(!/^[a-z][^=]*=/.test(line))continue;
    const value=line.slice(line.indexOf('=')+1).trim();
    if(!/\.(?:png|webp|anime|ogg|ttc|ttf)$/.test(value))continue;
    assert(value.startsWith('system/')||value==='sound/se/click.ogg'||cinema?.resources.some(r=>r.path===value),'未经白名单批准的配置资源：'+value);
    copy(value,portrait?portraitModule.configSource(portrait,value):value);
  }
  for(const rel of ['system/font/OFL.txt','sound/se/click.ogg'])copy(rel);
  for(const rel of inputs){
    if(!/\.(?:gui|anime)$/.test(rel))continue;
    const content=fs.readFileSync(path.join(stage,rel),'utf8');
    for(const m of content.matchAll(/(?:image-[\w-]+|file)\s*:\s*([^;]+);/g)){
      const dependency=m[1].trim();
      assert(inputs.has(dependency),'GUI依赖未打包：'+rel+' -> '+dependency);
    }
  }
  if(integration){for(const asset of integration.assets)copy(asset.runtimePath);for(const rel of integration.extraFiles||[])copy(rel);}
  const list=[...inputs].sort();
  // dev: size+mtime is enough to tell builds apart; release fingerprints hash every byte.
  const sourceHashes=Object.fromEntries([...sources].sort().map(p=>[p,dev?(s=>s.size+':'+s.mtimeMs)(fs.statSync(path.join(root,p))):fileHash(path.join(root,p))]));
  const runtimeBuildId=hash(JSON.stringify({layout,contentBuildId:generated.ir.buildId,sourceHashes,sdk:SDK_SHA,shell:fileHash(path.join(root,'tools/runtime/shell.js')),css:fileHash(path.join(root,'tools/runtime/shell.css')),build:fileHash(path.join(root,'tools/runtime/build.cjs')),integration:integration?integration.fingerprint:null}));
  write('main.ray','var e_build_id = '+JSON.stringify(saveId||runtimeBuildId)+';\n'+fs.readFileSync(path.join(stage,'main.ray'),'utf8'));
  // Byte-identical to SDK suika3-pack (verified against v1.1.0-beta.1 assets.arc); runs on any OS.
  const packed=require('./pack.cjs').pack(list,{cwd:stage,out:path.join(stage,'assets.arc'),previous:dev?.previousArc});
  if(dev)dev.packed=packed;
  fs.writeFileSync(path.join(base,'build.log'),list.map(p=>'Adding '+p).join('\n')+'\nTotal '+packed.bytes+' bytes\n');
  if(dev)fs.linkSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
  else fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
  let html=fs.readFileSync(sdk,'utf8');
  function once(from,to){assert.equal(html.split(from).length,2,'SDK补丁锚点不唯一：'+from);html=html.replace(from,to);}
  once('FS.mkdir(Module.UTF8ToString(A)),FS.mount(IDBFS,{},Module.UTF8ToString(A)),FS.syncfs(!0,(function(A){Module.ccall("main_continue","v")}))','suie.install(FS,IDBFS);const mount=Module.UTF8ToString(A);FS.mkdir(mount);FS.mount(IDBFS,{},mount);suie.restore(mount,function(){Module.ccall("main_continue","v")})');
  once('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open('+JSON.stringify(databasePrefix)+'+A,IDBFS.DB_VERSION)');
  once('function onResizeWindow(){var A=document.getElementById("canvas"),v=A.width/A.height,r=window.innerWidth,j=window.innerHeight,t=r,f=r/v;f>j&&(f=j,t=j*v),A.style.width=t+"px",A.style.height=f+"px",A.focus()}','function onResizeWindow(){suie.resize()}');
  once('print:function(e){console.log(e)}','print:function(e){suie.log(e);console.log(e)}');
  once('HEAP32[n+8>>2]=k,getWasmTableEntry(j)(t,n,v)&&r.preventDefault()','HEAP32[n+8>>2]=k,getWasmTableEntry(j)(t,n,v)&&r.cancelable&&r.preventDefault()');
  once('<meta content="width=device-width,user-scalable=no,maximum-scale=1,initial-scale=1"name=viewport>','<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">');
  once('<title>Game</title>','<title>毕节，雨停之前</title>');
  once('</head>','<link rel="icon" href="data:,"><link rel="stylesheet" href="shell.css"><script src="shell.js"></script></head>');
  once('<body style=padding:0;margin:0>','<body style=padding:0;margin:0><header><span>毕节，雨停之前</span><button id="fullscreen" type="button">全屏阅读</button></header>');
  // Rotating mid-session offers the other layout (saves are shared); a letterboxed landscape page keeps touch controls.
  once('<script>var Module=','<div id="rotate" role="status" hidden><span></span><button id="switch-layout" type="button">切换</button><button id="rotate-close" type="button" aria-label="关闭提示">保持当前</button></div><nav id="touchbar" aria-label="阅读控制"><button id="tb-menu" type="button">菜单</button><button id="tb-next" type="button">继续</button><button id="tb-fullscreen" type="button">全屏</button></nav><div id="storage-status" role="status" aria-live="polite">正在载入阅读界面与存档…</div><button id="retry-save" type="button" hidden>重试保存</button><script>var Module=');
  if(dev)once('<span>毕节，雨停之前</span>','<span>毕节，雨停之前 · 开发预览</span>');
  html=html.replace('<html lang=en-us>','<html lang="zh-CN" data-layout="'+layout+'">');
  if(integration&&integration.diagnostic)html=html.replace('<span>毕节，雨停之前</span>','<span>SUI-I02 技术诊断 · 图片仅作负载样本</span>');
  if(titleMotion){
    once('</head>','<script>window.suiTitleMotionConfig='+JSON.stringify({src:'title-motion.mp4',fadeStart:titleCover.motion.menuFadeStart,fadeEnd:titleCover.motion.menuFadeEnd})+'</script><script src="title-motion.js"></script></head>');
    fs.copyFileSync(path.join(root,titleCover.motion.path),path.join(web,'title-motion.mp4'));
    fs.copyFileSync(path.join(root,'tools/runtime/title-motion.js'),path.join(web,'title-motion.js'));
  }
  fs.writeFileSync(path.join(web,'index.html'),html);
  for(const name of ['shell.js','shell.css'])fs.copyFileSync(path.join(root,'tools/runtime',name),path.join(web,name));
  const manifest={schemaVersion:1,task:integration?'SUI-I02':'SUI-E',runtimeBuildId,saveBuildId:saveId||runtimeBuildId,layout,contentBuildId:generated.ir.buildId,project:PROJECT,databasePrefix,canvas:layout==='portrait'?[720,1280]:[1280,720],sdkSha256:SDK_SHA,pageSize:108,sourceHashes,
    runtimePositions:{count:Object.keys(positions).length,lineBase:1,batchSize:12},
    guiActions:{variable:'e_action',save:{1:'S',2:'D',3:'F'},load:{0:'A',1:'1',2:'2',3:'3'},openSave:'V',openLoad:'L',rollback:'R',nativeDirectSaveLoad:false},
    resourceBindings:integration?integration.bindings:[],webpCompatibility:integration?'SUI-I02显式图层适配；以当前候选实测为准':'仅PNG界面',
    inputs:list.map(p=>({path:p,bytes:fs.statSync(path.join(stage,p)).size,sha256:dev?dev.packed.index?.[p]??null:fileHash(path.join(stage,p))})),
    outputs:['assets.arc','index.html','shell.js','shell.css',...(titleMotion?['title-motion.mp4','title-motion.js']:[])].map(p=>({path:'web/'+p,bytes:fs.statSync(path.join(web,p)).size,sha256:fileHash(path.join(web,p))}))};
  fs.writeFileSync(path.join(base,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({out:path.relative(root,base),runtimeBuildId,contentBuildId:generated.ir.buildId,inputs:list.length,pages:generated.manifest.counts.pages,archiveBytes:fs.statSync(path.join(web,'assets.arc')).size}));
  return manifest;
}
if(require.main===module){try{let out;const args=process.argv.slice(2);while(args.length){const flag=args.shift();if(flag==='--out')out=args.shift();else throw Error('未知参数：'+flag);}build({out});}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={build,saveIdentity,PROJECT,DATABASE_PREFIX};
