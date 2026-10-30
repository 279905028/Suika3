# SUI-C 编译验证

[交接与实际验收](交接.md) · [编译入口和接口](../../tools/compiler/README.md) · [生成产物清单](generated/manifest.json)

- `generated/`：由当前scenario生成的NovelML、Ray、中间表示和来源映射。
- `verify.cjs`：只读执行SUI-S审阅器，与新编译结果穷举对照；结果写本批。
- `build-native.cjs`、`native-host.cjs`：独立原生探针宿主，答案是显式测试数据；不用于生产入口。
- `verify-browser.cjs`：原生快进、真实浏览器选择点击、参数探针和界面截图。
- `native/`、`web/`：可重建验证包与网页，资源依赖按`native-manifest.json`白名单打包；不作为正式采用图或发布包。
- `input-before.json`：受保护来源基线；`oracle/`保留本轮重跑的审阅器输出，不覆盖历史证据。
