#!/usr/bin/env node
'use strict';
// 本文件的中性画面、已审标签及资源通过状态仅是负例/正例夹具，绝非演出交付。
const C = require('./common.cjs');
const { assert, json, read, hash, fp, write, digest, DOC, QA, PACKS, parseCondition, neutral } = C;
const { loadContext, readPackage, resourceCatalog, validatePack } = require('./validate.cjs');
const { createMaps, boundaries, legacyAnchors } = require('./freeze.cjs');
const { compile } = require('../../compiler/compile.cjs');
const { model } = require('../../compiler/model.cjs');

function guardCoverage(ctx) {
  const ir = ctx.ir, R = ir.contract, m = model(ir), nodes = new Map(ir.nodes.map(n => [n.id, n]));
  const ast = new Map(ctx.nodes.map(n => [n.nodeId, parseCondition(n.condition, ir)]));
  const hits = new Map(ctx.nodes.map(n => [n.nodeId, 0])), boundary = new Map(ctx.boundaries.map(b => [b.boundaryId, b]));
  let calls = 0, returns = 0;
  function run(answers, state = m.fresh(), start = ir.entry) {
    const s = structuredClone(state); let pc = start, steps = 0;
    while (pc) {
      assert(++steps < ir.nodes.length * 3, '路径未终止'); const n = nodes.get(pc); assert(n); pc = n.next;
      if (hits.has(n.id)) {
        const row = ctx.byNode.get(n.id), conditions = ast.get(n.id);
        assert(!conditions.length || m.evaluate(conditions, s), '可达节点与冻结条件不符：' + n.id);
        if (row.routeIds.length) assert(row.routeIds.includes(s.route), '可达路线归属不符');
        const gate = row.entryGate;
        if (gate?.type === 'sharedEvent') assert(s.frame && s.relation === 'LOW' && gate.routes.includes(s.route));
        if (gate?.type === 'epilogue') assert(s.dispatched && s.epilogue === gate.value, '后日谈门禁错误');
        hits.set(n.id, hits.get(n.id) + 1);
      }
      switch (n.op) {
        case 'branch': pc = m.evaluate(n.condition, s) ? n.next : n.otherwise; break;
        case 'text': case 'anchor': break;
        case 'choice': if (!Object.hasOwn(answers, n.choice)) return { s, waiting: n.choice }; m.choose(s, n.choice, answers[n.choice]); break;
        case 'freeze': m.freeze(s); break;
        case 'event': m.event(s, n.event); break;
        case 'call': assert(!s.frame && s.route === n.route && s.relation === 'LOW'); s.frame = { returnTo: n.returnTo }; pc = n.target; calls++; break;
        case 'return': assert(s.frame); pc = s.frame.returnTo; s.frame = null; m.event(s, R.day36.eventId); returns++; break;
        case 'ending': m.ending(s, n.ending); break;
        case 'epilogue': pc = m.dispatch(s); if (!pc) s.status = 'complete'; break;
        case 'finish': {
          const i = R.storyEntry.common.indexOf(n.file);
          if (i >= 0) pc = ir.entries[R.storyEntry.common[i + 1] || R.storyEntry.routeEntry];
          else if (n.file === R.storyEntry.routeEntry) pc = ir.entries[R.routes.find(r => r.id === s.route).file];
          else { assert(s.ending && !s.frame); if (!s.dispatched) assert.equal(m.dispatch(s), null); s.status = 'complete'; pc = null; }
          break;
        }
        default: throw Error('未知控制');
      }
      const b = boundary.get(n.op + ':' + n.id);
      if (b && pc) assert(b.targetNodeIds.includes(pc), '边界缺真实跳转：' + b.boundaryId);
    }
    m.validate(s); return { s, waiting: null };
  }
  function* answers(ids) { for (let mask = 0; mask < 2 ** ids.length; mask++) yield Object.fromEntries(ids.map((id, i) => [id, mask >> i & 1 ? 'B' : 'A'])); }
  const commonIds = Object.values(ir.choices).filter(c => R.storyEntry.common.includes(c.source.file)).map(c => c.id), bases = {};
  let common = 0, routes = 0; const endings = new Set();
  for (const a of answers(commonIds)) { const r = run(a); assert.equal(r.waiting, R.storyEntry.routeChoice); if (r.s.events.includes(R.hiddenEntry.readEvent)) bases[r.s.relation] ??= r.s; common++; }
  for (const route of R.routes) for (const relation of ['HIGH', 'LOW']) {
    const ids = Object.values(ir.choices).filter(c => c.source.file === route.file && (route.id !== 'piao' || (c.id === route.lowPathChoice) === (relation === 'LOW'))).map(c => c.id);
    for (const a of answers(ids)) { const r = run({ ...a, [R.storyEntry.routeChoice]: route.id }, bases[relation], ir.entries[R.storyEntry.routeEntry]); assert.equal(r.s.status, 'complete'); endings.add(r.s.ending); routes++; }
  }
  assert.equal(common, 32768); assert.equal(routes, 2818); assert.equal(endings.size, 14); assert.equal(calls, returns);
  assert.deepEqual([...hits].filter(([, n]) => !n), [], '新显示节点不可达');
  return { commonCombinations: common, routeCombinations: routes, endings: endings.size, sharedCalls: calls, sharedReturns: returns, reachedDisplayNodes: hits.size };
}

function verify({ requireSeal = true, outputPath = QA + '/verification' + (requireSeal ? '-final' : '-development') + '.json' } = {}) {
  assert(/^qa\/dialogue-p4-P4-01-[^/]+\/[^/]+\.json$/.test(outputPath), '复验只写P4-01的新QA报告');
  assert(!C.fs.existsSync(C.path.join(C.ROOT, outputPath)), '报告已存在；请用--out另存新批次，不覆盖证据');
  const ctx = loadContext({ requireSeal }), report = { status: 'running', inputFingerprint: ctx.input.inputFingerprint,
    scope: 'P4-01冻结、映射、格式及离线条件/边界检查；夹具不构成正式审阅、资源通过或运行验收', checks: [], negativeCases: [] };
  const check = (name, fn) => { const result = fn(); report.checks.push({ name, status: 'pass', result }); };
  check('重新生成映射与两次编译保持一致', () => {
    const schemaSource = require('./schema.cjs'), schemaFile = json(DOC + '/schemas.json');
    assert.deepEqual(schemaFile.$defs, schemaSource.defs); assert.deepEqual(schemaFile.schemas, schemaSource.schemas);
    const a = compile({ root: C.path.join(C.ROOT, QA, 'input'), pageSize: 108, textPolicy: 'required' });
    const b = compile({ root: C.path.join(C.ROOT, QA, 'input'), pageSize: 108, textPolicy: 'required' });
    assert.deepEqual(a, b); assert.equal(a.ir.buildId, C.P3_BUILD);
    const B = json('docs/整合/bindings.json');
    const maps = createMaps(a, compile({ pageSize: 108 }), json('qa/dialogue-p0-20261102/paragraph-registry.json'), json(C.P3 + '/source-map.json'), B);
    assert.deepEqual(maps.nodes, ctx.nodes); assert.deepEqual(maps.paragraphs, ctx.paragraphs); assert.deepEqual(maps.packs, ctx.packages);
    assert.deepEqual(boundaries(a.ir, maps), ctx.boundaries);
    const historical = json(DOC + '/legacy-index.json'); const { inputFingerprint, ...rest } = historical;
    assert.deepEqual(legacyAnchors(maps, B), rest);
    return { ...ctx.input.counts, boundaries: ctx.boundaries.length, mappedScenes: historical.scenes.length };
  });
  const resources = resourceCatalog(ctx), drafts = Object.fromEntries(PACKS.map(p => [p, readPackage(DOC + '/templates/' + p)]));
  check('七包草稿可读但全部不能作为完成交接', () => {
    for (const p of PACKS) { validatePack(ctx, p, drafts[p], { mode: 'draft', resources }); assert.throws(() => validatePack(ctx, p, drafts[p], { mode: 'handoff', resources }), /未审/); }
    return { draftAccepted: 7, handoffRejected: 7 };
  });
  // 不落盘的人工已审模拟，只用于验证门禁正向路径。
  const fixture = structuredClone(drafts['P4-02-COMMON']);
  for (const row of fixture.bindings.bindings) {
    const n = ctx.byNode.get(row.nodeId);
    row.binding = { bindingId: 'p4-' + n.nodeId, anchor: { nodeId: n.nodeId, file: n.source.file, sha256: n.source.sha256 }, condition: n.condition, routeIds: n.routeIds,
      enter: neutral(), exit: { at: 'next-node', restore: neutral() }, cgId: null, fullView: false, restrictions: ['仅验证夹具，不是演出候选'] };
  }
  for (const r of fixture.review.reviews) { r.status = 'reviewed'; r.decision = 'neutral'; r.basis = '仅验证已审字段的夹具，不是人工逐段结论'; }
  for (const b of fixture.boundaries.boundaries) { b.status = 'reviewed'; b.basis = '仅边界门禁夹具'; }
  check('完整中性状态夹具可通过完成门禁（不落盘为候选）', () => validatePack(ctx, 'P4-02-COMMON', fixture, { mode: 'handoff', resources }).counts);
  function reject(name, mutate, expected, mode = 'handoff') {
    const d = structuredClone(fixture); mutate(d);
    assert.throws(() => validatePack(ctx, 'P4-02-COMMON', d, { mode, resources }), expected, name);
    report.negativeCases.push({ name, status: 'rejected-as-expected' });
  }
  reject('未知版本', d => d.bindings.schemaVersion = 'future', /不支持/);
  reject('未知字段', d => d.review.extra = true, /未知字段/);
  reject('过期输入', d => d.needs.inputFingerprint = '0'.repeat(64), /过期/);
  reject('错包身份', d => d.bindings.packageId = 'P4-02-PI', /包身份/);
  reject('缺正文页', d => d.bindings.bindings.shift(), /缺项/);
  reject('缺选择页', d => { d.bindings.bindings = d.bindings.bindings.filter(r => r.nodeId !== 'ROUTE-01'); }, /缺项/);
  reject('重复节点', d => d.bindings.bindings.push(d.bindings.bindings[0]), /重复/);
  reject('未知节点', d => d.bindings.bindings[0].nodeId = 'missing', /缺项/);
  reject('缺段落审阅', d => d.review.reviews.pop(), /缺项/);
  reject('缺边界状态', d => d.boundaries.boundaries.pop(), /缺项/);
  reject('跨包节点', d => d.bindings.bindings[0].nodeId = ctx.packages[1].nodeIds[0], /缺项/);
  reject('旧绑定直接套用', d => { d.bindings.bindings[0].binding = json('docs/整合/bindings.json').bindings[0]; }, /新绑定ID/);
  reject('旧来源指纹', d => d.bindings.bindings[0].binding.anchor.sha256 = '0'.repeat(64), /指纹/);
  reject('未知条件字段', d => d.bindings.bindings[0].binding.condition = 'UNKNOWN=A', /未知条件字段/);
  reject('未知条件值', d => d.bindings.bindings[0].binding.condition = 'PIAO_RELATION=MID', /非法条件值/);
  reject('放宽条件', d => { d.bindings.bindings.find(r => r.binding.condition !== 'ALL').binding.condition = 'ALL'; }, /条件须/);
  reject('提前读取未来选择', d => d.bindings.bindings[0].binding.condition = 'MY09-01=A', /条件须/);
  reject('新增路线门禁', d => d.bindings.bindings[0].binding.routeIds = ['piao'], /路线归属/);
  reject('未审段落', d => d.review.reviews[0].status = 'pending', /未审/);
  reject('未审边界', d => d.boundaries.boundaries[0].status = 'pending', /边界尚未/);
  reject('已审却没有依据', d => d.review.reviews[0].basis = '', /审阅依据/);
  reject('已审仍有未决项', d => d.review.reviews[0].unresolved.push('待确认'), /未决/);
  reject('空绑定冒充完成', d => d.bindings.bindings[0].binding = null, /空绑定/);
  const placement = (id, layer) => ({ assetId: id, layer, x: 0, y: 0, scale: 1, form: null, costume: null });
  reject('未知资源', d => d.bindings.bindings[0].binding.enter.background = placement('missing', 'bg'), /未知资源/);
  const bg = ctx.baseline.assets.find(a => a.type === 'background').assetId;
  reject('历史资源未做本批检查', d => d.bindings.bindings[0].binding.enter.background = placement(bg, 'bg'), /尚未通过/);
  reject('资源类型错误', d => d.bindings.bindings[0].binding.enter.characters = [placement(bg, 'center')], /类型/);
  reject('退出遗留CG', d => d.bindings.bindings[0].binding.exit.restore.cg = placement('cg-common-cg001', 'cg'), /尚未通过|restore/);
  reject('图鉴编号与画面不符', d => d.bindings.bindings[0].binding.cgId = 'CG001', /Expected values/);
  reject('选择全图标记', d => d.bindings.bindings.find(r => r.nodeId === 'ROUTE-01').binding.fullView = true, /Expected values/);
  reject('未知需求引用', d => d.review.reviews[0].needIds.push('missing'), /未知需求/);
  reject('修改恢复政策', d => d.boundaries.boundaries[0].restorePolicy = 'inherit', /不支持/);
  const pageIds = ctx.paragraphs.find(p => p.nodeIds.length > 1).nodeIds;
  reject('同段跨页画面不同', d => {
    const b = d.bindings.bindings.find(r => r.nodeId === pageIds[1]).binding;
    b.enter.background = placement(bg, 'bg'); b.exit.restore.background = placement(bg, 'bg');
    d.review.reviews.find(r => r.nodeIds.includes(pageIds[1])).decision = 'rebind';
  }, /分页画面不一致/, 'draft');
  reject('没有完整恢复状态', d => { delete d.bindings.bindings[0].binding.exit.restore.props; }, /缺字段/);
  const need = { needId: 'P4-02-COMMON-N001', resourceKey: 'fixture-bg', kind: 'background', action: 'reuse', ownerTask: 'P4-03',
    nodeIds: [fixture.bindings.bindings[0].nodeId], reason: '仅需求门禁夹具', constraints: [], existingAssetIds: [bg], proposedAssetId: bg, cgId: null, status: 'open', resolution: null };
  const addNeed = d => { d.needs.needs.push(structuredClone(need)); d.review.reviews[0].needIds.push(need.needId); };
  reject('未决缺图', addNeed, /未决需求/);
  reject('跨包缺图锚点', d => { addNeed(d); d.needs.needs[0].nodeIds = [ctx.packages[1].nodeIds[0]]; }, /跨包/);
  reject('制作包归属错误', d => { addNeed(d); d.needs.needs[0].ownerTask = 'P4-04'; }, /归属混用/);
  reject('关闭需求无证据', d => { addNeed(d); d.needs.needs[0].status = 'resolved'; d.needs.needs[0].resolution = { assetId: bg, reason: '夹具', evidence: [] }; }, /缺证据/);
  reject('新增美术无需求', d => d.review.reviews[0].decision = 'new-art', /须列需求/);
  check('真实资源草稿可填写，仍不能绕过资源复验', () => {
    const d = structuredClone(fixture), b = d.bindings.bindings[0].binding;
    b.enter.background = placement(bg, 'bg'); b.exit.restore.background = placement(bg, 'bg'); d.review.reviews[0].decision = 'reuse';
    validatePack(ctx, 'P4-02-COMMON', d, { mode: 'draft', resources });
    assert.throws(() => validatePack(ctx, 'P4-02-COMMON', d, { resources }), /尚未通过/);
    return { draft: 'pass', handoff: 'rejected-pending-resource-review' };
  });
  check('已复验资源/CG/需求的正向接口与61项CG扩展夹具', () => {
    // 证据仅在内存模拟，不写04/05目录，也不把模拟passed送入真实资源清单。
    const evidencePath = 'qa/dialogue-p4-P4-05-fixture/check.json', registrationPath = 'qa/dialogue-p4-P4-04-fixture/cg.json';
    const fixtureCtx = { ...ctx, checkFile: row => /-fixture\//.test(row.path) ? row : ctx.checkFile(row) };
    const catalog = structuredClone(ctx.baseline);
    for (const a of catalog.assets) { a.reviewStatus = 'passed'; a.checkEvidence = { path: evidencePath, sha256: 'a'.repeat(64) }; }
    const extra = structuredClone(catalog.assets.find(a => a.type === 'cg'));
    extra.assetId = 'fixture-cg999'; extra.source.path = 'assets/sources/p4-fixture/cg999.png'; extra.runtime.path = 'assets/sources/p4-fixture/cg999.webp';
    catalog.assets.push(extra); catalog.cg.push({ cgId: 'CG999', assetId: extra.assetId, registrationEvidence: { path: registrationPath, sha256: 'b'.repeat(64) } });
    const rr = resourceCatalog(fixtureCtx, catalog);
    assert.equal(rr.cgs.size, 61);
    const d = structuredClone(fixture), row = d.bindings.bindings[0];
    row.binding.enter.cg = placement(extra.assetId, 'cg'); row.binding.cgId = 'CG999'; row.binding.fullView = true; d.review.reviews[0].decision = 'new-art';
    const n = { ...structuredClone(need), resourceKey: 'fixture-cg999', kind: 'cg', action: 'new', ownerTask: 'P4-04', existingAssetIds: [], proposedAssetId: extra.assetId, cgId: 'CG999', status: 'resolved', resolution: { assetId: extra.assetId, reason: '仅测试解决需求', evidence: [{ path: evidencePath, sha256: 'a'.repeat(64) }] } };
    d.needs.needs.push(n); d.review.reviews[0].needIds.push(n.needId);
    validatePack(fixtureCtx, 'P4-02-COMMON', d, { mode: 'handoff', resources: rr });
    const bad = structuredClone(d); bad.bindings.bindings[0].binding.cgId = 'CG001';
    assert.throws(() => validatePack(fixtureCtx, 'P4-02-COMMON', bad, { resources: rr }), /CG编号/);
    const choice = structuredClone(d), from = structuredClone(choice.bindings.bindings[0].binding);
    const c = choice.bindings.bindings.find(b => b.nodeId === 'ROUTE-01'); c.binding.enter = from.enter; c.binding.cgId = from.cgId; c.binding.fullView = true;
    choice.review.reviews.find(r => r.unitId === 'ROUTE-01').decision = 'rebind';
    assert.throws(() => validatePack(fixtureCtx, 'P4-02-COMMON', choice, { resources: rr }), /选择节点禁止CG/);
    report.negativeCases.push({ name: 'CG编号与资源错配', status: 'rejected-as-expected' }, { name: '实际CG塞入选择节点', status: 'rejected-as-expected' });
    return { fixtureOnly: true, cgCount: 61, actualResourceReviews: 0, actualNewCG: 0 };
  });
  check('资源和CG登记拒绝非法引用及历史检查替代', () => {
    const mutations = [
      ['重复资源', d => d.assets.push(d.assets[0]), /重复/],
      ['资源假指纹', d => d.assets[0].runtime.sha256 = '0'.repeat(64), /漂移/],
      ['资源检查缺证据', d => d.assets[0].reviewStatus = 'passed', /缺批准/],
      ['旧检查冒充本批', d => { d.assets[0].reviewStatus = 'passed'; d.assets[0].checkEvidence = { path: 'qa/SUI-A11-20261029/pending-adoption.json', sha256: fp('qa/SUI-A11-20261029/pending-adoption.json').sha256 }; }, /历史A11/],
      ['退役CG复用', d => d.cg[0].cgId = [...ctx.retiredCG][0], /退役/],
      ['新CG未经04登记', d => d.cg[0].cgId = 'CG999', /P4-04登记/],
      ['重复CG登记', d => d.cg.push(d.cg[0]), /重复/]
    ];
    for (const [name, mutate, re] of mutations) { const d = structuredClone(ctx.baseline); mutate(d); assert.throws(() => resourceCatalog(ctx, d), re); report.negativeCases.push({ name, status: 'rejected-as-expected' }); }
    return mutations.length;
  });
  check('全路径上条件不预读、包归属、公共事件与后日谈边界', () => guardCoverage(ctx));
  check('受保护的正式文件与历史输入保持', () => {
    const rows = json(QA + '/protected-before.json');
    for (const r of rows) assert.equal(hash(read(r.path)), r.sha256, '任务外文件改变：' + r.path);
    return { unchanged: rows.length };
  });
  report.status = 'pass'; report.negativeCount = report.negativeCases.length;
  report.interfaceFingerprint = ctx.seal?.interfaceFingerprint || null;
  const target = C.path.join(C.ROOT, outputPath); let parent = C.path.dirname(target);
  while (!C.fs.existsSync(parent)) parent = C.path.dirname(parent);
  assert.equal(C.fs.realpathSync(parent), parent, '复验目录禁止符号链接');
  C.fs.mkdirSync(C.path.dirname(target), { recursive: true });
  C.fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, rejectedCases: report.negativeCount, counts: ctx.input.counts, paths: report.checks.find(c => c.name.startsWith('全路径')).result }, null, 2));
  return report;
}
if (require.main === module) { try {
  const args = process.argv.slice(2), opts = {};
  while (args.length) { const a = args.shift(); if (a === '--development') opts.requireSeal = false; else if (a === '--out' && args.length) opts.outputPath = args.shift(); else throw Error('用法：verify.cjs [--development] [--out qa/dialogue-p4-P4-01-新批次/verification.json]'); }
  verify(opts);
} catch (e) { console.error(e.stack); process.exitCode = 1; } }
module.exports = { verify, guardCoverage };
