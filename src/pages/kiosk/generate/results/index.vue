<template>
  <view class="res">
    <image class="res__glow" :src="ASSETS.glow" mode="scaleToFill" />

    <view class="res__bar">
      <kiosk-chip :icon="ASSETS.back" variant="glass" label="返回" @click="onBack" />
    </view>

    <view class="res-hero">
      <image v-if="current.image" class="res-hero__shot" :src="current.image" mode="aspectFill" />
      <view v-else class="res-hero__empty">
        <text>暂无匹配款式</text>
      </view>
      <view class="res-hero__compare" hover-class="none" @click="onCompare">
        <image class="res-hero__compare-icon" :src="ASSETS.compare" mode="aspectFit" />
        <text>穿搭对比</text>
      </view>
      <view v-if="current.id" class="res-buy" hover-class="none" @click="onBuy">
        <image class="res-buy__thumb" :src="current.buyThumb" mode="aspectFill" />
        <text class="res-buy__price">{{ current.price }}</text>
        <text class="res-buy__label">购买同款</text>
      </view>
    </view>

    <scroll-view v-if="looks.length" class="res-thumbs" scroll-x :show-scrollbar="false" enable-flex>
      <view class="res-thumbs__row">
        <view
          v-for="(look, index) in looks"
          :key="look.id"
          class="res-thumb"
          :class="{ 'is-on': index === activeIndex }"
          hover-class="none"
          @click="activeIndex = index"
        >
          <image :src="look.image" mode="aspectFill" />
        </view>
      </view>
    </scroll-view>

    <view class="res-panel">
      <view class="res-tip" hover-class="none">
        <text>试试调整风格标签，重新生成你喜欢的穿戴甲吧</text>
        <image class="res-tip__arrow" :src="ASSETS.arrow" mode="aspectFit" />
      </view>
      <view class="res-style">
        <view class="res-style__head">
          <image class="res-style__star" :src="ASSETS.star" mode="aspectFit" />
          <text>你的穿搭风格</text>
          <image class="res-style__star" :src="ASSETS.star" mode="aspectFit" />
        </view>
        <view v-if="tags.length" class="res-style__tags">
          <view
            v-for="(tag, index) in tags"
            :key="tag.code || tag.name"
            class="res-style__tag"
            :class="{ 'is-on': tag.selected }"
            hover-class="none"
            @click="toggleTag(index)"
          >
            <text>{{ tag.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="res-actions">
      <view class="res-actions__ghost" :class="{ 'is-busy': rematching }" hover-class="none" @click="onRegen">
        <text>{{ rematching ? "匹配中" : "重新匹配" }}</text>
      </view>
      <view class="res-actions__solid" hover-class="none" @click="onTry">
        <text>上手试效果</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { toGenerateLooks, type GenerateLook } from "@/data/results";
import {
  experienceStyleTags,
  loadMatchedExperience,
  readMatchedExperienceSnapshot,
  rematchBySelectedTags,
  type StyleTag,
} from "@/lib/experience-flow";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { showScreenError } from "@/lib/screen-http";
import type { ScreenExperience } from "@/lib/screen-api/experiences";

const ASSETS = {
  glow: "/static/results/glow.svg",
  back: "/static/results/back-white.svg",
  compare: "/static/results/compare.svg",
  arrow: "/static/results/tip-arrow.svg",
  star: "/static/icons/title-star.svg",
};

type ResultTag = StyleTag & { selected: boolean };

const looks = ref<GenerateLook[]>([]);
const activeIndex = ref(0);
const tags = ref<ResultTag[]>([]);
const rematching = ref(false);
const emptyLook: GenerateLook = { id: "", image: "", price: "", buyThumb: "" };
const current = computed(() => looks.value[activeIndex.value] ?? emptyLook);

onShow(() => {
  const keepSelection = tags.value.length > 0;
  if (!keepSelection) {
    applyExperience(readMatchedExperienceSnapshot());
  }
  loadResults();
});

async function loadResults() {
  try {
    applyExperience(await loadMatchedExperience(), tags.value.length > 0);
  } catch (error) {
    if (!readMatchedExperienceSnapshot()) {
      looks.value = [];
      tags.value = [];
      showScreenError(error, "匹配结果加载失败");
    }
  }
}

function applyExperience(experience: ScreenExperience | null, keepSelection = false) {
  looks.value = toGenerateLooks(experience?.matchedProducts);
  activeIndex.value = 0;
  const previous = keepSelection ? tags.value : [];
  tags.value = experienceStyleTags(experience).map((tag) => {
    const prev = previous.find((row) => (tag.code && row.code === tag.code) || row.name === tag.name);
    return { ...tag, selected: prev ? prev.selected : false };
  });
}

function toggleTag(index: number) {
  const row = tags.value[index];
  if (!row) {
    return;
  }
  tags.value[index] = { ...row, selected: !row.selected };
}

function onBack() {
  goBackOr(KIOSK_PAGES.home);
}

function onCompare() {
  uni.showToast({ title: "暂不支持穿搭对比", icon: "none" });
}

function onBuy() {
  if (!current.value.id) {
    return;
  }
  uni.navigateTo({ url: `${KIOSK_PAGES.productDetail}?id=${encodeURIComponent(current.value.id)}` });
}

async function onRegen() {
  if (rematching.value) {
    return;
  }
  const selected = tags.value.filter((tag) => tag.selected).map((tag) => tag.code || tag.name);
  if (!selected.length) {
    uni.showToast({ title: "请选择风格标签", icon: "none" });
    return;
  }
  rematching.value = true;
  try {
    applyExperience(await rematchBySelectedTags(selected), true);
  } catch (error) {
    showScreenError(error, "重新匹配失败");
  } finally {
    rematching.value = false;
  }
}

function onTry() {
  const look = current.value.id ? `?look=${encodeURIComponent(current.value.id)}` : "";
  uni.navigateTo({ url: `${KIOSK_PAGES.tryOn}${look}` });
}
</script>

<style>
page {
  height: 100%;
  background: #fff;
}

.res {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  position: relative;
  overflow: hidden;
  padding: 0 0 calc(56 * var(--u));
  box-sizing: border-box;
}

.res__glow {
  position: absolute;
  left: calc(-403 * var(--u));
  top: calc(-219 * var(--u));
  width: calc(1885 * var(--u));
  height: calc(732 * var(--u));
  z-index: 0;
  pointer-events: none;
}

.res__bar {
  position: relative;
  z-index: 2;
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  margin: calc(32 * var(--u)) auto 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.res-hero {
  position: relative;
  z-index: 1;
  width: calc(816 * var(--u));
  height: calc(816 * var(--u));
  margin: calc(32 * var(--u)) auto 0;
}

.res-hero__shot {
  width: 100%;
  height: 100%;
  border-radius: calc(60 * var(--u));
  box-shadow: 0 0 calc(29 * var(--u)) rgba(0, 0, 0, 0.1);
}

.res-hero__empty {
  width: 100%;
  height: 100%;
  border-radius: calc(60 * var(--u));
  background: #f5f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #777;
}

.res-hero__compare {
  position: absolute;
  right: calc(36 * var(--u));
  bottom: calc(40 * var(--u));
  width: calc(120 * var(--u));
  height: calc(120 * var(--u));
  border-radius: calc(32 * var(--u));
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(10 * var(--u));
  color: #fff;
  font-size: calc(20 * var(--u));
  font-weight: 500;
}

.res-hero__compare-icon {
  width: calc(34 * var(--u));
  height: calc(40 * var(--u));
}

.res-buy {
  position: absolute;
  right: calc(36 * var(--u));
  top: calc(415 * var(--u));
  width: calc(120 * var(--u));
  background: #fff;
  border-radius: calc(32 * var(--u));
  box-shadow: 0 0 calc(5 * var(--u)) rgba(0, 0, 0, 0.1);
  padding: calc(10 * var(--u)) calc(10 * var(--u)) calc(16 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.res-buy__thumb {
  width: calc(100 * var(--u));
  height: calc(100 * var(--u));
  border-radius: calc(22 * var(--u));
}

.res-buy__price {
  margin-top: calc(10 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 700;
  color: #333;
}

.res-buy__label {
  margin-top: calc(8 * var(--u));
  font-size: calc(20 * var(--u));
  font-weight: 500;
  color: #777;
}

.res-thumbs {
  position: relative;
  z-index: 1;
  width: calc(1032 * var(--u));
  margin: calc(32 * var(--u)) 0 0 calc(48 * var(--u));
  white-space: nowrap;
}

.res-thumbs__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(40 * var(--u));
  padding-right: calc(48 * var(--u));
}

.res-thumb {
  flex-shrink: 0;
  width: calc(180 * var(--u));
  height: calc(180 * var(--u));
  border: calc(3 * var(--u)) solid #eee;
  border-radius: calc(32 * var(--u));
  overflow: hidden;
  box-sizing: border-box;
}

.res-thumb.is-on {
  width: calc(198 * var(--u));
  height: calc(198 * var(--u));
  border-color: #0f1010;
}

.res-thumb image {
  width: 100%;
  height: 100%;
}

.res-panel {
  position: relative;
  z-index: 1;
  width: calc(984 * var(--u));
  margin: calc(32 * var(--u)) auto 0;
}

.res-tip {
  height: calc(80 * var(--u));
  padding: 0 calc(40 * var(--u));
  background: #191919;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  font-size: calc(28 * var(--u));
}

.res-tip__arrow {
  width: calc(35 * var(--u));
  height: calc(24 * var(--u));
  flex-shrink: 0;
}

.res-style {
  margin-top: calc(-16 * var(--u));
  background: #fff;
  border: calc(2 * var(--u)) solid #191919;
  border-radius: calc(60 * var(--u));
  padding: calc(32 * var(--u)) calc(32 * var(--u)) calc(40 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(32 * var(--u));
  box-sizing: border-box;
}

.res-style__head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(24 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 900;
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
}

.res-style__star {
  width: calc(26 * var(--u));
  height: calc(29 * var(--u));
}

.res-style__tags {
  width: calc(816 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(24 * var(--u));
}

.res-style__tag {
  padding: calc(24 * var(--u)) calc(60 * var(--u));
  border-radius: calc(60 * var(--u));
  background: #f7f7f7;
  font-size: calc(26 * var(--u));
  font-weight: 500;
  color: #333;
}

.res-style__tag.is-on {
  background: #191919;
  color: #fff;
  font-weight: 700;
}

.res-actions {
  position: relative;
  z-index: 1;
  width: calc(984 * var(--u));
  margin: calc(32 * var(--u)) auto 0;
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.res-actions__ghost,
.res-actions__solid {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.res-actions__ghost {
  background: #fff;
  border: calc(2 * var(--u)) solid #d9d9d9;
  color: #0f1010;
  box-sizing: border-box;
}

.res-actions__ghost.is-busy {
  opacity: 0.55;
}

.res-actions__solid {
  background: #191919;
  color: #fff;
}
</style>
