'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../tools/integration/runtime/i01-compose.cjs'),'utf8');
const start=source.indexOf('func iMatchCue(id) {'),first=source.indexOf('{',start);let depth=1,end=first+1;for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}
const body=source.slice(first+1,end-1).replace(/for\((\w+) in ([^)]+)\)/g,'for(const $1 of $2)');
const routeMap={xiaoman:{},zhouzhi:{},mengyao:{},piao:{},huangqiuqiu:{},friends:{}};
const checks=[];
function run(name,gate,state){let error='';const data={test:{gates:[gate],expressions:[]}},get=k=>state[k]??'',fail=s=>{error=s;return false;};const fn=new Function('id','iCueData','sc_get','sc_fail','Dict','sc_routes','sc_has','sc_field','sc_ok','sc_condition',body);const matched=fn('test',data,get,fail,{hasKey:(o,k)=>Object.hasOwn(o,k)},routeMap,(a,x)=>a.includes(x),field=>{const r=get('relation');if(!['HIGH','LOW'].includes(r))fail('relation-invalid');return r;},()=>!error,()=>true);checks.push({name,matched,error:error||null,expected:'状态非法时必须sc_fail，不能仅作为cue未命中'});}
const shared={kind:'sharedEvent',value:'LOW',routes:['xiaoman','zhouzhi','mengyao','huangqiuqiu','friends'],returns:[{route:'xiaoman',target:'XM-D36-RETURN'}]};
run('共享事件当前游标但缺返回帧',shared,{route:'xiaoman',relation:'LOW',return:''});
run('共享事件未知路线',shared,{route:'yelan',relation:'LOW',return:'XM-D36-RETURN'});
run('后日谈未知非空状态',{kind:'epilogue',value:'EP-HIGH'},{epilogue:'UNKNOWN',dispatched:'1'});
run('后日谈值存在但未分派',{kind:'epilogue',value:'EP-HIGH'},{epilogue:'EP-HIGH',dispatched:'0'});
const result={scope:'现行iMatchCue函数体独立JS语义探针；不是原生引擎测试',checks};fs.writeFileSync(path.join(__dirname,'gate-review-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
