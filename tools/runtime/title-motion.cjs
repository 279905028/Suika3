'use strict';
const assert=require('node:assert/strict');
function once(s,a,b){assert.equal(s.split(a).length,2,'动态标题接入锚点不唯一：'+a);return s.replace(a,b);}
function gui(text){
  return text.replace(/^SETTINGS\s*\{[^}]+\}/m,block=>{
    assert(block.includes('type: gui;'),'标题设置入口已变化');
    return block.replace('type: gui;','type: char;\n    var: e_action;\n    msg: C;\n    max: 1;').replace(/^\s*file:.*;$/m,'');
  });
}
function host(text){
  text='var eTitleMotionVisible = false;\n'+text;
  // Cinema's own action handler gets first refusal; this branch supports the original UI.
  text=once(text,'    if (action=="L")','    if (action=="C" && eMode=="title") {\n        ePanel="config"; Suika.stopGUI();\n        Suika.loadGUIFile({file:"system/sui-u/gui/config.gui",isSys:true});\n        Suika.clearInputState(); Suika.startGUI(); return;\n    }\n    if (action=="L")');
  text=text.replace('if (ePanel!="" && Suika.isGUIRunning()) {','if ((ePanel=="save" || ePanel=="load") && Suika.isGUIRunning()) {');
  text=once(text,'}\nfunc render() {','    eTitleMotionUpdate();\n}\nfunc render() {');
  text+='\nfunc eTitleMotionUpdate() {\n    var visible=eMode=="title" && ePanel=="" && Suika.isGUIRunning() && Suika.getTagName()=="gui";\n    if(visible==eTitleMotionVisible) return;\n    eTitleMotionVisible=visible;\n    if(visible) print("SUI_E|title-motion|visible=1");\n    else print("SUI_E|title-motion|visible=0");\n}\n';
  return text;
}
module.exports={gui,host};
