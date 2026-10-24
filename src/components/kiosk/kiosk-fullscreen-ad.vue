<template>
  <view v-if="visible && current" class="fs-ad" @click="onDismiss">
    <view class="fs-ad__stage" @click.stop >
      <!-- 视频 原生组件 -->
	  <view class="fs-cover-view" v-if="current.mediaKind === 'video'"  @touchstart="onTouchStart"
  @touchend="onTouchEnd">
		<video
        
        :key="current.id"
        class="fs-ad__media"
        :src="current.src"
        :autoplay="true"
        :loop="ads.length === 1"
        :muted="true"
        :controls="false"
        :show-center-play-btn="false"
        :enable-progress-gesture="false"
        object-fit="cover"
        @ended="onVideoEnded"
      />  
	  </view>
      
      <!-- 图片 -->
      <image
        v-else
        :key="current.id"
        class="fs-ad__media"
        :src="current.src"
        mode="aspectFill"
      />
    </view>
    <!-- 自定义 dots -->
    <view v-if="ads.length > 1" class="fs-swiper-dots">
      <view
        v-for="(dot, dotIndex) in ads"
        :key="dotIndex"
        class="fs-swiper-dots-item"
        :class="{ active: dotIndex === page }"
      />
    </view>
    <image
      class="fs-ad__close"
      src="/static/results/compare-close.svg"
      mode="aspectFit"
      @click.stop="onDismiss"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { FULLSCREEN_IMAGE_MS, type KioskAdSlide } from "@/data/ads";

const props = defineProps<{
  visible: boolean;
  ads: KioskAdSlide[];
}>();
const emit = defineEmits<{
  dismiss: [];
}>();

const page = ref(0);
let imageTimer: ReturnType<typeof setTimeout> | null = null;
const current = computed(() => props.ads[page.value] || props.ads[0] || null);

let subNvue: UniApp.SubNVue | null = null;

function clearImageTimer() {
  if (imageTimer) {
    clearTimeout(imageTimer);
    imageTimer = null;
  }
}

function goNext() {
  console.log("后一页");
  if (props.ads.length <= 1) return;
  page.value = (page.value + 1) % props.ads.length;
  armImageTimer();
}

function goPrev() {
  console.log("上一页");
  if (props.ads.length <= 1) return;
  page.value = (page.value - 1 + props.ads.length) % props.ads.length;
  armImageTimer();
}

function armImageTimer() {
  clearImageTimer();
  if (!props.visible || current.value?.mediaKind !== "image") {
    return;
  }
  imageTimer = setTimeout(() => {
    imageTimer = null;
    goNext();
  }, FULLSCREEN_IMAGE_MS);
}

function onVideoEnded() {
  goNext();
}

function onDismiss() {
  emit("dismiss");
}

// =========【修改点1：监听函数放到顶层，只注册一次】=========
function handleSwipe(direction: string) {
  // 增加保护：弹窗不可见时，直接忽略滑动事件
  if (!props.visible || props.ads.length <= 1) return;
  if (direction === "next") {
    goNext();
  } else if (direction === "prev") {
    goPrev();
  }
}

// 全局事件监听【只在组件初始化绑定一次！不要放进watch】
// #ifdef APP-PLUS
uni.$on("kioskAdSwipe", handleSwipe);
// #endif

// subNVue 显示隐藏
function showGestureLayer() {
  // #ifdef APP-PLUS
  if (!subNvue) {
    subNvue = uni.getSubNVueById("kioskAdGesture");
  }
  if (subNvue) {
    subNvue.show('fade-in');
  }
  // #endif
}
function hideGestureLayer() {
  // #ifdef APP-PLUS
  if (subNvue) {
    subNvue.hide('fade-out');
  }
  // #endif
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      showGestureLayer();
    } else {
      hideGestureLayer();
      clearImageTimer();
      page.value = 0;
    }
  }
);

watch(
  () => current.value?.id,
  () => {
    if (props.visible) {
      armImageTimer();
    }
  }
);

const startX = ref(0);
const startY = ref(0);
const SWIPE_THRESHOLD = 40;

function onTouchStart(e) {
	console.log('滑动')
  startX.value = e.touches[0].screenX;
  startY.value = e.touches[0].screenY;
}

function onTouchEnd(e) {
  const deltaX = e.changedTouches[0].screenX - startX.value;
  const deltaY = e.changedTouches[0].screenY - startY.value;
  console.log(deltaX, startX.value, 178)
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
    if (deltaX < 0) {
      goNext();  // 左滑 → 下一张
    } else {
      goPrev();  // 右滑 → 上一张
    }
  }
}

// =========【修改点2：组件销毁时移除事件监听】=========
onUnmounted(() => {
  clearImageTimer();
  hideGestureLayer();
  // #ifdef APP-PLUS
  uni.$off("kioskAdSwipe", handleSwipe);
  // #endif
});
</script>

<style>
.fs-ad {
  --u: calc(min(100vw, 1080px) / 1080);
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.fs-ad__stage {
  position: relative;
  width: calc(840 * var(--u));
  height: calc(1120 * var(--u));
  max-height: 72vh;
  border-radius: calc(48 * var(--u));
  overflow: hidden;
  background: #111;
}
.fs-cover-view {
	position: absolute;
	top: 0;
	left: 0;
	left: 0;
	bottom: 0;
	background: #dfdfdf;
	z-index: 99999;
}
.fs-ad__media {
  width: 100%;
  height: 100%;
}
.fs-ad__close {
  margin-top: calc(40 * var(--u));
  width: calc(84 * var(--u));
  height: calc(84 * var(--u));
}
.fs-swiper-dots {
  width: 100%;
  height: calc(20 * var(--u));
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: calc(20 * var(--u));
  margin-top: calc(20 * var(--u));
}
.fs-swiper-dots-item {
  width: calc(20 * var(--u));
  height: calc(20 * var(--u));
  background: rgba(255, 255, 255, 0.5);
  border-radius: calc(20 * var(--u));
}
.fs-swiper-dots-item.active {
  background: #fff;
}
</style>
