#!/usr/bin/env node
'use strict';
// Fast development loop: build current scenario/ + art into build/dev/<target>, serve with live reload,
// rebuild on change. Never freezes inputs, never writes dist/, uses its own save database.
// Formal candidates still go through tools/integration/runtime/build.cjs.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');
const DEV_PREFIX='bijie-rain-suika3-dev:';
const WATCH=['scenario','system','assets/current','docs/整合','config.ini','main.ray','start.novel','tools/runtime/shell.js','tools/runtime/shell.css','tools/runtime/title-motion.js'];
const SHELL_ONLY=new Set(['tools/runtime/shell.js','tools/runtime/shell.css','tools/runtime/title-motion.js']);

function options(argv){
  const o={target:'web',port:49300,serve:true,watch:true,open:false};
  const args=[...argv];
  while(args.length){
    const flag=args.shift();
    if(flag==='--target')o.target=args.shift();
    else if(flag==='--native')o.target='desktop';
    else if(flag==='--port')o.port=Number(args.shift());
    else if(flag==='--once'){o.serve=false;o.watch=false;}
    else if(flag==='--no-watch')o.watch=false;
    else if(flag==='--open')o.open=true;
    else throw Error('未知参数：'+flag+'\n用法：node tools/dev/dev.cjs [--native] [--port 49300] [--once] [--no-watch] [--open]');
  }
  assert(['web','desktop'].includes(o.target),'--target 只能是 web 或 desktop');
  assert(Number.isInteger(o.port)&&o.port>=1024&&o.port<=65535,'端口应在1024到65535');
  return o;
}

function build({target}){
  // Fresh requires so edits to tools are picked up without restarting the watcher.
  for(const key of Object.keys(require.cache))if(key.startsWith(path.join(ROOT,'tools')+path.sep)&&!key.startsWith(__dirname))delete require.cache[key];
  const {compile}=require('../compiler/compile.cjs');
  const {validate}=require('../integration/runtime/validate.cjs');
  const {integrate}=require('../integration/runtime/presentation-full.cjs');
  const {build:runtimeBuild,saveIdentity}=require('../runtime/build.cjs');
  const started=Date.now(),warnings=[];
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/current/manifest.json'),'utf8'));
  assert.notEqual(manifest.schemaVersion,'sui-i01-data-v1','开发构建暂只支持 SUI-I-1 采用清单');
  const compiled=compile({pageSize:108});
  // The schema checker tries anyOf branches via thrown assertions; skip stack capture for speed.
  const limit=Error.stackTraceLimit;Error.stackTraceLimit=0;
  let v;try{v=validate({root:ROOT,compiled,mode:'candidate',lenient:true});}finally{Error.stackTraceLimit=limit;}
  warnings.push(...v.warnings);
  const out=path.join(ROOT,'build/dev',target);
  const dev={warnings};
  const integration={diagnostic:false,assets:v.assets,bindings:v.bindingsList,fingerprint:'dev',
    adapt:args=>integrate({...args,assets:v.assets,bindings:v.bindingsList,mode:'candidate',sdkPlatform:target==='web'?'wasm':'desktop'})};
  const saveId=saveIdentity({projectRoot:ROOT,compiled,integration,dev:true});
  const result=runtimeBuild({out,projectRoot:ROOT,compiled,databasePrefix:DEV_PREFIX,dev,integration,saveId});
  if(target==='web'){
    // Portrait page lives at /portrait/ of the same origin, so both share one save database.
    const portraitOut=path.join(ROOT,'build/dev/web-portrait');
    runtimeBuild({out:portraitOut,projectRoot:ROOT,compiled,databasePrefix:DEV_PREFIX,dev:{warnings},integration,layout:'portrait',saveId});
    const dest=path.join(out,'web/portrait');fs.mkdirSync(dest);
    for(const name of fs.readdirSync(path.join(portraitOut,'web')))fs.linkSync(path.join(portraitOut,'web',name),path.join(dest,name));
  }
  for(const w of new Set(warnings))console.warn('⚠ '+w);
  console.log('构建完成 '+((Date.now()-started)/1000).toFixed(1)+'s · 正文 '+compiled.ir.buildId.slice(0,12)+' · 绑定 '+v.bindingsList.length+'/'+v.bindings.bindings.length+' · 复用资源 '+dev.packed.reused+'/'+dev.packed.files+' · 输出 '+path.relative(ROOT,out));
  return {out,manifest:result};
}

function nativeExe(){
  const exe=process.platform==='win32'?(process.arch==='arm64'?'SDK/windows/suika3-arm64.exe':'SDK/windows/suika3-win64.exe'):process.platform==='darwin'?'SDK/macos/root/bin/suika3':null;
  assert(exe,'当前系统没有可用的 Suika3 原生运行文件');
  assert(fs.existsSync(path.join(ROOT,exe)),'缺少 '+exe+'；请先从 build-inputs 包恢复 SDK/');
  return path.join(ROOT,exe);
}
let native=null;
function runNative(out){
  if(native&&native.exitCode===null)native.kill();
  const stage=path.join(out,'stage'),exe=nativeExe(),local=path.join(stage,path.basename(exe));
  fs.copyFileSync(exe,local);if(process.platform!=='win32')fs.chmodSync(local,0o755);
  native=cp.spawn(local,[],{cwd:stage,stdio:'inherit'});
  native.on('exit',code=>console.log('原生窗口已关闭（'+code+'）'));
}

// Live reload: the dev server injects a tiny EventSource client into index.html.
const clients=new Set();
function reload(){for(const res of clients)res.write('data: reload\n\n');}
const RELOAD='<script>new EventSource("/__dev/events").onmessage=()=>location.reload()</script>';
function serve(web,port){
  const http=require('node:http');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.arc':'application/octet-stream','.mp4':'video/mp4','.json':'application/json; charset=utf-8'};
  http.createServer((req,res)=>{
    let rel;try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
    if(rel==='/__dev/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store',Connection:'keep-alive'});res.write(': ok\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
    const file=path.resolve(web,'.'+(rel.endsWith('/')?rel+'index.html':rel));
    if(!file.startsWith(web+path.sep)||rel.includes('\0')){res.writeHead(403);res.end();return;}
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);res.end();return;}
      const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'};
      if(path.basename(file)==='index.html'){
        const html=fs.readFileSync(file,'utf8').replace('</body>',RELOAD+'</body>');
        res.writeHead(200,headers);res.end(html);return;
      }
      let start=0,end=stat.size-1,status=200;
      const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
      if(m&&(m[1]||m[2])){start=m[1]?Number(m[1]):Math.max(0,stat.size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),stat.size-1):stat.size-1;status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+stat.size;}
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);
      if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
    });
  }).listen(port,'127.0.0.1',()=>console.log('开发预览：http://127.0.0.1:'+port+'/  （存档独立于正式版，前缀 '+DEV_PREFIX+'）'));
}

function watch(o,onBuilt){
  let timer=null,pending=new Set(),busy=false;
  const run=()=>{
    if(busy)return;busy=true;
    const changed=[...pending];pending=new Set();
    try{
      if(o.target==='web'&&changed.length&&changed.every(p=>SHELL_ONLY.has(p))){
        for(const p of changed)for(const dir of ['web','web/portrait'])fs.copyFileSync(path.join(ROOT,p),path.join(ROOT,'build/dev/web',dir,path.basename(p)));
        console.log('外壳已更新：'+changed.join('、'));reload();
      }else onBuilt(build(o));
    }catch(e){console.error('✗ 构建失败：'+e.message);}
    busy=false;if(pending.size)schedule();
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(run,300);};
  for(const rel of WATCH){
    const full=path.join(ROOT,rel);if(!fs.existsSync(full))continue;
    fs.watch(full,{recursive:fs.statSync(full).isDirectory()},(_,name)=>{
      const p=fs.statSync(full).isDirectory()?rel+'/'+String(name||'').split(path.sep).join('/'):rel;
      pending.add(p);schedule();
    });
  }
  console.log('监视中：'+WATCH.join('、')+'（Ctrl+C 退出）');
}

if(require.main===module){
  try{
    const o=options(process.argv.slice(2));
    const first=build(o);
    const onBuilt=({out})=>{if(o.target==='desktop')runNative(out);else reload();};
    if(o.target==='desktop'){if(o.serve)runNative(first.out);}
    else if(o.serve){
      serve(path.join(first.out,'web'),o.port);
      if(o.open)cp.spawn(process.platform==='win32'?'cmd':'open',process.platform==='win32'?['/c','start','','http://127.0.0.1:'+o.port+'/']:['http://127.0.0.1:'+o.port+'/'],{detached:true,stdio:'ignore'}).unref();
    }
    if(o.watch)watch(o,onBuilt);
  }catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={build};
