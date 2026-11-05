#!/usr/bin/env node
'use strict';
// 只读现行正文与演出绑定，按已登记的连续场景区间统计；不生成或接入美术。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../../compiler/compile.cjs');
const {hash}=require('../../compiler/parse.cjs');
const ROOT=path.resolve(__dirname,'../../..');
const PLAN='qa/sui-i01-20261030/scene-plan.json';
const BACKDROP='system/sui-u/png/reading-backdrop.png';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const fingerprint=p=>({path:p,sha256:hash(fs.readFileSync(path.join(ROOT,p)))});
const emptyCounts=()=>({scenes:0,noBackgroundScenes:0,onlyRainScenes:0,mixedRainScenes:0,illustratedRainScenes:0});
const sceneLabels={onlyRainScenes:'全程只有雨窗',mixedRainScenes:'部分段落只有雨窗',illustratedRainScenes:'始终有立绘或CG'};
function audit(){
  const M=read('assets/current/manifest.json'),B=read('docs/整合/bindings.json'),P=read(PLAN),C=compile({pageSize:108});
  assert.equal(M.version,B.version);assert.equal(B.manifestSha256,fingerprint('assets/current/manifest.json').sha256);
  assert.deepEqual(B.sourceHashes,C.manifest.sourceHashes);assert.deepEqual(P.sourceHashes,B.sourceHashes);assert.equal(B.contentBuildId,C.ir.buildId);
  const inputPaths=['assets/current/manifest.json','docs/整合/bindings.json',PLAN,BACKDROP,'tools/integration/runtime/presentation-full.cjs','tools/integration/assets/audit-scene-backgrounds.cjs',...Object.keys(C.manifest.sourceHashes),...Object.keys(C.manifest.compilerHashes)];
  const inputs=[...new Set(inputPaths)].map(fingerprint),assets=new Map(M.assets.map(a=>[a.assetId,a]));
  const bindings=new Map(B.bindings.map(b=>[b.anchor.nodeId,b])),nodes=new Map(C.ir.nodes.map(n=>[n.id,n]));
  assert.equal(bindings.size,B.bindings.length);
  const display=C.ir.nodes.filter(n=>['text','choice'].includes(n.op)),seen=new Set(),referenced=new Set();
  const counts=emptyCounts(),byFile={},scenes=[];
  for(const s of P.scenes){
    const rows=s.nodeIds.map(id=>{
      assert(!seen.has(id),'场景重复覆盖 '+id);seen.add(id);
      const n=nodes.get(id),b=bindings.get(id);assert(n&&b&&['text','choice'].includes(n.op));
      assert.equal('scenario/'+n.source.file,s.file);assert.equal(b.anchor.sha256,n.source.sha256);
      assert(b.restrictions.some(t=>t.startsWith(s.sceneId+': ')),'当前绑定场景登记不同 '+id);
      assert.equal(b.enter.background?.assetId||null,s.backgroundId);
      for(const p of [b.enter.background,...b.enter.characters,...b.enter.props,b.enter.cg].filter(Boolean)){
        assert(assets.has(p.assetId),'未登记资源 '+p.assetId);referenced.add(p.assetId);
      }
      return {n,b};
    });
    assert.equal(rows[0].n.source.line,s.first.line);assert.equal(rows.at(-1).n.source.line,s.last.line);
    counts.scenes++;const f=byFile[s.file]??=emptyCounts();f.scenes++;
    if(s.backgroundId)continue;
    const paragraphs=new Map();
    for(const {n,b} of rows.filter(r=>r.n.op==='text')){
      const key=n.source.file+':'+n.source.line;
      if(paragraphs.has(key)){assert.deepEqual(paragraphs.get(key).state,b.enter);paragraphs.get(key).nodeIds.push(n.id);}
      else paragraphs.set(key,{line:n.source.line,nodeIds:[n.id],state:b.enter,preview:n.text.slice(0,90)});
    }
    assert(paragraphs.size,'无正文场景须另定口径 '+s.sceneId);
    const stats={paragraphs:paragraphs.size,onlyRainParagraphs:0,portraitParagraphs:0,cgParagraphs:0,propOnlyParagraphs:0};
    for(const {state} of paragraphs.values()){
      if(state.cg)stats.cgParagraphs++;
      else if(state.characters.length)stats.portraitParagraphs++;
      else if(state.props.length)stats.propOnlyParagraphs++;
      else stats.onlyRainParagraphs++;
    }
    const kind=stats.onlyRainParagraphs===stats.paragraphs?'onlyRainScenes':stats.onlyRainParagraphs?'mixedRainScenes':'illustratedRainScenes';
    counts.noBackgroundScenes++;f.noBackgroundScenes++;counts[kind]++;f[kind]++;
    const sourceLines=fs.readFileSync(path.join(ROOT,s.file),'utf8').split(/\r?\n/);
    const headings=sourceLines.slice(0,s.first.line).filter(l=>/^#{1,4} /.test(l));
    scenes.push({sceneId:s.sceneId,file:s.file,firstLine:s.first.line,lastLine:s.last.line,heading:headings.at(-1),kind,label:sceneLabels[kind],reason:s.direction,stats,
      paragraphs:[...paragraphs.values()].map(({state,...p})=>({...p,visibleKind:state.cg?'CG':state.characters.length?'立绘':state.props.length?'道具':'仅雨窗',characters:state.characters.map(p=>p.assetId),cg:state.cg?.assetId||null}))});
  }
  assert.equal(seen.size,display.length);assert.equal(bindings.size,display.length);for(const n of display)assert(seen.has(n.id));
  const checkedFiles=[...referenced].map(id=>assets.get(id).runtimePath);assert(fs.existsSync(path.join(ROOT,BACKDROP)));
  const missingFiles=checkedFiles.filter(p=>!fs.existsSync(path.join(ROOT,p)));assert.deepEqual(missingFiles,[]);
  const composer=fs.readFileSync(path.join(ROOT,'tools/integration/runtime/presentation-full.cjs'),'utf8');
  assert(composer.includes('if(!state.background) add(')&&composer.includes(BACKDROP),'雨窗后备逻辑已变化，须重新核验');
  const candidates=[];
  for(const name of ['sui-i02-20261030-title-b1-v2','v1.1.0-beta.1']){
    const prefix='build/'+name+'/input/';if(!fs.existsSync(path.join(ROOT,prefix+'docs/整合/bindings.json')))continue;
    for(const p of ['assets/current/manifest.json','docs/整合/bindings.json'])assert.equal(fingerprint(prefix+p).sha256,fingerprint(p).sha256,'候选输入变化 '+name);
    candidates.push(name);
  }
  counts.scenesWithOnlyRainParagraphs=counts.onlyRainScenes+counts.mixedRainScenes;
  counts.noBackgroundParagraphs=scenes.reduce((sum,s)=>sum+s.stats.paragraphs,0);
  counts.onlyRainParagraphs=scenes.reduce((sum,s)=>sum+s.stats.onlyRainParagraphs,0);
  assert.equal(counts.noBackgroundScenes,counts.onlyRainScenes+counts.mixedRainScenes+counts.illustratedRainScenes);
  for(const input of inputs)assert.equal(fingerprint(input.path).sha256,input.sha256,'统计期间输入变化 '+input.path);
  return {schemaVersion:1,date:'2026-11-02',version:B.version,contentBuildId:C.ir.buildId,counts,byFile,scenes,inputs,candidates,
    resources:{referencedAssets:referenced.size,checkedFiles:checkedFiles.length,missingFiles,backdrop:fingerprint(BACKDROP)},
    validation:{status:'pass',sourceHashes:true,manifestHash:true,contentBuildId:true,currentSceneCoverage:true,displayNodes:display.length,paginationStateConsistency:true,countsReconciled:true,referencedFilesExist:true,runtimeFallbackSource:true,inputsUnchanged:true}};
}
function markdown(r){
  const c=r.counts,lines=['# 无具体场景背景与雨窗场景统计','',`${r.date}｜当前演出版本：\`${r.version}\`。`,'',
    '## 数量','',`当前共${c.scenes}个已登记连续场景区间，其中**${c.noBackgroundScenes}个未绑定具体场景背景**（${(c.noBackgroundScenes/c.scenes*100).toFixed(1)}%）：`,'',
    `- ${c.onlyRainScenes}个全程只有雨窗底图与文字。`,
    `- ${c.mixedRainScenes}个部分段落只有雨窗，其他段落有立绘或CG。`,
    `- ${c.illustratedRainScenes}个以雨窗为底，正文始终有立绘或CG。`,'',
    `因此，至少出现过“只有简单雨窗＋文字”的是**${c.scenesWithOnlyRainParagraphs}个场景**。无具体背景共${c.noBackgroundParagraphs}段正文，其中${c.onlyRainParagraphs}段只有雨窗与文字。`,
    `当前引用的${r.resources.checkedFiles}份美术文件和雨窗底图均存在；发现缺失文件${r.resources.missingFiles.length}份。`,'',
    '## 分布','',
    '| 正文 | 无具体背景 | 全程只有雨窗 | 部分只有雨窗 | 始终有立绘或CG |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(r.byFile).map(([file,f])=>`| ${path.basename(file,'.md')} | ${f.noBackgroundScenes} | ${f.onlyRainScenes} | ${f.mixedRainScenes} | ${f.illustratedRainScenes} |`),'',
    '## 口径与验证范围','',
    '- 以现行绑定中的scene编号对应连续场景区间计数；共通只计一次，互斥分支均纳入，不代表一次游玩的数量。同一地点重复出现会分次登记，88个区间不等于需要制作88张独立图片。',
    '- “正文”包括对话、叙述、手机消息及过渡；分页按来源文件＋行号合并，选择等待页不计正文段落。没有立绘但已有具体场景图的段落不列入本次问题范围。',
    '- 空背景字段会由现行演出合成器放入统一雨窗阅读底图；CG覆盖雨窗时按CG显示统计。并非全部空背景字段都显示黑屏，也不意味着全部需要补图。',
    '- 已核对当前正文／绑定／清单指纹、全部显示节点与场景的一一覆盖、分页画面一致性、计数加总、文件存在性及雨窗后备代码；当前绑定与'+r.candidates.map(n=>'`'+n+'`').join('、')+'冻结输入一致。',
    '- 本批只做离线统计并查看统一雨窗底图；未修改正文、素材、绑定和游戏入口，未新增全稿人工审校、全部图片解码／目视、引擎运行、浏览器／手机真机或发布验收，未访问玩家存档。',
    '- 原登记原因保留供后续筛选；可能包括明确地点缺对应图、地点未说明、远程消息、概述及门外视角，本次不把它们自动判定为待制作需求。','',
    '## 88个区间明细','',
    '| 编号 | 正文位置 | 当前呈现 | 原登记原因 |',
    '| --- | --- | --- | --- |',
    ...r.scenes.map(s=>`| ${s.sceneId} | [${path.basename(s.file,'.md')}:${s.firstLine}—${s.lastLine}](../../${s.file}#L${s.firstLine}) | ${s.label} | ${s.reason} |`),'',
    '逐段画面类型、人物／CG引用及输入指纹见[report.json](report.json)。',''];
  return lines.join('\n');
}
if(require.main===module){
  const out=process.argv[2];assert(out,'用法：node tools/integration/assets/audit-scene-backgrounds.cjs qa/<新批次>');
  const dir=path.resolve(ROOT,out);assert(dir.startsWith(path.join(ROOT,'qa')+path.sep));assert(!fs.existsSync(dir),'不得覆盖既有QA批次');
  const r=audit();fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(r,null,2)+'\n');fs.writeFileSync(path.join(dir,'统计报告.md'),markdown(r));
  console.log(JSON.stringify({counts:r.counts,byFile:r.byFile,resources:r.resources,validation:r.validation},null,2));
}
module.exports={audit,markdown};
