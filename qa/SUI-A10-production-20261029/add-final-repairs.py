from pathlib import Path
import json
P=Path(__file__).resolve().parent
jobs={j['id']:j for j in json.loads((P/'jobs.json').read_text())}
repairs=json.loads((P/'repair-jobs.json').read_text())
def src(i,v='v001'):
 j=jobs[i];return 'assets/sources/20261029/'+j['package']+'/'+j['stem'].rsplit('-',1)[0]+'-'+v+'.png'
def add(i,reason,prompt,v='v002',extra=(),base='v001'):
 assert not any(r['id']==i and r['version']==v for r in repairs)
 repairs.append(dict(id=i,version=v,refs=[src(i,base),*extra],reason=reason,prompt='Use case: precise story illustration edit. '+prompt+' 保持完整横向16:9画幅、细腻半写实画风，不增加文字、边框、标题或水印。'))
add('CG006','停下的单个角色必须在游戏画面角落','只改屏幕内四个游戏角色的站位：其中一个独处在屏幕游戏场景的右下角，紧靠右边和下边的墙角，另外三个在左上方远处。清楚表现离队后停住。保留设备特写、牛仔袖和手，不加真人脸、可识别房间或游戏品牌。',v='v003',base='v002')
add('CG015','水滴在小满本人左眼睫毛','只修正一滴水的位置：擦去小满图像左边眼睛上的水滴，在图像右边眼睛（小满本人的左眼）下睫毛挂一滴小水珠。保留双眼自然神态、脸、浅金短发、衣装、捻后颈碎发的手、仰躺文文和洗头池。两人的其他脸部均没有明显水珠。',v='v003',base='v002')
add('CG040','掉桌边的夹子须可见','保持两名成年人的额头轻抵、脸和衣装、手摸向手机支架的动作。把孟遥后脑固定头发的黑色小发夹移到桌边、手机支架旁清晰可见；低马尾保留但稍松，不新增第二个发夹。桌边夹子尚未拾起。手机显示已停止的普通试讲播放器暗屏，无录像内容或可读时间。')
add('CG061','按快门前须先放下挡脸的手','只调整毛狼和飘的手部：毛狼深色演出西装白衬衫，原挡脸的手完全降到胸口以下、自然落在桌沿，脸无遮挡；飘把黑相机放低到胸前，食指明显抬离快门，双眼看向毛狼征询许可。保留两人和周栀的身份、场景、衣装、前景文文牛仔袖、餐桌。未按快门、无已拍照片。')
add('CG068','未知所打结物不得擅画绳','仅移除画面下部可见的棕色绳子、绳结和无关抓绳手。那只并未参与相机交接的手收至画外。保留文文牛仔袖手接相机、飘的手搭在他的手背重对焦、相机、身份和背景。不得为未知物体另补替代物。')
add('CG077','小手应在文文手背','仅修正球形黄球球唯一一只小手的位置：她的小手轻放在文文裸露的手背中央，不在袖口或手腕。文文掌心向下自然放桌面，五指放松。黄球球仍是一个金黄色球体和一只手，没有第二只手、身体或脚。保留吃过的餐盒、扣下的手机和原场景。')
add('CG078','人形须站门内并保持腰上裁切','保留同一成年黄球球B脸、短金发、图像右侧白眼罩、浅色上衣、项链、手中逗猫棒和文文牛仔袖握门把。修正空间：镜头从院子外朝打开的房门看，她站门槛里面，背后是普通房间室内墙面和暗部，不能在她背后再出现室外院落或天空。收紧到腰以上，不画裤子、裙子或任何新下装。门框在两侧，文文只露靠镜头的手。')
add('CG079','消除多出的手，明确她握他的手腕','保留成年黄球球和文文额头相抵的脸、白眼罩在图像右侧、发型、衣装、背景。重画所有可见手臂使关系唯一清楚：只保留一只文文的手从蓝牛仔袖伸出轻放她肩边；黄球球只用一只手握住这只手的手腕，手与臂连接到她的浅色袖口。她另一只手、文文另一只手完全在画外。画面总共只出现这两只手，禁止多余手指、断腕、自己的双手互握。肩上近景，不新增下装。')
add('CG086','纸箱尚未放到柜台','只调整三人共同搬的纸箱：把整只箱子和托住它的手向上抬约10厘米，使箱底与柜台顶之间清楚可见一条空气间隙，箱子仍由人托住尚未落下。保留文文、师匠、毛狼身份与原服饰，卷尺在台边，毛狼资料纸背无可读字，其余场景不变。')
for i in ['CG095','CG096']:
 add(i,'后日谈未定义具体地点时刻','仅重绘背景，窗户、河水、山坡、天空和任何能识别地点或明确时刻的景物全部替换成普通无字浅墙与浅景深桌椅，柔和室内漫射光。严格保留全部成年人物、脸、服饰、手中纸或手机、桌面动作和道具，不再添加其他人。')
phone_template='Recompose the image as a FIRST PERSON POV close-up. Show ONLY the holder\'s two hands with washed blue denim jacket cuffs and a single black smartphone front, no face or head or torso portrait. The owner and viewer share the same viewpoint looking down at the front display. Palm behind phone, fingers curl at edges, no fingers laid across text, no rear camera array on the display side. Reference 2 gives the correct hands-and-phone perspective only; its cafe, cup, time and reminder content must not be copied. The screen and hands occupy the upper central two-thirds. '
add('CG070','需要显示两张照片及消息的正面手机视角',phone_template+'Use a neutral shallow-focus tabletop. Two small physical photographs on the table use references 3 and 4: the table-corner hands photo and the rainy old street. Show a minimal message on the phone reading exactly “已经收到了”, no dates, no names or new replies, no video. Keep the photos recognizable and intact.',extra=[src('CG107'),'assets/sources/20261029-cg-preflight/SUI-A05/photo-piao-table-hands-v001.png','assets/sources/20261029-cg-preflight/SUI-A05/photo-piao-oldstreet-after-rain-v001.png'])
add('CG100','手机前后面混合、朝向错误',phone_template+'Use the original rental-room tabletop softly blurred. The phone shows a generic group chat: exactly “我们结婚了” and below it a closed unopened photo-attachment card with a generic landscape icon, not an actual wedding photograph. Two tiny response bubbles may read “谢谢” and “收到”. No visible person other than the hands, no wedding outfits or couple portraits, no dates or additional blessings.',extra=[src('CG107')])
add('CG102','手机视角及旧照剪坏处必须准确',phone_template+'The phone shows sending a previously existing portrait photograph: use reference 3 faithfully, including its complete ear area and conspicuously uneven small notch at the hairline in front of the ear. Do not smooth or beautify the bad haircut. Display the entire original photograph within the screen with a tiny generic send arrow below. It is not a live video or a new haircut. Plain blurred tabletop only; no person outside the phone screen.',extra=[src('CG107'),'assets/sources/20261029-cg-preflight/SUI-A02/photo-xiaoman-wenwen-day22-haircut-v002.png'])
add('CG105','手机屏幕须朝向持有者',phone_template+'Only the phone interface changes: contact heading exactly “孟遥”, rows “置顶” and “提醒”, both switches OFF in grey with the knob at the left; a small “聊天记录” entry remains. No deletion, blocking or meeting invitation. No dates or other invented text. Background is a neutral blurred tabletop with no recognizable location.',extra=[src('CG107')])
add('CG103','玻璃倒影的视角和动作需成立','把镜头移到文文斜后方，画面左侧近景只见金短寸后脑和牛仔肩背；他正面对闭店玻璃，看自己的倒影，右手把左臂皱袖口捋平。玻璃中可见同一成年文文的正面，倒影动作与真实手臂严格镜像同步。保持旧回声前台与门锁、桶旁纸袋、白昼，不出现周栀或第二真人。')
add('CG108','递早饭应在旧店旁而非新店室内','把同两名成年男子和两份早餐移到奶茶店门外台阶旁，两人站着，背后通过玻璃见奶茶店，脚下为室外旧石台阶。师匠仍一手递早餐给文文、另一手拿自己一份，保持脸、帽子、眼镜和衣服图案，严格两份。照片纸袋已折口装好，在台阶一侧，不露内容，无餐桌、无第三人，无新文字。参考2只提供已改奶茶店外立面。',extra=[jobs['CG108']['refs'][2]])
(P/'repair-jobs.json').write_text(json.dumps(repairs,ensure_ascii=False,indent=2)+'\n')
fail=json.loads((P/'generation-failures.json').read_text())
fail.append(dict(id='CG066',version='v001',error='image_gen output moderation_blocked sexual; request 40835343-24d5-4bf6-8bf5-1497c7051d56',outputProduced=False,resolution='全衣成年人靠近与散纸的普通叙事，澄清后重试一次'))
(P/'generation-failures.json').write_text(json.dumps(fail,ensure_ascii=False,indent=2)+'\n')
retry=[]
for i,prompt in {
 'CG016': 'Create a non-explicit romantic visual-novel illustration of two fully clothed adults, both clearly in their twenties. In an ordinary night barbecue stall, Xiaoman, the adult short pale-blond-haired woman wearing the red stripe jacket in reference 2, takes the lapel of Wenwen\'s denim jacket and gives him a brief closed-mouth kiss. Wenwen is the adult short gold-haired man in reference 1. Restrained tender expression, shoulder-up side view, one hand holding his jacket, ordinary public setting with softly blurred plastic stools and a table from reference 3. Other friends remain entirely outside the frame. Preserve both supplied adult identities and clothes. Landscape 16:9, refined semi-realistic illustration, no text, no invented relationship labels, no phones, no spectators.',
 'CG066': 'Create a gentle fully clothed adult-romance visual-novel illustration, landscape 16:9. The two people are both adults in their twenties: the short gold-haired man in blue denim jacket from reference 1 and the dark ponytailed woman in white black-trim short-sleeve blouse from reference 2. Standing beside the paper-binding worktable, they pause close together with foreheads gently resting together. Her hand lightly holds his denim jacket; one of his hands rests behind her neck. They remain fully dressed in their supplied outfits. Several loose unbound blank manuscript sheets have just slipped down between them and are falling to the floor, with a few already on the floor. Paper-binding tool and stapler on the table. Reference 5 establishes the room before evening. Quiet domestic storytelling and restrained affection; preserve identities, only these two adults, no text or watermark. Do not turn loose sheets into already-bound booklets.'
}.items():
 j=jobs[i];retry.append(dict(id=i,version='v001',attempt=2,refs=j['refs'],prompt=prompt,reason='澄清普通非露骨成年人物叙事；原服务错误保留'))
(P/'retry-jobs.json').write_text(json.dumps(retry,ensure_ascii=False,indent=2)+'\n')
print({'repairJobs':len(repairs),'retryJobs':len(retry)})
