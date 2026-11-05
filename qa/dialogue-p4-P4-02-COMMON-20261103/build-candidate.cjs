'use strict';
// 本批人工逐段审阅后的镜头表；只复用资源几何，不读取旧节点的演出状态。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../../tools/story-revision/p4-bindings/common.cjs');
const V=require('../../tools/story-revision/p4-bindings/validate.cjs');
const ctx=V.loadContext(), pack='P4-02-COMMON';
const out='docs/修订协作/P4-演出与美术/'+pack,qa='qa/dialogue-p4-P4-02-COMMON-20261103';
const ps=ctx.paragraphs.filter(p=>p.packageId===pack),nodes=ctx.nodes.filter(n=>n.packageId===pack);
const idx=new Map(ps.map((p,i)=>[p.paragraphId,i]));
const manifest=C.json('assets/current/manifest.json');
const old=C.json('docs/整合/bindings.json').bindings;
const geometry=new Map();for(const b of old)for(const p of V.placements(b.enter))if(!geometry.has(p.assetId))geometry.set(p.assetId,p);
const alias={ml:'maolang-base',ms:'maolang-serious',sj:'shijiang-base',ss:'shijiang-serious',xm:'char-xiaoman-base',xs:'char-xiaoman-serious',xd:'char-xiaoman-displeased',xh:'char-xiaoman-hesitant',xx:'char-xiaoman-downcast',my:'char-mengyao-human-base-neutral',mh:'char-mengyao-human-base-expression-hesitant',mm:'char-mengyao-human-base-expression-smile',zz:'char-zhouzhi-human-base',zs:'char-zhouzhi-human-serious',zl:'char-zhouzhi-human-smile',pi:'piao-base',ps:'piao-expression-serious',pl:'piao-expression-smile',pd:'piao-expression-displeased',yl:'yelan-b',ys:'yelan-serious',cn:'npc-chenniang-base',hq:'sui-a06-orb-base-v001',ha:'sui-a06-orb-amused-v001',hs:'sui-a06-orb-serious-v001'};
const bg={station:'bg-bijie-arrival-platform-day-rain',net:'bg-old-netcafe-counter-day',netn:'bg-old-netcafe-counter-night',back:'bg-old-netcafe-backroom-night',door:'bg-old-netcafe-yard-door-ajar-night',room:'bg-wenwen-bijie-rental-day',roomn:'bg-wenwen-bijie-rental-night',noodle:'bg-noodle-shop-day',dawn:'bg-noodle-shop-front-dawn',salon:'bg-salon-bijie-mirror-day',street:'bg-bijie-slope-street-day-overcast',dusk:'bg-bijie-slope-street-dusk',conv:'bg-convenience-bijie-day',corridor:'bg-huisheng-corridor-operating-day',meal:'bg-friends-meal-shop-day',meale:'bg-friends-meal-shop-evening',shaobing:'bg-bridge-shaobing-day',hqroom:'bg-huangqiuqiu-room-night'};
function placement(id,layer){id=alias[id]||bg[id]||id;const a=manifest.assets.find(a=>a.assetId===id);assert(a,'未知资源'+id);let p=geometry.get(id);if(p)p=structuredClone(p);else p={assetId:id,layer,x:0,y:0,scale:Math.max(1280/a.width,720/a.height),form:null,costume:null};p.layer=layer;if(a.type==='character'){const center=geometry.get(id);p.x=(layer==='left'?90:layer==='right'?800:445);p.y=center?.y??42;p.scale=center?.scale??0.38;p.form=center?.form??'human';p.costume=center?.costume??id;}return p;}
function state(background,chars=[]){return{background:background?placement(background,'bg'):null,characters:chars.map((c,i)=>placement(c,chars.length===1?'center':chars.length===2?(i?'right':'left'):['left','center','right'][i])),props:[],cg:null};}
const plans=[],assigned=new Map();
function span(a,z,background,chars,basis){a='T-'+a;z='T-'+z;assert(idx.has(a)&&idx.has(z),a+' / '+z);assert(idx.get(a)<=idx.get(z));const part=ps.slice(idx.get(a),idx.get(z)+1);assert(part.every(p=>p.source.file===part[0].source.file));const shot={shotId:'COMMON-S'+String(plans.length+1).padStart(3,'0'),start:a,end:z,background:bg[background]||background||null,characters:chars.map(c=>alias[c]||c),basis,paragraphIds:part.map(p=>p.paragraphId)};plans.push(shot);for(const p of part){assert(!assigned.has(p.paragraphId),'重复镜头'+p.paragraphId);assigned.set(p.paragraphId,{shot,state:state(background,chars)});}}
span('C01-000001','C01-000001','station',[],'站台接银行电话；毛狼尚未在画面出现，电话人员留在远端。');
span('C01-000243','C01-000246','station',['ml'],'毛狼踩住轮子、在旁听见逾期；银行电话不产生新现场人物。');
span('C01-000247','C01-000249','station',[],'文文走到雨棚另一头接电话，镜头离开毛狼。');
span('C01-000004','C01-000251','station',['ml'],'挂电话后毛狼递轮子、修理并抱箱；CG仅放递轮子的动作拍。');
span('C01-000008','C01-000014','street',['ml'],'两人离开站台向坡下走；轮子与箱子由正文说明，普通立绘不伪造持箱动作。');
span('C01-000015','C01-000259','net',['sj','ml'],'网吧谈班次，师匠与毛狼现场；计算器、签字、手机等动作交正文，不把旧节点动作图延长。');
span('C01-000024','C01-000042','net',['sj','ml'],'两种入职提问均在柜台；汇合后手机冲突，毛狼直到末段才离开。');
span('C01-000271','C01-000045','roomn',['cn'],'傍晚出租屋收租与送汤，陈孃现场；不把入职群像带回住处。');
span('C01-000046','C01-000054','door',[],'门只开一条缝，声源始终画外；无论选A或B都未获准进门，不显示黄球球。');
span('C01-000280','C01-000284','netn',[],'凌晨前台买面客人仅按身份画外发言，未指定其外貌，不用别的客人立绘替代。');
span('C01-000285','C01-000285','back',[],'四点后间收音机及失物播报，不把播音员或失主画到房内。');
span('C01-000057','C01-000293','dawn',['ml'],'清晨早餐店门口修轮子与道歉，毛狼现场；不是游戏语音。');
span('C01-000066','C01-000066','room',[],'六点以后回出租屋装轮子，明确清除毛狼。');
span('C01-000067','C01-000327','salon',[],'理发店小满穿工作围裙，扫发/洗手/吃包子/翻练习本动作连续；现有围裙图固定握剪刀梳子，缺空手版，人物层暂不伪用夹克或持剪差分，见开放需求。店长及朋友留画外。');
span('C01-000101','C01-000338','street',['xm'],'小满解围裙出门，电动车旁邀请被拒；恢复已确认日常夹克，头盔转交动作不延用双手持两盔图。');
span('C01-000339','C01-000341','street',[],'朋友喊慢点、车驶离，清除小满；尾灯和后悔保留空街。');
span('C01-000115','C01-000367','conv',['my'],'便利店重逢的普通会面，前女友身份不代表复合；收银员画外，布袋与水瓶只在CG005动作拍表现。');
span('C01-000151','C01-000151','conv',[],'孟遥已离开，文文门口记日历；清除孟遥。');
span('C01-000368','C01-000164',null,[],'线上组队语音及截图，不明确文文所在室内地点；使用阅读底图，叶岚/师匠/毛狼均为远程，CG006仅游戏画面拍。');
span('C01-000165','C01-000182','noodle',['ml','zz'],'面馆毛狼与周栀同桌；周栀当场接电话仍是现场，来电客人不出立绘。');
span('C01-000404','C01-000405','street',['zz'],'吃完送周栀，下坡方向转场；不把面馆毛狼带去回声。');
span('C01-000184','C01-000188','corridor',['zz'],'回声楼梯入口周栀接待客人；文文仍在门外，不能切到306包间。');
span('C01-000411','C01-000420','meale',['pi'],'第七天飘先到饭桌，册子尚未定稿；只用空手基础形象，不能用HIGH34/39专用册子动作图。');
span('C01-000421','C01-000224','meale',['pi','ml'],'毛狼入场；拍照前征求同意，A翻到允许页，B删图并收未核页。不得跨分支继承错误册页。');
span('C01-000225','C01-000457','netn',[],'柜台拆通知并看小满消息，远端小满不在场。');
span('C01-000228','C01-000460','netn',['sj'],'师匠捡照片并问换班；只显示当场师匠。');
span('C01-000235','C01-000466','netn',[],'师匠走回里间；文文读历史群聊，毛狼只是旧消息。');
span('C01-000238','C01-000242','back',[],'拿水后回后间读通知，后院敲门只作声音；不提前显示黄球球。');
span('C02-000001','C02-000016',null,[],'上班前后院门关得严；已有夜景半开门与正文冲突，暂用阅读底图并列关门夜景需求。门内声音不显形。');
span('C02-000266','C02-000268','netn',['sj'],'B分支返回柜台数饮料，师匠当面提问；不继续后院声源。');
span('C02-000269','C02-000032','net',['sj'],'第九天谈续租与班表；量尺来人只按画外身份处理，不能当作朋友线第60天交接人。');
span('C02-000278','C02-000042','net',['ml'],'毛狼带奶茶、约看演出；师匠暂在后面，镜头集中于毛狼。');
span('C02-000043','C02-000043','net',['sj'],'师匠出来递烟，毛狼接后离开，本段结束清除毛狼。');
span('C02-000044','C02-000318','shaobing',['my'],'烧饼店傍晚重逢；含查看刚才消息但孟遥确实坐在眼前。红笔/作业留文字动作，不套持相机或陌生册页。日景时段适配另列复验。');
span('C02-000081','C02-000081','street',[],'孟遥往学校走，文文目送，现场立绘退出。');
span('C02-000082','C02-000089','netn',['sj'],'夜班忙碌，师匠当场换座；毛狼/叶岚仅群聊，孟遥为下午旧消息。');
span('C02-000332','C02-000101',null,[],'第11至12天群聊、转发语音和照片；无明确收信地点，不把离行的人聚成现场。');
span('C02-000102','C02-000109','street',['ml'],'第十一天网吧门外毛狼等飘；她尚未到场。');
span('C02-000361','C02-000384','street',['ml','pi'],'飘到门边，自己决定赴约；两种选项均不能让文文替她答应。');
span('C02-000123','C02-000123','net',[],'两人离开，文文回柜台拿东西，清场。');
span('C02-000385','C02-000386',null,[],'毛狼消息约饭及次日转场，尚未进入面馆实景。');
span('C02-000125','C02-000125','noodle',['ml'],'叶岚在门口接电话，镜头留毛狼已占的桌；叶岚坐下才进入主画面。');
span('C02-000387','C02-000137','noodle',['ml','yl'],'叶岚第一次线下见面，普通队友；无攻略语义或专属亲密道具。');
span('C02-000138','C02-000407','street',['ml','yl'],'饭后门外等雨、确认车次，借普通阴雨街景，不把门口谈话继续摆在餐桌。');
span('C02-000408','C02-000408','street',[],'叶岚去站台、毛狼取线、文文返网吧，本段收束清空人物。');
span('C02-000409','C02-000417','net',[],'返回后看餐巾纸群图，三人不在同桌。');
span('C02-000145','C02-000149','room',['cn'],'陈孃来查漏水，现场只有房东；扳手不等于催租道具。');
span('C02-000150','C02-000150','room',[],'陈孃下楼，文文独自重新算账。');
span('C02-000151','C02-000419','meale',['ml'],'文文提前到第14天饭店，毛狼先到；叶岚已说明不参加，孟遥尚未到。');
span('C02-000153','C02-000424','meale',['xm','pi','ml'],'小满、飘先到，镜头取三人；唯一双页段完整画面一致，周栀可处画外，孟遥尚未到。');
span('C02-000425','C02-000197','meale',['xm','pi','zz'],'聚餐主体镜头是小满/飘/周栀，毛狼对话单拍另定；孟遥直到明确赶到后才切入，叶岚不入镜。');
span('C02-000198','C02-000204','meale',['xm','pi','zz'],'A说明欠款与B承认没弄明白都在同一饭局；返回公共段保持实际到场，不替文文还款。');
span('C02-000472','C02-000474','meale',['ml'],'饭后转账及毛狼回应，转为毛狼单人收束镜头。');
span('C02-000207','C02-000483','street',['xs'],'饭店外小满问是否还隐瞒；已经失望，不借递头盔恢复亲密，头盔只由她自己戴。');
span('C02-000214','C02-000214','dusk',[],'车灯远去，清除小满；不在独白中残留邀请姿态。');
span('C02-000484','C02-000221',null,[],'14天20:30先敲门、等报名字与允许进入；门未开严禁显示球形，门夜景待补。');
span('C02-000487','C02-000507','hqroom',['hq'],'明确推门后才首次显示球形；仍24岁成年女性，无手机，无人形，不扩展来历。');
span('C02-000244','C02-000244',null,[],'文文已在门外等合门，黄球球退场；关门夜景待补。');
span('C02-000245','C02-000518',null,[],'深夜看班表和飘消息；无明确地点，阅读底图，不继承黄球球房间与球形。');
span('C03-000001','C03-000039','room',[],'选线前在出租屋看钥匙和手机；六个远程邀请无现场女主，选择本身不改变好感或关系。个别出门段另切街景。');
span('C03-000017','C03-000018',null,[],'隐藏线邀请来到后院敲门，未回答前不显黄球球，不拿夜景替下午，列闭门日景复核。');
span('D36-000001','D36-000015','noodle',[],'五条非飘线LOW公共事件在面馆门外凳子坐谈；已目视日景包含门外凳子，可作门口背景；站姿飘不匹配，坐姿资源仍待交付。');
span('D36-000016','D36-000033','noodle',['ml'],'毛狼走来并站在桌边，飘仍坐着；文文发消息给远端师匠不带入师匠，缺坐姿飘待制作。');
span('D36-000034','D36-000040','noodle',[],'毛狼接电话走开，飘仍坐着；文文拎饭离开。CG101现图站姿需返修，群里邀约不构成新聚会。');
span('EPH-000001','EPH-000068',null,[],'HIGH后日谈分手回顾、半年后邀请及群聊；FR-E2全部消息视角，不借群图恢复现场关系。');
span('EPH-000069','EPH-000078','meal',['pi','ml'],'非FR-E2明确饭桌碰面；转述另一次晚饭仅作回忆，手机旧消息单拍另清人物，不能当成新的实时约会。');
span('EPH-000079','EPH-000097',null,[],'确认恋爱、第二年擅报人数及撤回均为群聊；没有婚礼现场。');
span('EPH-000098','EPH-000102','meal',['pi','ml'],'非FR-E2再见面讲争执，沿已确认普通饭店，不把争执演成亲密和解奖励。');
span('EPH-000103','EPH-000113',null,[],'她另约小店与后来群里统计，文文只知道转述/消息；不越过叙述视角描画私人约会。');
span('EPH-000027','EPH-000141','meal',['pi','ml'],'非FR-E2婚后第一顿朋友饭，飘普通衣装、册子仍有未改页；没有礼裙/黄球球/自动全员到场。');
span('EPH-000142','EPH-000041',null,[],'FR-E2只读婚讯与群中日常，绝不赴饭局；CG100仅手机消息特写，禁止借照片补未知现场。');
span('EPL-000015','EPL-000019',null,[],'LOW第91天后群里课程照片，无现场相聚或确认婚姻。');
span('EPL-000020','EPL-000045','meal',['pi','ml'],'非FR-E2当面吃饭与商量安排；是否伴侣仍未定，不画婚礼、孩子外貌或医疗结果。包带非衣角，拒绝拍摄者留画外。');
span('EPL-000011','EPL-000054',null,[],'FR-E2仅看群照及简短回复；不参加吃饭，不打听检查，不披露D36私事，不恢复旧友情。');
assert.equal(assigned.size,ps.length,'有未逐段审定的镜头：'+ps.filter(p=>!assigned.has(p.paragraphId)).map(p=>p.paragraphId+':'+p.text).join('\n'));
const overrides=[];
function patch(a,z,background,chars,basis){a='T-'+a;z='T-'+z;const ids=ps.slice(idx.get(a),idx.get(z)+1).map(p=>p.paragraphId);assert(ids.length);for(const id of ids){const d=assigned.get(id);d.state=state(background,chars);d.override=basis;}overrides.push({start:a,end:z,background:bg[background]||background||null,characters:chars.map(c=>alias[c]||c),basis,paragraphIds:ids});}
patch('C01-000336','C01-000337','street',['xh'],'拒绝同行后笑停住，改犹豫差分而非欢快。');
patch('C01-000355','C01-000356','conv',['mm'],'孟遥明确笑了，短拍微笑；下一段恢复普通态。');
patch('C01-000432','C01-000437','meale',['pd','ml'],'B擅拍后飘按住本子、等待删图，短段不悦；公共段恢复日常。');
patch('C02-000425','C02-000160','meale',['ml','pi','zz'],'周栀与毛狼开玩笑，转三人群像，不让尚未到场的孟遥出现。');
patch('C02-000427','C02-000175','meale',['xm','ml','zz'],'乔迁饭和拍卖说明主要面对毛狼与小满；CG011只在明确说出拍卖一拍。');
patch('C02-000446','C02-000180','meale',['xd','pi','zz'],'小满发现谎话后不悦，飘递纸巾；未让角色提前知道欠款。');
patch('C02-000458','C02-000463','meale',['my','pi','zz'],'孟遥到达后才显示，前文不提前出场；不拿纸笔替文文处理债务。');
patch('C02-000193','C02-000194','meale',['my','pi'],'周栀走到门口接电话，镜头留饭桌其他人；当面听到的声音不变远端立绘。');
patch('C02-000464','C02-000197','meale',['my','pi','zz'],'周栀回来，恢复普通表情；不是接客时笑容延续到欠款谈话。');
patch('C02-000198','C02-000200','meale',['ml','pi','zz'],'A说明欠款，毛狼回答，现场关注转到毛狼。');
patch('C02-000498','C02-000498','hqroom',['ha'],'黄球球自己先笑，仅一拍球形笑差分。');
patch('C03-000008','C03-000008','street',[],'收手机下坡，未进入小满店，不提前显示女主。');
patch('C03-000027','C03-000027','street',[],'沿坡去回声，周栀仍不在现场。');
patch('C03-000035','C03-000035','net',[],'下楼经过柜台拿袋子，尚未与飘碰面。');
patch('EPH-000075','EPH-000077',null,[],'正在翻给文文看的旧消息单拍，以阅读底图切明媒介，不把远程约饭演成当场发生。');
patch('EPH-000078','EPH-000078',null,[],'另一次约饭的转述收尾，文文未确认亲历，不把它接成现在的同桌。');
patch('EPH-000127','EPH-000127','meal',['pi'],'毛狼起身找店员拿纸巾，临时离开；下一句回来再显示。');
patch('EPH-000130','EPH-000131','meal',['pl','ml'],'婚后饭桌明确笑，短拍微笑，不增加亲密动作。');
patch('EPL-000035','EPL-000036','meal',['pl','ml'],'飘笑毛狼没有抢答，不意味着确定伴侣关系。');
// 坐谈用胸像构图：保留已确认的脸/上衣，下肢与坐姿动作均在画外。
// 不把既有站姿全身拼到饭桌前，也不据此宣称已制作坐姿差分。
const mealBackgrounds=new Set([bg.noodle,bg.meal,bg.meale,bg.dawn,bg.shaobing]);
for(const d of assigned.values()){
 if(mealBackgrounds.has(d.state.background?.assetId)){
  const count=d.state.characters.length;
  d.state.characters.forEach((p,i)=>{const a=manifest.assets.find(a=>a.assetId===p.assetId),cx=count===1?640:count===2?(i?970:310):[220,640,1060][i];p.scale=.85;p.x=Math.round(cx-a.width*.85/2);p.y=25;});
  d.framing='坐谈按肩胸近景显示，固定站姿图的下肢及手持动作置于画外；具体触物动作只由正文/相应CG承担，须P4-05检查裁切与阅读框。';
 }
 if(d.state.characters.some(p=>p.form==='orb'))for(const p of d.state.characters){p.x=630;p.y=195;}
}
// 每个CG只占新文的一个明确动作拍。101已发现姿态冲突，不用已知错图冒充完成。
const cgs={'C01-000004':'CG001','C01-000306':'CG004','C01-000135':'CG005','C01-000372':'CG006','C01-000173':'CG007','C01-000414':'CG008','C02-000367':'CG010','C02-000170':'CG011','C02-000487':'CG012','EPH-000072':'CG095','EPH-000027':'CG099','EPH-000144':'CG100','EPL-000025':'CG096','EPL-000038':'CG098'};
for(const [id,cgId]of Object.entries(cgs)){const d=assigned.get('T-'+id);d.state.cg=placement(ctx.baseline.cg.find(c=>c.cgId===cgId).assetId,'cg');d.cgId=cgId;}
const needs=[];
function need(key,kind,action,ids,reason,existing=[]){ids=ids.map(id=>id.startsWith('T-')?id:'T-'+id);const n={needId:pack+'-N'+String(needs.length+1).padStart(3,'0'),resourceKey:key,kind,action,ownerTask:kind==='cg'?'P4-04':'P4-03',nodeIds:ids.flatMap(id=>ctx.paragraphs.find(p=>p.paragraphId===id).nodeIds),reason,constraints:['按列出的P3稳定段落及其冻结条件制作；不得改台词迁就图片','检查实际站坐、衣装、持物及显示时段；资源回交后由P4-05复验'],existingAssetIds:existing,proposedAssetId:null,cgId:kind==='cg'?key.match(/CG\d{3}/)?.[0]||null:null,status:'open',resolution:null};needs.push(n);return n;}
function idsBetween(a,z){return ps.slice(idx.get('T-'+a),idx.get('T-'+z)+1).map(p=>p.paragraphId);}
need('xiaoman-work-apron-empty-hands','character','new',idsBetween('C01-000067','C01-000323'),'围裙职业形象需空手版，现图固定持剪刀/梳子与扫地、吃包子、摊本、洗手不兼容。保持已确认服装与外形，动作道具由正文/单拍CG承担。',['char-xiaoman-work-apron']);
need('old-netcafe-yard-door-closed-night','background','new',[...idsBetween('C02-000001','C02-000016'),...idsBetween('C02-000484','C02-000221'),'T-C02-000244'],'第8天上班前门关严，第14天晚间未获允许前及离场合门均不能复用门半开夜图。',['bg-old-netcafe-yard-door-ajar-night','bg-old-netcafe-yard-door-closed-morning']);
need('old-netcafe-yard-door-closed-afternoon','background','reuse',['C03-000017','C03-000018'],'第三章下午隐藏线敲门；请复核既有闭门晨景能否作为不强调时段的日景；不通过则制作闭门下午衍生。',['bg-old-netcafe-yard-door-closed-morning']);
need('noodle-shop-front-day-seated','background','reuse',idsBetween('D36-000001','D36-000040'),'公共事件坐在面馆门口凳子，本轮实际目视日景有门外空凳、台阶及门框，可复用；不追加钟点。',['bg-noodle-shop-day','bg-noodle-shop-front-dawn']);
need('piao-seated-base-common-d36','character','new',idsBetween('D36-000001','D36-000037'),'飘从开场至文文拎饭仍坐在门口；现有相机/包带动作图为站姿。需既定白衬衫坐姿安全截幅，不补孕期外貌、孕周及身体变化。',['piao-base','piao-action-knot']);
need('CG101','cg','repair',['D36-000034'],'接电话走开与写下次课日期才与现图动作最接近，但缩略目视见文文和飘站姿，与该拍仍坐着的正文冲突。保持LOW五线公共事件，重构坐姿文文/飘与稍远处毛狼，修好后才绑定。',['cg-common-cg101']);
need('CG001-reading-contrast','cg','reuse',['C01-000004'],'本批缩略图确认递轮子动作，P0-18文字对比/遮挡仍需P4-04在完整图和实际阅读框叠加下复核，不能用缩略图关闭。',['cg-common-cg001']);
need('bridge-shaobing-dusk','background','reuse',idsBetween('C02-000044','C02-000318'),'明确六点四十七到七点十分的傍晚会面；现有day背景需P4-03目视适用性判断，不能因旧绑定用过就视为时段通过。',['bg-bridge-shaobing-day']);
const reusedBackground=needs.find(n=>n.resourceKey==='noodle-shop-front-day-seated');reusedBackground.status='resolved';reusedBackground.proposedAssetId='bg-noodle-shop-day';reusedBackground.resolution={assetId:'bg-noodle-shop-day',reason:'本轮完整图目视确认门外构图，复用既有背景；P4-05资源复验仍待完成。',evidence:[{path:qa+'/visual-observations.json',sha256:C.fp(qa+'/visual-observations.json').sha256}]};
const cgLedger=ctx.baseline.cg.filter(c=>c.assetId.startsWith('cg-common-')).map(c=>({cgId:c.cgId,assetId:c.assetId,selectedParagraphId:Object.keys(cgs).find(id=>cgs[id]===c.cgId)?'T-'+Object.keys(cgs).find(id=>cgs[id]===c.cgId):null,decision:c.cgId==='CG101'?'repair-before-binding':'candidate-reuse-pending-P4-04-and-05',basis:c.cgId==='CG101'?'缩略图站姿与正文坐姿不合，改在拿小本子拍返修。':'逐段定位单一动作/媒介拍；缩略图仅用于镜头筛选，不是资源完整复验。'}));
const head=C.envelope(pack,ctx.input.inputFingerprint);
const bindings=[],reviews=[];
for(const p of ps){const d=assigned.get(p.paragraphId);const ns=needs.filter(n=>n.nodeIds.some(id=>p.nodeIds.includes(id)));const open=ns.filter(n=>n.status==='open');const unresolved=open.map(n=>n.needId+': '+n.reason);const neutral=V.placements(d.state).length===0;reviews.push({unitId:p.paragraphId,nodeIds:p.nodeIds,status:open.length?'blocked':'reviewed',decision:open.some(n=>n.action==='new'||n.action==='repair')?'new-art':neutral?'neutral':'rebind',basis:`${d.shot.shotId}；本段「${p.text}」；${d.override||d.shot.basis} ${d.framing||''} 姓名/媒介取冻结TEXT(${p.textMeta.kind}/${p.textMeta.channel})；背景、人物与道具完整赋值，下一节点重新计算。`,needIds:ns.map(n=>n.needId),unresolved});for(const id of p.nodeIds){const n=ctx.byNode.get(id),enter=structuredClone(d.state),restore={...structuredClone(enter),cg:null};bindings.push({nodeId:id,binding:{bindingId:'p4-'+id,anchor:{nodeId:id,file:n.source.file,sha256:n.source.sha256},condition:n.condition,routeIds:n.routeIds,enter,exit:{at:'next-node',restore},cgId:d.cgId||null,fullView:!!d.cgId,restrictions:[d.override||d.shot.basis,d.framing||'按本段经审定的基础形象与完整画面。','进入、回退、读档、改选都按目标节点完整重建；CG退出先去CG，不继承另一分支画面',...(open.length?['候选含开放需求，未达到最终可采用状态']:[])]}});}}
// 选择镜头按本次人工审定的前文场景构造，清CG；第三章选线始终在住处。
for(const [i,n] of nodes.entries())if(n.op==='choice'){const previous=nodes.slice(0,i).reverse().find(x=>x.op==='text'&&x.source.file===n.source.file),d=assigned.get(previous.paragraphId),enter={...structuredClone(d.state),cg:null};bindings.push({nodeId:n.nodeId,binding:{bindingId:'p4-'+n.nodeId,anchor:{nodeId:n.nodeId,file:n.source.file,sha256:n.source.sha256},condition:n.condition,routeIds:n.routeIds,enter,exit:{at:'next-node',restore:structuredClone(enter)},cgId:null,fullView:false,restrictions:['选择清姓名与CG，保留本次审阅的当场构图；选择结果按目标页重算。',d.shot.basis]}});reviews.push({unitId:n.nodeId,nodeIds:[n.nodeId],status:'reviewed',decision:V.placements(enter).length?'rebind':'neutral',basis:`选择${n.nodeId}在${previous.paragraphId}之后：${d.shot.basis} 保留已审场景，清姓名/CG，不提前展示任一选项结果；选项文案和门禁逐字保留。`,needIds:[],unresolved:[]});}
// 同一场景的缺图同时影响选择停留画面，不能只给正文登记依赖。
for(const [i,n] of nodes.entries())if(n.op==='choice'){
 const prev=nodes.slice(0,i).reverse().find(x=>x.op==='text'&&x.source.file===n.source.file);
 const ns=needs.filter(x=>x.status==='open'&&x.kind!=='cg'&&x.nodeIds.includes(prev.nodeId));
 if(ns.length){const r=reviews.find(x=>x.unitId===n.nodeId);r.status='blocked';r.needIds=ns.map(x=>x.needId);r.unresolved=ns.map(x=>x.needId+': '+x.reason);if(ns.some(x=>x.action==='new'||x.action==='repair'))r.decision='new-art';for(const need of ns)need.nodeIds.push(n.nodeId);}
}
bindings.sort((a,b)=>nodes.findIndex(n=>n.nodeId===a.nodeId)-nodes.findIndex(n=>n.nodeId===b.nodeId));
const policies={
 'file-entry':'先清源包所有层，再按本文件第一个实际可达显示节点重建。公共事件只从五线LOW合法CALL进入；双后日谈先按单身/关系值/已读事件规则分派。',
 'choice':'进入选择清姓名、CG与全图模式；改选不继承前一次结果或选项分支中的道具。',
 'branch':'只按冻结条件选择目标，不把目标集合中的互斥分支同时显示；未获黄球球门禁时不能显球形。',
 'branch-merge':'合流后按目的段完整画面重建，清除A/B独有道具与表情；不把异地/消息人物带到现场。',
 'finish':'章节结束后清场，第三章分派由目的路线独占。最终结束清除人物、CG，不留婚后饭桌。',
 'event':'公共事件已读/黄球球相识等规则仅依正文控制流，演出不另写状态或改变事件结果。',
 'freeze':'关系HIGH/LOW沿正文在共通结束冻结，不由角色图或选择外观推断；目的节点重建。',
 'return':'D36只回当前调用路线的登记RETURN；先清飘/毛狼/门口/CG，不把坐谈状态带回各线。五个目标是合法返回集合，不是五个同时发生的出口。',
 'pagination':'T-C02-000153两页使用相同完整画面与TEXT姓名/媒介；分页不额外换表情或解锁CG。'};
const boundaries=ctx.boundaries.filter(b=>b.packageId===pack).map(b=>({boundaryId:b.boundaryId,status:'reviewed',exitPolicy:'clear-before-target',restorePolicy:'recompute-destination',basis:`${b.kind}：${b.fromNodeId||'文件外'} → ${b.targetNodeIds.join(' / ')}；${policies[b.kind]||'按冻结控制流到目标页重建，不保存来源画面。'} FR-E2后日谈只读消息；六种仍维持恋爱的结局直接结束。`,unresolved:[]}));
function write(file,x){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');}
for(const [file,data]of Object.entries({'bindings.candidate.json':{...head,bindings},'review.json':{...head,reviews},'needs.json':{...head,needs},'boundary-states.json':{...head,boundaries},'shot-decisions.json':{inputFingerprint:ctx.input.inputFingerprint,interfaceFingerprint:ctx.seal.interfaceFingerprint,method:'997段逐段通读后人工镜头表；旧绑定只提取资源几何，不继承状态',plans,overrides},'cg-decisions.json':cgLedger}))write(out+'/'+file,data);
const docs=V.readPackage(out),res=V.validatePack(ctx,pack,docs,{mode:'draft'});write(qa+'/draft-validation.json',res);
let err;try{V.validatePack(ctx,pack,docs,{mode:'handoff'});}catch(e){err=e.message;}assert(err,'不应把未复验资源当作交接通过');write(qa+'/handoff-blockers.json',{handoffReady:false,firstFailure:err,openNeeds:needs.filter(n=>n.status==='open').map(n=>n.needId),pendingResources:[...new Set(bindings.flatMap(b=>V.placements(b.binding.enter).map(p=>p.assetId)))],runtimeTested:false});
write(qa+'/input-and-output-fingerprints.json',{inputFingerprint:ctx.input.inputFingerprint,interfaceFingerprint:ctx.seal.interfaceFingerprint,contentBuildId:ctx.input.contentBuildId,outputs:fs.readdirSync(out).filter(f=>/\.(json|md)$/.test(f)).map(f=>C.fp(out+'/'+f)),generator:C.fp(qa+'/build-candidate.cjs')});
console.log(JSON.stringify({...res,openNeeds:needs.filter(n=>n.status==='open').length,reviewed:reviews.filter(r=>r.status==='reviewed').length,blocked:reviews.filter(r=>r.status==='blocked').length,shots:plans.length,overrides:overrides.length}));
