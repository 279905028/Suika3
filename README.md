# 毕节，雨停之前 · Suika3 开发工程

2026-10-30｜唯一开发目录：`/Users/yipin/Desktop/Suika3`。

当前已迁入六线正文并调整孟遥婚姻线：陈晟为丈夫，关系结局为秘密继续或彻底断开。叶岚保留普通游戏队友身份，独立路线、选择入口和结局已取消。正文与开发资料由此目录维护，旧工程保留为来源。

- [正文入口](scenario/README.md) · [孟遥完整路线](scenario/孟遥-旧题.md) · [人物索引](docs/人物/README.md)
- [当前待办](TODO-v1.1.md) · [开发计划与分工](docs/开发计划.md) · [工程结构](docs/工程结构.md)
- [CG选择调整](docs/CG调整清单.md) · [美术资源规范](docs/美术资源规范.md)
- [SUI-S规则与内容交接](qa/sui-s-20261028/交接.md) · [内容规则契约](scenario/规则契约.md)
- [历史：六线迁入与婚姻线合并检查](qa/route-merge-20261028/README.md)

SUI-I02已生成完整资源候选 **sui-i02-20261030-v7**。使用[本机预览](http://127.0.0.1:49244/)或[分平台压缩包](dist/sui-i02-20261030-v7-packages/)。服务关闭后运行 `node tools/runtime/serve.cjs --web dist/sui-i02-20261030-v7/web --port 49244`。根Ray/NovelML是集成源，须通过独立构建入口生成后运行。构建、验证和未测范围见[SUI-I02说明](docs/整合/SUI-I02.md)。网页运行初验与电脑原生、手机真机、独立人工验收及发布分别记录。

本次只读内容复核见[检查结果](qa/sui-i02-20261030/audit-compiler-report.json)。历史检查工具默认会写入原批次，不直接重跑覆盖历史证据。检查结果只证明其覆盖的文稿与内容契约，不能替代引擎试玩。`tools/check-content.cjs`是旧schemaVersion 1的历史检查器，原报告留在历史批次，不作为当前契约的验收入口。
