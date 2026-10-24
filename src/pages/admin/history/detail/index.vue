<template>
  <view class="hd">
    <view class="hd__bar">
      <kiosk-chip :icon="ASSETS.back" label="返回" @click="onBack" />
    </view>

    <view v-if="item.outfit" class="hd-row">
      <text>穿搭图</text>
      <image class="hd-row__shot" :src="item.outfit" mode="aspectFill" />
    </view>
    <view v-if="item.source" class="hd-row">
      <text>原图</text>
      <image class="hd-row__shot" :src="item.source" mode="aspectFill" />
    </view>
    <view class="hd-row">
      <text>生成状态</text>
      <view class="hd-row__tags">
        <text v-for="tag in item.tags" :key="tag" class="hd-row__tag">{{ tag }}</text>
      </view>
    </view>
    <view class="hd-row">
      <text>消耗金额</text>
      <text>{{ item.points }}</text>
    </view>
    <view class="hd-row">
      <text>生成时间</text>
      <text>{{ item.createdAt }}</text>
    </view>

    <view v-if="item.looks.length" class="hd-looks">
      <text class="hd-looks__label">款式图</text>
      <view class="hd-looks__grid">
        <image v-for="(src, index) in item.looks" :key="index" class="hd-looks__shot" :src="src" mode="aspectFill" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { cacheHistory, emptyHistory, findHistory, toHistoryItem, type HistoryItem } from "@/data/history";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { fetchGenerations } from "@/lib/screen-api/generations";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
};

const historyId = ref("");
const item = reactive<HistoryItem>(emptyHistory());

onLoad((query?: Record<string, string>) => {
  historyId.value = query?.id || "";
});

onShow(() => {
  loadDetail();
});

async function loadDetail() {
  const cached = findHistory(historyId.value);
  if (cached && cached.createdAt) {
    Object.assign(item, cached);
    return;
  }
  try {
    const rows = await fetchGenerations();
    const mapped = rows.map(toHistoryItem);
    cacheHistory(mapped);
    Object.assign(item, findHistory(historyId.value));
  } catch (error) {
    showScreenError(error, "记录加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.history);
}
</script>

<style>
page {
  background: #fff;
}

.hd {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.hd__bar {
  height: calc(80 * var(--u));
}

.hd-row {
  margin-top: calc(40 * var(--u));
  padding-bottom: calc(40 * var(--u));
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.hd-row__shot {
  width: calc(228 * var(--u));
  height: calc(228 * var(--u));
  border-radius: calc(32 * var(--u));
}

.hd-row__tags {
  display: flex;
  flex-direction: row;
  gap: calc(16 * var(--u));
}

.hd-row__tag {
  padding: calc(16 * var(--u)) calc(32 * var(--u));
  background: #f2f3f7;
  border-radius: calc(16 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
}

.hd-looks {
  margin-top: calc(40 * var(--u));
}

.hd-looks__label {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  color: #333;
}

.hd-looks__grid {
  margin-top: calc(24 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.hd-looks__shot {
  width: calc(228 * var(--u));
  height: calc(228 * var(--u));
  border-radius: calc(32 * var(--u));
}
</style>
