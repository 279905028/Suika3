# SUI-A09 CG复核与制作放行

2026-10-29｜**60/60镜相关上游参考已冻结并通过本轮核验，全部可进入A10制作。** 选集仍为52项保留＋CG101～CG108八项新增；8个叶岚退役编号继续取消。正式CG成品0张，运行采用0张。

[逐镜放行记录](../../qa/SUI-A09-release-20261029/review-released.json) · [60项依赖映射](../../qa/SUI-A09-release-20261029/dependency-release.json) · [当前验证](../../qa/SUI-A09-release-20261029/verification.json) · [交接](../../qa/SUI-A09-release-20261029/交接.md)

## 本轮完成

- 用户要求“完成未达成的开工条件”。已补齐19项CG专用参考，保留2项返修前原件；87份生产参考均有实际文件、版本和指纹。人物原选型不变，三处衣装沿用户已确认方案。
- 60个上游需求键已落实到146条逐镜依赖；9项游戏/电话/消息/日历画内局部仍属A10制作内容，不当成外部阻塞，也不宣称已完成。
- 重跑32组共通组合、2,818条路线展开、135项重点反例；60镜原文与108/120字素分页的进入/退出均通过。904项已有正文、原件及运行输入未改。
- 本轮冻结的是**制作参考**。最终CG视觉审查、A11、I采用、E绑定和Q运行验收继续分开进行。

## 制作约束

- CG019：小满白色内搭、肩部近景；CG044：孟遥日常教学服及新河边参考；CG061：毛狼演出西装。三项不重复询问，不新增换衣剧情。
- 孟遥CG038～041在MY07之前；CG044仅要求MY07=A，AB仍保留。CG104仅AA；CG105覆盖AB/BA/BB。婚姻持续，不画公开复合或自动离婚。
- 黄球球按正文日序呈球形/人形；人形腰上，不补下装或遮片经历；没有自己的手机。CG075用文文手机内半幅失焦花照。
- CG006仅普通队友游戏暂停，不画叶岚实体或恋爱暗示；CG023为视频，CG035仅语音。CG067的湿绳独谈与CG101的相机包带三人事件不能共图。
- 相机按快门前、杯子写字前后、箱轮未修/已售设备、钥匙交还后、册子分支文字均按逐镜`frameUse`执行。照片未知背面日期、金额、检查地点等不入画。
- 1280×720横屏，脸/手/关键物件建议区[64,96,1152,322]；正文框y=490、姓名框y=442起。最终CG仍须做实际遮挡与读取性检查。
- 沿用A09-ONE-PARAGRAPH-v1：入段存快照，离开该段最后一页清CG并恢复/重算下一拍；读档校验源指纹、条件及页相位。此规范尚未绑定到运行包。

## 当前60镜

每镜详细衣装、道具、条件、参考路径与进出场见上方JSON。表内参考数量包含身份、衣装和按镜头取用的物件，不能整板同时放入CG。

| 编号 | 镜头 | 制作包 | 参考数 | 正文锚点 |
| --- | --- | --- | ---: | --- |
| CG001 | 坏轮子的返乡 | COMMON | 4 | [第21行](</Users/yipin/Desktop/Suika3/scenario/第一章-回到毕节.md:21>) |
| CG004 | 她自己的练习本 | COMMON | 6 | [第201行](</Users/yipin/Desktop/Suika3/scenario/第一章-回到毕节.md:201>) |
| CG005 | 便利店里的前任 | COMMON | 4 | [第317行](</Users/yipin/Desktop/Suika3/scenario/第一章-回到毕节.md:317>) |
| CG006 | 屏幕上只剩她的角色 | COMMON | 2 | [第367行](</Users/yipin/Desktop/Suika3/scenario/第一章-回到毕节.md:367>) |
| CG007 | 一碗面和一通工作电话 | COMMON | 5 | [第405行](</Users/yipin/Desktop/Suika3/scenario/第一章-回到毕节.md:405>) |
| CG008 | 册子里留白的地方 | COMMON | 6 | [第439行](</Users/yipin/Desktop/Suika3/scenario/第一章-回到毕节.md:439>) |
| CG010 | 她还没有开口 | COMMON | 5 | [第288行](</Users/yipin/Desktop/Suika3/scenario/第二章-十四天.md:288>) |
| CG011 | 饭桌上说出拍卖 | COMMON | 8 | [第436行](</Users/yipin/Desktop/Suika3/scenario/第二章-十四天.md:436>) |
| CG012 | 门后的第一次见面 | COMMON | 4 | [第556行](</Users/yipin/Desktop/Suika3/scenario/第二章-十四天.md:556>) |
| CG014 | 镜子里掉下的发夹 | XM | 4 | [第183行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:183>) |
| CG015 | 洗头池上的几秒 | XM | 5 | [第205行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:205>) |
| CG016 | 当众说我对象 | XM | 3 | [第265行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:265>) |
| CG019 | 她自己催回那笔钱 | XM | 5 | [第651行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:651>) |
| CG020 | 两顶头盔，没有车 | XM | 3 | [第713行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:713>) |
| CG022 | 这次没观众 | XM | 4 | [第805行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:805>) |
| CG023 | 隔着练习本的吻 | XM | 6 | [第1045行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:1045>) |
| CG025 | 两支麦克风 | ZZ | 5 | [第93行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:93>) |
| CG026 | 同样的一下袖口 | ZZ | 5 | [第157行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:157>) |
| CG027 | 隔在两人之间的单子 | ZZ | 6 | [第189行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:189>) |
| CG029 | 男朋友不是客人 | ZZ | 5 | [第491行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:491>) |
| CG031 | 把不走的钟留在原处 | ZZ | 5 | [第667行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:667>) |
| CG032 | 回声关了，她还上班 | ZZ | 4 | [第741行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:741>) |
| CG034 | 留住人，交出杯子 | ZZ | 5 | [第907行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:907>) |
| CG035 | 清晨电话里的人 | ZZ | 6 | [第1207行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:1207>) |
| CG038 | 四十八和六十 | MY | 4 | [第69行](</Users/yipin/Desktop/Suika3/scenario/孟遥-旧题.md:69>) |
| CG039 | 一起把伞撑正 | MY | 4 | [第193行](</Users/yipin/Desktop/Suika3/scenario/孟遥-旧题.md:193>) |
| CG040 | 试讲播完以后 | MY | 6 | [第255行](</Users/yipin/Desktop/Suika3/scenario/孟遥-旧题.md:255>) |
| CG041 | 楼下另一个约定 | MY | 6 | [第269行](</Users/yipin/Desktop/Suika3/scenario/孟遥-旧题.md:269>) |
| CG044 | 也让她烦一会儿 | MY | 6 | [第542行](</Users/yipin/Desktop/Suika3/scenario/孟遥-旧题.md:542>) |
| CG061 | 按下快门之前 | PI | 7 | [第1178行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:1178>) |
| CG062 | 不要求朋友立刻高兴 | PI | 5 | [第134行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:134>) |
| CG063 | 她自己说明过去 | PI | 4 | [第180行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:180>) |
| CG066 | 纸页落了一地 | PI | 5 | [第652行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:652>) |
| CG067 | 先把话说清楚 | PI | 4 | [第1208行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:1208>) |
| CG068 | 再对一次焦 | PI | 4 | [第1336行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:1336>) |
| CG069 | 我想继续，但仍要出发 | PI | 5 | [第812行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:812>) |
| CG070 | 留一张给朋友 | PI | 4 | [第1344行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:1344>) |
| CG073 | 杯底写两个文 | HQ | 4 | [第93行](</Users/yipin/Desktop/Suika3/scenario/黄球球-门后.md:93>) |
| CG075 | 糊掉一半的小白花 | HQ | 5 | [第161行](</Users/yipin/Desktop/Suika3/scenario/黄球球-门后.md:161>) |
| CG077 | 五点的那只手 | HQ | 5 | [第457行](</Users/yipin/Desktop/Suika3/scenario/黄球球-门后.md:457>) |
| CG078 | 她自己的另一种样子 | HQ | 4 | [第511行](</Users/yipin/Desktop/Suika3/scenario/黄球球-门后.md:511>) |
| CG079 | 第二次由她靠近 | HQ | 3 | [第545行](</Users/yipin/Desktop/Suika3/scenario/黄球球-门后.md:545>) |
| CG082 | 那把租屋钥匙仍能用 | HQ | 4 | [第774行](</Users/yipin/Desktop/Suika3/scenario/黄球球-门后.md:774>) |
| CG086 | 至少让我自己答应 | FR | 7 | [第105行](</Users/yipin/Desktop/Suika3/scenario/朋友与职业-夜班.md:105>) |
| CG090 | 卖掉旧游戏机 | FR | 4 | [第449行](</Users/yipin/Desktop/Suika3/scenario/朋友与职业-夜班.md:449>) |
| CG091 | 删掉朋友的笑料 | FR | 4 | [第529行](</Users/yipin/Desktop/Suika3/scenario/朋友与职业-夜班.md:529>) |
| CG094 | 挺好过 | FR | 3 | [第802行](</Users/yipin/Desktop/Suika3/scenario/朋友与职业-夜班.md:802>) |
| CG095 | 先把饭吃完再骂 | COMMON | 4 | [第81行](</Users/yipin/Desktop/Suika3/scenario/后日谈-他们的日子.md:81>) |
| CG096 | 先把未定的留空 | COMMON | 6 | [第20行](</Users/yipin/Desktop/Suika3/scenario/后日谈-未写完的安排.md:20>) |
| CG098 | 把不愿入镜的留在画外 | COMMON | 5 | [第40行](</Users/yipin/Desktop/Suika3/scenario/后日谈-未写完的安排.md:40>) |
| CG099 | 婚后的饭还热着 | COMMON | 6 | [第125行](</Users/yipin/Desktop/Suika3/scenario/后日谈-他们的日子.md:125>) |
| CG100 | 只在群里收到婚讯 | COMMON | 2 | [第151行](</Users/yipin/Desktop/Suika3/scenario/后日谈-他们的日子.md:151>) |
| CG101 | 先问这件事能告诉谁 | COMMON | 6 | [第25行](</Users/yipin/Desktop/Suika3/scenario/跨路线-第36天的消息.md:25>) |
| CG102 | 没裁掉的失败处 | XM | 4 | [第1061行](</Users/yipin/Desktop/Suika3/scenario/罗小满-练习本.md:1061>) |
| CG103 | 自己把袖口捋平 | ZZ | 2 | [第1255行](</Users/yipin/Desktop/Suika3/scenario/周栀-十一点四十七分.md:1255>) |
| CG104 | 第98天先留空 | MY | 5 | [第892行](</Users/yipin/Desktop/Suika3/scenario/孟遥-旧题.md:892>) |
| CG105 | 取消单独的提醒 | MY | 2 | [第950行](</Users/yipin/Desktop/Suika3/scenario/孟遥-旧题.md:950>) |
| CG106 | 最后一页不再等确认 | PI | 4 | [第1130行](</Users/yipin/Desktop/Suika3/scenario/飘-空白页.md:1130>) |
| CG107 | 五点不再等的提醒 | HQ | 4 | [第919行](</Users/yipin/Desktop/Suika3/scenario/黄球球-门后.md:919>) |
| CG108 | 两份早饭，不假装人齐 | FR | 6 | [第734行](</Users/yipin/Desktop/Suika3/scenario/朋友与职业-夜班.md:734>) |

## 历史与边界

[补选时文档快照](../../qa/SUI-A09-release-20261029/task-document-before.md)和[原待核记录](../../qa/SUI-A09-selection-20261029/review-approved.json)原样保留；其中“0镜放行/待核”是当时状态，本轮以后以上方放行记录为准。未以历史CG数量抵扣本次60镜；图鉴仍为60个空槽，未改正文、运行入口或玩家存档。
