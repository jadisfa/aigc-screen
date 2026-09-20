<template>
  <view class="bn">
    <view class="bn__bar">
      <kiosk-chip :icon="ASSETS.back" label="banner轮播图管理" @click="onBack" />
    </view>

    <view class="bn-cards">
      <view class="bn-card" hover-class="none" @click="goLibrary">
        <image class="bn-card__icon" :src="ASSETS.official" mode="aspectFit" />
        <view class="bn-card__copy">
          <text class="bn-card__title">官方Banner图库</text>
          <text class="bn-card__lead">选择平台官方宣传banner</text>
        </view>
      </view>
      <view class="bn-card" hover-class="none" @click="goUpload()">
        <image class="bn-card__icon" :src="ASSETS.upload" mode="aspectFit" />
        <view class="bn-card__copy">
          <text class="bn-card__title">自定义上传Banner</text>
          <text class="bn-card__lead">上传专属海报，自定义展示内容</text>
        </view>
      </view>
    </view>

    <view class="bn-tabs">
      <view
        v-for="tab in TABS"
        :key="tab.id"
        class="bn-tabs__item"
        :class="{ 'is-on': kindTab === tab.id }"
        hover-class="none"
        @click="kindTab = tab.id"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view class="bn-filter">
      <view class="bn-search">
        <image class="bn-search__icon" :src="ASSETS.search" mode="aspectFit" />
        <input
          class="bn-search__input"
          v-model="keyword"
          maxlength="32"
          placeholder="搜索轮播图名称"
          placeholder-style="color:#989898"
          :adjust-position="false"
        />
      </view>
      <view class="bn-status" hover-class="none" @click="pickStatus">
        <text>{{ statusLabel }}</text>
        <image class="bn-status__chev" :src="ASSETS.chevron" mode="aspectFit" />
      </view>
    </view>

    <view v-if="filtered.length" class="bn-list">
      <view v-for="item in filtered" :key="item.id" class="bn-row">
        <image class="bn-row__thumb" :src="item.image" mode="aspectFill" />
        <view class="bn-row__body">
          <text class="bn-row__title">{{ item.title }}</text>
          <view class="bn-row__tags">
            <text class="bn-row__tag">{{ item.kind === "video" ? "视频" : "图片" }}</text>
            <text v-if="item.official" class="bn-row__tag">官方</text>
          </view>
          <text class="bn-row__time">创建时间：{{ item.createdAt }}</text>
          <view class="bn-row__actions">
            <view
              v-for="act in rowActions(item)"
              :key="act.id"
              class="bn-act"
              :class="{ 'is-solid': act.solid }"
              hover-class="none"
              @click="onAction(item, act.id)"
            >
              <text>{{ act.label }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="bn-empty">
      <image class="bn-empty__art" :src="ASSETS.empty" mode="aspectFit" />
      <text class="bn-empty__text">暂无轮播图</text>
      <view class="bn-empty__btn" hover-class="none" @click="goUpload()">
        <image class="bn-empty__plus" :src="ASSETS.uploadPlus" mode="aspectFit" />
        <text>上传轮播图</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import {
  toBannerItem,
  type BannerItem,
  type BannerTab,
  type StatusFilter,
} from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { deleteDeviceBanner, fetchDeviceBanners, patchDeviceBanner } from "@/lib/screen-api/banners";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  official: "/static/admin/card-official.svg",
  upload: "/static/admin/card-upload.svg",
  search: "/static/admin/search.svg",
  chevron: "/static/admin/chevron.svg",
  empty: "/static/admin/empty.svg",
  uploadPlus: "/static/admin/upload-plus.svg",
};

const TABS: { id: BannerTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片轮播" },
  { id: "video", label: "视频轮播" },
];

const STATUS_SHEET: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "全部状态" },
  { id: "on", label: "已上架" },
  { id: "off", label: "已下架" },
];

type RowAct = { id: "on" | "off" | "pin" | "edit" | "del"; label: string; solid: boolean };

const items = ref<BannerItem[]>([]);
const kindTab = ref<BannerTab>("all");
const statusFilter = ref<StatusFilter>("all");
const keyword = ref("");

const statusLabel = computed(
  () => STATUS_SHEET.find((s) => s.id === statusFilter.value)?.label ?? "全部状态",
);

const filtered = computed(() => {
  const q = keyword.value.trim();
  return items.value.filter((item) => {
    if (kindTab.value !== "all" && item.kind !== kindTab.value) {
      return false;
    }
    if (statusFilter.value !== "all" && item.status !== statusFilter.value) {
      return false;
    }
    return !q || item.title.includes(q);
  });
});

onShow(() => {
  loadBanners();
});

async function loadBanners() {
  try {
    const rows = await fetchDeviceBanners();
    items.value = (rows || []).map(toBannerItem).filter((row) => row.id);
  } catch (error) {
    showScreenError(error, "轮播图加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.home);
}

function goLibrary() {
  uni.navigateTo({ url: ADMIN_PAGES.bannerLibrary });
}

function goUpload(id?: string) {
  const qs = id ? `?id=${encodeURIComponent(id)}` : "";
  uni.navigateTo({ url: `${ADMIN_PAGES.bannerUpload}${qs}` });
}

function pickStatus() {
  uni.showActionSheet({
    itemList: STATUS_SHEET.map((s) => s.label),
    success: (res) => {
      const picked = STATUS_SHEET[res.tapIndex];
      if (picked) {
        statusFilter.value = picked.id;
      }
    },
  });
}

function rowActions(item: BannerItem): RowAct[] {
  if (item.official) {
    return item.status === "on"
      ? [
          { id: "off", label: "下架", solid: false },
          { id: "del", label: "删除", solid: false },
        ]
      : [
          { id: "on", label: "上架", solid: true },
          { id: "del", label: "删除", solid: false },
        ];
  }
  if (item.status === "off") {
    return [
      { id: "on", label: "上架", solid: true },
      { id: "pin", label: "置顶", solid: false },
      { id: "edit", label: "编辑", solid: false },
      { id: "del", label: "删除", solid: false },
    ];
  }
  return [
    { id: "off", label: "下架", solid: false },
    { id: "pin", label: "置顶", solid: false },
    { id: "edit", label: "编辑", solid: false },
    { id: "del", label: "删除", solid: false },
  ];
}

async function onAction(item: BannerItem, act: RowAct["id"]) {
  if (act === "edit") {
    goUpload(item.id);
    return;
  }
  try {
    if (act === "del") {
      await deleteDeviceBanner(item.id);
    } else if (act === "pin") {
      await patchDeviceBanner(item.id, { pin: true });
    } else {
      await patchDeviceBanner(item.id, { openDeviceConfig: act === "on" ? "yes" : "no" });
    }
    await loadBanners();
  } catch (error) {
    showScreenError(error, "操作失败");
  }
}
</script>

<style>
page {
  background: #f2f3f5;
}

.bn {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #f2f3f5;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.bn__bar {
  height: calc(80 * var(--u));
}

.bn-cards {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.bn-card {
  width: calc(480 * var(--u));
  height: calc(200 * var(--u));
  padding: 0 calc(40 * var(--u));
  background: #fff;
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
  box-sizing: border-box;
}

.bn-card__icon {
  width: calc(84 * var(--u));
  height: calc(82 * var(--u));
  flex-shrink: 0;
}

.bn-card__copy {
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.bn-card__title {
  font-size: calc(28 * var(--u));
  font-weight: 700;
  letter-spacing: calc(2.8 * var(--u));
  color: #333;
}

.bn-card__lead {
  font-size: calc(20 * var(--u));
  line-height: calc(24 * var(--u));
  color: #777;
}

.bn-tabs {
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

.bn-tabs__item {
  flex: 1;
  height: calc(68 * var(--u));
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  color: #333;
}

.bn-tabs__item.is-on {
  background: #191919;
  color: #fff;
}

.bn-filter {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.bn-search {
  width: calc(732 * var(--u));
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

.bn-search__icon {
  width: calc(20 * var(--u));
  height: calc(20 * var(--u));
  flex-shrink: 0;
}

.bn-search__input {
  flex: 1;
  height: 100%;
  font-size: calc(24 * var(--u));
  color: #333;
}

.bn-status {
  width: calc(228 * var(--u));
  height: calc(80 * var(--u));
  padding: 0 calc(40 * var(--u));
  background: #fff;
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
}

.bn-status__chev {
  width: calc(10 * var(--u));
  height: calc(20 * var(--u));
  transform: rotate(90deg);
}

.bn-list {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.bn-row {
  padding-bottom: calc(24 * var(--u));
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(32 * var(--u));
}

.bn-row__thumb {
  width: calc(193 * var(--u));
  height: calc(257 * var(--u));
  border-radius: calc(22 * var(--u));
  flex-shrink: 0;
}

.bn-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.bn-row__title {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.bn-row__tags {
  display: flex;
  flex-direction: row;
  gap: calc(16 * var(--u));
}

.bn-row__tag {
  padding: calc(8 * var(--u)) calc(16 * var(--u));
  background: #f2f3f7;
  border-radius: calc(6 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #333;
}

.bn-row__time {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #c7c7cc;
}

.bn-row__actions {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: calc(16 * var(--u));
}

.bn-act {
  width: calc(120 * var(--u));
  height: calc(48 * var(--u));
  border: calc(1 * var(--u)) solid #c7c7cc;
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(20 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
}

.bn-act.is-solid {
  background: #191919;
  color: #fff;
}

.bn-empty {
  margin-top: calc(120 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bn-empty__art {
  width: calc(292 * var(--u));
  height: calc(331 * var(--u));
}

.bn-empty__text {
  margin-top: calc(40 * var(--u));
  font-size: calc(24 * var(--u));
  color: #333;
}

.bn-empty__btn {
  margin-top: calc(60 * var(--u));
  width: calc(324 * var(--u));
  height: calc(80 * var(--u));
  background: #191919;
  border-radius: calc(77 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  color: #fff;
  font-size: calc(24 * var(--u));
}

.bn-empty__plus {
  width: calc(20 * var(--u));
  height: calc(22 * var(--u));
}
</style>
