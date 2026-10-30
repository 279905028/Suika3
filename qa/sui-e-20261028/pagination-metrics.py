#!/usr/bin/env python3
"""Pillow/FreeType font advances and conservative three-line layout checks."""
import hashlib,json,math,sys
from pathlib import Path
from PIL import ImageFont
root=Path(__file__).resolve().parents[2]
ir=json.loads(Path(sys.argv[1]).read_text())
ui=json.loads((root/'system/sui-u/integration.json').read_text())
font_path=root/'system/font/NotoSansCJK-Medium.ttc'
font=ImageFont.truetype(str(font_path),ui['message']['fontSize'])
option_font=ImageFont.truetype(str(font_path),ui['choice']['fontSize'])
width=ui['message']['rect'][2]-ui['message']['textMargins'][0]-ui['message']['textMargins'][2]
# Reserve at least one full glyph for punctuation line breaking.
conservative_columns=math.floor(width/30)-1
no_start=set('，。！？、；：）】》〉」』〕］｝”’…')
no_end=set('（【《〈「『〔［｛“‘')
def layout(text):
    lines=[];current='';last_width=0
    for c in text:
        if c=='\n':lines.append(current);current='';continue
        if sum(math.ceil(font.getlength(ch)) for ch in current+c)>width:
            # Conservative kinsoku: never hang punctuation outside the reading area.
            carry=''
            if c in no_start or (current and current[-1] in no_end):
                carry=current[-1:];current=current[:-1]
            lines.append(current);current=carry+c
        else:current+=c
    if current:lines.append(current)
    return lines
pages=[n for n in ir['nodes'] if n['op']=='text']
chars=set(''.join(n['text'] for n in pages))
advances={c:font.getlength(c) for c in chars}
assert max(advances.values())<=30
assert not any(ord(c)<32 or c=='\\' for c in chars)
measure=[]
for n in pages:
    lines=layout(n['text'])
    assert len(lines)<=3,(n['id'],lines)
    # A per-character worst case leaves a whole-cell reserve on every line.
    assert len(n['text'])<=conservative_columns*3,n['id']
    widths=[sum(math.ceil(font.getlength(c)) for c in line) for line in lines]
    assert all(w<=width for w in widths),(n['id'],widths)
    measure.append({'id':n['id'],'source':n['source'],'characters':len(n['text']),'lines':len(lines),'lineWidths':widths,'text':n['text']})
questions=[];options=[]
for choice in ir['choices'].values():
    assert len(layout(choice['question']))<=3
    questions.append({'id':choice['id'],'width':font.getlength(choice['question'])})
    for option in choice['options']:
        w=option_font.getlength(option['text'])
        # The UI centers choices; keep a 36px side inset on both sides.
        assert w<=ui['choice']['width']-72,(choice['id'],w)
        options.append({'choice':choice['id'],'value':option['value'],'width':w})
max_bbox_bottom=max(font.getbbox(c)[3] for c in chars)
text_bottom=ui['message']['rect'][1]+ui['message']['textMargins'][1]+2*ui['message']['lineHeight']+max_bbox_bottom
content_bottom=ui['message']['rect'][1]+ui['message']['rect'][3]-ui['message']['textMargins'][3]
assert text_bottom<=content_bottom
result={'status':'pass','method':'Pillow FreeType actual font advances; conservative per-character and punctuation wrapping; no native rendered-pixel claim',
 'font':'system/font/NotoSansCJK-Medium.ttc','fontSha256':hashlib.sha256(font_path.read_bytes()).hexdigest(),'fontSize':30,
 'pages':len(pages),'distinctCharacters':len(chars),'maxGlyphAdvance':max(advances.values()),'readingWidth':width,'conservativeColumns':conservative_columns,
 'maxMeasuredLines':max(x['lines'] for x in measure),'maxCharacters':max(x['characters'] for x in measure),'maxLineWidth':max(max(x['lineWidths']) for x in measure),
 'textBottom':text_bottom,'contentBottom':content_bottom,'choiceQuestions':len(questions),'options':len(options),
 'widestQuestion':max(questions,key=lambda x:x['width']),'widestOption':max(options,key=lambda x:x['width']),
 'largestPages':sorted(measure,key=lambda x:(sum(x['lineWidths']),x['characters']),reverse=True)[:6]}
print(json.dumps(result,ensure_ascii=False,indent=2))
