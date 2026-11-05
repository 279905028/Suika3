'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const MANIFEST='assets/current/motion/manifest.json',BINDINGS='docs/整合/motion-bindings.json';
const codeFiles=['tools/runtime/motion.cjs','tools/runtime/motion-host.ray','tools/runtime/motion-bridge.js','tools/story-revision/ending-motion/controller.js','tools/story-revision/ending-motion/controller.css'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'动态桥接锚点不唯一：'+a);return s.replace(a,b);};
function load(root,generated){
 if(!fs.existsSync(path.join(root,MANIFEST)))return null;
 assert(fs.existsSync(path.join(root,BINDINGS)),'动态资源缺少绑定');
 const m=JSON.parse(fs.readFileSync(path.join(root,MANIFEST))),b=JSON.parse(fs.readFileSync(path.join(root,BINDINGS)));
 assert.equal(m.contentBuildId,generated.ir.buildId);assert.equal(b.contentBuildId,generated.ir.buildId);
 assert(Array.isArray(m.items)&&Array.isArray(b.bindings));
 const items=new Map(),nodes=new Set(),used=new Set(),inputFiles=[MANIFEST,BINDINGS,...codeFiles];
 for(const x of m.items){assert(/^[A-Za-z0-9_-]+$/.test(x.key),'动态键不合法');assert(!items.has(x.key));
  for(const [field,ext] of [['src','.mp4'],['fallback','.webp']]){const p=x[field];assert(typeof p==='string'&&!path.isAbsolute(p)&&!p.split('/').includes('..')&&p.endsWith(ext));assert.equal(sha(path.join(root,p)),x[field+'Sha256'],'动态文件指纹不符 '+p);inputFiles.push(p);}
  items.set(x.key,x);
 }
 for(const x of b.bindings){assert(items.has(x.key));assert(!nodes.has(x.node),'动态节点冲突 '+x.node);nodes.add(x.node);used.add(x.key);assert(generated.ir.nodes.some(n=>n.id===x.node&&n.op==='text'),'动态锚点不是当前正文 '+x.node);}
 assert.equal(used.size,items.size,'有未绑定动态素材');
 return {manifest:m,bindings:b.bindings,inputFiles:[...new Set(inputFiles)]};
}
function adapt(root,m,a){
 const literal=x=>JSON.stringify(x).replace(/"([a-zA-Z_][a-zA-Z_0-9]*)":/g,'$1:');
 const rows=m.bindings.map(b=>'mBindings['+JSON.stringify(b.node)+']='+literal({key:b.key,route:b.route||'',relation:b.relation||'',choices:b.choices||{},meeting:!!b.meeting,condition:b.conditionAst||[]})+';');
 const funcs=[],calls=[];
 for(let i=0;i<rows.length;i+=10){const name='mInstall_'+i;calls.push(name+'();');funcs.push('func '+name+'(){\n'+rows.slice(i,i+10).join('\n')+'\n}');}
 let host=a.host;
 host=once(host,'eInstallPositions(); suiUIStart();','eInstallPositions(); suiUIStart(); '+calls.join(''));
 host=once(host,'func update() {','func update() {\n    if(mBeforeUpdate()) return;');
 host=once(host,'func eJump(label) {','func eJump(label) {\n    mReset();');
 host=once(host,'eSet("action",""); eTrace("load|slot="+slot); return true;','eSet("action",""); mAt(sc_get("cursor"),true); eTrace("load|slot="+slot); return true;');
 host=once(host,'    iRender();','    iRender(); mRender();');
 host=once(host,'sc_new(); if(!iNew())','mReset(); sc_new(); if(!iNew())');
 let contentRay=once(a.contentRay,'    return sc_content_at(params);','    mAt(params.id,false);\n    return sc_content_at(params);');
 return {...a,host,contentRay,ray:a.ray+'\n'+fs.readFileSync(path.join(root,'tools/runtime/motion-host.ray'),'utf8')+'\n'+funcs.join('\n')};
}
function web(root,m,dir,databasePrefix){
 fs.mkdirSync(path.join(dir,'motion'),{recursive:true});const outputs=[],items={};
 for(const x of m.manifest.items){const src='motion/'+x.key+'.mp4',fallback='motion/'+x.key+'.webp';for(const [a,b]of[[x.src,src],[x.fallback,fallback]]){fs.copyFileSync(path.join(root,a),path.join(dir,b));outputs.push(b);}items[x.key]={title:x.title||x.key,src,fallback};}
 for(const [a,b]of[['tools/runtime/motion-bridge.js','motion-bridge.js'],['tools/story-revision/ending-motion/controller.js','motion-controller.js'],['tools/story-revision/ending-motion/controller.css','motion-controller.css']]){fs.copyFileSync(path.join(root,a),path.join(dir,b));outputs.push(b);}
 const config={storageKey:databasePrefix+'motion-unlocks:'+m.manifest.version,items,loadTimeoutMs:12000};
 return {outputs,head:'<link rel="stylesheet" href="motion-controller.css"><script>window.mcgConfig='+JSON.stringify(config).replaceAll('<','\\u003c')+'</script><script src="motion-bridge.js"></script><script src="motion-controller.js"></script>'};
}
module.exports={load,adapt,web,MANIFEST,BINDINGS,codeFiles};
