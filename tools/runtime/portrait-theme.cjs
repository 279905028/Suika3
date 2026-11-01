'use strict';
// Portrait (720x1280) web layout, applied on top of the cinema theme. Story pages, tags,
// save state and presentation state names are shared with the landscape build;
// only canvas size, GUI files, UI textures and layer placement differ.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const rel='system/sui-portrait/manifest.json';
const FROM='assets/current/ui-cinema/png/',TO='assets/current/ui-portrait/png/';
// Stage = the landscape canvas's central 720x720. Characters keep their feet and move
// toward the centre so left/right figures stay on screen.
const SHIFT=280,CENTER_K=0.72,CHAR_SCALE=0.9,THUMB_K=(1280/405).toFixed(4);
function swap(s,a,b,count=1){assert.equal(s.split(a).length-1,count,'竖版接入锚点数量不符：'+a);return s.split(a).join(b);}
function load(root){
 if(!fs.existsSync(path.join(root,rel)))return null;
 const m=JSON.parse(fs.readFileSync(path.join(root,rel)));assert.equal(m.approval.status,'approved');assert.deepEqual(m.canvas,[720,1280]);
 for(const r of m.resources){assert(r.path.startsWith('assets/current/ui-portrait/'));assert(!r.path.split('/').includes('..'));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r.path))).digest('hex'),r.sha256,'竖版UI资源变化：'+r.path);}
 const inputFiles=[rel,'tools/runtime/portrait-theme.cjs','tools/ui-portrait/build.cjs','tools/ui-portrait/render.py','assets/sources/20261101-portrait-ui/choice-layout.json',...Object.values(m.gui),...m.resources.map(r=>r.path)];
 return {...m,inputFiles};
}
const PATCHES={'msgbox.x':'24','msgbox.y':'792','msgbox.margin.left':'32','msgbox.margin.top':'28','msgbox.margin.right':'32','msgbox.margin.bottom':'40',
 'namebox.x':'40','namebox.y':'736','click.x':'656','click.y':'1196','sysbtn.x':'568','sysbtn.y':'24','automode.x':'24','automode.y':'24','skipmode.x':'24','skipmode.y':'24'};
for(let i=1;i<=8;i++)Object.assign(PATCHES,{['choose.box'+i+'.x']:'24',['choose.box'+i+'.y']:String(792+(Math.min(i,6)-1)*80)});
// The SDK stores these keys in every save and restores them on load, so each layout re-applies its own after loading.
const LAYOUT_KEYS=Object.keys(PATCHES);
// Config image paths are stored in saves too: keep the cinema paths and pack portrait content under them.
function config(text){
 for(const[k,v]of Object.entries(PATCHES)){const re=new RegExp('^'+k.replaceAll('.','\\.')+'=.*$','m');assert(re.test(text),'缺少配置项：'+k);text=text.replace(re,k+'='+v);}
 return text;
}
function configSource(m,value){
 const own=value.startsWith(FROM)&&TO+value.slice(FROM.length);
 return own&&m.resources.some(r=>r.path===own)?own:value;
}
function gui(root,m,rel,data){
 if(rel.endsWith('.gui')){const file=m.gui[path.basename(rel)];if(file)return fs.readFileSync(path.join(root,file));}
 return typeof data==='string'?data.replaceAll(FROM,TO):data;
}
function placements(root,ray){
 const assets=JSON.parse(fs.readFileSync(path.join(root,'assets/current/manifest.json'),'utf8')).assets;
 const size=new Map(assets.map(a=>[a.runtimePath,[a.width,a.height]]));
 let n=0;
 ray=ray.replace(/layer:"(\w+)",file:("(?:[^"\\]|\\.)*"),x:(-?\d+),y:(-?\d+),scale:([0-9.eE+-]+),/g,(all,layer,file,x,y,scale)=>{
  n++;
  // Keep the original literal: Ray needs 1.0, not 1, for a float scale.
  if(!['left','center','right'].includes(layer))return `layer:"${layer}",file:${file},x:${Number(x)-SHIFT},y:${y},scale:${scale},`;
  x=Number(x);y=Number(y);scale=Number(scale);
  const dims=size.get(JSON.parse(file));assert(dims,'竖版缺少人物尺寸：'+file);
  const [w,h]=dims,s=scale*CHAR_SCALE,center=360+(x+w*scale/2-640)*CENTER_K;
  let out=String(s);if(Number.isInteger(s))out+='.0';
  return `layer:"${layer}",file:${file},x:${Math.round(center-w*s/2)},y:${Math.round(y+h*scale-h*s)},scale:${out},`;
 });
 assert(n>0,'竖版未找到任何舞台图层');
 return ray;
}
function adapt(root,m,a){
 let {host,uiRay,ray}=a;
 host=swap(host,'func setup() { return {width:1280, height:720,','func setup() { return {width:720, height:1280,');
 // The stage is already above the choices; no need to shrink it aside.
 host=swap(host,'cinemaFitStage(true); Suika.render(); cinemaFitStage(false);','Suika.render();');
 host=swap(host,'var x=272; if (slot%2==1) x=752;','var x=24;');
 host=swap(host,'var y=150; if (slot>=2) y=390;','var y=236+slot*208;');
 host=swap(host,'x:x+224','x:x+240',5);
 host=swap(host,'    Suika.drawStageToThumb();','    portraitThumbStage(true); Suika.drawStageToThumb(); portraitThumbStage(false);');
 host=swap(host,'var x=292; if(slot%2==1) x=772;','var x=48;');
 host=swap(host,'var y=228; if(slot>=2) y=468;','var y=304+slot*208;');
 uiRay=uiRay.replaceAll(FROM,TO);
 // Reading notices sit on the stage; panel notices above the bottom navigation.
 uiRay=swap(uiRay,'    Engine.draw({texture:cinemaNoticeTexture,x:272,y:666});\n    Engine.draw({texture:eNotice,x:288,y:676});','    var ny=1068; if(ePanel=="") ny=88;\n    Engine.draw({texture:cinemaNoticeTexture,x:24,y:ny});\n    Engine.draw({texture:eNotice,x:40,y:ny+10});');
 uiRay=swap(uiRay,'x:768,y:32','x:24,y:716');
 uiRay=swap(uiRay,'x:768,y:128+i*88','x:24,y:792+i*80',2);
 uiRay=swap(uiRay,'suiGalleryHit(768,128+i*88,480,80)','suiGalleryHit(24,792+i*80,672,76)');
 uiRay=swap(uiRay,'Engine.mousePosX < 1104 || Engine.mousePosX >= 1232','Engine.mousePosX < 568 || Engine.mousePosX >= 696');
 uiRay=swap(uiRay,'suiGalleryHit(1104,24,128,56)','suiGalleryHit(568,24,128,56)');
 uiRay=swap(uiRay,'Engine.draw({texture: t, x: 1104, y: 24});','Engine.draw({texture: t, x: 568, y: 24});');
 // Gallery: 2x3 grid, pager above the bottom navigation, back at the top right.
 uiRay=swap(uiRay,'suiGalleryDrawFit(suiGalleryTextures[suiGalleryDetail],64,132,1152,510);','suiGalleryDrawFit(suiGalleryTextures[suiGalleryDetail],0,240,720,800);');
 uiRay=swap(uiRay,'Engine.draw({texture: suiGalleryUI.back, x: 1080, y: 32});','Engine.draw({texture: suiGalleryUI.back, x: 496, y: 40});');
 uiRay=swap(uiRay,'64 + (i % 3) * 400','24 + (i % 2) * 344');
 uiRay=swap(uiRay,'272 + (i % 3) * 320','24 + (i % 2) * 344',2);
 uiRay=swap(uiRay,'146 + (i / 3) * 208','168 + (i / 2) * 240',3);
 uiRay=swap(uiRay,'352,184','328,184');
 uiRay=swap(uiRay,'288,184','328,184',3);
 uiRay=swap(uiRay,'if (up && suiGalleryFocus >= 3) suiGalleryFocus = suiGalleryFocus - 3;','if (up && suiGalleryFocus >= 2) suiGalleryFocus = suiGalleryFocus - 2;',2);
 uiRay=swap(uiRay,'if (down && suiGalleryFocus < 3) suiGalleryFocus = suiGalleryFocus + 3;','if (down && suiGalleryFocus < 4) suiGalleryFocus = suiGalleryFocus + 2;',2);
 uiRay=swap(uiRay,'suiGalleryHit(32,592,200,64)','suiGalleryHit(496,40,200,64)');
 uiRay=swap(uiRay,'suiGalleryHit(272,588,176,56)','suiGalleryHit(24,1040,176,64)',2);
 uiRay=swap(uiRay,'suiGalleryHit(1040,588,176,56)','suiGalleryHit(520,1040,176,64)',3);
 uiRay=swap(uiRay,'x: 272, y: 588','x: 24, y: 1040');
 uiRay=swap(uiRay,'x: 1040, y: 588','x: 520, y: 1040');
 uiRay=swap(uiRay,'x: 680, y: 602','x: 296, y: 1058');
 // History: four rows per page, 24 characters per line in a 672-wide row.
 uiRay=swap(uiRay,'String.charCount(line) >= 32','String.charCount(line) >= 24');
 uiRay=swap(uiRay,'suiHistoryPage * 2','suiHistoryPage * 4');
 uiRay=swap(uiRay,'var start = end - 2;','var start = end - 4;');
 uiRay=swap(uiRay,'suiHistoryPages = (Array.size(suiHistoryRows)+1)/2;','suiHistoryPages = (Array.size(suiHistoryRows)+3)/4;',2);
 uiRay=swap(uiRay,'suiGalleryHit(272,146+i*214,880,208)','suiGalleryHit(24,160+i*216,672,208)');
 uiRay=swap(uiRay,'var y=146+i*214;','var y=160+i*216;');
 uiRay=swap(uiRay,'suiGalleryHit(64,y,880,208)','suiGalleryHit(24,y,672,208)');
 uiRay=swap(uiRay,'Engine.draw({texture:panel,x:272,y:y});','Engine.draw({texture:panel,x:24,y:y});');
 uiRay=swap(uiRay,'x:296,y:','x:48,y:',2);
 uiRay=swap(uiRay,'Engine.draw({texture:suiGalleryUI.prev,x:272,y:588});','Engine.draw({texture:suiGalleryUI.prev,x:24,y:1040});');
 uiRay=swap(uiRay,'Engine.draw({texture:suiGalleryUI.next,x:1040,y:588});','Engine.draw({texture:suiGalleryUI.next,x:520,y:1040});');
 uiRay=swap(uiRay,'Engine.draw({texture:suiHistoryPageText,x:680,y:602});','Engine.draw({texture:suiHistoryPageText,x:296,y:1058});');
 // The scrollbar column (x 1174+) lies outside a 720-wide canvas; drop its drawing.
 uiRay=swap(uiRay,'Engine.draw({texture:suiHistoryUI.scroll,x:1184,y:146});','');
 uiRay=swap(uiRay,'Engine.draw({texture:suiHistoryUI.knob,x:1184,y:y});','');
 ray=ray.replaceAll(FROM,TO);
 ray=swap(ray,'0,0,1280,720);','0,0,720,1280);');
 ray=swap(ray,'suiGalleryHit(64,24,248,56)','suiGalleryHit(24,24,248,56)');
 ray=swap(ray,'Engine.draw({texture:iViewHint,x:72,y:36});','Engine.draw({texture:iViewHint,x:32,y:36});');
 ray=placements(root,ray);
 // Save thumbnails stay 192x108 so both layouts can read every save file. The engine scales the
 // whole 720x1280 canvas into it; while drawing, stretch the stage's central 720x405 band to fill it.
 ray+='\nfunc portraitThumbStage(on) {\n    var state=iGet("state");if(!Dict.hasKey(iStates,state)) return;\n    for(p in iStates[state]) {\n        var y=p.y;var scaleY=p.scale;\n        if(on) {y=Int.from((p.y-157.5)*'+THUMB_K+');scaleY=p.scale*'+THUMB_K+';}\n        Suika.setLayerPosition({layer:iLayers[p.layer],x:p.x,y:y});\n        Suika.setLayerScale({layer:iLayers[p.layer],scaleX:p.scale,scaleY:scaleY});\n    }\n}\n';
 // Choice option textures share names with the cinema set; the prefix swap above retargets them.
 for(const[id,opts]of Object.entries(m.choices))for(const o of opts)assert(uiRay.includes(JSON.stringify(o.path).slice(1,-1)),'竖版选项图未接入：'+id);
 return {...a,host,uiRay,ray};
}
module.exports={load,config,configSource,gui,adapt,LAYOUT_KEYS};
