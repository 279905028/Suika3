#!/usr/bin/env node
'use strict';
// 只创建P4-01冻结交付；旧来源/正式正文/资源/绑定均只读，不生成可玩包。
const C = require('./common.cjs');
const { fs, path, assert, hash, ROOT, DOC, QA, P3, P3_BUILD, PACKS, EXPECTED, read, json, digest, fp, write, owner, guards, envelope } = C;
const { compile } = require('../../compiler/compile.cjs');

function createMaps(compiled, legacy, registry, mappings, bindings) {
  const ir = compiled.ir, R = ir.contract, byOld = new Map(registry.paragraphs.map(p => [p.id, p]));
  const provenance = new Map(), oldSeen = new Set();
  for (const row of mappings.mappings) {
    assert.equal(row.conditionChanged, false, '来源映射不能改变条件');
    for (const id of row.oldIds) { assert(byOld.has(id), '未知旧段'); oldSeen.add(id); }
    for (const id of row.newIds) {
      assert(!provenance.has(id), '来源映射新ID重复');
      provenance.set(id, { operation: row.operation, oldIds: row.oldIds, reason: row.reason });
    }
  }
  assert.equal(oldSeen.size, 3018);
  const oldBindings = new Map(bindings.bindings.map(b => [b.anchor.nodeId, b]));
  const oldNodes = new Map(legacy.ir.nodes.map(n => [n.id, n]));
  const g = guards(ir), paragraphs = new Map();
  const nodes = ir.nodes.filter(n => ['text', 'choice'].includes(n.op)).map(n => {
    const route = R.routes.find(r => r.file === n.source.file);
    const source = provenance.get(n.paragraph);
    if (n.op === 'text') assert(source, '新段缺来源映射：' + n.paragraph);
    const oldIds = source?.oldIds || [];
    const legacyNodeIds = n.op === 'choice' ? [n.id] : [...new Set(oldIds.flatMap(id => byOld.get(id).legacyNodeIds))];
    for (const id of legacyNodeIds) assert(oldNodes.has(id) && oldBindings.has(id), '旧节点或绑定不可追溯：' + id);
    const row = {
      nodeId: n.id, op: n.op, paragraphId: n.paragraph || null, packageId: owner(n.source.file, R),
      source: { file: 'scenario/' + n.source.file, candidateFile: 'docs/修订协作/P3-独立审读-20261103/正文/' + n.source.file,
        lineHint: n.source.line, context: n.source.anchor, sha256: n.source.sha256 },
      page: n.op === 'text' ? { index: n.offset / 108 + 1, offset: n.offset, text: n.text } : null,
      textMeta: n.textMeta || null,
      choice: n.op === 'choice' ? { id: n.choice, question: ir.choices[n.choice].question, options: ir.choices[n.choice].options.map(({ value, text }) => ({ value, text })) } : null,
      condition: g.get(n.id), routeIds: route ? [route.id] : [],
      entryGate: route ? { type: 'route', value: route.id } : n.source.file === R.day36.sharedSource.file ? { type: 'sharedEvent', value: R.day36.sharedSource.anchor, routes: R.day36.calls.map(c => c.routeId), relation: 'LOW' } : R.epilogues.rules.some(r => r.target?.file === n.source.file) ? { type: 'epilogue', value: n.source.file, rules: R.epilogues.rules.filter(r => r.target?.file === n.source.file) } : null,
      lexicalNextNodeId: n.next || null,
      legacy: { oldStableIds: oldIds, nodeIds: legacyNodeIds, bindingIds: legacyNodeIds.map(id => oldBindings.get(id).bindingId), use: 'provenance-only' }
    };
    if (n.op === 'text') {
      if (!paragraphs.has(n.paragraph)) paragraphs.set(n.paragraph, { paragraphId: n.paragraph, packageId: row.packageId, source: row.source,
        textMeta: n.textMeta, condition: row.condition, routeIds: row.routeIds, nodeIds: [], text: '', provenance: source,
        legacy: row.legacy, bindingReview: 'pending' });
      const p = paragraphs.get(n.paragraph);
      assert.equal(p.condition, row.condition); assert.deepEqual(p.textMeta, row.textMeta);
      p.nodeIds.push(n.id); p.text += n.text;
    }
    return row;
  });
  assert.equal(paragraphs.size, 4748); assert.equal(provenance.size, paragraphs.size);
  for (const p of paragraphs.values()) assert.equal(hash(p.text), p.source.sha256, '分页重组不符原段');
  const packs = PACKS.map((packageId, i) => {
    const ns = nodes.filter(n => n.packageId === packageId), ps = [...paragraphs.values()].filter(p => p.packageId === packageId);
    assert.equal(ps.length, EXPECTED[i], '段落分包数量');
    return { packageId, files: [...new Set(ns.map(n => n.source.candidateFile))], paragraphIds: ps.map(p => p.paragraphId), nodeIds: ns.map(n => n.nodeId),
      counts: { paragraphs: ps.length, textPages: ns.filter(n => n.op === 'text').length, choices: ns.filter(n => n.op === 'choice').length, displayNodes: ns.length } };
  });
  assert.equal(new Set(packs.flatMap(p => p.nodeIds)).size, nodes.length);
  return { nodes, paragraphs: [...paragraphs.values()], packs };
}

// 控制边界是审阅清单；可能的结构目的地不冒充已执行路径。
function boundaries(ir, maps) {
  const result = [], byId = new Map(ir.nodes.map(n => [n.id, n]));
  const add = (id, kind, file, from, targets, context = null) => {
    const pk = owner(file, ir.contract), targetPackages = [...new Set(targets.filter(Boolean).map(id => owner(byId.get(id).source.file, ir.contract)))];
    result.push({ boundaryId: id, kind, packageId: pk, fromNodeId: from, targetNodeIds: targets.filter(Boolean), targetPackages, context });
  };
  const R = ir.contract;
  for (const [file, entry] of Object.entries(ir.entries)) add('entry:' + entry, 'file-entry', file, null, [entry]);
  for (const n of ir.nodes) {
    let targets;
    if (n.op === 'branch') targets = [n.next, n.otherwise];
    else if (n.op === 'call') targets = [n.target];
    else if (n.op === 'return') targets = R.day36.calls.map(c => c.returnAnchor);
    else if (n.op === 'epilogue') targets = [...new Set(R.epilogues.rules.flatMap(r => r.target ? [r.target.anchor] : []))];
    else if (n.op === 'finish') {
      const i = R.storyEntry.common.indexOf(n.file);
      targets = i >= 0 ? [ir.entries[R.storyEntry.common[i + 1] || R.storyEntry.routeEntry]] : n.file === R.storyEntry.routeEntry ? R.routes.map(r => ir.entries[r.file]) : [];
    } else if (['choice', 'ending', 'event', 'freeze'].includes(n.op)) targets = [n.next];
    else continue;
    add(n.op + ':' + n.id, n.op, n.source.file, n.id, targets,
      n.op === 'branch' ? { condition: n.condition, meanings: ['true', 'false'] } : n.op === 'call' ? { route: n.route, returnTo: n.returnTo } : n.op === 'return' ? { returns: R.day36.calls } : n.op === 'epilogue' ? { rules: R.epilogues.rules, includesFinish: true } : null);
    if (n.op === 'branch') add('merge:' + n.id, 'branch-merge', n.source.file, n.id, [n.otherwise]);
  }
  for (const p of maps.paragraphs.filter(p => p.nodeIds.length > 1)) for (let i = 1; i < p.nodeIds.length; i++) add('page:' + p.nodeIds[i], 'pagination', path.basename(p.source.file), p.nodeIds[i - 1], [p.nodeIds[i]]);
  return result;
}

function legacyAnchors(maps, B) {
  const inverse = new Map();
  for (const p of maps.paragraphs) for (const id of p.legacy.bindingIds) {
    if (!inverse.has(id)) inverse.set(id, []);
    inverse.get(id).push(p.paragraphId);
  }
  const scenes = new Map(), cgs = new Map();
  for (const b of B.bindings) {
    for (const sceneId of new Set(b.restrictions.flatMap(t => t.match(/scene-\d+/g) || []))) {
      if (!scenes.has(sceneId)) scenes.set(sceneId, { sceneId, oldBindingIds: [], paragraphIds: [], choiceNodeIds: [] });
      const s = scenes.get(sceneId); s.oldBindingIds.push(b.bindingId); s.paragraphIds.push(...(inverse.get(b.bindingId) || []));
      if (maps.nodes.some(n => n.op === 'choice' && n.nodeId === b.anchor.nodeId)) s.choiceNodeIds.push(b.anchor.nodeId);
    }
    if (b.cgId) {
      if (!cgs.has(b.cgId)) cgs.set(b.cgId, { cgId: b.cgId, assetId: b.enter.cg.assetId, oldBindingIds: [], paragraphIds: [] });
      const cg = cgs.get(b.cgId); cg.oldBindingIds.push(b.bindingId); cg.paragraphIds.push(...(inverse.get(b.bindingId) || []));
    }
  }
  for (const row of [...scenes.values(), ...cgs.values()]) row.paragraphIds = [...new Set(row.paragraphIds)];
  assert.equal(cgs.size, 60);
  const issues = [
    { issueId: 'P0-13', key: 'CG066', reason: '坐姿/站立问题，P4-04须复核实际镜头', owners: ['P4-02-PI', 'P4-04', 'P4-05'] },
    { issueId: 'P0-18-CG025', key: 'CG025', reason: 'CG时段，P4-04须核对', owners: ['P4-02-ZZ', 'P4-04', 'P4-05'] },
    { issueId: 'P0-18-CG001', key: 'CG001', reason: '文字对比与遮挡', owners: ['P4-02-COMMON', 'P4-04', 'P4-05'] },
    { issueId: 'P0-18-scene-260', key: 'scene-260', reason: '消息与见面边界，不能由旧立绘继承现场', owners: ['P4-02-PI', 'P4-03'] }
  ].map(x => ({ ...x, status: 'pending', paragraphIds: (cgs.get(x.key) || scenes.get(x.key)).paragraphIds }));
  return { use: '仅定位与筛查，不是演出继承或新增图批准', scenes: [...scenes.values()], cgs: [...cgs.values()], issues };
}

function prepare() {
  assert(!fs.existsSync(path.join(ROOT, DOC, 'freeze.json')), '已冻结，不得覆盖；后续版本另立批次并由协调者登记');
  const p3 = json(P3 + '/input-manifest.json'), sourceMap = json(P3 + '/source-map.json');
  assert.equal(p3.contentBuildId, P3_BUILD); assert.equal(sourceMap.candidateBuildId, P3_BUILD);
  const paths = new Set(), add = (p, expected) => { const f = fp(p); if (expected) assert.equal(f.sha256, expected, '输入漂移：' + p); paths.add(p); return f; };
  for (const f of p3.files) { add(f.candidateFile, f.p3Sha256); write(QA + '/input/scenario/' + path.basename(f.file), read(f.candidateFile).toString()); }
  add(p3.routes.file, p3.routes.sha256); write(QA + '/input/scenario/routes.json', read(p3.routes.file).toString());
  const compiled = compile({ root: path.join(ROOT, QA, 'input'), textPolicy: 'required', pageSize: 108 });
  const again = compile({ root: path.join(ROOT, QA, 'input'), textPolicy: 'required', pageSize: 108 });
  assert.deepEqual(compiled, again); assert.equal(compiled.ir.buildId, P3_BUILD, 'P3构建指纹改变');
  const legacy = compile({ pageSize: 108 });
  const B = json('docs/整合/bindings.json'), M = json('assets/current/manifest.json');
  assert.equal(B.version, 'sui-i01-epilogues-20261102-v6'); assert.equal(B.version, M.version);
  assert.equal(hash(read('assets/current/manifest.json')), B.manifestSha256);
  assert.equal(B.bindings.length, 3085); assert.equal(M.assets.length, 226);
  assert.equal(new Set(B.bindings.map(b => b.anchor.nodeId)).size, B.bindings.length);
  assert.deepEqual(B.bindings.map(b => b.anchor.nodeId).sort(), legacy.ir.nodes.filter(n => ['text', 'choice'].includes(n.op)).map(n => n.id).sort());
  for (const [p, h] of Object.entries(B.sourceHashes)) add(p, h);
  for (const [p, h] of Object.entries(compiled.manifest.compilerHashes)) add(p, h);
  const oldNodes = new Map(legacy.ir.nodes.map(n => [n.id, n]));
  for (const b of B.bindings) { assert.equal(b.anchor.sha256, oldNodes.get(b.anchor.nodeId).source.sha256); assert.equal(b.anchor.file, 'scenario/' + oldNodes.get(b.anchor.nodeId).source.file); }
  for (const a of M.assets) {
    add(a.sourcePath, a.sourceSha256); add(a.runtimePath, a.runtimeSha256);
    assert.equal(fp(a.runtimePath).bytes, a.bytes);
    add(a.approval.evidence.path, a.approval.evidence.sha256); add(a.a11.path, a.a11.sha256);
  }
  for (const p of ['AGENTS.md', 'docs/美术资源规范.md', 'docs/美术/SUI-A01.md', 'docs/CG调整清单.md', 'docs/CG当前选择.json', 'docs/CG制作当前状态.json', 'docs/整合/interface-i01-v1.json', 'docs/整合/interface-v1.json', 'docs/整合/bindings.json', 'assets/current/manifest.json', 'system/sui-u/gallery.registry.json', 'system/sui-cinema/manifest.json', 'system/sui-u/png/reading-backdrop.png', 'assets/sources/20261030-cinema-ui/choice-layout.json', 'tools/integration/runtime/validate.cjs', 'tools/integration/runtime/presentation-full.cjs', 'tools/integration/runtime/presentation-full.ray', P3 + '/input-manifest.json', P3 + '/source-map.json', 'qa/dialogue-p0-20261102/paragraph-registry.json', 'qa/dialogue-p0-20261102/protected-controls.json', 'qa/scene-background-audit-20261102/report.json']) add(p);
  for (const folder of ['docs/人物', 'docs/分支']) for (const f of fs.readdirSync(path.join(ROOT, folder)).filter(f => f.endsWith('.md'))) add(folder + '/' + f);
  const maps = createMaps(compiled, legacy, json('qa/dialogue-p0-20261102/paragraph-registry.json'), sourceMap, B);
  const boundaryRows = boundaries(compiled.ir, maps), history = legacyAnchors(maps, B);
  const files = [...paths].sort().map(fp);
  const input = { schemaVersion: 'p4-input-v1', contentBuildId: P3_BUILD, pageSize: 108, textPolicy: 'required',
    legacy: { bindingVersion: B.version, recordedBuildId: B.contentBuildId, currentCompilerBuildId: legacy.ir.buildId, compatibility: 'source-hashes-and-node-anchors-verified; not-a-runtime-build' },
    counts: { paragraphs: maps.paragraphs.length, textPages: compiled.manifest.counts.pages, choiceNodes: compiled.manifest.counts.choices, displayNodes: maps.nodes.length, oldParagraphs: 3018, oldBindings: B.bindings.length, assets: M.assets.length, cg: history.cgs.length }, files };
  input.inputFingerprint = digest(input);
  write(DOC + '/input-manifest.json', input);
  write(DOC + '/node-map.json', { inputFingerprint: input.inputFingerprint, nodes: maps.nodes });
  write(DOC + '/paragraph-map.json', { inputFingerprint: input.inputFingerprint, paragraphs: maps.paragraphs });
  write(DOC + '/packages.json', { inputFingerprint: input.inputFingerprint, packages: maps.packs });
  write(DOC + '/boundaries.json', { inputFingerprint: input.inputFingerprint, interpretation: '结构审阅清单；目的地按控制/规则列全，不表示每个前后组合运行可达', boundaries: boundaryRows });
  write(DOC + '/legacy-index.json', { inputFingerprint: input.inputFingerprint, ...history });
  write(DOC + '/resources.baseline.json', { schemaVersion: 'p4-resources-v1', inputFingerprint: input.inputFingerprint,
    assets: M.assets.map(a => ({ assetId: a.assetId, type: a.type, source: { path: a.sourcePath, sha256: a.sourceSha256 }, runtime: { path: a.runtimePath, sha256: a.runtimeSha256 }, reviewStatus: 'pending', approvalEvidence: { path: a.approval.evidence.path, sha256: a.approval.evidence.sha256 }, checkEvidence: null })),
    cg: history.cgs.map(c => ({ cgId: c.cgId, assetId: c.assetId, registrationEvidence: { path: 'docs/CG当前选择.json', sha256: fp('docs/CG当前选择.json').sha256 } })) });
  for (const pack of maps.packs) {
    const head = envelope(pack.packageId, input.inputFingerprint), dir = DOC + '/templates/' + pack.packageId;
    write(dir + '/bindings.candidate.json', { ...head, bindings: pack.nodeIds.map(nodeId => ({ nodeId, binding: null })) });
    const units = [...maps.paragraphs.filter(p => p.packageId === pack.packageId).map(p => ({ unitId: p.paragraphId, nodeIds: p.nodeIds })), ...maps.nodes.filter(n => n.packageId === pack.packageId && n.op === 'choice').map(n => ({ unitId: n.nodeId, nodeIds: [n.nodeId] }))];
    write(dir + '/review.json', { ...head, reviews: units.map(u => ({ ...u, status: 'pending', decision: null, basis: '', needIds: [], unresolved: [] })) });
    write(dir + '/needs.json', { ...head, needs: [] });
    write(dir + '/boundary-states.json', { ...head, boundaries: boundaryRows.filter(b => b.packageId === pack.packageId).map(b => ({ boundaryId: b.boundaryId, status: 'pending', exitPolicy: 'clear-before-target', restorePolicy: 'recompute-destination', basis: '', unresolved: [] })) });
  }
  write(QA + '/compile-summary.json', { status: 'pass', buildId: compiled.ir.buildId, counts: compiled.manifest.counts, artifacts: compiled.manifest.outputs, deterministic: true, legacy: input.legacy, notRuntimeAcceptance: true });
  console.log(JSON.stringify({ status: 'prepared', ...input.counts, inputFingerprint: input.inputFingerprint, packages: maps.packs.map(p => ({ packageId: p.packageId, ...p.counts })) }, null, 2));
}

function seal() {
  assert(!fs.existsSync(path.join(ROOT, DOC, 'freeze.json')), '不得覆盖冻结记录');
  const files = [];
  function walk(dir) { for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) { const p = dir + '/' + f; if (fs.statSync(path.join(ROOT, p)).isDirectory()) walk(p); else files.push(fp(p)); } }
  walk(DOC); walk('tools/story-revision/p4-bindings');
  const freeze = { schemaVersion: 'p4-freeze-v1', inputFingerprint: json(DOC + '/input-manifest.json').inputFingerprint, files };
  freeze.interfaceFingerprint = digest(freeze);
  write(DOC + '/freeze.json', freeze);
  console.log(JSON.stringify({ status: 'frozen', files: files.length, interfaceFingerprint: freeze.interfaceFingerprint }));
}
if (require.main === module) { try { const args = process.argv.slice(2); assert(args.length === 1 && ['prepare', 'seal'].includes(args[0]), '用法：freeze.cjs prepare|seal'); args[0] === 'prepare' ? prepare() : seal(); } catch (e) { console.error(e.stack); process.exitCode = 1; } }
module.exports = { createMaps, boundaries, legacyAnchors, prepare, seal };
