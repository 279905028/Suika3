from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
p=ROOT/'assets/sources/20261029-cg-preflight/resource-records.json';m=json.loads(p.read_text())
observations={
 'bg-my-riverside-afternoon-v001':'河水、树影、石栏与路面完整，无人或新地名，区别于楼下长凳。',
 'prop-xiaoman-open-practice-kit-v001':'打开页有后脑勺草图及红笔“剪短了/层次不对”；纸背、发夹、浅灰手机分别可取。',
 'photo-xiaoman-wenwen-day22-haircut-v002':'同文文金黄短寸/黑眉，耳前发际存在一小处不齐缺口，耳周保留，无伤口；v001排除。',
 'char-xiaoman-morning-white-tee-v001':'脸发沿A，白圆领衣领完整，电话姿势可用；四底无明显矩形底或硬边。',
 'prop-zhouzhi-private-kit-v001':'摊位线框无地址租金、私人箱与金圈耳饰、折伞和手机套可辨。',
 'char-piao-knotted-shirt-v001':'沿B脸型、黑滚边白衬衫，衣摆打结且腹部不露；四底发丝及衣边连续。',
 'prop-piao-knots-reference-v002':'手提帆布袋有两提带与一个结，湿绳/细绳分开；v001束口袋排除。',
 'photo-piao-table-hands-v001':'毛狼黑护腕手与杯完整，文文牛仔袖在另一边，无未知人物脸；只按桌面原片使用。',
 'photo-piao-oldstreet-after-rain-v001':'湿石板反光，沿A08老街结构，没有新增可读招牌/日期。',
 'prop-piao-last-page-black-mark-v001':'仅共同句局部，“好”浓黑涂掉且整句有划线；没有新增分支文字。',
 'prop-piao-epilogue-paper-kit-v001':'米色修订册闭合、纸背只有模糊笔迹，无可读费用或检查日程。',
 'prop-wenwen-personal-kit-v001':'缺轮箱与脱轮、旧帆布包、黑手机前背、纸袋、钥匙及长柄伞分开；数量依当拍取用。',
 'prop-maolang-performance-papers-v001':'卷起白边、歪裁纸与串词白背可辨，无伪造演出档期或私事笑话。',
 'prop-qiaoge-cuff-reference-v001':'仅灰外套/白袖内层及前臂，翻起处明确；无乔哥新脸或身份饰品。',
 'photo-hq-yard-whiteflowers-blurred-v001':'小白花与旧墙和A08院落一致，半幅明显失焦，另一半可辨；无人物或手机框。',
 'prop-extras-tools-reference-v001':'卷尺和扳手结构完整，刻度无数值，卷尺壳无品牌。',
 'prop-salon-washbasin-reference-v001':'黑陶瓷盆沿颈托、喷头、龙头、排水口及卷毛巾可辨；棕皮椅与原店材质衔接。',
 'prop-station-travel-bags-reference-v001':'两只完整轮子的独立拉杆箱与一只棕旅行包；箱带收齐，未借用坏轮箱。',
 'prop-shared-handheld-food-boxes-reference-v001':'水瓶与装奶布袋、两只烧饼、搬运箱、两份早餐袋及折单分开；无品牌金额。'
}
rows=[]
for r in m['records']:
 if 'derivativeFile' not in r:continue
 assert r['assetId'] in observations
 r['status']='reference-frozen-for-cg-production'
 r['visualReview']='qa/SUI-A10-preflight-20261029/visual-review.json'
 rows.append({'assetId':r['assetId'],'sourceFile':r['sourceFile'],'sourceSha256':r['sourceSha256'],'status':'pass-for-cg-reference','observation':observations[r['assetId']],'scopeLimits':r['usage']})
m['status']='cg-production-reference-frozen';save(p,m)
save(OUT/'visual-review.json',{'date':'2026-10-29','status':'pass','scope':'本批19项生成原件/返修逐图检查，2份透明参考另看白黑昼夜合成；只批准本批制作参考用途，不表示用户逐张采用或正式CG终审。','reviewedBy':'当前制作助手','selected':19,'excludedOriginals':2,'rows':rows,'notTested':['最终60张CG画面','最终CG的UI遮挡/读取性','A11全资源汇总复核','引擎/浏览器/真机','运行采用及发布']})
a=json.loads((OUT/'alpha-check.json').read_text());a['status']='pass-for-reference';a['observations']='两图白/黑/昼/夜合成无明显残余底色或矩形边，发丝和衣边连续；alpha 0..254原样保留。';save(OUT/'alpha-check.json',a)
lines=['# CG前置补充视觉检查','','19项作为CG制作参考定稿；保留2项返修前原件。此结果不等于60张CG成品，也不等于运行采用。','','| 参考 | 实际检查 |','| --- | --- |']
lines += ['| '+r['assetId']+' | '+r['observation']+' |' for r in rows]
lines += ['','无损WebP已逐项比较解码RGBA像素；两份透明参考已查看白、黑、日景、夜景合成。各图适用范围见[资源记录](../../assets/sources/20261029-cg-preflight/resource-records.json)。']
(OUT/'视觉检查.md').write_text('\n'.join(lines)+'\n')
print('visual references passed:',len(rows))
