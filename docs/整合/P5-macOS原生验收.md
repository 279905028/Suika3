# P5 macOS 原生验收

更新：2026-11-05。原生 v3 已通过本机限定冒烟：手动保存、读回、退出重开恢复、首次选择及菜单切换。原生采用静态演出，不含网页动态视频桥接；未作原生全路线或全部 CG 节点验收。

本次运行身份为 `49aa385f6badbb2cd6cd41c2bf69976dbee697b470cad19047c293502b455f75`，正文版本与 P5 网页一致；存档独立，不跨版本迁移。

## 已发现并定位的问题

初版原生包在 macOS 26.6.2 真实打开标题、进入共通第一句，阅读菜单与存读档页面正常；自动档时间、章节、末句和缩略图可见。保存手动槽 1 后文件已生成，但保存面板重绘时进程退出。

v1 系统崩溃记录为 `EXC_BAD_ACCESS / SIGSEGV / 0xC`，主线程经过 `s3i_int_to_image → Suika_renderImage`。这是图片句柄访问异常，不能归为内存压力终止。派生包取消这段存档缩略图绘制，保留槽位、时间、章节及末句文字卡片。

v2 手动保存仍退出，出现另一条 `SIGABRT`：`Metal blitCommandEncoderCommon → hal_notify_image_update → Engine_loadTexture`。代码核对及独立调用链审核指向保存成功提示的背景图在 `Suika.render()` 后首次懒加载。v3 将提示背景、选项标题和焦点图移至启动时预载，选择卡片移到 `update()` 准备；渲染阶段只绘制已有纹理。相同保存流程在 v3 真实运行成功。未修改 SDK 二进制。

- [初版实际结果](../../qa/dialogue-p5-motion-20261104/native/report.json)
- [崩溃摘要](../../qa/dialogue-p5-motion-20261104/native/crash-20261105-092316.json)
- [真实标题](../../qa/dialogue-p5-motion-20261104/native/01-title.png)与[正文](../../qa/dialogue-p5-motion-20261104/native/02-story.png)
- [v2 失败记录](../../qa/dialogue-p5-motion-20261104/native/v2/report.json)及[第二次崩溃栈](../../qa/dialogue-p5-motion-20261104/native/v2/crash-20261105-095403.json)
- [v3 渲染调用链独立审核](../../qa/dialogue-p5-motion-20261104/native/v3/render-lifecycle-review.json)

## v3 实际复验

在 macOS 26.6.2 arm64 上通过标准 `.app` 操作，以下均为真实可见结果：

| 检查 | 结果与证据 |
| --- | --- |
| 标题、共通正文 | 两次启动均完整显示，见[标题](../../qa/dialogue-p5-motion-20261104/native/v3/01-title.png)。 |
| 手动保存 | 槽 1 出现时间、章节、末句及“已保存阅读位置”，见[保存成功](../../qa/dialogue-p5-motion-20261104/native/v3/03-manual-saved.png)。 |
| 推进后读回 | 推进到第二句，再读取槽 1，恢复第一句，见[读回原句](../../qa/dialogue-p5-motion-20261104/native/v3/05b-loaded-full.png)。 |
| 退出重开 | 通过原生 Quit 退出，重新启动后从“继续阅读”读取槽 1，恢复原句，见[重开恢复](../../qa/dialogue-p5-motion-20261104/native/v3/07-reopened-manual-restored.png)。 |
| 首次选择与焦点 | 两个选项均显示；Down 按键焦点可见，见[焦点](../../qa/dialogue-p5-motion-20261104/native/v3/09-keyboard-focus.png)。 |
| 选择页存读档 | 槽 2 保存和覆盖保存成功；选 A 进入分支后读取槽 2，恢复双选项，见[覆盖保存](../../qa/dialogue-p5-motion-20261104/native/v3/10-choice-overwrite-saved.png)、[恢复选择](../../qa/dialogue-p5-motion-20261104/native/v3/12-choice-restored.png)。 |
| 菜单切换 | 选择页进入图鉴，再返回后仍完整显示双选项，见[返回选择页](../../qa/dialogue-p5-motion-20261104/native/v3/14-choice-returned.png)。 |

最终已用原生 Quit 正常退出测试应用。测试后仅观察到 v1/v2 两份既有崩溃报告，无新增报告；[完整结果](../../qa/dialogue-p5-motion-20261104/native/v3/report.json)记录实际范围、存档指纹和操作限制。

短促的自动化按键曾未触发，Down 显式按住 150ms 后正常；退出使用原生菜单。v2 缩放窗口时曾出现局部白区，再次缩放后恢复；v3 默认尺寸两次启动显示正常，未将窗口缩放稳定性列为通过。

## 派生边界与重建

只从本批 `build-native-v1/runtime/stage` 冻结包派生，未修改 SDK、网页包、原生初版、正文或采用美术。693 项输入中只有 `main.ray` 改变：存档卡片不绘制 SDK 缩略图、纹理准备移出渲染阶段，并写入新的构建身份。重新生成资源包，保留 1,000 个函数；其余输入逐字节一致。复验后冻结输入和运行副本核对无差异。

```sh
node tools/story-revision/p5/build-native-preload.cjs
```

这是本次实际构建命令，输出 `build-native-v3` 和 `native/v3/run`；工具拒绝覆盖已有构建或存档，因此当前工作区重复运行会安全停止。本批工具仍将辅助报告写入固定 `native/v3`，不要直接把参数改为其他批次重复使用。字节一致的[工具快照](../../qa/dialogue-p5-motion-20261104/build-native-v3/build-native-preload.cjs)已保存，可在保留相同冻结输入的新副本中重建；不得为了重建删除现有验收证据。

应用位于 [P5原生安全版.app](../../qa/dialogue-p5-motion-20261104/native/v3/run/P5原生安全版.app)，与游戏数据并排。其独立存档目录为 `qa/dialogue-p5-motion-20261104/native/v3/run/save`。SDK 二进制指纹与历史原生验收所用文件一致；复制后隔离属性仍保留，未关闭系统保护。未读取玩家旧档。v1、v2 失败包和测试档均保留。

- [构建入口](../../tools/story-revision/p5/build-native-preload.cjs)
- [派生差异与构建身份](../../qa/dialogue-p5-motion-20261104/build-native-v3/build-result.json)
- [执行文件、隔离属性与输入核对](../../qa/dialogue-p5-motion-20261104/native/v3/binary-check.json)

## 当前待办

- [x] 初版真实原生启动与共通正文、菜单、自动档可见性检查。
- [x] 原生存档缩略图句柄及渲染阶段纹理懒加载两次崩溃定位；v1/v2 证据保留。
- [x] v3 真实手动保存、读取、退出重开恢复及首个选择相关回归。
- [ ] 原生完整路线、CG 静态回退节点、回退改选及长时运行。
- [ ] Windows 原生和手机真机；本机当前无对应运行环境。

网页完整播放、路线与保存恢复结果单独记录；本报告不替代这些证据，也不代表原生视频支持或发布验收。
