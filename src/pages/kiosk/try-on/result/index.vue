<template>
  <view class="fx">
    <view class="fx-hero">
      <image class="fx-hero__shot" :src="hero" mode="aspectFill" />
      <view class="fx-hero__bar">
        <kiosk-chip :icon="ASSETS.back" variant="shade" label="返回" @click="onBack" />
      </view>
      <view class="fx-save" hover-class="none" @click="openSave()">
        <image class="fx-save__qr" :src="saveQrSrc" :fade-show="true" mode="aspectFit" />
        <text>扫码保存</text>
      </view>
      <view v-if="look.id" class="fx-buy" hover-class="none" @click="onBuy">
        <image class="fx-buy__thumb" :src="look.buyThumb" mode="aspectFill" />
        <text class="fx-buy__price">{{ look.price }}</text>
        <text class="fx-buy__label">购买同款</text>
      </view>
      <view class="fx-compare" hover-class="none" @click="onCompare">
        <image class="fx-compare__icon" :src="ASSETS.compare" mode="aspectFit" />
        <text>试戴对比</text>
      </view>
    </view>

    <view class="fx-sheet">
      <text class="fx-sheet__label">更换手模</text>
      <view class="fx-sheet__grid">
        <view
          v-for="hand in hands"
          :key="hand.id"
          class="fx-hand"
          :class="{ 'is-on': pickedId === hand.id }"
          hover-class="none"
          @click="pickedId = hand.id"
        >
          <image class="fx-hand__shot" :src="hand.image" mode="aspectFill" />
          <image v-if="pickedId === hand.id" class="fx-hand__check" :src="ASSETS.check" mode="aspectFit" />
        </view>
      </view>
    </view>

    <view class="fx-foot">
      <view class="fx-foot__ghost" hover-class="none" @click="askHome">
        <image class="fx-foot__home" :src="ASSETS.home" mode="aspectFit" />
        <text>返回首页</text>
      </view>
      <view class="fx-foot__solid" :class="{ 'is-on': Boolean(pickedId) }" hover-class="none" @click="onRegen">
        <image class="fx-foot__regen" :src="ASSETS.regen" mode="aspectFit" />
        <text>再次生成</text>
      </view>
    </view>

    <view v-if="showSave" class="fx-mask" hover-class="none" @click="closeSave">
      <view class="fx-save-pop" @click.stop>
        <view class="fx-save-pop__frame">
          <image class="fx-save-pop__code" :src="saveQrSrc" mode="aspectFit" />
          <view class="fx-save-pop__c fx-save-pop__c--tl" />
          <view class="fx-save-pop__c fx-save-pop__c--tr" />
          <view class="fx-save-pop__c fx-save-pop__c--bl" />
          <view class="fx-save-pop__c fx-save-pop__c--br" />
        </view>
        <text class="fx-save-pop__hint">扫一扫二维码，保存图片至手机</text>
        <view class="fx-save-pop__close" hover-class="none" @click="closeSave">
          <text>关闭</text>
        </view>
      </view>
    </view>

    <kiosk-image-compare
      v-if="showCompare"
      :before="compareBefore"
      :after="compareAfter"
      @close="showCompare = false"
    />

  <KioskResultModal @gohome="onHome" @reGeneratge="handleReGenerate" />
  
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import KioskImageCompare from "@/components/kiosk/kiosk-image-compare.vue";
import {
  readTryOnImageUrl,
  readTryOnLookId,
  readTryOnResult,
  readTryOnTaskId,
  resolveLook,
  toKioskHands,
  writeTryOnHandId,
  writeTryOnImageUrl,
  type HandModel,
} from "@/data/try-on";
import { fetchHandModels } from "@/lib/screen-api/hand-models";
import { shareTryOnResult } from "@/lib/screen-api/experiences";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { showScreenError } from "@/lib/screen-http";
import { qrImageUrl } from "@/lib/scan-session";
import { trackTryonSubmit } from "@/lib/track-events";
import { readPreview } from "@/lib/upload-flow";
import KioskResultModal from "@/components/kiosk/kiosk-result-modal.vue";

const ASSETS = {
  back: "/static/results/back-white.svg",
  saveQr: "/static/tryon/save-qr.png",
  compare: "/static/results/compare.svg",
  check: "/static/scan/badge-ok.svg",
  home: "/static/tryon/home.svg",
  regen: "/static/tryon/regen.svg",
  cornerTr: "/static/scan/corner-tr.svg",
  cornerTl: "/static/scan/corner-tl.svg",
};

const look = computed(() => resolveLook(readTryOnLookId()));
const hero = ref(readTryOnResult());
const hands = ref<HandModel[]>([]);
const pickedId = ref("");
const showHomeConfirm = ref(false);
const showSave = ref(false);
const showCompare = ref(false);
const compareBefore = ref("");
const compareAfter = ref("");
const saveQrSrc = ref("");

onShow(() => {
  hero.value = readTryOnResult();
  openSave(1);
  loadHands();
});

async function loadHands() {
  try {
    hands.value = toKioskHands(await fetchHandModels());
  } catch (error) {
    showScreenError(error, "手模加载失败");
  }
}

async function onBack() {
  // goBackOr(KIOSK_PAGES.tryOn);
  try {
	  await openSave(1)
	  if (saveQrSrc.value.length > 0) {
		  (uni as any).$ResultModal.load("返回现有照片将被清除，是否继续？", "", "返回首页",  0, 200000, saveQrSrc.value)
	  }
  } catch (err) {
	  
  }
}

function onBuy() {
  if (!look.value.id) {
    return;
  }
  uni.navigateTo({ url: `${KIOSK_PAGES.productDetail}?id=${encodeURIComponent(look.value.id)}` });
}

function onCompare() {
  const before = readTryOnImageUrl() || readPreview("hand-model");
  const after = hero.value;
  if (!before) {
    uni.showToast({ title: "请先选择或上传手模图", icon: "none" });
    return;
  }
  if (!after) {
    uni.showToast({ title: "暂无试戴效果", icon: "none" });
    return;
  }
  compareBefore.value = before;
  compareAfter.value = after;
  showCompare.value = true;
}

async function openSave(val?: any) {
  const taskId = readTryOnTaskId().trim();
  if (!taskId) {
    uni.showToast({ title: "暂无试戴结果", icon: "none" });
    return;
  }
  try {
    const issued = await shareTryOnResult(taskId);
    if (!issued.h5Url) {
      uni.showToast({ title: "保存链接生成失败", icon: "none" });
      return;
    }
    saveQrSrc.value = await qrImageUrl(issued.h5Url, 640);
    if (!val) showSave.value = true;
  } catch (error) {
    showScreenError(error, "保存链接生成失败");
  }
}

function closeSave() {
  showSave.value = false;
}

function askHome() {
	(uni as any).$ResultModal.load("返回现有照片将被清除，是否继续？", "", "返回首页",  0, 200000, saveQrSrc.value)
}

function closeHomeConfirm() {
  showHomeConfirm.value = false;
}

function onHome() {
  uni.reLaunch({ url: KIOSK_PAGES.home });
}

function onRegen() {
	if (!pickedId.value) {
	  return;
	}
	const image = hands.value.find((item) => item.id === pickedId.value)?.image;
	if (!image) {
	  return;
	}
  (uni as any).$ResultModal.load("再次生成现有照片将被清除，是否继续？", "", "再次生成",  1, 200000, saveQrSrc.value);
}

const handleReGenerate = () => {
	const image = hands.value.find((item) => item.id === pickedId.value)?.image;
	trackTryonSubmit();
	writeTryOnHandId(pickedId.value);
	writeTryOnImageUrl(image);
	uni.redirectTo({
		url: `${KIOSK_PAGES.tryOnWait}?next=${encodeURIComponent(KIOSK_PAGES.tryOnResult)}`,
	});
}
</script>

<style>
page {
  height: 100%;
  background: #fff;
}

.fx {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  position: relative;
  padding-bottom: calc(148 * var(--u));
  box-sizing: border-box;
}

.fx-hero {
  position: relative;
  width: calc(1080 * var(--u));
  height: calc(1080 * var(--u));
}

.fx-hero__shot {
  width: 100%;
  height: 100%;
}

.fx-hero__bar {
  position: absolute;
  left: calc(48 * var(--u));
  top: calc(32 * var(--u));
  z-index: 2;
}

.fx-save {
  position: absolute;
  right: calc(40 * var(--u));
  top: calc(398 * var(--u));
  width: calc(120 * var(--u));
  background: #fff;
  border-radius: calc(32 * var(--u));
  padding: calc(20 * var(--u)) calc(10 * var(--u)) calc(16 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(10 * var(--u));
  box-sizing: border-box;
  z-index: 2;
}

.fx-save__qr {
  width: calc(82 * var(--u));
  height: calc(82 * var(--u));
}

.fx-save text {
  font-size: calc(20 * var(--u));
  font-weight: 500;
  color: #777;
}

.fx-buy {
  position: absolute;
  right: calc(40 * var(--u));
  top: calc(586 * var(--u));
  width: calc(120 * var(--u));
  background: #fff;
  border-radius: calc(32 * var(--u));
  padding: calc(10 * var(--u)) calc(10 * var(--u)) calc(16 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  z-index: 2;
}

.fx-buy__thumb {
  width: calc(100 * var(--u));
  height: calc(100 * var(--u));
  border-radius: calc(22 * var(--u));
}

.fx-buy__price {
  margin-top: calc(10 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 700;
  color: #333;
}

.fx-buy__label {
  margin-top: calc(8 * var(--u));
  font-size: calc(20 * var(--u));
  font-weight: 500;
  color: #777;
}

.fx-compare {
  position: absolute;
  right: calc(40 * var(--u));
  bottom: calc(91 * var(--u));
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
  z-index: 2;
}

.fx-compare__icon {
  width: calc(34 * var(--u));
  height: calc(40 * var(--u));
}

.fx-sheet {
  position: relative;
  z-index: 3;
  margin-top: calc(-59 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  padding: calc(40 * var(--u)) calc(48 * var(--u)) calc(32 * var(--u));
}

.fx-sheet__label {
  font-size: calc(36 * var(--u));
  font-weight: 500;
  color: #777;
}

.fx-sheet__grid {
  margin-top: calc(38 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.fx-hand {
  position: relative;
  width: calc(312 * var(--u));
  height: calc(312 * var(--u));
  border-radius: calc(40 * var(--u));
  overflow: hidden;
  box-sizing: border-box;
}

.fx-hand.is-on {
  border: calc(4 * var(--u)) solid #191919;
}

.fx-hand__shot {
  width: 100%;
  height: 100%;
}

.fx-hand__check {
  position: absolute;
  top: calc(24 * var(--u));
  right: calc(24 * var(--u));
  width: calc(40 * var(--u));
  height: calc(40 * var(--u));
}

.fx-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 10;
  width: calc(1080 * var(--u));
  margin-left: calc(-540 * var(--u));
  padding: calc(24 * var(--u)) calc(48 * var(--u));
  background: #fff;
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
  box-sizing: border-box;
}

.fx-foot__ghost,
.fx-foot__solid {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  box-sizing: border-box;
}

.fx-foot__ghost {
  background: #fff;
  border: calc(2 * var(--u)) solid #d9d9d9;
  color: #333;
}

.fx-foot__solid {
  background: rgba(25, 25, 25, 0.2);
  color: #fff;
}

.fx-foot__solid.is-on {
  background: #191919;
}

.fx-foot__home {
  width: calc(29.5 * var(--u));
  height: calc(32 * var(--u));
  flex-shrink: 0;
}

.fx-foot__regen {
  width: calc(30 * var(--u));
  height: calc(30 * var(--u));
  flex-shrink: 0;
}

.fx-mask {
  position: fixed;
  left: 50%;
  top: 0;
  bottom: 0;
  z-index: 30;
  width: calc(1080 * var(--u));
  margin-left: calc(-540 * var(--u));
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fx-dialog {
  width: calc(816 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u));
  padding: calc(60 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.fx-dialog__title {
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
  text-align: center;
  line-height: 1.4;
}

.fx-dialog__qr {
  position: relative;
  width: calc(420 * var(--u));
  height: calc(420 * var(--u));
  margin-top: calc(56 * var(--u));
}

.fx-dialog__code {
  position: absolute;
  left: calc(50 * var(--u));
  top: calc(50 * var(--u));
  width: calc(320 * var(--u));
  height: calc(320 * var(--u));
}

.fx-dialog__corner {
  position: absolute;
  width: calc(68 * var(--u));
  height: calc(68 * var(--u));
}

.fx-dialog__corner--tr {
  top: 0;
  right: 0;
}

.fx-dialog__corner--tl {
  top: 0;
  left: 0;
  transform: scaleX(-1);
}

.fx-dialog__corner--bl {
  bottom: 0;
  left: 0;
  transform: rotate(180deg);
}

.fx-dialog__corner--br {
  bottom: 0;
  right: 0;
  transform: rotate(180deg) scaleX(-1);
}

.fx-dialog__hint {
  margin-top: calc(32 * var(--u));
  font-size: calc(32 * var(--u));
  color: #333;
  text-align: center;
}

.fx-dialog__actions {
  margin-top: calc(72 * var(--u));
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.fx-dialog__cancel,
.fx-dialog__ok {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  box-sizing: border-box;
}

.fx-dialog__cancel {
  background: #fff;
  border: calc(3 * var(--u)) solid #191919;
  color: #191919;
}

.fx-dialog__ok {
  background: #191919;
  color: #fff;
}

.fx-dialog__home {
  width: calc(29.5 * var(--u));
  height: calc(32 * var(--u));
  flex-shrink: 0;
  filter: brightness(0) invert(1);
}

.fx-save-pop {
  width: calc(640 * var(--u));
  background: #fff;
  border-radius: calc(48 * var(--u));
  padding: calc(48 * var(--u)) calc(48 * var(--u)) calc(40 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.fx-save-pop__frame {
  position: relative;
  width: calc(460 * var(--u));
  height: calc(460 * var(--u));
}

.fx-save-pop__code {
  position: absolute;
  left: calc(28 * var(--u));
  top: calc(28 * var(--u));
  width: calc(404 * var(--u));
  height: calc(404 * var(--u));
  background: #fff;
}

.fx-save-pop__c {
  position: absolute;
  width: calc(96 * var(--u));
  height: calc(96 * var(--u));
  box-sizing: border-box;
  border-style: solid;
  border-color: #191919;
  pointer-events: none;
}

.fx-save-pop__c--tl {
  top: 0;
  left: 0;
  border-width: calc(4 * var(--u)) 0 0 calc(4 * var(--u));
  border-top-left-radius: calc(40 * var(--u));
}

.fx-save-pop__c--tr {
  top: 0;
  right: 0;
  border-width: calc(4 * var(--u)) calc(4 * var(--u)) 0 0;
  border-top-right-radius: calc(40 * var(--u));
}

.fx-save-pop__c--bl {
  bottom: 0;
  left: 0;
  border-width: 0 0 calc(4 * var(--u)) calc(4 * var(--u));
  border-bottom-left-radius: calc(40 * var(--u));
}

.fx-save-pop__c--br {
  right: 0;
  bottom: 0;
  border-width: 0 calc(4 * var(--u)) calc(4 * var(--u)) 0;
  border-bottom-right-radius: calc(40 * var(--u));
}

.fx-save-pop__hint {
  margin-top: calc(28 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 400;
  color: #333;
  text-align: center;
}

.fx-save-pop__close {
  margin-top: calc(36 * var(--u));
  width: 100%;
  height: calc(96 * var(--u));
  border-radius: calc(48 * var(--u));
  background: #191919;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #fff;
  box-sizing: border-box;
}
</style>
