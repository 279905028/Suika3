'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {compile,write}=require('../../tools/compiler/compile.cjs');const {hash}=require('../../tools/compiler/parse.cjs');
const dir=__dirname,root=path.resolve(dir,'../..'),stage=path.join(dir,'native'),web=path.join(dir,'web');
const generated=compile();write(path.join(dir,'generated'),generated);
for(const d of[stage,web])fs.mkdirSync(d,{recursive:true});
const T=path.join(root,'qa/suika3-spike-20261028/native');
const TManifest=JSON.parse(fs.readFileSync(path.join(root,'qa/suika3-spike-20261028/build-manifest.json'),'utf8'));
const support=TManifest.inputs.filter(e=>e.path.startsWith('system/')&&!e.path.startsWith('system/plugins/'));
for(const e of support){
  const data=fs.readFileSync(path.join(T,e.path));assert.equal(hash(data),e.sha256,'SUI-T依赖指纹变化：'+e.path);
  fs.mkdirSync(path.dirname(path.join(stage,e.path)),{recursive:true});fs.writeFileSync(path.join(stage,e.path),data);
}
let config=fs.readFileSync(path.join(T,'config.ini'),'utf8');
config=config.replaceAll('SUI-T','SUI-C').replaceAll('技术样板','编译验证');
// QA uses the engine's normal skip lifecycle, preserving draw-context cleanup.
config=config.replace('msgbox.skip_unseen=false','msgbox.skip_unseen=true');
fs.writeFileSync(path.join(stage,'config.ini'),config);
const qa=require('./native-host.cjs')(generated.ir);
const host=qa.host;
fs.writeFileSync(path.join(dir,'native-cases.json'),JSON.stringify(qa.cases,null,2)+'\n');
fs.writeFileSync(path.join(stage,'main.ray'),generated.artifacts['story.ray']+host);
fs.writeFileSync(path.join(stage,'start.novel'),'[config name="game.locale" value="zh-cn"]\n'+generated.artifacts['story.novel']+qa.fixture);
const pack=path.join(dir,'suika3-pack');fs.copyFileSync(path.join(root,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);cp.spawnSync('xattr',['-d','com.apple.quarantine',pack]);
function files(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(p,e.name)):[path.join(p,e.name)]);}
const inputs=['main.ray','start.novel','config.ini',...support.map(e=>e.path)].sort();
const r=cp.spawnSync(pack,inputs,{cwd:stage,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);
fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
const sdk=fs.readFileSync(path.join(root,'SDK/wasm/index.html'),'utf8');
assert.equal(hash(sdk),'f589ca123faccada973c65cd560f4d3bb0207ae3f701d4017fcf46d094ee74c0');
let html=sdk.replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("bijie-rain-suic-qa-20261028:"+A,IDBFS.DB_VERSION)');
html=html.replace('</head>','<link rel="icon" href="data:,"><script>window.scLog=[];window.alert=(s)=>{scLog.push(String(s));console.log(s)};</script></head>');
fs.writeFileSync(path.join(web,'index.html'),html);
fs.writeFileSync(path.join(dir,'native-manifest.json'),JSON.stringify({buildId:generated.ir.buildId,sdk:hash(sdk),inputs:inputs.map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(stage,p)))})),archive:hash(fs.readFileSync(path.join(web,'assets.arc')))},null,2)+'\n');
console.log(JSON.stringify({buildId:generated.ir.buildId,inputs:inputs.length,archiveBytes:fs.statSync(path.join(web,'assets.arc')).size}));
