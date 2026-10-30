'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const choiceRE = /^\*\*选择 ([A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2})｜(.+)\*\*$/;
const endingRE = /^#### 结局 ([A-Z]+-L?E[12])｜(.+)$/;

function condition(expr, choices, endings) {
  return expr.split('|').map(group => group.split('&').map(term => {
    const m = /^\s*([A-Z0-9_-]+)\s*(!=|=)\s*([A-Za-z0-9_-]+)\s*$/.exec(term);
    assert(m, `不支持的条件：${expr}`);
    const [, field, operator, value] = m;
    const values = field === 'PIAO_RELATION' ? ['HIGH', 'LOW'] : field === 'ENDING' ? endings : choices[field]?.options.map(x => x.value);
    assert(values, `未知条件字段：${field}`);
    assert(values.includes(value), `非法条件值：${field}=${value}`);
    return {field, operator, value};
  }));
}

function parse(R, sources, {pageSize = 120} = {}) {
  assert(Number.isInteger(pageSize) && pageSize >= 32 && pageSize <= 200, 'pageSize须为32至200的整数');
  assert.equal(R.schemaVersion, 2, '只支持schemaVersion 2');
  assert.equal(R.contentContract.status, 'frozen');
  assert.deepEqual(R.unresolved, []);
  const files = [...new Set([...R.storyEntry.common, R.storyEntry.routeEntry, ...R.routes.map(r => r.file), R.day36.sharedSource.file, ...R.epilogues.rules.flatMap(r => r.target ? [r.target.file] : [])])];
  for (const file of files) assert(typeof sources[file] === 'string', `缺少来源：${file}`);
  const endings = R.routes.flatMap(r => [...r.endings, ...(r.lowPathEndings || [])]);
  assert.equal(new Set(endings).size, endings.length, '结局登记重复');
  assert.equal(new Set(R.routes.map(r => r.id)).size, R.routes.length, '路线登记重复');
  const choices = {}, declaredEndings = new Set(), anchors = {}, programs = {}, omitted = [];
  // First pass registers every option before parsing any condition.
  for (const file of files) {
    let current = null;
    for (const [index, raw] of sources[file].split('\n').entries()) {
      const line = raw.trim(); let m;
      if ((m = choiceRE.exec(line))) {
        assert(!Object.hasOwn(choices, m[1]), `重复选择ID：${m[1]}`);
        current = choices[m[1]] = {id:m[1], question:m[2], options:[], source:{file, line:index + 1}};
      } else if ((m = /^#### ([A-Z])｜(.+)$/.exec(line))) {
        assert(current && current.id !== R.storyEntry.routeChoice, `${file}:${index+1} 选项无普通选择`);
        current.options.push({value:m[1], text:m[2], source:{file, line:index+1}});
      } else if (file === R.storyEntry.routeEntry && (m = /^### (.+)｜(.+)$/.exec(line))) {
        assert(current?.id === R.storyEntry.routeChoice, '路线选项无选择');
        const route = R.routes.find(r => r.name === m[1]);
        assert(route, `未知路线：${m[1]}`);
        current.options.push({value:route.id, text:m[1]+'｜'+m[2], source:{file, line:index+1}});
      }
    }
  }
  for (const c of Object.values(choices)) {
    const expected = c.id === R.storyEntry.routeChoice ? R.routes.map(r => r.id).sort() : ['A','B'];
    assert.deepEqual(c.options.map(o => o.value).sort(), expected, `${c.id}选项缺失、重复或非法`);
  }
  const segments = new Intl.Segmenter('zh', {granularity:'grapheme'});
  for (const file of files) {
    const list = [], stack = [], occurrences = new Map();
    let body = false, activeChoice = null, optionBranch = null, scope = 'FILE', lastNode = null;
    const loc = (line, raw) => ({file, line, anchor:scope, sha256:hash(raw)});
    const unique = (kind, raw) => {
      const base = `${kind}_${hash(file+'\0'+scope+'\0'+raw).slice(0,20)}`;
      const n = (occurrences.get(base) || 0) + 1; occurrences.set(base,n);
      return n === 1 ? base : base+'_'+n;
    };
    const emit = (op, line, raw, data = {}, id = unique(op.toUpperCase(),raw)) => {
      const node = {id, op, source:loc(line,raw), ...data}; list.push(node); return node;
    };
    const endOption = () => { if (optionBranch) {optionBranch.falseIndex=list.length; optionBranch=null;} };
    for (const [index, raw] of sources[file].split('\n').entries()) {
      const line = raw.trim(), ln = index+1; let m;
      try {
        if ((m = /^<!-- IF (.+) -->$/.exec(line))) {
          const node = emit('branch',ln,raw,{condition:condition(m[1],choices,endings)}); stack.push(node);
        } else if (line === '<!-- ENDIF -->') {
          assert(stack.length,'多余ENDIF'); stack.pop().falseIndex=list.length;
        } else if ((m = /^<!-- NODE ([A-Za-z0-9_-]+) -->$/.exec(line))) {
          assert(!anchors[m[1]],'重复NODE：'+m[1]); scope=m[1]; lastNode=m[1];
          anchors[m[1]]=emit('anchor',ln,raw,{},m[1]);
        } else if (line === '<!-- CALL PIAO-D36 -->') {
          const call=R.day36.calls.find(c=>c.file===file&&c.callAnchor===lastNode);
          assert(call,'未登记CALL来源');
          emit('call',ln,raw,{target:R.day36.sharedSource.anchor,returnTo:call.returnAnchor,route:call.routeId});
        } else if (line === '<!-- RETURN -->') {
          assert(file===R.day36.sharedSource.file && !stack.length,'RETURN来源或条件栈错误'); emit('return',ln,raw);
        } else if ((m = /^<!-- EVENT ([A-Za-z0-9_-]+) -->$/.exec(line))) {
          assert(R.stateContract.events.includes(m[1]),'未知EVENT：'+m[1]);
          const expected=m[1]===R.hiddenEntry.readEvent?R.hiddenEntry.source:{file:R.day36.piaoSource.file,anchor:R.day36.piaoSource.completeAnchor};
          assert(file===expected.file&&lastNode===expected.anchor,'EVENT来源锚点错误'); emit('event',ln,raw,{event:m[1]});
        } else if (line === '<!-- FREEZE PIAO_RELATION -->') {
          assert(file===R.piaoRelation.freeze.file&&lastNode===R.piaoRelation.freeze.anchor,'FREEZE来源锚点错误');emit('freeze',ln,raw);
        } else if (line === '<!-- EPILOGUE PM -->') {
          assert(body&&R.routes.some(r=>r.file===file),'EPILOGUE不在路线正文'); emit('epilogue',ln,raw);
        } else if (line.includes('<!--') || line.includes('-->')) throw Error('未知或非单行控制标记');
        else if (/^#{2,3} 第[三四五六七八九十]+章｜/.test(line) || /^(?:#{2,3} 剧情简介|\*\*剧情简介\*\*)/.test(line)) {
          endOption(); body=false; activeChoice=null; scope=line;
          omitted.push({file,line:ln,reason:'章节或简介边界'});
        } else if (/^(?:#{2,3} 完整内容|\*\*完整内容\*\*)$/.test(line)) {
          endOption(); body=true; activeChoice=null;
        } else if ((m=choiceRE.exec(line))) {
          assert(body,'选择在正文外'); endOption(); activeChoice=m[1]; scope=m[1];
          emit('choice',ln,raw,{choice:m[1]},m[1]);
        } else if ((m=/^#### ([A-Z])｜(.+)$/.exec(line)) || (file===R.storyEntry.routeEntry && (m=/^### (.+)｜(.+)$/.exec(line)))) {
          assert(body&&activeChoice,'选项在正文/选择外');endOption();
          const value=activeChoice===R.storyEntry.routeChoice?R.routes.find(r=>r.name===m[1])?.id:m[1];
          assert(choices[activeChoice].options.some(o=>o.value===value),'未知选项');scope=activeChoice+'/'+value;
          optionBranch=emit('branch',ln,raw,{condition:[[{field:activeChoice,operator:'=',value}]]});
        } else if (line==='#### 共同段') {endOption();scope=(activeChoice||scope)+'/COMMON';}
        else if ((m=endingRE.exec(line))) {
          assert(body,'结局在正文外'); assert(endings.includes(m[1]),'未知结局');assert(!declaredEndings.has(m[1]),'结局ID重复');
          declaredEndings.add(m[1]);scope=m[1]; emit('ending',ln,raw,{ending:m[1]},m[1]);
        } else if (!line || /^(>|→)/.test(line) || /^\[.+\]\(.+\)(?: · .*)?$/.test(line)) {
          if(line)omitted.push({file,line:ln,reason:'编辑提示或导航'});
        } else if (line.startsWith('#')) {
          assert(!/^#### (选择|结局|共同段|[A-Z]｜)/.test(line),'未知结构标题');
          if (/^## (高|低)好感路径｜/.test(line)) {endOption();body=false;activeChoice=null;}
          scope=line;omitted.push({file,line:ln,reason:'标题'});
        } else if (body) {
          assert(!/^(\||```|---$)/.test(line),'正文中不支持的Markdown结构');
          const chars=Array.from(segments.segment(line),x=>x.segment), paragraph=unique('TEXT',line);
          for(let start=0;start<chars.length;start+=pageSize)emit('text',ln,raw,{text:chars.slice(start,start+pageSize).join(''),paragraph,offset:start},paragraph+'_'+(start/pageSize+1));
        } else omitted.push({file,line:ln,reason:'简介或元数据'});
      } catch(e) {throw Error(`${file}:${ln} ${e.message}`,{cause:e});}
    }
    assert(!stack.length,file+' IF未闭合');endOption();
    emit('finish',sources[file].split('\n').length,'',{file},'END_'+hash(file).slice(0,16));
    for(let i=0;i<list.length;i++){
      if(i+1<list.length)list[i].next=list[i+1].id;
      if(list[i].op==='branch') {assert(Number.isInteger(list[i].falseIndex),'分支缺终点');list[i].otherwise=list[list[i].falseIndex].id;delete list[i].falseIndex;}
    }
    programs[file]=list;
  }
  assert.deepEqual([...declaredEndings].sort(),[...endings].sort(),'正文结局与登记不符');
  const required=[{file:R.piaoRelation.freeze.file,anchor:R.piaoRelation.freeze.anchor},R.hiddenEntry.source,R.day36.sharedSource,...R.day36.calls.flatMap(c=>[{file:c.file,anchor:c.callAnchor},{file:c.file,anchor:c.returnAnchor}]),{file:R.day36.piaoSource.file,anchor:R.day36.piaoSource.startAnchor},{file:R.day36.piaoSource.file,anchor:R.day36.piaoSource.completeAnchor},...R.epilogues.rules.flatMap(r=>r.target?[r.target]:[]),...Object.values(R.routes.find(r=>r.id==='piao').pathAnchors).map(anchor=>({file:R.routes.find(r=>r.id==='piao').file,anchor}))];
  for(const a of required)assert(anchors[a.anchor]?.source.file===a.file,'锚点缺失或来源错误：'+a.anchor);
  const nodes=Object.values(programs).flat();assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length,'生成ID碰撞');
  const allIds=new Set(nodes.map(n=>n.id));
  for(const n of nodes)for(const k of ['next','otherwise','target','returnTo'])if(n[k])assert(allIds.has(n[k]),'悬空目标：'+n[k]);
  for(const c of R.piaoRelation.choices)assert(choices[c.id]?.source.file===c.file,'计分选择缺失或来源不符');
  const entries=Object.fromEntries(files.map(f=>[f,programs[f][0].id]));
  return {version:1,contract:R,pageSize,entries,entry:entries[R.storyEntry.common[0]],choices,nodes,omitted};
}
module.exports={parse,condition,hash};
