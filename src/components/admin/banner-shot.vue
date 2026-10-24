<template>
  <view class="banner-shot">
    <image v-if="still" class="banner-shot__media" :src="still" mode="aspectFill" />
	// #ifdef H5
    <video
      v-else-if="src"
      :id="videoId"
      class="banner-shot__media"
      :src="poster || src"
      :poster="cover"
      :autoplay="false"
      :loop="false"
      :muted="true"
      :controls="false"
      :show-center-play-btn="false"
      :show-play-btn="false"
      :enable-progress-gesture="false"
      object-fit="cover"
      @loadedmetadata="paintFrame"
    />
	// #endif
	<view class="banner-status">正在使用</view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from "vue";

const props = defineProps<{
  src: string;
  cover?: string;
  kind?: "image" | "video";
  poster?: string
}>();

const videoId = `banner-shot-${Math.random().toString(36).slice(2, 10)}`;
const instance = getCurrentInstance();

const still = computed(() => {
  const cover = (props.cover || "").trim();
  if (props.kind === "video") {
    return props.poster?.trim();
  }
  return cover || (props.src || "").trim();
});

function paintFrame() {
  try {
    const ctx = instance?.proxy
      ? uni.createVideoContext(videoId, instance.proxy)
      : uni.createVideoContext(videoId);
    ctx.seek(0.1);
  } catch {
    /* 取不到封面帧时保持当前画面 */
  }
}
</script>

<style>
.banner-shot {
	--u: calc(min(100vw, 1080px) / 1080);
  overflow: hidden;
  position: relative;
}

.banner-status {
	background: #191919;
	color: #fff;
	padding: calc(16 * var(--u)) calc(8 * var(--u));
	position: absolute;
	top: calc(10 * var(--u));
	left: calc(10 * var(--u));
	font-size: calc(16 * var(--u));
	border-radius: calc(12 * var(--u));
	z-index:9999999
}

.banner-shot__media {
  width: 100%;
  height: 100%;
  display: block;
  position: absolute;
}
</style>
