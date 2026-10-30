const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'build/sui-i02-20261030-v6'),out=path.join(__dirname,'menu-smoke-final');assert(!fs.existsSync(out));const stage=path.join(out,'stage'),web=path.join(out,'web');fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(web);
const m=require(path.join(base,'wasm/build-manifest.json'));for(const f of m.inputs){const dest=path.join(stage,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(base,'wasm/stage',f.path),dest);}
let text=fs.readFileSync(path.join(stage,'main.ray'),'utf8').replace('var down = iUIDown;', 'var down = Engine.isMouseLeftPressed || Suika.isMouseLeftPressed() || Suika.isMouseDragging();').replace('var iUIDown = false;\n','').replace('iUIDown=down;iUIClick=released;', 'iUIClick=released;');
fs.writeFileSync(path.join(stage,'main.ray'),text);const r=cp.spawnSync(path.join(base,'wasm/bin/suika3-pack'),m.inputs.map(f=>f.path),{cwd:stage,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
for(const f of ['index.html','shell.js','shell.css'])fs.copyFileSync(path.join(base,'wasm/web',f),path.join(web,f));fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
fs.writeFileSync(path.join(web,'index.html'),fs.readFileSync(path.join(web,'index.html'),'utf8').replaceAll('bijie-rain-suika3-v1:','bijie-rain-suika3-i02-menu-probe:'));
console.log(out);
