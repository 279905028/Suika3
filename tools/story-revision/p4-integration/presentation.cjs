'use strict';
const {assert,parseCondition} = require('./common.cjs');
const {integrate:legacyIntegrate,LAYERS} = require('../../integration/runtime/presentation-full.cjs');
function once(s,a,b) {assert.equal(s.split(a).length,2,'P4接入锚点漂移：'+a);return s.replace(a,b);}
function compactRegistration(ray,args) {
  const marker='// SUI-I02 presentation executor.',split=ray.indexOf(marker);assert(split>0);
  // Keep the exact generated placement statements. Compress only repetitive binding metadata.
  const statements=ray.slice(0,split).split('\n').filter(l=>/^(iStates\[|Array.push\(iStates|iWebpFiles\[|if\(!suiUIRegisterCG)/.test(l));
  const shared=new Map(),predicates=new Map(),rows=[];
  const literal=x=>JSON.stringify(x).replace(/"([a-zA-Z_][a-zA-Z_0-9]*)":/g,'$1:');
  for(const b of args.bindings){
    const indexes=[];for(const s of [b.enter,b.exit.restore]){const key=JSON.stringify(s);if(!shared.has(key))shared.set(key,shared.size);indexes.push(shared.get(key));}
    assert(b.bindingId.endsWith(b.anchor.nodeId),'绑定编号必须以节点编号结尾');
    const pred={prefix:b.bindingId.slice(0,-b.anchor.nodeId.length),routes:b.routeIds,condition:b.conditionAst||parseCondition(b.condition,args.generated.ir)},sig=JSON.stringify(pred);
    if(!predicates.has(sig)){const id=predicates.size;predicates.set(sig,id);statements.push('p4Predicates['+JSON.stringify(String(id))+'] = '+literal(pred)+';');}
    assert.equal(b.fullView,!!b.cgId,'CG全图声明错误');
    rows.push('p4Register('+[JSON.stringify(b.anchor.nodeId),...indexes,String(predicates.get(sig)),JSON.stringify(b.cgId||'')].join(',')+');');
  }
  const definitions=[],calls=[];
  for(const [prefix,lines,size] of [['State',statements,12],['Binding',rows,40]])for(let n=0;n<lines.length;n+=size){const name='p4Install'+prefix+'_'+n;definitions.push('func '+name+'(){\n'+lines.slice(n,n+size).join('\n')+'\n}');calls.push(name+'();');}
  let level=calls,depth=0;
  while(level.length>8){const next=[];for(let n=0;n<level.length;n+=8){const name='p4InstallBranch_'+depth+'_'+n;definitions.push('func '+name+'(){'+level.slice(n,n+8).join('\n')+'}');next.push(name+'();');}level=next;depth++;}
  return 'var iWebpSwap = '+(args.sdkPlatform!=='desktop')+';\nvar iWebpFiles={};\nvar p4Predicates={};\n'+
    'func p4Register(node,enter,restore,predicate,cg){var p=p4Predicates[String.from(predicate)];iRegister({id:p.prefix+node,node:node,routes:p.routes,condition:p.condition,cg:cg,full:cg!="",enter:"state-"+enter,restore:"state-"+restore});}\n'+
    'func iInstall() {\n'+Object.entries(LAYERS).map(([k,v])=>'iLayers['+JSON.stringify(k)+']=Suika.LAYER_'+v+';').join('\n')+'\n'+level.join('\n')+'\n    iViewHint = suiHistoryText("查看全图 · V / 点击",22,true);\n}\n'+definitions.join('\n')+'\n'+ray.slice(split);
}
function integrate({gallery,...args}) {
  assert(gallery?.items?.length,'缺少已验证的图鉴清单');
  const items=gallery.items,byAsset=new Map(args.assets.map(a=>[a.assetId,a]));
  assert.equal(new Set(items.map(i=>i.id)).size,items.length,'图鉴编号重复');
  for(const i of items){assert(/^CG\d{3}$/.test(i.id));assert.equal(i.unlockVariable,'sui_cg_'+i.id);assert.equal(byAsset.get(i.assetId)?.runtimePath,i.file);}
  let ui=args.uiRay;
  const order=/^var suiCGOrder = .*;$/m;assert(order.test(ui),'缺图鉴顺序入口');
  ui=ui.replace(order,'var suiCGOrder = '+JSON.stringify(items.map(i=>i.id))+';');
  // Bound keyboard focus and clicks to the actual last-page cells, not six slots.
  ui=once(ui,'func suiGalleryOpen(cell) {','func p4GalleryCells() { var n=Array.size(suiCGOrder)-suiGalleryPage*6; if(n>6) return 6; return n; }\nfunc suiGalleryOpen(cell) {\n    if(cell<0 || cell>=p4GalleryCells()) return;');
  ui=once(ui,'if (right && suiGalleryFocus < 5)','if (right && suiGalleryFocus < p4GalleryCells()-1)');
  ui=once(ui,'if (down && suiGalleryFocus < 3)','if (down && suiGalleryFocus < 3 && suiGalleryFocus+3 < p4GalleryCells())');
  ui=once(ui,'if (suiGalleryHit(x,y,352,184)) {','if (i < p4GalleryCells() && suiGalleryHit(x,y,352,184)) {');
  if(args.mode==='diagnostic')ui=once(ui,'suiUITrace("gallery-page|page=" + (suiGalleryPage + 1));','suiUITrace("gallery-page|page=" + (suiGalleryPage + 1)); print("SUI_I|gallery-page|page="+(suiGalleryPage+1));');
  const a=legacyIntegrate({...args,uiRay:ui});
  // Native GUI cancellation can consume the pointer before the gallery pump sees it.
  // Tear down its custom overlay in the same frame as the native Back button.
  a.host=once(a.host,'if (!Suika.isGUIRunning() && ePanel!="") {ePanel="";eReleaseSlots();}',
    'if (!Suika.isGUIRunning() && ePanel!="") {if(ePanel=="gallery" && suiGalleryActive){suiGalleryReleasePage();suiGalleryActive=false;suiGalleryDetail=-1;Suika.clearInputState();}ePanel="";eReleaseSlots();}');
  a.ray=compactRegistration(a.ray,args);
  a.ray=once(a.ray,'func iInstall() {','func p4InstallBindings() {');
  const calls=[],funcs=[];
  for(let n=0;n<items.length;n+=8){
    const name='p4GalleryRegister_'+n;calls.push(name+'();');
    funcs.push('func '+name+'() {\n'+items.slice(n,n+8).map(i=>'if(!suiUIRegisterCG('+JSON.stringify(i.id)+','+JSON.stringify(i.file)+')) sc_fail("cg-register:'+i.id+'");').join('\n')+'\n}');
  }
  // Hierarchical initializer avoids a function-size ceiling as the catalog grows.
  let level=calls,depth=0;
  while(level.length>8){const next=[];for(let n=0;n<level.length;n+=8){const name='p4GalleryBranch_'+depth+'_'+n;funcs.push('func '+name+'(){'+level.slice(n,n+8).join('\n')+'}');next.push(name+'();');}level=next;depth++;}
  a.ray+='\nvar p4HintBackground=false;\n'+funcs.join('\n')+'\nfunc iInstall(){p4InstallBindings();'+level.join('\n')+'\n p4HintBackground=Engine.loadTexture({file:"assets/current/ui-cinema/png/notice-backdrop.png"});}\n';
  a.ray=once(a.ray,'iViewHint = suiHistoryText("查看全图 · V / 点击",22,true);','iViewHint = Engine.createTextTexture({slot:1,text:"查看全图 · V / 点击",size:22,r:238,g:234,b:224,a:255});');
  a.ray=once(a.ray,'return iBindings[active].full && eMode=="reading"',
    'return iBindings[active].full && iBindings[active].node==sc_get("cursor") && iGet("state")==iBindings[active].enter && !suiGalleryActive && eMode=="reading"');
  a.ray=once(a.ray,'if(active=="" || !Dict.hasKey(iBindings,active) || eMode!="reading" || Suika.getTagName()!="text" || Suika.isGUIRunning() || suiHistoryActive) return;',
    'if(!iCanView()) return;');
  a.ray=once(a.ray,'if(iCanView()) Engine.draw({texture:iViewHint,x:72,y:36});',
    'if(iCanView()) {\n        Engine.renderTexture({texture:p4HintBackground,dstLeft:64,dstTop:24,dstWidth:248,dstHeight:56,srcLeft:0,srcTop:0,srcWidth:p4HintBackground.width,srcHeight:p4HintBackground.height,alpha:255});\n        Engine.draw({texture:iViewHint,x:76,y:40});\n    }');
  a.summary={...a.summary,galleryCount:items.length,galleryPages:Math.ceil(items.length/6),registeredCG:items.map(i=>i.id),hint:'opaque-dark-with-warm-white-text',registrationUnlocks:false};
  return a;
}
module.exports={integrate,once};
