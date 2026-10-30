const fs=require('fs'),path=require('path'),cp=require('child_process'),http=require('http');
const root=path.resolve(__dirname,'../..'),version=process.argv[2],port=Number(process.argv[3]);
const out=path.join(__dirname,version);fs.mkdirSync(out,{recursive:true});
const log=fs.openSync(path.join(out,'server.log'),'a');
const server=cp.spawn(process.execPath,['tools/runtime/serve.cjs','--web','dist/'+version+'/web','--port',String(port)],{cwd:root,detached:true,stdio:['ignore',log,log]});server.unref();
fs.writeFileSync(path.join(out,'server.json'),JSON.stringify({pid:server.pid,port,version}));
function run(file){return new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,[path.join(__dirname,file),version,String(port)],{cwd:root,stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(Error(file+' exit '+code)));});}
function ready(){return new Promise((resolve,reject)=>{let tries=0;function check(){const q=http.get('http://127.0.0.1:'+port+'/',r=>{r.resume();resolve();});q.on('error',()=>{if(++tries>30)reject(Error('server unavailable'));else setTimeout(check,300)});}check();});}
(async()=>{await ready();await run('verify-browser.cjs');await run(process.argv.includes('--delta')?'verify-route-layout.cjs':'verify-routes.cjs')})().catch(e=>{console.error(e);process.exitCode=1});
