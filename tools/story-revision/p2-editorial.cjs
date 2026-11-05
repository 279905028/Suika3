'use strict';
const assert=require('node:assert/strict');
const corrections=require('./p2-editorial-corrections.json');

// Apply reviewed corrections after the route drafts are assembled. Existing IDs
// stay stable; restored source transitions receive their own IDs and mappings.
function applyEditorial(file,source,mappings){
 const changes=corrections.corrections.filter(c=>c.file===file);
 const inserts=corrections.insertBefore.filter(c=>c.file===file);
 const notes=corrections.notes.filter(c=>c.file===file);
 const byId=new Map(changes.map(c=>[c.id,c])),seen=new Set(),inserted=new Set();
 let result=source.replace(/^<!-- TEXT (.+) -->\n([^\n]+)/gm,(block,json,text)=>{
  const meta=JSON.parse(json),change=byId.get(meta.id);
  const mapping=mappings.find(m=>m.file===file&&m.newIds.includes(meta.id));
  assert(mapping,'校正锚点缺少来源映射：'+meta.id);
  const before=[];
  for(const item of inserts.filter(c=>c.beforeId===meta.id)){
   const entry=item.entry,id=entry.meta.id;
   assert(!inserted.has(id)&&!mappings.some(m=>m.newIds.includes(id)),'恢复过渡ID重复：'+id);
   assert.deepEqual(mapping.oldIds,item.sourceOldIds,'恢复过渡来源漂移：'+id);
   assert(item.sourceOldIds.length,'恢复过渡必须有原稿来源：'+id);
   assert(!/[\r\n]/.test(entry.text)&&entry.text.length,'恢复过渡必须单行：'+id);
   before.push('<!-- TEXT '+JSON.stringify(entry.meta)+' -->\n'+entry.text+'\n\n');
   mappings.push({...mapping,operation:'rewrite',newIds:[id],reason:item.reason,source:'P2',editorialReview:{batch:corrections.batch,category:item.category,restoredSourceTransition:true}});
   inserted.add(id);
  }
  if(change){
   assert(!seen.has(meta.id),'校正目标重复：'+meta.id);seen.add(meta.id);
   assert.deepEqual({meta,text},change.expected,'候选前稿漂移，须重新审读：'+meta.id);
   assert.deepEqual(mapping.oldIds,change.sourceOldIds,'校正来源漂移：'+meta.id);
   assert.equal(change.replacement.meta.id,meta.id,'校正不得更换已有ID');
   assert(!/[\r\n]/.test(change.replacement.text)&&change.replacement.text.length,'校正正文必须单行：'+meta.id);
   const previousOperation=mapping.operation;
   if(text!==change.replacement.text&&mapping.operation==='retag')mapping.operation='rewrite';
   mapping.editorialReview={batch:corrections.batch,category:change.category,reason:change.reason,previousOperation};
   mapping.reason+='；P2定稿校正：'+change.reason;
   block='<!-- TEXT '+JSON.stringify(change.replacement.meta)+' -->\n'+change.replacement.text;
  }
  return before.join('')+block;
 });
 assert.equal(seen.size,changes.length,'未命中的校正：'+file);
 assert.equal(inserted.size,inserts.length,'未命中的恢复过渡：'+file);
 for(const note of notes){
  assert(note.expected.startsWith('> ')&&note.replacement.startsWith('> '),'只允许校正非正文说明');
  assert(!/[\r\n]|<!--|\*\*选择 /.test(note.replacement),'说明不得引入正文或控制标记');
  const lines=result.split('\n');assert.equal(lines.filter(line=>line===note.expected).length,1,'说明前稿漂移：'+file);
  result=lines.map(line=>line===note.expected?note.replacement:line).join('\n');
 }
 return result;
}
module.exports={applyEditorial,corrections};
