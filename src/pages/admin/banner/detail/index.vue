<template>
  <view class="dt">
    <view class="dt__bar">
      <kiosk-chip :icon="ASSETS.back" :label="item?.title || '轮播图详情'" @click="onBack" />
    </view>

    <text v-if="editing" class="dt-edit-hint">{{ editHint }}</text>

    <view v-if="item && !editing" class="dt-grid">
      <view
        v-for="(media, index) in images"
        :key="`${media.src}-${index}`"
        class="dt-card"
        hover-class="none"
        @click="preview = media.src"
      >
        <banner-shot class="dt-card__shot" :kind="item.kind" :src="media.src" :cover="media.cover" />
      </view>
    </view>

    <view v-else-if="item && editing" class="dt-edit-grid">
      <view v-if="canAdd" class="dt-plus" hover-class="none" @click="openQr">
        <image class="dt-plus__icon" :src="ASSETS.plus" mode="aspectFit" />
        <text>上传轮播图</text>
      </view>
      <view
        v-for="(src, index) in drafts"
        :key="`${src}-${index}`"
        class="dt-thumb"
        :class="{ 'is-dragging': activeIndex === index }"
        :style="getDragStyle(index)"
        @touchstart="onTouchStart(index, $event)"
        @touchmove="onTouchMove($event)"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
        @click="onDraftClick(src)"
      >
        <banner-shot class="dt-thumb__shot" :kind="item.kind" :src="src" :cover="coverOf(src)" />
        <image
          class="dt-thumb__x"
          :src="ASSETS.close"
          mode="aspectFit"
          @touchstart.stop
          @click.stop="removeDraft(index)"
        />
      </view>
    </view>

    <view v-if="item" class="dt-meta">
      <view class="dt-row">
        <text class="dt-row__label">类型</text>
        <text class="dt-row__value">{{ kindLabel }}</text>
      </view>
      <view class="dt-row">
        <text class="dt-row__label">跳转链接</text>
        <text class="dt-row__value">{{ item.link || "不跳转" }}</text>
      </view>
      <text class="dt-hint">{{
        item.kind === "video" ? "轮播视频共用同一个跳转链接" : "轮播图片共用同一个跳转链接"
      }}</text>
    </view>

    <view v-if="item" class="dt-foot">
      <template v-if="editing">
        <view class="dt-foot__ghost" hover-class="none" @click="cancelEdit">
          <text>取消</text>
        </view>
        <view class="dt-foot__solid" hover-class="none" @click="onSave">
          <text>保存</text>
        </view>
      </template>
      <template v-else>
        <view v-if="canEdit" class="dt-foot__ghost" hover-class="none" @click="onEdit">
          <text>编辑</text>
        </view>
        <view class="dt-foot__solid" hover-class="none" @click="onToggleList">
          <text>{{ listed ? "下架" : "立即上架" }}</text>
        </view>
      </template>
    </view>

    <view v-if="preview" class="dt-mask" hover-class="none" @click="preview = ''">
      <view class="dt-preview" @click.stop>
        <video
          v-if="item?.kind === 'video'"
          class="dt-preview__shot"
          :src="preview"
          :poster="previewCover"
          :controls="true"
          object-fit="contain"
        />
        <image v-else class="dt-preview__shot" :src="preview" mode="aspectFill" />
      </view>
      <image class="dt-preview__close" :src="ASSETS.close" mode="aspectFit" @click.stop="preview = ''" />
    </view>

    <view v-if="showQr" class="dt-qr-mask" hover-class="none" @click="closeQr">
      <view class="dt-sheet" @click.stop>
        <image class="dt-sheet__close" :src="ASSETS.close" mode="aspectFit" @click="closeQr" />
        <text class="dt-sheet__title">扫码上传banner轮播图</text>
        <text class="dt-sheet__lead">{{ editHint }}</text>
        <scan-stage
          class="dt-sheet__stage"
          :preview="qrPreview"
          :media-kind="item?.kind"
          :status="qrStatus"
          :qr-src="qrSrc"
          @tap="onQrTap"
          @retry="openQr"
        />
      </view>
    </view>
    <kiosk-toast />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import BannerShot from "@/components/admin/banner-shot.vue";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";
import ScanStage from "@/components/upload/scan-stage.vue";
import { BANNER_MEDIA_LIMIT, libraryMediaFromContent, toBannerItem, type BannerItem } from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { applyBannerCatalog, fetchBannerCatalog, patchBannerCatalog, patchDeviceBanner } from "@/lib/screen-api/banners";
import { cancelBannerUpload, issueBannerUpload, pollBannerUpload } from "@/lib/screen-api/scan";
import { isPollAborted, mapScanStatus, pollUntilTerminal, qrImageUrl } from "@/lib/scan-session";
import { showScreenError } from "@/lib/screen-http";
import type { ScanStatus } from "@/lib/upload-flow";

const ASSETS = {
  back: "/static/scan/back.svg",
  plus: "/static/tryon/plus.svg",
  close: "/static/tryon/close.svg",
};

const COLS = 3;
const CELL_WIDTH_U = 312;
const CELL_HEIGHT_U = 417;
const GAP_U = 24;
const LONG_PRESS = 300;

const storeAdId = ref("");
const item = ref<BannerItem | null>(null);
const preview = ref("");
const acting = ref(false);
const editing = ref(false);
const saving = ref(false);
const drafts = ref<string[]>([]);
const covers = ref<Record<string, string>>({});

const showQr = ref(false);
const qrPreview = ref("");
const qrStatus = ref<ScanStatus>("waiting");
const qrSrc = ref("");
let scanSessionId = "";
let polling = false;

const images = computed(() =>
  item.value ? libraryMediaFromContent(item.value.contentJson, item.value.image, item.value.kind) : [],
);
const previewCover = computed(() => images.value.find((media) => media.src === preview.value)?.cover || "");
const kindLabel = computed(() => (item.value?.kind === "video" ? "视频轮播" : "图片轮播"));
const listed = computed(() => Boolean(item.value?.inUse && item.value.status === "on"));
const canEdit = computed(() => Boolean(item.value && !item.value.official));
const canAdd = computed(() => drafts.value.length < BANNER_MEDIA_LIMIT);
const editHint = computed(() => {
  const kind = item.value?.kind === "video" ? "视频" : "图片";
  return `长按${kind}拖动调整顺序，最多${BANNER_MEDIA_LIMIT}个（${drafts.value.length}/${BANNER_MEDIA_LIMIT}）`;
});

const grid = ref({
  cellWidth: 0,
  cellHeight: 0,
  gapX: 0,
  gapY: 0,
  columns: COLS,
});
const activeIndex = ref(-1);
const dragX = ref(0);
const dragY = ref(0);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let touchStartX = 0;
let touchStartY = 0;
let moved = false;
let areaRect = { left: 0, top: 0 };

onLoad((query?: Record<string, string>) => {
  storeAdId.value = query?.id || "";
});

onShow(() => {
  if (!editing.value) {
    loadDetail();
  }
});

onUnload(() => {
  stopScan();
});

async function loadDetail() {
  const id = storeAdId.value;
  if (!id) {
    (uni as any).$toast?.error("轮播图不存在", undefined, 1000);
    goBackOr(ADMIN_PAGES.banner);
    return;
  }
  try {
    const catalog = await fetchBannerCatalog();
    const found = (catalog || []).map(toBannerItem).find((row) => (row.storeAdId || row.id) === id);
    if (!found) {
      (uni as any).$toast?.error("轮播图不存在", undefined, 1000);
      goBackOr(ADMIN_PAGES.banner);
      return;
    }
    item.value = found;
  } catch (error) {
    showScreenError(error, "轮播图详情加载失败");
  }
}

function onBack() {
  if (editing.value) {
    cancelEdit();
    return;
  }
  goBackOr(ADMIN_PAGES.banner);
}

function coverOf(src: string) {
  return covers.value[src] || "";
}

function rememberCovers(media: { src: string; cover: string }[]) {
  const next = { ...covers.value };
  media.forEach((row) => {
    if (row.src && row.cover) {
      next[row.src] = row.cover;
    }
  });
  covers.value = next;
}

function onEdit() {
  if (!canEdit.value || !item.value) {
    return;
  }
  rememberCovers(images.value);
  drafts.value = images.value.map((media) => media.src).filter(Boolean);
  editing.value = true;
  preview.value = "";
  nextTick(() => initGrid());
}

function cancelEdit() {
  stopScan();
  showQr.value = false;
  editing.value = false;
  drafts.value = [];
  activeIndex.value = -1;
}

async function onSave() {
  const current = item.value;
  const id = current?.storeAdId || current?.id;
  if (!current || !id || saving.value) {
    return;
  }
  if (!drafts.value.length) {
    uni.showToast({ title: "请至少保留 1 个素材", icon: "none" });
    return;
  }
  saving.value = true;
  try {
    const saved = await patchBannerCatalog(id, {
      assetUrls: drafts.value,
      linkUrl: !current.link || current.link === "不跳转" ? "" : current.link,
      displayForm: current.kind === "video" ? "video_dynamic" : "image_scroll",
    });
    item.value = toBannerItem(saved);
    editing.value = false;
    drafts.value = [];
    (uni as any).$toast?.success("保存成功", undefined, 1000);
  } catch (error) {
    showScreenError(error, "保存失败");
  } finally {
    saving.value = false;
  }
}

async function onToggleList() {
  const current = item.value;
  if (!current || acting.value || editing.value) {
    return;
  }
  acting.value = true;
  try {
    if (listed.value) {
      if (!current.configId) {
        return;
      }
      await patchDeviceBanner(current.configId, { openDeviceConfig: "no" });
      (uni as any).$toast?.success("下架成功", undefined, 1000);
    } else if (current.inUse && current.configId) {
      await patchDeviceBanner(current.configId, { openDeviceConfig: "yes" });
      (uni as any).$toast?.success("上架成功", undefined, 1000);
    } else {
      await applyBannerCatalog(current.storeAdId || current.id, "yes");
      (uni as any).$toast?.success("上架成功", undefined, 1000);
    }
    preview.value = "";
    setTimeout(() => goBackOr(ADMIN_PAGES.banner), 1000);
  } catch (error) {
    showScreenError(error, listed.value ? "下架失败" : "上架失败");
  } finally {
    acting.value = false;
  }
}

function getUnit() {
  const sys = uni.getSystemInfoSync();
  const screenWidth = sys.windowWidth || sys.screenWidth || 375;
  return Math.min(screenWidth, 1080) / 1080;
}

function initGrid() {
  const u = getUnit();
  grid.value = {
    cellWidth: CELL_WIDTH_U * u,
    cellHeight: CELL_HEIGHT_U * u,
    gapX: GAP_U * u,
    gapY: GAP_U * u,
    columns: COLS,
  };
}

function getDragStyle(index: number) {
  if (activeIndex.value !== index) {
    return {};
  }
  return {
    transform: `translate3d(${dragX.value}px, ${dragY.value}px, 0)`,
    transition: "none",
    zIndex: 10,
  };
}

function onDraftClick(src: string) {
  if (activeIndex.value > -1 || moved) {
    return;
  }
  preview.value = src;
}

function onTouchStart(index: number, e: any) {
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) {
    return;
  }
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  moved = false;
  dragX.value = 0;
  dragY.value = 0;
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  uni.createSelectorQuery()
    .select(".dt-edit-grid")
    .boundingClientRect((rect: any) => {
      if (rect) {
        areaRect.left = rect.left;
        areaRect.top = rect.top;
      }
    })
    .exec();
  longPressTimer = setTimeout(() => {
    if (moved) {
      return;
    }
    activeIndex.value = index;
    longPressTimer = null;
    uni.vibrateShort?.();
  }, LONG_PRESS);
}

function onTouchMove(e: any) {
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) {
    return;
  }
  const dx = Math.abs(touch.clientX - touchStartX);
  const dy = Math.abs(touch.clientY - touchStartY);
  if (activeIndex.value < 0) {
    if (dx > 8 || dy > 8) {
      moved = true;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
    return;
  }
  dragX.value = touch.clientX - touchStartX;
  dragY.value = touch.clientY - touchStartY;
  const { cellWidth, cellHeight, gapX, gapY, columns } = grid.value;
  if (!cellWidth) {
    return;
  }
  const col = Math.round((touch.clientX - areaRect.left) / (cellWidth + gapX));
  const row = Math.round((touch.clientY - areaRect.top) / (cellHeight + gapY));
  const visual = row * columns + col;
  const target = visual - (canAdd.value ? 1 : 0);
  if (target >= 0 && target < drafts.value.length && target !== activeIndex.value) {
    swapDrafts(activeIndex.value, target);
    activeIndex.value = target;
    uni.vibrateShort?.();
  }
}

function onTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (activeIndex.value > -1) {
    dragX.value = 0;
    dragY.value = 0;
    activeIndex.value = -1;
  }
}

function swapDrafts(from: number, to: number) {
  const list = [...drafts.value];
  const [movedItem] = list.splice(from, 1);
  list.splice(to, 0, movedItem);
  drafts.value = list;
}

function removeDraft(index: number) {
  drafts.value = drafts.value.filter((_, i) => i !== index);
}

async function openQr() {
  if (!canAdd.value || acting.value) {
    return;
  }
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
    if (session.status === "ready" && session.assetUrl && drafts.value.length < BANNER_MEDIA_LIMIT) {
      drafts.value = [...drafts.value, session.assetUrl];
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
</script>

<style>
page {
  background: #fff;
}

.dt {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(172 * var(--u));
  box-sizing: border-box;
}

.dt__bar {
  height: calc(80 * var(--u));
}

.dt-edit-hint {
  display: block;
  margin-top: calc(24 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
}

.dt-grid {
  margin-top: calc(40 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.dt-card {
  width: calc(312 * var(--u));
}

.dt-card__shot,
.dt-thumb__shot {
  width: calc(312 * var(--u));
  height: calc(417 * var(--u));
  border-radius: calc(32 * var(--u));
}

.dt-edit-grid {
  margin-top: calc(40 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.dt-plus,
.dt-thumb {
  position: relative;
  width: calc(312 * var(--u));
  height: calc(417 * var(--u));
  flex-shrink: 0;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.dt-thumb.is-dragging {
  z-index: 10;
  filter: drop-shadow(0 8rpx 24rpx rgba(0, 0, 0, 0.15));
}

.dt-plus {
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

.dt-plus__icon {
  width: calc(46 * var(--u));
  height: calc(46 * var(--u));
}

.dt-thumb__shot {
  width: 100%;
  height: 100%;
  border-radius: calc(32 * var(--u));
}

.dt-thumb__x {
  position: absolute;
  top: calc(24 * var(--u));
  right: calc(24 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}

.dt-meta {
  margin-top: calc(16 * var(--u));
}

.dt-row {
  padding: calc(40 * var(--u)) 0;
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.dt-row__label,
.dt-row__value {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.dt-row__value {
  max-width: calc(640 * var(--u));
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dt-hint {
  display: block;
  margin-top: calc(16 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
}

.dt-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  padding: calc(24 * var(--u)) calc(48 * var(--u));
  background: #fff;
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
  box-sizing: border-box;
}

.dt-foot__ghost,
.dt-foot__solid {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.dt-foot__ghost {
  background: #fff;
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}

.dt-foot__solid {
  background: #191919;
  color: #fff;
}

.dt-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(214 * var(--u));
  overflow-y: auto;
}

.dt-preview {
  width: calc(648 * var(--u));
}

.dt-preview__shot {
  width: calc(648 * var(--u));
  height: calc(979 * var(--u));
  border-radius: calc(24 * var(--u));
}

.dt-preview__close {
  margin-top: calc(24 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}

.dt-qr-mask {
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

.dt-sheet {
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

.dt-sheet__close {
  position: absolute;
  top: calc(40 * var(--u));
  right: calc(40 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}

.dt-sheet__title {
  margin-top: calc(132 * var(--u));
  font-size: calc(56 * var(--u));
  font-weight: 900;
  line-height: calc(72 * var(--u));
  letter-spacing: calc(5.6 * var(--u));
  color: #333;
}

.dt-sheet__lead {
  margin-top: calc(32 * var(--u));
  padding: 0 calc(48 * var(--u));
  font-size: calc(30 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  color: #333;
  text-align: center;
}

.dt-sheet__stage {
  margin-top: calc(40 * var(--u));
}
</style>
