<template>
  <view class="up">
    <view class="up__bar">
      <kiosk-chip :icon="ASSETS.back" :label="editingId ? '编辑banner' : '自定义上传banner'" @click="onBack" />
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
      <view v-if="drafts.length < BANNER_MEDIA_LIMIT" class="up-plus" hover-class="none" @click="openQr">
        <image class="up-plus__icon" :src="ASSETS.plus" mode="aspectFit" />
        <text>上传轮播图</text>
      </view>
      <view v-for="(src, index) in drafts" :key="`${src}-${index}`" class="up-thumb">
        <banner-shot class="up-thumb__shot" :kind="kind" :src="src" :cover="coverOf(src)" />
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
      <view class="up-link__row">
        <text class="up-row__label">跳转链接</text>
        <input
          class="up-link__input"
          v-model="link"
          maxlength="255"
          placeholder="请输入跳转地址"
          placeholder-style="color:#989898"
          :adjust-position="false"
        />
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
        <scan-stage
          class="up-sheet__stage"
          :preview="qrPreview"
          :media-kind="kind"
          :status="qrStatus"
          :qr-src="qrSrc"
          @tap="onQrTap"
          @retry="openQr"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import BannerShot from "@/components/admin/banner-shot.vue";
import ScanStage from "@/components/upload/scan-stage.vue";
import {
  BANNER_MEDIA_LIMIT,
  isCustomBanner,
  libraryMediaFromContent,
  toBannerItem,
  type BannerKind,
  type BannerStatus,
} from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import {
  createCustomBanner,
  fetchBannerCatalog,
  patchBannerCatalog,
  patchDeviceBanner,
} from "@/lib/screen-api/banners";
import { cancelBannerUpload, issueBannerUpload, pollBannerUpload } from "@/lib/screen-api/scan";
import { isPollAborted, mapScanStatus, pollUntilTerminal, qrImageUrl } from "@/lib/scan-session";
import { showScreenError } from "@/lib/screen-http";
import type { ScanStatus } from "@/lib/upload-flow";

const ASSETS = {
  back: "/static/scan/back.svg",
  plus: "/static/tryon/plus.svg",
  close: "/static/tryon/close.svg",
};

const kind = ref<BannerKind>("image");
const status = ref<BannerStatus>("on");
const link = ref("");
const drafts = ref<string[]>([]);
const covers = ref<Record<string, string>>({});
const editingStoreAdId = ref("");
const editingConfigId = ref("");
const saving = ref(false);
const showQr = ref(false);
const qrPreview = ref("");
const qrStatus = ref<ScanStatus>("waiting");
const qrSrc = ref("");
let scanSessionId = "";
let polling = false;
const editingId = computed(() => editingStoreAdId.value || editingConfigId.value);

const hint = computed(() =>
  kind.value === "video"
    ? `可上传mp4格式的视频，最多可上传${BANNER_MEDIA_LIMIT}段，每段大小不超过50M。`
    : `最多上传 ${BANNER_MEDIA_LIMIT} 张图片，支持 JPEG、JPG、PNG 格式，单张图片大小≤10M`,
);

onLoad((query) => {
  const id = typeof query?.id === "string" ? query.id.trim() : "";
  if (id) {
    void loadForEdit(id);
  }
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
      if (drafts.value.length < BANNER_MEDIA_LIMIT) {
        drafts.value = [...drafts.value, session.assetUrl];
      }
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

function coverOf(src: string) {
  return covers.value[src] || "";
}

function removeDraft(index: number) {
  drafts.value = drafts.value.filter((_, i) => i !== index);
}

async function loadForEdit(id: string) {
  try {
    const catalog = await fetchBannerCatalog();
    const row = (catalog || []).find((item) => item.storeAdId === id || item.configId === id);
    if (!row || !isCustomBanner(row)) {
      (uni as any).$toast?.error("仅自定义 Banner 可编辑", undefined, 1000);
      goBackOr(ADMIN_PAGES.banner);
      return;
    }
    const item = toBannerItem(row);
    editingStoreAdId.value = item.storeAdId || item.id;
    editingConfigId.value = item.configId || "";
    const media = libraryMediaFromContent(item.contentJson, item.image, item.kind);
    drafts.value = media.map((row) => row.src);
    covers.value = Object.fromEntries(media.filter((row) => row.src && row.cover).map((row) => [row.src, row.cover]));
    kind.value = item.kind;
    status.value = item.inUse ? item.status : "off";
    link.value = !item.link || item.link === "不跳转" ? "" : item.link;
  } catch (error) {
    showScreenError(error, "轮播图加载失败");
    goBackOr(ADMIN_PAGES.banner);
  }
}

async function onSave() {
  if (!drafts.value.length) {
    uni.showToast({ title: "请先上传轮播图", icon: "none" });
    return;
  }
  if (saving.value) {
    return;
  }
  saving.value = true;
  const linkUrl = !link.value.trim() || link.value.trim() === "不跳转" ? "" : link.value.trim();
  const openDeviceConfig = status.value === "on" ? "yes" : "no";
  const displayForm = kind.value === "video" ? "video_dynamic" : "image_scroll";
  const patch = {
    openDeviceConfig: openDeviceConfig as "yes" | "no",
    assetUrls: drafts.value,
    linkUrl,
    displayForm,
  };
  try {
    if (editingStoreAdId.value) {
      await patchBannerCatalog(editingStoreAdId.value, patch);
    } else if (editingConfigId.value) {
      await patchDeviceBanner(editingConfigId.value, patch);
    } else {
      await createCustomBanner({
        assetUrls: drafts.value,
        linkUrl,
        displayForm,
        openDeviceConfig,
      });
    }
    (uni as any).$toast?.success("保存成功", undefined, 1000);
    setTimeout(() => goBackOr(ADMIN_PAGES.banner), 400);
  } catch (error) {
    showScreenError(error, "保存失败");
  } finally {
    saving.value = false;
  }
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

.up-link__input {
  flex: 1;
  min-width: 0;
  height: calc(80 * var(--u));
  margin-left: calc(32 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
  text-align: right;
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
