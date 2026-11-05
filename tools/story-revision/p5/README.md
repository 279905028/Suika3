# P5 动态接入与同版本验收

当前采用29段，范围和实际验收见[整合报告](../../../docs/整合/P5动态CG整合验收.md)。已验网页包为 `qa/dialogue-p5-motion-20261104/build-v5/runtime/web/`，使用端口49345；新构建不得覆盖它。

```sh
node tools/story-revision/p5/build.cjs qa/dialogue-p5-motion-20261104/build-next web
node tools/runtime/serve.cjs --web qa/dialogue-p5-motion-20261104/build-next/runtime/web --port 49346
node tools/story-revision/p5/verify-final-package.cjs qa/dialogue-p5-motion-20261104/build-next qa/dialogue-p5-motion-20261104/package-next.json
```

`adopt-motion.cjs`登记29段及7项排除（孟遥夜间1、次晨6）；`build.cjs`复制冻结输入并生成独立包。`verify-coverage.cjs`验证正文模型及条件，`verify-native-conditions.cjs`用独立Suika WASM夹具检查正式条件函数；两者都不能冒称完整浏览器路线或macOS原生通过。`verify-final-package.cjs`核对冻结输入、当前运行源和所有网页产物，验收脚本/说明的后续变化逐项列出。

原生候选使用末参数 `native`，只保留正式静态演出，排除网页动态桥接；构建成功不等于原生应用验收通过。

## 同版本运行验收

两项工具均要求新的输出目录；在独立浏览器上下文或临时用户资料中，从真实 Suika 标题开始执行鼠标、键盘或触控输入。读取引擎日志做断言，不注入剧情状态，不读玩家存档。

```sh
P5_WORKERS=3 node tools/story-revision/p5/verify-routes.cjs <构建根目录> <端口> <新结果目录>
node tools/story-revision/p5/verify-restoration.cjs <构建根目录> <端口> <新结果目录>
```

构建根目录须含 `bindings.json`、`motion-bindings.json` 和 `runtime/`。可选末参数 `firefox`，需提供独立的 `PLAYWRIGHT_BROWSERS_PATH`；默认使用本机 Chrome。`P5_CASE_FILTER` 可仅跑部分路线，报告保留实际计划清单，不能把子集称为全路线。

- 路线测试：P4交接24分派＋孟遥HIGH/LOW各补AB/BB，共28路径；逐页正文顺序、完整选择表、静态CG首帧解锁、原生选择快照、结局/后日谈与第36天调用返回。动态按当前节点、路线和选择条件计算应出现列表，并核对实际首帧解锁；任何媒体失败均报错。进入视频或CG保护时释放输入，等待完整播放，不绕过保护。
- 恢复测试：81项14页图鉴与末页、普通两个手动槽、CG全图与加载、选择存档、回退改选、刷新/关闭重开、自动档和横竖屏触控模拟。
- 证据记录构建ID、浏览器版本、独立存储、截图、逐页日志、耗时和本机首开资源计时；历史证据不得覆盖。

这些脚本不替代人工逐段审美复看、真实手机、Safari、Windows/macOS原生、外网首开或长期压力验收。完整路线等结果以具体批次报告为准，脚本存在不等于执行通过。

`P5_RESTORE=1` 在代表路线内增加第36天事件、头盔寄放、人物/道具及黄球球形态的保存→前进→读取→刷新恢复；恢复日志单列，正文主遍历仍严格按顺序比对，首帧解锁集合联合统计。`P5_STOP_AFTER=hq-human` 可做抵达人形节点即停止的限定专项，结果为 `pass-scoped`，不得算完整结局路线。

合并跨批次的同构建通过记录时使用：

```sh
P5_PREVIEW=<构建根目录> node tools/story-revision/p5/summarize.cjs <新的汇总JSON> <批次报告1> <批次报告2>
```

汇总检查运行ID与全部网页/媒体指纹相同，只采纳各代表路径的通过记录；保留来源失败，不抹掉超时或工具问题。另输出实际去重正文节点、源段落覆盖与未覆盖列表。28代表路径不能代表所有选择组合均实玩。

`verify-edge-restoration.cjs <构建根目录> <端口> <新结果目录>` 补测隐藏路线两个独立前置条件的五项界面，以及孟遥 AA→AB→BA 的游戏内菜单逐级回退、下游重问、结局/后日谈重算和当前动态清除。它从标题以普通输入运行；已经获得的全局图鉴应保留。该限定专项不计为额外完整代表路线。
