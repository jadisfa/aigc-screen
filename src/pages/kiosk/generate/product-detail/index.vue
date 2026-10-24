<template>
  <view class="detail">
    <view class="detail-hero">
      <image v-if="hero" class="detail-hero__shot" :src="hero" mode="aspectFill" />
      <view class="detail-hero__bar">
        <kiosk-chip :icon="ASSETS.back" variant="shade" label="返回" @click="onBack" />
      </view>
      <view v-if="product && product.thumbs.length > 1" class="detail-thumbs">
        <view
          v-for="(src, index) in product.thumbs"
          :key="src + index"
          class="detail-thumb"
          :class="{ 'is-on': index === thumbIndex }"
          hover-class="none"
          @click="onThumb(index)"
        >
          <image :src="src" mode="aspectFill" />
        </view>
      </view>
      <view class="detail-contact">
        <image class="detail-contact__icon" :src="ASSETS.bag" mode="aspectFit" />
        <text>这款很心动？请联系店员购买</text>
      </view>
    </view>

    <view v-if="product" class="detail-sheet">
      <view class="detail-info">
        <view class="detail-price">
          <text class="detail-price__num">{{ product.price }}</text>
          <view class="detail-price__badge">
            <text>{{ product.exclusive }}</text>
          </view>
        </view>
        <text class="detail-info__title">{{ product.title }}</text>
        <view v-if="product.tags.length" class="detail-info__tags">
          <view v-for="(tag, index) in product.tags" :key="tag + index" class="detail-info__tag">
            <text>{{ tag }}</text>
          </view>
        </view>
      </view>

      <view v-if="product.specs.length" class="detail-specs">
        <view
          v-for="(spec, index) in product.specs"
          :key="spec.label"
          class="detail-specs__cell"
          :class="{ 'is-last': index === product.specs.length - 1 }"
        >
          <text class="detail-specs__label">{{ spec.label }}</text>
          <text class="detail-specs__value">{{ spec.value }}</text>
        </view>
      </view>

      <image v-if="product.promo" class="detail-promo" :src="product.promo" mode="aspectFill" />
    </view>

    <view v-else class="detail-empty">
      <text>{{ missing ? "商品不存在或已下架" : "商品加载中…" }}</text>
    </view>

    <view v-if="product" class="detail-foot">
      <view class="detail-foot__btn" hover-class="none" @click="onTryOn">
        <text>生成试戴效果</text>
        <image class="detail-foot__spark" :src="ASSETS.sparkle" mode="aspectFit" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import {
  findListedProduct,
  loadListedProduct,
  toKioskProductDetail,
  type KioskProductDetail,
} from "@/data/kiosk-catalog";
import { KIOSK_PAGES } from "@/lib/kiosk-routes";
import { showScreenError } from "@/lib/screen-http";
import { trackTryonEntry } from "@/lib/track-events";
import { writeTryOnLookId, writeTryOnNailUrl, clearTryOnHandSelection } from "@/data/try-on";
import { clearPreview } from "@/lib/upload-flow";

const ASSETS = {
  back: "/static/results/back-white.svg",
  bag: "/static/results/bag.svg",
  sparkle: "/static/results/sparkle.svg",
};

const productId = ref("");
const product = ref<KioskProductDetail | null>(null);
const missing = ref(false);
const thumbIndex = ref(0);
const hero = computed(() => product.value?.thumbs[thumbIndex.value] ?? product.value?.hero ?? "");

onLoad((query?: Record<string, string>) => {
  productId.value = query?.id || "";
  hydrate();
  loadProduct();
});

function hydrate() {
  const cached = findListedProduct(productId.value);
  if (cached) {
    product.value = toKioskProductDetail(cached);
    thumbIndex.value = 0;
  }
}

async function loadProduct() {
  if (!productId.value) {
    missing.value = true;
    return;
  }
  try {
    const item = await loadListedProduct(productId.value);
    product.value = toKioskProductDetail(item);
    thumbIndex.value = 0;
    missing.value = false;
  } catch (error) {
    if (!product.value) {
      missing.value = true;
      showScreenError(error, "商品详情加载失败");
    }
  }
}

function onBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack({
      delta: 1,
      fail: () => {
        uni.reLaunch({ url: KIOSK_PAGES.home });
      },
    });
    return;
  }
  uni.reLaunch({ url: KIOSK_PAGES.home });
}

function onThumb(index: number) {
  thumbIndex.value = index;
}

function onTryOn() {
  if (!product.value) {
    return;
  }
  const nail = hero.value || product.value.hero || product.value.thumbs[0] || "";
  trackTryonEntry();
  clearTryOnHandSelection();
  clearPreview("hand-model");
  writeTryOnLookId(product.value.id);
  writeTryOnNailUrl(nail);
  const pages = getCurrentPages();
  const previous = pages[pages.length - 2] as { route?: string } | undefined;
  if (previous?.route === "pages/kiosk/try-on/index") {
    uni.navigateBack({ delta: 1 });
    return;
  }
  uni.navigateTo({ url: `${KIOSK_PAGES.tryOn}?look=${encodeURIComponent(product.value.id)}` });
}
</script>

<style>
page {
  height: 100%;
  background: #fff;
}

.detail {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  position: relative;
  padding-bottom: calc(148 * var(--u));
  box-sizing: border-box;
}

.detail-hero {
  position: relative;
  width: calc(1080 * var(--u));
  height: calc(1080 * var(--u));
  background: #f7f7f7;
}

.detail-hero__shot {
  width: 100%;
  height: 100%;
}

.detail-hero__bar {
  position: absolute;
  left: calc(48 * var(--u));
  top: calc(32 * var(--u));
  z-index: 2;
}

.detail-thumbs {
  position: absolute;
  right: calc(48 * var(--u));
  top: calc(236 * var(--u));
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(32 * var(--u));
  filter: drop-shadow(0 0 calc(7.5 * var(--u)) rgba(0, 0, 0, 0.1));
}

.detail-thumb {
  width: calc(120 * var(--u));
  height: calc(120 * var(--u));
  border: calc(2 * var(--u)) solid #fff;
  border-radius: calc(32 * var(--u));
  overflow: hidden;
  box-sizing: border-box;
}

.detail-thumb.is-on {
  width: calc(140 * var(--u));
  height: calc(140 * var(--u));
  border-width: calc(3 * var(--u));
  border-color: #191919;
}

.detail-thumb image {
  width: 100%;
  height: 100%;
}

.detail-contact {
  position: absolute;
  left: calc(60 * var(--u));
  bottom: calc(60 * var(--u));
  z-index: 2;
  width: calc(960 * var(--u));
  height: calc(90 * var(--u));
  background: #191919;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(24 * var(--u));
  color: #fff;
  font-size: calc(32 * var(--u));
}

.detail-contact__icon {
  width: calc(40 * var(--u));
  height: calc(40 * var(--u));
  flex-shrink: 0;
}

.detail-sheet {
  position: relative;
  z-index: 3;
  margin-top: calc(-60 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  box-shadow: 0 calc(-40 * var(--u)) calc(40 * var(--u)) rgba(0, 0, 0, 0.1);
  padding: calc(40 * var(--u)) calc(48 * var(--u)) calc(32 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(32 * var(--u));
}

.detail-empty {
  padding: calc(80 * var(--u)) calc(48 * var(--u));
  text-align: center;
  font-size: calc(28 * var(--u));
  color: #989898;
}

.detail-info {
  width: calc(984 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(32 * var(--u));
}

.detail-price {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(24 * var(--u));
}

.detail-price__num {
  font-size: calc(60 * var(--u));
  font-weight: 700;
  color: #333;
  line-height: 1;
}

.detail-price__badge {
  padding: calc(10 * var(--u)) calc(24 * var(--u));
  background: #fbe7cc;
  border-radius: calc(71 * var(--u));
}

.detail-price__badge text {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #603700;
}

.detail-info__title {
  font-size: calc(46 * var(--u));
  font-weight: 800;
  color: #333;
  line-height: 1.2;
}

.detail-info__tags {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.detail-info__tag {
  padding: calc(10 * var(--u)) calc(24 * var(--u));
  border: calc(1 * var(--u)) solid #191919;
  border-radius: calc(71 * var(--u));
  box-sizing: border-box;
}

.detail-info__tag text {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
}

.detail-specs {
  width: calc(984 * var(--u));
  min-height: calc(188 * var(--u));
  background: #f7f7f7;
  border-radius: calc(40 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
}

.detail-specs__cell {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(32 * var(--u));
  border-right: calc(1 * var(--u)) solid #ddd;
  box-sizing: border-box;
  padding: calc(32 * var(--u)) calc(8 * var(--u));
}

.detail-specs__cell.is-last {
  border-right: none;
}

.detail-specs__label {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
}

.detail-specs__value {
  font-size: calc(30 * var(--u));
  font-weight: 500;
  color: #191919;
  text-align: center;
}

.detail-promo {
  width: calc(984 * var(--u));
  height: calc(893 * var(--u));
  border-radius: calc(40 * var(--u));
}

.detail-foot {
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

.detail-foot__btn {
  height: calc(100 * var(--u));
  background: #191919;
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

.detail-foot__spark {
  width: calc(28.8 * var(--u));
  height: calc(28.8 * var(--u));
  flex-shrink: 0;
}
</style>

