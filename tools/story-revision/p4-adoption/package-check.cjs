'use strict';
// 保留P4-01逐字段/完整状态检查，v2只扩展经过重冻结的版本头。
// 历史校验器不修改；本文件不对旧指纹作豁免。
const C=require('./common.cjs');
const {assert,parseCondition,checkSchema}=C;
const {defs,schemas:baseSchemas}=require('../p4-bindings/schema.cjs');
const {placements,equalSet,NAMES}=require('../p4-bindings/validate.cjs');
const nonempty=(s,label)=>assert(typeof s==='string'&&s.trim().length>0,label+'须有审阅依据');
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
  const schemas = structuredClone(baseSchemas);
  for (const key of Object.keys(NAMES)) { schemas[key].properties.schemaVersion.const='p4-package-v2'; schemas[key].properties.contentBuildId.const=ctx.input.contentBuildId; }
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
  return { status: 'pass', mode, packageId: packId, inputFingerprint: ctx.input.inputFingerprint, contentBuildId: ctx.input.contentBuildId, resourceFingerprint: resources.fingerprint,
    counts: { ...pack.counts, reviewedUnits: review.reviews.filter(r => r.status === 'reviewed').length, assignedBindings: completed, needs: needs.needs.length, boundaries: boundaries.boundaries.length },
    handoffReady: ready, notRuntimeAcceptance: true };
}

module.exports={validatePack};
