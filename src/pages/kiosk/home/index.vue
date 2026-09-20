<template>
  <view class="kiosk">
    <view class="kiosk__scroll">
      <view class="kiosk-hero">
        <swiper
          class="kiosk-hero__swiper"
          :indicator-dots="false"
          :circular="heroSlides.length > 1"
          :autoplay="heroSlides.length > 1"
          :interval="5000"
          :duration="400"
          @change="onHeroChange"
        >
          <swiper-item v-for="(slide, index) in heroSlides" :key="slide.id">
            <view class="kiosk-slide">
              <template v-if="slide.mode === 'ad'">
                <video
                  v-if="slide.mediaKind === 'video'"
                  class="kiosk-slide__media"
                  :src="slide.src"
                  :autoplay="index === heroPage"
                  :loop="true"
                  :muted="true"
                  :controls="false"
                  :show-center-play-btn="false"
                  object-fit="cover"
                />
                <image v-else class="kiosk-slide__media" :src="slide.src" mode="aspectFill" />
              </template>
              <template v-else>
                <image
                  class="kiosk-slide__model"
                  :class="{ 'kiosk-slide__model--inspire': slide.mode === 'inspire' }"
                  :src="slide.mode === 'inspire' ? IMAGES.heroModel2 : IMAGES.heroModel1"
                  mode="aspectFill"
                />
                <image
                  v-if="slide.mode === 'outfit'"
                  class="kiosk-slide__title"
                  :src="ICONS.titleAi"
                  mode="aspectFit"
                />
                <view v-else class="kiosk-script kiosk-script--hero">
                  <image class="kiosk-script__line" :src="ICONS.underline" mode="scaleToFill" />
                  <image class="kiosk-script__word" :src="IMAGES.scriptNail" mode="aspectFit" />
                  <image class="kiosk-script__spark" :src="ICONS.spark" mode="aspectFit" />
                </view>
                <text class="kiosk-slide__lead">{{
                  slide.mode === "outfit" ? "上传今日穿搭  生成专属美甲" : "选择关键词或上传照片 发现心动款式"
                }}</text>
                <view class="kiosk-slide__rule" />
                <view class="kiosk-steps">
                  <view
                    v-for="(step, stepIndex) in slide.mode === 'outfit' ? OUTFIT_STEPS : INSPIRE_STEPS"
                    :key="step.label"
                    class="kiosk-steps__item"
                  >
                    <image
                      v-if="stepIndex > 0"
                      class="kiosk-steps__chevron"
                      :src="ICONS.chevron"
                      mode="aspectFit"
                    />
                    <view class="kiosk-steps__cell">
                      <image class="kiosk-steps__icon" :src="step.icon" mode="aspectFit" />
                      <text class="kiosk-steps__label">{{ step.label }}</text>
                    </view>
                  </view>
                </view>
              </template>
              <view v-if="slide.mode !== 'ad'" class="kiosk-brand">
                <image class="kiosk-brand__logo" :src="ICONS.logo" mode="aspectFit" />
                <image class="kiosk-brand__sub" :src="ICONS.logoSub" mode="aspectFit" />
              </view>
            </view>
          </swiper-item>
        </swiper>
        <view class="kiosk-hero__fade" />
        <view class="kiosk-hero__dots">
          <view
            v-for="(slide, index) in heroSlides"
            :key="slide.id"
            class="kiosk-hero__dot"
            :class="{ 'is-active': index === heroPage }"
          />
        </view>
      </view>

      <view class="kiosk-cards">
        <view class="kiosk-card kiosk-card--dark" hover-class="none" @click="onGenerate">
          <image class="kiosk-card__model" :src="IMAGES.heroModel1" mode="aspectFill" />
          <view class="kiosk-card__scrim" />
          <image class="kiosk-card__brand" :src="IMAGES.ailookLogo" mode="aspectFit" />
          <view class="kiosk-card__copy kiosk-card__copy--light">
            <text>上传今日穿搭</text>
            <text>生成专属美甲</text>
          </view>
          <view class="kiosk-cta kiosk-cta--light">
            <image class="kiosk-cta__icon" :src="ICONS.wandDark" mode="aspectFit" />
            <text>立即生成</text>
          </view>
        </view>

        <view class="kiosk-card kiosk-card--light" hover-class="none" @click="onInspire">
          <image
            class="kiosk-card__model kiosk-card__model--inspire"
            :src="IMAGES.heroModel2"
            mode="aspectFill"
          />
          <view class="kiosk-script kiosk-script--card">
            <image class="kiosk-script__line" :src="ICONS.underline" mode="scaleToFill" />
            <image class="kiosk-script__word" :src="IMAGES.scriptNail" mode="aspectFit" />
            <image class="kiosk-script__spark" :src="ICONS.spark" mode="aspectFit" />
          </view>
          <view class="kiosk-card__copy kiosk-card__copy--muted">
            <text>上传照片或选关键词</text>
            <text>发现心动款式</text>
          </view>
          <view class="kiosk-cta kiosk-cta--dark">
            <image class="kiosk-cta__icon" :src="ICONS.wandLight" mode="aspectFit" />
            <text>寻找款式</text>
          </view>
        </view>
      </view>

      <view class="kiosk-products">
        <view class="kiosk-products__head">
          <view class="kiosk-products__title">
            <image class="kiosk-products__title-img" :src="ICONS.titleRecommend" mode="aspectFit" />
          </view>
          <view class="kiosk-products__more" hover-class="none" @click="onMore">
            <text class="kiosk-products__more-text">更多精选</text>
            <image class="kiosk-products__more-icon" :src="ICONS.more" mode="aspectFit" />
          </view>
        </view>
		<swiper class="kiosk-products-swiper" :autoplay="recommendedProducts.length > 1">
			<swiper-item v-for="(productRow, rowIndex) in recommendedProducts" :key="rowIndex" class="kiosk-swiper-item">
				<view class="kiosk-products__inner">
				  <view v-for="product in productRow" :key="product.id" class="kiosk-products__cell">
				    <kiosk-product-card
				      :product="product"
				      size="rail"
				      :show-action="true"
				      @click="openKioskProduct(product.id)"
				    />
				  </view>
				</view>
			</swiper-item>
		</swiper>
        <!-- <scroll-view class="kiosk-products__rail" scroll-x :show-scrollbar="false">
          <view class="kiosk-products__inner">
            <view v-for="product in recommendedProducts" :key="product.id" class="kiosk-products__cell">
              <kiosk-product-card
                :product="product"
                size="rail"
                :show-action="true"
                @click="openKioskProduct(product.id)"
              />
            </view>
          </view>
        </scroll-view> -->
      </view>
    </view>

    <view class="kiosk-footer">
      <view class="kiosk-footer__addr">
        <image class="kiosk-footer__pin" :src="ICONS.pin" mode="aspectFit" />
        <text class="kiosk-footer__addr-text">{{ DEFAULT_STORE_ADDRESS }}</text>
      </view>
      <view class="kiosk-footer__admin" hover-class="none" @click="onAdmin">
        <image class="kiosk-footer__admin-icon" :src="ICONS.admin" mode="aspectFit" />
        <text>管理员登录</text>
      </view>
    </view>

    <view v-if="unauthorized" class="kiosk-lock">
      <text class="kiosk-lock__msg">{{ unauthorizedMessage }}</text>
      <view class="kiosk-lock__admin" hover-class="none" @click="onAdmin">
        <text>管理员登录</text>
      </view>
    </view>

    <view v-if="showSheet" class="inspire-mask" @click="closeSheet">
      <view class="inspire-sheet" @click.stop>
        <view class="inspire-sheet__head">
          <text class="inspire-sheet__title">选择生成类型</text>
          <view class="inspire-sheet__close" hover-class="none" @click="closeSheet">
            <image :src="SHEET.close" mode="aspectFit" />
          </view>
        </view>
        <view class="inspire-sheet__list">
          <view class="inspire-row" hover-class="none" @click="openOutfitUpload">
            <view class="inspire-row__left">
              <view class="inspire-row__icon">
                <image class="inspire-row__upload" :src="SHEET.upload" mode="aspectFit" />
              </view>
              <view class="inspire-row__copy">
                <text class="inspire-row__name">上传穿搭图</text>
                <text class="inspire-row__desc">AI结合穿搭风格，推荐店铺在售现有美甲款式</text>
              </view>
            </view>
            <image class="inspire-row__chevron" :src="SHEET.chevron" mode="aspectFit" />
          </view>
          <view class="inspire-row" hover-class="none" @click="openKeywords">
            <view class="inspire-row__left">
              <view class="inspire-row__icon">
                <view class="inspire-kw">
                  <image class="inspire-kw__3" :src="SHEET.kw3" mode="aspectFit" />
                  <image class="inspire-kw__2" :src="SHEET.kw2" mode="aspectFit" />
                  <image class="inspire-kw__1" :src="SHEET.kw1" mode="aspectFit" />
                  <image class="inspire-kw__4" :src="SHEET.kw4" mode="aspectFit" />
                  <image class="inspire-kw__5" :src="SHEET.kw5" mode="aspectFit" />
                  <image class="inspire-kw__6" :src="SHEET.kw6" mode="aspectFit" />
                  <image class="inspire-kw__7" :src="SHEET.kw7" mode="aspectFit" />
                </view>
              </view>
              <view class="inspire-row__copy">
                <text class="inspire-row__name">输入描述/选择关键词</text>
                <text class="inspire-row__desc">基于关键词或文字描述，为您匹配门店现货款式</text>
              </view>
            </view>
            <image class="inspire-row__chevron" :src="SHEET.chevron" mode="aspectFit" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskProductCard from "@/components/kiosk/kiosk-product-card.vue";
import {
  DEFAULT_STORE_ADDRESS,
  HOME_SLIDES,
  INSPIRE_STEPS,
  OUTFIT_STEPS,
  type HomeProduct,
} from "@/data/home";
import { INSPIRE_MODE_KEY } from "@/data/inspire";
import {
  openKioskProduct,
  peekListedProducts,
  recommendedHomeProducts,
  refreshListedCatalog,
} from "@/data/kiosk-catalog";
import { DEVICE_UNAUTHORIZED_MESSAGE } from "@/lib/device-auth";
import { resolveKioskAuth } from "@/lib/kiosk-auth";
import { ADMIN_PAGES, KIOSK_PAGES } from "@/lib/kiosk-routes";
import { fetchDeviceBanners, type ScreenBanner } from "@/lib/screen-api/banners";
import { discardUploadDraft, scanUploadUrl } from "@/lib/upload-flow";
import deviceConfig from "@/device.json";

type HeroSlide = {
  id: string;
  mode: "ad" | "outfit" | "inspire";
  src?: string;
  mediaKind?: "image" | "video";
};

const IMAGES = {
  heroModel1: "/static/images/hero-model-1.png",
  heroModel2: "/static/images/hero-model-2.png",
  scriptNail: "/static/images/script-nail.png",
  ailookLogo: "/static/images/card-ailook-logo.png",
};

const ICONS = {
  logo: "/static/icons/logo-nailook.svg",
  logoSub: "/static/icons/logo-subtitle.svg",
  titleAi: "/static/icons/title-ai.svg",
  underline: "/static/icons/script-underline.svg",
  spark: "/static/icons/script-spark.svg",
  chevron: "/static/icons/chevron.svg",
  wandDark: "/static/icons/wand-dark.svg",
  wandLight: "/static/icons/wand-light.svg",
  titleRecommend: "/static/icons/title-recommend.svg",
  more: "/static/icons/more-arrow.svg",
  pin: "/static/icons/pin.svg",
  admin: "/static/icons/admin.svg",
};

const SHEET = {
  close: "/static/sheet/close.svg",
  upload: "/static/sheet/icon-upload.svg",
  chevron: "/static/sheet/chevron.svg",
  kw1: "/static/sheet/kw-1.svg",
  kw2: "/static/sheet/kw-2.svg",
  kw3: "/static/sheet/kw-3.svg",
  kw4: "/static/sheet/kw-4.svg",
  kw5: "/static/sheet/kw-5.svg",
  kw6: "/static/sheet/kw-6.svg",
  kw7: "/static/sheet/kw-7.svg",
};

const heroPage = ref(0);
const showSheet = ref(false);
const unauthorized = ref(false);
const unauthorizedMessage = ref(DEVICE_UNAUTHORIZED_MESSAGE);
const listedBanners = ref<HeroSlide[]>([]);
const recommendedProducts = ref<HomeProduct[][]>([]);
// const recommendedProducts = ref<HomeProduct[]>(recommendedHomeProducts(peekListedProducts()));
const deviceInfo = reactive({})

const fallbackSlides: HeroSlide[] = HOME_SLIDES.map((slide, index) => ({
  id: `home-${index}`,
  mode: slide.kind,
}));

const heroSlides = computed(() => (listedBanners.value.length ? listedBanners.value : fallbackSlides));

onShow(() => {
  checkAuthorized();
});

function chunk<T>(arr: T[], n: number): T[][] {
  if (!Array.isArray(arr) || n <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    result.push(arr.slice(i, i + n));
  }
  return result;
}

async function checkAuthorized() {
  const state = await resolveKioskAuth();
  unauthorized.value = state === "unauthorized";
  if (unauthorized.value) {
    showSheet.value = false;
    listedBanners.value = [];
    recommendedProducts.value = [];
    heroPage.value = 0;
    return;
  }
  await Promise.all([loadBanners(), loadRecommendedProducts()]);
}

async function loadBanners() {
  try {
    const rows = await fetchDeviceBanners();
    listedBanners.value = toListedBannerSlides(rows);
    if (heroPage.value >= heroSlides.value.length) {
      heroPage.value = 0;
    }
  } catch {
    listedBanners.value = [];
  }
}

async function loadRecommendedProducts() {
  recommendedProducts.value = chunk(recommendedHomeProducts(peekListedProducts()), 3);
  // recommendedProducts.value = chunk(recommendedHomeProducts(peekListedProducts()), 3);
  try {
    const cache = await refreshListedCatalog();
  } catch {
    /* keep cached rail */
  }
}

function toListedBannerSlides(rows?: ScreenBanner[] | null): HeroSlide[] {
  const slides: HeroSlide[] = [];
  (rows || []).forEach((row, index) => {
    if ((row.openDeviceConfig || "").toLowerCase() !== "yes") {
      return;
    }
    const src = (row.previewUrl || "").trim();
    if (!src) {
      return;
    }
    slides.push({
      id: row.configId || `banner-${index}`,
      mode: "ad",
      src,
      mediaKind: row.displayForm === "video_dynamic" ? "video" : "image",
    });
  });
  return slides;
}

function onHeroChange(event: { detail: { current: number } }) {
  heroPage.value = event.detail.current;
}

function onGenerate() {
  if (unauthorized.value) {
    return;
  }
  uni.removeStorageSync(INSPIRE_MODE_KEY);
  discardUploadDraft("outfit");
  uni.navigateTo({ url: scanUploadUrl("outfit") });
}

function onInspire() {
  if (unauthorized.value) {
    return;
  }
  showSheet.value = true;
}

function closeSheet() {
  showSheet.value = false;
}

function openOutfitUpload() {
  if (unauthorized.value) {
    return;
  }
  uni.setStorageSync(INSPIRE_MODE_KEY, "outfit");
  showSheet.value = false;
  discardUploadDraft("inspire");
  uni.navigateTo({ url: scanUploadUrl("inspire") });
}

function openKeywords() {
  if (unauthorized.value) {
    return;
  }
  uni.setStorageSync(INSPIRE_MODE_KEY, "keyword");
  showSheet.value = false;
  uni.navigateTo({ url: KIOSK_PAGES.keywords });
}

function onMore() {
  if (unauthorized.value) {
    return;
  }
  uni.navigateTo({ url: KIOSK_PAGES.products });
}

function onAdmin() {
  uni.navigateTo({ url: ADMIN_PAGES.login });
}
</script>

<style>
.kiosk {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  height: 100%;
  min-height: 100%;
  margin: 0 auto;
  background: #f0f0f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.kiosk__scroll {
  flex: 1;
  height: 0;
  overflow-y: auto;
  padding-bottom: calc(24 * var(--u));
}

.kiosk-hero {
  position: relative;
  height: calc(669 * var(--u));
  overflow: hidden;
}

.kiosk-hero__swiper {
  height: 100%;
}

.kiosk-hero__fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(232 * var(--u));
  background: linear-gradient(to bottom, rgba(240, 240, 240, 0), #f0f0f0);
  pointer-events: none;
  z-index: 1;
}

.kiosk-hero__dots {
  position: absolute;
  left: calc(51 * var(--u));
  top: calc(512 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
  z-index: 2;
}

.kiosk-hero__dot {
  width: calc(10 * var(--u));
  height: calc(10 * var(--u));
  border-radius: 50%;
  background: rgba(51, 51, 51, 0.2);
}

.kiosk-hero__dot.is-active {
  background: #333;
}

.kiosk-slide {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f0f0f0;
}

.kiosk-slide__media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.kiosk-slide__model {
  position: absolute;
  right: calc(-80 * var(--u));
  top: calc(-40 * var(--u));
  width: calc(720 * var(--u));
  height: calc(760 * var(--u));
  pointer-events: none;
}

.kiosk-slide__model--inspire {
  right: calc(-120 * var(--u));
  top: calc(-80 * var(--u));
  width: calc(780 * var(--u));
  height: calc(820 * var(--u));
}

.kiosk-brand {
  position: absolute;
  left: calc(46 * var(--u));
  top: calc(51 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(10 * var(--u));
  z-index: 1;
}

.kiosk-brand__logo {
  height: calc(24 * var(--u));
  width: calc(151 * var(--u));
}

.kiosk-brand__sub {
  height: calc(24 * var(--u));
  width: calc(121 * var(--u));
}

.kiosk-slide__title {
  position: absolute;
  left: calc(64 * var(--u));
  top: calc(141 * var(--u));
  width: calc(413 * var(--u));
  height: calc(89 * var(--u));
  z-index: 1;
}

.kiosk-slide__lead {
  position: absolute;
  left: calc(58 * var(--u));
  top: calc(280 * var(--u));
  font-size: calc(28 * var(--u));
  line-height: 1.316;
  color: #333;
  z-index: 1;
}

.kiosk-slide__rule {
  position: absolute;
  left: calc(58 * var(--u));
  top: calc(349 * var(--u));
  width: calc(71 * var(--u));
  height: calc(2 * var(--u));
  background: #333;
  z-index: 1;
}

.kiosk-steps {
  position: absolute;
  left: calc(58 * var(--u));
  top: calc(383 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(18 * var(--u));
  z-index: 1;
}

.kiosk-steps__item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(18 * var(--u));
}

.kiosk-steps__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(11 * var(--u));
}

.kiosk-steps__icon {
  width: calc(34 * var(--u));
  height: calc(34 * var(--u));
}

.kiosk-steps__label {
  font-size: calc(12.4 * var(--u));
  line-height: 1.316;
  color: #000;
}

.kiosk-steps__chevron {
  width: calc(8 * var(--u));
  height: calc(16 * var(--u));
  transform: rotate(180deg);
}

.kiosk-script {
  position: relative;
}

.kiosk-script--hero {
  position: absolute;
  left: calc(48 * var(--u));
  top: calc(150 * var(--u));
  width: calc(280 * var(--u));
  height: calc(110 * var(--u));
  z-index: 1;
}

.kiosk-script__line {
  position: absolute;
  top: calc(8 * var(--u));
  left: 0;
  width: calc(260 * var(--u));
  height: calc(80 * var(--u));
  transform: rotate(-13deg);
}

.kiosk-script__word {
  position: relative;
  display: block;
  width: calc(240 * var(--u));
  height: calc(96 * var(--u));
  margin: calc(18 * var(--u)) 0 0 calc(12 * var(--u));
}

.kiosk-script__spark {
  position: absolute;
  right: calc(8 * var(--u));
  top: calc(22 * var(--u));
  width: calc(16 * var(--u));
  height: calc(17 * var(--u));
}

.kiosk-cards {
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
  padding: 0 calc(48 * var(--u));
  margin-top: calc(-87 * var(--u));
  position: relative;
  z-index: 2;
}

.kiosk-card {
  position: relative;
  width: calc(480 * var(--u));
  height: calc(520 * var(--u));
  border-radius: calc(60 * var(--u));
  overflow: hidden;
}

.kiosk-card--dark {
  background: #191919;
}

.kiosk-card--light {
  background: #fff;
  box-sizing: border-box;
  border: calc(2 * var(--u)) solid #ebf1f4;
}

.kiosk-card__model {
  position: absolute;
  left: calc(209 * var(--u));
  top: calc(69 * var(--u));
  width: calc(409 * var(--u));
  height: calc(546 * var(--u));
  pointer-events: none;
}

.kiosk-card__model--inspire {
  left: calc(238 * var(--u));
  right: auto;
  top: calc(63 * var(--u));
  width: calc(348 * var(--u));
  height: calc(464 * var(--u));
}

.kiosk-card__scrim {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(25, 25, 25, 0.18);
  pointer-events: none;
}

.kiosk-card__brand {
  position: absolute;
  left: calc(34 * var(--u));
  top: calc(79 * var(--u));
  width: calc(271 * var(--u));
  height: calc(59 * var(--u));
  z-index: 1;
}

.kiosk-card--light .kiosk-script--card {
  position: absolute;
  left: calc(25 * var(--u));
  top: calc(43 * var(--u));
  width: calc(240 * var(--u));
  height: calc(110 * var(--u));
  margin: 0;
  z-index: 1;
}

.kiosk-card--light .kiosk-script__line {
  width: calc(242 * var(--u));
  height: calc(75 * var(--u));
  top: 0;
  left: calc(-10 * var(--u));
}

.kiosk-card--light .kiosk-script__word {
  width: calc(218 * var(--u));
  height: calc(87 * var(--u));
}

.kiosk-card--light .kiosk-script__spark {
  width: calc(10 * var(--u));
  height: calc(11 * var(--u));
  right: calc(4 * var(--u));
  top: calc(20 * var(--u));
}

.kiosk-card__copy {
  position: absolute;
  left: calc(34 * var(--u));
  top: calc(174 * var(--u));
  display: flex;
  flex-direction: column;
  font-size: calc(24 * var(--u));
  line-height: calc(36 * var(--u));
  z-index: 1;
}

.kiosk-card__copy--light {
  color: #fff;
}

.kiosk-card__copy--muted {
  left: calc(39 * var(--u));
  color: #777;
}

.kiosk-cta {
  position: absolute;
  left: calc(34 * var(--u));
  top: calc(352 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(12 * var(--u));
  width: calc(230 * var(--u));
  height: calc(72 * var(--u));
  border-radius: calc(107 * var(--u));
  font-size: calc(26 * var(--u));
  font-weight: 700;
  z-index: 1;
}

.kiosk-cta__icon {
  width: calc(29 * var(--u));
  height: calc(29 * var(--u));
}

.kiosk-cta--light {
  background: #fff;
  color: #2f2f2f;
}

.kiosk-cta--dark {
  background: #2f2f2f;
  color: #fff;
}

.kiosk-products {
  margin-top: calc(48 * var(--u));
}

.kiosk-products__head {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 calc(48 * var(--u));
  margin-bottom: calc(40 * var(--u));
}

.kiosk-products__title {
  width: calc(220 * var(--u));
  height: calc(60 * var(--u));
  flex-shrink: 0;
}

.kiosk-products__title-img {
  width: calc(220 * var(--u));
  height: calc(60 * var(--u));
}

.kiosk-products__more {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
  min-height: 44px;
}

.kiosk-products__more-text {
  font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  line-height: normal;
  color: #777;
}

.kiosk-products__more-icon {
  width: calc(24 * var(--u));
  height: calc(24 * var(--u));
}

.kiosk-products__rail {
  width: 100%;
  height: calc(460 * var(--u));
  white-space: nowrap;
}
.kiosk-products-swiper {
	width: calc(1080 * var(--u));
	margin: 0 auto;
	height: calc(460 * var(--u));
	overflow: hidden;
}
.kiosk-swiper-item {
	box-sizing: border-box;
	padding: 0 calc(48 * var(--u));
}
.kiosk-products__inner {
  display: inline-block;
  white-space: nowrap;
}

.kiosk-products__cell {
  display: inline-block;
  width: calc(312 * var(--u));
  margin-right: calc(24 * var(--u));
  vertical-align: top;
}

.kiosk-products__cell:last-child {
  margin-right: 0;
}

.kiosk-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: calc(120 * var(--u));
  padding: 0 calc(48 * var(--u));
  background: #fff;
  flex-shrink: 0;
}

.kiosk-footer__addr {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(8 * var(--u));
  min-width: 0;
  flex: 1;
}

.kiosk-footer__pin {
  width: calc(24 * var(--u));
  height: calc(32 * var(--u));
  flex-shrink: 0;
}

.kiosk-footer__addr-text {
  font-size: calc(26 * var(--u));
  font-weight: 700;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kiosk-footer__admin {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
  height: calc(76 * var(--u));
  padding: 0 calc(40 * var(--u));
  border: 1px solid #eee;
  border-radius: calc(149 * var(--u));
  background: #fff;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  flex-shrink: 0;
}

.kiosk-footer__admin-icon {
  width: calc(30 * var(--u));
  height: calc(30 * var(--u));
}

.inspire-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 20;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.inspire-sheet {
  width: 100%;
  background: #f2f3f5;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  padding: calc(48 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.inspire-sheet__head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.inspire-sheet__title {
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.inspire-sheet__close,
.inspire-sheet__close image {
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
}

.inspire-sheet__list {
  margin-top: calc(60 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(32 * var(--u));
}

.inspire-row {
  background: #fff;
  border-radius: calc(40 * var(--u));
  padding: calc(60 * var(--u)) calc(40 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.inspire-row__left {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(40 * var(--u));
  min-width: 0;
  flex: 1;
}

.inspire-row__icon {
  width: calc(100 * var(--u));
  height: calc(100 * var(--u));
  position: relative;
  flex-shrink: 0;
}

.inspire-row__upload {
  width: calc(84 * var(--u));
  height: calc(81 * var(--u));
  margin: calc(15 * var(--u)) 0 0 calc(11 * var(--u));
}

.inspire-kw {
  position: relative;
  width: calc(84 * var(--u));
  height: calc(81 * var(--u));
  margin: calc(15 * var(--u)) 0 0 calc(11 * var(--u));
}

.inspire-kw image {
  position: absolute;
}

.inspire-kw__1 {
  left: calc(45 * var(--u));
  top: calc(11 * var(--u));
  width: calc(31 * var(--u));
  height: calc(49 * var(--u));
}

.inspire-kw__2 {
  left: calc(37 * var(--u));
  top: calc(5 * var(--u));
  width: calc(31 * var(--u));
  height: calc(61 * var(--u));
}

.inspire-kw__3 {
  left: 0;
  top: 0;
  width: calc(61 * var(--u));
  height: calc(72 * var(--u));
}

.inspire-kw__4 {
  left: calc(1 * var(--u));
  top: calc(46 * var(--u));
  width: calc(60 * var(--u));
  height: calc(25 * var(--u));
}

.inspire-kw__5 {
  left: calc(10 * var(--u));
  top: calc(16 * var(--u));
  width: calc(40 * var(--u));
  height: calc(20 * var(--u));
}

.inspire-kw__6 {
  left: calc(45 * var(--u));
  top: calc(42 * var(--u));
  width: calc(39 * var(--u));
  height: calc(39 * var(--u));
}

.inspire-kw__7 {
  left: calc(45 * var(--u));
  top: calc(7 * var(--u));
  width: calc(6 * var(--u));
  height: calc(6 * var(--u));
}

.inspire-row__copy {
  display: flex;
  flex-direction: column;
  gap: calc(16 * var(--u));
  min-width: 0;
}

.inspire-row__name {
  font-size: calc(32 * var(--u));
  font-weight: 700;
  color: #333;
}

.inspire-row__desc {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
}

.inspire-row__chevron {
  width: calc(10 * var(--u));
  height: calc(20 * var(--u));
  flex-shrink: 0;
  margin-left: calc(24 * var(--u));
}

.kiosk-lock {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(15, 16, 16, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(48 * var(--u));
  box-sizing: border-box;
}

.kiosk-lock__msg {
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #fff;
  text-align: center;
  line-height: 1.5;
}

.kiosk-lock__admin {
  margin-top: calc(48 * var(--u));
  min-width: calc(320 * var(--u));
  height: calc(88 * var(--u));
  padding: 0 calc(40 * var(--u));
  border-radius: calc(44 * var(--u));
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(28 * var(--u));
  font-weight: 600;
  color: #333;
}
</style>
