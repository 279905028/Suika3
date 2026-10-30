# 已选封面 · A「雨城同行」

历史采用记录：用户后续已改选[B「夜班灯火」](封面-B夜班灯火.md)。本页A资源、动画和验收原样保留。

2026-10-30｜用户已确认采用三人核心方案A v002。文文居主视觉，毛狼与师傅（师匠）为核心角色，五位女主以低对比剪影出现。

- [游戏预览](http://127.0.0.1:49248/)：`sui-i02-20261030-cover-a-v1`，包含最新对话表情与连续立绘修复，当前标题页使用静态A。
- [循环播放页](../assets/sources/20261030-cover-a-motion/index.html) · [GIF](../assets/sources/20261030-cover-a-motion/cover-a-loop.gif) · [动态WebP](../assets/sources/20261030-cover-a-motion/cover-a-loop.webp) · [高清MP4](../assets/sources/20261030-cover-a-motion/cover-a-loop.mp4)。动图独立交付。
- [选定原图](../assets/sources/20261030-trio-cover-options/cover-a-v002.png) · [运行封面](../assets/current/title/cover-a-title.webp) · [实际标题页截图](../qa/cover-a-adoption-20261030/browser-final/01-title-desktop.png)。

## 游戏接入

保留1671×941原件，等比缩为1279×720，在1280×720画布右侧补1像素；无裁切、无拉伸。底部增加渐暗区，将开始、继续、设置、图鉴排列在底部，避开三人面部与原画标题。

批准与资源指纹登记在[封面清单](../system/sui-title/manifest.json)，GUI在[标题布局](../system/sui-title/title.gui)。构建时覆盖标题入口，原SUI-U资源与GUI原件保留；PNG用于引擎兼容加载，WebP无损归档。角色/CG采用清单未由本任务改写。

## 即梦循环动画

使用即梦CLI 1.1.1、`seedance_2.0_fast_vip`，首尾帧均来自选定A，生成一段6秒正常视频。[即梦画布](https://jimeng.jianying.com/ai-tool/ai-canvas/3fec2a0b-7b0f-4780-937b-84f4b547d215) · [提示词](../assets/sources/20261030-cover-a-motion/animation-prompt.txt) · [生成与下载身份](../qa/cover-a-adoption-20261030/dreamina-state.json)。服务端报价上限36积分、无需额外确认；仅提交一次，资源积分快照不作为最终结算账本。

原片完整保留。循环衍生去除音轨，固定标题字形区域，末0.5秒平滑回到首帧。MP4为1280×720/24fps，动态WebP为960×540/20fps，GIF为720×405/12fps，均6秒；GIF/WebP设为无限循环且解码首尾画面一致。原片与衍生的参数、尺寸、时长、指纹见[导出记录](../assets/sources/20261030-cover-a-motion/exports.json)。

## 实际验证

[检查记录](../qa/cover-a-adoption-20261030/检查记录.md)：Chrome标题及菜单/开场8项检查通过；引擎标题截图与排版预览像素一致。横屏844×390、竖屏375×667为尺寸模拟。浏览器实际播放MP4并完成一次自动循环；资源格式、首尾、循环标记及分发文件指纹通过。

测试使用独立浏览器存储，玩家旧档保留；新构建须重新开始。未新增Firefox/Safari、手机真机、电脑原生运行、印刷或发布验收，未重新打四平台ZIP。关闭预览服务后可运行：

```sh
node tools/runtime/serve.cjs --web dist/sui-i02-20261030-cover-a-v1/web --port 49248
```
