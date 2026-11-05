#!/usr/bin/env node
'use strict';
// 本批仅补无背景节点，保留正文、路线、人物、道具、CG及历史P4冻结。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hash}=require('../../compiler/parse.cjs');
const {compile}=require('../../compiler/compile.cjs');
const ROOT=path.resolve(__dirname,'../../..'),QA='qa/background-fill-20261104',DOC='docs/美术/背景补全-20261104';
const VERSION='sui-bg-fill-20261104-v1',BUILD=QA+'/build';
const read=p=>fs.readFileSync(path.join(ROOT,p)),json=p=>JSON.parse(read(p)),fp=p=>({path:p,sha256:hash(read(p))});
function write(p,v){fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');}
const clone=x=>structuredClone(x);
const ids={phone:'bg-insert-phone-neutral',computer:'bg-insert-computer-neutral',papers:'bg-insert-papers-neutral',coach:'bg-intercity-coach-neutral',street:'bg-guiyang-roadside-overcast',elevator:'bg-elevator-interior-neutral',wall:'bg-xiaoman-packing-interior'};
function prepare(){
  assert(!fs.existsSync(path.join(ROOT,DOC+'/plan.json')),'不得覆盖本批计划');
  const frozen=json('docs/修订协作/P4-演出与美术/P4-07/freeze.json');
  const observedConcurrentFiles=new Set(['tools/integration/runtime/presentation-full.ray','tools/story-revision/p4-adoption/build.cjs']);
  const drift=[];for(const f of frozen.files){const now=fp(f.path).sha256;if(now!==f.sha256){assert(observedConcurrentFiles.has(f.path),'未经本批评估的输入变化 '+f.path);drift.push({path:f.path,p4FrozenSha256:f.sha256,currentSha256:now});}}
  // CG停留保护是并行任务的已观察修改；原P4冻结不回写，记录精确输入并在新包验证。
  write(QA+'/concurrent-inputs.json',{status:'recorded',unchanged:frozen.files.length-drift.length,changed:drift,scope:'保留已观察的CG停留保护与构建兼容调整；不冒称原P4冻结仍全匹配。'});
  require('../../story-revision/p4-adoption/validate.cjs').validate({adopted:true});
  const audit=json('qa/current-visual-audit-20261104/report.json'),M=json(QA+'/before/assets/current/manifest.json'),B=json(QA+'/before/docs/整合/bindings.json');
  assert.equal(fp('assets/current/manifest.json').sha256,fp(QA+'/before/assets/current/manifest.json').sha256);assert.deepEqual(json('docs/整合/bindings.json'),B);
  const source=compile({pageSize:108,textPolicy:'required'});assert.equal(source.ir.buildId,B.contentBuildId);
  const records=json('assets/sources/20261104/background-fill/resource-records.json'),newIds=new Set(records.map(x=>x.assetId)),assets=new Map([...M.assets,...records].map(x=>[x.assetId,x]));
  const plan=new Map();
  const choose=(nodeId,assetId,basis,mode)=>{
    const b=B.bindings.find(x=>x.anchor.nodeId===nodeId);assert(b&&!b.enter.background,'仅允许补空背景 '+nodeId);assert(assets.has(assetId));
    plan.set(nodeId,{nodeId,assetId,mode:mode||(newIds.has(assetId)?'new':'reuse'),basis,file:b.anchor.file,condition:b.condition,routeIds:b.routeIds,
      previousRestrictions:b.restrictions,priorStateSha256:hash(JSON.stringify(b.enter))});
  };
  // 每个连续区间均显式登记，不通过猜词给所有消息安放具体房间。
  const defaults={
    R001:'computer',R002:'computer',R003:'phone',R004:'phone',R005:'phone',R006:'phone',R007:'phone',R008:'phone',R009:'phone',
    R010:'phone',R011:'wall',R012:'wall',R013:'papers',R014:'street',R015:'coach',R016:'phone',R017:'phone',R018:'phone',R019:'phone',
    R020:'street',R021:'street',R022:'wall',R023:'phone',R024:'phone',R025:'phone',R026:'phone',R027:'phone',R028:'phone',R029:'elevator',R030:'street',
    R031:'phone',R032:'phone',R033:'phone',R034:'phone',R035:'phone',R036:'phone',R037:'phone',R038:'phone',R039:'papers',R040:'phone',R041:'computer',R042:'papers',
    R043:'phone',R044:'computer',R045:'phone',R046:'papers',R047:'coach',R048:'phone',R049:'phone',R050:'coach',R051:'phone',R052:'phone',R053:'phone',R054:'phone',
    R055:'wall',R056:'wall',R057:'phone',R058:'wall',R059:'wall',R060:'coach',R061:'wall',R062:'bg-huangqiuqiu-room-day',R063:'bg-bijie-slope-street-night',R064:'bg-wenwen-bijie-rental-day',
    R065:'phone',R066:'phone',R067:'phone',R068:'phone',R069:'bg-old-netcafe-yard-door-closed-morning',R070:'papers',R071:'phone',R072:'phone',R073:'phone',R074:'phone',
    R075:'phone',R076:'phone',R077:'phone',R078:'phone',R079:'phone',R080:'phone',R081:'phone',R082:'wall',R083:'wall',R084:'wall',R085:'phone',R086:'phone',
    R087:'phone',R088:'phone',R089:'phone',R090:'phone',R091:'phone',R092:'phone',R093:'phone',R094:'phone',R095:'phone'
  };
  const reasons={phone:'用户确认地点未明的消息/电话采用中性手机特写；无可读内容与远端人物，不指定收信地点。',computer:'文本明确线上游戏/文件操作；中性电脑局部不标识网吧或住所，不把远程队友画在现场。',papers:'文本涉及材料、页稿或行程记录；中性纸页特写不画可读文书，不指定所在房间。',coach:'文本明确已在返程车上；共用无地标/无时刻的客车车厢，不把市内公交当城际客车。',street:'文本明确在贵阳楼下/路边；共用匿名街面，不借用毕节坡街或周栀私人住处。',elevator:'文本明确电梯内的独白；新电梯局部不补楼层、地址或其他人。',wall:'复用已存在的无标识米色墙面局部，作为中性近景/概述衬底；不将画面重新解释为小满家或确认室内地点。'};
  assert.equal(Object.keys(defaults).length,audit.rainOnlyRuns.length);
  for(const run of audit.rainOnlyRuns){const key=defaults[run.id],assetId=ids[key]||key;assert(assetId);for(const id of run.nodeIds)choose(id,assetId,reasons[key]||({R062:'前段明确回忆下午黄球球房内调收音机；复用房间昼景，只作回忆，不让她在回声现场出现，下一实际目标回到回声。',R063:'第30天21:15小吃摊至后院的跨地点叙述，复用毕节夜街，仅街面，不绑定小满朋友摊位或老板。',R064:'正文以回自己的住处睡觉收尾；复用文文毕节租屋昼景，不显示被拒绝进入的球球房间。',R069:'第62晚至第63清晨蒙太奇，以明确的次晨闭门纸条收尾；复用闭门清晨，不显示球球或开门。'}[run.id]));}
  // 同一段落含转场时，仅在文本已确认的地点使用既有图，其余保留中性插入。
  for(const id of ['T-XM-000780_1','T-XM-000781_1','T-XM-000782_1','T-XM-000783_1','T-XM-000784_1','T-XM-000378_1'])choose(id,ids.coach,reasons.coach);
  for(const id of ['T-ZZ-000432_1','T-ZZ-000433_1','T-ZZ-000434_1'])choose(id,'bg-departure-station-morning-rain','明确去车站并在站台停留；复用无地标、无时钟的灰天车站遮棚，不指定站名/交通种类，不描画远端周栀摊位。');
  for(const id of ['T-ZZ-000951_1','T-ZZ-000952_1','T-ZZ-000436_1'])choose(id,ids.coach,reasons.coach);
  choose('T-PI-000395_1',ids.street,reasons.street);
  // 下列画面已有立绘/道具或单页CG，补足底层并保持原人物与CG进入/退出。
  for(const b of B.bindings.filter(b=>!b.enter.background&&!plan.has(b.anchor.nodeId))){
    const id=b.anchor.nodeId;
    let assetId=ids.wall,basis=reasons.wall;
    if(id==='T-C01-000372_1'){assetId=ids.computer;basis=reasons.computer;}
    if(id==='T-EPH-000147_1'){assetId=ids.phone;basis=reasons.phone;}
    if(id==='T-PI-000327_1'){assetId=ids.papers;basis=reasons.papers;}
    if(['T-PI-000458_1','T-PI-000459_1'].includes(id)){assetId='bg-old-netcafe-backroom-night';basis='文本十点前洗饭盒回柜台交接，复用既有网吧后间夜景，与下一实际目标一致；毛狼原立绘不变。';}
    choose(id,assetId,basis);
  }
  assert.equal(plan.size,495);
  const decision={date:'2026-11-04',version:VERSION,sourceVersion:B.version,contentBuildId:B.contentBuildId,authorization:{request:'补充这些场景图，尽量复用已有的场景，不行再另外生成',clarification:'地点未写明的消息、电话和概述使用中性特写背景',tool:'内置image_gen；未调用外部付费API'},scope:'只补无背景状态；正文、选择、人物、道具、81CG和解锁均保持。',plan:[...plan.values()],newAssetIds:[...newIds],counts:{affectedNodes:plan.size,newImages:records.length,reuseNodes:[...plan.values()].filter(p=>p.mode==='reuse').length,newImageNodes:[...plan.values()].filter(p=>p.mode==='new').length},build:BUILD};
  write(DOC+'/plan.json',decision);write(QA+'/plan.json',decision);
  console.log(JSON.stringify(decision.counts));return decision;
}
function candidate(){
  const p=json(DOC+'/plan.json'),M=clone(json(QA+'/before/assets/current/manifest.json')),B=clone(json(QA+'/before/docs/整合/bindings.json'));
  const resourceRecords=json('assets/sources/20261104/background-fill/resource-records.json');
  const approval={path:DOC+'/plan.json',sha256:fp(DOC+'/plan.json').sha256},inspection={path:QA+'/image-check.json',sha256:fp(QA+'/image-check.json').sha256,task:'背景补全-20261104'};
  for(const r of resourceRecords)M.assets.push({assetId:r.assetId,type:'background',sourcePath:r.sourcePath,sourceSha256:r.sourceSha256,runtimePath:r.runtimePath,runtimeSha256:r.runtimeSha256,
    bytes:r.bytes,width:r.width,height:r.height,format:'WEBP',alpha:false,encoding:{lossless:true,tool:'Pillow WebP lossless',parameters:'lossless=True,method=6；PNG/WebP完整RGBA像素一致'},
    approval:{status:'approved',evidence:approval,scope:[r.assetId,'用户本批授权新增必要背景及确认中性特写；仅按计划绑定使用。']},inspection,
    restrictions:['不以中性插入图推定具体地点、时刻、日期、关系或人物在场；无可读文本。','不参与CG图鉴与解锁；原81项CG保持。']});
  const assets=new Map(M.assets.map(a=>[a.assetId,a]));
  for(const row of p.plan){const b=B.bindings.find(b=>b.anchor.nodeId===row.nodeId),a=assets.get(row.assetId);assert(!b.enter.background);assert.equal(hash(JSON.stringify(b.enter)),row.priorStateSha256);
    const scale=Math.min(1280/a.width,720/a.height),bg={assetId:a.assetId,layer:'bg',x:(1280-a.width*scale)/2,y:(720-a.height*scale)/2,scale,form:null,costume:null};
    b.enter.background=bg;b.exit.restore.background=clone(bg);
    b.restrictions=[`背景补全-20261104：${row.basis}`,...b.restrictions.map(t=>/阅读底|雨窗/.test(t)?'前版留白依据（本批已补背景；视角限制保留）：'+t:t)];
  }
  const reused=new Set(p.plan.filter(r=>r.mode==='reuse').map(r=>r.assetId));
  for(const a of M.assets.filter(a=>reused.has(a.assetId)))a.backgroundFillUsage={plan:approval,nodeIds:p.plan.filter(r=>r.assetId===a.assetId).map(r=>r.nodeId),scope:a.assetId===ids.wall?'仅借用无标识墙面纹理作为中性衬底，不表示跨线共用小满住处。':'按本批明确地点/时刻范围复用；原件与其他绑定不变。'};
  M.version=VERSION;M.scope={...M.scope,description:'P4正式版基础上补全495个无背景节点；共268资源、81静态CG。'};
  M.backgroundFill={plan:DOC+'/plan.json',sourceVersion:p.sourceVersion,build:BUILD};
  B.version=VERSION;B.backgroundFill=M.backgroundFill;B.manifestSha256=hash(JSON.stringify(M,null,2)+'\n');
  write(DOC+'/manifest.candidate.json',M);write(DOC+'/bindings.candidate.json',B);return {M,B,p};
}
if(require.main===module){if(process.argv[2]==='prepare')prepare();else if(process.argv[2]==='candidate')candidate();else throw Error('使用 prepare 或 candidate');}
module.exports={ROOT,QA,DOC,VERSION,BUILD,read,json,write,fp,prepare,candidate};
