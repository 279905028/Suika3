#!/usr/bin/env node
'use strict';
// P1 is an isolated preview. Never writes scenario, adopted art, or old QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compile}=require('../compiler/compile.cjs'),{hash}=require('../compiler/parse.cjs'),{model}=require('../compiler/model.cjs');
const {build}=require('../runtime/build.cjs'),{integrate}=require('../integration/runtime/presentation-full.cjs');
const ROOT=path.resolve(__dirname,'../..'),QA='qa/dialogue-p1-runtime-20261102';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x,null,2)+'\n');};
function prepare(out){
  const sources=read('qa/dialogue-p1-writing-20261102/source-paragraphs.json');
  const map=read('qa/dialogue-p1-writing-20261102/source-map.json');
  const registry=read('qa/dialogue-p0-20261102/paragraph-registry.json');
  const oldBindings=read('docs/整合/bindings.json').bindings;
  const oldById=new Map(oldBindings.map(b=>[b.anchor.nodeId,b]));
  const paragraphs=new Map(registry.paragraphs.map(p=>[p.id,p]));
  const source=path.join(out,'input');assert(!fs.existsSync(source),'不覆盖已有P1输入');
  const previous=read('build/sui-i02-20261102-epilogue-v1/wasm/build-manifest.json');
  const paths=new Set([...Object.keys(previous.sourceHashes),'SDK/wasm/index.html','SDK/macos/suika3-pack']);
  for(const dir of ['scenario','tools/compiler'])for(const f of fs.readdirSync(path.join(ROOT,dir)))if(fs.statSync(path.join(ROOT,dir,f)).isFile())paths.add(dir+'/'+f);
  const inventory=dir=>fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true}).forEach(e=>e.isDirectory()?inventory(dir+'/'+e.name):paths.add(dir+'/'+e.name));
  inventory('system/sui-u');
  const assets=read('assets/current/manifest.json').assets;
  for(const a of assets)paths.add(a.runtimePath);
  for(const f of ['docs/整合/bindings.json','assets/current/manifest.json','tools/runtime/build.cjs','tools/runtime/shell.js','tools/runtime/shell.css','tools/story-revision/build-p1.cjs'])paths.add(f);
  const fingerprints=[];
  for(const rel of [...paths].sort()){
    const bytes=fs.readFileSync(path.join(ROOT,rel));write(path.join(source,rel),bytes);
    fingerprints.push({path:rel,sha256:hash(bytes),bytes:bytes.length});
  }
  const origins=new Map(),samples=[];
  for(const s of sources.samples){
    const record=map.samples.find(m=>m.sourceFile===s.file),original=fs.readFileSync(path.join(ROOT,s.file),'utf8');
    assert.equal(hash(original),s.sourceSha256,'小样来源漂移：'+s.file);
    const draft=fs.readFileSync(path.join(ROOT,record.candidateFile),'utf8');
    const start=s.code==='C01'?draft.indexOf('<!-- TEXT '):draft.indexOf('\n## ')+1;
    let replacement=draft.slice(start).trim();
    // Writing drafts omit repeated "完整内容" envelopes. Insert only these
    // non-reading markers so the production parser retains its strict body gate.
    replacement=replacement.replace(/^(#{2,3} 第[三四五六七八九十]+章｜.+)$/gm,'$1\n\n### 完整内容');
    const lines=original.split('\n');lines.splice(s.controlFirstLine-1,s.controlLastLine-s.controlFirstLine+1,replacement);
    write(path.join(source,s.file),lines.join('\n'));
    const ids=[...draft.matchAll(/^<!-- TEXT (.+) -->$/gm)].map(m=>JSON.parse(m[1]).id);
    for(const id of record.retainedIds)origins.set(id,id);
    for(const c of record.changes){assert.equal(c.oldIds.length,1);for(const id of c.newIds)origins.set(id,c.oldIds[0]);}
    samples.push({name:s.sample,code:s.code,file:s.file,draft:record.candidateFile,draftSha256:hash(draft),ids});
  }
  const generated=compile({root:source,pageSize:108,textPolicy:'mixed'});
  assert.equal(new Set(generated.ir.nodes.filter(n=>n.textMeta).map(n=>n.paragraph)).size,468);
  // The option strings are unchanged. Re-use their measured textures only after
  // exact value/text comparison, then update the isolated manifest fingerprint.
  const old=JSON.parse(fs.readFileSync(path.join(ROOT,'build/sui-i02-20261102-epilogue-v1/wasm/generated/story.ir.json')));
  const choices=ir=>Object.values(ir.choices).map(c=>({id:c.id,question:c.question,options:c.options.map(o=>({value:o.value,text:o.text}))}));
  assert.deepEqual(choices(generated.ir),choices(old));
  const cinemaPath=path.join(source,'system/sui-cinema/manifest.json'),cinema=JSON.parse(fs.readFileSync(cinemaPath));cinema.contentBuildId=generated.ir.buildId;write(cinemaPath,cinema);
  const bindings=[],review=[];
  // These existing shots were checked against their precise new reading beat.
  const cgBeats=new Set(['T-C01-000004','T-PI-000521','T-PI-000476','T-PI-000630','T-PI-000645','T-MY-000403']);
  for(const n of generated.ir.nodes.filter(n=>['text','choice'].includes(n.op))){
    const parent=origins.get(n.paragraph),p=paragraphs.get(parent);
    const oldId=p?p.legacyNodeIds[0]:n.id,prior=oldById.get(oldId);assert(prior,'无旧节点来源：'+n.id);
    const b=structuredClone(prior);b.bindingId='p1-'+n.id;b.anchor={nodeId:n.id,file:'scenario/'+n.source.file,sha256:n.source.sha256};
    if(n.textMeta){
      const remote=['phone','video','voice','text','inner'].includes(n.textMeta.channel);
      if(remote){b.enter.characters=[];b.enter.props=[];}
      if(!cgBeats.has(n.paragraph)){b.enter.cg=null;b.cgId=null;b.fullView=false;}
      b.exit.restore=structuredClone(b.enter);
      review.push({id:n.paragraph,sourceId:parent,sourceBinding:prior.bindingId,channel:n.textMeta.channel,displayName:n.textMeta.displayName,background:b.enter.background?.assetId||null,characters:b.enter.characters.map(p=>p.assetId),cgId:b.cgId,decision:remote?'远程／心声单独画面，清除现场立绘与道具':b.cgId?'核对至本句动作后复用既有CG':'按原场景与在场人物核对；拆句不自动延长CG',scope:'仅P1独立技术小样；正式采用仍待P3/P4'});
    }
    bindings.push(b);
  }
  const m=model(generated.ir),allA=Object.fromEntries(Object.keys(generated.ir.choices).map(id=>[id,'A']));
  const entries=[{id:'common',label:'网吧多人',start:samples[0].ids[0]+'_1',state:m.fresh() }];
  for(const [id,code,stop] of [['piao','PI','PI-L06-01'],['mengyao','MY','MY07-01']]){
    const answers={...allA,'ROUTE-01':id};for(const c of generated.ir.contract.piaoRelation.choices)answers[c.id]='B';
    if(id==='piao')for(const c of Object.values(generated.ir.choices).filter(c=>c.source.file===generated.ir.contract.routes.find(r=>r.id===id).file))delete answers[c.id];
    else for(const key of ['MY07-01','MY08-01','MY09-01','MY10-01'])delete answers[key];
    delete answers[stop];const state=m.run(answers).s;m.validate(state);
    entries.push({id,label:id==='piao'?'飘 LOW':'孟遥条件段',start:samples.find(s=>s.code===code).ids[0]+'_1',state});
  }
  write(path.join(out,'input-manifest.json'),{scope:'P1独立预览；原始依赖指纹，scenario仅在input内拼入三份候选',inputs:fingerprints});
  write(path.join(out,'samples.json'),{samples,entries,commonLast:samples[0].ids.at(-1)+'_1',contentBuildId:generated.ir.buildId});
  write(path.join(out,'binding-review.json'),review);write(path.join(out,'bindings.json'),bindings);
  return {source,generated,assets,bindings,entries,samples};
}
function buildPreview({attempt='preview-v1'}={}){
  assert(/^[a-z0-9-]+$/.test(attempt));const out=path.join(ROOT,QA,attempt);assert(!fs.existsSync(out),'不得覆盖旧尝试');
  const prepared=prepare(out),{source,generated,assets,bindings,entries,samples}=prepared;
  let start=fs.readFileSync(path.join(source,'start.novel'),'utf8');
  start=start.replace('[goto name="SC_ENTRY"]','[goto name="P1_MENU"]');
  start+='\n[label name="P1_MENU"]\n[p1_menu]\n[text text="P1 独立小样 · 请选择阅读片段。\n片段从已核对的前置状态开始，片段内选择由你决定。"]\n[choose name="p1_sample" '+entries.map((e,i)=>`text${i+1}=${JSON.stringify(e.label)} value${i+1}=${JSON.stringify(e.id)}`).join(' ')+']\n[p1_begin]\n[label name="P1_SAMPLE_DONE"]\n[p1_done]\n';
  start=start.replace('请选择阅读片段。\n片段','请选择阅读片段。\\n片段');
  write(path.join(source,'start.novel'),start);
  const q=JSON.stringify,set=(k,v)=>`sc_set(${q(k)},${q(String(v??''))});`;
  const seedFunctions=entries.map(e=>{
    const s=e.state,lines=[...Object.entries(s.choices).map(([k,v])=>set('c_'+k,v)),...['score','relation','route','ending'].map(k=>set(k,s[k])),...s.events.map(ev=>set('e_'+ev,1))];
    const groups=[];for(let i=0;i<lines.length;i+=8)groups.push(lines.slice(i,i+8));
    return groups.map((lines,i)=>`func p1_seed_${e.id}_${i}() {${lines.join('\n')}}`).join('\n')+`\nfunc p1_seed_${e.id}() {${groups.map((_,i)=>`p1_seed_${e.id}_${i}();`).join('')} if(!sc_validate()) return sc_jump("SC_ERROR"); return sc_jump(${q(e.start)});}`;
  }).join('\n');
  const extra=`\n${seedFunctions}
func Tag_p1_menu(params) {eMode="p1-menu";Suika.moveToNextTag();return true;}
func Tag_p1_begin(params) {eMode="reading";eLastStable=-1;var id=Suika.getVariableString({name:"p1_sample"}); print("SUI_E|p1-begin|"+id); ${entries.map(e=>`if(id==${q(e.id)}) return p1_seed_${e.id}();`).join(' ')} return sc_jump("SC_ERROR");}
func Tag_p1_done(params) {eMode="complete";Suika.showNameBox({show:false});print("SUI_E|p1-done|common");eJump("e_complete");return true;}
var p1Last="";
func p1Observe() {
 var tag=Suika.getTagName();if(eMode!="reading") return;if(tag!="text"&&tag!="choose") return;
 var name="";var message="";if(Suika.getHistoryCount()>0){name=Suika.getHistoryName({index:0});message=Suika.getHistoryMessage({index:0});}
 if(tag=="text" && message!=Suika.getTagArgString({name:"text",omissible:true,defVal:""})) return;
 if(tag=="text" && name!=Suika.getTagArgString({name:"name",omissible:true,defVal:""})) return;
 var alpha=Suika.getLayerAlpha({layer:Suika.LAYER_NAMEBOX});if(alpha!=0&&alpha!=255) return;
 var value=sc_get("cursor")+"|tag="+tag+"|native="+name+"|alpha="+Suika.getLayerAlpha({layer:Suika.LAYER_NAMEBOX})+"|auto="+Suika.isAutoMode()+"|skip="+Suika.isSkipMode();
 if(value==p1Last) return;p1Last=value;
 print("SUI_E|p1-observe|cursor="+value+"|message="+message);
}
`;
  const manifest=build({out:path.join(out,'runtime'),projectRoot:source,compiled:generated,databasePrefix:'bijie-p1-isolated-20261102:',integration:{assets,bindings,fingerprint:hash(JSON.stringify(bindings)+extra),adapt:args=>{
    let a=integrate({...args,assets,bindings,mode:'diagnostic'});
    a.ray+=extra;a.host=a.host.replace('    Suika.render(); suiUIRender();','    Suika.render(); suiUIRender(); p1Observe();');
    const last=samples[0].ids.at(-1)+'_1',n=generated.ir.nodes.find(n=>n.id===last);
    a.contentNovel=a.contentNovel.replace(`[sc_at id="${last}"]\n[text text=${q(n.text)}]\n[goto name=${q(n.next)}]`,`[sc_at id="${last}"]\n[text text=${q(n.text)}]\n[goto name="P1_SAMPLE_DONE"]`);
    return a;
  }}});
  const htmlPath=path.join(out,'runtime/web/index.html');let html=fs.readFileSync(htmlPath,'utf8');html=html.replace('<span>毕节，雨停之前</span>','<span>P1 小样 · 网吧／飘 LOW／孟遥</span>');write(htmlPath,html);
  const htmlOutput=manifest.outputs.find(f=>f.path==='web/index.html');
  manifest.previewHeader={beforeSha256:htmlOutput.sha256,afterSha256:hash(html)};
  htmlOutput.sha256=hash(html);htmlOutput.bytes=Buffer.byteLength(html);
  write(path.join(out,'runtime/build-manifest.json'),manifest);
  write(path.join(out,'preview-manifest.json'),{scope:'P1独立可运行小样，非正式全稿候选',contentBuildId:generated.ir.buildId,runtimeBuildId:manifest.runtimeBuildId,entry:path.relative(ROOT,path.join(out,'runtime/web')),samples:samples.map(s=>({name:s.name,paragraphs:s.ids.length})),databasePrefix:manifest.databasePrefix,htmlSha256:hash(html)});
  console.log(JSON.stringify({status:'built',attempt,pages:generated.manifest.counts.pages,explicitParagraphs:468}));return prepared;
}
if(require.main===module)buildPreview({attempt:process.argv[2]||'preview-v1'});
module.exports={buildPreview,prepare,ROOT,QA};
