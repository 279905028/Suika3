# P4-07 正式采用与 P5 构建

当前采用版本 `sui-p4-07-20261104-v7`。正文只从根 `scenario/` 读取；冻结副本用于追溯，不另设正文编辑入口。保留 P4-01/06 工具及历史证据，新增 v2 包版本校验、P4 资源复验与采用依据检查；不再借用“固定60CG/A11”旧校验器来处理新资源。

采用交接见 [P4-07](../../../docs/修订协作/P4-演出与美术/P4-07/交接.md)。`preflight.cjs`、`prepare.cjs`、`adopt.cjs` 是本批单次协调步骤，完成后拒绝覆盖重跑。后续修订另建版本，不改本批冻结清单。

P5 可以对现行采用版做只读验证，并写入尚不存在的新目录：

```sh
node tools/story-revision/p4-adoption/freeze.cjs --check
node tools/story-revision/p4-adoption/validate.cjs --adopted
node tools/story-revision/p4-adoption/verify.cjs --adopted --out qa/dialogue-p5-新批次/static.json
node tools/story-revision/p4-adoption/build.cjs --out qa/dialogue-p5-新批次/build
```

构建前校验采用清单、262资源、4,814条完整状态与81个图鉴编号，复用65题134张未改选项图；通过P4-06的图鉴/全图/初始化优化生成新的Suika Wasm包。使用独立 `bijie-p4-07-isolated:` 存储，不读写历史玩家库。所有构建结果写在新目录，禁止覆盖历史包。

`verify-smoke.cjs <构建目录> <新QA目录>` 仅检查本机Chrome启动、14页图鉴末页、锁定状态与CG001全图；不替代全路线/存档/设备验收。无独立人工审图者参与本批CG116返修复核，P5须复看清晨图真实呈现。结局动态CG未接入，电脑原生包与发布不在本工具范围内。
