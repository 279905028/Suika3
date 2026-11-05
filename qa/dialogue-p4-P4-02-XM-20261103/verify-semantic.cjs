'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {loadContext,validatePack,readPackage}=require('../../tools/story-revision/p4-bindings/validate.cjs');
const C=require('../../tools/story-revision/p4-bindings/common.cjs');
const ctx=loadContext();
for(const pack of ['XM','ZZ']){
const id='P4-02-'+pack,dir='docs/修订协作/P4-演出与美术/'+id,qa='qa/dialogue-p4-'+id+'-20261103',docs=readPackage(dir),ps=ctx.paragraphs.filter(p=>p.packageId===id),bm=new Map(docs.bindings.bindings.map(r=>[r.nodeId,r.binding])),checks=[];
function check(name,fn){fn();checks.push({name,status:'pass'});}
const at=i=>bm.get(ps[i-1].nodeIds[0]),ids=i=>at(i).enter.characters.map(c=>c.assetId),range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
check('冻结输入/四文件覆盖/条件/完整状态/需求回链',()=>validatePack(ctx,id,docs,{mode:'draft'}));
check('全部选择清CG且有独立审阅',()=>{for(const n of ctx.nodes.filter(n=>n.packageId===id&&n.op==='choice')){assert.equal(bm.get(n.nodeId).cgId,null);assert.equal(bm.get(n.nodeId).enter.cg,null);assert(docs.review.reviews.some(r=>r.unitId===n.nodeId));}});
check('全部退出去CG、目标恢复完整',()=>{for(const {binding:b} of docs.bindings.bindings)assert.deepEqual(b.exit.restore,{...b.enter,cg:null});});
check('全部边界已审且按目标重建',()=>{for(const b of docs.boundaries.boundaries){assert.equal(b.status,'reviewed');assert.equal(b.exitPolicy,'clear-before-target');assert.equal(b.restorePolicy,'recompute-destination');}});
check('CG每编号仅一个稳定段，非拆段继承',()=>{const used=docs.bindings.bindings.map(r=>r.binding.cgId).filter(Boolean);assert.equal(new Set(used).size,used.length);assert.equal(used.length,pack==='XM'?8:9);});
check('所有资源仍保持本批待验，无假通过标签',()=>{const r=C.json(dir+'/resources-used.json');assert(r.assets.every(a=>a.reviewStatus==='pending'&&a.checkEvidence===null));});
if(pack==='XM'){
check('第59天至结尾远程小满不现场，排除真正见面区间',()=>{for(const i of [...range(472,480),...range(535,603),...range(618,681)])assert(!ids(i).some(s=>s.includes('xiaoman')));});
check('第40天阿俊播放小满语音仅阿俊现场',()=>assert.deepEqual(ids(315),['npc-ajun-base']));
check('当面发送语音/群消息不误清小满',()=>{for(const i of [58,60,199,282,307,309,425])assert(ids(i).some(s=>s.includes('xiaoman')));});
check('旧卫衣只在第40天A段，B不继承',()=>{for(const i of range(355,372))assert(ids(i).includes('char-xiaoman-old-sweatshirt'));for(const i of range(373,401))assert(!ids(i).includes('char-xiaoman-old-sweatshirt'));});
check('裙装只第30天，小满段保持',()=>{for(const i of [...range(225,235),...range(248,267)])assert(ids(i).includes('char-xiaoman-skirt'));});
check('双盔图仅卖车后，未冒充第15天单盔',()=>{for(let i=1;i<=ps.length;i++)if(ids(i).includes('char-xiaoman-two-helmets'))assert(i>=457&&i<=460);});
check('闭本图不冒充打开错误页/报名材料',()=>{for(const i of [...range(22,39),...range(119,122),...range(481,488)])assert(!ids(i).includes('char-xiaoman-practice-notebook'));});
check('AA吻CG不泄漏至AB/BA/BB',()=>{assert.equal(at(506).condition,'XM07-01=A&XM08-01=A');for(const i of range(512,532))assert.equal(at(i).cgId,null);});
check('第91天剪发是新人，小满在成都',()=>{for(const i of range(604,617))assert.deepEqual(ids(i),['npc-salon-newcomer-base']);});
}else{
check('工作裙装只第46天，不倒用于回声旧班',()=>{for(let i=1;i<=ps.length;i++)if(ids(i).some(a=>a.includes('work-')))assert(i>=483&&i<=513);});
check('备菜围裙仅第75天AA，摘下立即退',()=>{for(let i=1;i<=ps.length;i++)if(ids(i).includes('char-zhouzhi-human-prep-apron')){assert(i>=647&&i<=651);assert.equal(at(i).condition,'ZZ06-01=A&ZZ08-01=A');}});
check('杯子放下与再拿逐拍退出，不带到街边',()=>{for(const i of range(378,380))assert(!ids(i).includes('char-zhouzhi-human-tied-tired-cup'));assert(ids(381).includes('char-zhouzhi-human-tied-tired-cup'));for(const i of range(382,388))assert(!ids(i).includes('char-zhouzhi-human-tied-tired-cup'));});
check('双方电话/群聊保持男主侧，不召来远程女方',()=>{for(const i of [...range(239,244),...range(295,299),...range(315,316),...range(367,371),...range(535,549),...range(688,719),...range(731,803)])assert(!ids(i).some(a=>a.includes('zhouzhi')));});
check('当面发消息/接电话仍现场',()=>{for(const i of [165,339,473])assert(ids(i).some(a=>a.includes('zhouzhi')));});
check('ZZ06-B送到家门不继承A同居',()=>{for(const i of range(457,463))assert.equal(at(i).enter.background.assetId,'bg-zhouzhi-bijie-home-door-day');});
check('第60天歌单已还，未造独立道具错误转移',()=>{for(const i of range(566,610))assert.deepEqual(at(i).enter.props,[]);});
check('E1回屋准确到开门句，不提前三句进屋',()=>{assert.equal(at(779).enter.background.assetId,'bg-bijie-slope-street-day-overcast');assert.equal(at(780).enter.background.assetId,'bg-wenwen-bijie-rental-day');});
check('AA交杯CG严格双A条件，其余不泄漏',()=>{assert.equal(at(586).condition,'ZZ06-01=A&ZZ08-01=A');for(const i of range(589,610))assert.equal(at(i).cgId,null);});
}
check('handoff真实拒绝开放需求和未复验，不标可采用',()=>assert.throws(()=>validatePack(ctx,id,docs,{mode:'handoff'}),/未决需求/));
const result={packageId:id,inputFingerprint:ctx.input.inputFingerprint,interfaceFingerprint:ctx.seal.interfaceFingerprint,status:'pass',checks,notRuntimeAcceptance:true,scope:'语义锚点与数据断言，未替代图片目视/解码/引擎或浏览器验收。'};fs.writeFileSync(qa+'/semantic-verification.json',JSON.stringify(result,null,2)+'\n');console.log(id,checks.length+'项通过');
}
