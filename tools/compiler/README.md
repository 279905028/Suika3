# SUI-C 编译入口与接口 v1

2026-10-28。唯一输入为本工程 `scenario/`，内容契约为 schemaVersion 2。编译器只写显式输出目录；本任务默认输出到 `qa/sui-c-20261028/generated/`，不覆盖根入口，不接入旧 JS 播放器。

```sh
node tools/compiler/compile.cjs --out qa/sui-c-20261028/generated
node qa/sui-c-20261028/verify.cjs
```

## 编译与交接约定

- `story.ir.json`：独立中间表示，显式条件分支、选择、调用/返回、结局与后日谈；没有预填未来答案。
- `story.novel`：静态正文/选项及稳定标签。`story.ray`：配套的 `sc_` 函数及 `Tag_sc_` 标签处理器。SUI-E 将此模块与自己的宿主入口拼接；启动顺序为 `Suika.start()` → `sc_install()` → 新游戏 `sc_new()` → `SC_ENTRY`。`sc_install()`只登记只读表；读档不得再调用 `sc_new()`。
- 不使用 `${变量}`。选择先写临时变量 `sc_input`，再由提交处理器校验并写入 `sc_c_<选择ID>`。SUI-E 只在稳定正文/选项等待态保存。
- 原生变量前缀 `sc_` 是编译接口，不是正式存档库身份；正式项目名、存档迁移/回退/持久化与 UI 由 SUI-E/U 冻结。`sc_build` 必须匹配当前输入版本。运行错误进入 `SC_ERROR`，不默认 LOW；完成进入 `SC_DONE`，宿主按 `sc_status` 接管结束界面。
- `source-map.json`：每个生成单元对应文件、来源行、稳定锚点、原文摘要及 NovelML 行。选择、结局、显式 NODE 保留原 ID。普通段落 ID 由文件、标题/选项上下文和原文哈希产生，不依赖行号；相同上下文的完全重复段落以出现序号区分。修改文字可能改变该段 ID，跨版本档不能凭行号迁移。
- `manifest.json`：输入、编译器与输出指纹。相同输入和参数生成相同字节。输入变化应重新编译；不得手改生成文件。
- 默认一段一页，超长段按 Unicode 字素分割至每页120字素，原文按页拼接可还原；这是保守编译分页，不代表正式 UI 的排版验收。分页参数写入 manifest。
- 美术尚未采用；编译器不推断背景/立绘/CG、不导入示例图。资源接口预留为来源锚点，SUI-I 按批准清单绑定。

## 交给 SUI-E 的原生状态

| 原生变量 | 内容 |
| --- | --- |
| `sc_build` | 完整构建指纹；不匹配即拒绝继续 |
| `sc_c_<选择ID>` | 未访问为空；普通选择 A/B，ROUTE-01 为路线ID |
| `sc_score`、`sc_relation` | 关系分数；UNSET/HIGH/LOW，后两者表示已冻结 |
| `sc_e_day14-meeting-read`、`sc_e_PIAO-PREGNANCY-READ` | 0/1；公共事件仅RETURN完成后置已读 |
| `sc_route`、`sc_ending` | 当前互斥路线及合法结局；后日谈不改写 |
| `sc_return` | 空或五条登记返回锚点之一；须随事件内存档恢复 |
| `sc_dispatched`、`sc_epilogue` | 0/1；后日谈为空、EP-HIGH或EP-LOW（中间表示用来源文件名） |
| `sc_pending`、`sc_input` | 当前待提交选择ID及原生choose临时答案；提交完成清空 |
| `sc_cursor`、`sc_status`、`sc_error` | 稳定来源ID；running/complete/error；错误原因 |

`sc_validate()`验证内容状态的一致性，不验证原生存档容器、标签位置、历史快照和浏览器落盘；这些仍属SUI-E。`sc_diagnostic_visits/choices`仅为运行计数，不是存档状态。编译器不提供任意跳到旧选择的生产操作；回退必须恢复之前的完整快照并使下游状态失效。

当前SDK需要分批注册元数据，生成器每批12项，避免集中在一个函数中导致加载失败。字符串转义的原生探针覆盖NovelML参数传递；不是所有字体与正文富文本控制字符的视觉验收。

## 所有权与证据

本任务拥有 `tools/compiler/`、`qa/sui-c-20261028/`；集成更新根 TODO。正文、SDK、根入口、其他批次证据只读。编译与控制流测试、原生兼容探针、正式游戏/存档、真机与发布分别记录；最终结果见本批次交接。
