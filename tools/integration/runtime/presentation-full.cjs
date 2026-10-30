'use strict';
// Build-time composition only: C/U sources remain unchanged on disk.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {condition}=require('../../compiler/parse.cjs');
const LAYERS={bg:'BG',left:'CHL',center:'CHC',right:'CHR',prop1:'EFF1',prop2:'EFF2',cg:'EFF3'};
const q=JSON.stringify;
function literal(value){
  if(typeof value==='string'||typeof value==='boolean'||typeof value==='number')return q(value);
  if(Array.isArray(value))return '['+value.map(literal).join(',')+']';
  assert(value&&typeof value==='object');
  return '{'+Object.entries(value).map(([k,v])=>{assert(/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(k));return k+':'+literal(v);}).join(',')+'}';
}
function replaceOnce(text,from,to,label){assert.equal(text.split(from).length,2,'SUI-I02接入锚点不唯一：'+label);return text.replace(from,to);}
function integrate({generated,host,uiRay,assets=[],bindings=[],mode='candidate',sdkPlatform='wasm'}){
  assert(['wasm','desktop'].includes(sdkPlatform),'不支持的SDK平台');
  const list=Array.isArray(assets)?assets:assets.assets;
  const bindingList=Array.isArray(bindings)?bindings:bindings.bindings;
  assert(Array.isArray(list)&&Array.isArray(bindingList));
  const byId=new Map(list.map(a=>[a.assetId,a]));
  assert.equal(byId.size,list.length,'资源ID重复');
  const nodes={},cgFiles=new Map(),registrations=[],ids=new Set();
  const stateNames=['empty'];
  const sharedStates=new Map();
  const add=line=>registrations.push(line);
  add('iStates["empty"] = [{assetId:"ui:backdrop",layer:"bg",file:"system/sui-u/png/reading-backdrop.png",x:0,y:0,scale:1.0,webp:false,form:"",costume:""}];');
  for(const binding of bindingList){
    assert(!ids.has(binding.bindingId),'绑定ID重复');ids.add(binding.bindingId);
    const source=generated.ir.nodes.find(n=>n.id===binding.anchor.nodeId);
    assert(source&&['text','choice'].includes(source.op),'仅允许在正文或选择节点绑定');
    assert(binding.exit.at==='next-node','未知退出时点');
    assert(!binding.fullView||source.op==='text','全图查看仅支持正文节点');
    const cg=binding.cgId||'';
    if(cg){
      assert(binding.enter.cg,'CG绑定缺少图像');
      const asset=byId.get(binding.enter.cg.assetId);assert(asset&&asset.type==='cg');
      assert(!cgFiles.has(cg)||cgFiles.get(cg)===asset.runtimePath,'同一CG登记多个文件');
      cgFiles.set(cg,asset.runtimePath);
    }
    const ast=binding.conditionAst||(binding.condition==='ALL'?[]:condition(binding.condition,generated.ir.choices,generated.ir.contract.routes.flatMap(r=>[...r.endings,...r.lowPathEndings||[]])));
    const runtime={id:binding.bindingId,node:binding.anchor.nodeId,routes:binding.routeIds,condition:ast,cg,full:binding.fullView};
    assert(!nodes[binding.anchor.nodeId],'完整接口单节点只允许一条绑定');
    (nodes[binding.anchor.nodeId]??=[]).push(binding.bindingId);
    for(const [phase,state] of [['enter',binding.enter],['restore',binding.exit.restore]]){
      const signature=JSON.stringify(state);
      if(sharedStates.has(signature)){
        runtime[phase]=sharedStates.get(signature);
        continue;
      }
      const key='state-'+sharedStates.size;stateNames.push(key);runtime[phase]=key;
      sharedStates.set(signature,key);add(`iStates[${q(key)}] = [];`);
      // A location-unspecified paragraph is still a reading scene. Keep the
      // approved UI backdrop behind it instead of clearing BG to transparent
      // (which the engine renders as solid black). This does not invent a place.
      const placements=[state.background,...state.characters,...state.props,state.cg].filter(Boolean),usedLayers=new Set();
      if(!state.background) add(`Array.push(iStates[${q(key)}],{assetId:"ui:backdrop",layer:"bg",file:"system/sui-u/png/reading-backdrop.png",x:0,y:0,scale:1.0,webp:false,form:"",costume:""});`);
      for(const p of placements){
        assert(!usedLayers.has(p.layer),'状态图层重复');usedLayers.add(p.layer);
        assert(Object.hasOwn(LAYERS,p.layer));
        const asset=byId.get(p.assetId);assert(asset,'未知资源：'+p.assetId);
        assert(typeof asset.runtimePath==='string'&&!/[\r\n]/.test(asset.runtimePath));
        assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.scale)&&p.scale>0);
        const placement={assetId:p.assetId,layer:p.layer,file:asset.runtimePath,x:Math.round(p.x),y:Math.round(p.y),scale:p.scale,webp:asset.runtimePath.endsWith('.webp'),form:p.form||'',costume:p.costume||''};
        let encoded=literal(placement);if(Number.isInteger(p.scale))encoded=encoded.replace('scale:'+p.scale+',','scale:'+p.scale+'.0,');
        add(`Array.push(iStates[${q(key)}],${encoded});`);
      }
    }
    add(`iRegister(${literal(runtime)});`);
  }
  for(const file of list.filter(a=>a.runtimePath.endsWith('.webp')).map(a=>a.runtimePath))add(`iWebpFiles[${q(file)}] = true;`);
  for(const[id,file] of cgFiles)add(`if(!suiUIRegisterCG(${q(id)},${q(file)})) sc_fail(${q('cg-register:'+id)});`);
  // One bounded registration per function also handles large six-person scene states.
  const data=['var iWebpSwap = '+(sdkPlatform==='wasm')+';','var iWebpFiles = {};'];
  const definitions=[];
  const batches=[];for(let n=0;n<registrations.length;n+=12)batches.push(registrations.slice(n,n+12));
  batches.forEach((lines,n)=>definitions.push(`func iInstallItem_${n}() {\n${lines.join('\n')}\n}`));
  let calls=batches.map((_,n)=>`iInstallItem_${n}`),depth=0;
  // Bound every initializer function, including the root; scale to thousands of bindings.
  while(calls.length>3){
    const parents=[];
    for(let offset=0;offset<calls.length;offset+=12){
      const name=`iInstallBranch_${depth}_${offset/12}`;
      definitions.push(`func ${name}() {`,...calls.slice(offset,offset+12).map(fn=>`    ${fn}();`),'}');
      parents.push(name);
    }
    calls=parents;depth++;
  }
  data.push('func iInstall() {',...Object.entries(LAYERS).map(([name,constant])=>`    iLayers[${q(name)}] = Suika.LAYER_${constant};`),...calls.map(fn=>`    ${fn}();`),'    iViewHint = suiHistoryText("查看全图 · V / 点击",22,true);','}',...definitions);
  const ray=data.join('\n')+'\n'+fs.readFileSync(path.join(__dirname,'presentation-full.ray'),'utf8');
  let contentRay=generated.artifacts['story.ray'];
  contentRay=replaceOnce(contentRay,'func Tag_sc_at(params) {','func sc_content_at(params) {','sc_at');
  contentRay+= '\nfunc Tag_sc_at(params) {\n    if(!iAt(params.id)) return sc_jump("SC_ERROR");\n    return sc_content_at(params);\n}\n';
  contentRay=replaceOnce(contentRay,'func Tag_sc_step(params) {','func sc_content_step(params) {','sc_step');
  contentRay+='\nfunc Tag_sc_step(params) {\n    if(!iExit(params.id)) return sc_jump("SC_ERROR");\n    return sc_content_step(params);\n}\n';
  host=replaceOnce(host,'eInstallPositions(); suiUIStart();','eInstallPositions(); suiUIStart(); iInstall();','install');
  host=replaceOnce(host,'if (!eStable() || !sc_validate())','if (!eStable() || !sc_validate() || !iValidate())','save');
  host=replaceOnce(host,'if (!eValidateLoad() ||','if (!eValidateLoad() || !iRestore() ||','load');
  host=replaceOnce(host,'func update() {','func update() {\n    if(iBeforeUpdate()) return;','update');
  host=replaceOnce(host,'if(eNotice!=false && Engine.millisec<eNoticeUntil) Engine.draw({texture:eNotice,x:80,y:92});','if(eNotice!=false && Engine.millisec<eNoticeUntil) Engine.draw({texture:eNotice,x:80,y:92});\n    iRender();','render');
  host=replaceOnce(host,'sc_new(); eSet("depth",0);','sc_new(); if(!iNew()) return sc_jump("SC_ERROR"); eSet("depth",0);','new');
  host=replaceOnce(host,'eMode="title"; ePanel="";','iFullView=false; eMode="title"; ePanel="";','title');
  uiRay=replaceOnce(uiRay,'for (t in suiGalleryTextures) if (t != false) Engine.destroyTexture({texture: t});','for (t in suiGalleryTextures) if (t != false) Suika.destroyImage({image: t.image});','gallery-release');
  uiRay=replaceOnce(uiRay,'t = Engine.loadTexture({file: suiCGFiles[id]});','t = iLoadGallery(suiCGFiles[id]);','gallery-load');
  const fitStart=uiRay.indexOf('func suiGalleryDrawFit('),fitEnd=uiRay.indexOf('\nfunc suiUIRender()',fitStart);
  assert(fitStart>=0&&fitEnd>fitStart,'图鉴绘制锚点丢失');
  uiRay=uiRay.slice(0,fitStart)+'func suiGalleryDrawFit(t,x,y,w,h) { iDrawFit(t,x,y,w,h); }'+uiRay.slice(fitEnd);
  return {contentRay,contentNovel:generated.artifacts['story.novel'],host,uiRay,ray,summary:{mode,sdkPlatform,bindings:bindingList.length,states:stateNames.length,registeredCG:[...cgFiles.keys()],webpSwap:sdkPlatform==='wasm'}};
}
module.exports={integrate,LAYERS};
