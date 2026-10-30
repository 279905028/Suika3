const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),version=process.argv[2],base=path.join(root,'build',version),out=path.join(__dirname,version,'asset-probe');assert(!fs.existsSync(out));
const manifest=require(path.join(base,'wasm/build-manifest.json')),assets=require(path.join(base,'input/assets/current/manifest.json')).assets;const stage=path.join(out,'stage'),web=path.join(out,'web');fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(web);
for(const f of manifest.inputs){const dest=path.join(stage,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(base,'wasm/stage',f.path),dest);}
let code=fs.readFileSync(path.join(stage,'main.ray'),'utf8').replace('func update() {','func probeOriginalUpdate() {').replace('func render() {','func probeOriginalRender() {');
const batches=[];for(let i=0;i<assets.length;i+=12)batches.push(assets.slice(i,i+12));
code+='\nvar probeAssets=[];var probeStarted=false;var probeIndex=0;var probeImage=false;var probeDown=false;\n';
code+=batches.map((a,i)=>'func probeData'+i+'(){\n'+a.map(x=>'Array.push(probeAssets,{file:'+JSON.stringify(x.runtimePath)+',id:'+JSON.stringify(x.assetId)+',width:'+x.width+',height:'+x.height+'});').join('\n')+'\n}').join('\n');
code+=`\nfunc probeCheck(name,ok){if(ok)print("SUI_I|probe-check|pass="+name);else print("SUI_I|probe-check|FAIL="+name);}
func probeNext(){
 if(probeImage!=false)Suika.destroyImage({image:probeImage.image});
 if(probeIndex>=Array.size(probeAssets)){print("SUI_I|probe-done");probeImage=false;return;}
 var a=probeAssets[probeIndex];probeImage=iLoadGallery(a.file);
 probeCheck("dimensions-"+probeIndex,probeImage.width==a.width&&probeImage.height==a.height);
 print("SUI_I|probe-asset|index="+probeIndex+"|id="+a.id);
}
func update(){
 if(probeStarted){var down=Engine.isGKeyPressed;if(down&&!probeDown){probeIndex=probeIndex+1;probeNext();}probeDown=down;Suika.clearInputState();return;}
 probeOriginalUpdate();
 if(eStable()&&Suika.getTagName()=="text"){
  var active=iGet("active");var state=iGet("state");var cursor=sc_get("cursor");
  probeCheck("valid-live",iValidate());iSet("active","");probeCheck("missing-active",!iValidate());iSet("active","unknown");probeCheck("unknown-active",!iValidate());iSet("active",active);iSet("state","empty");probeCheck("wrong-state",!iValidate());iSet("state","unknown");probeCheck("unknown-state",!iValidate());iSet("state",state);sc_set("cursor","unknown");probeCheck("wrong-cursor",!iValidate());sc_set("cursor",cursor);probeCheck("valid-restore",iRestore());
  ${batches.map((_,i)=>'probeData'+i+'();').join('')}
  probeStarted=true;probeNext();
 }
}
func render(){if(!probeStarted){probeOriginalRender();return;}Engine.draw({texture:suiGalleryUI.view,x:0,y:0});if(probeImage!=false)iDrawFit(probeImage,0,0,1280,720);}
`;
fs.writeFileSync(path.join(stage,'main.ray'),code);
const result=cp.spawnSync(path.join(base,'wasm/bin/suika3-pack'),manifest.inputs.map(f=>f.path),{cwd:stage,encoding:'utf8'});assert.equal(result.status,0,result.stderr);fs.writeFileSync(path.join(out,'build.log'),result.stdout+result.stderr);
for(const f of ['index.html','shell.js','shell.css'])fs.copyFileSync(path.join(base,'wasm/web',f),path.join(web,f));fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
fs.writeFileSync(path.join(web,'index.html'),fs.readFileSync(path.join(web,'index.html'),'utf8').replaceAll('bijie-rain-suika3-v1:', 'bijie-rain-suika3-i02-asset-probe:'));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version,sourceRuntimeBuildId:manifest.runtimeBuildId,scope:'独立派生探针；逐项实际解码/渲染与损坏演出状态负例，非正式候选剧情路径',assets,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(web,'assets.arc'))).digest('hex')},null,2));console.log(out);
