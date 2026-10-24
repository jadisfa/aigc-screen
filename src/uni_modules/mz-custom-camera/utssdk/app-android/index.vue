<template>
	<!-- 占位根节点；真正原生视图由 NVLoad 返回的 FrameLayout + PreviewView 承载 -->
	<view class="mz-custom-camera"></view>
</template>

<script lang="uts">
	/**
	 * uni-app 兼容模式 UTS 组件（nvue）
	 * 原生载体: PreviewView + CameraX（CameraXEngine.kt）
	 * UI 由业务页自行覆盖绘制（快门 / 相册 / 返回等）
	 *
	 * Android 注意：
	 * - $emit 第二参仅支持 Map<string, any>，对象字面量可能导致业务侧收不到字段
	 * - 与 iOS 对齐：再包一层 detail，业务侧统一读 e.detail.xxx
	 * - 须在 nvue 页使用；普通 vue 页无法内嵌该原生组件
	 */
	import PreviewView from 'androidx.camera.view.PreviewView'
	import FrameLayout from 'android.widget.FrameLayout'
	import LayoutParams from 'android.widget.FrameLayout.LayoutParams'
	import Color from 'android.graphics.Color'
	import CameraXEngine from 'uts.sdk.modules.mzCustomCamera.CameraXEngine'
	import ICameraXCallback from 'uts.sdk.modules.mzCustomCamera.ICameraXCallback'
	import { fireTakePhotoSuccess, fireTakePhotoFail } from '../captureBridge.uts'

	/**
	 * 将业务 detail 再包一层，使 nvue 侧事件形态为 e.detail.facing / path 等
	 * （与 iOS __$$emit 约定一致）
	 */
	function buildEmitData(detail : Map<string, any>) : Map<string, any> {
		const data = new Map<string, any>()
		data.set('detail', detail)
		return data
	}

	/**
	 * CameraX 引擎 → 组件事件桥接
	 * 持有组件弱引用式引用，把原生回调转成 $emit
	 */
	class EngineCallback extends ICameraXCallback {
		private comp : UTSComponent<FrameLayout>
		constructor(comp : UTSComponent<FrameLayout>) {
			super()
			this.comp = comp
		}
		override onReady(facing : string) {
			// $emit 必须在主线程（DCloud: fireEvent must be called by main thread）
			UTSAndroid.getDispatcher("main").async((_) => {
				const detail = new Map<string, any>()
				detail.set('facing', facing)
				this.comp.$emit('ready', buildEmitData(detail))
			}, null)
		}
		override onError(code : string, message : string) {
			UTSAndroid.getDispatcher("main").async((_) => {
				// API 路径（takeCameraPhoto options）优先，不依赖 $emit
				fireTakePhotoFail(message.length > 0 ? message : code)
				const detail = new Map<string, any>()
				detail.set('code', code)
				detail.set('message', message)
				this.comp.$emit('error', buildEmitData(detail))
			}, null)
		}
		override onCapture(path : string) {
			UTSAndroid.getDispatcher("main").async((_) => {
				// API 路径（takeCameraPhoto options）优先，不依赖 $emit
				fireTakePhotoSuccess(path)
				const detail = new Map<string, any>()
				detail.set('path', path)
				this.comp.$emit('capture', buildEmitData(detail))
			}, null)
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
				engine: null as CameraXEngine | null,
				previewView: null as PreviewView | null,
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
		// 与 iOS 对齐：避免 setFlashMode 与 prop flashMode 的 setter 冲突
		expose: ['startPreview', 'stopPreview', 'takePhoto', 'switchCamera', 'updateFlashMode'],
		methods: {
			/** 组件侧主动报错（引擎尚未创建时） */
			emitError(code : string, message : string) {
				const detail = new Map<string, any>()
				detail.set('code', code)
				detail.set('message', message)
				this.$emit('error', buildEmitData(detail))
			},
			/** 手动开启预览（autoPreview=false 时由业务调用） */
			startPreview() {
				this.bindCamera()
			},
			/** 停止预览（不解绑组件原生视图） */
			stopPreview() {
				if (this.engine != null) {
					this.engine!.stop()
				}
				this.started = false
			},
			/** 拍照；结果经 @capture 回传本地绝对路径 */
			takePhoto() {
				console.log('[mz-custom-camera] takePhoto, engine=', this.engine != null)
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
			 * 创建/复用 CameraXEngine 并 start
			 * 依赖 NVLoad 已创建的 previewView
			 */
			bindCamera() {
				const activity = UTSAndroid.getUniActivity()
				if (activity == null || this.previewView == null) {
					this.emitError('NO_ACTIVITY', 'Activity or PreviewView is null')
					return
				}
				if (this.engine == null) {
					this.engine = new CameraXEngine()
				}
				if (this.callback == null) {
					this.callback = new EngineCallback(this)
				}
				const facingBack = this.devicePosition != 'front'
				this.engine!.start(activity!, this.previewView!, facingBack, this.flashMode, this.callback!)
				this.started = true
			}
		},
		/**
		 * 创建原生根视图：黑底 FrameLayout 全屏嵌入 PreviewView
		 * 返回值成为组件在 nvue 中的原生载体
		 */
		NVLoad() : FrameLayout {
			const context = $androidContext!
			const root = new FrameLayout(context)
			root.setBackgroundColor(Color.BLACK)
			const preview = new PreviewView(context)
			const lp = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
			root.addView(preview, lp)
			this.previewView = preview
			return root
		},
		/** 原生视图挂载完成；autoPreview 时自动开预览 */
		NVLoaded() {
			if (this.autoPreview) {
				this.bindCamera()
			}
		},
		NVLayouted() {
			// PreviewView 尺寸变化后 CameraX 会自行适配，无需手动 layout
		},
		/** 卸载前释放引擎，避免泄漏与相机占用 */
		NVBeforeUnload() {
			if (this.engine != null) {
				this.engine!.release()
				this.engine = null
			}
			this.previewView = null
			this.callback = null
			this.started = false
		},
		NVUnloaded() { },
		/** Vue 卸载兜底：再释放一次引擎 */
		unmounted() {
			if (this.engine != null) {
				this.engine!.release()
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
