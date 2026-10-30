'use strict';
// Build-time reference executor; never shipped as a browser player.
const assert = require('node:assert/strict');
const clone = x => structuredClone(x);
function model(ir) {
  const R=ir.contract, nodes=new Map(ir.nodes.map(n=>[n.id,n])), routes=new Map(R.routes.map(r=>[r.id,r]));
  const fresh=()=>({choices:{},score:R.piaoRelation.initialScore,relation:'UNSET',frozen:false,events:[],route:null,ending:null,epilogue:null,dispatched:false,frame:null,status:'running'});
  function read(s,field) {
    if(field==='PIAO_RELATION'){assert(s.frozen&&['HIGH','LOW'].includes(s.relation),'关系未冻结或非法');return s.relation;}
    if(field==='ENDING'){assert(s.ending,'结局尚未产生');return s.ending;}
    assert(ir.choices[field],'未知选择字段');assert(Object.hasOwn(s.choices,field),'未访问选择：'+field);
    assert(ir.choices[field].options.some(o=>o.value===s.choices[field]),'非法选择值');return s.choices[field];
  }
  const evaluate=(ast,s)=>ast.some(group=>group.every(t=>t.operator==='='?read(s,t.field)===t.value:read(s,t.field)!==t.value));
  function available(s,id) {
    assert(ir.choices[id],'未知选择');
    if(id!==R.storyEntry.routeChoice)return ir.choices[id].options;
    read(s,'PIAO_RELATION');
    return ir.choices[id].options.filter(o=>o.value!==R.hiddenEntry.routeId || Object.entries(R.hiddenEntry.choiceRequirements).every(([k,v])=>s.choices[k]===v)&&s.events.includes(R.hiddenEntry.readEvent));
  }
  function choose(s,id,value) {
    assert(!Object.hasOwn(s.choices,id),'重复提交选择');
    assert(available(s,id).some(o=>o.value===value),'不可用或非法选项');
    const owner=R.routes.find(r=>r.file===ir.choices[id].source.file);
    if(owner){assert.equal(s.route,owner.id,'跨路线选择');if(owner.id==='piao')assert.equal(id===owner.lowPathChoice,s.relation==='LOW','飘高低选择混用');}
    const scored=R.piaoRelation.choices.find(c=>c.id===id);
    if(scored)assert(!s.frozen,'冻结后计分');
    if(id===R.storyEntry.routeChoice){assert(!s.route,'路线不可更换');s.route=value;}
    s.choices[id]=value;if(scored)s.score+=scored.effects[value];
  }
  function freeze(s) {
    assert(!s.frozen,'重复冻结');
    const score=R.piaoRelation.initialScore+R.piaoRelation.choices.reduce((n,c)=>n+c.effects[read(s,c.id)],0);
    assert.equal(score,s.score,'分数与已访问选择不一致');
    s.relation=score>=R.piaoRelation.freeze.highAtLeast?'HIGH':'LOW';s.frozen=true;
  }
  function event(s,id) {
    assert(R.stateContract.events.includes(id),'未知事件');assert(!s.events.includes(id),'重复事件');
    if(id===R.hiddenEntry.readEvent){for(const[k,v]of Object.entries(R.hiddenEntry.choiceRequirements))assert.equal(read(s,k),v,'相识前置错误');read(s,R.hiddenEntry.neutralChoice);}
    else {assert.equal(read(s,'PIAO_RELATION'),'LOW','高关系不能发生低关系事件');assert(s.route,'事件无路线');}
    s.events.push(id);
  }
  function expectedEnding(s) {
    const r=routes.get(s.route);assert(r,'结局没有当前路线');read(s,'PIAO_RELATION');
    if(r.id==='piao'&&s.relation==='LOW')return r.lowPathOutcomes[read(s,r.lowPathChoice)];
    return r.outcomes[r.keyChoices.map(id=>read(s,id)).join('')];
  }
  function ending(s,id) {
    assert(!s.ending,'重复结局');assert.equal(id,expectedEnding(s),'跨路线或非法结局');
    assert.equal(s.events.includes(R.day36.eventId),s.relation==='LOW','结局事件状态错误');s.ending=id;
  }
  function dispatch(s) {
    assert.equal(s.ending,expectedEnding(s),'结局状态不符');assert(!s.dispatched,'重复后日谈');
    const rules=R.epilogues.rules.filter(r=>r.relation===s.relation&&r.endings.includes(s.ending));assert.equal(rules.length,1,'后日谈分派不唯一');
    const rule=rules[0];if(rule.requiresEvent)assert(s.events.includes(rule.requiresEvent),'后日谈缺事件');
    s.dispatched=true;s.epilogue=rule.target?.file??null;return rule.target?.anchor??null;
  }
  function validate(s) {
    assert.deepEqual(Object.keys(s).sort(),Object.keys(fresh()).sort(),'未知或缺失状态字段');
    assert(['UNSET','HIGH','LOW'].includes(s.relation),'非法关系');assert.equal(s.frozen,s.relation!=='UNSET','冻结字段不一致');
    let score=R.piaoRelation.initialScore;
    for(const[id,v]of Object.entries(s.choices)){
      assert(ir.choices[id]?.options.some(o=>o.value===v),'未知选择或非法值');
      const c=R.piaoRelation.choices.find(c=>c.id===id);if(c)score+=c.effects[v];
      const owner=R.routes.find(r=>r.file===ir.choices[id].source.file);
      if(owner){assert.equal(s.route,owner.id,'跨路线状态');if(owner.id==='piao')assert.equal(id===owner.lowPathChoice,s.relation==='LOW','飘高低混用');}
    }
    assert.equal(s.score,score,'分数与选择不一致');
    if(s.frozen){R.piaoRelation.choices.forEach(c=>read(s,c.id));assert.equal(s.relation,s.score>=R.piaoRelation.freeze.highAtLeast?'HIGH':'LOW','关系与分数不一致');}
    assert.equal(new Set(s.events).size,s.events.length,'重复事件');for(const e of s.events)assert(R.stateContract.events.includes(e),'未知事件');
    if(s.events.includes(R.hiddenEntry.readEvent)){for(const[k,v]of Object.entries(R.hiddenEntry.choiceRequirements))assert.equal(read(s,k),v,'相识前置错误');read(s,R.hiddenEntry.neutralChoice);}
    if(s.events.includes(R.day36.eventId))assert(s.route&&s.relation==='LOW','事件状态错误');
    if(s.route){assert.equal(read(s,R.storyEntry.routeChoice),s.route);assert(available(s,R.storyEntry.routeChoice).some(o=>o.value===s.route),'隐藏路线前置错误');}
    else assert(!Object.hasOwn(s.choices,R.storyEntry.routeChoice),'路线字段缺失');
    if(s.ending)assert.equal(s.ending,expectedEnding(s),'结局不符');
    if(s.epilogue){assert(s.dispatched,'未分派后日谈');const rule=R.epilogues.rules.find(r=>r.relation===s.relation&&r.endings.includes(s.ending));assert.equal(rule?.target?.file,s.epilogue,'后日谈不符');if(rule.requiresEvent)assert(s.events.includes(rule.requiresEvent),'后日谈缺事件');}
    if(s.frame){const c=R.day36.calls.find(c=>c.routeId===s.route);assert(c&&s.relation==='LOW'&&s.frame.returnTo===c.returnAnchor,'失效返回点');assert(!s.events.includes(R.day36.eventId),'完成事件仍有栈');}
  }
  function run(answers, {state=fresh(), start=ir.entry, collect=true}={}) {
    const s=clone(state), trace=[], paragraphs=[];let pc=start, steps=0;
    const log=(n,extra={})=>{if(collect)trace.push({id:n.id,op:n.op,file:n.source.file,line:n.source.line,...extra});};
    while(pc){assert(++steps<=ir.nodes.length*3,'执行循环或未终止');const n=nodes.get(pc);assert(n,'未知执行位置：'+pc);pc=n.next;
      switch(n.op){
        case 'branch':pc=evaluate(n.condition,s)?n.next:n.otherwise;break;
        case 'text':if(collect){const last=paragraphs.at(-1);if(last?.id===n.paragraph)last.text+=n.text;else paragraphs.push({id:n.paragraph,file:n.source.file,line:n.source.line,text:n.text});}break;
        case 'choice':if(!Object.hasOwn(answers,n.choice))return {s,trace,paragraphs,waiting:n.id};choose(s,n.choice,answers[n.choice]);log(n,{value:answers[n.choice]});break;
        case 'anchor':log(n);break;
        case 'freeze':freeze(s);log(n);break;
        case 'event':if(n.event===R.day36.eventId){assert.equal(s.route,'piao');read(s,R.routes.find(r=>r.id==='piao').lowPathChoice);}event(s,n.event);log(n);break;
        case 'call':assert(!s.frame,'嵌套CALL');assert.equal(s.route,n.route);assert.equal(read(s,'PIAO_RELATION'),'LOW');assert(!s.events.includes(R.day36.eventId),'重复CALL');s.frame={returnTo:n.returnTo};pc=n.target;log(n);break;
        case 'return':assert(s.frame,'RETURN无调用栈');pc=s.frame.returnTo;s.frame=null;event(s,R.day36.eventId);log(n,{returnTo:pc});break;
        case 'ending':ending(s,n.ending);log(n);break;
        case 'epilogue':pc=dispatch(s);log(n,{target:pc});if(!pc)s.status='complete';break;
        case 'finish':{
          const i=R.storyEntry.common.indexOf(n.file);
          if(i>=0)pc=ir.entries[R.storyEntry.common[i+1]||R.storyEntry.routeEntry];
          else if(n.file===R.storyEntry.routeEntry){assert(s.route,'缺少路线');pc=ir.entries[routes.get(s.route).file];}
          else if(n.file===R.day36.sharedSource.file)throw Error('公共事件没有RETURN');
          else {assert(s.ending,'故事未产生结局');assert(!s.frame,'遗留调用栈');if(!s.dispatched)assert.equal(dispatch(s),null,'漏后日谈');s.status='complete';pc=null;}break;
        }
        default:throw Error('未知操作：'+n.op);
      }
    }
    validate(s);return {s,trace,paragraphs,waiting:null};
  }
  return {fresh,read,evaluate,available,choose,freeze,event,ending,expectedEnding,dispatch,validate,run};
}
module.exports={model};
