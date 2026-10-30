#!/usr/bin/env node
'use strict';
// 当前源码与旧可达状态证据之间的离线回归。只运行生成注册/恢复函数的 JS 转译，
// 不加载引擎，不解码图片，不将本结果称为浏览器、原生或逐帧视觉验收。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),BASE='build/sui-i02-20261030-v7/input/';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const json=p=>JSON.parse(read(p));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const plain=v=>JSON.parse(JSON.stringify(v));
const checks=[];
function check(name,details){checks.push({name,pass:true,details});}
const report={scope:'当前编译与生成演出注册/恢复函数的离线模型回归；沿用冻结可达状态，不重新遍历全部路线。不含引擎、图片解码、浏览器、真机、原生或发布验收。',checks};
try {
  const generated=require('../../tools/compiler/compile.cjs').compile({root:ROOT,pageSize:108});
  const B=json('docs/整合/bindings.json'),old=json(BASE+'docs/整合/bindings.json');
  const M=json('assets/current/manifest.json'),oldM=json(BASE+'assets/current/manifest.json');
  const witnesses=json('qa/sui-i01-closeout-20261030/state-witnesses.json');
  const assets=new Map(M.assets.map(a=>[a.assetId,a]));
  const nodes=new Map(generated.ir.nodes.map(n=>[n.id,n]));
  const bindings=new Map(B.bindings.map(b=>[b.bindingId,b]));
  assert.equal(B.version,'sui-i01-dialogue-20261030-v3','先生成本批绑定再运行');
  assert.deepEqual(B.sourceHashes,old.sourceHashes);
  assert.deepEqual(generated.manifest.sourceHashes,B.sourceHashes);
  assert.equal(bindings.size,3086);assert.equal(witnesses.length,3086);
  assert.equal(new Set(witnesses.map(w=>w.bindingId)).size,3086);
  assert.deepEqual([...bindings.keys()].sort(),old.bindings.map(b=>b.bindingId).sort());
  for(const before of old.bindings){
    const after=bindings.get(before.bindingId);
    for(const field of ['anchor','condition','conditionAst','routeIds','cgId','fullView'])assert.deepEqual(after[field],before[field],before.bindingId+' '+field);
    for(const field of ['background','props','cg'])assert.deepEqual(after.enter[field],before.enter[field],before.bindingId+' '+field);
    assert.equal(after.exit.at,before.exit.at);
    assert.deepEqual(after.exit.restore,{...after.enter,cg:null},before.bindingId+' 退场状态');
  }
  // 不把摘要或被重新生成的source-map当成正文证明，直接逐源段还原分页文字。
  const paragraphs=new Map();
  for(const n of generated.ir.nodes.filter(n=>n.op==='text')){
    assert(n.text.length>0,n.id+' 空正文页');
    const key=n.source.file+':'+n.source.line;
    paragraphs.set(key,(paragraphs.get(key)||'')+n.text);
  }
  for(const [key,value]of paragraphs){const k=key.lastIndexOf(':'),file=key.slice(0,k),line=+key.slice(k+1);assert.equal(value,read('scenario/'+file).split('\n')[line-1].trim(),key);}
  for(const before of oldM.assets){const a=assets.get(before.assetId);assert(a);for(const k of ['runtimePath','runtimeSha256','sourcePath','sourceSha256','width','height','format','alpha','type'])assert.deepEqual(a[k],before[k],a.assetId+' '+k);}
  check('正文、节点身份、条件、路线、60CG及图片登记保持一致',{bindings:3086,paragraphs:paragraphs.size,cg:B.bindings.filter(b=>b.cgId).length,assets:M.assets.length});
  let maxCharacters=0,portraits=0,choicesWithCharacters=0;
  for(const b of B.bindings){
    const n=nodes.get(b.anchor.nodeId);assert(n&&['text','choice'].includes(n.op));
    assert(b.enter.characters.length<=3,n.id+' 人物超过三槽');
    assert.equal(new Set(b.enter.characters.map(p=>p.layer)).size,b.enter.characters.length,n.id+' 图层重复');
    maxCharacters=Math.max(maxCharacters,b.enter.characters.length);
    if(b.enter.characters.length){portraits++;if(n.op==='choice')choicesWithCharacters++;}
    for(const p of b.enter.characters){assert.equal(assets.get(p.assetId)?.type,'character');assert.equal(assets.get(p.assetId).approval.status,'approved');}
  }
  check('全节点角色数、采用状态及选择等待人物',{maxCharacters,portraits,choicesWithCharacters});
  const gateRanges={
    '第一章-回到毕节.md':[[1,10000]],
    '第二章-十四天.md':[[1,554],[610,10000]],
    '第三章-选一条路.md':[[1,10000]],
    '黄球球-门后.md':[[17,27],[77,77],[189,189],[279,371],[435,449],[459,475],[507,507],[706,706],[744,744],[793,793],[805,808],[821,850],[881,10000]],
  };
  let doorChecks=0,formChecks=0;
  for(const b of B.bindings){
    const n=nodes.get(b.anchor.nodeId),hq=b.enter.characters.filter(p=>p.assetId.startsWith('sui-a06-'));
    if((gateRanges[n.source.file]||[]).some(([s,e])=>n.source.line>=s&&n.source.line<=e)){assert.equal(hq.length,0,n.source.file+':'+n.source.line+' 门外/不在场人物');doorChecks++;}
    for(const p of hq){
      assert(['黄球球-门后.md','第二章-十四天.md'].includes(n.source.file),n.id+' 非现场黄球球');
      const expected=n.source.file==='第二章-十四天.md'||n.source.line<509?'orb':'human';
      assert(p.assetId.startsWith('sui-a06-'+expected+'-'),n.id+' 形态时点');assert.equal(p.form,expected);formChecks++;
    }
  }
  check('黄球球先获准开门、第55天人形及结束后不回退形态',{doorChecks,formChecks});
  const ui=json('system/sui-u/integration.json');
  let totalRestores=0,totalRejects=0,placementComparisons=0,frE2Checks=0;
  report.platforms=[];
  for(const sdkPlatform of ['wasm','desktop']){
    const adapted=require('../../tools/integration/runtime/presentation-full.cjs').integrate({generated,host:read('main.ray'),uiRay:ui.raySourceOrder.map(read).join('\n'),assets:M.assets,bindings:B.bindings,sdkPlatform});
    const prefix=adapted.ray.slice(0,adapted.ray.indexOf('// SUI-I02 presentation executor'));
    let saved={},native={},failure='',stage={},applies=0;
    const suika={LAYER_BG:'bg',LAYER_CHL:'left',LAYER_CHC:'center',LAYER_CHR:'right',LAYER_EFF1:'prop1',LAYER_EFF2:'prop2',LAYER_EFF3:'cg',
      setLayerFile:({layer,file})=>{(stage[layer]??={}).file=file;applies++;return true;},
      createImage:({width,height})=>({width,height,file:''}),createImageFromFile:({file})=>({file}),
      setLayerImage:({layer,image})=>{(stage[layer]??={}).image=image;},
      setLayerAlpha:({layer,alpha})=>{(stage[layer]??={}).alpha=alpha;},
      setLayerPosition:({layer,x,y})=>{Object.assign(stage[layer]??={},{x,y});},
      setLayerScale:({layer,scaleX,scaleY})=>{Object.assign(stage[layer]??={},{scaleX,scaleY});}};
    const ctx={iStates:{},iBindings:{},iNodes:{},iLayers:{},iLiveLayers:{},iFullView:false,
      Array:{push:(a,x)=>a.push(x),size:a=>a.length},Dict:{hasKey:(o,k)=>Object.hasOwn(o,k)},
      Suika:suika,suiHistoryText:()=>false,suiUIRegisterCG:()=>true,iFix:()=>{}};
    ctx.iRegister=b=>{ctx.iBindings[b.id]=b;ctx.iNodes[b.node]=[b.id];};
    ctx.iGet=k=>saved[k]??'';ctx.iSet=(k,v)=>{saved[k]=String(v);};ctx.sc_get=k=>native[k]??'';
    ctx.sc_ok=()=>!failure;ctx.sc_fail=s=>{failure=s;return false;};ctx.sc_has=(a,v)=>a.includes(v);
    ctx.sc_condition=ast=>ast.some(terms=>terms.every(t=>{
      const v=t.field==='PIAO_RELATION'?native.relation:t.field==='ENDING'?native.ending:native['c_'+t.field];
      if(!v||v==='UNSET'){failure='unvisited';return false;}return t.operator==='='?v===t.value:v!==t.value;
    }));
    vm.createContext(ctx);vm.runInContext(prefix.replaceAll('func ','function '),ctx);vm.runInContext('iInstall()',ctx);
    function extract(name){
      const start=adapted.ray.indexOf('func '+name+'(');assert(start>=0,name);
      const first=adapted.ray.indexOf('{',start);let depth=1,end=first+1;
      while(depth){assert(end<adapted.ray.length,name+' 大括号未结束');if(adapted.ray[end]==='{')depth++;if(adapted.ray[end]==='}')depth--;end++;}
      return adapted.ray.slice(start,end).replace('func ','function ')
        .replace('for (name,layer in iLayers)','for (const [name,layer] of Object.entries(iLayers))')
        .replace(/for\s*\((\w+) in ([^)]+)\)/g,'for (const $1 of $2)');
    }
    for(const name of ['iApply','iMatches','iValidate','iRestore'])vm.runInContext(extract(name),ctx);
    const backdrop={assetId:'ui:backdrop',layer:'bg',file:'system/sui-u/png/reading-backdrop.png',x:0,y:0,scale:1,webp:false,form:'',costume:''};
    assert(fs.existsSync(path.join(ROOT,backdrop.file)),'UI底图文件缺失');
    const expected=state=>[...(state.background?[]:[backdrop]),...[state.background,...state.characters,...state.props,state.cg].filter(Boolean).map(p=>({assetId:p.assetId,layer:p.layer,file:assets.get(p.assetId).runtimePath,x:Math.round(p.x),y:Math.round(p.y),scale:p.scale,webp:assets.get(p.assetId).runtimePath.endsWith('.webp'),form:p.form||'',costume:p.costume||''}))];
    function checkApplied(wanted,label){
      const active=new Map(wanted.map(p=>[p.layer,p]));
      assert(active.has('bg'),label+' 缺可见BG');
      for(const name of Object.keys(ctx.iLayers)){
        const p=active.get(name),s=stage[name];assert(s,label+' 图层未初始化 '+name);
        if(!p){assert.equal(s.alpha,0,label+' 残留图层 '+name);continue;}
        assert.equal(s.file,p.file,label+' 文件 '+name);assert.equal(s.image.file,p.file,label+' 图像 '+name);
        assert.equal(s.alpha,255,label+' 不透明度 '+name);assert.equal(s.x,p.x);assert.equal(s.y,p.y);assert.equal(s.scaleX,p.scale);assert.equal(s.scaleY,p.scale);
      }
    }
    // 包括没有被旧见证单独选中的共用状态与 empty；每个生成状态都需实际有BG。
    let fallbackStates=0;
    for(const [name,state]of Object.entries(ctx.iStates)){
      const bg=state.filter(p=>p.layer==='bg');assert.equal(bg.length,1,name+' 背景数量');
      if(bg[0].assetId==='ui:backdrop')fallbackStates++;
    }
    for(const w of witnesses){
      const b=ctx.iBindings[w.bindingId],source=bindings.get(w.bindingId);assert(b&&source);
      assert.equal(b.node,w.nodeId);
      native={cursor:w.nodeId,route:w.state.route||'',relation:w.state.relation,ending:w.state.ending||'',...Object.fromEntries(Object.entries(w.state.choices).map(([k,v])=>['c_'+k,v]))};
      const goodNative={...native};saved={active:b.id,state:b.enter};failure='';
      assert(ctx.iValidate(),w.bindingId+' 合法状态校验');assert(ctx.iRestore(),w.bindingId+' 合法恢复');
      checkApplied(expected(source.enter),w.bindingId+' 恢复');totalRestores++;
      for(const phase of ['enter','restore']){
        const state=phase==='enter'?source.enter:source.exit.restore,wanted=expected(state);
        assert.deepEqual(plain(ctx.iStates[b[phase]]),wanted,w.bindingId+' '+phase);
        assert(ctx.iApply(b[phase]));checkApplied(wanted,w.bindingId+' '+phase);placementComparisons++;
      }
      // 验证函数拒绝六种存储损坏，恢复函数同样拒绝且不触碰舞台。
      const otherActive=Object.keys(ctx.iBindings).find(k=>k!==b.id);
      const otherState=Object.keys(ctx.iStates).find(k=>k!==b.enter&&k!=='empty');
      for(const mutation of [{active:''},{active:'unknown'},{active:otherActive},{state:'empty'},{state:'missing'},{state:otherState}]){
        saved={active:b.id,state:b.enter,...mutation};native={...goodNative};failure='';
        assert.equal(ctx.iValidate(),false,w.bindingId+' 接受损坏 '+JSON.stringify(mutation));
        failure='';const previous=applies;assert.equal(ctx.iRestore(),false,w.bindingId+' 恢复损坏');
        assert.equal(failure,'presentation-invalid-save');assert.equal(applies,previous,'非法恢复不应更改舞台');totalRejects++;
      }
      if(source.anchor.file.includes('/后日谈-')){
        native={...goodNative,ending:'FR-E2',route:'friends'};failure='';
        if(ctx.iMatches(b)){assert.equal(source.enter.characters.length,0,w.nodeId+' FR-E2后日谈实体侵入');frE2Checks++;}
      }
    }
    report.platforms.push({sdkPlatform,raySha256:sha(adapted.ray),generatedStates:Object.keys(ctx.iStates).length,fallbackStates,bindings:witnesses.length,validRestores:witnesses.length,rejectedCorruptStates:witnesses.length*6,placementComparisons:witnesses.length*2});
  }
  assert(frE2Checks>0,'FR-E2后日谈检查没有实际覆盖节点');
  check('两平台生成enter/restore与声明一致，缺地点状态有UI底图',{placementComparisons,platforms:report.platforms});
  check('沿用全部3086可达见证，真实生成函数通过合法恢复并拒绝损坏',{totalRestores,totalRejects,validationAndRestoreRejections:totalRejects*2,usesMockedNativeImageAPI:true});
  check('FR-E2在两份后日谈可达节点不出现实体人物',{frE2Checks});
  report.status='PASS_OFFLINE_BINDINGS_AND_GENERATED_STATE_MODEL';
  report.inputs={bindings:{path:'docs/整合/bindings.json',sha256:sha(read('docs/整合/bindings.json'))},manifest:{path:'assets/current/manifest.json',sha256:sha(read('assets/current/manifest.json'))},witnesses:{path:'qa/sui-i01-closeout-20261030/state-witnesses.json',sha256:sha(read('qa/sui-i01-closeout-20261030/state-witnesses.json'))},sourceHashes:generated.manifest.sourceHashes};
} catch(e){report.status='FAIL';report.failure=e.stack;process.exitCode=1;}
fs.writeFileSync(path.join(__dirname,'binding-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.map(c=>c.name),platforms:report.platforms,failure:report.failure},null,2));
