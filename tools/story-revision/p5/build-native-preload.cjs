#!/usr/bin/env node
'use strict';
// Derive an isolated macOS regression package from the frozen native-v1 stage.
// The SDK and the web build are deliberately not modified.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/dialogue-p5-motion-20261104';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const fp=p=>({path:p,bytes:fs.statSync(path.join(ROOT,p)).size,sha256:hash(fs.readFileSync(path.join(ROOT,p)))});
const put=(p,data)=>{fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),JSON.stringify(data,null,2)+'\n');};
function build(out=QA+'/build-native-v3',run=QA+'/native/v3/run'){
 const parent=QA+'/build-native-v1',m=read(parent+'/runtime/build-manifest.json');
 assert.equal(m.runtimeBuildId,'cc501a8c32f201481ccdfa5d592f4f8c90f182ef0b759737116eec31b119d0c8');
 for(const p of [out,run]){assert(p.startsWith(QA+'/')&&!p.includes('..'));assert(!fs.existsSync(path.join(ROOT,p)),'不覆盖既有构建/测试存档：'+p);}
 for(const x of m.inputs)assert.equal(fp(parent+'/runtime/stage/'+x.path).sha256,x.sha256,'native-v1冻结输入变化：'+x.path);
 const before=fs.readFileSync(path.join(ROOT,parent,'runtime/stage/main.ray'),'utf8');
 const thumbnailBlock=`        for(slot in 0..4) if(Suika.checkSaveExists({index:slot}) && (slot!=0 || ePanel!="save")) {
            var x=292; if(slot%2==1) x=772;
            var y=228; if(slot>=2) y=468;
            Suika.renderImage({dstLeft:x,dstTop:y,dstWidth:192,dstHeight:108,image:Suika.getSaveThumbnail({index:slot}),srcLeft:0,srcTop:0,srcWidth:192,srcHeight:108,alpha:255,blend:Suika.BLEND_ALPHA});
        }`;
 assert.equal(before.split(thumbnailBlock).length,2,'缩略图绘制锚点不唯一');
 const adapterSha=hash(fs.readFileSync(__filename));
 const runtimeBuildId=hash(JSON.stringify({parentRuntimeBuildId:m.runtimeBuildId,parentInputs:m.inputs,adapterSha,change:'native-text-save-cards-and-update-texture-upload-v3'}));
 let after=before.replace(thumbnailBlock,'        // Native SDK thumbnail handles may be released after saving. Text cards remain.');
 const noticeLoad='    if(cinemaNoticeTexture==false) cinemaNoticeTexture=Engine.loadTexture({file:"assets/current/ui-cinema/png/notice-backdrop.png"});';
 const headingLoad='    if(cinemaHeading==false) cinemaHeading=Engine.loadTexture({file:"assets/current/ui-cinema/png/choice-heading.png"});';
 const focusLoad='        if(cinemaFocusTexture==false) cinemaFocusTexture=Engine.loadTexture({file:"assets/current/ui-cinema/png/choice-keyboard.png"});';
 for(const x of [noticeLoad,headingLoad,focusLoad])assert.equal(after.split(x).length,2,'native preload anchor');
 after=after.replace(noticeLoad,'    // Native: texture is uploaded by start(), before rendering.').replace(focusLoad,'        // Native: focus texture is uploaded by start().');
 const choicePreparation=`    if(Suika.getTagName()!="choose" || Suika.isGUIRunning() || suiGalleryActive) {if(cinemaChoiceId!="") cinemaReleaseChoices();return;}
    var id=sc_get("cursor");
    if(!Dict.hasKey(cinemaChoices,id)) return;
${headingLoad}
    if(cinemaChoiceId!=id) {
        cinemaReleaseChoices(); cinemaChoiceId=id;
        for(option in cinemaChoices[id]) {
            if(id!=sc_route_choice || option.value!=sc_hidden || sc_hq_eligible()) Array.push(cinemaChoiceTextures,Engine.loadTexture({file:option.file}));
        }
    }`;
 assert.equal(after.split(choicePreparation).length,2,'choice preparation anchor');
 after=after.replace(choicePreparation,`    if(Suika.getTagName()!="choose" || Suika.isGUIRunning() || suiGalleryActive) return;
    if(cinemaChoiceId!=sc_get("cursor")) return;`);
 const startAnchor='    Suika.start(); sc_install(); eInstallPositions(); suiUIStart(); cinemaInstall(); iInstall();';
 assert.equal(after.split(startAnchor).length,2);
 after=after.replace(startAnchor,startAnchor+'\n'+noticeLoad+'\n'+headingLoad+'\n'+focusLoad.trimStart());
 const updateEnd='    eTitleMotionUpdate();\n}';assert.equal(after.split(updateEnd).length,2);
 after=after.replace(updateEnd,`    // Native Metal uploads must finish before Suika.render() opens its encoder.
    if(Suika.getTagName()=="choose" && !Suika.isGUIRunning() && !suiGalleryActive && Dict.hasKey(cinemaChoices,sc_get("cursor"))) {
        var id=sc_get("cursor");
        if(cinemaChoiceId!=id) {
            cinemaReleaseChoices(); cinemaChoiceId=id;
            for(option in cinemaChoices[id]) {
                if(id!=sc_route_choice || option.value!=sc_hidden || sc_hq_eligible()) Array.push(cinemaChoiceTextures,Engine.loadTexture({file:option.file}));
            }
        }
    } else if(cinemaChoiceId!="") cinemaReleaseChoices();
    eTitleMotionUpdate();
}`);
 for(const name of ['cinemaRenderNotice','cinemaRenderChoices']){
  const body=after.split('func '+name+'() {')[1].split('\nfunc ')[0];assert(!body.includes('Engine.loadTexture('),name+' must not upload during render');
 }
 const oldId='var e_build_id = '+JSON.stringify(m.runtimeBuildId)+';';assert.equal(after.split(oldId).length,2);
 after=after.replace(oldId,'var e_build_id = '+JSON.stringify(runtimeBuildId)+';');
 assert(!after.includes('Suika.getSaveThumbnail('));
 const stage=path.join(ROOT,out,'runtime/stage');fs.mkdirSync(path.dirname(stage),{recursive:true});fs.cpSync(path.join(ROOT,parent,'runtime/stage'),stage,{recursive:true});
 fs.writeFileSync(path.join(stage,'main.ray'),after);
 const pack=path.join(ROOT,parent,'runtime/bin/suika3-pack');
 // Use the already-built frozen packer; do not alter quarantine/signing attributes.
 const result=cp.spawnSync(pack,m.inputs.map(x=>x.path),{cwd:stage,encoding:'utf8',timeout:60000});
 fs.writeFileSync(path.join(ROOT,out,'runtime/build.log'),(result.stdout||'')+(result.stderr||''));assert.equal(result.status,0,String(result.error||result.stderr));
 const inputs=m.inputs.map(x=>({...fp(out+'/runtime/stage/'+x.path),path:x.path}));
 const changed=inputs.filter((x,i)=>x.sha256!==m.inputs[i].sha256).map(x=>x.path);assert.deepEqual(changed,['main.ray']);
 const nativeManifest={...m,runtimeBuildId,parentRuntimeBuildId:m.runtimeBuildId,platform:'macos-native',nativeAdapter:{source:path.relative(ROOT,__filename),sha256:adapterSha,reason:'v1 invalid save thumbnail handle; v2 Metal assertion from lazy notice texture upload during render',behavior:'原生存档卡片保留文字；提示、标题与焦点纹理在start预载，选项纹理在update准备，render仅绘制。'},inputs,outputs:[{...fp(out+'/runtime/stage/assets.arc'),path:'stage/assets.arc'}]};
 put(out+'/runtime/build-manifest.json',nativeManifest);fs.copyFileSync(path.join(ROOT,parent,'runtime/runtime-positions.json'),path.join(ROOT,out,'runtime/runtime-positions.json'));
 fs.mkdirSync(path.dirname(path.join(ROOT,run)),{recursive:true});fs.cpSync(stage,path.join(ROOT,run),{recursive:true});
 const app=path.join(ROOT,run,'P5原生安全版.app/Contents');fs.mkdirSync(path.join(app,'MacOS'),{recursive:true});
 fs.writeFileSync(path.join(app,'Info.plist'),'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>suika3</string><key>CFBundleIdentifier</key><string>local.suika.p5.native.preload.20261105</string><key>CFBundleName</key><string>P5原生安全版</string><key>CFBundlePackageType</key><string>APPL</string><key>NSHighResolutionCapable</key><true/></dict></plist>');
 const binary=path.join(ROOT,'SDK/macos/root/bin/suika3'),target=path.join(app,'MacOS/suika3');
 const copied=cp.spawnSync('/bin/cp',['-p',binary,target],{encoding:'utf8'});assert.equal(copied.status,0,copied.stderr);
 assert.equal(hash(fs.readFileSync(binary)),hash(fs.readFileSync(target)));
 const attr=p=>cp.spawnSync('/usr/bin/xattr',['-p','com.apple.quarantine',p],{encoding:'utf8'});
 const sourceAttr=attr(binary),targetAttr=attr(target);assert.equal(targetAttr.status,sourceAttr.status);
 // macOS refreshes the copy's quarantine timestamp/flags itself. Preserve the
 // attribute and originating event UUID; never write/remove the attribute.
 if(sourceAttr.status===0){assert(targetAttr.stdout.trim(),'不得丢弃SDK隔离标记');assert.equal(targetAttr.stdout.trim().split(';').at(-1),sourceAttr.stdout.trim().split(';').at(-1));}
 const report={date:'2026-11-05',parentRuntimeBuildId:m.runtimeBuildId,runtimeBuildId,contentBuildId:m.contentBuildId,parentStage:parent+'/runtime/stage',stage:out+'/runtime/stage',runDirectory:run,app:run+'/P5原生安全版.app',saveDirectory:run+'/save',changedStageFiles:changed,functions:(after.match(/^func /gm)||[]).length,adapter:nativeManifest.nativeAdapter,securityFlagsPreserved:true,quarantine:{source:sourceAttr.stdout.trim(),copy:targetAttr.stdout.trim(),modifiedByBuilder:false},sourceSdkUnchanged:true,webBuildUnchanged:true,validation:{frozenParent:'pass',packaging:'pass',actualMacOs:'pending'}};
 put(out+'/build-result.json',report);put(QA+'/native/v3/build-result.json',report);console.log(JSON.stringify(report,null,2));return report;
}
if(require.main===module)build(process.argv[2],process.argv[3]);
module.exports={build};
