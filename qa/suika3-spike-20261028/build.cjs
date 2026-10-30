// Frozen standalone SUI-T entry. Never packages the project root.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const base=__dirname,root=path.resolve(base,'../..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mkdir=p=>fs.mkdirSync(p,{recursive:true});
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const sdk=path.join(root,'SDK/wasm/index.html');
if(hash(sdk)!=='f589ca123faccada973c65cd560f4d3bb0207ae3f701d4017fcf46d094ee74c0')throw Error('SDK fingerprint changed; review patches first');
const stage=path.join(base,'stage'),web=path.join(base,'web'),bin=path.join(base,'bin');
mkdir(stage);mkdir(web);mkdir(bin);
const inputs=[];
const resourcePaths=new Set(JSON.parse(fs.readFileSync(path.join(base,'resource-manifest.json'),'utf8')).assets.map(a=>a.path));
for(const dir of ['native','resources'])for(const source of files(path.join(base,dir))){
 const rel=path.relative(path.join(base,dir),source);
 if(/(^|\/)(save|\.DS_Store)(\/|$)/.test(rel)||/\.(arc|log)$/.test(rel))continue;
 const target=dir==='native'?rel:path.join('resources',rel);
 if(dir==='resources'&&!resourcePaths.has(target))continue;
 if(dir==='native'&&['source-map.json','excerpt-source.txt'].includes(rel))continue;
 mkdir(path.dirname(path.join(stage,target)));fs.copyFileSync(source,path.join(stage,target));inputs.push(target);
}
const pack=path.join(bin,'suika3-pack');fs.copyFileSync(path.join(root,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);
cp.spawnSync('xattr',['-d','com.apple.quarantine',pack],{stdio:'ignore'});
const packed=cp.spawnSync(pack,inputs.sort(),{cwd:stage,encoding:'utf8',timeout:60000});
fs.writeFileSync(path.join(base,'build.log'),(packed.stdout||'')+(packed.stderr||''));
if(packed.status!==0)throw Error('pack failed '+packed.status+' '+(packed.error||packed.stderr));
fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
let html=fs.readFileSync(sdk,'utf8');
function replaceOnce(from,to){if(html.split(from).length!==2)throw Error('Patch anchor mismatch: '+from);html=html.replace(from,to);}
replaceOnce('FS.mkdir(Module.UTF8ToString(A)),FS.mount(IDBFS,{},Module.UTF8ToString(A)),FS.syncfs(!0,(function(A){Module.ccall("main_continue","v")}))','suit.install(FS,IDBFS);const mount=Module.UTF8ToString(A);FS.mkdir(mount);FS.mount(IDBFS,{},mount);FS.syncfs(true,function(error){if(suit.restored(error,mount))Module.ccall("main_continue","v")})');
replaceOnce('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("bijie-rain-suika3-spike-20261028:"+A,IDBFS.DB_VERSION)');
replaceOnce('function onResizeWindow(){var A=document.getElementById("canvas"),v=A.width/A.height,r=window.innerWidth,j=window.innerHeight,t=r,f=r/v;f>j&&(f=j,t=j*v),A.style.width=t+"px",A.style.height=f+"px",A.focus()}','function onResizeWindow(){suit.resize()}');
replaceOnce('print:function(e){console.log(e)}','print:function(e){suit.log(e);console.log(e)}');
replaceOnce('<meta content="width=device-width,user-scalable=no,maximum-scale=1,initial-scale=1"name=viewport>','<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">');
replaceOnce('</head>','<link rel="icon" href="data:,"><link rel="stylesheet" href="shell.css"><script src="shell.js"></script></head>');
replaceOnce('<body style=padding:0;margin:0>','<body style=padding:0;margin:0><header>SUI-T 技术样板 · 正文摘录与测试条件 · 非正式游戏</header>');
const keys=[['Enter','继续'],['C','返回选择'],['U','切换前置'],['N','下张资源'],['R','重新开始'],['S','存档1'],['D','存档2'],['F','存档3'],['A','读自动档'],['1','读档1'],['2','读档2'],['3','读档3']];
replaceOnce('<script>var Module=', '<nav id="controls" aria-label="样板测试控制">'+keys.map(([k,t])=>`<button type="button" data-key="${k}">${t}</button>`).join('')+'<button id="retry-save">重试写入</button></nav><div id="storage-status" role="status">正在载入引擎及独立存档库…</div><script>var Module=');
html=html.replace('<html lang=en-us>','<html lang="zh-CN">');fs.writeFileSync(path.join(web,'index.html'),html);
for(const name of ['shell.js','shell.css'])fs.copyFileSync(path.join(base,name),path.join(web,name));
const manifest={sdkSha256:hash(sdk),project:'bijie-rain-suika3-spike-20261028',inputs:inputs.sort().map(p=>({path:p,bytes:fs.statSync(path.join(stage,p)).size,sha256:hash(path.join(stage,p))})),outputs:files(web).map(p=>({path:path.relative(base,p),bytes:fs.statSync(p).size,sha256:hash(p)}))};
fs.writeFileSync(path.join(base,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({inputs:inputs.length,archiveBytes:fs.statSync(path.join(web,'assets.arc')).size}));
