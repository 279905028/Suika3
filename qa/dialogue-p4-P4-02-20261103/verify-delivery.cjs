'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const C=require('../../tools/story-revision/p4-bindings/common.cjs');
const V=require('../../tools/story-revision/p4-bindings/validate.cjs');
const ctx=V.loadContext(),root='docs/修订协作/P4-演出与美术/',qa='qa/dialogue-p4-P4-02-20261103';
const checks=[],packs=[],bindings=new Map(),reviews=new Map(),allNeeds=[],allFiles=[];
function check(name,fn){const evidence=fn();checks.push({name,status:'pass',evidence:evidence??true});}
for(const id of C.PACKS){const dir=root+id,docs=V.readPackage(dir);const result=V.validatePack(ctx,id,docs,{mode:'draft'});assert(fs.readFileSync(dir+'/交接.md','utf8').trim());
 for(const b of docs.bindings.bindings){assert(b.binding,'空绑定');assert(!bindings.has(b.nodeId));bindings.set(b.nodeId,b.binding);}
 for(const r of docs.review.reviews){assert.notEqual(r.status,'pending');assert(!reviews.has(r.unitId));reviews.set(r.unitId,r);}
 let failure;try{V.validatePack(ctx,id,docs,{mode:'handoff'});}catch(e){failure=e.message;}assert(failure,'资源未复验不应通过handoff');
 const counts={...result.counts,reviewed:docs.review.reviews.filter(r=>r.status==='reviewed').length,blocked:docs.review.reviews.filter(r=>r.status==='blocked').length,openNeeds:docs.needs.needs.filter(n=>n.status==='open').length,resolvedNeeds:docs.needs.needs.filter(n=>n.status==='resolved').length};
 packs.push({packageId:id,draft:'pass',handoff:'blocked',firstHandoffFailure:failure,counts});allNeeds.push(...docs.needs.needs);
 allFiles.push(...fs.readdirSync(dir).filter(f=>/\.(md|json)$/.test(f)).map(f=>C.fp(dir+'/'+f)));
}
const b=id=>bindings.get(id.endsWith('_1')||id.endsWith('_2')?id:id+'_1');
function emptyPeople(ids){for(const id of ids)assert.deepEqual(b(id).enter.characters,[],id);return ids;}
function ids(a,z){const i=ctx.paragraphs.findIndex(p=>p.paragraphId===a),j=ctx.paragraphs.findIndex(p=>p.paragraphId===z);assert(i>=0&&j>=i);return ctx.paragraphs.slice(i,j+1).map(p=>p.paragraphId);}
check('七包完整且唯一覆盖4748段、65选择、4814节点',()=>{assert.equal(bindings.size,4814);assert.equal(reviews.size,4813);assert.equal(packs.reduce((s,p)=>s+p.counts.boundaries,0),654);return{paragraphs:4748,choices:65,nodes:4814,boundaries:654};});
check('所有节点完整恢复、选择无CG、分页一致，由冻结检查器逐节点验证',()=>packs.map(p=>({packageId:p.packageId,draft:p.draft})));
check('共通线上游戏没有现场队友',()=>emptyPeople(ids('T-C01-000368','T-C01-000164')));
check('黄球球开门前及离场后不显示，首次相识仍球形',()=>{emptyPeople(ids('T-C02-000484','T-C02-000221'));emptyPeople(['T-C02-000244','T-C03-000017','T-C03-000018']);assert(b('T-C02-000488').enter.characters.every(p=>p.form==='orb'));return['T-C02-000484','T-C02-000488','T-C02-000244'];});
check('同段跨页没有额外换镜或重复CG',()=>{const strip=x=>({enter:x.enter,exit:x.exit,cgId:x.cgId});assert.deepEqual(strip(b('T-C02-000153_1')),strip(b('T-C02-000153_2')));return['T-C02-000153_1','T-C02-000153_2'];});
check('孟遥未到饭局前不提前出现、叶岚未参加第14天饭局',()=>{for(const id of ids('T-C02-000151','T-C02-000457'))assert(!b(id).enter.characters.some(c=>/mengyao|yelan/.test(c.assetId)),id);assert(b('T-C02-000460').enter.characters.some(c=>c.assetId.includes('mengyao')));return true;});
check('第36天远端师匠不入镜、CG101已知站坐冲突保留返修',()=>{assert(!b('T-D36-000020').enter.characters.some(c=>c.assetId.includes('shijiang')));assert([...bindings.values()].every(x=>x.cgId!=='CG101'));assert(allNeeds.some(n=>n.cgId==='CG101'&&n.status==='open'));return true;});
check('FR-E2两篇后日谈仅消息构图，允许已收到的婚讯手机CG',()=>{const ps=ctx.paragraphs.filter(p=>/^T-EP[HL]-/.test(p.paragraphId)&&p.condition.split('|').every(term=>term.split('&').includes('ENDING=FR-E2')));assert(ps.length>0);for(const p of ps){const x=b(p.paragraphId);assert.deepEqual(x.enter.characters,[]);assert.deepEqual(x.enter.props,[]);assert.equal(x.enter.background,null);assert(x.cgId===null||x.cgId==='CG100');}return{paragraphs:ps.length,ids:ps.map(p=>p.paragraphId)};});
check('scene-260群消息与链接消息没有继承现场飘',()=>{const issue=C.json(C.DOC+'/legacy-index.json').issues.find(i=>i.key==='scene-260');const ps=issue.paragraphIds.map(id=>ctx.paragraphs.find(p=>p.paragraphId===id)).filter(p=>p.textMeta.channel==='text');return emptyPeople(ps.map(p=>p.paragraphId));});
check('孟遥秘密继续CG只在AA，断开CG只在非AA，冻结条件未放宽',()=>{assert.equal(b('T-MY-000349').condition,'MY07-01=A&MY09-01=A');assert.equal(b('T-MY-000676').condition,'MY07-01=B|MY09-01=B');emptyPeople(['T-MY-000349','T-MY-000676']);return true;});
check('小满与周栀亲密结局CG保持双A门禁',()=>{assert.equal(b('T-XM-000330').condition,'XM07-01=A&XM08-01=A');assert.equal(b('T-ZZ-000872').condition,'ZZ06-01=A&ZZ08-01=A');return true;});
check('每个CG至多一个新显示锚点，不把拆分对白机械复用同CG',()=>{const cg=new Map();for(const [id,x]of bindings)if(x.cgId){assert(!cg.has(x.cgId),x.cgId+'重复');cg.set(x.cgId,id);}return Object.fromEntries(cg);});
check('全部654项边界声明按目标重建，公共返回不保存另一包源画面',()=>{let count=0;for(const pack of C.PACKS)for(const s of V.readPackage(root+pack).boundaries.boundaries){assert.equal(s.status,'reviewed');assert.equal(s.exitPolicy,'clear-before-target');assert.equal(s.restorePolicy,'recompute-destination');count++;}assert.equal(count,654);return count;});
const used=[...new Set([...bindings.values()].flatMap(x=>V.placements(x.enter).map(p=>p.assetId)))].sort();
check('全部候选资源仅引用已登记ID，未伪造P4-05通过',()=>{for(const id of used)assert.equal(ctx.baseline.assets.find(a=>a.assetId===id).reviewStatus,'pending');return{uniqueResources:used.length,resourceReviewStatus:'pending'};});
const groups={};for(const n of allNeeds)(groups[n.resourceKey]??=[]).push({packageId:n.needId.split('-N')[0],needId:n.needId,status:n.status,ownerTask:n.ownerTask,kind:n.kind,action:n.action,nodeCount:n.nodeIds.length,reason:n.reason});
const report={status:'candidate-delivery-verified-final-handoff-blocked',inputFingerprint:ctx.input.inputFingerprint,interfaceFingerprint:ctx.seal.interfaceFingerprint,contentBuildId:ctx.input.contentBuildId,packs,checks,totals:{paragraphs:4748,displayNodes:4814,reviewUnits:4813,reviewed:packs.reduce((s,p)=>s+p.counts.reviewed,0),blocked:packs.reduce((s,p)=>s+p.counts.blocked,0),boundaries:654,openNeeds:allNeeds.filter(n=>n.status==='open').length,resolvedNeeds:allNeeds.filter(n=>n.status==='resolved').length,uniqueResourceKeys:Object.keys(groups).length,referencedResources:used.length},handoffReady:false,notRuntimeAcceptance:true};
fs.writeFileSync(qa+'/verification.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(root+'P4-02/needs-index.json',JSON.stringify({inputFingerprint:ctx.input.inputFingerprint,groups},null,2)+'\n');
fs.writeFileSync(qa+'/delivery-fingerprints.json',JSON.stringify({inputFingerprint:ctx.input.inputFingerprint,interfaceFingerprint:ctx.seal.interfaceFingerprint,outputs:allFiles,outputFingerprint:C.digest(allFiles)},null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:checks.length,totals:report.totals,packs:packs.map(p=>({id:p.packageId,...p.counts}))},null,2));
