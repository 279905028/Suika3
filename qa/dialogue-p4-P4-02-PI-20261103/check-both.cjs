'use strict';
const fs=require('fs'),assert=require('assert/strict');const V=require(process.cwd()+'/tools/story-revision/p4-bindings/validate.cjs'),ctx=V.loadContext();
for(const code of ['MY','PI']){
 const pack='P4-02-'+code,dir='docs/修订协作/P4-演出与美术/'+pack,qa='qa/dialogue-p4-'+pack+'-20261103';
 const docs=V.readPackage(dir),ps=ctx.paragraphs.filter(p=>p.packageId===pack), byId=new Map(docs.bindings.bindings.map(b=>[b.nodeId,b.binding]));const results=[];
 const check=(name,fn)=>{fn();results.push({name,status:'pass'})};
 const at=i=>byId.get(ps[i].nodeIds[0]);const empty=(a,b)=>{for(let i=a;i<=b;i++)assert.equal(at(i).enter.characters.length,0,ps[i].paragraphId)};
 check('冻结输入/接口/完整包draft校验',()=>V.validatePack(ctx,pack,docs,{mode:'draft'}));
 check('全部绑定有完整出入场并恢复去CG底层',()=>{for(const b of byId.values())assert.deepEqual(b.exit.restore,{...b.enter,cg:null})});
 check('CG每编号仅单节点触发，不由拆段倍增',()=>{let used=new Set;for(const b of byId.values())if(b.cgId){assert(!used.has(b.cgId));used.add(b.cgId)}});
 check('选择清CG并保留原始条件',()=>{for(const n of ctx.nodes.filter(n=>n.packageId===pack&&n.op==='choice')){assert.equal(byId.get(n.nodeId).cgId,null);assert.equal(byId.get(n.nodeId).condition,n.condition)}});
 check('开放需求全双向回链且单元blocked',()=>{for(const n of docs.needs.needs)for(const id of n.nodeIds){let r=docs.review.reviews.find(r=>r.nodeIds.includes(id));assert(r.needIds.includes(n.needId));assert.equal(r.status,'blocked')}});
 if(code==='MY'){
  check('第90/91天四组合电话/消息不出现孟遥现场',()=>{empty(449,487);empty(489,565)});
  check('MY07=B前台归还无亲密CG及住处背景',()=>{for(let i=430;i<=448;i++){assert.equal(at(i).cgId,null);assert.notEqual(at(i).enter.background?.assetId,'bg-mengyao-guiyang-home-day')}});
  check('A过夜已按MY07=A冻结，不按未来MY09倒推',()=>{for(let i=322;i<=349;i++){assert.equal(at(i).condition,'MY07-01=A');assert(!at(i).condition.includes('MY09'))}});
  check('电源线交出后停止持物，A贵阳场景不出现丈夫',()=>{assert(at(439).enter.characters.some(c=>c.assetId==='chensheng-cable'));assert(!at(442).enter.characters.some(c=>c.assetId==='chensheng-cable'));for(let i=396;i<=429;i++)assert(!at(i).enter.characters.some(c=>c.assetId.startsWith('chensheng')))});
  check('第28天不是教学衬衫',()=>{for(let i=149;i<=176;i++)assert(at(i).enter.characters.every(c=>c.assetId==='char-mengyao-human-casual-jacket'))});
  check('缺电梯背景不借用错误文文旧房',()=>assert.equal(at(429).enter.background,null));
  check('下午光照复核需求涵盖MY10选择页',()=>assert(docs.needs.needs.find(n=>n.resourceKey==='my-rental-afternoon-light').nodeIds.includes('MY10-01')));
 }else{
  check('scene-260群消息不显示三人现场',()=>empty(638,647));
  check('scene-260在见面时恢复、交机后清持机',()=>{assert(at(648).enter.characters.some(c=>c.assetId==='piao-action-camera'));assert(!at(649).enter.characters.some(c=>c.assetId==='piao-action-camera'))});
  check('scene-260 B离场与第58天链接消息清人物',()=>{empty(656,656);empty(667,667);empty(671,671)});
  check('HIGH第十章电子图不重演返乡现场',()=>empty(505,506));
  check('CG066仍明确阻塞返修',()=>{let need=docs.needs.needs.find(n=>n.cgId==='CG066');assert.equal(need.action,'repair');assert.equal(need.status,'open');assert.equal(at(334).cgId,'CG066')});
  check('LOW CG068递机后退CG且女主不再持机',()=>{assert.equal(at(705).cgId,'CG068');for(let i=706;i<=709;i++){assert.equal(at(i).cgId,null);assert(!at(i).enter.characters.some(c=>c.assetId==='piao-action-camera'))}});
  check('CG061在许可后，CG070限定收图发送',()=>{assert.equal(at(586).cgId,null);assert.equal(at(589).cgId,'CG061');assert.equal(at(710).cgId,'CG070');for(let i=711;i<=720;i++)assert.equal(at(i).cgId,null)});
  check('LOW摄影/孩子边界不用HIGH封二道具',()=>{for(let i=573;i<ps.length;i++)assert(![...at(i).enter.characters,...at(i).enter.props].some(c=>['piao-action-booklet','piao-prop-booklet'].includes(c.assetId)))});
  check('PI-LE2从消息进入新聚会时重建现场',()=>{empty(710,714);assert(at(715).enter.characters.length>0);assert.equal(at(715).condition,'PIAO_RELATION=LOW&PI-L06-01=B')});
 }
 check('未通过P4-05的包不得通过handoff',()=>assert.throws(()=>V.validatePack(ctx,pack,docs),/未决需求|未审|尚未通过|未通过/));
 fs.writeFileSync(qa+'/semantic-verification.json',JSON.stringify({packageId:pack,status:'pass',checks:results,notRuntimeAcceptance:true,limitations:'这些断言验证候选状态和关键分支限制，不替代美术全尺寸复验、实际裁切和引擎运行。'},null,2)+'\n');console.log(pack,results.length+' checks passed');
}
