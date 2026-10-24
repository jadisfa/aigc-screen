<template>
  <view class="ver">
    <view class="ver__bar">
      <kiosk-chip :icon="ASSETS.back" label="版本信息" @click="onBack" />
    </view>

    <view class="ver-hero">
      <image v-if="phase !== 'latest'" class="ver-hero__blob" :src="ASSETS.blob" mode="aspectFit" />
      <image
        class="ver-hero__icon"
        :class="{ 'is-latest': phase === 'latest' }"
        :src="phase === 'latest' ? ASSETS.latest : ASSETS.up"
        mode="aspectFit"
      />
    </view>

    <template v-if="phase === 'latest'">
      <text class="ver__title">已是最新版本</text>
      <text class="ver__sub">当前版本：{{ version.current }}</text>
    </template>

    <template v-else-if="phase === 'available'">
      <text class="ver__title">有1个新版本可升级</text>
      <text class="ver__sub">当前版本：{{ version.current }}</text>
      <view class="ver__btn ver__btn--solid" hover-class="none" @click="startUpdate">
        <text>立即更新</text>
      </view>
    </template>

    <template v-else>
      <view class="ver-prog">
        <view class="ver-prog__track">
          <view class="ver-prog__fill" :style="{ width: `${progress}%` }" />
        </view>
        <text class="ver-prog__num">{{ progress }}%</text>
      </view>
      <text class="ver__sub">当前版本：{{ version.current }}</text>
      <view class="ver__btn ver__btn--ghost" hover-class="none" @click="pauseUpdate">
        <text>暂停更新</text>
      </view>
    </template>

    <view class="ver-notes">
      <text class="ver-notes__title">
        {{ phase === "latest" ? `当前版本${version.current}` : `待更新版本${version.next}` }}
      </text>
      <text v-if="phase !== 'latest'" class="ver-notes__line">安装包大小：{{ version.size }}</text>
      <text class="ver-notes__line">更新内容：</text>
      <text v-for="(line, idx) in version.notes" :key="idx" class="ver-notes__line">{{ line }}</text>
    </view>

    <view v-if="showModal" class="ver-mask" hover-class="none" @click="skipModal">
      <view class="ver-modal" @click.stop>
        <view class="ver-modal__hero">
          <image class="ver-modal__art" :src="ASSETS.latest" mode="aspectFit" />
        </view>
        <text class="ver-modal__title">有新版本可升级</text>
        <text class="ver-modal__head">待更新版本{{ version.next }}</text>
        <text class="ver-modal__line">安装包大小：{{ version.size }}</text>
        <text class="ver-modal__line">更新内容：</text>
        <text v-for="line in version.notes" :key="line" class="ver-modal__line">{{ line }}</text>
        <view class="ver-modal__acts">
          <view class="ver-modal__later" hover-class="none" @click="skipModal">
            <text>以后再说</text>
          </view>
          <view class="ver-modal__now" hover-class="none" @click="upgradeNow">
            <text>立即升级</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { onUnmounted, reactive, ref } from "vue";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import type { VersionPhase } from "@/data/version";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import {
  checkOtaUpdate,
  commitLocalScreenVersion,
  formatOtaSize,
  openOtaPackage,
  splitOtaNotes,
} from "@/lib/ota-upgrade";
import { formatLocalScreenVersion, readLocalScreenChangelog, resolveLocalScreenVersionNo, writeLocalScreenChangelog } from "@/lib/screen-version";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  blob: "/static/admin/store-blob.svg",
  up: "/static/admin/version-up.svg",
  latest: "/static/admin/version-latest.svg",
};

const version = reactive({
  current: formatLocalScreenVersion(resolveLocalScreenVersionNo()),
  next: "--",
  size: "--",
  notes: splitOtaNotes(readLocalScreenChangelog()),
  accessUrl: "",
});
const phase = ref<VersionPhase>("latest");
const progress = ref(0);
const showModal = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
let latestUrl = "";
let latestVersionNo: number | null = null;
let latestChangelog = "";

onShow(() => {
	const appInfo = uni.getAppBaseInfo();
	console.log(appInfo.appVersionCode)
  loadVersion();
});

onUnmounted(() => {
  stopTimer();
});

async function loadVersion() {
  try {
    const result = await checkOtaUpdate(true, true);
    const localNo = resolveLocalScreenVersionNo();
    version.current = formatLocalScreenVersion(localNo);
    if (!result.latest || !result.latest.versionName) {
      phase.value = "latest";
      showModal.value = false;
      version.notes = splitOtaNotes(readLocalScreenChangelog());
      return;
    }
    version.next = result.latest.versionName;
    version.size = formatOtaSize(result.latest.fileSize);
    latestUrl = result.latest.accessUrl || "";
    latestVersionNo = result.latest.versionNo ?? null;
    latestChangelog = result.latest.changelog || "";
    if (result.hasUpdate) {
      version.notes = splitOtaNotes(result.latest.changelog);
      phase.value = "available";
      showModal.value = result.kind === "optional";
      return;
    }
    if (result.latest.versionNo === localNo) {
      writeLocalScreenChangelog(result.latest.changelog || "");
    }
    version.notes = splitOtaNotes(readLocalScreenChangelog());
    phase.value = "latest";
    showModal.value = false;
  } catch (error) {
    showScreenError(error, "版本信息加载失败");
    version.current = formatLocalScreenVersion(resolveLocalScreenVersionNo());
    version.notes = splitOtaNotes(readLocalScreenChangelog());
    phase.value = "latest";
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.home);
}

function skipModal() {
  showModal.value = false;
}

function upgradeNow() {
  showModal.value = false;
  startUpdate();
}

function startUpdate() {
  showModal.value = false;
  if (latestUrl) {
    openOtaPackage(latestUrl);
  }
  phase.value = "updating";
  stopTimer();
  timer = setInterval(() => {
    if (progress.value >= 100) {
      stopTimer();
      commitLocalScreenVersion(latestVersionNo, latestChangelog);
      version.current = formatLocalScreenVersion(resolveLocalScreenVersionNo());
      version.notes = splitOtaNotes(readLocalScreenChangelog());
      phase.value = "latest";
      progress.value = 0;
      showModal.value = false;
      return;
    }
    progress.value = Math.min(100, progress.value + 2);
  }, 80);
}

function pauseUpdate() {
  stopTimer();
  phase.value = "available";
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
</script>

<style>
page {
  background: #fff;
}

.ver {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.ver__bar {
  height: calc(80 * var(--u));
}

.ver-hero {
  position: relative;
  margin: calc(40 * var(--u)) auto 0;
  width: calc(480 * var(--u));
  height: calc(480 * var(--u));
}

.ver-hero__blob {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.ver-hero__icon {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(124 * var(--u));
  height: calc(211 * var(--u));
  transform: translate(-50%, -50%);
}

.ver-hero__icon.is-latest {
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  transform: none;
}

.ver__title {
  display: block;
  margin-top: calc(32 * var(--u));
  text-align: center;
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.ver__sub {
  display: block;
  margin-top: calc(40 * var(--u));
  text-align: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #777;
}

.ver__btn {
  margin: calc(80 * var(--u)) auto 0;
  width: calc(480 * var(--u));
  height: calc(100 * var(--u));
  border-radius: calc(103 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.ver__btn--solid {
  background: #191919;
  color: #fff;
}

.ver__btn--ghost {
  background: rgba(25, 25, 25, 0.1);
  color: #333;
}

.ver-prog {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
}

.ver-prog__track {
  flex: 1;
  height: calc(16 * var(--u));
  background: #f2f3f5;
  border-radius: calc(26 * var(--u));
  overflow: hidden;
}

.ver-prog__fill {
  height: 100%;
  background: #191919;
  border-radius: calc(26 * var(--u));
}

.ver-prog__num {
  width: calc(100 * var(--u));
  text-align: right;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.ver-notes {
  margin-top: calc(80 * var(--u));
  display: flex;
  flex-direction: column;
}

.ver-notes__title {
  margin-bottom: calc(40 * var(--u));
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.ver-notes__line {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: 1.5;
  color: #777;
}

.ver-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ver-modal {
  width: calc(984 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u));
  padding: calc(48 * var(--u));
  box-sizing: border-box;
}

.ver-modal__hero {
  position: relative;
  margin: 0 auto;
  width: calc(220 * var(--u));
  height: calc(220 * var(--u));
}

.ver-modal__art {
  width: 100%;
  height: 100%;
}

.ver-modal__title {
  display: block;
  margin-top: calc(24 * var(--u));
  text-align: center;
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.ver-modal__head {
  display: block;
  margin-top: calc(32 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 700;
  color: #333;
}

.ver-modal__line {
  display: block;
  margin-top: calc(8 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: 1.5;
  color: #777;
}

.ver-modal__acts {
  margin-top: calc(40 * var(--u));
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.ver-modal__later,
.ver-modal__now {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.ver-modal__later {
  border: calc(3 * var(--u)) solid #191919;
  color: #191919;
  box-sizing: border-box;
}

.ver-modal__now {
  background: #191919;
  color: #fff;
}
</style>
