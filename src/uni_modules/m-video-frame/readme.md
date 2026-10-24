# m-video-frame

> 支持本地视频（相册/录制/文件）和在线视频地址（http/https）抽取指定时间帧，可自定义尺寸、格式和质量。

## 原生实现

- Android：`MediaMetadataRetriever`，关键帧优先 + 精确降级，取帧后等比缩放
- iOS：`AVAssetImageGenerator`，自动纠正旋转、容差取帧、解码期约束尺寸

## 支持的视频地址

| 平台 | 本地绝对路径 | file:// | content:// | http(s):// | `_doc/` 等虚拟路径 |
| --- | --- | --- | --- | --- | --- |
| Android | 支持 | 支持 | 支持 | 支持 | 不支持 |
| iOS | 支持 | 支持 | 不支持 | 支持 | 不支持 |

> iOS 的 `content://` 不是系统 URL 形式，不支持。
>
> `_doc/`、`_downloads/`、`uni-file://` 是 plus.io 虚拟协议，原生层按相对路径找不到文件会抽帧失败。App 端 `uni.chooseVideo` / `uni.chooseMedia` 返回的就是这种路径，调用前先转换：

```js
// _doc/... -> 原生绝对路径
const url = plus.io.convertLocalFileSystemURL('_doc/uniapp_temp_xxx/camera/video_001.mp4')
// Android -> /storage/emulated/0/Android/data/<包名>/apps/<appId>/doc/uniapp_temp_xxx/...
// iOS     -> /var/mobile/Containers/Data/Application/<UUID>/Documents/uniapp_temp_xxx/...
```

## 基本使用方式

```js
import { extractVideoFrame } from '@/uni_modules/m-video-frame'

// 本地视频
const res1 = await extractVideoFrame({ url: '/var/mobile/.../video_001.mp4' })

// 在线视频
const res2 = await extractVideoFrame({ url: 'https://example.com/demo.mp4' })

// 完整参数
const res3 = await extractVideoFrame({
  url: 'https://example.com/demo.mp4',
  timeSec: 1,
  format: 'jpg',
  quality: 90,
  maxWidth: 720,
  maxHeight: 720,
  fileName: 'video_thumb_001'
})

console.log(res.path) // file:// 绝对路径，可直接用于 <image> 展示
```

## 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `url` | string | 是 | 无 | 视频地址，`_doc/` 等虚拟路径需先转换（见上文） |
| `timeMs` | number | 否 | `0` | 抽帧毫秒数，优先级高于 `timeSec` |
| `timeSec` | number | 否 | `0` | 抽帧秒数 |
| `format` | `'jpg' \| 'png'` | 否 | `jpg` | 输出格式 |
| `quality` | number | 否 | `90` | 压缩质量 1-100，越界自动收敛，仅 jpg 有效 |
| `maxWidth` | number | 否 | `0`（不限制） | 最大宽度，超限等比缩小，不裁剪、不放大 |
| `maxHeight` | number | 否 | `0`（不限制） | 最大高度，与 `maxWidth` 独立判断，只传其一仅约束该维度 |
| `fileName` | string | 否 | `frame_<时间戳>` | 输出文件名（不含扩展名），非法字符自动替换为 `_` |

## 返回值

```ts
type ExtractVideoFrameResult = {
  path: string      // 带 file:// 前缀的本地路径，两端统一，可直接用于 image 展示
  width: number     // 输出图片宽度（像素）
  height: number    // 输出图片高度（像素）
  format: string    // 实际输出格式 jpg / png
  timeMs: number    // 实际抽帧时间点（毫秒）
  size: number      // 文件大小（字节）
}
```

## 注意事项

1. 网络视频抽帧依赖系统框架，目标服务器必须支持系统播放器/解码器访问。
2. Android 读取相册本地媒体时，调用方需要自行确保有媒体读取权限。
3. 抽帧时间超出视频时长时插件会自动钳制到时长内（留 50ms 余量），返回的 `timeMs` 为实际取帧时间点
4. 插件对原生层的取帧错误只返回通用错误码 `9030001`，不透出原生具体原因；排查问题建议先在调用侧打印路径转换前后日志