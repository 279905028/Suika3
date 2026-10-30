'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..'),web=path.join(__dirname,'package-test-work/server');fs.mkdirSync(web,{recursive:true});fs.writeFileSync(path.join(web,'index.html'),'TEST ONLY');
let handler;const mockHTTP={createServer(fn){handler=fn;return{listen(){}};}};
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'tools/runtime/serve.cjs'),'utf8'),{require:id=>id==='node:http'?mockHTTP:require(id),__dirname:path.join(ROOT,'tools/runtime'),process:{argv:['node','serve.cjs','--web',web,'--port','49389']},console,URL});
(async()=>{const request=url=>new Promise(resolve=>{const result={url};const res={writeHead(status){result.status=status;},end(){resolve(result);}};try{handler({method:'HEAD',url},res);}catch(e){result.uncaught=e.message;resolve(result);}});const normal=await request('/'),bad=await request('/%00');const result={scope:'网络绑定在当前环境被拒绝；使用实际服务处理器与真实fs，捕获监听而不占用端口',normal,encodedNull:bad};fs.writeFileSync(path.join(__dirname,'package-test-server-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));})();
