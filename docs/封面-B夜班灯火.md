# 当前封面 · B「夜班灯火」

2026-10-30｜用户改选三人核心B v001。文文居前景，毛狼和师傅（师匠）为核心角色；五位女主保留背景剪影。A封面及其动画、构建和原件保留。

- [游戏预览](http://127.0.0.1:49250/)：`sui-i02-20261030-title-b1-v2`，已选定并接入方案一动态标题，保留电影侧栏及当前立绘补画基线；[动态接入与验证](方案一动态封面接入.md)。静态B保留为回退画面。
- [选定原图](../assets/sources/20261030-trio-cover-options/cover-b-v001.png) · [标题封面](../assets/current/title/cover-b-title.webp) · [实际游戏截图](../qa/cover-b-adoption-20261030/browser/01-title-desktop.png)。

## 朋友欢笑打闹动画

即梦CLI已完成两个独立方案，均以B为首尾帧，8秒、1280×720、固定机位。三人有清楚的笑容及朋友间的轻拍、转身或躲闪；女主保持背景剪影。循环衍生固定标题字形、去除音轨，末0.33秒平滑回到首帧。

| 方案 | 实际表现 | 文件 |
| --- | --- | --- |
| ① 损友笑场 | 毛狼逗文文，文文大笑回身，师匠也跟着笑 | [MP4](../assets/sources/20261030-cover-b-motion/b1-loop.mp4) · [WebP](../assets/sources/20261030-cover-b-motion/b1-loop.webp) · [GIF](../assets/sources/20261030-cover-b-motion/b1-loop.gif) |
| ② 肩拍躲闪 | 师匠拍肩，文文回身笑，毛狼笑弯腰 | [MP4](../assets/sources/20261030-cover-b-motion/b2-loop.mp4) · [WebP](../assets/sources/20261030-cover-b-motion/b2-loop.webp) · [GIF](../assets/sources/20261030-cover-b-motion/b2-loop.gif) |

[循环播放页](../assets/sources/20261030-cover-b-motion/index.html) · [最终文件包](../assets/sources/20261030-cover-b-motion/b-two-motion-options.zip) · [即梦画布](https://jimeng.jianying.com/ai-tool/ai-canvas/8fe782cf-aafb-4ef0-b5b7-3511edba6b3a) · [完整提示词](../assets/sources/20261030-cover-b-motion/prompts.json)。用户已批准总上限96积分，两项报价各48积分，各提交一次；恢复身份见[本批记录](../qa/cover-b-adoption-20261030/dreamina-state.json)。此为报价/资源快照，不代替最终积分结算账本。

GIF80帧、动态WebP120帧，均8000ms、loop=0、解码首尾画面一致；MP4为24fps，静音。浏览器实际播放两个MP4并各完成至少一次自动循环。原片、导出参数和完整检查见[双方案文件说明](../assets/sources/20261030-cover-b-motion/README.md)及[本批检查](../qa/cover-b-adoption-20261030/检查记录.md)。

## 静态接入及实际验证

1672×941原件等比缩为1279×720，在1280×720画布右侧补1像素，无裁切或拉伸。保留已验证的底部横排菜单，避免遮挡三人面部与左上标题。采用与指纹见[标题清单](../system/sui-title/manifest.json)；A配置在[本批前置归档](../qa/cover-b-adoption-20261030/previous-title/)。

[资源检查](../qa/cover-b-adoption-20261030/asset-check.json)、[分发检查](../qa/cover-b-adoption-20261030/package-check.json)及[Chrome检查](../qa/cover-b-adoption-20261030/browser/report.json)通过：标题截图与预览像素一致，2组PNG/WebP等像素，源图/原UI/演出数据5项输入未变，菜单与开场8项检查通过。844×390横屏、375×667竖屏为尺寸模拟。

测试使用独立浏览器存储；新预览须重新开始，玩家旧档保留。本轮未新增正文审校、Firefox/Safari、手机真机、电脑原生运行、印刷或发布验收。预览服务关闭后运行：

```sh
node tools/runtime/serve.cjs --web dist/sui-i02-20261030-cover-b-v1/web --port 49250
```
