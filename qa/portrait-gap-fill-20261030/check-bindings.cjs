'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),json=p=>JSON.parse(read(p)),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),plain=v=>JSON.parse(JSON.stringify(v));
const checks=[],check=(name,details)=>checks.push({name,pass:true,details});
const report={scope:'本批逐段决定、来源/角色边界及两平台生成状态恢复的离线模型检查；复用既有可达状态见证，不表示新增引擎/真机/逐帧验收。',checks};
try{
 const generated=require('../../tools/compiler/compile.cjs').compile({pageSize:108});
 const B=json('docs/整合/bindings.json'),M=json('assets/current/manifest.json');
 const old=json('qa/portrait-gap-fill-20261030/before/docs__整合__bindings.json'),oldM=json('qa/portrait-gap-fill-20261030/before/assets__current__manifest.json');
 const review=json('qa/portrait-gap-fill-20261030/review.json');
 const witnesses=json('qa/sui-i01-closeout-20261030/state-witnesses.json');
 const assets=new Map(M.assets.map(a=>[a.assetId,a])),nodes=new Map(generated.ir.nodes.map(n=>[n.id,n])),bindings=new Map(B.bindings.map(b=>[b.bindingId,b]));
 const byNode=new Map(B.bindings.map(b=>[b.anchor.nodeId,b]));
 assert.equal(B.version,'sui-i01-portraits-20261030-v5');assert.equal(bindings.size,3086);assert.equal(M.assets.length,226);assert.equal(witnesses.length,3086);
 assert.deepEqual(B.sourceHashes,old.sourceHashes);assert.deepEqual(generated.manifest.sourceHashes,B.sourceHashes);
 assert.deepEqual(B.bindings.map(b=>b.bindingId),old.bindings.map(b=>b.bindingId));
 for(const before of oldM.assets)assert.deepEqual(assets.get(before.assetId),before,'旧资源登记变化 '+before.assetId);
 for(const before of old.bindings){const after=bindings.get(before.bindingId);
  for(const field of ['anchor','condition','conditionAst','routeIds','cgId','fullView'])assert.deepEqual(after[field],before[field],before.bindingId+' '+field);
  for(const field of ['background','props','cg'])assert.deepEqual(after.enter[field],before.enter[field],before.bindingId+' '+field);
  for(const p of before.enter.characters){const q=after.enter.characters.find(q=>q.assetId===p.assetId);assert(q,'已有角色/表情被丢弃');for(const k of ['scale','y','form','costume'])assert.equal(q[k],p[k],k+'不得被补图改变');}
  assert.deepEqual(after.exit.restore,{...after.enter,cg:null});assert(after.enter.characters.length<=3);
 }
 check('正文、3086节点身份/分支、212原图登记、表情/衣装/形态、60CG和道具不变',{assets:226,newImages:14,bindings:3086,cg:B.bindings.filter(b=>b.cgId).length});
 let kept=0,added=0;
 for(const p of review.paragraphs)for(const part of p.parts){const b=byNode.get(part.nodeId);assert(b);if(p.decision==='keep'){assert.equal(b.enter.characters.length,0,p.file+':'+p.line+'不应出现实体');kept++;}else{assert(b.enter.characters.some(c=>c.assetId===p.assetId),p.file+':'+p.line+'没有补入审定角色');added++;}}
 assert.equal(kept,723);assert.equal(added,64); // 722个保留段落中孟遥632行分成两页。
 check('786段逐段决定完整应用：722保留，54补绘、10复用；分页不重复计段',{paragraphs:786,keptPages:kept,addedPages:added});
 const paragraphs=new Map();for(const n of generated.ir.nodes.filter(n=>n.op==='text')){const key=n.source.file+':'+n.source.line;paragraphs.set(key,(paragraphs.get(key)||'')+n.text);}
 for(const [key,v]of paragraphs){const i=key.lastIndexOf(':');assert.equal(v,read('scenario/'+key.slice(0,i)).split('\n')[+key.slice(i+1)-1].trim());}
 check('3019原文段落分页重组与来源逐字一致',{paragraphs:paragraphs.size,pages:generated.manifest.counts.pages});
 // 沿用原门禁和形态约束；本批不改变任何黄球球绑定。
 for(const before of old.bindings){if(before.anchor.file.endsWith('/黄球球-门后.md')){const after=bindings.get(before.bindingId);assert.deepEqual(after.enter.characters.filter(p=>p.assetId.startsWith('sui-a06-')),before.enter.characters.filter(p=>p.assetId.startsWith('sui-a06-')));}}
 check('黄球球形态/开门约束和所有原有女主肖像保持原规则');
 const ui=json('system/sui-u/integration.json');let totalRestores=0,totalRejects=0,placementComparisons=0,frE2Checks=0;
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
