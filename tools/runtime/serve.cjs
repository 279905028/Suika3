#!/usr/bin/env node
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
let web,port=49222;
const args=process.argv.slice(2);
while(args.length){const flag=args.shift();if(flag==='--web')web=path.resolve(args.shift());else if(flag==='--port')port=Number(args.shift());else throw Error('未知参数：'+flag);}
if(!web)throw Error('必须显式指定 --web qa/<新批次>/web 或 dist/<候选>/web');
if(!['qa','dist','build'].includes(path.relative(root,web).split(path.sep)[0])||path.relative(root,web).split(path.sep).includes('..'))throw Error('仅服务本工程 qa/build/dist 候选');
web=fs.realpathSync(web);
if(!web.startsWith(root+path.sep))throw Error('候选不能链接到工程外');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口应在1024到65535');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.arc':'application/octet-stream','.wasm':'application/wasm','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let rel;try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(rel.includes('\0')){res.writeHead(400);res.end();return;}
  const file=path.resolve(web,'.'+(rel==='/'?'/index.html':rel));
  if(!file.startsWith(web+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(file,(error,stat)=>{
    let real;try{real=fs.realpathSync(file);}catch{res.writeHead(404);res.end();return;}
    if(error||!stat.isFile()||!real.startsWith(web+path.sep)){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log('本地阅读入口：http://127.0.0.1:'+port+'/'));
