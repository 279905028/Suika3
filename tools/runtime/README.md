# 当前动态CG整合版（2026-11-04）

29段动态已接入；当前网页为`qa/dialogue-p5-motion-20261104/build-v5/runtime/web/`，端口49345。孟遥夜间保留静态，同次留宿只播夜间。正式条件、播放约定、同版本标识和各平台实际结果统一见[P5整合验收](../../docs/整合/P5动态CG整合验收.md)；重建与路线测试见[P5工具](../story-revision/p5/README.md)。同版已部署[阿里云网页](http://106.14.32.114/)，外网验收与带宽限制另见[部署记录](../../docs/部署/阿里云.md)。重新开始，旧档保留。

```sh
node tools/runtime/serve.cjs --web qa/dialogue-p5-motion-20261104/build-v5/runtime/web --port 49345
```

下方均为历史基线，不作为当前试玩入口。

# 背景补全基线（2026-11-04）

当前为`sui-bg-fill-20261104-v1`，268资源、4,814绑定、81CG；495处原无背景节点已补齐。采用与复核入口见[背景补全交接](../../docs/美术/背景补全-20261104/交接.md)。同版本运行文件为`qa/background-fill-20261104/build/runtime/web/`，本机端口49333。P5全线和设备另验，旧档保留；下方P4构建入口已属历史冻结基线。

# P4采用基线（2026-11-04）

当前为`sui-p4-07-20261104-v7`，262资源、4,814绑定、81CG。使用[P4-07构建入口](../story-revision/p4-adoption/README.md)与[同版本交接](../../docs/修订协作/P4-演出与美术/P4-07/交接.md)；从头开始，独立存储，P5全线/存档/设备另验。下文预览、命令和结果均属历史版本。

# 当前构建与运行入口（2026-11-03）

P1独立小样已通过：点击[本机小样](http://127.0.0.1:49285/)中的“开始阅读”，选择网吧多人、飘LOW或孟遥条件段。详见[P1交接](../../qa/dialogue-p1-runtime-20261102/交接.md)。该小样使用独立存储；根正文与下方全稿候选保持原样。

```sh
node tools/runtime/serve.cjs --web qa/dialogue-p1-runtime-20261102/preview-v6/runtime/web --port 49285
```

本批构建支持长姓名适配，并拒绝会造成存档行号偏移的多行text标签及漏打包的入口资源。姓名来自编译元数据，不从立绘猜测。新正文与分页需要新构建，从头开始；正式全稿仍须后续冻结和整合。

当前候选为 `sui-i02-20261102-epilogue-v1`：后日谈仅接文文主结局仍单身的路径，恋爱／秘密关系继续及试着交往的结局直接结束。保留226项美术、电影侧栏和B循环封面；新版从头开始，旧候选与玩家存档保留。变更与实际验证见[本批交接](../../qa/epilogue-single-only-20261102/交接.md)。

```sh
node tools/runtime/serve.cjs --web dist/sui-i02-20261102-epilogue-v1/web --port 49270
node tools/integration/runtime/verify-package.cjs dist/sui-i02-20261102-epilogue-v1
```

后日谈版本的I01冻结快照为 `qa/epilogue-single-only-20261102/snapshot.json`。下方为2026-10-30的候选来源与历史入口。

立绘补全冻结为`sui-i01-portraits-20261030-v5`，226项美术资源。独立验收候选为`sui-i02-20261030-portraits-v2`，采用相同电影侧栏与B循环封面，入口[49262](http://127.0.0.1:49262/)；[补全结果与实际验证](../../qa/portrait-gap-fill-20261030/结果报告.md)。本批构建来源使用`qa/portrait-gap-fill-20261030/snapshot.json`；一次性制作/检查工具及其固定QA批次不直接重跑覆盖，后续修改另建批次。

上一候选为 `sui-i02-20261030-title-b1-v2`，已采用[方案一动态标题](../../docs/方案一动态封面接入.md)，保留[电影侧栏UI](../../docs/UI-电影侧栏.md)及当前补画立绘。标题与UI分别由`system/sui-title/manifest.json`、`system/sui-cinema/manifest.json`登记，旧SUI-U资源保留。动态标题仅用于网页，电脑原生使用静态B。

```sh
node tools/runtime/serve.cjs --web dist/sui-i02-20261030-title-b1-v2/web --port 49250
node tools/integration/runtime/verify-package.cjs dist/sui-i02-20261030-title-b1-v2
```

新候选通过 `tools/integration/runtime/build.cjs` 显式指定新版本和I01冻结快照生成；压缩包使用同目录 `archive.py`。现有版本、QA和玩家存档不覆盖。底层 `tools/runtime/build.cjs` 必须显式指定新的 `--out`，服务必须指定 `--web`，仅监听本机。

下方为SUI-E历史设计说明，其历史包没有正式美术；历史复验命令会写入原批次，不能直接用于新验收。

# SUI-E 运行接口与历史说明

2026-10-28。输入为当前 `scenario/`、SUI-C 编译器、`system/sui-u/` 与根宿主 `main.ray`、`start.novel`、`config.ini`。根 Ray/NovelML 是集成源，须通过下列入口合并后运行；不直接启动未合并的根脚本。

```sh
node tools/runtime/build.cjs --out qa/自行指定的新批次
node tools/runtime/serve.cjs --web qa/自行指定的新批次/web --port 49222
```

SUI-E当时的服务端口为49221，输出为 `qa/sui-e-20261028/`；这些仅为历史位置。当前入口见上方，不再支持无参数默认构建或服务。电脑浏览器可使用该入口；macOS/Windows 原生分发与手机真机须另验。

## 构建与身份

- `generated/`：按108字素重建正文、Ray模块、中间表示、来源映射和编译指纹。
- `stage/`：合并后的原生工程；五个固定GUI路径映射到U界面，仅在构建输出派生保存/读取动作、回退按钮及每个选择前的原生检查点。`runtime-positions.json`记录合并后的实际行号；编译阶段的`generated/source-map.json`仍用于追溯正文，不混作运行行号。
- `web/`：`index.html`、`assets.arc`、`shell.js`、`shell.css`；清单记录全部输入/输出SHA-256。
- 项目名固定为「毕节，雨停之前 · Suika3」，网页数据库前缀固定为 `bijie-rain-suika3-v1:`。不读取、导入或改写其他项目的存档库。
- `runtimeBuildId`包含正文编译指纹、根宿主/UI/配置、SDK与外壳；存档须精确匹配。不同构建不按行号迁移，原档保留。
- 根原SDK入口已留在本批 `original-entry/`；SDK、U原文件及正文未改写。网页包只含142项白名单输入，没有采用新的角色、场景或CG。

## 阅读、保存与回退

标题提供开始、继续、设置和图鉴；菜单提供保存、读取、回顾、自动、快进已读、设置、返回标题和回到上一选择。用户存档只在正文/选择等待态保存；内部选择快照由每个选择前必经的`e_checkpoint`原生等待步骤保存，不依赖显示帧或键盘松开时机。读取前校验版本，读取后校验原生文件/标签位置、稳定来源、内容状态与待选节点，再继续脚本。结局与错误有独立返回入口。

用户槽为0自动、1～3手动。自动档在稳定页变化后最多延后1.5秒写入；若检测到其他版本自动档，保留该档并提示本轮使用手动存档，不自动覆盖。点击手动保存会覆盖所选槽，界面有提示。网页状态栏区分写入中、已落盘和失败；失败可重试，未完成时关闭页面会触发浏览器保护。

内部槽10～99保存最近90个选择节点的完整原生快照。每个存档保存自身的路径、槽号和代次；回退恢复选择前的全部剧情状态，原生检查点接续到选项后可以重选。当前停在未选节点时回到上一已读节点；新游戏和读取另一存档不会把路径接到其他周目。若旧快照已经被90槽循环覆盖，明确拒绝回退且保留当前状态，普通手动档仍可读。

SDK读档会清空回顾，因此回顾从恢复点重新累计；不是全文跨会话历史库。设置仍使用原生全局变量持久化；本批未绑定正式CG。资源接口沿用SUI-U登记，SUI-I须在批准图导入后验证WebP保色、演出和资源随存档恢复。

## 复验

- `node qa/sui-e-20261028/pagination-check.cjs`：全页字体度量、原文还原与确定性。
- `node qa/sui-e-20261028/shell-unit.cjs`：网页写回队列与恢复失败的独立故障测试。
- `node qa/sui-e-20261028/verify-browser.cjs`：正式候选四槽、回退、刷新/重开及手机尺寸触摸。
- `node qa/sui-e-20261028/verify-routes.cjs <runtimeBuildId>`：同一候选七条代表路径，普通键盘/鼠标输入，逐页对照当前IR。
- `node qa/sui-e-20261028/audit-runtime-negative.cjs`：独立派生探针中的状态拒绝测试；不注入正式候选。
- `node qa/sui-e-20261028/verify-event-save.cjs`：正式公共事件内存档、重开、恢复及返回。

浏览器检查使用独立临时资料，不能指向玩家日常浏览器资料。最终实测结果与边界见本批交接。
