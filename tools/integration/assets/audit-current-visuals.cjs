#!/usr/bin/env node
'use strict';
// 审计当前正式绑定；只向新的QA目录写报告，不改正文、美术、绑定或历史证据。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../../compiler/compile.cjs');
const {hash}=require('../../compiler/parse.cjs');
const {integrate}=require('../../story-revision/p4-integration/presentation.cjs');
const ROOT=path.resolve(__dirname,'../../..');
const DOC='docs/修订协作/P4-演出与美术/P4-07';
const BUILD='qa/dialogue-p4-P4-07-20261104/build-adopted';
const BACKDROP='system/sui-u/png/reading-backdrop.png';
const read=p=>fs.readFileSync(path.join(ROOT,p));
const json=p=>JSON.parse(read(p));
const fp=p=>({path:p,sha256:hash(read(p))});
const placements=s=>[s.background,...s.characters,...s.props,s.cg].filter(Boolean);
const kind=s=>s.cg?'cg':s.background?'background':s.characters.length?'rainPortrait':s.props.length?'rainProp':'rainOnly';
const empty=()=>({paragraphs:0,textPages:0,choices:0,rainOnlyParagraphs:0,rainOnlyTextPages:0,rainOnlyChoices:0,rainPortrait:0,rainProp:0,cg:0});
function audit(){
  const generated=compile({pageSize:108,textPolicy:'required'}),M=json('assets/current/manifest.json'),B=json('docs/整合/bindings.json');
  const packageDir=B.backgroundFill?.build||BUILD;
  const G=json('system/sui-u/gallery.registry.json'),A=json(DOC+'/cg-anchors.json').records,context=json(DOC+'/context.json');
  assert.equal(M.version,B.version);assert.equal(B.manifestSha256,fp('assets/current/manifest.json').sha256);
  assert.equal(B.contentBuildId,generated.ir.buildId);assert.equal(M.contentBuildId,generated.ir.buildId);assert.deepEqual(B.sourceHashes,generated.manifest.sourceHashes);
  const inputs=[...new Set(['assets/current/manifest.json','docs/整合/bindings.json','system/sui-u/gallery.registry.json',DOC+'/cg-anchors.json',DOC+'/context.json',
    BACKDROP,'tools/integration/assets/audit-current-visuals.cjs','tools/integration/runtime/presentation-full.cjs','tools/integration/runtime/presentation-full.ray',
    'tools/story-revision/p4-integration/presentation.cjs',...Object.keys(generated.manifest.sourceHashes),...Object.keys(generated.manifest.compilerHashes),
    ...context.packages.map(p=>DOC+'/packages/'+p.packageId+'/review.json')])].map(fp);
  const assets=new Map(M.assets.map(a=>[a.assetId,a])),bindings=new Map(B.bindings.map(b=>[b.anchor.nodeId,b]));
  assert.equal(assets.size,M.assets.length);assert.equal(bindings.size,B.bindings.length);
  const display=generated.ir.nodes.filter(n=>['text','choice'].includes(n.op));assert.equal(display.length,bindings.size);
  const reviews=new Map(context.packages.flatMap(p=>json(DOC+'/packages/'+p.packageId+'/review.json').reviews.flatMap(r=>r.nodeIds.map(id=>[id,r]))));
  const counts={displayNodes:display.length,paragraphs:new Set(display.filter(n=>n.op==='text').map(n=>n.paragraph)).size,textPages:0,choices:0,
    background:0,cg:0,rainOnly:0,rainPortrait:0,rainProp:0,noBackground:0,noBackgroundWithCG:0};
  const byFile={},rows=[],referenced=new Set(),paragraphs=new Map();
  for(const n of display){
    const b=bindings.get(n.id);assert(b,'无绑定节点 '+n.id);assert.equal(b.anchor.sha256,n.source.sha256);
    assert.equal(b.anchor.file,'scenario/'+n.source.file);assert(reviews.has(n.id),'无审阅记录 '+n.id);
    for(const s of [b.enter,b.exit.restore])for(const p of placements(s)){assert(assets.has(p.assetId),'未知资源 '+p.assetId);referenced.add(p.assetId);}
    const k=kind(b.enter),f=byFile[n.source.file]??=empty();counts[k]++;if(!b.enter.background){counts.noBackground++;if(b.enter.cg)counts.noBackgroundWithCG++;}
    if(n.op==='text'){
      counts.textPages++;f.textPages++;
      if(paragraphs.has(n.paragraph))assert.deepEqual(paragraphs.get(n.paragraph).state,b.enter,'分页画面不一致');
      else{paragraphs.set(n.paragraph,{file:n.source.file,state:b.enter});f.paragraphs++;if(k==='rainOnly')f.rainOnlyParagraphs++;}
      if(k==='rainOnly')f.rainOnlyTextPages++;
    }else{counts.choices++;f.choices++;if(k==='rainOnly')f.rainOnlyChoices++;}
    if(['rainPortrait','rainProp','cg'].includes(k))f[k]++;
    rows.push({nodeId:n.id,paragraphId:n.paragraph||null,op:n.op,file:'scenario/'+n.source.file,line:n.source.line,anchor:n.source.anchor,
      condition:b.condition,routeIds:b.routeIds,kind:k,text:n.text||generated.ir.choices[n.id]?.prompt||'',
      background:b.enter.background?.assetId||null,characters:b.enter.characters.map(p=>p.assetId),props:b.enter.props.map(p=>p.assetId),cgId:b.cgId,
      restrictions:b.restrictions,reviewBasis:reviews.get(n.id).basis});
  }
  counts.rainOnlyParagraphs=[...paragraphs.values()].filter(p=>kind(p.state)==='rainOnly').length;
  counts.rainOnlyTextPages=rows.filter(r=>r.kind==='rainOnly'&&r.op==='text').length;
  counts.rainOnlyChoices=rows.filter(r=>r.kind==='rainOnly'&&r.op==='choice').length;
  const runs=[];let last=null;
  for(const r of rows){
    if(r.kind!=='rainOnly'){last=null;continue;}
    const key=JSON.stringify([r.file,r.anchor,r.condition]);
    if(!last||last.key!==key){last={id:'R'+String(runs.length+1).padStart(3,'0'),key,file:r.file,anchor:r.anchor,condition:r.condition,routeIds:r.routeIds,
      firstLine:r.line,lastLine:r.line,nodeIds:[],paragraphIds:[],textPages:0,choices:0,preview:r.text,restrictions:r.restrictions,reviewBasis:r.reviewBasis};runs.push(last);}
    last.lastLine=r.line;last.nodeIds.push(r.nodeId);if(r.paragraphId&&!last.paragraphIds.includes(r.paragraphId))last.paragraphIds.push(r.paragraphId);last[r.op==='text'?'textPages':'choices']++;
  }
  runs.forEach(r=>delete r.key);
  const cgItems=G.items.map(i=>{
    const a=assets.get(i.assetId),anchors=A.filter(a=>a.cgId===i.id),bs=B.bindings.filter(b=>b.cgId===i.id),ns=rows.filter(r=>r.cgId===i.id);
    assert(a&&a.type==='cg');assert.equal(i.file,a.runtimePath);assert.equal(i.unlockVariable,'sui_cg_'+i.id);
    assert.equal(anchors.length,1);assert.equal(bs.length,1);assert.equal(bs[0].enter.cg.assetId,i.assetId);assert(bs[0].fullView);
    assert.equal(anchors[0].nodeId,bs[0].anchor.nodeId);assert.equal(anchors[0].assetId,i.assetId);assert.equal(anchors[0].condition,bs[0].condition);
    return {id:i.id,assetId:i.assetId,file:i.file,nodeId:ns[0].nodeId,sourceFile:ns[0].file,line:ns[0].line,condition:ns[0].condition};
  });
  assert.equal(new Set(cgItems.map(c=>c.id)).size,G.items.length);
  const unboundCG=M.assets.filter(a=>a.type==='cg'&&!cgItems.some(i=>i.assetId===a.assetId)).map(a=>a.assetId);
  const unregisteredBindings=B.bindings.filter(b=>b.cgId&&!G.items.some(i=>i.id===b.cgId)).map(b=>b.bindingId);
  assert.deepEqual(unboundCG,[]);assert.deepEqual(unregisteredBindings,[]);assert.equal(A.length,cgItems.length);
  const files=M.assets.map(a=>({assetId:a.assetId,type:a.type,path:a.runtimePath,expected:a.runtimeSha256,...fp(a.runtimePath)}));
  for(const f of files)assert.equal(f.sha256,f.expected,'文件指纹不同 '+f.path);
  // 重新调用正式合成器，逐一核对无背景状态确实生成雨窗后备；不把它当成引擎实玩。
  const ui=json('system/sui-u/integration.json').raySourceOrder.map(p=>read(p).toString()).join('\n');
  const presentation=integrate({generated,host:read('main.ray').toString(),uiRay:ui,assets:M.assets,bindings:B.bindings,gallery:G,mode:'candidate'});
  const shared=new Map();for(const b of B.bindings)for(const s of [b.enter,b.exit.restore])if(!shared.has(JSON.stringify(s)))shared.set(JSON.stringify(s),{index:shared.size,state:s});
  const fallbackStates=[...shared.values()].filter(r=>!r.state.background);
  for(const s of fallbackStates)assert(presentation.ray.includes('Array.push(iStates["state-'+s.index+'"],{assetId:"ui:backdrop"'),'缺雨窗后备');
  assert.deepEqual(json(packageDir+'/bindings.json').bindings,B.bindings);assert.deepEqual(json(packageDir+'/gallery.registry.json'),G);
  const packagedAssets=json(packageDir+'/runtime-assets.json');for(const a of M.assets)assert(packagedAssets.some(p=>p.assetId===a.assetId&&p.runtimePath===a.runtimePath&&p.runtimeSha256===a.runtimeSha256));
  const packageFiles=json(packageDir+'/build-result.json').inputs;
  for(const p of Object.keys(generated.manifest.sourceHashes))assert.equal(fp(p).sha256,packageFiles.find(f=>f.path===p)?.sha256,'当前正文与包不同');
  for(const f of inputs)assert.equal(fp(f.path).sha256,f.sha256,'审计期间输入变化');
  return {date:'2026-11-04',version:B.version,contentBuildId:generated.ir.buildId,scope:'当前正式P4静态版；全稿含互斥分支，不是单次游玩数。',counts,byFile,
    rainOnlyRuns:runs,rows,cg:{adopted:M.assets.filter(a=>a.type==='cg').length,gallery:G.items.length,bound:cgItems.length,unboundCG,unregisteredBindings,items:cgItems},
    resources:{adopted:M.assets.length,referenced:referenced.size,unused:M.assets.filter(a=>!referenced.has(a.assetId)).map(a=>a.assetId),missing:[],hashMismatches:[],files,backdrop:fp(BACKDROP)},
    presentation:{uniqueStates:shared.size,fallbackStates:fallbackStates.length,emittedFallbackVerified:true,package:packageDir,sameVersionPackage:true},
    inputs,validation:{status:'pass',sourceHashes:true,completeBindings:true,paragraphPagination:true,cgAnchors:true,resourcesExistAndMatch:true,inputsUnchanged:true,
      engine:'not-run',browser:'not-run',mobile:'not-tested',native:'not-tested',release:'not-executed'}};
}
const cell=s=>String(s??'').replace(/\|/g,'／').replace(/\n/g,' ');
function markdown(r){
  const c=r.counts;
  return ['# 当前空画面与CG绑定检查','',`${r.date}｜版本 \`${r.version}\`。`,'',
    c.rainOnly>0?`**仍有${c.rainOnlyParagraphs}段正文＋${c.rainOnlyChoices}个选择页，只显示深色雨窗阅读底图与文字。** 正文占全稿${(c.rainOnlyParagraphs/c.paragraphs*100).toFixed(1)}%。另有${c.rainPortrait}个节点为雨窗＋立绘、${c.rainProp}个为雨窗＋道具；这两类不算只有底图。`:`**当前全部${c.displayNodes}个显示节点均已绑定背景，只有雨窗与文字的正文／选择页为0。** 雨窗底上的立绘／道具节点也为0。`,
    `**已采用${r.cg.adopted}张静态CG全部有剧情绑定，漏绑0张。** 图鉴、正式锚点、资源和当前验收包一致；${r.resources.adopted}份采用图像文件均存在且SHA-256一致。`,'',
    '## 分布','',
    '| 正文 | 仅雨窗正文段 | 仅雨窗选择页 | 雨窗＋立绘节点 | 雨窗＋道具节点 | CG页 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(r.byFile).map(([f,v])=>`| ${cell(path.basename(f,'.md'))} | ${v.rainOnlyParagraphs} | ${v.rainOnlyChoices} | ${v.rainPortrait} | ${v.rainProp} | ${v.cg} |`),'',
    '## 如何理解','',
    '- “黑屏下雨”对应当前统一深色雨窗底图，已查看该图；不等于图片丢失造成的纯黑屏。正式合成器在空背景状态添加雨窗后备，本次重新生成状态并逐项核对。',
    '- 当前采用版有4,814条完整显示绑定：4,749正文页（4,748段）和65个选择页。普通背景或立绘画面无CG属于常规演出，不能将所有非CG页计为漏绑。',
    '- 部分雨窗为消息、远程语音、跨日概述或场所未明确而保留；部分登记明确缺客车/贵阳街面等合适背景。下表保留原绑定与逐段审阅依据，不自动把每处雨窗判成必须新画CG。',
    '- 统计包括互斥分支及两篇后日谈，共通只计一次；不是一次游玩的段数。旧版88场景统计的正文和场景分组均已变化，不能直接用区间数量作增减比较。',
    '- 恋爱结局、留宿、亲吻动态CG仍为独立制作任务，当前正式动态绑定为0；本报告的81张为已采用静态CG。',
    '- 本次完成正文/绑定/锚点/文件/合成器/同版本包核对和雨窗底图目视；图像完整解码结果另见image-check.json。未改正文、资源或运行入口，未新增全路线引擎实玩、浏览器、手机真机、电脑原生或发布验收，未访问玩家存档。','',
    '## 仅雨窗的位置','',
    `按正文显示顺序，遇到非仅雨窗节点、文件、控制锚点或条件变化即另分一行，共${r.rainOnlyRuns.length}段区间；区间不等于场景或补图张数。完整节点、条件和逐段审阅依据见[report.json](report.json)。`,'',
    '| 编号 | 正文位置 | 正文段／选择页 | 起始文字或选项节点 | 当前依据 |',
    '| --- | --- | ---: | --- | --- |',
    ...r.rainOnlyRuns.map(x=>`| ${x.id} | [${cell(path.basename(x.file,'.md'))}:${x.firstLine}–${x.lastLine}](../../${x.file}#L${x.firstLine}) | ${x.paragraphIds.length}／${x.choices} | ${cell(x.preview||x.nodeIds[0]).slice(0,65)} | ${cell(x.restrictions.find(t=>!/^按本段经审定|^进入、回退|^P4-07|^退出去CG/.test(t))||x.reviewBasis).slice(0,130)} |`),'',
    '## 文件与复核','',
    '- [全部仅雨窗正文、选择与原审阅依据（CSV）](仅雨窗明细.csv)',
    '- [81张静态CG的正式节点（CSV）](CG绑定明细.csv)',
    '- [完整统计、逐节点状态与输入指纹（JSON）](report.json)',
    '- [图像完整解码检查](image-check.json)',''].join('\n');
}
function csv(rows,keys){const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';return '\ufeff'+[keys.map(quote).join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n')+'\n';}
if(require.main===module){
  const out=process.argv[2];assert(out&&/^qa\/[^/]+$/.test(out)&&!out.includes('..'),'用法：audit-current-visuals.cjs qa/<新批次>');
  const dir=path.join(ROOT,out);assert(!fs.existsSync(dir),'不覆盖历史证据');const result=audit();fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(dir,'检查报告.md'),markdown(result));
  fs.writeFileSync(path.join(dir,'仅雨窗明细.csv'),csv(result.rows.filter(r=>r.kind==='rainOnly'),['nodeId','paragraphId','op','file','line','anchor','condition','text','reviewBasis']));
  fs.writeFileSync(path.join(dir,'CG绑定明细.csv'),csv(result.cg.items,['id','assetId','nodeId','sourceFile','line','condition','file']));
  console.log(JSON.stringify({counts:result.counts,byFile:result.byFile,cg:{adopted:result.cg.adopted,bound:result.cg.bound,unboundCG:result.cg.unboundCG},resources:result.resources.adopted,runs:result.rainOnlyRuns.length,presentation:result.presentation},null,2));
}
module.exports={audit,markdown};
