<template>
  <view></view>
</template>

<script lang="uts">
  import FrameLayout from 'android.widget.FrameLayout'
  import { CameraEngine } from './CameraEngine.uts'

  /**
   * <fsyang-camera> 自定义相机组件（uni-app 兼容模式 uts 组件）
   * NVLoad 返回原生 FrameLayout，CameraEngine 把 CameraX 预览挂上去。
   */
  export default {
    name: 'fsyang-camera',
    emits: ['ready', 'error', 'captured', 'recordstart', 'recordstop', 'focus', 'zoomchange'],
    props: {
      mode: { type: String, default: 'photo' },
      position: { type: String, default: 'back' },
      cameraPosition: { type: String, default: '' },
      flash: { type: String, default: 'off' },
      photoWidth: { type: Number, default: 1080 },
      zoom: { type: Number, default: 1 },
      exposure: { type: Number, default: 0 },
      grid: { type: Boolean, default: false },
      // 裁剪:传 JSON 对象字符串 '{"x":0,"y":0,"w":1,"h":1}'(0~1 相对预览可见区)=开启；空串/不传=关闭(原生组件 prop 用 String 最稳，规避 Object 桥接崩)
      crop: { type: String, default: '' },
      // 裁剪取景框:true=裁剪开启时显示取景框(默认)；false=静默裁剪不显框。仅 crop 开启时有意义
      cropBox: { type: Boolean, default: true },
      cropBoxMask: { type: Boolean, default: true },
      cropBoxColor: { type: String, default: '#50DC78' },
      cropBoxRadius: { type: Number, default: 0 },
      saveExif: { type: Boolean, default: true },
      saveLocation: { type: Boolean, default: false },
      mute: { type: Boolean, default: false },
      silentCapture: { type: Boolean, default: false },
      coverFrame: { type: Number, default: 10 },
      videoQuality: { type: String, default: 'fhd' },
      videoFps: { type: Number, default: 30 },
      // 水印:传 JSON 字符串 '{"on":true,"time":true,"date":true,"week":true,"location":"","text":""}'=开启；空串/不传=关闭(原生组件 prop 用 String 最稳，规避 Object 桥接崩)
      watermark: { type: String, default: '' },
      enableZoomGesture: { type: Boolean, default: true },
      enableTapFocus: { type: Boolean, default: true }
    },
    data() {
      return {
        engine: null as CameraEngine | null,
        pendingPosition: ''
      }
    },
    watch: {
      position: { handler(v: string) { if (this.cameraPosition == null || this.cameraPosition == '') { this.pendingPosition = ''; this.engine?.setPosition(v) } } },
      cameraPosition: { handler(v: string) { this.pendingPosition = ''; this.engine?.setPosition(this.resolvePosition()) } },
      flash: { handler(v: string) { this.engine?.setFlash(v) } },
      mode: { handler(v: string) { this.engine?.setMode(v) } },
      photoWidth: { handler(v: number) { this.engine?.setPhotoWidth(v) } },
      zoom: { handler(v: number) { this.engine?.setZoom(v) } },
      exposure: { handler(v: number) { this.engine?.setExposure(v) } },
      grid: { handler(v: boolean) { this.engine?.setGrid(v) } },
      crop: { handler(v: string) { this.applyCrop() } },
      cropBox: { handler(v: boolean) { this.engine?.setCropBox(v) } },
      cropBoxMask: { handler(v: boolean) { this.engine?.setCropBoxMask(v) } },
      cropBoxColor: { handler(v: string) { this.engine?.setCropBoxColor(v) } },
      cropBoxRadius: { handler(v: number) { this.engine?.setCropBoxRadius(v) } },
      saveExif: { handler(v: boolean) { this.engine?.setSaveExif(v) } },
      saveLocation: { handler(v: boolean) { this.engine?.setSaveLocation(v) } },
      mute: { handler(v: boolean) { this.engine?.setMute(v) } },
      silentCapture: { handler(v: boolean) { this.engine?.setSilentCapture(v) } },
      coverFrame: { handler(v: number) { this.engine?.setCoverFrame(v) } },
      videoQuality: { handler(v: string) { this.engine?.setVideoQuality(v) } },
      enableZoomGesture: { handler(v: boolean) { this.engine?.setEnableZoomGesture(v) } },
      enableTapFocus: { handler(v: boolean) { this.engine?.setEnableTapFocus(v) } },
      watermark: { handler(v: string) { this.applyWatermark() } }
    },
    expose: [
      'takePhoto', 'startRecord', 'stopRecord', 'switchCamera',
      'zoomTo', 'exposureTo', 'flashTo', 'focusAt',
      'changeCameraPosition', 'requestPermission', 'startCamera', 'stopCamera', 'setWatermarkConfig', 'refresh'
    ],
    methods: {
      resolvePosition(): string {
        const pending = this.pendingPosition
        if (pending != null && pending != '') { return pending }
        const cp = this.cameraPosition
        if (cp != null && cp != '') { return cp }
        return this.position
      },
      refresh() { this.engine?.refresh() },
      // 解析 crop JSON 对象字符串 → 引擎:x/y/w/h(0~1)开启裁剪；空串/解析失败=关闭
      applyCrop() {
        const s = this.crop
        if (s == null || s == '') { this.engine?.setCrop(false); return }
        const o = JSON.parseObject(s)
        if (o == null) { this.engine?.setCrop(false); return }
        const co = o!
        this.engine?.setCrop(true)
        this.engine?.setCropRect(co.getNumber('x') ?? 0, co.getNumber('y') ?? 0, co.getNumber('w') ?? 1, co.getNumber('h') ?? 1)
      },
      // 解析 watermark JSON 字符串 → 引擎:on:true 开启(读 time/date/week/location/text)；空串/解析失败/on:false=关闭
      applyWatermark() {
        const s = this.watermark
        if (s == null || s == '') { this.engine?.setWatermarkConfig(false, true, true, true, '', ''); return }
        const wo = JSON.parseObject(s)
        if (wo == null) { this.engine?.setWatermarkConfig(false, true, true, true, '', ''); return }
        const o = wo!
        if (o.getBoolean('on') ?? false) {
          this.engine?.setWatermarkConfig(true, o.getBoolean('time') ?? true, o.getBoolean('date') ?? true, o.getBoolean('week') ?? true, o.getString('location') ?? '', o.getString('text') ?? '')
        } else {
          this.engine?.setWatermarkConfig(false, true, true, true, '', '')
        }
      },
      setWatermarkConfig(on: boolean, time: boolean, date: boolean, week: boolean, location: string, text: string) {
        this.engine?.setWatermarkConfig(on, time, date, week, location, text)
      },
      takePhoto() { this.engine?.takePhoto() },
      startRecord() { this.engine?.startRecord() },
      stopRecord() { this.engine?.stopRecord() },
      switchCamera() { this.engine?.switchCamera() },
      changeCameraPosition(pos: string) { this.pendingPosition = pos; this.engine?.setPosition(pos) },
      zoomTo(ratio: number) { this.engine?.setZoom(ratio) },
      exposureTo(ev: number) { this.engine?.setExposure(ev) },
      flashTo(m: string) { this.engine?.setFlash(m) },
      focusAt(x: number, y: number) { this.engine?.focusAt(x, y) },
      requestPermission(perms: string) { this.engine?.requestPermissions(perms) },
      startCamera() { this.engine?.startCamera() },
      stopCamera() { this.engine?.stopCamera() }
    },
    NVLoad(): FrameLayout {
      return new FrameLayout(this.$androidContext!)
    },
    NVLoaded() {
      const self = this
      const eng = new CameraEngine(this.$androidContext!, (event: string, data: UTSJSONObject): void => {
        self.$emit(event, JSON.stringify(data))
      })
      this.engine = eng
      // 应用初始 props
      eng.setMode(this.mode)
      eng.setPosition(this.resolvePosition())
      eng.attach(this.$el as FrameLayout)
      eng.setFlash(this.flash)
      eng.setPhotoWidth(this.photoWidth)
      this.applyCrop()
      eng.setCropBox(this.cropBox)
      eng.setCropBoxMask(this.cropBoxMask)
      eng.setCropBoxColor(this.cropBoxColor)
      eng.setCropBoxRadius(this.cropBoxRadius)
      eng.setSaveExif(this.saveExif)
      eng.setSaveLocation(this.saveLocation)
      eng.setMute(this.mute)
      eng.setSilentCapture(this.silentCapture)
      eng.setCoverFrame(this.coverFrame)
      eng.setVideoQuality(this.videoQuality)
      eng.setEnableZoomGesture(this.enableZoomGesture)
      eng.setEnableTapFocus(this.enableTapFocus)
      this.applyWatermark()
      eng.setGrid(this.grid)
      if (this.zoom != 1) eng.setZoom(this.zoom)
      if (this.exposure != 0) eng.setExposure(this.exposure)
    },
    NVUnloaded() {
      this.engine?.release()
      this.engine = null
    }
  }
</script>
