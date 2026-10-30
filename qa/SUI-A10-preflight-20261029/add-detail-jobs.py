import json
from pathlib import Path
p=Path(__file__).parent/'job-plan.json';a=json.loads(p.read_text())
jobs=[
 {'id':'prop-salon-washbasin-reference-v001','owner':'SUI-A08','refs':['assets/sources/20261029/SUI-A08/bg-salon-bijie/bg-salon-bijie-washbasin-day-v001.png'],'requirements':['bg-salon-bijie','prop-salon-fixed'],'shots':['CG015'],'transparent':False,'prompt':'参考图锁定同一旧理发店的朴素装修、灰旧墙面、棕皮椅、温暖灯光与半写实手绘质感。现在制作同一理发店洗头池的局部造型参考，不是完整CG，不画人物。前景主体为一只普通黑色陶瓷理发洗头盆，清楚看到靠近镜头一侧的U形颈托凹口、盆内排水口、普通银色龙头和手持冲洗喷头，一条已卷好的浅灰毛巾放在颈托边，向后仰的深棕旧皮洗头椅顶端与颈托对齐。镜头三分之四近景，盆与椅的结构确实能支撑成年人仰躺洗头。背景只见原店灰墙和虚化镜边，不新增门窗位置、招牌或奢华设备。横向16:9，无人物、文字、logo或水印。'},
 {'id':'prop-station-travel-bags-reference-v001','owner':'SUI-A08','refs':[],'requirements':['prop-transport-packing'],'shots':['CG022','CG034','CG069'],'transparent':False,'prompt':'为中国小城成年视觉小说画普通车站行李的造型参考板，暖灰底，横向16:9，细腻半写实手绘。三个分开的物件不重叠：左侧一只朴素灰蓝硬壳小拉杆箱，四个完整轮子，拉杆收下，一条暗灰箱带已经收齐贴箱没有拖地；中间一只深灰布面拉杆行李箱，轮子完整，拉杆拉起可由主人自己拖走；右侧一只无品牌深棕帆布短途旅行包，拉链拉好，两只提手自然落在包上。用普通旧物感但无破损轮子。只提供各人的独立出行物件形制，不暗示是同一个人的同一箱；不画后备箱、车、人物、额外标签、票据、标志、文字或日期。'},
 {'id':'prop-shared-handheld-food-boxes-reference-v001','owner':'SUI-A08','refs':['assets/sources/20261029/SUI-A08/bg-bridge-shaobing/bg-bridge-shaobing-day-v001.png'],'requirements':['prop-shared-food-boxes','prop-netcafe-counter-equipment','prop-huisheng-sales'],'shots':['CG005','CG027','CG035','CG041','CG044','CG077','CG086','CG108'],'transparent':False,'prompt':'参考图只锁定普通烧饼的烘烤外观和半写实手绘质感。制作横向16:9的无品牌日常手持道具参考板，暖灰背景，物件分区明确但不画文字标签。左上：一只透明无标签瓶装水和一只普通米白棉布购物袋，袋口露一盒完全无文字的白色牛奶纸盒；右上：两只与参考图一致的普通圆烧饼，其中一只半装在牛皮纸食品袋里，另一只露出完整边缘；左下：普通棕色搬运纸箱，短侧两只提手孔，箱中饮料只露无标签瓶盖，不出现品牌或数量文字；中下：两份各自包好的普通早餐牛皮纸袋，大小相近，不打开猜测食物种类；右下：一小张无文字浅色折叠消费单纸，带极淡线格但无金额。物件之间留空，无人物、日期、logo、可读文字、水印，不把参考板当具体聚餐摆放或新增故事。'}
]
assert not any(j['id'] in {x['id'] for x in a} for j in jobs)
a+=jobs;p.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
print(len(a))
