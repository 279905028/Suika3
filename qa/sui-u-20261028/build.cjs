// Independent native GUI build. Root runtime and SDK inputs are read-only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const base=__dirname,root=path.resolve(base,'../..'),ui=path.join(root,'system/sui-u');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mkdir=p=>fs.mkdirSync(p,{recursive:true});
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const sdk=path.join(root,'SDK/wasm/index.html');
if(hash(sdk)!=='f589ca123faccada973c65cd560f4d3bb0207ae3f701d4017fcf46d094ee74c0')throw Error('SDK changed; review the compatibility patches');
const stage=path.join(base,'stage'),web=path.join(base,'web'),bin=path.join(base,'bin');
for(const d of [stage,web,bin])mkdir(d);
const inputs=new Set();
function write(rel,content){const p=path.join(stage,rel);mkdir(path.dirname(p));fs.writeFileSync(p,content);inputs.add(rel)}
function copy(rel,source=path.join(root,rel)){write(rel,fs.readFileSync(source))}
let config=fs.readFileSync(path.join(root,'config.ini'),'utf8');
const patch=JSON.parse(fs.readFileSync(path.join(ui,'config.patch.json'),'utf8'));
for(const [key,value] of Object.entries(patch)){
 const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const rx=new RegExp('^'+escaped+'=.*$','m');
 if(!rx.test(config)){
  if(key==='game.locale')config+='\ngame.locale='+value+'\n';
  else throw Error('Unknown config '+key);
 }else config=config.replace(rx,value===''?'# SUI-U removes '+key:key+'='+value);
}
config=config.replace(/^game\.title(?:\.[a-z-]+)?=.*$/gm,m=>m.split('=')[0]+'=SUI-U 界面验收');
write('config.ini',config);
write('main.ray',['gallery-order.ray','gallery.ray','history.ray','runtime.ray'].map(p=>fs.readFileSync(path.join(ui,p),'utf8')).join('\n')+'\n'+fs.readFileSync(path.join(base,'native/main.ray'),'utf8'));
copy('start.novel',path.join(base,'native/start.novel'));
for(const dir of ['png','gui','anime'])for(const source of files(path.join(ui,dir)))copy(path.relative(root,source),source);
for(const name of ['sysmenu','save','load','history','config'])copy(`system/${name}/${name}.gui`,path.join(ui,`gui/${name}.gui`));
// Only existing file-valued config entries are needed from the SDK sample.
for(const line of config.split('\n')){
 if(!/^[a-z][^=]*=/.test(line))continue;
 const v=line.slice(line.indexOf('=')+1).trim();
 if(/\.(?:png|anime|ogg|ttc)$/.test(v)&&fs.existsSync(path.join(root,v)))copy(v);
}
for(const rel of ['system/font/OFL.txt','sound/se/click.ogg'])copy(rel);
const pack=path.join(bin,'suika3-pack');fs.copyFileSync(path.join(root,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);
cp.spawnSync('xattr',['-d','com.apple.quarantine',pack],{stdio:'ignore'});
const list=[...inputs].sort();const result=cp.spawnSync(pack,list,{cwd:stage,encoding:'utf8',timeout:60000});
fs.writeFileSync(path.join(base,'build.log'),(result.stdout||'')+(result.stderr||''));
if(result.status!==0)throw Error('pack failed '+result.status+': '+(result.error||result.stderr));
fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
let html=fs.readFileSync(sdk,'utf8');
function once(from,to){if(html.split(from).length!==2)throw Error('Patch anchor mismatch: '+from);html=html.replace(from,to)}
once('FS.mkdir(Module.UTF8ToString(A)),FS.mount(IDBFS,{},Module.UTF8ToString(A)),FS.syncfs(!0,(function(A){Module.ccall("main_continue","v")}))','suiu.install(FS,IDBFS);const mount=Module.UTF8ToString(A);FS.mkdir(mount);FS.mount(IDBFS,{},mount);FS.syncfs(true,function(error){if(suiu.restored(error,mount))Module.ccall("main_continue","v")})');
once('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("bijie-rain-suika3-ui-20261028:"+A,IDBFS.DB_VERSION)');
once('function onResizeWindow(){var A=document.getElementById("canvas"),v=A.width/A.height,r=window.innerWidth,j=window.innerHeight,t=r,f=r/v;f>j&&(f=j,t=j*v),A.style.width=t+"px",A.style.height=f+"px",A.focus()}','function onResizeWindow(){suiu.resize()}');
once('print:function(e){console.log(e)}','print:function(e){suiu.log(e);console.log(e)}');
// Preserve native touch dispatch; cancel only cancellable browser events.
once('HEAP32[n+8>>2]=k,getWasmTableEntry(j)(t,n,v)&&r.preventDefault()','HEAP32[n+8>>2]=k,getWasmTableEntry(j)(t,n,v)&&r.cancelable&&r.preventDefault()');
once('<meta content="width=device-width,user-scalable=no,maximum-scale=1,initial-scale=1"name=viewport>','<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">');
once('</head>','<link rel="icon" href="data:,"><link rel="stylesheet" href="shell.css"><script src="shell.js"></script></head>');
once('<body style=padding:0;margin:0>','<body style=padding:0;margin:0><header><span>SUI-U 界面预览</span><small>独立测试存档</small><button id="fullscreen">全屏阅读</button></header>');
once('<script>var Module=','<div id="rotate" role="status"><div class="rotate-icon">↻</div><strong>请旋转手机，横屏阅读</strong><span>阅读进度会保留在当前页面。</span></div><div id="storage-status" role="status">正在准备阅读界面…</div><button id="retry-save" hidden>重试保存</button><script>var Module=');
html=html.replace('<html lang=en-us>','<html lang="zh-CN">');fs.writeFileSync(path.join(web,'index.html'),html);
for(const name of ['shell.js','shell.css'])fs.copyFileSync(path.join(base,name),path.join(web,name));
const manifest={date:'2026-10-28',fixture:true,canvas:[1280,720],sdkSha256:hash(sdk),
 inputs:list.map(p=>({path:p,bytes:fs.statSync(path.join(stage,p)).size,sha256:hash(path.join(stage,p))})),
 outputs:files(web).map(p=>({path:path.relative(base,p),bytes:fs.statSync(p).size,sha256:hash(p)}))};
fs.writeFileSync(path.join(base,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({inputs:list.length,archiveBytes:fs.statSync(path.join(web,'assets.arc')).size}));
