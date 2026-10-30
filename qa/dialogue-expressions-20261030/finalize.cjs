'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=__dirname,root=path.resolve(dir,'../..'),version='sui-i02-20261030-v9';
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const main=read(version+'/routes/routes-report.json'),extra=read(version+'/routes-hq-branches/routes-report.json');
assert.equal(main.results.length,16);assert.equal(extra.results.length,2);
// 主套件的截图目标选了HQ的BA含泪拍，但原16路径只含HQ的AA/AB。
// 保留其原始缺覆盖失败；这里只在补查实际抵达并截图后汇总放行。
assert(main.status==='pass'||(main.status==='fail'&&main.error.includes('未覆盖表情截图')),'存在未处理的主套件失败');
assert(extra.status==='pass'||(extra.status==='fail'&&extra.error.includes('未覆盖指定最大正文截图')),'存在未处理的补查失败');
const results=[...main.results,...extra.results];
assert.equal(new Set(results.map(r=>r.name)).size,18);
for(const r of results){assert.equal(r.status,'pass',r.name);assert.deepEqual(r.errors,[]);assert(r.allNarrativeBindingsMatched&&r.allNarrativeCursorsMatched&&r.everyChoiceCheckpointed);}
assert.deepEqual(main.errors,[]);assert.deepEqual(extra.errors,[]);
// HQ补查不经过全套最长段落所在的另一分支；该非表情目标由主套件覆盖。
for(const node of ['TEXT_8a73ff522c7a4d852668_1','TEXT_509cd7d4331f7a2a971a_1']){
 assert(main.screenshots.some(s=>s.includes(node))||extra.screenshots.some(s=>s.includes(node)),'合并后仍缺最长正文截图');
}
const expressionShots=[];
for(const assetId of Object.keys(main.expressionTargets)){
 let found;
 for(const [report,folder]of [[main,'routes'],[extra,'routes-hq-branches']]){
  const node=report.expressionTargets[assetId];if(!node)continue;
  const shot=report.screenshots.find(s=>s.includes(node)&&!s.includes('failure'));
  if(shot){const rel=version+'/'+folder+'/screenshots/'+shot,full=path.join(dir,rel);assert(fs.existsSync(full));found={assetId,nodeId:node,screenshot:rel,sha256:hash(full)};break;}
 }
 assert(found,'缺实际表情截图 '+assetId);expressionShots.push(found);
}
assert.equal(expressionShots.length,28);
const cg=[...new Set(results.flatMap(r=>r.actualCG))].sort();assert.equal(cg.length,60);
const presentation=read(version+'/presentation/report.json');assert.equal(presentation.status,'pass');assert.equal(presentation.checks.length,16);
assert.equal(read('visual-review.json').status,'PASS_REPRESENTATIVE_SCREENSHOTS');
assert.equal(read('preview-check.json').status,'pass');assert.equal(read('preview-check.json').version,version);
const offline=read('binding-check.json');assert.equal(offline.status,'PASS_OFFLINE_BINDINGS_AND_GENERATED_STATE_MODEL');
const build=JSON.parse(fs.readFileSync(path.join(root,'build',version,'candidate-manifest.json')));
assert.equal(main.runtimeBuildId,build.runtimeBuildIds.web);assert.equal(extra.runtimeBuildId,main.runtimeBuildId);assert.equal(presentation.runtimeBuildId,main.runtimeBuildId);
for(const report of [main,extra])for(const [file,sha]of Object.entries(report.webHashes))assert.equal(hash(path.join(root,'dist',version,'web',file)),sha);
const result={status:'PASS_SCOPED_LOCAL_CHROME',version,runtimeBuildId:main.runtimeBuildId,summary:read('binding-changes.json').summary,
 routes:results.map(r=>({name:r.name,status:r.status,pages:r.narrativePages,choices:r.nativeChoiceClicks})),
 totalNarrativePages:results.reduce((s,r)=>s+r.narrativePages,0),totalChoiceClicks:results.reduce((s,r)=>s+r.nativeChoiceClicks,0),cg,expressionShots,presentationChecks:presentation.checks.length,errors:[],
 resolvedTestCoverageGap:'主套件16路径全部通过，但其截图目标选中未在16路径内的HQ-BA含泪首拍；补查BA/BB已抵达并截图。补查继承的全套最长段落目标又属于其他分支，由主套件提供实际截图。本汇总重新检查28表情、两个最长段落及同包指纹，全部要求均须有真实证据；两份原始缺覆盖报告均保留。',
 limitations:['只审阅表情相关正文，没有重审全部文案','图片字节沿用已批准资源，不是新美术制作','自动覆盖不代替逐帧人工美术终审','未新增Firefox/Safari、手机真机、电脑原生、长期压力或发布验收'],
 evidence:['binding-check.json',version+'/presentation/report.json',version+'/routes/routes-report.json',version+'/routes-hq-branches/routes-report.json','package-check.json','visual-review.json','preview-check.json'].map(p=>({path:p,sha256:hash(path.join(dir,p))}))};
fs.writeFileSync(path.join(dir,'final-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,routes:result.routes.length,pages:result.totalNarrativePages,choices:result.totalChoiceClicks,cg:cg.length,expressionShots:expressionShots.length,presentationChecks:result.presentationChecks}));
