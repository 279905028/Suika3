'use strict';
// 全字段封闭；最终绑定payload沿用SUI-I-1，不向旧运行器塞入审阅字段。
const { json, PACKS, P3_BUILD } = require('./common.cjs');
const str = { type: 'string', minLength: 1 };
const sha = { type: 'string', pattern: '^[0-9a-f]{64}$' };
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = items => ({ type: 'array', items, uniqueItems: true });
const en = values => ({ enum: values });
const nullable = schema => ({ anyOf: [{ type: 'null' }, schema] });
const evidence = obj({ path: str, sha256: sha });
const status = en(['pending', 'reviewed', 'blocked']);
const head = { schemaVersion: { const: 'p4-package-v1' }, packageId: en(PACKS), inputFingerprint: sha, contentBuildId: { const: P3_BUILD } };
const defs = { ...json('docs/整合/interface-v1.json').$defs };
const schemas = {
  bindings: obj({ ...head, bindings: arr(obj({ nodeId: str, binding: nullable({ $ref: '#/$defs/binding' }) })) }),
  review: obj({ ...head, reviews: arr(obj({ unitId: str, nodeIds: arr(str), status,
    decision: nullable(en(['reuse', 'rebind', 'neutral', 'new-art'])), basis: { type: 'string' }, needIds: arr(str), unresolved: arr(str) })) }),
  needs: obj({ ...head, needs: arr(obj({ needId: str, resourceKey: str,
    kind: en(['character', 'expression', 'background', 'prop', 'cg']), action: en(['reuse', 'offscreen', 'new', 'repair']),
    ownerTask: en(['P4-03', 'P4-04']), nodeIds: arr(str), reason: str, constraints: arr(str),
    existingAssetIds: arr(str), proposedAssetId: nullable(str), cgId: nullable({ type: 'string', pattern: '^CG[0-9]{3}$' }),
    status: en(['open', 'resolved', 'cancelled']), resolution: nullable(obj({ assetId: nullable(str), reason: str, evidence: arr(evidence) })) })) }),
  boundaries: obj({ ...head, boundaries: arr(obj({ boundaryId: str, status,
    exitPolicy: { const: 'clear-before-target' }, restorePolicy: { const: 'recompute-destination' }, basis: { type: 'string' }, unresolved: arr(str) })) }),
  resources: obj({ schemaVersion: { const: 'p4-resources-v1' }, inputFingerprint: sha,
    assets: arr(obj({ assetId: str, type: en(['character', 'background', 'prop', 'cg']), source: evidence, runtime: evidence,
      reviewStatus: en(['pending', 'passed', 'rework']), approvalEvidence: nullable(evidence), checkEvidence: nullable(evidence) })),
    cg: arr(obj({ cgId: { type: 'string', pattern: '^CG[0-9]{3}$' }, assetId: str, registrationEvidence: evidence })) })
};
module.exports = { defs, schemas };
