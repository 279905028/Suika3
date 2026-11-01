#!/usr/bin/env node
'use strict';
// Cross-platform assets.arc writer/reader, byte-compatible with Suika3 SDK suika3-pack
// (PlayfieldEngine StratoHAL archive.c, default OBFUSCATION_KEY). Layout:
// u64 count | count x (name[256] xor, u64 size, u64 offset) | bodies xor, all little-endian.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const KEY_HI=0xabadcafe,KEY_LO=0xdeadbeef,MUL=0xbe00,ADD=0xef,TWO32=2**32;
const NAME=256,ENTRY=NAME+16,CHUNK=1<<20;
// Per-entry seed: rotate-left after xor, index times (archive.c set_random_seed).
function seed(index){
  let hi=KEY_HI,lo=KEY_LO;
  for(let i=0;i<index;i++){
    hi=(hi^0xafcb8f2f)>>>0;lo=(lo^0xf4fff33f)>>>0;
    const top=hi>>>31;hi=((hi<<1)|(lo>>>31))>>>0;lo=((lo<<1)|top)>>>0;
  }
  return [hi,lo];
}
// XOR buf in place with the stream of entry `index`, continuing from `state` if given.
// next = ((KEY&0xff00)*r + (KEY&0xff)) mod 2^64 % KEY ^ C; KEY>=2^63 so % is one subtract.
function xor(buf,state){
  let [hi,lo]=state;
  for(let i=0;i<buf.length;i++){
    buf[i]^=lo&0xff;
    const p=lo*MUL,carry=Math.floor(p/TWO32);
    lo=p-carry*TWO32+ADD;hi=(hi*MUL+carry)%TWO32;
    if(lo>=TWO32){lo-=TWO32;hi=(hi+1)%TWO32;}
    if(hi>KEY_HI||(hi===KEY_HI&&lo>=KEY_LO)){lo-=KEY_LO;hi-=KEY_HI;if(lo<0){lo+=TWO32;hi-=1;}}
    hi=(hi^0xfcbfaff8)>>>0;lo=(lo^0xf2f4f3f0)>>>0;
  }
  state[0]=hi;state[1]=lo;
  return buf;
}
// files: relative paths using '/', read from cwd, written in the given order (suika3-pack keeps argv order).
// previous (dev): an older archive with its <arc>.json index; an entry with the same index, path and
// content is copied as already-obfuscated bytes, since the stream depends only on the index.
function pack(files,{cwd=process.cwd(),out=path.join(cwd,'assets.arc'),previous=null}={}){
  assert(files.length>0,'没有要打包的文件');
  const sizes=files.map(rel=>{
    assert(!path.isAbsolute(rel)&&!rel.includes('\\')&&!rel.split('/').includes('..'),'非法打包路径：'+rel);
    assert(Buffer.byteLength(rel)<NAME,'文件名过长：'+rel);
    return fs.statSync(path.join(cwd,rel)).size;
  });
  const table=Buffer.alloc(8+ENTRY*files.length);
  table.writeBigUInt64LE(BigInt(files.length),0);
  let offset=table.length;
  files.forEach((rel,i)=>{
    const at=8+ENTRY*i,name=Buffer.alloc(NAME);name.write(rel,'utf8');
    xor(name,seed(i)).copy(table,at);
    table.writeBigUInt64LE(BigInt(sizes[i]),at+NAME);table.writeBigUInt64LE(BigInt(offset),at+NAME+8);
    offset+=sizes[i];
  });
  let old=null;
  if(previous&&fs.existsSync(previous)&&fs.existsSync(previous+'.json')){
    try{old={fd:fs.openSync(previous,'r'),entries:JSON.parse(fs.readFileSync(previous+'.json','utf8')).entries};}catch{old=null;}
  }
  const fd=fs.openSync(out,'w'),index=[];let reused=0;
  try{
    fs.writeSync(fd,table);
    const buf=Buffer.alloc(CHUNK);
    files.forEach((rel,i)=>{
      const full=path.join(cwd,rel),sha256=previous?crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'):null;
      const prior=old?.entries[i];
      if(prior&&prior.path===rel&&prior.sha256===sha256&&prior.size===sizes[i]){
        for(let done=0;done<prior.size;){const n=fs.readSync(old.fd,buf,0,Math.min(CHUNK,prior.size-done),prior.offset+done);fs.writeSync(fd,buf,0,n);done+=n;}
        reused++;
      }else{
        const input=fs.openSync(full,'r'),state=seed(i);
        try{let n;while((n=fs.readSync(input,buf,0,CHUNK,null))>0)fs.writeSync(fd,xor(buf.subarray(0,n),state));}
        finally{fs.closeSync(input);}
      }
      index.push({path:rel,size:sizes[i],offset:Number(table.readBigUInt64LE(8+ENTRY*i+NAME+8)),sha256});
    });
  }finally{fs.closeSync(fd);if(old)fs.closeSync(old.fd);}
  if(previous)fs.writeFileSync(out+'.json',JSON.stringify({entries:index}));
  return {files:files.length,bytes:offset,reused,index:previous?Object.fromEntries(index.map(e=>[e.path,e.sha256])):null};
}
function list(arc){
  const fd=fs.openSync(arc,'r');
  try{
    const head=Buffer.alloc(8);fs.readSync(fd,head,0,8,0);
    const count=Number(head.readBigUInt64LE(0)),table=Buffer.alloc(ENTRY*count);
    fs.readSync(fd,table,0,table.length,8);
    return Array.from({length:count},(_,i)=>{
      const name=xor(Buffer.from(table.subarray(ENTRY*i,ENTRY*i+NAME)),seed(i)),end=name.indexOf(0);
      return {index:i,path:name.toString('utf8',0,end<0?NAME:end),size:Number(table.readBigUInt64LE(ENTRY*i+NAME)),offset:Number(table.readBigUInt64LE(ENTRY*i+NAME+8))};
    });
  }finally{fs.closeSync(fd);}
}
function unpack(arc,outDir){
  const entries=list(arc),fd=fs.openSync(arc,'r');
  try{
    for(const e of entries){
      const dest=path.resolve(outDir,e.path);
      assert(dest.startsWith(path.resolve(outDir)+path.sep),'归档路径越界：'+e.path);
      fs.mkdirSync(path.dirname(dest),{recursive:true});
      const output=fs.openSync(dest,'w'),state=seed(e.index),buf=Buffer.alloc(CHUNK);
      try{for(let done=0;done<e.size;){const n=fs.readSync(fd,buf,0,Math.min(CHUNK,e.size-done),e.offset+done);fs.writeSync(output,xor(buf.subarray(0,n),state));done+=n;}}
      finally{fs.closeSync(output);}
    }
  }finally{fs.closeSync(fd);}
  return entries;
}
if(require.main===module){
  try{
    const [command,...args]=process.argv.slice(2);
    if(command==='list')for(const e of list(args[0]))console.log(e.size+'\t'+e.path);
    else if(command==='unpack')console.log(unpack(args[0],args[1]).length+' files');
    else if(command==='pack')console.log(JSON.stringify(pack(args)));
    else throw Error('用法：pack.cjs pack <相对路径...> | list <assets.arc> | unpack <assets.arc> <目录>');
  }catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={pack,list,unpack};
