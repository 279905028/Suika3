#!/usr/bin/env node
'use strict';
const C = require('./common.cjs');
const { fs, path, assert, hash, ROOT, DOC, P3_BUILD, PACKS, json, read, fp, digest, parseCondition, checkSchema } = C;
const { defs, schemas } = require('./schema.cjs');
const { parse } = require('../../compiler/parse.cjs');
const NAMES = { bindings: 'bindings.candidate.json', review: 'review.json', needs: 'needs.json', boundaries: 'boundary-states.json' };
const nonempty = (s, label) => assert(typeof s === 'string' && s.trim().length > 0, label + '须有人工审阅依据');
const equalSet = (got, want, label) => { assert.equal(new Set(got).size, got.length, label + '重复'); assert.deepEqual([...got].sort(), [...want].sort(), label + '缺项/越界'); };

function loadContext({ requireSeal = true } = {}) {
  const input = json(DOC + '/input-manifest.json');
  const { inputFingerprint, ...body } = input;
  assert.equal(digest(body), inputFingerprint, '输入清单自身指纹错误'); assert.equal(input.contentBuildId, P3_BUILD);
  const checked = new Map();
  function checkFile(row) {
    const f = checked.get(row.path) || fp(row.path); checked.set(row.path, f);
    assert.equal(f.sha256, row.sha256, '冻结输入漂移：' + row.path);
    if ('bytes' in row) assert.equal(f.bytes, row.bytes, '冻结长度漂移：' + row.path);
    return f;
  }
  input.files.forEach(checkFile);
  let seal = null;
  if (requireSeal) {
    seal = json(DOC + '/freeze.json'); const { interfaceFingerprint, ...sealedBody } = seal;
    assert.equal(digest(sealedBody), interfaceFingerprint, '接口冻结自身指纹错误');
    assert.equal(seal.inputFingerprint, inputFingerprint);
    seal.files.forEach(checkFile);
  }
  const nodes = json(DOC + '/node-map.json'), paragraphs = json(DOC + '/paragraph-map.json'), packages = json(DOC + '/packages.json'), boundaries = json(DOC + '/boundaries.json');
  for (const d of [nodes, paragraphs, packages, boundaries]) assert.equal(d.inputFingerprint, inputFingerprint);
  const R = json('scenario/routes.json');
  const sources = Object.fromEntries([...new Map(nodes.nodes.map(n => [path.basename(n.source.file), n.source.candidateFile])).entries()].map(([file, p]) => [file, read(p).toString()]));
  const ir = parse(R, sources, { pageSize: 108, textPolicy: 'required' });
  const ctx = { input, seal, ir, nodes: nodes.nodes, byNode: new Map(nodes.nodes.map(n => [n.nodeId, n])), paragraphs: paragraphs.paragraphs,
    packages: packages.packages, boundaries: boundaries.boundaries, checkFile,
    retiredCG: new Set(json('docs/CG当前选择.json').retiredRouteIds), baseline: json(DOC + '/resources.baseline.json') };
  equalSet(ctx.nodes.map(n => n.nodeId), ir.nodes.filter(n => ['text', 'choice'].includes(n.op)).map(n => n.id), '节点映射');
  return ctx;
}

function resourceCatalog(ctx, catalog = ctx.baseline) {
  checkSchema(catalog, schemas.resources, defs, 'resources');
  assert.equal(catalog.inputFingerprint, ctx.input.inputFingerprint, '资源清单来源版本不符');
  const assets = new Map(), cgs = new Map(), runtimePaths = new Set();
  for (const a of catalog.assets) {
    assert(!assets.has(a.assetId), '重复资源ID'); assets.set(a.assetId, a);
    assert(!runtimePaths.has(a.runtime.path), '同一运行图须复用同一资源ID'); runtimePaths.add(a.runtime.path);
    const original = ctx.baseline.assets.find(x => x.assetId === a.assetId);
    if (original) assert.equal(a.type, original.type, '既有资源ID不得换类型');
    for (const p of [a.source, a.runtime]) {
      assert(p.path.startsWith('assets/sources/') || p.path.startsWith('assets/current/'), '资源须在登记的素材目录'); ctx.checkFile(p);
    }
    if (a.approvalEvidence) ctx.checkFile(a.approvalEvidence);
    if (a.checkEvidence) ctx.checkFile(a.checkEvidence);
    if (a.reviewStatus === 'passed') {
      assert(a.approvalEvidence && a.checkEvidence, '通过资源缺批准/本批检查证据');
      assert(a.checkEvidence.path.startsWith('qa/dialogue-p4-'), '历史A11不能替代本批P4复验');
    }
  }
  for (const cg of catalog.cg) {
    assert(!cgs.has(cg.cgId), '重复CG编号'); assert(!ctx.retiredCG.has(cg.cgId), '退役CG禁止复用');
    assert.equal(assets.get(cg.assetId)?.type, 'cg', 'CG登记缺图或类型错误');
    ctx.checkFile(cg.registrationEvidence); cgs.set(cg.cgId, cg.assetId);
    const old = ctx.baseline.cg.find(c => c.cgId === cg.cgId);
    if (old) assert.equal(cg.assetId, old.assetId, '旧CG编号不得改为另一资源ID');
    else assert(cg.registrationEvidence.path.startsWith('docs/修订协作/P4-演出与美术/P4-04/') || cg.registrationEvidence.path.startsWith('qa/dialogue-p4-P4-04-'), '新CG编号须P4-04登记证据');
  }
  return { assets, cgs, fingerprint: digest(catalog) };
}

function placements(state) {
  return [...(state.background ? [state.background] : []), ...state.characters, ...state.props, ...(state.cg ? [state.cg] : [])];
}
function stateCheck(state, resources, ready) {
  const used = new Set();
  for (const [key, ps] of Object.entries({ background: state.background ? [state.background] : [], characters: state.characters, props: state.props, cg: state.cg ? [state.cg] : [] })) {
    const type = { background: 'background', characters: 'character', props: 'prop', cg: 'cg' }[key];
    const layers = { background: ['bg'], characters: ['left', 'center', 'right'], props: ['prop1', 'prop2'], cg: ['cg'] }[key];
    for (const p of ps) {
      assert(resources.assets.has(p.assetId), '未知资源：' + p.assetId);
      const a = resources.assets.get(p.assetId);
      assert.equal(a.type, type, '资源类型与图层不符'); assert(layers.includes(p.layer), '非法显示层');
      assert(!used.has(p.layer), '重复显示层'); used.add(p.layer);
      if (ready) assert.equal(a.reviewStatus, 'passed', '引用资源尚未通过本批P4检查：' + p.assetId);
    }
  }
}

function validatePack(ctx, packId, documents, { mode = 'handoff', resources = resourceCatalog(ctx) } = {}) {
  assert(['draft', 'handoff'].includes(mode), '模式只能draft或handoff');
  const ready = mode === 'handoff', pack = ctx.packages.find(p => p.packageId === packId);
  assert(pack, '未知包归属');
  for (const [key, d] of Object.entries(documents)) { assert(NAMES[key], '未知交付文档'); checkSchema(d, schemas[key], defs, key); assert.equal(d.packageId, packId, '包身份不符'); assert.equal(d.inputFingerprint, ctx.input.inputFingerprint, '过期输入指纹'); }
  equalSet(Object.keys(documents), Object.keys(NAMES), '交付文件');
  const { bindings, review, needs, boundaries } = documents;
  equalSet(bindings.bindings.map(b => b.nodeId), pack.nodeIds, '显示节点覆盖');
  const unitMap = new Map(ctx.paragraphs.filter(p => p.packageId === packId).map(p => [p.paragraphId, p.nodeIds]));
  for (const n of ctx.nodes.filter(n => n.packageId === packId && n.op === 'choice')) unitMap.set(n.nodeId, [n.nodeId]);
  equalSet(review.reviews.map(r => r.unitId), [...unitMap.keys()], '段落/选择审阅覆盖');
  const reviewByUnit = new Map(), needById = new Map();
  for (const need of needs.needs) {
    assert(need.needId.startsWith(packId + '-'), '需求ID须包前缀');
    assert(!needById.has(need.needId), '重复需求ID'); needById.set(need.needId, need);
    assert(need.nodeIds.length, '需求须有新节点锚点');
    for (const id of need.nodeIds) assert(ctx.byNode.get(id)?.packageId === packId, '需求锚点跨包或未知');
    assert.equal(need.ownerTask, need.kind === 'cg' ? 'P4-04' : 'P4-03', '资源/CG制作归属混用');
    for (const id of need.existingAssetIds) assert(resources.assets.has(id), '需求引用未知既有资源');
    if (need.cgId) { assert.equal(need.kind, 'cg'); assert(!ctx.retiredCG.has(need.cgId), '不能复用退役CG'); }
    if (need.kind !== 'cg') assert.equal(need.cgId, null);
    if (need.status === 'open') { assert.equal(need.resolution, null, '开放需求不能填已解决'); if (ready) throw Error('仍有未决需求：' + need.needId); }
    else {
      assert(need.resolution, '需求关闭缺处置'); assert(need.resolution.evidence.length, '需求关闭缺证据'); need.resolution.evidence.forEach(ctx.checkFile);
      const id = need.resolution.assetId;
      if (need.status === 'resolved' && need.action !== 'offscreen') {
        assert(id && resources.assets.has(id), '已解决需求缺有效资源');
        const a = resources.assets.get(id), type = need.kind === 'expression' ? 'character' : need.kind;
        assert.equal(a.type, type, '需求资源类型不符');
        if (need.proposedAssetId) assert.equal(id, need.proposedAssetId, '资源解决与提案不符');
        if (need.cgId) assert.equal(resources.cgs.get(need.cgId), id, '需求CG登记不符');
        if (ready) assert.equal(a.reviewStatus, 'passed', '需求资源未通过');
      } else assert.equal(id, null, '画外或取消需求不能偷偷引用图');
    }
  }
  for (const r of review.reviews) {
    equalSet(r.nodeIds, unitMap.get(r.unitId), '审阅节点归属'); reviewByUnit.set(r.unitId, r);
    for (const id of r.needIds) { const n = needById.get(id); assert(n, '未知需求引用'); assert(n.nodeIds.some(id => r.nodeIds.includes(id)), '需求与段落无关'); }
    if (r.status === 'reviewed') { nonempty(r.basis, r.unitId); assert(r.decision, '已审缺决策'); assert.deepEqual(r.unresolved, [], '已审仍有未决项'); }
    if (ready) assert.equal(r.status, 'reviewed', '存在未审/阻塞段落或选择：' + r.unitId);
  }
  for (const n of needs.needs) for (const id of n.nodeIds) {
    const node = ctx.byNode.get(id), unit = node.paragraphId || id;
    assert(reviewByUnit.get(unit).needIds.includes(n.needId), '需求没有回链至对应审阅段');
  }
  const seenBindings = new Set(), resolved = new Map(); let completed = 0;
  for (const row of bindings.bindings) {
    const n = ctx.byNode.get(row.nodeId), r = reviewByUnit.get(n.paragraphId || n.nodeId), b = row.binding;
    if (!b) { assert(!ready && r.status !== 'reviewed', '待审空绑定不能交付或标已审：' + row.nodeId); continue; }
    assert.equal(b.bindingId, 'p4-' + row.nodeId, '新绑定ID须由新节点生成，禁止沿用旧绑定ID');
    assert(!seenBindings.has(b.bindingId), '重复绑定ID'); seenBindings.add(b.bindingId);
    assert.deepEqual(b.anchor, { nodeId: n.nodeId, file: n.source.file, sha256: n.source.sha256 }, '锚点/来源指纹不符');
    parseCondition(b.condition, ctx.ir);
    assert.equal(b.condition, n.condition, '条件须逐字采用冻结映射，不能放宽/加门禁/读取未来选择');
    assert.deepEqual(b.routeIds, n.routeIds, '路线归属须与冻结源一致');
    stateCheck(b.enter, resources, ready); stateCheck(b.exit.restore, resources, ready);
    const base = { ...b.enter, cg: null };
    assert.deepEqual(b.exit.restore, base, 'exit.restore须为本页去CG后的完整底层，随后按目标页重算');
    if (b.enter.cg) {
      assert.equal(n.op, 'text', '选择节点禁止CG'); assert.equal(resources.cgs.get(b.cgId), b.enter.cg.assetId, 'CG编号未登记或与图片不符'); assert.equal(b.fullView, true);
    } else { assert.equal(b.cgId, null); assert.equal(b.fullView, false); }
    if (r.status === 'reviewed') {
      if (r.decision === 'neutral') assert.deepEqual(b.enter, C.neutral(), '留白决策与画面冲突');
      if (r.decision === 'reuse') for (const p of placements(b.enter)) assert(ctx.baseline.assets.some(a => a.assetId === p.assetId), '复用决策引用新资源');
      if (r.decision === 'new-art') assert(r.needIds.length > 0, '新增美术须列需求');
    }
    resolved.set(row.nodeId, b); completed++;
  }
  // 同段分页保持同画面/姓名；不把意外分页当作额外演出拍点。
  for (const ids of unitMap.values()) if (ids.length > 1) {
    const bs = ids.map(id => resolved.get(id)).filter(Boolean);
    for (const b of bs.slice(1)) assert.deepEqual({ enter: b.enter, exit: b.exit, cgId: b.cgId, fullView: b.fullView }, { enter: bs[0].enter, exit: bs[0].exit, cgId: bs[0].cgId, fullView: bs[0].fullView }, '同段分页画面不一致');
  }
  equalSet(boundaries.boundaries.map(b => b.boundaryId), ctx.boundaries.filter(b => b.packageId === packId).map(b => b.boundaryId), '边界审阅覆盖');
  for (const b of boundaries.boundaries) {
    if (b.status === 'reviewed') { nonempty(b.basis, b.boundaryId); assert.deepEqual(b.unresolved, [], '边界已审但未决'); }
    if (ready) assert.equal(b.status, 'reviewed', '边界尚未审阅：' + b.boundaryId);
  }
  return { status: 'pass', mode, packageId: packId, inputFingerprint: ctx.input.inputFingerprint, contentBuildId: P3_BUILD, resourceFingerprint: resources.fingerprint,
    counts: { ...pack.counts, reviewedUnits: review.reviews.filter(r => r.status === 'reviewed').length, assignedBindings: completed, needs: needs.needs.length, boundaries: boundaries.boundaries.length },
    handoffReady: ready, notRuntimeAcceptance: true };
}

function readPackage(directory) {
  assert(!path.isAbsolute(directory) && !directory.split('/').includes('..'), '包路径须为工程相对路径');
  return Object.fromEntries(Object.entries(NAMES).map(([key, file]) => [key, json(directory + '/' + file)]));
}
function cli() {
  const opts = { mode: 'handoff' }, args = process.argv.slice(2);
  while (args.length) { const k = args.shift(); assert(['--package', '--dir', '--mode', '--resources'].includes(k) && args.length, '参数错误'); opts[k.slice(2)] = args.shift(); }
  assert(PACKS.includes(opts.package), '须指定--package P4-02-包ID');
  const ctx = loadContext(), directory = opts.dir || DOC + '/templates/' + opts.package;
  const documents = readPackage(directory), resources = resourceCatalog(ctx, opts.resources ? json(opts.resources) : ctx.baseline);
  const result = validatePack(ctx, opts.package, documents, { mode: opts.mode, resources });
  const outputs = Object.values(NAMES).map(f => fp(directory + '/' + f));
  if (opts.mode === 'handoff') { const note = read(directory + '/交接.md').toString(); nonempty(note, '交接说明'); outputs.push(fp(directory + '/交接.md')); }
  result.outputs = outputs; result.outputFingerprint = digest(outputs); result.interfaceFingerprint = ctx.seal.interfaceFingerprint;
  result.resourceCatalog = fp(opts.resources || DOC + '/resources.baseline.json');
  console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) { try { cli(); } catch (e) { console.error(e.stack); process.exitCode = 1; } }
module.exports = { loadContext, resourceCatalog, validatePack, readPackage, NAMES, placements, equalSet };
