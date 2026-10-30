# SUI-T 技术样板

[交接与验收](交接.md) · [本机预览](http://127.0.0.1:49173/) · [冻结入口](入口契约.md)

- `native/`：原生Ray/NovelML技术源，摘录来源与指纹。
- `resources/`、`resource-manifest.json`：代表资源白名单，原图字节保留；诊断拼图不进入运行包。
- `build.cjs` → `web/`：锁本地SDK、白名单打包与网页兼容修复。
- `verify-browser.cjs`、`browser-report.json`：浏览器行为、持久存档与手机尺寸模拟。
- `color-audit.py`、`color-audit.json`：原生WebP保色回归，保留修复前后的观测。
- `diagnostics/`：定位过程的旧画面，不作为最终通过证据。

已按用户确认，本轮范围为浏览器手机尺寸验收；手机真机单独待办。技术布局与图片负载不等于正式UI和美术采用。
