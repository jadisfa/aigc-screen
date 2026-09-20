<template>
  <view class="lib">
    <view class="lib__bar">
      <kiosk-chip :icon="ASSETS.back" label="官方banner图集" @click="onBack" />
    </view>

    <view class="lib-search">
      <image class="lib-search__icon" :src="ASSETS.search" mode="aspectFit" />
      <input
        class="lib-search__input"
        v-model="keyword"
        maxlength="32"
        placeholder="搜索轮播图名称"
        placeholder-style="color:#989898"
        :adjust-position="false"
      />
    </view>

    <view class="lib-tabs">
      <view
        v-for="tab in TABS"
        :key="tab.id"
        class="lib-tabs__item"
        :class="{ 'is-on': kindTab === tab.id }"
        hover-class="none"
        @click="kindTab = tab.id"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view class="lib-grid">
      <view
        v-for="poster in filtered"
        :key="poster.id"
        class="lib-card"
        hover-class="none"
        @click="picked = poster"
      >
        <image class="lib-card__shot" :src="poster.image" mode="aspectFill" />
        <view v-if="poster.badge" class="lib-card__badge" :class="{ 'is-listed': poster.badge === 'listed' }">
          <text>{{ badgeText(poster.badge) }}</text>
        </view>
        <text class="lib-card__title">{{ poster.title }}</text>
      </view>
    </view>

    <view v-if="picked" class="lib-mask" hover-class="none" @click="picked = null">
      <view class="lib-preview" @click.stop>
        <image class="lib-preview__shot" :src="picked.image" mode="aspectFill" />
        <view v-if="picked.badge" class="lib-preview__badge" :class="{ 'is-listed': picked.badge === 'listed' }">
          <text>{{ badgeText(picked.badge) }}</text>
        </view>
      </view>
      <view class="lib-preview__btn lib-preview__btn--dark" hover-class="none" @click.stop="onStore">
        <text>存入我的图库</text>
      </view>
      <view class="lib-preview__btn lib-preview__btn--light" hover-class="none" @click.stop="onListNow">
        <text>立即上架</text>
      </view>
      <image class="lib-preview__close" :src="ASSETS.close" mode="aspectFit" @click.stop="picked = null" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import {
  badgeText,
  toLibraryPoster,
  type BannerTab,
  type LibraryPoster,
} from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { bindOfficialBanner, fetchDeviceBanners, fetchOfficialBanners } from "@/lib/screen-api/banners";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  search: "/static/admin/search.svg",
  close: "/static/tryon/close.svg",
};

const TABS: { id: BannerTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片轮播" },
  { id: "video", label: "视频轮播" },
];

const posters = ref<LibraryPoster[]>([]);
const kindTab = ref<BannerTab>("all");
const keyword = ref("");
const picked = ref<LibraryPoster | null>(null);

const filtered = computed(() => {
  const q = keyword.value.trim();
  return posters.value.filter((item) => {
    if (kindTab.value !== "all" && item.kind !== kindTab.value) {
      return false;
    }
    return !q || item.title.includes(q);
  });
});

onShow(() => {
  loadLibrary();
});

async function loadLibrary() {
  try {
    const [official, device] = await Promise.all([fetchOfficialBanners(), fetchDeviceBanners()]);
    const deviceLibraryIds = new Set(
      (device || []).map((row) => row.libraryId).filter((id): id is string => Boolean(id)),
    );
    const listedLibraryIds = new Set(
      (device || [])
        .filter((row) => row.openDeviceConfig === "yes" && row.libraryId)
        .map((row) => row.libraryId as string),
    );
    posters.value = (official || []).map((row) => toLibraryPoster(row, deviceLibraryIds, listedLibraryIds));
    if (picked.value) {
      picked.value = posters.value.find((row) => row.id === picked.value?.id) ?? null;
    }
  } catch (error) {
    showScreenError(error, "图库加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.banner);
}

async function onStore() {
  const current = picked.value;
  if (!current) {
    return;
  }
  try {
    await bindOfficialBanner(current.id, "no");
    uni.showToast({ title: "已存入图库", icon: "none" });
    picked.value = null;
    await loadLibrary();
  } catch (error) {
    showScreenError(error, "存入失败");
  }
}

async function onListNow() {
  const current = picked.value;
  if (!current) {
    return;
  }
  try {
    await bindOfficialBanner(current.id, "yes");
    uni.showToast({ title: "已上架", icon: "none" });
    picked.value = null;
    await loadLibrary();
  } catch (error) {
    showScreenError(error, "上架失败");
  }
}
</script>

<style>
page {
  background: #fff;
}

.lib {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.lib__bar {
  height: calc(80 * var(--u));
}

.lib-search {
  margin-top: calc(32 * var(--u));
  width: calc(978 * var(--u));
  height: calc(80 * var(--u));
  padding: 0 calc(6 * var(--u)) 0 calc(32 * var(--u));
  background: #fff;
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(10 * var(--u));
  box-sizing: border-box;
}

.lib-search__icon {
  width: calc(20 * var(--u));
  height: calc(20 * var(--u));
  flex-shrink: 0;
}

.lib-search__input {
  flex: 1;
  height: 100%;
  font-size: calc(24 * var(--u));
  color: #333;
}

.lib-tabs {
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

.lib-tabs__item {
  flex: 1;
  height: calc(68 * var(--u));
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  color: #333;
}

.lib-tabs__item.is-on {
  background: #191919;
  color: #fff;
}

.lib-grid {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.lib-card {
  width: calc(312 * var(--u));
  position: relative;
}

.lib-card__shot {
  width: calc(312 * var(--u));
  height: calc(417 * var(--u));
  border-radius: calc(32 * var(--u));
}

.lib-card__badge {
  position: absolute;
  left: calc(20 * var(--u));
  top: calc(20 * var(--u));
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: rgba(0, 0, 0, 0.3);
  border-radius: calc(12 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #fff;
}

.lib-card__badge.is-listed {
  background: #0f1010;
}

.lib-card__title {
  display: block;
  margin-top: calc(24 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.lib-mask {
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

.lib-preview {
  position: relative;
  width: calc(648 * var(--u));
}

.lib-preview__shot {
  width: calc(648 * var(--u));
  height: calc(979 * var(--u));
  border-radius: calc(24 * var(--u));
}

.lib-preview__badge {
  position: absolute;
  right: calc(20 * var(--u));
  top: calc(20 * var(--u));
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: rgba(0, 0, 0, 0.3);
  border-radius: calc(12 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #fff;
}

.lib-preview__badge.is-listed {
  background: #0f1010;
}

.lib-preview__btn {
  margin-top: calc(24 * var(--u));
  width: calc(480 * var(--u));
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.lib-preview__btn--dark {
  background: #191919;
  color: #fff;
}

.lib-preview__btn--light {
  background: #fff;
  color: #333;
}

.lib-preview__close {
  margin-top: calc(24 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}
</style>
