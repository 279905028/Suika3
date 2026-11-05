'use strict';
// Preserve the immutable P4 adoption record while explicitly freezing a runtime-only revision.
const {assert,DOC,json,fp,digest}=require('./common.cjs');
function verifyRuntimePatch(rel){
  assert(typeof rel==='string'&&rel.startsWith('qa/')&&!rel.split('/').includes('..'),'运行补丁清单须位于本工程qa/');
  const base=json(DOC+'/freeze.json'),{fingerprint,...body}=base;
  assert.equal(digest(body),fingerprint,'采用冻结清单指纹错误');
  const patch=json(rel);assert.equal(patch.schemaVersion,'sui-runtime-patch-v1');
  assert.equal(patch.baseFingerprint,fingerprint,'补丁基线不同');
  const changed=new Map(patch.files.map(f=>[f.path,f]));assert.equal(changed.size,patch.files.length);
  for(const f of patch.files)assert(/^(tools\/(runtime|integration\/runtime|story-revision\/p4-integration)\/.*\.(cjs|js|ray|css)|tools\/story-revision\/p4-adoption\/build\.cjs)$/.test(f.path),'运行补丁不得更改正文、绑定、美术或历史记录：'+f.path);
  for(const old of base.files){
    const current=fp(old.path),change=changed.get(old.path);
    if(change){
      assert.equal(change.beforeSha256,old.sha256,'补丁原始指纹错误：'+old.path);
      assert.equal(change.afterSha256,current.sha256,'补丁输入漂移：'+old.path);
      assert.notEqual(current.sha256,old.sha256,'补丁包含未改变文件：'+old.path);changed.delete(old.path);
    }else assert.equal(current.sha256,old.sha256,'未登记的采用输入变化：'+old.path);
  }
  assert.equal(changed.size,0,'补丁包含不属于基线的覆盖文件');
  return {manifest:fp(rel),baseFingerprint:fingerprint,files:patch.files};
}
module.exports={verifyRuntimePatch};
