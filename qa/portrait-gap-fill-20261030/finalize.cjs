'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),Q='qa/portrait-gap-fill-20261030';
const version=process.argv[2]||'sui-i02-20261030-portraits-v2';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const put=(p,v)=>fs.writeFileSync(path.join(ROOT,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const R=read(Q+'/review.json'),C=read(Q+'/binding-changes.json'),S=read('assets/sources/20261030-portrait-gap-fill/selected.json');
const offline=read(Q+'/binding-check.json'),routes=read(Q+'/'+version+'/routes/routes-report.json'),portraits=read(Q+'/'+version+'/portraits/report.json');
const pkg=require('../../tools/integration/runtime/verify-package.cjs').verify(path.join(ROOT,'dist',version));
assert.equal(offline.status,'PASS_OFFLINE_BINDINGS_AND_GENERATED_STATE_MODEL');assert.equal(routes.status,'pass');assert.equal(portraits.status,'pass');assert.equal(routes.results.length,7);
assert(Object.values(routes.expressionCoverage).every(Boolean));assert.equal(Object.keys(routes.expressionCoverage).length,14);
assert.deepEqual(routes.errors,[]);assert.deepEqual(portraits.errors,[]);
const candidate=read('build/'+version+'/candidate-manifest.json');
assert.equal(hash('assets/current/manifest.json'),candidate.handoff.manifest.sha256);assert.equal(hash('docs/整合/bindings.json'),candidate.handoff.bindings.sha256);
const summary={status:'pass',version,artVersion:C.version,reviewedParagraphs:786,newImages:14,newDrawingParagraphs:54,reusedParagraphs:10,
 newPortraitParagraphs:64,additionalExistingTextParagraphs:55,choiceNodes:3,modifiedNodes:122,remainingBackgroundParagraphs:722,
 currentParagraphs:{total:3019,portraitsWithoutCG:2237,cg:60,backgroundOnly:722},
 validation:{sourceAndOriginal212ImageBytesUnchanged:true,rgbaExactImages:14,newNPCsWithBrowserScreenshots:14,
  chromeRepresentativePaths:7,narrativeVisits:routes.results.reduce((n,r)=>n+r.narrativePages,0),choiceClicks:routes.results.reduce((n,r)=>n+r.nativeChoiceClicks,0),
  newPortraitPersistenceChecks:portraits.checks.length,errors:0,offlinePlatforms:offline.platforms,packageFiles:pkg.outputs},
 inputs:{manifest:candidate.handoff.manifest,bindings:candidate.handoff.bindings,snapshot:candidate.handoff.snapshot},
 evidence:{review:Q+'/review.json',images:Q+'/image-checks.json',offline:Q+'/binding-check.json',routes:Q+'/'+version+'/routes/routes-report.json',persistence:Q+'/'+version+'/portraits/report.json'},
 scope:'本批786段已逐段决定并应用。保留段落不等于缺图；没有新增剧情。不是所有NPC/动作逐拍重绘，不代表其他浏览器、手机真机、电脑原生、完整全分支或发布验收。'};
put(Q+'/final-verification.json',summary);put(Q+'/package-check.json',pkg);
const rows=S.assets.map(a=>{const n=R.paragraphs.filter(p=>p.decision==='new'&&p.assetId===a.assetId).length;return '| '+a.name+' | '+n+' |';}).join('\n');
const md=`# 逐段筛定与立绘补全\n\n2026-10-30｜候选 \`${version}\`｜[本机预览](http://127.0.0.1:49262/)\n\n**786段已逐段核对：54段需要新图、10段可复用、722段保留画外。新增并接入14张普通配角立绘，共补齐64段原本只有背景的正文。**\n\n此外，为同一配角的前后出场补齐55段既有画面的同框与3个选择节点，共修改122个显示节点；正文、选择、数值、分支、结局及原212项图片字节未改。全篇现为2,237段立绘、60段CG、722段背景，共3,019段。\n\n## 筛定依据\n\n持续当面交流、关键当前交接及选择需要人物肖像；有适用图片即复用。独白、电话/群聊/视频、未开门、离场、回忆转述、关灯留白与仅作环境细节的短暂服务保留原处理。未明确联络媒介时不推断见面。\n\n逐段文字、来源行号、决定及理由见[786段清单](review.json)；[人工规则](../../tools/art/portrait-gap-review.cjs)没有关键词兜底分类。已逐项检查恰好覆盖786段，既无遗漏也无重复。这里只统计本批筛定的画面缺口。\n\n## 新图数量\n\n| 新增肖像 | 原缺图段数 |\n| --- | ---: |\n${rows}\n| 合计14张 | 54 |\n\n每张均有PNG原件及等像素无损WebP，按14项画面计数。使用内置imagegen；[最终选集与来源](../../assets/sources/20261030-portrait-gap-fill/selected.json)、[完整提示词](../../assets/sources/20261030-portrait-gap-fill/prompts-final.json)、[角色总览](角色总览.jpg)。保留4份未采用稿：3份偏精致首稿与1份和阿俊偏相似的新人图。新人采用短圆脸/普通眼镜v002。\n\n外形按用户“由你按正文身份设计并补入游戏”“普通人，不要太好看”的授权选用，非用户逐图选型。窗口工作人员与交钥匙的人、原/新杂货店主分别设计；不新增精确年龄、婚史、家庭、疾病或其他剧情经历。\n\n## 实际验证\n\n- 14组PNG/WebP真实格式、1024×1536、alpha与全部RGBA像素一致；四底合成目视通过，见[图片检查](image-checks.json)与[目视记录](visual-review.json)。李老板左上角原生1/255 alpha保留，合成下不可见，没有手工重写原件。\n- 两平台各3,086次合法恢复与18,516种损坏状态拒绝通过；全部进退场状态比较通过，FR-E2消息视角、黄球球开门与形态保持，见[离线结果](binding-check.json)。\n- 本批候选Chrome六线7条代表路径通过：${summary.validation.narrativeVisits.toLocaleString('en-US')}次正文页访问、${summary.validation.choiceClicks}次鼠标选择，14名新增配角全部有非CG覆盖的运行截图，错误为零。见[路径结果](${version}/routes/routes-report.json)与[运行总览](运行截图总览.jpg)。\n- 新增陈孃自然到达、退场、保存/读取、关闭重开、回退C01-01改选B后再到场共5项通过；保存/读取/重开的人物区域像素一致，见[专项结果](${version}/portraits/report.json)。所有测试使用独立临时浏览器资料，未访问玩家旧档。\n- ${pkg.outputs}项分发文件校验通过；网页和三个电脑目录生成，电脑原生未实测，本批未制作ZIP。\n\nv1检查后检测到工程新增已批准的B封面循环动画，最终v2重新消费当前工具与封面入口，并重跑上述浏览器验证。初次专项误把回退后紧随的stable事件当作未回退，原生rollback已实际发生；修正断言后重跑通过，首次失败证据保留在v1的portraits-attempt-1。首次受限环境不能启动本机服务与Chrome，获系统执行许可后完成实测。\n\n## 使用与边界\n\n打开[本机补全版](http://127.0.0.1:49262/)后重新开始。旧候选与旧档保留。本次候选保留当前电影侧栏与B封面动画。\n\n本批完成逐段筛定、14张基础对话肖像制作/接入和上述Chrome验证。没有逐拍重绘理发、搬运、卧床等身体动作，也未新增Firefox/Safari、手机真机、电脑原生运行、长期压力或发布验收；既有正文/CG/Firefox问题继续按原待办处理。剩余722段按本批画面设计保留，不计作尚缺722张图。\n`;
put(Q+'/结果报告.md',md);
put('docs/美术/立绘补全-20261030.md',`# 立绘补全｜2026-10-30\n\n786段逐段筛定完毕：54段需补图、10段复用、722段保留画外。已用内置imagegen制作并接入**14张普通配角基础立绘**，补齐64段原本只有背景的正文，另完善55段同场配角及3个选择节点。\n\n[结果与14张用量](../../${Q}/结果报告.md) · [角色总览](../../${Q}/角色总览.jpg) · [运行总览](../../${Q}/运行截图总览.jpg) · [逐段清单](../../${Q}/review.json) · [本机预览](http://127.0.0.1:49262/)\n\n配角外形采用用户委托设计的普通人方向；原/新店主与不同交接岗位分别设计，不补造个人经历。原212项图与正文/条件保持。当前采用226项美术资源，冻结为 \`${C.version}\`。\n\nPNG/WebP像素、alpha和四底目视、两平台离线恢复及Chrome7条代表路径/5项专项通过；不代替逐拍动作、其他浏览器、手机真机、电脑原生或发布验收。旧A07制作包和QA作为历史保留，当前新增图以本批记录为准。\n`);
console.log(JSON.stringify({status:summary.status,version,newImages:14,newDrawingParagraphs:54,reusedParagraphs:10,remainingBackground:722,validation:summary.validation},null,2));
