'use strict';
const assert=require('node:assert/strict');
const registry=require('../../compiler/speakers.json').speakers;
const entry=(kind,speaker,name,channel,text)=>({kind,speaker,name,channel,text});
const named=(kind,id,text,channel,override)=>{
 const speaker=registry.find(s=>s.id===id);assert(speaker,'未登记speaker：'+id);
 const name=override||speaker.canonical;assert(speaker.allowedNames.includes(name),'未登记称呼：'+id+'／'+name);
 return entry(kind,id,name,channel,text);
};
exports.n=text=>entry('narration',null,'','none',text);
exports.a=text=>entry('action',null,'','none',text);
exports.t=text=>named('thought','wenwen',text,'inner');
exports.d=(speaker,text,channel='face')=>named('dialogue',speaker,text,channel);
exports.voice=(speaker,text)=>named('dialogue',speaker,text,'offscreen',speaker==='huangqiuqiu'?'门内的声音':undefined);
exports.m=(speaker,text)=>named('message',speaker,text,'text');
