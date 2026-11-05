# P4-01 映射与交付检查工具

输入及使用入口见[冻结说明](../../../docs/修订协作/P4-演出与美术/P4-01/README.md)。无第三方依赖，仅使用当前Node.js与工程编译器，不联网、不运行游戏、不读取浏览器存储。

- `freeze.cjs prepare`：核对P3/旧v6来源，独立试编译并生成输入、节点/段落/边界/历史映射和全量待审模板。只能在尚未冻结时运行。
- `freeze.cjs seal`：冻结P4-01文档、映射、模板及本工具文件，已有freeze.json时拒绝覆盖。
- `schema.cjs`：封闭字段定义；复用当前SUI-I-1的binding/state/placement格式。
- `validate.cjs`：只读检查单包，默认handoff，显式draft才允许待审。返回文件与资源目录指纹，不写正式文件。
- `verify.cjs`：独立重生成映射、非法交付正反例、全路径条件/边界覆盖与受保护文件检查；测试用已审标签和资源通过状态只在内存模拟。

本批已封存。以后复验必须使用尚不存在的新报告路径，不能覆盖历史QA：

```sh
node tools/story-revision/p4-bindings/verify.cjs --out qa/dialogue-p4-P4-01-新批次/verification.json
```

同名报告、未知参数、失效输入/接口指纹均拒绝。P4-07采用新正文或资源后，本版本输入检查自然失效；届时另冻结新版交接，不改写本批清单来绕过检查。
