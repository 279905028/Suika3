#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {ROOT,write}=require('./prepare.cjs'),{items}=require('./manifest.cjs');
const BASE='qa/ending-motion-P4-V-T-20261104';
function build(out=BASE+'/probe-v1',mediaSource=BASE+'/media/probe.mp4'){
 assert(!path.isAbsolute(mediaSource)&&!mediaSource.split('/').includes('..')&&mediaSource.endsWith('.mp4'),'视频须为工程内MP4');
 const full=path.join(ROOT,out),stage=path.join(full,'stage'),web=path.join(full,'web');
 assert(!fs.existsSync(full),'拒绝覆盖已有证据');fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(web,{recursive:true});
 const dependencies=new Set();
 function copy(p){if(dependencies.has(p))return;dependencies.add(p);const text=fs.readFileSync(path.join(ROOT,p));write(out+'/stage/'+p,text);
  if(/\.(gui|anime)$/.test(p))for(const m of text.toString().matchAll(/(?:image-[\w-]+|file)\s*:\s*([^;]+);/g))copy(m[1].trim());
 }
 copy('config.ini');
 for(const line of fs.readFileSync(path.join(ROOT,'config.ini'),'utf8').split('\n'))if(/^[a-z][^=]*=/.test(line)){const v=line.slice(line.indexOf('=')+1).trim();if(/\.(png|webp|anime|ogg|ttc|ttf)$/.test(v))copy(v);}
 for(const name of ['sysmenu.png','back-idle.png','back-hover.png','back-press.png'])copy('system/sui-u/png/'+name);
 write(out+'/stage/probe.png',fs.readFileSync(path.join(ROOT,BASE,'media/probe.png')));dependencies.add('probe.png');
 write(out+'/stage/probe.gui','global { fadein: 0.0; fadeout: 0.0; clickcancel: no; escapecancel: yes; rightcancel: yes; }\nBASE { id: 1; type: noaction; x: 0; y: 0; image-idle: system/sui-u/png/sysmenu.png; }\nBACK { id: 2; type: cancel; x: 1080; y: 32; image-idle: system/sui-u/png/back-idle.png; image-hover: system/sui-u/png/back-hover.png; image-press: system/sui-u/png/back-press.png; }\n');dependencies.add('probe.gui');
 const ray=`
var mvHold=false;var mvSent=false;var mvMenu=false;var mvOldMenu=false;var mvDrain=0;var mvToken=0;var mvSaved=false;
func setup(){return {width:1280,height:720,title:"P4-V正文视频技术夹具",fullscreen:false};}
func start(){Suika.start();Suika.setTextSpeed({speed:1.0});Suika.setVariableString({name:"mv_key",value:""});print("P4V|started");}
func update(){
 if(Engine.isQKeyPressed){mvHold=false;mvDrain=Engine.millisec+200;Suika.clearInputState();return;}
 if(Engine.isYKeyPressed){mvHold=true;Suika.clearInputState();return;}
 if(Engine.isSKeyPressed && !mvSaved){mvSaved=Suika.executeSaveLocal({index:3});print("P4V|save|ok="+mvSaved);Suika.clearInputState();return;}
 if(Engine.isLKeyPressed){Suika.stopGUI();var ok=Suika.executeLoadLocal({index:3});mvHold=false;mvSent=true;mvToken=mvToken+1;print("P4V|load|ok="+ok);print("SUI_M|context|"+Suika.getVariableString({name:"mv_key"})+"|restore|"+mvToken);Suika.clearInputState();mvDrain=Engine.millisec+200;return;}
 if(Engine.isRKeyPressed){mvHold=false;mvSent=false;Suika.moveToLabelTag({label:"BEGIN"});print("SUI_M|exit");Suika.clearInputState();return;}
 if(Engine.isTKeyPressed){mvHold=false;mvSent=true;Suika.moveToLabelTag({label:"TITLE"});print("SUI_M|exit");Suika.clearInputState();return;}
 if(Engine.isMKeyPressed && !Suika.isGUIRunning()){Suika.loadGUIFile({file:"probe.gui",isSys:true});Suika.startGUI();Suika.clearInputState();}
 mvMenu=Suika.isGUIRunning();if(mvMenu!=mvOldMenu){print("SUI_M|menu|"+mvMenu);mvOldMenu=mvMenu;}
 if(mvMenu){Suika.update();return;}
 if(mvHold || Engine.millisec<mvDrain){Suika.clearInputState();return;}
 Suika.update();
}
func render(){Suika.render();if(!mvSent && Suika.getTagName()=="text"){mvSent=true;print("SUI_M|context|"+Suika.getVariableString({name:"mv_key"})+"|enter|"+mvToken);print("P4V|node|"+Suika.getVariableString({name:"mv_node"}));}}
func Tag_mv_at(p){Suika.setVariableString({name:"mv_key",value:p.key});Suika.setVariableString({name:"mv_node",value:p.node});mvHold=p.key!="";mvSent=false;mvToken=mvToken+1;Suika.stopAutoMode();Suika.stopSkipMode();Suika.moveToNextTag();return true;}
`;
 write(out+'/stage/main.ray',ray);dependencies.add('main.ray');
 let novel='[config name="game.locale" value="zh-cn"]\n[label name="BEGIN"]\n[bg file="probe.png" time="0.0"]\n';
 for(const item of items)novel+='[mv_at key="'+item.key+'" node="'+item.node+'"]\n[text text="P4-V 技术夹具 · '+item.ending+'。只验证播放器，不是正式剧情。点击先跳过视频，再次继续。"]\n[mv_at key="" node="AFTER-'+item.ending+'"]\n[text text="视频已退出，本段须保持静态。"]\n';
 novel+='[label name="TITLE"]\n[mv_at key="" node="TITLE"]\n[text text="技术夹具结束。R返回首段；S原生保存；L原生读档；M打开原生菜单。"]\n[goto name="TITLE"]\n';write(out+'/stage/start.novel',novel);dependencies.add('start.novel');
 const pack=path.join(full,'suika3-pack');fs.copyFileSync(path.join(ROOT,'SDK/macos/suika3-pack'),pack);fs.chmodSync(pack,0o755);const r=cp.spawnSync(pack,[...dependencies],{cwd:stage,encoding:'utf8',timeout:60000});assert.equal(r.status,0,String(r.error||r.signal||r.stderr||r.stdout));
 fs.copyFileSync(path.join(stage,'assets.arc'),path.join(web,'assets.arc'));
 fs.copyFileSync(path.join(ROOT,mediaSource),path.join(web,'probe.mp4'));fs.copyFileSync(path.join(ROOT,BASE,'media/probe.png'),path.join(web,'probe.png'));
 for(const p of ['controller.js','controller.css'])fs.copyFileSync(path.join(__dirname,p),path.join(web,p));
 const config={storageKey:'suika3-p4v-probe:unlocks',loadTimeoutMs:1500,items:Object.fromEntries(items.map(i=>[i.key,{src:'probe.mp4',fallback:'probe.png',title:i.ending}]))};
 let html=fs.readFileSync(path.join(ROOT,'SDK/wasm/index.html'),'utf8');
 html=html.replace('IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)','IDBFS.indexedDB().open("suika3-p4v-engine-probe:"+A,IDBFS.DB_VERSION)');
 const head='<link rel="icon" href="data:,"><link rel="stylesheet" href="controller.css"><style>#canvas_holder{position:relative}#canvas{display:block;margin:auto;max-width:100%;height:auto}</style><script>window.mcgConfig='+JSON.stringify(config)+';window.p4vEvents=[];window.alert=s=>{p4vEvents.push(String(s));if(/^SUI_M/.test(s))window.endingMotion?.onLog(s);console.log(s)};window.mcgBridge={hold(value){const c=document.getElementById("canvas"),key=value?"Y":"Q",code="Key"+key; c.dispatchEvent(new KeyboardEvent("keydown",{key,code,keyCode:key.charCodeAt(0),which:key.charCodeAt(0),bubbles:true}));setTimeout(()=>c.dispatchEvent(new KeyboardEvent("keyup",{key,code,keyCode:key.charCodeAt(0),which:key.charCodeAt(0),bubbles:true})),70)},gallery(value){this.hold(value)}};</script><script src="controller.js"></script>';
 html=html.replace('</head>',head+'</head>');write(out+'/web/index.html',html);
 const sha=p=>require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 write(out+'/build.json',{scope:'Suika Wasm技术夹具；底图为合成图，不是正文全路线或正式动态采用',storagePrefix:'suika3-p4v-engine-probe:',media:{path:mediaSource,sha256:sha(path.join(ROOT,mediaSource))},controllerSha256:sha(path.join(web,'controller.js')),items:items.map(x=>x.key),dependencies:[...dependencies],entry:out+'/web'});console.log(JSON.stringify({status:'built',out}));return out;
}
if(require.main===module)build(process.argv[2],process.argv[3]);module.exports={build};
