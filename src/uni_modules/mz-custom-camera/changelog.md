## 1.0.1（2026-08-22）
移除 CameraX/WorkManager 的 `BOOT_COMPLETED` 自启动接收器（合规：频繁自启动）
## 1.0.0（2026-08-20）
- 初版：UTS 自定义相机（uni-app 兼容模式组件）
- Android：CameraX 1.4.2；iOS：AVFoundation
- 组件：预览 / 拍照 / 切摄 / 闪光灯；UI 由业务 nvue 自定义
- API：`checkCameraPermission` / `isCameraAvailable` / `takeCameraPhoto`
- 示例：`example/custom-ui.nvue`、`example/custom-ui-vue3.nvue`
