from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2];QA=Path(__file__).resolve().parent
SOURCE=ROOT/'assets/sources/20261029/SUI-A07'
font=lambda n:ImageFont.truetype(str(ROOT/'system/font/NotoSansCJK-Medium.ttc'),n)
records=json.loads((SOURCE/'resource-records.json').read_text())['records']
selected=[r for r in records if r['selectedForPackage']]
sheet=Image.new('RGB',(1920,1800),'#162830')
for i,r in enumerate(selected):
    im=Image.open(QA/'ui-static'/f'{r["key"]}.jpg');im=im.resize((640,360),Image.Resampling.LANCZOS)
    sheet.paste(im,((i%3)*640,(i//3)*360))
sheet.save(QA/'previews/ui-contact.jpg',quality=95)
sheet=Image.new('RGB',(1800,640),'#e8ece6');d=ImageDraw.Draw(sheet)
for i,(key,name,desc) in enumerate([('wenwen-base','文文','沿用小镇青年 B'),('maolang-base','毛狼','沿用 Option D'),('shijiang-base','师匠','沿用 Option A'),('yelan-b','叶岚','新设计 · 选定 B'),('chensheng-b','陈晟','新设计 · 选定 B')]):
    r=next(r for r in records if r['key']==key);im=Image.open(ROOT/r['png']['path']).convert('RGBA');im.thumbnail((344,516))
    d.text((i*360+20,20),name,font=font(30),fill='#173d36');d.text((i*360+20,62),desc,font=font(21),fill='#4b665d');sheet.paste(im,(i*360+8,110),im)
sheet.save(QA/'previews/five-bases.jpg',quality=95)
im=Image.open(QA/'ui-static/yelan-b.jpg').convert('RGB');d=ImageDraw.Draw(im)
geometry=json.loads((ROOT/'system/sui-u/integration.json').read_text())['choice']
for i in range(6):
    x=geometry['x'];y=geometry['firstY']+i*geometry['stepY'];w=geometry['width'];h=geometry['height']
    d.rounded_rectangle((x,y,x+w,y+h),radius=8,fill='#142f36',outline='#7da99c');d.text((x+20,y+24),f'选项遮挡示意 {i+1} · 演出需在选择期间隐藏或弱化人物',font=font(25),fill='#e4ece5')
im.save(QA/'ui-static/six-choices-occlusion.jpg',quality=95)
requirements=json.loads((QA/'requirement-decisions.json').read_text());lines=['# SUI-A07 逐人需求与交付','', '2026-10-29｜27个A01需求族已逐项登记；用户本轮确认只制作五人。其他配角与独立道具特写按镜头接续，不计作已制作。','', '| 需求键 | 对象 | 当前交付/决定 | 正文或资料依据 |','| --- | --- | --- | --- |']
for r in requirements:
    s=r['anchors'][0];links='、'.join(r['assets']) or r['status']
    lines.append(f'| `{r["id"]}` | {r["name"]} | {links} | [{s["path"]}:{s["line"]}](../../{s["path"]}) |')
lines+=['','## 群众独立键','', '以下只确定资源归属，不确定外形；按用户决定，本轮不制图。','', '| 父需求 | 人物键 | 角色 |','| --- | --- | --- |']
for r in requirements:
    for p in r['separateCharacters']:lines.append(f'| `{r["id"]}` | `{p["key"]}` | {p["name"]} |')
(QA/'逐人需求与交付.md').write_text('\n'.join(lines)+'\n')
old=SOURCE/'shijiang/retained-revisions/char-shijiang-calculator-v001.png';new=SOURCE/'shijiang/variants/char-shijiang-calculator-v002.png'
revision={'character':'shijiang','reason':'v001灰色持物形似手机，计算器辨识度不足','retainedOriginal':str(old.relative_to(ROOT)),
          'retainedSha256':hashlib.sha256(old.read_bytes()).hexdigest(),'replacement':str(new.relative_to(ROOT)),
          'replacementSha256':hashlib.sha256(new.read_bytes()).hexdigest(),'finalCandidate':'v002','rejectedVersionAdopted':False,
          'scope':'仅修正持物为实体按键计算器，显示屏空白，无金额。'}
(QA/'retained-revisions.json').write_text(json.dumps([revision],ensure_ascii=False,indent=2)+'\n')
print('已保存五人概览、UI总览、六选项遮挡示意、逐人需求和返修记录。')
