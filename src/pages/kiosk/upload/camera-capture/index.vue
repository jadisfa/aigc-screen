<template>
  <view class="cam">
    <view id="kioskCamLive" class="cam__live">
      <!-- #ifdef APP-PLUS || MP-WEIXIN -->
      <camera
        v-if="phase === 'idle' || phase === 'countdown'"
        id="kioskCamera"
        class="cam__sensor"
        device-position="front"
        flash="off"
      />
      <!-- #endif -->
    </view>
    <image
      v-if="photo && phase !== 'idle' && phase !== 'countdown'"
      class="cam__shot"
      :src="photo"
      mode="aspectFill"
    />

    <view v-if="phase === 'idle' || phase === 'countdown'" class="cam__veil">
      <view class="cam__veil-t" />
      <view class="cam__veil-mid">
        <view class="cam__veil-l" />
        <view class="cam__hole">
          <view class="cam__fillet cam__fillet--tl" />
          <view class="cam__fillet cam__fillet--tr" />
          <view class="cam__fillet cam__fillet--bl" />
          <view class="cam__fillet cam__fillet--br" />
        </view>
        <view class="cam__veil-r" />
      </view>
      <view class="cam__veil-b" />
    </view>

    <view class="cam__close" hover-class="none" @click="onClose">
      <image class="cam__close-icon" :src="ASSETS.close" mode="aspectFit" />
    </view>

    <text v-if="(phase === 'idle' || phase === 'countdown') && cameraFailed" class="cam__cam-error">
      无法打开摄像头，请检查权限后重试
    </text>

    <text v-if="phase === 'idle' || phase === 'countdown'" class="cam__hint">
      {{ flow.cameraHint }}
    </text>

    <view v-if="phase === 'idle' || phase === 'countdown'" class="cam__frame">
      <image class="cam__corner cam__corner--tl" :src="ASSETS.frameTl" mode="aspectFit" />
      <image class="cam__corner cam__corner--tr" :src="ASSETS.frameTr" mode="aspectFit" />
      <image class="cam__corner cam__corner--bl" :src="ASSETS.frameTl" mode="aspectFit" />
      <image class="cam__corner cam__corner--br" :src="ASSETS.frameTr" mode="aspectFit" />
    </view>

    <view v-if="phase === 'idle'" class="cam__shutter" hover-class="none" @click="startCountdown">
      <image class="cam__shutter-icon" :src="ASSETS.shutter" mode="aspectFit" />
    </view>

    <view v-if="phase === 'countdown'" class="cam__count">
      <image class="cam__count-ring" :src="ASSETS.countdownRing" mode="aspectFit" />
      <text class="cam__count-num">{{ countdown }}</text>
    </view>

    <view v-if="phase === 'preview' || phase === 'recognizing' || phase === 'failed'" class="cam__review">
      <view class="cam__circle" hover-class="none" @click="retake">
        <image class="cam__circle-icon" :src="ASSETS.retake" mode="aspectFit" />
      </view>
      <view class="cam__circle" hover-class="none" @click="confirmPhoto">
        <image class="cam__circle-icon" :src="ASSETS.confirm" mode="aspectFit" />
      </view>
    </view>
    <view v-if="phase === 'preview' || phase === 'recognizing' || phase === 'failed'" class="cam__review-labels">
      <text>重拍</text>
      <text>确定</text>
    </view>

    <text v-if="phase === 'idle' || phase === 'countdown'" class="cam__tip">
      点击拍摄，5 秒倒计时自动拍摄
    </text>

    <view v-if="phase === 'recognizing'" class="cam__mask">
      <view class="cam__dialog">
        <image class="cam__dialog-icon" :src="ASSETS.recognize" mode="aspectFit" />
        <text class="cam__dialog-title">图片识别中，请稍等……</text>
        <view class="cam__bar">
          <view class="cam__bar-fill" :style="{ width: progress + '%' }" />
        </view>
        <text class="cam__dialog-pct">{{ progress }}%</text>
      </view>
    </view>

    <view v-if="phase === 'failed'" class="cam__fail-mask">
      <view class="cam__sheet">
        <view class="cam__fail-thumb">
          <image class="cam__fail-img" :src="photo" mode="aspectFill" />
          <view class="cam__fail-scrim">
            <image class="cam__fail-badge" :src="ASSETS.failBadge" mode="aspectFit" />
            <text class="cam__fail-label">识别失败</text>
          </view>
        </view>
        <text class="cam__fail-msg">图片不清晰，请调整光线后重新拍摄</text>
        <view class="cam__fail-btn" hover-class="none" @click="retake">
          <text>重新拍照</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { onHide, onLoad, onReady, onShow, onUnload } from "@dcloudio/uni-app";
import { goBackOr } from "@/lib/kiosk-routes";
import { parseUploadIntent, scanUploadUrl, UPLOAD_FLOWS, writePreview, type UploadIntent } from "@/lib/upload-flow";
import { useH5Camera } from "@/lib/use-h5-camera";

type Phase = "idle" | "countdown" | "preview" | "recognizing" | "failed";

const ASSETS = {
  frameTl: "/static/camera/frame-tl.svg",
  frameTr: "/static/camera/frame-tr.svg",
  close: "/static/camera/close.svg",
  shutter: "/static/camera/shutter.svg",
  countdownRing: "/static/camera/countdown-ring.svg",
  retake: "/static/camera/retake.svg",
  confirm: "/static/camera/confirm.svg",
  recognize: "/static/camera/recognize-icon.png",
  failBadge: "/static/camera/fail-badge.svg",
};

const intent = ref<UploadIntent>("outfit");
const flow = computed(() => UPLOAD_FLOWS[intent.value]);
const phase = ref<Phase>("idle");
const countdown = ref(5);
const progress = ref(0);
const photo = ref("");
const h5 = useH5Camera("#kioskCamLive");
const cameraFailed = h5.failed;

onLoad((query?: Record<string, string>) => {
  intent.value = parseUploadIntent(query);
});

let timer: ReturnType<typeof setInterval> | null = null;
let recognizeTimer: ReturnType<typeof setInterval> | null = null;

onReady(() => {
  // #ifdef H5
  void h5.start();
  // #endif
});

onShow(() => {
  // #ifdef H5
  void h5.start();
  // #endif
});

onHide(() => {
  stopCountdown();
});

onUnload(() => {
  teardown();
});

onUnmounted(() => {
  teardown();
});

function teardown() {
  stopCountdown();
  if (recognizeTimer) {
    clearInterval(recognizeTimer);
    recognizeTimer = null;
  }
  h5.stop();
}

function onClose() {
  teardown();
  goBackOr(scanUploadUrl(intent.value));
}

function startCountdown() {
  if (phase.value !== "idle") {
    return;
  }
  countdown.value = 5;
  phase.value = "countdown";
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      stopCountdown();
      void capture();
    }
  }, 1000);
}

function stopCountdown() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function retake() {
  stopCountdown();
  progress.value = 0;
  photo.value = "";
  phase.value = "idle";
}

function confirmPhoto() {
  if (phase.value !== "preview" || !photo.value) {
    return;
  }
  if (flow.value.skipRecognize) {
    writePreview(intent.value, photo.value);
    goBackOr(scanUploadUrl(intent.value));
    return;
  }
  phase.value = "recognizing";
  progress.value = 0;
  const started = Date.now();
  if (recognizeTimer) {
    clearInterval(recognizeTimer);
  }
  recognizeTimer = setInterval(() => {
    const next = Math.min(100, Math.round(((Date.now() - started) / 1800) * 100));
    progress.value = next;
    if (next >= 100 && recognizeTimer) {
      clearInterval(recognizeTimer);
      recognizeTimer = null;
      writePreview(intent.value, photo.value);
      goBackOr(scanUploadUrl(intent.value));
    }
  }, 80);
}

async function capture() {
  // #ifdef APP-PLUS
  await captureApp();
  // #endif
  // #ifdef H5
  captureH5();
  // #endif
}

function captureApp() {
  return new Promise<void>((resolve) => {
    const ctx = uni.createCameraContext();
    ctx.takePhoto({
      quality: "high",
      success: (res) => {
        photo.value = res.tempImagePath;
        phase.value = "preview";
        resolve();
      },
      fail: () => {
        photo.value = "";
        phase.value = "preview";
        resolve();
      },
    });
  });
}

function captureH5() {
  photo.value = h5.capture("");
  phase.value = "preview";
}

</script>

<style>
page {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: #000;
}

/* #ifdef H5 */
html,
body,
uni-app,
uni-page,
uni-page-wrapper,
uni-page-body {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #000;
}
/* #endif */

.cam {
  --u: min(calc(100vw / 1080), calc(100vh / 1920));
  --ox: calc((100vw - 1080 * var(--u)) / 2);
  --oy: calc((100vh - 1920 * var(--u)) / 2);
  --frame-top: calc(var(--oy) + 361 * var(--u));
  --frame-side: calc(var(--ox) + 80 * var(--u));
  --frame-size: calc(920 * var(--u));
  --frame-radius: calc(100 * var(--u));
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: #000;
  position: relative;
  overflow: hidden;
}

.cam__live,
.cam__sensor,
.cam__shot,
.cam__video {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  background: #000;
}

.cam__shot {
  z-index: 1;
  object-fit: cover;
  object-position: center;
}

.cam__video {
  object-fit: cover;
  object-position: center;
}

.cam__veil {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.cam__veil-t {
  width: 100%;
  height: var(--frame-top);
  background: rgba(0, 0, 0, 0.5);
}

.cam__veil-b {
  flex: 1;
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.cam__veil-mid {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: var(--frame-size);
}

.cam__veil-l {
  width: var(--frame-side);
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.cam__veil-r {
  flex: 1;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.cam__hole {
  position: relative;
  width: var(--frame-size);
  height: var(--frame-size);
  overflow: visible;
}

.cam__fillet {
  position: absolute;
  width: var(--frame-radius);
  height: var(--frame-radius);
}

.cam__fillet--tl {
  top: 0;
  left: 0;
  background: radial-gradient(circle at 100% 100%, transparent var(--frame-radius), rgba(0, 0, 0, 0.5) var(--frame-radius));
}

.cam__fillet--tr {
  top: 0;
  right: 0;
  background: radial-gradient(circle at 0 100%, transparent var(--frame-radius), rgba(0, 0, 0, 0.5) var(--frame-radius));
}

.cam__fillet--bl {
  bottom: 0;
  left: 0;
  background: radial-gradient(circle at 100% 0, transparent var(--frame-radius), rgba(0, 0, 0, 0.5) var(--frame-radius));
}

.cam__fillet--br {
  bottom: 0;
  right: 0;
  background: radial-gradient(circle at 0 0, transparent var(--frame-radius), rgba(0, 0, 0, 0.5) var(--frame-radius));
}

.cam__close {
  position: absolute;
  left: calc(var(--ox) + 80 * var(--u));
  top: calc(var(--oy) + 96 * var(--u));
  width: calc(48 * var(--u));
  height: calc(48 * var(--u));
  z-index: 4;
}

.cam__close-icon {
  position: absolute;
  left: calc(-3 * var(--u));
  top: calc(-3 * var(--u));
  width: calc(54 * var(--u));
  height: calc(54 * var(--u));
}

.cam__hint {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--oy) + 251 * var(--u));
  z-index: 4;
  text-align: center;
  color: #fff;
  font-size: calc(40 * var(--u));
  font-weight: 500;
  letter-spacing: calc(4 * var(--u));
}

.cam__cam-error {
  position: absolute;
  left: var(--frame-side);
  top: calc(var(--frame-top) + var(--frame-size) / 2);
  width: var(--frame-size);
  z-index: 4;
  text-align: center;
  color: #fff;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.cam__frame {
  position: absolute;
  left: var(--frame-side);
  top: var(--frame-top);
  width: var(--frame-size);
  height: var(--frame-size);
  z-index: 3;
  pointer-events: none;
}

.cam__corner {
  position: absolute;
  width: calc(220 * var(--u));
  height: calc(220 * var(--u));
}

.cam__corner--tl {
  top: 0;
  left: 0;
}

.cam__corner--tr {
  top: 0;
  right: 0;
  transform: scaleY(-1) rotate(180deg);
}

.cam__corner--bl {
  bottom: 0;
  left: 0;
  transform: scaleY(-1);
}

.cam__corner--br {
  bottom: 0;
  right: 0;
  transform: rotate(180deg);
}

.cam__shutter,
.cam__count {
  position: absolute;
  left: calc(var(--ox) + 429 * var(--u));
  top: calc(var(--oy) + 1481 * var(--u));
  width: calc(222 * var(--u));
  height: calc(222 * var(--u));
  z-index: 4;
}

.cam__shutter-icon,
.cam__count-ring {
  width: 100%;
  height: 100%;
}

.cam__count-num {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(41 * var(--u));
  text-align: center;
  font-size: calc(100 * var(--u));
  font-weight: 500;
  letter-spacing: calc(10 * var(--u));
  color: #333;
}

.cam__tip {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--oy) + 1743 * var(--u));
  z-index: 4;
  text-align: center;
  color: #fff;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.cam__review {
  position: absolute;
  left: calc(var(--ox) + 258 * var(--u));
  top: calc(var(--oy) + 1481 * var(--u));
  width: calc(564 * var(--u));
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  z-index: 4;
}

.cam__circle,
.cam__circle-icon {
  width: calc(222 * var(--u));
  height: calc(222 * var(--u));
}

.cam__review-labels {
  position: absolute;
  left: calc(var(--ox) + 258 * var(--u));
  top: calc(var(--oy) + 1727 * var(--u));
  width: calc(564 * var(--u));
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  z-index: 4;
  color: #fff;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.cam__review-labels text {
  width: calc(222 * var(--u));
  text-align: center;
}

.cam__mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cam__dialog {
  width: calc(816 * var(--u));
  height: calc(552 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cam__dialog-icon {
  width: calc(140 * var(--u));
  height: calc(140 * var(--u));
  margin-top: calc(88 * var(--u));
}

.cam__dialog-title {
  margin-top: calc(32 * var(--u));
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.cam__bar {
  margin-top: calc(56 * var(--u));
  width: calc(636 * var(--u));
  height: calc(10 * var(--u));
  border-radius: calc(17 * var(--u));
  background: rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.cam__bar-fill {
  height: 100%;
  background: #191919;
  border-radius: calc(17 * var(--u));
}

.cam__dialog-pct {
  margin-top: calc(40 * var(--u));
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.cam__fail-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 6;
}

.cam__sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(1008 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cam__fail-thumb {
  position: relative;
  margin-top: calc(140 * var(--u));
  width: calc(360 * var(--u));
  height: calc(360 * var(--u));
  border-radius: calc(60 * var(--u));
  overflow: hidden;
}

.cam__fail-img,
.cam__fail-scrim {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}

.cam__fail-scrim {
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
}

.cam__fail-badge {
  width: calc(40 * var(--u));
  height: calc(40 * var(--u));
}

.cam__fail-label {
  color: #fff;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.cam__fail-msg {
  margin-top: calc(60 * var(--u));
  font-size: calc(40 * var(--u));
  font-weight: 500;
  color: #333;
}

.cam__fail-btn {
  margin-top: calc(76 * var(--u));
  width: calc(700 * var(--u));
  height: calc(120 * var(--u));
  border-radius: calc(60 * var(--u));
  background: #191919;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(32 * var(--u));
  font-weight: 700;
}
</style>
