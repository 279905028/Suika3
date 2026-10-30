# SUI-S 源稿规则核查

范围：SUI-S 源稿的状态、选择、调用返回、结局及后日谈静态展开；不是 Suika3 引擎/存档/浏览器/手机/发布验收。

结果：通过。

| 检查 | 结果 |
| --- | --- |
| 契约、稳定锚点与控制标记 | 通过 |
| 选择索引逐字一致 | 通过 |
| 关系8组合、初值与阈值边界 | 通过 |
| 共通全赋值、黄球球门禁与真实相识标记 | 通过 |
| 全路线、高低关系、调用返回、结局及双后日谈 | 通过 |
| 拒绝非法状态、未访问条件及不合法跳转 | 通过 |
| 历史SDK与检查工具保护 | 通过 |

实际计数：{"choices":65,"options":134,"declaredEndings":14,"commonAssignments":32768,"commonDistinctReadings":16384,"routeAssignments":2818,"sharedCalls":1280,"sharedReturns":1280,"epilogueReads":2754,"representativeTraces":46,"rejectedNegativeCases":24}。



输入指纹、来源行号、代表轨迹与分派结果见 [content-audit.json](content-audit.json)。

运行：`node qa/sui-s-20261028/check-rules.cjs`。仅证明本审阅器对源稿契约的展开；不证明人物动机、完整语义、引擎执行、存档恢复或真机表现。日序的 afterDay/beforeDay 检查为契约范围核查，正文时序仍须独立审读。
