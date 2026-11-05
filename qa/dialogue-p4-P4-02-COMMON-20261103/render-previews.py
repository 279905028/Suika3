"""离线候选构图检查；不含引擎UI，不作为资源或运行验收。"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[2]
bindings = json.loads((root / 'docs/修订协作/P4-演出与美术/P4-02-COMMON/bindings.candidate.json').read_text())['bindings']
bindings = {row['nodeId']: row['binding'] for row in bindings}
assets = {row['assetId']: row for row in json.loads((root / 'assets/current/manifest.json').read_text())['assets']}
nodes = ['T-C01-000016_1', 'T-C01-000173_1', 'T-C01-000372_1', 'T-C02-000153_1', 'T-C02-000153_2', 'T-C02-000460_1', 'T-C02-000488_1', 'T-D36-000022_1', 'T-EPH-000145_1']
sheet = Image.new('RGB', (1920, 1188), '#eeeeee')
draw = ImageDraw.Draw(sheet)
for index, node in enumerate(nodes):
    state = bindings[node]['enter']
    canvas = Image.new('RGBA', (1280, 720), '#213139')
    placements = ([state['background']] if state['background'] else []) + state['characters'] + state['props'] + ([state['cg']] if state['cg'] else [])
    for placement in placements:
        source = Image.open(root / assets[placement['assetId']]['runtimePath']).convert('RGBA')
        source = source.resize((round(source.width * placement['scale']), round(source.height * placement['scale'])))
        canvas.alpha_composite(source, (round(placement['x']), round(placement['y'])))
    canvas = canvas.convert('RGB')
    canvas.thumbnail((640, 360))
    x, y = index % 3 * 640, index // 3 * 396
    sheet.paste(canvas, (x, y + 26))
    draw.text((x + 10, y + 8), node + (' / missing seated Piao' if node.startswith('T-D36') else ''), fill='black')
sheet.save(Path(__file__).parent / 'composition-preview-final.jpg')
