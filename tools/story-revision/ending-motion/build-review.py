#!/usr/bin/env python3
"""Build the selected six-video gallery from verified candidate records."""
import html
import json
import os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
QA=ROOT/'qa/ending-motion-P4-V00-20261104'
selection=json.loads((ROOT/'qa/ending-motion-P4-V-Q-20261104/selection.json').read_text())
names={'XM-E1':'罗小满','ZZ-E1':'周栀','MY-E1':'孟遥','PI-E1':'飘 · HIGH','PI-LE1':'飘 · LOW','HQ-E1':'黄球球'}
css='''body{margin:0;background:#111923;color:#ede9df;font:16px/1.7 -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:1280px;margin:auto;padding:36px 28px}h1{font-size:34px;margin:5px 0 10px}header p{max-width:990px;color:#bbc4ca}.eyebrow{letter-spacing:3px;color:#b9c7bc}.summary{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.badge{padding:6px 14px;background:#283c37;border-radius:6px}section{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}article{background:#1c2733;border:1px solid #334451;border-radius:12px;overflow:hidden}article video{display:block;width:100%;aspect-ratio:16/9;background:#0c1117}.body{padding:18px 20px}h2{font-size:22px;margin:0}.id{float:right;color:#a3b3be}.body p{font-size:14px;margin:10px 0}.state{color:#b9d7c9}a{color:#a6d4e4}.links{display:flex;gap:14px;font-size:13px;flex-wrap:wrap}footer{margin-top:32px;color:#aab6bf;font-size:14px}@media(max-width:720px){section{grid-template-columns:1fr}main{padding:24px 16px}h1{font-size:28px}}'''
parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>P4-V 六段视频候选</title><style>'+css+'</style><main><header><div class="eyebrow">毕节，雨停之前 / P4-V</div><h1>六个结局，六个停留的瞬间</h1><p>2026-11-04 · 六段视频候选均已完成。小满与飘 LOW 采用返修版，其余四段保留首版。每段5秒，以下为静音预览；全部通过制作方画面初检，尚未接入正式游戏。</p><div class="summary"><span class="badge">6段初检通过</span><span class="badge">5秒 / 段</span><span class="badge">小满、飘 LOW 已返修</span></div><p><a href="../../docs/美术/恋爱结局动态CG-20261104/P4-V00/交接.md">制作与验证交接</a> · <a href="../ending-motion-P4-V-Q-20261104/selection.json">当前六片记录</a> · <a href="https://jimeng.jianying.com/ai-tool/ai-canvas/63e8f6ad-e7b7-4dee-adce-34c05f8cb6bb">即梦画布</a></p></header><section>']
for item in selection['items']:
    key=item['ending'];version=item['version'];review=item['review']
    note=''.join(review['observations']);prefix='../../'
    parts.append(f'<article id="{key}"><video controls muted playsinline preload="metadata" poster="{prefix+item["first"]["path"]}" src="{prefix+item["runtime"]["path"]}" aria-label="{names[key]}视频"></video><div class="body"><span class="id">{key}</span><h2>{names[key]}</h2><p class="state">制作方初检通过 · {version}</p><p>{html.escape(note)}</p><div class="links"><a href="{prefix+item["runtime"]["path"]}">静音视频</a><a href="{prefix+item["source"]["path"]}">原片</a><a href="{prefix+review["evidence"]}">关键帧</a><a href="{prefix+item["prompt"]["path"]}">制作提示</a></div></div></article>')
parts.append('</section><footer>八次生成保留全部原件，当前选用六段：小满及飘LOW为v002，其余为v001。运行候选为1280×720、24fps、无音轨；原片保留生成音轨。独立素材终验、正式桥接与采用、真实后台、自动快进、完整恢复及设备验收仍待。</footer></main></html>')
page=''.join(parts)
(QA/'index.html').write_text(page)
web=ROOT/'qa/ending-motion-P4-V-T-20261104/real-media-v2/web'
webpage=page
for item in selection['items']:
    key=item['ending']
    for field,suffix in [('runtime','.mp4'),('source','-raw.mp4'),('first','-first.webp'),('prompt','-prompt.txt')]:
        src=ROOT/item[field]['path'];name=key+suffix;dst=web/name
        if not dst.exists():os.link(src,dst)
        webpage=webpage.replace('../../'+item[field]['path'],name)
    name=key+'-contact.jpg';dst=web/name
    if not dst.exists():os.link(ROOT/item['review']['evidence'],dst)
    webpage=webpage.replace('../../'+item['review']['evidence'],name)
webpage=webpage.replace('../../docs/美术/恋爱结局动态CG-20261104/P4-V00/交接.md','handoff.md').replace('../ending-motion-P4-V-Q-20261104/selection.json','selection.json')
(web/'review.html').write_text(webpage)
(web/'selection.json').write_text(json.dumps(selection,ensure_ascii=False,indent=2)+'\n')
(web/'handoff.md').write_text((ROOT/'docs/美术/恋爱结局动态CG-20261104/P4-V00/交接.md').read_text())
print('六视频候选预览已生成')
