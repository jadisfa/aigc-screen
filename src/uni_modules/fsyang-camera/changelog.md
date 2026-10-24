## 1.0.9（2026-08-01）
- Android CameraX 依赖由 1.3.4 升到 1.4.2，解决 Google Play上架问题
- 功能与 API 无变化
## 1.0.8（2026-07-16）
- Android / iOS 新增 cropBoxMask、cropBoxColor、cropBoxRadius，支持控制框外遮罩、取景框颜色和圆角；双端默认遮罩开启、颜色 #50DC78、直角
## 1.0.7（2026-07-09）
- iOS ready 事件修复
## 1.0.6（2026-07-09）
修复预设前后摄不生效的问题，因参数名冲突有变化请了解
## 1.0.5（2026-07-09）
- 修复 iPhone 7 Plus / iOS 15 等设备上 iOS ready 事件可能不触发的问题
- iOS ready 录像档位列表改为 videoQualitiesJson 安全字段，避免嵌套 Map 数组在老设备事件桥接失败
- 修复 Android 初始 position 可能被默认后置抢先绑定、示例页切换镜头状态不同步的问题
- 新增 cameraPosition 镜头属性并作为推荐写法，避免 nvue/native 场景下 position 属性名冲突或初始化透传异常
- 新增 changeCameraPosition('back' | 'front') 方法，用于运行时直接设置镜头方向
- Android / iOS position 增加 trim/lowercase 容错，并兼容常见拼写 `fonrt`
## 1.0.4（2026-07-08）
删除 android 默认的录音权限配置
## 1.0.3（2026-07-08）
- 修复录像清晰度无效的问题
- Android 默认不再声明/申请录音权限；如需录像收声，由宿主应用自行添加 RECORD_AUDIO 并显式申请 microphone
## 1.0.2（2026-06-25）
- 录像结果 @recordstop 新增 duration(时长ms)/width/height；iOS 端补齐 size，双端字段一致
- 修复 Android enableTapFocus=false 无法关闭点按对焦的问题
- 修复 Android 裁剪取景框在全幅(0,0,1,1)时绿框贴边被裁、肉眼不可见的问题
- 类型声明 interface.uts 修正：水印字段(on/time/date/week/location/text)、拍照/录像结果按实际回传补全
- readme / 使用说明 文档与实际能力对齐（补 cropBox 等）
## 1.0.1（2026-06-25）
修复部分缺陷
## 1.0.0（2026-06-25）
- 首发：原生 CameraX(Android) / AVFoundation(iOS) 自定义相机组件 `<fsyang-camera>`
- 预览自适应任意容器、所见即所得、横竖方向自动跟随
- 拍照：自定义成片宽度 + 自动选分辨率 + 按比例裁剪 + 实时水印 + EXIF/GPS 开关 + 无声拍照
- 录像：设备真实档位(4K/1080P/720P) + 帧率 + 音频开关 + 自动取封面
- 专业控制：曝光 / 变焦 / 点按对焦 / 两指缩放 / 闪光 / 前后摄
- 权限可独立申请；Android + iOS 双端一致
