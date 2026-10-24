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
        @click="openDetail(poster)"
      >
        <banner-shot
          class="lib-card__shot"
          :kind="poster.kind"
          :src="poster.images[0]?.src || poster.image"
          :cover="poster.images[0]?.cover || ''"
        />
        <view v-if="poster.badge" class="lib-card__badge" :class="{ 'is-listed': poster.badge === 'listed' }">
          <text>{{ badgeText(poster.badge) }}</text>
        </view>
        <text class="lib-card__title">{{ poster.title }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import BannerShot from "@/components/admin/banner-shot.vue";
import {
  badgeText,
  toLibraryPoster,
  type BannerTab,
  type LibraryPoster,
} from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { fetchOfficialBanners, fetchBannerCatalog, bannerCatalogLibraryMarks } from "@/lib/screen-api/banners";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  search: "/static/admin/search.svg",
};

const TABS: { id: BannerTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片轮播" },
  { id: "video", label: "视频轮播" },
];

const posters = ref<LibraryPoster[]>([]);
const kindTab = ref<BannerTab>("all");
const keyword = ref("");

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
    const [official, catalog] = await Promise.all([fetchOfficialBanners(), fetchBannerCatalog()]);
    const { stored: deviceLibraryIds, listed: listedLibraryIds } = bannerCatalogLibraryMarks(catalog);
    posters.value = (official || []).map((row) => toLibraryPoster(row, deviceLibraryIds, listedLibraryIds));
  } catch (error) {
    showScreenError(error, "图库加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.banner);
}

function openDetail(poster: LibraryPoster) {
  if (!poster.id) {
    return;
  }
  uni.navigateTo({
    url: `${ADMIN_PAGES.bannerLibraryDetail}?id=${encodeURIComponent(poster.id)}`,
  });
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
</style>
