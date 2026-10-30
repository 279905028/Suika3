'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),version='sui-i02-20261030-v7',candidate=path.join(root,'build',version),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['孟遥-旧题.md','飘-空白页.md','黄球球-门后.md','后日谈-他们的日子.md','后日谈-未写完的安排.md','跨路线-第36天的消息.md'];
const ir=read(`build/${version}/wasm/generated/story.ir.json`),nodes=new Map(ir.nodes.map(n=>[n.id,n]));
const bb=read(`build/${version}/input/docs/整合/bindings.json`),bindings=new Map(bb.bindings.map(b=>[b.anchor.nodeId,b]));
const sourceCheck=files.map(f=>{const p='scenario/'+f,b=fs.readFileSync(path.join(root,p)),c=fs.readFileSync(path.join(candidate,'input',p));assert(b.equals(c),p+'变更');assert.equal(hash(b),bb.sourceHashes[p]);return {file:p,lines:b.toString().trimEnd().split('\n').length,sha256:hash(b),candidateIdentical:true};});
assert(fs.readFileSync(path.join(root,'docs/整合/bindings.json')).equals(fs.readFileSync(path.join(candidate,'input/docs/整合/bindings.json'))));
const result={candidate:version,layer:'独立离线内容/绑定核验，非引擎试玩或图片逐像素目视',sourceCheck,checks:[],counts:{},cases:[],findings:[],coverage:{}};
const check=(name,detail)=>result.checks.push({name,status:'pass',detail});
const coverage=new Set(),cgCoverage=new Set(),active=new Set();let bindingChecks=0,calls=0,returns=0;
// 独立遍历冻结IR；不用历史QA结论、model.run或演出执行器作为判定来源。
function walk(answers){let pc=ir.entry,steps=0,state={choices:{},relation:'UNSET',score:20,route:null,ending:null,events:[],epilogue:null},ret=null;const texts=[],cg=[],trace=[];
function value(k){const v=k==='PIAO_RELATION'?state.relation:k==='ENDING'?state.ending:state.choices[k];assert(v!=null&&v!=='UNSET','条件读取未访问状态 '+k);return v;}
function ast(c){return c.some(group=>group.every(t=>t.operator==='='?value(t.field)===t.value:value(t.field)!==t.value));}
function bindingCondition(c){if(c==='ALL')return true;return c.split('|').some(g=>g.split('&').every(t=>{let m=t.trim().match(/^([^!=]+)(!=|=)(.+)$/);assert(m);return m[2]==='='?value(m[1])===m[3]:value(m[1])!==m[3];}));}
while(pc){assert(++steps<10000);const n=nodes.get(pc);assert(n);pc=n.next;switch(n.op){
case 'text':case 'choice':{const b=bindings.get(n.id);assert(b,'缺绑定 '+n.id);assert(bindingCondition(b.condition),'可达绑定条件不匹配 '+n.id);bindingChecks++;active.add(b.bindingId);if(files.includes(n.source.file))coverage.add(n.id);for(const c of b.enter.characters){if(c.assetId.startsWith('sui-a06-')&&n.source.file==='黄球球-门后.md'){assert.equal(c.form,n.source.line>=509?'human':'orb','黄球球形态提前或退回');}if(c.assetId.includes('human-toy'))assert.equal(n.source.line,511,'玩偶棒越界');}
if(b.cgId){cg.push(b.cgId);cgCoverage.add(b.cgId);assert(b.fullView);assert.equal(b.exit.restore.cg,null,'CG退出残留');}
if(n.op==='text'){texts.push(n);break;}
if(n.choice==='ROUTE-01'){state.route=answers[n.choice];if(state.route==='huangqiuqiu')assert(state.choices['C01-02']==='A'&&state.choices['C02-01']==='A'&&state.events.includes('day14-meeting-read'));}
assert(n.choice in answers,n.choice);assert(!(n.choice in state.choices));state.choices[n.choice]=answers[n.choice];if(['C01-06','C02-08','C02-09'].includes(n.choice))state.score+=answers[n.choice]==='A'?10:-5;break;}
case 'branch':pc=ast(n.condition)?n.next:n.otherwise;break;
case 'freeze':assert(['C01-06','C02-08','C02-09'].every(k=>k in state.choices));state.relation=state.score>=35?'HIGH':'LOW';break;
case 'anchor':break;
case 'event':assert(!state.events.includes(n.event));state.events.push(n.event);break;
case 'call':assert.equal(state.relation,'LOW');assert.equal(ret,null);ret=n.returnTo;pc=n.target;calls++;break;
case 'return':assert(ret);pc=ret;ret=null;state.events.push('PIAO-PREGNANCY-READ');returns++;break;
case 'ending':assert.equal(state.ending,null);state.ending=n.ending;break;
case 'epilogue':state.epilogue=state.relation==='LOW'?'后日谈-未写完的安排.md':state.ending==='PI-E1'?null:'后日谈-他们的日子.md';pc=state.epilogue?ir.entries[state.epilogue]:null;break;
case 'finish':{const f=n.file;if(f==='第一章-回到毕节.md')pc=ir.entries['第二章-十四天.md'];else if(f==='第二章-十四天.md')pc=ir.entries['第三章-选一条路.md'];else if(f==='第三章-选一条路.md')pc=ir.entries[ir.contract.routes.find(r=>r.id===state.route).file];else pc=null;break;}
default:throw Error(n.op);}
}
assert.equal(ret,null);const preg=state.events.filter(x=>x==='PIAO-PREGNANCY-READ').length;assert.equal(preg,state.relation==='LOW'?1:0);return {state,texts,cg};}
const combos=function*(ids){for(let mask=0;mask<2**ids.length;mask++)yield Object.fromEntries(ids.map((id,i)=>[id,mask&(1<<i)?'B':'A']));};
const common=Object.values(ir.choices).filter(c=>ir.contract.storyEntry.common.includes(c.source.file)).map(c=>c.id);
let total=0;const counts={};
for(const route of ['mengyao','piao','huangqiuqiu','friends'])for(const relation of ['HIGH','LOW']){
const r=ir.contract.routes.find(r=>r.id===route),ids=Object.values(ir.choices).filter(c=>c.source.file===r.file&&(route!=='piao'||((c.id==='PI-L06-01')===(relation==='LOW')))).map(c=>c.id),all=route==='friends'?combos(r.keyChoices):combos(ids);
for(const changes of all){const a={...Object.fromEntries(common.map(k=>[k,'A'])),...Object.fromEntries(ids.map(k=>[k,'A'])),...changes,'ROUTE-01':route};for(const k of ['C01-06','C02-08','C02-09'])a[k]=relation==='HIGH'?'A':'B';const run=walk(a),s=run.state;
const key=route==='piao'&&relation==='LOW'?a['PI-L06-01']:r.keyChoices.map(k=>a[k]).join(''),expected=route==='piao'&&relation==='LOW'?(key==='A'?'PI-LE1':'PI-LE2'):(key==='AA'?r.prefix+'-E1':r.prefix+'-E2');assert.equal(s.ending,expected);assert.equal(s.relation,relation);
const body=run.texts.filter(n=>n.source.file===r.file).map(n=>n.text).join('\n');
if(route==='mengyao'){
if(a['MY07-01']==='B'){assert(!body.includes('那晚我休班，回住处后接到她电话'));assert(!run.cg.includes('CG044'));assert(body.includes('我们没有亲吻，我也没有去她住处。'));}
if(key==='AA'){assert(body.includes('我们没有公开复合，她没有离婚'));assert(run.cg.includes('CG104'));assert(!run.cg.includes('CG105'));}else {assert(body.includes('结束的是我和她的私人关系'));assert(run.cg.includes('CG105'));assert(!run.cg.includes('CG104'));}}
if(route==='piao'){if(relation==='LOW'){assert(!Object.keys(s.choices).some(k=>/^PI\d/.test(k)));assert(!run.cg.some(k=>['CG062','CG063','CG066','CG069','CG106'].includes(k)));}else {assert(!run.cg.some(k=>['CG061','CG067','CG068','CG070'].includes(k)));if(key==='AA')assert.equal(s.epilogue,null);}}
if(route==='friends'&&key!=='AA'){const ep=run.texts.filter(n=>n.source.file.startsWith('后日谈-'));assert(!run.cg.some(k=>['CG095','CG096','CG098','CG099'].includes(k)));assert(ep.every(n=>relation==='HIGH'?![79,81,83,85,87,103,105,107,125,127,129,131,133,135,137,139,141,143].includes(n.source.line):![18,20,22,24,29,35,38,40,42].includes(n.source.line)));}
let ckey=route+'/'+relation;counts[ckey]=(counts[ckey]||0)+1;total++;if(!result.cases.some(c=>c.key===ckey+'/'+key))result.cases.push({key:ckey+'/'+key,ending:s.ending,epilogue:s.epilogue,pregnancyEvents:s.events.filter(x=>x==='PIAO-PREGNANCY-READ').length,cg:run.cg,textSha256:hash(body)});
}}
check('分配源稿与冻结候选逐字节一致',sourceCheck.length);check('孟遥 AA 维持婚姻秘密继续；AB/BA/BB断开；MY07=B不重启亲密',counts['mengyao/HIGH']+counts['mengyao/LOW']);check('飘高低条件、四/二结局与双后日谈互斥',counts['piao/HIGH']+counts['piao/LOW']);check('黄球球前置、球形/人形与玩偶棒绑定',counts['huangqiuqiu/HIGH']+counts['huangqiuqiu/LOW']);check('朋友 FR-E2 后日谈仅消息视角；CG不误入现场',8);check('可达文本/选择绑定条件与CG退出状态',bindingChecks);
result.counts={totalRoutes:total,routeAssignments:counts,bindingChecks,sharedCalls:calls,sharedReturns:returns,distinctActiveBindings:active.size};result.coverage={specialTextAndChoiceNodes:coverage.size,specialDeclared:ir.nodes.filter(n=>files.includes(n.source.file)&&['text','choice'].includes(n.op)).length,cgIds:[...cgCoverage].sort(),nodes:[...coverage].sort()};assert.equal(result.coverage.specialTextAndChoiceNodes,result.coverage.specialDeclared);result.status='PASS_AUTOMATED_WITH_EDITORIAL_FINDINGS_PENDING';fs.writeFileSync(path.join(__dirname,'audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,counts:result.counts,coverage:{...result.coverage,nodes:undefined}},null,2));
