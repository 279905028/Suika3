# P4-06 候选接入工具

只写新建的 `qa/dialogue-p4-P4-06-*/`。不采用正文、资源或全局登记，不修改P4-01冻结工具。交付与实际验证见[交接](../../../docs/修订协作/P4-演出与美术/P4-06/交接.md)。

- `catalog.cjs`：复用P4-01资产/既有编号检查；独立核验P4-04与“CG扩充20张”的真实新编号登记。核对P4-05检查对应的资产、源图、运行文件和指纹，不把旧A11证据伪装成本批复验。
- `assemble.cjs`：读取七包，按节点完整覆盖，展开运行绑定与资源，生成图鉴清单和未闭合项。`draft`仅供技术检查；`handoff`要求审阅、需求、资源采用依据和所有CG绑定均闭合。
- `choices.cjs`：逐题核对题干、选项文字、值、顺序、图片登记及实际文件指纹。一旦变化即拒绝沿用，要求重建受影响图；本批65题134图均未变化。
- `presentation.cjs`：生成81项/14页图鉴、末页有效格子导航、深色全图提示和退出清理。压缩绑定登记，保留完整状态、条件和解锁变量。代码仅进入QA候选。
- `build.cjs`：冻结所需输入，在独立 `input/scenario/` 中编译P3候选，再构建Suika Wasm包。核对821份消费文件及保护集；检查当前SDK的1024函数上限。网页只用 `bijie-p4-06-isolated:` 存储。
- `verify.cjs`：候选/负例、旧60/61项兼容、生成确定性、全部绑定登记等价性及恢复语义检查。
- `verify-engine.cjs`：81张真实图片的独立合成引擎夹具；全图开关、首可见帧、原生存读档、清场与末页。不把合成顺序当成正文路径。
- `verify-preview.cjs`：完整P3技术候选的Chrome启动、电影图鉴、返回和CG001全图专项；包括844×390模拟尺寸，不是真机验收。

所有输出目录必须尚不存在，不能重跑覆盖下列示例路径：

```sh
node tools/story-revision/p4-integration/assemble.cjs --mode draft --out qa/dialogue-p4-P4-06-新批次/candidate
node tools/story-revision/p4-integration/build.cjs --mode draft --out qa/dialogue-p4-P4-06-新批次/preview
node tools/story-revision/p4-integration/verify.cjs qa/dialogue-p4-P4-06-新批次/preview qa/dialogue-p4-P4-06-新批次/static
node tools/story-revision/p4-integration/verify-engine.cjs qa/dialogue-p4-P4-06-新批次/preview qa/dialogue-p4-P4-06-新批次/engine
node tools/story-revision/p4-integration/verify-preview.cjs qa/dialogue-p4-P4-06-新批次/preview qa/dialogue-p4-P4-06-新批次/browser
```

构建和检查无第三方安装、无外网传输。浏览器检查使用本机已有Playwright/Chrome，临时浏览器资料；两项检查分别只监听127.0.0.1:49306/49307，退出时关闭服务。

P4-02闭合后，先以 `assemble.cjs --mode handoff --resources <新版目录> --packages <七包父目录> --out <新QA目录>` 检查，再由P4-07统一采用。若头盔移段使冻结正文变化，必须先建立新冻结上下文并更新接入来源；当前工具会拒绝旧指纹，不能关掉冻结检查或篡改历史清单绕过。

`manifest.json`的 `adoptionReady` 只代表上述交付门槛。P4-07的统一采用、跨包内容判断及P5全路线/设备运行验收仍须分别完成。当前动态CG附加包未接入。
