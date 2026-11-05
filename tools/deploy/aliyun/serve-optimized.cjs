#!/usr/bin/env node
'use strict';
// 仅回环地址的验收服务器：原发布包与新分发包共享测试 origin。
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const [releasePath,baselinePath,port='49451']=process.argv.slice(2);
const root=path.resolve(__dirname,'../../..');
const release=path.resolve(root,releasePath),baseline=path.resolve(root,baselinePath);
const manifest=JSON.parse(fs.readFileSync(path.join(release,'release-manifest.json')));
const baselineManifest=JSON.parse(fs.readFileSync(path.join(baseline,'release-manifest.json')));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.mp4':'video/mp4','.webp':'image/webp','.arc':'application/octet-stream'};
http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const baselineVersioned=baselineManifest.assetBasePath&&pathname.startsWith(baselineManifest.assetBasePath);
  const old=pathname.startsWith('/baseline/')||baselineVersioned,versioned=pathname.startsWith(manifest.assetBasePath);
  const base=path.join(old?baseline:release,'web');
  let name=baselineVersioned?pathname.slice(baselineManifest.assetBasePath.length):old?pathname.slice('/baseline/'.length):versioned?pathname.slice(manifest.assetBasePath.length):pathname.slice(1);
  if(!name)name='index.html';
  const file=path.resolve(base,name);
  if(!file.startsWith(base+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  const size=fs.statSync(file).size;
  const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes',
    'Cache-Control':versioned?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff'};
  let start=0,end=size-1,status=200,source=file;
  if(req.headers.range){
    const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if(!match||+match[1]>=size){res.writeHead(416,{'Content-Range':'bytes */'+size}).end();return;}
    start=+match[1];end=match[2]?Math.min(+match[2],size-1):size-1;status=206;
    headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }else if(/gzip/.test(req.headers['accept-encoding']||'')&&fs.existsSync(file+'.gz')){
    source=file+'.gz';end=fs.statSync(source).size-1;headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';
  }
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);
  if(req.method==='HEAD')res.end();else{const stream=fs.createReadStream(source,{start,end});stream.pipe(res);res.on('close',()=>stream.destroy());}
}).listen(+port,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+port,assetBase:manifest.assetBasePath})));
