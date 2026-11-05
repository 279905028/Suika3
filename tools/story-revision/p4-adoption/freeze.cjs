#!/usr/bin/env node
'use strict';
const C=require('./common.cjs');
const {fs,path,ROOT,DOC,QA,VERSION,assert,json,fp,write,walk,digest}=C;
const {validate,checkFile}=require('./validate.cjs');
function freeze(){
  const target=DOC+'/freeze.json';assert(!fs.existsSync(path.join(ROOT,target)),'采用冻结不可覆盖');
  const a=validate({adopted:true}),check=json(QA+'/verification-adopted.json');assert.equal(check.status,'pass');assert.equal(check.contentBuildId,a.ctx.input.contentBuildId);
  const files=new Set(['main.ray','start.novel','config.ini','assets/current/manifest.json','docs/整合/bindings.json','docs/CG当前选择.json','docs/CG制作当前状态.json','docs/CG扩充当前状态.json']);
  for(const dir of ['scenario','docs/人物','docs/分支','tools/compiler','tools/runtime','tools/integration/runtime','tools/story-revision/p4-integration','tools/story-revision/p4-adoption','system/sui-u','system/sui-cinema',DOC])for(const p of walk(dir))files.add(p);
  for(const art of a.catalog.assets)for(const row of [art.source,art.runtime,art.approvalEvidence,art.checkEvidence])files.add(row.path);
  for(const cg of a.catalog.cg)files.add(cg.registrationEvidence.path);
  for(const p of require('../../runtime/cinema-theme.cjs').load(ROOT).inputFiles)files.add(p);
  const title=require('../../runtime/title-cover.cjs').load(ROOT);if(title)for(const p of title.inputFiles)files.add(p);
  for(const p of ['SDK/wasm/index.html','SDK/macos/suika3-pack','system/font/NotoSansCJK-Medium.ttc'])files.add(p);
  const record={schemaVersion:'p4-adoption-freeze-v1',task:'P4-07',date:'2026-11-04',version:VERSION,contentBuildId:a.ctx.input.contentBuildId,inputFingerprint:a.ctx.input.inputFingerprint,adoptionReady:true,counts:{paragraphs:4748,displayNodes:4814,assets:262,cg:81,choices:65,options:134},files:[...files].sort().map(fp),P5:'pending',dynamicCG:'not-integrated',release:'not-executed'};
  record.fingerprint=digest(record);write(target,record);record.files.forEach(checkFile);console.log(JSON.stringify({status:'frozen',files:record.files.length,fingerprint:record.fingerprint}));return record;
}
function verifyFreeze(){const record=json(DOC+'/freeze.json'),{fingerprint,...body}=record;assert.equal(digest(body),fingerprint);record.files.forEach(checkFile);return record;}
if(require.main===module){if(process.argv.includes('--check')){const r=verifyFreeze();console.log(JSON.stringify({status:'pass',files:r.files.length,fingerprint:r.fingerprint}));}else freeze();}
module.exports={freeze,verifyFreeze};
