'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const rel='system/sui-cinema/manifest.json';
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'电影UI接入锚点不唯一：'+a);return s.replace(a,b)};
function load(root){
 if(!fs.existsSync(path.join(root,rel)))return null;
 const m=JSON.parse(fs.readFileSync(path.join(root,rel)));assert.equal(m.approval.status,'approved');
 for(const r of m.resources){assert(r.path.startsWith('assets/current/ui-cinema/'));assert(!r.path.split('/').includes('..'));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r.path))).digest('hex'),r.sha256,'电影UI资源变化：'+r.path);}
 const inputFiles=[rel,'system/sui-cinema/runtime.ray','tools/ui-cinema/build.cjs','tools/ui-cinema/render.py','assets/sources/20261030-cinema-ui/choice-layout.json',...Object.values(m.gui),...m.resources.map(r=>r.path)];
 return {...m,inputFiles};
}
function config(text){
 text=text.replaceAll('system/sui-u/png/','assets/current/ui-cinema/png/');
 const patches={'choose.font.size':'26','namebox.font.r':'220','namebox.font.g':'201','namebox.font.b':'164'};
 for(let i=1;i<=8;i++)Object.assign(patches,{['choose.box'+i+'.x']:'768',['choose.box'+i+'.y']:String(128+(Math.min(i,6)-1)*88),['choose.box'+i+'.margin.top']:'20'});
 for(const[k,v]of Object.entries(patches)){const re=new RegExp('^'+k.replaceAll('.','\\.')+'=.*$','m');assert(re.test(text));text=text.replace(re,k+'='+v);}
 return text;
}
function gui(root,m,rel,data){
 if(rel==='system/sui-u/gui/title.gui')return data.toString().replace(/^GALLERY\s*\{[^}]+\}/m,b=>b.replace('type: goto;','type: char;\n    var: e_action;\n    msg: G;\n    max: 1;').replace(/^\s*label:.*;$/m,''));
 if(rel.endsWith('.gui')){
  const file=m.gui[path.basename(rel)];if(file)return fs.readFileSync(path.join(root,file));
 }
 return typeof data==='string'?data.replaceAll('system/sui-u/png/','assets/current/ui-cinema/png/'):data;
}
function adapt(root,m,a){
 let {host,uiRay,contentNovel}=a;
 uiRay=uiRay.replaceAll('system/sui-u/png/','assets/current/ui-cinema/png/').replaceAll('r: 169, g: 208, b: 195','r: 220, g: 201, b: 164');
 uiRay=uiRay.replaceAll('>= 38','>= 32');
 // Shift backlog content only; its native GUI retains responsibility for navigation.
 const hs=uiRay.indexOf('func suiHistoryUpdate()'),he=uiRay.indexOf('// Call before Suika.update()',hs);
 assert(hs>0&&he>hs);
 let history=uiRay.slice(hs,he).replaceAll('64,588','272,588').replaceAll('64,146','272,146').replaceAll('1080,208','880,208').replaceAll('x:64','x:272').replaceAll('x:88','x:296').replaceAll('x:554','x:680');
 history=history.replace('    Engine.draw({texture:suiHistoryUI.base,x:0,y:0});\n','').replace('    Engine.draw({texture:suiGalleryUI.back,x:1080,y:32});\n','');
 uiRay=uiRay.slice(0,hs)+history+uiRay.slice(he);
 // Reuse existing gallery unlock/page/detail logic for an overlay which never moves the story tag.
 const gs=uiRay.indexOf('    var click = Suika.isMouseLeftClicked();',uiRay.indexOf('func Tag_sui_gallery'));
 const ge=uiRay.indexOf('\nfunc suiGalleryDrawFit',gs);
 let pump=uiRay.slice(gs,ge).replace(/\n}\s*$/,'');
 pump=pump.replace('        Suika.stopCommandRepetition();\n','').replace('        Suika.moveToNextTag();','        Suika.stopGUI(); ePanel="";');
 pump=pump.replace('suiGalleryHit(1080,32,136,56)','suiGalleryHit(32,592,200,64)');
 pump=pump.replaceAll('64 + (i % 3) * 400','272 + (i % 3) * 320').replaceAll('352,184','288,184').replaceAll('64,588','272,588');
 uiRay+='\nfunc cinemaGalleryUpdate() {\n'+pump+'\n}\n';
 const rs=uiRay.indexOf('func suiUIRender()');
 let render=uiRay.slice(rs).replaceAll('64 + (i % 3) * 400','272 + (i % 3) * 320').replaceAll('352,184','288,184').replaceAll('x: 64, y: 588','x: 272, y: 588').replaceAll('x: 554','x: 680');
 render=render.replace('    Engine.draw({texture: suiGalleryUI.base, x: 0, y: 0});\n','');
 render=render.replace('    Engine.draw({texture: suiGalleryUI.back, x: 1080, y: 32});\n    if (suiGalleryPage','    if (suiGalleryPage');
 uiRay=uiRay.slice(0,rs)+render;
 // The extracted pump is after the renderer; preserve it while changing its own geometry only once.
 uiRay=once(uiRay,'    if (suiHistoryActive) suiHistoryUpdate();','    if (suiGalleryActive && ePanel=="gallery") cinemaGalleryUpdate();\n    if (suiHistoryActive) suiHistoryUpdate();');
 const bodyStart=uiRay.indexOf('    var wasDown =',uiRay.indexOf('func suiHistoryAfterUpdate'));
 const bodyEnd=uiRay.indexOf('\n}\nfunc suiHistoryUpdate',bodyStart);
 assert(bodyStart>0&&bodyEnd>bodyStart);
 uiRay+='\nfunc cinemaOpenHistory() {\n'+uiRay.slice(bodyStart,bodyEnd)+'\n}\n';
 const install=['var cinemaChoices = {};'];let n=0;
 for(const[id,opts]of Object.entries(m.choices))install.push('func cinemaRegister_'+(n++)+'() { cinemaChoices['+JSON.stringify(id)+'] = '+JSON.stringify(opts.map(o=>({file:o.path,value:o.value}))).replace(/"(file|value)":/g,'$1:')+'; }');
 for(let i=0;i<n;i+=12)install.push('func cinemaInstallGroup_'+i+'() {',...Array.from({length:Math.min(12,n-i)},(_,j)=>'    cinemaRegister_'+(i+j)+'();'),'}');
 install.push('func cinemaInstall() {',...Array.from({length:Math.ceil(n/12)},(_,i)=>'    cinemaInstallGroup_'+(i*12)+'();'),'}');
 uiRay+='\n'+install.join('\n')+'\n'+fs.readFileSync(path.join(root,'system/sui-cinema/runtime.ray'),'utf8');
 host=once(host,'eInstallPositions(); suiUIStart();','eInstallPositions(); suiUIStart(); cinemaInstall();');
 host=once(host,'    eGlobal("meta_gen_"+slot,eGet("generation"));','    eGlobal("meta_gen_"+slot,eGet("generation"));\n    eGlobal("meta_time_"+slot,Suika.getSaveTimestamp({index:slot}));\n    eGlobal("meta_chapter_"+slot,Suika.getSaveChapterName({index:slot}));\n    eGlobal("meta_message_"+slot,Suika.getSaveLastMessage({index:slot}));');
 host=host.replace('slot<10 && !Suika.checkSaveExists({index:slot})','slot<10 && !cinemaHasSave(slot)');
 host=host.replace('slot==0 && Suika.checkSaveExists({index:0})','slot==0 && cinemaHasSave(0)');
 host=host.replace('if (Suika.checkSaveExists({index:slot})) {','if (cinemaHasSave(slot)) {');
 host=host.replace('var label=Suika.getSaveChapterName({index:slot});','var label=cinemaSavedChapter(slot);').replace('Suika.getSaveLastMessage({index:slot}),13','cinemaSavedMessage(slot),9').replace('eDate(Suika.getSaveTimestamp({index:slot}))','eDate(cinemaSavedTimestamp(slot))');
 host=once(host,'            var status="可读取";','            if(!Suika.checkSaveExists({index:slot})) Array.push(eSlotText,{texture:suiHistoryText("已保存 · 点击恢复",20,true),x:x+24,y:y+100});\n            var status="可读取";');
 host=once(host,'    ePanel=panel; ePrepareSlots();','    cinemaCleanup(); ePanel=panel; ePrepareSlots();');
 host=once(host,'    eSet("action","");\n    if (action=="L")','    eSet("action","");\n    if (cinemaAction(action)) return;\n    if (action=="L")');
 host=once(host,'if (ePanel!="" && Suika.isGUIRunning()) {','if ((ePanel=="save" || ePanel=="load") && Suika.isGUIRunning()) {');
 host=host.replace('var x=64; if (slot%2==1) x=660;','var x=272; if (slot%2==1) x=752;').replace('var y=146; if (slot>=2) y=388;','var y=150; if (slot>=2) y=390;');
 host=host.replaceAll('x:x+232','x:x+224').replaceAll('eShort(label,13),22','eShort(label,9),21').replace('}),13);','}),9);').replace('eShort(Suika.getSaveLastMessage({index:slot}),13)','eShort(Suika.getSaveLastMessage({index:slot}),9)');
 host=host.replace('var x=84; if(slot%2==1) x=680;','var x=292; if(slot%2==1) x=772;').replace('var y=224; if(slot>=2) y=466;','var y=228; if(slot>=2) y=468;');
 host=once(host,'    Suika.render(); suiUIRender();','    cinemaFitStage(true); Suika.render(); cinemaFitStage(false); suiUIRender(); cinemaRenderChoices();');
 host=once(host,'func update() {','func update() {\n    if(cinemaBeforeUpdate()) return;');
 host=once(host,'if(eNotice!=false && Engine.millisec<eNoticeUntil) Engine.draw({texture:eNotice,x:80,y:92});','if(eNotice!=false && Engine.millisec<eNoticeUntil) cinemaRenderNotice();');
 // Keep original native labels: the SDK also uses them in save metadata.
 // Opaque, measured label textures supply the theme's readable presentation.
 return {...a,host,uiRay,contentNovel};
}
module.exports={load,config,gui,adapt};
