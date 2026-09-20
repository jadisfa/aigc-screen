<template>
  <view class="wait">
    <view class="wait__bar">
      <kiosk-chip :icon="ASSETS.back" variant="glass" label="返回" @click="onBack" />
    </view>
    <image class="wait__scan" :src="ASSETS.scan" mode="aspectFit" />
    <text class="wait__eta">预计等待时间{{ etaSeconds }}秒</text>
    <text class="wait__line">{{ line }}</text>
    <view class="wait__track">
      <view class="wait__fill" :style="{ width: progress + '%' }" />
    </view>
    <text class="wait__pct">{{ progress }}%</text>
  </view>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { TRYON_WAIT_LINES, readTryOnImageUrl, writeTryOnResult } from "@/data/try-on";
import { runTryOn } from "@/lib/experience-flow";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/results/back-white.svg",
  scan: "/static/tryon/wait-scan.png",
};

const progress = ref(0);
const etaSeconds = ref(20);
const lineIndex = ref(0);
const line = ref(TRYON_WAIT_LINES[0]);
const nextUrl = ref<string>(KIOSK_PAGES.tryOnResult);
const signal = { aborted: false };
let leaveTimer: ReturnType<typeof setTimeout> | null = null;
let lineTimer: ReturnType<typeof setInterval> | null = null;

onLoad((query?: Record<string, string>) => {
  if (query?.next) {
    nextUrl.value = decodeURIComponent(query.next);
  }
  lineTimer = setInterval(() => {
    lineIndex.value = (lineIndex.value + 1) % TRYON_WAIT_LINES.length;
    line.value = TRYON_WAIT_LINES[lineIndex.value];
  }, 1400);
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
    const generation = await runTryOn(readTryOnImageUrl(), (percent, eta) => {
      if (signal.aborted) {
        return;
      }
      progress.value = Math.max(progress.value, percent);
      if (eta && eta > 0) {
        etaSeconds.value = eta;
      }
    }, signal);
    if (signal.aborted) {
      return;
    }
    writeTryOnResult(generation.resultImageUrl || "");
    progress.value = 100;
    leaveTimer = setTimeout(() => {
      uni.redirectTo({ url: nextUrl.value });
    }, 400);
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    showScreenError(error, "试戴暂时不可用，请稍后重试");
    goBackOr(KIOSK_PAGES.tryOn);
  }
}

function stop() {
  signal.aborted = true;
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
  if (lineTimer) {
    clearInterval(lineTimer);
    lineTimer = null;
  }
}

function onBack() {
  stop();
  goBackOr(KIOSK_PAGES.tryOn);
}
</script>

<style>
page {
  height: 100%;
  background: #0f1010;
}

.wait {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #0f1010;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(32 * var(--u)) 0 0;
  box-sizing: border-box;
}

.wait__bar {
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
}

.wait__scan {
  margin-top: calc(422 * var(--u));
  width: calc(200 * var(--u));
  height: calc(200 * var(--u));
}

.wait__eta {
  margin-top: calc(60 * var(--u));
  font-size: calc(40 * var(--u));
  font-weight: 500;
  color: #fff;
  text-align: center;
}

.wait__line {
  margin-top: calc(37 * var(--u));
  height: calc(45 * var(--u));
  font-size: calc(32 * var(--u));
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.wait__track {
  margin-top: calc(60 * var(--u));
  width: calc(648 * var(--u));
  height: calc(4 * var(--u));
  border-radius: calc(11 * var(--u));
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.wait__fill {
  height: 100%;
  border-radius: calc(11 * var(--u));
  background: linear-gradient(90deg, #565656, #fff);
}

.wait__pct {
  margin-top: calc(24 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}
</style>
