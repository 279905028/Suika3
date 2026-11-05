# 加载优化与阿里云 CDN

2026-11-05。线上入口：[galagame.site](https://galagame.site/)。优化分发包与中国大陆CDN已上线，公网完整下载、存读档与本机缓存重载验收通过。

## 实测结果

同一测试环境的Chrome独立存储记录：

| 场景 | 到游戏标题的时间 |
| --- | --- |
| 原发布包直连3Mbps源站 | 18分29秒 |
| 优化包首次填充CDN，包含预热争用及恢复 | 11分45秒 |
| 部分CDN缓存已有，新浏览器（中间配置） | 94.3秒 |
| 最终配置、CDN已缓存、新浏览器 | **44.8秒** |
| 最终配置、同一浏览器资源缓存重载 | **0.856秒**，核心资源网络下载0字节 |

[最终公网Chrome报告](../../qa/aliyun-perf-20261105/public-browser-final-v3/report.json)。本次最终首开比首次直连基线缩短约96%，但两次网络及缓存状态不同，不是全地区速度保证。未缓存的地区首次回源仍受源站3Mbps限制。中间配置曾出现入口等待49秒，最终改为CDN缓存60秒后复验通过，未隐去该报告。

## 本次变化

| 项目 | 原发布包 | 本次分发包 |
| --- | --- | --- |
| 首载核心包 | 431,425,183 B（411.44 MiB） | 168,315,155 B（160.52 MiB），减少61.0% |
| 全部网页资源 | 491.35 MiB | 220.78 MiB |
| 重复打开 | 依赖浏览器常规缓存 | 单独保存并校验核心资源，命中时不重新下载 |
| 下载中断 | 引擎默认下载 | 可见进度、Range续传，最多重试3次 |
| 分发 | 上海ECS直接提供 | 阿里云中国大陆CDN，HTTPS、HTTP/2 |

本次优化的是原在线P5 v5包，没有合并其他并行剧情或媒体更新。正文、引擎、GUI脚本、透明人物、道具、视频逐字节保留；背景、CG及动态回退图生成独立WebP分发副本，尺寸不变。205张图通过PSNR≥34dB、平均绝对像素差≤3的检查，另做样本画质与真实标题/正文目视复核。字体保留5个字体面与正文、界面用到的1,702个原有字符；未覆盖原图或采用资源。

运行兼容标识仍为`df34bb78…20bcfd`，存档空间仍为`bijie-p5-motion-20261104:`。原发布包写档、新分发包读档已在同一独立浏览器来源验证。不同IP、HTTP、HTTPS来源之间的存档仍分别保存，不会自动迁移。

## 当前部署

- 分发标识：`cc1ba27c1351074a`；本机包`dist/aliyun-perf-20261105-v1/`。
- 源站：`106.14.32.114`，带宽保持3 Mbps；`/srv/suika3/current`指向`/srv/suika3/releases/20261105-perf-cc1ba27c1351074a`。
- 版本资源地址：`/r/cc1ba27c1351074a/`，浏览器及CDN长期缓存365天；此目录内容不原位覆盖。入口HTML在CDN短缓存60秒、浏览器每次校验；发布时刷新入口或等待最多60秒，ACME验证路径不缓存。
- Cloudflare继续仅提供DNS；根记录改为CNAME `galagame.site.w.kunlunaq.com`，TTL 300秒，代理关闭。权威解析会将根域CNAME展开为CDN节点IP，不能因查询未显示CNAME就认定未生效。
- CDN使用HTTPS 443回源、Host/SNI `galagame.site`；开启gzip、Brotli、Range、HTTP/2与TLS1.2/1.3。回源主动请求gzip，复用源站预压缩文件。
- 原发布目录保留。临时上传公私钥及服务器中转归档均已删除，76个部署文件与归档指纹通过服务器核验。

## 已购流量包与维护

使用用户现有的中国内地通用流量包：50GB，有效期至2027-11-05；没有购买其他资源、扩容带宽或设置自动复购。

用户明确批准专用角色、维护任务和证书上传后，服务器启用：

- `suika3-cdn-guard.timer`：每5分钟查询该年度包，剩余≤5GB、到期或连续3次查询失败时停止`galagame.site`的CDN；不会自动恢复。状态在`/var/lib/suika3-cdn/guard.json`。
- `certbot-renew.timer`：续签源站证书；部署钩子同步到CDN。`suika3-cdn-certificate.timer`每日补偿检查，避免一次上传失败后漏同步。
- 角色`Suika3GalagameCdnMaintenance`仅允许更新本站CDN证书、停止本站CDN、查询资源包；不允许购买、扩容、启用CDN或修改其他域名。代码与权限范围见`tools/deploy/aliyun/cdn-maintenance.py`及同目录策略文件。

证书私钥仅由服务器直接经HTTPS上传到用户当前账号的阿里云CDN，未进入聊天、QA或命令日志。没有长期AccessKey。

CDN切换后的续期演练已通过，现有证书同步状态一致。首次演练遇到公网DNS解析失败，核查两台权威DNS、公共解析及Google加密DNS后重试成功；未为此改变解析或降低安全设置。演练没有替换当前生产证书，证书仍有效至2027-02-03。

**边界：这不是绝对费用上限。** 资源包与用量统计存在延迟；套餐耗尽后平台可继续按量收费，留5GB余量只能降低超额风险。停止CDN后域名访问会暂停，需要人工确认套餐及原因后恢复或切回源站。[阿里云用量封顶说明](https://help.aliyun.com/zh/cdn/user-guide/configure-usage-cap)、[套餐耗尽规则](https://help.aliyun.com/zh/cdn/user-guide/usage-cap-faq)。

额外的控制台月封顶尚未设置：用户已登录，但登录后的控制台在自动化连接中持续超时。当前已实际启用的是上述年度包余量保护，不能将其记为平台原生月封顶。

## 验收记录

| 范围 | 结果与证据 |
| --- | --- |
| 冻结输入、图片、字体、非目标文件保留 | [分发清单](../../qa/aliyun-perf-20261105/candidate-v1/optimization-report.json) |
| 原包写档→新包读档、缓存复用 | [本机Chrome通过](../../qa/aliyun-perf-20261105/local-browser-v1/report.json)；冷启动1.023秒、缓存重载0.783秒，仅代表本机 |
| 断线续传、忽略Range、坏缓存、配额不足、持续断网、错误指纹 | [6项容错通过](../../qa/aliyun-perf-20261105/loader-fault-tests.json) |
| 年度包保护边界逻辑 | [6项通过](../../qa/aliyun-perf-20261105/quota-logic-tests.json)；未人为耗尽真实套餐或中断公开CDN来测试停机 |
| 源站文件与原子切换 | [76文件通过](../../qa/aliyun-perf-20261105/stage-release.json)、[切换及首页指纹](../../qa/aliyun-perf-20261105/activate-release.json) |
| CDN 68文件长度/缓存、核心及视频206、实际HIT | [通过项](../../qa/aliyun-perf-20261105/cdn-preflight-v1/report.json)；该次HTML下载因预热争用超时，随后[压缩及指纹补验通过](../../qa/aliyun-perf-20261105/cdn-preflight-html-retry.json) |
| 证书、维护任务、临时权限清理 | [服务器回读通过](../../qa/aliyun-perf-20261105/maintenance-verification.json) |
| CDN切换后续期演练、同步状态及上传归档清理 | [最终维护检查通过](../../qa/aliyun-perf-20261105/final-maintenance-v4.json)；原DNS失败记录与解析核查保留 |
| 真实域名首页 | [HTTPS及解压后指纹通过](../../qa/aliyun-perf-20261105/public-root-verification.json) |
| 公网完整首载、存读档、缓存重载 | [最终Chrome通过](../../qa/aliyun-perf-20261105/public-browser-final-v3/report.json)，运行错误0；[首次填充过程](../../qa/aliyun-perf-20261105/public-browser-v1/report.json)与[中间复测](../../qa/aliyun-perf-20261105/public-browser-cdn-hit-v2/report.json)保留 |

初次全区域预热在3Mbps源站上造成回源争用。通过仅拒绝预热代理结束任务`33746598351`（结果Failed/源站503），随后[撤除临时限制](../../qa/aliyun-perf-20261105/prewarm-relief-removed.json)，正式配置恢复。当前采用实际访问填充缓存；未宣称全网预热完成。本批未测试手机真机、全地区运营商、长期负载或全剧情路线。

## 后续发布与恢复

重建必须使用新`dist/`与`qa/`目录，不能覆盖本批资源地址。优化脚本`tools/deploy/aliyun/optimize-web.py`会验证冻结输入、生成图片/字体副本并打包；先执行`verify-loader.cjs`及`verify-optimized.cjs`，再上传独立版本、校验、切换。

如需恢复原分发包，服务器中将`current`原子切回`/srv/suika3/releases/20261105-df34bb78`；入口CDN最多缓存60秒，恢复后刷新入口或等待60秒；版本目录继续保留。如需绕开CDN，按[原DNS快照](../../qa/aliyun-perf-20261105/dns-before-cdn.json)将根记录改回A `106.14.32.114`、TTL300、仅DNS。DNS传播期间两端均保留HTTPS服务，存档来源不变。
