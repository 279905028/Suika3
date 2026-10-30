#!/usr/bin/env node
'use strict';
// 只校验 Suika3/scenario 的编辑稿，不执行引擎、不读取玩家存档。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'scenario');
const OUT = path.join(ROOT, 'qa/route-merge-20261028');
const CHAPTERS = ['第三章','第四章','第五章','第六章','第七章','第八章','第九章','第十章'];
const ROUTES = [
  ['XM','罗小满-练习本.md','罗小满',['XM07-01','XM08-01']],
  ['ZZ','周栀-十一点四十七分.md','周栀',['ZZ06-01','ZZ08-01']],
  ['MY','孟遥-旧题.md','孟遥',['MY07-01','MY09-01']],
  ['PI','飘-空白页.md','飘',['PI06-01','PI08-01']],
  ['FR','朋友与职业-夜班.md','朋友与职业',['FR06-01','FR08-01']],
  ['HQ','黄球球-门后.md','黄球球',['HQ07-01','HQ08-01']]
];
const COMMON = ['第一章-回到毕节.md','第二章-十四天.md'];
const ENTRY = '第三章-选一条路.md';
const choicePattern = () => /^\*\*选择 ([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2})｜(.+)\*\*$/gm;
const endingPattern = () => /^#### 结局 ([A-Z]+-(?:L)?E[12])｜(.+)$/gm;
const read = name => fs.readFileSync(path.join(DIR, name), 'utf8');
const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const han = text => (text.match(/\p{Script=Han}/gu) || []).length;
const ids = text => [...text.matchAll(choicePattern())].map(m => m[1]);
const assignments = names => Array.from({length: 2 ** names.length}, (_, n) =>
  Object.fromEntries(names.map((id,i) => [id,(n >> i) & 1 ? 'B' : 'A'])));
function choices(text, file) {
  const matches = [...text.matchAll(choicePattern())];
  return matches.map((m,i) => {
    const part = text.slice(m.index, matches[i+1]?.index ?? text.length);
    const options = m[1] === 'ROUTE-01'
      ? [...part.matchAll(/^### (.+)｜(.+)$/gm)].map(x => [x[1],x[2]])
      : [...part.matchAll(/^#### ([AB])｜(.+)$/gm)].map(x => [x[1],x[2]]);
    assert.equal(options.length, m[1] === 'ROUTE-01' ? 6 : 2, file+' '+m[1]+'选项数量');
    if (m[1] !== 'ROUTE-01') assert.deepEqual(options.map(x=>x[0]), ['A','B'],m[1]+'选项顺序');
    return {id:m[1],question:m[2],options,file,line:text.slice(0,m.index).split('\n').length};
  });
}
function parseCondition(expr, knownChoices, knownEndings) {
  return expr.split('|').map(or => or.split('&').map(term => {
    const m = /^\s*([A-Z0-9_-]+)\s*(!=|=)\s*([A-Z0-9_-]+)\s*$/.exec(term);
    assert(m, '不支持的条件：'+expr);
    const [,field,operator,value] = m;
    if (field === 'PIAO_RELATION') assert(['HIGH','LOW'].includes(value),'未知飘关系：'+value);
    else if (field === 'ENDING') assert(knownEndings.has(value),'未知结局：'+value);
    else {
      assert(knownChoices.has(field),'未知选择条件：'+field);
      assert(['A','B'].includes(value),'未知选项：'+term);
    }
    return {field,operator,value};
  }));
}
function evaluate(ast, flags, onRead = () => {}) {
  return ast.some(group => group.every(({field,operator,value}) => {
    onRead(field);
    assert(Object.hasOwn(flags,field),'缺少明确阅读条件：'+field);
    return operator === '=' ? flags[field] === value : flags[field] !== value;
  }));
}
function validateConditions(text, knownChoices, knownEndings, file) {
  const stack = []; let count = 0;
  text.split('\n').forEach((raw,i) => {
    const line = raw.trim(), m = /^<!-- IF (.+) -->$/.exec(line);
    if (m) { parseCondition(m[1],knownChoices,knownEndings); stack.push(i+1); count++; }
    else if (line === '<!-- ENDIF -->') { assert(stack.length,file+':'+(i+1)+'多余ENDIF'); stack.pop(); }
    else if (/^<!--\s*(?:IF|ENDIF)\b/.test(line)) throw Error(file+':'+(i+1)+'条件标记格式错误');
  });
  assert.equal(stack.length,0,file+'条件未闭合：'+stack.join(','));
  return count;
}
function commonGuard(text) {
  // 两处旧稿入口以编辑说明写出；补成临时审阅条件，不改源文件。
  if (!text.includes('### 第8—9天｜')) return text;
  assert(text.includes('### 第九天') && text.includes('### 第14天深夜'),'共通入口锚点变化，需更新阅读器');
  return text.replace(/(^### 第8—9天｜[\s\S]*?)(?=^### 第九天)/m,'<!-- IF C01-02=A -->\n$1<!-- ENDIF -->\n')
    .replace(/(^### 第14天·20:30｜正式相识[\s\S]*?)(?=^### 第14天深夜)/m,'<!-- IF C01-02=A & C02-01=A -->\n$1<!-- ENDIF -->\n');
}
function render(text, flags, context) {
  const {knownChoices,knownEndings,external=[]} = context;
  const own = new Set(ids(text)), seen = new Set(external), stack = [];
  let inBody = false, currentChoice = null, option = null, connections = 0;
  const lines=[], visited=[], endings=[];
  for (const raw of text.split('\n')) {
    const line=raw.trim(), condition=/^<!-- IF (.+) -->$/.exec(line);
    if (condition) {
      const ast=parseCondition(condition[1],knownChoices,knownEndings), parent=stack.every(Boolean);
      stack.push(parent && evaluate(ast,flags,field => {
        assert(!own.has(field)||seen.has(field),'条件提前读取未访问选择：'+field);
      })); continue;
    }
    if (line==='<!-- ENDIF -->') {assert(stack.length,'多余ENDIF');stack.pop();continue;}
    const active=stack.every(Boolean);
    if (/^#{2,3} 第[三四五六七八九十]+章｜/.test(line)) {inBody=false;currentChoice=null;option=null;continue;}
    if (/^(?:#{2,3} 剧情简介|\*\*剧情简介\*\*)/.test(line)) {inBody=false;currentChoice=null;option=null;continue;}
    if (/^(?:#{2,3} 完整内容|\*\*完整内容\*\*)/.test(line)) {inBody=true;currentChoice=null;option=null;continue;}
    const c=/^\*\*选择 ([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2})｜(.+)\*\*$/.exec(line);
    if(c) {
      currentChoice=c[1]; option=null;
      if(active&&inBody) {assert(Object.hasOwn(flags,c[1]),'缺少选择：'+c[1]); seen.add(c[1]);visited.push(c[1]);}
      continue;
    }
    const opt=/^#### ([AB])｜/.exec(line);
    if(opt) {assert(currentChoice,'选项没有所属选择');option=opt[1];continue;}
    if(/^#### 共同段$/.test(line)) {option=null;continue;}
    const eligible=active&&inBody&&(!option||flags[currentChoice]===option);
    const ending=/^#### 结局 ([A-Z]+-(?:L)?E[12])｜(.+)$/.exec(line);
    if(ending) {if(eligible) endings.push(ending[1]);continue;}
    if(line==='<!-- EPILOGUE PM -->') {if(eligible)connections++;continue;}
    if(!eligible||!line||/^(#|>|<!--|→)/.test(line)) continue;
    if(/^\[.+\]\(.+\)(?: · .*)?$/.test(line))continue;
    lines.push(line);
  }
  assert.equal(stack.length,0,'条件未闭合');
  const rendered=lines.join('\n\n');
  return {text:rendered,han:han(rendered),visited,endings,connections};
}
function markdownFiles(dir) {
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()
    ? markdownFiles(path.join(dir,e.name)) : e.isFile()&&e.name.endsWith('.md')?[path.join(dir,e.name)]:[]);
}
function audit({write=true}={}) {
  const report={scope:'当前编辑稿的结构、条件展开、索引和链接校验；不代表 Suika3 引擎、存档、浏览器或人工语义验收',
    projectRoot:ROOT,status:'running',checks:[],errors:[],warnings:[],manualReview:'脚本不证明亲密连续性的语义正确；独立审读结果及实读指纹见本批 manual-review.md。',engineStatus:'未接入；未运行引擎或访问玩家存档'};
  const check=(name,fn)=>{try{const detail=fn();report.checks.push({name,status:'pass',detail});return detail;}catch(e){report.errors.push({check:name,message:e.message});report.checks.push({name,status:'fail'});return null;}};
  const names=[...COMMON,ENTRY,...ROUTES.map(r=>r[1])];
  const all=[];
  for(const name of names)check('选择解析：'+name,()=>{const list=choices(read(name),name);all.push(...list);return {count:list.length};});
  const knownChoices=new Set(all.map(c=>c.id));
  const allEndings=ROUTES.flatMap(r=>[...read(r[1]).matchAll(endingPattern())].map(m=>m[1]));
  const knownEndings=new Set(allEndings);
  const context={knownChoices,knownEndings};
  report.totalChoices=all.length;
  report.totalOptions=all.reduce((n,c)=>n+c.options.length,0);
  report.totalDeclaredEndings=allEndings.length;
  report.choices=all;
  check('路线及选择唯一性',()=>{
    assert.equal(knownChoices.size,all.length,'选择ID重复');
    assert.equal(knownEndings.size,allEndings.length,'结局ID重复');
    assert.equal(ROUTES.length,6);
    assert(!fs.existsSync(path.join(DIR,'叶岚-下线.md')),'仍含可玩叶岚路线文件');
    const entry=all.find(c=>c.id==='ROUTE-01');
    assert.deepEqual(entry.options.map(o=>o[0]),['罗小满','周栀','孟遥','飘','朋友与职业','黄球球']);
    for(const file of fs.readdirSync(DIR).filter(n=>n.endsWith('.md')))
      assert(!/\bYL(?:\d{2}-\d{2}|-E[12])\b/.test(read(file)),file+'残留叶岚选择/结局ID');
    return {playableRoutes:6,publicRoutes:5,conditionalRoutes:1,declaredEndings:allEndings};
  });
  check('路线注册与婚姻结果契约',()=>{
    const registry=JSON.parse(fs.readFileSync(path.join(DIR,'routes.json'),'utf8'));
    assert.equal(registry.developmentRoot,ROOT);
    assert.equal(registry.status,'manuscript-only');assert.equal(registry.runtimeReady,false);
    assert.equal(registry.routes.length,6);assert.equal(new Set(registry.routes.map(r=>r.id)).size,6);
    assert(!registry.routes.some(r=>r.id==='yelan'||r.prefix==='YL'));
    for(const [prefix,file,name,keys] of ROUTES){const r=registry.routes.find(r=>r.prefix===prefix);assert(r,prefix+'未注册');assert.equal(r.file,file);assert.equal(r.name,name);assert.deepEqual(r.keyChoices,keys);assert.deepEqual(r.endings,[prefix+'-E1',prefix+'-E2']);}
    assert.equal(registry.mengyao.marriedTo,'陈晟');assert.equal(registry.mengyao.marriageEnds,false);
    assert.deepEqual(registry.mengyao.outcomes,{AA:'MY-E1',AB:'MY-E2',BA:'MY-E2',BB:'MY-E2'});
    assert.deepEqual(registry.mengyao.endingMeaning,{'MY-E1':'秘密关系继续','MY-E2':'彻底断开'});
    assert.equal(registry.mengyao.stoppedAtFirstChoiceCannotResume,true);
    const piao=registry.routes.find(r=>r.prefix==='PI');assert.equal(piao.lowPathChoice,'PI-L06-01');assert.deepEqual(piao.lowPathEndings,['PI-LE1','PI-LE2']);assert.equal(piao.relationRuleStatus,'unresolved');
    assert.deepEqual(registry.routes.find(r=>r.prefix==='HQ').entryRequires,['C01-02=A','C02-01=A','day14-meeting-read']);
    assert(registry.supportingOnly.includes('yelan'),'叶岚配角保留声明缺失');
    return {routes:registry.routes.length,mengyao:registry.mengyao,unresolved:registry.unresolved};
  });
  check('选择设计与正文一致',()=>{
    const rows=[...read('选择设计.md').matchAll(/^\| ([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2}) · [^|]+ \| ([^|]+) \| ([^|]+) \|$/gm)];
    assert.equal(rows.length,all.length,'全量选择索引行数');
    assert.equal(new Set(rows.map(r=>r[1])).size,rows.length,'全量选择索引重复');
    for(const c of all){const row=rows.find(r=>r[1]===c.id);assert(row,c.id+'索引缺失');assert.equal(row[2].trim(),c.question,c.id+'问题不一致');assert.deepEqual(row[3].trim().split(/<br\s*\/?\s*>/).map(s=>s.trim()),c.options.map(([label,text])=>label+'：'+text),c.id+'选项不一致');}
    return {matched:rows.length};
  });
  check('条件语法与引用',()=>{
    let count=0;for(const file of fs.readdirSync(DIR).filter(n=>n.endsWith('.md')))count+=validateConditions(read(file),knownChoices,knownEndings,file);
    assert.throws(()=>evaluate(parseCondition('PIAO_RELATION=LOW',knownChoices,knownEndings),{}),/缺少明确/);
    assert.throws(()=>parseCondition('UNKNOWN=A',knownChoices,knownEndings),/未知选择/);
    return {conditionBlocks:count,unknownCondition:'拒绝',missingPiaoRelation:'拒绝，不默认LOW'};
  });
  check('共通隐藏入口',()=>{
    const texts=COMMON.map(read), names=texts.flatMap(ids), unique=new Set();let hidden=0;
    for(const flags of assignments(names)){
      const a=render(texts[0],flags,context),b=render(commonGuard(texts[1]),flags,{...context,external:a.visited});
      const visited=[...a.visited,...b.visited];
      assert.equal(visited.includes('C02-01'),flags['C01-02']==='A');
      const unlocked=flags['C01-02']==='A'&&flags['C02-01']==='A';
      assert.equal(visited.includes('C02-07'),unlocked);
      const key=visited.map(id=>id+'='+flags[id]).join(',');
      if(!unique.has(key)){unique.add(key);if(unlocked)hidden++;}
    }
    return {assignments:2**names.length,distinctReadings:unique.size,hiddenEligibleReadings:hidden,method:'按两处明确前置说明临时补审阅条件，未修改原稿或实现引擎条件'};
  });
  report.routes=[];
  for(const [prefix,file,label,keys] of ROUTES)check('路线展开：'+label,()=>{
    const text=read(file), standard=text.split('## 低好感路径｜')[0];
    assert.deepEqual([...standard.matchAll(/^## (第[三四五六七八九十]+章)｜/gm)].map(m=>m[1]),CHAPTERS,file+'章节');
    const names=ids(standard);assert.equal(names.length,8,file+'主路径选择');
    const samples={}, combinations={AA:0,AB:0,BA:0,BB:0};
    for(const flags of assignments(names)){
      const result=render(text,{...flags,PIAO_RELATION:'HIGH'},context);
      assert.deepEqual(result.visited,names,file+'选择访问变化');
      const combination=keys.map(k=>flags[k]).join(''),expected=prefix+'-E'+(combination==='AA'?'1':'2');
      assert.deepEqual(result.endings,[expected],file+' '+combination+'结局');
      assert.equal(result.connections,expected==='PI-E1'?0:1,file+'后日谈标记');
      combinations[combination]++;
      samples[combination]??={flags,ending:expected,han:result.han,textSha256:hash(result.text)};
    }
    const detail={prefix,file,chapters:8,assignments:256,combinations,samples};
    report.routes.push(detail);return detail;
  });
  check('飘低路径独立展开',()=>{
    const text=read('飘-空白页.md'),low=text.split('## 低好感路径｜')[1];
    assert(low,'缺少低路径');assert.deepEqual([...low.matchAll(/^### (第[三四五六七八九十]+章)｜/gm)].map(m=>m[1]),CHAPTERS);
    assert.deepEqual(ids(low),['PI-L06-01']);
    for(const answer of ['A','B']){const result=render(text,{PIAO_RELATION:'LOW','PI-L06-01':answer},context);assert.deepEqual(result.visited,['PI-L06-01']);assert.deepEqual(result.endings,[answer==='A'?'PI-LE1':'PI-LE2']);assert.equal(result.connections,0,'低路径不能接高路径后日谈');}
    return {chapters:8,assignments:2,endings:['PI-LE1','PI-LE2'],relationRule:'条件枚举仅用于编辑稿校验，初值/判定时点/阈值仍待定'};
  });
  check('高关系后日谈展开',()=>{
    const text=read('后日谈-他们的日子.md');let count=0;
    for(const r of report.routes)for(const sample of Object.values(r.samples)){
      if(sample.ending==='PI-E1')continue;
      const result=render(text,{...sample.flags,ENDING:sample.ending,PIAO_RELATION:'HIGH'},context);
      assert(result.han>0,sample.ending+'后日谈为空');assert.equal(result.endings.length,0,'后日谈增加主结局');
      if(sample.ending==='FR-E2'){assert(!result.text.includes('毛狼把婚后的第一顿朋友饭约在小店'),'FR-E2读到现场相聚');}
      count++;
    }
    return {representativeReadings:count,excluded:'PI-E1',lowEpilogue:'低关系后日谈含叙事阅读提示，未据此宣称完整状态接续已实现'};
  });
  check('活跃Markdown链接',()=>{
    const files=[...markdownFiles(DIR),...markdownFiles(path.join(ROOT,'docs')),...['README.md','AGENTS.md','TODO-v1.1.md'].map(f=>path.join(ROOT,f)).filter(f=>fs.existsSync(f))];let count=0;
    const broken=[];
    for(const file of files)for(const m of fs.readFileSync(file,'utf8').matchAll(/\[[^\]]*\]\((<?[^)]+>?)\)/g)){
      let href=m[1].trim().replace(/^<|>$/g,'');if(/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href))continue;
      href=href.split('#')[0].replace(/:\d+(?:-\d+)?$/,'');if(!href)continue;
      try{href=decodeURIComponent(href);}catch{}
      const target=path.resolve(path.dirname(file),href);if(!fs.existsSync(target))broken.push(path.relative(ROOT,file)+' → '+href);count++;
    }
    assert.deepEqual(broken,[],'失效链接');return {files:files.length,links:count};
  });
  check('开发入口与SDK保护',()=>{
    assert.equal(fs.realpathSync(ROOT),'/Users/yipin/Desktop/Suika3','运行位置不符');
    const readme=fs.readFileSync(path.join(ROOT,'README.md'),'utf8'),agents=fs.readFileSync(path.join(ROOT,'AGENTS.md'),'utf8');
    assert(readme.includes('/Users/yipin/Desktop/Suika3')&&agents.includes('/Users/yipin/Desktop/Suika3'),'入口未声明当前开发根目录');
    const before=JSON.parse(fs.readFileSync(path.join(OUT,'sdk-before.json'),'utf8'));
    for(const [file,expected] of Object.entries(before))assert.equal(hash(fs.readFileSync(path.join(ROOT,file))),expected,'原SDK/样例变化：'+file);
    return {originalSdkFilesUnchanged:Object.keys(before).length,currentRoot:ROOT};
  });
  report.warnings.push('飘关系初值、依据、判定时点与阈值未确定；第36天逐线日序/返回与低条件FR-E2、双后日谈接续未完成引擎契约。');
  report.warnings.push('条件结构正确不等于人物动机、婚姻事实及亲密行为的前后语义正确；须另列人工审阅。');
  report.sourceHashes=Object.fromEntries(fs.readdirSync(DIR).filter(n=>n.endsWith('.md')||n.endsWith('.json')).sort().map(n=>['scenario/'+n,hash(fs.readFileSync(path.join(DIR,n)))]));
  report.status=report.errors.length?'fail':'pass';
  if(write){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'content-audit.json'),JSON.stringify(report,null,2)+'\n');
    const rows=report.checks.map(c=>'| '+c.name+' | '+(c.status==='pass'?'通过':'失败')+' |').join('\n');
    fs.writeFileSync(path.join(OUT,'content-audit.md'),'# 六线编辑稿自动检查\n\n范围：'+report.scope+'。\n\n结果：'+(report.status==='pass'?'自动结构检查通过':'检查存在失败')+'。选择 '+report.totalChoices+' 处，选项 '+report.totalOptions+' 个，声明结局 '+report.totalDeclaredEndings+' 个（含飘高低路径各两个）。\n\n| 检查 | 结果 |\n| --- | --- |\n'+rows+'\n\n'+report.manualReview+'\n\n待定：'+report.warnings.join('\n\n')+'\n\n'+(report.errors.length?'失败详情：\n\n'+report.errors.map(e=>'- '+e.check+'：'+e.message).join('\n')+'\n\n':'')+'详细数据与本次输入指纹见 [content-audit.json](content-audit.json)。运行命令：`node tools/check-content.cjs`。\n');}
  return report;
}
module.exports={audit,render,commonGuard,parseCondition,choices,ROUTES,ids};
if(require.main===module){const report=audit({write:!process.argv.includes('--no-write')});console.log(JSON.stringify({status:report.status,totalChoices:report.totalChoices,totalOptions:report.totalOptions,totalDeclaredEndings:report.totalDeclaredEndings,errors:report.errors},null,2));process.exitCode=report.errors.length?1:0;}
