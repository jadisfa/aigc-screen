<template>
	<!--
		可选：业务侧可复制本结构到自己的 nvue 页自定义 UI。
		本文件不是原生组件，不参与预览渲染。
	-->
	<view class="panel-doc">
		<text class="title">mz-custom-camera 自定义 UI 说明</text>
		<text class="desc">原生组件只提供预览与拍照能力；返回、取景框、快门、相册等请在 nvue 页自行布局覆盖。</text>
		<text class="desc">完整示例见：uni_modules/mz-custom-camera/example/custom-ui.nvue</text>
	</view>
</template>

<script>
	export default {
		name: 'mz-custom-camera-panel'
	}
</script>

<style scoped>
	.panel-doc {
		padding: 24rpx;
	}
	.title {
		font-size: 32rpx;
		font-weight: 600;
		margin-bottom: 12rpx;
	}
	.desc {
		font-size: 26rpx;
		color: #666;
		line-height: 1.5;
		margin-bottom: 8rpx;
	}
</style>
