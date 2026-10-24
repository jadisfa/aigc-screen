# mz-custom-camera

**UTS 自定义相机组件**：Android 使用 CameraX，iOS 使用 AVFoundation。原生只负责**相机预览层**，快门、取景框、相册、返回等 UI 由业务页自行覆盖实现。

| 平台 | 原生能力 | 最低版本 |
|------|----------|----------|
| Android | CameraX `Preview` + `ImageCapture` | API 21+ |
| iOS | AVFoundation Session + PreviewLayer + PhotoOutput | iOS 12+ |
| 宿主 | uni-app **App-nvue**（兼容模式 UTS 组件） | HBuilderX ≥ 4.25 |

> 不支持：H5、小程序、普通 vue 页内嵌相机组件（必须 **nvue**）。非 uni-app x 专用组件语法。

---

## 功能特性

- 后置 / 前置摄像头切换
- 闪光灯：`off` / `on` / `auto`
- 拍照输出本地 JPG 路径（见「注意事项 · 路径」）
- 权限检测 / 主动申请
- 设备前后摄可用性探测
- UI 完全自定义（插件不内置业务控件）
- Android CameraX **1.4.2**，适配 Google Play **16KB 内存页**

---

## 快速开始

### 1. 导入插件

将本插件放入项目 `uni_modules/mz-custom-camera`（或从插件市场导入）。

### 2. 配置权限

**Android**（`manifest.json` → App 模块权限，或插件 Manifest 合并）：

- `android.permission.CAMERA`

**iOS**（`manifest.json` → iOS 隐私信息访问描述）：

```text
NSCameraUsageDescription = 需要使用相机进行拍照，请允许访问相机
```

若用到相册，另配 `NSPhotoLibraryUsageDescription`。建议在「App 模块配置」中勾选 **Camera**。

### 3. 制作自定义基座

本插件为 UTS 原生插件，**标准基座无法运行**。

1. HBuilderX → 运行 → **制作自定义调试基座**
2. 勾选 `mz-custom-camera`
3. 用自定义基座真机运行

正式发版请**云打包**并包含本插件。修改原生代码后需重新制作基座。

### 4. 新建 nvue 页面

在 `pages.json` 注册 nvue 页（建议全屏、关闭原生标题栏）：

```json
{
  "path": "pages/camera/custom-ui",
  "style": {
    "navigationStyle": "custom",
    "app-plus": {
      "titleNView": false,
      "bounce": "none",
      "background": "#000000"
    }
  }
}
```

完整示例：

- `example/custom-ui.nvue`（Vue2 / Vue3 双路径快门）
- `example/custom-ui-vue3.nvue`（Vue3 精简写法）

---

## Vue2 / Vue3 怎么用

组件模板相同；**差别在「怎么触发拍照、怎么拿 path」**。

| | Vue2 | Vue3 nvue |
|---|---|---|
| 触发拍照 | `this.$refs.camera.takePhoto()` | `takeCameraPhoto({ success, fail })` |
| 拿图片路径 | `@capture` → `e.detail.path` | `success(res)` → `res.path` |
| 说明 | `$refs` 调 UTS 方法可用 | `$refs.takePhoto` 常无效，请用 API |

```html
<mz-custom-camera
  ref="camera"
  class="preview"
  device-position="back"
  flash-mode="off"
  :auto-preview="true"
  @ready="onReady"
  @error="onError"
  @capture="onCapture"
/>
```

### Vue2

```js
methods: {
  onReady() {
    this.ready = true
  },
  onCapture(e) {
    const d = (e && e.detail) || e
    const path = d.path || (d.detail && d.detail.path) || ''
    // 使用 path
  },
  onShutter() {
    if (!this.ready) return
    this.$refs.camera && this.$refs.camera.takePhoto()
  }
}
```

### Vue3

```js
import { takeCameraPhoto } from '@/uni_modules/mz-custom-camera'

methods: {
  onReady() {
    this.ready = true
  },
  onCapture(e) {
    // 可选备份
    const d = (e && e.detail) || e
    const path = d.path || (d.detail && d.detail.path) || ''
    if (path) { /* 使用 path */ }
  },
  onShutter() {
    if (!this.ready) return
    takeCameraPhoto({
      success: (res) => {
        // res.path
      },
      fail: (err) => {
        uni.showToast({ title: err.errMsg || '拍照失败', icon: 'none' })
      }
    })
  }
}
```

`takeCameraPhoto` 会先回调 `success` / `fail`，再 `$emit('capture'|'error')`。Vue3 请以 `success` 为准。

---

## 组件用法

```html
<template>
  <div class="page">
    <mz-custom-camera
      ref="camera"
      class="preview"
      device-position="back"
      flash-mode="off"
      :auto-preview="true"
      @ready="onReady"
      @error="onError"
      @capture="onCapture"
    />
    <div class="shutter" @click="onShutter"></div>
  </div>
</template>

<script>
export default {
  data() {
    return { ready: false }
  },
  methods: {
    onReady(e) {
      this.ready = true
      const d = (e && e.detail) || e
      console.log('facing', d.facing)
    },
    onError(e) {
      const d = (e && e.detail) || e
      uni.showToast({ title: d.message || '相机错误', icon: 'none' })
    },
    onCapture(e) {
      const d = (e && e.detail) || e
      console.log('path', d.path)
    },
    onShutter() {
      if (!this.ready) return
      // Vue2；Vue3 见上文 takeCameraPhoto
      this.$refs.camera && this.$refs.camera.takePhoto()
    }
  }
}
</script>

<style>
.page { flex: 1; background-color: #000000; }
.preview {
  position: absolute;
  left: 0; top: 0; right: 0; bottom: 0;
}
</style>
```

### Props

| 属性 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `devicePosition` | `back` \| `front` | `back` | 初始摄像头 |
| `flashMode` | `off` \| `on` \| `auto` | `off` | 闪光灯模式 |
| `autoPreview` | Boolean | `true` | 加载后是否自动开预览 |

### 方法（`$refs`，主要 Vue2）

| 方法 | 说明 |
|------|------|
| `startPreview()` | 开始预览 |
| `stopPreview()` | 停止预览 |
| `takePhoto()` | 拍照，成功触发 `@capture` |
| `switchCamera()` | 前后摄切换 |
| `updateFlashMode(mode)` | 改闪光灯。**勿**用 `setFlashMode`（与 prop 冲突） |

### 事件

| 事件 | 字段 | 说明 |
|------|------|------|
| `ready` | `facing` | 预览就绪 |
| `error` | `code`, `message` | 错误 |
| `capture` | `path` | 拍照成功 |

事件取值：

```js
const d = (e && e.detail) || e
// d.path / d.facing / d.code / d.message
```

---

## API 用法

```js
import {
  checkCameraPermission,
  isCameraAvailable,
  takeCameraPhoto
} from '@/uni_modules/mz-custom-camera'

const info = isCameraAvailable()
// { available, hasFront, hasBack }

checkCameraPermission({
  request: true,
  success: (res) => console.log(res.granted),
  fail: (err) => console.log(err.errCode, err.errMsg)
})

// Vue3 推荐；须已有预览中的 <mz-custom-camera>
takeCameraPhoto({
  success: (res) => console.log(res.path),
  fail: (err) => console.log(err.errCode, err.errMsg)
})
// 也可 takeCameraPhoto(null)，仅发起并依赖 @capture
```

建议在页 `onLoad` 先申请权限，再依赖 `autoPreview` 或手动 `startPreview()`。

---

## 自定义 UI 布局

```
┌─────────────────────────────┐
│  nvue 自定义层（绝对定位）     │  ← 返回 / 取景框 / 快门 / 相册
├─────────────────────────────┤
│  <mz-custom-camera>         │  ← 仅原生预览，铺满全屏
└─────────────────────────────┘
```

插件不绘制业务控件。

---

## 错误码

### API `fail`

| errCode | 含义 |
|---------|------|
| 9101001 | 无相机权限 / 用户拒绝 |
| 9101002 | 参数错误 |
| 9101003 | 无可用摄像头 |
| 9101004 | 预览绑定失败 |
| 9101005 | 拍照失败 |
| 9101010 | 未知错误 |

### 组件 `@error`

常见：`NO_PERMISSION`、`NOT_READY`、`BIND_FAILED`、`CAPTURE_FAILED` 等，带 `message`。

---

## 注意事项

1. **必须自定义基座 / 云打包包含本插件**，标准基座无法使用。
2. **相机组件只能放在 nvue 页**；结果预览等可用普通 vue 页。
3. **Vue2 / Vue3 拍照方式不同**，见上文对照表；Vue3 请用 `takeCameraPhoto({ success })`。
4. **路径**
   - iOS：多为 `_doc/mz-custom-camera/xxx.jpg`（vue / nvue 均可直接或按需转换后给 `<image>`）
   - Android：绝对路径（展示时按需加 `file://`）
   - 上传可用 `uni.uploadFile`；普通 vue 页若绝对路径显示异常，可转 `_doc` 或参考示例 `resolveVueImageSrc`
5. **iOS 混编 Swift**：同目录类型直接使用，不要写 `import { Xxx } from './Xxx'`。
6. **上架 Google Play**：建议 HBuilderX ≥ 4.81，AAB 渠道；勿引入未适配 16KB 的其它 native 库。
7. **闪光灯**：运行时用 `updateFlashMode`，不要调用 `setFlashMode`。

---

## 隐私说明

- 仅本地预览与拍照，**不会**自动上传或采集其它隐私数据
- 权限：相机（相册由业务自行 `uni.chooseImage`）

---

## 兼容与依赖

| 项 | 说明 |
|----|------|
| HBuilderX | ≥ 4.25；上架 Google Play 建议 ≥ 4.81 |
| Android | `androidx.camera:*:1.4.2`（见 `utssdk/app-android/config.json`） |
| Vue | Vue2：`$refs.takePhoto`；Vue3：`takeCameraPhoto({ success })` |

参考：[UTS 插件](https://doc.dcloud.net.cn/uni-app-x/plugin/uts-plugin.html) · [兼容模式组件](https://doc.dcloud.net.cn/uni-app-x/plugin/uts-component-compatible.html) · [原生混编](https://doc.dcloud.net.cn/uni-app-x/plugin/uts-plugin-hybrid.html)
