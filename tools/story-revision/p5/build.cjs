#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./adopt-motion.cjs'),{ROOT,QA,json,put,fp,hash}=C;
const {compile}=require('../../compiler/compile.cjs');
const {integrate}=require('../p4-integration/presentation.cjs');
function walk(dir){return fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
function build(out,platform='web'){
 assert(['web','native'].includes(platform));
 assert(out?.startsWith(QA+'/build-')&&!out.includes('..'),'指定新的本批构建目录');assert(!fs.existsSync(path.join(ROOT,out)),'不覆盖旧构建');
 const M=json('assets/current/manifest.json'),B=json('docs/整合/bindings.json'),G=json('system/sui-u/gallery.registry.json'),MM=json('assets/current/motion/manifest.json'),MB=json('docs/整合/motion-bindings.json');
 assert.deepEqual(M,json(QA+'/before/static-manifest.json'),'静态资源不得被本批改写');assert.deepEqual(B,json(QA+'/before/static-bindings.json'),'静态绑定不得被本批改写');
 assert.equal(M.assets.length,268);assert.equal(B.bindings.length,4814);assert.equal(G.items.length,81);assert.equal(MM.items.length,29);assert.equal(MB.bindings.length,29);
 const generated=compile({pageSize:108,textPolicy:'required'});assert.equal(generated.ir.buildId,B.contentBuildId);assert.equal(MM.contentBuildId,B.contentBuildId);assert.equal(MB.contentBuildId,B.contentBuildId);assert.deepEqual(B.sourceHashes,generated.manifest.sourceHashes);
 const parent=json('qa/background-fill-20261104/build/build-result.json'),paths=new Set(parent.inputs.map(x=>x.path));
 for(const dir of ['tools/runtime','tools/story-revision/p5','assets/current/motion'])for(const p of walk(dir))paths.add(p);
 for(const p of ['assets/current/manifest.json','docs/整合/bindings.json','docs/整合/motion-bindings.json','tools/story-revision/ending-motion/controller.js','tools/story-revision/ending-motion/controller.css'])paths.add(p);
 const inputs=[...paths].sort().map(fp),src=out+'/input';
 for(const input of inputs){const target=path.join(ROOT,src,input.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(ROOT,input.path),target);}
 const frozen=compile({root:path.join(ROOT,src),pageSize:108,textPolicy:'required'});assert.equal(frozen.ir.buildId,generated.ir.buildId);
 const fingerprint=hash(JSON.stringify(inputs));
 const r=require('../../runtime/build.cjs').build({out:path.join(ROOT,out,'runtime'),projectRoot:path.join(ROOT,src),compiled:frozen,databasePrefix:'bijie-p5-motion-20261104:',motionPlatform:platform,integration:{diagnostic:false,assets:M.assets,bindings:B.bindings,fingerprint,adapt:args=>integrate({...args,assets:M.assets,bindings:B.bindings,gallery:G,mode:'candidate',sdkPlatform:platform==='native'?'desktop':'wasm'})}});
 for(const p of inputs)assert.equal(fp(p.path).sha256,p.sha256,'构建期间输入改变：'+p.path);
 const functionCount=(fs.readFileSync(path.join(ROOT,out,'runtime/stage/main.ray'),'utf8').match(/^func /gm)||[]).length;assert(functionCount<1024,'Suika函数容量超限');
 const result={date:'2026-11-04',version:MM.version,platform,contentBuildId:generated.ir.buildId,runtimeBuildId:r.runtimeBuildId,inputFingerprint:fingerprint,databasePrefix:r.databasePrefix,functionCount,counts:{assets:268,staticBindings:4814,staticCG:81,motionCG:platform==='web'?29:0,staticFallbackOnly:platform==='web'?1:30},inputs,entry:out+'/runtime/web',verification:{packaging:'pass',browser:'pending',native:'static-fallback-pending',mobile:'not-tested',release:'not-executed'}};
 put(out+'/build-result.json',result);put(out+'/bindings.json',B);put(out+'/runtime-assets.json',M.assets);put(out+'/gallery.registry.json',G);put(out+'/motion-manifest.json',MM);put(out+'/motion-bindings.json',MB);
 console.log(JSON.stringify({entry:result.entry,runtimeBuildId:r.runtimeBuildId,functionCount}));return result;
}
if(require.main===module)build(process.argv[2],process.argv[3]||'web');
module.exports={build};
