<template>
	<!-- 占位根节点；真正原生视图由 NVLoad 返回的 UIView 承载，预览层由 CameraAVEngine 叠加 -->
	<view class="mz-custom-camera"></view>
</template>

<script lang="uts">
	/**
	 * uni-app 兼容模式 UTS 组件（nvue）
	 * 原生载体: UIView + AVCaptureVideoPreviewLayer（CameraAVEngine.swift / AVFoundation）
	 * UI 由业务页自行覆盖绘制（快门 / 相册 / 返回等）
	 *
	 * iOS 注意：
	 * - __$$emit / $emit 第二参必须是 Map<string, any>，对象字面量会编成 UTSJSONObject 导致编译失败
	 * - 业务侧可读 e.detail.xxx，需再包一层 detail（与 Android 对齐）
	 * - this.$el 类型为 UIView（非可选），勿使用 $el!
	 * - 须在 nvue 页使用；普通 vue 页无法内嵌该原生组件
	 */
	import { UIView, UIColor } from 'UIKit'
	import { CGRect } from 'CoreGraphics'
	import { fireTakePhotoSuccess, fireTakePhotoFail } from '../captureBridge.uts'
	// CameraAVEngine / CameraAVCallback 为同目录混编 Swift，直接使用，勿相对路径 import

	/**
	 * 将业务 detail 再包一层，使 nvue 侧事件形态为 e.detail.facing / path 等
	 * （iOS 必须用 Map，且与 Android buildEmitData 约定一致）
	 */
	function buildEmitData(detail : Map<string, any>) : Map<string, any> {
		const data = new Map<string, any>()
		data.set('detail', detail)
		return data
	}

	/**
	 * AVFoundation 引擎 → 组件事件桥接
	 * 实现 CameraAVCallback，经 __$$emit 抛给业务页
	 */
	class EngineCallback implements CameraAVCallback {
		private component : UTSComponent<UIView>
		constructor(component : UTSComponent<UIView>) {
			this.component = component
			super.init()
		}
		@objc onReady(facing : string) {
			const detail = new Map<string, any>()
			detail.set('facing', facing)
			this.component.__$$emit('ready', buildEmitData(detail))
		}
		@objc onError(code : string, message : string) {
			fireTakePhotoFail(message.length > 0 ? message : code)
			const detail = new Map<string, any>()
			detail.set('code', code)
			detail.set('message', message)
			this.component.__$$emit('error', buildEmitData(detail))
		}
		@objc onCapture(path : string) {
			fireTakePhotoSuccess(path)
			const detail = new Map<string, any>()
			detail.set('path', path)
			this.component.__$$emit('capture', buildEmitData(detail))
		}
	}

	export default {
		name: 'mz-custom-camera',
		emits: ['ready', 'error', 'capture'],
		props: {
			/**
			 * 摄像头方向: back | front
			 */
			devicePosition: {
				type: String,
				default: 'back'
			},
			/**
			 * 闪光灯: off | on | auto
			 */
			flashMode: {
				type: String,
				default: 'off'
			},
			/**
			 * 组件加载后是否自动开启预览（NVLoaded 时调用 bindCamera）
			 */
			autoPreview: {
				type: Boolean,
				default: true
			}
		},
		data() {
			return {
				engine: null as CameraAVEngine | null,
				callback: null as EngineCallback | null,
				started: false
			}
		},
		watch: {
			/** prop 变化时同步到已启动的引擎（切摄） */
			devicePosition: {
				handler(newValue : string, oldValue : string) {
					if (newValue != oldValue && this.engine != null) {
						this.engine!.setFacing(newValue)
					}
				},
				immediate: false
			},
			/** prop 变化时同步闪光灯 */
			flashMode: {
				handler(newValue : string, oldValue : string) {
					if (newValue != oldValue && this.engine != null) {
						this.engine!.updateFlashMode(newValue)
					}
				},
				immediate: false
			}
		},
		// setFlashMode 会与 prop flashMode 的 ObjC setter 冲突，故用 updateFlashMode
		expose: ['startPreview', 'stopPreview', 'takePhoto', 'switchCamera', 'updateFlashMode'],
		methods: {
			/** 组件侧主动报错（引擎尚未创建时） */
			emitError(code : string, message : string) {
				const detail = new Map<string, any>()
				detail.set('code', code)
				detail.set('message', message)
				this.__$$emit('error', buildEmitData(detail))
			},
			/** 手动开启预览（autoPreview=false 时由业务调用） */
			startPreview() {
				this.bindCamera()
			},
			/** 停止预览（不解绑宿主 UIView） */
			stopPreview() {
				if (this.engine != null) {
					this.engine!.stop()
				}
				this.started = false
			},
			/** 拍照；结果经 @capture 回传本地绝对路径 */
			takePhoto() {
				if (this.engine != null) {
					this.engine!.takePhoto()
				} else {
					this.emitError('NOT_READY', 'Camera not ready')
				}
			},
			/** 前后摄切换 */
			switchCamera() {
				if (this.engine != null) {
					this.engine!.switchCamera()
				}
			},
			/** 运行时改闪光灯（勿用 setFlashMode 命名） */
			updateFlashMode(mode : string) {
				if (this.engine != null) {
					this.engine!.updateFlashMode(mode)
				}
			},
			/**
			 * 创建/复用 CameraAVEngine 并 start
			 * hostView 使用组件 $el（NVLoad 返回的 UIView）
			 */
			bindCamera() {
				if (this.engine == null) {
					this.engine = new CameraAVEngine()
				}
				if (this.callback == null) {
					this.callback = new EngineCallback(this)
				}
				const facingBack = this.devicePosition != 'front'
				// iOS 上 $el 为非可选 UIView，勿写 this.$el!
				this.engine!.start(
					hostView = this.$el,
					facingBack = facingBack,
					flashMode = this.flashMode,
					callback = this.callback!
				)
				this.started = true
			}
		},
		/**
		 * 创建原生根视图：黑底 UIView
		 * 预览 Layer 由引擎 start 时 insert 到该 view.layer
		 */
		NVLoad() : UIView {
			const view = new UIView(frame = CGRect(x = 0, y = 0, width = 0, height = 0))
			view.backgroundColor = UIColor.black
			view.clipsToBounds = true
			return view
		},
		/** 原生视图挂载完成；autoPreview 时自动开预览 */
		NVLoaded() {
			if (this.autoPreview) {
				this.bindCamera()
			}
		},
		/** 布局变化时同步预览层 frame（对应引擎 layoutPreview） */
		NVLayouted() {
			if (this.engine != null) {
				this.engine!.layoutPreview()
			}
		},
		/** 卸载前释放引擎，避免泄漏与相机占用 */
		NVBeforeUnload() {
			if (this.engine != null) {
				this.engine!.releaseEngine()
				this.engine = null
			}
			this.callback = null
			this.started = false
		},
		NVUnloaded() { },
		/** Vue 卸载兜底：再释放一次引擎 */
		unmounted() {
			if (this.engine != null) {
				this.engine!.releaseEngine()
				this.engine = null
			}
		}
	}
</script>

<style>
	.mz-custom-camera {
		flex: 1;
	}
</style>
