'use strict';
const assert=require('node:assert/strict');
const contract=require('./text-format.json');
const registry=require('./speakers.json');
const speakers=new Map(registry.speakers.map(s=>[s.id,s]));
// The six fields are scalars. Parsing each key/value token also detects duplicate
// JSON keys, which JSON.parse alone silently accepts (including escaped keys).
function metadata(json,{code}={}) {
  const value=JSON.parse(json);
  assert(value&&typeof value==='object'&&!Array.isArray(value),'TEXT必须为JSON对象');
  const pairs=[...json.matchAll(/("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*"|null|true|false|-?\d+(?:\.\d+)?)/g)];
  const keys=pairs.map(m=>JSON.parse(m[1]));
  assert.equal(new Set(keys).size,keys.length,'TEXT字段重复');
  assert.deepEqual(Object.keys(value).sort(),[...contract.requiredFields].sort(),'TEXT缺字段或含未知字段');
  assert(new RegExp(contract.idPattern).test(value.id),'TEXT id非法');
  if(code)assert(value.id.startsWith('T-'+code+'-'),'TEXT文件码不符');
  assert(typeof value.kind==='string'&&Object.hasOwn(contract.channelsByKind,value.kind),'TEXT kind非法');
  assert(contract.channelsByKind[value.kind].includes(value.channel),'TEXT kind/channel组合非法');
  assert(value.group===null||typeof value.group==='string'&&new RegExp(contract.groupPattern).test(value.group),'TEXT group非法');
  if(value.group&&code)assert(value.group.startsWith('G-'+code+'-'),'TEXT group文件码不符');
  assert(typeof value.name==='string','TEXT name须为字符串');
  if(contract.silentKinds.includes(value.kind))assert(value.speaker===null&&value.name==='','旁白与动作必须清名');
  else {
    assert(typeof value.speaker==='string'&&speakers.has(value.speaker),'TEXT未登记speaker');
    assert(speakers.get(value.speaker).allowedNames.includes(value.name),'TEXT姓名不在允许称呼中');
    if(value.kind==='thought')assert(contract.thoughtSpeakers.includes(value.speaker),'TEXT心声仅限文文');
  }
  return {...value,displayName:value.name+contract.channelSuffix[value.channel]};
}
function fileCodes(R) {
  return Object.fromEntries([
    ...R.storyEntry.common.map((f,i)=>[f,'C0'+(i+1)]),[R.storyEntry.routeEntry,'C03'],
    ...R.routes.map(r=>[r.file,{xiaoman:'XM',zhouzhi:'ZZ',mengyao:'MY',piao:'PI',huangqiuqiu:'HQ',friends:'FR'}[r.id]]),
    [R.day36.sharedSource.file,'D36'],...R.epilogues.rules.filter(r=>r.target).map(r=>[r.target.file,r.relation==='HIGH'?'EPH':'EPL'])
  ]);
}
module.exports={metadata,fileCodes,contract};
