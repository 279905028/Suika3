#!/usr/bin/env python3
"""Actual canvas screenshot check: two known native choose buttons must visibly render.
Checks near-opaque blank left button interiors, away from text and pointer/focus.
Only applicable to the SUI-U two-choice test screenshot; not general image QA.
"""
from pathlib import Path
from PIL import Image, ImageStat
import json, sys, hashlib
p=Path(sys.argv[1]); image=Image.open(p).convert('RGB'); w,h=image.size
rows=[]
for y in [148,244]:
    box=[round((150-5)*w/1280),round((y-5)*h/720),round((150+5)*w/1280),round((y+5)*h/720)]
    actual=ImageStat.Stat(image.crop(box)).mean
    expected=[[24,43,49],[46,77,78]]
    error=min(max(abs(a-b) for a,b in zip(actual,palette)) for palette in expected)
    rows.append({'nativeCenter':[150,y],'screenshotBox':box,'actualRGB':actual,'expectedIdleOrHoverRGB':expected,'maxChannelError':error,'pass':error<=12})
result={'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'method':'Near-opaque alpha247 idle button interiors must match idle [24,43,49] or hover [46,77,78] within 12/255 per channel; both choices checked','probes':rows,'pass':all(r['pass'] for r in rows)}
print(json.dumps(result,ensure_ascii=False));sys.exit(0 if result['pass'] else 1)
