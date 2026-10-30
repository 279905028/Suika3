'use strict';
const {model}=require('../../tools/compiler/model.cjs');
const {quoted:q}=require('../../tools/compiler/emit.cjs');
module.exports=ir=>{
  const R=ir.contract,m=model(ir),base=Object.fromEntries(Object.values(ir.choices).filter(c=>R.storyEntry.common.includes(c.source.file)).map(c=>[c.id,'A']));
  const cases=[];for(const r of R.routes)for(const relation of ['HIGH','LOW']){
    const combinations=r.id==='piao'&&relation==='LOW'?['A','B']:['AA','AB','BA','BB'];
    for(const combination of combinations){
      const a={...base,'ROUTE-01':r.id};for(const c of R.piaoRelation.choices)a[c.id]=relation==='HIGH'?'A':'B';
      for(const c of Object.values(ir.choices).filter(c=>c.source.file===r.file&&(r.id!=='piao'||(c.id===r.lowPathChoice)===(relation==='LOW'))))a[c.id]='A';
      (r.id==='piao'&&relation==='LOW'?[r.lowPathChoice]:r.keyChoices).forEach((id,i)=>a[id]=combination[i]);
      const result=m.run(a);const pages=result.paragraphs.reduce((n,p)=>n+Math.ceil(Array.from(new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(p.text)).length/ir.pageSize),0)+result.trace.filter(t=>t.op==='choice').length;
      const s=result.s;cases.push({name:`${r.id}/${relation}/${combination}`,answers:a,kind:'complete',expected:{route:s.route,relation:s.relation,score:s.score,ending:s.ending,epilogue:s.epilogue?R.epilogues.rules.find(r=>r.target?.file===s.epilogue).target.anchor:'',pregnancy:s.events.includes(R.day36.eventId)?'1':'0',meeting:'1',pages,choices:Object.keys(s.choices).length}});
    }
  }
  for(let mask=0;mask<8;mask++){
    const a={...base};R.piaoRelation.choices.forEach((c,i)=>a[c.id]=(mask>>i)&1?'B':'A');const s=m.run(a).s;
    cases.push({name:'relation/'+R.piaoRelation.choices.map(c=>a[c.id]).join(''),answers:a,kind:'relation',expected:{relation:s.relation,score:s.score,meeting:'1'}});
  }
  const init=['var qa_answers = [];','var qa_names = [];','var qa_kinds = [];','func qa_init() {',...cases.map((_,i)=>`    qa_init_${i}();`),'}'];
  for(const[c,i]of cases.map((c,i)=>[c,i])){
    init.push(`func qa_init_${i}() {`,'    var answers = {};',...Object.entries(c.answers).map(([k,v])=>`    answers[${q(k)}] = ${q(v)};`),'    Array.push(qa_answers, answers);',`    Array.push(qa_names, ${q(c.name)});`,`    Array.push(qa_kinds, ${q(c.kind)});`,'}');
  }
  const literal='中文"引号" [goto name="INJECT"] \\path ${raw} 👨‍👩‍👧‍👦';
  const fixture=`\n[label name="QA_ESCAPE"]\n[qa_escape text=${q(literal)}]\n`;
  const host=init.join('\n')+`
var qa_auto = false;
var qa_index = 0;
var qa_pages = 0;
var qa_choices = 0;
var qa_last_q = false;
var qa_last_h = false;
var qa_last_l = false;
var qa_pause_route = false;
var qa_pause_locked = false;
var qa_route_logged = false;
var qa_request = 0;
var qa_pending_request = "";
func setup() { return {width:720, height:1280, title:"SUI-C 编译验证 · 独立测试", fullscreen:false}; }
func start() {
    Suika.start();
    Engine.loadFont({slot:1, file:"system/font/NotoSansCJK-Medium.ttc"});
    Suika.setTextSpeed({speed:1.0});
    sc_install(); sc_new(); qa_init();
    print("SUI_C|ready");
}
func qa_reset() {
    Suika.stopCommandRepetition();
    for (i in 0..8) Suika.showChooseBox({index:i, showIdle:false, showHover:false});
    Suika.showMessageBox({show:false});
    sc_new(); qa_pages=0; qa_choices=0; qa_route_logged=false; qa_pending_request="";
    sc_jump("SC_ENTRY");
}
func qa_result() {
    qa_pages=sc_diagnostic_visits; qa_choices=sc_diagnostic_choices;
    print("SUI_C|case|" + qa_names[qa_index] + "|" + sc_get("route") + "|" + sc_get("relation") + "|" + sc_get("score") + "|" + sc_get("ending") + "|" + sc_get("epilogue") + "|" + sc_get("e_" + sc_pregnancy_event) + "|" + sc_get("e_" + sc_meeting_event) + "|" + qa_pages + "|" + qa_choices);
    qa_index = qa_index + 1;
    if (qa_index == ${cases.length}) {
        qa_auto=false; print("SUI_C|suite-done|${cases.length}");
        return;
    }
    qa_reset();
}
func Tag_qa_escape(params) {
    if (params.text != ${q(literal)}) {print("SUI_C|escape-fail|" + params.text);qa_auto=false;}
    else {print("SUI_C|escape-pass");qa_index=0;qa_auto=true;qa_reset();}
    return true;
}
func update() {
    if (Engine.isQKeyPressed && !qa_last_q) {
        Suika.stopCommandRepetition();qa_pause_route=false;sc_jump("QA_ESCAPE");
    }
    if ((Engine.isUKeyPressed && !qa_last_h) || (Engine.isJKeyPressed && !qa_last_l)) {
        qa_index=0;qa_pause_route=true;qa_pause_locked=Engine.isJKeyPressed;qa_auto=true;qa_reset();
    }
    qa_last_q=Engine.isQKeyPressed;qa_last_h=Engine.isUKeyPressed;qa_last_l=Engine.isJKeyPressed;
    var limit=1;
    if (qa_auto) limit=40;
    for (i in 0..limit) {
        var choosing_before=Suika.isInCommandRepetition() && Suika.getTagName() == "choose";
        if (qa_auto && !(Suika.isInCommandRepetition() && Suika.getTagName() == "choose")) Suika.startSkipMode();
        Suika.update();
        if (choosing_before) Suika.clearInputState();
        if (sc_get("route") != "" && !qa_route_logged && !qa_auto) {
            qa_route_logged=true;print("SUI_C|clicked|" + sc_get("route"));
        }
        if (qa_auto) {
            if (!sc_ok()) {qa_auto=false;print("SUI_C|suite-failed|" + qa_names[qa_index]);return;}
            if (sc_get("status") == "complete") {qa_result();return;}
            if (Suika.isInCommandRepetition()) {
                var tag=Suika.getTagName();
                if (tag == "choose") {
                    var id=sc_get("pending");
                    if (id == sc_route_choice && qa_pause_route) {
                        qa_auto=false;Suika.stopSkipMode();print("SUI_C|route-ready|" + sc_hq_eligible());return;
                    }
                    if (id == sc_route_choice && qa_kinds[qa_index] == "relation") {qa_result();return;}
                    if (!Dict.hasKey(qa_answers[qa_index],id)) {print("SUI_C|answer-missing|"+id);qa_auto=false;return;}
                    var answer=qa_answers[qa_index][id];
                    if (qa_pause_route && qa_pause_locked && id == "C01-02") answer="B";
                    var request_key=String.from(qa_index)+"/"+id;
                    if (request_key != qa_pending_request) {
                        var option_index=0;
                        for (v in sc_choices[id].values) {
                            if (v == answer) break;
                            option_index=option_index+1;
                        }
                        qa_pending_request=request_key;qa_request=qa_request+1;
                        print("SUI_C|choose|"+qa_request+"|"+qa_index+"|"+id+"|"+option_index);
                    }
                    return;
                }
            }
        }
        // A real click is consumed once, even when this QA host fast-forwards many updates.
        if (choosing_before) return;
    }
}
func render() { Suika.render(); }
`;
  return {host,fixture,cases};
};
