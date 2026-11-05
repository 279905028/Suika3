# P4-V 独立工具

只用于 `qa/ending-motion-*` 和视频候选；正式入口、正文、绑定和玩家存档不由这里修改。

- `manifest.cjs`：六镜条件；未使用ENDING决定入镜。
- `prepare.cjs`：建立输入记录；已有冻结时仅核指纹，不覆盖制作进度。
- `controller.js/.css`：媒体生命周期；需要宿主正确发送context/menu/exit通知及占用桥接。
- `build-probe.cjs`：新的、不得覆盖的独立Suika技术夹具，测试媒体来自本批media目录。
- `verify.cjs`：核心与负例检查；结果输出到新的QA目录。
- `verify-background.cjs --six-only`：六个合成正例的Suika运行检查。未带参数的真实切标签检查尚未通过，不把模拟冻结当成后台验收。
- `dreamina-jobs.py prepare`：按已获授权的六图范围上传/建草稿，复用状态记录；不触发生成。`quote`只读报价。该脚本不会替用户批准积分。

- `fulfill.py submit/status/download`：首批明确批准后的一次性提交、原身份查询与官方原片下载；凭证不落盘，已尝试提交即禁止重放。
- `prepare-media.py`：核对下载指纹，完整解码并制作24fps静音候选、原始首尾帧和4fps审阅图。
- `serve-proof.py`：只在本机提供real-media-v1/v2真实视频夹具，分别保存21项检查结果；v2对应最终候选。
- 返修批次独立记录于 `revision-state.json`；`fulfill.py <命令> revision-state.json`复用其身份。未获相应授权时禁止confirm/run。

- `build-review.py`：按已核验的selection.json生成六视频预览。

最终测试包 `qa/ending-motion-P4-V-T-20261104/probe-v4`，核心结果 `check-v4`，连续触发结果 `six-nodes-v2`。复验须提供新输出目录；使用本机HTTP服务访问，不能直接以file://代表验收。

[总交接](../../../docs/美术/恋爱结局动态CG-20261104/P4-V00/交接.md) · [技术边界](../../../docs/美术/恋爱结局动态CG-20261104/P4-V-T/交接.md)
