<template>
  <view class="dt">
    <view class="dt__bar">
      <kiosk-chip :icon="ASSETS.back" :label="poster?.title || '官方轮播图详情'" @click="onBack" />
    </view>

    <view v-if="poster" class="dt-grid">
      <view
        v-for="(media, index) in poster.images"
        :key="`${media.src}-${index}`"
        class="dt-card"
        hover-class="none"
        @click="preview = media.src"
      >
        <banner-shot class="dt-card__shot" :kind="poster.kind" :src="media.src" :cover="media.cover" />
      </view>
    </view>

    <view v-if="poster" class="dt-meta">
      <view class="dt-row">
        <text class="dt-row__label">类型</text>
        <text class="dt-row__value">{{ kindLabel }}</text>
      </view>
      <view class="dt-row">
        <text class="dt-row__label">跳转链接</text>
        <text class="dt-row__value">{{ poster.link || "不跳转" }}</text>
      </view>
      <text class="dt-hint">{{
        poster.kind === "video" ? "轮播视频共用同一个跳转链接" : "轮播图片共用同一个跳转链接"
      }}</text>
    </view>

    <view v-if="poster" class="dt-foot">
      <view class="dt-foot__ghost" hover-class="none" @click="onListNow">
        <text>立即上架</text>
      </view>
      <view class="dt-foot__solid" hover-class="none" @click="onStore">
        <text>存入我的图库</text>
      </view>
    </view>

    <view v-if="preview" class="dt-mask" hover-class="none" @click="preview = ''">
      <view class="dt-preview" @click.stop>
        <video
          v-if="poster?.kind === 'video'"
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
    <kiosk-toast />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import BannerShot from "@/components/admin/banner-shot.vue";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";
import { toLibraryPoster, type LibraryPoster } from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { bindOfficialBanner, fetchDeviceBanners, fetchOfficialBanners, bannerLibraryMarks } from "@/lib/screen-api/banners";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  close: "/static/tryon/close.svg",
};

const libraryId = ref("");
const poster = ref<LibraryPoster | null>(null);
const preview = ref("");
const acting = ref(false);

const kindLabel = computed(() => (poster.value?.kind === "video" ? "视频轮播" : "图片轮播"));
const previewCover = computed(
  () => poster.value?.images.find((media) => media.src === preview.value)?.cover || "",
);

onLoad((query?: Record<string, string>) => {
  libraryId.value = query?.id || "";
});

onShow(() => {
  loadDetail();
});

async function loadDetail() {
  const id = libraryId.value;
  if (!id) {
    (uni as any).$toast?.error("图库不存在", undefined, 1000);
    goBackOr(ADMIN_PAGES.bannerLibrary);
    return;
  }
  try {
    const [official, ads] = await Promise.all([fetchOfficialBanners(), fetchDeviceBanners()]);
    const { stored: deviceLibraryIds, listed: listedLibraryIds } = bannerLibraryMarks(ads);
    const found = (official || []).find((row) => row.libraryId === id);
    if (!found) {
      (uni as any).$toast?.error("图库不存在", undefined, 1000);
      goBackOr(ADMIN_PAGES.bannerLibrary);
      return;
    }
    poster.value = toLibraryPoster(found, deviceLibraryIds, listedLibraryIds);
  } catch (error) {
    showScreenError(error, "图库详情加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.bannerLibrary);
}

async function onStore() {
  await bindGallery("no", "已加入设备图库", "存入失败");
}

async function onListNow() {
  await bindGallery("yes", "已上架", "上架失败");
}

async function bindGallery(open: "yes" | "no", okTitle: string, failTitle: string) {
  const current = poster.value;
  if (!current || acting.value) {
    return;
  }
  acting.value = true;
  try {
    await bindOfficialBanner(current.id, open);
    preview.value = "";
    (uni as any).$toast?.success(okTitle, undefined, 1000);
    setTimeout(() => goBackOr(ADMIN_PAGES.banner), 1000);
  } catch (error) {
    showScreenError(error, failTitle);
  } finally {
    acting.value = false;
  }
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

.dt-card__shot {
  width: calc(312 * var(--u));
  height: calc(417 * var(--u));
  border-radius: calc(32 * var(--u));
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

.dt-preview__btn {
  margin-top: calc(24 * var(--u));
  width: calc(480 * var(--u));
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.dt-preview__close {
  margin-top: calc(24 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}
</style>
