## 1.2.2（2026-08-28）
- 优化 Network 响应解析，兼容原生 `uni.request`、已解包业务响应、Axios 风格响应及 Promise `[err, res]`，避免固定读取 `res.data` 导致响应显示为 `undefined`
- 修复 Android 原生浮标可拖入顶部或底部安全区域，以及底部触摸结束事件丢失后再次拖动跳回旧位置的问题
## 1.2.1（2026-07-23）
- 修复展开或收起 Network 请求详情时列表自动滚动到底部的问题
## 1.2.0（2026-07-21）
- 默认改为独立的全局 Debug WebView，整个 App 只运行一个 vConsole 实例
- 使用原生全局浮标控制全屏调试 WebView 显示/隐藏，避免透明 WebView 黑屏和触摸拦截
- 原生浮标恢复 vConsole 绿色按钮样式，并支持拖动、边界限制和位置记忆
- 新增 `showLauncher` 配置及 `hideVConsoleLauncher/showVConsoleLauncher` 运行时控制
- 新增长按浮标隐藏确认，拖动时自动取消长按并避免误触
- 新增 `webviewScope` 和 `sharedWebview` 配置，并保留 `active/all` 兼容模式
- 优化 Network 请求 ID、历史同步和去重缓存，避免页面栈增长导致重复更新与卡顿
## 1.1.1（2026-05-29）
- 优化示例入口配置，Vue2/Vue3 分支统一使用 `process.env.NODE_ENV !== 'production'`
- 优化 README 启用示例，移除 Vite 专属的 `import.meta.env` 写法，提升 uni-app Vue2 项目兼容性
## 1.1.0（2026-05-29）
- 新增悬浮按钮位置记忆，页面跳转后保持上次拖动位置
- 新增 Log、Network、Storage 跨页面历史回放，减少多 WebView 页面切换后的记录丢失感
- 新增 Storage 面板镜像，支持查看 `uni.setStorageSync/removeStorageSync/clearStorageSync` 的变更
- 新增 `persistLogs`、`persistNetwork`、`persistStorage`、`persistSwitchPosition` 配置开关
- 优化默认历史数量，Log 默认保留 200 条、Network 默认保留 100 条
- 优化悬浮按钮位置同步，移除常驻轮询，降低页面运行开销
- 调整 `uni.request` 采集逻辑，请求记录只进入 Network 面板，不再自动写入 Log 面板
## 1.0.0（2026-05-29）
- 支持 App-Plus 真机 WebView 自动注入 vConsole
- 支持采集 `console.log/info/warn/error/debug`
- 支持采集 `uni.request` 请求并展示到 vConsole Network 面板
- 内置本地 `vconsole.min.js`，无需额外安装 npm 依赖
