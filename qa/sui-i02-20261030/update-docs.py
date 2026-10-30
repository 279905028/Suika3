from pathlib import Path
import json,sys
root=Path(__file__).resolve().parents[2];qa=Path(__file__).parent
r=json.loads((qa/'final-verification.json').read_text());assert r['status']=='PASS_SCOPED_WEB_CANDIDATE'
v=r['version'];suffix=v.rsplit('-',1)[1];n=r['counts'];port=49244
c=json.loads((root/'dist'/v/'candidate-manifest.json').read_text())
colors=json.loads((qa/v/'all-colors.json').read_text());max_error=max(p['error'] for x in colors['checks'] for p in x['probes'])
routes=json.loads((qa/v/'routes/routes-report.json').read_text());bindings=json.loads((root/'build'/v/'input/docs/整合/bindings.json').read_text())['bindings']
seen={l.split('|node=')[1] for x in routes['results'] for l in x['logs'] if l.startswith('SUI_I|enter|')}
used={p['assetId'] for b in bindings if b['anchor']['nodeId'] in seen for p in [b['enter']['background'],*b['enter']['characters'],*b['enter']['props'],b['enter'].get('cg')] if p}
metric=r['webLaunchSample'];arc=next(x['bytes'] for x in c['outputs'] if x['path']=='web/assets.arc')
(root/'docs/整合/SUI-I02.md').write_text(f'''# SUI-I02 构建打包与运行整合

2026-10-30｜**已完成**。交付候选 **`{v}`**；正式构建、分平台打包和网页运行初验通过，交SUI-Q独立验收。

## 当前入口

- [本机预览](http://127.0.0.1:{port}/) · [运行文件](../../dist/{v}/) · [四个平台压缩包](../../dist/{v}-packages/)
- [候选清单](../../dist/{v}/candidate-manifest.json) · [冻结输入](../../build/{v}/) · [压缩包校验和](../../dist/{v}-packages/checksums.json)
- [实际验证与未测范围](../../qa/sui-i02-20261030/交接.md) · [最终机器记录](../../qa/sui-i02-20261030/final-verification.json)

消费I01的[10月30日正式快照](../../qa/sui-i01-closeout-20261030/snapshot.json)，数据版本 `sui-i01-20261030-v2`、接口 `SUI-I-1`。本版含12份正文、3,021页、65处选择、134个选项、14个结局、3,086条完整演出绑定和60张CG。

212项批准WebP全部随包：174项参与绑定、38项备用；420个节点遵守I01声明的文字镜头。网页、macOS universal和Windows x64/ARM64来自同一份{len(c['inputs']):,}项输入快照；两端按SDK分别处理WebP通道，运行ID不同，存档不互相导入。

## 完成内容

- 独立完整状态执行器归并178组场景，合并脚本775个函数，解决完整绑定超出引擎函数上限的问题；绑定ID、条件、来源和图层映射保持。
- 连续页复用未变图层；读档、新游戏重新加载并保色。按当前节点重算唯一绑定，拒绝缺失、未知和错配的演出状态。
- CG首次实际可见才解锁；同段全图查看隐藏正文和菜单，退出留在原段。全局图鉴解锁不随剧情回退撤销。
- 保留1自动＋3手动档、选择检查点、构建版本校验及写回失败重试。生成时将系统菜单返回按钮移出阅读菜单入口的点击范围，解决长按打开后立即关闭的问题；U源文件保持不变。
- 固定输入两端16项产物重建一致，14项分发文件及4个ZIP逐项校验通过。

同一候选完成19项浏览器功能、11项演出专项、16条完整代表路径和全60CG自然显示/解锁；212图独立解码与保色、四类演出读档/刷新恢复、四种菜单点击时长均通过。详细数量、截图与证据边界统一记录在本批交接，不把探针或自动流程当作全篇人工验收。

I01快照包含的旧演出工具按原字节保留；本次使用 `presentation-full.cjs/.ray`。正文、批准图片、I01采用/绑定/冻结证据、C/U、SDK和历史工程未改。测试使用独立临时浏览器资料，玩家旧档保留。

## 使用与复现

```sh
node tools/runtime/serve.cjs --web dist/{v}/web --port {port}
node tools/integration/runtime/verify-package.cjs dist/{v}
node tools/integration/runtime/rebuild.cjs {v} qa/sui-i02-20261030/rebuild-{suffix}-new
```

重建核对须指定尚不存在的QA目录。修改后生成新候选也必须使用新版本名，例如：

```sh
node tools/integration/runtime/build.cjs --mode candidate --version sui-i02-20261030-v8 --snapshot qa/sui-i01-closeout-20261030/snapshot.json
python3 tools/integration/runtime/archive.py sui-i02-20261030-v8
```

## 后续范围

SUI-Q继续独立人工验收全篇/全分支及每处衣装、形态、道具、镜头意图；手机真机、Safari/Firefox、电脑原生运行、长期压力、峰值内存和移动网络仍未测。签名、公证、安装包封装及发布未执行，发布目标未配置。

本批v1～v6保留排错证据，不能作为当前交付。旧[10月29日诊断交接](../../qa/sui-i02-20261029/交接.md)也不代替本版验收。候选清单内“未测”为构建时记录，后验以本批最终记录为准，不回写已冻结候选。
''')
(qa/'交接.md').write_text(f'''# SUI-I02 正式候选交接

2026-10-30｜**已完成构建、打包与网页运行初验**｜候选 **{v}**｜交接对象：SUI-Q。

## 交付入口

| 产物 | 路径 |
| --- | --- |
| 本机网页 | [127.0.0.1:{port}](http://127.0.0.1:{port}/) |
| 网页与电脑运行文件 | [dist/{v}](../../dist/{v}/) |
| 四个平台ZIP与SHA-256 | [压缩包目录](../../dist/{v}-packages/) · [校验和](../../dist/{v}-packages/checksums.json) |
| 输入与生成物 | [冻结构建](../../build/{v}/) · [候选清单](../../dist/{v}/candidate-manifest.json) |
| 当前结论 | [最终验证记录](final-verification.json) · [使用与重建说明](../../docs/整合/SUI-I02.md) |

生产者快照：`qa/sui-i01-closeout-20261030/snapshot.json`，SHA-256 `{c['handoff']['snapshot']['sha256']}`。

| 身份 | SHA-256 |
| --- | --- |
| 输入总指纹 | `{c['inputFingerprint']}` |
| 正文 | `{c['contentBuildId']}` |
| 网页运行 | `{c['runtimeBuildIds']['web']}` |
| 电脑运行 | `{c['runtimeBuildIds']['desktop']}` |

{len(c['inputs']):,}项冻结输入；12份正文、3,021页、65选择、134选项、14结局；212项批准WebP、3,086绑定、60CG。174项资源参与绑定，38项备用，420个节点采用I01声明的文字镜头。

## 实际验证

| 层次 | 结果 | 证据 |
| --- | --- | --- |
| 正文与规则 | 32,768组共通、2,818组路线、1,280次事件调用/返回；19编译＋26状态拒绝负例 | [内容检查](audit-compiler-report.json) |
| 浏览器功能 | 19项：1自动＋3手动、选择快照/回退、刷新/关闭重开、身份、旋转/触摸、写回失败与重试 | [浏览器报告]({v}/browser-report.json) |
| 完整代表路径 | 16条、{n['narrativePages']:,}次正文页访问、{n['actualChoiceClicks']}次真实选择；逐页顺序、检查点、结局与后日谈一致 | [路径报告]({v}/routes/routes-report.json) |
| 六线关键规则 | 孟遥AA/AB/BA/BB；飘HIGH/LOW及LOW两结局；黄球球门禁；朋友LOW公共事件/FR-E2消息视角 | 同上；自然孟遥四组合为HIGH，其他关系展开由内容检查覆盖 |
| CG与图鉴 | 全60CG在自然路径实际显示、首次可见帧解锁并打开全图；CG001跨浏览器重开、锁定与解锁持久化另验 | [11项演出检查]({v}/presentation/report.json)、路径报告 |
| 全量资源 | 212图在独立派生Wasm探针中实际解码、核对尺寸并逐张渲染；7项状态正负例通过 | [资源探针]({v}/asset-probe/report.json) |
| WebP保色 | 212资源＋60自然CG截图，共{n['colorProbes']:,}个源图选区；最大RGB均值误差{max_error:.2f}/255 | [全量颜色报告]({v}/all-colors.json) |
| 开场/CG恢复 | 48色探针，背景/人物/CG读档及重开、CG进出后的声明背景恢复 | [开场像素报告]({v}/presentation/color-report.json) |
| 球形/人形/人物/道具恢复 | 黄球球球形、人形及飘人物、道具共4处；手动读档、刷新后恢复的8组画面区域逐像素一致 | [自然恢复路径]({v}/restoration-final/routes-report.json) · [像素核对]({v}/restoration-pixels.json) |
| 菜单回归 | 菜单入口0/60/350/1000ms、其他控件统一60ms，均完成保存、读取和刷新恢复；移位返回按钮实际点击通过 | [时长检查]({v}/menu/report.json) · [返回检查]({v}/menu/back-report.json) |
| 声明状态执行 | 3,086合法恢复、6,172组图层映射、12,344损坏状态拒绝；178组共享状态 | [语义检查]({v}/state-audit.json)，非原生全路径验收 |
| 重建与打包 | 两端16项产物逐字节一致；14项分发文件与4个ZIP内容/CRC通过 | [重建](rebuild-{suffix}/report.json) · [包检查](package-verify-{suffix}.json) |
| 来源保护 | 1,130项记录输入未变，含正文、SDK依赖、C/U、I01采用/绑定/接口与冻结证据 | [保护结果](protected-report.json) |

16条自然路径覆盖{len(seen):,}个不同绑定节点、{len(used)}项不同资源；未声称3,086节点已全部引擎试玩。212图探针包含38项备用，未声称备用图在正式剧情出场。

目视检查开场人物、CG阅读态、手机尺寸选择页、菜单，以及3张覆盖60CG的全图联系表：[1]({v}/cg-sheet-1.jpg)、[2]({v}/cg-sheet-2.jpg)、[3]({v}/cg-sheet-3.jpg)。全图没有正文或菜单遮挡；该检查不替代所有镜头意图的人工终审。

网页资源包{arc:,}字节。独立桌面Chrome冷资料、本机回环单次采样：导航到标题{metric['navigationToTitleMs']/1000:.3f}秒，Wasm固定512MiB、JS堆约{metric['jsHeap']['usedJSHeapSize']/1e6:.0f}MB。该采样不是手机、移动网络、长期运行或进程峰值内存结论。

## 实现与失败记录

- 完整状态归并和集中登记将脚本降至775函数，解决v1/v2启动时的函数上限错误。
- 完整执行器独立放在 `presentation-full.cjs/.ray`，保留I01冻结的旧工具和接口。连续页复用图层，读档/新游戏重新解码，按正文游标校验唯一绑定。
- v3补充测试发现菜单入口和返回按钮重叠；v4/v6输入释放尝试未通过完整回归，v5被构建锚点检查拒绝。最终v7只在生成菜单中将返回按钮从x=1080移至x=944，避免同次点击误触，原U界面文件未改。仅v7作为当前交付。
- 将0ms合成鼠标脉冲同时用于全部原生GUI控件的压力尝试曾漏掉一次读取；[原始失败]({v}/menu/all-controls-zero-duration-attempt1.json)保留，常规点击和真实触摸初验通过。菜单时长专项固定其他控件为60ms，零持续时间全控件压力可靠性留Q另验。
- 诊断和中间失败结果全部保留。资源探针、菜单诊断使用派生包；最终交付结论只取上述同一v7证据。

## SUI-Q待办与边界

- [x] 正式候选冻结、构建、重建；网页、macOS universal、Windows x64/ARM64文件及ZIP生成。
- [x] 同一候选完成上述网页引擎、资源/CG、条件、存档恢复与菜单初验。
- [ ] 全篇/全分支独立人工验收、剩余节点及逐拍衣装/形态/道具/镜头意图。
- [ ] 手机真机、Safari/Firefox、macOS与Windows原生启动和交互。
- [ ] 长期资源压力、峰值内存与移动网络体验。
- [ ] 签名、公证、安装包封装、发布目标配置与发布。

测试使用独立临时浏览器资料与本机端口，没有读取或替换玩家旧档，未改正文、批准资源或旧工程。候选清单保留构建时“未测”字段，后验以本批最终验证记录为准。
''')
for rel in ['README.md','tools/runtime/README.md','docs/开发计划.md','docs/SUI-I整合子任务.md']:
 p=root/rel;s=p.read_text().replace('sui-i02-20261030-v3',v).replace('49232',str(port));p.write_text(s)
p=root/'docs/开发计划.md';s=p.read_text().replace('以下为拆分后的待执行任务，均未因本次规划而完成。','以下为任务分工；A01～A11已交付，当前采用与运行状态见TODO及SUI-I交接。').replace('当前60镜相关上游已全部冻结并经A09放行；CG成品及运行采用待完成','当前60镜已完成制作、A11复核、I01采用及I02网页初验').replace('SUI-S负责冻结上述正文与内容契约，`runtimeReady`仍为`false`。其检查记录与SUI-T技术样板分别核验；仅规则确定不等于技术样板通过，也不表示已完成引擎、存档或可玩版本验收。','SUI-S负责上述内容契约；源登记的`runtimeReady=false`保留其原交付状态。当前完整资源候选、存档和网页初验以SUI-I02交接为准，各阶段证据分别记录。');p.write_text(s)
(root/'dist/README.md').write_text(f'''# 当前候选

2026-10-30｜使用 **{v}**。

- [运行文件]({v}/)：网页、macOS、Windows x64/ARM64。
- [分平台压缩包]({v}-packages/)：四个ZIP及SHA-256。
- [SUI-I02说明](../docs/整合/SUI-I02.md) · [实际验证](../qa/sui-i02-20261030/final-verification.json)

v1～v6仅保留排错证据；当前v7完成网页运行初验。电脑原生、手机真机、独立人工验收及发布另行完成。
''')
p=root/'TODO-v1.1.md';s=p.read_text()
s=s.replace('- [ ] SUI-I02：构建与运行适配、212项资源限定拍点诊断已通过；I01 v2输入现已冻结，待消费新交接生成同源正式候选并做运行初验。已有诊断证据见[10月29日交接](qa/sui-i02-20261029/交接.md)。',f'- [x] SUI-I02：正式候选 `{v}` 已完成冻结、构建、四平台打包与网页运行初验；212资源、3,086绑定、全60CG及存档恢复验证完成，见[10月30日交接](qa/sui-i02-20261030/交接.md)。')
a=s.index('## SUI-I02 2026-10-29 技术整合');b=s.index('## SUI-S 规则与内容',a)
s=s[:a]+f'''## SUI-I02 2026-10-30 正式整合

- [x] 消费I01正式冻结快照，交付 `{v}`：网页、macOS universal、Windows x64/ARM64文件及4个ZIP；{len(c['inputs']):,}项输入可追溯，两端16项产物重建一致。
- [x] 完整状态归并为178组、775函数；212批准WebP、3,086绑定和60图鉴接入。CG首可见帧解锁、同段全图查看及全局持久化通过。
- [x] 同候选19项浏览器功能、11项演出专项、16条完整代表路径（{n['narrativePages']:,}页访问、{n['actualChoiceClicks']}次选择）通过；全部60CG自然显示/解锁，六线重点规则符合当前契约。
- [x] 全212图解码/渲染、{n['colorProbes']:,}色探针；球形、人形、飘人物/道具的8组恢复像素核对通过。菜单返回位置重叠已修，4种点击时长和返回按钮回归通过。
- [x] 3,086合法恢复、12,344损坏状态拒绝及1,130项来源保护通过；仅使用独立浏览器资料，玩家旧档保留。证据及具体边界见[本批交接](qa/sui-i02-20261030/交接.md)和[最终验证](qa/sui-i02-20261030/final-verification.json)。
- [ ] SUI-Q全篇/全分支独立人工验收、逐拍衣装/形态/道具；手机真机、Safari/Firefox、电脑原生、长期压力、峰值内存及移动网络；签名/公证/安装包封装和发布分别待验。

10月29日限定拍点诊断仅为[历史证据](qa/sui-i02-20261029/交接.md)。本批v1～v6失败或中间版本保留排错，不作为当前交付。

'''+s[b:]
s=s.replace('- [ ] SUI-A/I按横屏阅读区核对资源安全区，导入批准图并接真实图鉴解锁；SUI-Q对同一正式候选另验完整剧情/存档/CG、手机真机和桌面。','- [x] SUI-A/I已导入批准图、接入60CG真实解锁并完成网页初验；SUI-Q独立人工、手机真机和桌面原生待验，见上方I02当前交接。')
s=s.replace('当前本地运行：`node tools/runtime/serve.cjs`，端口49221；重建见[运行说明](tools/runtime/README.md)。','当前入口已转到SUI-I02正式候选，使用与重建见[运行说明](tools/runtime/README.md)；49221仅为SUI-E历史端口。')
s=s.replace('- [ ] SUI-A/I/Q接续美术与CG、完整人工试玩、手机真机、电脑原生包和发布；本批不把尺寸模拟或桌面浏览器当作这些验收。','- [x] 美术与CG已由SUI-I02接入并完成网页初验，见上方当前交接。完整人工试玩、手机真机、电脑原生运行和发布仍由后续验收记录。')
s=s.replace('SUI-U交付时图鉴登记52个保留编号；本轮A09补选后源登记扩至60个空槽，该60项版本尚未重建或验证正式运行包。','SUI-U交付时图鉴登记52个保留编号；A09补选后扩至60项，现已由SUI-I02接入真实CG并完成网页初验。')
p.write_text(s)
print('已更新I02交接、使用说明、当前入口、开发计划与TODO。')
