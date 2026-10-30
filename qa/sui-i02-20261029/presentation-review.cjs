'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),ray=fs.readFileSync(path.join(ROOT,'tools/integration/runtime/presentation.ray'),'utf8');
function body(name){const start=ray.indexOf('func '+name+'(');assert(start>=0);const first=ray.indexOf('{',start);let depth=1,i=first+1;while(depth&&i<ray.length){if(ray[i]==='{')depth++;if(ray[i]==='}')depth--;i++;}return ray.slice(first+1,i-1);}
const validateBody=body('iValidate'),restoreBody=body('iRestore');
const cue=require('../../docs/整合/bindings.json').bindings.find(b=>b.cgId==='CG001'),active='i01-state-'+cue.enter.cursor+'-1';
const bindings={[active]:{node:cue.enter.cursor}},states={empty:[],[active+':enter']:[],[active+':restore']:[]},restores={empty:true,[active+':restore']:true};
let current={state:'empty',active:''},checks=0,applied='';
const iValidate=new Function('Dict','iGet','iStates','iRestoreStates','iBindings','sc_get','iMatches','sc_ok',validateBody).bind(null,{hasKey:(o,k)=>Object.hasOwn(o,k)},k=>current[k],states,restores,bindings,k=>k==='cursor'?cue.enter.cursor:'',()=>{checks++;return true;},()=>true);
const iRestore=new Function('iValidate','sc_fail','iApply','iGet','iFullView',restoreBody).bind(null,iValidate,msg=>{throw Error(msg);},s=>{applied=s;return true;},k=>current[k],true);
const result={scope:'直接执行现行Ray iValidate/iRestore函数体的独立JS语义探针；非原生引擎验收',sourceCursor:cue.enter.cursor,checks:[]};
result.checks.push({name:'已绑定CG节点但存档active为空/state=empty',accepted:iRestore(),predicateCalls:checks,appliedState:applied,expected:'拒绝或按目标cursor重新计算CG状态'});
current={state:active+':enter',active};checks=0;applied='';result.checks.push({name:'合法active/enter配对',accepted:iRestore(),predicateCalls:checks,appliedState:applied});
current={state:'empty',active};result.checks.push({name:'active存在但state为空场',accepted:iValidate(),expected:false});
current={state:'empty',active:'unknown'};result.checks.push({name:'未知active',accepted:iValidate(),expected:false});
fs.writeFileSync(path.join(__dirname,'presentation-review-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
