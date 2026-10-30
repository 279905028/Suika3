#!/usr/bin/env node
'use strict';
// Build the current scenario + E host + U GUI. SDK and source GUI files stay read-only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {compile,write:writeCompiled}=require('../compiler/compile.cjs');
const ROOT=path.resolve(__dirname,'../..');
const PROJECT='毕节，雨停之前 · Suika3';
const DATABASE_PREFIX='bijie-rain-suika3-v1:';
const SDK_SHA='f589ca123faccada973c65cd560f4d3bb0207ae3f701d4017fcf46d094ee74c0';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const fileHash=p=>hash(fs.readFileSync(p));
const mkdir=p=>fs.mkdirSync(p,{recursive:true});
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function build({out,projectRoot=ROOT,compiled,integration,databasePrefix=DATABASE_PREFIX}={}){
  assert(out,'必须显式指定新输出目录；SUI-I02 请使用 tools/integration/runtime/build.cjs');
  const root=path.resolve(projectRoot);
  const base=path.resolve(out),relative=path.relative(ROOT,base);
  assert(['qa','build'].includes(relative.split(path.sep)[0])&&!relative.split(path.sep).includes('..'),'仅输出至当前工程 qa/ 或 build/');
  assert(!fs.existsSync(base)||fs.readdirSync(base).length===0,'输出目录非空，拒绝覆盖已有候选或历史证据');
  const sdk=path.join(root,'SDK/wasm/index.html');
  assert.equal(fileHash(sdk),SDK_SHA,'SDK已变化，需重新审查网页兼容补丁');
  const ui=JSON.parse(fs.readFileSync(path.join(root,'system/sui-u/integration.json'),'utf8'));
  const titleCover=require('./title-cover.cjs').load(root);
  const titleMotion=titleCover?.motion?require('./title-motion.cjs'):null;
  const cinemaModule=require('./cinema-theme.cjs'),cinema=cinemaModule.load(root);
  let config=fs.readFileSync(path.join(root,'config.ini'),'utf8');
  assert(config.split('\n').includes('game.title='+PROJECT),'根 config.ini 尚未使用冻结的 SUI-E 项目身份');
  assert(config.includes('msgbox.image=system/sui-u/png/message.png'),'根 config.ini 尚未接入 SUI-U 配置');
  if(cinema)config=cinemaModule.config(config);
  const generated=compiled||compile({root,pageSize:108});
  if(cinema)assert.equal(cinema.contentBuildId,generated.ir.buildId,'电影UI选项图与正文版本不符；请先运行 tools/ui-cinema/build.cjs');
  const stage=path.join(base,'stage'),web=path.join(base,'web'),bin=path.join(base,'bin');
  for(const dir of [stage,web,bin])mkdir(dir);
  writeCompiled(path.join(base,'generated'),generated);
  const inputs=new Set(),sources=new Set(['main.ray','start.novel','config.ini','system/sui-u/integration.json']);
  if(titleCover)for(const rel of titleCover.inputFiles)sources.add(rel);
  if(titleMotion)for(const rel of ['tools/runtime/title-motion.cjs','tools/runtime/title-motion.js'])sources.add(rel);
  if(cinema)for(const rel of cinema.inputFiles)sources.add(rel);
  function write(rel,data){assert(!path.isAbsolute(rel)&&!rel.split('/').includes('..'));mkdir(path.dirname(path.join(stage,rel)));fs.writeFileSync(path.join(stage,rel),data);inputs.add(rel);}
  function copy(rel,source=rel){
    if(titleCover&&rel==='system/sui-u/gui/title.gui')source=titleCover.gui;
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
    write(rel,data);
  }
  write('config.ini',config);
  let host=fs.readFileSync(path.join(root,'main.ray'),'utf8');
  let uiRay=ui.raySourceOrder.map(rel=>{sources.add(rel);return fs.readFileSync(path.join(root,rel),'utf8');}).join('\n');
  let adapted=integration?integration.adapt({generated,host,uiRay}):{host,uiRay,ray:'',contentRay:generated.artifacts['story.ray'],contentNovel:generated.artifacts['story.novel']};
  if(cinema)adapted=cinemaModule.adapt(root,cinema,adapted);
  host=titleMotion?titleMotion.host(adapted.host):adapted.host;uiRay=adapted.uiRay;
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
  for(const dir of ['png','gui','anime'])for(const f of files(path.join(root,'system/sui-u',dir)))copy(path.relative(root,f));
  for(const [target,source] of Object.entries(ui.fixedGUIAliases))copy(target,source);
  for(const state of ['idle','hover','press'])copy('system/sui-e/rollback-'+state+'.png','tools/runtime/rollback-'+state+'.png');
  if(titleCover)for(const resource of titleCover.resources)copy(resource.path);
  if(cinema)for(const rel of [...Object.values(cinema.gui),...cinema.resources.filter(r=>r.path.endsWith('.png')).map(r=>r.path)])copy(rel);
  sources.add('tools/runtime/rollback-button.py');
  // Include only explicitly configured support assets; never package sample story/art folders.
  for(const line of config.split('\n')){
    if(!/^[a-z][^=]*=/.test(line))continue;
    const value=line.slice(line.indexOf('=')+1).trim();
    if(!/\.(?:png|webp|anime|ogg|ttc|ttf)$/.test(value))continue;
    assert(value.startsWith('system/')||value==='sound/se/click.ogg'||cinema?.resources.some(r=>r.path===value),'未经白名单批准的配置资源：'+value);
    copy(value);
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
  const sourceHashes=Object.fromEntries([...sources].sort().map(p=>[p,fileHash(path.join(root,p))]));
  const runtimeBuildId=hash(JSON.stringify({contentBuildId:generated.ir.buildId,sourceHashes,sdk:SDK_SHA,shell:fileHash(path.join(root,'tools/runtime/shell.js')),css:fileHash(path.join(root,'tools/runtime/shell.css')),build:fileHash(path.join(root,'tools/runtime/build.cjs')),integration:integration?integration.fingerprint:null}));
  write('main.ray','var e_build_id = '+JSON.stringify(runtimeBuildId)+';\n'+fs.readFileSync(path.join(stage,'main.ray'),'utf8'));
  const pack=path.join(bin,'suika3-pack');fs.copyFileSync(path.join(root,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);
  cp.spawnSync('xattr',['-d','com.apple.quarantine',pack],{stdio:'ignore'});
  const result=cp.spawnSync(pack,list,{cwd:stage,encoding:'utf8',timeout:60000});
  fs.writeFileSync(path.join(base,'build.log'),(result.stdout||'')+(result.stderr||''));
  assert.equal(result.status,0,'打包失败：'+(result.error||result.stderr||result.stdout));
  fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
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
  once('<script>var Module=','<div id="rotate" role="status"><div class="rotate-icon">↻</div><strong>请旋转手机，横屏阅读</strong><span>阅读进度会保留在当前页面。</span></div><div id="storage-status" role="status" aria-live="polite">正在载入阅读界面与存档…</div><button id="retry-save" type="button" hidden>重试保存</button><script>var Module=');
  html=html.replace('<html lang=en-us>','<html lang="zh-CN">');
  if(integration&&integration.diagnostic)html=html.replace('<span>毕节，雨停之前</span>','<span>SUI-I02 技术诊断 · 图片仅作负载样本</span>');
  if(titleMotion){
    once('</head>','<script>window.suiTitleMotionConfig='+JSON.stringify({src:'title-motion.mp4',fadeStart:titleCover.motion.menuFadeStart,fadeEnd:titleCover.motion.menuFadeEnd})+'</script><script src="title-motion.js"></script></head>');
    fs.copyFileSync(path.join(root,titleCover.motion.path),path.join(web,'title-motion.mp4'));
    fs.copyFileSync(path.join(root,'tools/runtime/title-motion.js'),path.join(web,'title-motion.js'));
  }
  fs.writeFileSync(path.join(web,'index.html'),html);
  for(const name of ['shell.js','shell.css'])fs.copyFileSync(path.join(root,'tools/runtime',name),path.join(web,name));
  const manifest={schemaVersion:1,task:integration?'SUI-I02':'SUI-E',runtimeBuildId,contentBuildId:generated.ir.buildId,project:PROJECT,databasePrefix,canvas:[1280,720],sdkSha256:SDK_SHA,pageSize:108,sourceHashes,
    runtimePositions:{count:Object.keys(positions).length,lineBase:1,batchSize:12},
    guiActions:{variable:'e_action',save:{1:'S',2:'D',3:'F'},load:{0:'A',1:'1',2:'2',3:'3'},openSave:'V',openLoad:'L',rollback:'R',nativeDirectSaveLoad:false},
    resourceBindings:integration?integration.bindings:[],webpCompatibility:integration?'SUI-I02显式图层适配；以当前候选实测为准':'仅PNG界面',
    inputs:list.map(p=>({path:p,bytes:fs.statSync(path.join(stage,p)).size,sha256:fileHash(path.join(stage,p))})),
    outputs:['assets.arc','index.html','shell.js','shell.css',...(titleMotion?['title-motion.mp4','title-motion.js']:[])].map(p=>({path:'web/'+p,bytes:fs.statSync(path.join(web,p)).size,sha256:fileHash(path.join(web,p))}))};
  fs.writeFileSync(path.join(base,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({out:path.relative(root,base),runtimeBuildId,contentBuildId:generated.ir.buildId,inputs:list.length,pages:generated.manifest.counts.pages,archiveBytes:fs.statSync(path.join(web,'assets.arc')).size}));
  return manifest;
}
if(require.main===module){try{let out;const args=process.argv.slice(2);while(args.length){const flag=args.shift();if(flag==='--out')out=args.shift();else throw Error('未知参数：'+flag);}build({out});}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={build,PROJECT,DATABASE_PREFIX};
