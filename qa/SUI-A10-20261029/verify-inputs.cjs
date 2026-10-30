'use strict';
// 仅核对当前正文、A09记录和本批等待队列；不写正式生成物或修改上游。
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const {parse} = require(path.join(root, 'tools/compiler/parse.cjs'));
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const review = read('qa/SUI-A09-selection-20261029/review-approved.json');
const queue = read('qa/SUI-A10-20261029/shot-queue.json');
const selection = read('docs/CG当前选择.json');
const R = read('scenario/routes.json');
const sources = Object.fromEntries(fs.readdirSync(path.join(root, 'scenario')).filter(x=>x.endsWith('.md')).map(x=>[x,fs.readFileSync(path.join(root,'scenario',x),'utf8')]));
const checks = [], add = (name, pass, detail) => checks.push({name,pass,...(detail?{detail}:{})});
add('60镜唯一且与当前正式选集一致', queue.shots.length===60 && new Set(queue.shots.map(s=>s.id)).size===60 && JSON.stringify(queue.shots.map(s=>s.id).sort())===JSON.stringify([...selection.activeSelectedIds].sort()));
add('未复活8个取消编号',queue.shots.every(s=>!selection.retiredRouteIds.includes(s.id)));
add('遵守等全部上游定稿的全体开工条件', queue.productionGate.mode==='wait-for-all-upstream' && queue.productionGate.allowPartialShotProduction===false && queue.shots.every(s=>!s.productionReady && s.generatedCount===0 && s.originalFiles.length===0));
const decisions=read('qa/SUI-A10-20261029/decisions.json');
add('三处衣装确认均落入对应镜头',decisions.wardrobe.choices.every(c=>queue.shots.find(s=>s.id===c.shot)?.confirmedWardrobeOverride?.choice===c.choice));
add('A09输入未漂移',hash(queue.source)===queue.sourceSha256);
for(const ref of Object.values(review.references)){
  add('参考图指纹 '+ref.sourceFile,hash(ref.sourceFile)===ref.sourceSha256);
  add('资源记录指纹 '+ref.recordPath,hash(ref.recordPath)===ref.recordSha256);
}
const parseCounts=[];
for(const size of [120,108]){
  const ir=parse(R,sources,{pageSize:size});
  parseCounts.push({pageSize:size,textPages:ir.nodes.filter(n=>n.op==='text').length});
  for(const s of review.shots){
    const pages=ir.nodes.filter(n=>n.op==='text'&&n.paragraph===s.source.paragraph);
    add(`${size}字素 ${s.id} 正文/页相位/进出场`,
      pages.map(n=>n.text).join('')===s.source.quote && pages[0]?.id===s.lifecycle.enterBeforeId &&
      JSON.stringify(pages.map(n=>n.id))===JSON.stringify(s.lifecycle.visiblePageIds) && pages.at(-1)?.next===s.lifecycle.exitBeforeId &&
      hash(s.source.path)===s.source.sourceSha256);
    for(const ctx of s.contextSources) add(`${size}字素 ${s.id} 上下文指纹 ${ctx.path}`,hash(ctx.path)===ctx.sourceSha256);
  }
}
const snapshot=read('qa/SUI-A10-20261029/input-fingerprints.json');
const drift=snapshot.files.filter(x=>hash(x.path)!==x.sha256).map(x=>x.path);
add('受保护输入指纹不变',drift.length===0,drift);
const result={task:'SUI-A10制作前置',date:'2026-10-29',status:checks.every(x=>x.pass)?'pass':'fail',
 scope:'正文解析、文件/资源记录指纹与等待队列检查；不是全路线回归、图片制作或引擎验收',
 parseCounts,checks,summary:{checks:checks.length,passed:checks.filter(x=>x.pass).length,protectedInputs:snapshot.files.length},
 notTested:['CG图像生成与视觉检查','正式图像采用或演出绑定','引擎/浏览器/手机真机/电脑原生运行','发布']};
fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,...result.summary,parseCounts,failures:checks.filter(x=>!x.pass)}));
if(result.status!=='pass')process.exitCode=1;
