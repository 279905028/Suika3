#!/usr/bin/env python3
"""Portrait message box (system/sui-portrait/manifest.json): actual font advances, conservative wrapping."""
import hashlib,json,math,sys
from pathlib import Path
from PIL import ImageFont
root=Path(__file__).resolve().parents[2]
ir=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
layout_spec=json.loads((root/'system/sui-portrait/manifest.json').read_text(encoding='utf-8'))['layout']
config=dict(l.split('=',1) for l in (root/'config.ini').read_text(encoding='utf-8').splitlines() if '=' in l and not l.startswith('#'))
# Values patched by tools/runtime/portrait-theme.cjs; font size and line height stay from config.ini.
x,y,w,h=layout_spec['message'];margins=(32,28,32,40)
size=int(config['msgbox.font.size']);line_height=int(config['msgbox.margin.line'])
font_path=root/'system/font/NotoSansCJK-Medium.ttc'
font=ImageFont.truetype(str(font_path),size)
width=w-margins[0]-margins[2]
no_start=set('，。！？、；：）】》〉」』〕］｝”’…')
no_end=set('（【《〈「『〔［｛“‘')
def layout(text):
    lines=[];current=''
    for c in text:
        if c=='\n':lines.append(current);current='';continue
        if sum(math.ceil(font.getlength(ch)) for ch in current+c)>width:
            carry=''
            if c in no_start or (current and current[-1] in no_end):
                carry=current[-1:];current=current[:-1]
            lines.append(current);current=carry+c
        else:current+=c
    if current:lines.append(current)
    return lines
pages=[n for n in ir['nodes'] if n['op']=='text']
chars=set(''.join(n['text'] for n in pages))
max_bbox_bottom=max(font.getbbox(c)[3] for c in chars)
content_bottom=y+h-margins[3]
max_lines=(content_bottom-(y+margins[1])-max_bbox_bottom)//line_height+1
conservative_columns=math.floor(width/size)-1
measure=[]
for n in pages:
    lines=layout(n['text'])
    assert len(lines)<=max_lines,(n['id'],lines)
    assert len(n['text'])<=conservative_columns*max_lines,n['id']
    widths=[sum(math.ceil(font.getlength(c)) for c in line) for line in lines]
    assert all(v<=width for v in widths),(n['id'],widths)
    measure.append({'id':n['id'],'characters':len(n['text']),'lines':len(lines),'lineWidths':widths})
used=max(m['lines'] for m in measure)
text_bottom=y+margins[1]+(used-1)*line_height+max_bbox_bottom
assert text_bottom<=content_bottom
print(json.dumps({'status':'pass','method':'Pillow FreeType实际字宽；逐字保守换行含标点避头尾；不代表原生像素或真机',
 'fontSha256':hashlib.sha256(font_path.read_bytes()).hexdigest(),'fontSize':size,'lineHeight':line_height,'message':[x,y,w,h],'margins':margins,
 'pages':len(pages),'readingWidth':width,'maxLinesAvailable':max_lines,'maxMeasuredLines':used,'conservativeColumns':conservative_columns,
 'maxCharacters':max(m['characters'] for m in measure),'textBottom':text_bottom,'contentBottom':content_bottom,
 'lineHistogram':{str(k):sum(1 for m in measure if m['lines']==k) for k in range(1,used+1)}},ensure_ascii=False,indent=2))
