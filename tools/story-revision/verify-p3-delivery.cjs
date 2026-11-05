#!/usr/bin/env node
'use strict';
// P3交付只读核对：不改正文、不生成正式包、不启动引擎。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../compiler/compile.cjs');
const {hash}=require('../compiler/parse.cjs');
const ROOT=path.resolve(__dirname,'../..'),QA=path.join(ROOT,'qa/dialogue-p3-review-20261103');
const P2=path.join(ROOT,'docs/修订协作/P2-全稿修订-20261103/正文');
const P3=path.join(ROOT,'docs/修订协作/P3-独立审读-20261103');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8')),read=p=>fs.readFileSync(p,'utf8');
const manifest=json(path.join(QA,'input-manifest.json'));
const stat=json(path.join(QA,'static-verification.json')),editorial=json(path.join(QA,'editorial-verification.json'));
const sourceMap=json(path.join(QA,'source-map.json')),ending=json(path.join(QA,'ending-review.json')),register=json(path.join(QA,'review-register.json'));
assert.equal(manifest.status,'frozen');assert.equal(manifest.files.length,12);assert.equal(manifest.totalParagraphs,4748);assert.equal(manifest.changedParagraphs,3);assert.equal(manifest.unchangedParagraphs,4745);assert.equal(manifest.changedFiles,3);
const p2Review=json(path.join(ROOT,'qa/dialogue-p2-closeout-20261103/editorial-review.json'));
for(const file of manifest.files){
 const name=path.basename(file.file),candidate=fs.readFileSync(path.join(P3,'正文',name)),reading=fs.readFileSync(path.join(ROOT,file.readingFile));
 assert.equal(hash(candidate),file.p3Sha256,'冻结正文变化：'+name);assert.equal(hash(reading),file.readingSha256,'审读副本变化：'+name);assert.equal(hash(fs.readFileSync(path.join(QA,'input/scenario',name))),file.p3Sha256,'验证输入变化：'+name);
 assert.equal(hash(fs.readFileSync(path.join(P2,name))),file.p2Sha256,'P2输入被改写：'+name);
 const p2row=p2Review.reviewedFiles.find(row=>path.basename(row.candidateFile)===name);assert(p2row);assert.equal(file.p2Sha256,p2row.sha256,'P2历史身份不一致：'+name);
}
const generated=compile({root:path.join(QA,'input'),textPolicy:'required',pageSize:108}),buildId=generated.ir.buildId;
assert.equal(buildId,manifest.contentBuildId);assert.equal(buildId,stat.contentBuildId);assert.equal(buildId,editorial.contentBuildId);assert.equal(buildId,sourceMap.candidateBuildId);assert.equal(buildId,ending.contentBuildId);assert.equal(buildId,register.contentBuildId);assert.equal(generated.manifest.runtimeReady,false);
assert.equal(stat.status,'pass');assert.equal(stat.checks.length,30);assert.equal(stat.negativeCases,21);assert.equal(stat.warnings.length,0);assert.equal(stat.commonAssignments,32768);assert.equal(stat.routeAssignments,2818);assert.equal(stat.dispatchConfigurations,24);assert.equal(stat.protectedSourceFiles,1032);
assert.equal(editorial.status,'pass');assert.equal(editorial.checks.length,12);assert.equal(editorial.keyCombinationCases.length,46);assert.equal(editorial.distinctEndings,14);assert.equal(editorial.endingAnchorsChecked,172);
const documents=[
 'docs/修订协作/P3-独立审读-20261103/P3-独立审读报告.md',
 'docs/修订协作/P3-独立审读-20261103/P3-候选冻结与验收交接.md',
 'TODO-v1.1.md'
];
let localLinksChecked=0;
for(const file of documents){
 const absolute=path.join(ROOT,file),text=read(absolute);assert(text.includes(buildId),'文档未登记P3构建ID：'+file);
 for(const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
  const target=match[1].split('#')[0];if(!target||/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(target))continue;
  const resolved=path.resolve(path.dirname(absolute),decodeURIComponent(target));assert(resolved.startsWith(ROOT+path.sep),'交付链接越出项目：'+target);
  // 本报告由本脚本在检查成功后生成，允许交接预先链接这一确定产物。
  if(resolved!==path.join(QA,'delivery-verification.json'))assert(fs.existsSync(resolved),'失效链接：'+file+'／'+target);localLinksChecked++;
 }
}
assert(read(path.join(ROOT,'TODO-v1.1.md')).includes('- [x] P3：'),'待办未登记P3完成');
const report={
 status:'pass',phase:'P3-independent-review-frozen',contentBuildId:buildId,p2ContentBuildId:manifest.p2ContentBuildId,
 candidateFiles:12,readingFiles:12,readingParagraphs:4748,changedFiles:3,changedParagraphs:3,unchangedParagraphs:4745,
 staticChecks:30,editorialChecks:12,negativeCases:21,commonAssignments:32768,routeAssignments:2818,dispatchConfigurations:24,keyCombinations:46,endings:14,endingAnchorsChecked:172,protectedFormalFiles:1032,warnings:0,localLinksChecked,
 documents:documents.map(file=>({file,sha256:hash(fs.readFileSync(path.join(ROOT,file)))})),
 formalAdoption:false,p4:'pending',p5:'pending',
 scope:'仅P3正文候选、纯阅读副本、指纹、文档链接、文本结构与分支规则；不是演出、引擎、浏览器、真机或发布验收',
 notPerformed:['P4逐段演出重绑及资源目视','正式scenario采用','引擎与存档整合验收','浏览器试玩','手机真机与电脑原生验收','发布']
};
fs.writeFileSync(path.join(QA,'delivery-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,contentBuildId:buildId,candidateFiles:12,readingFiles:12,readingParagraphs:4748,changedParagraphs:3,localLinksChecked,formalAdoption:false},null,2));
