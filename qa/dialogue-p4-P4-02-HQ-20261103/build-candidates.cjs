'use strict';
// 本批自有工具：镜头分段由逐段通读后手工写定；不读取旧节点绑定。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');process.chdir(ROOT);
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D='docs/修订协作/P4-演出与美术',F=D+'/P4-01';
const allP=read(F+'/paragraph-map.json').paragraphs,allN=read(F+'/node-map.json').nodes,allB=read(F+'/boundaries.json').boundaries;
const manifest=read('assets/current/manifest.json').assets, byAsset=new Map(manifest.map(a=>[a.assetId,a]));
const input=read(F+'/input-manifest.json'),seal=read(F+'/freeze.json');
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n')};
const B={room:'bg-huangqiuqiu-room-day',roomN:'bg-huangqiuqiu-room-night',yard:'bg-old-netcafe-yard-door-open-afternoon',closed:'bg-old-netcafe-yard-door-closed-morning',counter:'bg-old-netcafe-counter-day',counterN:'bg-old-netcafe-counter-night',rental:'bg-wenwen-bijie-rental-day',rentalN:'bg-wenwen-bijie-rental-night',venue:'bg-huisheng-306-operating-night',stage:'bg-performance-mall-side-stage-day',rehearsal:'bg-performance-rehearsal-rain-day',clearing:'bg-old-netcafe-counter-fr-clearing-day',handover:'bg-old-netcafe-counter-fr-handover-day',back:'bg-old-netcafe-backroom-night',newD:'bg-new-netcafe-counter-day',newN:'bg-new-netcafe-counter-night',newEntrance:'bg-new-netcafe-entrance-night',milk:'bg-old-netcafe-milk-tea-fr-day91',bus:'bg-bus-stop-bijie-stop-day',home:'bg-wenwen-guiyang-home-day',homeDoor:'bg-wenwen-guiyang-home-corridor-day',photo:'bg-photo-print-shop-day'};
const C={orb:'sui-a06-orb-base-v001',orbS:'sui-a06-orb-serious-v001',orbA:'sui-a06-orb-amused-v001',orbD:'sui-a06-orb-downcast-v001',orbW:'sui-a06-orb-wave-v001',human:'sui-a06-human-neutral-v001',humanS:'sui-a06-human-serious-v001',humanD:'sui-a06-human-downcast-v001',humanT:'sui-a06-human-tearful-v001',humanC:'sui-a06-human-chin-v001',humanToy:'sui-a06-human-toy-base-v001',ml:'maolang-base',mlS:'maolang-serious',mlStage:'maolang-stage',mlBag:'maolang-mic-bag',sj:'shijiang-base',sjS:'shijiang-serious',sjCalc:'shijiang-calculator',piao:'piao-base',piaoS:'piao-expression-serious',zz:'char-zhouzhi-human-work-neutral',sign:'npc-sign-repairer-base',classmate:'npc-classmate-base',boss:'npc-boss-li-base',customer:'npc-cafe-customer-base',colleague:'npc-cafe-colleague-base',key:'npc-key-handover-base'};
function placement(key,layer){const assetId=B[key]||C[key]||key,a=byAsset.get(assetId);assert(a,assetId);let scale,x,y,form=null,costume=null;if(a.type==='character'){const orb=assetId.includes('-orb-');scale=orb?.24:.38;const centers={left:340,center:640,right:940};x=Math.round(centers[layer]-a.width*scale/2);y=orb?210:42;form=orb?'orb':'human';costume=assetId;}else{scale=Math.min(1280/a.width,720/a.height);x=0;y=0;}return{assetId,layer,x,y,scale,form,costume};}
function state(bg,chars=[],cg=null){return{background:bg?placement(bg,'bg'):null,characters:chars.map((c,i)=>placement(c,chars.length===1?'center':['left','right','center'][i])),props:[],cg:cg?placement(cg,'cg'):null};}
const H=[],R=[];
const shot=(arr,start,end,bg,chars,basis,extra={})=>arr.push({start,end,bg,chars,basis,...extra});
// HQ：门内/门外、回忆及来访日逐段审定；索引只用于本批输入编写，导出后以稳定ID和指纹追溯。
shot(H,0,2,'counter',['sign'],'修招牌的人在前厅询问；黄球球尚在门内，不能因谈及她而显形。');
shot(H,3,6,'closed',[],'视点在未开的侧门外；只听见杯声和画外答话，黄球球不可见。');
shot(H,7,23,'room',['orbS'],'门已开后在矮桌旁谈失言和隐私；球形认真差分，修招牌的人留在屋外。杯子和水龙头以正文叙述，不添加独立道具层。');
shot(H,24,30,'room',['orbA'],'橘子与收音机让气氛缓和；球形笑意只从剥橘子这拍开始，手中橘子留在叙述。');
shot(H,31,35,'counter',['sign'],'第18天前厅收线，公众来访不展示球球。');
shot(H,36,43,'roomN',['orb'],'夜间开门后并排放杯、写名；球形普通交流，杯底文字由正文承载，CG073只在递笔写名当拍。');
shot(H,44,51,'room',['orbA'],'第22天白昼窗边谈天空与酸橘；日常球形，不把所述街道当作当前地点。');
shot(H,52,54,'room',['orbS'],'傍晚站在门内犹豫，先保留室内视点；A项由她自己推门，不提前画出走远。');
shot(H,55,56,'yard',['orbS'],'A项仅进入无人后院片刻，球形不进公共街道；扶门后下一拍回屋。');
shot(H,57,61,'room',['orb'],'A项已回屋谈墙角白花，不把花或街景当当前位置。');
shot(H,62,75,'room',['orbA'],'B项听文文手机录音，汇合后一起看花照；手机属于文文，不赋予黄球球手机通信。');
shot(H,76,78,'room',['orbS'],'第27天电话震动发生在屋内；她在场，但尚未替文文接听。');
shot(H,79,'79','yard',[],'文文到门外核材料并蹲墙边；球球与电话另一端均不在画面。');
shot(H,80,109,'room',['orbS'],'重新进屋后谈房子和工作；文件袋留在膝上叙述，电话对方无现场立绘。');
shot(H,110,120,'room',['orb'],'第29天按纸条入内商量两份饭，恢复球形普通交流；手机待办仍是文文的。');
shot(H,121,124,'venue',['ml'],'第30天回声现场毛狼拉住文文；提到下午球球不让她进入酒吧画面。');
shot(H,125,127,null,[],'承接“我想起下午”的黄球球原话为回忆插入；暂用阅读底图隔开时间层，不把她画到回声现场。');
shot(H,128,141,'venue',['ml'],'两种介绍选择均只和毛狼当面谈；不公开球球住处或形态。');
shot(H,142,148,'venue',['ml','piao'],'飘拿演出单来与毛狼核散场安排；她是现场人物，黄球球未到场。');
shot(H,149,151,'venue',['ml'],'周栀此刻尚在楼上结账，暂不进镜；提醒响后毛狼留人。');
shot(H,152,155,'venue',['ml','zz'],'周栀下楼后碰杯合照、抬饮料；群像取毛狼与周栀，未逐一确认的聚餐者留画外。球球仅在文文想法中。');
shot(H,156,null,null,[],'从小吃摊跑向后院的跨地点叙述，不补造摊位地点与老板形象。');
shot(H,157,181,null,[],'九点以后门一直未开；必须使用关门夜景，现有半开夜门不能表现拒绝进入。人物均不展示。',{gap:'closedNight'});
shot(H,182,null,'counterN',[],'接班后独自吃掉两份饭，球球没有手机，不能放远程球球图。');
shot(H,183,184,'closed',[],'第31天下班后在门边留下/收到纸条，未见面不显示球球；时段跨越采用关门近景待复验光线。');
shot(H,185,197,'room',['orbS'],'第34天五点已开门，谈迟到与扫兴；认真球形，五点半按她要求结束，不表现和解拥抱。');
shot(H,198,202,'room',['orbS'],'第36天返回路线时明确重建矮桌室内球形；COMMON消息人物、背景、CG全部清掉。');
shot(H,203,null,null,[],'多日留纸及回出租屋睡觉的概述无单一现场；不将拒见日画成已经进屋。');
shot(H,204,205,'room',['orbA'],'第40天共同调收音机、笑出声，球形日常；收音机不复制成新道具层。');
shot(H,206,221,'room',['orbS'],'第42天提出尝试另一种样子，仍为球形；不画变身触发器或提前换人形。');
shot(H,222,null,'room',['orb'],'第44天现场交纸条，预约第45天和第55天；手机归文文，球球仍球形。');
shot(H,223,228,null,[],'睡醒接师匠电话、算账，文本未指定所在房间；远程师匠留画外，电话选择不预先生成赴约场景。');
shot(H,229,null,'yard',[],'四点五十七到院里等五点敲门，尚未开门不展示球球。');
shot(H,230,240,'room',['orbA'],'A按时赴约后一起吃饭，伸小手发生在球形；照片是师匠发给文文，远程师匠不入镜。');
shot(H,241,null,null,[],'B先在电话答应临时工，尚未走到柜台，不沿用A的屋内画面。');
shot(H,242,244,'counter',['sjS'],'B在柜台核货、拿工钱，师匠现场指导；球球没有在柜台等待。');
shot(H,245,257,null,[],'B七点多后院闭门对话，黄球球只有画外声；不可套用半开门夜图。',{gap:'closedNight'});
shot(H,258,267,'room',['orbS'],'第47天球球主动写第55天预约，仍球形；选择不是变身条件。');
shot(H,268,null,'yard',['orbW'],'离开时她在门边抬小手，镜头只在未关门的挥手这一拍；结束后清球形。');
shot(H,269,null,'yard',[],'第55天下午到院等待五点；开门前无球形也无人形。');
shot(H,270,274,'yard',['humanToy'],'第55天五点开门才首次人形，保留照片已确认的外套、眼片与玩偶棒，仅上身裁切，不补下装。');
shot(H,275,284,'room',['human'],'入屋后普通交流及握手使用空手人形；玩偶棒无持续持有依据，不延续持棒。');
shot(H,285,296,'room',['human'],'第57天擦外套与接吻为当面动作；基础立绘只作交流近景，接吻动作由CG079单拍承接，不把站姿当动作全景。');
shot(H,297,310,'roomN',['human'],'明确休班的夜间亲近，空手人形、屋内夜景；不新增裸露衣装或未确认下装，双方回应由文字承载。');
shot(H,311,315,'room',[],'清晨同躺与早餐的近距离主观镜头，不用直立肖像伪装躺姿；背景与文字保留，人形未退回球形。');
shot(H,316,321,'closed',['humanS'],'第60天试在无人后院吃早饭，身体仍停门槛与门框；现有关闭晨门不适合开门扶框，需开门晨景。',{gap:'openMorning'});
shot(H,322,342,'room',['humanD'],'回屋后仍人形，关于能否出门的争执与眼红；杯子在门外不自动成为球形角色。');
shot(H,343,357,'room',['humanS'],'HQ08选A承认限制；只有HQ07也A才有接手贴脸，普通认真肖像作对话，身体接触留文字不借用其他分支CG。');
shot(H,358,366,'room',['humanT'],'BA她流泪且不许靠近；人形泪差分，不显示拥抱或把迟来的愿望当恢复恋爱。');
shot(H,367,378,'room',['humanD'],'HQ08选B明确不能继续；维持人形低落，不以外形退回球形惩罚选择。');
shot(H,379,380,'room',[],'AB告别拥抱的贴近镜头不放直立肖像；只保留背景文字，不使用AA亲密CG。');
shot(H,381,390,'room',['humanD'],'BB收纸及汇合后的冷早餐、独处两天约定，均人形；桌上黄色小球是普通道具。');
shot(H,391,null,'yard',[],'文文已经走出后院，人物清除，不把掌心回忆变成她在场。');
shot(H,392,null,'rental',[],'第61天依约留出租屋洗饭盒；不见球球。');
shot(H,393,null,null,[],'第62晚到第63清晨的闭门纸条时间蒙太奇；不合并成现场会面，关门图多时段需求。',{gap:'closedNight'});
shot(H,394,399,'room',['human'],'第63天她准时开门仍人形；AA重新约定并询问接吻意愿。');
shot(H,400,402,'room',[],'AA嘴角接吻和沙发依靠的主观近镜，不以直立图冒充动作；她仍人形，P4-04可评估是否需要结尾补镜。');
shot(H,403,413,'room',['humanD'],'非AA第63天明确分开、杯子移开；不重复AA亲密镜头，不把留纸取物当约会。');
shot(H,414,null,'homeDoor',[],'第75天贵阳交钥匙与事前换班的过渡，黄球球不在贵阳现场。');
shot(H,415,435,'room',['humanS'],'回到后院才展示人形；讨论包、钥匙和留宿边界，CG082只在指租屋钥匙当拍。');
shot(H,436,438,'room',['human'],'AA允许商量留宿但今晚不留，邀请拥抱前维持空手人形。');
shot(H,439,null,'room',[],'AA额头抵肩拥抱的主观近镜，禁止把同居或持棒带入。');
shot(H,440,null,'rentalN',[],'本段最后已回出租屋写下一次纸条，明确清除球球与室内亲密状态。');
shot(H,441,443,'room',['humanD'],'分开支明确不能重谈关系，最后拥抱需要她同意，普通对话保留低落人形。');
shot(H,444,445,'room',[],'非AA最后告别拥抱及交包，去掉直立肖像以文字呈现动作；不恢复恋爱。');
shot(H,446,null,'closed',[],'已到门外道别，只听里面回应，人物清除；日间关门近景待P4-05复验。');
shot(H,447,null,null,[],'第90天拍卖结果及材料概述未写具体地点，阅读底图，无球球远程联系。');
shot(H,448,453,'roomN',['human'],'AA按原约在上班前见面，九点半送至门内；人形不因关系稳定而公共出场。');
shot(H,454,455,'rentalN',[],'分开支留出租屋给毛狼电话，毛狼远程且球球未见面。');
shot(H,456,null,'counterN',[],'电话后已按时回柜台，没有绕去后院；不留下毛狼或球球。');
shot(H,457,461,'rental',[],'第91天下班回屋写自己班表，两种HQ10选择均独处，不预先带入结局恋人。');
shot(H,462,468,'room',['human'],'E1下午四点半按约到屋内写杯名；空手人形，写字道具由叙述承载。');
shot(H,469,472,'room',[],'E1下巴靠肩与嘴角亲吻的近镜，不机械复用57天CG；人物仍人形，动作留白有明确镜头理由。');
shot(H,473,488,'room',['human'],'E1讨论公开姓名范围和下次两小时，只有室内人形；毛狼仅被提及，不让球球赴公众聚会。');
shot(H,489,495,'rental',[],'E2在自己班表上反思三种分开原因，球球仅被回忆，不使用可见球形/人形代表复合。');
shot(H,496,497,'counter',[],'E2从前门走向工作，远处电台和最后一次人形是回忆，不进入后院或摆球球立绘。');
shot(H,498,null,'counter',[],'E2柜台放回自己的杯、取消旧提醒；CG107只落在此动作，不在下一拍夜班残留。');
shot(H,499,null,'counterN',[],'E2九点四十回柜台上班，恢复夜景；不延续日景CG或任何恋爱状态。');

// FR：现场说话与远程同名说话分别落镜；人际与结薪结果不互相代替。
shot(R,0,8,'counter',['sj'],'买家量柜台时师匠在场；买家无已确认专用立绘，保留画外发言，不拿交钥匙配角冒充。');
shot(R,9,15,'counter',['sjS'],'买家离开后师匠和文文谈是否留任，换认真态；她不继续留在画面。');
shot(R,16,22,'counterN',['sjS'],'夜里收银争执及监控核对，师匠从后间到场；醉客无专用图，画外呈现，不能混用新店顾客身份。');
shot(R,23,37,'counterN',['sj'],'客人已走，师匠递水查手；两选择都在柜台，不因说电话预演未来远程场景。');
shot(R,38,42,'counter',['sj','ml'],'第21天下午毛狼借打印机，师匠饭盒在侧；演出单与设备清单不新增浮层。');
shot(R,43,67,'counter',['sjS','mlS'],'买家再来再离开，文文与师匠起冲突、毛狼追问；保留两名听者，买家画外，CG086在文文自行答应工作的反问处。');
shot(R,68,75,null,[],'盘点与演出邀约通过消息往来，文文算账的地点未明确；远程师匠/毛狼不按姓名出现。');
shot(R,76,88,'stage',['mlStage'],'A实际赴七点商场演出，毛狼穿已批准演出西装；负责人画外压价，既有day舞台需复核夜间光线，不自动采用。',{gap:'stageEvening'});
shot(R,89,90,'bg-noodle-shop-day',['mlStage'],'A七点演出后吃面，西装延续到本次散场；现有面馆day图需交夜间光线版本或确认室内适用，演出单油点由文字交代。',{gap:'noodleEvening'});
shot(R,91,92,null,[],'B先电话说明缺席，不能显示A的舞台或毛狼站姿。');
shot(R,93,101,'counterN',['sjS'],'B在网吧盘点，师匠现场；毛狼视频与消息是屏幕内容，不将毛狼舞台立绘放到柜台。');
shot(R,102,122,'counter',['sj','mlS'],'第24天三人订纸，毛狼本人在柜台打电话；保留现场毛狼，远端负责人及录音仅声音。结算到账不等于今后演出恢复。');
shot(R,123,125,'counter',['classmate'],'老同学问工作，毛狼尚未入门；不先行摆上他的肖像。');
shot(R,126,128,'counter',['classmate','mlBag'],'毛狼背话筒包进门；老同学走到机位后下一镜退出。');
shot(R,129,135,null,['mlS'],'拉到后门私下争执；现有后院通球球侧门不可当作已确定FR后门，人物近景与阅读底图保留地点留白。');
shot(R,136,138,'counter',['classmate'],'毛狼走后同学买水，毛狼立绘立即撤下。');
shot(R,139,143,null,[],'道歉和帮忙邀约均为消息，毛狼未回应或简短文字，不展示见面。');
shot(R,144,165,'rehearsal',['mlS'],'第28天排练场搬音箱、门口雨地谈伤人私话，毛狼认真；不拿微笑当原谅，A离开/B帮收线都不恢复原来亲近。');
shot(R,166,173,null,[],'第29晚饭前读新旧消息、复看过去舞台照；所有照片与文字不变成现场。');
shot(R,174,null,'counterN',['sj'],'交班时已在网吧，师匠问为何不走；毛狼仍不在场。');
shot(R,175,184,'counter',['sjS'],'第30天下午改结薪日期，师匠认真回应；买家仅预约尚未到。');
shot(R,185,null,null,[],'A先发消息解释不能到回声；不把毛狼放入工资谈判。');
shot(R,186,192,'counterN',['sjS'],'A八点半买家到场核工资；买家画外，师匠在柜台签第60天，工资日期由文字显示。');
shot(R,193,199,'counterN',['sjS'],'买家走后文文单独道歉，师匠不递饭盒；不以饭盒/笑容宣布和好。');
shot(R,200,null,'counterN',[],'给毛狼消息“今晚不用等”，聚焦收信界面叙述，远端毛狼不在店里。');
shot(R,201,206,null,['mlS'],'次日楼下还线、道歉；毛狼住处未明确登记，使用人物近景而不复用文文租屋冒充其家。');
shot(R,207,214,'counter',['sjS'],'B列工作与工资边界，当面师匠仍在；班里饭照吃不代表私人关系恢复。');
shot(R,215,225,'venue',['mlS'],'B按换班时间去回声，毛狼当面谈不传话；未说清私话伤害，不摆欢庆合照。');
shot(R,226,null,'counterN',['sjS'],'十点回店交班，毛狼与酒吧背景立即退出。');
shot(R,227,null,'bg-huisheng-corridor-locked-day',[],'第31天回声已经关门，仅锁门环境，不放运营夜场或周栀。');
shot(R,228,232,'counter',['sjS'],'第34天墙上分别写两项日期，师匠现场，文文扶纸；不使用清空后的柜台过早预告。');
shot(R,233,null,'back',[],'到后间取饭，先不显示师匠；既有后间夜景时段不明，需中性室内光复核。',{gap:'backroomDay'});
shot(R,234,240,'back',['sj'],'师匠进入后间后才显示；A能谈饭/B仅礼貌点头，不由共同肖像抹平分支文字。',{gap:'backroomDay'});
shot(R,241,null,null,[],'第35天看二手页面照片；不凭照片把师匠显示在文文眼前。');
shot(R,242,251,'counter',['sjS'],'第36天下午买家取游戏机、师匠擦灰；买家画外、不与奶茶店女买家混为同一个人，CG090只在擦灰拍。');
shot(R,252,253,'counterN',[],'当晚翻点卡给毛狼发图；他通过文字说资产，非现场。');
shot(R,254,258,'clearing',['sj'],'第42天老客户领键盘，选清理中柜台；老客户画外，师匠与文文搬箱，不拿新店顾客立绘冒充老客户。');
shot(R,259,260,'clearing',['sj','ml'],'第45天三人最后打一局，只展示已在场毛狼与师匠。');
shot(R,261,263,'clearing',['ml'],'师匠接电话去量门后退出镜头，毛狼留耳机。');
shot(R,264,281,'clearing',['ml','piao'],'飘到场与毛狼核演出时间和单独吃饭，明确只是一对的计划，不替文文友情自动和好。');
shot(R,282,299,'clearing',['sj','ml'],'师匠回来处理钟与饭盒，镜头回三人工作物件交接；飘留画外不继续占镜。');
shot(R,300,null,'clearing',[],'第52天毛狼到门外接电话，文文面前只剩屏幕，不以仍有声音判他在场。');
shot(R,301,null,'clearing',[],'看到关于自己的草稿，毛狼还在门外；不加讲台观众暗示段子已公开。');
shot(R,302,316,'clearing',['mlS'],'毛狼返回柜台承认写稿、删页并当面接电话；负责人远端不显示，CG091只在删页当拍。');
shot(R,317,318,'counterN',['mlS'],'两人在旧店挨着电脑改稿到天黑，仍未完成；不显示演出西装或掌声观众。');
shot(R,319,327,'clearing',['sjCalc'],'第59天核工资，师匠计算器当场握在手里；两条结局都清薪，不依据笑容判和好。');
shot(R,328,336,'handover',['sjS'],'第60天柜台挪开露出猫画、施工板盖住；师匠拍照后拆线，工人留画外，避免人物画遮挡猫画关键位置。');
shot(R,337,null,'handover',['sj','mlBag'],'毛狼背包来，三件安排重叠；只画旧店临别，不提前把新老板摆入。');
shot(R,338,344,'bus',[],'A先谈工作再站台打电话，当前取站台视点；毛狼在车边远端，无站姿同场。');
shot(R,345,346,'bus',[],'A-A另给师匠发班表，消息约清库房；师匠不突然出现在站台。');
shot(R,347,354,'bus',[],'BA电话未获复约，师匠也拒绝库房邀约；不能将远端礼貌转成团聚群像。');
shot(R,355,361,'handover',['sjS','mlBag'],'B已回旧店交钥匙、明确疏远，师匠与毛狼现场；不因FR06为A恢复未来约定。');
shot(R,362,null,'bg-bijie-slope-street-day-overcast',['mlBag'],'AB只送毛狼到路口，不摆师匠跟随，不添加返程约饭。');
shot(R,363,367,'handover',['sjS','mlBag'],'BB签收、结打印费，礼貌完成工作，最后无合照；结束时清两人。');
shot(R,368,null,'rental',[],'回租屋放钟和饭盒、洗锅，独处场景不继承旧店群像。');
shot(R,369,372,'newD',['boss'],'第63天新店报到，李老板仅工作关系，不能用师匠替代。');
shot(R,373,383,'newN',['customer'],'第一个夜班退款争执，新店顾客在场；选择皆保留顾客、无旧朋友援场。');
shot(R,384,null,'newN',['boss','customer'],'新老板实际来处理才显示老板，记录待检修不宣布已经修好。');
shot(R,385,386,'home',[],'第75天交钥匙前进屋停留，交接人在门外，空房镜头不摆老友陪同。');
shot(R,387,null,'homeDoor',['key'],'出来交钥匙时才显示交接人肖像，动作由文字叙述。');
shot(R,388,390,'newD',[],'第90天工作中收到拍卖消息、向联系人要明细，手机远程无现场人物。');
shot(R,391,403,null,[],'AA告知旧友、买面后接毛狼电话，地点在店外但未指定；只读消息/电话，不把赶场毛狼和师匠拉来同桌。');
shot(R,404,411,'newD',[],'非AA删掉求安慰的文字后客气通报，旧友仅文字回复；工作场景不恢复群像。');
shot(R,412,null,'photo',[],'第91天从照片店取猫照，店员留画外；照片文字与完整耳朵由叙述说明。');
shot(R,413,422,'milk',['sj'],'旧店外与师匠交洗好的猫照，奶茶店已换招牌；共同FR10选择不决定友情重开。');
shot(R,423,431,'milk',['sj'],'E1两份早饭仅文文和师匠；毛狼在外地，CG108不可画第三份餐具或本人。');
shot(R,432,442,null,[],'E1下午群聊协商未来饭局，尚未实际聚餐；三人消息不转成现场三立绘。');
shot(R,443,null,'newN',[],'E1夜里先备饭再到新店核机位，取工作落点，旧钟不是前老板在场依据。');
shot(R,444,445,'newEntrance',[],'给毛狼拍新店门头，毛狼仍远程；不是毛狼已经到店停车。');
shot(R,446,null,'newN',[],'E1关屏幕开始核账，结束清消息，不预演未来饭桌。');
shot(R,447,462,'milk',['sjS'],'E2收照片一起吃早餐只是当面告别，三组合分别接受疏远；不使用E1早餐CG或毛狼群像。');
shot(R,463,466,'milk',[],'师匠走向停车处，毛狼群里路牌消息，现场人物清除；不安排三人重聚。');
shot(R,467,471,'rental',[],'E2回租屋装旧耳机并约取，文字“再联系”不等于恢复友情。');
shot(R,472,null,'rentalN',[],'E2夜里独自做饭，旧钟和饭盒已归文文，不当欠情证据。');
shot(R,473,479,'newN',['colleague'],'E2新店夜班同事询问旧店，旧友只在回忆；CG094仅停顿那拍，不把“挺好过”改成团圆。');

function build(code,shots,cgAnchors){
 const packageId='P4-02-'+code,dir=D+'/'+packageId,qa='qa/dialogue-p4-'+packageId+'-20261103';
 const ps=allP.filter(p=>p.packageId===packageId),ns=allN.filter(n=>n.packageId===packageId),pIndex=new Map(ps.map((p,i)=>[p.paragraphId,i])),nm=new Map(ns.map(n=>[n.nodeId,n]));
 const assigned=new Map(),audit=[];
 for(const [ix,s] of shots.entries()){s.end=s.end==null?s.start:Number(s.end);assert(s.start<=s.end);const covered=ps.slice(s.start,s.end+1);assert.equal(covered.length,s.end-s.start+1);for(const p of covered){assert(!assigned.has(p.paragraphId),p.paragraphId);assigned.set(p.paragraphId,s);}audit.push({shotId:packageId+'-S'+String(ix+1).padStart(3,'0'),paragraphs:covered.map(p=>({id:p.paragraphId,sha256:p.source.sha256})),background:s.bg?B[s.bg]||s.bg:null,characters:s.chars.map(c=>C[c]||c),basis:s.basis,openGap:s.gap||null});}
 assert.equal(assigned.size,ps.length,'镜头覆盖缺段');
 const head={schemaVersion:'p4-package-v1',packageId,inputFingerprint:input.inputFingerprint,contentBuildId:input.contentBuildId};
 const documents={bindings:{...head,bindings:[]},review:{...head,reviews:[]},needs:{...head,needs:[]},boundaries:{...head,boundaries:[]}};
 const needs=documents.needs.needs;
 function need(resourceKey,kind,action,ids,reason,constraints,existingAssetIds=[],cgId=null){const needId=packageId+'-N'+String(needs.length+1).padStart(3,'0');needs.push({needId,resourceKey,kind,action,ownerTask:kind==='cg'?'P4-04':'P4-03',nodeIds:ids,reason,constraints,existingAssetIds,proposedAssetId:null,cgId,status:'open',resolution:null});return needId;}
 const cgByP=new Map(cgAnchors.map(([p,c])=>[p,c]));
 const stateByP=new Map();
 for(const p of ps){const s=assigned.get(p.paragraphId),cg=cgByP.get(p.paragraphId),asset=cg?read(F+'/resources.baseline.json').cg.find(x=>x.cgId===cg).assetId:null;stateByP.set(p.paragraphId,state(s.gap?null:s.bg,s.chars,asset));}
 const gaps=[...new Set(shots.map(s=>s.gap).filter(Boolean))];
 for(const gap of gaps){const ids=ps.filter(p=>assigned.get(p.paragraphId).gap===gap).flatMap(p=>p.nodeIds);const desc={closedNight:['old-netcafe-yard-door-closed-night','夜间门始终未开：既有夜图为半开，不能表示拒绝见面。','保持原后院布局与关闭的门；按夜间及清晨纸条近景分时段输出；不画球球或门内人物；与COMMON共享此资源键。',['bg-old-netcafe-yard-door-ajar-night','bg-old-netcafe-yard-door-closed-morning']],openMorning:['old-netcafe-yard-door-open-morning','第60天晨间扶门框退回屋内，既有晨图关门，与动作不符。','晨光、门打开可扶门框；人物不离门槛，维持人形上身裁切；不补下装。',['bg-old-netcafe-yard-door-closed-morning','bg-old-netcafe-yard-door-open-afternoon']],backroomDay:['old-netcafe-backroom-neutral-day','第34天取班饭，原文未定夜间；现有后间夜图照明须核对或交中性室内光版本。','沿用后间布局及饭盒位置，不改正文补夜晚；人物到场时点按节点。',['bg-old-netcafe-backroom-night']],stageEvening:['performance-mall-side-stage-evening','演出七点开场，现有商场侧台资源标day；不得无依据沿用日景。','确认既有舞台室内光可用于晚间则交复用证据，否则交同地点晚间版本；不改变人物西装和负责人画外。',['bg-performance-mall-side-stage-day']],noodleEvening:['noodle-shop-evening','七点演出结束后吃面，现有面馆标day；需核对室内照明/窗外或补晚间版本。','保持同一面馆布局与散场西装，不替换成朋友聚餐店；若复用需说明窗外与光线适用。',['bg-noodle-shop-day']]}[gap];need(desc[0],'background','repair',ids,desc[1],[desc[2]],desc[3]);}
 for(const [pid,cg] of cgAnchors){const p=ps.find(p=>p.paragraphId===pid),asset=read(F+'/resources.baseline.json').cg.find(x=>x.cgId===cg).assetId;need(cg.toLowerCase()+'-p4-review','cg','reuse',p.nodeIds,'拟复用 '+cg+'：仅覆盖“'+p.text+'”这一个新段。拆分后的相邻段不重复进CG。',['P4-04核对完整图与文字框遮挡；P4-05本批解码/目视复验前不可采用。',code==='HQ'?'按锚点守住球形/人形、门禁、文文手机归属与未确认下装裁切；不把普通黄色小球当角色。':'人物、衣装、时段和在场人数须与当前锚点一致；FR-E2不得使用E1团聚语义。','退出到本节点去CG底层；下一页完整重建，回退/读档亦按目标状态。'],[asset],cg);}
 // 结尾已提供可读镜头与具体衔接；提出可选增补评估，不按结局机械增加CG。
 const endingIds=code==='HQ'?['T-HQ-000586','T-HQ-000588','T-HQ-000598']:[];
 if(endingIds.length)need('hq-e1-cup-name-close','cg','new',ps.filter(p=>endingIds.includes(p.paragraphId)).flatMap(p=>p.nodeIds),'E1重新写杯名、靠肩与商量下一次已有完整动作，但没有对应结尾近景；交P4-04评估一张必要收束图，不能复用57天初吻图冒充91天。',['优先复用现有形象与房间，仅文文/黄球球；保持人形、上身构图及未确认下装裁切。','可合并为一张写名靠肩镜头；不要为了三个锚点生产三张图。','若P4-04判断背景＋正文足够，需有明确取消依据；当前不自行分配CG编号。']);
 for(const n of ns){let s,st,cgId=null,basis;if(n.op==='text'){s=assigned.get(n.paragraphId);st=structuredClone(stateByP.get(n.paragraphId));cgId=cgByP.get(n.paragraphId)||null;basis=s.basis;}else{const pos=allN.findIndex(x=>x.nodeId===n.nodeId);const prev=allN.slice(0,pos).reverse().find(x=>x.packageId===packageId&&x.op==='text');assert(prev);s=assigned.get(prev.paragraphId);st=structuredClone(stateByP.get(prev.paragraphId));st.cg=null;basis='选择 '+n.nodeId+' 保留前一已审定现场：'+s.basis+' 选择清姓名、清CG；选后按分支目标完整状态重建。';}
 if(n.nodeId==='HQ06-01'){st=state('venue',['ml']);basis='从下午回忆回到第30天回声现场，再选择如何向毛狼介绍黄球球；保留毛狼与回声夜景，球球绝不进入现场；清CG及姓名。';}
 const restore={...structuredClone(st),cg:null};
 documents.bindings.bindings.push({nodeId:n.nodeId,binding:{bindingId:'p4-'+n.nodeId,anchor:{nodeId:n.nodeId,file:n.source.file,sha256:n.source.sha256},condition:n.condition,routeIds:n.routeIds,enter:st,exit:{at:'next-node',restore},cgId,fullView:!!cgId,restrictions:[basis,'姓名与媒介只读冻结TEXT；角色肖像不是动作全景，道具未独立登记时不伪造道具层。','回退、读档、改选先清旧画面，再按目标节点完整重建；同名远程发言不自动进现场。','所有引用图片仍待P4-05本批复验；本候选不代表正式采用或运行通过。']}});
 }
 for(const p of ps){const s=assigned.get(p.paragraphId),ids=needs.filter(n=>n.nodeIds.some(id=>p.nodeIds.includes(id))).map(n=>n.needId),st=stateByP.get(p.paragraphId);documents.review.reviews.push({unitId:p.paragraphId,nodeIds:p.nodeIds,status:s.gap?'blocked':'reviewed',decision:s.gap?'new-art':st.background||st.characters.length||st.cg?'rebind':'neutral',basis:'原文“'+p.text+'”；'+s.basis+' 媒介='+p.textMeta.channel+'，条件='+p.condition+'；道具/动作以本段文字与已登记CG为限。',needIds:ids,unresolved:s.gap?['画面方案已审，等待'+s.gap+'背景补缺/复核后闭合。']:[]});}
 for(const n of ns.filter(n=>n.op==='choice')){const b=documents.bindings.bindings.find(x=>x.nodeId===n.nodeId).binding,pos=allN.findIndex(x=>x.nodeId===n.nodeId),prev=allN.slice(0,pos).reverse().find(x=>x.packageId===packageId&&x.op==='text'),s=assigned.get(prev.paragraphId);const related=s.gap?needs.filter(x=>x.kind==='background'&&x.nodeIds.includes(prev.nodeId)):[];for(const need of related)need.nodeIds.push(n.nodeId);documents.review.reviews.push({unitId:n.nodeId,nodeIds:[n.nodeId],status:s.gap?'blocked':'reviewed',decision:s.gap?'new-art':b.enter.background||b.enter.characters.length?'rebind':'neutral',basis:b.restrictions[0]+' 文案与条件逐字保持冻结映射。',needIds:related.map(x=>x.needId),unresolved:s.gap?['与选择前现场共享背景缺口，补图后一起闭合。']:[]});}
 const describeTarget=id=>{const n=nm.get(id);return n?`${id}（${n.op}，${n.condition}，${n.textMeta?.channel||'无姓名'}）`:id+'（控制锚点）'};
 for(const b of allB.filter(b=>b.packageId===packageId)){let policy='';if(b.kind==='call')policy=code==='HQ'?'只在LOW读第36天公共消息；退出第34天室内球形，COMMON独占消息镜头，返回HQ-D36-RETURN后从T-HQ-000153_1重建第36天室内球形。':'只在LOW读第36天消息；第35天二手页面退出，COMMON独占消息镜头，返回FR-D36-RETURN后从T-FR-000163_1进入第36天下午买家取游戏机。';else if(b.kind==='epilogue')policy=code==='HQ'?'HQ-E1保持恋爱直接结束；HQ-E2单身按HIGH/LOW条件进入COMMON，不能携带球球人形/球形到婚宴；LOW须已读事件。':'两结局均单身可按HIGH/LOW分派；FR-E2在两篇后日谈仅消息视角、不参加聚会或合照，FR-E1仍须按正文确认现场；LOW须已读事件。';else if(b.kind==='ending')policy=code==='HQ'?'AA为E1，其他三组合E2；第55天后两结局都维持人形，E2回忆不重新显示她在场。':'AA为E1，其他三组合E2；工资均结清不作为友情恢复条件；E2早餐是告别，不展示团圆CG。';else if(b.kind==='finish')policy='结束清姓名、角色、道具与CG，不以最后一帧作为下一轮开始的状态。';else if(b.kind==='file-entry')policy=code==='HQ'?'沿用共通隐藏入口已满足门禁，仅从前厅修招牌者进入，球球未开门不展示。':'进入旧店第15天下午买家量柜台，不继承共通网游群像或其他路线女主。';else policy='选择/分支汇合不沿用上一条词法分支；以实际跳转目的地的完整绑定重建。控制锚点期间不得自动展示候选目标；选择清姓名及CG，表情与在场由目标段决定。';documents.boundaries.boundaries.push({boundaryId:b.boundaryId,status:'reviewed',exitPolicy:'clear-before-target',restorePolicy:'recompute-destination',basis:`${b.kind}：${b.fromNodeId||'文件入口'} → ${b.targetNodeIds.map(describeTarget).join('、')||'结束'}。${policy}`,unresolved:[]});}
 const filenames={bindings:'bindings.candidate.json',review:'review.json',needs:'needs.json',boundaries:'boundary-states.json'};
 for(const [k,file] of Object.entries(filenames))write(dir+'/'+file,documents[k]);
 write(dir+'/shot-decisions.json',{inputFingerprint:input.inputFingerprint,interfaceFingerprint:seal.interfaceFingerprint,packageId,method:'全稿逐段通读后手写分镜区间；生成器仅展开稳定ID、坐标及接口字段，不读取旧绑定内容。',shots:audit});
 write(qa+'/input-fingerprints.json',{inputFingerprint:input.inputFingerprint,interfaceFingerprint:seal.interfaceFingerprint,files:[F+'/paragraph-map.json',F+'/node-map.json',F+'/boundaries.json',F+'/resources.baseline.json','assets/current/manifest.json',...new Set(ps.map(p=>p.source.candidateFile))].map(p=>({path:p,sha256:sha(p)}))});
 write(dir+'/交接.md',`# ${packageId} 演出候选交接\n\n2026-11-03。**逐段演出方案及候选已交，最终可采用交接未通过：仍有资源依赖。**\n\n本包完整通读P3冻结正文${ps.length}段，逐段审定${ns.length}个显示节点（含${ns.filter(n=>n.op==='choice').length}个选择）、${documents.boundaries.boundaries.length}项边界。分镜依据见[shot-decisions.json](shot-decisions.json)，逐段结论见[review.json](review.json)。${documents.review.reviews.filter(r=>r.status==='blocked').length}段已明确方案但因背景缺口保留blocked；其他已审表示演出决定已作出，不表示资源复验完成。\n\n- 正文构建：\`${input.contentBuildId}\`。\n- 输入指纹：\`${input.inputFingerprint}\`；接口：\`${seal.interfaceFingerprint}\`。\n- 当前候选由逐段新文决定背景、在场、表达和退出；未读取旧绑定作为新状态，仅沿用已登记资源尺寸与身份。\n- 每节点写完整enter及去CG底层restore；选择清CG、姓名由冻结编译器清理。回退/改选/读档按目的地重算，不跨分支继承。\n- ${code==='HQ'?'第55天五点开门前为球形，之后即使分开也人形；隔门/拒见不展示角色；第30天回声中的黄球球原话按回忆处理。文文手机不可变成黄球球手机，不公开出场、不赴后日谈婚宴、不补下装。':'现场毛狼打电话仍可在镜头内，远端负责人始终画外；消息和视频不生成现场立绘。奶茶店买家/游戏机买家/老客户分别画外，不挪用身份不符的图。叶岚未在本稿实际现场，不添加她的独立线或结局。E2早餐为告别，后续简短消息不恢复友情。'}\n\n## 待闭合资源\n\n[needs.json](needs.json)共${needs.length}项：${gaps.length}项背景补缺/复核、${cgAnchors.length}项既有CG本批复核${endingIds.length?'、1项结尾镜头必要性评估':''}。每项均有精确新节点、原文、条件回链与负责制作任务。CG均只在一个明确动作段进入；未把拆分原段变为重复解锁点。资源目录仍为P4-01全pending，须P4-03/04处理和P4-05复验；未知新图不填假assetId。\n\n缺背景时的底图/现有图只是明确标记的候选临时状态，不是批准复用，相关review保持blocked。可有依据地维持画外的短暂配角不强制新增肖像；近身/躺姿不拿直立立绘冒充动作。\n\n## 验证与范围\n\n草稿结构、覆盖、条件、资源ID、分页和生命周期由冻结validate.cjs检查；本批回执见[validation-draft.json](../../../../${qa}/validation-draft.json)，完成门禁拒绝见[validation-handoff.json](../../../../${qa}/validation-handoff.json)。输入输出指纹与专项约束见[verification.json](../../../../${qa}/verification.json)。图片未在本包重新解码/目视、未制作，故不签发资源passed。\n\n未改P3正文、正式scenario、正式清单/绑定、公共代码及旧QA；没有引擎、浏览器/手机/原生、存档或发布验收。COMMON跨包约束写入boundary-states.json，由P4-07合并核对。\n`);
 return {packageId,dir,qa,documents,ps,ns};
}
const h=build('HQ',H,[['T-HQ-000034','CG073'],['T-HQ-000058','CG075'],['T-HQ-000176','CG077'],['T-HQ-000197','CG078'],['T-HQ-000476','CG079'],['T-HQ-000563','CG082'],['T-HQ-000343','CG107']]);
const r=build('FR',R,[['T-FR-000040','CG086'],['T-FR-000440','CG090'],['T-FR-000475','CG091'],['T-FR-000264','CG108'],['T-FR-000603','CG094']]);
const V=require('../../tools/story-revision/p4-bindings/validate.cjs'),ctx=V.loadContext(),resources=V.resourceCatalog(ctx);
for(const x of [h,r]){const result=V.validatePack(ctx,x.packageId,x.documents,{mode:'draft',resources});write(x.qa+'/validation-draft.json',result);let error=null;try{V.validatePack(ctx,x.packageId,x.documents,{mode:'handoff',resources});}catch(e){error=e.message;}assert(error,'不可绕过P4-05');write(x.qa+'/validation-handoff.json',{status:'blocked',expected:true,error,reason:'真实资源依赖保留，未用夹具passed标签绕过门禁。'});const outputs=['bindings.candidate.json','review.json','needs.json','boundary-states.json','shot-decisions.json','交接.md'].map(f=>({path:x.dir+'/'+f,sha256:sha(x.dir+'/'+f)}));write(x.qa+'/output-fingerprints.json',{inputFingerprint:input.inputFingerprint,interfaceFingerprint:seal.interfaceFingerprint,outputs});console.log(x.packageId,JSON.stringify(result.counts));}
