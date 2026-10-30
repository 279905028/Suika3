# SUI-T：SDK 静态审计

2026-10-28。仅检查当前工程内 SDK；本报告不代表网页、桌面或手机运行通过。SDK、根入口与正文未修改。

## 结论

本机 SDK 具备生成独立 Suika3 网页样板的必要工具：原生 Ray / NovelML、最多八选项、按索引存档、内嵌 Wasm 的网页壳、macOS 打包器。当前网页壳存在明确持久化缺口：挂载 IDBFS 时未开启自动写回，业务代码仅在启动时从 IndexedDB 读取；不能把内存文件保存成功视为刷新后可恢复。

样板必须在自己的目录生成 `assets.arc`，使用独立浏览器上下文、端口和数据库身份，保持正式入口不变。

## 版本指纹

| 输入 | SHA-256 |
| --- | --- |
| `SDK/wasm/index.html` | `f589ca123faccada973c65cd560f4d3bb0207ae3f701d4017fcf46d094ee74c0` |
| `SDK/macos/suika3-pack` | `ca490cf5173dc7083da96a74175a1b9b2426a54aa1e0f2302807dc96d2d4e04a` |
| `SDK/macos/root/bin/suika3` | `e53c15076b9bb87267b6f1885c9c2edb9755c386b47c9faaf50e3f374f28bcc5` |

SDK 网页是包含二进制数据的压缩单行文件，因此下列网页引用均为第 1 行；定位采用精确字符串，不整文件展开或重排。任何派生补丁应先验证输入指纹，再验证每个替换锚点恰好出现一次。

## 网页加载与持久存档

来源：`SDK/wasm/index.html:1`。

- `Module.preRun=function(){FS.createPreloadedFile("/","assets.arc","assets.arc",!0,!1)}`：运行时会完整下载、预加载同目录 `assets.arc`，因此要记录整个包的字节数和冷启动耗时；只加载小图并不能代表真实资源负载。
- 唯一业务挂载锚点：

```js
FS.mkdir(Module.UTF8ToString(A)),FS.mount(IDBFS,{},Module.UTF8ToString(A)),FS.syncfs(!0,(function(A){Module.ccall("main_continue","v")}))
```

- `FS.syncfs(!0,...)` 为启动读取；原回调忽略错误并继续启动。全文没有业务 `FS.syncfs(!1,...)` / `FS.syncfs(false,...)`，自动写回实现只在 `mount` 配置 `autoPersist` 后启用，而此处传入 `{}`。
- 数据库名直接取挂载路径。`getRemoteSet` 调用 `IDBFS.getDB(A.mountpoint,...)`；唯一打开数据库锚点为 `IDBFS.indexedDB().open(A,IDBFS.DB_VERSION)`。仅改页面路径不会隔离同源数据库。
- 可行派生方案：保持引擎内部挂载路径，给 `open()` 的数据库名加样板项目身份前缀；开启 `autoPersist:true` 或明确执行写回。正式工程应冻结独立身份及迁移策略，不沿用样板身份。
- `autoPersist` 内部 `queuePersist` 回调未把错误传到用户界面；仅开启此选项不足以证明可靠保存。需要记录 pending、成功、失败，并在明确的 `FS.syncfs(false, cb)` 成功后提示可刷新。启动读取失败也必须可见。
- 验证范围至少包含自动槽、三个手动槽、刷新、关闭页重开、返回初始状态后读档、同源另一项目数据库哨兵未变；读档核对状态和演出，不能仅核对文件存在。

## 条件六选一与 Ray 接口

| 能力 | 当前 SDK 依据 | 实施注意 |
| --- | --- | --- |
| 六选一 | `SDK/documents/novelml-tags.html:3759–3898`：`choose` 最多八项，`text1…8`、`value1…8`、结果 `name` | 使用稳定 `valueN`，不要用可修改的文案作状态 ID |
| 条件分支 | `SDK/documents/novelml-tags.html:4706–4798`：`if` / `elseif` / `else` / `endif` | 字符串用 `===`，数值用 `==` 等；变量写为 `${name}`；未知条件不可默认低条件 |
| 条件选项 | `choose` 文档未声明逐项 `requires` / `enabled` 参数 | 由 Ray 或条件分支构造可见项，选择提交后再次检查资格；不能假定不存在的标签参数生效 |
| 本地存档 | `SDK/documents/ray-vn-api.html:22221–22241`：`Suika.executeSaveLocal({index})` | 布尔返回表示引擎保存结果，不等于 IndexedDB 已写入 |
| 读档 | `SDK/documents/ray-vn-api.html:22243–22263`：`Suika.executeLoadLocal({index})` | 需要实际核对文本位置、选择、背景、人物和状态 |
| 槽存在 | `SDK/documents/ray-vn-api.html:22265–22285`：`Suika.checkSaveExists({index})` | 可分配 0 为自动槽，1–3 为手动槽；这个分配是样板约定 |
| 读档当帧 | `SDK/documents/ray-vn-api.html:22316–22321`：`Suika.checkRightAfterLoad()` | 避免恢复后立即被自动存档或状态初始化覆盖 |
| 全局档 | `SDK/documents/ray-vn-api.html:22205–22219`：`executeSaveGlobal` / `executeLoadGlobal` | 与进度槽分开；测试不要清理其他项目全局数据 |
| 按键 | `SDK/documents/ray-2d-api.html:1656–1741`：`Engine.is1KeyPressed` 至 `is0KeyPressed`、F1–F12 | 是状态属性；持续按住应做边沿检测，避免重复写档 |

`Suika.writeSaveData` / `readSaveData` 文档在 `ray-vn-api.html:22739–22786`；后者写成布尔返回，与 `ray-2d-api.html:2286–2303` 的字符串读取说明不一致。技术样板优先用进度槽接口，不依赖未经实测的低层返回契约。

## 竖屏与旋转

来源：`SDK/wasm/index.html:1`。原壳绑定窗口 `resize`，按 canvas 自身宽高比缩放到视口内：

```js
function onResizeWindow(){var A=document.getElementById("canvas"),v=A.width/A.height,r=window.innerWidth,j=window.innerHeight,t=r,f=r/v;f>j&&(f=j,t=j*v),A.style.width=t+"px",A.style.height=f+"px",A.focus()}
```

这只是保持比例缩放，不会自动重排 NovelML 文本或选择布局。原生 1280×720 在 390px 宽竖屏中显著缩小。必须在实际样板上查看长段溢出、六选项可点范围、网页控制条与安全区，并做旋转后的坐标与读档复核。浏览器触屏模拟与手机真机应分别记录。

## 打包与 macOS

- `SDK/documents/distribute.html:1112–1134` 说明 `suika3-pack <files>` 生成 `assets.arc`；`1196–1208` 说明网页分发为 `index.html` 与 `assets.arc` 同目录，可由本地 HTTP 服务预览。
- 调用打包器时指定独立样板 cwd 和文件白名单，例如 `main.ray config.ini start.novel system resources`；不要使用根目录通配符，以免把 SDK、QA、正文和旧包一起递归打入。
- macOS 打包器和 `SDK/macos/root/bin/suika3` 均为 x86_64 / arm64 双架构 Mach-O。`otool -L` 显示运行器依赖系统 AppKit、Metal、AVFoundation 等框架，未显示额外 Homebrew 动态库依赖。这仅证明静态可用性。
- `SDK/macos/root/share/man/man1/suika3.1:15–20` 明确运行器从 cwd 读取 `main.ray`，不能在命令行指定其他脚本。
- `SDK/macos/suika3-wrapper.sh:5` 指向当前不存在的 `SDK/macos/suika3`；真实入口为 `SDK/macos/root/bin/suika3`。第 8–11、19–22 行成功/失败退出码反转，第 19 行还采用宽泛文件枚举。因此不作为可复现构建入口。
- 打包器带 `com.apple.quarantine`。保留 SDK 只读，若系统拦截，应复制到样板工具目录，仅处理副本；不要对 SDK 执行 wrapper 的 `xattr -c` / `chmod`。
- 本轮曾尝试 `--help` 探测，未得到帮助输出并已中止；未成功启动桌面窗口、未以此声称打包成功。打包语法结论来自随包官方文档。真正打包、网页读档与桌面结果由独立运行证据记录。

## 后续放行要求

静态 API 存在不等于通过。正式编译和运行工作前，应以样板实测证明：中文长段可读、透明 WebP 实际引擎呈现、六项及条件变化、四槽持久读档、刷新/重开、完整代表性资源冷启动和旋转可操作。设备缺席时标记手机真机未测，不能由模拟器结果替代。
