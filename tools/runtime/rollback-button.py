#!/usr/bin/env python3
"""Rebuild the E-only rollback GUI button without editing SUI-U source artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parent.parent
font = ImageFont.truetype(str(root / 'system/font/NotoSansCJK-Medium.ttc'), 26)
for state, fill, border in [('idle', '#20363a', '#587575'), ('hover', '#2e4a4d', '#a9d0c3'), ('press', '#152d30', '#a9d0c3')]:
    image = Image.new('RGBA', (328, 80), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((1, 1, 326, 78), radius=5, fill=fill, outline=border, width=1)
    label = '回到上一选择'
    box = draw.textbbox((0, 0), label, font=font)
    draw.text(((328 - box[2] + box[0]) / 2, (80 - box[3] + box[1]) / 2 - box[1]), label, font=font, fill='#eeeae0')
    image.save(here / ('rollback-' + state + '.png'))
