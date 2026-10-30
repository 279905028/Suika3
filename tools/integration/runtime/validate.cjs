#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {condition}=require('../../compiler/parse.cjs');
const ROOT=path.resolve(__dirname,'../../..'),INTERFACE='docs/整合/interface-v1.json';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;
const stable=x=>JSON.stringify(normalize(x));
function checkSchema(value,schema,defs,label){
  if(schema.$ref)return checkSchema(value,defs[schema.$ref.split('/').pop()],defs,label);
  if(schema.anyOf){const errors=[];for(const sub of schema.anyOf)try{checkSchema(value,sub,defs,label);return;}catch(e){errors.push(e.message);}throw Error(label+' 类型不符合任一允许结构：'+errors.join('；'));}
  if('const' in schema)assert.deepEqual(value,schema.const,label+' 不支持的值/版本');
  if(schema.enum)assert(schema.enum.includes(value),label+' 不支持的枚举值：'+value);
  if(schema.type){const type=schema.type;assert(type==='null'?value===null:type==='array'?Array.isArray(value):type==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):type==='integer'?Number.isInteger(value):typeof value===type,label+' 类型须为'+type);}
  if(typeof value==='number'){assert(Number.isFinite(value),label+' 不是有限数');if('minimum'in schema)assert(value>=schema.minimum,label+' 过小');if('exclusiveMinimum'in schema)assert(value>schema.exclusiveMinimum,label+' 过小');if('maximum'in schema)assert(value<=schema.maximum,label+' 过大');}
  if(typeof value==='string'){if(schema.minLength)assert(value.trim().length>=schema.minLength,label+' 不得为空');if(schema.pattern)assert(new RegExp(schema.pattern).test(value),label+' 格式错误');}
  if(Array.isArray(value)){if(schema.maxItems!==undefined)assert(value.length<=schema.maxItems,label+' 项目过多');if(schema.uniqueItems)assert.equal(new Set(value.map(stable)).size,value.length,label+' 重复项');if(schema.items)value.forEach((v,i)=>checkSchema(v,schema.items,defs,label+'['+i+']'));}
  if(value&&typeof value==='object'&&!Array.isArray(value)){if(schema.minProperties)assert(Object.keys(value).length>=schema.minProperties,label+' 属性不足');for(const k of schema.required||[])assert(Object.hasOwn(value,k),label+' 缺字段 '+k);for(const[k,v]of Object.entries(value)){const sub=schema.properties?.[k];if(sub)checkSchema(v,sub,defs,label+'.'+k);else if(schema.additionalProperties===false)throw Error(label+' 未知字段 '+k);else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')checkSchema(v,schema.additionalProperties,defs,label+'.'+k);}}
}
function safeFile(root,rel){
  assert(typeof rel==='string'&&!path.isAbsolute(rel)&&!rel.includes('\\')&&!rel.includes('\0')&&rel.split('/').every(p=>p&&p!=='.'&&p!=='..'),'非法工程相对路径：'+rel);
  let cur=root;for(const part of rel.split('/')){cur=path.join(cur,part);const st=fs.lstatSync(cur);assert(!st.isSymbolicLink(),'禁止符号链接输入：'+rel);}
  assert(fs.statSync(cur).isFile(),'输入不是文件：'+rel);return cur;
}
function validate({root=ROOT,manifestPath='assets/current/manifest.json',bindingsPath='docs/整合/bindings.json',snapshotPath,compiled,mode='candidate',outputDir,outputRoot=root}={}){
  root=path.resolve(root);assert(['candidate','diagnostic'].includes(mode),'未知构建模式：'+mode);assert(compiled?.ir&&compiled?.manifest&&compiled?.artifacts,'须传入当前compile({pageSize:108})结果');assert.equal(compiled.manifest.pageSize,108,'整合分页固定108');
  const diagnostic=mode==='diagnostic';
  if(diagnostic){assert(outputDir,'诊断输出必须显式指定');const rel=path.relative(path.resolve(outputRoot),path.resolve(outputDir)).split(path.sep).join('/');assert(/^qa\/sui-i02-[^/]+(?:\/|$)/.test(rel)&&!rel.split('/').includes('..'),'诊断只允许输出至qa/sui-i02-<批次>/');}
  const records=new Map();
  function read(rel,expected){const p=safeFile(root,rel),data=fs.readFileSync(p),sha256=hash(data);if(expected)assert.equal(sha256,expected,'输入指纹不符：'+rel);records.set(rel,{path:rel,sha256,bytes:data.length});return data;}
  const interfaceBytes=read(INTERFACE),spec=JSON.parse(interfaceBytes),defs=spec.$defs;
  const manifestBytes=read(manifestPath),manifest=JSON.parse(manifestBytes);checkSchema(manifest,defs.manifest,defs,'manifest');
  const bindingsBytes=read(bindingsPath),bindings=JSON.parse(bindingsBytes);checkSchema(bindings,defs.bindings,defs,'bindings');
  assert(snapshotPath,'缺少I01冻结快照snapshotPath');const snapshotBytes=read(snapshotPath),snapshot=JSON.parse(snapshotBytes);checkSchema(snapshot,defs.snapshot,defs,'snapshot');
  assert.equal(snapshot.interfaceSha256,hash(interfaceBytes),'接口指纹已变化，I01须重新核对');
  assert.deepEqual(snapshot.manifest,{path:manifestPath,sha256:hash(manifestBytes)},'快照manifest不匹配');assert.deepEqual(snapshot.bindings,{path:bindingsPath,sha256:hash(bindingsBytes)},'快照bindings不匹配');
  assert.equal(bindings.manifestSha256,hash(manifestBytes),'绑定采用清单指纹不符');assert.equal(bindings.contentBuildId,compiled.ir.buildId,'绑定正文构建版本已变化');assert.deepEqual(bindings.sourceHashes,compiled.manifest.sourceHashes,'绑定正文输入指纹已变化');
  for(const[p,h]of Object.entries(bindings.sourceHashes))read(p,h);
  for(const[p,h]of Object.entries(compiled.manifest.compilerHashes))read(p,h);
  assert.deepEqual(manifest.scope,bindings.scope,'资源/绑定范围不一致');assert.deepEqual(manifest.scope,snapshot.scope,'资源/快照范围不一致');assert.deepEqual(snapshot.missing,manifest.scope.missing,'缺项表不一致');
  const scope=manifest.scope;assert.equal(scope.kind==='diagnostic',diagnostic,'诊断身份与构建模式不符');if(scope.kind==='complete')assert.equal(scope.missing.length,0,'完整候选仍有缺项');else assert(scope.missing.length>0,'阶段或诊断包须明确缺项');
  const sourceMap=JSON.parse(compiled.artifacts['source-map.json']);assert.equal(sourceMap.buildId,compiled.ir.buildId,'source-map版本不符');
  const R=compiled.ir.contract,routeIds=new Set(R.routes.map(r=>r.id));
  const gallery=JSON.parse(read('system/sui-u/gallery.registry.json')).items.map(x=>x.id),selected=JSON.parse(read('docs/CG当前选择.json')).activeSelectedIds;
  assert.deepEqual([...gallery].sort(),[...selected].sort(),'U图鉴登记与当前CG选择不一致');assert.equal(gallery.length,60,'当前图鉴须60项');const galleryIds=new Set(gallery);
  const assets=new Map(),runtimePaths=new Set();
  const a11Cache=new Map();
  for(const a of manifest.assets){
    assert(!assets.has(a.assetId),'重复assetId：'+a.assetId);assert(!runtimePaths.has(a.runtimePath),'运行文件重复映射：'+a.runtimePath);runtimePaths.add(a.runtimePath);assets.set(a.assetId,a);
    assert(a.sourcePath.startsWith('assets/sources/')||(diagnostic&&/^qa\/sui-i02-[^/]+\//.test(a.sourcePath)),'图片来源超出白名单：'+a.sourcePath);
    assert(diagnostic?/^qa\/sui-i02-[^/]+\//.test(a.runtimePath):a.runtimePath.startsWith('assets/current/'),'运行资源目录/身份不符：'+a.runtimePath);
    read(a.sourcePath,a.sourceSha256);const image=read(a.runtimePath,a.runtimeSha256);assert.equal(image.length,a.bytes,'运行资源字节数不符：'+a.assetId);
    if(a.format==='PNG')assert(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&/\.png$/.test(a.runtimePath),'PNG签名/扩展名错误：'+a.assetId);
    else assert(image.toString('ascii',0,4)==='RIFF'&&image.toString('ascii',8,12)==='WEBP'&&/\.webp$/.test(a.runtimePath),'WebP签名/扩展名错误：'+a.assetId);
    assert(a.approval.scope.includes(a.assetId),'批准范围不含当前assetId：'+a.assetId);
    if(diagnostic){assert.equal(a.approval.status,'diagnostic-only','诊断不可伪装正式采用');assert.equal(a.approval.evidence,null,'诊断不得附加正式批准记录');}
    else{assert.equal(a.approval.status,'approved','资源未获采用批准：'+a.assetId);assert(a.approval.evidence,'缺批准证据：'+a.assetId);read(a.approval.evidence.path,a.approval.evidence.sha256);assert(a.a11,'缺A11证据：'+a.assetId);}
    if(a.a11){
      const bytes=read(a.a11.path,a.a11.sha256);if(!a11Cache.has(a.a11.path))a11Cache.set(a.a11.path,JSON.parse(bytes));
      const matches=a11Cache.get(a.a11.path).records?.filter(r=>r.assetId===a.a11.assetId)||[];assert.equal(matches.length,1,'A11记录不存在或不唯一：'+a.assetId);const r=matches[0];
      assert.equal(r.offlineStatus,'通过','A11未通过：'+a.assetId);assert.equal(r.formatStatus,'通过','A11格式未通过：'+a.assetId);assert.equal(r.role,'pending_adoption_review','A11仅参考资源不能采用：'+a.assetId);
      assert.equal(a.sourceSha256,r.expectedSourceSha256,'源图不符A11：'+a.assetId);assert.equal(a.sourcePath,r.sourceFile,'源图路径不符A11：'+a.assetId);
      const meta=a.format==='WEBP'?r.webpMetadata:r.pngCompatibilityMetadata;assert(meta,'A11无该编码兼容衍生：'+a.assetId);assert.equal(a.runtimeSha256,meta.sha256,'运行衍生不符A11：'+a.assetId);
      for(const k of ['width','height','bytes'])assert.equal(a[k],meta[k],'运行尺寸/字节不符A11：'+a.assetId);
      assert.equal(a.alpha,Boolean(meta.alpha?.channelPresent),'alpha标记不符A11：'+a.assetId);assert.equal(a.encoding.lossless,true,'A11当前只交接无损衍生：'+a.assetId);
    }
  }
  const bindingIds=new Set(),nodeIds=new Set(),boundCG=new Map(),resolvedBindings=[];
  function state(s,label){const layers=new Set();for(const[k,placements]of Object.entries({background:s.background?[s.background]:[],characters:s.characters,props:s.props,cg:s.cg?[s.cg]:[]})){const allowed={background:['bg'],characters:['left','center','right'],props:['prop1','prop2'],cg:['cg']}[k],type={background:'background',characters:'character',props:'prop',cg:'cg'}[k];for(const p of placements){assert(assets.has(p.assetId),label+' 未知资源 '+p.assetId);assert.equal(assets.get(p.assetId).type,type,label+' 类型不匹配 '+p.assetId);assert(allowed.includes(p.layer),label+' 显示层不匹配 '+p.layer);assert(!layers.has(p.layer),label+' 重复显示层 '+p.layer);layers.add(p.layer);}}}
  for(const b of bindings.bindings){
    assert(!bindingIds.has(b.bindingId),'重复bindingId：'+b.bindingId);bindingIds.add(b.bindingId);assert(!nodeIds.has(b.anchor.nodeId),'一个节点不允许多条重叠绑定：'+b.anchor.nodeId);nodeIds.add(b.anchor.nodeId);
    const sourceUnit=sourceMap.units[b.anchor.nodeId];assert(sourceUnit,'失效正文锚点：'+b.anchor.nodeId);assert(['text','choice'].includes(sourceUnit.op),'仅允许正文/选择等待节点绑定：'+b.anchor.nodeId);
    assert.equal(b.anchor.file,'scenario/'+sourceUnit.source.file,'锚点来源文件不匹配');assert.equal(b.anchor.sha256,sourceUnit.source.sha256,'锚点摘要指纹不匹配');
    for(const r of b.routeIds)assert(routeIds.has(r),'未知或取消路线：'+r);
    const route=R.routes.find(r=>b.anchor.file==='scenario/'+r.file);if(route)assert(b.routeIds.length===1&&b.routeIds[0]===route.id,'路线正文必须明确仅属自身路线：'+b.bindingId);
    const conditionAst=b.condition==='ALL'?[]:condition(b.condition,compiled.ir.choices,R.routes.flatMap(r=>[...r.endings,...(r.lowPathEndings||[])]));
    state(b.enter,b.bindingId+'.enter');state(b.exit.restore,b.bindingId+'.restore');assert.equal(b.exit.restore.cg,null,'恢复目标不能保留CG：'+b.bindingId);
    if(b.enter.cg){assert(b.cgId&&galleryIds.has(b.cgId),'未知或取消CG编号：'+b.cgId);assert.equal(b.fullView,true,'CG必须支持同段全图查看');assert.equal(sourceUnit.op,'text','CG仅可绑定正文等待节点');const previous=boundCG.get(b.cgId);assert(!previous||previous===b.enter.cg.assetId,'同CG编号出现不同图片：'+b.cgId);boundCG.set(b.cgId,b.enter.cg.assetId);}
    else{assert.equal(b.cgId,null,'没有CG画面却声明CG编号：'+b.bindingId);assert.equal(b.fullView,false,'无CG不可声明全图查看：'+b.bindingId);}
    resolvedBindings.push({...b,conditionAst,sourceUnit});
  }
  if(scope.kind==='complete'){
    assert(manifest.assets.length>0&&bindings.bindings.length>0,'完整候选不可为空');assert.deepEqual([...boundCG.keys()].sort(),[...galleryIds].sort(),'完整候选未覆盖60项CG');
    for(const r of routeIds)assert(bindings.bindings.some(b=>b.routeIds.includes(r)),'完整候选缺路线绑定：'+r);
  }
  const snapshotFiles=new Map();for(const f of snapshot.files){assert(!snapshotFiles.has(f.path),'快照重复路径：'+f.path);snapshotFiles.set(f.path,f.sha256);read(f.path,f.sha256);}
  const required=new Set([INTERFACE,manifestPath,bindingsPath,...manifest.assets.flatMap(a=>[a.sourcePath,a.runtimePath,...(a.a11?[a.a11.path]:[]),...(a.approval.evidence?[a.approval.evidence.path]:[])])]);
  for(const p of required)assert.equal(snapshotFiles.get(p),records.get(p)?.sha256,'快照缺项/指纹不符：'+p);
  const files=[...records.values()].sort((a,b)=>a.path.localeCompare(b.path));
  return {manifest,bindings,snapshot,assets:[...assets.values()],bindingsList:bindings.bindings,resolvedBindings,sourceMap,files,inputFingerprint:hash(stable(files)),scope,complete:scope.kind==='complete',diagnostic};
}
if(require.main===module){try{const args=process.argv.slice(2),opts={};while(args.length){const k=args.shift();const name={'--manifest':'manifestPath','--bindings':'bindingsPath','--snapshot':'snapshotPath','--mode':'mode','--out':'outputDir'}[k];assert(name,'未知参数：'+k);assert(args.length,'参数缺值：'+k);opts[name]=args.shift();}opts.compiled=require('../../compiler/compile.cjs').compile({pageSize:108});const r=validate(opts);console.log(JSON.stringify({ok:true,inputFingerprint:r.inputFingerprint,scope:r.scope,assets:r.assets.length,bindings:r.bindingsList.length,cgCount:new Set(r.bindingsList.map(b=>b.cgId).filter(Boolean)).size,files:r.files},null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={validate,checkSchema,safeFile,hash,INTERFACE};
