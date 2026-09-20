<!-- 生成结果（暂时仅失败） -->
<template>
	<view class="kiosk-generate">
	  <view class="return-bar">
		<kiosk-chip :icon="ASSETS.back" label="返回" @click="onBack" />
	  </view>
	  <view class="kiosk-generate-content">
		  <image class="kiosk-generate-failed" :src="ASSETS.failed" mode="widthFix" />
		  <text class="kiosk-generate-title">美甲生成失败</text>
		  <text class="kiosk-generate-dec">稍等片刻再尝试重新生成</text>
		  <view class="kiosk-generate-btn" @click="handleRegenerate">重新生成</view>
		  <view class="kiosk-generate-return" @click="onBack">返回</view>
	  </view>
	</view>
</template>

<script setup lang="ts">
import KioskChip from "@/components/kiosk/kiosk-chip.vue";

const emit = defineEmits<{ back: [], reGenerate: [] }>();

const ASSETS = {
  back: "/static/scan/back.svg",
  failed: "/static/admin/failed.svg"
};

const handleRegenerate = () => {
	emit('reGenerate')
}

const onBack = () => {
	emit('back')
}
	
</script>

<style>
	.kiosk-generate {
		width: 100%;
		height: 100%;
		position: fixed;
		left: 0;
		top: 0;
		background: #0F1010;
		z-index: 99999;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}
	.return-bar {
		position: absolute;
		left: calc(48 * var(--u));
		top: calc(32 * var(--u));
		z-index: 2;
	}
	.kiosk-generate-content {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.kiosk-generate-failed {
		width: calc(200 * var(--u));
		height: calc(200 * var(--u));
	}
	.kiosk-generate-title {
		font-size: calc(40 * var(--u));
		color: #fff;
		margin-top: calc(67 * var(--u));
	}
	.kiosk-generate-dec {
		font-size: calc(32 * var(--u));
		color: rgba(255, 255, 255, .5);
		margin-top: calc(38 * var(--u));
	}
	.kiosk-generate-btn , .kiosk-generate-return {
		width: calc(420 * var(--u));
		height: calc(80 * var(--u));
		font-size: calc(32 * var(--u));
		border-radius: calc(60 * var(--u));
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.kiosk-generate-btn {
		background: #fff;
		color: #323333;
		margin-top: calc(60 * var(--u));
	}
	.kiosk-generate-return {
		color: #fff;
		border: calc(1 * var(--u)) solid #323333;
		margin-top: calc(32 * var(--u));
	}
</style>