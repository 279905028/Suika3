# SUI-A05 目视复核

复核日期：2026-10-29。范围为本包19份最终图及离线合成；不替代A11全作复核或游戏运行验收。

| 复核对象 | 实际查看与结果 |
| --- | --- |
| A/B独立呈现 | [比较图](previews/piao-options-a-b.png)及单图：A较平滑明亮，B保留原自然质感；外形和衣装一致。B原选型保持 |
| B人物一致性 | [13图总览](previews/piao-selected-b-sheet.png)、[脸部细节](previews/piao-faces-detail-sheet.png)及基础原图：发型、眉眼、滚边衣饰与红绳延续，双侧浅酒窝随表情自然减弱 |
| 手部与动作 | [手部细节](previews/piao-hands-detail-sheet.png)及三张新动作UI：持相机、持册与系带的手部衔接可读，所见部位未发现明显多指/穿插。细节裁图不含全部下垂手，既有姿态结合全图复核 |
| 五件道具 | [道具总览](previews/piao-props-sheet.png)：独立相机、持相机动作和说明书v002沿用平顶机身方向；相机包及系带动作可对应。空封二无新增文字，工具组合不伪称分层文件 |
| 四底边缘 | [白](previews/edge-review-white.png)、[黑](previews/edge-review-black.png)、[昼](previews/edge-review-day.png)、[夜](previews/edge-review-night.png)均已打开复核；在所查看尺寸未发现明显白边、黑边或底色块。76份逐图合成保留供放大复查 |
| 新动作的阅读区 | [持相机](previews/piao-action-camera-ui.png)、[持册](previews/piao-action-booklet-ui.png)、[系包带](previews/piao-action-knot-ui.png)均已看：脸、持物手和结不被阅读框遮住。系带图包底进入正文框，不保证完整包体可读 |

说明书v001的封面机身有凸起取景器，与本包相机不一致；已使用image_gen返修为v002并目视复核。初稿保留，且不出现在19张最终图及18项候选里。详见[版本记录](retained-revisions.json)。

离线UI采用当前SUI-U画布与界面图片，人物等比缩到448×608范围、居中、顶端y=36。该位置仅供静态检查；衣装切换、表情衔接、六选项遮挡、多人物、实际背景光照、坐姿、运动、引擎WebP通道与手机呈现均未验证。来源alpha最高254如实保留，没有强制改为255。

[机器检查132项](verification.json)覆盖格式与可计算字段；本页所述目视检查单列，不计入132项。正式采用还需A11/I，演出及读档恢复由E/Q验收。
