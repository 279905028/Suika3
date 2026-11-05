#!/usr/bin/env node
'use strict';
// 从P0冻结原文生成可追溯资料；不生成改写稿或修改正式来源。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ROOT,QA,json,read,sha}=require('./p0-baseline.cjs');
const DOC='docs/修订协作/P0-基线与规则-20261102';
const registry=json(QA+'/paragraph-registry.json');
function write(rel,data){const dest=path.join(ROOT,rel),text=typeof data==='string'?data:JSON.stringify(data,null,2)+'\n';fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest)){if(fs.readFileSync(dest,'utf8')===text)return;assert(rel.startsWith(DOC+'/'),'禁止改写既有QA：'+rel);fs.writeFileSync(dest,text);return;}fs.writeFileSync(dest,text,{flag:'wx'});}
function evidence(file,needle){
  const source='scenario/'+file+'.md',lines=read(QA+'/before/'+source).toString('utf8').split('\n');
  const hits=lines.map((text,i)=>({text,line:i+1})).filter(x=>x.text.includes(needle));
  assert.equal(hits.length,1,'证据必须唯一：'+file+' '+needle);
  const hit=hits[0],p=registry.paragraphs.find(p=>p.file===source&&p.line===hit.line);
  return {file:source,line:hit.line,sha256:sha(hit.text),paragraphId:p?.id??null,quote:hit.text};
}
const E=(f,t)=>evidence(f,t);
const evidenceLink=e=>`[${e.paragraphId||'说明:'+e.line}](../../../${QA}/before/${e.file})`;
const mainNames=[
  ['wenwen','文文',['文文'],'文文开口显示姓名；明确心声另加媒介后缀。第一人称旁白不挂文文姓名。','会接玩笑，也用“先干着”避开难处；逐渐肯说明班表与限制。','第一章-回到毕节','“文文，我又没问你多大'],
  ['xiaoman','罗小满',['罗小满','小满'],'姓名框统一罗小满；正文对话可沿用小满，不新造昵称。','直爽、嘴硬；有原稿“莫”等地方口语，不能每句都套方言。','第一章-回到毕节','小满把我的头'],
  ['zhouzhi','周栀',['周栀'],'区分工作招呼与私人回应，不把营业亲近都当成恋爱确认。','会接话，也会避开追问；谈工作与收入时具体，不写成道理总结。','第一章-回到毕节','周栀已经坐在店里'],
  ['mengyao','孟遥',['孟遥'],'共通只知前女友和英语老师；第27天本线才揭示婚姻。朋友不自动知道秘密关系。','熟人面前较劲、调侃；工作先核课表与费用，不能总当导师。','第一章-回到毕节','隔天下午，我在便利店看见孟遥'],
  ['piao','飘',['飘'],'HIGH／LOW同一人物；各自路径独立，不混用另一条经历或关系称呼。','先讲具体安排和作品，再讲自己愿不愿意；不替她作主。','第一章-回到毕节','飘'],
  ['huangqiuqiu','黄球球',['门内的声音','黄球球'],'自报姓名这一句仍显示门内的声音；该句之后才显示黄球球。形态不改人物键和姓名，不用“球球”作默认称呼。','干巴巴地吐槽，关键处直接；不能扩成读心或许愿能力。','第二章-十四天','“黄球球。黄是黄色的黄。”'],
  ['maolang','毛狼',['毛狼'],'沿用已有称呼，不补真实姓名；工作与孩子事务由本人承诺。','接梗、爱热闹，也会说错话；受伤时不立即用笑话抵消。','第一章-回到毕节','轮子滚下站台'],
  ['shijiang','师匠',['师匠'],'称呼不是师徒身世；仍是雇主。','谈班表、交接与钱时简短务实；照顾和拖薪后果都保留。','第一章-回到毕节','网吧在坡下。师匠'],
  ['yelan','叶岚',['叶岚'],'普通游戏队友；游戏麦用voice，不把远程队友画成现场人物。','指出配合问题、能接玩笑，也有自己的工作安排。','第一章-回到毕节','第五天休班，我刚进游戏'],
  ['chensheng','陈晟',['陈晟'],'MY第15天手机出现姓名；第27天门口段旁白已点名，可随原文显示陈晟。丈夫身份直到孟遥正式介绍才揭示，不能提前写进姓名框。','普通人的简短问答与生活安排，不反派化，不替他获知秘密。','孟遥-旧题','“陈晟，我丈夫。”']
];
// 一些核心人物的首次出现包含多次名字，取明确段落而不推断人物关系。
mainNames[1][6]='小满';mainNames[4][6]='飘';
function firstBodyEvidence(file,needle){
  const p=registry.paragraphs.find(p=>p.file==='scenario/'+file+'.md'&&read(QA+'/before/'+p.file).toString('utf8').split('\n')[p.line-1].includes(needle));assert(p);
  const text=read(QA+'/before/'+p.file).toString('utf8').split('\n')[p.line-1];
  return {file:p.file,line:p.line,sha256:p.sha256,paragraphId:p.id,quote:text};
}
const speakers=mainNames.map(([id,canonical,allowedNames,knowledge,voice,file,needle])=>({id,canonical,allowedNames,knowledge,voice,evidence:[firstBodyEvidence(file,needle)]}));
const npcs=[
  ['chenniang','陈孃',['陈孃'],'npc-chenniang-base','原稿写“陈孃”，资源台账另写“陈嬢”，不自动带入正文。'],
  ['ajun','阿俊',['阿俊'],'npc-ajun-base','只采用原有熟人身份。'],
  ['housing-clerk-xm','办事的人',['办事的人'],'npc-housing-clerk-base','正文未给职业细分，不显示资源名“租房办事员”。'],
  ['salon-newcomer','理发店新人',['理发店新人'],'npc-salon-newcomer-base','不补姓名、年龄或与小满的竞争经历。'],
  ['aying','阿英',['阿英'],'npc-aying-base','与周栀的相处和夜宵摊安排以原稿为准。'],
  ['key-handover-zz','交接的人',['交接的人'],'npc-key-handover-base','不擅称买家、中介或银行职员。'],
  ['grocery-owner','杂货店大姐',['杂货店大姐'],'npc-grocery-owner-base','与后来接手的新店主分开。'],
  ['shoe-repairer','修鞋师傅',['修鞋师傅'],'npc-shoe-repairer-base','不借作品受访关系补家庭经历。'],
  ['new-grocery-owner','新店主',['新店主'],'npc-new-grocery-owner-base','来源女性代词保留，不编姓名或接店缘由。'],
  ['sign-repairer','修招牌的人',['修招牌的人'],'npc-sign-repairer-base','只知道门外当场信息，不知黄球球身份。'],
  ['classmate-fr','老同学',['老同学'],'npc-classmate-base','与孟遥被对外称作老同学的语境不同。'],
  ['boss-li','新老板',['新老板','李老板'],'npc-boss-li-base','第63天明确姓李后可用李老板；前文来看旧店的买家不自动并成此人。'],
  ['cafe-customer-fr','顾客',['顾客'],'npc-cafe-customer-base','仅指FR退费场景该顾客，别处顾客另登记场景限定键。'],
  ['cafe-colleague-fr','同事',['同事'],'npc-cafe-colleague-base','仅指FR新柜台同事，不能合并其他路线同事。']
];
const B=json(QA+'/before/docs/整合/bindings.json');
for(const [id,canonical,allowedNames,assetId,knowledge]of npcs){
  const b=B.bindings.find(b=>b.enter.characters.some(c=>c.assetId===assetId));assert(b);
  const p=registry.paragraphs.find(p=>p.legacyNodeIds.includes(b.anchor.nodeId));assert(p);
  const text=read(QA+'/before/'+p.file).toString('utf8').split('\n')[p.line-1];
  speakers.push({id,canonical,allowedNames,knowledge,voice:'按该场原话保持简短生活口语，不添加身份背景。',assetReference:assetId,evidence:[{file:p.file,line:p.line,sha256:p.sha256,paragraphId:p.id,quote:text}]});
}
speakers.push({id:'qiaoge',canonical:'乔哥',allowedNames:['熟客','乔哥'],knowledge:'ZZ正文已介绍“叫乔哥的熟客”后使用乔哥，不补真实姓名或幕后关系。',voice:'保留原稿熟客劝酒语境，不扩大成新反派线。',evidence:[E('周栀-十一点四十七分','旁边一个叫乔哥的熟客')]});
speakers.push({id:'phone-c01-001',canonical:'电话那头的人',allowedNames:['电话那头的人'],knowledge:'开场电话仅知道问姓名与逾期，不擅自命名银行或联系人；只限本场。',voice:'原稿未展开的内容不自行编造。',evidence:[E('第一章-回到毕节','电话那头问我是不是文文')]});
const roster={version:'dialogue-speakers-v1-p0',status:'已登记26个核心或场景身份；其余发言者改稿时先据原文登记，非全稿逐句说话人标注',speakers};
write(DOC+'/speakers.json',roster);
const md=['# 角色称呼与信息边界','',`2026-11-02｜26个角色／场景身份。姓名框默认用下表称呼，称呼许可及证据在[speakers.json](speakers.json)；不是全稿说话人自动判定结果。`,'',
  '姓名、人物键、玩家已知身份分别处理。未揭身份按当前场景已知称呼；消息按发送者，电话／游戏麦按媒介。普通配角不用立绘文件名补姓名；同称“顾客”“同事”的不同人不合并。', '',
  '| 人物键 | 默认称呼 | 信息边界 | 原文定位 |','| --- | --- | --- | --- |',
  ...speakers.map(s=>`| \`${s.id}\` | ${s.canonical} | ${s.knowledge} | ${evidenceLink(s.evidence[0])} |`),'',
  '## 主要人物口吻','',...speakers.slice(0,10).map(s=>`- **${s.canonical}**：${s.voice}`),'',
  '## 揭示与新增登记','',
  '- 黄球球的自报姓名句仍用“门内的声音”，下一条发言才切姓名；只有相识条件成立才读这一段。不要在回顾标题、CG说明或姓名框提前泄露。',
  '- 陈晟：第15天只看见手机姓名；第27天门口段旁白已经点名，可随原文显示陈晟，但不能提前标为丈夫。孟遥正式介绍后文文才知道婚姻；这份信息不能自动扩散给共同朋友。',
  '- 陈孃的“孃”沿用原稿；“租房办事员”来自资源统计名，正文只确认“办事的人”；李老板只确认姓李，不补全姓名。',
  '- 收银员、司机、店长、电台主持、其他顾客／来电等若需新增实际台词，先在本场上下文核实身份，再登记带文件码或场景号的键；能用原有身份称呼就不编姓名。身份或关系不能确定且影响剧情时问用户。',
  '- 同一角色允许多个已确认称呼，但每条TEXT必须显式选用当前时点合法的name；不能随机轮换，也不靠立绘、目录或后来结局反推。',
  '', '[返回P0交接](README.md) · [格式与规则](规则与格式.md)',''];
write(DOC+'/角色称呼表.md',md.join('\n'));
const issues=[];
function issue(id,kind,stage,title,detail,fix,refs,extra={}){issues.push({id,kind,stage,status:'open',title,detail,acceptance:fix,evidence:refs,...extra});}
issue('P0-01','明确错误','P2','第一章选择数及计分说明过时','写5处且称其他选择只影响当前交流；实际6处，C01-06计入飘关系。','按当前登记改为6处并说明计分；ID、效果不变。',[E('第一章-回到毕节','> 本章5处选择')]);
issue('P0-02','明确错误','P2','第二章选择数过时','章首写7处，实际9处；两次新增计分选择都已登记。','改为9处，保留隐藏段前置与单次计分规则。',[E('第二章-十四天','> 本章7处选择')]);
issue('P0-03','明确错误','P2','周栀离场与接班时间','先约9:45离场，后来又说10点才走，夜班10点接手。','统一成既定9:45离场／10点接班，不另造排班。',[E('周栀-十一点四十七分','九点四十五得走'),E('周栀-十一点四十七分','“我十点得走。”')]);
issue('P0-04','明确错误','P2','蓝沿白杯交付方向','她刚从包里取出杯子，尚未交给文文，后文却写她伸手拿“我的杯子”。','逐分支统一拿取者、持有人和最终交付动作。',[E('周栀-十一点四十七分','她从包里取出那只蓝沿白杯'),E('周栀-十一点四十七分','她没急着伸手拿我的杯子')]);
issue('P0-05','衔接不足','P2','电子照片与照片背面','发来照片、放大查看和“背面记着参数”并置，媒介未交代。','按现有媒介改清；不擅增洗印、寄送经历。若需新事实先问用户。',[E('飘-空白页','照片背面记着她练习时的参数')]);
issue('P0-06','衔接不足','P2','飘HIGH第十章同场错觉','已赴贵阳，章首夹照片、绑细绳和“她说”缺乏当下／回忆／远程定位。','先核对分支及册子归属；未确认前不写返乡重逢或新寄件事件。',[E('飘-空白页','她把新洗出的几张照片夹进册子')]);
issue('P0-07','衔接不足','P2','飘LOW第36天收最后一箱','第30天回声已停业，第36天面馆谈话后“回去”帮周栀收箱，地点与缘由不明。','删除非必要歧义动作或用既有事实澄清，不补设搬运地址。',[E('飘-空白页','第三十天，回声停业，大家忙着搬东西'),E('飘-空白页','她回去帮周栀收最后一箱东西')]);
issue('P0-08','衔接不足','P2','飘LOW两个短结局','试交往主要靠转述，两个结局各两段，尚不足以证明决定、回应和生活落点完整。','按既有场景补足约2—3段短场景；A保留试交往、B保留朋友，孩子责任不转移。',[E('飘-空白页','我约飘散步，她选了下午'),E('飘-空白页','我们没有再开始恋爱。')]);
issue('P0-09','明确错误','P2','四条恋爱路线尾注遗漏单身门禁','小满、周栀、孟遥、黄球球旧尾注只按HIGH/LOW说接后日谈，与已生效门禁不完整一致；朋友线本来均单身。','按当前rules同步导航；飘及公共事件的新尾注保留。',['罗小满-练习本','周栀-十一点四十七分','孟遥-旧题','黄球球-门后'].map(f=>E(f,'> 后续阅读：低好感怀孕路径接')));
issue('P0-10','工程缺口','P1','编译链缺显式说话人','现行parse仅有text，emit未贯通姓名；配置启用姓名框不代表已有数据。','三个小样通过解析、分页、清名、回顾及恢复再铺全稿。',[],{files:['tools/compiler/parse.cjs','tools/compiler/emit.cjs','config.ini']});
issue('P0-11','工程缺口','P1/P4','旧段落及行号绑定在改稿后失效','旧ID含原文哈希，制作表还有start/end行号。','采用稳定ID及一对多来源映射；变化节点全部重审绑定，不自动套图。',[],{files:['tools/compiler/parse.cjs','tools/integration/assets/portrait-gap-plan.cjs','docs/整合/bindings.json']});
issue('P0-12','工程缺口','P4','CG固定60项与选项文字图','新增CG需联动登记、容量、解锁和校验；改选项文案需重建电影侧栏文字图。','新编号不复用取消编号；清单与图鉴、绑定、界面和文字图一起验证。',[],{files:['tools/integration/runtime/validate.cjs','system/sui-u/gallery.registry.json','system/sui-cinema/manifest.json']});
issue('P0-13','历史待复核','P4','CG066坐姿／站立偏差','旧QA记录站立拥吻与正文坐姿冲突，本次只保留问题，不重新目视判定。','按冻结正文复查、必要时修图；不改正文迁就画面。',[],{files:['qa/sui-q-20261030/验收报告.md'],historicalId:'Q-SPECIAL-01'});
issue('P0-14','历史待复核','P5','Firefox快速面板交互漏操作','旧QA的快速存读档衔接未通过，慢速通过不能关闭；P0未复现。','修复后按原快节奏复测，独立存储并记录浏览器版本。',[],{files:['qa/sui-q-20261030/验收报告.md'],historicalId:'Q-B01'});
issue('P0-15','工程缺口','P1/P2','资源称呼不能充当剧情揭示','陈孃／资源名陈嬢、办事的人／资源名租房办事员不同；陈晟手机姓名不等于已认识本人。','以称呼表与原文信息时点逐句标注；陌生声音不显示真实姓名。',[E('第一章-回到毕节','陈孃收了房租'),E('罗小满-练习本','办事的人问我以前住哪边'),E('孟遥-旧题','对话上方写着陈晟，我不认识')]);
issue('P0-16','说明过时','P3','旧文档仍写未接入引擎','部分正文／人物说明保留迁移前状态；不能据此忽略已完成的本机候选验收。','合审时更新状态说明并引用相应QA；不把P0当作新引擎验收。',[E('README','当前可编辑文稿，尚未转换或接入Suika3引擎')],{files:['docs/人物/文文.md','docs/人物/孟遥.md']});
issue('P0-17','需用户决定','P2/P3','毛狼两个月长活与第92天回来','共通原话是“可能”“前后两个月”，朋友线第91天说明天回来；旧QA未认定为确定矛盾。','修到此处若须解释提前结束或短暂回来，应先问用户；也可保留未定安排，不擅自定因果。',[E('第二章-十四天','跟演出队去几个县，前后两个月'),E('朋友与职业-夜班','毛狼在群里发来一张路牌，说明天下午回来')],{decision:'unresolved; P0只登记，不新增叙事规则'});
issue('P0-18','历史待复核','P4/P5','次要视觉、首开负载与设备缺口','旧QA还留CG025时段、CG001全图提示对比度、scene-260消息／见面边界，以及首开负载、Safari、手机／桌面原生与长期压力待验。','按实际修订影响重新检查，保留独立验收层级，不以Chrome专项代替其他范围。',[],{files:['qa/sui-q-20261030/验收报告.md','qa/ui-cinema-20261030/验收记录.md']});
write(DOC+'/issues.json',{version:'p0-issues-v1',baselineFingerprint:json(QA+'/baseline.json').fingerprint,scope:'计划初审逐项回查及历史问题继承，不代表全稿审校；open不阻塞P0资料完成',issues});
const issueMD=['# 修订问题台账','',`2026-11-02｜18项。当前均为待处理；P0完成的是定位、分类与验收条件，未修正文、代码或图像。权威条目及原句见[issues.json](issues.json)。`, '',
  '| 编号 | 分类／阶段 | 问题及证据 | 关闭条件 |','| --- | --- | --- | --- |',
  ...issues.map(i=>`| ${i.id} | ${i.kind}／${i.stage} | **${i.title}**：${i.detail} ${i.evidence.map(evidenceLink).join('、')}${(i.files||[]).map(f=>`[${path.basename(f)}](../../../${f})`).join('、')} | ${i.acceptance} |`),'',
  '## 处理规则','',
  '- 以上分成明确错误、衔接不足、工程缺口、需用户决定及历史待复核。旧QA问题只继承状态，不能写成本次重验。',
  '- P0-17暂不选择“提前收工”或“短暂返乡”；原稿的“可能”使它不构成已证实矛盾。P0-05/06/07若最小修订仍需新增事实，同样转交用户决定。',
  '- 每项关闭须追加采用批次、稳定段落ID、变更理由、受影响分支和实际检查证据。工程、资源、引擎、浏览器／真机分别结项；不得只改status。',
  '- P1/P2逐场审读可追加新编号；不要重编号、合并掉尚未解决的证据或声称本台账覆盖全部正文问题。',
  '', '[返回P0交接](README.md)',''];
write(DOC+'/问题台账.md',issueMD.join('\n'));
const f=read(QA+'/before/scenario/第一章-回到毕节.md').toString('utf8').split('\n');
const fixtures=[
  [43,'action',null,'','none',f[42]],
  [45,'dialogue','shijiang','师匠','face',f[44].slice(1,-1)],
  [47,'narration',null,'','none',f[46]],
  [49,'action',null,'','none',f[48]],
  [51,'dialogue','wenwen','文文','face','先干多久？'],
  [53,'dialogue','shijiang','师匠','face','你能干多久？']
].map(([line,kind,speaker,name,channel,text])=>{
  const p=registry.paragraphs.find(p=>p.file==='scenario/第一章-回到毕节.md'&&p.line===line);assert(p);
  return {source:{id:p.id,file:p.file,line,sha256:p.sha256},metadata:{id:p.id,kind,speaker,name,channel,group:null},text,scope:'格式夹具：只摘取原句、分离发言标签；未采用、非P1中文模型试写'};
});
write(QA+'/format-fixtures.json',{version:'dialogue-v1-p0',fixtures});
console.log(JSON.stringify({speakers:speakers.length,issues:issues.length,fixtures:fixtures.length}));
