const fs=require('fs'),assert=require('assert/strict');
const ir=require('../../build/sui-i02-20261030-v2/wasm/generated/story.ir.json'),m=require('../../tools/compiler/model.cjs').model(ir);
const bindings=require('../../docs/整合/bindings.json').bindings,byNode=new Map(bindings.map(b=>[b.anchor.nodeId,b]));
const defaults=Object.fromEntries(Object.entries(ir.choices).map(([id,c])=>[id,c.options[0].value]));
const candidates=require('../sui-c-20261028/native-cases.json').filter(c=>c.kind==='complete');
for(const w of require('../sui-i01-20261030/state-witnesses.json').filter(w=>w.enter.cg)) candidates.push({name:'witness-'+byNode.get(w.nodeId).cgId,answers:{...defaults,...w.state.choices}});
for(const c of candidates){c.result=m.run(c.answers);c.cg=bindings.filter(b=>b.cgId&&c.result.paragraphs.some(p=>p.id===ir.nodes.find(n=>n.id===b.anchor.nodeId).paragraph)).map(b=>b.cgId);}
const required=['mengyao/HIGH/AA','mengyao/HIGH/AB','mengyao/HIGH/BA','mengyao/HIGH/BB','friends/LOW/AA','xiaoman/HIGH/AA','zhouzhi/HIGH/AA','piao/HIGH/AA','piao/LOW/A','piao/LOW/B','huangqiuqiu/HIGH/AA'];
const selected=required.map(name=>{const c=candidates.find(c=>c.name===name);assert(c,name);return c;});
const covered=new Set(selected.flatMap(c=>c.cg));
while(covered.size<60){const c=candidates.filter(c=>!selected.includes(c)).sort((a,b)=>b.cg.filter(id=>!covered.has(id)).length-a.cg.filter(id=>!covered.has(id)).length)[0];assert(c&&c.cg.some(id=>!covered.has(id)), 'missing '+bindings.filter(b=>b.cgId&&!covered.has(b.cgId)).map(b=>b.cgId));selected.push(c);c.cg.forEach(id=>covered.add(id));}
fs.writeFileSync(__dirname+'/route-cases.json',JSON.stringify(selected.map(({name,answers,cg})=>({name,answers,cg})),null,2)+'\n');
console.log({cases:selected.length,cg:covered.size,names:selected.map(c=>c.name)});
