<template>
  <view class="scan-stage" hover-class="none" @click="onTap">
    <view v-if="!preview" class="scan-qr" :class="{ 'is-dimmed': status !== 'waiting' }">
      <image v-if="qrSrc" class="scan-qr__code" :src="qrSrc" mode="aspectFit" />
      <image class="scan-qr__corner scan-qr__corner--tr" :src="ASSETS.cornerTr" mode="aspectFit" />
      <image class="scan-qr__corner scan-qr__corner--tl" :src="ASSETS.cornerTl" mode="aspectFit" />
      <image class="scan-qr__corner scan-qr__corner--bl" :src="ASSETS.cornerTl" mode="aspectFit" />
      <image class="scan-qr__corner scan-qr__corner--br" :src="ASSETS.cornerTr" mode="aspectFit" />
    </view>
    <image v-if="preview && mediaKind !== 'video'" class="scan-stage__photo" :src="preview" mode="aspectFill" />
    <banner-shot v-else-if="preview" class="scan-stage__photo" kind="video" :src="preview" />

    <view v-if="!preview && status === 'scanned'" class="scan-status">
      <image class="scan-status__badge" :src="ASSETS.scanOk" mode="aspectFit" />
      <text class="scan-status__title">扫码成功</text>
      <text class="scan-status__desc">请在手机上选择要上传的照片</text>
    </view>
    <view
      v-if="!preview && (status === 'failed' || status === 'cancelled' || status === 'expired')"
      class="scan-status"
      @click.stop
    >
      <image class="scan-status__badge" :src="ASSETS.scanFail" mode="aspectFit" />
      <text class="scan-status__title">{{ failTitle }}</text>
      <text class="scan-status__desc">{{ failDesc }}</text>
      <view class="scan-status__btn" hover-class="none" @click="onRetry">
        <text>重新扫码</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BannerShot from "@/components/admin/banner-shot.vue";
import type { ScanStatus } from "../../lib/upload-flow";

const props = defineProps<{
  preview: string;
  status: ScanStatus;
  qrSrc?: string;
  mediaKind?: "image" | "video";
}>();

const emit = defineEmits<{
  tap: [];
  retry: [];
}>();

const ASSETS = {
  cornerTr: "/static/scan/corner-tr.svg",
  cornerTl: "/static/scan/corner-tl.svg",
  scanOk: "/static/sheet/scan-ok.svg",
  scanFail: "/static/sheet/scan-fail.svg",
};

const failTitle = computed(() => {
  if (props.status === "cancelled") {
    return "手机端已关闭";
  }
  if (props.status === "expired") {
    return "上传超时";
    // return "二维码已过期";
  }
  return "上传失败";
});
const failDesc = computed(() => {
  if (props.status === "cancelled") {
    return "请重新扫码后继续上传";
  }
  if (props.status === "expired") {
    return "请刷新二维码后重新扫码";
  }
  return "请刷新二维码，重新上传";
});

function onTap() {
  emit("tap");
}

function onRetry() {
  emit("retry");
}
</script>

<style>
.scan-stage {
  width: calc(528 * var(--u));
  height: calc(528 * var(--u));
  position: relative;
}

.scan-qr {
  width: 100%;
  height: 100%;
  position: relative;
}

.scan-qr.is-dimmed {
  opacity: 0.18;
}

.scan-status {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.scan-status__badge {
  width: calc(80 * var(--u));
  height: calc(80 * var(--u));
}

.scan-status__title {
  margin-top: calc(24 * var(--u));
  font-size: calc(36 * var(--u));
  font-weight: 700;
  color: #333;
  text-align: center;
}

.scan-status__desc {
  margin-top: calc(12 * var(--u));
  max-width: calc(400 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
  text-align: center;
}

.scan-status__btn {
  margin-top: calc(32 * var(--u));
  width: calc(200 * var(--u));
  height: calc(72 * var(--u));
  border-radius: calc(60 * var(--u));
  background: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(28 * var(--u));
  font-weight: 500;
}

.scan-qr__code {
  position: absolute;
  left: calc(64 * var(--u));
  top: calc(64 * var(--u));
  width: calc(400 * var(--u));
  height: calc(400 * var(--u));
}

.scan-qr__corner {
  position: absolute;
  width: calc(82 * var(--u));
  height: calc(82 * var(--u));
}

.scan-qr__corner--tr {
  top: 0;
  right: 0;
}

.scan-qr__corner--tl {
  top: 0;
  left: 0;
  transform: scaleX(-1);
}

.scan-qr__corner--bl {
  bottom: 0;
  left: 0;
  transform: rotate(180deg);
}

.scan-qr__corner--br {
  bottom: 0;
  right: 0;
  transform: rotate(180deg) scaleX(-1);
}

.scan-stage__photo {
  width: 100%;
  height: 100%;
  border-radius: calc(32 * var(--u));
}
</style>
