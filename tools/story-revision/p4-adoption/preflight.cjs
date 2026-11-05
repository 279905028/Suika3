#!/usr/bin/env node
'use strict';
const C=require('./common.cjs');
const {assert,fs,path,ROOT,BASE,DOC,QA,read,json,fp,write,walk}=C;
const V=require('../p4-bindings/validate.cjs');
assert(!fs.existsSync(path.join(ROOT,QA+'/preflight.json')),'不覆盖开工证据');
const ctx=V.loadContext();
const a=require('../p4-integration/assemble.cjs').assemble({ctx});
const mutable=[...walk('scenario'),...walk('docs/人物'),...walk('docs/分支'),'assets/current/manifest.json','docs/整合/bindings.json','docs/CG当前选择.json','docs/CG制作当前状态.json','docs/CG扩充当前状态.json','system/sui-u/gallery.registry.json','system/sui-u/gallery-order.ray','system/sui-cinema/manifest.json','TODO-v1.1.md','README.md','docs/P4演出与美术子任务.md','docs/开发计划.md','docs/对白化与结尾过渡修订计划-20261102.md','tools/compiler/README.md','tools/runtime/README.md','dist/README.md'];
for(const p of mutable)if(fs.existsSync(path.join(ROOT,p)))write(QA+'/before/'+p,read(p));
const paths=new Set([...ctx.input.files,...ctx.seal.files,...a.manifest.inputs].map(f=>f.path));
for(const d of ['tools/story-revision/p4-bindings','tools/story-revision/p4-integration',BASE,'docs/修订协作/P3-独立审读-20261103'])for(const p of walk(d))if(!p.startsWith(DOC+'/'))paths.add(p);
const files=[...paths].sort().map(fp);
write(QA+'/preflight.json',{task:'P4-07',date:'2026-11-04',status:'passed',parentInput:ctx.input.inputFingerprint,parentInterface:ctx.seal.interfaceFingerprint,parentBuild:ctx.input.contentBuildId,files,mutable,counts:a.manifest.counts,pending:a.manifest.pending});
write(QA+'/parent-context.json',{input:ctx.input,seal:ctx.seal,nodes:ctx.nodes,paragraphs:ctx.paragraphs,packages:ctx.packages,boundaries:ctx.boundaries,baseline:ctx.baseline,retiredCG:[...ctx.retiredCG]});
console.log(JSON.stringify({status:'pass',files:files.length,pending:a.manifest.pending.length,counts:a.manifest.counts}));
