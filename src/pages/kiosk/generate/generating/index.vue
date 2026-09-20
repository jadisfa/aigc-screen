<template>
  <view class="gen">
    <text class="gen__title">{{ title }}</text>
    <text class="gen__lead">{{ lead }}</text>
    <view class="gen__card">
      <image class="gen__icon" :src="ASSETS.recognize" mode="aspectFit" />
      <text class="gen__status">{{ statusText }}</text>
      <view class="gen__bar">
        <view class="gen__bar-fill" :style="{ width: progress + '%' }" />
      </view>
      <text class="gen__pct">{{ progress }}%</text>
    </view>
	<KioskGenerate v-if="showFailed" @back="handleBack" @reGenerate="handleRegenerate" />
	<kiosk-toast />
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { matchingScene, runMatching } from "@/lib/experience-flow";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { showScreenError } from "@/lib/screen-http";
import KioskGenerate from "@/components/kiosk/kiosk-generate.vue";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";

const ASSETS = {
  recognize: "/static/camera/recognize-icon.png",
};

const scene = matchingScene();
const title = ref(scene === "keyword" ? "正在为您匹配款式" : "正在识别穿搭风格");
const lead = ref(
  scene === "keyword" ? "根据您的灵感关键词，从门店现货中挑选推荐" : "根据您的穿搭与偏好，从门店现货中挑选推荐",
);
const progress = ref(0);
const nextUrl = ref<string>(KIOSK_PAGES.results);
const signal = { aborted: false };
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

const statusText = computed(() => (progress.value < 100 ? "智能匹配中，请稍等……" : "匹配完成"));
const showFailed = ref(false);

onLoad((query?: Record<string, string>) => {
  if (query?.next) {
    nextUrl.value = decodeURIComponent(query.next);
  }
  start();
});

onUnload(() => {
  stop();
});

onUnmounted(() => {
  stop();
});

async function start() {
  try {
    await runMatching((percent) => {
      if (!signal.aborted) {
        progress.value = Math.max(progress.value, percent);
      }
    }, signal);
    if (signal.aborted) {
      return;
    }
    progress.value = 100;
    leaveTimer = setTimeout(() => {
      uni.redirectTo({ url: nextUrl.value });
    }, 400);
  } catch (error) {
	if (error.message.includes('未绑定') || error.message) {
		showFailed.value = true;
	} else {
		(uni as any).$toast.error(error.message, undefined, 1000);
	}
    if (signal.aborted) {
      return;
    }
    // showScreenError(error, "穿搭识别暂时不可用，请稍后重试");
    // goBackOr(KIOSK_PAGES.home);
  }
}

function stop() {
  signal.aborted = true;
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
}
const handleRegenerate = () => {
	showFailed.value = false;
	start()
}

const handleBack = () => {
	showFailed.value = false;
	const pages = getCurrentPages();
	uni.navigateBack({
		delta: 1
	});
}
</script>

<style>
page {
  height: 100%;
  background: #f0f0f0;
}

.gen {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #f0f0f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(80 * var(--u));
  box-sizing: border-box;
}

.gen__title {
  font-size: calc(56 * var(--u));
  font-weight: 900;
  letter-spacing: calc(5.6 * var(--u));
  color: #333;
}

.gen__lead {
  margin-top: calc(24 * var(--u));
  font-size: calc(28 * var(--u));
  font-weight: 500;
  color: #777;
}

.gen__card {
  margin-top: calc(80 * var(--u));
  width: calc(840 * var(--u));
  background: #fff;
  border-radius: calc(40 * var(--u));
  padding: calc(64 * var(--u)) calc(48 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.gen__icon {
  width: calc(120 * var(--u));
  height: calc(120 * var(--u));
}

.gen__status {
  margin-top: calc(32 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 700;
  color: #333;
}

.gen__bar {
  margin-top: calc(40 * var(--u));
  width: 100%;
  height: calc(16 * var(--u));
  border-radius: calc(8 * var(--u));
  background: #eee;
  overflow: hidden;
}

.gen__bar-fill {
  height: 100%;
  background: #191919;
}

.gen__pct {
  margin-top: calc(16 * var(--u));
  font-size: calc(28 * var(--u));
  font-weight: 500;
  color: #777;
}
</style>
