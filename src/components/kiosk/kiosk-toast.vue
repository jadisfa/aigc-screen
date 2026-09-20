<template>
  <view v-if="visible" class="kiosk-toast">
    <view class="kiosk-toast__box">
      <image
        v-if="config.icon"
        class="kiosk-toast__icon"
        :src="config.icon"
        mode="aspectFit"
      />
      <text v-if="config.title" class="kiosk-toast__text">{{ config.title }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from "vue";

const visible = ref(false);
const config = reactive({
  title: "",
  icon: "",
  duration: 2000,
});

let timer: any = null;

function show(options: {  title?: string; icon?: string; duration?: number }) {
	console.log(options.icon)
  config.icon = options.icon || "";
  config.title = options.title || "";
  config.duration = options.duration ?? 2000;

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

// 监听全局事件
onMounted(() => {
  uni.$on("kiosk:toast:show", show);
  uni.$on("kiosk:toast:hide", hide);
});

onUnmounted(() => {
  uni.$off("kiosk:toast:show", show);
  uni.$off("kiosk:toast:hide", hide);
});

defineExpose({ show, hide });
</script>

<style>
.kiosk-toast {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.kiosk-toast__mask {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
}

.kiosk-toast__box {
  position: relative;
  padding: calc(24 * var(--u));
  background: rgba(0, 0, 0, 0.75);
  border-radius: calc(24 * var(--u));
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.kiosk-toast__icon {
  width: calc(50 * var(--u));
  height: calc(50 * var(--u));
}

.kiosk-toast__text {
  font-size: calc(32 * var(--u));
  color: #fff;
  text-align: center;
}
</style>