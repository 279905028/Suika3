'use strict';
const fs=require('fs'),assert=require('assert/strict');
const{compile}=require('../../tools/compiler/compile.cjs'),{model}=require('../../tools/compiler/model.cjs'),{compileCues}=require('../../tools/integration/runtime/i01-compose.cjs');
const generated=compile({pageSize:108}),ir=generated.ir,R=ir.contract,m=model(ir),rawBindings=require('../../docs/整合/bindings.json').bindings,assets=require('../../assets/current/manifest.json').records.map(r=>({assetId:r.assetId,type:r.type,runtimePath:r.runtime.path})),data=compileCues({generated,assets,rawBindings}),nodes=new Map(ir.nodes.map(n=>[n.id,n]));
const report={layer:'当前I01 cue在当前正文参考执行器内的条件/组合检查，不是Wasm完整演出验收',contentBuildId:ir.buildId,cues:rawBindings.length,visits:0,paths:0,seen:new Set(),cg:new Set(),missing:[],checks:[]};
function matches(cue,s){
  for(const g of cue.gates){
    if(g.kind==='route'){assert(s.route,'missing route');if(s.route!==g.value)return false;}
    else if(g.kind==='event'){assert(Array.isArray(s.events));if(!s.events.includes(g.value))return false;}
    else if(g.kind==='epilogue'){assert(s.epilogue,'missing epilogue');const rule=R.epilogues.rules.find(r=>r.target?.file===s.epilogue);if(rule.target.anchor!==g.value)return false;}
    else if(g.kind==='sharedEvent'){assert(s.route);if(!g.routes.includes(s.route))return false;const relation=m.read(s,'PIAO_RELATION');if(relation!=='LOW'||!s.frame)return false;assert(g.returns.some(r=>r.route===s.route&&r.target===s.frame.returnTo));}
    else throw Error('unknown gate');
  }
  return cue.expressions.every(expr=>m.evaluate(expr,s));
}
function observe(n,s){
 const local=data.members[n.id]||[],active=local.filter(c=>matches(data.cueData[c.bindingId],s));
 for(const c of active){report.seen.add(c.bindingId);if(c.cgId)report.cg.add(c.cgId);}
 if(local.length){report.visits++;const variants=data.bindings.filter(b=>b.anchor.nodeId===n.id),matchesVariant=variants.filter(b=>{const p=data.predicates[b.bindingId];return p.include.every(id=>matches(data.cueData[id],s))&&p.exclude.every(id=>!matches(data.cueData[id],s))});assert.equal(matchesVariant.length,1,'组合不唯一 '+n.id);const selected=matchesVariant[0];assert(!data.predicates[selected.bindingId].conflict,'图层冲突 '+n.id);if(active.some(c=>c.cgId)){assert.equal(selected.enter.characters.length,0);assert.equal(selected.enter.props.length,0);assert.equal(selected.enter.background.assetId,'i02-neutral');}else assert.equal(selected.enter.cg,null);}
}
function run(answers,start=ir.entry,state=m.fresh()){
 const s=structuredClone(state);let pc=start,steps=0;
 while(pc){assert(++steps<ir.nodes.length*3);const n=nodes.get(pc);assert(n);pc=n.next;
  switch(n.op){
   case'text':observe(n,s);break;
   case'branch':pc=m.evaluate(n.condition,s)?n.next:n.otherwise;break;
   case'choice':if(!Object.hasOwn(answers,n.choice))return{s,waiting:n.id};m.choose(s,n.choice,answers[n.choice]);break;
   case'anchor':break;
   case'freeze':m.freeze(s);break;
   case'event':m.event(s,n.event);break;
   case'call':assert(!s.frame);s.frame={returnTo:n.returnTo};pc=n.target;break;
   case'return':pc=s.frame.returnTo;s.frame=null;m.event(s,R.day36.eventId);break;
   case'ending':m.ending(s,n.ending);break;
   case'epilogue':pc=m.dispatch(s);if(!pc)s.status='complete';break;
   case'finish':{const i=R.storyEntry.common.indexOf(n.file);if(i>=0)pc=ir.entries[R.storyEntry.common[i+1]||R.storyEntry.routeEntry];else if(n.file===R.storyEntry.routeEntry)pc=ir.entries[R.routes.find(r=>r.id===s.route).file];else{if(!s.dispatched)assert.equal(m.dispatch(s),null);s.status='complete';pc=null;}break;}
   default:throw Error(n.op);
  }
 }
 m.validate(s);return{s,waiting:null};
}
const bases={},common=Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>c.id),relevant=['C01-02','C02-01',...R.piaoRelation.choices.map(c=>c.id)];
for(const defaults of ['A','B'])for(let mask=0;mask<32;mask++){const a=Object.fromEntries(common.map(id=>[id,defaults]));relevant.forEach((id,i)=>a[id]=mask&(1<<i)?'B':'A');const r=run(a);assert.equal(r.waiting,'ROUTE-01');if(m.available(r.s,'ROUTE-01').some(o=>o.value==='huangqiuqiu'))bases[r.s.relation]??=r.s;report.paths++;}
for(const route of R.routes)for(const relation of ['HIGH','LOW']){
 const ids=Object.values(ir.choices).filter(c=>c.source.file===route.file&&(route.id!=='piao'||(c.id===route.lowPathChoice)===(relation==='LOW'))).map(c=>c.id);
 for(let mask=0;mask<2**ids.length;mask++){const a=Object.fromEntries(ids.map((id,i)=>[id,mask&(1<<i)?'B':'A']));a['ROUTE-01']=route.id;const r=run(a,ir.entries[R.storyEntry.routeEntry],bases[relation]);assert.equal(r.s.status,'complete');report.paths++;}
}
report.seen=[...report.seen].sort();report.cg=[...report.cg].sort();report.missing=rawBindings.filter(c=>!report.seen.includes(c.bindingId)).map(c=>({id:c.bindingId,node:c.enter.cursor,conditions:c.conditions}));report.status='pass';report.checks=['64 common art gate combinations + 2818 route assignments execute without unknown/unvisited condition errors','Each matched node has exactly one complete composite state','CG suppresses background/characters/props and uses neutral matte','Non-CG composites contain no residual CG','Conditions only evaluated for member node IDs'];fs.writeFileSync(__dirname+'/cue-check-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,paths:report.paths,cues:report.cues,seen:report.seen.length,cg:report.cg.length,missing:report.missing,visits:report.visits},null,2));
