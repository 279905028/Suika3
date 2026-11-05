#!/usr/bin/env node
'use strict';
// 只读当前正文、采用清单与演出绑定；按原文段落去重，不统计玩家访问频率。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../../compiler/compile.cjs');
const {hash}=require('../../compiler/parse.cjs');
const {families}=require('./expressions.cjs');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const fingerprint=p=>({path:p,sha256:hash(fs.readFileSync(path.join(ROOT,p)))});
const labels={base:'基础／默认',expression:'表情差分',other:'衣装／持物／动作'};
const emotions={serious:'认真',displeased:'不悦',embarrassed:'窘迫',hesitant:'迟疑',downcast:'低落',smile:'微笑',amused:'笑意',tired:'疲惫',surprised:'惊讶',tearful:'含泪'};
const npcNames={chenniang:'陈嬢',ajun:'阿俊','housing-clerk':'租房办事员','salon-newcomer':'理发店新人',aying:'阿英','key-handover':'交钥匙的人','shoe-repairer':'修鞋人','grocery-owner':'杂货店大姐','new-grocery-owner':'新杂货店老板','sign-repairer':'修招牌师傅',classmate:'老同学','boss-li':'李老板','cafe-customer':'网咖顾客','cafe-colleague':'新柜台同事'};
const pct=(n,d)=>d?(100*n/d).toFixed(1)+'%':'—';
function owner(id){
  for(const [pattern,name]of [[/xiaoman/,'罗小满'],[/zhouzhi/,'周栀'],[/mengyao/,'孟遥'],[/^piao-/,'飘'],[/^sui-a06-orb-/,'黄球球（球形）'],[/^sui-a06-human-/,'黄球球（人形）'],[/^maolang-/,'毛狼'],[/^shijiang-/,'师匠'],[/^yelan-/,'叶岚'],[/^chensheng-/,'陈晟']])if(pattern.test(id))return name;
  const key=id.replace(/^npc-/,'').replace(/-base$/,'');
  assert(npcNames[key],'未分类人物 '+id);return npcNames[key];
}
function audit(){
  const M=read('assets/current/manifest.json'),B=read('docs/整合/bindings.json'),C=compile({pageSize:108});
  assert.equal(M.version,B.version);assert.equal(B.manifestSha256,fingerprint('assets/current/manifest.json').sha256);
  assert.deepEqual(B.sourceHashes,C.manifest.sourceHashes);assert.equal(B.contentBuildId,C.ir.buildId);
  const inputPaths=['assets/current/manifest.json','docs/整合/bindings.json',...Object.keys(C.manifest.sourceHashes),...Object.keys(C.manifest.compilerHashes),'tools/integration/assets/expressions.cjs','tools/integration/assets/audit-expression-usage.cjs'];
  const inputs=[...new Set(inputPaths)].map(fingerprint);
  const familyMap=new Map();
  for(const [family,ids]of Object.entries(families))ids.forEach((id,i)=>{assert(!familyMap.has(id));familyMap.set(id,{family,category:i?'expression':'base'});});
  const assets=M.assets.filter(a=>a.type==='character').map(a=>{
    const family=familyMap.get(a.assetId),category=family?.category||(/^npc-|^chensheng-b$/.test(a.assetId)?'base':'other');
    const emotion=category==='expression'?Object.keys(emotions).find(e=>new RegExp('-'+e+'(?:-v\\d+)?$').test(a.assetId)):null;
    assert(category!=='expression'||emotion,'未分类表情 '+a.assetId);
    return {assetId:a.assetId,owner:owner(a.assetId),category,emotion,family:family?.family||null,runtimePath:a.runtimePath,visibleParagraphs:0,rawTextPages:0,allBindingNodes:0,hiddenByCG:0};
  });
  const assetMap=new Map(assets.map(a=>[a.assetId,a])),bindings=new Map(B.bindings.map(b=>[b.anchor.nodeId,b]));
  assert.equal(bindings.size,B.bindings.length);
  for(const b of B.bindings)for(const p of b.enter.characters){assert(assetMap.has(p.assetId));assetMap.get(p.assetId).allBindingNodes++;}
  const grouped=new Map(),sourceLines=new Map();
  for(const n of C.ir.nodes.filter(n=>['text','choice'].includes(n.op))){
    const b=bindings.get(n.id);assert(b,'显示节点缺绑定 '+n.id);assert.equal(b.anchor.sha256,n.source.sha256);
    if(n.op!=='text')continue;
    for(const p of b.enter.characters)assetMap.get(p.assetId).rawTextPages++;
    const key=n.source.file+':'+n.source.line;
    if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push({n,b});
  }
  const paragraphs=[],owners={},categories={base:0,expression:0,other:0},emotionCounts={};
  for(const group of grouped.values()){
    group.sort((a,b)=>a.n.offset-b.n.offset);const {n,b}=group[0];
    for(const p of group)assert.deepEqual(p.b.enter,b.enter,'同段分页的画面不同，须另定统计口径 '+n.id);
    if(!sourceLines.has(n.source.file))sourceLines.set(n.source.file,fs.readFileSync(path.join(ROOT,'scenario',n.source.file),'utf8').split(/\r?\n/));
    const original=sourceLines.get(n.source.file)[n.source.line-1];assert.equal(group.map(p=>p.n.text).join(''),original.trim());assert.equal(hash(original),n.source.sha256);
    const ids=b.enter.characters.map(p=>p.assetId);assert.equal(new Set(ids).size,ids.length);
    const visible=b.enter.cg?[]:ids;
    for(const id of b.enter.cg?ids:[])assetMap.get(id).hiddenByCG++;
    for(const id of visible){
      const a=assetMap.get(id);a.visibleParagraphs++;categories[a.category]++;
      owners[a.owner]??={total:0,base:0,expression:0,other:0};owners[a.owner].total++;owners[a.owner][a.category]++;
      if(a.emotion)emotionCounts[a.emotion]=(emotionCounts[a.emotion]||0)+1;
    }
    paragraphs.push({file:'scenario/'+n.source.file,line:n.source.line,sha256:n.source.sha256,nodeIds:group.map(p=>p.n.id),condition:b.condition,routeIds:b.routeIds,cg:b.enter.cg?.assetId||null,characters:ids,visibleCharacters:visible});
  }
  const total=assets.reduce((s,a)=>s+a.visibleParagraphs,0);
  assert.equal(total,Object.values(categories).reduce((s,n)=>s+n,0));
  assert.equal(total,Object.values(owners).reduce((s,o)=>s+o.total,0));
  assert.equal(categories.expression,Object.values(emotionCounts).reduce((s,n)=>s+n,0));
  const candidates=[];
  for(const name of ['sui-i02-20261030-title-b1-v2','v1.1.0-beta.1']){
    const prefix='build/'+name+'/input/';
    if(!fs.existsSync(path.join(ROOT,prefix,'docs/整合/bindings.json')))continue;
    for(const p of ['assets/current/manifest.json','docs/整合/bindings.json'])assert.equal(fingerprint(prefix+p).sha256,fingerprint(p).sha256,'候选输入不同 '+name);
    candidates.push({name,manifest:fingerprint(prefix+'assets/current/manifest.json'),bindings:fingerprint(prefix+'docs/整合/bindings.json')});
  }
  for(const input of inputs)assert.equal(fingerprint(input.path).sha256,input.sha256,'统计期间输入变化 '+input.path);
  return {schemaVersion:1,date:'2026-10-30',version:M.version,contentBuildId:C.ir.buildId,inputs,candidates,
    counts:{textPages:C.manifest.counts.pages,paragraphs:paragraphs.length,choiceNodes:C.ir.nodes.filter(n=>n.op==='choice').length,bindings:B.bindings.length,visiblePortraitParagraphs:paragraphs.filter(p=>p.visibleCharacters.length).length,cgParagraphs:paragraphs.filter(p=>p.cg).length,backgroundOnlyParagraphs:paragraphs.filter(p=>!p.cg&&!p.visibleCharacters.length).length,portraitAppearances:total,categories,emotionCounts},
    owners,assets,paragraphs,validation:{status:'pass',sourceHashes:true,contentBuildId:true,manifestHash:true,displayNodeCoverage:true,paragraphReconstruction:true,paginationStateConsistency:true,countReconciliation:true,inputsUnchanged:true}};
}
function markdown(r){
  const c=r.counts,lines=['# 当前立绘表情使用比例','',`${r.date}｜演出版本 \`${r.version}\`。当前绑定与${r.candidates.map(c=>'`'+c.name+'`').join('、')}的冻结输入一致。`,'',
    '## 统计口径','',
    '- 以当前 scenario/ 正文按来源文件＋行号去重；同段分页合并，共通段只计一次。互斥分支均纳入静态全稿统计，不代表一轮游戏或玩家实际阅读时长。',
    '- 统计正文进入时配置的立绘；排除选择等待页、CG覆盖的底层人物、退出恢复状态和重复路径访问。多人同框按每人每段各计一次。',
    '- 基础／默认指已登记表情族的首张图及仅有基础图的配角，不表示面部完全无表情。周栀工作衣装的 neutral／serious 按已登记表情族分类；其余独立衣装、持物、动作单列，不凭脸部观感推定为表情差分。',
    '- 资产采用率另按不同资源计数；低频与零频不直接意味着需要补图或强行增加表情切换。','',
    '## 总体','',
    `正文${c.textPages.toLocaleString()}页，去重后${c.paragraphs.toLocaleString()}段：${c.visiblePortraitParagraphs.toLocaleString()}段有立绘且无CG覆盖，${c.cgParagraphs}段为CG，${c.backgroundOnlyParagraphs}段仅背景。`,
    `共${c.portraitAppearances.toLocaleString()}次“人物×段落”立绘出现。`,'',
    '| 类型 | 次数 | 占全部立绘出现 |','| --- | ---: | ---: |',
    ...Object.entries(c.categories).map(([k,n])=>`| ${labels[k]} | ${n} | ${pct(n,c.portraitAppearances)} |`),'',
    `只看具备同衣装／同形态表情族的基础图与表情差分，差分占${pct(c.categories.expression,c.categories.expression+r.assets.filter(a=>a.family&&a.category==='base').reduce((s,a)=>s+a.visibleParagraphs,0))}。此口径排除衣装／动作图及无表情族的配角。`,'',
    '## 各人物（全稿各篇合计）','',
    '| 人物 | 总次数 | 基础／默认 | 表情差分 | 衣装／动作 | 差分占比 |','| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(r.owners).sort((a,b)=>b[1].total-a[1].total).map(([name,v])=>`| ${name} | ${v.total} | ${v.base} | ${v.expression} | ${v.other} | ${pct(v.expression,v.total)} |`),'',
    '## 各种表情差分','',
    '| 表情 | 次数 | 占全部立绘出现 | 占表情差分 |','| --- | ---: | ---: | ---: |',
    ...Object.keys(emotions).sort((a,b)=>(c.emotionCounts[b]||0)-(c.emotionCounts[a]||0)).map(k=>`| ${emotions[k]} | ${c.emotionCounts[k]||0} | ${pct(c.emotionCounts[k]||0,c.portraitAppearances)} | ${pct(c.emotionCounts[k]||0,c.categories.expression)} |`),'',
    '## 资源利用与逐图分布','',
    `采用清单共${r.assets.length}张立绘，${r.assets.filter(a=>a.visibleParagraphs).length}张在正文无CG覆盖段出现；${r.assets.filter(a=>a.category==='expression').length}张纯表情差分中使用${r.assets.filter(a=>a.category==='expression'&&a.visibleParagraphs).length}张。`,'',
    '| 人物 | 资源 | 分类／表情 | 正文出现次数 | 全部显示节点引用 |','| --- | --- | --- | ---: | ---: |',
    ...r.assets.map(a=>`| ${a.owner} | \`${a.assetId}\` | ${a.emotion?emotions[a.emotion]:labels[a.category]} | ${a.visibleParagraphs} | ${a.allBindingNodes} |`),'',
    '“全部显示节点引用”包含选择页、CG底层与正文分页，仅用于区分未引用和被CG遮盖，不用作主占比分母。','',
    '## 实际验证与范围','',
    '已核对正文与绑定指纹、采用清单指纹、内容构建编号、全部显示节点绑定、分页原文重组、分页画面一致性、分类与人物加总，以及上述现行候选冻结输入。逐段与逐图明细、分类依据字段及输入指纹见[report.json](report.json)。',
    '本批仅离线统计，未修改正文、图片和演出绑定；未新增正文人工审校、图片目视、引擎运行、浏览器、手机真机或发布验收，未访问玩家存档。',''];
  return lines.join('\n');
}
if(require.main===module){
  const out=process.argv[2];assert(out,'用法：node tools/integration/assets/audit-expression-usage.cjs qa/<新批次>');
  const dir=path.resolve(ROOT,out);assert(dir.startsWith(path.join(ROOT,'qa')+path.sep));assert(!fs.existsSync(dir),'不得覆盖既有QA批次');
  const r=audit();fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(r,null,2)+'\n');fs.writeFileSync(path.join(dir,'统计报告.md'),markdown(r));
  console.log(JSON.stringify({counts:r.counts,owners:r.owners,unused:r.assets.filter(a=>!a.visibleParagraphs).map(a=>({assetId:a.assetId,category:a.category,allBindingNodes:a.allBindingNodes})),validation:r.validation},null,2));
}
module.exports={audit,markdown};
