#!/usr/bin/env node
'use strict';
// P0只冻结指纹、来源索引与只读核对结果；不写正文、运行资源或旧QA。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const {compile} = require('../compiler/compile.cjs');
const ROOT = path.resolve(__dirname, '../..');
const QA = 'qa/dialogue-p0-20261102';
const CANDIDATE = 'build/sui-i02-20261102-epilogue-v1/candidate-manifest.json';
const SNAPSHOT = 'qa/epilogue-single-only-20261102/snapshot.json';
const PLAN = 'docs/对白化与结尾过渡修订计划-20261102.md';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = rel => fs.readFileSync(path.join(ROOT, rel));
const json = rel => JSON.parse(read(rel));
function record(rel) {
  assert(!path.isAbsolute(rel) && !rel.split('/').includes('..'), '非法路径 '+rel);
  assert(fs.realpathSync(path.join(ROOT, rel)).startsWith(ROOT + path.sep), '链接越界 '+rel);
  const data = read(rel);
  return {path:rel, bytes:data.length, sha256:sha(data)};
}
function walk(rel) {
  return fs.readdirSync(path.join(ROOT, rel), {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e => e.isDirectory() ? walk(rel+'/'+e.name) : [rel+'/'+e.name]);
}
function write(rel, value) {
  const dest = path.join(ROOT, QA, rel);
  fs.mkdirSync(path.dirname(dest), {recursive:true});
  fs.writeFileSync(dest, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value,null,2)+'\n', {flag:'wx'});
}
function unchanged(records) {
  for (const item of records) assert.deepEqual(record(item.path), item, '冻结期间输入变化：'+item.path);
}
function capture() {
  assert(!fs.existsSync(path.join(ROOT, QA, 'baseline.json')), 'P0已冻结；不得覆盖原基线');
  const c = compile({pageSize:108}), B = json('docs/整合/bindings.json'), M = json('assets/current/manifest.json');
  const candidate = json(CANDIDATE), previous = json('qa/dialogue-story-plan-20261102/baseline.json');
  assert.equal(B.contentBuildId, c.ir.buildId);
  assert.deepEqual(B.sourceHashes, c.manifest.sourceHashes);
  assert.equal(B.manifestSha256, record('assets/current/manifest.json').sha256);
  assert.equal(B.version, M.version);
  const paths = new Set(candidate.inputs.map(x=>x.path));
  for (const dir of ['scenario','tools/compiler','tools/runtime','tools/integration','tools/ui-cinema','tools/art','system/sui-u','system/sui-cinema','docs/人物','docs/分支']) for (const f of walk(dir)) paths.add(f);
  for (const f of ['AGENTS.md','docs/美术资源规范.md','docs/CG调整清单.md',CANDIDATE,SNAPSHOT,'qa/epilogue-single-only-20261102/交接.md','qa/epilogue-single-only-20261102/final-verification.json','qa/dialogue-story-plan-20261102/baseline.json','qa/dialogue-story-plan-20261102/核对记录.md']) paths.add(f);
  const inputs = [...paths].sort().map(record);
  const drift = candidate.inputs.filter(x=>record(x.path).sha256!==x.sha256).map(x=>({path:x.path,candidateSha256:x.sha256,currentSha256:record(x.path).sha256}));
  const planningDrift = Object.entries(previous.sourceHashes).filter(([f,h])=>record(f).sha256!==h).map(([f,h])=>({path:f,planSha256:h,currentSha256:record(f).sha256}));
  for (const a of M.assets) {
    assert.equal(record(a.sourcePath).sha256, a.sourceSha256, a.assetId+'源图');
    assert.equal(record(a.runtimePath).sha256, a.runtimeSha256, a.assetId+'运行图');
  }
  const handoff = json(SNAPSHOT);
  for (const item of handoff.files) assert.equal(record(item.path).sha256, item.sha256, '最新交接失效 '+item.path);
  const bmap = new Map(B.bindings.map(b=>[b.anchor.nodeId,b]));
  const displays = c.ir.nodes.filter(n=>['text','choice'].includes(n.op));
  assert.equal(bmap.size, B.bindings.length);assert.equal(displays.length,bmap.size);
  for (const n of displays) {
    assert.equal(bmap.get(n.id)?.anchor.file,'scenario/'+n.source.file);
    assert.equal(bmap.get(n.id)?.anchor.sha256,n.source.sha256);
  }
  const codes = ['C01','C02','C03','XM','ZZ','MY','PI','HQ','FR','D36','EPH','EPL'];
  const fileList = Object.keys(c.ir.entries), fileCodes = Object.fromEntries(fileList.map((f,i)=>['scenario/'+f,codes[i]]));
  assert.deepEqual(fileList, ['第一章-回到毕节.md','第二章-十四天.md','第三章-选一条路.md','罗小满-练习本.md','周栀-十一点四十七分.md','孟遥-旧题.md','飘-空白页.md','黄球球-门后.md','朋友与职业-夜班.md','跨路线-第36天的消息.md','后日谈-他们的日子.md','后日谈-未写完的安排.md']);
  const groups = new Map(), counters = {};
  for (const n of c.ir.nodes.filter(n=>n.op==='text')) {
    const key = n.source.file+'\0'+n.paragraph;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }
  const paragraphs = [...groups.values()].map(nodes=>{
    nodes.sort((a,b)=>a.offset-b.offset);
    const n=nodes[0], file='scenario/'+n.source.file, b=bmap.get(n.id);
    const raw=read(file).toString('utf8').split('\n')[n.source.line-1];
    assert.equal(sha(raw),n.source.sha256);assert.equal(nodes.map(x=>x.text).join(''),raw.trim());
    for(const page of nodes) assert.equal(page.source.sha256,n.source.sha256);
    const serial=counters[file]=(counters[file]||0)+1;
    return {id:`T-${fileCodes[file]}-${String(serial).padStart(6,'0')}`,file,line:n.source.line,sha256:n.source.sha256,legacyParagraph:n.paragraph,legacyNodeIds:nodes.map(x=>x.id),legacyBindingIds:nodes.map(x=>bmap.get(x.id).bindingId),context:n.source.anchor,condition:b.condition,routeIds:b.routeIds,excerpt:raw.trim().slice(0,90)};
  });
  assert.equal(new Set(paragraphs.map(p=>p.id)).size,paragraphs.length);
  const protectedMarkers = fileList.map(file=>({file:'scenario/'+file,markers:read('scenario/'+file).toString('utf8').split('\n').flatMap((raw,index)=> /^(<!--|\*\*选择 |#### (?:[AB]｜|共同段|结局 )|### (?:罗小满|周栀|孟遥|飘|黄球球|朋友与职业)｜)/.test(raw.trim()) ? [{line:index+1,text:raw.trim()}] : [])}));
  const control = {contract:c.ir.contract,choices:c.ir.choices,files:protectedMarkers};
  const baseline = {
    schemaVersion:1,date:'2026-11-02',timeZone:'Asia/Shanghai',batch:'dialogue-p0-20261102',scope:'P0输入指纹与约定；不代表P1姓名实现、全稿审校或运行验收',
    git:{head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),statusBefore:cp.execFileSync('git',['-c','core.quotepath=false','status','--short'],{cwd:ROOT,encoding:'utf8'})},
    contractRevision:c.ir.contract.revision,contentBuildId:c.ir.buildId,bindingVersion:B.version,pageSize:108,
    counts:{...c.manifest.counts,paragraphs:paragraphs.length,bindings:B.bindings.length,assets:M.assets.length,cg:json('system/sui-u/gallery.registry.json').items.length,protectedMarkers:protectedMarkers.reduce((s,f)=>s+f.markers.length,0),fingerprintedFiles:inputs.length},
    fingerprint:sha(JSON.stringify(inputs)),inputs,sourceHashes:c.manifest.sourceHashes,compilerHashes:c.manifest.compilerHashes,
    references:{candidate:CANDIDATE,producerSnapshot:SNAPSHOT,plan:'qa/dialogue-story-plan-20261102/baseline.json'},candidateInputDrift:drift,planningInputDrift:planningDrift,
    boundary:{manuscriptRewritten:false,runtimeBuilt:false,imageDecoded:false,engineRun:false,browserRun:false,playerStorageAccessed:false,published:false}
  };
  for(const f of [...walk('scenario'),'assets/current/manifest.json','docs/整合/bindings.json','system/sui-cinema/manifest.json','system/sui-u/gallery.registry.json','AGENTS.md',PLAN,'TODO-v1.1.md']) write('before/'+f,read(f));
  write('baseline.json',baseline);
  write('paragraph-registry.json',{schemaVersion:1,baselineFingerprint:baseline.fingerprint,contentBuildId:c.ir.buildId,status:'已分配基线ID，尚未写入scenario或引擎',fileCodes,nextSerial:Object.fromEntries(Object.entries(counters).map(([f,n])=>[f,n+1])),paragraphs});
  write('protected-controls.json',control);
  write('asset-fingerprints.json',{version:M.version,assets:M.assets.map(a=>({assetId:a.assetId,type:a.type,source:record(a.sourcePath),runtime:record(a.runtimePath)}))});
  unchanged(inputs);
  write('capture-verification.json',{status:'pass',date:'2026-11-02',counts:baseline.counts,baselineFingerprint:baseline.fingerprint,sourceAndCompilerMatchBinding:true,displayCoverage:true,paragraphReconstruction:true,uniqueStableIds:true,adoptedAssetHashesMatch:true,handoffFilesVerified:handoff.files.length,inputsUnchanged:true,candidateInputDrift:drift,planningInputDrift:planningDrift});
  console.log(JSON.stringify({status:'pass',...baseline.counts,contentBuildId:c.ir.buildId,candidateInputDrift:drift,planningInputDrift:planningDrift},null,2));
}
function verify() {
  const b=json(QA+'/baseline.json');unchanged(b.inputs);
  const c=compile({pageSize:b.pageSize});assert.equal(c.ir.buildId,b.contentBuildId);assert.deepEqual(c.manifest.sourceHashes,b.sourceHashes);
  const registry=json(QA+'/paragraph-registry.json');assert.equal(registry.baselineFingerprint,b.fingerprint);
  for(const p of registry.paragraphs) assert.equal(sha(read(p.file).toString('utf8').split('\n')[p.line-1]),p.sha256);
  console.log(JSON.stringify({status:'pass',fingerprintedFiles:b.inputs.length,paragraphs:registry.paragraphs.length,contentBuildId:c.ir.buildId}));
}
if (require.main === module) {
  try { const mode=process.argv[2]; assert(['capture','verify'].includes(mode)&&process.argv.length===3,'用法：node tools/story-revision/p0-baseline.cjs capture|verify'); mode==='capture'?capture():verify(); }
  catch(e) { console.error(e.stack);process.exitCode=1; }
}
module.exports={ROOT,QA,record,json,read,sha};
