<template>
	<view v-if="visible" class="kiosk-result">
		<view class="kiosk-result-body">
			<text class="kiosk-result-title">{{ getTitle() }}</text>
			<text class="kiosk-result-dec">{{ getDec() }}</text>
			<view class="qr-body">
				<image :src="config.url" class="qr-img"  />
			</view>
			<text class="kiosk-result-dectext">扫一扫二维码，保存图片至手机</text>
			<view class="kiosk-result-btns">
				<view class="dt-foot__ghost" hover-class="none" @click="hide">
					<text>取消</text>
				</view>
				<view class="dt-foot__solid" hover-class="none" @click="handleFunction(config.type)">
					<image :src="btnIcon" class="btn-icon" />
					<text>{{ getBtn() }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
	import { reactive, ref, onMounted, onUnmounted, computed } from "vue";
	import HomeIcon from "@/static/icons/home-icon.svg";
	import BackIcon from "@/static/icons/back-icon.svg";
	// 生成结果返回弹框（返回、再次生成, 类型分别对应0,1）
	
	const emit = defineEmits<{ gohome: [], reGeneratge: [] }>();
	
	const visible = ref(false);
	const config = reactive({
      title: '', // 标题
	  dec: '', // 文案
	  btnText: '', // 确认按钮文字
	  type: 0,
	  duration: 2000,
	  url: '', //二维码地址
	});
	
	const btnIcon = computed(() => config.type == 0 ? BackIcon : HomeIcon);
	
	let timer: any = null;
	
	function show(options: {  title?: string; dec?: string; btnText?: string; type?: number; duration?: number, url?: any }) {
	  config.duration = options.duration ?? 2000;
	  config.title = options.title ?? '';
	  config.dec = options.dec ?? '';
	  config.btnText = options.btnText ?? '';
	  config.type = options.type ?? 0;
	  config.url = options.url ?? '';
	  if (timer) {
	    clearTimeout(timer);
	    timer = null;
	  }
	  visible.value = true;
	  timer = setTimeout(() => {
	    visible.value = false;
	    timer = null;
	  }, config.duration);
	}
	
	function hide() {
	  if (timer) {
	    clearTimeout(timer);
	    timer = null;
	  }
	  visible.value = false;
	}
	
	const getTitle = () => config.title;
	const getDec = () => config.dec;
	const getBtn = () => config.btnText;
	
	// 删除
	const handleReturn = () => {
		emit('gohome')
	}
	
	// 重新上传
	const handleReGenerate = () => {
		emit('reGeneratge')
	}
	
	
	// 执行操作，根据类型区分
	const handleFunction = (type: number) => {
		switch(type) {
			case 0:
				handleReturn()
				break;
			case 1:
				handleReGenerate()
				break;
			default:
				break;
		}
		
	}
	
	// 监听全局事件
	onMounted(() => {
	  uni.$on("kiosk:ResultModal:show", show);
	  uni.$on("kiosk:ResultModal:hide", hide);
	});
	
	onUnmounted(() => {
	  uni.$off("kiosk:ResultModal:show", show);
	  uni.$off("kiosk:ResultModal:hide", hide);
	});
	
	defineExpose({ show, hide });
</script>

<style>
	.kiosk-result {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		justify-content: center;
		background: rgba(0, 0, 0, .75);
		align-items: center;
	}
	.kiosk-result-body {
		position: relative;
		background: #fff;
		border-radius: calc(60 * var(--u));
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40rpx;
		min-width: calc(720 * var(--u));
		max-width: calc(872 * var(--u));
		gap: calc(40 * var(--u));
	}
	.kiosk-result-btns {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		margin-top: calc(40* var(--u));
		gap: calc(24 * var(--u));
		width: 100%;
	}
	
	.dt-foot__ghost,
	.dt-foot__solid {
	  flex: 1;
	  height: calc(100 * var(--u));
	  border-radius: calc(60 * var(--u));
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  font-size: calc(32 * var(--u));
	  font-weight: 500;
	}
	
	.dt-foot__ghost {
	  border: calc(1 * var(--u)) solid #191919;
	  color: #333;
	  box-sizing: border-box;
	}
	
	.dt-foot__solid {
	  background: #191919;
	  color: #fff;
	  gap: calc(16 * var(--u));
	  
	}
	.btn-icon {
		width: calc(32 * var(--u));
		height: calc(32 * var(--u));
	}
	
	.kiosk-result-title {
		font-weight: bold;
		font-size: calc(40 * var(--u));
		color: #333;
	}
	.kiosk-result-dec {
		font-weight: normal;
		font-size: calc(32 * var(--u));
		color: #333;
	}
	.qr-body {
		width: calc(420 * var(--u));
		height: calc(420 * var(--u));
		margin: 0 auto;
		display: flex;
		justify-content: center;
		align-items: center;
		background: url('@/static/icons/qr-bg.svg');
		background-repeat: no-repeat;
		background-position: center;
		background-size: contain;
	}
	.qr-img {
		width: calc(320 * var(--u));
		height: calc(320 * var(--u));
	}
	.kiosk-result-dectext {
		font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
		font-size: calc(32 * var(--u));
		color: #333;
	}
</style>