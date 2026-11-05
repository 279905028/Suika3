#!/usr/bin/env node
'use strict';
const C=require('./common.cjs');
const {fs,path,assert,ROOT,QA,BASE,fp,read,json,write,walk,hash,digest,freshOutput,protect,unchanged}=C;
const {assemble,emitCandidate}=require('./assemble.cjs');
const {compareChoices}=require('./choices.cjs');
const {compile}=require('../../compiler/compile.cjs');
const {integrate}=require('./presentation.cjs');
const {build:runtimeBuild}=require('../../runtime/build.cjs');
function build({out,mode='draft',catalogPath,packagesRoot}={}) {
  assert(out,'须显式指定新的--out');
  const protectedFiles=protect(),a=assemble({mode,catalogPath,packagesRoot}),dir=freshOutput(out),source=path.join(dir,'input');
  write(dir,'protected-inputs.json',protectedFiles);emitCandidate(dir,a);
  const paths=new Set(['main.ray','start.novel','config.ini','SDK/wasm/index.html','SDK/macos/suika3-pack','sound/se/click.ogg']);
  for(const d of ['system/sui-u','system/sui-cinema','system/font','tools/compiler','tools/runtime'])for(const p of walk(d)) paths.add(p);
  for(const rel of ['system/sui-cinema/manifest.json','assets/sources/20261030-cinema-ui/choice-layout.json'])paths.add(rel);
  const cinema=json('system/sui-cinema/manifest.json');for(const p of require('../../runtime/cinema-theme.cjs').load(ROOT).inputFiles)paths.add(p);
  const title=require('../../runtime/title-cover.cjs').load(ROOT);if(title)for(const p of title.inputFiles)paths.add(p);
  for(const line of read('config.ini').toString().split('\n'))if(/^[a-z][^=]*=/.test(line)){const v=line.slice(line.indexOf('=')+1).trim();if(/\.(png|webp|anime|ogg|ttc|ttf)$/.test(v))paths.add(v);}
  for(const asset of a.assets)paths.add(asset.runtimePath);
  const inputFiles=[...paths].sort().map(fp);
  for(const r of inputFiles)write(source,r.path,read(r.path));
  write(source,'scenario/routes.json',read('scenario/routes.json'));
  for(const [file,candidate] of new Map(a.ctx.nodes.map(n=>[n.source.file,n.source.candidateFile])))write(source,file,read(candidate));
  const generated=compile({root:source,pageSize:108,textPolicy:'required'});assert.equal(generated.ir.buildId,a.manifest.contentBuildId,'编译版本漂移');
  const choices=compareChoices(generated.ir);write(dir,'choice-comparison.json',choices);
  // Only this isolated input manifest changes identity after exact string/texture comparison.
  write(source,'system/sui-cinema/manifest.json',{...cinema,contentBuildId:generated.ir.buildId});
  write(source,'system/sui-u/gallery.registry.json',a.gallery);
  write(source,'system/sui-u/gallery-order.ray','var suiCGOrder = '+JSON.stringify(a.gallery.items.map(i=>i.id))+';\n');
  const runtime=runtimeBuild({out:path.join(dir,'runtime'),projectRoot:source,compiled:generated,databasePrefix:'bijie-p4-06-isolated:',integration:{diagnostic:true,assets:a.assets,bindings:a.bindings,fingerprint:digest({bindings:a.bindings,gallery:a.gallery,tools:walk('tools/story-revision/p4-integration').map(fp)}),adapt:args=>integrate({...args,assets:a.assets,bindings:a.bindings,gallery:a.gallery,mode:'diagnostic'})}});
  const functionCount=(fs.readFileSync(path.join(dir,'runtime/stage/main.ray'),'utf8').match(/^func /gm)||[]).length;
  assert(functionCount<1024,'生成函数触及当前SDK上限，须继续压缩登记，不能交付不可启动包');
  unchanged(protectedFiles);unchanged(a.manifest.inputs);
  const result={task:'P4-06',scope:'独立技术候选；未将P4演出或新增CG计划作为正式采用',mode,adoptionReady:a.manifest.adoptionReady,counts:a.manifest.counts,pending:a.manifest.pending,contentBuildId:generated.ir.buildId,runtimeBuildId:runtime.runtimeBuildId,databasePrefix:runtime.databasePrefix,inputs:inputFiles,choices:{count:choices.choices,options:choices.options,regenerated:choices.regenerated},protectedFiles:protectedFiles.length,entry:path.relative(ROOT,path.join(dir,'runtime/web'))};
  result.functionCount=functionCount;
  write(dir,'build-result.json',result);console.log(JSON.stringify({status:'built',out,counts:result.counts,choices:result.choices,adoptionReady:result.adoptionReady,functionCount}));return {dir,source,generated,...a,result};
}
if(require.main===module){try{const args=process.argv.slice(2),o={};while(args.length){const f=args.shift();const key={'--out':'out','--mode':'mode','--resources':'catalogPath','--packages':'packagesRoot'}[f];assert(key,'未知参数：'+f);assert(args.length,'缺参数');o[key]=args.shift();}build(o);}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={build};
