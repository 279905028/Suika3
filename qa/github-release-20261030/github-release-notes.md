# 毕节，雨停之前 · v1.1.0-beta.1

这是**预览版**：推荐桌面Chrome，macOS／Windows包为实验性构建。

## 本版内容

- B「夜班灯火」封面与网页8秒静音循环标题「损友笑场」。
- 电影侧栏UI，覆盖剧情选项、设置、存读档、回顾与图鉴。
- 补齐14名普通配角立绘，保留六条路线、60CG及当前故事分支。

## 下载与启动

| 文件 | 大小（MB） | 用途 |
| --- | ---: | --- |
| [v1.1.0-beta.1-web.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.1/v1.1.0-beta.1-web.zip) | 373.2 | 推荐：桌面Chrome网页包 |
| [v1.1.0-beta.1-macos.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.1/v1.1.0-beta.1-macos.zip) | 363.4 | 实验性：macOS x64／ARM64 |
| [v1.1.0-beta.1-windows-x64.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.1/v1.1.0-beta.1-windows-x64.zip) | 361.7 | 实验性：Windows x64 |
| [v1.1.0-beta.1-windows-arm64.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.1/v1.1.0-beta.1-windows-arm64.zip) | 361.6 | 实验性：Windows ARM64 |
| [v1.1.0-beta.1-build-inputs.zip](https://github.com/279905028/Suika3/releases/download/v1.1.0-beta.1/v1.1.0-beta.1-build-inputs.zip) | 896.4 | 开发者冻结输入；玩家无需下载 |

网页包需Node.js 18或更新版本：解压后运行`node serve.cjs`，再用Chrome打开`http://127.0.0.1:49280/`。macOS运行`macos/启动.command`，Windows运行对应目录的`启动.bat`。所有包附中文说明与许可文件。原生包未签名／公证，原生标题使用静态封面。

**新版请重新开始，旧档保留。** 不同运行版本、网页与原生档不互通。网页存档绑定浏览器与本机地址；继续使用同一浏览器和端口。

## 验证与已知问题

本次检查16项分发文件、五份ZIP全部条目和权限；**解压网页包Chrome27项、随包HTTP9项通过**，覆盖标题循环、菜单、选择、保存读取、刷新、重开、配角退场与回退。使用独立测试存储，未访问玩家旧档。

Firefox快速连续存读档面板、周栀／飘文字衔接、CG066坐站姿偏差仍待处理。Safari、手机真机、macOS／Windows完整原生流程、长期压力未获本版放行。本次未重新执行全路线或全文人工审校，历史验证不扩张为新版全平台验收。

`SHA256SUMS.txt`和`checksums.json`校验附件；`release-manifest.json`关联源码提交、输入指纹与运行身份。GitHub自动生成的**Source code不包含大素材和SDK，也不是可玩包**；开发者需配合build-inputs附件恢复。本次仅发布下载版本，没有部署在线试玩。

源码提交：`4561eb2df8f35c7c7b8d97dbae2ab3fba4bb8c2b`。

[详细启动说明](https://github.com/279905028/Suika3/blob/v1.1.0-beta.1/docs/releases/v1.1.0-beta.1.md) · [验证与发布记录](https://github.com/279905028/Suika3/blob/main/qa/github-release-20261030/%E5%8F%91%E5%B8%83%E8%AE%B0%E5%BD%95.md)
