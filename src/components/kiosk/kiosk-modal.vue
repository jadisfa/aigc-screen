<template>
	<view v-if="visible" class="custom-modal">
		<view class="custom-modal-body">
			<text class="custom-modal-title">{{ getTitle() }}</text>
			<text class="custom-modal-dec">{{ getDec() }}</text>
			<view class="custom-modal-btns">
				<view class="dt-foot__ghost" hover-class="none" @click="hide">
					<text>取消</text>
				</view>
				<view class="dt-foot__solid" hover-class="none" @click="handleFunction(config.type)">
					<text>{{ getBtn() }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
	import { reactive, ref, onMounted, onUnmounted } from "vue";
	// 公用弹框（确认删除、重新上传确认，下架确认, 类型分别对应0,1,2）
	
	const emit = defineEmits<{ delete: [], reUpload: [], RemoveSale: [] }>();
	
	const visible = ref(false);
	const config = reactive({
      title: '', // 标题
	  dec: '', // 文案
	  btnText: '', // 确认按钮文字
	  type: 0,
	  duration: 2000,
	});
	
	let timer: any = null;
	
	function show(options: {  title?: string; dec?: string; btnText?: string; type?: number; duration?: number }) {
	  config.duration = options.duration ?? 2000;
	  config.title = options.title ?? '';
	  config.dec = options.dec ?? '';
	  config.btnText = options.btnText ?? '';
	  config.type = options.type ?? 0;
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
	const handleDelete = () => {
		emit('delete')
	}
	
	// 重新上传
	const handleReupload = () => {
		emit('reUpload')
	}
	
	// 下架
	const handleRemoveSale = () => {
		emit("RemoveSale");
	}
	
	// 执行操作，根据类型区分
	const handleFunction = (type: number) => {
		switch(type) {
			case 0:
				handleDelete()
				break;
			case 1:
				handleReupload()
				break;
			case 2:
				handleRemoveSale()
				break;
			default:
				break;
		}
		
	}
	
	// 监听全局事件
	onMounted(() => {
	  uni.$on("kiosk:modal:show", show);
	  uni.$on("kiosk:modal:hide", hide);
	});
	
	onUnmounted(() => {
	  uni.$off("kiosk:modal:show", show);
	  uni.$off("kiosk:modal:hide", hide);
	});
	
	defineExpose({ show, hide });
</script>

<style>
	.custom-modal {
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
	.custom-modal-body {
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
	.custom-modal-btns {
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
	}
	
	.custom-modal-title {
		font-weight: bold;
		font-size: calc(40 * var(--u));
		color: #333;
	}
	.custom-modal-dec {
		font-weight: normal;
		font-size: calc(32 * var(--u));
		color: #333;
	}
</style>