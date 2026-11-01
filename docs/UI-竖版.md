# 竖版网页（720×1280）

2026-11-01。用户确认：竖屏手机单独用竖版画布；上方舞台加下方文字；横竖版存档互通。电脑原生版仍只有横版。

## 入口与切换

- 同一个网页包内含两个页面：根目录是横版（1280×720），`portrait/` 是竖版（720×1280）。两者同源，共用一个存档库。
- 页面打开时由外壳 `tools/runtime/shell.js` 按 `(orientation:portrait) and (max-width:900px)` 选择：竖屏手机进入 `portrait/`，其他设备留在横版。地址加 `?layout=landscape` 或 `?layout=portrait` 可以固定版式，不自动跳转（测试用）。
- 阅读中旋转手机时，底部出现「切换横版／切换竖版」提示。点击后先等自动存档写入（自动档在翻页后最多 1.5 秒写入），再跳到另一版式；回到标题后点「继续」读取自动档。「保持当前」在本次会话内不再提示。

## 画面规格

| 区域 | 位置（画布像素） | 说明 |
| --- | --- | --- |
| 舞台 | 0,0 – 720,720 | 背景取横版画面中间 720 宽（不放大）；人物缩放 0.9 倍，水平位置向中间收拢（系数 0.72），脚底不变 |
| 名字框 | 40,736 | 沿用电影侧栏名字框 |
| 文字框 | 24,792，672×440 | 30px 字、44px 行距，可排 8 行；当前 3021 页最多 6 行（见分页检查） |
| 菜单按钮 | 568,24，128×56 | 舞台右上角 |
| 选项 | 24,792 起每项 80，672×76 | 标题「做出选择」在 24,716；最多六项 |
| 系统页 | 顶部标题与返回，底部五项导航（y=1136） | 存读档单列四格；回顾每页四条；图鉴 2×3 |

- 选项、系统页和图鉴的位图由 `tools/ui-portrait/render.py` 绘制，配色与电影侧栏相同；没有变化的按钮直接复用电影侧栏批准件。
- 标题页暂用 B「夜班灯火」封面的中间部分加文字标题，没有动态标题（动态视频是横版）。如需专用竖版封面，替换 `render.py` 中标题部分后重建。
- CG 在舞台区显示中间部分；「查看全图」在竖屏下等比显示整幅（720×405）。

## 存档互通

- 两个页面使用同一份编译正文和行号登记，`start.novel`、`runtime-positions.json` 逐字节相同。
- 存档身份（`e_build_id`）由 `tools/runtime/build.cjs` 的 `saveIdentity()` 计算：正文、宿主与状态逻辑、UI 清单、SDK 和构建工具，不含版式产物。两个页面写入同一个值；`runtimeBuildId` 仍按版式分别记录。
- 人物和背景：读档后按状态名从各自的 `iStates` 表重新套用，所以同一个存档在两种版式下都会按各自的版式摆放。
- 文字框、名字框、选项框等：SDK 会把 `msgbox.*`、`namebox.*`、`choose.*`、`click.*` 等配置写进存档，读档时覆盖当前值（见上游 `conf.c` 中标为 SAVE/LOCAL 的项）。处理分两步：
  - 这些配置里的图片在两个包中用同一路径（`assets/current/ui-cinema/png/…`），竖版包在这些路径下放竖版图片，所以跨包读档不会找不到文件。
  - 读档成功后立即调用 `eApplyLayout()`，用本版式的值重写 `portrait-theme.cjs` 的 `LAYOUT_KEYS`（各框坐标与文字边距），再调用 `Suika.reloadStageImages()` / `reloadStagePositions()`。横版包也做同样处理。
- 存档缩略图在两版都是 192×108（SDK 按配置尺寸读写缩略图，尺寸必须一致）。竖版截缩略图时，临时把舞台中间 720×405 纵向拉伸铺满，截完立即还原。

## 可重建入口

```sh
node tools/ui-portrait/build.cjs        # 正文选项变化后重建竖版位图、GUI 与清单
npm run dev                              # 同时构建横版与竖版；竖版在 /portrait/
npm run release -- <版本>                # dist/<版本>/web/portrait/ 一并生成
```

- `tools/runtime/portrait-theme.cjs`：在电影侧栏之上叠加竖版改动（画布、配置坐标、GUI 映射、脚本坐标、舞台坐标、缩略图）。每处替换都核对锚点数量，上游代码变化时构建会直接报错。
- `system/sui-portrait/manifest.json`：竖版 UI 的批准记录、版面尺寸、资源指纹和 GUI 映射。
- `assets/sources/20261101-portrait-ui/`、`assets/current/ui-portrait/`：位图原件与运行用衍生（PNG，另存等像素无损 WebP）。和其他素材一样不进 Git，可用上面的命令重新生成。

## 同批修复

电影侧栏图鉴原本点「上一页／下一页」和缩略图都没有反应（横版同样如此）：图鉴处理放在 `Suika.update()` 之前，那时 `Suika.isMouseLeftClicked()` 拿不到点击。现在改成和阅读回顾一样按“按下瞬间”判断（`tools/runtime/cinema-theme.cjs`、`system/sui-cinema/runtime.ray`）；打开图鉴的那次按压不算作图鉴内的点击。

## 验证边界

结果记录在 [竖版验收](../qa/portrait-20261101/记录.md)。只做了 Chrome 无头模式的尺寸模拟；iOS/Android 真机、Safari/Firefox 和电脑原生运行都没有覆盖。
