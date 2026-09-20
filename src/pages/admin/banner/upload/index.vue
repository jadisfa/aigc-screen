<template>
  <view class="up">
    <view class="up__bar">
      <kiosk-chip :icon="ASSETS.back" label="自定义上传banner" @click="onBack" />
    </view>

    <view class="up-tabs">
      <view
        class="up-tabs__item"
        :class="{ 'is-on': kind === 'image' }"
        hover-class="none"
        @click="kind = 'image'"
      >
        <text>图片轮播</text>
      </view>
      <view
        class="up-tabs__item"
        :class="{ 'is-on': kind === 'video' }"
        hover-class="none"
        @click="kind = 'video'"
      >
        <text>视频轮播</text>
      </view>
    </view>

    <text class="up__hint">{{ hint }}</text>

    <view class="up-grid">
      <view v-if="drafts.length < 5" class="up-plus" hover-class="none" @click="openQr">
        <image class="up-plus__icon" :src="ASSETS.plus" mode="aspectFit" />
        <text>上传轮播图</text>
      </view>
      <view v-for="(src, index) in drafts" :key="`${src}-${index}`" class="up-thumb">
        <image class="up-thumb__shot" :src="src" mode="aspectFill" />
        <image class="up-thumb__x" :src="ASSETS.close" mode="aspectFit" @click.stop="removeDraft(index)" />
      </view>
    </view>

    <view class="up-row">
      <text class="up-row__label">状态</text>
      <view class="up-row__opts">
        <view class="up-opt" :class="{ 'is-on': status === 'on' }" hover-class="none" @click="status = 'on'">
          <text>立即上架</text>
        </view>
        <view class="up-opt" :class="{ 'is-on': status === 'off' }" hover-class="none" @click="status = 'off'">
          <text>下架</text>
        </view>
      </view>
    </view>

    <view class="up-link">
      <view class="up-link__row" hover-class="none" @click="pickLink">
        <text class="up-row__label">跳转链接</text>
        <view class="up-link__value">
          <text>{{ link }}</text>
          <image class="up-link__chev" :src="ASSETS.chevron" mode="aspectFit" />
        </view>
      </view>
      <text class="up-link__hint">{{
        kind === "video" ? "批量上传的轮播视频将共用同一个跳转链接" : "批量上传的轮播图片将共用同一个跳转链接"
      }}</text>
    </view>

    <view class="up-foot">
      <view class="up-foot__btn" hover-class="none" @click="onSave">
        <text>保存</text>
      </view>
    </view>

    <view v-if="showQr" class="up-mask" hover-class="none" @click="closeQr">
      <view class="up-sheet" @click.stop>
        <image class="up-sheet__close" :src="ASSETS.close" mode="aspectFit" @click="closeQr" />
        <text class="up-sheet__title">扫码上传banner轮播图</text>
        <text class="up-sheet__lead">{{ hint }}</text>
        <scan-stage class="up-sheet__stage" :preview="qrPreview" :status="qrStatus" :qr-src="qrSrc" @tap="onQrTap" @retry="openQr" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import ScanStage from "@/components/upload/scan-stage.vue";
import { LINK_OPTIONS, type BannerKind, type BannerStatus } from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { cancelBannerUpload, issueBannerUpload, pollBannerUpload } from "@/lib/screen-api/scan";
import { isPollAborted, mapScanStatus, pollUntilTerminal, qrImageUrl } from "@/lib/scan-session";
import { showScreenError } from "@/lib/screen-http";
import type { ScanStatus } from "@/lib/upload-flow";

const ASSETS = {
  back: "/static/scan/back.svg",
  plus: "/static/tryon/plus.svg",
  close: "/static/tryon/close.svg",
  chevron: "/static/admin/chevron.svg",
};

const kind = ref<BannerKind>("image");
const status = ref<BannerStatus>("on");
const link = ref(LINK_OPTIONS[0]);
const drafts = ref<string[]>([]);
const showQr = ref(false);
const qrPreview = ref("");
const qrStatus = ref<ScanStatus>("waiting");
const qrSrc = ref("");
let scanSessionId = "";
let polling = false;

const hint = computed(() =>
  kind.value === "video"
    ? "可上传mp4格式的视频，最多可上传5段，每段大小不超过50M。"
    : "最多上传 5 张图片，支持 JPEG、JPG、PNG 格式，单张图片大小≤10M",
);

onLoad(() => {
  // 自定义上传走扫码会话，服务端在 H5 上传成功后写入本机配置
});

onUnload(() => {
  stopScan();
});

function onBack() {
  goBackOr(ADMIN_PAGES.banner);
}

async function openQr() {
  resetQr();
  showQr.value = true;
  try {
    const issued = await issueBannerUpload();
    scanSessionId = issued.sessionId;
    qrSrc.value = issued.h5Url ? await qrImageUrl(issued.h5Url) : "";
    polling = true;
    const session = await pollUntilTerminal(() => pollBannerUpload(issued.sessionId), {
      expiresAt: issued.expiresAt,
      shouldContinue: () => polling,
      onTick: (tick) => {
        if (!polling) {
          return;
        }
        if (mapScanStatus(tick.status) === "scanned") {
          qrStatus.value = "scanned";
        }
      },
    });
    if (!polling) {
      return;
    }
    if (session.status === "ready" && session.assetUrl) {
      qrPreview.value = session.assetUrl;
      if (drafts.value.length < 5) {
        drafts.value = [...drafts.value, session.assetUrl];
      }
      uni.showToast({ title: "已上传", icon: "none" });
      showQr.value = false;
      resetQr();
      scanSessionId = "";
      return;
    }
    qrStatus.value = mapScanStatus(session.status);
    scanSessionId = "";
  } catch (error) {
    if (!polling || isPollAborted(error)) {
      return;
    }
    qrStatus.value = "failed";
    showScreenError(error, "出码失败");
  }
}

function closeQr() {
  stopScan();
  showQr.value = false;
  resetQr();
}

function resetQr() {
  qrPreview.value = "";
  qrStatus.value = "waiting";
  qrSrc.value = "";
}

function stopScan() {
  polling = false;
  if (scanSessionId) {
    cancelBannerUpload(scanSessionId).catch(() => undefined);
    scanSessionId = "";
  }
}

function onQrTap() {
  // 二维码由出码接口生成，点击不模拟扫码
}

function removeDraft(index: number) {
  drafts.value = drafts.value.filter((_, i) => i !== index);
}

function pickLink() {
  uni.showActionSheet({
    itemList: LINK_OPTIONS,
    success: (res) => {
      const picked = LINK_OPTIONS[res.tapIndex];
      if (picked) {
        link.value = picked;
      }
    },
  });
}

function onSave() {
  if (!drafts.value.length) {
    uni.showToast({ title: "请先上传轮播图", icon: "none" });
    return;
  }
  uni.showToast({ title: "已保存", icon: "none" });
  setTimeout(() => {
    goBackOr(ADMIN_PAGES.banner);
  }, 400);
}
</script>

<style>
page {
  background: #fff;
}

.up {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(180 * var(--u));
  box-sizing: border-box;
}

.up__bar {
  height: calc(80 * var(--u));
}

.up-tabs {
  margin-top: calc(32 * var(--u));
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  padding: 0 calc(6 * var(--u));
  background: #f5f6f8;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  box-sizing: border-box;
}

.up-tabs__item {
  flex: 1;
  height: calc(68 * var(--u));
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
}

.up-tabs__item.is-on {
  background: #191919;
  color: #fff;
}

.up__hint {
  display: block;
  margin-top: calc(40 * var(--u));
  font-size: calc(30 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  color: #777;
}

.up-grid {
  margin-top: calc(40 * var(--u));
  padding-bottom: calc(40 * var(--u));
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.up-plus {
  width: calc(312 * var(--u));
  height: calc(417 * var(--u));
  background: #f2f3f5;
  border-radius: calc(32 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(24 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #777;
}

.up-plus__icon {
  width: calc(46 * var(--u));
  height: calc(46 * var(--u));
}

.up-thumb {
  position: relative;
  width: calc(312 * var(--u));
  height: calc(417 * var(--u));
}

.up-thumb__shot {
  width: 100%;
  height: 100%;
  border-radius: calc(32 * var(--u));
}

.up-thumb__x {
  position: absolute;
  top: calc(24 * var(--u));
  right: calc(24 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}

.up-row {
  padding: calc(40 * var(--u)) 0;
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.up-row__label {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.up-row__opts {
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.up-opt {
  width: calc(240 * var(--u));
  height: calc(80 * var(--u));
  background: #ebf1f4;
  border-radius: calc(24 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
}

.up-opt.is-on {
  background: #191919;
  color: #fff;
}

.up-link {
  margin-top: calc(40 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(16 * var(--u));
}

.up-link__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.up-link__value {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.up-link__chev {
  width: calc(10 * var(--u));
  height: calc(20 * var(--u));
}

.up-link__hint {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
}

.up-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  padding: calc(24 * var(--u)) calc(48 * var(--u));
  background: #fff;
  box-sizing: border-box;
}

.up-foot__btn {
  height: calc(100 * var(--u));
  background: #191919;
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #fff;
}

.up-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.up-sheet {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  height: calc(1080 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.up-sheet__close {
  position: absolute;
  top: calc(40 * var(--u));
  right: calc(40 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}

.up-sheet__title {
  margin-top: calc(132 * var(--u));
  font-size: calc(56 * var(--u));
  font-weight: 900;
  line-height: calc(72 * var(--u));
  letter-spacing: calc(5.6 * var(--u));
  color: #333;
}

.up-sheet__lead {
  margin-top: calc(32 * var(--u));
  padding: 0 calc(48 * var(--u));
  font-size: calc(30 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  color: #333;
  text-align: center;
}

.up-sheet__stage {
  margin-top: calc(40 * var(--u));
}
</style>
