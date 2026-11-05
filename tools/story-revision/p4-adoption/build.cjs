#!/usr/bin/env node
'use strict';
const C=require('./common.cjs');
const {fs,path,ROOT,DOC,QA,assert,read,json,write,walk,fp,digest}=C;
const {validate,checkFile}=require('./validate.cjs');
const {compile}=require('../../compiler/compile.cjs');
const {build:runtimeBuild}=require('../../runtime/build.cjs');
const {integrate}=require('../p4-integration/presentation.cjs');
function build({out,adopted=true,runtimePatch}={}){
  assert(typeof out==='string'&&/^qa\/dialogue-p[45]-[^/]+\/.+/.test(out)&&!out.split('/').includes('..'),'须指定本工程新的P4/P5 QA目录');assert(!fs.existsSync(path.join(ROOT,out)),'不覆盖已有包');
  assert(!runtimePatch||adopted,'运行补丁必须基于已采用正文');
  const runtimeRevision=runtimePatch?require('./runtime-patch.cjs').verifyRuntimePatch(runtimePatch):null;
  if(adopted&&!runtimePatch)require('./freeze.cjs').verifyFreeze();
  const a=validate({adopted}),source=out+'/input';
  const paths=new Set(['main.ray','start.novel','config.ini','scenario/routes.json','SDK/wasm/index.html','SDK/macos/suika3-pack','sound/se/click.ogg']);
  if(runtimePatch)paths.add(runtimePatch);
  for(const d of ['system/sui-u','system/sui-cinema','system/font','tools/compiler','tools/runtime','tools/integration/runtime','tools/story-revision/p4-integration','tools/story-revision/p4-adoption'])for(const p of walk(d))paths.add(p);
  for(const p of require('../../runtime/cinema-theme.cjs').load(ROOT).inputFiles)paths.add(p);
  const title=require('../../runtime/title-cover.cjs').load(ROOT);if(title)for(const p of title.inputFiles)paths.add(p);
  for(const line of read('config.ini').toString().split('\n'))if(/^[a-z][^=]*=/.test(line)){const v=line.slice(line.indexOf('=')+1).trim();if(/\.(png|webp|anime|ogg|ttc|ttf)$/.test(v))paths.add(v);}
  for(const asset of a.assets)paths.add(asset.runtimePath);
  for(const file of Object.keys(a.ctx.ir.entries))paths.add(adopted?'scenario/'+file:DOC+'/正文/'+file);
  const files=[...paths].sort().map(fp);files.forEach(f=>write(source+'/'+f.path,read(f.path)));
  if(!adopted)for(const file of Object.keys(a.ctx.ir.entries))write(source+'/scenario/'+file,read(DOC+'/正文/'+file));
  const generated=compile({root:path.join(ROOT,source),pageSize:108,textPolicy:'required'});assert.equal(generated.ir.buildId,a.ctx.input.contentBuildId);
  const choice=require('../p4-integration/choices.cjs').compareChoices(generated.ir);write(out+'/choice-comparison.json',choice);
  const cinema=json('system/sui-cinema/manifest.json');write(source+'/system/sui-cinema/manifest.json',{...cinema,contentBuildId:generated.ir.buildId});
  write(source+'/system/sui-u/gallery.registry.json',a.gallery);write(source+'/system/sui-u/gallery-order.ray','var suiCGOrder = '+JSON.stringify(a.gallery.items.map(i=>i.id))+';\n');
  const inputFingerprint=digest({files,bindings:a.bindings,gallery:a.gallery});
  const runtime=runtimeBuild({out:path.join(ROOT,out,'runtime'),projectRoot:path.join(ROOT,source),compiled:generated,databasePrefix:'bijie-p4-07-isolated:',integration:{diagnostic:false,assets:a.assets,bindings:a.bindings,fingerprint:inputFingerprint,adapt:args=>integrate({...args,assets:a.assets,bindings:a.bindings,gallery:a.gallery,mode:'candidate'})}});
  const functions=(read(out+'/runtime/stage/main.ray').toString().match(/^func /gm)||[]).length;assert(functions<1024,'当前SDK函数容量超限');
  files.forEach(checkFile);
  const result={task:'P4-07',adopted,adoptionReady:true,contentBuildId:generated.ir.buildId,runtimeBuildId:runtime.runtimeBuildId,inputFingerprint,databasePrefix:runtime.databasePrefix,functionCount:functions,counts:{assets:a.assets.length,bindings:a.bindings.length,cg:a.gallery.items.length,choices:choice.choices,options:choice.options},inputs:files,entry:out+'/runtime/web',verification:{packaging:'passed',P5:'pending',native:'not-tested',mobile:'not-tested',release:'not-executed'}};
  if(runtimeRevision){require('./runtime-patch.cjs').verifyRuntimePatch(runtimePatch);result.runtimeRevision=runtimeRevision;}
  write(out+'/build-result.json',result);write(out+'/bindings.json',{contentBuildId:generated.ir.buildId,bindings:a.bindings});write(out+'/gallery.registry.json',a.gallery);write(out+'/runtime-assets.json',a.assets);
  console.log(JSON.stringify({status:'built',out,functions,buildId:result.contentBuildId,runtimeBuildId:result.runtimeBuildId}));return result;
}
if(require.main===module){const args=process.argv.slice(2),options={};while(args.length){const flag=args.shift();if(flag==='--out')options.out=args.shift();else if(flag==='--candidate')options.adopted=false;else if(flag==='--runtime-patch')options.runtimePatch=args.shift();else throw Error('未知参数：'+flag);}build(options);}
module.exports={build};
