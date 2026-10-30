const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'build/sui-i02-20261030-v3'),out=path.join(__dirname,'menu-probe');assert(!fs.existsSync(out));const stage=path.join(out,'stage'),web=path.join(out,'web');fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(web);
const m=require(path.join(base,'wasm/build-manifest.json'));for(const f of m.inputs){const dest=path.join(stage,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(base,'wasm/stage',f.path),dest);}
const w=require(path.join(base,'input/qa/sui-i01-closeout-20261030/state-witnesses.json')).find(w=>w.nodeId==='TEXT_20a6d0e0f7c2089d06ee_1');
let text=fs.readFileSync(path.join(stage,'main.ray'),'utf8');const a=text.indexOf('func Tag_e_new(params) {'),b=text.indexOf('func Tag_e_finish',a);
const state={...Object.fromEntries(Object.entries(w.state.choices).map(([k,v])=>['c_'+k,v])),score:w.state.score,relation:w.state.relation,route:w.state.route,dispatched:'0',status:'running',...Object.fromEntries(w.state.events.map(k=>['e_'+k,'1']))};
text=text.slice(0,a)+`func Tag_e_new(params) {sc_new();iNew();${Object.entries(state).map(([k,v])=>'sc_set('+JSON.stringify(k)+','+JSON.stringify(String(v))+');').join('')}eMode="reading";eSet("depth",0);eSet("generation","");eLastStable=-1;return sc_jump(${JSON.stringify(w.nodeId)});}\n`+text.slice(b);
text=text.replace('func suiUIUpdate() {','func suiUIUpdate() {\nif(Engine.isMouseLeftPressed || Suika.isMouseLeftClicked()) print("SUI_I|mouse|x="+Engine.mousePosX+"|y="+Engine.mousePosY+"|old="+suiMenuPointerDown+"|gallery="+suiGalleryActive+"|gui="+Suika.isGUIRunning()+"|tag="+Suika.getTagName());');
fs.writeFileSync(path.join(stage,'main.ray'),text);const r=cp.spawnSync(path.join(base,'wasm/bin/suika3-pack'),m.inputs.map(f=>f.path),{cwd:stage,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
for(const f of ['index.html','shell.js','shell.css'])fs.copyFileSync(path.join(base,'wasm/web',f),path.join(web,f));fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
fs.writeFileSync(path.join(web,'index.html'),fs.readFileSync(path.join(web,'index.html'),'utf8').replaceAll('bijie-rain-suika3-v1:','bijie-rain-suika3-i02-menu-probe:'));
console.log(out);
