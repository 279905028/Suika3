// Export lossless WebP and a comparison preview; keep generated PNG originals intact.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const deps=process.env.CODEX_POSTER_NODE_MODULES||'/Users/yipin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp=require(path.join(deps,'sharp'));
const root=path.resolve(__dirname,'../..');
const out=path.join(root,'assets/sources/20261029-promo-v11-reference-v2');
const qa=path.join(root,'qa/promo-v11-reference-v2-20261029');
const items=[['A-cinematic','A · 雨后群像'],['B-nightshift','B · 夜班灯火'],['C-literary','C · 雨停留白']];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const records=[];const panels=[];
 for(let i=0;i<items.length;i++){
  const [id,name]=items[i];const png=path.join(out,`poster-${id}.png`);const webp=path.join(out,`poster-${id}.webp`);
  const meta=await sharp(png).metadata();
  await sharp(png).webp({lossless:true,effort:6}).toFile(webp);
  const p=await sharp(png).ensureAlpha().raw().toBuffer();const w=await sharp(webp).ensureAlpha().raw().toBuffer();
  if(!p.equals(w)||meta.width>=meta.height)throw new Error('Format or pixel comparison failed: '+id);
  records.push({id,name,png:path.relative(root,png),webp:path.relative(root,webp),dimensions:[meta.width,meta.height],sourceFormat:meta.format,webpFormat:(await sharp(webp).metadata()).format,rgbaPixelsEqual:true,sha256:{png:hash(png),webp:hash(webp)}});
  panels.push({input:await sharp(png).resize({width:470}).png().toBuffer(),left:40+i*510,top:180});
  const label=Buffer.from(`<svg width="470" height="60"><text x="0" y="39" fill="#203432" font-family="PingFang SC,sans-serif" font-size="25">${name}</text></svg>`);
  panels.push({input:label,left:40+i*510,top:115});
 }
 const title=Buffer.from('<svg width="1480" height="70"><text x="0" y="40" fill="#203432" font-family="PingFang SC,sans-serif" font-size="30">《毕节，雨停之前》v1.1 · 参考海报重制版</text><text x="0" y="68" fill="#66695f" font-family="PingFang SC,sans-serif" font-size="17">三套竖版方案 / 新版预告 / 开发中</text></svg>');
 panels.push({input:title,left:40,top:22});
 await sharp({create:{width:1570,height:1070,channels:3,background:'#e6e2d7'}}).composite(panels).png().toFile(path.join(out,'three-options.png'));
 await sharp(path.join(out,'three-options.png')).webp({lossless:true,effort:6}).toFile(path.join(out,'three-options.webp'));
 const refs=JSON.parse(fs.readFileSync(path.join(qa,'references-before.json'),'utf8')).map(x=>({...x,sourceUnchanged:hash(x.source)===x.sha256,copyUnchanged:hash(path.join(root,x.copy))===x.sha256}));
 if(refs.some(x=>!x.sourceUnchanged||!x.copyUnchanged))throw new Error('Reference changed');
 const routes=JSON.parse(fs.readFileSync(path.join(root,'scenario/routes.json'),'utf8'));
 const endings=[...new Set(routes.routes.flatMap(r=>[...r.endings,...(r.lowPathEndings||[])]))];
 const epilogues=[...new Set(routes.epilogues.rules.filter(x=>x.target).map(x=>x.target.file))];
 if(routes.routes.length!==6||endings.length!==14||epilogues.length!==2)throw new Error('Claim mismatch');
 fs.writeFileSync(path.join(qa,'validation.json'),JSON.stringify({date:'2026-10-29',tool:'image_gen.imagegen',mode:'built-in',outputs:records,references:refs,claims:{routeCount:6,endingCount:14,endingIds:endings,epilogueCount:2,epilogueFiles:epilogues},visualReview:{A:'v002已检查：4位女性剪影＋黄球球球形提示、3位男性；文文金黄短寸和牛仔夹克；主标题、版本、数字与开发中标识可读。',B:'已检查：单人夜班主视觉、文文当前脸型/金黄短寸/牛仔夹克、标题和全部下方文案正确，手部自然。',C:'已检查：无人物；纸感、伞与雨巷；全部标题、版本、宣传数字和开发中标识正确。'},scope:'宣传候选；不是新增游戏CG、正式运行采用或发布。',notPerformed:['正文全量审校','引擎运行','游戏浏览器验收','手机真机','电脑原生','印刷','发布']},null,2));
 const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>v1.1 参考版海报</title><style>body{background:#e6e2d7;margin:35px;color:#203432;font-family:"PingFang SC",sans-serif}main{display:flex;gap:24px}section{width:32%}h1{font-size:28px}h2{font-size:21px}img{width:100%;box-shadow:0 6px 20px #0002}a{color:inherit}</style><h1>《毕节，雨停之前》v1.1 · 参考版海报</h1><p>新版预告 / 开发中 / 三方案</p><main>${items.map(([id,name])=>`<section><h2>${name}</h2><a href="poster-${id}.png"><img src="poster-${id}.webp" alt="${name}"></a></section>`).join('')}</main></html>`;
 fs.writeFileSync(path.join(out,'index.html'),html);
 console.log(JSON.stringify({posters:records.length,dimensions:records.map(x=>x.dimensions),losslessPixels:true,unchangedReferences:refs.length,counts:[6,14,2]}));
})().catch(e=>{console.error(e);process.exit(1)});
