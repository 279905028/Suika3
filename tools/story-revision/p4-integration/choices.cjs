'use strict';
const {assert,json,fp,digest} = require('./common.cjs');
function compareChoices(ir, layout=json('assets/sources/20261030-cinema-ui/choice-layout.json'), cinema=json('system/sui-cinema/manifest.json')) {
  const expected=Object.values(ir.choices), old=new Map(layout.choices.map(c=>[c.id,c]));
  assert.equal(old.size,layout.choices.length,'选项来源重复');
  assert.deepEqual([...old.keys()].sort(),expected.map(c=>c.id).sort(),'选项集合变化，须重建相关图');
  assert.deepEqual(Object.keys(cinema.choices).sort(),expected.map(c=>c.id).sort(),'选项贴图登记缺项');
  const rows=[];
  for(const c of expected) {
    const prev=old.get(c.id), textures=cinema.choices[c.id];
    assert.equal(c.question,prev.question,'选择题干变化：'+c.id);
    assert.deepEqual(c.options.map(o=>({value:o.value,text:o.text})),prev.options.map(o=>({value:o.value,text:o.text})),'选择文案/顺序/值变化，须重建：'+c.id);
    assert.deepEqual(textures.map(o=>o.value),c.options.map(o=>o.value),'贴图值/顺序错误');
    for(const t of textures) {
      const r=cinema.resources.find(r=>r.path===t.path);assert(r,'贴图未登记');assert.equal(fp(t.path).sha256,r.sha256,'选项图被改写');
    }
    rows.push({id:c.id,question:c.question,options:c.options.map((o,i)=>({value:o.value,text:o.text,...fp(textures[i].path)})),decision:'reuse-byte-identical'});
  }
  return {contentBuildId:ir.buildId,choices:rows.length,options:rows.reduce((n,r)=>n+r.options.length,0),regenerated:0,comparisonFingerprint:digest(rows),rows};
}
module.exports={compareChoices};
