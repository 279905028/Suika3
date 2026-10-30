'use strict';
// I01 explicit-paragraph cues -> mutually exclusive, complete stage states.
const assert=require('node:assert/strict');
const {integrate}=require('./presentation.cjs');
const {condition}=require('../../compiler/parse.cjs');
const q=JSON.stringify;
function ray(v){if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return q(v);if(Array.isArray(v))return '['+v.map(ray).join(',')+']';return '{'+Object.entries(v).map(([k,x])=>k+':'+ray(x)).join(',')+'}';}
function replaceOnce(s,a,b){assert.equal(s.split(a).length,2,'I01接入点不唯一：'+a);return s.replace(a,b);}
const NEUTRAL={assetId:'i02-neutral',type:'background',runtimePath:'tools/runtime/neutral.png'};
const neutral=()=>({assetId:NEUTRAL.assetId,layer:'bg',x:0,y:0,scale:1,form:null,costume:null});
const empty=()=>({background:neutral(),characters:[],props:[],cg:null});
function compileCues({generated,assets,rawBindings,contract=generated.ir.contract}){
  const cues=Array.isArray(rawBindings)?rawBindings:rawBindings.bindings,byId=new Map(assets.map(a=>[a.assetId,a]));
  const ends=contract.routes.flatMap(r=>[...r.endings,...(r.lowPathEndings||[])]),sourceMap=JSON.parse(generated.artifacts['source-map.json']).units;
  const cueData={},members={},predicates={},bindings=[],conflicts=[];
  for(const cue of cues){
    assert(!Object.hasOwn(cueData,cue.bindingId),'I01重复cue');assert(byId.has(cue.assetId),'I01未知asset');
    const gates=cue.conditions.entryGates.map(g=>{
      if(g.type==='route'){assert(contract.routes.some(r=>r.id===g.value));return {kind:'route',value:g.value,routes:[],returns:[]};}
      if(g.type==='event'){assert(contract.stateContract.events.includes(g.value));return {kind:'event',value:g.value,routes:[],returns:[]};}
      if(g.type==='epilogue'){const targets=contract.epilogues.rules.filter(r=>r.target?.file===g.value).map(r=>r.target.anchor);assert(targets.length&&new Set(targets).size===1);return {kind:'epilogue',value:targets[0],routes:[],returns:[]};}
      assert.equal(g.type,'sharedEvent');assert.equal(g.value,contract.day36.sharedSource.anchor);assert.equal(g.relation,'LOW');assert(g.routes.every(r=>contract.day36.calls.some(c=>c.routeId===r)));return {kind:'sharedEvent',value:'LOW',routes:g.routes,returns:contract.day36.calls.filter(c=>g.routes.includes(c.routeId)).map(c=>({route:c.routeId,target:c.returnAnchor}))};
    });
    cueData[cue.bindingId]={gates,expressions:cue.conditions.requiredExpressions.map(expr=>condition(expr,generated.ir.choices,ends))};
    for(const node of cue.visiblePageIds){assert(sourceMap[node]?.op==='text','I01cue仅正文');(members[node]??=[]).push(cue);}
  }
  for(const[node,at]of Object.entries(members)){
    assert(at.length<=8,'单节点cue组合过大，须显式扩展接口');
    for(let mask=0;mask<2**at.length;mask++){
      const selected=at.filter((_,i)=>mask&(1<<i)),id='i01-state-'+node+'-'+mask;
      const cg=selected.filter(c=>c.display.slot==='cg'),active=cg.length?cg:selected,state=empty(),used=new Set();let conflict=false;
      for(const cue of active){
        const layer={background:'bg','character-left':'left','character-center':'center','character-right':'right','prop-center':'prop1',cg:'cg'}[cue.display.slot];assert(layer,'未知I01显示槽');
        if(used.has(layer)){conflict=true;continue;}used.add(layer);
        const p={assetId:cue.assetId,layer,x:cue.display.x,y:cue.display.y,scale:cue.display.scale,form:cue.sceneFacts?.form||null,costume:cue.sceneFacts?.wardrobeAndForm||null};
        if(layer==='bg')state.background=p;else if(layer==='cg')state.cg=p;else if(layer==='prop1')state.props.push(p);else state.characters.push(p);
      }
      if(conflict)conflicts.push({id,node,selected:selected.map(c=>c.bindingId)});
      predicates[id]={include:selected.map(c=>c.bindingId),exclude:at.filter(c=>!selected.includes(c)).map(c=>c.bindingId),conflict};
      bindings.push({bindingId:id,anchor:{nodeId:node,file:'scenario/'+sourceMap[node].source.file,sha256:sourceMap[node].source.sha256},condition:'ALL',routeIds:[],enter:state,exit:{at:'next-node',restore:empty()},cgId:cg[0]?.cgId||null,fullView:cg.length>0,restrictions:['I01 destination recomputation; technical neutral fallback']});
    }
  }
  return {cueData,members,predicates,bindings,conflicts};
}
function registerTree(registrations,prefix){
  const batches=[];for(let n=0;n<registrations.length;n+=4)batches.push(registrations.slice(n,n+4));
  const out=batches.map((lines,i)=>`func ${prefix}Item_${i}() {\n${lines.join('\n')}\n}`);let names=batches.map((_,i)=>`${prefix}Item_${i}`),depth=0;
  while(names.length>12){const parents=[];for(let i=0;i<names.length;i+=12){const name=`${prefix}Group_${depth}_${i/12}`;out.push(`func ${name}() {`,...names.slice(i,i+12).map(n=>`${n}();`),'}');parents.push(name);}names=parents;depth++;}
  out.push(`func ${prefix}() {`,...names.map(n=>`${n}();`),'}');return out.join('\n');
}
const EXECUTOR=`
var iCueData = {};
var iPredicates = {};
func iMatchCue(id) {
    var cue=iCueData[id];
    for(gate in cue.gates) {
        if(gate.kind=="route") {
            var route=sc_get("route");if(route=="") return sc_fail("cue-route-unvisited");
            if(!Dict.hasKey(sc_routes,route)) return sc_fail("cue-route-invalid");
            if(route!=gate.value) return false;
        } else if(gate.kind=="event") {
            var value=sc_get("e_"+gate.value);if(value!="0"&&value!="1") return sc_fail("cue-event-invalid");
            if(value!="1") return false;
        } else if(gate.kind=="epilogue") {
            var value=sc_get("epilogue");
            if(sc_get("dispatched")!="1" || !sc_has(["EP-HIGH","EP-LOW"],value)) return sc_fail("cue-epilogue-invalid");
            if(value!=gate.value) return false;
        } else if(gate.kind=="sharedEvent") {
            var route=sc_get("route");if(route=="" || !Dict.hasKey(sc_routes,route)) return sc_fail("cue-shared-route-invalid");
            if(sc_get("return")=="" || sc_get("return")!=sc_routes[route].returnTo) return sc_fail("cue-shared-return-invalid");
            if(!sc_has(gate.routes,route)) return false;
            var relation=sc_field("PIAO_RELATION");if(!sc_ok()) return false;
            if(relation!="LOW") return false;
            var matched=false;for(target in gate.returns) if(target.route==route&&target.target==sc_get("return")) matched=true;
            if(!matched) return sc_fail("cue-shared-return-invalid");
        } else return sc_fail("cue-gate-unknown");
    }
    for(expression in cue.expressions) {if(!sc_condition(expression)) return false;if(!sc_ok()) return false;}
    return true;
}
func iMatchPredicate(id) {
    var predicate=iPredicates[id];
    for(cue in predicate.include) {if(!iMatchCue(cue)) return false;if(!sc_ok()) return false;}
    for(cue in predicate.exclude) {if(iMatchCue(cue)) return false;if(!sc_ok()) return false;}
    if(predicate.conflict) return sc_fail("cue-layer-conflict:"+id);
    return true;
}
`;
function integrateI01(args){
  const data=compileCues(args),adapted=integrate({...args,assets:[...args.assets,NEUTRAL],bindings:data.bindings});
  const registrations=[...Object.entries(data.cueData).map(([id,v])=>`iCueData[${q(id)}] = ${ray(v)};`),...Object.entries(data.predicates).map(([id,v])=>`iPredicates[${q(id)}] = ${ray(v)};`)];
  adapted.ray=replaceOnce(adapted.ray,'func iMatches(binding) {','func iMatches(binding) {\n    if(Dict.hasKey(iPredicates,binding.id)) return iMatchPredicate(binding.id);');
  const validationStart=adapted.ray.indexOf('func iValidate() {'),validationEnd=adapted.ray.indexOf('func iExit(id) {',validationStart);
  assert(validationStart>=0&&validationEnd>validationStart);
  adapted.ray=adapted.ray.slice(0,validationStart)+`func iValidate() {
    var id=sc_get("cursor");
    if(!Dict.hasKey(iNodes,id)) return iGet("active")=="" && iGet("state")=="empty";
    var selected="";
    for(bindingId in iNodes[id]) {
        if(iMatches(iBindings[bindingId])) {
            if(selected!="") return sc_fail("cue-restore-ambiguous");
            selected=bindingId;
        }
        if(!sc_ok()) return false;
    }
    if(selected=="") return sc_fail("cue-restore-unresolved");
    return iGet("active")==selected && iGet("state")==selected+":enter";
}
`+adapted.ray.slice(validationEnd);
  adapted.ray=replaceOnce(adapted.ray,'if(!iApply(active+":restore")) return false;','if(!iApply("empty")) return false;');
  adapted.ray=replaceOnce(adapted.ray,'func iInstall() {','func iInstall() {\n    iInstallCues();');
  adapted.ray=replaceOnce(adapted.ray,'if(!Dict.hasKey(iNodes,id)) return true;','if(!Dict.hasKey(iNodes,id)) {iSet("active","");return iApply("empty");}');
  adapted.ray=adapted.ray.replaceAll('system/sui-u/png/reading-backdrop.png',NEUTRAL.runtimePath)+'\n'+EXECUTOR+'\n'+registerTree(registrations,'iInstallCues');
  adapted.summary={...adapted.summary,sourceSchema:'sui-i01-data-v1',cueCount:Object.keys(data.cueData).length,visibleNodes:Object.keys(data.members).length,compositeStates:data.bindings.length,possibleConflicts:data.conflicts,generatedNeutralResource:NEUTRAL.runtimePath,pixelPositionRounding:'nearest integer; max 0.5px per axis; source data retained'};
  return adapted;
}
module.exports={integrateI01,compileCues,registerTree};
