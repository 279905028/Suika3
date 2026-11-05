import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
notes={
'ending-MCG-XM-E1':'小满始终在手机画面内；练习本从半遮脸到放低，飞吻后微笑。手机边框保持可辨。',
'ending-MCG-ZZ-E1':'文文独处吃饼，放低后转向桌面通话手机；未出现周栀实体或视频画面。',
'ending-MCG-MY-E1':'文文将红笔放入抽屉并撤手，练习册留在桌面；不产生婚姻结束或公开复合暗示。',
'ending-MCG-PI-E1':'文文独处老街合上膝上册子；未把收到的照片变成现场，也未出现飘实体。',
'ending-MCG-PI-LE1':'唯一一台相机由飘交到文文手中，飘松指撤手；红手绳与相机背带可区分。',
'ending-MCG-HQ-E1':'人形黄球球靠在文文肩上，文文拿杯书写并微笑；杯子、笔与人物位置连续。',
'kiss-KCG-XM-01':'暖色摊位中抓前襟、接吻及退开后摸下巴连续；两人身份稳定。',
'kiss-KCG-XM-02':'冷色车棚和电动车背景可辨，文文低头接吻；小满抓前襟而非正文所写扣手腕，保留动作简化说明。',
'kiss-KCG-XM-03':'租屋中双人轻吻可辨；抽帧不能明确区分轻咬下唇与普通亲吻，不宣称咬唇细节通过。',
'kiss-KCG-XM-04':'站台双人拥吻，后颈与前襟接触及退开整理衣领可辨；手臂未出现突增。',
'kiss-KCG-ZZ-01':'雨后街边靠近、接吻、退开及拇指触碰嘴边可辨；雨伞和街景保持。',
'kiss-KCG-ZZ-02':'室内门边双人接吻，双臂抱住后退开；角色与空间连续。',
'kiss-KCG-ZZ-03':'晨光卧室，周栀俯身亲吻坐在床上的文文后起身；接触清楚。',
'kiss-KCG-ZZ-04':'站台周栀先靠近，手贴颈侧，文文抱住她；退开仍抓前襟。',
'kiss-KCG-ZZ-05':'晨光室内二人牵手后靠近轻吻，脸部与衣装稳定。',
'kiss-KCG-MY-01':'桌前孟遥主动靠近接吻，两人均在场；没有陈晟或婚姻变化画面。',
'kiss-KCG-MY-02':'河边树旁短吻，牵手及退出可辨；仅表现原动作段，不扩入后续电话。',
'kiss-KCG-MY-03':'夜间书桌边孟遥先靠近、接吻后退开；教案与房间连续。',
'kiss-KCG-MY-04':'桌边接吻后孟遥伸向手机，支架手机保留；未把拍摄解释为公开关系。',
'kiss-KCG-PI-01':'白昼房间飘主动短吻，文文手移到颈后；人物、相机背景和衣装稳定。',
'kiss-KCG-PI-02':'车站近景持续亲吻再退开，裁剪版4.63秒；画面内无尾部人物突变。',
'kiss-KCG-HQ-01':'人形黄球球与文文初吻后退开；保持人形与既有脸部特征。',
'kiss-KCG-HQ-02':'人形黄球球向文文嘴角靠近接触后退开；没有球形切换。',
'kiss-KCG-HQ-03':'写杯名场景黄球球转头亲吻文文，杯笔保留；没有形态切换。',
'night-OV-XM45':'素色内搭的文文与小满从对视到双臂拥抱；租屋夜景连续，手臂归属清楚。',
'night-OV-ZZ-BJ':'双方在床边拥抱，窗外车灯经过后室内变暗，轮廓仍可辨；开关动作在画外。',
'night-OV-ZZ-GY':'实际使用runtime-v003-framed.mp4。周栀放手机后低头靠近，最终额头与文文额头接触；没有翻身，也未清楚抵在肩上。保留剧情动作差异，不计逐动作一致通过。',
'night-OV-MY56':'手部归属仍有错误，按用户决定不接动态，使用原静态演出。',
'night-OV-PI39':'飘在桌边将手覆到文文手上并合握，内搭、两张脸与夜景连续。',
'night-OV-HQ57':'人形黄球球触碰并握住文文手，二人内搭与窗外夜景连续，无球形变化。',
'morning-OV-XM45':'小满拿枕头推向文文脸侧；二人可辨，留作历史备选。',
'morning-OV-ZZ-BJ':'周栀俯身找物，拨开文文伸来的手后继续；发圈细节不明显，留作历史备选。',
'morning-OV-ZZ-GY':'周栀写采购纸后回望床上文文；两人可辨，留作历史备选。',
'morning-OV-MY56':'孟遥整理教案并穿外套，文文坐在床侧；留作历史备选，不替代夜间缺陷片。',
'morning-OV-PI39':'飘靠在文文肩头，手放到他的手上；留作历史备选。',
'morning-OV-HQ57':'人形黄球球与文文并躺，伸手触向闹钟；留作历史备选。'
}
r=json.loads((OUT/'technical-report.json').read_text())
differences=['kiss-KCG-XM-02','kiss-KCG-XM-03','night-OV-ZZ-GY']
for x in r['items']:
 x['visualReview']={'method':'独立审查者检查本批新抽取的2fps全时段接触表，逐镜10帧（PI站台9帧）；另查CG116原尺寸图与周栀贵阳夜间原尺寸尾帧。','result':'exclude-static-fallback' if x['policy']=='static-fallback' else 'historical-alternative-only' if x['policy']=='historical-alternative' else 'reviewed-with-action-difference' if x['auditId'] in differences else 'sampled-visual-pass','observation':notes[x['auditId']]}
r.update(status='29-adoption-candidates-reviewed-with-disclosed-differences',reviewer='P5独立素材复验子任务；不是生成制作方原报告',scope={'runtimeCompleteDecodes':36,'originalCompleteDecodes':36,'selectedRuntimeCount':29,'historicalMorningAlternatives':6,'excludedNightCount':1,'sampledFrames':359,'selectedSampledFrames':289,'continuousVisualPlayback':'未做完整速度人工播放审看；完整解码与抽帧目视分开记录','browserOrEngineAcceptance':False},cg116={'path':'assets/current/P4-07-20261104/cg-zz-cg116.webp','sha256':hashlib.sha256((ROOT/'assets/current/P4-07-20261104/cg-zz-cg116.webp').read_bytes()).hexdigest(),'result':'原尺寸素材目视通过：冷灰清晨环境、两位女性搬箱及湿路可辨，非夜间灯光；引擎叠框另由P5执行。'})
(OUT/'report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
lines=['# 动态 CG 独立素材复验','', '2026-11-04。核对当前正式正文及绑定，未改原片、来源档案、正文或正式资源。','', '## 采用范围','', '按用户本轮确认沿用夜间方案，同一次留宿只播放一段：6段结局＋18段亲吻＋5段夜间，共29段进入整合；6段次晨保留历史备选；孟遥夜间片保留原静态演出。','', '## 实际检查','', '- 36份原片及36份运行衍生完整解码通过；登记文件指纹、36个正文锚点与当前绑定条件一致。','- 运行衍生均为1280×720、H.264、yuv420p、24fps、静音；飘站台亲吻采用既有4.63秒剪辑，其余为5秒。','- 本次独立查看359张2fps样本帧（正式候选289张），覆盖每段首、中、尾；并查看CG116全尺寸图和周栀贵阳夜间尾帧。全片解码通过不等于逐帧人工审看；未做完整速度的人工连续播放审看。','- CG116清晨光线与搬箱动作素材复看通过；实际引擎叠框、图鉴与平台呈现另计P5运行证据。','', '## 保留差异','', '| 镜头 | 实际画面与边界 |','| --- | --- |','| KCG-XM-02 | 小满抓前襟，未呈现正文扣手腕。 |','| KCG-XM-03 | 轻吻可辨，抽帧不能确认咬下唇细节。 |','| OV-ZZ-GY | 使用framed版本；坐着放手机后额头相贴，未呈现翻身及额头抵肩。 |','| OV-MY56 | 手部归属错误；用户确认保留静态，本轮不接动态。 |','', '前三项按现有候选记录为动作呈现差异，不以技术通过冒称逐动作完全一致；正式采用处置由整合记录说明。孟遥亲密段仍须MY07=A，结局MY-E1必须MY07=A且MY09=A；飘HIGH/LOW和黄球球门禁由正式桥接及负例验证。','', '## 证据与待办','', '- [逐镜复验与文件指纹](../../qa/dialogue-p5-motion-20261104/media-review/report.json)','- [本批技术重验脚本](../../qa/dialogue-p5-motion-20261104/media-review/audit.py)','- [x] 36份素材与锚点独立复验；29段当前采用候选与6段历史备选、1段排除片分开登记。','- [x] CG116素材独立目视复看。','- [ ] 完整速度人工连续播放审看及前三项动作差异的最终美术口径。','- [ ] 同版本正式Suika运行、浏览器/真机/电脑原生、保存恢复及发布；本报告不替代这些验收。','']
(ROOT/'docs/整合/动态CG-P5素材复验.md').write_text('\n'.join(lines))
print('独立复验报告已写入；29候选、6历史、1静态排除')
