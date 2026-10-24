# 自定义相机 fsyang-camera

> 原生 **CameraX(Android) / AVFoundation(iOS)** 封装的自定义相机组件 `<fsyang-camera>`。
> 预览自适应任意容器、所见即所得、横竖方向自动跟随。**Android + iOS 双端一致**，uni-app(vue3 / nvue) 通用。

## 特性

- **预览自适应**：放进任意大小的盒子都不变形，所见即所得（成片 = 预览可视区）
- **拍照**：自定义成片宽度（自动选传感器分辨率）/ 按比例裁剪 / 实时水印 / EXIF·GPS 开关 / 无声拍照
- **录像**：按设备真实档位（4K / 1080P / 720P）+ 帧率 + 音频开关 + 自动取封面
- **专业控制**：曝光补偿 / 变焦 / 点按对焦 / 两指缩放 / 闪光(关·开·自动·常亮) / 前后摄切换
- **能力一次给全**：`@ready` 回传变焦范围、曝光档、是否有闪光灯、拍照上限、录像真实档位
- **权限独立申请**：相机 / 麦克风 / 定位 各自按需

## 快速开始

### 1. 放置组件（铺满或任意容器都可）

```html
<template>
  <view style="flex:1">
    <fsyang-camera
      ref="cam"
      style="position:absolute;left:0;top:0;right:0;bottom:0;"
      :mode="mode"
      :cameraPosition="position"
      :flash="flash"
      :photoWidth="1080"
      @ready="onReady"
      @captured="onCapture"
      @error="onError"
    />
  </view>
</template>
```

> nvue 中自定义原生组件 `flex:1` 不会被撑开，请用绝对定位铺满父容器。

### 2. 申请权限并拍照

```js
export default {
  data() { return { mode: 'photo', position: 'back', flash: 'off' } },
  mounted() {
    // 默认只申请相机权限；需要录像收声时，再按需申请 microphone
    this.$refs.cam.requestPermission('camera')
  },
  methods: {
    shot() { this.$refs.cam.takePhoto() },          // 拍照
    onReady(e) { /* this.parse(e) 为设备能力 */ },
    onCapture(e) {
      const d = this.parse(e)                        // { path, width, height, size, ... }
      console.log('拍到', d.path)
    },
    onError(e) { console.log(this.parse(e).message) },
    // 事件 payload 双端统一解析（字符串 / 对象 / Map 都兼容）
    parse(e) {
      let d = (e != null && e.detail != null) ? e.detail : e
      if (typeof d === 'string') { try { d = JSON.parse(d) } catch (x) { d = {} } }
      return d || {}
    }
  }
}
```

## Props

| 属性 | 类型 | 默认 | 说明 |
|------|------|------|------|
| mode | String | photo | 工作模式：photo 拍照 / video 录像 |
| cameraPosition | String | '' | 镜头：back 后置 / front 前置（推荐使用，避免与 nvue 样式字段混淆） |
| flash | String | off | 闪光：off / on / auto / torch(常亮手电) |
| photoWidth | Number | 1080 | 成片宽度(px)，自动选分辨率；0 = 原图 |
| zoom | Number | 1 | 变焦倍数（范围以 @ready 为准） |
| exposure | Number | 0 | 曝光补偿档（范围以 @ready 为准） |
| grid | Boolean | false | 九宫格辅助线 |
| crop | String | '' | 裁剪，JSON 串 `{"x":0,"y":0,"w":1,"h":1}`(0~1 相对预览可视区)；空串 = 不裁 |
| cropBox | Boolean | true | 裁剪取景框：true=裁剪开启时显示取景框；false=静默裁剪不显框（仅 crop 开启时有意义） |
| cropBoxMask | Boolean | true | 是否显示取景框外的灰色遮罩；false = 只显示取景框描边 |
| cropBoxColor | String | #50DC78 | 裁剪取景框描边颜色，Android / iOS 一致；支持 `#RRGGBB`、`#AARRGGBB`，非法值回退默认色 |
| cropBoxRadius | Number | 0 | 裁剪取景框圆角（逻辑像素），0 = 直角；仅改变预览框样式，不改变最终矩形裁剪结果 |
| watermark | String | '' | 水印，JSON 串 `{"on":true,"time":true,"date":true,"week":true,"location":"厦门","text":"内部资料"}`；空串 / on:false = 关 |
| saveExif | Boolean | true | 写入 EXIF |
| saveLocation | Boolean | false | 写入 GPS（开启才申请定位） |
| silentCapture | Boolean | false | 无声拍照（抓帧，无快门音） |
| mute | Boolean | false | 录像静音 |
| coverFrame | Number | 10 | 录像封面取第 N 帧 |
| videoQuality | String | fhd | 录像档位 uhd / fhd / hd / sd；设备不支持指定档位时自动回退 |
| videoFps | Number | 30 | 录像帧率 |
| enableZoomGesture | Boolean | true | 两指缩放手势 |
| enableTapFocus | Boolean | true | 点按对焦 |

```html
<!-- 圆角只影响预览框样式，照片仍按 crop 的矩形区域裁剪 -->
<fsyang-camera
  :crop="cropJson"
  :cropBox="true"
  :cropBoxMask="false"
  cropBoxColor="#FF3B30"
  :cropBoxRadius="12"
/>
```

## 事件

| 事件 | 触发时机 | detail |
|------|----------|--------|
| @ready | 相机就绪 | zoomMin / zoomMax / exposureMin / exposureMax / hasFlash / position / photoMaxWidth / photoMaxHeight / videoQuality / videoQualities；iOS 老设备兼容字段 videoQualitiesJson |
| @captured | 拍照完成 | type / path / width / height / size / time / model / hasGps / lat / lng（iOS 另含 make / orientation / fnumber / iso / exposure） |
| @recordstart | 录像开始 | — |
| @recordstop | 录像结束 | type / path / size / cover(可选) / duration(毫秒) / width / height |
| @zoomchange | 变焦变化 | zoom |
| @focus | 对焦 | — |
| @error | 出错 | code / message |

> payload 双端形态略有差异（Android 为 JSON 字符串、iOS 为 `e.detail`），用上面的 `parse(e)` 统一处理即可。

## 方法（this.$refs.cam.xxx）

| 方法 | 说明 |
|------|------|
| takePhoto() | 拍照（结果走 @captured） |
| startRecord() / stopRecord() | 开始 / 停止录像 |
| switchCamera() | 切换前后摄 |
| changeCameraPosition('back' \| 'front') | 设置镜头 |
| zoomTo(ratio) | 变焦到指定倍数 |
| exposureTo(ev) | 设置曝光档 |
| flashTo('off' \| 'on' \| 'auto' \| 'torch') | 设置闪光 |
| focusAt(x, y) | 对焦到 0~1 坐标 |
| requestPermission('camera') | 申请相机权限 |
| requestPermission('microphone') | 申请麦克风权限（仅录像收声需要） |
| requestPermission('location') | 申请定位权限（仅写 GPS 需要） |
| startCamera() / stopCamera() | 启停预览（建议 onShow / onHide） |
| setWatermarkConfig(...) | 动态设置水印 |
| refresh() | 刷新预览 |

## 系统要求与权限

- **Android** minSdk 21（5.0）+，需自定义基座 / 云打包；**iOS** 12.0+
- 权限：相机(必需) / 定位(可选，仅写 GPS 时)；麦克风仅录像收声时需要
- Android 插件默认不声明 `RECORD_AUDIO`，云打包不会自动加入录音权限；如业务需要录像收声，请在宿主 `manifest.json` 额外添加 `android.permission.RECORD_AUDIO`，并在使用前调用 `requestPermission('microphone')`
- iOS 相机 / 麦克风 / 定位用途串插件已内置声明，云打包自动合并

## 购买与售后

- 支持试用，先试后买；**源码版**含 Android(CameraX) + iOS(AVFoundation) 完整 uts 源码 + 示例工程
- 定制 / 对接问题：插件评论区留言
