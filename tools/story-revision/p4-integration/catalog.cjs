'use strict';
// Extend the sealed P4-01 contract without changing its files or disguising evidence.
const C = require('./common.cjs');
const {assert, json, fp, digest, BASE, checkSchema} = C;
const V = require('../p4-bindings/validate.cjs');
const {defs, schemas} = require('../p4-bindings/schema.cjs');
function resourceCatalog(ctx, catalog) {
  checkSchema(catalog,schemas.resources,defs,'resources');
  const oldIds = new Set(ctx.baseline.cg.map(c=>c.cgId));
  const registrations = [BASE+'/P4-04/cg-registration.json',BASE+'/CG扩充20张/cg-registration.json'];
  const registered = new Map();
  for (const file of registrations) {
    const d=json(file); assert.equal(d.inputFingerprint,ctx.input.inputFingerprint); assert.equal(d.contentBuildId,ctx.input.contentBuildId);
    for (const row of d.newRegistrations) {
      assert(!registered.has(row.cgId),'新增登记编号重复');
      registered.set(row.cgId,{assetId:row.assetId,evidence:row.registrationEvidence || fp(file)});
    }
  }
  // Original validator still validates every asset and the unchanged old CG mapping.
  const resources=V.resourceCatalog(ctx,{...catalog,cg:catalog.cg.filter(c=>oldIds.has(c.cgId))});
  for (const old of ctx.baseline.cg) assert.equal(resources.cgs.get(old.cgId),old.assetId,'缺失旧CG编号');
  for (const old of ctx.baseline.assets) assert(resources.assets.has(old.assetId),'缺失原资源：'+old.assetId);
  const cgs=new Map(), usedAssets=new Set(), inspections=new Map();
  for (const cg of catalog.cg) {
    assert(!cgs.has(cg.cgId),'重复CG编号'); assert(!ctx.retiredCG.has(cg.cgId),'退役CG禁止复用');
    assert.equal(resources.assets.get(cg.assetId)?.type,'cg','CG资源缺失/类型错误');
    assert(!usedAssets.has(cg.assetId),'同一CG资源重复编号'); usedAssets.add(cg.assetId);
    if (!oldIds.has(cg.cgId)) {
      const r=registered.get(cg.cgId); assert(r,'新增编号未登记：'+cg.cgId); assert.equal(r.assetId,cg.assetId,'登记图片不符');
      assert.equal(cg.registrationEvidence.path,r.evidence.path,'登记须引用真实来源');
      assert.equal(cg.registrationEvidence.sha256,r.evidence.sha256,'登记证据指纹不符');ctx.checkFile(cg.registrationEvidence);
    }
    cgs.set(cg.cgId,cg.assetId);
  }
  for (const a of catalog.assets) {
    if (a.type==='cg') assert(usedAssets.has(a.assetId),'CG资源未登记');
    assert(a.checkEvidence,'缺少本批资源检查');ctx.checkFile(a.checkEvidence);
    const check=json(a.checkEvidence.path);assert.equal(check.taskId,'P4-05');assert.equal(check.inspectionStatus,'passed','资源复验未通过');
    assert.equal(check.assetId,a.assetId,'检查证据对应另一资源');assert.equal(check.type,a.type);
    for (const field of ['source','runtime']) assert.deepEqual(check[field],a[field],'复验文件与候选不符：'+a.assetId);
    assert.equal(check.visual.status,'passed','图片目视未通过');
    assert(Object.values(check.checks).every(v=>v===true),'技术检查未通过');
    inspections.set(a.assetId,check);
  }
  const oldOrder=json('system/sui-u/gallery.registry.json').items.map(x=>x.id);
  assert.deepEqual([...oldOrder].sort(),[...oldIds].sort(),'旧图鉴集合漂移');
  const order=[...oldOrder,...[...cgs.keys()].filter(id=>!oldIds.has(id)).sort((a,b)=>Number(a.slice(2))-Number(b.slice(2)))];
  const gallery={schemaVersion:1,orderSource:'P4-06: validated P4 catalog; old order preserved',pageSize:6,
    items:order.map(id=>({id,assetId:cgs.get(id),unlockVariable:'sui_cg_'+id,file:resources.assets.get(cgs.get(id)).runtime.path}))};
  return {...resources,cgs,inspections,gallery,registrations:registrations.map(fp),fingerprint:digest(catalog)};
}
module.exports={resourceCatalog};
