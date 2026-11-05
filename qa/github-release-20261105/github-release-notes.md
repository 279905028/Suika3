# 毕节，雨停之前 · v1.1.0-beta.2

预览版，推荐桌面Chrome。beta.1继续保留；macOS／Windows为实验性静态演出。

## 本版更新

- 六条路线对白与结尾过渡更新：4,748段正文、14结局。
- 补齐雨窗段落背景，采用268项静态美术与81项静态CG图鉴。
- 网页接入29段动态CG，包含11月5日替换的孟遥libTV接吻片段；静态CG至少显示1.5秒，动态播完回到原句。
- 原生沿用修复存档缩略图及渲染阶段纹理加载崩溃的P5 v3，采用文字存档卡片。

## 下载

| 附件 | 大小（MB） | 用途 |
| --- | ---: | --- |
| [web.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.2/v1.1.0-beta.2-web.zip) | 510.8 | 推荐；完整网页包与29段动态CG |
| [macos.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.2/v1.1.0-beta.2-macos.zip) | 430.4 | 实验性；x64／ARM64通用，静态演出 |
| [windows-x64.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.2/v1.1.0-beta.2-windows-x64.zip) | 428.8 | 实验性；静态演出 |
| [windows-arm64.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.2/v1.1.0-beta.2-windows-arm64.zip) | 428.7 | 实验性；静态演出 |
| [build-inputs.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.2/v1.1.0-beta.2-build-inputs.zip) | 621.7 | 开发者冻结输入及预编译阶段；玩家无需下载 |

网页包需Node.js 18或更新版本。解压后运行`node serve.cjs`，用Chrome打开`http://127.0.0.1:49280/`；也可使用随包“启动网页”脚本。原生运行对应目录的“启动”脚本，程序未签名／公证。

**新版请重新开始，旧档保留。** 不覆盖旧版目录；网页存档绑定浏览器、地址、端口和精确运行版本，网页与原生不互通。

## 本次验证与边界

五份ZIP共1,436项文件逐项核验字节、SHA-256及权限；解压网页Chrome恢复10项、29段动态图鉴完整播放与布局、HTTP9项通过。冻结输入恢复2,703项、网页和原生重新打包指纹一致，测试未访问玩家旧档。

最新孟遥单镜构建此前已完成Chrome HIGH四种关键组合完整路线，共4,670页；其他P5全路线、Firefox、Safari与原生记录属于各自冻结基线。本次没有将其扩张为新版全平台放行。手机真机、Windows原生运行、Safari完整路线、macOS完整路线及长期压力仍未测。

[阿里云在线版](https://galagame.site/)单独维护，仍为原P5 v5加载优化版，本次不切换线上；其体积与速度不用于本ZIP。

`SHA256SUMS.txt`、`checksums.json`与`release-manifest.json`提供附件校验和源码关联。自动生成的Source code缺少大素材及SDK，需配合build-inputs恢复。

[详细启动及恢复说明](https://github.com/279905028/Suika3/blob/v1.1.0-beta.2/docs/releases/v1.1.0-beta.2.md) · [本批验证与最终发布记录](https://github.com/279905028/Suika3/blob/codex/release-v1.1.0-beta.2/qa/github-release-20261105/%E5%8F%91%E5%B8%83%E8%AE%B0%E5%BD%95.md)
