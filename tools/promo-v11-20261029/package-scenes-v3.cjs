const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const deps=process.env.CODEX_POSTER_NODE_MODULES||'/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp=require(path.join(deps,'sharp'));
const root=path.resolve(__dirname,'../..');
const out=path.join(root,'assets/sources/20261029-promo-v11-scenes-v3');
const qa=path.join(root,'qa/promo-v11-scenes-v3-20261029');
const items=JSON.parse(fs.readFileSync(path.join(out,'generation-record.json'),'utf8')).items;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const outputs=[],panels=[];
 for(let i=0;i<items.length;i++){
  const item=items[i],png=path.join(out,`poster-${item.id}.png`),webp=path.join(out,`poster-${item.id}.webp`);
  const meta=await sharp(png).metadata();
  await sharp(png).webp({lossless:true,effort:6}).toFile(webp);
  const rgba=await sharp(png).ensureAlpha().raw().toBuffer();
  const wp=await sharp(webp).ensureAlpha().raw().toBuffer();
  if(!rgba.equals(wp)||meta.width>=meta.height)throw new Error('Format/pixels: '+item.id);
  outputs.push({id:item.id,name:item.name,png:path.relative(root,png),webp:path.relative(root,webp),dimensions:[meta.width,meta.height],sourceFormat:meta.format,webpFormat:(await sharp(webp).metadata()).format,rgbaPixelsEqual:true,sha256:{png:hash(png),webp:hash(webp)}});
  panels.push({input:await sharp(png).resize({width:470}).png().toBuffer(),left:40+i*510,top:180});
  const label=Buffer.from(`<svg width="470" height="60"><text x="0" y="39" fill="#203432" font-family="PingFang SC,sans-serif" font-size="25">${item.id[0]} · ${item.name}</text></svg>`);
  panels.push({input:label,left:40+i*510,top:115});
 }
 const title=Buffer.from('<svg width="1480" height="75"><text x="0" y="40" fill="#203432" font-family="PingFang SC,sans-serif" font-size="30">《毕节，雨停之前》v1.1 · 三种场景主视觉</text><text x="0" y="70" fill="#66695f" font-family="PingFang SC,sans-serif" font-size="17">归城站台 / 街角烟火 / 网吧后院 · 新版预告 · 开发中</text></svg>');
 panels.push({input:title,left:40,top:22});
 await sharp({create:{width:1570,height:1070,channels:3,background:'#e6e2d7'}}).composite(panels).png().toFile(path.join(out,'three-options.png'));
 await sharp(path.join(out,'three-options.png')).webp({lossless:true,effort:6}).toFile(path.join(out,'three-options.webp'));
 const protectedInputs=JSON.parse(fs.readFileSync(path.join(qa,'protected-before.json'),'utf8')).map(x=>({...x,unchanged:hash(x.path)===x.sha256}));
 if(protectedInputs.some(x=>!x.unchanged))throw new Error('Protected reference or story input changed');
 const routes=JSON.parse(fs.readFileSync(path.join(root,'scenario/routes.json'),'utf8'));
 const endings=[...new Set(routes.routes.flatMap(r=>[...r.endings,...(r.lowPathEndings||[])]))];
 const epilogues=[...new Set(routes.epilogues.rules.filter(x=>x.target).map(x=>x.target.file))];
 if(routes.routes.length!==6||endings.length!==14||epilogues.length!==2)throw new Error('Claim mismatch');
 fs.writeFileSync(path.join(qa,'validation.json'),JSON.stringify({date:'2026-10-29',tool:'image_gen.imagegen',mode:'built-in',outputs,protectedInputs,claims:{routeCount:6,endingCount:14,endingIds:endings,epilogueCount:2},visualReview:{D:'雨棚/钢柱/长凳/雨地为主，文文金黄短寸与牛仔夹克背影，当前标题、预告版本、数字与开发中标识可读；不指定交通方式。',E:'红橙雨篷、烤炉/桌面/烟气形成暖色生活主视觉；文文与小满沿当前造型，手部与人物布局通过本批目视检查；没有确立关系或结局标签。',F:'木门、门缝暖光、后院植物和蓝凳主视觉；无人物与黄球球人形；文案、版本状态、数字及布局可读。'},scope:'主题宣传插画候选；不作为正式剧情CG、运行采用或新增剧情事实。',notPerformed:['正文全量审校','引擎运行','游戏浏览器验收','手机真机','电脑原生','印刷','发布']},null,2));
 const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>v1.1 三种场景主视觉</title><style>body{background:#e6e2d7;margin:35px;color:#203432;font-family:"PingFang SC",sans-serif}main{display:flex;gap:24px}section{width:32%}h1{font-size:28px}h2{font-size:21px}img{width:100%;box-shadow:0 6px 20px #0002}a{color:inherit}</style><h1>《毕节，雨停之前》v1.1 · 三种场景主视觉</h1><p>新版预告 / 开发中 / 第三轮独立候选</p><main>${items.map(({id,name})=>`<section><h2>${id[0]} · ${name}</h2><a href="poster-${id}.png"><img src="poster-${id}.webp" alt="${name}"></a></section>`).join('')}</main></html>`;
 fs.writeFileSync(path.join(out,'index.html'),html);
 console.log(JSON.stringify({posters:outputs.length,dimensions:outputs.map(x=>x.dimensions),losslessPixels:true,protectedUnchanged:protectedInputs.length,counts:[6,14,2]}));
})().catch(e=>{console.error(e);process.exit(1)});
