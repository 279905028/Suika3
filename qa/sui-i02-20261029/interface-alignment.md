# SUI-I01 / I02 接口对齐审查

2026-10-29｜只读审查；未改I01数据、共同接口或运行代码。**不能将现有I01数据直接重命名为SUI-I-1；它包含v1无法表达的运行限制。建议共同冻结SUI-I-2，并保留原I01清单为唯一可编辑来源。**

## 本次输入与现状

| 文件 | 本次读取SHA-256 |
| --- | --- |
| `assets/current/manifest.json` | `1accc11bdf98a366a6c59efb5b7777dc98085eb7ac77a41bdc243d94b35faac2` |
| `docs/整合/bindings.json` | `2a035c1177e2648b112be42d05c2be743ca83aa926027bd58fe8a44b21d45114` |
| `tools/integration/assets/contract.json` | `ab791292e800f3ab8ea9f67790ee3f119483e73b81306eb0ffdd680968df0531` |

I01正在更新：本轮前次读到175条绑定/51项备用，当前一致读取为 **212项采用、30项排除、174条绑定、52项备用**。任何候选只能锁最终交接，不能混用前后版本。

- 采用类型：character 67；prop 9；background 76；cg 60。
- 155个目标游标；19个游标有多资源cue，0个同slot冲突，1个多资源游标具有不同条件。166条排版有非整数x/y。
- 合同支持visiblePageIds多页；**本批实际多页cue为0**，不应把未出现的案例写成已验。
- entryGates：epilogue 5；sharedEvent 1；route 138；event 10。
- 本次逐页核对：174处当前来源摘要吻合，全部目标来自pageSize=108的当前编译。当前contentBuildId为`e6d026f4499bda5de649e8bac607cdbce76e398c1f5ab3edc80b4e3d5975f3fd`。
- 用户批准记录已由I01登记为`qa/sui-i01-20261029/approval.json`，范围明确引用212项proposal。记录可用于追溯；I02仍须锁定批准文件、proposal与逐项assetId，不能把本审查当作新增授权。当前生产者scope明确“限定拍点及批准备用”，应映射为partial而非全正文完整整合。

## 可直接映射的字段

| I01来源 | I02规范化目标 / 必须保留的内容 |
| --- | --- |
| schemaVersion / revision | 接收器精确识别`sui-i01-data-v1`；version=revision；共同执行语义另外使用新版本，不能静默接受未知版本 |
| manifest.records[].assetId / type | 原值；不重新命名资产 |
| source.path / sha256 | sourcePath / sourceSha256；保留其余原始元数据引用 |
| runtime.path / sha256 / bytes / width / height / format / alpha.channelPresent | runtimePath / runtimeSha256 / bytes / width / height / format / alpha；按真实文件和A11逐项核验 |
| derivativeSource | 保留其path/hash并加入冻结输入；不可只记录源PNG而遗漏真正拷贝的WebP |
| encoding | 保留完整结构。v1的parameters字符串最多可作无损JSON序列化，不能丢lossless/method/exact/profileProcess |
| approval.path / sha256 / decisionId | evidence.path/hash/reference；status从批准文件decision=approved验证，scope从批准assetIds验证，不从自由文本推断 |
| a11.path / sha256 / assetId | 原值；保留recordIndex/checks/visualEvidence引用与所引用证据指纹 |
| usage.restrictions | 原样数组；usage.form可映射form。wardrobeAndForm是说明文字，不能伪造为标准衣装枚举 |
| source.path / quoteSha256 / visiblePageIds | 每页anchor.file / sha256 / nodeId；验证paragraphId、contextAnchor、sourceSha256和全部pages属于同段，lineHint只定位 |
| display.slot | background→bg；character-center→center；prop-center→prop1；cg→cg。数值layer=0/10/20/30须与类型/槽对应，不只是随意排序 |
| display.x / y / scale | 原值。x/y需升级为有限number；不可无记录地round或truncate |
| cgId / gallery.id / variable / global | 必须相互一致并属于当前60项。解锁变量继续U的sui_cg_前缀 |
| reserves / excluded | 保留为有原因的独立列表；备用不自动绑定，排除项不打包，不能合并成“缺图”或批准采用 |

## 无法无损塞进现有v1的运行语义

1. **多资源cue与条件分别成立。** v1拒绝一个节点多个binding，I01把背景、人物、道具、CG分项。可在运行时按cursor归组并逐cue判断，再合成完整state；不可删除除CG之外的cue，也不可把所有条件合并成统一条件。实际`TEXT_3d133bc56ed5cf453822_1`的CG078只受黄球球路线门槛，人形另须`day14-meeting-read`；这两个判定须独立保留。同slot冲突继续拒绝。
2. **typed entryGates不是v1选择表达式。** route可映射routeIds；event要检查`sc_get("e_"+eventId)=="1"`；epilogue文件应通过当前routes.json规则解析成EP-HIGH/EP-LOW，并检查已分派与当前后日谈；sharedEvent须校验PIAO-D36、允许五路线、LOW、有效调用返回帧及来源段，不能仅替换成LOW。全部先匹配cursor后求值，未知/缺失状态报错。
3. **requiredExpressions数组表示逐表达式AND。** 每个表达式内部仍按C的&高于|解析。不能简单`join('&')`：CG106包含HIGH与`PI06-01=B|PI08-01=B`，直接拼接会放宽第二个OR分支。保留AST数组逐条求值，或作严格逻辑笛卡尔展开；不可引入C不支持的括号字符串。
4. **目标页重算，不继承旧restore。** I01要求每次到达目标cursor，从中性`#10181c`和空人物/道具/CG开始，汇总目标所有非CG cue后再叠CG；选择时隐藏美术。v1的exit.restore是固定完整state，随后可沿未绑定页保留，与此冲突。恢复策略应新增`resolve-destination`，加载/回退按恢复游标、条件和当前输入重算，不能沿用上段背景或衣装。
5. **visiblePageIds决定段内生命周期。** 离开集合立即退出，不等lexicalNextCursor；跳转、回退、读档、重开都须应用。当前实际均单页，可按页归一化；共同合同仍应保留分组字段，避免未来多页出现逐页重新解锁/闪烁/视图态丢失。
6. **first-visible-frame解锁。** v1约定“遇见”不足以表达I01要求。载入纹理、注册资源、执行sc_at或准备state不等于已显示；应在当前CG纹理成功加载且该CG真正参与一帧渲染后提交一次全局解锁。隐藏选择/菜单、尚未绘制、加载失败不得解锁。读档到已展示CG允许维持全局记录；回退不重新锁。
7. **排版与遮挡。** contain/portrait、width/height、matte、crop=false及cgHidesBaseScene需执行/验证；仅转换x/y/scale会漏掉背景不足画布的底色和CG遮底语义。v1缺背景色字段，需要明确中性底色。fullViewWithinSameParagraph在非CG display也出现，不等于要给普通立绘生成全图按钮；CG reveal须同时隐藏message/name/menu/auto-status且不推进页。
8. **存档viewMode与可回退状态。** I01列出viewMode、cursor、bindingId、baseScene和条件/源版本复核；v1只存一个完整state ID不包含逐cue命中与段内查看状态。可把源输入指纹+cursor作为主键并重算，再独立保存当前合法viewMode；不可删除I01的recomputeOnLoad要求。
9. **限制证据不是自由文本备注的替代。** usage、sceneFacts、criticalRegions、sourcePlacement、provenance及审批proposal包含不可丢失的边界。规范化可以通过`sourceRecord:{path,sha256,jsonPointer}`锁定全文而不重复可编辑清单，但构建器须保留这些引用及冻结字节，未知影响执行的字段要报错。

## 最小共同更新建议

采用新增`SUI-I-2`，保留SUI-I-1诊断历史。I01原manifest/bindings仍是唯一编辑源；I02在build暂存生成规范化IR，禁止生成第二份可编辑采用表。

- 新接口明确接收生产者版本`sui-i01-data-v1`和合同SHA；schema完整定义cue、typed gates、表达式数组、浮点placement、visiblePageIds、target-cursor恢复和first-visible-frame解锁。原始限制与证据全文以记录引用保留。
- 资产层映射如上；绑定层直接保留逐cue结构，由I02运行器按cursor计算完整state。不能先把cue压为v1单一enter再希望运行器补回门槛。
- scope结构定为partial，说明“限定拍点+批准备用”；不用60个CG齐全推断整部正文连续演出完成。覆盖/缺项报告和备用理由进入交接。
- I01输出最终冻结快照，至少含共同接口、生产者合同、唯一manifest、bindings、批准+proposal、A11、逐项原件/运行衍生/derivativeSource与sourceHashes。I02前后核对冻结输入；以当前compile(108)补充contentBuildId且记录编译器指纹。
- 双方先通过小型真实组合用例：同页BG+CG、HQ人形门槛差异、CG106的AND/OR、未绑定页中性底色、首次可见帧、CG进出后读档/回退；再打完整212项包及60项注册。升级实现与实测完成前保持候选门禁，不要求I01删除限制以通过旧校验器。

本报告只完成接口差异与当前源映射核对，未改数据、未新增资源采用、未执行引擎/浏览器/手机真机/电脑原生或发布验收。
