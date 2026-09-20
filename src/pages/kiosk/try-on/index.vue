<template>
  <view class="try">
    <view class="try__bar">
      <kiosk-chip :icon="ASSETS.back" label="返回" @click="onBack" />
    </view>

    <text class="try__title">AI试戴美甲</text>
    <text class="try__lead">上传/选择手模图，AI为你生成试戴效果</text>

    <view class="try-pair">
      <image class="try-pair__tile" :src="nails" mode="aspectFill" />
      <image class="try-pair__join" :src="ASSETS.join" mode="aspectFit" />
      <view v-if="handImage" class="try-pair__slot">
        <image class="try-pair__tile" :src="handImage" mode="aspectFill" />
        <image class="try-pair__close" :src="ASSETS.close" mode="aspectFit" hover-class="none" @click.stop="clearHand" />
      </view>
      <view v-else class="try-pair__upload" hover-class="none" @click="onUpload">
        <view class="try-pair__dash">
          <image class="try-pair__plus" :src="ASSETS.plus" mode="aspectFit" />
          <text>上传手模图</text>
        </view>
      </view>
    </view>

    <view class="try-sheet">
      <text class="try-sheet__label">官方手模图</text>
      <view class="try-sheet__grid">
        <view
          v-for="hand in hands"
          :key="hand.id"
          class="try-hand"
          :class="{ 'is-on': selectedId === hand.id }"
          hover-class="none"
          @click="onPick(hand.id)"
        >
          <image class="try-hand__shot" :src="hand.image" mode="aspectFill" />
          <image v-if="selectedId === hand.id" class="try-hand__check" :src="ASSETS.check" mode="aspectFit" />
        </view>
      </view>
    </view>

    <view class="try-foot">
      <view class="try-foot__btn" :class="{ 'is-on': canGenerate }" hover-class="none" @click="onGenerate">
        <text>生成试戴效果</text>
        <image class="try-foot__spark" :src="ASSETS.sparkle" mode="aspectFit" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import {
  clearTryOnHandId,
  readTryOnHandId,
  resolveLook,
  toKioskHands,
  writeTryOnHandId,
  writeTryOnImageUrl,
  writeTryOnLookId,
  writeTryOnNailUrl,
  type HandModel,
} from "@/data/try-on";
import { loadListedProduct } from "@/data/kiosk-catalog";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { fetchHandModels } from "@/lib/screen-api/hand-models";
import { showScreenError } from "@/lib/screen-http";
import { clearPreview, readPreview, scanUploadUrl } from "@/lib/upload-flow";

const ASSETS = {
  back: "/static/scan/back.svg",
  join: "/static/tryon/join.svg",
  plus: "/static/tryon/plus.svg",
  close: "/static/tryon/close.svg",
  check: "/static/scan/badge-ok.svg",
  sparkle: "/static/results/sparkle.svg",
};

const nails = ref("");
const hands = ref<HandModel[]>([]);
const selectedId = ref("");
const uploaded = ref("");

const handImage = computed(() => {
  if (selectedId.value) {
    return hands.value.find((item) => item.id === selectedId.value)?.image || "";
  }
  return uploaded.value;
});

const canGenerate = computed(() => Boolean(handImage.value && nails.value));

onLoad((query?: Record<string, string>) => {
  const stashId = uni.getStorageSync('selectId') || query?.look;
  writeTryOnLookId(stashId || "");
  nails.value = resolveLook(stashId).image;
  if (stashId) {
    loadListedProduct(stashId)
      .then((item) => {
        nails.value = item.image;
      })
      .catch(() => undefined);
  }
});

onShow(() => {
  uploaded.value = readPreview("hand-model");
  if (uploaded.value) {
    selectedId.value = "";
    clearTryOnHandId();
  } else {
    selectedId.value = readTryOnHandId();
  }
  loadHands();
});

async function loadHands() {
  try {
    hands.value = toKioskHands(await fetchHandModels());
  } catch (error) {
    showScreenError(error, "手模加载失败");
  }
}

function onBack() {
  // goBackOr(KIOSK_PAGES.results);
  console.log('试戴返回')
  const productId = uni.getStorageSync('selectId') || '';
  uni.navigateTo({
  	url: `/pages/kiosk/generate/product-detail/index?id=${productId}`
  })
}

function onUpload() {
  uni.navigateTo({ url: scanUploadUrl("hand-model") });
}

function onPick(id: string) {
  selectedId.value = id;
  writeTryOnHandId(id);
  uploaded.value = "";
  clearPreview("hand-model");
}

function clearHand() {
  selectedId.value = "";
  uploaded.value = "";
  clearTryOnHandId();
  clearPreview("hand-model");
}

function onGenerate() {
  if (!canGenerate.value) {
    return;
  }
  writeTryOnImageUrl(handImage.value);
  writeTryOnNailUrl(nails.value);
  uni.navigateTo({
    url: `${KIOSK_PAGES.tryOnWait}?next=${encodeURIComponent(KIOSK_PAGES.tryOnResult)}`,
  });
}
</script>

<style>
page {
  height: 100%;
  background: #f7f7f7;
}

.try {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #f7f7f7;
  position: relative;
  padding: calc(32 * var(--u)) 0 calc(148 * var(--u));
  box-sizing: border-box;
}

.try__bar {
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  margin: 0 auto;
}

.try__title {
  display: block;
  margin-top: calc(58 * var(--u));
  text-align: center;
  font-size: calc(56 * var(--u));
  font-weight: 900;
  line-height: calc(72 * var(--u));
  letter-spacing: calc(5.6 * var(--u));
  color: #333;
}

.try__lead {
  display: block;
  margin-top: calc(32 * var(--u));
  text-align: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
}

.try-pair {
  margin-top: calc(60 * var(--u));
  padding: 0 calc(72 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.try-pair__tile {
  width: calc(396 * var(--u));
  height: calc(396 * var(--u));
  border-radius: calc(60 * var(--u));
  box-shadow: 0 0 calc(20 * var(--u)) rgba(0, 0, 0, 0.1);
}

.try-pair__join {
  width: calc(43 * var(--u));
  height: calc(43 * var(--u));
  flex-shrink: 0;
}

.try-pair__slot {
  position: relative;
  width: calc(396 * var(--u));
  height: calc(396 * var(--u));
}

.try-pair__close {
  position: absolute;
  top: calc(-24 * var(--u));
  right: calc(-24 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
  z-index: 2;
}

.try-pair__upload {
  width: calc(396 * var(--u));
  height: calc(396 * var(--u));
  border-radius: calc(60 * var(--u));
  background: #eef2f5;
  padding: calc(16 * var(--u));
  box-sizing: border-box;
}

.try-pair__dash {
  width: 100%;
  height: 100%;
  border: calc(2 * var(--u)) dashed #e5e5e5;
  border-radius: calc(44 * var(--u));
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(24 * var(--u));
  box-sizing: border-box;
}

.try-pair__dash text {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #777;
}

.try-pair__plus {
  width: calc(46 * var(--u));
  height: calc(46 * var(--u));
}

.try-sheet {
  margin-top: calc(90 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  padding: calc(40 * var(--u)) calc(48 * var(--u)) calc(32 * var(--u));
  min-height: calc(760 * var(--u));
}

.try-sheet__label {
  font-size: calc(36 * var(--u));
  font-weight: 500;
  color: #777;
}

.try-sheet__grid {
  margin-top: calc(38 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.try-hand {
  position: relative;
  width: calc(312 * var(--u));
  height: calc(312 * var(--u));
  border-radius: calc(40 * var(--u));
  overflow: hidden;
  box-sizing: border-box;
}

.try-hand.is-on {
  border: calc(4 * var(--u)) solid #191919;
}

.try-hand__shot {
  width: 100%;
  height: 100%;
}

.try-hand__check {
  position: absolute;
  top: calc(24 * var(--u));
  right: calc(24 * var(--u));
  width: calc(40 * var(--u));
  height: calc(40 * var(--u));
}

.try-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 10;
  width: calc(1080 * var(--u));
  margin-left: calc(-540 * var(--u));
  padding: calc(24 * var(--u)) calc(48 * var(--u));
  background: #fff;
  box-sizing: border-box;
}

.try-foot__btn {
  height: calc(100 * var(--u));
  background: rgba(25, 25, 25, 0.2);
  border-radius: calc(60 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  color: #fff;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.try-foot__btn.is-on {
  background: #191919;
}

.try-foot__spark {
  width: calc(28.8 * var(--u));
  height: calc(28.8 * var(--u));
  flex-shrink: 0;
}
</style>
