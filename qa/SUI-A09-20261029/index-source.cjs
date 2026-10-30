'use strict';
// 仅解析当前正文到本批QA；不构建或修改运行文件。
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const {parse}=require(path.join(root,'tools/compiler/parse.cjs'));
const R=JSON.parse(fs.readFileSync(path.join(root,'scenario/routes.json'),'utf8'));
const sources=Object.fromEntries(fs.readdirSync(path.join(root,'scenario')).filter(f=>f.endsWith('.md')).map(f=>[f,fs.readFileSync(path.join(root,'scenario',f),'utf8')]));
const ir=parse(R,sources);
const files=[...new Set(ir.nodes.map(n=>n.source.file))], paragraphs=[];
const expr=c=>c.map(g=>g.map(t=>t.field+t.operator+t.value).join('&')).join('|');
for(const file of files){
  const nodes=ir.nodes.filter(n=>n.source.file===file), indices=new Map(nodes.map((n,i)=>[n.id,i]));
  const branches=nodes.flatMap((n,i)=>n.op==='branch'?[{start:i,end:indices.get(n.otherwise),condition:expr(n.condition)}]:[]);
  for(let i=0;i<nodes.length;i++){
    const n=nodes[i];if(n.op!=='text'||n.offset!==0)continue;
    const pages=nodes.filter(x=>x.paragraph===n.paragraph), last=pages.at(-1);
    const lines=sources[file].split('\n'), before=lines.slice(0,n.source.line);
    paragraphs.push({path:'scenario/'+file,line:n.source.line,paragraph:n.paragraph,scope:n.source.anchor,
      heading:before.filter(s=>/^#{1,4} /.test(s)).at(-1),nearestNode:before.filter(s=>/^<!-- NODE /.test(s)).at(-1)||null,
      quote:pages.map(x=>x.text).join(''),conditions:branches.filter(b=>b.start<i&&i<b.end).map(b=>b.condition),
      enterId:pages[0].id,pageIds:pages.map(x=>x.id),exitBeforeId:last.next,
      sourceSha256:crypto.createHash('sha256').update(sources[file]).digest('hex')});
  }
}
fs.writeFileSync(path.join(__dirname,'source-index.json'),JSON.stringify({task:'SUI-A09',date:'2026-10-29',scope:'本次当前正文解析；非引擎验收',paragraphs},null,2)+'\n');
console.log(JSON.stringify({files:files.length,paragraphs:paragraphs.length,textPages:ir.nodes.filter(n=>n.op==='text').length}));
