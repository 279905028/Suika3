#!/usr/bin/env node
// Transform only the frozen deployed web package; never read current story/media inputs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'../../..');
const [sourceArg,outArg,traceArg,toolingArg]=process.argv.slice(2);
assert(sourceArg&&outArg&&traceArg&&toolingArg,'source out trace binaryen-package required');
const source=path.resolve(root,sourceArg),out=path.resolve(root,outArg);
assert(out.startsWith(root+'/dist/')&&!fs.existsSync(out),'必须使用新的独立分发目录');
const original=JSON.parse(fs.readFileSync(path.join(source,'release-manifest.json')));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const originalHTML=fs.readFileSync(path.join(source,'web/index.html'),'utf8');
for(const item of original.files) assert.equal(sha(fs.readFileSync(path.join(source,item.path))),item.sha256,item.path);
const binaryen=(await import(pathToFileURL(path.resolve(toolingArg,'index.js')).href)).default;
assert.equal(JSON.parse(fs.readFileSync(path.resolve(toolingArg,'package.json'))).version,'132.0.0');
const wasmStart=originalHTML.indexOf('function findWasmBinary(){');
const wasmEnd=originalHTML.indexOf('function getBinarySync(',wasmStart);
assert(wasmStart>0&&wasmEnd>wasmStart);
const binaryDecode='function binaryDecode(A){for(var v,r=0,j=A.length,t=new Uint8Array(j);r<j;++r)v=A.charCodeAt(r),t[r]=~v>>8&v;return t}';
const wasm=vm.runInNewContext(binaryDecode+originalHTML.slice(wasmStart,wasmEnd)+';findWasmBinary()');
assert(WebAssembly.validate(wasm));
const imports=WebAssembly.Module.imports(new WebAssembly.Module(wasm));
const suspending=imports.filter(x=>x.name==='fd_read'||x.name.startsWith('invoke_')).map(x=>x.module+'.'+x.name);
const module=binaryen.readBinary(wasm);
module.setFeatures(module.getFeatures() | binaryen.Features.BulkMemory | binaryen.Features.BulkMemoryOpt | binaryen.Features.NontrappingFPToInt | binaryen.Features.SignExt | binaryen.Features.MutableGlobals);
binaryen.setPassArgument('asyncify-imports',suspending.join(','));
module.runPasses(['asyncify']);
assert(module.validate(),'变换后的引擎校验失败');
const transformed=module.emitBinary();module.dispose();
assert(WebAssembly.validate(transformed));
const archive=fs.readFileSync(path.join(source,'web/assets.arc'));
assert.equal(sha(archive),original.core.sha256);
const chunkSize=262144,chunks=[];
for(let start=0;start<archive.length;start+=chunkSize){
 const bytes=archive.subarray(start,Math.min(start+chunkSize,archive.length));
 chunks.push({path:'chunks/'+String(chunks.length).padStart(4,'0')+'.bin',bytes:bytes.length,sha256:sha(bytes)});
}
const trace=JSON.parse(fs.readFileSync(path.resolve(root,traceArg)));
const bootIds=trace.titleChunks;
assert(bootIds.length>0&&bootIds.length<chunks.length/4);
const boot=Buffer.concat(bootIds.map(id=>archive.subarray(id*chunkSize,Math.min((id+1)*chunkSize,archive.length))));
const loader=fs.readFileSync(path.join(root,'tools/deploy/aliyun/demand-loader.js'));
const bridge=fs.readFileSync(path.join(root,'tools/deploy/aliyun/demand-async.js'));
const config={bytes:archive.length,sha256:sha(archive),chunkSize,chunks,
 bootstrap:{path:'bootstrap.bin',bytes:boot.length,sha256:sha(boot),chunks:bootIds},
 engine:{path:'engine-demand.wasm',bytes:transformed.length,sha256:sha(transformed)}};
const distributionId=sha(Buffer.from(JSON.stringify({source:original.distributionId,config,loader:sha(loader),bridge:sha(bridge),builder:sha(fs.readFileSync(import.meta.filename))}))).slice(0,16);
const assetBasePath='/r/'+distributionId+'/';
fs.mkdirSync(path.join(out,'web/chunks'),{recursive:true});
for(const item of original.files){
 if(['web/index.html','web/assets.arc','web/core-loader.js'].includes(item.path)) continue;
 const target=path.join(out,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,item.path),target);
}
for(let i=0;i<chunks.length;i++)fs.writeFileSync(path.join(out,'web',chunks[i].path),archive.subarray(i*chunkSize,Math.min((i+1)*chunkSize,archive.length)));
fs.writeFileSync(path.join(out,'web/bootstrap.bin'),boot);
fs.writeFileSync(path.join(out,'web/engine-demand.wasm'),transformed);
fs.writeFileSync(path.join(out,'web/demand-loader.js'),loader);
fs.writeFileSync(path.join(out,'web/demand-async.js'),bridge);
let html=originalHTML.slice(0,wasmStart)+'function findWasmBinary(){return new URL("engine-demand.wasm",document.baseURI).href}'+originalHTML.slice(wasmEnd);
function once(from,to){assert.equal(html.split(from).length,2,'锚点不唯一：'+from.slice(0,100));html=html.replace(from,to);}
once('<base href="'+original.assetBasePath+'">','<base href="'+assetBasePath+'">');
once('<script src="core-loader.js"></script>','<script src="demand-async.js"></script><script src="demand-loader.js"></script><script>window.suiDemandConfig='+JSON.stringify(config)+'</script>');
const start=html.indexOf('Module.preRun=function(){'),end=html.indexOf(';',html.indexOf('abort(error)})}',start))+1;
assert(start>0&&end>start&&html.slice(start,end).endsWith('abort(error)})};'));
html=html.slice(0,start)+'Module.preRun=function(){const dependency="suika3-bootstrap";addRunDependency(dependency);suiDemand.install(FS,suiDemandConfig).then(()=>removeRunDependency(dependency)).catch(error=>{suiDemand.fail(error);abort(error)})};'+html.slice(end);
once('async function getWasmBinary(A){return getBinarySync(A)}','async function getWasmBinary(A){return suiDemand.fetchVerified("engine-demand.wasm",suiDemandConfig.engine)}');
once('assignWasmExports(wasmExports=A.exports)','assignWasmExports(wasmExports=suiDemandAsync.install(A.exports))');
once('wasmTableMirror[A]=v=wasmTable.get(A)','wasmTableMirror[A]=v=suiDemandAsync.wrap(wasmTable.get(A))');
once('fd_read:_fd_read','fd_read:suiDemandAsync.importRead(_fd_read,()=>({FS,HEAPU32}))');
once('getWasmTableEntry(A)(j,v)&&requestAnimationFrame(r)','suiDemandAsync.frame(getWasmTableEntry(A),[j,v],r)');
once('var v=A(0,0);return exitJS(v,!0),v','var v=A(0,0);if(v&&typeof v.then==="function"){v.then(x=>exitJS(x,true)).catch(handleException);return 0}return exitJS(v,!0),v');
fs.writeFileSync(path.join(out,'web/index.html'),html);
const files=[],compressedFiles=[];
function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())visit(file);else{const bytes=fs.readFileSync(file);files.push({path:path.relative(out,file),bytes:bytes.length,sha256:sha(bytes)});}}}
visit(path.join(out,'web'));
for(const item of files){if(!/\.(html|js|css|wasm)$/.test(item.path))continue;const gz=zlib.gzipSync(fs.readFileSync(path.join(out,item.path)),{level:6});fs.writeFileSync(path.join(out,item.path+'.gz'),gz);compressedFiles.push({path:item.path+'.gz',bytes:gz.length,sha256:sha(gz)});}
const manifest={status:'candidate',distributionId,assetBasePath,sourceDistribution:original.distributionId,runtimeBuildId:original.runtimeBuildId,contentBuildId:original.contentBuildId,databasePrefix:original.databasePrefix,
 sourceEngineSHA256:sha(wasm),engine:config.engine,engineTransform:{binaryen:'132.0.0',pass:'asyncify',imports:suspending,scope:'仅将资源读取变为可等待；正文、存档标识及归档字节保持'},
 core:original.core,demand:config,files,compressedFiles,totalWebBytes:files.reduce((n,x)=>n+x.bytes,0)};
fs.writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({distributionId,archiveBytes:archive.length,bootstrapBytes:boot.length,originalEngineBytes:wasm.length,engineBytes:transformed.length,files:files.length}));
