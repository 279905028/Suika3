'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const R=process.cwd(),D='docs/修订协作/P4-演出与美术/P4-01/';
const V=require(R+'/tools/story-revision/p4-bindings/validate.cjs');
const ctx=V.loadContext();const assets=JSON.parse(fs.readFileSync('assets/current/manifest.json')).assets;
const legacy=JSON.parse(fs.readFileSync(D+'legacy-index.json'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n')};
const fp=p=>({path:p,sha256:hash(fs.readFileSync(p))});
const p=(id,layer)=>{let a=assets.find(a=>a.assetId===id);assert(a,id);let art=['bg','cg'].includes(layer);let scale=art?Math.min(1280/a.width,720/a.height):(layer.startsWith('prop')?340/a.width:584/a.height);return {assetId:id,layer,x:art?0:layer==='left'?165:layer==='right'?725:layer==='prop1'?470:445,y:art?0:layer.startsWith('prop')?110:42,scale,form:a.type==='character'?'human':null,costume:a.type==='character'?id:null}};
function build(code,segments,overrides,cgs,needs,summary){
 const pack='P4-02-'+code,dir='docs/修订协作/P4-演出与美术/'+pack,qa='qa/dialogue-p4-'+pack+'-20261103';
 const ps=ctx.paragraphs.filter(p=>p.packageId===pack),ns=ctx.nodes.filter(n=>n.packageId===pack);const byp=new Map(ps.map((p,i)=>[p.paragraphId,{p,i}]));
 const templates=k=>JSON.parse(fs.readFileSync(D+'templates/'+pack+'/'+k));let docs={bindings:templates('bindings.candidate.json'),review:templates('review.json'),needs:templates('needs.json'),boundaries:templates('boundary-states.json')};
 const states=new Map(),notes=new Map(); const checked=[];
 for(let i=0;i<ps.length;i++){
  let s=segments.find(s=>s[0]<=i&&i<=s[1]);assert(s,'no shot '+code+i);let [lo,hi,bg,chs,note,crop]=s;chs=[...chs];let props=[];let o=overrides[i];if(o){if('bg'in o)bg=o.bg;if(o.chars)chs=[...o.chars];if(o.props)props=o.props;note+='；'+o.note;if('crop'in o)crop=o.crop;}
  // Explicit shot ranges establish presence. Speaker selection only frames an already established local person.
  let characters=chs.map((id,j)=>p(id,chs.length===1?'center':j===0?'left':j===1?'right':'center'));
  if(crop&&characters.length){let speaker=ps[i].textMeta.speaker;let match=characters.find(a=>speaker==='piao'?a.assetId.startsWith('piao'):speaker==='mengyao'?a.assetId.startsWith('char-mengyao'):speaker==='maolang'?a.assetId.startsWith('maolang'):speaker==='chensheng'?a.assetId.startsWith('chensheng'):false)||characters[0];characters=[{...match,layer:'center',x:179,y:25,scale:.9}];note+='；取肩胸以上表情近景，下半身在阅读框/画面外，动作和坐姿不由站立底图代演，其他现场人物留画外';}
  let state={background:bg?p(bg,'bg'):null,characters,props:props.map((x,j)=>p(x,'prop'+(j+1))),cg:null};let cg=cgs[i];if(cg)state.cg=p(ctx.baseline.cg.find(x=>x.cgId===cg).assetId,'cg');states.set(ps[i].paragraphId,state);notes.set(ps[i].paragraphId,note);checked.push({paragraphId:ps[i].paragraphId,nodeIds:ps[i].nodeIds,text:ps[i].text,channel:ps[i].textMeta.channel,speaker:ps[i].textMeta.speaker,condition:ps[i].condition,shot:note,background:bg,characters:characters.map(p=>p.assetId),props,cgId:cg||null});
 }
 const choose=new Map();for(let i=0;i<ns.length;i++){let n=ns[i];if(n.op==='choice'){let prev=ns.slice(0,i).reverse().find(x=>x.op==='text');assert(prev);let state=structuredClone(states.get(prev.paragraphId));state.cg=null;choose.set(n.nodeId,{state,originParagraphId:prev.paragraphId,note:'选择承接本章现场/远程视角；清姓名与CG，选择后只按目标条件重建。'+notes.get(prev.paragraphId)});}}
 docs.needs.needs=needs.map((n,j)=>{let inds=n.indices;return {needId:pack+'-N'+String(j+1).padStart(3,'0'),resourceKey:n.key,kind:n.kind,action:n.action,ownerTask:n.kind==='cg'?'P4-04':'P4-03',nodeIds:[...new Set([...inds.flatMap(i=>ps[i].nodeIds),...([...choose].filter(([id,c])=>n.kind==='background'&&inds.some(i=>ps[i].paragraphId===c.originParagraphId)).map(([id])=>id))])],reason:n.reason,constraints:n.constraints,existingAssetIds:n.existing||[],proposedAssetId:null,cgId:n.cg||null,status:'open',resolution:null}});
 for(const row of docs.bindings.bindings){let n=ctx.byNode.get(row.nodeId),st=structuredClone(n.op==='choice'?choose.get(n.nodeId).state:states.get(n.paragraphId));row.binding={bindingId:'p4-'+n.nodeId,anchor:{nodeId:n.nodeId,file:n.source.file,sha256:n.source.sha256},condition:n.condition,routeIds:n.routeIds,enter:st,exit:{at:'next-node',restore:{...structuredClone(st),cg:null}},cgId:st.cg?ctx.baseline.cg.find(c=>c.assetId===st.cg.assetId).cgId:null,fullView:!!st.cg,restrictions:['本段按P3冻结正文重新审定；旧绑定不作为状态来源','每次进入/回退/读档按目标节点重建完整状态，跨路线与分支清除源状态','CG仅当前正文节点可见，下一节点恢复完整底层；选择清姓名/CG；可见帧解锁留P4-06/P5验证','当前为未通过P4-05资源复验的候选，不得直接正式采用']};}
 for(let r of docs.review.reviews){let entry=byp.get(r.unitId),note=entry?notes.get(r.unitId):choose.get(r.unitId).note;let st=entry?states.get(r.unitId):choose.get(r.unitId).state;r.needIds=docs.needs.needs.filter(n=>n.nodeIds.some(id=>r.nodeIds.includes(id))).map(n=>n.needId);r.status=r.needIds.length?'blocked':'reviewed';r.decision=r.needIds.length?'new-art':(!st.background&&!st.characters.length&&!st.props.length&&!st.cg?'neutral':'rebind');r.basis=entry?'逐段核读「'+entry.p.text+'」；'+note+'；媒介='+entry.p.textMeta.channel+'，冻结条件='+entry.p.condition:note;r.unresolved=r.needIds.map(id=>'待制作/复核：'+id);}
 const bById=new Map(ctx.boundaries.filter(b=>b.packageId===pack).map(b=>[b.boundaryId,b]));
 for(let b of docs.boundaries.boundaries){let x=bById.get(b.boundaryId);b.status='reviewed';b.basis='核对'+x.kind+' '+(x.fromNodeId||'文件入口')+' → '+x.targetNodeIds.join('、')+'；'+(code==='MY'?'MY07=A只影响已发生的44/56/75日亲密，MY07与MY09均A才继续秘密关系；B后读档与改选不得恢复亲密；婚姻持续。':'HIGH/LOW入口互斥，HIGH仅PI06/PI08均A继续，LOW按PI-L06收束；第36天已在本线发生，不再CALL公共事件。')+'目标包='+x.targetPackages.join('、')+'；跨包不保存源人物、道具或CG，由目的节点重建；结局仅单身者按规则进公共后日谈。';b.unresolved=[];}
 for(const [key,file]of Object.entries(V.NAMES))write(dir+'/'+file,docs[key]);
 write(qa+'/reading-register.json',{packageId:pack,inputFingerprint:ctx.input.inputFingerprint,interfaceFingerprint:ctx.seal.interfaceFingerprint,method:'逐段完整通读冻结文本；按明确场景/媒介重新设计镜头并手工填写范围，程序只展开重复字段；未读取旧绑定生成状态。肩胸近景只供表情，不模拟身体动作。',paragraphs:checked});
 write(qa+'/shot-plan.json',{segments:segments.map(s=>({first:ps[s[0]].paragraphId,last:ps[s[1]].paragraphId,background:s[2],characters:s[3],basis:s[4],upperBodyCrop:!!s[5]})),overrides:Object.fromEntries(Object.entries(overrides).map(([i,o])=>[ps[+i].paragraphId,o])),cgs:Object.fromEntries(Object.entries(cgs).map(([i,c])=>[ps[+i].paragraphId,c]))});
 const draft=V.validatePack(ctx,pack,docs,{mode:'draft'});let handoff;try{V.validatePack(ctx,pack,docs);handoff={unexpectedPass:true};}catch(e){handoff={status:'blocked-as-expected',reason:e.message};}
 write(qa+'/verification.json',{...draft,interfaceFingerprint:ctx.seal.interfaceFingerprint,semanticReviewedUnits:docs.review.reviews.filter(x=>x.status==='reviewed').length,blockedUnits:docs.review.reviews.filter(x=>x.status==='blocked').length,referencedAssets:[...new Set(docs.bindings.bindings.flatMap(b=>V.placements(b.binding.enter).map(p=>p.assetId)))],handoff,notes:'draft仅结构/指纹/覆盖通过；并非已审完成或资源/运行验收。'});
 const text='# '+pack+' 演出候选交接\n\n2026-11-03｜逐段审阅与候选已交；最终交接未闭合。\n\n'+summary+'\n\n- 覆盖：'+ps.length+'段正文，'+ns.filter(n=>n.op==='choice').length+'个选择，'+ns.length+'个完整状态绑定，'+docs.boundaries.boundaries.length+'项边界。逐段结论见 `review.json`，原句与镜头见本批QA `reading-register.json`。\n- '+docs.needs.needs.length+'项开放需求；受影响单元标 blocked，并双向关联 `needs.json`。其余单元的 reviewed 仅表示演出判断完成。资源基线全为 pending；不将历史批准当本批检查。\n- draft检查通过；handoff按预期拒绝。未修改P3/scenario、当前资源清单、正式绑定、P4-01冻结模板或根TODO。\n- 本批看过现有CG缩略联系图及面馆昼/晨、回声白昼楼道3张背景作构图/叙事比对；未做P4-05全尺寸逐项解码、alpha、四底边缘和UI遮挡复验，未生成新图。\n- 未执行引擎、浏览器/手机真机、电脑原生、存读档或发布；未访问玩家旧档。\n\n输入构建ID：`'+ctx.input.contentBuildId+'`。输入指纹：`'+ctx.input.inputFingerprint+'`。接口指纹：`'+ctx.seal.interfaceFingerprint+'`。\n\nP4-03/04返回需求处置与资源后，在本包闭合；P4-05通过后重新执行handoff。P4-07核对跨包入口，统一采用；P5另做运行验收。\n';write(dir+'/交接.md',text);write(qa+'/交接.md',text);write(qa+'/outputs.json',{inputs:[fp(D+'input-manifest.json'),fp(D+'freeze.json')],outputs:[...Object.values(V.NAMES).map(f=>fp(dir+'/'+f)),fp(dir+'/交接.md'),fp(qa+'/reading-register.json'),fp(qa+'/shot-plan.json')]});console.log(pack,ps.length,ns.length,docs.needs.needs.length,draft.status);
}
module.exports={build,ctx,write,fp};
if(require.main===module){
const S='char-mengyao-human-base-expression-serious',N='char-mengyao-human-base-neutral',H='char-mengyao-human-base-expression-hesitant',T='char-mengyao-human-base-expression-tired',DWN='char-mengyao-human-base-expression-downcast',SM='char-mengyao-human-base-expression-smile';
const sg=(a,b,bg,ch,n,c=false)=>[a,b,bg,ch,n,c];
const segments=[
sg(0,23,'bg-mengyao-bijie-school-corridor-day',[S],'机构走廊退费争执；家长、负责人及学生画外，不补造外貌，孟遥认真；考勤纸不冒充租房材料'),
sg(24,33,'bg-bridge-shaobing-day',[N],'桥头烧饼与租房讨论；陈晟仅出现在手机姓名中，禁止到场；无婚姻预泄露'),
sg(34,57,'bg-mengyao-bijie-school-classroom-day',[N],'第21天教室清书与练习册归还；公共物品交接不等于恋爱确认'),
sg(58,64,'bg-mengyao-bijie-school-corridor-day',[N],'楼梯口借书，孟遥接电话但仍在文文面前；电话另一端不显示'),
sg(65,74,'bg-mengyao-bijie-school-classroom-day',[T],'第23天教室最后一排坐谈；入职材料与收入为正事，旧练习册在桌边',true),
sg(75,91,'bg-noodle-shop-day',[N],'两碗面各付各的钱；坐席对话，普通熟悉不承诺复合',true),
sg(92,103,null,[SM],'饭店檐下撑伞；本处不是桥头烧饼店，缺精确雨檐背景需P4-03核定'),
sg(104,107,'bg-mengyao-bijie-school-entrance-day',[SM],'回机构门口送别；转角后退出，不向后继独处页继承'),
sg(108,108,'bg-wenwen-bijie-rental-night',[],'夜晚文文独自读借书和第27天提醒；孟遥仅在心想中'),
sg(109,109,'bg-mengyao-bijie-school-entrance-day',[],'第27天机构对面办房屋电话；目标地点采用机构入口远景，来电人画外'),
sg(110,128,'bg-mengyao-bijie-school-classroom-day',[N],'教室录试讲、相互同意亲吻；孟遥尚未说明婚姻，不出现陈晟；近景不让站姿替代坐姿亲密',true),
sg(129,129,'bg-mengyao-bijie-school-corridor-day',[H],'楼道通知有人等；陈晟未正式出现，勿提前展示'),
sg(130,141,'bg-mengyao-bijie-school-entrance-day',[H,'chensheng-b'],'第27天门口介绍丈夫；陈晟为普通生活伴侣，资料袋交接按单拍切换'),
sg(142,142,'bg-mengyao-bijie-school-classroom-day',[],'文文独返空教室，孟遥与丈夫留在门口，不继承立绘'),
sg(143,148,null,[],'文字消息；文文实际地点未写，保留阅读底图，不把孟遥显示为现场'),
sg(149,176,'bg-mengyao-drink-shop-afternoon',['char-mengyao-human-casual-jacket'],'第28天饮品店，明确换下教学衬衫，夹克版本；包隔开座位，婚姻仍在',true),
sg(177,177,'bg-bijie-slope-street-day-overcast',[],'离店到街口，独自标记提醒；清孟遥'),
sg(178,181,'bg-huisheng-306-operating-night',[N,'char-zhouzhi-human-work-neutral'],'第30天回声群聚；周栀与孟遥同坐，飘和毛狼按焦点切镜；不表现复合',true),
sg(182,205,null,[H],'回声楼道纸箱隔开的谈话承接夜间聚会并在21:25离开；现有楼道为明显日照，清背景并交夜景需求；没有恢复亲密'),
sg(206,206,'bg-bijie-slope-street-night',[],'21:25离开去接班，孟遥没下楼，现场清人'),
sg(207,210,null,[],'周栀发来的锁门照片是群消息；不以店外照片替换文文所在地'),
sg(211,231,'bg-mengyao-used-books-day',[N,'chensheng-b'],'第34天旧书交接，丈夫在场；书袋/资料不在默认图中附会'),
sg(232,280,'bg-wenwen-bijie-rental-downstairs-bench-day',[S],'第38天楼下长凳核账与边界；明确婚姻持续；A私见/B停下，不改财务',true),
sg(281,281,null,[],'第44天查看维修店回复，地点未定，纯消息阅读'),
sg(282,292,null,[N],'仅MY07=A河边约见与亲吻；实际河边背景缺口，不能套桥头雨檐或街道',true),
sg(293,293,null,[],'MY07=B未发送消息，文文独处；无孟遥现场'),
sg(294,297,'bg-mengyao-bijie-school-corridor-day',[],'MY07=B把空书袋交前台；孟遥仅教室内可听声、未看见文文，保持画外'),
sg(298,298,'bg-old-netcafe-counter-night',[],'晚间处理洒饮料键盘，客人画外；清前场人物'),
sg(299,321,'bg-mengyao-bijie-school-classroom-day',[N],'第56天教室门边打包旧讲义，所有路径可见，书仍未归还；不以收书等同亲密'),
sg(322,338,'bg-wenwen-bijie-rental-night',[],'MY07=A夜间电话邀约至过夜；从来电到真正进门分开，身体互动用房间空镜与文字，勿以白天工作立绘模拟'),
sg(339,342,'bg-wenwen-bijie-rental-day',[],'MY07=A天亮穿袖核课表，动作缺图时留画外，不补造睡衣或裸露'),
sg(343,345,'bg-wenwen-bijie-rental-downstairs-bench-day',[N],'MY07=A楼下临别，不预设新恋爱称呼'),
sg(346,349,'bg-wenwen-bijie-rental-day',[],'孟遥已走，遗落红笔与消息；不把道具盖图默认为全部物件齐全'),
sg(350,357,'bg-mengyao-bijie-school-classroom-day',[DWN],'MY07=B交接后拒绝再坐；没有拥抱/过夜/遗落红笔'),
sg(358,358,'bg-wenwen-bijie-rental-night',[],'MY07=B文文回住处关闭聊天；空镜保持真正停止'),
sg(359,368,'bg-bijie-slope-street-day-overcast',[N,'chensheng-b'],'第60天路边核行李，夫妻日常从文文远观；不将任何文文选择改写婚姻'),
sg(369,393,'bg-wenwen-bijie-rental-night',[],'第68天房屋安排与A视频/B群消息，采用文文端夜间住处；视频中的两只碗不是现场道具，孟遥不出立绘'),
sg(394,395,'bg-wenwen-guiyang-home-day',[],'第75天贵阳交钥匙，文文自己的旧房与未结余账，不能套孟遥租屋'),
sg(396,428,'bg-mengyao-guiyang-home-day',[N],'仅MY07=A贵阳住处试讲与亲吻；手机录制暴露秘密的压力，陈晟只有发消息未到场',true),
sg(429,429,null,[],'离开孟遥住处的电梯无精确图；本页清背景并标blocked交P4-03，不拿文文旧房走廊冒充'),
sg(430,447,'bg-mengyao-guiyang-school-day',[N],'仅MY07=B机构前台还书，拒绝试讲；丈夫送线后普通晚饭安排，无亲密'),
sg(448,448,null,[],'走出机构到路口去车站，贵阳路口无精确背景，清现场角色'),
sg(449,487,null,[],'第89/90天材料及21点收尾电话；四组合仅通话，文文当下地点未明，清孟遥/陈晟与亲密图'),
sg(488,488,'bg-bijie-slope-street-night',[],'21:30去夜班路上，房屋和感情同时难过但未同场见面'),
sg(489,563,'bg-wenwen-bijie-rental-day',[],'第91天文文住处练习册与下午通话；孟遥在贵阳机构附近，仅声音，AA秘密继续、AB/BA/BB断开'),
sg(564,565,'bg-wenwen-bijie-rental-day',[],'傍晚前只存照片不发送，旧练习册收抽屉；不留孟遥头像或私密姿态')];
const overrides={0:{chars:[],note:'未上三楼只听叫声，人物尚未进入视线'},35:{props:['prop-mengyao-workbook-cover'],note:'封面拿给文文看；只单拍显示封面'},44:{props:['prop-mengyao-workbook-page'],note:'红叉页近景，下一页收回叠层'},65:{props:['prop-mengyao-workbook-page'],note:'练习册已归文文，桌面单拍特写'},107:{chars:[],note:'她提包上楼到转角，出口清人'},130:{chars:[H,'chensheng-documents'],note:'丈夫初登场持路线资料袋'},131:{chars:[H,'chensheng-documents'],note:'交袋前仍持资料'},140:{chars:[H,'chensheng-documents'],note:'孟遥将袋交回陈晟，恢复持资料'},141:{chars:[],note:'文文转身上楼，退出夫妻立绘'},178:{chars:[N,'char-zhouzhi-human-work-neutral'],note:'孟遥坐周栀旁'},180:{chars:['piao-base','maolang-base'],note:'切门边飘与毛狼讨论演出，其他朋友画外'},181:{chars:[N],note:'转回孟遥敲红笔的文文这一桌'},217:{chars:[N,'chensheng-book-bag'],note:'薄袋已换布袋，仍提书袋'},218:{chars:[N,'chensheng-book-bag'],note:'夫妻围绕袋子说话'},219:{chars:[N,'chensheng-book-bag'],note:'布袋未放下'},220:{chars:[N,'chensheng-book-bag'],note:'提手处动作'},221:{chars:[N,'chensheng-book-bag'],note:'袋子话题'},222:{chars:[N,'chensheng-book-bag'],note:'书袋仍在手'},223:{chars:[N,'chensheng-b'],note:'翻书换普通图，避免同手继续提袋'},227:{chars:[H],note:'门边退手近景，丈夫留旧书场外'},271:{chars:[N],note:'A手背接触用表情近景，未公开复合'},277:{chars:[DWN],note:'B伸手后收回，不能亲吻'},280:{chars:[],note:'分支汇合转核房屋事项，清两分支的手部/人物状态'},286:{chars:[],note:'头靠肩上由CG呈现；不让站姿图重复演坐姿'},291:{chars:[],note:'接吻、走开接电话，身体动作留画外'},305:{chars:['char-mengyao-human-book-box'],note:'当场真实有内容物书箱，单拍取用'},326:{chars:[N],crop:true,note:'孟遥真正进门才显示肩胸表情'},327:{chars:[N],crop:true,note:'进门说明次日返机构'},329:{chars:[N],crop:true,note:'明确询问丈夫是否知道'},330:{chars:[H],crop:true,note:'回答不知道仍在场'},331:{chars:[],note:'拥抱转房间空镜，未使用站姿代演'},339:{chars:[],note:'早上穿衣动作不补设服装'},359:{chars:[N,'chensheng-b'],note:'两人真实路边核行李'},368:{chars:[],note:'文文走开，结束夫妻观察镜头'},397:{props:['prop-mengyao-phone-stand'],note:'录试讲支架单拍，支撑物由文字说明'},403:{chars:[],note:'相拥动作转房间景，避免站姿伪演'},407:{chars:[],note:'正在录制时接吻，留画外不复用第27天旧机构CG'},409:{chars:[N],note:'陈晟为文字消息，孟遥仍是当前现场人物'},428:{chars:[],note:'门口拥抱短暂，退出前场立绘'},439:{chars:[N,'chensheng-cable'],note:'B丈夫携电源线到场'},440:{chars:[N,'chensheng-cable'],note:'电源线交出前'},441:{chars:[N,'chensheng-cable'],note:'文文普通回应'},442:{chars:[N,'chensheng-b'],note:'电源线已交出，换普通图'},443:{chars:[N,'chensheng-b'],note:'普通晚饭安排'},444:{chars:[N,'chensheng-b'],note:'普通招呼'},445:{chars:[N,'chensheng-b'],note:'不泄露秘密以争输赢'},446:{chars:[N,'chensheng-b'],note:'拒绝送路口，丈夫仍在机构'},447:{chars:[N,'chensheng-b'],note:'只在机构告别'},489:{props:['prop-mengyao-workbook-page'],note:'旧练习册归文文，红叉页单拍'},524:{note:'AA文文收红笔，秘密关系继续；CG104只此节点'},561:{note:'断开通话最后再见，CG105电话特写仅本句；之后退出，不以CG制造重见'}};
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const needs=[{key:'my-restaurant-eaves-rain',kind:'background',action:'new',indices:range(92,103),reason:'饭店檐下撑伞不等于桥头烧饼店，当前无该场准确背景。',constraints:['与CG039饭店檐下雨景核对','不新增地点身份或店名','新图先制作/检查再补引用']},{key:'my-riverside-day',kind:'background',action:'new',indices:range(282,292),reason:'MY07=A第44天下午河边坐谈、烧饼与亲吻，资源库无明确河边背景。',constraints:['仅MY07=A；AB前史真实发生，不能按未来MY09过滤','与CG044保持河岸空间一致']},{key:'my-guiyang-elevator',kind:'background',action:'new',indices:[429],reason:'正文为离开孟遥住处的电梯；既有文文旧房走廊不能当作她的电梯。',constraints:['候选背景暂空且明确blocked，正式采用前补准确电梯或有依据的画外处置，不使用占位图','不改剧情地点']},{key:'my-rental-afternoon-light',kind:'background',action:'reuse',indices:range(491,563),existing:['bg-wenwen-bijie-rental-day'],reason:'同一白昼出租屋用于约好的下午电话，P4-03须核图片光照是否能覆盖下午；不使用晚饭/婚后场景。',constraints:['P4-03给出复用或返修理由','不把天亮衣装场景继承到下午']},{key:'huisheng-corridor-night',kind:'background',action:'new',indices:range(182,205),existing:['bg-huisheng-corridor-operating-day'],reason:'现楼道图目视有强烈白昼窗光，而本段承接回声夜间聚会并在21:25去接班，不能在室内/楼道之间错误换成白昼。',constraints:['沿用回声同一楼道空间与纸箱位置，补夜间照明','MY06选择及A/B分支均用同一夜景','新原件另存，不改现有白昼图']},{key:'my-cg040-post-kiss',kind:'cg',action:'reuse',indices:[122],existing:['cg-my-cg040'],cg:'CG040',reason:'缩略图显示教室两人近距离与支架，需P4-04核对吻后手机/夹子动作及窗外时段；CG040仅吻后这一句。',constraints:['第27天吻后，不得覆盖婚姻揭露或第75天','保留编号，不拿CG替代亲吻全过程']}];
build('MY',segments,overrides,{35:'CG038',93:'CG039',122:'CG040',130:'CG041',286:'CG044',524:'CG104',561:'CG105'},needs,'孟遥566段全读，按场景重新指定画面。MY07=A第44/56/75天的既有亲密不由未来MY09倒推；MY07=B严格无私密住处。第90/91天全部通话与消息，AA只秘密继续，AB/BA/BB断开，陈晟仍为丈夫。旧练习册归文文，借书与红笔按分支归还；CG只在精确单节点进入。跨包：LOW公共事件返回后重建楼下第38天，MY-E1直接结束；MY-E2按单身门禁进入HIGH/LOW后日谈，不把孟遥立绘带入。');
}
